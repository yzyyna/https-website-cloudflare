/* 背包：9 格快捷栏 + 18 格存储，自动堆叠 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  var TOTAL = 27, HOTBAR = 9, STACK_MAX = 64;

  function Inventory() {
    this.slots = new Array(TOTAL).fill(null); /* {id, count} | null */
    this.selected = 0;
    this.pickedSlot = null; /* 背包整理时的待移动源槽位 */
    this.onChange = null;
  }

  Inventory.prototype._emit = function () {
    if (this.onChange) this.onChange();
  };

  /* 返回是否成功放入 */
  Inventory.prototype.add = function (id, n) {
    if (!id || !n) return false;
    var i, s;
    /* 先叠加 */
    for (i = 0; i < TOTAL; i++) {
      s = this.slots[i];
      if (s && s.id === id && s.count < STACK_MAX) {
        var take = Math.min(n, STACK_MAX - s.count);
        s.count += take; n -= take;
        if (n <= 0) { this._emit(); return true; }
      }
    }
    /* 再开新格（快捷栏优先） */
    for (i = 0; i < TOTAL; i++) {
      if (!this.slots[i]) {
        var put = Math.min(n, STACK_MAX);
        this.slots[i] = { id: id, count: put };
        n -= put;
        if (n <= 0) { this._emit(); return true; }
      }
    }
    this._emit();
    return false; /* 背包满 */
  };

  Inventory.prototype.getSelected = function () {
    return this.slots[this.selected];
  };

  Inventory.prototype.consumeSelected = function () {
    var s = this.slots[this.selected];
    if (!s) return;
    s.count--;
    if (s.count <= 0) this.slots[this.selected] = null;
    this._emit();
  };

  /* 中键选取：目标方块对应的物品格 */
  Inventory.prototype.pick = function (id) {
    for (var i = 0; i < TOTAL; i++) {
      var s = this.slots[i];
      if (s && s.id === id) {
        if (i < HOTBAR) { this.selected = i; }
        else {
          var tmp = this.slots[this.selected];
          this.slots[this.selected] = s;
          this.slots[i] = tmp;
        }
        this._emit();
        return true;
      }
    }
    return false;
  };

  /* 背包面板点击：支持自由互换、合并堆叠与快捷栏槽位切换 */
  Inventory.prototype.clickSlot = function (idx) {
    if (idx < 0 || idx >= TOTAL) return;
    if (this.pickedSlot === null || this.pickedSlot === undefined) {
      if (this.slots[idx]) {
        this.pickedSlot = idx;
      }
      if (idx < HOTBAR) {
        this.selected = idx;
      }
    } else {
      var from = this.pickedSlot;
      var to = idx;
      if (from === to) {
        this.pickedSlot = null;
      } else {
        var sFrom = this.slots[from];
        var sTo = this.slots[to];
        if (sFrom && sTo && sFrom.id === sTo.id && sTo.count < STACK_MAX) {
          var transfer = Math.min(sFrom.count, STACK_MAX - sTo.count);
          sTo.count += transfer;
          sFrom.count -= transfer;
          if (sFrom.count <= 0) this.slots[from] = null;
        } else {
          this.slots[from] = sTo;
          this.slots[to] = sFrom;
        }
        this.pickedSlot = null;
        if (to < HOTBAR) this.selected = to;
        else if (from < HOTBAR) this.selected = from;
      }
    }
    this._emit();
  };

  Inventory.prototype.serialize = function () {
    return { slots: this.slots, selected: this.selected };
  };

  Inventory.prototype.load = function (obj) {
    if (!obj || !Array.isArray(obj.slots)) return;
    for (var i = 0; i < TOTAL; i++) {
      var s = obj.slots[i];
      this.slots[i] = (s && typeof s.id === 'number' && s.id !== MC.BLOCK.AIR && MC.DEFS[s.id] && typeof s.count === 'number')
        ? { id: s.id, count: Math.min(STACK_MAX, Math.max(1, s.count | 0)) } : null;
    }
    this.selected = Math.min(HOTBAR - 1, Math.max(0, obj.selected | 0));
    this.pickedSlot = null;
    this._emit();
  };

  Inventory.prototype.clear = function () {
    this.slots = new Array(TOTAL).fill(null);
    this.selected = 0;
    this.pickedSlot = null;
    this._emit();
  };

  Inventory.prototype.countItem = function (id) {
    var c = 0;
    for (var i = 0; i < TOTAL; i++) {
      if (this.slots[i] && this.slots[i].id === id) c += this.slots[i].count;
    }
    return c;
  };

  Inventory.prototype.remove = function (id, count) {
    if (this.countItem(id) < count) return false;
    var remain = count;
    for (var i = 0; i < TOTAL && remain > 0; i++) {
      var s = this.slots[i];
      if (s && s.id === id) {
        var take = Math.min(remain, s.count);
        s.count -= take;
        remain -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this._emit();
    return true;
  };

  /* 模拟在虚拟槽位中添加物品，判断是否能完全容纳（杜绝吞物品） */
  function simulateCanAdd(slots, id, n) {
    var copy = [];
    for (var i = 0; i < TOTAL; i++) {
      var s = slots[i];
      copy.push(s ? { id: s.id, count: s.count } : null);
    }
    var j, cur;
    for (j = 0; j < TOTAL; j++) {
      cur = copy[j];
      if (cur && cur.id === id && cur.count < STACK_MAX) {
        var take = Math.min(n, STACK_MAX - cur.count);
        cur.count += take;
        n -= take;
        if (n <= 0) return true;
      }
    }
    for (j = 0; j < TOTAL; j++) {
      if (!copy[j]) {
        var put = Math.min(n, STACK_MAX);
        copy[j] = { id: id, count: put };
        n -= put;
        if (n <= 0) return true;
      }
    }
    return false;
  }

  /* 配方：cost: [[itemId, count], ...], result: [itemId, count] */
  var RECIPES = [
    { result: [18, 1], cost: [[8, 4]], name: '工作台' },     /* 4 木板 -> 1 工作台 */
    { result: [8, 4], cost: [[6, 1]], name: '木板 x4' },     /* 1 原木 -> 4 木板 */
    { result: [23, 4], cost: [[14, 1], [8, 1]], name: '火把 x4' }, /* 1 煤矿 + 1 木板 -> 4 火把 */
    { result: [24, 1], cost: [[8, 3], [6, 1]], name: '木镐（2.2x速）' }, /* 3 木板 + 1 原木 */
    { result: [25, 1], cost: [[15, 3], [8, 2]], name: '铁镐（4.5x速）' }, /* 3 铁矿 + 2 木板 */
    { result: [26, 1], cost: [[17, 3], [8, 2]], name: '钻石镐（8.0x速）' }, /* 3 钻石矿 + 2 木板 */
    { result: [19, 1], cost: [[8, 3]], name: '书架' },       /* 3 木板 -> 1 书架 */
    { result: [12, 4], cost: [[3, 4]], name: '砖块 x4' },     /* 4 石头 -> 4 砖块 */
    { result: [9, 2], cost: [[5, 2]], name: '玻璃 x2' },      /* 2 沙子 -> 2 玻璃 */
    { result: [20, 1], cost: [[5, 4], [14, 1]], name: 'TNT' },/* 4 沙子 + 1 煤矿 -> 1 TNT */
    { result: [21, 2], cost: [[16, 2]], name: '萤石 x2' }     /* 2 金矿 -> 2 萤石 */
  ];

  Inventory.prototype.canCraft = function (recipe) {
    if (!recipe || !recipe.cost || !recipe.result) return false;
    for (var i = 0; i < recipe.cost.length; i++) {
      var req = recipe.cost[i];
      if (this.countItem(req[0]) < req[1]) return false;
    }
    /* 空间预检：模拟扣除材料后，检查产物是否能完全存入背包 */
    var virtualSlots = [];
    for (var s = 0; s < TOTAL; s++) {
      var cur = this.slots[s];
      virtualSlots.push(cur ? { id: cur.id, count: cur.count } : null);
    }
    for (var j = 0; j < recipe.cost.length; j++) {
      var costReq = recipe.cost[j];
      var remain = costReq[1];
      for (var k = 0; k < TOTAL && remain > 0; k++) {
        var vs = virtualSlots[k];
        if (vs && vs.id === costReq[0]) {
          var t = Math.min(remain, vs.count);
          vs.count -= t;
          remain -= t;
          if (vs.count <= 0) virtualSlots[k] = null;
        }
      }
    }
    return simulateCanAdd(virtualSlots, recipe.result[0], recipe.result[1]);
  };

  Inventory.prototype.craft = function (recipe) {
    if (!this.canCraft(recipe)) return false;
    for (var i = 0; i < recipe.cost.length; i++) {
      var req = recipe.cost[i];
      this.remove(req[0], req[1]);
    }
    this.add(recipe.result[0], recipe.result[1]);
    return true;
  };

  Inventory.HOTBAR = HOTBAR;
  Inventory.TOTAL = TOTAL;
  Inventory.RECIPES = RECIPES;
  MC.Inventory = Inventory;
})();
