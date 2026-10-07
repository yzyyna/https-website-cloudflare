/**
 * 《404 之前：互联网考古馆》- 2003 个人主页花园
 */

import { museumStore } from '../state.js';
import { audioManager } from '../audio.js';
import { eggsManager } from '../eggs.js';

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

export function initEra2003() {
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
        alert('请输入留言内容哦~');
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
