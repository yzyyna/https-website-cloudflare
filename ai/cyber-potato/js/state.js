/**
 * state.js - 核心状态机、时间推演引擎与 localStorage 持久化
 */

window.PotatoState = (function () {
  const STORAGE_KEY = 'cyber_potato_save_v1';

  // 默认初始状态
  const defaultState = () => ({
    name: '波特·马铃薯',
    stats: {
      hunger: 80,
      energy: 85,
      sanity: 90,
      overheat: 0
    },
    status: 'normal',
    isSleeping: false,
    counters: {
      coffeeCount: 0,
      bookCount: 0,
      feedCount: 0,
      pokeCount: 0,
      petCount: 0,
      overloadCount: 0,
      resignedTimes: 0,
      neglectScore: 0
    },
    accessories: {
      unlocked: {},
      active: {}
    },
    resigned: false,
    lastSaveTime: Date.now(),
    lastInteractionTime: Date.now(),
    birthTime: Date.now()
  });

  let state = defaultState();
  let tickTimer = null;
  let onStateChangeListeners = [];

  // 仅接受有限的 number 类型；null / '' / true 等会被 Number() 隐式转换，故不走隐式转换
  function sanitizeNum(val, def, min = 0, max = Infinity) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return def;
    return Math.min(max, Math.max(min, val));
  }

  // 存档中的配件开关只保留确定的 true，其余（非布尔、篡改值）一律丢弃
  function pickTrueFlags(src) {
    const out = {};
    if (src && typeof src === 'object') {
      Object.keys(src).forEach((k) => {
        if (src[k] === true) out[k] = true;
      });
    }
    return out;
  }

  // 从 localStorage 加载并执行离线推演
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 合并防止老版本缺少字段
        state = {
          ...defaultState(),
          ...parsed,
          stats: { ...defaultState().stats, ...(parsed.stats || {}) },
          counters: { ...defaultState().counters, ...(parsed.counters || {}) },
          accessories: {
            unlocked: pickTrueFlags(parsed.accessories && parsed.accessories.unlocked),
            active: pickTrueFlags(parsed.accessories && parsed.accessories.active)
          }
        };

        // 数据自愈与清洗，防止 NaN 污染
        state.stats.hunger = sanitizeNum(state.stats.hunger, 80, 0, 100);
        state.stats.energy = sanitizeNum(state.stats.energy, 85, 0, 150);
        state.stats.sanity = sanitizeNum(state.stats.sanity, 90, 0, 100);
        state.stats.overheat = sanitizeNum(state.stats.overheat, 0, 0, 100);
        state.lastSaveTime = sanitizeNum(state.lastSaveTime, Date.now(), 0);
        state.birthTime = sanitizeNum(state.birthTime, Date.now(), 0);
        // 计数器只允许非负有限数，布尔态强制为布尔值，防止篡改数据污染逻辑
        Object.keys(defaultState().counters).forEach((k) => {
          state.counters[k] = sanitizeNum(state.counters[k], 0, 0);
        });
        state.resigned = state.resigned === true;
        state.isSleeping = state.isSleeping === true;

        // 离线时间推演
        simulateOfflineProgress();
        evaluateStatus();
      }
    } catch (e) {
      console.warn('读取本地存档失败，使用默认状态', e);
      state = defaultState();
    }
  }

  // 离线时间演算推演
  function simulateOfflineProgress() {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - (state.lastSaveTime || now)) / 1000);

    if (elapsedSeconds > 10) {
      // 离线衰减
      if (state.isSleeping) {
        // 睡眠只回升、不回落：咖啡等效果可使精力超过 100，不能被截回 100
        state.stats.energy = Math.max(state.stats.energy, Math.min(100, state.stats.energy + elapsedSeconds * 0.03));
      } else {
        state.stats.energy = Math.max(0, state.stats.energy - elapsedSeconds * 0.015);
      }

      state.stats.hunger = Math.max(0, state.stats.hunger - elapsedSeconds * 0.02);
      state.stats.sanity = Math.max(0, state.stats.sanity - elapsedSeconds * 0.018);

      // 冷却过载
      state.stats.overheat = Math.max(0, state.stats.overheat - elapsedSeconds * 0.1);

      // 累计疏忽分数
      const neglectAdded = Math.floor(elapsedSeconds / 600);
      state.counters.neglectScore = (state.counters.neglectScore || 0) + neglectAdded;

      // 超过 24 小时未照料 (或 86400 秒)，且尚未辞职
      if (elapsedSeconds >= 86400 && !state.resigned) {
        state.resigned = true;
        state.status = 'resigned';
        state.counters.resignedTimes = (state.counters.resignedTimes || 0) + 1;
      }
    }

    state.lastSaveTime = now;
  }

  // 持久化保存
  function save() {
    state.lastSaveTime = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('保存存档失败', e);
    }
  }

  // 重置状态
  function reset() {
    state = defaultState();
    save();
    notifyChange({ event: 'reset' });
  }

  // 快进时间 (用于调试与测试离线机制)
  function fastForward(seconds) {
    state.lastSaveTime = (state.lastSaveTime || Date.now()) - seconds * 1000;
    simulateOfflineProgress();
    evaluateStatus();
    save();
    notifyChange({ event: 'fastForward', seconds });
  }

  // 状态机评估与刷新
  function evaluateStatus() {
    if (state.resigned) {
      state.status = 'resigned';
      return;
    }

    // 咖啡过载
    if (state.stats.overheat > 60) {
      state.status = 'overload';
      return;
    }

    // 虚脱
    if (state.stats.energy <= 0 && state.stats.hunger <= 0) {
      state.status = 'crash';
      return;
    }

    // 睡觉中
    if (state.isSleeping) {
      state.status = 'sleeping';
      return;
    }

    // 饥饿
    if (state.stats.hunger < 25) {
      state.status = 'hungry';
      return;
    }

    // 困倦
    if (state.stats.energy < 25) {
      state.status = 'sleepy';
      return;
    }

    // 正常状态
    state.status = 'normal';
  }

  // 定时驱动心脏跳动 Tick
  function startTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      // 饥饿自然下降 (每秒约 -0.15)
      state.stats.hunger = Math.max(0, state.stats.hunger - 0.15);

      // 精力
      if (state.isSleeping) {
        // 睡眠只回升、不回落（精力可能因咖啡超过 100）
        state.stats.energy = Math.max(state.stats.energy, Math.min(100, state.stats.energy + 0.6));
        // 充满电后自动醒来
        if (state.stats.energy >= 100) {
          state.isSleeping = false;
        }
      } else {
        state.stats.energy = Math.max(0, state.stats.energy - 0.1);
      }

      // 心智情绪自然回落
      state.stats.sanity = Math.max(0, state.stats.sanity - 0.08);

      // 过载温度自然冷却 (每秒 -1.2)
      const prevOverheat = state.stats.overheat || 0;
      if (state.stats.overheat > 0) {
        state.stats.overheat = Math.max(0, state.stats.overheat - 1.2);
        if (prevOverheat > 60 && state.stats.overheat <= 60) {
          // 过载狂暴消退后遗症：精力回落与吐槽
          // 只做回落、不抬升：精力已低于 10 时不能被“修正”成 10
          state.stats.energy = Math.min(state.stats.energy, Math.max(10, state.stats.energy - 25));
          if (window.PotatoDialogue) {
            window.PotatoDialogue.say('呼……咖啡因药效消退，CPU 降频，全身瘫软如泥……', 'sleepy');
          }
        }
      }

      // 长时间心智为 0 且极度饥饿，自动触发辞职
      if (state.stats.sanity <= 0 && state.stats.hunger <= 0 && !state.resigned) {
        state.resigned = true;
        state.counters.resignedTimes = (state.counters.resignedTimes || 0) + 1;
      }

      evaluateStatus();

      // 检查是否有配件满足新解锁
      if (window.PotatoAccessories) {
        window.PotatoAccessories.evaluateUnlocks(state);
      }

      save();
      notifyChange({ event: 'tick' });
    }, 1000);
  }

  function addChangeListener(listener) {
    onStateChangeListeners.push(listener);
  }

  function notifyChange(detail = {}) {
    onStateChangeListeners.forEach((fn) => {
      try {
        fn(state, detail);
      } catch (err) {
        console.error('State listener error', err);
      }
    });
  }

  return {
    getState: () => state,
    load,
    save,
    reset,
    fastForward,
    startTick,
    evaluateStatus,
    addChangeListener,
    notifyChange
  };
})();
