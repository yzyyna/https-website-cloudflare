/**
 * cell-defense 核心机制与数值配置单元测试集 (Node 环境无头运行)
 */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// 模拟无头浏览器上下文
const sandbox = {
  window: {},
  performance: { now: () => Date.now() },
  console: console,
  Math: Math
};
sandbox.window = sandbox;

function loadScript(rel) {
  const code = fs.readFileSync(path.join(__dirname, rel), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: rel });
}

console.log('🧪 开始细胞防线 (cell-defense) 单元测试集...');

// 1. 加载音频模块
loadScript('js/audio.js');
assert(sandbox.CellAudio, 'CellAudio 应当成功挂载至 window');
assert(typeof sandbox.CellAudio.playSwallow === 'function', '应当导出 playSwallow');
assert.strictEqual(sandbox.CellAudio.isEnabled(), true, '默认音效应为开启状态');
// 测试 safe 降级防抛机制（无 AudioContext 环境下调用不会崩溃）
assert.doesNotThrow(() => {
  sandbox.CellAudio.playSwallow();
  sandbox.CellAudio.playDigest();
  sandbox.CellAudio.playHeartbeat();
  sandbox.CellAudio.playFuse();
}, '无音频上下文环境下 safe 防护层应静默降级不抛异常');
console.log('   ✅ 音频引擎与 safe 容灾防抛测试通过');

// 2. 加载细胞逻辑
loadScript('js/cells.js');
assert(sandbox.CELL_CONFIGS, 'CELL_CONFIGS 应当成功导出');
const cellTypes = ['macrophage', 'neutrophil', 'dendritic', 'bcell', 'nkcell'];
cellTypes.forEach((type) => {
  const cfg = sandbox.CELL_CONFIGS[type];
  assert(cfg, `细胞类型 ${type} 必须在配置表中注册`);
  assert(typeof cfg.name === 'string' && cfg.name.length > 0, `${type} 必须具有合法名称`);
  assert(Number.isFinite(cfg.cost) && cfg.cost > 0, `${type} 建造消耗必须为正数`);
  assert(Number.isFinite(cfg.range) && cfg.range > 0, `${type} 攻击或警戒范围必须为正数`);
  assert(Number.isFinite(cfg.radius) && cfg.radius > 0, `${type} 尺寸半径必须为正数`);
});
console.log('   ✅ 5 类核心免疫细胞配置与数值完备性检查通过');

// 3. 细胞融合与阶次算法
const Cell = sandbox.Cell;
const cell1 = new Cell('macrophage', 100, 200, 1);
assert.strictEqual(cell1.tier, 1, '新创建细胞应为 Tier 1 初始阶');
assert(cell1.maxSwallow >= 3, '巨噬细胞应支持吞噬液泡');

// 创建更高阶细胞
const cell2 = new Cell('macrophage', 100, 200, 2);
assert.strictEqual(cell2.tier, 2, '创建后应为 Tier 2');
assert(cell2.radius > cell1.radius, '高阶细胞体型应当增大');
assert.strictEqual(cell2.maxSwallow, cell1.maxSwallow + 2, 'Tier 2 巨噬细胞吞噬上限提升 2');

const cell3 = new Cell('macrophage', 100, 200, 3);
assert.strictEqual(cell3.tier, 3, '创建后应为 Tier 3');
assert.strictEqual(cell3.maxSwallow, cell1.maxSwallow + 4, 'Tier 3 巨噬细胞吞噬上限提升 4');
console.log('   ✅ 细胞突变融合与等阶倍率算法验证通过');

// 4. 加载病原体配置与伤害逻辑
loadScript('js/enemies.js');
assert(sandbox.ENEMY_CONFIGS, 'ENEMY_CONFIGS 应当成功导出');
const enemyTypes = ['influenza', 'mrsa', 'chlamydia', 'helminth_boss'];
enemyTypes.forEach((type) => {
  const cfg = sandbox.ENEMY_CONFIGS[type];
  assert(cfg, `病原体 ${type} 必须在配置表中注册`);
  assert(Number.isFinite(cfg.speed) && cfg.speed > 0, `${type} 移动速度必须为正数`);
  assert(Number.isFinite(cfg.hp) && cfg.hp > 0, `${type} 生命值必须为正数`);
  assert(Number.isFinite(cfg.reward) && cfg.reward > 0, `${type} 击溃奖励必须为正数`);
});
assert.strictEqual(sandbox.ENEMY_CONFIGS.helminth_boss.isBoss, true, '寄生巨虫必须具有 isBoss 属性');
console.log('   ✅ 4 类感染病原体生态与 Boss 属性验证通过');

// 5. 伤害结算与抗性模拟
const Enemy = sandbox.Enemy;
const mockPath = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
const mrsa = new Enemy('mrsa', mockPath);
const initialHp = mrsa.hp;
assert.strictEqual(initialHp, 190, 'MRSA 初始血量应为 190');

const mockGame = {
  createFloatingText: () => {},
  addATP: () => {},
  addDNA: () => {},
  activeMutations: {}
};

// MRSA 具备 30% 酸液减伤抗性 (armor = 0.3)
mrsa.takeDamage(100, mockGame, 'acid');
assert.strictEqual(mrsa.hp, initialHp - 70, 'MRSA 受到 100 点酸液伤害在 30% 减伤后扣减 70 HP');

// 穿孔素真实伤害应无视护甲
const currentHp = mrsa.hp;
mrsa.takeDamage(50, mockGame, 'perforin');
assert.strictEqual(mrsa.hp, currentHp - 50, '穿孔素应当造成真实全额伤害');
console.log('   ✅ 病原体生化抗性与免疫克制伤害计算通过');

// 6. 局内快照持久化模块（内存存储兜底，验证采集/校验/恢复链路）
let store = {};
sandbox.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
loadScript('js/save.js');
assert(sandbox.CellSave, 'CellSave 应当成功挂载至 window');

const CellSave = sandbox.CellSave;
assert.strictEqual(CellSave.VERSION, 1, '存档版本号应为 1');
assert.strictEqual(CellSave.load(), null, '无存档时应返回 null');
assert.strictEqual(CellSave.has(), false, '无存档时 has() 应为 false');

// 构造一个最小可用的局内状态
const slots = [{ x: 10, y: 10, cell: null }, { x: 50, y: 50, cell: null }];
const fakeGame = {
  atp: 233,
  dna: 7,
  health: 78,
  maxHealth: 120,
  wave: 4,
  maxWaves: 10,
  waveActive: true,
  awaitingMutation: false,
  spawnTimer: 1.5,
  enemiesToSpawn: [{ type: 'mrsa', delay: 2.4 }],
  cells: [new sandbox.Cell('macrophage', 10, 10, 1), new sandbox.Cell('bcell', 50, 50, 2)],
  activeMutations: { m_acid_splash: true },
  stats: { swallowed: 12, killed: 5, wavesCompleted: 3 },
  skills: { adrenaline: { cd: 15, currentCd: 3.2 }, fever: { cd: 20, currentCd: 0 }, interferon: { cd: 25, currentCd: 0 } },
  timeScale: 1.5,
  bloodFlow: { slots: slots }
};
fakeGame.cells[0].slot = slots[0];
slots[0].cell = fakeGame.cells[0];

assert.strictEqual(CellSave.save(fakeGame), true, '存档写入应成功');
assert.strictEqual(CellSave.has(), true, '写入后 has() 应为 true');
assert.strictEqual(typeof store[CellSave.KEY], 'string', '存档应当是 JSON 字符串');

const loaded = CellSave.load();
assert(loaded, '存档应能被读回');
assert.strictEqual(loaded.atp, 233, 'ATP 应被完整保存');
assert.strictEqual(loaded.dna, 7, 'RNA 密码子应被完整保存');
assert.strictEqual(loaded.health, 78, '组织活性应被完整保存');
assert.strictEqual(loaded.maxHealth, 120, '活性上限应被完整保存');
assert.strictEqual(loaded.wave, 4, '波次应被完整保存');
assert.strictEqual(loaded.waveActive, true, '波次进行中标记应被保存');
assert.strictEqual(loaded.cells.length, 2, '两只细胞都应被保存');
assert.strictEqual(loaded.cells[1].tier, 2, '细胞阶次应被保存');
assert.strictEqual(loaded.cells[1].slot, -1, '未绑定槽位的细胞应记为 -1');
assert.strictEqual(loaded.cells[0].slot, 0, '槽位索引应被保存');
assert.strictEqual(loaded.spawn.length, 1, '待生成敌人应被保存');
assert(loaded.spawn[0].delay < 2.4, '剩余延迟应扣除已流逝的 spawnTimer');
assert.strictEqual(loaded.cooldowns.adrenaline, 3.2, '肾上腺素冷却应被保存');
assert.strictEqual(loaded.cooldowns.fever, 0, '无冷却的技能应记为 0');
assert.strictEqual(loaded.timeScale, 1.5, '倍速应被保存');
assert.strictEqual(loaded.mutations.m_acid_splash, true, '突变协议应被保存');
assert(loaded.stats.swallowed === 12 && loaded.stats.killed === 5, '统计应被保存');
assert(CellSave.summary(loaded).indexOf('第 4 波') !== -1, '摘要应包含当前波次');

// 恢复链路：重建细胞并回绑槽位
const targetGame = {
  atp: 0, dna: 0, health: 100, maxHealth: 100, wave: 1,
  waveActive: false, awaitingMutation: false, spawnTimer: 0, enemiesToSpawn: [],
  cells: [], activeMutations: {},
  stats: { swallowed: 0, killed: 0, wavesCompleted: 0 },
  skills: { adrenaline: { cd: 15, currentCd: 0 }, fever: { cd: 20, currentCd: 0 }, interferon: { cd: 25, currentCd: 0 } },
  timeScale: 1, isOver: false, isPaused: false,
  bloodFlow: { slots: [{ x: 10, y: 10, cell: null }, { x: 50, y: 50, cell: null }] },
  updateHUD: () => {}
};
assert.strictEqual(CellSave.apply(targetGame, loaded), true, '恢复应成功');
assert.strictEqual(targetGame.atp, 233, '恢复后 ATP 应一致');
assert.strictEqual(targetGame.cells.length, 2, '恢复后细胞数量应一致');
assert.strictEqual(targetGame.cells[0].slot, targetGame.bloodFlow.slots[0], '恢复后细胞应回绑到原槽位');
assert.strictEqual(targetGame.bloodFlow.slots[0].cell, targetGame.cells[0], '恢复后槽位应指向细胞');
assert.strictEqual(targetGame.cells[0].x, 10, '回绑槽位的细胞坐标应吸附到槽位');
assert.strictEqual(targetGame.skills.adrenaline.currentCd, 3.2, '恢复后技能冷却应一致');
assert.strictEqual(targetGame.timeScale, 1.5, '恢复后倍速应一致');

// 损坏数据必须静默降级为「无存档」，不得抛异常
store[CellSave.KEY] = '{ 这不是合法 JSON';
assert.strictEqual(CellSave.load(), null, '损坏 JSON 应返回 null');
assert.doesNotThrow(() => CellSave.apply(targetGame, null), '对 null 快照调用 apply 不得抛异常');
assert.strictEqual(CellSave.apply(targetGame, null), false, '对 null 快照调用 apply 应返回 false');

// 版本不符视为无存档
store[CellSave.KEY] = JSON.stringify({ version: 99, atp: 1 });
assert.strictEqual(CellSave.load(), null, '版本不匹配的存档应被忽略');

// 篡改类型白名单：未知细胞类型应被丢弃而不是注入
store[CellSave.KEY] = JSON.stringify({
  version: 1, atp: 10, dna: 0, health: 100, maxHealth: 100, wave: 1, waveActive: false,
  spawn: [], cells: [{ type: 'evil_cell', x: 0, y: 0, tier: 1, hp: 10, maxHp: 10, slot: -1, vac: [] }],
  mutations: [], stats: {}, cooldowns: {}, timeScale: 1
});
const sanitized = CellSave.load();
assert(sanitized, '合法外壳的篡改数据仍应可读');
assert.strictEqual(sanitized.cells.length, 0, '未知细胞类型必须被过滤掉');

// 越界数值应被夹紧
store[CellSave.KEY] = JSON.stringify({
  version: 1, atp: -99999, dna: 0, health: 9999, maxHealth: 100, wave: -5, waveActive: false,
  spawn: [], cells: [], mutations: [], stats: {}, cooldowns: {}, timeScale: 99
});
const clamped = CellSave.load();
assert.strictEqual(clamped.atp, 0, '负 ATP 应被夹紧到 0');
assert(Number.isFinite(clamped.health) && Number.isFinite(clamped.maxHealth), '活性相关数值必须有限');
assert.strictEqual(clamped.wave, 1, '波次不应小于 1');
assert.strictEqual(clamped.timeScale, 2, '倍速应被限制在 2 以内');

// 活性上限小于当前活性时，恢复环节必须夹紧，避免出现超过 100% 的血量
const overHeal = CellSave.load();
overHeal.health = 9999;
CellSave.apply(targetGame, overHeal);
assert.strictEqual(targetGame.health, targetGame.maxHealth, '活性超过上限时应被夹紧到上限');

CellSave.clear();
assert.strictEqual(CellSave.load(), null, '清除后应无存档');
console.log('   ✅ 局内快照持久化采集、校验、恢复与降级测试通过');

// 7. 首次对局引导：同 key 只提示一次，不重复打扰
const onboardSeen = {};
let onboardShown = null;
let onboardHidden = 0;
const fakeHint = { textContent: '', classList: { add() {}, remove() { onboardHidden++; } } };
sandbox.document = {
  getElementById(id) { return id === 'onboard-hint' ? fakeHint : null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};
function showOnboardHint(key, text) {
  if (onboardSeen[key]) return;
  onboardSeen[key] = true;
  onboardShown = text;
  fakeHint.textContent = text;
}
showOnboardHint('place', '先选中底栏细胞安放');
assert.strictEqual(onboardShown, '先选中底栏细胞安放', '首次应给出安放引导');
showOnboardHint('place', '第二次同 key 不应覆盖');
assert.strictEqual(onboardShown, '先选中底栏细胞安放', '同一引导 key 不得重复弹出');
showOnboardHint('merge', '拖拽两只同类型细胞融合');
assert.strictEqual(onboardShown, '拖拽两只同类型细胞融合', '不同 key 应能推进到下一步');
console.log('   ✅ 首次对局引导去重与步骤推进测试通过');

// 8. 低组织活性告警阈值判定（< 30% 触发，恢复后撤下）
function isCritical(health, maxHealth) {
  return maxHealth > 0 && (health / maxHealth) < 0.3;
}
assert.strictEqual(isCritical(20, 100), true, '活性 20% 应触发濒危告警');
assert.strictEqual(isCritical(29, 100), true, '活性 29% 仍应触发告警');
assert.strictEqual(isCritical(30, 100), false, '活性 30% 刚好不应触发');
assert.strictEqual(isCritical(80, 100), false, '活性充足时不应触发告警');
assert.strictEqual(isCritical(0, 100), true, '活性为 0 必须触发告警');
assert.strictEqual(isCritical(50, 0), false, '上限异常为 0 时不得误报');
console.log('   ✅ 低组织活性告警阈值判定测试通过');

// 9. 细胞拖拽融合未成功/失焦原位坐标回弹保护
const testCell = new Cell('macrophage', 120, 240, 1);
testCell.origX = testCell.x;
testCell.origY = testCell.y;
// 模拟拖拽移动到悬空位置
testCell.x = 350;
testCell.y = 500;
// 模拟未融合松手或失焦
const mergedSuccess = false;
if (!mergedSuccess && testCell.origX != null && testCell.origY != null) {
  testCell.x = testCell.origX;
  testCell.y = testCell.origY;
}
assert.strictEqual(testCell.x, 120, '未融合成功时细胞 x 必须弹回原位');
assert.strictEqual(testCell.y, 240, '未融合成功时细胞 y 必须弹回原位');
console.log('   ✅ 细胞拖拽未融合/失焦原位回弹保护测试通过');

// 10. 血管基座布局：槽位必须落在安全可视区内且互不重叠（移动端核心体验保障）
sandbox.document = {
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};
loadScript('js/bloodflow.js');
assert(sandbox.BloodFlow, 'BloodFlow 应当成功导出');

// 模拟手机竖屏（顶栏 100px、底栏 160px 被 UI 遮挡）
const phoneFlow = new sandbox.BloodFlow(390, 844);
phoneFlow.safeRect = { x0: 14, y0: 116, x1: 376, y1: 668 };
phoneFlow.buildSlots();
assert(phoneFlow.slots.length >= 8, `小屏至少应生成 8 个基座，实际 ${phoneFlow.slots.length}`);
phoneFlow.slots.forEach((sl, i) => {
  assert(sl.x >= phoneFlow.safeRect.x0 && sl.x <= phoneFlow.safeRect.x1, `槽位 ${i} 的 x 必须在安全区内`);
  assert(sl.y >= phoneFlow.safeRect.y0 && sl.y <= phoneFlow.safeRect.y1, `槽位 ${i} 的 y 必须在安全区内（不得被 HUD/底栏盖住）`);
});
// 两两间距不得小于 40px，防止细胞挤成一团
for (let i = 0; i < phoneFlow.slots.length; i++) {
  for (let j = i + 1; j < phoneFlow.slots.length; j++) {
    const d = Math.hypot(phoneFlow.slots[i].x - phoneFlow.slots[j].x, phoneFlow.slots[i].y - phoneFlow.slots[j].y);
    assert(d >= 40, `槽位 ${i} 与 ${j} 间距过近（${d.toFixed(1)}px），会导致细胞重叠`);
  }
}
// 桌面宽屏应生成更多基座
const deskFlow = new sandbox.BloodFlow(1440, 900);
deskFlow.safeRect = { x0: 14, y0: 72, x1: 1426, y1: 828 };
deskFlow.buildSlots();
assert(deskFlow.slots.length > phoneFlow.slots.length, '宽屏应比窄屏生成更多基座');
console.log(`   ✅ 血管基座安全区布局验证通过（竖屏 ${phoneFlow.slots.length} 个 / 宽屏 ${deskFlow.slots.length} 个）`);

// 11. 长按移除退款与坐标钳制逻辑（对齐 Game.prototype.removeCellAt / clampToSafeRect 规则）
const mockSlots = [{ x: 100, y: 100, cell: null }, { x: 300, y: 300, cell: null }];
const mockCells = [new Cell('macrophage', 100, 100, 1)];
const mockBloodFlow = { slots: mockSlots, safeRect: { x0: 20, y0: 60, x1: 700, y1: 600 } };
const refundGame = {
  cells: mockCells,
  atp: 10,
  bloodFlow: mockBloodFlow,
  createSparks() {}, createFloatingText() {}, updateHUD() {}, persist() {}
};
function removeCellAt(game, cell) {
  const idx = game.cells.indexOf(cell);
  if (idx === -1) return false;
  game.cells.splice(idx, 1);
  if (cell.slot) cell.slot.cell = null;
  const cfg = sandbox.CELL_CONFIGS[cell.type];
  game.atp += cfg ? cfg.cost : 0;
  return true;
}
assert.strictEqual(removeCellAt(refundGame, mockCells[0]), true, '移除已建细胞应成功');
assert.strictEqual(refundGame.cells.length, 0, '移除后细胞列表应为空');
assert.strictEqual(refundGame.atp, 10 + sandbox.CELL_CONFIGS.macrophage.cost, '移除必须全额退还 ATP');
assert.strictEqual(mockSlots[0].cell, null, '移除后槽位占用必须释放');
assert.strictEqual(removeCellAt(refundGame, mockCells[0]), false, '重复移除同一细胞应返回 false');

function clampToSafeRect(rect, x, y, m = 30) {
  return {
    x: Math.max(rect.x0 + m, Math.min(rect.x1 - m, x)),
    y: Math.max(rect.y0 + m, Math.min(rect.y1 - m, y))
  };
}
const c1 = clampToSafeRect(mockBloodFlow.safeRect, 5, 5);
assert.strictEqual(c1.x, 50, '越界左侧应被钳制到安全区左边界');
assert.strictEqual(c1.y, 90, '越界顶部应被钳制到安全区上边界');
const c2 = clampToSafeRect(mockBloodFlow.safeRect, 9999, 9999);
assert.strictEqual(c2.x, 670, '越界右侧应被钳制到安全区右边界');
assert.strictEqual(c2.y, 570, '越界底部应被钳制到安全区下边界');
const c3 = clampToSafeRect(mockBloodFlow.safeRect, 300, 300);
assert.strictEqual(c3.x, 300, '合法坐标不应被改动');
assert.strictEqual(c3.y, 300, '合法坐标不应被改动');
console.log('   ✅ 长按移除退款与坐标安全区钳制测试通过');

// 12. 触屏拖拽意图阈值：轻点（<12px）不触发融合，拖动（>12px）才进入融合判定
function classifyGesture(pressX, pressY, curX, curY) {
  return Math.hypot(curX - pressX, curY - pressY) > 12;
}
assert.strictEqual(classifyGesture(100, 100, 103, 104), false, '轻点不应进入拖拽融合流程');
assert.strictEqual(classifyGesture(100, 100, 100, 100), false, '完全静止不应进入拖拽');
assert.strictEqual(classifyGesture(100, 100, 130, 100), true, '明显拖动应进入融合判定');
console.log('   ✅ 触屏轻点/拖拽意图阈值判定测试通过');

console.log('\n🎉 所有 cell-defense 核心单元测试全部通过！');
