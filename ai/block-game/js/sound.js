/* WebAudio 程序化音效（无音频文件） */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  var ctx = null, master = null;

  function ensureReady() {
    if (!ctx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = api.muted ? 0 : 0.3;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; return false; }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    return true;
  }

  function cleanup(nodes) {
    return function () {
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch (e) {}
      }
    };
  }

  var api = {
    muted: false,
    init: function () {
      ensureReady();
    },
    toggleMute: function () {
      api.muted = !api.muted;
      if (master && ctx) {
        master.gain.setValueAtTime(api.muted ? 0 : 0.3, ctx.currentTime);
      }
      return api.muted;
    },
    /* 挖掘/破坏声：带通滤波的噪声脉冲 */
    breakBlock: function (id) {
      if (api.muted || !ensureReady()) return;
      var freq = 500;
      var B = MC.BLOCK;
      if (id === B.STONE || id === B.COBBLE || id === B.BRICK || id === B.COAL || id === B.BEDROCK) freq = 300;
      else if (id === B.LOG || id === B.PLANK) freq = 480;
      else if (id === B.LEAVES) freq = 900;
      else if (id === B.GLASS) freq = 1500;
      else freq = 700;
      var dur = id === B.GLASS ? 0.15 : 0.1;
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
      var g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(f); f.connect(g); g.connect(master);
      src.onended = cleanup([src, f, g]);
      src.start();
    },
    /* 放置声：短促低频方波 */
    place: function () {
      if (api.muted || !ensureReady()) return;
      var o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 190;
      var g = ctx.createGain();
      var t = ctx.currentTime;
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g); g.connect(master);
      o.onended = cleanup([o, g]);
      o.start(t); o.stop(t + 0.09);
    },
    /* TNT 引线燃烧嘶嘶声 */
    fuse: function () {
      if (api.muted || !ensureReady()) return;
      var len = Math.floor(ctx.sampleRate * 0.18);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 1800;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      src.connect(f); f.connect(g); g.connect(master);
      src.onended = cleanup([src, f, g]);
      src.start();
    },
    /* 爆炸轰鸣声（低频震荡 + 冲击波扩散） */
    explode: function () {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var g1 = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.65);
      g1.gain.setValueAtTime(0.85, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.connect(g1); g1.connect(master);
      o.onended = cleanup([o, g1]);
      o.start(t); o.stop(t + 0.85);

      var len = Math.floor(ctx.sampleRate * 0.7);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
      var nSrc = ctx.createBufferSource();
      nSrc.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(800, t);
      f.frequency.exponentialRampToValueAtTime(110, t + 0.7);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.9, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      nSrc.connect(f); f.connect(g2); g2.connect(master);
      nSrc.onended = cleanup([nSrc, f, g2]);
      nSrc.start(t);
    },
    /* 入水飞溅声 */
    splash: function () {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 0.22);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.setValueAtTime(750, t);
      f.frequency.exponentialRampToValueAtTime(320, t + 0.2);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      src.connect(f); f.connect(g); g.connect(master);
      src.onended = cleanup([src, f, g]);
      src.start(t);
    },
    /* 掉落物磁吸拾取音效（清脆跳跃音阶连击升调） */
    pickup: function () {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      var nowMs = performance.now();
      if (!this._lastPickupT || nowMs - this._lastPickupT > 1200) {
        this._pickupCombo = 0;
      } else {
        this._pickupCombo = ((this._pickupCombo || 0) + 1) % 6;
      }
      this._lastPickupT = nowMs;

      /* 连续拾取音调按十二平均律台阶逐级上升，带来极其爽快的收集解压感 */
      var baseFreq = 740 * Math.pow(1.09, this._pickupCombo);
      var endFreq = baseFreq * 1.55;

      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(baseFreq, t);
      o.frequency.exponentialRampToValueAtTime(endFreq, t + 0.08);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g); g.connect(master);
      o.onended = cleanup([o, g]);
      o.start(t); o.stop(t + 0.1);
    },
    /* 快捷制作/合成成功音效：清脆双音和弦 */
    craft: function () {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach(function (freq, i) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.15, t + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.15);
        o.connect(g); g.connect(master);
        o.onended = cleanup([o, g]);
        o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.16);
      });
    },
    /* 地面移动脚步声（根据方块材质产生不同轻触音） */
    step: function (blockId) {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      var B = MC.BLOCK;
      var freq = 120;
      if (blockId === B.STONE || blockId === B.COBBLE || blockId === B.BRICK) freq = 220;
      else if (blockId === B.SAND || blockId === B.SNOW) freq = 160;
      else if (blockId === B.LOG || blockId === B.PLANK) freq = 180;
      else freq = 130;

      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.07);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(g); g.connect(master);
      o.onended = cleanup([o, g]);
      o.start(t); o.stop(t + 0.08);
    },
    /* 落地闷响（高处坠落着地时触发，音高随冲击力微变） */
    land: function (hard) {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(hard ? 130 : 160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(hard ? 0.35 : 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o.connect(g); g.connect(master);
      o.onended = cleanup([o, g]);
      o.start(t); o.stop(t + 0.14);
    },
    ui: function () {
      if (api.muted || !ensureReady()) return;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 660;
      var g = ctx.createGain();
      var t = ctx.currentTime;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.connect(g); g.connect(master);
      o.onended = cleanup([o, g]);
      o.start(t); o.stop(t + 0.07);
    },
    /* 飞行开启：柔和双音上升脉冲 */
    flyStart: function () {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      [440, 660].forEach(function (freq, i) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t + i * 0.06);
        o.frequency.exponentialRampToValueAtTime(freq * 1.3, t + i * 0.06 + 0.12);
        g.gain.setValueAtTime(0.15, t + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.14);
        o.connect(g); g.connect(master);
        o.onended = cleanup([o, g]);
        o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.15);
      });
    },
    /* 飞行降落退出：柔和下行音 */
    flyEnd: function () {
      if (api.muted || !ensureReady()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.16);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(master);
      o.onended = cleanup([o, g]);
      o.start(t); o.stop(t + 0.19);
    }
  };

  MC.Sound = api;
})();
