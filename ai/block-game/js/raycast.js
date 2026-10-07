/* 体素射线检测（Amanatides & Woo DDA） */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var BLOCK = MC.BLOCK;

  /*
   * o: 起点 [x,y,z]，d: 单位方向，maxDist: 最远距离
   * 返回 {x,y,z,face:[nx,ny,nz],dist,id} 或 null（水与空气不可选中）
   */
  function raycast(world, o, d, maxDist) {
    var x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
    var stepX = d[0] > 0 ? 1 : -1;
    var stepY = d[1] > 0 ? 1 : -1;
    var stepZ = d[2] > 0 ? 1 : -1;
    var tdx = d[0] !== 0 ? Math.abs(1 / d[0]) : Infinity;
    var tdy = d[1] !== 0 ? Math.abs(1 / d[1]) : Infinity;
    var tdz = d[2] !== 0 ? Math.abs(1 / d[2]) : Infinity;
    var tMaxX = d[0] !== 0 ? (d[0] > 0 ? (x + 1 - o[0]) : (o[0] - x)) * tdx : Infinity;
    var tMaxY = d[1] !== 0 ? (d[1] > 0 ? (y + 1 - o[1]) : (o[1] - y)) * tdy : Infinity;
    var tMaxZ = d[2] !== 0 ? (d[2] > 0 ? (z + 1 - o[2]) : (o[2] - z)) * tdz : Infinity;

    var face = null, t = 0;
    for (var i = 0; i < 256; i++) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tdx; face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tdy; face = [0, -stepY, 0];
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tdz; face = [0, 0, -stepZ];
      }
      if (t > maxDist) return null;
      var b = world.getBlock(x, y, z);
      var def = MC.DEFS[b];
      if (b !== BLOCK.AIR && def && def.targetable) {
        return { x: x, y: y, z: z, face: face, dist: t, id: b };
      }
    }
    return null;
  }

  MC.raycast = raycast;
})();
