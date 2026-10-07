/* 世界：区块数据生成、方块读写、编辑记录 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var BLOCK = MC.BLOCK;

  var CHUNK = 16, H = 64, SEA = 22, SNOW_LINE = 47;
  MC.CHUNK = CHUNK;
  MC.WORLD_H = H;
  MC.SEA_LEVEL = SEA;

  function World(seed) {
    this.seed = seed | 0;
    this.noise = MC.makeNoise(this.seed);
    this.chunks = new Map();   /* "cx,cz" -> {cx,cz,data,mesh} */
    this.edits = new Map();    /* "cx,cz" -> Map(idx -> blockId) */
    this.dirtySet = new Set(); /* 待重建网格的区块 key */
    this.spawn = this._findSpawn();
  }

  World.prototype.key = function (cx, cz) { return cx + ',' + cz; };

  /* ---------- 地形函数（纯函数，任何区块都能独立算出一致结果） ---------- */

  World.prototype.heightAt = function (x, z) {
    var n = this.noise;
    var h = 24 + (n.fbm2(x * 0.0085, z * 0.0085, 4, 0) - 0.5) * 26;
    var m = n.fbm2(x * 0.0038 + 537.3, z * 0.0038 + 193.7, 3, 77);
    if (m > 0.56) h += (m - 0.56) * 110;
    h = Math.floor(h);
    if (h < 2) h = 2;
    if (h > H - 6) h = H - 6;
    return h;
  };

  World.prototype.isTreeAt = function (x, z) {
    return this.noise.hash2(x, z, 9137) < 0.0055;
  };

  World.prototype._caveAt = function (x, y, z) {
    return this.noise.noise3(x * 0.09, y * 0.11, z * 0.09, 311) > 0.74;
  };

  World.prototype._findSpawn = function () {
    for (var r = 0; r < 40; r++) {
      for (var a = 0; a < Math.max(1, r * 6); a++) {
        var ang = (a / Math.max(1, r * 6)) * Math.PI * 2;
        var x = Math.round(Math.cos(ang) * r * 6) + 8;
        var z = Math.round(Math.sin(ang) * r * 6) + 8;
        var h = this.heightAt(x, z);
        /* 避开水面、雪山和树干（防止出生卡进原木） */
        if (h > SEA + 1 && h < SNOW_LINE && !this.isTreeAt(x, z) && !this.isTreeAt(x - 1, z) &&
            !this.isTreeAt(x + 1, z) && !this.isTreeAt(x, z - 1) && !this.isTreeAt(x, z + 1)) {
          return [x + 0.5, h + 1.01, z + 0.5];
        }
      }
      if (r === 0) { /* 中心先试一次 */
        var h0 = this.heightAt(8, 8);
        if (h0 > SEA + 1 && h0 < SNOW_LINE && !this.isTreeAt(8, 8)) return [8.5, h0 + 1.01, 8.5];
      }
    }
    return [8.5, 40, 8.5];
  };

  /* ---------- 区块数据生成 ---------- */

  World.prototype.ensureData = function (cx, cz) {
    var k = this.key(cx, cz);
    var ch = this.chunks.get(k);
    if (ch) return ch;
    ch = { cx: cx, cz: cz, data: new Uint8Array(CHUNK * CHUNK * H), mesh: null };
    this._genChunk(ch);
    this.chunks.set(k, ch);
    return ch;
  };

  World.prototype._genChunk = function (ch) {
    var data = ch.data;
    var bx = ch.cx * CHUNK, bz = ch.cz * CHUNK;
    var x, y, z, h, id;

    for (z = 0; z < CHUNK; z++) {
      for (x = 0; x < CHUNK; x++) {
        var wx = bx + x, wz = bz + z;
        h = this.heightAt(wx, wz);
        var beach = h <= SEA + 1;
        var snowy = h >= SNOW_LINE;
        var allowCave = h > SEA + 1;
        for (y = 0; y < H; y++) {
          if (y === 0) { id = BLOCK.BEDROCK; }
          else if (y <= h - 4) {
            id = BLOCK.STONE;
            if (this.noise.hash3(wx, y, wz, 555) < 0.012) id = BLOCK.COAL;
            else if (y <= 36 && this.noise.hash3(wx, y, wz, 777) < 0.009) id = BLOCK.IRON_ORE;
            else if (y <= 24 && this.noise.hash3(wx, y, wz, 888) < 0.005) id = BLOCK.GOLD_ORE;
            else if (y <= 14 && this.noise.hash3(wx, y, wz, 999) < 0.0035) id = BLOCK.DIAMOND_ORE;
            else if (allowCave && y >= 6 && this._caveAt(wx, y, wz)) id = BLOCK.AIR;
          }
          else if (y < h) {
            id = beach ? BLOCK.SAND : BLOCK.DIRT;
          }
          else if (y === h) {
            id = beach ? BLOCK.SAND : (snowy ? BLOCK.SNOW : BLOCK.GRASS);
          }
          else if (y === h + 1 && !beach && !snowy && h > SEA + 1 && this.noise.hash2(wx, wz, 3333) < 0.018) {
            id = BLOCK.FLOWER_RED;
          }
          else if (y <= SEA) {
            id = BLOCK.WATER;
          }
          else { id = BLOCK.AIR; }
          data[(y * CHUNK + z) * CHUNK + x] = id;
        }
      }
    }

    /* 树木：扫描本区块外扩 2 格的列，保证跨区块的树冠一致 */
    for (var tz = bz - 2; tz < bz + CHUNK + 2; tz++) {
      for (var tx = bx - 2; tx < bx + CHUNK + 2; tx++) {
        if (!this.isTreeAt(tx, tz)) continue;
        var th = this.heightAt(tx, tz);
        if (th <= SEA + 1 || th >= SNOW_LINE) continue;
        var trunk = 4 + Math.floor(this.noise.hash2(tx, tz, 9138) * 3);
        var top = th + trunk;
        var dy, dx2, dz2, yy;
        /* 树干 */
        for (yy = th + 1; yy <= top; yy++) {
          this._setLocal(data, bx, bz, tx, yy, tz, BLOCK.LOG, false);
        }
        /* 树冠 */
        for (yy = top - 2; yy <= top + 1; yy++) {
          var rad = (yy <= top - 1) ? 2 : 1;
          for (dz2 = -rad; dz2 <= rad; dz2++) {
            for (dx2 = -rad; dx2 <= rad; dx2++) {
              if (dx2 === 0 && dz2 === 0 && yy <= top) continue; /* 树干占位 */
              if (Math.abs(dx2) === rad && Math.abs(dz2) === rad) {
                if (rad === 1) continue; /* 顶两层去角 */
                if (this.noise.hash2(tx * 3 + dx2, tz * 3 + dz2, 4242) < 0.5) continue;
              }
              this._setLocal(data, bx, bz, tx + dx2, yy, tz + dz2, BLOCK.LEAVES, true);
            }
          }
        }
      }
    }

    /* 应用玩家编辑（存档恢复） */
    var edits = this.edits.get(this.key(ch.cx, ch.cz));
    if (edits) {
      edits.forEach(function (id2, idx) { data[idx] = id2; });
    }
  };

  World.prototype._setLocal = function (data, bx, bz, wx, wy, wz, id, onlyAir) {
    var lx = wx - bx, lz = wz - bz;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || wy < 0 || wy >= H) return;
    var idx = (wy * CHUNK + lz) * CHUNK + lx;
    if (onlyAir && data[idx] !== BLOCK.AIR) return;
    data[idx] = id;
  };

  /* ---------- 方块读写 ---------- */

  World.prototype.getBlock = function (x, y, z) {
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= H) return BLOCK.AIR;
    var ch = this.ensureData(x >> 4, z >> 4);
    return ch.data[(y * CHUNK + (z & 15)) * CHUNK + (x & 15)];
  };

  World.prototype.setBlock = function (x, y, z, id) {
    if (y < 1 || y >= H) return false; /* 基岩层不可改 */
    var cx = x >> 4, cz = z >> 4;
    var ch = this.ensureData(cx, cz);
    var lx = x & 15, lz = z & 15;
    var idx = (y * CHUNK + lz) * CHUNK + lx;
    var oldId = ch.data[idx];
    if (oldId === id) return true;
    ch.data[idx] = id;

    /* 记录编辑，供存档与重新生成 */
    var k = this.key(cx, cz);
    var m = this.edits.get(k);
    if (!m) { m = new Map(); this.edits.set(k, m); }
    m.set(idx, id);

    /* 检查是否涉及光源方块（火把/萤石等） */
    var oldDef = MC.DEFS[oldId];
    var newDef = MC.DEFS[id];
    var isLightChange = (oldDef && oldDef.light) || (newDef && newDef.light);

    /* 标记需要重建网格（含边角相邻区块，因为面剔除与 AO 跨界） */
    this.dirtySet.add(k);
    var i, j;
    for (i = -1; i <= 1; i++) {
      for (j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        var needX = (lx === 0 && i === -1) || (lx === 15 && i === 1) || i === 0;
        var needZ = (lz === 0 && j === -1) || (lz === 15 && j === 1) || j === 0;
        /* 光源方块具有 8 格衰减辐射，因此必须将周围 8 个邻近区块均标记 dirty */
        if (isLightChange || (needX && needZ)) {
          this.dirtySet.add(this.key(cx + i, cz + j));
        }
      }
    }
    /* 仅当增删光源方块时才使光源缓存失效，避免常规挖掘引发全图遍历 */
    if (isLightChange) {
      this._lightDirty = true;
    }
    return true;
  };

  /*
   * 区块光源列表（火把/萤石等 def.light>0 的方块），带缓存。
   * 返回 [wx,wy,wz,...] 扁平数组；_lightDirty 时全部重算。
   */
  World.prototype.lightListOf = function (cx, cz) {
    if (!this._lightCache) this._lightCache = new Map();
    if (this._lightDirty) {
      this._lightCache.clear();
      this._lightDirty = false;
    }
    var k = this.key(cx, cz);
    var cached = this._lightCache.get(k);
    if (cached) return cached;
    var list = [];
    var ch = this.ensureData(cx, cz);
    if (ch) {
      var bx = cx * CHUNK, bz = cz * CHUNK;
      for (var y = 0; y < H; y++) {
        for (var lz = 0; lz < CHUNK; lz++) {
          for (var lx = 0; lx < CHUNK; lx++) {
            var id = ch.data[(y * CHUNK + lz) * CHUNK + lx];
            var def = MC.DEFS[id];
            if (def && def.light) list.push(bx + lx, y, bz + lz);
          }
        }
      }
    }
    this._lightCache.set(k, list);
    return list;
  };

  /* ---------- 编辑序列化（存档用） ---------- */

  World.prototype.serializeEdits = function () {
    var out = {};
    this.edits.forEach(function (m, k) {
      var o = {};
      m.forEach(function (id, idx) { o[idx] = id; });
      out[k] = o;
    });
    return out;
  };

  World.prototype.loadEdits = function (obj) {
    if (!obj || typeof obj !== 'object') return;
    var self = this;
    Object.keys(obj).forEach(function (k) {
      var o = obj[k];
      if (!o || typeof o !== 'object') return;
      var m = new Map();
      Object.keys(o).forEach(function (idx) {
        var nIdx = +idx;
        var id = o[idx];
        if (Number.isInteger(nIdx) && nIdx >= 0 && nIdx < 16384 && Number.isInteger(id) && id >= 0 && id <= 255) {
          m.set(nIdx, id);
        }
      });
      self.edits.set(k, m);
    });
  };

  MC.World = World;
})();
