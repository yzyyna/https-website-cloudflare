/**
 * 《404 之前：互联网考古馆》- 2099 网页遗址修复中心
 */

import { museumStore } from '../state.js';
import { audioManager } from '../audio.js';
import { eggsManager } from '../eggs.js';

// 6 块历史遗迹碎片定义
const FRAGMENTS_CONFIG = [
  {
    id: 'frag_1998',
    era: 1998,
    name: '1998 拨号协议与软盘磁粉',
    icon: '💾',
    text: 'ATDT 16300 拨号握手协议残片与 1.44MB 磁性介质'
  },
  {
    id: 'frag_2003',
    era: 2003,
    name: '2003 闪烁星辰与访客计数',
    icon: '✨',
    text: '小雨的秘密花园·计数器 5201314 荧光微粒'
  },
  {
    id: 'frag_2008',
    era: 2008,
    name: '2008 深夜论坛沙发跟帖',
    icon: '☕',
    text: '天涯猫扑旧帖[quote]沙发留名[/quote]纯文本信标'
  },
  {
    id: 'frag_2012',
    era: 2012,
    name: '2012 未发送的草稿纸说说',
    icon: '💌',
    text: '在深夜反复删改后留存在草稿箱里的那句真心话'
  },
  {
    id: 'frag_2024',
    era: 2024,
    name: '2024 算法投喂与注意力特征',
    icon: '👁️',
    text: '收集了多巴胺权重的多维特征向量矩阵'
  },
  {
    id: 'frag_2099',
    era: 2099,
    name: '2099 量子时空记忆原石',
    icon: '🔮',
    text: '在 404 浩劫之后被永久保存的数字文明心跳'
  }
];

export function initEra2099() {
  const container = document.getElementById('era-2099');
  if (!container) return;

  const fragmentsPool = document.getElementById('fragments-floating-pool');
  const slotsContainer = document.getElementById('restoration-slots-grid');
  const restorationPercentEl = document.getElementById('restoration-percent');
  const restorationProgressFill = document.getElementById('restoration-progress-fill');
  const archiveFinalCard = document.getElementById('restoration-final-archive');
  const btnFinalExport = document.getElementById('btn-final-export-book');

  let restoredIds = [...(museumStore.getState().restoredFragments || [])];
  let selectedFragId = null;

  function updateProgressUI(isInit = false) {
    const total = FRAGMENTS_CONFIG.length;
    const count = restoredIds.length;
    const percent = Math.round((count / total) * 100);

    if (restorationPercentEl) restorationPercentEl.textContent = `${percent}%`;
    if (restorationProgressFill) restorationProgressFill.style.width = `${percent}%`;

    if (count === total) {
      // 全部修复完成！
      if (archiveFinalCard) archiveFinalCard.classList.remove('hidden');
      museumStore.update({
        restorationComplete: true,
        restoredFragments: restoredIds
      });
      if (!isInit) {
        eggsManager.triggerEgg('restored_memory');
      }
    }
  }

  // 渲染插槽与漂浮碎片
  function renderSlotsAndFragments() {
    if (!slotsContainer || !fragmentsPool) return;
    slotsContainer.innerHTML = '';
    fragmentsPool.innerHTML = '';

    FRAGMENTS_CONFIG.forEach((cfg) => {
      const isRestored = restoredIds.includes(cfg.id);

      // 插槽
      const slot = document.createElement('div');
      slot.className = `restoration-slot ${isRestored ? 'filled' : 'empty'}`;
      slot.dataset.targetId = cfg.id;
      slot.setAttribute('tabindex', isRestored ? '-1' : '0');
      slot.setAttribute('role', 'region');
      slot.setAttribute('aria-label', `${cfg.era}年代遗迹修复插槽`);

      slot.innerHTML = `
        <div class="slot-era-badge">${cfg.era}</div>
        <div class="slot-content">
          ${isRestored ? `
            <span class="slot-icon">${cfg.icon}</span>
            <div class="slot-title">${cfg.name}</div>
            <div class="slot-desc">${cfg.text}</div>
          ` : `
            <span class="slot-placeholder">〔 待嵌入 ${cfg.era} 遗迹碎片 〕</span>
          `}
        </div>
      `;

      // 点击与键盘回车/空格装配（针对点击选中模式）
      if (!isRestored) {
        slot.setAttribute('role', 'button');
        slot.addEventListener('click', () => {
          if (selectedFragId) {
            handleTrySnap(selectedFragId, cfg.id, slot);
          } else {
            eggsManager.showToast(`📌 这是【${cfg.era}年代】插槽，请先在右侧选择对应碎片或直接拖拽投放。`);
          }
        });
        slot.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            slot.click();
          }
        });
      }

      slotsContainer.appendChild(slot);

      // 未吸附的碎片，放置在漂浮池
      if (!isRestored) {
        const fragEl = document.createElement('div');
        fragEl.className = `draggable-fragment ${selectedFragId === cfg.id ? 'selected' : ''}`;
        fragEl.dataset.fragId = cfg.id;
        fragEl.draggable = true;
        fragEl.setAttribute('tabindex', '0');
        fragEl.setAttribute('role', 'button');
        fragEl.setAttribute('aria-label', `${cfg.name}，拖拽或点击进行对位嵌入`);

        fragEl.innerHTML = `
          <div class="frag-icon">${cfg.icon}</div>
          <div class="frag-info">
            <strong>${cfg.name}</strong>
            <small>${cfg.era} 年代</small>
          </div>
          <span style="font-size: 11px; color: #38bdf8; opacity: 0.8;">拖拽/点选</span>
        `;

        // 拖拽开始
        fragEl.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', cfg.id);
          fragEl.classList.add('dragging');
        });

        fragEl.addEventListener('dragend', () => {
          fragEl.classList.remove('dragging');
        });

        // 点击切换选中状态
        fragEl.addEventListener('click', () => {
          audioManager.playClick();
          if (selectedFragId === cfg.id) {
            selectedFragId = null;
            fragEl.classList.remove('selected');
            eggsManager.showToast('已取消碎片选定');
          } else {
            selectedFragId = cfg.id;
            fragmentsPool.querySelectorAll('.draggable-fragment').forEach(f => f.classList.remove('selected'));
            fragEl.classList.add('selected');
            eggsManager.showToast(`✨ 已选定【${cfg.name}】，请点击左侧对应的 ${cfg.era} 年代插槽`);
          }
        });

        // 键盘无障碍支持
        fragEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fragEl.click();
          }
        });

        fragmentsPool.appendChild(fragEl);
      }
    });

    // 绑定槽位的 DragOver, DragLeave, Drop 事件
    slotsContainer.querySelectorAll('.restoration-slot.empty').forEach((slot) => {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        slot.classList.add('dragover');
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('dragover');
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('dragover');
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = slot.dataset.targetId;
        if (draggedId && targetId) {
          handleTrySnap(draggedId, targetId, slot);
        }
      });
    });
  }

  // 严格比对碎片投放与槽位目标
  function handleTrySnap(fragId, targetId, slotEl) {
    const fragCfg = FRAGMENTS_CONFIG.find(f => f.id === fragId);
    const targetCfg = FRAGMENTS_CONFIG.find(f => f.id === targetId);
    if (!fragCfg || !targetCfg) return;

    if (fragId === targetId) {
      // 对位成功！
      selectedFragId = null;
      doSnapFragment(fragId);
    } else {
      // 对位失败！严格拒绝吸附并触发弹回与音效
      audioManager.playReject();
      if (eggsManager.haptic) eggsManager.haptic([25, 40, 25]);

      // 槽位晃动警示
      slotEl.classList.remove('slot-mismatch');
      void slotEl.offsetWidth; // 触发 reflow
      slotEl.classList.add('slot-mismatch');
      setTimeout(() => slotEl.classList.remove('slot-mismatch'), 500);

      // 碎片弹回反馈
      const fragEl = fragmentsPool?.querySelector(`[data-frag-id="${fragId}"]`);
      if (fragEl) {
        fragEl.classList.remove('frag-bounce-back');
        void fragEl.offsetWidth;
        fragEl.classList.add('frag-bounce-back');
        setTimeout(() => fragEl.classList.remove('frag-bounce-back'), 500);
      }

      eggsManager.showToast(`⚠️ 时代错位：该碎片属于 ${fragCfg.era} 年代，无法嵌入 ${targetCfg.era} 插槽！请重新匹配。`);
    }
  }

  function doSnapFragment(fragId) {
    if (restoredIds.includes(fragId)) return;
    const cfg = FRAGMENTS_CONFIG.find(f => f.id === fragId);
    if (!cfg) return;

    audioManager.playSnap();
    if (eggsManager.haptic) eggsManager.haptic(30);
    restoredIds.push(fragId);
    museumStore.update({ restoredFragments: [...restoredIds] });

    eggsManager.showToast(`✨ 成功吸附修复 ${cfg.era} 年代遗迹：${cfg.name}`);

    renderSlotsAndFragments();
    updateProgressUI();

    if (restoredIds.length === FRAGMENTS_CONFIG.length) {
      audioManager.playRestorationSuccess();
      if (eggsManager.haptic) eggsManager.haptic([40, 60, 40, 60, 90]);
      eggsManager.showToast('🎉 全网 6 大遗址修复完成！终极历史档案已解密！');
    }
  }

  // 终极导出按钮
  if (btnFinalExport) {
    btnFinalExport.addEventListener('click', () => {
      eggsManager.exportStandaloneHTML();
    });
  }

  renderSlotsAndFragments();
  updateProgressUI(true);
}
