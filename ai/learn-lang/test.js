/**
 * learn-lang · 课程解锁链、路由落锚与社区交互的无头验证：node learn-lang/test.js
 * 用最小 DOM 桩加载 js/app.js，真实执行业务逻辑；不依赖任何第三方库。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appSrc = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

/* ---------- 最小 DOM / BOM 桩 ---------- */
const registry = new Map();
const handlers = {};
const hashWrites = [];      // location.hash 被赋值的记录（每条对应一次历史记录压入）
const replaceStates = [];   // history.replaceState 的记录（不压入历史）
const likeButtons = new Map();
let doc;

function makeEl(id) {
  const el = {
    id: id, dataset: {}, style: {}, disabled: false, value: '', _class: new Set(), _attrs: {},
    classList: {
      add() { for (const c of arguments) el._class.add(c); },
      remove() { for (const c of arguments) el._class.delete(c); },
      toggle(c, force) {
        const on = force === undefined ? !el._class.has(c) : !!force;
        if (on) el._class.add(c); else el._class.delete(c);
        return on;
      },
      contains(c) { return el._class.has(c); }
    },
    setAttribute(k, v) { el._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k) ? el._attrs[k] : null; },
    removeAttribute(k) { delete el._attrs[k]; },
    addEventListener() {},
    focus() { doc.activeElement = el; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  let text = '';
  let html = '';
  Object.defineProperty(el, 'textContent', { get: () => text, set: v => { text = String(v); } });
  // 与浏览器一致：写 innerHTML 之后 textContent 是去掉标签后的文本
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set: v => { html = String(v); text = html.replace(/<[^>]*>/g, ''); }
  });
  return el;
}

// 六个视图容器，以及侧栏 + 移动端两套导航（各 4 项）
const ROUTES = ['home', 'dashboard', 'course', 'learn', 'community', 'login'];
// 奖励文案节点带着页面里的初始 HTML：app.js 第一次读它的 innerHTML 当作「发奖时的默认文案」
const REWARD_HTML_MATCH = /<p id="learn-reward-text"[^>]*>([\s\S]*?)<\/p>/.exec(pageSrc);
const viewEls = ROUTES.map(r => makeEl('view-' + r));
const navEls = [].concat(
  ['home', 'dashboard', 'course', 'community'],
  ['home', 'dashboard', 'course', 'community']
).map(r => { const el = makeEl(''); el.dataset.nav = r; return el; });

doc = {
  activeElement: null,
  getElementById(id) {
    if (!registry.has(id)) {
      registry.set(id, makeEl(id));
      if (id === 'learn-reward-text' && REWARD_HTML_MATCH) registry.get(id).innerHTML = REWARD_HTML_MATCH[1];
    }
    return registry.get(id);
  },
  createElement() { return makeEl(''); },
  querySelectorAll(sel) {
    if (sel === '.view-container') return viewEls;
    if (sel === '[data-nav]') return navEls;
    return [];
  },
  // 只实现点赞就地更新用到的那一种选择器；节点不存在时返回 null，与浏览器一致
  querySelector(sel) {
    const m = /^#community-feed \[data-like-id="(\d+)"\]$/.exec(sel);
    if (!m) return null;
    const feed = registry.get('community-feed');
    if (!feed || feed.innerHTML.indexOf('data-like-id="' + m[1] + '"') === -1) return null;
    if (!likeButtons.has(m[1])) {
      const btn = makeEl('');
      const icon = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
      const count = { textContent: '' };
      btn.icon = icon;
      btn.count = count;
      btn.querySelector = q => (q === 'svg' ? icon : q === '.like-count' ? count : null);
      likeButtons.set(m[1], btn);
    }
    return likeButtons.get(m[1]);
  },
  addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
  dispatch(type, ev) { (handlers[type] || []).forEach(fn => fn(ev || { target: null })); },
  body: { appendChild() {} }
};

const store = {};
// 与浏览器一致：赋值不带 # 时自动补上
const location = {
  _hash: '',
  get hash() { return this._hash; },
  set hash(v) {
    const h = String(v).charAt(0) === '#' ? String(v) : '#' + v;
    hashWrites.push(h);
    this._hash = h;
  }
};

const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, Date: Date,
  document: doc, location: location, navigator: {}, scrollTo() {},
  HTMLElement: class {},
  history: { replaceState(a, b, url) { replaceStates.push(url); location._hash = url; } },
  localStorage: {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(appSrc, ctx, { filename: 'js/app.js' });
const run = code => vm.runInContext(code, ctx);

/* ---------- 断言与辅助 ---------- */
let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name);
  }
}

const MODULES = ['m1', 'm2', 'm3', 'm4', 'm5'];

/** 课程页各模块的锁定态：取 renderCourse 生成的卡片 onclick 里的 isLocked 字面量 */
function lockStates() {
  run('renderCourse()');
  const html = doc.getElementById('course-module-list').innerHTML;
  const out = {};
  MODULES.forEach(id => {
    const m = new RegExp("handleModuleClick\\('" + id + "', '[a-z]+', (true|false)\\)").exec(html);
    out[id] = m ? m[1] === 'true' : null;
  });
  return out;
}

const completed = () => run('STATE.progress.completedModules.slice()');
const exp = () => run('STATE.progress.exp');
const hint = () => doc.getElementById('learn-unlock-hint').textContent;
const title = () => doc.getElementById('learn-module-title').textContent;
const rewardText = () => doc.getElementById('learn-reward-text').textContent;
const savedProgress = () => JSON.parse(store.linguajourney_state_v1).progress;

/** 把当前这组闪卡学完（3 张，每张翻面后点下一个） */
function finishSession() {
  for (let i = 0; i < 3; i++) { run('toggleCardFlip()'); run('nextCard()'); }
}

/** 从课程卡片进入某模块并学完整组闪卡，返回本次会话归属的模块 */
function studyModule(id, type) {
  run("location.hash = '#course'; handleHashChange()"); // 课程卡片只在课程页可见
  const before = hashWrites.length;
  run("handleModuleClick('" + id + "', '" + type + "', false)");
  // 浏览器里 hashchange 是异步派发；hash 未变化时 navigate 已同步渲染，不会再派发该事件
  if (hashWrites.length > before) run('handleHashChange()');
  const active = run('STATE.activeModuleId');
  finishSession();
  return active;
}

/** 通用入口（首页 / 学习中心的闪卡入口，不带模块）进入并学完 */
function studyGeneric() {
  run("location.hash = '#course'; handleHashChange()");
  run("navigate('learn')"); run('handleHashChange()');
  finishSession();
}

/* ---------- 用例 ---------- */
console.log('路由：首次加载不压入多余历史记录');
doc.dispatch('DOMContentLoaded');
check('空 hash 首次加载不改写 location.hash（不压入历史记录）', hashWrites.length === 0);
check('空 hash 首次加载用 replaceState 落锚到 #home',
  replaceStates.length === 1 && replaceStates[0] === '#home');
check('落锚后当前路由为 home', run('STATE.currentRoute') === 'home');

console.log('课程：锁定规则');
let locks = lockStates();
check('初始 m2 / m3 开放', locks.m2 === false && locks.m3 === false);
check('初始 m4 / m5 锁定（前序未完成）', locks.m4 === true && locks.m5 === true);
run("handleModuleClick('m4', 'listening', true)");
check('点击锁定模块：不进入学习页', location.hash === '#home');
check('点击锁定模块：给出原因提示',
  doc.getElementById('toast').textContent.indexOf('先完成前置模块') !== -1);

console.log('课程：通用入口（非课程卡片）');
studyGeneric();
check('通用入口进入：会话不归属任何模块', run('STATE.activeModuleId') === null);
check('通用入口进入：标题不带模块名', title() === '核心词汇互动闪卡');
check('通用会话学完：不改变完成记录', JSON.stringify(completed()) === JSON.stringify(['m1']));
check('通用会话学完：如实提示未计入模块进度',
  hint() === '本次为通用练习，未计入模块进度；从课程页的模块卡片进入才会记入对应模块');
check('首次学完的会话（此处是通用练习）发放 50 EXP', exp() === 95 && run('STATE.progress.rewardGranted') === true);
check('发奖当时落库的已是「已发奖」标记（顺序颠倒的话这里会是 false，刷新后可重复领奖）',
  savedProgress().rewardGranted === true && savedProgress().exp === 95);
check('首次发奖时结算区提 +50 EXP',
  rewardText() === '已成功掌握本组高频词汇，首次完成奖励 +50 EXP！');
run("STATE.pendingModuleId = 'm4'; navigate('learn')"); run('handleHashChange()');
check('上次点到一半的待认领模块不会被新会话采用',
  run('STATE.activeModuleId') === null && run('STATE.pendingModuleId') === null);

console.log('课程：解锁链 m2 → m3 → m4 → m5');
check('从 m2 卡片进入时会话归属 m2，标题显示模块名',
  studyModule('m2', 'speaking') === 'm2' && title().indexOf('主持英文例会') !== -1);
check('学完 m2：完成记录落库', JSON.stringify(completed()) === JSON.stringify(['m1', 'm2']));
check('学完 m2：奖励不重复发放', exp() === 95);
check('学完 m2：本次没发奖，结算区不提 +50 EXP', rewardText() === '已成功掌握本组高频词汇，继续保持！');
check('学完 m2：m3 本就开放，提示不称「解锁」', hint() === '下一模块：3. 商务邮件撰写规范');
check('完成记录已写入本地存储',
  JSON.stringify(savedProgress().completedModules) === JSON.stringify(['m1', 'm2']));

studyModule('m3', 'grammar');
locks = lockStates();
check('学完 m3：奖励不重复发放', exp() === 95);
check('学完 m3：本次没发奖，结算区不再提 +50 EXP', rewardText() === '已成功掌握本组高频词汇，继续保持！');
check('学完 m3：m4 解锁，m5 仍锁定', locks.m4 === false && locks.m5 === true);
check('学完 m3：提示解锁 m4', hint() === '已解锁下一模块：4. 听懂带口音的客户');

studyModule('m4', 'listening');
check('学完 m4：m5 解锁', lockStates().m5 === false);

studyModule('m5', 'speaking');
check('学完 m5：五个模块全部完成', completed().length === 5);
check('学完 m5：提示全部完成', hint() === '全部 5 个模块均已完成，可随时回课程页复习');
locks = lockStates();
check('全部完成后不再有锁定模块', MODULES.every(id => locks[id] === false));

console.log('课程：复习与跳着学');
check('复习已完成的模块：不重复记录，如实提示此前已完成',
  studyModule('m3', 'grammar') === 'm3' && completed().length === 5 &&
  hint() === '复习完成：「商务邮件撰写规范」此前已完成');
// 模拟一份跳着学的存档：做过 m3、m4，漏了 m2，现在学最后一个模块
run("STATE.progress.completedModules = ['m1', 'm3', 'm4']");
studyModule('m5', 'speaking');
check('跳着学到最后一模块：如实提示还有未完成的模块',
  completed().length === 4 && hint() === '已是最后一个模块；还有 主持英文例会 未完成，可回课程页补学');

console.log('课程：已在学习页时课程卡片被重复触发');
run("location.hash = '#course'; handleHashChange()");
run("handleModuleClick('m3', 'grammar', false)"); // hash 已是 #learn，hashchange 在排队
run("handleModuleClick('m3', 'grammar', false)");        // 它派发之前卡片又被触发了一次
run('handleHashChange()');                               // 排队的 hashchange 此刻才派发
check('会话归属不丢失（不会被重置成通用会话）', run('STATE.activeModuleId') === 'm3');

console.log('读屏与键盘');
run("location.hash = '#course'; handleHashChange()");
check('当前页的导航项标注 aria-current="page"',
  navEls.filter(e => e.dataset.nav === 'course').every(e => e.getAttribute('aria-current') === 'page'));
check('非当前页的导航项不带 aria-current',
  navEls.filter(e => e.dataset.nav !== 'course').every(e => e.getAttribute('aria-current') === null));
check('页面结构：两套导航有可读名称，品牌标可键盘聚焦',
  pageSrc.indexOf('aria-label="主导航"') !== -1 &&
  pageSrc.indexOf('aria-label="移动端导航"') !== -1 &&
  /class="brand"[^>]*role="button"[^>]*tabindex="0"/.test(pageSrc));
check('页面结构：学习页标题、解锁提示与奖励文案节点存在（app.js 依赖这三个 id）',
  pageSrc.indexOf('id="learn-module-title"') !== -1 &&
  pageSrc.indexOf('id="learn-unlock-hint"') !== -1 &&
  pageSrc.indexOf('id="learn-reward-text"') !== -1);

console.log('键盘：品牌标回首页');
{
  let clicks = 0;
  let prevented = 0;
  // 真实浏览器里 keydown 的 target 是聚焦的元素；这里造一个「就是品牌标」的目标
  const brand = Object.create(sandbox.HTMLElement.prototype);
  brand.matches = sel => sel.indexOf('.brand') !== -1;
  brand.click = () => { clicks++; run("navigate('home')"); }; // 等同 HTML 上的 onclick="navigate('home')"
  run("location.hash = '#community'; handleHashChange()");
  doc.dispatch('keydown', { key: 'Enter', target: brand, preventDefault() { prevented++; } });
  check('品牌标上按 Enter：触发点击并回到首页', clicks === 1 && prevented === 1 && location.hash === '#home');
  doc.dispatch('keydown', { key: ' ', target: brand, preventDefault() { prevented++; } });
  check('品牌标上按空格同样触发', clicks === 2);
  doc.dispatch('keydown', { key: 'a', target: brand, preventDefault() { prevented++; } });
  check('品牌标上按其他键不触发', clicks === 2 && prevented === 2);
  const plain = Object.create(sandbox.HTMLElement.prototype);
  plain.matches = () => false; // 不在委托选择器里的普通可聚焦元素
  plain.click = () => { clicks += 100; };
  run("location.hash = '#community'; handleHashChange()");
  doc.dispatch('keydown', { key: 'Enter', target: plain, preventDefault() { prevented++; } });
  check('不在委托范围内的元素上按 Enter：不触发点击、不拦截默认行为', clicks === 2 && prevented === 2 && location.hash === '#community');
}

console.log('社区：点赞就地更新');
run("location.hash = '#community'; handleHashChange()");
const feedBefore = doc.getElementById('community-feed').innerHTML;
check('点赞按钮带 data-like-id 与 aria-pressed',
  feedBefore.indexOf('data-like-id="1"') !== -1 && feedBefore.indexOf('aria-pressed="false"') !== -1);
run('toggleLike(1)');
const likeBtn = likeButtons.get('1');
check('点赞：计数 +1，且信息流未被整体重建（焦点得以保留）',
  !!likeBtn && likeBtn.count.textContent === 125 && likeBtn._class.has('liked') &&
  doc.getElementById('community-feed').innerHTML === feedBefore);
check('点赞：按钮状态同步（aria-pressed 与图标填充）',
  !!likeBtn && likeBtn.getAttribute('aria-pressed') === 'true' && likeBtn.icon.attrs.fill === '#ef4444');
run('toggleLike(1)');
check('取消点赞：计数 -1 并还原',
  !!likeBtn && likeBtn.count.textContent === 124 && !likeBtn._class.has('liked'));
run('STATE.posts[0].likes = 0; STATE.posts[0].liked = true; toggleLike(1)');
check('计数不会出现负数', run('STATE.posts[0].likes') === 0);

console.log(failed === 0 ? '全部通过' : failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
