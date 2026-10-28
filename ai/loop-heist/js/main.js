/* 时光回放小偷 · 流程、输入与界面（绘制见 render.js，规则见 sim.js） */
(function () {
  'use strict';

  var SIM = window.LH_SIM;
  var RENDER = window.LH_RENDER;
  var AUDIO = window.LH_AUDIO;
  var LEVELS = window.LH_LEVELS;
  var STORE_KEY = 'loop_heist_progress_v1';
  var MAX_GHOSTS_DEFAULT = 5;
  var ALARM_MS = 1000;
  var MSG_MS = 1800;
  var KEY_ACTIONS = {
    ArrowUp: 'U', KeyW: 'U',
    ArrowDown: 'D', KeyS: 'D',
    ArrowLeft: 'L', KeyA: 'L',
    ArrowRight: 'R', KeyD: 'R',
    Space: 'W'
  };

  var state = {
    screen: 'menu',
    progress: loadProgress(),
    level: 0,
    ghosts: [],
    world: null,
    anim: null,
    alarmTimer: 0,
    shakeUntil: 0,
    msgTimer: 0
  };

  function $(id) { return document.getElementById(id); }

  function loadProgress() {
    var base = { unlocked: 1, best: {} };
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return base;
      var unlocked = Math.floor(Number(raw.unlocked));
      if (isFinite(unlocked)) base.unlocked = Math.min(Math.max(unlocked, 1), LEVELS.length);
      if (raw.best && typeof raw.best === 'object') {
        Object.keys(raw.best).forEach(function (k) {
          var i = Number(k);
          var v = Math.floor(Number(raw.best[k]));
          if (Number.isInteger(i) && i >= 0 && i < LEVELS.length && isFinite(v) && v >= 0 && v <= 99) {
            base.best[i] = v;
          }
        });
      }
    } catch (e) {
      return base;
    }
    return base;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.progress));
    } catch (e) {
      /* 隐私模式或配额不足时仅丢失存档，不影响游玩 */
    }
  }

  function maxGhosts() {
    return LEVELS[state.level].maxGhosts || MAX_GHOSTS_DEFAULT;
  }

  /* 警报期间玩家仍可重来/选关：必须同时清掉待触发的轮回，否则定时器句柄残留会让 act() 永久早退。 */
  function clearAlarm() {
    clearTimeout(state.alarmTimer);
    state.alarmTimer = 0;
  }

  function snapshot(w) {
    return {
      bodies: w.bodies.map(function (b) { return { x: b.x, y: b.y }; }),
      guards: w.guards.map(function (g) { return { x: g.x, y: g.y }; })
    };
  }

  function message(text) {
    var el = $('msg');
    el.textContent = text;
    clearTimeout(state.msgTimer);
    state.msgTimer = setTimeout(function () { el.textContent = ''; }, MSG_MS);
  }

  function updateHud() {
    var w = state.world;
    $('lvlName').textContent = LEVELS[state.level].name;
    $('hint').textContent = LEVELS[state.level].hint;
    $('loopInfo').textContent = '幽灵 ' + state.ghosts.length + '/' + maxGhosts();
    $('lootInfo').textContent = '宝物 ' + w.lootCount + '/' + w.lootTotal;
    $('plateInfo').textContent = w.plates.length
      ? '压力板 ' + w.pressedCount + '/' + w.plates.length
      : '';
    $('tickInfo').textContent = '回合 ' + w.tick;
    // 走过至少一步后，「轮回」才真正可用，此时给它主操作的高亮
    var canLoop = w.status === 'play' && w.history.length > 0 && state.ghosts.length < maxGhosts();
    $('btnLoop').classList.toggle('ready', canLoop);
    $('btnLoop').disabled = !canLoop;
  }

  /* 关卡提示折叠：短视口默认收起，展开后仍完整显示，不再整体隐藏 */
  function applyHintCollapsed(collapsed) {
    var row = document.querySelector('.hud-hint-row');
    var btn = $('btnHint');
    if (row) row.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    if (btn) {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.textContent = collapsed ? '提示' : '收起';
    }
  }

  function newAttempt() {
    state.world = SIM.createWorld(LEVELS[state.level], state.ghosts);
    state.anim = null;
    RENDER.fit(state.world);
    updateHud();
  }

  function startLevel(i) {
    if (!LEVELS[i]) return;
    clearAlarm();
    state.level = i;
    state.ghosts = [];
    state.shakeUntil = 0;
    // 短视口默认收起提示，保留随时展开的入口
    applyHintCollapsed(window.matchMedia && window.matchMedia('(max-height: 520px)').matches);
    showScreen('game');
    newAttempt();
  }

  function showScreen(name) {
    clearAlarm();
    clearTimeout(state.msgTimer);
    var toast = $('msg');
    if (toast) toast.textContent = '';
    state.screen = name;
    $('menu').hidden = name !== 'menu';
    $('game').hidden = name !== 'game';
    $('overlay').hidden = true;
    if (name === 'menu') buildMenu();
    if (name === 'game' && state.world) RENDER.fit(state.world);
  }

  function buildMenu() {
    var list = $('levelList');
    list.innerHTML = '';
    LEVELS.forEach(function (lvl, i) {
      var locked = i >= state.progress.unlocked;
      var btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.disabled = locked;
      var best = state.progress.best[i];
      var title = document.createElement('span');
      title.className = 'level-title';
      title.textContent = (i + 1) + '. ' + lvl.name;
      var meta = document.createElement('span');
      meta.className = 'level-meta';
      meta.textContent = locked ? '未解锁' : (best === undefined ? '未通关' : '最佳 ' + best + ' 次轮回');
      btn.appendChild(title);
      btn.appendChild(meta);
      btn.addEventListener('click', function () { startLevel(i); });
      list.appendChild(btn);
    });
  }

  function toggleMute() {
    AUDIO.setMuted(!AUDIO.isMuted());
    $('btnMute').textContent = AUDIO.isMuted() ? '声音 关' : '声音 开';
  }

  /* 幽灵录像 = 当前尝试的玩家动作序列；失败的尝试同样会留下幽灵 */
  function loopAttempt() {
    var w = state.world;
    if (w.status === 'win') return;
    if (!w.history.length) {
      message('先走一步再轮回');
      return;
    }
    if (state.ghosts.length >= maxGhosts()) {
      if (w.status === 'caught') return showOver('lose');
      message('幽灵已达上限，按 X 重来本关');
      return;
    }
    state.ghosts.push(w.history.slice());
    AUDIO.loop();
    newAttempt();
  }

  function resetLevel() {
    if (state.screen !== 'game') return;
    clearAlarm();
    state.ghosts = [];
    state.shakeUntil = 0;
    $('overlay').hidden = true;
    newAttempt();
    message('重新开始');
  }

  function act(action) {
    var w = state.world;
    if (!w || w.status !== 'play' || state.alarmTimer) return;
    if (action === 'LOOP') return loopAttempt();

    var before = snapshot(w);
    var lootBefore = w.lootCount;
    SIM.step(w, action);
    state.anim = { from: before, t0: performance.now() };

    if (w.status === 'win') return onWin();
    if (w.status === 'caught') return onCaught();
    if (w.lootCount > lootBefore) AUDIO.loot(); else AUDIO.step();
    updateHud();
  }

  function onCaught() {
    var caught = state.world.caughtBy;
    message(caught && caught.body > 0 ? '幽灵被守卫发现，本轮提前结束' : '被守卫发现，本轮结束');
    AUDIO.alarm();
    state.shakeUntil = performance.now() + ALARM_MS;
    updateHud();
    state.alarmTimer = setTimeout(function () {
      state.alarmTimer = 0;
      if (state.ghosts.length >= maxGhosts()) return showOver('lose');
      loopAttempt();
    }, ALARM_MS);
  }

  function onWin() {
    AUDIO.win();
    var loops = state.ghosts.length;
    var prev = state.progress.best[state.level];
    if (prev === undefined || loops < prev) state.progress.best[state.level] = loops;
    state.progress.unlocked = Math.max(state.progress.unlocked, Math.min(state.level + 2, LEVELS.length));
    saveProgress();
    updateHud();
    showOver('win');
  }

  function showOver(kind) {
    var win = kind === 'win';
    var loops = state.ghosts.length;
    $('overTitle').textContent = win ? '通关！' : '本轮失败';
    $('overText').textContent = win
      ? '用了 ' + loops + ' 次轮回完成本关。'
      : '幽灵已达上限，本关无法继续。按 X 或点击下方按钮重来。';
    $('btnNext').hidden = !(win && state.level + 1 < LEVELS.length);
    $('btnRetry').hidden = false;
    $('overlay').hidden = false;
  }

  function onKeyDown(e) {
    if (state.screen !== 'game') return;
    if (e.key === 'Escape') return showScreen('menu');
    if (e.repeat) return;
    if (e.code === 'KeyR') { e.preventDefault(); AUDIO.unlock(); return act('LOOP'); }
    if (e.code === 'KeyX') { e.preventDefault(); return resetLevel(); }
    if (e.code === 'KeyM') return toggleMute();
    var a = KEY_ACTIONS[e.code];
    if (a) {
      e.preventDefault();
      AUDIO.unlock();
      act(a);
    }
  }

  /* 控件点击后必须失焦：否则空格（游戏内的“等待”）会顺带再次激活该按钮，造成一次输入触发两遍。 */
  function onControl(el, fn) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      AUDIO.unlock();
      fn();
      el.blur();
    });
  }

  function bindControls() {
    document.addEventListener('keydown', onKeyDown);

    document.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        AUDIO.unlock();
        act(btn.getAttribute('data-act'));
        btn.blur();
      });
    });

    onControl($('btnLoop'), function () { act('LOOP'); });
    onControl($('btnReset'), resetLevel);
    onControl($('btnMenu'), function () { showScreen('menu'); });
    onControl($('btnMute'), toggleMute);
    onControl($('btnHint'), function () {
      var row = document.querySelector('.hud-hint-row');
      applyHintCollapsed(!(row && row.getAttribute('data-collapsed') === 'true'));
    });
    onControl($('btnNext'), function () { startLevel(state.level + 1); });
    onControl($('btnRetry'), function () { startLevel(state.level); });
    onControl($('btnOverMenu'), function () { showScreen('menu'); });

    window.addEventListener('resize', function () {
      if (state.screen === 'game' && state.world) RENDER.fit(state.world);
    });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (state.screen !== 'game' || !state.world) return;
    var anim = state.anim;
    if (anim && now - anim.t0 >= 200) state.anim = null;
    RENDER.draw(state.world, state.anim, now, now < state.shakeUntil);
  }

  function init() {
    RENDER.attach($('gameCanvas'));
    bindControls();
    $('btnMute').textContent = '声音 开';
    showScreen('menu');
    requestAnimationFrame(frame);
  }

  init();
})();
