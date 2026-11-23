/**
 * internet-museum · 导航滚动状态机、论坛楼层与 BBCode 解析的无头验证：node internet-museum/test.js
 * 用假时钟 + 最小 DOM 桩把 ES 模块源码当普通脚本执行，不依赖任何第三方库。
 * 只读：不写文件、不构建；app.bundle.js 是否与源码一致由 scripts/check.sh 调 build.js --check 负责。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = rel => fs.readFileSync(path.join(__dirname, rel), 'utf8');
// 与 build.js 同样的处理：去掉模块语法后当普通脚本执行
const strip = src => src.replace(/^import[^\n]*\n/gm, '').replace(/export\s+(const|class|function)\s+/g, '$1 ');

let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name);
  }
}

/* ---------- 假时钟：setTimeout 可确定性地推进 ---------- */
function makeClock() {
  let now = 0;
  let seq = 0;
  let created = 0;
  const pending = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; pending.set(id, { fn, at: now + ms }); created++; return id; },
    clearTimeout(id) { pending.delete(id); },
    now: () => now,
    size: () => pending.size,
    created: () => created,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [id, t] of pending) {
          if (t.at <= end && (!next || t.at < next.t.at)) next = { id, t };
        }
        if (!next) break;
        pending.delete(next.id);
        now = next.t.at;
        next.t.fn();
      }
      now = end;
    }
  };
}

/* ---------- 最小 DOM 桩 ---------- */
function makeNode() {
  const n = {
    children: [], _h: {}, _qs: {}, className: '', value: '', disabled: false, style: {}, rawHtml: '',
    classList: { add() {}, remove() {} },
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      return c;
    },
    addEventListener(t, fn) { (this._h[t] = this._h[t] || []).push(fn); },
    querySelector(sel) { if (!this._qs[sel]) this._qs[sel] = makeNode(); return this._qs[sel]; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0 }; },
    focus() {}
  };
  let text = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: v => { text = String(v); } });
  Object.defineProperty(n, 'innerHTML', { get: () => n.rawHtml, set: v => { n.rawHtml = String(v); } });
  return n;
}

const fire = (list, ev) => (list || []).forEach(fn => fn(ev));
const lastOf = arr => arr[arr.length - 1];

const ERAS = [1998, 2003, 2008, 2012, 2024, 2099].map((year, i) => ({
  year, name: '展厅' + i, speed: 's', statusText: 'st', themeColor: '#000'
}));

/* ================= 一、导航滚动状态机 ================= */
function loadNavigation() {
  const clock = makeClock();
  const gallery = {
    clientWidth: 1000, scrollLeft: 0, offsetLeft: 0, style: { removeProperty() {} }, handlers: {}, scrollToCalls: [],
    // 浏览器里 smooth 是异步动画：这里不立刻改 scrollLeft，由用例决定「何时抵达」或「被打断」
    scrollTo(o) { this.scrollToCalls.push(o); if (o.behavior === 'auto') this.scrollLeft = o.left; },
    scrollBy(o) { this.scrollLeft += o.left; },
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
  };
  const store = {
    state: { currentEra: 1998, eggs: [] }, updates: [],
    update(p) { this.updates.push(p); Object.assign(this.state, p); },
    getState() { return this.state; },
    subscribe() {}
  };
  const audio = { plays: 0, playEraTransition() { this.plays++; } };
  const eggs = { toasts: [], showToast(t) { this.toasts.push(t); } };
  const env = { overlayOpen: false, activeTag: null };
  const winHandlers = {};
  const sandbox = {
    console: console, navigator: {},
    performance: { now: () => clock.now() },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    ERAS_CONFIG: ERAS, EGGS_METADATA: { a: 1, b: 2 },
    museumStore: store, audioManager: audio, eggsManager: eggs,
    document: {
      querySelector(sel) {
        if (sel.indexOf('.museum-modal-backdrop') === 0) return env.overlayOpen ? {} : null;
        return sel === '.gallery' ? gallery : null;
      },
      querySelectorAll(sel) { return []; },
      getElementById() { return null; },
      get activeElement() { return env.activeTag ? { tagName: env.activeTag, isContentEditable: false } : null; }
    },
    window: {
      innerWidth: 1000,
      getComputedStyle() { return { overflowY: 'visible' }; },
      addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); }
    }
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(strip(read('js/navigation.js')), ctx, { filename: 'js/navigation.js' });
  const Nav = vm.runInContext('NavigationManager', ctx);
  return { nav: new Nav(), gallery, store, audio, eggs, clock, env, winHandlers };
}

console.log('导航：初始定位');
{
  const t = loadNavigation();
  const { nav, gallery, store, audio, eggs, clock } = t;
  const key = extra => fire(t.winHandlers.keydown, Object.assign({ key: 'ArrowRight', preventDefault() {} }, extra));

  nav.init();
  check('打开页面定位到上次的展厅：不滚动、不出声、不提示',
    gallery.scrollToCalls.length === 0 && audio.plays === 0 && eggs.toasts.length === 0);

  console.log('导航：跨展厅切换');
  key();
  check('ArrowRight 切到下一展厅：写 store、播一次音、提示一次',
    store.state.currentEra === 2003 && audio.plays === 1 && eggs.toasts.length === 1 && nav.currentIndex === 1);
  check('平滑滚动目标为下一展厅原点',
    JSON.stringify(lastOf(gallery.scrollToCalls)) === JSON.stringify({ left: 1000, behavior: 'smooth' }));
  check('滚动进行中处于程序态', nav.isProgrammaticScroll === true);
  clock.advance(450);
  check('450ms 后仍在滚动：保持程序态并续期', nav.isProgrammaticScroll === true && clock.size() === 1);
  gallery.scrollLeft = 1000;
  clock.advance(80);
  check('抵达后解除程序态', nav.isProgrammaticScroll === false && clock.size() === 0);
  const playsAfterArrive = audio.plays;
  check('抵达不产生额外的音效或提示', audio.plays === playsAfterArrive && eggs.toasts.length === 1);

  console.log('导航：程序滚动被手势打断');
  nav.goToEraByIndex(4);
  check('（前置）程序滚动进行中', nav.isProgrammaticScroll === true);
  fire(gallery.handlers.wheel, { deltaX: 120, deltaY: 0, target: gallery, preventDefault() {} });
  check('横向触控板滑动接管：立即放开程序态', nav.isProgrammaticScroll === false);

  nav.goToEraByIndex(5);
  fire(gallery.handlers.wheel, { deltaX: 0, deltaY: 100, target: gallery, preventDefault() {} });
  check('纵向滚轮转换为横移时：立即放开程序态', nav.isProgrammaticScroll === false && gallery.scrollLeft > 0);

  const mouseDown = gallery.handlers.mousedown[0];
  mouseDown({ button: 2, pageX: 10, target: { closest() { return null; } } });
  check('右键按下不进入拖拽态', nav.isDragging === false);
  nav.goToEraByIndex(3);
  mouseDown({ button: 0, pageX: 10, target: { closest() { return null; } } });
  check('左键按下可拖拽区：进入拖拽态并放开程序态', nav.isDragging === true && nav.isProgrammaticScroll === false);
  nav.isDragging = false;

  nav.goToEraByIndex(2);
  fire(gallery.handlers.touchmove);
  check('触摸拖动：放开程序态', nav.isProgrammaticScroll === false);

  console.log('导航：没被手势钩子覆盖的打断（超时兜底）');
  const createdBefore = clock.created();
  nav.goToEraByIndex(4);           // 目标：第 4 个展厅（2024）
  gallery.scrollLeft = 3000;       // 浏览器因焦点变化等原因此刻停在了第 3 个展厅（2012）
  clock.advance(10000);
  check('超时后放开程序态，轮询不再续期', nav.isProgrammaticScroll === false && clock.size() === 0);
  check('轮询次数有上限', clock.created() - createdBefore <= 45);
  check('没抵达目标时以实际位置为准：store 与当前展厅同步为实际所在的 2012',
    store.state.currentEra === 2012 && nav.currentIndex === 3);
  // 此后手动滚动应恢复生效：滚动监听器不再被程序态屏蔽
  gallery.scrollLeft = 5000;
  fire(gallery.handlers.scroll);
  clock.advance(60);
  check('程序态放开后手动滚动重新同步时代', store.state.currentEra === 2099 && nav.currentIndex === 5);

  console.log('导航：挂起中的检测定时器');
  nav.currentIndex = 0;
  store.state.currentEra = 1998;
  gallery.scrollLeft = 0;
  fire(gallery.handlers.scroll);   // 手动滚动排定了一次 60ms 后的检测
  key();                           // 检测还没执行就开始了程序滚动
  clock.advance(60);
  check('程序滚动途中，先前排定的检测不会把别的展厅写进 store，也不多播一次音',
    store.state.currentEra === 2003 && nav.currentIndex === 1);

  console.log('导航：同厅回弹');
  clock.advance(600);
  gallery.scrollLeft = 1000;
  nav.goToEraByIndex(1);           // 先把位置与状态对齐，作为下面用例的起点
  clock.advance(600);
  const base = { u: store.updates.length, p: audio.plays, t: eggs.toasts.length, s: gallery.scrollToCalls.length };
  gallery.scrollLeft = 1040;
  nav.goToEraByIndex(1);           // snapToNearestEra 在同厅小幅拖动后做的事
  check('同厅内偏移 40px 松手：只回弹到展厅原点',
    gallery.scrollToCalls.length === base.s + 1 &&
    JSON.stringify(lastOf(gallery.scrollToCalls)) === JSON.stringify({ left: 1000, behavior: 'smooth' }));
  check('同厅回弹不写 store、不出声、不提示',
    store.updates.length === base.u && audio.plays === base.p && eggs.toasts.length === base.t);
  gallery.scrollLeft = 1000;
  clock.advance(600);
  nav.goToEraByIndex(1);
  check('同厅且已对齐：直接返回，不触发滚动', gallery.scrollToCalls.length === base.s + 1);

  console.log('导航：键盘');
  let prevented = 0;
  t.env.overlayOpen = true;
  key({ preventDefault() { prevented++; } });
  check('遮罩打开时方向键不切展厅', nav.currentIndex === 1 && store.updates.length === base.u);
  check('遮罩打开时拦掉方向键的原生滚动（焦点不在输入控件内）', prevented === 1);
  t.env.activeTag = 'TEXTAREA';
  key({ preventDefault() { prevented++; } });
  check('焦点在输入控件内时不拦截（光标移动要用）', prevented === 1);
  t.env.activeTag = null;
  t.env.overlayOpen = false;
  key({ ctrlKey: true });
  key({ key: 'ArrowLeft', altKey: true });
  check('带 Ctrl / Alt 的组合键不切展厅（留给浏览器的后退等快捷键）', nav.currentIndex === 1);
  key({ repeat: true });
  check('按住不放的系统自动重复不连续跳厅', nav.currentIndex === 1 && audio.plays === base.p);
  ['TEXTAREA', 'INPUT', 'SELECT'].forEach(tag => { t.env.activeTag = tag; key(); });
  check('焦点在输入框 / 下拉框内时方向键不切展厅', nav.currentIndex === 1);
  t.env.activeTag = null;
  key();
  check('无遮罩、无修饰键、非自动重复、焦点不在输入控件：方向键正常切展厅',
    nav.currentIndex === 2 && store.state.currentEra === 2008);

  console.log('导航：窗口尺寸变化');
  gallery.scrollLeft = 2000;
  clock.advance(1000);
  const before = gallery.scrollToCalls.length;
  const playsBefore = audio.plays;
  const toastsBefore = eggs.toasts.length;
  fire(t.winHandlers.resize);
  clock.advance(150);
  check('只有高度变化（如地址栏收放）：不重新对齐，不打断用户', gallery.scrollToCalls.length === before);
  gallery.clientWidth = 800;
  fire(t.winHandlers.resize);
  clock.advance(150);
  check('宽度变化：按新宽度静默对齐当前展厅',
    gallery.scrollToCalls.length === before + 1 &&
    JSON.stringify(lastOf(gallery.scrollToCalls)) === JSON.stringify({ left: 1600, behavior: 'auto' }) &&
    audio.plays === playsBefore && eggs.toasts.length === toastsBefore);
}

/* ================= 二、论坛：楼层 ================= */
const FLOOR_TAG_RE = /class="floor-tag">([^<]*)</;

function loadForum(savedReplies) {
  const clock = makeClock();
  const registry = {};
  ['era-2008', 'forum-floors-list', 'btn-forum-load-more', 'btn-forum-upvote', 'forum-upvote-count',
    'forum-hot-badge', 'forum-reply-input', 'btn-forum-submit-reply', 'forum-ghost-online']
    .forEach(id => { registry[id] = makeNode(); });
  const floors = registry['forum-floors-list'];
  floors.querySelectorAll = () => floors.children
    .map(c => { const m = FLOOR_TAG_RE.exec(c.rawHtml); return m ? { textContent: m[1] } : null; })
    .filter(Boolean);
  // 存档对象原样交给模块，用例结束后检查它没有被改写
  const store = {
    state: { forumReplies: savedReplies, forumUpvotes: 3 }, updates: [],
    update(p) { this.updates.push(p); Object.assign(this.state, p); },
    getState() { return this.state; }
  };
  const toasts = [];
  const sandbox = {
    console: console, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    requestAnimationFrame(fn) { fn(); },
    museumStore: store,
    audioManager: { playClick() {}, playForumPostSound() {} },
    eggsManager: { showToast(msg) { toasts.push(msg); }, triggerEgg() {} },
    document: {
      getElementById(id) { return registry[id] || null; },
      createElement() { return makeNode(); },
      body: makeNode(),
      addEventListener() {}
    },
    window: { addEventListener() {} }
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(strip(read('js/eras/era-2008.js')), ctx, { filename: 'js/eras/era-2008.js' });
  vm.runInContext('initEra2008()', ctx);
  const click = id => fire(registry[id]._h.click);
  return {
    clock, registry, store, toasts, floors,
    labels: () => floors.querySelectorAll().map(x => x.textContent),
    numbers: () => floors.querySelectorAll().map(x => parseInt(x.textContent, 10)),
    loadMore() { click('btn-forum-load-more'); clock.advance(500); },
    reply(text) { registry['forum-reply-input'].value = text; click('btn-forum-submit-reply'); },
    /** 点第 floorIndex 个楼层的「引用回复」 */
    quote(floorIndex) { fire(floors.children[floorIndex]._qs['.btn-quote-reply']._h.click); },
    format: vm.runInContext('formatForumContent', ctx)
  };
}

const LONG_REPLY = '这是一条足够长的测试回帖正文内容，用来通过十五字校验。';
const QUOTE_ONLY = '[quote][b]午夜游民[/b] 在 1 楼 (楼主) 说道：\n最近一连几天，我房间那台联想锋行电脑……[/quote]\n';
const LEGACY_REPLY = { floor: '4 楼', user: '我 (考古学者)', rank: '游侠大虾', avatar: '🤠', time: '02:30:00', content: '旧回帖', signature: 's' };
const LEGACY_BOT = { floor: '5 楼', user: '深夜夜猫子', rank: '潜水员', avatar: '🌙', time: '02:30:01', content: '[quote]回复 4 楼[/quote]\n旧跟帖', signature: 's' };

console.log('论坛：校验');
{
  const f = loadForum([]);
  f.reply(QUOTE_ONLY);
  check('只有引用样板、正文为空：拦截并提示', f.toasts.length === 1 && f.toasts[0].indexOf('不少于 15 字') !== -1);
  check('被拦截的回帖不追加楼层', f.numbers().join('-') === '1-2-3');
  f.reply(LONG_REPLY);
  check('正文足够长：放行', f.registry['btn-forum-submit-reply'].disabled === true);
}

console.log('论坛：先回帖、后展开历史楼层');
{
  const f = loadForum([]);
  f.reply(LONG_REPLY);
  f.clock.advance(800);
  check('未展开历史楼层时回帖：楼号排在历史楼层（4、5 楼）之后',
    f.labels().join('|') === '1 楼 (楼主)|2 楼 (沙发)|3 楼 (板凳)|6 楼');
  f.clock.advance(700);
  check('机器人跟帖顺延为 7 楼', f.numbers().join('-') === '1-2-3-6-7');
  f.loadMore();
  check('再展开历史楼层：插在 3 楼与回帖之间，楼序为 1-2-3-4-5-6-7', f.numbers().join('-') === '1-2-3-4-5-6-7');
  check('回帖与跟帖均已持久化', f.store.state.forumReplies.map(p => p.floor).join(',') === '6 楼,7 楼');
}

console.log('论坛：回访用户（存档里的回帖）');
{
  const f = loadForum([LEGACY_REPLY, LEGACY_BOT]);
  f.loadMore();
  check('展开历史楼层后楼序为 1-2-3-4-5-6-7，没有重复楼号', f.numbers().join('-') === '1-2-3-4-5-6-7');
  check('存档里的回帖按顺序展示为 6 楼、7 楼', f.labels().slice(5).join('|') === '6 楼|7 楼');
  f.quote(5);
  check('引用存档回帖时，模板里用的是展示楼号（6 楼）',
    f.registry['forum-reply-input'].value.indexOf('在 6 楼 说道') !== -1);
  f.reply(LONG_REPLY);
  f.clock.advance(800);
  check('新回帖接在最大楼号之后：8 楼', f.numbers().join('-') === '1-2-3-4-5-6-7-8');
  check('展示用的楼号不回写存档（存档里仍是原值）',
    f.store.state.forumReplies.slice(0, 2).map(p => p.floor).join(',') === '4 楼,5 楼');
}

console.log('论坛：展开与回帖同时进行');
{
  const f = loadForum([]);
  f.registry['btn-forum-load-more']._h.click.forEach(fn => fn());
  f.reply(LONG_REPLY); // 读取历史楼层的 500ms 窗口内提交回帖
  f.clock.advance(500);
  check('历史楼层先到：1-2-3-4-5', f.numbers().join('-') === '1-2-3-4-5');
  f.clock.advance(300);
  check('回帖后到：接在 5 楼之后，楼序为 1-2-3-4-5-6', f.numbers().join('-') === '1-2-3-4-5-6');
}

/* ================= 三、论坛：BBCode 解析 ================= */
console.log('论坛：BBCode 解析');
{
  const f = loadForum([]);
  const fmt = f.format;
  check('普通文本原样保留', fmt('大家好') === '大家好');
  check('HTML 被转义，不可注入', fmt('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');
  check('成对 [b] 渲染为加粗', fmt('这是[b]重点[/b]内容') === '这是<strong>重点</strong>内容');
  check('成对 [quote] 渲染为引用块',
    fmt('[quote]原话[/quote]回复') === '<blockquote class="forum-quote-box">原话</blockquote>回复');
  check('引用块内的加粗照常生效，且不会被包进 <strong>',
    fmt('[quote][b]甲[/b] 在 3 楼 说道：\n片段[/quote]\n正文') ===
    '<blockquote class="forum-quote-box"><strong>甲</strong> 在 3 楼 说道：<br>片段</blockquote><br>正文');
  check('未闭合的 [quote] 不漏出字面量', fmt('[quote]只有开头') === '只有开头');
  check('错配的结束标签被剥离', fmt('[b]甲[/quote]') === '甲');
  check('嵌套引用不漏出外层标签', fmt('[quote][quote]a[/quote]b[/quote]') ===
    '<blockquote class="forum-quote-box">a</blockquote>b');
  check('引用被 [b] 包裹时不产生 block 嵌进行内标签', fmt('[b][quote]x[/quote][/b]') ===
    '<blockquote class="forum-quote-box">x</blockquote>');
  check('换行转为 <br>', fmt('第一行\n第二行') === '第一行<br>第二行');
}

console.log(failed === 0 ? '全部通过' : failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
