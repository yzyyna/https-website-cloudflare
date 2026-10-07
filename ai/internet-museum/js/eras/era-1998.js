/**
 * 《404 之前：互联网考古馆》- 1998 拨号接入室
 */

import { museumStore } from '../state.js';
import { audioManager } from '../audio.js';
import { eggsManager } from '../eggs.js';

export function initEra1998() {
  const container = document.getElementById('era-1998');
  if (!container) return;

  const btnConnect = document.getElementById('btn-1998-connect');
  const statusLed = document.getElementById('modem-led-oh');
  const dataLed = document.getElementById('modem-led-sd');
  const dialStatusText = document.getElementById('dial-status-text');
  const dialProgressFill = document.getElementById('dial-progress-fill');
  const dialWindow = document.getElementById('win98-dial-window');
  const connectedBanner = document.getElementById('win98-connected-card');

  // 图标物件
  const iconDontClick = document.getElementById('icon-1998-dontclick');
  const iconFloppy = document.getElementById('icon-1998-floppy');
  const iconCd = document.getElementById('icon-1998-cd');
  const iconNetwork = document.getElementById('icon-1998-network');

  // 1. 初始化检查连接状态
  const state = museumStore.getState();
  if (state.connected1998) {
    applyConnectedUI();
  }

  function applyConnectedUI() {
    if (dialStatusText) dialStatusText.textContent = '已连接：电信 163 接入网 (33.6 Kbps)';
    if (dialProgressFill) dialProgressFill.style.width = '100%';
    if (btnConnect) {
      btnConnect.textContent = '断开连接';
      btnConnect.classList.add('connected');
    }
    if (statusLed) statusLed.classList.add('lit');
    if (dataLed) dataLed.classList.add('blinking');
    if (connectedBanner) connectedBanner.classList.remove('hidden');
  }

  // 2. 点击拨号连接按钮
  if (btnConnect) {
    btnConnect.addEventListener('click', () => {
      audioManager.playClick();
      const isConnected = museumStore.getState().connected1998;

      if (isConnected) {
        // 断开连接逻辑
        museumStore.update({ connected1998: false });
        if (dialStatusText) dialStatusText.textContent = '线路已断开。准备就绪。';
        if (dialProgressFill) dialProgressFill.style.width = '0%';
        btnConnect.textContent = '连接互联网 (Dial-up)';
        btnConnect.classList.remove('connected');
        if (statusLed) statusLed.classList.remove('lit');
        if (dataLed) dataLed.classList.remove('blinking');
        if (connectedBanner) connectedBanner.classList.add('hidden');
        return;
      }

      // 开始拨号
      btnConnect.disabled = true;
      btnConnect.textContent = '拨号连线中...';
      if (statusLed) statusLed.classList.add('lit');

      let progressVal = 10;
      const progressTimer = setInterval(() => {
        progressVal = Math.min(95, progressVal + 15);
        if (dialProgressFill) dialProgressFill.style.width = `${progressVal}%`;
      }, 900);

      audioManager.playDialup(
        (stepText) => {
          if (dialStatusText) dialStatusText.textContent = stepText;
          if (dataLed) dataLed.classList.toggle('blinking');
        },
        () => {
          clearInterval(progressTimer);
          btnConnect.disabled = false;
          museumStore.update({ connected1998: true });
          applyConnectedUI();
          eggsManager.showToast('🎉 成功连接到 1998 年互联网世界！');
        }
      );
    });
  }

  // 绑定图标键盘回车/空格触发无障碍
  [iconDontClick, iconFloppy, iconCd, iconNetwork].forEach(el => {
    el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  // 3. 点击彩蛋“不要点.exe”
  if (iconDontClick) {
    iconDontClick.addEventListener('click', () => {
      audioManager.playClick();
      eggsManager.triggerEgg('broken_floppy');
    });
  }

  // 4. 点击 3.5英寸软盘
  if (iconFloppy) {
    iconFloppy.addEventListener('click', () => {
      audioManager.playClick();
      showWin98Dialog(
        '软盘驱动器 (A:)',
        '容量：1.44 MB 磁性软盘\n状态：读写保护滑块已打开\n内容：包含 dialer.ini, readme.txt 以及一份只有 8KB 的全纯文本网页收藏夹。'
      );
    });
  }

  // 5. 点击光盘
  if (iconCd) {
    iconCd.addEventListener('click', () => {
      audioManager.playClick();
      showWin98Dialog(
        'CD-ROM 驱动器 (D:)',
        '光盘卷标：【电脑爱好者】1998 年合订附赠光盘\n内容：内含网际快车早期试用版、FoxMail 1.0、网络蚂蚁以及 50 款经典 MIDI 音乐合集。'
      );
    });
  }

  // 6. 点击网上邻居
  if (iconNetwork) {
    iconNetwork.addEventListener('click', () => {
      audioManager.playClick();
      showWin98Dialog(
        '网上邻居',
        '工作组 WORKGROUP：\n正在广播 ARP 寻址数据包...\n当前局域网没有发现其它主机。1998年全国拨号上网用户仅数十万人，大家都在浩瀚的黑夜里独自冲浪。'
      );
    });
  }
}

// 辅助弹出 98 风格对话框
function showWin98Dialog(title, content) {
  const modal = document.getElementById('win98-generic-dialog');
  if (!modal) return;
  const titleEl = modal.querySelector('.win98-dialog-title');
  const bodyEl = modal.querySelector('.win98-dialog-body');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = content;

  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    modal.classList.add('visible');
  });
  const closeBtn = modal.querySelector('.win98-dialog-close');
  const okBtn = modal.querySelector('.win98-dialog-ok');
  const closer = () => {
    audioManager.playClick();
    modal.classList.remove('visible');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 250);
    closeBtn?.removeEventListener('click', closer);
    okBtn?.removeEventListener('click', closer);
  };
  closeBtn?.addEventListener('click', closer);
  okBtn?.addEventListener('click', closer);
}
