/* 噪声与随机数（确定性，按种子生成地形） */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed) {
    var s = seed | 0;

    function hash(x, y, z, w) {
      var h = Math.imul(x | 0, 0x27d4eb2d) ^
              Math.imul(y | 0, 0x165667b1) ^
              Math.imul(z | 0, 0x9e3779b1) ^
              Math.imul((s + (w | 0)) | 0, 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
      h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
      h ^= h >>> 15;
      return (h >>> 0) / 4294967296; /* 0..1 */
    }

    function smooth(t) { return t * t * (3 - 2 * t); }

    /* 2D 值噪声，w 用于挑选不同通道 */
    function noise2(x, y, w) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var u = smooth(x - xi), v = smooth(y - yi);
      var a = hash(xi, yi, 0, w),     b = hash(xi + 1, yi, 0, w);
      var c = hash(xi, yi + 1, 0, w), d = hash(xi + 1, yi + 1, 0, w);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }

    function fbm2(x, y, oct, w) {
      var amp = 1, freq = 1, sum = 0, norm = 0, i;
      for (i = 0; i < oct; i++) {
        sum += noise2(x * freq, y * freq, (w || 0) + i * 131) * amp;
        norm += amp; amp *= 0.5; freq *= 2;
      }
      return sum / norm;
    }

    function noise3(x, y, z, w) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      var u = smooth(x - xi), v = smooth(y - yi), t = smooth(z - zi);
      var n000 = hash(xi, yi, zi, w),         n100 = hash(xi + 1, yi, zi, w);
      var n010 = hash(xi, yi + 1, zi, w),     n110 = hash(xi + 1, yi + 1, zi, w);
      var n001 = hash(xi, yi, zi + 1, w),     n101 = hash(xi + 1, yi, zi + 1, w);
      var n011 = hash(xi, yi + 1, zi + 1, w), n111 = hash(xi + 1, yi + 1, zi + 1, w);
      var nx00 = n000 + (n100 - n000) * u, nx10 = n010 + (n110 - n010) * u;
      var nx01 = n001 + (n101 - n001) * u, nx11 = n011 + (n111 - n011) * u;
      var nxy0 = nx00 + (nx10 - nx00) * v, nxy1 = nx01 + (nx11 - nx01) * v;
      return nxy0 + (nxy1 - nxy0) * t;
    }

    return { hash2: function (x, y, w) { return hash(x, y, 0, w); },
             hash3: hash, noise2: noise2, noise3: noise3, fbm2: fbm2,
             rand: mulberry32(s) };
  }

  MC.makeNoise = makeNoise;
  MC.mulberry32 = mulberry32;
})();
