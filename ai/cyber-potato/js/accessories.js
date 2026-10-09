/**
 * accessories.js - 奇怪配件与生长系统
 */

window.PotatoAccessories = (function () {
  // 配件配置字典
  const ACCESSORY_DEFS = [
    {
      id: 'glasses',
      name: '老学究黑框眼镜',
      icon: '👓',
      domClass: 'accessory-glasses',
      desc: '饱读诗书后长出的光学配件，说话开始言必称物理定律。',
      unlockHint: '逼它连续读书 3 次解锁',
      checkUnlock: (state) => (state.counters.bookCount || 0) >= 3
    },
    {
      id: 'cyberEye',
      name: '赛博义眼与管线',
      icon: '👁️',
      domClass: 'accessory-cyber-eye',
      desc: '承受高频咖啡因超频冲击后，眼部变异出的外挂发光光瞳。',
      unlockHint: '让它经历 2 次咖啡过载解锁',
      checkUnlock: (state) => (state.counters.overloadCount || 0) >= 2
    },
    {
      id: 'sprout',
      name: '生化嫩绿幼芽',
      icon: '🌱',
      domClass: 'accessory-sprout',
      desc: '在极端冷落与抗议中顽强破土而出的小草，代表生命的反叛。',
      unlockHint: '冷落它或经历 1 次辞职事件解锁',
      checkUnlock: (state) => (state.counters.resignedTimes || 0) >= 1 || (state.stats.hunger <= 10)
    },
    {
      id: 'mushroom',
      name: '剧毒红伞蘑菇',
      icon: '🍄',
      domClass: 'accessory-mushroom',
      desc: '长时间未擦拭在表皮寄生发霉产生的小毒蕈，十分危险。',
      unlockHint: '累计发霉或饥饿总数达到 50 点解锁',
      checkUnlock: (state) => (state.counters.neglectScore || 0) >= 50
    },
    {
      id: 'tie',
      name: '打工人暗红领带',
      icon: '👔',
      domClass: 'accessory-tie',
      desc: '标准的正式社畜防卫装备，戴上后工作效率（幻觉）+20%。',
      unlockHint: '累计抚摸/互动 15 次解锁',
      checkUnlock: (state) => (state.counters.petCount || 0) >= 15
    },
    {
      id: 'goldChain',
      name: '暴发户粗金链子',
      icon: '🪙',
      domClass: 'accessory-gold-chain',
      desc: '沉甸甸的纯金质感，宣告这颗土豆不仅有淀粉，还有资产。',
      unlockHint: '累计综合互动达 40 次解锁',
      checkUnlock: (state) => {
        const total = (state.counters.feedCount || 0) + 
                      (state.counters.coffeeCount || 0) + 
                      (state.counters.bookCount || 0) + 
                      (state.counters.pokeCount || 0) + 
                      (state.counters.petCount || 0);
        return total >= 40;
      }
    }
  ];

  // 检查是否有新配件满足解锁条件
  function evaluateUnlocks(state) {
    let newlyUnlocked = [];
    ACCESSORY_DEFS.forEach((acc) => {
      if (!state.accessories.unlocked[acc.id] && acc.checkUnlock(state)) {
        state.accessories.unlocked[acc.id] = true;
        // 自动激活佩戴上
        state.accessories.active[acc.id] = true;
        newlyUnlocked.push(acc);
      }
    });

    if (newlyUnlocked.length > 0) {
      applyToDOM(state);
      renderWardrobe(state);
      return newlyUnlocked;
    }
    return [];
  }

  // 同步佩戴状态到真实 DOM
  function applyToDOM(state) {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    ACCESSORY_DEFS.forEach((acc) => {
      const el = document.querySelector(`.${acc.domClass}`);
      if (el) {
        if (state.accessories.active[acc.id]) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    // 辞职小行囊
    const bundleEl = document.querySelector('.accessory-bundle');
    if (bundleEl) {
      if (state.resigned) {
        bundleEl.classList.add('active');
      } else {
        bundleEl.classList.remove('active');
      }
    }
  }

  // 渲染衣橱列表
  function renderWardrobe(state) {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function' || typeof document.createElement !== 'function') return;
    const listEl = document.getElementById('wardrobeGrid');
    if (!listEl) return;

    listEl.innerHTML = '';
    ACCESSORY_DEFS.forEach((acc) => {
      const isUnlocked = !!state.accessories.unlocked[acc.id];
      const isActive = !!state.accessories.active[acc.id];

      const card = document.createElement('div');
      card.className = `accessory-card ${isUnlocked ? '' : 'locked'}`;
      card.innerHTML = `
        <div class="accessory-header">
          <span>${acc.icon} ${acc.name}</span>
          ${
            isUnlocked
              ? `<span class="toggle-badge ${isActive ? 'active' : ''}" data-id="${acc.id}">
                  ${isActive ? '已佩戴' : '未佩戴'}
                </span>`
              : `<span class="toggle-badge">未解锁</span>`
          }
        </div>
        <div class="accessory-desc">
          ${isUnlocked ? acc.desc : `🔒 ${acc.unlockHint}`}
        </div>
      `;

      if (isUnlocked) {
        const toggleBtn = card.querySelector('.toggle-badge');
        toggleBtn.addEventListener('click', () => {
          // 每次取当前存档对象，避免 reset() 之后闭包持有旧 state
          const s = window.PotatoState ? window.PotatoState.getState() : state;
          s.accessories.active[acc.id] = !s.accessories.active[acc.id];
          applyToDOM(s);
          renderWardrobe(s);
          if (window.PotatoState) {
            window.PotatoState.save();
          }
          if (window.PotatoAudio) {
            window.PotatoAudio.playPoke();
          }
        });
      }

      listEl.appendChild(card);
    });
  }

  return {
    ACCESSORY_DEFS,
    evaluateUnlocks,
    applyToDOM,
    renderWardrobe
  };
})();
