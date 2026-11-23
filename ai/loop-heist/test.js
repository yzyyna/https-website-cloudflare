/* 时光回放小偷 · 模拟内核与关卡单元测试：node loop-heist/test.js */
'use strict';

const fs = require('fs');
const path = require('path');

const window = {};
for (const f of ['js/levels.js', 'js/sim.js']) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  new Function('window', src)(window);
}

const { createWorld, step } = window.LH_SIM;
const levels = window.LH_LEVELS;

let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name);
  }
}

function play(level, ghosts, actions) {
  const world = createWorld(level, ghosts);
  actions.forEach(a => step(world, a));
  return world;
}

/* 只复制会被 step 修改的字段；tiles / plates / exit / timeline 不可变，可共享。 */
function cloneWorld(w) {
  return {
    w: w.w,
    h: w.h,
    tick: w.tick,
    status: w.status,
    caughtBy: w.caughtBy,
    tiles: w.tiles,
    doorOpen: w.doorOpen,
    gateOpen: w.gateOpen,
    pressedCount: w.pressedCount,
    plates: w.plates,
    lootTotal: w.lootTotal,
    lootTaken: Object.assign({}, w.lootTaken),
    lootCount: w.lootCount,
    exit: w.exit,
    guards: w.guards.map(g => ({ x: g.x, y: g.y, path: g.path, facing: g.facing })),
    bodies: w.bodies.map(b => ({ x: b.x, y: b.y, isPlayer: b.isPlayer, timeline: b.timeline })),
    history: w.history.slice()
  };
}

/* 广度优先搜索最短动作序列。ghosts 为固定录像。
 * 去重键必须是「完整世界状态」：玩家坐标 + 已拿宝物 + 绝对回合数 + 门/闸门状态 + 各幽灵坐标。
 * 只用「玩家坐标 + 宝物 + tick % 守卫周期」会把实际不同的状态判成同一个而误报无解：
 * 幽灵按绝对回合索引录像且不循环；幽灵被关闭的门挡住之后，位置就不再由回合数决定。
 * 「某关无解」的断言全靠这里返回 null，键不充分时那种断言会变得不可信。 */
function solve(level, ghosts, maxTicks) {
  const moves = ['U', 'D', 'L', 'R', 'W'];
  const keyOf = (w) => {
    const p = w.bodies[0];
    return [
      p.x + ',' + p.y,
      Object.keys(w.lootTaken).sort().join(';'),
      w.tick,
      w.doorOpen ? 1 : 0,
      w.gateOpen ? 1 : 0,
      w.bodies.slice(1).map(b => b.x + ',' + b.y).join(';')
    ].join('|');
  };
  const start = createWorld(level, ghosts);
  const seen = new Set([keyOf(start)]);
  const queue = [[start, []]];

  while (queue.length) {
    const node = queue.shift();
    const world = node[0];
    const actions = node[1];
    if (actions.length >= maxTicks) continue;
    for (const m of moves) {
      const w = cloneWorld(world);
      step(w, m);
      if (w.status === 'caught') continue;
      const next = actions.concat(m);
      if (w.status === 'win') return next;
      const k = keyOf(w);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([w, next]);
    }
  }
  return null;
}

console.log('第一幕：基础路线');
{
  const w = play(levels[0], [], ['R', 'R', 'R', 'R', 'D', 'D', 'R', 'R']);
  check('拿宝物并抵达出口后 status 为 win', w.status === 'win');
}

console.log('第二幕：压力板门');
{
  const blocked = play(levels[1], [], ['D', 'R', 'R', 'R', 'R', 'R']);
  check('无幽灵时门保持关闭，玩家停在门前', blocked.bodies[0].x === 4 && blocked.bodies[0].y === 2);

  const attempt1 = play(levels[1], [], ['R', 'R', 'R']);
  check('第一轮结束后玩家站在压力板上', attempt1.bodies[0].x === 4 && attempt1.bodies[0].y === 1);

  const win = play(levels[1], [['R', 'R', 'R']],
    ['D', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'U', 'D']);
  check('幽灵踩住压力板后门开启，可通关', win.status === 'win');
}

console.log('守卫视野与幽灵重放');
{
  const synthetic = {
    map: ['#######', '#@...E#', '#######'],
    guards: [{ x: 4, y: 1, path: 'L' }]
  };
  check('守卫朝玩家方向巡逻，玩家在视野内被抓', play(synthetic, [], ['W']).status === 'caught');

  const away = { map: synthetic.map, guards: [{ x: 4, y: 1, path: 'R' }] };
  check('守卫背向玩家巡逻时玩家不会被抓', play(away, [], ['W']).status === 'play');

  const ghostMap = ['##########', '#@......E#', '##########'];
  const ghostCaught = play(
    { map: ghostMap, guards: [{ x: 7, y: 1, path: 'LR' }] },
    [['R']],
    ['W']
  );
  check('幽灵被守卫看到同样触发警报',
    ghostCaught.status === 'caught' && ghostCaught.caughtBy.body === 1);
}

console.log('视线规则：门与归因');
{
  // 走廊：@ 起点、P 压力板、D 门。幽灵先去踩板开门，第三 tick 离开让门关上
  const corridor = ['###########', '#@PD..E...#', '###########'];
  const sentry = { map: corridor, guards: [{ x: 8, y: 1, path: 'WWL' }] };

  // 玩家趁门开着站进门格；幽灵离开压力板后门在玩家脚下关上，
  // 守卫这一 tick 转身沿走廊看过来，门框里的人仍然可见
  const inDoor = play(sentry, [['R', 'W', 'L']], ['W', 'R', 'R']);
  check('站在已关闭门格上的人仍会被守卫看见',
    inDoor.status === 'caught' && inDoor.caughtBy.body === 0);

  // 遮挡：玩家原地不动。守卫 'LL' 两步后到 (5,1)，距 (1,1) 恰好 4 格，在视野范围之内。
  // 中间的门若不挡视线就会被看见，所以这两条能区分「门挡视线」与「门不挡视线」
  const occluder = { map: corridor, guards: [{ x: 8, y: 1, path: 'LL' }] };
  check('关闭的门遮挡其后的格子', play(occluder, [], ['W', 'W', 'W']).status === 'play');
  check('门开后同一条视线就能看见', play(occluder, [['R']], ['W', 'W', 'W']).status === 'caught');

  // 归因：跨守卫也以玩家优先。守卫 0（下行）只看到幽灵，守卫 1（上行）只看到玩家，
  // 两者在同一 tick 命中，应报告看到玩家的守卫 1
  const twoLanes = {
    map: ['###########', '#@........#', '#.........#'],
    guards: [{ x: 7, y: 2, path: 'L' }, { x: 5, y: 1, path: 'RL' }]
  };
  const crossGuard = play(twoLanes, [['D', 'R']], ['W', 'W']);
  check('跨守卫同时命中时归因为看到玩家的那只',
    crossGuard.status === 'caught' &&
    crossGuard.caughtBy.guard === 1 && crossGuard.caughtBy.body === 0);

  // 坏数据防御：空路线或含非法字符的路线不应让对局崩溃
  const badPaths = ['', 'X!', null, 'LX'];
  const survives = badPaths.every((p) => {
    try {
      const w = play({ map: corridor, guards: [{ x: 8, y: 1, path: p }] }, [], ['W', 'W']);
      return w.status === 'play' && /^[UDLRW]+$/.test(w.guards[0].path) && /^[UDLRW]$/.test(w.guards[0].facing);
    } catch (e) {
      return false;
    }
  });
  check('守卫路线为空或含非法字符时被合法化而非崩溃', survives);
  check('非法字符被剔除后保留合法部分',
    play({ map: corridor, guards: [{ x: 8, y: 1, path: 'LX' }] }, [], ['W']).guards[0].path === 'L');

  // 列表本身是坏数据：非数组、含 null 条目
  const badLists = ['nope', [null, { x: 8, y: 1, path: 'L' }]];
  const listOk = badLists.every((g, i) => {
    try {
      const w = play({ map: corridor, guards: g }, [], ['W', 'W']);
      return w.status === 'play' && w.guards.length === (i === 0 ? 0 : 1);
    } catch (e) {
      return false;
    }
  });
  check('守卫列表非数组或含 null 条目时被忽略而非崩溃', listOk);
}

console.log('总闸门：必须所有压力板同时被踩住');
{
  const half = play(levels[3], [], ['R', 'R', 'R']);
  check('只踩一块板时闸门仍然关闭', half.gateOpen === false && half.pressedCount === 1);

  const both = play(levels[3], [['R', 'R', 'R'], ['D', 'D', 'D', 'R', 'R', 'R']], ['W', 'W', 'W', 'W', 'W', 'W']);
  check('两块板都被幽灵踩住后闸门打开', both.gateOpen === true && both.pressedCount === 2);

  check('第四幕没有幽灵时无解（闸门挡住唯一通路）', solve(levels[3], [], 40) === null);
}

console.log('关卡可解性（BFS 求解真实规则）');
{
  const s1 = solve(levels[0], [], 30);
  check('第一幕可解：' + (s1 ? s1.join('') : '无解'), s1 !== null);

  const s2 = solve(levels[1], [['R', 'R', 'R']], 40);
  check('第二幕带幽灵可解：' + (s2 ? s2.join('') : '无解'), s2 !== null);
  check('第二幕无幽灵时无解', solve(levels[1], [], 30) === null);

  const s3 = solve(levels[2], [], 40);
  check('第三幕（守卫巡逻）可解：' + (s3 ? s3.join('') : '无解'), s3 !== null);

  const ghosts4 = [['R', 'R', 'R'], ['D', 'D', 'D', 'R', 'R', 'R']];
  const s4 = solve(levels[3], ghosts4, 50);
  check('第四幕带两个幽灵可解：' + (s4 ? s4.join('') : '无解'), s4 !== null);

  const s5 = solve(levels[4], [['R', 'R', 'R']], 60);
  check('第五幕（守卫 + 门）可解：' + (s5 ? s5.join('') : '无解'), s5 !== null);
  check('第五幕无幽灵时无解', solve(levels[4], [], 40) === null);
}

console.log('求解器：去重键必须是完整状态');
{
  // 这一关用「玩家坐标 + 宝物 + tick % 守卫周期」去重时会被误判为无解：
  // 本关没有守卫（周期为 1，等于忽略回合数），而幽灵按绝对回合踩板、离开，
  // 同一个「玩家坐标」在不同回合对应的门状态并不相同
  const lvl = { map: ['##########', '#..ED..P@#', '##########'], guards: [] };
  const ghost = ['W', 'L', 'R', 'L', 'R', 'R', 'L'];
  const sol = solve(lvl, [ghost], 12);
  check('有解的关卡不会被误判为无解：' + (sol ? sol.join('') : '无解'), sol !== null);
  check('求得的解回放确实通关', sol !== null && play(lvl, [ghost], sol).status === 'win');
}

console.log('关卡数据完整性');
{
  const ok = levels.every((l, i) => {
    const width = l.map[0].length;
    const uniform = l.map.every(row => row.length === width);
    const hasStart = l.map.some(row => row.includes('@'));
    const hasExit = l.map.some(row => row.includes('E'));
    const guardInBounds = (l.guards || []).every(g =>
      g.y >= 0 && g.y < l.map.length && g.x >= 0 && g.x < width &&
      l.map[g.y][g.x] !== '#' && /^[UDLRW]+$/.test(g.path)
    );
    // 图例外的字符会被内核当作可行走地板，必须在数据侧拦住
    const charsetOk = l.map.every(row => /^[#.@E$PDG]*$/.test(row));
    // 没有压力板的关卡里，G 闸门永远不会打开
    const gatesHavePlates = !l.map.some(row => row.includes('G')) || l.map.some(row => row.includes('P'));
    return uniform && hasStart && hasExit && guardInBounds && charsetOk && gatesHavePlates &&
      typeof l.name === 'string' && l.name;
  });
  check('所有关卡地图等宽、有起点与出口、守卫坐标合法、用图字符与闸门配套（共 ' + levels.length + ' 关）', ok);
}

console.log(failed === 0 ? '全部通过' : failed + ' 项失败');
process.exit(failed === 0 ? 0 : 1);
