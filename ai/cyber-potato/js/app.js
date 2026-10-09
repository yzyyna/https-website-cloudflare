/**
 * app.js - 赛博土豆主控制器与交互调度中心
 */

(function () {
  // DOM 元素缓存
  const elPotatoChar = document.getElementById('potatoChar');
  const elValHunger = document.getElementById('valHunger');
  const elFillHunger = document.getElementById('fillHunger');
  const elValEnergy = document.getElementById('valEnergy');
  const elFillEnergy = document.getElementById('fillEnergy');
  const elValSanity = document.getElementById('valSanity');
  const elFillSanity = document.getElementById('fillSanity');
  const elOverheatMeter = document.getElementById('overheatMeter');
  const elValOverheat = document.getElementById('valOverheat');
  const elDialogueText = document.getElementById('dialogueText');
  const elDialogueIcon = document.getElementById('dialogueIcon');
  const elStatusHintText = document.getElementById('statusHintText');
  const elLiveClock = document.getElementById('liveClock');
  const elSleepBtnIcon = document.getElementById('sleepBtnIcon');
  const elSleepBtnText = document.getElementById('sleepBtnText');
  const elCrtScreen = document.querySelector('.crt-screen');
  const elPetTitleBadge = document.getElementById('petTitleBadge');
  const elPetAgeText = document.getElementById('petAgeText');

  // 模态框
  const modalResignation = document.getElementById('modalResignation');
  const modalWardrobe = document.getElementById('modalWardrobe');
  const modalTimeMachine = document.getElementById('modalTimeMachine');

  // 音频切换
  const btnMute = document.getElementById('btnMute');
  const muteIcon = document.getElementById('muteIcon');

  // 戳一戳连击记录
  let pokeTimestamps = [];
  let rageTimeout = null;

  // 动画定时器句柄（重复触发时先清理，避免旧定时器提前移除新动画类）
  let shakeTimer = null;
  let squashTimer = null;
  let blushTimer = null;
  const pressTimers = new Map();

  // 触觉反馈（Android Vibration API；iOS 静默降级无副作用）
  function haptic(ms) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
    } catch (e) {}
  }

  // 屏幕震颤与移动端震动反馈 (Haptic)
  function triggerScreenShake(hapticMs = 40) {
    if (elCrtScreen) {
      elCrtScreen.classList.remove('screen-shake');
      void elCrtScreen.offsetWidth;
      elCrtScreen.classList.add('screen-shake');
      clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => elCrtScreen.classList.remove('screen-shake'), 350);
    }
    haptic(hapticMs);
  }

  // 1. 初始化入口
  function init() {
    // 加载存档与离线时间推演
    window.PotatoState.load();
    const state = window.PotatoState.getState();

    // 音效初始化
    updateMuteUI();

    // 绑定界面事件
    bindActionButtons();
    bindModals();
    bindPotatoDirectClick();
    bindKeyboardShortcuts();

    // 监听状态改变
    window.PotatoState.addChangeListener(onStateChanged);

    // 页面首次手势无感激活 Web Audio
    const unlockAudio = () => {
      if (window.PotatoAudio) window.PotatoAudio.unlock();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // 首次渲染
    updateUI(state);
    window.PotatoAccessories.applyToDOM(state);
    window.PotatoAccessories.renderWardrobe(state);

    // 启动心脏循环
    window.PotatoState.startTick();
    startClock();

    // 开场白
    setTimeout(() => {
      if (state.resigned) {
        showResignationModal();
      } else if (state.stats.hunger < 25) {
        window.PotatoDialogue.say(null, 'hungry');
      } else {
        window.PotatoDialogue.say('已完成淀粉生命体启动。今天你又打算浪费多少青春？', 'idle');
      }
    }, 600);
  }

  // 2. 状态变更回调
  function onStateChanged(state, detail) {
    updateUI(state);

    // 如果刚发生辞职，弹出辞职信
    if (state.resigned && !modalResignation.classList.contains('open')) {
      showResignationModal();
    }
  }

  // 3. UI 仪表盘与外观刷新
  function updateUI(state) {
    const { hunger, energy, sanity, overheat } = state.stats;

    // 饱食度
    elValHunger.textContent = `${Math.round(hunger)}%`;
    elFillHunger.style.width = `${Math.min(100, Math.max(0, hunger))}%`;
    setBarColorClass(elFillHunger, hunger);

    // 电力
    elValEnergy.textContent = `${Math.round(energy)}%`;
    elFillEnergy.style.width = `${Math.min(100, Math.max(0, energy))}%`;
    setBarColorClass(elFillEnergy, energy);

    // 心智
    elValSanity.textContent = `${Math.round(sanity)}%`;
    elFillSanity.style.width = `${Math.min(100, Math.max(0, sanity))}%`;
    setBarColorClass(elFillSanity, sanity);

    // 过载温度指示
    if (overheat > 10) {
      elOverheatMeter.classList.add('active');
      elValOverheat.textContent = `${Math.round(overheat * 3.5 + 45)}°C`;
    } else {
      elOverheatMeter.classList.remove('active');
    }

    // 睡觉按钮文案
    if (state.isSleeping) {
      elSleepBtnIcon.textContent = '☀️';
      elSleepBtnText.textContent = '开灯醒';
    } else {
      elSleepBtnIcon.textContent = '💤';
      elSleepBtnText.textContent = '关灯睡';
    }

    // 状态修饰类更新
    updateCharacterClasses(state);

    // 存活天数与成长度称号更新
    if (elPetAgeText && elPetTitleBadge) {
      const birth = state.birthTime || Date.now();
      const days = Math.max(1, Math.floor((Date.now() - birth) / 86400000) + 1);
      elPetAgeText.textContent = `Day ${days}`;

      const totalInteractions = 
        (state.counters.feedCount || 0) +
        (state.counters.coffeeCount || 0) +
        (state.counters.bookCount || 0) +
        (state.counters.pokeCount || 0) +
        (state.counters.petCount || 0);

      let title = '萌芽淀粉块';
      if (totalInteractions >= 150) title = '薯门统帅·碳水主宰';
      else if (totalInteractions >= 70) title = '资深赛博马铃薯';
      else if (totalInteractions >= 30) title = '高级老油条薯';
      else if (totalInteractions >= 10) title = '入门级打工薯';

      elPetTitleBadge.textContent = title;
    }
  }

  function setBarColorClass(el, val) {
    el.classList.remove('warning', 'danger');
    if (val < 25) {
      el.classList.add('danger');
    } else if (val < 50) {
      el.classList.add('warning');
    }
  }

  function updateCharacterClasses(state) {
    // 移除主要状态类
    elPotatoChar.classList.remove(
      'state-normal',
      'state-hungry',
      'state-sleepy',
      'state-sleeping',
      'state-overload',
      'state-crash',
      'state-rage',
      'state-resigned'
    );

    let status = state.status;
    let hint = '状态: 正常摸鱼中';
    let icon = '💬';

    if (state.resigned) {
      elPotatoChar.classList.add('state-resigned');
      hint = '状态: 已经递交辞呈，准备投奔油锅';
      icon = '📦';
    } else if (elPotatoChar.classList.contains('is-raging')) {
      elPotatoChar.classList.add('state-rage');
      hint = '状态: 狂暴愤怒！警告：请勿骚扰！';
      icon = '💢';
    } else if (status === 'overload') {
      elPotatoChar.classList.add('state-overload');
      hint = '状态: ⚡️ 咖啡超频过载！主频 999GHz！';
      icon = '⚡️';
    } else if (status === 'crash') {
      elPotatoChar.classList.add('state-crash');
      hint = '状态: 虚脱断电，动弹不得';
      icon = '🪫';
    } else if (status === 'sleeping') {
      elPotatoChar.classList.add('state-sleeping');
      hint = '状态: 深度打盹休眠中...';
      icon = '💤';
    } else if (status === 'hungry') {
      elPotatoChar.classList.add('state-hungry');
      hint = '状态: 极度饥饿发瘪，急需化肥！';
      icon = '😫';
    } else if (status === 'sleepy') {
      elPotatoChar.classList.add('state-sleepy');
      hint = '状态: 电压过低，眼皮打架中';
      icon = '🥱';
    } else {
      elPotatoChar.classList.add('state-normal');
      hint = '状态: 厌世发呆中';
      icon = '🥔';
    }

    elStatusHintText.textContent = hint;
    elDialogueIcon.textContent = icon;
  }

  // 4. 核心交互按钮绑定
  function bindActionButtons() {
    // 喂食 (Feed)
    document.getElementById('btnFeed').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      if (state.resigned) {
        showResignationModal();
        return;
      }

      state.stats.hunger = Math.min(100, state.stats.hunger + 24);
      state.stats.sanity = Math.min(100, state.stats.sanity + 6);
      state.counters.feedCount = (state.counters.feedCount || 0) + 1;

      window.PotatoAudio.playFeed();
      haptic(15);
      triggerSquash();

      // 台词反馈
      if (state.stats.hunger >= 95) {
        window.PotatoDialogue.say('嗝——！淀粉已满溢，快膨胀成巨型马铃薯了！', 'idle');
      } else {
        const quotes = [
          '吞噬了优质有机化肥，淀粉分子重新排列完成。',
          '咕咚！味道像陈年泥土，但能维持生命。',
          '感谢投喂，我暂时放弃了发芽毒死你的计划。'
        ];
        window.PotatoDialogue.say(quotes[Math.floor(Math.random() * quotes.length)], 'idle');
      }

      checkUnlocks();
      window.PotatoState.save();
      window.PotatoState.evaluateStatus();
      updateUI(state);
    });

    // 灌咖啡 (Coffee) - 过载核心玩法！
    document.getElementById('btnCoffee').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      if (state.resigned) {
        showResignationModal();
        return;
      }

      // 精力突破，过载温度暴涨
      state.stats.energy = Math.min(150, state.stats.energy + 25);
      state.stats.overheat = Math.min(100, (state.stats.overheat || 0) + 35);
      state.counters.coffeeCount = (state.counters.coffeeCount || 0) + 1;

      window.PotatoAudio.playCoffee();
      triggerSquash();

      if (state.stats.overheat > 60) {
        // 触发过载狂暴！
        state.counters.overloadCount = (state.counters.overloadCount || 0) + 1;
        window.PotatoAudio.playAlarm();
        triggerScreenShake(80);
        window.PotatoDialogue.say(null, 'overload');

        // 检查解锁赛博义眼
        checkUnlocks();
      } else {
        window.PotatoDialogue.say('滋啦！高纯度咖啡因注入，核心主频开始爬升！', 'idle');
      }

      window.PotatoState.save();
      window.PotatoState.evaluateStatus();
      updateUI(state);
    });

    // 逼读书 (Read) - 长出眼镜核心玩法！
    document.getElementById('btnRead').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      if (state.resigned) {
        showResignationModal();
        return;
      }

      state.stats.sanity = Math.min(100, state.stats.sanity + 12);
      state.stats.hunger = Math.max(0, state.stats.hunger - 4); // 动脑耗淀粉
      state.counters.bookCount = (state.counters.bookCount || 0) + 1;

      window.PotatoAudio.playBook();
      triggerSquash();

      // 检查是否刚好长出眼镜
      const unlocks = checkUnlocks();
      const gotGlasses = unlocks.some((item) => item.id === 'glasses');

      if (gotGlasses) {
        window.PotatoDialogue.say('👓 啪的一声！由于被迫输入过多学术垃圾，你的土豆脸上硬生生长出了一副黑框眼镜！', 'academic');
      } else if (state.accessories.unlocked['glasses']) {
        window.PotatoDialogue.say(null, 'academic');
      } else {
        const count = state.counters.bookCount;
        const left = Math.max(0, 3 - count);
        window.PotatoDialogue.say(`正在强行解析代码架构...（再读 ${left} 次即可催生长出眼镜）`, 'idle');
      }

      window.PotatoState.save();
      window.PotatoState.evaluateStatus();
      updateUI(state);
    });

    // 戳一戳 (Poke) - 连击发火
    document.getElementById('btnPoke').addEventListener('click', handlePokeInteraction);

    // 关灯睡 / 开灯醒 (Sleep)
    document.getElementById('btnSleep').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      if (state.resigned) {
        showResignationModal();
        return;
      }

      state.isSleeping = !state.isSleeping;
      window.PotatoAudio.playPoke();

      if (state.isSleeping) {
        window.PotatoDialogue.say(null, 'sleeping');
      } else {
        window.PotatoDialogue.say('哈欠……主控日光灯亮起，强制重启工作线程。', 'sleepy');
      }

      window.PotatoState.save();
      window.PotatoState.evaluateStatus();
      updateUI(state);
    });

    // 摸摸头 (Pet) - 抚慰心智
    document.getElementById('btnPet').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      if (state.resigned) {
        showResignationModal();
        return;
      }

      state.stats.sanity = Math.min(100, state.stats.sanity + 18);
      state.counters.petCount = (state.counters.petCount || 0) + 1;

      window.PotatoAudio.playPet();
      triggerSquash();

      // 脸红 2.5 秒
      elPotatoChar.classList.add('has-blush');
      clearTimeout(blushTimer);
      blushTimer = setTimeout(() => elPotatoChar.classList.remove('has-blush'), 2500);

      window.PotatoDialogue.say(null, 'pet');
      checkUnlocks();

      window.PotatoState.save();
      window.PotatoState.evaluateStatus();
      updateUI(state);
    });

    // 逼它吐槽 (Random Quote)
    document.getElementById('btnSayRandom').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      window.PotatoAudio.playPoke();
      if (state.accessories.active['glasses'] && Math.random() > 0.4) {
        window.PotatoDialogue.say(null, 'academic');
      } else {
        window.PotatoDialogue.say(null, state.status);
      }
    });
  }

  // 5. 戳一戳逻辑 (含暴怒连击判定)
  function handlePokeInteraction() {
    const state = window.PotatoState.getState();
    if (state.resigned) {
      showResignationModal();
      return;
    }

    const now = Date.now();
    pokeTimestamps.push(now);
    // 只保留最近 1.5 秒内的点击
    pokeTimestamps = pokeTimestamps.filter((t) => now - t < 1500);

    state.counters.pokeCount = (state.counters.pokeCount || 0) + 1;
    triggerSquash();

    // 连击 >= 5 次，直接暴怒！
    if (pokeTimestamps.length >= 5) {
      elPotatoChar.classList.add('is-raging');
      window.PotatoAudio.playAlarm();
      triggerScreenShake(60);
      window.PotatoDialogue.say(null, 'rage');

      if (rageTimeout) clearTimeout(rageTimeout);
      rageTimeout = setTimeout(() => {
        elPotatoChar.classList.remove('is-raging');
        updateCharacterClasses(window.PotatoState.getState());
      }, 3500);
    } else {
      window.PotatoAudio.playPoke();
      // 随机掉落短吐槽
      const pokes = [
        "别戳了，戳我也戳不出需求变更。",
        "Q弹吧？这可是百分之百纯淀粉。",
        "戳一下扣两分心智，小心我写辞职报告给你看。",
        "波特正在记录你的点击热区：全在我的肚皮上。"
      ];
      window.PotatoDialogue.say(pokes[Math.floor(Math.random() * pokes.length)], 'idle');
    }

    checkUnlocks();
    window.PotatoState.save();
    updateUI(state);
  }

  function bindPotatoDirectClick() {
    // 点击土豆角色本体直接等同于戳一戳
    elPotatoChar.addEventListener('click', handlePokeInteraction);
  }

  // 6. 受击 Q 弹动画
  function triggerSquash() {
    elPotatoChar.classList.remove('is-squashing');
    void elPotatoChar.offsetWidth; // 触发 reflow
    elPotatoChar.classList.add('is-squashing');
    clearTimeout(squashTimer);
    squashTimer = setTimeout(() => {
      elPotatoChar.classList.remove('is-squashing');
    }, 380);
  }

  // 7. 检查配件解锁
  function checkUnlocks() {
    const state = window.PotatoState.getState();
    const newlyUnlocked = window.PotatoAccessories.evaluateUnlocks(state);
    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach((acc) => {
        console.log(`[解锁新配件] ${acc.name}`);
      });
      window.PotatoAccessories.applyToDOM(state);
      window.PotatoAccessories.renderWardrobe(state);
    }
    return newlyUnlocked;
  }

  // 8. 模态框与工具栏
  function bindModals() {
    // 声音开关
    btnMute.addEventListener('click', () => {
      const muted = window.PotatoAudio.toggleMute();
      updateMuteUI();
      if (!muted) {
        window.PotatoAudio.playPoke();
      }
      haptic(15);
    });

    // 打开衣橱
    document.getElementById('btnWardrobe').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      window.PotatoAccessories.renderWardrobe(state);
      modalWardrobe.classList.add('open');
      window.PotatoAudio.playPoke();
      haptic(12);
    });
    document.getElementById('btnCloseWardrobe').addEventListener('click', () => {
      modalWardrobe.classList.remove('open');
    });
    modalWardrobe.addEventListener('click', (e) => {
      if (e.target === modalWardrobe) {
        modalWardrobe.classList.remove('open');
      }
    });

    // 打开时光机
    document.getElementById('btnTimeMachine').addEventListener('click', () => {
      modalTimeMachine.classList.add('open');
      window.PotatoAudio.playPoke();
    });
    document.getElementById('btnCloseTimeMachine').addEventListener('click', () => {
      modalTimeMachine.classList.remove('open');
    });
    modalTimeMachine.addEventListener('click', (e) => {
      if (e.target === modalTimeMachine) {
        modalTimeMachine.classList.remove('open');
      }
    });

    // 时光机按键逻辑
    document.getElementById('btnDebugForward1H').addEventListener('click', () => {
      window.PotatoState.fastForward(3600);
      window.PotatoAudio.playBook();
      window.PotatoDialogue.say('时光飞逝……你已放置了 1 小时。', 'idle');
    });

    document.getElementById('btnDebugForward8H').addEventListener('click', () => {
      window.PotatoState.fastForward(3600 * 8);
      window.PotatoAudio.playBook();
      window.PotatoDialogue.say('漫长的一夜过去了……肚子已经空空如也。', 'hungry');
    });

    // 核心测试：快进 24 小时直接写辞职信！
    document.getElementById('btnDebugForward24H').addEventListener('click', () => {
      modalTimeMachine.classList.remove('open');
      // 辞职弹窗由 onStateChanged 统一触发，此处不再重复调用 showResignationModal
      window.PotatoState.fastForward(86400);
    });

    // 一键补满
    document.getElementById('btnDebugFillAll').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      state.stats.hunger = 100;
      state.stats.energy = 100;
      state.stats.sanity = 100;
      state.stats.overheat = 0;
      state.isSleeping = false;
      window.PotatoState.save();
      updateUI(state);
      window.PotatoAudio.playFeed();
      window.PotatoDialogue.say('全属性拉满！感觉自己充满了神圣的碳水之力！', 'idle');
    });

    // 直接过载
    document.getElementById('btnDebugOverloadMax').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      state.stats.overheat = 99;
      state.stats.energy = 150;
      state.counters.overloadCount = (state.counters.overloadCount || 0) + 1;
      window.PotatoState.evaluateStatus();
      updateUI(state);
      window.PotatoAudio.playAlarm();
      window.PotatoDialogue.say(null, 'overload');
      checkUnlocks();
    });

    // 格式化重置
    document.getElementById('btnDebugReset').addEventListener('click', () => {
      if (confirm('确定要重置这颗土豆的所有记忆与配件吗？')) {
        window.PotatoState.reset();
        modalTimeMachine.classList.remove('open');
        modalResignation.classList.remove('open');
        window.PotatoAccessories.applyToDOM(window.PotatoState.getState());
        window.PotatoAccessories.renderWardrobe(window.PotatoState.getState());
        updateUI(window.PotatoState.getState());
        window.PotatoDialogue.say('新生命诞生。一颗崭新、未经职场毒打的马铃薯破土而出。', 'idle');
      }
    });

    // 辞职信按钮：磕糖挽留
    document.getElementById('btnKeepPotato').addEventListener('click', () => {
      const state = window.PotatoState.getState();
      state.resigned = false;
      state.stats.hunger = 85;
      state.stats.sanity = 85;
      state.stats.energy = 70;
      state.counters.resignedTimes = (state.counters.resignedTimes || 0) + 1;

      // 绝地重生：解锁生化嫩芽配件！
      state.accessories.unlocked['sprout'] = true;
      state.accessories.active['sprout'] = true;

      window.PotatoAccessories.applyToDOM(state);
      window.PotatoAccessories.renderWardrobe(state);
      window.PotatoState.evaluateStatus();
      window.PotatoState.save();

      modalResignation.classList.remove('open');
      window.PotatoAudio.playFeed();

      // 傲娇挽留成功台词
      window.PotatoDialogue.say('哼，看在你加倍发化肥红包的面子上，劳动合同暂时顺延……头顶还为你长了一株抗议嫩芽呢！', 'idle');
      updateUI(state);
    });

    // 辞职信按钮：批准辞职 (孵化新土豆)
    document.getElementById('btnDismissPotato').addEventListener('click', () => {
      window.PotatoAudio.playStamp();
      modalResignation.classList.remove('open');
      window.PotatoState.reset();
      window.PotatoAccessories.applyToDOM(window.PotatoState.getState());
      window.PotatoAccessories.renderWardrobe(window.PotatoState.getState());
      updateUI(window.PotatoState.getState());
      window.PotatoDialogue.say('旧土豆已投奔快餐店。新孵化的土豆正在懵懂地打量着这个残酷的打工世界……', 'idle');
    });
  }

  function showResignationModal() {
    window.PotatoAudio.playStamp();
    triggerScreenShake(100);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    document.getElementById('resignationDate').textContent = localDate;
    modalResignation.classList.add('open');
    window.PotatoDialogue.say(null, 'resigned');
  }

  // 10. 全局键盘快捷键
  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // 避免输入框冲突
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
      // 组合键（如 Ctrl+R、Cmd+W）不触发养成动作
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      // 长按键盘防刷防挂（所有键均过滤自动重复）
      if (e.repeat) return;
      const btnMap = {
        '1': 'btnFeed',
        'f': 'btnFeed',
        '2': 'btnCoffee',
        'c': 'btnCoffee',
        '3': 'btnRead',
        'r': 'btnRead',
        '4': 'btnPoke',
        'p': 'btnPoke',
        '5': 'btnSleep',
        's': 'btnSleep',
        '6': 'btnPet',
        'h': 'btnPet',
        ' ': 'btnSayRandom',
        'm': 'btnMute',
        'w': 'btnWardrobe',
        't': 'btnTimeMachine'
      };

      if (e.key === 'Escape') {
        modalWardrobe.classList.remove('open');
        modalTimeMachine.classList.remove('open');
        return;
      }

      // 弹窗打开状态下屏蔽背景动作快捷键
      const isModalOpen = modalWardrobe.classList.contains('open') ||
                          modalTimeMachine.classList.contains('open') ||
                          modalResignation.classList.contains('open');
      if (isModalOpen) return;

      const btnId = btnMap[key];
      if (btnId) {
        const btn = document.getElementById(btnId);
        if (btn) {
          if (key === ' ') e.preventDefault();
          btn.classList.add('is-active-press');
          clearTimeout(pressTimers.get(btn));
          pressTimers.set(btn, setTimeout(() => btn.classList.remove('is-active-press'), 140));
          btn.click();
        }
      }
    });
  }

  function updateMuteUI() {
    const isMuted = window.PotatoAudio.isMuted();
    if (isMuted) {
      muteIcon.textContent = '🔇';
      document.getElementById('muteText').textContent = '静音';
    } else {
      muteIcon.textContent = '🔊';
      document.getElementById('muteText').textContent = '音效';
    }
  }

  // 9. 时钟
  function startClock() {
    function tick() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      elLiveClock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  // 页面加载完成后自启动
  window.addEventListener('DOMContentLoaded', init);
})();
