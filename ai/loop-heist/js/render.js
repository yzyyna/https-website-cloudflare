/* 时光回放小偷 · Canvas 绘制（只负责画面，不改变游戏状态） */
(function () {
  'use strict';

  var SIM = window.LH_SIM;
  var MOVE_MS = 140;
  var canvas = null;
  var c = null;
  var dpr = 1;
  var cssW = 0;
  var cssH = 0;
  var tile = 32;
  var ox = 0;
  var oy = 0;
  var reduceMotion = false;

  function attach(el) {
    canvas = el;
    c = el.getContext('2d');
    try {
      reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      reduceMotion = false;
    }
  }

  function fit(world) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var stage = canvas.parentElement;
    cssW = stage.clientWidth;
    cssH = stage.clientHeight;
    tile = Math.max(12, Math.min(72, Math.floor(Math.min(cssW / world.w, cssH / world.h))));
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ox = Math.floor((cssW - world.w * tile) / 2);
    oy = Math.floor((cssH - world.h * tile) / 2);
  }

  function lerpPos(e, from, k) {
    if (!from) return e;
    return { x: from.x + (e.x - from.x) * k, y: from.y + (e.y - from.y) * k };
  }

  function drawTile(w, x, y, now) {
    var t = tile;
    var px = x * t;
    var py = y * t;
    var ch = w.tiles[y][x];

    if (ch === '#') {
      c.fillStyle = '#1b2440';
      c.fillRect(px, py, t, t);
      c.fillStyle = '#2b3a63';
      c.fillRect(px, py, t, Math.max(2, t * 0.12));
      return;
    }

    c.fillStyle = (x + y) % 2 ? '#121a2e' : '#0f1628';
    c.fillRect(px, py, t, t);

    var cx = px + t / 2;
    var cy = py + t / 2;
    var pulse = 0.5 + 0.5 * Math.sin(now / 260);

    if (ch === '$' && !w.lootTaken[x + ',' + y]) {
      c.save();
      c.shadowColor = '#ffd166';
      c.shadowBlur = t * 0.5 * pulse;
      c.fillStyle = '#ffd166';
      c.beginPath();
      c.moveTo(cx, cy - t * 0.3);
      c.lineTo(cx + t * 0.3, cy);
      c.lineTo(cx, cy + t * 0.3);
      c.lineTo(cx - t * 0.3, cy);
      c.closePath();
      c.fill();
      c.restore();
    } else if (ch === 'E') {
      var ready = w.lootCount === w.lootTotal;
      c.save();
      c.strokeStyle = ready ? '#3ddc97' : '#37445e';
      c.lineWidth = Math.max(2, t * 0.08);
      c.shadowColor = ready ? '#3ddc97' : 'transparent';
      c.shadowBlur = ready ? t * 0.6 * pulse : 0;
      c.beginPath();
      c.arc(cx, cy, t * (0.28 + 0.04 * pulse), 0, Math.PI * 2);
      c.stroke();
      c.restore();
    } else if (ch === 'P') {
      var held = w.bodies.some(function (b) { return b.x === x && b.y === y; });
      c.fillStyle = held ? '#ff9f43' : '#6b4f2a';
      c.fillRect(px + t * 0.15, py + t * 0.4, t * 0.7, t * 0.2);
    } else if (ch === 'D') {
      c.fillStyle = w.doorOpen ? 'rgba(255,159,67,0.18)' : '#8a5a2b';
      c.fillRect(px + t * 0.1, py, t * 0.8, t);
      if (!w.doorOpen) {
        c.fillStyle = '#5c3a1c';
        for (var i = 1; i < 4; i++) {
          c.fillRect(px + t * 0.1, py + t * i / 4, t * 0.8, Math.max(1, t * 0.05));
        }
      }
    } else if (ch === 'G') {
      var open = w.gateOpen;
      c.fillStyle = open ? 'rgba(125,211,252,0.14)' : '#16283f';
      c.fillRect(px, py, t, t);
      c.fillStyle = open ? 'rgba(125,211,252,0.45)' : '#7dd3fc';
      for (var b = 1; b <= 3; b++) {
        c.fillRect(px + t * b / 4 - t * 0.04, py + t * 0.08, Math.max(1, t * 0.08), t * 0.84);
      }
      c.fillStyle = open ? 'rgba(125,211,252,0.4)' : '#bde8ff';
      c.fillRect(px, py + t * 0.06, t, Math.max(1, t * 0.08));
      c.fillRect(px, py + t * 0.86, t, Math.max(1, t * 0.08));
    }
  }

  function drawGuard(w, g, gp, index, now) {
    var t = tile;
    var cells = SIM.viewCells(w, g);
    c.fillStyle = 'rgba(255,95,109,0.16)';
    cells.slice(1).forEach(function (v) {
      c.fillRect(v.x * t, v.y * t, t, t);
    });

    var px = gp.x * t;
    var py = gp.y * t;
    var caught = w.caughtBy && w.caughtBy.guard === index;
    if (caught) {
      c.save();
      c.strokeStyle = '#ff5f6d';
      c.lineWidth = Math.max(2, t * 0.1);
      c.shadowColor = '#ff5f6d';
      c.shadowBlur = t * 0.6;
      c.strokeRect(px + t * 0.05, py + t * 0.05, t * 0.9, t * 0.9);
      c.restore();
    }

    c.fillStyle = '#ff5f6d';
    c.fillRect(px + t * 0.18, py + t * 0.18, t * 0.64, t * 0.64);
    var d = SIM.DIRS[g.facing];
    c.fillStyle = '#ffffff';
    c.fillRect(
      px + t * (0.5 + d[0] * 0.2) - t * 0.08,
      py + t * (0.5 + d[1] * 0.2) - t * 0.08,
      t * 0.16,
      t * 0.16
    );
  }

  function drawBody(bp, isPlayer, now) {
    var t = tile;
    var px = bp.x * t + t * 0.15;
    var py = bp.y * t + t * 0.15;
    var s = t * 0.7;
    c.save();
    if (isPlayer) {
      c.shadowColor = '#ffe66d';
      c.shadowBlur = t * 0.4;
      c.fillStyle = '#ffe66d';
      c.fillRect(px, py, s, s);
    } else {
      c.globalAlpha = 0.55;
      c.fillStyle = 'rgba(125,211,252,0.25)';
      c.strokeStyle = '#7dd3fc';
      c.lineWidth = 1.5;
      c.setLineDash([3, 3]);
      c.fillRect(px, py, s, s);
      c.strokeRect(px, py, s, s);
    }
    c.restore();
  }

  /* anim：{ from: { bodies: [{x,y}], guards: [{x,y}] }, t0 }，为空则直接画到当前位置 */
  function draw(world, anim, now, shaking) {
    if (!c) return;
    var k = anim && !reduceMotion ? Math.min(1, (now - anim.t0) / MOVE_MS) : 1;
    var sh = shaking && !reduceMotion ? (Math.random() - 0.5) * 8 : 0;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#080c16';
    c.fillRect(0, 0, cssW, cssH);

    c.save();
    c.translate(ox + sh, oy + sh);
    for (var y = 0; y < world.h; y++) {
      for (var x = 0; x < world.w; x++) {
        drawTile(world, x, y, now);
      }
    }
    world.guards.forEach(function (g, i) {
      var from = anim && anim.from.guards[i];
      drawGuard(world, g, lerpPos(g, from, k), i, now);
    });
    world.bodies.forEach(function (b, i) {
      var from = anim && anim.from.bodies[i];
      drawBody(lerpPos(b, from, k), b.isPlayer, now);
    });
    c.restore();
  }

  window.LH_RENDER = {
    attach: attach,
    fit: fit,
    draw: draw
  };
})();
