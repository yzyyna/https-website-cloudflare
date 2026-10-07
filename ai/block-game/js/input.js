/* 输入：键盘、鼠标、指针锁定与移动端多点触控（虚拟摇杆/滑屏/触控键） */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  function detectTouchDevice() {
    var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return !!(hasTouch && (isCoarse || isMobileUA));
  }

  function Input(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { left: false, right: false };
    this.lastSpace = 0;
    this.enabled = false; /* playing 状态才响应游戏键 */

    /* 模式控制：auto | touch | desktop */
    this.controlMode = 'auto';
    this.detectedTouch = detectTouchDevice();
    this.virtualLocked = false;

    /* 触控状态 */
    this.touchMove = { mf: 0, ms: 0 };
    this.touchJump = false;
    this.touchSprint = false;
    this.moveTouchId = null;
    this.lookTouchId = null;
    this.lastLookX = 0;
    this.lastLookY = 0;
    this.lastJumpTouch = 0;

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
    this.onLockError = null;

    /* 初始化触控模式样式与 DOM 绑定 */
    this._initTouchDOM();
    this.updateModeUI();

    /* ---------- 键盘事件 ---------- */
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;

      if (e.code === 'Escape') {
        /* 指针锁定时 ESC 由浏览器处理；未锁定时用于关闭背包/打开菜单 */
        if (self.onToggleInventory) self.onToggleInventory();
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
      self.resetInputs();
    });

    /* ---------- 鼠标与指针锁定事件 ---------- */
    document.addEventListener('mousemove', function (e) {
      if (self.isTouchActive()) return;
      if (!self.isLocked()) return;
      if (self.onLook) self.onLook(e.movementX || 0, e.movementY || 0);
    });

    canvas.addEventListener('mousedown', function (e) {
      if (self.isTouchActive()) return;
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
      if (self.isTouchActive()) return;
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
      if (!self.isTouchActive()) {
        if (self.onLockChange) self.onLockChange(self.isLocked());
      }
    });

    document.addEventListener('pointerlockerror', function () {
      if (!self.isTouchActive()) {
        if (self.onLockError) self.onLockError();
      }
    });

    /* 首次触碰自动唤醒触控模式 */
    window.addEventListener('touchstart', function () {
      if (!self.detectedTouch) {
        self.detectedTouch = true;
        self.updateModeUI();
      }
    }, { passive: true, once: true });
  }

  Input.prototype.isTouchActive = function () {
    if (this.controlMode === 'touch') return true;
    if (this.controlMode === 'desktop') return false;
    return this.detectedTouch;
  };

  Input.prototype.setControlMode = function (mode) {
    if (mode === 'touch' || mode === 'desktop' || mode === 'auto') {
      this.controlMode = mode;
      this.updateModeUI();
    }
  };

  Input.prototype.updateModeUI = function () {
    var isTouch = this.isTouchActive();
    document.body.classList.toggle('touch-mode', isTouch);
    
    var hDesktop1 = document.getElementById('title-help-desktop');
    var hTouch1 = document.getElementById('title-help-touch');
    if (hDesktop1 && hTouch1) {
      hDesktop1.classList.toggle('hidden', isTouch);
      hTouch1.classList.toggle('hidden', !isTouch);
    }
    var hDesktop2 = document.getElementById('pause-help-desktop');
    var hTouch2 = document.getElementById('pause-help-touch');
    if (hDesktop2 && hTouch2) {
      hDesktop2.classList.toggle('hidden', isTouch);
      hTouch2.classList.toggle('hidden', !isTouch);
    }
    var hint = document.getElementById('hint');
    if (hint) {
      hint.textContent = isTouch ? '轻触画面开始操作' : '点击画面锁定鼠标开始操作';
    }
  };

  Input.prototype.isLocked = function () {
    if (this.isTouchActive()) {
      return this.virtualLocked && this.enabled;
    }
    return document.pointerLockElement === this.canvas;
  };

  Input.prototype.requestLock = function () {
    MC.Sound.init();
    if (this.isTouchActive()) {
      this.virtualLocked = true;
      if (this.onLockChange) this.onLockChange(true);
      return;
    }
    var c = this.canvas;
    try {
      var p = c.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  };

  Input.prototype.exitLock = function () {
    if (this.isTouchActive()) {
      this.virtualLocked = false;
      this.resetInputs();
      if (this.onLockChange) this.onLockChange(false);
      return;
    }
    if (this.isLocked()) document.exitPointerLock();
  };

  Input.prototype.resetInputs = function () {
    this.keys = {};
    this.mouse.left = false;
    this.mouse.right = false;
    this.touchMove.mf = 0;
    this.touchMove.ms = 0;
    this.touchJump = false;
    this.moveTouchId = null;
    this.lookTouchId = null;
    this._resetJoystickVisual();
  };

  /* ---------- 移动端多点触控与虚拟摇杆/按键绑定 ---------- */
  Input.prototype._initTouchDOM = function () {
    var self = this;
    var joyZone = document.getElementById('touch-joystick-zone');
    var joyBase = document.getElementById('joystick-base');
    var joyKnob = document.getElementById('joystick-knob');
    var joyRadius = 45;
    var baseCenter = { x: 0, y: 0 };

    function updateJoystick(touch) {
      var dx = touch.clientX - baseCenter.x;
      var dy = touch.clientY - baseCenter.y;
      var dist = Math.hypot(dx, dy);
      if (dist > joyRadius) {
        dx = (dx / dist) * joyRadius;
        dy = (dy / dist) * joyRadius;
      }
      if (joyKnob) {
        joyKnob.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0)';
      }
      /* 归一化移动分量（向前为正，向右为正） */
      self.touchMove.mf = -(dy / joyRadius);
      self.touchMove.ms = (dx / joyRadius);
    }

    if (joyZone) {
      joyZone.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!self.isLocked()) {
          if (self.onRequestLock) self.onRequestLock();
          return;
        }
        var touch = e.changedTouches[0];
        self.moveTouchId = touch.identifier;
        var rect = joyBase ? joyBase.getBoundingClientRect() : joyZone.getBoundingClientRect();
        baseCenter.x = rect.left + rect.width / 2;
        baseCenter.y = rect.top + rect.height / 2;
        updateJoystick(touch);
      }, { passive: false });

      joyZone.addEventListener('touchmove', function (e) {
        e.preventDefault();
        e.stopPropagation();
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === self.moveTouchId) {
            updateJoystick(t);
            break;
          }
        }
      }, { passive: false });

      var endMove = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === self.moveTouchId) {
            self.moveTouchId = null;
            self.touchMove.mf = 0;
            self.touchMove.ms = 0;
            self._resetJoystickVisual();
            break;
          }
        }
      };
      joyZone.addEventListener('touchend', endMove, { passive: false });
      joyZone.addEventListener('touchcancel', endMove, { passive: false });
    }

    /* 右侧全屏滑屏视角 */
    window.addEventListener('touchstart', function (e) {
      if (!self.isTouchActive() || !self.isLocked()) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        /* 排除左侧摇杆区域与按键区域 */
        if (t.clientX > window.innerWidth * 0.35 && self.lookTouchId === null) {
          var target = document.elementFromPoint(t.clientX, t.clientY);
          if (target && target.closest && target.closest('.touch-btn, .touch-top-btn, #inventory-panel, #pause-menu, #title-menu, #hotbar')) {
            continue;
          }
          self.lookTouchId = t.identifier;
          self.lastLookX = t.clientX;
          self.lastLookY = t.clientY;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (!self.isTouchActive() || !self.isLocked() || self.lookTouchId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === self.lookTouchId) {
          var dx = (t.clientX - self.lastLookX) * 1.75;
          var dy = (t.clientY - self.lastLookY) * 1.75;
          self.lastLookX = t.clientX;
          self.lastLookY = t.clientY;
          if (self.onLook) self.onLook(dx, dy);
          break;
        }
      }
    }, { passive: true });

    var endLook = function (e) {
      if (self.lookTouchId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === self.lookTouchId) {
          self.lookTouchId = null;
          break;
        }
      }
    };
    window.addEventListener('touchend', endLook, { passive: true });
    window.addEventListener('touchcancel', endLook, { passive: true });

    /* 动作按钮绑定 */
    function bindTouchBtn(id, onStart, onEnd) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        MC.Sound.init();
        if (onStart) onStart();
      }, { passive: false });
      btn.addEventListener('touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (onEnd) onEnd();
      }, { passive: false });
      btn.addEventListener('touchcancel', function (e) {
        e.preventDefault();
        if (onEnd) onEnd();
      }, { passive: false });
    }

    bindTouchBtn('btn-touch-jump', function () {
      self.touchJump = true;
      var now = performance.now();
      if (now - self.lastJumpTouch < 280) {
        if (self.onToggleFly) self.onToggleFly();
        self.lastJumpTouch = 0;
      } else {
        self.lastJumpTouch = now;
      }
    }, function () {
      self.touchJump = false;
    });

    bindTouchBtn('btn-touch-mine', function () {
      self.mouse.left = true;
    }, function () {
      self.mouse.left = false;
    });

    bindTouchBtn('btn-touch-place', function () {
      self.mouse.right = true;
    }, function () {
      self.mouse.right = false;
    });

    var sprintBtn = document.getElementById('btn-touch-sprint');
    if (sprintBtn) {
      sprintBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.touchSprint = !self.touchSprint;
        sprintBtn.classList.toggle('active', self.touchSprint);
      }, { passive: false });
    }

    var pauseBtn = document.getElementById('btn-touch-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.exitLock();
      }, { passive: false });
    }

    var invBtn = document.getElementById('btn-touch-inv');
    if (invBtn) {
      invBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (self.onToggleInventory) self.onToggleInventory();
      }, { passive: false });
    }
  };

  Input.prototype._resetJoystickVisual = function () {
    var knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = 'translate3d(0, 0, 0)';
  };

  /* 汇总移动输入给 player.update（同时无缝融合键盘、方向键与触屏摇杆） */
  Input.prototype.playerInput = function () {
    var k = this.keys;
    var keyMf = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    var keyMs = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);

    var totalMf = Math.max(-1, Math.min(1, keyMf + this.touchMove.mf));
    var totalMs = Math.max(-1, Math.min(1, keyMs + this.touchMove.ms));

    return {
      mf: totalMf,
      ms: totalMs,
      jump: !!k['Space'] || this.touchJump,
      shift: !!k['ShiftLeft'] || !!k['ShiftRight'] || this.touchSprint,
      ctrl: !!k['ControlLeft'] || !!k['ControlRight']
    };
  };

  /* 自动化测试用 */
  Input.prototype.debugKey = function (code, down) {
    this.keys[code] = down;
  };

  MC.Input = Input;
  MC.detectTouchDevice = detectTouchDevice;
})();

