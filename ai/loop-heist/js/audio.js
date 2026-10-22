/* 时光回放小偷 · Web Audio 程序化音效（无外部音频文件，不可用时静默降级） */
(function () {
  'use strict';

  var ctx = null;
  var muted = false;

  function getCtx() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, endFreq, duration, type, volume, delay) {
    var c = getCtx();
    if (!c || muted) return;
    if (c.state === 'suspended') c.resume();
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
    gain.gain.setValueAtTime(volume || 0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  window.LH_AUDIO = {
    unlock: function () { getCtx(); },
    setMuted: function (v) { muted = !!v; },
    isMuted: function () { return muted; },
    step: function () { tone(520, 480, 0.05, 'triangle', 0.05); },
    loot: function () {
      tone(880, 1320, 0.12, 'square', 0.06);
      tone(1320, 1760, 0.12, 'square', 0.05, 0.08);
    },
    loop: function () { tone(220, 880, 0.35, 'sawtooth', 0.05); },
    alarm: function () {
      tone(420, 180, 0.4, 'square', 0.07);
      tone(420, 180, 0.4, 'square', 0.07, 0.45);
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0, 0.18, 'triangle', 0.08, i * 0.1);
      });
    }
  };
})();
