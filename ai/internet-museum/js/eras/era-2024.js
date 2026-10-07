/**
 * 《404 之前：互联网考古馆》- 2024 算法走廊
 */

import { museumStore } from '../state.js';
import { audioManager } from '../audio.js';
import { eggsManager } from '../eggs.js';
import { navigationManager } from '../navigation.js';

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

export function initEra2024() {
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
