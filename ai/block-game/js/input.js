/* 输入：键盘、鼠标、指针锁定 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  function Input(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { left: false, right: false };
    this.lastSpace = 0;
    this.enabled = false; /* playing 状态才响应游戏键 */

    var self = this;
    this.onLook = null;          /* (dx, dy) */
    this.onSelect = null;        /* (index) */
    this.onScroll = null;        /* (dir) */
    this.onToggleInventory = null;
    this.onToggleFly = null;
    this.onToggleMute = null;
    this.onPick = null;
    this.onRequestLock = null;
    this.onLockChange = null;

    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;

      if (e.code === 'Escape') {
        /* 指针锁定时 ESC 由浏览器处理（退出锁定）；未锁定时用于关闭背包 */
        if (!self.isLocked() && self.onToggleInventory) self.onToggleInventory();
        return;
      }

      if (e.code === 'KeyE') { if (self.onToggleInventory) self.onToggleInventory(); return; }
      if (e.code === 'KeyM') { if (self.onToggleMute) self.onToggleMute(); return; }
      if (e.code === 'KeyF') { if (self.onToggleFly) self.onToggleFly(); return; }

      if (/^Digit[1-9]$/.test(e.code)) {
        if (self.onSelect) self.onSelect(+e.code.slice(5) - 1);
        return;
      }

      if (e.code === 'Space') {
        var now = performance.now();
        if (now - self.lastSpace < 280) {
          if (self.onToggleFly) self.onToggleFly();
          self.lastSpace = 0;
        } else {
          self.lastSpace = now;
        }
      }

      self.keys[e.code] = true;
    });

    document.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
    });

    window.addEventListener('blur', function () {
      self.keys = {};
      self.mouse.left = false;
      self.mouse.right = false;
    });

    document.addEventListener('mousemove', function (e) {
      if (!self.isLocked()) return;
      if (self.onLook) self.onLook(e.movementX || 0, e.movementY || 0);
    });

    canvas.addEventListener('mousedown', function (e) {
      if (!self.isLocked()) {
        if (self.onRequestLock) self.onRequestLock();
        return;
      }
      if (e.button === 0) self.mouse.left = true;
      else if (e.button === 1) {
        e.preventDefault();
        if (self.onPick) self.onPick();
      }
      else if (e.button === 2) self.mouse.right = true;
    });

    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.mouse.left = false;
      else if (e.button === 2) self.mouse.right = false;
    });

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('wheel', function (e) {
      if (!self.isLocked()) return;
      e.preventDefault();
      if (self.onScroll) self.onScroll(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    document.addEventListener('pointerlockchange', function () {
      if (self.onLockChange) self.onLockChange(self.isLocked());
    });

    /* Chrome 在 ESC 退出锁定后有约 1.25s 冷却期，期间申请会失败，需提示用户 */
    document.addEventListener('pointerlockerror', function () {
      if (self.onLockError) self.onLockError();
    });
  }

  Input.prototype.isLocked = function () {
    return document.pointerLockElement === this.canvas;
  };

  Input.prototype.requestLock = function () {
    var c = this.canvas;
    MC.Sound.init();
    try {
      var p = c.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  };

  Input.prototype.exitLock = function () {
    if (this.isLocked()) document.exitPointerLock();
  };

  /* 汇总移动输入给 player.update（同时支持 WASD 与方向键） */
  Input.prototype.playerInput = function () {
    var k = this.keys;
    return {
      mf: (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0),
      ms: (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0),
      jump: !!k['Space'],
      shift: !!k['ShiftLeft'] || !!k['ShiftRight'],
      ctrl: !!k['ControlLeft'] || !!k['ControlRight']
    };
  };

  /* 自动化测试用 */
  Input.prototype.debugKey = function (code, down) {
    this.keys[code] = down;
  };

  MC.Input = Input;
})();
