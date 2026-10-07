/**
 * 《404 之前：互联网考古馆》- 原生 Web Audio API 声音合成模块
 * 零外部音频依赖，完全由振荡器与白噪合成器纯代码生成
 */

import { museumStore } from './state.js';

class AudioManager {
  constructor() {
    this.ctx = null;
    this.bgmPlaying = false;
    this.bgmOscs = [];
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isSoundEnabled() {
    return museumStore.getState().soundEnabled;
  }

  // 基础通用点击音
  playClick() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // 年代切换滑动音
  playEraTransition() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  // 1998 经典拨号声合成（双音多频 DTMF + 调制解调器握手噪波）
  playDialup(onProgress, onComplete) {
    const playFallbackSteps = () => {
      const steps = [
        { text: '初始化端口 COM1...', delay: 600 },
        { text: '正在拨号 ATDT 16300...', delay: 1800 },
        { text: '线路接通，等待载波...', delay: 3000 },
        { text: '握手协商：V.90 56K 协议匹配...', delay: 4500 },
        { text: '正在验证用户凭证 (guest)...', delay: 5800 },
        { text: '已分配 IP: 202.96.128.86 (33.6Kbps)', delay: 6800 }
      ];
      steps.forEach(st => {
        setTimeout(() => {
          if (onProgress) onProgress(st.text);
        }, st.delay);
      });
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 7200);
    };

    if (!this.isSoundEnabled()) {
      playFallbackSteps();
      return;
    }

    this.ensureContext();
    if (!this.ctx) {
      playFallbackSteps();
      return;
    }

    const now = this.ctx.currentTime;

    // 1. DTMF 模拟拨号号码双音 (697Hz+1209Hz, 770Hz+1336Hz 等)
    const dtmfPairs = [
      [697, 1209], [770, 1336], [852, 1477], [941, 1336], [697, 1477]
    ];
    let toneTime = now + 0.5;

    dtmfPairs.forEach((pair, idx) => {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc1.frequency.value = pair[0];
      osc2.frequency.value = pair[1];
      g.gain.setValueAtTime(0.08, toneTime);
      g.gain.exponentialRampToValueAtTime(0.001, toneTime + 0.14);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(this.ctx.destination);

      osc1.start(toneTime);
      osc2.start(toneTime);
      osc1.stop(toneTime + 0.15);
      osc2.stop(toneTime + 0.15);

      toneTime += 0.22;
    });

    // 2. 拨号完毕后握手高频蜂鸣与调频杂音 (modem handshake screech)
    const screechStart = toneTime + 0.2;
    const screechOsc = this.ctx.createOscillator();
    const screechGain = this.ctx.createGain();
    screechOsc.type = 'sawtooth';
    screechOsc.frequency.setValueAtTime(1800, screechStart);
    screechOsc.frequency.linearRampToValueAtTime(2400, screechStart + 0.8);
    screechOsc.frequency.linearRampToValueAtTime(1200, screechStart + 1.5);
    screechGain.gain.setValueAtTime(0.08, screechStart);
    screechGain.gain.exponentialRampToValueAtTime(0.001, screechStart + 2.0);

    screechOsc.connect(screechGain);
    screechGain.connect(this.ctx.destination);
    screechOsc.start(screechStart);
    screechOsc.stop(screechStart + 2.0);

    // 3. 握手白噪声 (模拟调制解调器嘶嘶声)
    const noiseStart = screechStart + 0.5;
    const bufferSize = this.ctx.sampleRate * 2.2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, noiseStart);
    filter.Q.value = 3.0;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.06, noiseStart);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, noiseStart + 2.2);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(noiseStart);
    whiteNoise.stop(noiseStart + 2.2);

    // 4. 连接成功提示双音
    const successTime = noiseStart + 2.5;
    const okOsc = this.ctx.createOscillator();
    const okGain = this.ctx.createGain();
    okOsc.type = 'square';
    okOsc.frequency.setValueAtTime(523.25, successTime); // C5
    okOsc.frequency.setValueAtTime(659.25, successTime + 0.15); // E5
    okOsc.frequency.setValueAtTime(783.99, successTime + 0.3); // G5
    okGain.gain.setValueAtTime(0.1, successTime);
    okGain.gain.exponentialRampToValueAtTime(0.001, successTime + 0.7);

    okOsc.connect(okGain);
    okGain.connect(this.ctx.destination);
    okOsc.start(successTime);
    okOsc.stop(successTime + 0.7);

    // 回调事件
    const textSteps = [
      { text: '初始化端口 COM1...', delay: 300 },
      { text: '正在拨号 ATDT 16300...', delay: 1000 },
      { text: '线路接通，双向握手协商中...', delay: 2400 },
      { text: '数据载波稳定，交换加密散列...', delay: 3800 },
      { text: '分配动态 IP: 202.96.128.86', delay: 4800 },
      { text: '已连接互联网！当前速率 33.6Kbps', delay: 5600 }
    ];

    textSteps.forEach(st => {
      setTimeout(() => {
        if (onProgress) onProgress(st.text);
      }, st.delay);
    });

    setTimeout(() => {
      if (onComplete) onComplete();
    }, 6000);
  }

  // 2003 个人主页复古 8-bit / MIDI 八音盒旋律
  play2003Melody() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    // 播放一段活泼的怀旧琶音旋律
    const notes = [
      { freq: 523.25, duration: 0.2 }, // C5
      { freq: 659.25, duration: 0.2 }, // E5
      { freq: 783.99, duration: 0.2 }, // G5
      { freq: 1046.50, duration: 0.3 }, // C6
      { freq: 880.00, duration: 0.2 }, // A5
      { freq: 783.99, duration: 0.2 }, // G5
      { freq: 659.25, duration: 0.4 }  // E5
    ];

    let t = this.ctx.currentTime;
    notes.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + note.duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + note.duration);

      t += note.duration + 0.05;
    });
  }

  // 2008 论坛回帖/顶帖音效
  playForumPostSound() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // 2012 空间水滴/点赞特效音
  playWaterDrop() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // 2024 算法推送/分析滑动音
  playAlgorithmFeed() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // 2099 碎片对位磁吸音
  playSnap() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // 2099 碎片错位弹回错误音
  playReject() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  // 2099 终极遗迹修复成功大和弦
  playRestorationSuccess() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const chord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const now = this.ctx.currentTime;

    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.8);
    });
  }

  // 彩蛋解锁胜利闪光音
  playEggUnlock() {
    if (!this.isSoundEnabled()) return;
    this.ensureContext();
    if (!this.ctx) return;

    const tones = [587.33, 739.99, 880.00, 1174.66];
    let t = this.ctx.currentTime;

    tones.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.35);

      t += 0.1;
    });
  }
}

export const audioManager = new AudioManager();
