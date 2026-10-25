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

console.log('\n🎉 所有 cell-defense 核心单元测试全部通过！');
