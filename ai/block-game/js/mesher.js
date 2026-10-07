/* 区块网格构建：面剔除 + 逐顶点 AO，输出不透明/半透明两套顶点缓冲数据 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var BLOCK = MC.BLOCK, DEFS = MC.DEFS;
  var CHUNK = 16, H = 64;
  var PW = 18, PH = 66; /* 快照尺寸：-1..16 / -1..64 */

  /* 六个面：dir=法线 shade=基础明暗 corners=[局部坐标, uv]（来自标准方块面表） */
  var FACES = [
    { dir: [-1, 0, 0], shade: 0.72, corners: [ [[0,1,0],[0,1]], [[0,0,0],[0,0]], [[0,1,1],[1,1]], [[0,0,1],[1,0]] ] },
    { dir: [ 1, 0, 0], shade: 0.72, corners: [ [[1,1,1],[0,1]], [[1,0,1],[0,0]], [[1,1,0],[1,1]], [[1,0,0],[1,0]] ] },
    { dir: [ 0,-1, 0], shade: 0.5,  corners: [ [[1,0,1],[1,0]], [[0,0,1],[0,0]], [[1,0,0],[1,1]], [[0,0,0],[0,1]] ] },
    { dir: [ 0, 1, 0], shade: 1.0,  corners: [ [[0,1,1],[1,1]], [[1,1,1],[0,1]], [[0,1,0],[1,0]], [[1,1,0],[0,0]] ] },
    { dir: [ 0, 0,-1], shade: 0.82, corners: [ [[1,0,0],[0,0]], [[0,0,0],[1,0]], [[1,1,0],[0,1]], [[0,1,0],[1,1]] ] },
    { dir: [ 0, 0, 1], shade: 0.82, corners: [ [[0,0,1],[0,0]], [[1,0,1],[1,0]], [[0,1,1],[0,1]], [[1,1,1],[1,1]] ] }
  ];
  /* 每个面的两个切向轴（非法线轴） */
  var TANGENTS = [[1, 2], [1, 2], [0, 2], [0, 2], [0, 1], [0, 1]];
  var AO_CURVE = [0.42, 0.62, 0.82, 1.0];
  var UV_EPS = 0.02; /* 防图集渗色的小缩进 */
  var SHARED_SNAP = new Uint8Array(PW * PH * PW);

  function buildChunkMesh(world, chunk) {
    var bx = chunk.cx * CHUNK, bz = chunk.cz * CHUNK;

    /* 快照：复用预分配的连续内存，把本区块外扩一圈的方块取进局部数组，零 GC 开销 */
    var snap = SHARED_SNAP;
    var x, y, z;
    for (y = -1; y <= H; y++) {
      for (z = -1; z <= CHUNK; z++) {
        for (x = -1; x <= CHUNK; x++) {
          snap[((y + 1) * PW + (z + 1)) * PW + (x + 1)] = world.getBlock(bx + x, y, bz + z);
        }
      }
    }
    function S(lx, ly, lz) {
      return snap[((ly + 1) * PW + (lz + 1)) * PW + (lx + 1)];
    }

    /* 每列最高不透明方块（深度变暗用）：挖开地表后坑底自然变亮 */
    var colTop = new Int16Array(CHUNK * CHUNK);
    for (z = 0; z < CHUNK; z++) {
      for (x = 0; x < CHUNK; x++) {
        colTop[z * CHUNK + x] = -1;
        for (var ty2 = H - 1; ty2 >= 0; ty2--) {
          if (MC.isOpaque(S(x, ty2, z))) { colTop[z * CHUNK + x] = ty2; break; }
        }
      }
    }

    /* 收集 3x3 邻域内火把/萤石等点光源（缓存于 world，通常为空零开销） */
    var lights = [];
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx2 = -1; dx2 <= 1; dx2++) {
        var ll = world.lightListOf(chunk.cx + dx2, chunk.cz + dz);
        for (var li = 0; li < ll.length; li += 3) lights.push(ll[li], ll[li + 1], ll[li + 2]);
      }
    }
    function blockLightAt(wx, wy, wz) {
      var best = 0;
      for (var i = 0; i < lights.length; i += 3) {
        var d = Math.sqrt((wx - lights[i]) * (wx - lights[i]) +
                          (wy - (lights[i + 1] + 0.4)) * (wy - (lights[i + 1] + 0.4)) +
                          (wz - lights[i + 2]) * (wz - lights[i + 2]));
        var c = 1 - d / 8;
        if (c > best) best = c;
      }
      return best * 0.95;
    }

    var out = {
      solid: { vert: [], idx: [] },
      trans: { vert: [], idx: [] }
    };
    var vertCount = { solid: 0, trans: 0 };

    for (y = 0; y < H; y++) {
      for (z = 0; z < CHUNK; z++) {
        for (x = 0; x < CHUNK; x++) {
          var b = S(x, y, z);
          if (b === BLOCK.AIR) continue;
          var def = DEFS[b];
          if (!def) continue;
          var pass = def.model === 'cross' ? 'solid' : (def.translucent ? 'trans' : 'solid');

          /* 深度系数：距列顶越深越暗（洞穴氛围），火把可补光 */
          var depth = colTop[z * CHUNK + x] - y;
          var df = depth > 4 ? Math.max(0.3, 1 - (depth - 4) * 0.045) : 1;

          /* 交叉双面模型（红花、火把等植物/附属物），alpha-test 走不透明通道 */
          if (def.model === 'cross') {
            var tileIdC = def.side;
            var txc = tileIdC % 8, tyc = Math.floor(tileIdC / 8);
            var cu0 = (txc + UV_EPS) / 8, cu1 = (txc + 1 - UV_EPS) / 8;
            var cv0 = (tyc + UV_EPS) / 8, cv1 = (tyc + 1 - UV_EPS) / 8;
            var cSky = def.light ? 1.0 : 0.92 * df;
            var cGlow = def.light ? 1.0 : blockLightAt(bx + x + 0.5, y + 0.5, bz + z + 0.5);
            var vlist = out[pass].vert;
            var ilist = out[pass].idx;

            /* 对角面 1 */
            var b1 = vertCount[pass];
            vlist.push(
              bx + x + 0.14, y,        bz + z + 0.14, cu0, cv1, cSky, cGlow,
              bx + x + 0.86, y,        bz + z + 0.86, cu1, cv1, cSky, cGlow,
              bx + x + 0.86, y + 0.96, bz + z + 0.86, cu1, cv0, cSky, cGlow,
              bx + x + 0.14, y + 0.96, bz + z + 0.14, cu0, cv0, cSky, cGlow
            );
            ilist.push(b1, b1 + 1, b1 + 2, b1, b1 + 2, b1 + 3);
            ilist.push(b1, b1 + 2, b1 + 1, b1, b1 + 3, b1 + 2);
            vertCount[pass] += 4;

            /* 对角面 2 */
            var b2 = vertCount[pass];
            vlist.push(
              bx + x + 0.14, y,        bz + z + 0.86, cu0, cv1, cSky, cGlow,
              bx + x + 0.86, y,        bz + z + 0.14, cu1, cv1, cSky, cGlow,
              bx + x + 0.86, y + 0.96, bz + z + 0.14, cu1, cv0, cSky, cGlow,
              bx + x + 0.14, y + 0.96, bz + z + 0.86, cu0, cv0, cSky, cGlow
            );
            ilist.push(b2, b2 + 1, b2 + 2, b2, b2 + 2, b2 + 3);
            ilist.push(b2, b2 + 2, b2 + 1, b2, b2 + 3, b2 + 2);
            vertCount[pass] += 4;
            continue;
          }

          for (var f = 0; f < 6; f++) {
            var face = FACES[f];
            var dir = face.dir;
            var nb = S(x + dir[0], y + dir[1], z + dir[2]);
            if (nb === b) continue;              /* 同类相邻（水-水、玻璃-玻璃、树叶-树叶）剔除 */
            if (DEFS[nb] && DEFS[nb].opaque) continue; /* 被不透明块遮住 */

            var tileId = dir[1] === 1 ? def.top : (dir[1] === -1 ? def.bottom : def.side);
            var tx = tileId % 8, ty = Math.floor(tileId / 8);

            /* 光源方块自身全亮 */
            var glow = def.light ? 1.0 : 0;
            var skyMul = def.light ? 1.0 : df;

            /* 逐顶点 AO */
            var tan = TANGENTS[f];
            var ao = [0, 0, 0, 0], light = [0, 0, 0, 0];
            for (var ci = 0; ci < 4; ci++) {
              var c = face.corners[ci][0];
              var o1 = c[tan[0]] === 1 ? 1 : -1;
              var o2 = c[tan[1]] === 1 ? 1 : -1;
              var e1 = [0, 0, 0], e2 = [0, 0, 0];
              e1[tan[0]] = o1; e2[tan[1]] = o2;
              var s1 = MC.isOpaque(S(x + dir[0] + e1[0], y + dir[1] + e1[1], z + dir[2] + e1[2])) ? 1 : 0;
              var s2 = MC.isOpaque(S(x + dir[0] + e2[0], y + dir[1] + e2[1], z + dir[2] + e2[2])) ? 1 : 0;
              var cn = MC.isOpaque(S(x + dir[0] + e1[0] + e2[0], y + dir[1] + e1[1] + e2[1], z + dir[2] + e1[2] + e2[2])) ? 1 : 0;
              var a = (s1 && s2) ? 0 : 3 - (s1 + s2 + cn);
              ao[ci] = a;
              light[ci] = face.shade * AO_CURVE[a] * skyMul;
            }

            /* 面中心的火把贡献（整面共享，避免逐顶点开销） */
            if (!glow && lights.length) {
              glow = blockLightAt(bx + x + 0.5 + dir[0] * 0.5,
                                  y + 0.5 + dir[1] * 0.5,
                                  bz + z + 0.5 + dir[2] * 0.5);
            }

            var base = vertCount[pass];
            var vlist = out[pass].vert;
            for (ci = 0; ci < 4; ci++) {
              var c2 = face.corners[ci][0], uv = face.corners[ci][1];
              vlist.push(
                bx + x + c2[0],
                y + c2[1],
                bz + z + c2[2],
                (tx + UV_EPS + uv[0] * (1 - 2 * UV_EPS)) / 8,
                (ty + UV_EPS + (1 - uv[1]) * (1 - 2 * UV_EPS)) / 8,
                light[ci],
                glow
              );
            }
            var ilist = out[pass].idx;
            /* 根据对角 AO 选择四边形拆分方向，避免插值伪影 */
            if (ao[0] + ao[3] > ao[1] + ao[2]) {
              ilist.push(base, base + 1, base + 3, base, base + 3, base + 2);
            } else {
              ilist.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
            vertCount[pass] += 4;
          }
        }
      }
    }

    function packPass(part, count) {
      return {
        vert: new Float32Array(part.vert),
        idx: count > 65535 ? new Uint32Array(part.idx) : new Uint16Array(part.idx)
      };
    }

    return {
      solid: packPass(out.solid, vertCount.solid),
      trans: packPass(out.trans, vertCount.trans)
    };
  }

  MC.buildChunkMesh = buildChunkMesh;
})();
