/**
 * 《404 之前：互联网考古馆》- 2012 青春空间
 */

import { museumStore } from '../state.js';
import { audioManager } from '../audio.js';
import { eggsManager } from '../eggs.js';

export function initEra2012() {
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
