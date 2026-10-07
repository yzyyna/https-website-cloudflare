/* 破坏方块的粒子效果（WebGL 点精灵） */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  function Particles() {
    this.list = [];
    this._arr = new Float32Array(0);
  }

  /* 在方块位置喷出一撮带方块颜色的碎片 */
  Particles.prototype.spawnBurst = function (atlas, blockId, bx, by, bz) {
    var def = MC.DEFS[blockId];
    var tileId = def && def.side !== undefined ? def.side : 3;
    var rgb = atlas.avgColor(tileId);
    var n = 14;
    for (var i = 0; i < n; i++) {
      var shade = 0.75 + Math.random() * 0.4;
      this.list.push({
        x: bx + 0.15 + Math.random() * 0.7,
        y: by + 0.15 + Math.random() * 0.7,
        z: bz + 0.15 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 4.2,
        vy: 1.5 + Math.random() * 3.2,
        vz: (Math.random() - 0.5) * 4.2,
        age: 0,
        life: 0.35 + Math.random() * 0.4,
        r: Math.min(1, rgb[0] * shade),
        g: Math.min(1, rgb[1] * shade),
        b: Math.min(1, rgb[2] * shade),
        size: 0.09 + Math.random() * 0.09
      });
    }
    if (this.list.length > 400) this.list.splice(0, this.list.length - 400);
  };

  Particles.prototype.update = function (dt) {
    var list = this.list;
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.age += dt;
      if (p.age >= p.life) { list.splice(i, 1); continue; }
      p.vy -= 13 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  };

  /* 输出 [x,y,z, r,g,b, size] 交错数组 */
  Particles.prototype.getData = function () {
    var n = this.list.length;
    if (this._arr.length < n * 7) this._arr = new Float32Array(n * 7);
    for (var i = 0; i < n; i++) {
      var p = this.list[i], k = i * 7;
      this._arr[k] = p.x; this._arr[k + 1] = p.y; this._arr[k + 2] = p.z;
      this._arr[k + 3] = p.r; this._arr[k + 4] = p.g; this._arr[k + 5] = p.b;
      this._arr[k + 6] = p.size;
    }
    return { arr: this._arr, count: n };
  };

  MC.Particles = Particles;
})();
