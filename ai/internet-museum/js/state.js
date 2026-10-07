/**
 * 《404 之前：互联网考古馆》- 全局状态管理
 * 负责状态存储、localStorage 读写与事件广播
 */

const STORAGE_KEY = 'internet-museum-state-v1';

// 6个年代元数据定义
export const ERAS_CONFIG = [
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
export const EGGS_METADATA = {
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
          if (Array.isArray(parsed.guestbookMessages)) base.guestbookMessages = parsed.guestbookMessages;
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

export const museumStore = new MuseumStore();
