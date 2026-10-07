/**
 * audio.js - Web Audio API 原生 8-bit 复古音频合成引擎
 * 零外部音频文件依赖，直接通过 OscillatorNode 与 GainNode 实时合成声波
 */

window.PotatoAudio = (function () {
  let audioCtx = null;
  let masterGain = null;
  let lastToneTime = 0;
  let isMuted = false;
  try {
    isMuted = localStorage.getItem('cyber_potato_muted') === 'true';
  } catch (e) {}

  function getContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function setMuted(muted) {
    isMuted = muted;
    try {
      localStorage.setItem('cyber_potato_muted', muted ? 'true' : 'false');
    } catch (e) {}
  }

  function toggleMute() {
    setMuted(!isMuted);
    return isMuted;
  }

  // 基础蜂鸣音 (方波/三角波/正弦波)
  function playTone(freq, type = 'square', duration = 0.08, startVol = 0.1, stopVol = 0.001) {
    if (isMuted) return;
    const now = Date.now();
    if (now - lastToneTime < 16) return; // 频率节流防爆音
    lastToneTime = now;

    try {
      const ctx = getContext();
      if (!ctx || !masterGain) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(startVol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(stopVol, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // 忽略音频异常
    }
  }

  // 1. 打字机嗒嗒声 (清脆极短)
  function playTypewriter() {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const freq = 600 + Math.random() * 300;
      playTone(freq, 'triangle', 0.02, 0.04, 0.001);
    } catch (e) {}
  }

  // 2. 喂食吞咽咀嚼音效 (柔和阶梯递降)
  function playFeed() {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const notes = [320, 260, 200];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          playTone(freq, 'sine', 0.08, 0.15, 0.01);
        }, idx * 70);
      });
    } catch (e) {}
  }

  // 3. 喝咖啡 / 赛博过载超频 (高频音阶快速冲顶 Laser / PowerUp)
  function playCoffee() {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  // 4. 读书 / 领悟智慧 (清脆双音和弦)
  function playBook() {
    if (isMuted) return;
    playTone(523.25, 'triangle', 0.12, 0.15, 0.01); // C5
    setTimeout(() => {
      playTone(659.25, 'triangle', 0.18, 0.15, 0.01); // E5
    }, 90);
  }

  // 5. 戳一戳 Q 弹音效 (Boing 弹簧下滑)
  function playPoke() {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch (e) {}
  }

  // 6. 暴怒 / 警报音效 (刺耳交替双频)
  function playAlarm() {
    if (isMuted) return;
    playTone(880, 'square', 0.08, 0.15, 0.01);
    setTimeout(() => {
      playTone(440, 'square', 0.08, 0.15, 0.01);
    }, 90);
  }

  // 7. 辞职信重磅盖章咚的一声 (低音打击)
  function playStamp() {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }

  // 8. 抚摸摸头心跳音
  function playPet() {
    if (isMuted) return;
    playTone(349.23, 'sine', 0.15, 0.1, 0.01); // F4
    setTimeout(() => {
      playTone(440.00, 'sine', 0.18, 0.1, 0.01); // A4
    }, 100);
  }

  return {
    isMuted: () => isMuted,
    setMuted,
    toggleMute,
    playTypewriter,
    playFeed,
    playCoffee,
    playBook,
    playPoke,
    playAlarm,
    playStamp,
    playPet
  };
})();
