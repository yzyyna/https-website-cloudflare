/**
 * 《404 之前：互联网考古馆》- 导航与时间轴驱动模块
 * 负责横向展区滚动、手势拖拽、键盘导航与时代同步
 */

import { ERAS_CONFIG, EGGS_METADATA, museumStore } from './state.js';
import { audioManager } from './audio.js';
import { eggsManager } from './eggs.js';

/* 程序滚动态的最长保持时间：跨多个展厅的平滑滚动通常 1 秒左右完成；
   超过它仍未抵达，多半是滚动被用户手势打断，此时必须放开程序态 */
const PROGRAMMATIC_SCROLL_MAX_MS = 3000;

/* 任一遮罩/抽屉打开时，方向键归遮罩层处理，不在背后切换展厅 */
const OPEN_OVERLAY_SELECTOR = '.museum-modal-backdrop.visible, .archaeology-drawer.visible';
const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'];

export class NavigationManager {
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
        // 排定之后才开始的程序滚动：这次检测已过期，执行它会把中途经过的展厅写进存档并多播一次音
        if (this.isProgrammaticScroll) return;
        this.detectCurrentEraFromScroll();
      }, 60);
    }, { passive: true });

    // 2. 滚轮事件优化：精准判定纵向滚动意图，避免阻碍展厅内容垂直阅读
    this.galleryEl.addEventListener('wheel', (e) => {
      // 若主要是横向滚动（如触控板左右轻扫），直接交由原生处理
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // 但它同样会打断正在进行的程序滚动：放开程序态，让之后的滚动事件照常同步时代
        this.releaseProgrammaticScroll();
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
        // 滚轮接管了滚动位置，正在进行的程序滚动作废：放开程序态让手动滚动重新生效
        this.releaseProgrammaticScroll();
        this.galleryEl.scrollBy({
          left: e.deltaY * 1.3,
          behavior: 'auto'
        });
      }
    }, { passive: false });

    // 3. 键盘左右键切换
    window.addEventListener('keydown', (e) => {
      // 避免在输入控件（含下拉与可编辑区）内按左右键触发切屏
      const active = document.activeElement;
      const inInput = !!(active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable));
      // 有遮罩/抽屉打开时方向键归遮罩层处理，不在它背后悄悄切展厅
      if (document.querySelector(OPEN_OVERLAY_SELECTOR)) {
        // 遮罩多半由展厅内的按钮打开，焦点还在可滚动的展厅里：
        // 拦掉方向键的原生滚动，否则展厅会在遮罩背后翻页（输入控件内除外，光标移动要用）
        if (!inInput && !e.altKey && !e.ctrlKey && !e.metaKey && NAV_KEYS.includes(e.key)) {
          e.preventDefault();
        }
        return;
      }
      if (inInput) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.repeat) return; // 按住不放的系统自动重复不连续跳厅、不叠音
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
      if (e.button !== 0) return; // 只认左键：右键/中键按下不应进入拖拽态
      if (e.target.closest('button, input, textarea, a, .clickable, .draggable-item')) return;
      // 即将手动拖动，正在进行的程序滚动作废
      this.releaseProgrammaticScroll();
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

    // 触摸拖动会打断浏览器正在进行的平滑滚动：放开程序态，让后续滚动事件照常同步时代
    this.galleryEl.addEventListener('touchmove', () => {
      if (this.isProgrammaticScroll) this.releaseProgrammaticScroll();
    }, { passive: true });

    // 窗口宽度变化后展厅宽度随之改变，按新宽度把当前展厅重新对齐（静默，不算穿越）。
    // 是否瞬时取决于 CSS 的 scroll-behavior（.gallery 设了 smooth，所以实际是动画）。
    // 只认宽度：移动端地址栏收放只改高度，那不是真正的重排，不能在用户滑动途中把位置拽回去
    let lastWidth = this.galleryEl.clientWidth;
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const width = this.galleryEl.clientWidth;
        if (width === lastWidth || !width) return;
        lastWidth = width;
        this.goToEraByIndex(this.currentIndex, false, true);
      }, 150);
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
        this.eggCountEl.textContent = `${state.eggs.length} / ${Object.keys(EGGS_METADATA).length}`;
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

  /* 结束程序滚动态。平滑滚动被用户手势打断、或超时仍未抵达时必须走到这里：
     否则标志一直为 true，scroll 监听器从此忽略所有手动滚动，时代指示不再跟随 */
  releaseProgrammaticScroll() {
    if (this._programmaticTimer) {
      clearTimeout(this._programmaticTimer);
      this._programmaticTimer = 0;
    }
    this.isProgrammaticScroll = false;
  }

  goToEraByIndex(index, smooth = true, silent = false) {
    const clampedIndex = Math.max(0, Math.min(this.eras.length - 1, index));
    const width = this.galleryEl.clientWidth || window.innerWidth;
    const targetScroll = clampedIndex * width;
    const targetEra = this.eras[clampedIndex];
    /* 判据是「目标展厅是否就是当前展厅」，而不是滚动偏移量：
       同厅内小幅拖动后松手，偏移必然超过几像素，但那只是在同一展厅里回弹 */
    const sameEra = clampedIndex === this.currentIndex;
    const needsSnap = Math.abs(this.galleryEl.scrollLeft - targetScroll) >= 2;

    if (sameEra && !needsSnap) {
      this.updateIndicators(targetEra.year);
      return;
    }

    this.isProgrammaticScroll = true;
    this._programmaticStart = performance.now();

    if (!sameEra) {
      this.currentIndex = clampedIndex;
      museumStore.update({ currentEra: targetEra.year });
      if (!silent) {
        audioManager.playEraTransition();
        // 展厅间过渡提示：切换年代时给出轻量面包屑，避免用户在横向长廊中迷失方位
        if (typeof eggsManager !== 'undefined' && eggsManager.showToast) {
          eggsManager.showToast(`已穿越至 ${targetEra.year} · ${targetEra.name}`);
        }
      }
    }

    this.galleryEl.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto'
    });

    if (this._programmaticTimer) clearTimeout(this._programmaticTimer);
    const settle = () => {
      const arrived = Math.abs(this.galleryEl.scrollLeft - targetScroll) < 2;
      /* 长距离平滑滚动可能超过固定等待：抵达前保持程序态，
         防止中途减速经过的展厅被 detectCurrentEraFromScroll 误写 + 音效连播 */
      if (!arrived && performance.now() - this._programmaticStart < PROGRAMMATIC_SCROLL_MAX_MS) {
        this._programmaticTimer = setTimeout(settle, 80);
        return;
      }
      if (!arrived) {
        /* 超时仍未抵达：滚动多半被没覆盖到的手势打断，用户所在的不一定是目标展厅。
           以实际滚动位置重新检测，让 store、指示器与所见一致，而不是把指示器刷成没到的那一厅 */
        this.releaseProgrammaticScroll();
        this.detectCurrentEraFromScroll();
        this.updateIndicators(this.eras[this.currentIndex].year);
        return;
      }
      this.releaseProgrammaticScroll();
      this.updateIndicators(targetEra.year);
    };
    this._programmaticTimer = setTimeout(settle, smooth ? 450 : 50);
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
    /* 初始定位走 silent 路径：恢复上次的展厅不算“穿越”，不播提示与音效 */
    this.goToEraByIndex(initialIndex, false, true);
    if (this.eggCountEl) {
      this.eggCountEl.textContent = `${state.eggs.length} / ${Object.keys(EGGS_METADATA).length}`;
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

export const navigationManager = new NavigationManager();
