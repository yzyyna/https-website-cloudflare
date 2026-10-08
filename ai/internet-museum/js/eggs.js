/**
 * 《404 之前：互联网考古馆》- 彩蛋系统与考古发现册
 * 负责彩蛋收集反馈、画册渲染与离线档案导出
 */

import { EGGS_METADATA, museumStore } from './state.js';
import { audioManager } from './audio.js';

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class EggsManager {
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

export const eggsManager = new EggsManager();
