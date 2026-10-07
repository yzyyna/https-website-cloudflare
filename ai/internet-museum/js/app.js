/**
 * 《404 之前：互联网考古馆》- 主应用入口
 */

import { museumStore } from './state.js';
import { audioManager } from './audio.js';
import { navigationManager } from './navigation.js';
import { eggsManager } from './eggs.js';

import { initEra1998 } from './eras/era-1998.js';
import { initEra2003 } from './eras/era-2003.js';
import { initEra2008 } from './eras/era-2008.js';
import { initEra2012 } from './eras/era-2012.js';
import { initEra2024 } from './eras/era-2024.js';
import { initEra2099 } from './eras/era-2099.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化各基础管理器
  navigationManager.init();
  eggsManager.init();

  // 2. 初始化各年代展厅
  initEra1998();
  initEra2003();
  initEra2008();
  initEra2012();
  initEra2024();
  initEra2099();

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
