/* 程序化生成贴图图集（128x128，8x8 个 16px 图块），无外部图片 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var TILE_PX = 16, COLS = 8, ROWS = 8;

  function buildAtlas() {
    var canvas = document.createElement('canvas');
    canvas.width = TILE_PX * COLS;
    canvas.height = TILE_PX * ROWS;
    var ctx = canvas.getContext('2d');
    var T = MC.TILE;

    function painter(tileId) {
      var ox = (tileId % COLS) * TILE_PX;
      var oy = Math.floor(tileId / COLS) * TILE_PX;
      var rng = MC.mulberry32(tileId * 7919 + 1337);
      return {
        px: function (x, y, color) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x, oy + y, 1, 1);
        },
        rect: function (x, y, w, h, color) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x, oy + y, w, h);
        },
        /* 用基础色 + 明暗抖动填充整块 */
        speckle: function (base, dark, light, density) {
          ctx.fillStyle = base;
          ctx.fillRect(ox, oy, TILE_PX, TILE_PX);
          for (var y = 0; y < TILE_PX; y++) {
            for (var x = 0; x < TILE_PX; x++) {
              var r = rng();
              if (r < (density || 0.35)) {
                ctx.fillStyle = r < (density || 0.35) / 2 ? dark : light;
                ctx.fillRect(ox + x, oy + y, 1, 1);
              }
            }
          }
        },
        rng: rng
      };
    }

    var p;

    /* 草顶 */
    p = painter(T.GRASS_TOP);
    p.speckle('#5d9e3c', '#4c8a30', '#6fb44a', 0.5);

    /* 草侧：泥土 + 顶部草皮 */
    p = painter(T.GRASS_SIDE);
    p.speckle('#8a6244', '#75523a', '#9c7050', 0.45);
    p.rect(0, 0, 16, 3, '#5d9e3c');
    for (var i = 0; i < 16; i++) {
      if (p.rng() < 0.5) p.px(i, 3, '#5d9e3c');
      if (p.rng() < 0.2) p.px(i, 4, '#4c8a30');
    }

    /* 泥土 */
    p = painter(T.DIRT);
    p.speckle('#8a6244', '#75523a', '#9c7050', 0.45);

    /* 石头 */
    p = painter(T.STONE);
    p.speckle('#8a8a8a', '#787878', '#9c9c9c', 0.5);

    /* 圆石 */
    p = painter(T.COBBLE);
    p.speckle('#828282', '#6e6e6e', '#969696', 0.4);
    for (var c = 0; c < 5; c++) {
      var cx0 = Math.floor(p.rng() * 12), cy0 = Math.floor(p.rng() * 12);
      var w = 3 + Math.floor(p.rng() * 3), h = 3 + Math.floor(p.rng() * 3);
      p.rect(cx0, cy0, w, 1, '#5c5c5c');
      p.rect(cx0, cy0 + h, w, 1, '#a0a0a0');
      p.rect(cx0, cy0, 1, h, '#5c5c5c');
      p.rect(cx0 + w, cy0, 1, h, '#a0a0a0');
    }

    /* 沙子 */
    p = painter(T.SAND);
    p.speckle('#d9cd94', '#c9bc82', '#e6dca6', 0.4);

    /* 原木侧面：竖条纹 */
    p = painter(T.LOG_SIDE);
    p.speckle('#6b5230', '#5a4428', '#7a5f3a', 0.3);
    for (i = 0; i < 16; i += 3) {
      p.rect(i, 0, 1, 16, '#57431f');
    }
    p.rect(0, 0, 1, 16, '#7d6238');

    /* 原木顶面：年轮 */
    p = painter(T.LOG_TOP);
    p.speckle('#a3814e', '#96753f', '#b08c58', 0.3);
    p.rect(0, 0, 16, 1, '#6b5230'); p.rect(0, 15, 16, 1, '#6b5230');
    p.rect(0, 0, 1, 16, '#6b5230'); p.rect(15, 0, 1, 16, '#6b5230');
    p.rect(3, 3, 10, 1, '#7c5f36'); p.rect(3, 12, 10, 1, '#7c5f36');
    p.rect(3, 3, 1, 10, '#7c5f36'); p.rect(12, 3, 1, 10, '#7c5f36');
    p.rect(6, 6, 4, 4, '#8a6a3c');
    p.rect(7, 7, 2, 2, '#6b5230');

    /* 树叶：带透明孔洞 */
    p = painter(T.LEAVES);
    ctx.clearRect((T.LEAVES % COLS) * TILE_PX, Math.floor(T.LEAVES / COLS) * TILE_PX, TILE_PX, TILE_PX);
    for (var y2 = 0; y2 < 16; y2++) {
      for (var x2 = 0; x2 < 16; x2++) {
        var r2 = p.rng();
        if (r2 < 0.16) continue; /* 透明洞 */
        p.px(x2, y2, r2 < 0.5 ? '#3e7a24' : (r2 < 0.8 ? '#4c9430' : '#356b1e'));
      }
    }

    /* 木板 */
    p = painter(T.PLANK);
    p.speckle('#a3814e', '#96753f', '#b08c58', 0.25);
    for (i = 0; i < 16; i += 4) {
      p.rect(0, i, 16, 1, '#6b5230');
    }
    p.px(4, 2, '#6b5230'); p.px(12, 6, '#6b5230'); p.px(8, 10, '#6b5230'); p.px(2, 14, '#6b5230');

    /* 玻璃：边框 + 高光，其余透明 */
    p = painter(T.GLASS);
    ctx.clearRect((T.GLASS % COLS) * TILE_PX, Math.floor(T.GLASS / COLS) * TILE_PX, TILE_PX, TILE_PX);
    p.rect(0, 0, 16, 1, '#dfeef2'); p.rect(0, 15, 16, 1, '#dfeef2');
    p.rect(0, 0, 1, 16, '#dfeef2'); p.rect(15, 0, 1, 16, '#dfeef2');
    for (i = 2; i < 7; i++) p.px(i, 9 - i + 2, 'rgba(255,255,255,0.85)');
    p.px(11, 3, 'rgba(255,255,255,0.7)'); p.px(12, 4, 'rgba(255,255,255,0.7)');

    /* 水：半透明蓝 + 波纹 */
    p = painter(T.WATER);
    ctx.clearRect((T.WATER % COLS) * TILE_PX, Math.floor(T.WATER / COLS) * TILE_PX, TILE_PX, TILE_PX);
    p.rect(0, 0, 16, 16, 'rgba(38, 98, 196, 0.62)');
    for (i = 0; i < 16; i++) {
      if (p.rng() < 0.4) p.rect(0, i, 16, 1, 'rgba(90, 150, 230, 0.35)');
      if (p.rng() < 0.25) p.rect(Math.floor(p.rng() * 10), i, 4 + Math.floor(p.rng() * 4), 1, 'rgba(20, 70, 160, 0.4)');
    }

    /* 基岩 */
    p = painter(T.BEDROCK);
    p.speckle('#4a4a4a', '#2e2e2e', '#666666', 0.7);

    /* 砖块 */
    p = painter(T.BRICK);
    p.rect(0, 0, 16, 16, '#9c9c9c'); /* 灰浆底 */
    for (var row = 0; row < 4; row++) {
      var off = (row % 2) === 0 ? 0 : 4;
      for (var bx = -8; bx < 16; bx += 8) {
        var x0 = bx + off;
        var w0 = Math.min(7, 16 - x0);
        if (w0 <= 0) continue;
        if (x0 < 0) { w0 += x0; x0 = 0; }
        if (w0 > 0) p.rect(x0, row * 4, w0, 3, '#9c4a38');
      }
    }

    /* 雪块 */
    p = painter(T.SNOW);
    p.speckle('#eef4f6', '#dde8ec', '#ffffff', 0.35);

    /* 煤矿石 */
    p = painter(T.COAL);
    p.speckle('#8a8a8a', '#787878', '#9c9c9c', 0.5);
    for (i = 0; i < 4; i++) {
      var kx = 2 + Math.floor(p.rng() * 11), ky = 2 + Math.floor(p.rng() * 11);
      p.rect(kx, ky, 2, 2, '#262626');
      p.px(kx + (p.rng() < 0.5 ? -1 : 2), ky + Math.floor(p.rng() * 2), '#1a1a1a');
    }

    /* 铁矿石 */
    p = painter(T.IRON_ORE);
    p.speckle('#8a8a8a', '#787878', '#9c9c9c', 0.5);
    for (i = 0; i < 5; i++) {
      var ix = 2 + Math.floor(p.rng() * 11), iy = 2 + Math.floor(p.rng() * 11);
      p.rect(ix, iy, 2, 2, '#d4a88c');
      p.px(ix, iy, '#f0cfb8');
      p.px(ix + 1, iy + 1, '#b08367');
    }

    /* 金矿石 */
    p = painter(T.GOLD_ORE);
    p.speckle('#8a8a8a', '#787878', '#9c9c9c', 0.5);
    for (i = 0; i < 5; i++) {
      var gx = 2 + Math.floor(p.rng() * 11), gy = 2 + Math.floor(p.rng() * 11);
      p.rect(gx, gy, 2, 2, '#fcee4b');
      p.px(gx, gy, '#fff799');
      p.px(gx + 1, gy + 1, '#d49b13');
    }

    /* 钻石矿石 */
    p = painter(T.DIAMOND_ORE);
    p.speckle('#8a8a8a', '#787878', '#9c9c9c', 0.5);
    for (i = 0; i < 5; i++) {
      var dx = 2 + Math.floor(p.rng() * 11), dy = 2 + Math.floor(p.rng() * 11);
      p.rect(dx, dy, 2, 2, '#5cebf5');
      p.px(dx, dy, '#d4fbff');
      p.px(dx + 1, dy + 1, '#2ba8b8');
    }

    /* 工作台顶面 */
    p = painter(T.CRAFTING_TOP);
    p.speckle('#a3814e', '#96753f', '#b08c58', 0.25);
    p.rect(0, 0, 16, 16, '#6b5230');
    p.rect(1, 1, 14, 14, '#b5925a');
    p.rect(3, 3, 10, 10, '#4a371c');
    p.rect(4, 4, 8, 8, '#cbb281');
    /* 3x3 雕花网格 */
    for (i = 4; i <= 12; i += 3) {
      p.rect(4, i, 8, 1, '#8e6c3a');
      p.rect(i, 4, 1, 8, '#8e6c3a');
    }

    /* 工作台侧面 */
    p = painter(T.CRAFTING_SIDE);
    p.speckle('#a3814e', '#96753f', '#b08c58', 0.25);
    for (i = 0; i < 16; i += 4) p.rect(0, i, 16, 1, '#6b5230');
    /* 挂工具图案（锯子/锤子） */
    p.rect(2, 4, 5, 8, '#3d3d3d');
    p.rect(3, 5, 3, 6, '#8e969b');
    p.rect(9, 4, 5, 2, '#4a3622');
    p.rect(11, 6, 2, 7, '#7d5d36');

    /* 书架侧面 */
    p = painter(T.BOOKSHELF_SIDE);
    p.rect(0, 0, 16, 16, '#a3814e');
    p.rect(0, 0, 16, 2, '#6b5230');
    p.rect(0, 7, 16, 2, '#6b5230');
    p.rect(0, 14, 16, 2, '#6b5230');
    var bookColors = ['#a83232', '#2a6fa8', '#388e3c', '#d4af37', '#8e24aa', '#c25e00'];
    for (var bi = 1; bi < 15; bi += 2) {
      p.rect(bi, 2, 2, 5, bookColors[(bi * 3) % bookColors.length]);
      p.rect(bi, 9, 2, 5, bookColors[(bi * 5) % bookColors.length]);
      p.px(bi, 3, '#fff');
      p.px(bi, 10, '#fff');
    }

    /* TNT 顶面与侧面 */
    p = painter(T.TNT_TOP);
    p.speckle('#c43e2b', '#a32f1e', '#e0533e', 0.3);
    p.rect(4, 4, 8, 8, '#4a4a4a');
    p.rect(6, 6, 4, 4, '#808080');
    p.px(7, 7, '#ffffff');

    p = painter(T.TNT_SIDE);
    p.rect(0, 0, 16, 16, '#c43e2b');
    p.rect(0, 5, 16, 6, '#f4f4f4');
    /* 绘制 TNT 黑色字样 */
    p.rect(1, 6, 4, 1, '#111'); p.rect(2, 7, 2, 3, '#111'); /* T */
    p.rect(6, 6, 1, 4, '#111'); p.rect(7, 7, 1, 1, '#111'); p.rect(8, 8, 1, 1, '#111'); p.rect(9, 6, 1, 4, '#111'); /* N */
    p.rect(11, 6, 4, 1, '#111'); p.rect(12, 7, 2, 3, '#111'); /* T */

    p = painter(T.TNT_BOTTOM);
    p.speckle('#a32f1e', '#802315', '#bd3c28', 0.4);

    /* 萤石 */
    p = painter(T.GLOWSTONE);
    p.speckle('#e8bc58', '#b88c32', '#ffdf85', 0.45);
    for (i = 0; i < 8; i++) {
      var lx = Math.floor(p.rng() * 14), ly = Math.floor(p.rng() * 14);
      p.rect(lx, ly, 2, 2, '#fff1b8');
      p.px(lx, ly, '#ffffff');
    }

    /* 红花（虞美人） */
    p = painter(T.FLOWER_RED);
    ctx.clearRect((T.FLOWER_RED % COLS) * TILE_PX, Math.floor(T.FLOWER_RED / COLS) * TILE_PX, TILE_PX, TILE_PX);
    /* 绿茎与叶 */
    p.rect(7, 6, 2, 10, '#388e3c');
    p.rect(5, 10, 2, 2, '#2e7d32');
    p.rect(9, 12, 2, 2, '#2e7d32');
    /* 红色花瓣 */
    p.rect(5, 3, 6, 5, '#d32f2f');
    p.rect(4, 4, 8, 3, '#e53935');
    p.rect(6, 4, 4, 3, '#b71c1c');
    p.px(7, 5, '#ffeb3b'); /* 花蕊 */

    /* 火把（透明底 + 木棍 + 顶部燃烧炭块与火焰） */
    p = painter(T.TORCH);
    ctx.clearRect((T.TORCH % COLS) * TILE_PX, Math.floor(T.TORCH / COLS) * TILE_PX, TILE_PX, TILE_PX);
    p.rect(7, 5, 2, 10, '#6d5032'); /* 木柄 */
    p.px(7, 6, '#563e26'); p.px(8, 9, '#563e26');
    p.rect(6, 3, 4, 3, '#33271d'); /* 顶部炭块 */
    p.rect(6, 1, 4, 3, '#ff9800'); /* 橙色外焰 */
    p.rect(7, 1, 2, 2, '#ffeb3b'); /* 黄色内焰 */
    p.px(7, 0, '#fff');            /* 顶端火星 */

    /* 镐子绘制辅助函数 */
    function drawPickaxe(tileId, headColor, headLight, headDark) {
      p = painter(tileId);
      ctx.clearRect((tileId % COLS) * TILE_PX, Math.floor(tileId / COLS) * TILE_PX, TILE_PX, TILE_PX);
      /* 斜向木手柄 (2,13) -> (10,5) */
      for (var pi = 0; pi < 9; pi++) {
        p.px(2 + pi, 13 - pi, '#5d4037');
        p.px(3 + pi, 14 - pi, '#795548');
      }
      /* 镐头弧形 */
      p.rect(9, 2, 5, 2, headColor);
      p.rect(13, 3, 2, 4, headColor);
      p.rect(5, 6, 2, 4, headColor);
      p.rect(8, 3, 2, 2, headDark);
      p.px(10, 2, headLight); p.px(11, 2, headLight);
      p.px(14, 3, headLight); p.px(14, 6, headDark);
      p.px(5, 9, headDark); p.px(6, 6, headLight);
    }

    /* 木镐 */
    drawPickaxe(T.PICKAXE_WOOD, '#96753f', '#bfa168', '#6b5230');
    /* 铁镐 */
    drawPickaxe(T.PICKAXE_IRON, '#b0bec5', '#eceff1', '#78909c');
    /* 钻石镐 */
    drawPickaxe(T.PICKAXE_DIAMOND, '#26c6da', '#80deea', '#0097a7');

    /* 计算每个图块的平均颜色（粒子用） */
    var avg = {};
    for (var key in MC.TILE) {
      var tId = MC.TILE[key];
      var sx = (tId % COLS) * TILE_PX, sy = Math.floor(tId / COLS) * TILE_PX;
      var d = ctx.getImageData(sx, sy, TILE_PX, TILE_PX).data;
      var r = 0, g = 0, b = 0, n = 0;
      for (var k = 0; k < d.length; k += 4) {
        if (d[k + 3] < 40) continue;
        r += d[k]; g += d[k + 1]; b += d[k + 2]; n++;
      }
      n = n || 1;
      avg[tId] = [r / n / 255, g / n / 255, b / n / 255];
    }

    return {
      canvas: canvas,
      tilePx: TILE_PX, cols: COLS, rows: ROWS,
      avgColor: function (tileId) { return avg[tileId] || [1, 1, 1]; }
    };
  }

  MC.buildAtlas = buildAtlas;
})();
