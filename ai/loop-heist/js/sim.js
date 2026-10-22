/* 时光回放小偷 · 回合制模拟内核（纯逻辑，不依赖 DOM）
 * 每次输入记为一个 tick；所有幽灵按各自录下的动作逐 tick 重放，守卫按路线循环推进。
 * 同一份录像在任何时候重放结果都一致，因此幽灵的行为可以被提前规划。
 */
(function () {
  'use strict';

  var DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
  var VIEW_RANGE = 4;

  function inBounds(world, x, y) {
    return x >= 0 && y >= 0 && x < world.w && y < world.h;
  }

  function canEnter(world, x, y) {
    if (!inBounds(world, x, y)) return false;
    var c = world.tiles[y][x];
    if (c === '#') return false;
    if (c === 'D') return world.doorOpen;
    if (c === 'G') return world.gateOpen;
    return true;
  }

  function moveEntity(world, e, action) {
    var d = DIRS[action];
    if (!d || (d[0] === 0 && d[1] === 0)) return;
    var nx = e.x + d[0];
    var ny = e.y + d[1];
    if (canEnter(world, nx, ny)) {
      e.x = nx;
      e.y = ny;
    }
  }

  function viewCells(world, guard) {
    var cells = [{ x: guard.x, y: guard.y }];
    var d = DIRS[guard.facing];
    for (var i = 1; i <= VIEW_RANGE; i++) {
      var x = guard.x + d[0] * i;
      var y = guard.y + d[1] * i;
      if (!inBounds(world, x, y)) break;
      var c = world.tiles[y][x];
      if (c === '#' || (c === 'D' && !world.doorOpen) || (c === 'G' && !world.gateOpen)) break;
      cells.push({ x: x, y: y });
    }
    return cells;
  }

  function firstFacing(path) {
    for (var i = 0; i < path.length; i++) {
      if (path[i] !== 'W') return path[i];
    }
    return 'D';
  }

  function createWorld(level, ghostTimelines) {
    var map = level.map;
    var world = {
      w: map[0].length,
      h: map.length,
      tick: 0,
      status: 'play',
      caughtBy: null,
      tiles: [],
      doorOpen: false,
      gateOpen: false,
      pressedCount: 0,
      plates: [],
      lootTotal: 0,
      lootTaken: {},
      lootCount: 0,
      exit: null,
      guards: [],
      bodies: [],
      history: []
    };
    var start = { x: 1, y: 1 };

    for (var y = 0; y < world.h; y++) {
      world.tiles[y] = [];
      for (var x = 0; x < world.w; x++) {
        var c = map[y][x];
        if (c === '@') {
          start = { x: x, y: y };
          c = '.';
        } else if (c === 'E') {
          world.exit = { x: x, y: y };
        } else if (c === 'P') {
          world.plates.push({ x: x, y: y });
        } else if (c === '$') {
          world.lootTotal++;
        }
        world.tiles[y][x] = c;
      }
    }

    world.bodies.push({ x: start.x, y: start.y, isPlayer: true, timeline: null });
    (ghostTimelines || []).forEach(function (timeline) {
      world.bodies.push({ x: start.x, y: start.y, isPlayer: false, timeline: timeline });
    });

    (level.guards || []).forEach(function (g) {
      world.guards.push({
        x: g.x,
        y: g.y,
        path: g.path,
        facing: firstFacing(g.path)
      });
    });

    return world;
  }

  function collectLoot(world) {
    world.bodies.forEach(function (b) {
      var key = b.x + ',' + b.y;
      if (world.tiles[b.y][b.x] === '$' && !world.lootTaken[key]) {
        world.lootTaken[key] = true;
        world.lootCount++;
      }
    });
  }

  /* D（普通门）任一块压力板被压住即开；G（总闸门）要求所有压力板同时被压住。 */
  function updateDoors(world) {
    var pressed = 0;
    world.plates.forEach(function (p) {
      if (world.bodies.some(function (b) { return b.x === p.x && b.y === p.y; })) pressed++;
    });
    world.pressedCount = pressed;
    world.doorOpen = pressed > 0;
    world.gateOpen = world.plates.length > 0 && pressed === world.plates.length;
  }

  function detect(world) {
    for (var i = 0; i < world.guards.length; i++) {
      var cells = viewCells(world, world.guards[i]);
      for (var j = 0; j < world.bodies.length; j++) {
        var b = world.bodies[j];
        var hit = cells.some(function (c) {
          return c.x === b.x && c.y === b.y;
        });
        if (hit) {
          world.status = 'caught';
          world.caughtBy = { guard: i, body: j };
          return;
        }
      }
    }
  }

  /* 推进一个 tick。playerAction 为 U/D/L/R/W；返回同一个 world 对象。 */
  function step(world, playerAction) {
    if (world.status !== 'play') return world;
    var t = world.tick;
    var action = DIRS[playerAction] ? playerAction : 'W';

    world.history.push(action);
    world.bodies.forEach(function (b) {
      if (b.isPlayer) {
        moveEntity(world, b, action);
      } else {
        moveEntity(world, b, t < b.timeline.length ? b.timeline[t] : 'W');
      }
    });

    collectLoot(world);

    world.guards.forEach(function (g) {
      var a = g.path[t % g.path.length];
      if (a !== 'W') g.facing = a;
      moveEntity(world, g, a);
    });

    updateDoors(world);
    detect(world);

    if (world.status === 'play') {
      var player = world.bodies[0];
      if (world.exit && player.x === world.exit.x && player.y === world.exit.y &&
          world.lootCount === world.lootTotal) {
        world.status = 'win';
      }
    }

    world.tick++;
    return world;
  }

  window.LH_SIM = {
    DIRS: DIRS,
    VIEW_RANGE: VIEW_RANGE,
    createWorld: createWorld,
    step: step,
    viewCells: viewCells
  };
})();
