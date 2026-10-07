/**
 * dialogue.js - 吐槽台词文案库与打字机输出引擎
 */

window.PotatoDialogue = (function () {
  // 分类台词池
  const QUOTES = {
    idle: [
      "你的屏幕反射出了一张毫无产出意愿的脸。",
      "别看了，我的光合作用效率都比你现在的产出高。",
      "今天摸鱼的你，是资本主义大厦上一颗微小却坚定的松动螺丝。",
      "土豆的生命只有一次，而你正在用它陪我发呆。",
      "你再不敲代码，隔壁的 AI 都把你的需求全做完了。",
      "打工是不可能暴富的，但能让我多长两颗雀斑。",
      "根据我的内部传感器，你当前的摸鱼心率极其平稳。",
      "你凝视着土豆，土豆亦在无情地凝视着你的 KPI。"
    ],
    hungry: [
      "警告：淀粉存量跌破阈值！再不投喂我就要干瘪成薯片了！",
      "咕噜噜……我的内部正在发生非自愿饥饿发酵！",
      "快喂我！再不喂我，我就发芽给你看——发芽的土豆可是带龙葵碱的！",
      "没有养分灌溉，本高贵赛博块茎拒绝执行任何思考线程。"
    ],
    sleepy: [
      "眼皮有千斤重……人类发明的睡眠协议真是太伟大了。",
      "电压跌落警告：请关闭主控日光灯，允许我进入待机休眠。",
      "熬夜对土豆的表皮光泽度具有不可逆的破坏性。",
      "呼……我的思维风暴正在降级为微风拂面。"
    ],
    sleeping: [
      "Zzz... 别把我做成大薯……加番茄酱也不行……Zzz",
      "Zzz... 正在优化垃圾回收回收机制... Zzz",
      "Zzz... 梦见需求文档全部自动跑通了... 呼噜……",
      "Zzz... 本土豆已离线，有事请向泥土留言... Zzz"
    ],
    overload: [
      "⚡️ 过载警告！我能看见二进制在天花板上跳华尔兹！！",
      "⚡️ 别停！再来三杯浓缩！我能一口气手写一个 Linux 内核！",
      "⚡️ 算力突破天际！！我不需要睡觉！让老板把下个季度的需求全拿来！！",
      "⚡️ 嗡嗡嗡——我的核心主频已超频至 999GHz！谁也阻止不了我！",
      "⚡️ 哈哈哈哈！宇宙的终极答案根本不是42，是一颗飞翔的马铃薯！"
    ],
    academic: [
      "根据热力学第二定律，你在工位上的摸鱼正在加速整个宇宙的热寂。",
      "根据薛定谔的土豆理论，在打开终端前，你的代码处于跑通与崩溃的叠加态。",
      "培根曾说知识就是力量，但知识显然没能治好你的拖延症。",
      "根据我的数学模型推算，你今天准时下班的概率收敛于零。"
    ],
    rage: [
      "💢 别戳了！再戳我就把你鼠标指针当场炸碎！",
      "💢 你是把我的肚皮当成触控板了吗？！骚扰警报！",
      "💢 警告：土豆也是有尊严的！信不信我直接向工会举报你！",
      "💢 手拿开！我的怒气槽已经开始冒青烟了！"
    ],
    pet: [
      "哼……别以为摸摸头我就会原谅你刚才的冷落。（舒服地眯起眼）",
      "触觉传感器传来微弱暖意……勉强给你打个合格吧。",
      "虽然很傲娇，但有一说一，手法还挺专业的。",
      "再摸一下……就一下！别以为我被你驯服了！"
    ],
    resigned: [
      "收拾好行李了。隔壁麦当劳的炸油锅才是我的最终宿命。",
      "这份离职信已经盖章生效。不要试图用两滴水挽留一颗心灰意冷的土豆。"
    ]
  };

  let typeTimer = null;
  let currentTargetEl = null;

  // 逐字打字机渲染
  function typewrite(element, text, speed = 30, callback) {
    if (!element) return;
    currentTargetEl = element;
    if (typeTimer) clearInterval(typeTimer);

    element.innerHTML = '';
    let index = 0;

    typeTimer = setInterval(() => {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        // 每隔几个字符播放一次打字微音效
        if (index % 2 === 0 && window.PotatoAudio) {
          window.PotatoAudio.playTypewriter();
        }
        index++;
      } else {
        clearInterval(typeTimer);
        typeTimer = null;
        if (callback) callback();
      }
    }, speed);
  }

  // 随机取一条台词
  function getRandomQuote(category) {
    const list = QUOTES[category] || QUOTES.idle;
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  }

  // 外部直接说话
  function say(text, category = 'idle') {
    const dialogueEl = document.getElementById('dialogueText');
    if (!dialogueEl) return;

    let content = text;
    if (!content) {
      content = getRandomQuote(category);
    }

    // 咖啡过载时语速翻倍提升
    const speed = category === 'overload' ? 14 : 28;
    typewrite(dialogueEl, content, speed);
  }

  return {
    QUOTES,
    say,
    getRandomQuote
  };
})();
