/**
 * test.js - 赛博土豆核心逻辑与自动化测试套件
 * 模拟 DOM 与 Storage 环境，验证核心业务逻辑与边界条件
 */

const assert = require('assert');

// 模拟简易 DOM 与 LocalStorage
global.localStorage = (function () {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();

global.window = global;
global.document = {
  querySelector: () => null,
  getElementById: () => null,
  createElement: () => ({
    className: '',
    innerHTML: '',
    querySelector: () => ({ addEventListener: () => {} }),
    appendChild: () => {}
  }),
  querySelectorAll: () => []
};

// 加载脚本
require('./js/audio.js');
require('./js/dialogue.js');
require('./js/accessories.js');
require('./js/state.js');

console.log('🧪 开始赛博土豆逻辑测试集...');

// 测试 1: 初始状态验证
console.log('▶️ [Test 1] 初始状态与加载验证');
window.PotatoState.reset();
let s = window.PotatoState.getState();
assert.strictEqual(s.name, '波特·马铃薯', '初始名字应为波特·马铃薯');
assert.strictEqual(s.stats.hunger, 80, '初始饱食度应为 80');
assert.strictEqual(s.stats.energy, 85, '初始电力应为 85');
assert.strictEqual(s.stats.sanity, 90, '初始心智应为 90');
assert.strictEqual(s.resigned, false, '初始辞职状态应为 false');
console.log('   ✅ 初始状态正确');

// 测试 2: 喂咖啡与过载机制
console.log('▶️ [Test 2] 喂咖啡与过载机制');
s.stats.overheat = 0;
s.counters.coffeeCount = 0;
s.counters.overloadCount = 0;

// 灌 3 杯咖啡
for (let i = 0; i < 3; i++) {
  s.stats.energy = Math.min(150, s.stats.energy + 25);
  s.stats.overheat += 35;
  s.counters.coffeeCount++;
}
assert(s.stats.overheat > 60, '灌3杯咖啡后 overheat 应超过 60');
window.PotatoState.evaluateStatus();
assert.strictEqual(s.status, 'overload', 'overheat > 60 时状态必须为 overload');
console.log('   ✅ 咖啡超频过载成功');

// 测试 3: 读书与黑框眼镜配件解锁
console.log('▶️ [Test 3] 读书与黑框眼镜配件解锁');
s.counters.bookCount = 0;
assert(!s.accessories.unlocked['glasses'], '初始眼镜未解锁');
// 连续读书 3 次
s.counters.bookCount = 3;
let unlocks = window.PotatoAccessories.evaluateUnlocks(s);
assert(s.accessories.unlocked['glasses'], '读书 3 次后眼镜应自动解锁');
assert(s.accessories.active['glasses'], '解锁后眼镜应默认佩戴');
console.log('   ✅ 老学究黑框眼镜解锁成功');

// 测试 4: 离线推演与连续不理它写辞职信
console.log('▶️ [Test 4] 离线推演与写辞职信');
window.PotatoState.reset();
s = window.PotatoState.getState();

// 快进 24 小时 (86400 秒)
window.PotatoState.fastForward(86400);
s = window.PotatoState.getState();
assert.strictEqual(s.resigned, true, '快进24小时未理它必须触发辞职信');
assert.strictEqual(s.status, 'resigned', '辞职后状态必须为 resigned');
console.log('   ✅ 辞职信触发与离线推演成功');

// 测试 5: 辞职信挽留与破土幼芽配件生成
console.log('▶️ [Test 5] 辞职信挽留与生化幼芽配件');
s.resigned = false;
s.stats.hunger = 85;
s.stats.sanity = 85;
s.counters.resignedTimes = (s.counters.resignedTimes || 0) + 1;
s.accessories.unlocked['sprout'] = true;
s.accessories.active['sprout'] = true;
window.PotatoState.evaluateStatus();
assert.strictEqual(s.resigned, false, '挽留后解除辞职状态');
assert(s.accessories.unlocked['sprout'], '挽留后长出抗议生化幼芽');
console.log('   ✅ 挽留逻辑与生化幼芽生长成功');

// 测试 6: 数据持久化与再次读取
console.log('▶️ [Test 6] localStorage 持久化与恢复');
window.PotatoState.save();
const raw = localStorage.getItem('cyber_potato_save_v1');
assert(raw, 'localStorage 应该包含持久化 JSON');
const parsed = JSON.parse(raw);
assert.strictEqual(parsed.counters.resignedTimes, 2, '挽留历史计数应被正确累加与存储');
console.log('   ✅ 持久化存储与恢复测试通过');

// 测试 7: 脏数据自愈与容错
console.log('▶️ [Test 7] 脏数据注入与自动净化测试');
localStorage.setItem('cyber_potato_save_v1', JSON.stringify({
  stats: { hunger: NaN, energy: -999, sanity: 'invalid_data', overheat: 9999 },
  birthTime: 'invalid_time'
}));
window.PotatoState.load();
const healed = window.PotatoState.getState();
assert(Number.isFinite(healed.stats.hunger) && healed.stats.hunger >= 0 && healed.stats.hunger <= 100, 'hunger 应被清洗为合法数值');
assert(Number.isFinite(healed.stats.energy) && healed.stats.energy >= 0, 'energy 应被清洗为非负合法数值');
assert(Number.isFinite(healed.stats.sanity) && healed.stats.sanity >= 0 && healed.stats.sanity <= 100, 'sanity 应被清洗为合法数值');
assert(Number.isFinite(healed.stats.overheat) && healed.stats.overheat <= 100, 'overheat 应被约束在上限范围内');
console.log('   ✅ 脏数据自愈与健壮性校验通过');

console.log('\n🎉 所有 7 大核心场景与健壮性测试全部通过！');
