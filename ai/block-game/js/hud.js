/* HUD：快捷栏、背包面板、准星进度、状态、提示 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  function Hud() {
    this.el = {
      crosshair: document.getElementById('crosshair'),
      breakbar: document.getElementById('breakbar'),
      breakbarFill: document.getElementById('breakbar-fill'),
      targetName: document.getElementById('target-name'),
      stats: document.getElementById('stats'),
      hotbar: document.getElementById('hotbar'),
      bubbles: document.getElementById('air-bubbles'),
      toast: document.getElementById('toast'),
      underwater: document.getElementById('underwater-overlay'),
      invPanel: document.getElementById('inventory-panel'),
      invGrid: document.getElementById('inventory-grid'),
      craftingList: document.getElementById('crafting-list'),
      handViewmodel: document.getElementById('hand-viewmodel'),
      handCanvas: document.getElementById('hand-canvas'),
      titleMenu: document.getElementById('title-menu'),
      pauseMenu: document.getElementById('pause-menu'),
      hint: document.getElementById('hint')
    };
    this.iconCache = {};
    this.toastTimer = null;
  }

  /* 等距立方体图标（从图集取贴图）；工具/火把/花等平面物画平铺贴图 */
  Hud.prototype.drawIcon = function (canvas, blockId) {
    var ctx = canvas.getContext('2d');
    var size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    var atlas = this.atlasCanvas;
    var def = MC.DEFS[blockId];
    if (!def || def.top === undefined) return;
    var tilePx = this.tilePx, cols = this.cols;

    if (def.isTool || def.model === 'cross') {
      /* 平面物品：贴图放大铺满并带一点倾斜 */
      var tileId = def.side;
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(-0.12);
      ctx.drawImage(atlas,
        (tileId % cols) * tilePx, Math.floor(tileId / cols) * tilePx, tilePx, tilePx,
        -size * 0.42, -size * 0.42, size * 0.84, size * 0.84);
      ctx.restore();
      return;
    }

    function srcRect(tileId) {
      return [(tileId % cols) * tilePx, Math.floor(tileId / cols) * tilePx, tilePx, tilePx];
    }

    var k = size / 32; /* 半宽步长 */
    var s = function (m) { ctx.setTransform.apply(ctx, m); };

    /* 顶面 */
    var r = srcRect(def.top);
    s([k, 0.5 * k, -k, 0.5 * k, size / 2, size * 0.03]);
    ctx.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, 16, 16);

    /* 左面（较暗） */
    r = srcRect(def.side);
    s([k, 0.5 * k, 0, k, size * 0.03, size * 0.03 + 8 * k]);
    ctx.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,20,0.34)';
    ctx.fillRect(0, 0, 16, 16);

    /* 右面（中等暗） */
    s([k, -0.5 * k, 0, k, size / 2, size * 0.03 + 16 * k]);
    ctx.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,20,0.18)';
    ctx.fillRect(0, 0, 16, 16);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  /* 离屏缓存加速：同一 canvas 元素不能同时挂在快捷栏与背包两处 DOM，通过缓存复用 drawImage 复制 */
  Hud.prototype.getIconCache = function (blockId) {
    if (!this._iconCache) this._iconCache = {};
    if (!this._iconCache[blockId]) {
      var c = document.createElement('canvas');
      c.width = 40; c.height = 40;
      this.drawIcon(c, blockId);
      this._iconCache[blockId] = c;
    }
    return this._iconCache[blockId];
  };

  Hud.prototype.iconFor = function (blockId) {
    var cached = this.getIconCache(blockId);
    var c = document.createElement('canvas');
    c.width = 40; c.height = 40;
    var ctx = c.getContext('2d');
    ctx.drawImage(cached, 0, 0);
    return c;
  };

  Hud.prototype.invalidateIcons = function () {
    this._iconCache = {};
  };

  /* ---------- 快捷栏 ---------- */
  Hud.prototype.buildHotbar = function (inventory) {
    var html = '';
    for (var i = 0; i < MC.Inventory.HOTBAR; i++) {
      html += '<div class="hb-slot" data-i="' + i + '"><span class="keynum">' + (i + 1) + '</span><span class="cnt"></span></div>';
    }
    this.el.hotbar.innerHTML = html;
    var self = this;
    this.el.hotbar.addEventListener('click', function (e) {
      var slot = e.target.closest('.hb-slot');
      if (!slot) return;
      var idx = +slot.dataset.i;
      if (idx >= 0 && idx < MC.Inventory.HOTBAR) {
        inventory.selected = idx;
        inventory._emit();
        if (MC.Sound && MC.Sound.ui) MC.Sound.ui();
      }
    });
    this.refreshHotbar(inventory);
  };

  Hud.prototype.refreshHotbar = function (inventory) {
    var slots = this.el.hotbar.children;
    for (var i = 0; i < slots.length; i++) {
      var div = slots[i];
      var item = inventory.slots[i];
      div.classList.toggle('selected', i === inventory.selected);
      var old = div.querySelector('canvas');
      if (old) old.remove();
      if (item) {
        div.appendChild(this.iconFor(item.id));
        div.querySelector('.cnt').textContent = item.count > 1 ? item.count : '';
      } else {
        div.querySelector('.cnt').textContent = '';
      }
    }
  };

  /* ---------- 背包面板 ---------- */
  Hud.prototype.buildPanel = function (inventory) {
    var html = '';
    for (var i = 0; i < MC.Inventory.TOTAL; i++) {
      if (i === MC.Inventory.HOTBAR) html += '<div class="row-gap"></div>';
      html += '<div class="hb-slot" data-i="' + i + '"><span class="cnt"></span></div>';
    }
    this.el.invGrid.innerHTML = html;
    var self = this;
    this.el.invGrid.addEventListener('click', function (e) {
      var slot = e.target.closest('.hb-slot');
      if (!slot) return;
      if (self.onSlotClick) self.onSlotClick(+slot.dataset.i);
    });
    this.refreshPanel(inventory);
    this.buildCrafting(inventory);
  };

  Hud.prototype.buildCrafting = function (inventory) {
    if (!this.el.craftingList) return;
    var self = this;
    var html = '';
    MC.Inventory.RECIPES.forEach(function (rec, idx) {
      var costStr = rec.cost.map(function (c) {
        var def = MC.DEFS[c[0]];
        return (def ? def.name : '材料') + 'x' + c[1];
      }).join(' + ');
      html += '<div class="craft-item" data-rec="' + idx + '">' +
        '<div class="craft-info">' +
          '<div class="craft-icon" data-id="' + rec.result[0] + '"></div>' +
          '<div>' +
            '<div class="craft-name">' + rec.name + '</div>' +
            '<div class="craft-cost">需要: ' + costStr + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="craft-btn">制作</button>' +
      '</div>';
    });
    this.el.craftingList.innerHTML = html;
    var iconSlots = this.el.craftingList.querySelectorAll('.craft-icon');
    iconSlots.forEach(function (slot) {
      var id = +slot.dataset.id;
      slot.appendChild(self.iconFor(id));
    });
    this.el.craftingList.addEventListener('click', function (e) {
      var item = e.target.closest('.craft-item');
      if (!item || item.classList.contains('disabled')) return;
      var recIdx = +item.dataset.rec;
      var rec = MC.Inventory.RECIPES[recIdx];
      if (rec && self.onCraftClick) {
        self.onCraftClick(rec);
      }
    });
    this.refreshCrafting(inventory);
  };

  Hud.prototype.refreshCrafting = function (inventory) {
    if (!this.el.craftingList) return;
    var items = this.el.craftingList.querySelectorAll('.craft-item');
    items.forEach(function (el) {
      var recIdx = +el.dataset.rec;
      var rec = MC.Inventory.RECIPES[recIdx];
      if (rec) {
        var can = inventory.canCraft(rec);
        el.classList.toggle('disabled', !can);
      }
    });
  };

  Hud.prototype.refreshPanel = function (inventory) {
    var slots = this.el.invGrid.children;
    for (var i = 0; i < slots.length; i++) {
      var div = slots[i];
      if (!div.dataset || div.dataset.i === undefined) continue;
      var idx = +div.dataset.i;
      var item = inventory.slots[idx];
      var old = div.querySelector('canvas');
      if (old) old.remove();
      div.classList.toggle('selected', idx === inventory.selected);
      div.classList.toggle('picked', idx === inventory.pickedSlot);
      if (item) {
        div.appendChild(this.iconFor(item.id));
        div.querySelector('.cnt').textContent = item.count > 1 ? item.count : '';
      } else {
        div.querySelector('.cnt').textContent = '';
      }
    }
    this.refreshCrafting(inventory);
  };

  /* ---------- 杂项 ---------- */
  Hud.prototype.setProgress = function (p) {
    if (p > 0) {
      this.el.breakbar.classList.remove('hidden');
      this.el.breakbarFill.style.width = Math.min(100, p * 100) + '%';
    } else {
      this.el.breakbar.classList.add('hidden');
    }
  };

  Hud.prototype.setTargetName = function (name) {
    this.el.targetName.textContent = name || '';
  };

  Hud.prototype.setStats = function (text) {
    this.el.stats.textContent = text;
  };

  Hud.prototype.toast = function (msg) {
    var el = this.el.toast;
    el.textContent = msg;
    el.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1600);
  };

  Hud.prototype.setUnderwater = function (b) {
    this.el.underwater.classList.toggle('hidden', !b);
  };

  Hud.prototype.setAir = function (bubbles, inWater) {
    if (!this.el.bubbles) return;
    if (!inWater) {
      this.el.bubbles.classList.add('hidden');
      return;
    }
    this.el.bubbles.classList.remove('hidden');
    if (this.el.bubbles.children.length !== 10) {
      var html = '';
      for (var i = 0; i < 10; i++) html += '<div class="bubble"></div>';
      this.el.bubbles.innerHTML = html;
    }
    var bEls = this.el.bubbles.children;
    for (var j = 0; j < 10; j++) {
      bEls[j].classList.toggle('popped', j >= bubbles);
    }
  };

  Hud.prototype._renderHandCanvas = function (blockId) {
    if (!this.el.handCanvas) return;
    var canvas = this.el.handCanvas;
    var ctx = canvas.getContext('2d');
    var size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    if (blockId && MC.DEFS[blockId]) {
      ctx.imageSmoothingEnabled = false;
      var atlas = this.atlasCanvas;
      var def = MC.DEFS[blockId];

      if (def.isTool || def.model === 'cross') {
        /* 工具、火把、花朵：以 45° 经典角度手持呈现 */
        var tileId = def.side;
        var tilePx = this.tilePx, cols = this.cols;
        var sx = (tileId % cols) * tilePx;
        var sy = Math.floor(tileId / cols) * tilePx;
        ctx.save();
        ctx.translate(size * 0.2, size * 0.15);
        ctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, size * 0.72, size * 0.72);
        ctx.restore();
      } else if (def && def.top !== undefined) {
        /* 绘制放大的等距手持方块 */
        var tilePx = this.tilePx, cols = this.cols;
        function srcRect(tileId) {
          return [(tileId % cols) * tilePx, Math.floor(tileId / cols) * tilePx, tilePx, tilePx];
        }
        var k = size / 20;
        var s = function (m) { ctx.setTransform.apply(ctx, m); };

        /* 顶面 */
        var r = srcRect(def.top);
        s([k, 0.45 * k, -k, 0.45 * k, size * 0.48, size * 0.12]);
        ctx.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, 16, 16);

        /* 左面 */
        r = srcRect(def.side);
        s([k, 0.45 * k, 0, 1.05 * k, size * 0.08, size * 0.12 + 7.2 * k]);
        ctx.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,20,0.30)';
        ctx.fillRect(0, 0, 16, 16);

        /* 右面 */
        s([k, -0.45 * k, 0, 1.05 * k, size * 0.48, size * 0.12 + 14.4 * k]);
        ctx.drawImage(atlas, r[0], r[1], r[2], r[3], 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,20,0.15)';
        ctx.fillRect(0, 0, 16, 16);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    } else {
      /* 空手：绘制经典方块手臂与袖口 */
      ctx.fillStyle = '#b88b68';
      ctx.fillRect(40, 48, 55, 92);
      ctx.fillStyle = '#2b7899';
      ctx.fillRect(35, 108, 65, 42);
    }
  };

  Hud.prototype.updateHand = function (blockId, bob, bobAmp, swing) {
    if (!this.el.handViewmodel) return;
    if (this._currentHandBlockId !== blockId) {
      this._currentHandBlockId = blockId;
      this._renderHandCanvas(blockId);
    }

    /* 硬件加速 translate3d + 纯平滑角度位移，零重绘 */
    var tx = Math.cos(bob) * 7.5 * bobAmp - swing * 18;
    var ty = Math.abs(Math.sin(bob)) * 10 * bobAmp + swing * 26;
    var rot = Math.sin(bob) * 2.5 * bobAmp - swing * 20;
    this.el.handViewmodel.style.transform =
      'translate3d(' + tx.toFixed(1) + 'px, ' + ty.toFixed(1) + 'px, 0) rotate(' + rot.toFixed(1) + 'deg)';
  };

  /* state: title / playing / paused / inventory */
  Hud.prototype.showState = function (state) {
    this.el.titleMenu.classList.toggle('hidden', state !== 'title');
    this.el.pauseMenu.classList.toggle('hidden', state !== 'paused');
    this.el.invPanel.classList.toggle('hidden', state !== 'inventory');
    this.el.crosshair.classList.toggle('hidden', state === 'title');
    this.el.hotbar.classList.toggle('hidden', state === 'title');
    this.el.stats.classList.toggle('hidden', state === 'title');
    if (this.el.handViewmodel) {
      this.el.handViewmodel.classList.toggle('hidden', state !== 'playing');
    }
  };

  Hud.prototype.showHint = function (b) {
    this.el.hint.classList.toggle('hidden', !b);
  };

  MC.Hud = Hud;
})();
