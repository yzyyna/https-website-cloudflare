/**
 * cell-defense: 局内进度快照持久化
 * 设计约束：
 * 1. 只保存可安全 JSON 化的局内状态，不触碰任何存档数据格式契约；
 * 2. 读取时做类型白名单校验与数值 sanitize，损坏/篡改数据一律视为无存档，绝不让异常抛到主循环；
 * 3. localStorage 不可用（隐私模式 / file:// 受限 / 配额满）时静默降级为「无存档」，游戏照常可玩。
 */
(function (window) {
  'use strict';

  var KEY = 'cell_defense_save_v1';
  var VERSION = 1;

  function storage() {
    try {
      var ls = window.localStorage;
      if (!ls) return null;
      ls.setItem('__cd_probe__', '1');
      ls.removeItem('__cd_probe__');
      return ls;
    } catch (e) {
      return null;
    }
  }

  function num(value, fallback, min, max) {
    var n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n)) return fallback;
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  }

  function int(value, fallback, min, max) {
    return Math.round(num(value, fallback, min, max));
  }

  function knownType(type) {
    return typeof type === 'string' && !!window.CELL_CONFIGS && !!window.CELL_CONFIGS[type];
  }

  /**
   * 采集局内快照
   */
  function capture(game) {
    var slots = (game.bloodFlow && game.bloodFlow.slots) || [];
    var cells = [];
    for (var i = 0; i < game.cells.length; i++) {
      var c = game.cells[i];
      if (!knownType(c.type)) continue;
      cells.push({
        type: c.type,
        x: Math.round(c.x),
        y: Math.round(c.y),
        tier: int(c.tier, 1, 1, 3),
        hp: Math.round(c.hp),
        maxHp: Math.round(c.maxHp),
        slot: c.slot ? slots.indexOf(c.slot) : -1,
        vac: (c.digestingViruses || []).map(function (v) {
          return {
            name: String(v.name || ''),
            timer: num(v.timer, 0, 0),
            maxTime: num(v.maxTime, 1, 0.1),
            color: typeof v.color === 'string' ? v.color : '#34d399',
            reward: num(v.reward, 0, 0)
          };
        })
      });
    }

    var spawn = (game.enemiesToSpawn || []).map(function (item) {
      return {
        type: typeof item.type === 'string' ? item.type : 'influenza',
        delay: Math.max(0, num(item.delay - game.spawnTimer, 0, 0))
      };
    });

    var cds = {};
    for (var k in game.skills) {
      if (Object.prototype.hasOwnProperty.call(game.skills, k)) {
        cds[k] = Math.max(0, num(game.skills[k].currentCd, 0, 0));
      }
    }

    return {
      version: VERSION,
      savedAt: Date.now(),
      atp: Math.round(game.atp),
      dna: Math.round(game.dna),
      health: Math.round(game.health),
      maxHealth: Math.round(game.maxHealth),
      wave: int(game.wave, 1, 1, game.maxWaves),
      maxWaves: game.maxWaves,
      waveActive: !!game.waveActive,
      awaitingMutation: !!game.awaitingMutation,
      spawn: spawn,
      cells: cells,
      mutations: Object.keys(game.activeMutations || {}),
      stats: {
        swallowed: int(game.stats.swallowed, 0, 0),
        killed: int(game.stats.killed, 0, 0),
        wavesCompleted: int(game.stats.wavesCompleted, 0, 0)
      },
      cooldowns: cds,
      timeScale: num(game.timeScale, 1, 1, 2)
    };
  }

  /**
   * 写入快照；存储不可用时返回 false，调用方无需感知
   */
  function save(game) {
    var ls = storage();
    if (!ls) return false;
    try {
      ls.setItem(KEY, JSON.stringify(capture(game)));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 读取并校验快照，任何异常都归并为 null（无存档）
   */
  function load() {
    var ls = storage();
    if (!ls) return null;
    var raw = null;
    try {
      raw = ls.getItem(KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;

    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (!data || typeof data !== 'object') return null;
    if (num(data.version, 0) !== VERSION) return null;

    var validTypes = window.CELL_CONFIGS || {};
    var cells = [];
    if (Object.prototype.toString.call(data.cells) === '[object Array]') {
      for (var i = 0; i < data.cells.length; i++) {
        var c = data.cells[i];
        if (!c || typeof c !== 'object') continue;
        if (typeof c.type !== 'string' || !validTypes[c.type]) continue;
        var tier = int(c.tier, 1, 1, 3);
        var maxHp = Math.max(1, num(c.maxHp, 100 * tier, 1));
        cells.push({
          type: c.type,
          x: num(c.x, 0, -200, 100000),
          y: num(c.y, 0, -200, 100000),
          tier: tier,
          hp: Math.min(maxHp, num(c.hp, maxHp, 1)),
          maxHp: maxHp,
          slot: int(c.slot, -1, -1, 64),
          vac: Object.prototype.toString.call(c.vac) === '[object Array]' ? c.vac.filter(function (v) {
            return v && typeof v === 'object';
          }).map(function (v) {
            return {
              name: typeof v.name === 'string' ? v.name : '',
              timer: num(v.timer, 0, 0),
              maxTime: num(v.maxTime, 1, 0.1),
              color: typeof v.color === 'string' ? v.color : '#34d399',
              reward: num(v.reward, 0, 0)
            };
          }) : []
        });
      }
    }

    var spawn = [];
    if (Object.prototype.toString.call(data.spawn) === '[object Array]') {
      for (var s = 0; s < data.spawn.length; s++) {
        var item = data.spawn[s];
        if (!item || typeof item !== 'object') continue;
        spawn.push({
          type: typeof item.type === 'string' ? item.type : 'influenza',
          delay: Math.max(0, num(item.delay, 0, 0))
        });
      }
    }

    var mutations = {};
    if (Object.prototype.toString.call(data.mutations) === '[object Array]') {
      for (var m = 0; m < data.mutations.length; m++) {
        if (typeof data.mutations[m] === 'string') mutations[data.mutations[m]] = true;
      }
    }

    var cooldowns = {};
    if (data.cooldowns && typeof data.cooldowns === 'object') {
      for (var cd in data.cooldowns) {
        if (Object.prototype.hasOwnProperty.call(data.cooldowns, cd)) {
          cooldowns[cd] = Math.max(0, num(data.cooldowns[cd], 0, 0));
        }
      }
    }

    return {
      savedAt: num(data.savedAt, Date.now(), 0),
      atp: num(data.atp, 0, 0),
      dna: num(data.dna, 0, 0),
      health: num(data.health, 100, 0),
      maxHealth: num(data.maxHealth, 100, 1),
      wave: int(data.wave, 1, 1, 99),
      waveActive: !!data.waveActive,
      awaitingMutation: !!data.awaitingMutation,
      spawn: spawn,
      cells: cells,
      mutations: mutations,
      stats: {
        swallowed: int(data.stats && data.stats.swallowed, 0, 0),
        killed: int(data.stats && data.stats.killed, 0, 0),
        wavesCompleted: int(data.stats && data.stats.wavesCompleted, 0, 0)
      },
      cooldowns: cooldowns,
      timeScale: num(data.timeScale, 1, 1, 2)
    };
  }

  function has() {
    return load() !== null;
  }

  function clear() {
    var ls = storage();
    if (!ls) return;
    try {
      ls.removeItem(KEY);
    } catch (e) { /* 静默 */ }
  }

  /**
   * 把校验过的快照写回游戏实例
   */
  function apply(game, data) {
    if (!data) return false;

    game.atp = data.atp;
    game.dna = data.dna;
    game.maxHealth = data.maxHealth;
    game.health = Math.min(data.health, data.maxHealth);
    game.wave = data.wave;
    game.waveActive = data.waveActive;
    game.awaitingMutation = data.awaitingMutation;
    game.spawnTimer = 0;
    game.enemiesToSpawn = data.spawn.slice();
    game.activeMutations = data.mutations;
    game.stats = {
      swallowed: data.stats.swallowed,
      killed: data.stats.killed,
      wavesCompleted: data.stats.wavesCompleted
    };
    game.timeScale = data.timeScale;

    for (var k in game.skills) {
      if (Object.prototype.hasOwnProperty.call(game.skills, k)) {
        game.skills[k].currentCd = data.cooldowns[k] || 0;
      }
    }

    // 重建细胞：先清空槽位占用，再按存档槽位索引回绑
    var slots = (game.bloodFlow && game.bloodFlow.slots) || [];
    for (var s = 0; s < slots.length; s++) {
      if (slots[s]) slots[s].cell = null;
    }
    game.cells = [];
    for (var i = 0; i < data.cells.length; i++) {
      var c = data.cells[i];
      var cell = new window.Cell(c.type, c.x, c.y, c.tier);
      cell.hp = c.hp;
      cell.maxHp = c.maxHp;
      cell.digestingViruses = c.vac.map(function (v) {
        return { name: v.name, timer: v.timer, maxTime: v.maxTime, color: v.color, reward: v.reward };
      });
      if (c.slot >= 0 && c.slot < slots.length && slots[c.slot] && !slots[c.slot].cell) {
        slots[c.slot].cell = cell;
        cell.slot = slots[c.slot];
        cell.x = slots[c.slot].x;
        cell.y = slots[c.slot].y;
        cell.targetX = cell.x;
        cell.targetY = cell.y;
      }
      game.cells.push(cell);
    }

    game.isOver = false;
    game.isPaused = false;
    game.updateHUD();
    return true;
  }

  /**
   * 生成恢复按钮上的一句话摘要
   */
  function summary(data) {
    if (!data) return '';
    return '第 ' + data.wave + ' 波 · ⚡' + Math.round(data.atp) + ' · 细胞 ' + data.cells.length + ' · 吞噬 ' + data.stats.swallowed;
  }

  window.CellSave = {
    KEY: KEY,
    VERSION: VERSION,
    save: save,
    load: load,
    has: has,
    clear: clear,
    apply: apply,
    summary: summary
  };
})(window);
