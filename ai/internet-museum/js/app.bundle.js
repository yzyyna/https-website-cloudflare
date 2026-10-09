(() => {
  "use strict";
  // === 状态管理 (state.js) ===
  /**
 * 《404 之前：互联网考古馆》- 全局状态管理
 * 负责状态存储、localStorage 读写与事件广播
 */

const STORAGE_KEY = 'internet-museum-state-v1';

// 6个年代元数据定义
const ERAS_CONFIG = [
  {
    year: 1998,
    name: '拨号接入室',
    speed: '33.6 kbps',
    statusText: '调制解调器已就绪，正在侦听电话线路',
    themeColor: '#008080'
  },
  {
    year: 2003,
    name: '个人主页花园',
    speed: '512 kbps',
    statusText: 'ADSL 宽带稳定连接中，欢迎访问小主页',
    themeColor: '#ff69b4'
  },
  {
    year: 2008,
    name: '深夜论坛',
    speed: '2 Mbps',
    statusText: '小区宽带连接良好，正在同步深夜讨论版',
    themeColor: '#2b5886'
  },
  {
    year: 2012,
    name: '青春空间',
    speed: '20 Mbps',
    statusText: '光纤入户，正在装扮并加载好友个性动态',
    themeColor: '#7b4397'
  },
  {
    year: 2024,
    name: '算法走廊',
    speed: '1000 Mbps (5G)',
    statusText: '高速超宽带，推荐算法正在高速拟合用户特征',
    themeColor: '#0f172a'
  },
  {
    year: 2099,
    name: '网页遗址修复中心',
    speed: '量子网络 (∞)',
    statusText: '全息信标已同步，正在重建 20-21 世纪失落文明',
    themeColor: '#06b6d4'
  }
];

// 彩蛋元数据定义
const EGGS_METADATA = {
  broken_floppy: {
    id: 'broken_floppy',
    era: 1998,
    title: '互联网勇气软盘',
    icon: '💾',
    desc: '点击了“不要点.exe”获得的像素猫遗迹。在未知面前，人们最初的上网动力正是这一份毫无防备的好奇心。',
    foundAt: '1998 桌面不要点.exe'
  },
  glitter_cursor: {
    id: 'glitter_cursor',
    era: 2003,
    title: '星光闪烁指针',
    icon: '✨',
    desc: '狂点计数器直到变成5201314。那时候每个站长都在代码里藏着自己悄悄喜欢的那个人的名字。',
    foundAt: '2003 访客计数器异常'
  },
  eternal_online_avatar: {
    id: 'eternal_online_avatar',
    era: 2008,
    title: '永不下线的幽灵头像',
    icon: '👤',
    desc: '一个注册于2008年8月8日且永远在线的ID。只要论坛没有关服，有些人就好像从未离开过那年夏天。',
    foundAt: '2008 论坛幽灵在线人数'
  },
  unsent_status: {
    id: 'unsent_status',
    era: 2012,
    title: '未发送的草稿纸',
    icon: '💌',
    desc: '匿名访客留下的未发说说：“如果你今天在线，我就告诉你那个秘密”。草稿箱里装满了青春的怯懦。',
    foundAt: '2012 空间匿名访客记录'
  },
  preference_shadow: {
    id: 'preference_shadow',
    era: 2024,
    title: '算法投喂的倒影',
    icon: '👁️',
    desc: '荒诞的算法透明度报告。屏幕前的人以为自己在刷内容，屏幕后的公式正在给人类贴上第487个标签。',
    foundAt: '2024 为什么推荐给我？'
  },
  restored_memory: {
    id: 'restored_memory',
    era: 2099,
    title: '被保存的数字记忆核',
    icon: '🔮',
    desc: '集齐碎片修复成功的完整档案。技术会更迭，服务器会下线，但人类隔着网线渴望彼此相连的温度永不消逝。',
    foundAt: '2099 终极遗迹拼图完成'
  }
};

const defaultState = {
  currentEra: 1998,
  soundEnabled: false,
  eggs: [], // 已收集彩蛋ID列表
  // 1998状态
  connected1998: false,
  // 2003状态
  moodIndex: 0,
  guestbookMessages: [
    { name: '风之子', text: '路过踩踩，小窝很漂亮哦，记得回踩！', time: '2003-05-12' },
    { name: '紫水晶女孩', text: '背景音乐很好听，留个脚印 (*^__^*)', time: '2003-06-01' }
  ],
  visitorCount: 1314,
  // 2008状态
  forumUpvotes: 3,
  forumReplies: [],
  // 2012状态
  spaceSkin: 'sakura', // sakura, blue, night
  spaceDecorScore: 45,
  spacePosts: [
    {
      text: '有时候不是网速慢了，是想等的那个人不会再上线了。',
      source: 'iPhone 4S 客户端',
      time: '2012-10-24 22:15',
      likes: 12
    }
  ],
  // 2024状态
  algorithmPreference: {
    cat: 0,
    productivity: 0,
    emotion: 0
  },
  algorithmDismissed: [],
  // 2099状态
  restoredFragments: [], // 已修复的碎片ID
  restorationComplete: false
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

class MuseumStore {
  constructor() {
    this.state = this.loadState();
    this.listeners = [];
  }

  loadState() {
    const base = cloneDefaultState();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.eggs)) base.eggs = parsed.eggs.filter(x => typeof x === 'string');
          if (typeof parsed.soundEnabled === 'boolean') base.soundEnabled = parsed.soundEnabled;
          if (typeof parsed.crtEffect === 'boolean') base.crtEffect = parsed.crtEffect;
          if (typeof parsed.currentEra === 'number') base.currentEra = parsed.currentEra;
          if (typeof parsed.connected1998 === 'boolean') base.connected1998 = parsed.connected1998;
          if (typeof parsed.counter2003 === 'number') base.counter2003 = Math.max(0, parsed.counter2003 | 0);
          if (typeof parsed.music2003Playing === 'boolean') base.music2003Playing = parsed.music2003Playing;
          if (typeof parsed.moodIndex === 'number') base.moodIndex = Math.max(0, parsed.moodIndex | 0);
          if (Array.isArray(parsed.guestbookMessages)) {
            base.guestbookMessages = parsed.guestbookMessages.filter(m => m && typeof m === 'object');
          }
          if (Array.isArray(parsed.forumPosts)) base.forumPosts = parsed.forumPosts;
          if (typeof parsed.forumSignature === 'string') base.forumSignature = parsed.forumSignature;
          if (typeof parsed.spaceSkin === 'string') base.spaceSkin = parsed.spaceSkin;
          if (typeof parsed.spaceDecorScore === 'number') base.spaceDecorScore = Math.min(100, Math.max(0, parsed.spaceDecorScore | 0));
          if (Array.isArray(parsed.spacePosts)) base.spacePosts = parsed.spacePosts;
          if (parsed.algorithmPreference && typeof parsed.algorithmPreference === 'object') {
            base.algorithmPreference = {
              cat: Number(parsed.algorithmPreference.cat) || 0,
              productivity: Number(parsed.algorithmPreference.productivity) || 0,
              emotion: Number(parsed.algorithmPreference.emotion) || 0
            };
          }
          if (Array.isArray(parsed.algorithmDismissed)) base.algorithmDismissed = parsed.algorithmDismissed;
          if (Array.isArray(parsed.restoredFragments)) base.restoredFragments = parsed.restoredFragments.filter(x => typeof x === 'string');
          if (typeof parsed.restorationComplete === 'boolean') base.restorationComplete = parsed.restorationComplete;
        }
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
    return base;
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
    this.notify();
  }

  getState() {
    return this.state;
  }

  update(patch) {
    this.state = { ...this.state, ...patch };
    this.saveState();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  /**
   * 收集彩蛋
   * @param {string} eggId
   * @returns {boolean} 是否为首次收集
   */
  unlockEgg(eggId) {
    if (!EGGS_METADATA[eggId]) return false;
    if (this.state.eggs.includes(eggId)) {
      return false; // 已收集
    }
    const nextEggs = [...this.state.eggs, eggId];
    this.update({ eggs: nextEggs });
    return true; // 新解锁
  }

  hasEgg(eggId) {
    return this.state.eggs.includes(eggId);
  }

  resetAll() {
    this.state = cloneDefaultState();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    this.notify();
  }
}

const museumStore = new MuseumStore();


  // === 音频合成 (audio.js) ===
  /**
 * 《404 之前：互联网考古馆》- 原生 Web Audio API 声音合成模块
 * 零外部音频依赖，完全由振荡器与白噪合成器纯代码生成
 */


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

const audioManager = new AudioManager();


  // === 导航驱动 (navigation.js) ===
  /**
 * 《404 之前：互联网考古馆》- 导航与时间轴驱动模块
 * 负责横向展区滚动、手势拖拽、键盘导航与时代同步
 */


class NavigationManager {
  constructor() {
    this.galleryEl = null;
    this.timelineNodesEl = null;
    this.timelineProgressEl = null;
    this.eraIndicatorEl = null;
    this.speedIndicatorEl = null;
    this.statusIndicatorEl = null;
    this.eggCountEl = null;

    this.eras = ERAS_CONFIG;
    this.currentIndex = 0;
    this.isProgrammaticScroll = false;
    this.scrollTimeout = null;

    // 手势拖拽状态
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeftStart = 0;
  }

  init() {
    this.galleryEl = document.querySelector('.gallery');
    this.timelineNodesEl = document.querySelectorAll('.timeline-node');
    this.timelineProgressEl = document.querySelector('.timeline-progress-fill');
    this.eraIndicatorEl = document.getElementById('current-era-display');
    this.speedIndicatorEl = document.getElementById('current-speed-display');
    this.statusIndicatorEl = document.getElementById('current-status-display');
    this.eggCountEl = document.getElementById('eggs-count-display');

    if (!this.galleryEl) return;

    this.bindEvents();
    this.syncFromState();
  }

  bindEvents() {
    // 1. 监听横向滚动，使用防抖与 Intersection 检测当前时代
    this.galleryEl.addEventListener('scroll', () => {
      if (this.isProgrammaticScroll) return;
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.detectCurrentEraFromScroll();
      }, 60);
    }, { passive: true });

    // 2. 滚轮事件优化：精准判定纵向滚动意图，避免阻碍展厅内容垂直阅读
    this.galleryEl.addEventListener('wheel', (e) => {
      // 若主要是横向滚动（如触控板左右轻扫），直接交由原生处理
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return;
      }

      // 沿着 DOM 树向上检测当前指针所在的所有可垂直滚动的容器（含内部列表与展厅本身）
      let targetEl = e.target;
      while (targetEl && targetEl !== this.galleryEl) {
        const style = window.getComputedStyle(targetEl);
        const overflowY = style.overflowY;
        const isScrollContainer = (overflowY === 'auto' || overflowY === 'scroll') && targetEl.scrollHeight > targetEl.clientHeight;

        if (isScrollContainer) {
          const canScrollUp = e.deltaY < 0 && targetEl.scrollTop > 0;
          const canScrollDown = e.deltaY > 0 && (targetEl.scrollTop + targetEl.clientHeight < targetEl.scrollHeight - 1);

          // 若当前容器在其垂直方向上还有滚动空间，优先执行正常的垂直滚动！
          if (canScrollUp || canScrollDown) {
            return;
          }
        }
        targetEl = targetEl.parentElement;
      }

      // 仅在当前垂直空间已到顶/到底，或无需纵向滚动的展区内，才将滚轮转换为横向穿梭
      if (Math.abs(e.deltaY) > 10) {
        e.preventDefault();
        this.galleryEl.scrollBy({
          left: e.deltaY * 1.3,
          behavior: 'auto'
        });
      }
    }, { passive: false });

    // 3. 键盘左右键切换
    window.addEventListener('keydown', (e) => {
      // 避免输入框内按左右键触发切屏
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        this.nextEra();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.prevEra();
      }
    });

    // 4. 鼠标指针拖拽滑动支持
    this.galleryEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, textarea, a, .clickable, .draggable-item')) return;
      this.isDragging = true;
      this.startX = e.pageX - this.galleryEl.offsetLeft;
      this.scrollLeftStart = this.galleryEl.scrollLeft;
      this.galleryEl.style.cursor = 'grabbing';
      this.galleryEl.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.pageX - this.galleryEl.offsetLeft;
      const walk = (x - this.startX) * 1.2;
      this.galleryEl.scrollLeft = this.scrollLeftStart - walk;
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.galleryEl.style.cursor = '';
        this.galleryEl.style.removeProperty('user-select');
        this.snapToNearestEra();
      }
    });

    // 5. 底部时间轴节点点击
    this.timelineNodesEl.forEach((node) => {
      node.addEventListener('click', () => {
        const year = parseInt(node.dataset.year, 10);
        this.goToEraByYear(year);
      });
    });

    // 6. 前后切换按钮
    const prevBtn = document.getElementById('btn-prev-era');
    const nextBtn = document.getElementById('btn-next-era');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prevEra());
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextEra());

    // 7. 监听状态更新同步
    museumStore.subscribe((state) => {
      this.updateIndicators(state.currentEra);
      if (this.eggCountEl) {
        this.eggCountEl.textContent = `${state.eggs.length} / 6`;
      }
    });
  }

  snapToNearestEra() {
    const width = this.galleryEl.clientWidth;
    const scrollLeft = this.galleryEl.scrollLeft;
    const targetIdx = Math.round(scrollLeft / width);
    this.goToEraByIndex(targetIdx);
    this.haptic();
  }

  /* 触觉反馈（Android Vibration API；iOS 静默降级无副作用） */
  haptic(pattern) {
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern || 12);
    } catch (e) {}
  }

  detectCurrentEraFromScroll() {
    const width = this.galleryEl.clientWidth || window.innerWidth;
    const scrollLeft = this.galleryEl.scrollLeft;
    const index = Math.round(scrollLeft / width);
    const clampedIndex = Math.max(0, Math.min(this.eras.length - 1, index));

    if (clampedIndex !== this.currentIndex) {
      this.currentIndex = clampedIndex;
      const targetEra = this.eras[clampedIndex];
      museumStore.update({ currentEra: targetEra.year });
      audioManager.playEraTransition();
    }
  }

  goToEraByIndex(index, smooth = true) {
    const clampedIndex = Math.max(0, Math.min(this.eras.length - 1, index));
    const width = this.galleryEl.clientWidth || window.innerWidth;
    const targetScroll = clampedIndex * width;

    this.isProgrammaticScroll = true;
    this.currentIndex = clampedIndex;
    const targetEra = this.eras[clampedIndex];

    museumStore.update({ currentEra: targetEra.year });
    audioManager.playEraTransition();

    this.galleryEl.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto'
    });

    if (this._programmaticTimer) clearTimeout(this._programmaticTimer);
    this._programmaticTimer = setTimeout(() => {
      this.isProgrammaticScroll = false;
      this.updateIndicators(targetEra.year);
    }, smooth ? 450 : 50);
  }

  goToEraByYear(year) {
    const idx = this.eras.findIndex(e => e.year === year);
    if (idx !== -1) {
      this.goToEraByIndex(idx);
    }
  }

  nextEra() {
    if (this.currentIndex < this.eras.length - 1) {
      this.goToEraByIndex(this.currentIndex + 1);
    }
  }

  prevEra() {
    if (this.currentIndex > 0) {
      this.goToEraByIndex(this.currentIndex - 1);
    }
  }

  syncFromState() {
    const state = museumStore.getState();
    const idx = this.eras.findIndex(e => e.year === state.currentEra);
    const initialIndex = idx !== -1 ? idx : 0;
    this.goToEraByIndex(initialIndex, false);
    if (this.eggCountEl) {
      this.eggCountEl.textContent = `${state.eggs.length} / 6`;
    }
  }

  updateIndicators(year) {
    const config = this.eras.find(e => e.year === year) || this.eras[0];
    const index = this.eras.findIndex(e => e.year === year);

    if (this.eraIndicatorEl) {
      this.eraIndicatorEl.textContent = `${config.year} · ${config.name}`;
      this.eraIndicatorEl.style.borderColor = config.themeColor;
    }
    if (this.speedIndicatorEl) {
      this.speedIndicatorEl.textContent = config.speed;
    }
    if (this.statusIndicatorEl) {
      this.statusIndicatorEl.textContent = config.statusText;
    }

    // 更新时间轴高亮和进度线
    if (this.timelineNodesEl) {
      this.timelineNodesEl.forEach((node, i) => {
        const nodeYear = parseInt(node.dataset.year, 10);
        if (nodeYear === year) {
          node.classList.add('active');
        } else if (i < index) {
          node.classList.add('passed');
          node.classList.remove('active');
        } else {
          node.classList.remove('active', 'passed');
        }
      });
    }

    if (this.timelineProgressEl) {
      const percent = (index / (this.eras.length - 1)) * 100;
      this.timelineProgressEl.style.width = `${percent}%`;
    }
  }
}

const navigationManager = new NavigationManager();


  // === 彩蛋系统 (eggs.js) ===
  /**
 * 《404 之前：互联网考古馆》- 彩蛋系统与考古发现册
 * 负责彩蛋收集反馈、画册渲染与离线档案导出
 */


function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class EggsManager {
  constructor() {
    this.modalEl = null;
    this.bookDrawerEl = null;
  }

  init() {
    this.modalEl = document.getElementById('egg-unlock-modal');
    this.bookDrawerEl = document.getElementById('archaeology-book-drawer');

    this.bindEvents();
  }

  bindEvents() {
    // 点击顶部彩蛋计数器打开发现册
    const eggsWidget = document.getElementById('eggs-widget-btn');
    if (eggsWidget) {
      eggsWidget.addEventListener('click', () => {
        audioManager.playClick();
        this.openBook();
      });
    }

    // 关闭发现册
    const closeBookBtn = document.getElementById('btn-close-book');
    if (closeBookBtn) {
      closeBookBtn.addEventListener('click', () => {
        audioManager.playClick();
        this.closeBook();
      });
    }

    // 关闭彩蛋解锁弹窗
    const closeUnlockBtn = document.getElementById('btn-close-unlock-modal');
    if (closeUnlockBtn) {
      closeUnlockBtn.addEventListener('click', () => {
        audioManager.playClick();
        this.closeUnlockModal();
      });
    }

    // 重置进度按钮
    const resetBtn = document.getElementById('btn-reset-progress');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (window.confirm('确定要清除所有考古进度与彩蛋记录，重新开始探索吗？')) {
          museumStore.resetAll();
          window.location.reload();
        }
      });
    }

    // 导出纪念册
    const exportBtn = document.getElementById('btn-export-memory-html');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportStandaloneHTML();
      });
    }
  }

  triggerEgg(eggId) {
    const isNew = museumStore.unlockEgg(eggId);
    const egg = EGGS_METADATA[eggId];
    if (!egg) return;

    if (isNew) {
      audioManager.playEggUnlock();
      this.haptic(35);
      this.showUnlockModal(egg);
    } else {
      // 若已解锁，给出轻量 toast 提示已收录
      this.haptic(15);
      this.showToast(`已在考古发现册中：${egg.title}`);
    }
  }

  showUnlockModal(egg) {
    if (!this.modalEl) return;
    const iconEl = this.modalEl.querySelector('.egg-modal-icon');
    const titleEl = this.modalEl.querySelector('.egg-modal-title');
    const descEl = this.modalEl.querySelector('.egg-modal-desc');
    const locationEl = this.modalEl.querySelector('.egg-modal-location');

    if (iconEl) iconEl.textContent = egg.icon;
    if (titleEl) titleEl.textContent = `发现彩蛋：${egg.title}`;
    if (descEl) descEl.textContent = egg.desc;
    if (locationEl) locationEl.textContent = `遗址来源：${egg.foundAt}`;

    this.modalEl.classList.remove('hidden');
    this.modalEl.classList.add('visible');
  }

  closeUnlockModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('visible');
    setTimeout(() => {
      this.modalEl.classList.add('hidden');
    }, 200);
  }

  openBook() {
    this.renderBookGrid();
    if (this.bookDrawerEl) {
      this.bookDrawerEl.classList.remove('hidden');
      this.bookDrawerEl.classList.add('visible');
    }
  }

  closeBook() {
    if (this.bookDrawerEl) {
      this.bookDrawerEl.classList.remove('visible');
      setTimeout(() => {
        this.bookDrawerEl.classList.add('hidden');
      }, 200);
    }
  }

  showToast(text) {
    const toast = document.createElement('div');
    toast.className = 'museum-toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /* 触觉反馈（Android Vibration API；iOS 静默降级无副作用） */
  haptic(pattern) {
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch (e) {}
  }

  renderBookGrid() {
    const gridEl = document.getElementById('archaeology-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const state = museumStore.getState();
    const allEggs = Object.values(EGGS_METADATA);

    allEggs.forEach((egg) => {
      const unlocked = state.eggs.includes(egg.id);
      const card = document.createElement('div');
      card.className = `egg-card ${unlocked ? 'unlocked' : 'locked'}`;

      if (unlocked) {
        card.innerHTML = `
          <div class="egg-card-header">
            <span class="egg-badge">${egg.era} 年代</span>
            <span class="egg-icon-large">${egg.icon}</span>
          </div>
          <h4 class="egg-title">${egg.title}</h4>
          <p class="egg-desc">${egg.desc}</p>
          <div class="egg-origin">📍 发现地：${egg.foundAt}</div>
        `;
      } else {
        card.innerHTML = `
          <div class="egg-card-header">
            <span class="egg-badge">${egg.era} 年代</span>
            <span class="egg-icon-large">🔒</span>
          </div>
          <h4 class="egg-title">未解档案：未知遗物</h4>
          <p class="egg-desc">等待考古学家深入 ${egg.era} 年代展厅发掘神秘交互点...</p>
          <div class="egg-origin">📍 线索提示：${egg.foundAt.split(' ')[0]} 展区附近</div>
        `;
      }
      gridEl.appendChild(card);
    });

    // 检查是否全集齐
    const totalCollected = state.eggs.length;
    const summaryCountEl = document.getElementById('book-collected-count');
    if (summaryCountEl) {
      summaryCountEl.textContent = `${totalCollected} / 6`;
    }

    const exportArea = document.getElementById('book-export-area');
    if (exportArea) {
      if (totalCollected >= 6) {
        exportArea.classList.remove('hidden');
      } else {
        exportArea.classList.add('hidden');
      }
    }
  }

  exportStandaloneHTML() {
    const state = museumStore.getState();
    const collectedEggs = state.eggs.map(id => EGGS_METADATA[id]).filter(Boolean);

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>《404 之前：你的互联网考古发现册》</title>
  <style>
    body {
      background: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 30px;
      line-height: 1.8;
      border: 1px solid #30363d;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    h1 { color: #58a6ff; border-bottom: 2px solid #21262d; padding-bottom: 15px; }
    .meta-box { background: #161b22; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
    .egg-item {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 18px;
    }
    .egg-tag { display: inline-block; background: #238636; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; }
    .quote {
      font-style: italic;
      color: #8b949e;
      border-left: 3px solid #58a6ff;
      padding-left: 15px;
      margin: 25px 0;
    }
    footer { text-align: center; margin-top: 40px; color: #8b949e; font-size: 13px; }
  </style>
</head>
<body>
  <h1>📜 《404 之前：你的互联网考古发现册》</h1>
  <div class="meta-box">
    <p><strong>考古研究员状态：</strong> 完整修复六大时代遗迹，荣誉出馆</p>
    <p><strong>探索年代跨度：</strong> 1998年 (33.6kbps拨号时代) → 2099年 (量子遗迹时代)</p>
    <p><strong>完成归档时间：</strong> ${new Date().toLocaleString()}</p>
  </div>

  <div class="quote">
    “我们保存下来的，不只是网页。<br>
    还有每一个笨拙的昵称、每一句‘踩踩，已回访’，以及每一次等待对方头像亮起。”
  </div>

  <h2>🏆 永久归档的六件数字遗物</h2>
  ${collectedEggs.map(e => `
    <div class="egg-item">
      <div style="font-size: 26px; margin-bottom: 5px;">${e.icon} <strong>${e.title}</strong> <span class="egg-tag">${e.era} 年</span></div>
      <p style="margin: 8px 0; color: #c9d1d9;">${e.desc}</p>
      <small style="color: #7ee787;">📍 发掘自：${e.foundAt}</small>
    </div>
  `).join('')}

  <h2>📝 您沿途留下的数字印记</h2>
  <div class="meta-box">
    <p><strong>2003年您提交的留言：</strong> ${escapeHTML(state.guestbookMessages[0]?.text || '风之子路过踩踩')}</p>
    <p><strong>2008年您发表的论坛回帖：</strong> ${escapeHTML(state.forumReplies?.[0]?.content || '人在江湖漂，哪能不挨刀')}</p>
    <p><strong>2012年您发布的个性说说：</strong> ${escapeHTML(state.spacePosts[0]?.text || '写在青春空间的未眠心情')}</p>
    <p><strong>2024年算法对您的画像偏好：</strong> 猫咪喜爱度(${Number(state.algorithmPreference.cat) || 0}) / 认知效率(${Number(state.algorithmPreference.productivity) || 0}) / 情绪共鸣(${Number(state.algorithmPreference.emotion) || 0})</p>
  </div>

  <footer>
    《404 之前：互联网考古馆》· 永久离线存档 · 即使原站404，记忆依然长存。
  </footer>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `你的互联网考古发现册-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('纪念册已成功导出！可离线直接双击打开查看。');
  }
}

const eggsManager = new EggsManager();


  // === 1998 拨号接入室 (era-1998.js) ===
  /**
 * 《404 之前：互联网考古馆》- 1998 拨号接入室
 */


function initEra1998() {
  const container = document.getElementById('era-1998');
  if (!container) return;

  const btnConnect = document.getElementById('btn-1998-connect');
  const statusLed = document.getElementById('modem-led-oh');
  const dataLed = document.getElementById('modem-led-sd');
  const dialStatusText = document.getElementById('dial-status-text');
  const dialProgressFill = document.getElementById('dial-progress-fill');
  const dialWindow = document.getElementById('win98-dial-window');
  const connectedBanner = document.getElementById('win98-connected-card');

  // 图标物件
  const iconDontClick = document.getElementById('icon-1998-dontclick');
  const iconFloppy = document.getElementById('icon-1998-floppy');
  const iconCd = document.getElementById('icon-1998-cd');
  const iconNetwork = document.getElementById('icon-1998-network');

  // 1. 初始化检查连接状态
  const state = museumStore.getState();
  if (state.connected1998) {
    applyConnectedUI();
  }

  function applyConnectedUI() {
    if (dialStatusText) dialStatusText.textContent = '已连接：电信 163 接入网 (33.6 Kbps)';
    if (dialProgressFill) dialProgressFill.style.width = '100%';
    if (btnConnect) {
      btnConnect.textContent = '断开连接';
      btnConnect.classList.add('connected');
    }
    if (statusLed) statusLed.classList.add('lit');
    if (dataLed) dataLed.classList.add('blinking');
    if (connectedBanner) connectedBanner.classList.remove('hidden');
  }

  // 2. 点击拨号连接按钮
  if (btnConnect) {
    btnConnect.addEventListener('click', () => {
      audioManager.playClick();
      const isConnected = museumStore.getState().connected1998;

      if (isConnected) {
        // 断开连接逻辑
        museumStore.update({ connected1998: false });
        if (dialStatusText) dialStatusText.textContent = '线路已断开。准备就绪。';
        if (dialProgressFill) dialProgressFill.style.width = '0%';
        btnConnect.textContent = '连接互联网 (Dial-up)';
        btnConnect.classList.remove('connected');
        if (statusLed) statusLed.classList.remove('lit');
        if (dataLed) dataLed.classList.remove('blinking');
        if (connectedBanner) connectedBanner.classList.add('hidden');
        return;
      }

      // 开始拨号
      btnConnect.disabled = true;
      btnConnect.textContent = '拨号连线中...';
      if (statusLed) statusLed.classList.add('lit');

      let progressVal = 10;
      const progressTimer = setInterval(() => {
        progressVal = Math.min(95, progressVal + 15);
        if (dialProgressFill) dialProgressFill.style.width = `${progressVal}%`;
      }, 900);

      audioManager.playDialup(
        (stepText) => {
          if (dialStatusText) dialStatusText.textContent = stepText;
          if (dataLed) dataLed.classList.toggle('blinking');
        },
        () => {
          clearInterval(progressTimer);
          btnConnect.disabled = false;
          museumStore.update({ connected1998: true });
          applyConnectedUI();
          eggsManager.showToast('🎉 成功连接到 1998 年互联网世界！');
        }
      );
    });
  }

  // 绑定图标键盘回车/空格触发无障碍
  [iconDontClick, iconFloppy, iconCd, iconNetwork].forEach(el => {
    el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  // 3. 点击彩蛋“不要点.exe”
  if (iconDontClick) {
    iconDontClick.addEventListener('click', () => {
      audioManager.playClick();
      eggsManager.triggerEgg('broken_floppy');
    });
  }

  // 4. 点击 3.5英寸软盘
  if (iconFloppy) {
    iconFloppy.addEventListener('click', () => {
      audioManager.playClick();
      showWin98Dialog(
        '软盘驱动器 (A:)',
        '容量：1.44 MB 磁性软盘\n状态：读写保护滑块已打开\n内容：包含 dialer.ini, readme.txt 以及一份只有 8KB 的全纯文本网页收藏夹。'
      );
    });
  }

  // 5. 点击光盘
  if (iconCd) {
    iconCd.addEventListener('click', () => {
      audioManager.playClick();
      showWin98Dialog(
        'CD-ROM 驱动器 (D:)',
        '光盘卷标：【电脑爱好者】1998 年合订附赠光盘\n内容：内含网际快车早期试用版、FoxMail 1.0、网络蚂蚁以及 50 款经典 MIDI 音乐合集。'
      );
    });
  }

  // 6. 点击网上邻居
  if (iconNetwork) {
    iconNetwork.addEventListener('click', () => {
      audioManager.playClick();
      showWin98Dialog(
        '网上邻居',
        '工作组 WORKGROUP：\n正在广播 ARP 寻址数据包...\n当前局域网没有发现其它主机。1998年全国拨号上网用户仅数十万人，大家都在浩瀚的黑夜里独自冲浪。'
      );
    });
  }
}

// 辅助弹出 98 风格对话框
function showWin98Dialog(title, content) {
  const modal = document.getElementById('win98-generic-dialog');
  if (!modal) return;
  const titleEl = modal.querySelector('.win98-dialog-title');
  const bodyEl = modal.querySelector('.win98-dialog-body');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = content;

  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    modal.classList.add('visible');
  });
  const closeBtn = modal.querySelector('.win98-dialog-close');
  const okBtn = modal.querySelector('.win98-dialog-ok');
  const closer = () => {
    audioManager.playClick();
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 250);
    closeBtn?.removeEventListener('click', closer);
    okBtn?.removeEventListener('click', closer);
  };
  closeBtn?.addEventListener('click', closer);
  okBtn?.addEventListener('click', closer);
}


  // === 2003 个人主页花园 (era-2003.js) ===
  /**
 * 《404 之前：互联网考古馆》- 2003 个人主页花园
 */


const MOODS_LIST = [
  "今天也要做闪闪发光的普通人。",
  "雨停在你上线之前。",
  "本人正在假装不在。",
  "愿所有等待都有回复。",
  "有一点想念，但网络太慢。",
  "偷偷把你的网名放进了密码里。",
  "今天把QQ头像换成了那个眨眼睛的男孩。",
  "放学后在学校对面的网吧等你，不见不散。"
];

function initEra2003() {
  const container = document.getElementById('era-2003');
  if (!container) return;

  const moodTextEl = document.getElementById('mood-text-2003');
  const moodBtn = document.getElementById('btn-change-mood');
  const visitorCountEl = document.getElementById('visitor-counter-digits');
  const counterBox = document.getElementById('visitor-counter-box');
  const bgmPlayBtn = document.getElementById('btn-2003-bgm');
  const bgmStatusEl = document.getElementById('bgm-2003-status');

  // 留言板组件
  const guestbookListEl = document.getElementById('guestbook-list');
  const guestNameInput = document.getElementById('guestbook-name-input');
  const guestTextInput = document.getElementById('guestbook-text-input');
  const guestSubmitBtn = document.getElementById('btn-guestbook-submit');

  // 1. 心情随机切换
  let currentMoodIdx = museumStore.getState().moodIndex || 0;
  if (moodTextEl) {
    moodTextEl.textContent = MOODS_LIST[currentMoodIdx % MOODS_LIST.length];
  }

  if (moodBtn) {
    moodBtn.addEventListener('click', () => {
      audioManager.playClick();
      currentMoodIdx = (currentMoodIdx + 1) % MOODS_LIST.length;
      museumStore.update({ moodIndex: currentMoodIdx });
      if (moodTextEl) {
        moodTextEl.style.opacity = '0';
        setTimeout(() => {
          moodTextEl.textContent = MOODS_LIST[currentMoodIdx];
          moodTextEl.style.opacity = '1';
        }, 150);
      }
    });
  }

  // 2. 访客计数器连续点击 5 次触发彩蛋
  let clickCount = 0;
  let clickTimer = null;
  if (counterBox) {
    counterBox.addEventListener('click', () => {
      audioManager.playClick();
      clickCount++;
      clearTimeout(clickTimer);

      if (clickCount >= 5) {
        clickCount = 0;
        if (visitorCountEl) {
          visitorCountEl.textContent = '5201314';
          visitorCountEl.classList.add('easter-rainbow');
        }
        eggsManager.triggerEgg('glitter_cursor');
      } else {
        // 轻微递增
        const currentNum = parseInt(visitorCountEl?.textContent || '1314', 10);
        if (visitorCountEl && currentNum !== 5201314) {
          visitorCountEl.textContent = String(currentNum + 1);
        }
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 2000);
      }
    });
  }

  // 3. 背景音乐播放器伪控件
  let isPlayingBgm = false;
  if (bgmPlayBtn) {
    bgmPlayBtn.addEventListener('click', () => {
      audioManager.playClick();
      if (!isPlayingBgm) {
        isPlayingBgm = true;
        if (bgmPlayBtn) bgmPlayBtn.textContent = '⏸ 暂停';
        if (bgmStatusEl) bgmStatusEl.textContent = '▶ 正在播放：千年之恋.mid (8-bit Web Synth)';
        audioManager.play2003Melody();
        setTimeout(() => {
          isPlayingBgm = false;
          if (bgmPlayBtn) bgmPlayBtn.textContent = '▶ 播放';
          if (bgmStatusEl) bgmStatusEl.textContent = '已就绪：千年之恋.mid';
        }, 2200);
      }
    });
  }

  // 4. 留言板渲染与提交
  function renderGuestbook() {
    if (!guestbookListEl) return;
    const messages = museumStore.getState().guestbookMessages || [];
    guestbookListEl.innerHTML = '';
    messages.forEach((msg) => {
      if (!msg || typeof msg !== 'object') return; // 跳过损坏的历史存档条目
      const item = document.createElement('div');
      item.className = 'guestbook-message-card';
      item.innerHTML = `
        <div class="msg-header">
          <span class="msg-author">🌸 ${escapeHTML(msg.name)}</span>
          <span class="msg-time">${escapeHTML(msg.time)}</span>
        </div>
        <div class="msg-body">${escapeHTML(msg.text)}</div>
        ${msg.reply ? `<div class="msg-reply"><strong>站长回复：</strong>${escapeHTML(msg.reply)}</div>` : ''}
      `;
      guestbookListEl.appendChild(item);
    });
  }

  renderGuestbook();

  if (guestSubmitBtn) {
    guestSubmitBtn.addEventListener('click', () => {
      const name = guestNameInput?.value.trim() || '神秘网友';
      const text = guestTextInput?.value.trim();

      if (!text) {
        eggsManager.showToast('请输入留言内容哦~');
        return;
      }

      audioManager.playClick();
      guestSubmitBtn.disabled = true;
      guestSubmitBtn.textContent = '写入留言簿...';

      const repliesPool = [
        '踩踩~欢迎常来做客，记得把小站加进收藏夹哦！(*^__^*)',
        '886~我妈妈催我下机写作业了，改天线上见！',
        '哇，很高兴认识你！祝你每天都有好心情~☆',
        '收到留言啦，送你一颗许愿流星 ⭐~'
      ];
      const autoReply = repliesPool[Math.floor(Math.random() * repliesPool.length)];

      setTimeout(() => {
        const newMsg = {
          name,
          text,
          time: '2003-08-15',
          reply: autoReply
        };
        const currentMessages = museumStore.getState().guestbookMessages || [];
        museumStore.update({
          guestbookMessages: [newMsg, ...currentMessages]
        });

        if (guestTextInput) guestTextInput.value = '';
        guestSubmitBtn.disabled = false;
        guestSubmitBtn.textContent = '签写留言 ✎';
        renderGuestbook();
        eggsManager.showToast('✨ 留言成功！站长已光速给您回复。');
      }, 600);
    });
  }

  // 5. 鼠标移动留下星光粒子效果（严格限制在 2003 年代区域，限流控制性能）
  let lastParticleTime = 0;
  container.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastParticleTime < 80) return; // 80ms 节流
    lastParticleTime = now;

    createSparkle(e.clientX, e.clientY);
  });
}

function createSparkle(x, y) {
  const sparkle = document.createElement('div');
  sparkle.className = 'mouse-sparkle-star';
  const symbols = ['★', '☆', '✦', '✧', '♥'];
  sparkle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
  sparkle.style.left = `${x - 10}px`;
  sparkle.style.top = `${y - 10}px`;
  sparkle.style.color = ['#ff69b4', '#00ffff', '#ffd700', '#ff1493'][Math.floor(Math.random() * 4)];
  document.body.appendChild(sparkle);

  setTimeout(() => {
    sparkle.remove();
  }, 750);
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


  // === 2008 深夜论坛 (era-2008.js) ===
  /**
 * 《404 之前：互联网考古馆》- 2008 深夜论坛
 */


const INITIAL_POSTS = [
  {
    floor: '1 楼 (楼主)',
    user: '午夜游民',
    rank: '论坛元老',
    avatar: '🕹️',
    time: '2008-08-08 02:14:09',
    content: '最近一连几天，我房间那台联想锋行电脑在凌晨 2:30 会准时自己亮屏，IE浏览器自动弹出一个全黑的页面，地址栏是一串纯数字IP，中间赫然写着一句话：“请不要断开连接，我们正在给你打包回忆”。我拔了网线它竟然还能打开！求教论坛各位大虾，这到底是什么新型木马？',
    signature: '———— 人在江湖漂，哪能不挨刀。★ 本人常驻 QQ群：3849102'
  },
  {
    floor: '2 楼 (沙发)',
    user: '沙发狂魔_小杰',
    rank: '初级水怪',
    avatar: '🥤',
    time: '2008-08-08 02:16:33',
    content: '沙发！前排占座，兜售西瓜瓜子矿泉水~ 楼主你是不是中了灰鸽子远程控制啊？赶紧下个微点主动防御或者卡巴斯基扫一扫！',
    signature: '———— 抢沙发是一种美德，灌水是一种生活态度。'
  },
  {
    floor: '3 楼 (板凳)',
    user: '网吧网管阿强',
    rank: '技术版副',
    avatar: '🔧',
    time: '2008-08-08 02:22:15',
    content: '拔了网线还能打开？那只有一种可能：页面已经被缓存到本地 Temporary Internet Files 了，或者你的 HOSTS 文件被恶意脚本劫持到 127.0.0.1。楼主不妨查看下任务管理器里有没有陌生的 .exe 进程？',
    signature: '———— 遇到问题先重启，不行再重装，还不行换主板。'
  }
];

const MORE_FLOORS = [
  {
    floor: '4 楼',
    user: '失眠的猫咪',
    rank: '中级会员',
    avatar: '🐱',
    time: '2008-08-08 02:45:00',
    content: '楼主淡定，重装系统试试。话说那个打包回忆有点玄乎啊，会不会是哪个暗恋你的黑客妹子写的恶作剧程序？此帖必火，截图留名！',
    signature: '———— 躲在被窝里用诺基亚刷论坛的人。'
  },
  {
    floor: '5 楼',
    user: 'Matrix_08',
    rank: '高级会员',
    avatar: '🕶️',
    time: '2008-08-08 03:12:18',
    content: '不是电脑的问题，是它比你更早上网。其实我们现在浏览的所有网页，在很多年后可能都会消失得一干二净。也许它是来自未来的回信呢？',
    signature: '———— 01001000 01101001'
  }
];

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 安全解析旧论坛 [quote] 和 [b] 标签
function formatForumContent(rawText) {
  const safe = escapeHTML(rawText);
  return safe
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="forum-quote-box">$1</blockquote>')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function initEra2008() {
  const container = document.getElementById('era-2008');
  if (!container) return;

  const floorContainer = document.getElementById('forum-floors-list');
  const btnLoadMore = document.getElementById('btn-forum-load-more');
  const btnUpvote = document.getElementById('btn-forum-upvote');
  const upvoteCountEl = document.getElementById('forum-upvote-count');
  const hotBadge = document.getElementById('forum-hot-badge');
  const replyInput = document.getElementById('forum-reply-input');
  const btnSubmitReply = document.getElementById('btn-forum-submit-reply');
  const ghostCounterEl = document.getElementById('forum-ghost-online');

  let currentLoadedExtra = false;

  function renderFloorItem(post) {
    const floorDiv = document.createElement('div');
    floorDiv.className = 'forum-floor-item';
    floorDiv.innerHTML = `
      <div class="floor-sidebar">
        <div class="user-avatar-badge">${escapeHTML(post.avatar)}</div>
        <div class="user-name"><strong>${escapeHTML(post.user)}</strong></div>
        <div class="user-rank">${escapeHTML(post.rank)}</div>
      </div>
      <div class="floor-main">
        <div class="floor-meta">
          <span class="floor-tag">${escapeHTML(post.floor)}</span>
          <span class="post-time">发表于 ${escapeHTML(post.time)}</span>
          <button class="btn-quote-reply" data-floor="${escapeHTML(post.floor)}" data-user="${escapeHTML(post.user)}">[引用回复]</button>
        </div>
        <div class="floor-content">${formatForumContent(post.content)}</div>
        <div class="floor-signature">${escapeHTML(post.signature)}</div>
      </div>
    `;

    // 绑定引用按钮
    const quoteBtn = floorDiv.querySelector('.btn-quote-reply');
    quoteBtn?.addEventListener('click', () => {
      audioManager.playClick();
      if (replyInput) {
        const snippet = String(post.content).slice(0, 50);
        replyInput.value = `[quote][b]${post.user}[/b] 在 ${post.floor} 说道：\n${snippet}...[/quote]\n` + replyInput.value;
        replyInput.focus();
      }
    });

    return floorDiv;
  }

  // 初始化楼层渲染：初始楼层 + 本地持久化保存的用户回帖
  function initFloors() {
    if (!floorContainer) return;
    floorContainer.innerHTML = '';
    INITIAL_POSTS.forEach(p => floorContainer.appendChild(renderFloorItem(p)));

    // 恢复历史已保存的回复
    const savedReplies = museumStore.getState().forumReplies || [];
    savedReplies.forEach(p => floorContainer.appendChild(renderFloorItem(p)));
  }

  initFloors();

  // 2. 查看更多回复（楼层展开）
  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      audioManager.playClick();
      if (!currentLoadedExtra) {
        currentLoadedExtra = true;
        btnLoadMore.textContent = '正在读取楼层数据包...';
        btnLoadMore.disabled = true;

        setTimeout(() => {
          MORE_FLOORS.forEach(p => {
            floorContainer.appendChild(renderFloorItem(p));
          });
          btnLoadMore.textContent = '已展示全部官方历史楼层';
          eggsManager.showToast('📄 已成功加载全部历史楼层讨论！');
        }, 500);
      }
    });
  }

  // 3. 顶帖功能与 HOT 标识
  let upvotes = museumStore.getState().forumUpvotes || 3;
  if (upvoteCountEl) upvoteCountEl.textContent = String(upvotes);
  if (upvotes >= 5 && hotBadge) hotBadge.classList.remove('hidden');

  if (btnUpvote) {
    btnUpvote.addEventListener('click', () => {
      audioManager.playForumPostSound();
      upvotes++;
      museumStore.update({ forumUpvotes: upvotes });
      if (upvoteCountEl) upvoteCountEl.textContent = String(upvotes);

      // 飘字动画
      showFloatingPlusOne(btnUpvote);

      if (upvotes >= 5 && hotBadge) {
        hotBadge.classList.remove('hidden');
        hotBadge.classList.add('pulse-glow');
      }
    });
  }

  // 4. 回帖交互
  if (btnSubmitReply) {
    btnSubmitReply.addEventListener('click', () => {
      const text = replyInput?.value.trim();
      if (!text) {
        alert('请输入回帖内容（字数不少于15字，严禁纯数字纯表情灌水）');
        return;
      }

      audioManager.playForumPostSound();
      btnSubmitReply.disabled = true;
      btnSubmitReply.textContent = '网络延迟中... 发送中';

      setTimeout(() => {
        const floorNum = floorContainer.children.length + 1;
        const userPost = {
          floor: `${floorNum} 楼`,
          user: '我 (考古学者)',
          rank: '游侠大虾',
          avatar: '🤠',
          time: new Date().toLocaleTimeString(),
          content: text,
          signature: '———— 岁月神偷，我们在 2008 年的深坑里留下了脚印。'
        };
        floorContainer.appendChild(renderFloorItem(userPost));

        // 保存用户回帖到全局持久化状态
        const existingReplies = museumStore.getState().forumReplies || [];
        museumStore.update({
          forumReplies: [...existingReplies, userPost]
        });

        // 随机跟帖
        const randomReplies = [
          '楼主淡定，重装系统试试。',
          '此帖必火，前排留名！',
          '我朋友当年也遇到过，后来他成了该站管理员。',
          '十五字十五字十五字十五字。'
        ];
        const botReply = randomReplies[Math.floor(Math.random() * randomReplies.length)];

        setTimeout(() => {
          const botFloorNum = floorContainer.children.length + 1;
          const botPost = {
            floor: `${botFloorNum} 楼`,
            user: '深夜夜猫子',
            rank: '潜水员',
            avatar: '🌙',
            time: new Date().toLocaleTimeString(),
            content: `[quote]回复 ${floorNum} 楼[/quote]\n${botReply}`,
            signature: '———— 夜太美，尽管太危险，总有人黑着眼眶修仙。'
          };
          floorContainer.appendChild(renderFloorItem(botPost));

          // 将机器人的回帖也一并持久化存储
          const updatedReplies = museumStore.getState().forumReplies || [];
          museumStore.update({
            forumReplies: [...updatedReplies, botPost]
          });

          eggsManager.showToast('💬 回帖成功！收到论坛网友秒回！');
        }, 700);

        if (replyInput) replyInput.value = '';
        btnSubmitReply.disabled = false;
        btnSubmitReply.textContent = '快速发表回复 ↵';
      }, 800);
    });
  }

  // 5. 彩蛋 3：签名档里跳动的幽灵在线人数
  if (ghostCounterEl) {
    ghostCounterEl.addEventListener('click', () => {
      audioManager.playClick();
      eggsManager.triggerEgg('eternal_online_avatar');
    });
  }
}

function showFloatingPlusOne(targetEl) {
  const plusOne = document.createElement('span');
  plusOne.className = 'floating-plus-one';
  plusOne.textContent = '+1 顶！';
  const rect = targetEl.getBoundingClientRect();
  plusOne.style.left = `${rect.left + rect.width / 2}px`;
  plusOne.style.top = `${rect.top - 10}px`;
  document.body.appendChild(plusOne);

  setTimeout(() => {
    plusOne.remove();
  }, 1000);
}


  // === 2012 青春空间 (era-2012.js) ===
  /**
 * 《404 之前：互联网考古馆》- 2012 青春空间
 */


function initEra2012() {
  const container = document.getElementById('era-2012');
  if (!container) return;

  const skinSelectBtns = document.querySelectorAll('.btn-skin-choice');
  const decorScoreValue = document.getElementById('decor-score-value');
  const decorProgressFill = document.getElementById('decor-progress-fill');
  const meteorShowerEl = document.getElementById('space-meteor-shower');

  const postInput = document.getElementById('space-post-input');
  const btnPublishPost = document.getElementById('btn-space-publish');
  const postsFeedEl = document.getElementById('space-posts-feed');

  const anonymousVisitorEl = document.getElementById('visitor-avatar-anonymous');

  // 1. 初始化皮肤与装扮值
  const state = museumStore.getState();
  applySkin(state.spaceSkin || 'sakura');
  updateDecorScore(state.spaceDecorScore || 45);

  function applySkin(skinKey) {
    container.classList.remove('skin-sakura', 'skin-blue', 'skin-night');
    container.classList.add(`skin-${skinKey}`);
    skinSelectBtns.forEach(btn => {
      if (btn.dataset.skin === skinKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updateDecorScore(score) {
    const clamped = Math.min(100, score);
    if (decorScoreValue) decorScoreValue.textContent = `${clamped} 分`;
    if (decorProgressFill) decorProgressFill.style.width = `${clamped}%`;

    // 超过 75 分触发华丽流星雨动画
    if (clamped >= 75 && meteorShowerEl) {
      meteorShowerEl.classList.remove('hidden');
    }
  }

  // 皮肤切换
  skinSelectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      audioManager.playWaterDrop();
      const skin = btn.dataset.skin;
      let newScore = (museumStore.getState().spaceDecorScore || 45) + 15;
      if (newScore > 100) newScore = 100;

      museumStore.update({
        spaceSkin: skin,
        spaceDecorScore: newScore
      });
      applySkin(skin);
      updateDecorScore(newScore);
      eggsManager.showToast(`✨ 装扮风格已切换！华丽度上升至 ${newScore} 分`);
    });
  });

  // 2. 动态发表
  function renderPosts() {
    if (!postsFeedEl) return;
    const posts = museumStore.getState().spacePosts || [];
    postsFeedEl.innerHTML = '';

    posts.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'space-feed-card';
      card.innerHTML = `
        <div class="feed-header">
          <div class="feed-avatar">🌟</div>
          <div class="feed-info">
            <span class="feed-name">唯美主义者丶 (黄钻Lv.7)</span>
            <span class="feed-time">${escapeHTML(item.time)} · ${escapeHTML(item.source)}</span>
          </div>
        </div>
        <div class="feed-content">${escapeHTML(item.text)}</div>
        <div class="feed-actions">
          <button class="btn-feed-like" data-index="${index}">❤️ 赞 (${item.likes || 0})</button>
          <span class="feed-cmt-hint">💬 评论(3)</span>
          <span class="feed-forward-hint">🔄 转发</span>
        </div>
      `;

      // 点赞事件
      const likeBtn = card.querySelector('.btn-feed-like');
      likeBtn?.addEventListener('click', () => {
        audioManager.playWaterDrop();
        item.likes = (item.likes || 0) + 1;
        museumStore.saveState();
        likeBtn.textContent = `❤️ 赞 (${item.likes})`;
        spawnFlyingHeart(likeBtn);
      });

      postsFeedEl.appendChild(card);
    });
  }

  renderPosts();

  if (btnPublishPost) {
    btnPublishPost.addEventListener('click', () => {
      const text = postInput?.value.trim();
      if (!text) {
        alert('说说内容不能为空哦~');
        return;
      }

      audioManager.playWaterDrop();
      const currentPosts = museumStore.getState().spacePosts || [];
      const newPost = {
        text,
        source: 'iPhone 4S 客户端',
        time: new Date().toLocaleTimeString(),
        likes: 1
      };

      museumStore.update({
        spacePosts: [newPost, ...currentPosts]
      });

      if (postInput) postInput.value = '';
      renderPosts();
      eggsManager.showToast('📝 动态说说已同步发表到空间！');
    });
  }

  // 3. 访客列表点击彩蛋：匿名访客
  if (anonymousVisitorEl) {
    anonymousVisitorEl.addEventListener('click', () => {
      audioManager.playClick();
      eggsManager.triggerEgg('unsent_status');
    });
  }
}

// 飘动爱心粒子
function spawnFlyingHeart(btn) {
  const heart = document.createElement('span');
  heart.className = 'floating-heart-particle';
  heart.textContent = ['❤️', '💖', '✨', '🌸'][Math.floor(Math.random() * 4)];
  const rect = btn.getBoundingClientRect();
  heart.style.left = `${rect.left + rect.width / 2 + (Math.random() * 20 - 10)}px`;
  heart.style.top = `${rect.top}px`;
  document.body.appendChild(heart);

  setTimeout(() => {
    heart.remove();
  }, 1000);
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


  // === 2024 算法走廊 (era-2024.js) ===
  /**
 * 《404 之前：互联网考古馆》- 2024 算法走廊
 */


// 内容数据库（根据用户偏好动态过滤和演化）
const FEED_DATABASE = {
  cat: [
    {
      level: 1,
      tag: '#猫咪日常',
      title: '这只流浪小橘猫今天居然主动踩奶了！',
      snippet: '软萌肉垫治愈一切疲惫，它甚至会眨眼睛跟你说谢谢...',
      stats: '14.2万赞 · 3218评论'
    },
    {
      level: 2,
      tag: '#猫咪行为学',
      title: '猫咪这3种叫声，其实是在向你发出隐秘求救信号！',
      snippet: '90%的铲屎官都忽略了！它频繁蹭墙角不是在撒娇，而是分离焦虑早期表现...',
      stats: '28.9万赞 · 8912评论'
    },
    {
      level: 3,
      tag: '#宇宙猫猫论',
      title: '如果猫从来没有被驯化过，为什么它们会精准掌控人类的生活节律？',
      snippet: '神经生物学最新假设：猫的呼噜声频率（20-140Hz）恰好能对人类多巴胺奖赏回路进行生物声学锁定...',
      stats: '51.4万赞 · 1.6万评论'
    }
  ],
  productivity: [
    {
      level: 1,
      tag: '#效率提升',
      title: '25分钟番茄工作法：彻底拯救拖延症的微习惯',
      snippet: '只要一张白纸和一个闹钟，让你每天多出3小时专注深度工作时间...',
      stats: '8.7万赞 · 1502评论'
    },
    {
      level: 2,
      tag: '#晨起奇迹',
      title: '那些坚持每天凌晨4点起床的人，后来到底拉开了怎样的差距？',
      snippet: '掌控清晨就是掌控人生。世界还在沉睡时，你的第一篇论文、第一个商业计划书已经完成了...',
      stats: '34.1万赞 · 9801评论'
    },
    {
      level: 3,
      tag: '#认知觉醒',
      title: '穷人思维与底层互害的算法陷阱：普通人如何实现认知突围？',
      snippet: '所有免费的娱乐都在收割你最宝贵的注意力本金。当你停止被算法喂养，你才真正开始拥有自由意志...',
      stats: '62.8万赞 · 2.4万评论'
    }
  ],
  emotion: [
    {
      level: 1,
      tag: '#治愈生活',
      title: '今天下班路上的夕阳，送给每一个努力生活的你',
      snippet: '生活总有不如意，但总有微风、烤红薯和天边的晚霞在悄悄偏心你...',
      stats: '19.5万赞 · 4102评论'
    },
    {
      level: 2,
      tag: '#心理洞察',
      title: '高敏感人格（HSP）的9个特征：你不是矫情，你只是感知更深刻',
      snippet: '容易共情他人痛苦、受不了嘈杂环境、常因一句话反复琢磨...停止内耗，接纳你天赋异禀的敏感...',
      stats: '45.3万赞 · 1.8万评论'
    },
    {
      level: 3,
      tag: '#情绪深渊',
      title: '为什么我们联系越来越方便，却在深夜越来越找不到一个人可以说真心话？',
      snippet: '屏幕那头是永不熄灭的红点与推送，屏幕这头是一个人在被窝里的绝对静音。现代人的孤独是算法精心配置的...',
      stats: '78.2万赞 · 3.9万评论'
    }
  ]
};

function initEra2024() {
  const container = document.getElementById('era-2024');
  if (!container) return;

  const feedListEl = document.getElementById('algorithm-feed-list');
  const insightProgressFill = document.getElementById('insight-progress-fill');
  const insightScoreEl = document.getElementById('algorithm-insight-score');
  const profilePersonaEl = document.getElementById('algorithm-persona-text');
  const btnWhyRecommend = document.getElementById('btn-why-recommend');
  const alertBanner = document.getElementById('algorithm-alert-banner');
  const portal2099Btn = document.getElementById('btn-jump-to-2099');

  // 1. 初始化偏好
  let preference = { ...museumStore.getState().algorithmPreference };

  function calculateInsightPercent() {
    const totalPoints = preference.cat + preference.productivity + preference.emotion;
    // 基础12%，每互动1分增加2.5%，最高97%
    const calculated = 12 + Math.floor(totalPoints * 2.8);
    return Math.min(97, calculated);
  }

  function updateInsightUI() {
    const percent = calculateInsightPercent();
    if (insightScoreEl) insightScoreEl.textContent = `${percent}%`;
    if (insightProgressFill) insightProgressFill.style.width = `${percent}%`;

    // 推测画像
    let persona = '多维复合型探索者';
    const maxScore = Math.max(preference.cat, preference.productivity, preference.emotion);
    if (maxScore > 0) {
      if (preference.cat === maxScore) persona = '高亲和·动物治愈系·多巴胺依赖';
      else if (preference.productivity === maxScore) persona = '高焦虑·效能狂热·认知突破追求者';
      else if (preference.emotion === maxScore) persona = '高敏感·深度共情·情绪内耗易感人群';
    }
    if (profilePersonaEl) profilePersonaEl.textContent = persona;

    // 达到 80% 触发系统警报和 2099 虫洞
    if (percent >= 80) {
      if (alertBanner) alertBanner.classList.remove('hidden');
      if (portal2099Btn) portal2099Btn.classList.remove('hidden');
      container.classList.add('algorithm-high-control');
    }
  }

  // 2. 渲染推荐信息流卡片
  const activeHoverTimers = new Set();

  function clearAllHoverTimers() {
    activeHoverTimers.forEach(t => clearTimeout(t));
    activeHoverTimers.clear();
  }

  function renderFeedCards() {
    clearAllHoverTimers();
    if (!feedListEl) return;
    feedListEl.innerHTML = '';

    // 根据偏好确定三类内容的阶梯（level 1~3）
    const getLevel = (score) => {
      if (score >= 8) return 3;
      if (score >= 4) return 2;
      return 1;
    };

    const catLevel = getLevel(preference.cat);
    const prodLevel = getLevel(preference.productivity);
    const emoLevel = getLevel(preference.emotion);

    // 排序优先级：偏好高的排在最前
    const categories = [
      { key: 'cat', score: preference.cat, data: FEED_DATABASE.cat[catLevel - 1] },
      { key: 'productivity', score: preference.productivity, data: FEED_DATABASE.productivity[prodLevel - 1] },
      { key: 'emotion', score: preference.emotion, data: FEED_DATABASE.emotion[emoLevel - 1] }
    ];
    categories.sort((a, b) => b.score - a.score);

    categories.forEach((catObj) => {
      const card = createCardElement(catObj);
      feedListEl.appendChild(card);
    });
  }

  function createCardElement(catObj) {
    const item = catObj.data;
    const card = document.createElement('div');
    card.className = 'algo-feed-card';
    card.dataset.category = catObj.key;

    card.innerHTML = `
      <div class="card-badge-row">
        <span class="algo-tag">${item.tag}</span>
        <span class="algo-score-chip">模型权重: +${catObj.score}</span>
      </div>
      <h3 class="algo-card-title">${item.title}</h3>
      <p class="algo-card-snippet">${item.snippet}</p>
      <div class="algo-card-footer">
        <span class="algo-stats">${item.stats}</span>
        <div class="algo-action-btns">
          <button class="btn-algo-like" title="喜欢内容 (偏好+2)">👍 喜欢</button>
          <button class="btn-algo-dismiss" title="不感兴趣 (偏好-1)">✕ 减少此类</button>
        </div>
      </div>
    `;

    // 停留检测计时器（停留超过 2 秒加 1 分）
    let hoverTimer = null;
    card.addEventListener('mouseenter', () => {
      hoverTimer = setTimeout(() => {
        activeHoverTimers.delete(hoverTimer);
        preference[catObj.key] = (preference[catObj.key] || 0) + 1;
        saveAndRefresh();
        showMicroFeedback(card, '视线停留 +1 分');
      }, 2000);
      activeHoverTimers.add(hoverTimer);
    });

    card.addEventListener('mouseleave', () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        activeHoverTimers.delete(hoverTimer);
      }
    });

    // 点开/点击卡片加 3 分
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      audioManager.playAlgorithmFeed();
      preference[catObj.key] = (preference[catObj.key] || 0) + 3;
      saveAndRefresh();
      showMicroFeedback(card, '深度展开 +3 分');
    });

    // 点赞按钮加 2 分
    const likeBtn = card.querySelector('.btn-algo-like');
    likeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.playAlgorithmFeed();
      preference[catObj.key] = (preference[catObj.key] || 0) + 2;
      saveAndRefresh();
      showMicroFeedback(likeBtn, '👍 权重提升 +2');
    });

    // 减少推荐减 1 分
    const dismissBtn = card.querySelector('.btn-algo-dismiss');
    dismissBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      audioManager.playClick();
      preference[catObj.key] = Math.max(0, (preference[catObj.key] || 0) - 1);
      saveAndRefresh();
      showMicroFeedback(dismissBtn, '✕ 降低同类权重');
    });

    return card;
  }

  function saveAndRefresh() {
    museumStore.update({ algorithmPreference: { ...preference } });
    updateInsightUI();
    renderFeedCards();
  }

  function showMicroFeedback(el, text) {
    const tip = document.createElement('span');
    tip.className = 'algo-micro-tip';
    tip.textContent = text;
    const rect = el.getBoundingClientRect();
    tip.style.left = `${rect.left + 10}px`;
    tip.style.top = `${rect.top - 20}px`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 1200);
  }

  // 3. 点击“为什么推荐给我？”触发彩蛋 5
  if (btnWhyRecommend) {
    btnWhyRecommend.addEventListener('click', () => {
      audioManager.playClick();
      eggsManager.triggerEgg('preference_shadow');
      showTransparencyModal();
    });
  }

  // 4. 传送至 2099 按钮
  if (portal2099Btn) {
    portal2099Btn.addEventListener('click', () => {
      navigationManager.goToEraByYear(2099);
    });
  }

  // 初次渲染
  updateInsightUI();
  renderFeedCards();
}

function showTransparencyModal() {
  const modal = document.getElementById('algorithm-transparency-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    modal.classList.add('visible');
  });

  const closeBtns = modal.querySelectorAll('.btn-close-transparency');
  const closer = () => {
    audioManager.playClick();
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 250);
    closeBtns.forEach(btn => btn.removeEventListener('click', closer));
  };
  closeBtns.forEach(btn => btn.addEventListener('click', closer));
}


  // === 2099 网页遗址修复中心 (era-2099.js) ===
  /**
 * 《404 之前：互联网考古馆》- 2099 网页遗址修复中心
 */


// 6 块历史遗迹碎片定义
const FRAGMENTS_CONFIG = [
  {
    id: 'frag_1998',
    era: 1998,
    name: '1998 拨号协议与软盘磁粉',
    icon: '💾',
    text: 'ATDT 16300 拨号握手协议残片与 1.44MB 磁性介质'
  },
  {
    id: 'frag_2003',
    era: 2003,
    name: '2003 闪烁星辰与访客计数',
    icon: '✨',
    text: '小雨的秘密花园·计数器 5201314 荧光微粒'
  },
  {
    id: 'frag_2008',
    era: 2008,
    name: '2008 深夜论坛沙发跟帖',
    icon: '☕',
    text: '天涯猫扑旧帖[quote]沙发留名[/quote]纯文本信标'
  },
  {
    id: 'frag_2012',
    era: 2012,
    name: '2012 未发送的草稿纸说说',
    icon: '💌',
    text: '在深夜反复删改后留存在草稿箱里的那句真心话'
  },
  {
    id: 'frag_2024',
    era: 2024,
    name: '2024 算法投喂与注意力特征',
    icon: '👁️',
    text: '收集了多巴胺权重的多维特征向量矩阵'
  },
  {
    id: 'frag_2099',
    era: 2099,
    name: '2099 量子时空记忆原石',
    icon: '🔮',
    text: '在 404 浩劫之后被永久保存的数字文明心跳'
  }
];

function initEra2099() {
  const container = document.getElementById('era-2099');
  if (!container) return;

  const fragmentsPool = document.getElementById('fragments-floating-pool');
  const slotsContainer = document.getElementById('restoration-slots-grid');
  const restorationPercentEl = document.getElementById('restoration-percent');
  const restorationProgressFill = document.getElementById('restoration-progress-fill');
  const archiveFinalCard = document.getElementById('restoration-final-archive');
  const btnFinalExport = document.getElementById('btn-final-export-book');

  let restoredIds = [...(museumStore.getState().restoredFragments || [])];
  let selectedFragId = null;

  function updateProgressUI(isInit = false) {
    const total = FRAGMENTS_CONFIG.length;
    const count = restoredIds.length;
    const percent = Math.round((count / total) * 100);

    if (restorationPercentEl) restorationPercentEl.textContent = `${percent}%`;
    if (restorationProgressFill) restorationProgressFill.style.width = `${percent}%`;

    if (count === total) {
      // 全部修复完成！
      if (archiveFinalCard) archiveFinalCard.classList.remove('hidden');
      museumStore.update({
        restorationComplete: true,
        restoredFragments: restoredIds
      });
      if (!isInit) {
        eggsManager.triggerEgg('restored_memory');
      }
    }
  }

  // 渲染插槽与漂浮碎片
  function renderSlotsAndFragments() {
    if (!slotsContainer || !fragmentsPool) return;
    slotsContainer.innerHTML = '';
    fragmentsPool.innerHTML = '';

    FRAGMENTS_CONFIG.forEach((cfg) => {
      const isRestored = restoredIds.includes(cfg.id);

      // 插槽
      const slot = document.createElement('div');
      slot.className = `restoration-slot ${isRestored ? 'filled' : 'empty'}`;
      slot.dataset.targetId = cfg.id;
      slot.setAttribute('tabindex', isRestored ? '-1' : '0');
      slot.setAttribute('role', 'region');
      slot.setAttribute('aria-label', `${cfg.era}年代遗迹修复插槽`);

      slot.innerHTML = `
        <div class="slot-era-badge">${cfg.era}</div>
        <div class="slot-content">
          ${isRestored ? `
            <span class="slot-icon">${cfg.icon}</span>
            <div class="slot-title">${cfg.name}</div>
            <div class="slot-desc">${cfg.text}</div>
          ` : `
            <span class="slot-placeholder">〔 待嵌入 ${cfg.era} 遗迹碎片 〕</span>
          `}
        </div>
      `;

      // 点击与键盘回车/空格装配（针对点击选中模式）
      if (!isRestored) {
        slot.setAttribute('role', 'button');
        slot.addEventListener('click', () => {
          if (selectedFragId) {
            handleTrySnap(selectedFragId, cfg.id, slot);
          } else {
            eggsManager.showToast(`📌 这是【${cfg.era}年代】插槽，请先在右侧选择对应碎片或直接拖拽投放。`);
          }
        });
        slot.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            slot.click();
          }
        });
      }

      slotsContainer.appendChild(slot);

      // 未吸附的碎片，放置在漂浮池
      if (!isRestored) {
        const fragEl = document.createElement('div');
        fragEl.className = `draggable-fragment ${selectedFragId === cfg.id ? 'selected' : ''}`;
        fragEl.dataset.fragId = cfg.id;
        fragEl.draggable = true;
        fragEl.setAttribute('tabindex', '0');
        fragEl.setAttribute('role', 'button');
        fragEl.setAttribute('aria-label', `${cfg.name}，拖拽或点击进行对位嵌入`);

        fragEl.innerHTML = `
          <div class="frag-icon">${cfg.icon}</div>
          <div class="frag-info">
            <strong>${cfg.name}</strong>
            <small>${cfg.era} 年代</small>
          </div>
          <span style="font-size: 11px; color: #38bdf8; opacity: 0.8;">拖拽/点选</span>
        `;

        // 拖拽开始
        fragEl.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', cfg.id);
          fragEl.classList.add('dragging');
        });

        fragEl.addEventListener('dragend', () => {
          fragEl.classList.remove('dragging');
        });

        // 点击切换选中状态
        fragEl.addEventListener('click', () => {
          audioManager.playClick();
          if (selectedFragId === cfg.id) {
            selectedFragId = null;
            fragEl.classList.remove('selected');
            eggsManager.showToast('已取消碎片选定');
          } else {
            selectedFragId = cfg.id;
            fragmentsPool.querySelectorAll('.draggable-fragment').forEach(f => f.classList.remove('selected'));
            fragEl.classList.add('selected');
            eggsManager.showToast(`✨ 已选定【${cfg.name}】，请点击左侧对应的 ${cfg.era} 年代插槽`);
          }
        });

        // 键盘无障碍支持
        fragEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fragEl.click();
          }
        });

        fragmentsPool.appendChild(fragEl);
      }
    });

    // 绑定槽位的 DragOver, DragLeave, Drop 事件
    slotsContainer.querySelectorAll('.restoration-slot.empty').forEach((slot) => {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        slot.classList.add('dragover');
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('dragover');
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('dragover');
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = slot.dataset.targetId;
        if (draggedId && targetId) {
          handleTrySnap(draggedId, targetId, slot);
        }
      });
    });
  }

  // 严格比对碎片投放与槽位目标
  function handleTrySnap(fragId, targetId, slotEl) {
    const fragCfg = FRAGMENTS_CONFIG.find(f => f.id === fragId);
    const targetCfg = FRAGMENTS_CONFIG.find(f => f.id === targetId);
    if (!fragCfg || !targetCfg) return;

    if (fragId === targetId) {
      // 对位成功！
      selectedFragId = null;
      doSnapFragment(fragId);
    } else {
      // 对位失败！严格拒绝吸附并触发弹回与音效
      audioManager.playReject();
      if (eggsManager.haptic) eggsManager.haptic([25, 40, 25]);

      // 槽位晃动警示
      slotEl.classList.remove('slot-mismatch');
      void slotEl.offsetWidth; // 触发 reflow
      slotEl.classList.add('slot-mismatch');
      setTimeout(() => slotEl.classList.remove('slot-mismatch'), 500);

      // 碎片弹回反馈
      const fragEl = fragmentsPool?.querySelector(`[data-frag-id="${fragId}"]`);
      if (fragEl) {
        fragEl.classList.remove('frag-bounce-back');
        void fragEl.offsetWidth;
        fragEl.classList.add('frag-bounce-back');
        setTimeout(() => fragEl.classList.remove('frag-bounce-back'), 500);
      }

      eggsManager.showToast(`⚠️ 时代错位：该碎片属于 ${fragCfg.era} 年代，无法嵌入 ${targetCfg.era} 插槽！请重新匹配。`);
    }
  }

  function doSnapFragment(fragId) {
    if (restoredIds.includes(fragId)) return;
    const cfg = FRAGMENTS_CONFIG.find(f => f.id === fragId);
    if (!cfg) return;

    audioManager.playSnap();
    if (eggsManager.haptic) eggsManager.haptic(30);
    restoredIds.push(fragId);
    museumStore.update({ restoredFragments: [...restoredIds] });

    eggsManager.showToast(`✨ 成功吸附修复 ${cfg.era} 年代遗迹：${cfg.name}`);

    renderSlotsAndFragments();
    updateProgressUI();

    if (restoredIds.length === FRAGMENTS_CONFIG.length) {
      audioManager.playRestorationSuccess();
      if (eggsManager.haptic) eggsManager.haptic([40, 60, 40, 60, 90]);
      eggsManager.showToast('🎉 全网 6 大遗址修复完成！终极历史档案已解密！');
    }
  }

  // 终极导出按钮
  if (btnFinalExport) {
    btnFinalExport.addEventListener('click', () => {
      eggsManager.exportStandaloneHTML();
    });
  }

  renderSlotsAndFragments();
  updateProgressUI(true);
}


  // === 主程序启动 (app.js) ===
  /**
 * 《404 之前：互联网考古馆》- 主应用入口
 */



// 单个模块初始化失败只记录日志，不影响其余展厅与全局控件绑定
function safeInit(name, fn) {
  try {
    fn();
  } catch (e) {
    console.error(`[${name}] 初始化失败:`, e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化各基础管理器
  safeInit('navigation', () => navigationManager.init());
  safeInit('eggs', () => eggsManager.init());

  // 2. 初始化各年代展厅
  safeInit('era-1998', initEra1998);
  safeInit('era-2003', initEra2003);
  safeInit('era-2008', initEra2008);
  safeInit('era-2012', initEra2012);
  safeInit('era-2024', initEra2024);
  safeInit('era-2099', initEra2099);

  // 3. 声音开关绑定
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundLabel = document.getElementById('sound-status-label');

  function updateSoundUI(enabled) {
    if (soundToggleBtn) {
      if (enabled) {
        soundToggleBtn.classList.add('sound-on');
        soundToggleBtn.classList.remove('sound-off');
        if (soundLabel) soundLabel.textContent = '🔊 音效开启';
      } else {
        soundToggleBtn.classList.add('sound-off');
        soundToggleBtn.classList.remove('sound-on');
        if (soundLabel) soundLabel.textContent = '🔇 音效已静音';
      }
    }
  }

  updateSoundUI(museumStore.getState().soundEnabled);

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      const current = museumStore.getState().soundEnabled;
      const next = !current;
      museumStore.update({ soundEnabled: next });
      updateSoundUI(next);
      if (next) {
        audioManager.ensureContext();
        audioManager.playClick();
        eggsManager.showToast('🔊 模拟音效已开启，已解锁 1998 拨号杂音与复古八音盒！');
      } else {
        eggsManager.showToast('🔇 音效已静音');
      }
    });
  }

  // 4. 展品导览说明弹窗
  const introBtn = document.getElementById('btn-museum-intro');
  const introModal = document.getElementById('museum-intro-modal');
  const closeIntroBtn = document.getElementById('btn-close-intro');
  const startExploreBtn = document.getElementById('btn-start-explore');

  const closeIntroModal = () => {
    audioManager.playClick();
    if (introModal) {
      introModal.classList.remove('visible');
      setTimeout(() => {
        introModal.classList.add('hidden');
      }, 250);
    }
  };

  if (introBtn && introModal) {
    introBtn.addEventListener('click', () => {
      audioManager.playClick();
      introModal.classList.remove('hidden');
      requestAnimationFrame(() => {
        introModal.classList.add('visible');
      });
    });
  }

  if (closeIntroBtn) {
    closeIntroBtn.addEventListener('click', closeIntroModal);
  }
  if (startExploreBtn) {
    startExploreBtn.addEventListener('click', closeIntroModal);
  }

  console.log('🏛️《404 之前：互联网考古馆》已成功启动！穿越 1998 ~ 2099 年代。');
});

})();