/**
 * LinguaJourney - Core Application Script
 * Pure Vanilla JavaScript (Zero External Dependencies)
 */

// HTML Escape Helper
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Offline-ready SVG Avatar Generator
function getAvatarSvg(seed) {
  const s = String(seed || 'User').trim();
  const colors = [
    ['#3b82f6', '#1d4ed8'],
    ['#10b981', '#047857'],
    ['#8b5cf6', '#6d28d9'],
    ['#f59e0b', '#b45309'],
    ['#ec4899', '#be185d'],
    ['#06b6d4', '#0e7490']
  ];
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const pair = colors[Math.abs(hash) % colors.length];
  const char = escapeHTML((s[0] || 'U').toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g_${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${pair[0]}"/><stop offset="100%" stop-color="${pair[1]}"/></linearGradient></defs><rect width="40" height="40" rx="20" fill="url(#g_${Math.abs(hash)})"/><text x="20" y="25" font-family="-apple-system,sans-serif" font-weight="700" font-size="18" fill="#ffffff" text-anchor="middle">${char}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// 头像 data URI 白名单校验：仅接受本项目生成的 SVG（encodeURIComponent 输出字符集），否则回退为本地生成
const AVATAR_PREFIX = 'data:image/svg+xml;utf8,';
const AVATAR_MAX_LEN = 8000;
const AVATAR_BODY_RE = /^[A-Za-z0-9\-_.!~*'()%]*$/;
function ensureAvatar(value, seed) {
  if (typeof value === 'string' && value.length <= AVATAR_MAX_LEN && value.startsWith(AVATAR_PREFIX)
    && AVATAR_BODY_RE.test(value.slice(AVATAR_PREFIX.length))) {
    return value;
  }
  return getAvatarSvg(seed);
}

// Application State
const STATE = {
  user: null, // { name, avatar }
  progress: {
    userId: '1',
    level: 1,
    exp: 45,
    completedModules: ['m1'],
  },
  currentRoute: 'home',
  flashcards: [
    { word: 'Synergy', translation: '协同作用', example: 'We need to create synergy between the two departments.' },
    { word: 'Leverage', translation: '利用，发挥效能', example: 'We must leverage our existing resources to optimize results.' },
    { word: 'Alignment', translation: '一致，对齐', example: 'There is a lack of strategic alignment on our project goals.' },
  ],
  learnIndex: 0,
  isFlipped: false,
  sessionCompleted: false, // 本轮闪卡是否已结算，防止重复加经验
  posts: [
    { id: 1, author: 'Alex', avatar: getAvatarSvg('Alex'), content: '今天终于突破了 B2 等级的职场沟通测试！感谢大家的资料分享。', likes: 124, comments: 12, time: '2小时前', liked: false },
    { id: 2, author: 'Sarah', avatar: getAvatarSvg('Sarah'), content: '大家有没有好的商务英文跟读技巧推荐？感觉会议发言语调总是偏生硬。', likes: 45, comments: 38, time: '5小时前', liked: false },
    { id: 3, author: 'Ken', avatar: getAvatarSvg('Ken'), content: '分享一份我整理的韩语初级到中级语法思维导图，需要的自取~ 📝', likes: 892, comments: 156, time: '昨天', liked: false },
  ],
};

// LocalStorage Persistence
// 存储键带版本号；旧版无版本号键仅作只读回退，不删除，保证旧数据可回滚
const STORAGE_KEY = 'linguajourney_state_v1';
const LEGACY_STORAGE_KEY = 'linguajourney_state';
const KNOWN_MODULE_IDS = ['m1', 'm2', 'm3', 'm4', 'm5'];

// 数值清洗：非有限数（NaN / Infinity / 非数字字符串）一律回退到默认值
function toSafeInt(value, min, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.floor(n)) : fallback;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return;

    if (parsed.user && typeof parsed.user === 'object' && typeof parsed.user.name === 'string') {
      const name = parsed.user.name.slice(0, 30);
      STATE.user = { name, avatar: ensureAvatar(parsed.user.avatar, name) };
    }
    if (parsed.progress && typeof parsed.progress === 'object') {
      const exp = toSafeInt(parsed.progress.exp, 0, 0);
      STATE.progress = {
        ...STATE.progress,
        exp,
        level: Math.floor(exp / 100) + 1, // 与 addExp 的升级公式保持一致
        completedModules: Array.isArray(parsed.progress.completedModules)
          ? parsed.progress.completedModules.filter(id => typeof id === 'string' && KNOWN_MODULE_IDS.includes(id))
          : ['m1'],
      };
    }
    if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
      STATE.posts = parsed.posts
        .filter(p => p && typeof p === 'object')
        .map(p => {
          const author = String(p.author || '学员').slice(0, 30);
          return {
            id: toSafeInt(p.id, 0, Date.now()),
            author,
            avatar: ensureAvatar(p.avatar, author),
            content: String(p.content || '').slice(0, 500),
            likes: toSafeInt(p.likes, 0, 0),
            comments: toSafeInt(p.comments, 0, 0),
            time: String(p.time || '刚刚').slice(0, 20),
            liked: Boolean(p.liked)
          };
        });
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage', e);
  }
}

let storageWarned = false;
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user: STATE.user,
      progress: STATE.progress,
      posts: STATE.posts,
    }));
  } catch (e) {
    console.warn('Failed to save state to localStorage', e);
    // 隐私模式或配额满：数据仅保留在当前页面内存中，只提示一次
    if (!storageWarned) {
      storageWarned = true;
      showToast('本地存储不可用，本次学习数据刷新后将丢失');
    }
  }
}

// Router & Navigation
// 路由白名单：未知 hash 一律回退到 home
const VALID_ROUTES = ['home', 'dashboard', 'course', 'learn', 'community', 'login'];
function normalizeRoute(raw) {
  const r = String(raw || '').replace(/^#/, '');
  return VALID_ROUTES.includes(r) ? r : 'home';
}

function navigate(route) {
  const target = normalizeRoute(route);
  if (window.location.hash.replace(/^#/, '') === target) {
    // hash 未变化时 hashchange 不会触发，直接渲染
    handleHashChange();
  } else {
    // 只改 hash，由 hashchange 统一渲染，避免双重渲染
    window.location.hash = target;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleHashChange() {
  const route = normalizeRoute(window.location.hash);
  STATE.currentRoute = route;
  renderRoute(route);
}

function renderRoute(route) {
  // Hide all views
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));

  // Update nav buttons
  document.querySelectorAll('[data-nav]').forEach(el => {
    if (el.dataset.nav === route || (route === 'course' && el.dataset.nav === 'course')) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Show target view
  const target = document.getElementById(`view-${route}`);
  if (target) {
    target.classList.add('active');
  } else {
    document.getElementById('view-home').classList.add('active');
  }

  // Trigger view-specific renders
  if (route === 'dashboard') {
    renderDashboard();
  } else if (route === 'learn') {
    resetLearnSession();
  } else if (route === 'course') {
    renderCourse();
  } else if (route === 'community') {
    renderCommunity();
  }
}

// User & Auth Management
function updateUserUI() {
  const userBox = document.getElementById('sidebar-user-box');
  const loginBtn = document.getElementById('sidebar-login-btn');
  const dashWelcomeName = document.getElementById('dash-welcome-name');

  if (STATE.user) {
    if (userBox) {
      userBox.style.display = 'flex';
      document.getElementById('sidebar-avatar').src = STATE.user.avatar;
      document.getElementById('sidebar-name').textContent = STATE.user.name;
    }
    if (loginBtn) loginBtn.style.display = 'none';
    if (dashWelcomeName) dashWelcomeName.textContent = STATE.user.name;
  } else {
    if (userBox) userBox.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'flex';
    if (dashWelcomeName) dashWelcomeName.textContent = '游客';
  }
}

function loginUser(name) {
  const cleanName = name.trim().slice(0, 30) || '学员';
  STATE.user = {
    name: cleanName,
    avatar: getAvatarSvg(cleanName),
  };
  saveState();
  updateUserUI();
  navigate('dashboard');
}

function logoutUser() {
  STATE.user = null;
  saveState();
  updateUserUI();
  navigate('home');
}

// EXP & Progress Management
function addExp(amount) {
  STATE.progress.exp += amount;
  const newLevel = Math.floor(STATE.progress.exp / 100) + 1;
  STATE.progress.level = newLevel;
  saveState();
  renderDashboard();
}

function completeModule(moduleId) {
  if (!STATE.progress.completedModules.includes(moduleId)) {
    STATE.progress.completedModules.push(moduleId);
    saveState();
  }
}

// Dashboard View Logic
function renderDashboard() {
  updateUserUI();

  const level = STATE.progress.level || 1;
  const exp = STATE.progress.exp || 0;
  const expForNextLevel = level * 100;
  const currentLevelExp = exp % 100;
  const percent = Math.min(100, Math.round((currentLevelExp / 100) * 100));

  const levelNumEl = document.getElementById('dash-level-num');
  const expTextEl = document.getElementById('dash-exp-text');
  const expBarEl = document.getElementById('dash-exp-bar');

  if (levelNumEl) levelNumEl.textContent = `Lv.${level}`;
  if (expTextEl) expTextEl.textContent = `${currentLevelExp} / 100 EXP (总计 ${exp})`;
  if (expBarEl) expBarEl.style.width = `${percent}%`;

  renderActivityChart();
}

function renderActivityChart() {
  const chartEl = document.getElementById('activity-chart-svg');
  if (!chartEl) return;

  const data = [
    { day: '周一', score: 20 },
    { day: '周二', score: 45 },
    { day: '周三', score: 30 },
    { day: '周四', score: 60 },
    { day: '周五', score: 80 },
    { day: '周六', score: 70 },
    { day: '周日', score: 90 },
  ];

  const width = 600;
  const height = 200;
  const paddingX = 40;
  const paddingY = 30;

  const maxScore = 100;
  const stepX = (width - paddingX * 2) / (data.length - 1);

  const points = data.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = height - paddingY - (d.score / maxScore) * (height - paddingY * 2);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  let dotsHtml = '';
  let labelsHtml = '';

  points.forEach((p) => {
    dotsHtml += `
      <circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="4.5">
        <title>${p.day}: ${p.score} 分</title>
      </circle>
    `;
    labelsHtml += `
      <text x="${p.x}" y="${height - 8}" text-anchor="middle">${p.day}</text>
    `;
  });

  chartEl.innerHTML = `
    <defs>
      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    <!-- Background Grid Lines -->
    <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" stroke="#f1f5f9" stroke-dasharray="4"/>
    <line x1="${paddingX}" y1="${height / 2}" x2="${width - paddingX}" y2="${height / 2}" stroke="#f1f5f9" stroke-dasharray="4"/>
    <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="#e2e8f0"/>

    <!-- Chart Fill & Line -->
    <path class="chart-area" d="${areaD}"/>
    <path class="chart-line" d="${pathD}"/>

    <!-- Points & Labels -->
    ${dotsHtml}
    <g class="chart-axis">${labelsHtml}</g>
  `;
}

// Course View Logic
function renderCourse() {
  const completed = STATE.progress.completedModules || [];
  const modules = [
    { id: 'm1', title: '破冰与自我介绍', duration: '15 mins', type: 'vocab', locked: false },
    { id: 'm2', title: '主持英文例会', duration: '25 mins', type: 'speaking', locked: false },
    { id: 'm3', title: '商务邮件撰写规范', duration: '20 mins', type: 'grammar', locked: false },
    { id: 'm4', title: '听懂带口音的客户', duration: '30 mins', type: 'listening', locked: true },
    { id: 'm5', title: '谈判技巧与妥协', duration: '40 mins', type: 'speaking', locked: true },
  ];

  const listEl = document.getElementById('course-module-list');
  if (!listEl) return;

  listEl.innerHTML = modules.map((mod, index) => {
    const isCompleted = completed.includes(mod.id);
    const prevCompleted = index === 0 || completed.includes(modules[index - 1].id);
    const isLocked = mod.locked && !prevCompleted;

    let statusClass = '';
    let iconSvg = '';
    let btnText = '';

    if (isCompleted) {
      statusClass = 'completed';
      iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="22" height="22"><polyline points="20 6 9 17 4 12"/></svg>`;
      btnText = '<span style="color:#10b981;font-weight:600;font-size:13px">已完成 ✓</span>';
    } else if (isLocked) {
      statusClass = 'locked';
      iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
      btnText = '<span style="color:#94a3b8;font-size:13px">解锁前序</span>';
    } else {
      iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      btnText = `<button class="btn btn-primary" style="padding:8px 16px;font-size:13px">开始学习</button>`;
    }

    return `
      <div class="module-card ${statusClass}" onclick="handleModuleClick('${mod.id}', '${mod.type}', ${isLocked})">
        <div class="module-left">
          <div class="module-icon-box">${iconSvg}</div>
          <div>
            <div class="module-title">${index + 1}. ${mod.title}</div>
            <div class="module-info">
              <span class="module-type-badge">${mod.type}</span>
              <span>·</span>
              <span>${mod.duration}</span>
            </div>
          </div>
        </div>
        <div>${btnText}</div>
      </div>
    `;
  }).join('');
}

function handleModuleClick(id, type, isLocked) {
  if (isLocked) {
    showToast('请先完成前置模块后再解锁此内容！');
    return;
  }
  navigate('learn');
}

// Learn / Flashcard Logic
function resetLearnSession() {
  STATE.learnIndex = 0;
  STATE.isFlipped = false;
  STATE.sessionCompleted = false;
  document.getElementById('learn-session-active').style.display = 'block';
  document.getElementById('learn-session-complete').style.display = 'none';
  renderFlashcard();
}

function renderFlashcard() {
  const card = STATE.flashcards[STATE.learnIndex];
  const cardEl = document.getElementById('flashcard');
  const wordEl = document.getElementById('card-word');
  const transEl = document.getElementById('card-translation');
  const exampleEl = document.getElementById('card-example');
  const nextBtn = document.getElementById('next-card-btn');

  STATE.isFlipped = false;
  if (cardEl) cardEl.classList.remove('flipped');

  if (wordEl) wordEl.textContent = card.word;
  if (transEl) transEl.textContent = card.translation;
  if (exampleEl) exampleEl.textContent = `"${card.example}"`;

  // Update indicators
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById(`step-dot-${i}`);
    if (dot) {
      dot.className = 'step-dot';
      if (i < STATE.learnIndex) dot.classList.add('passed');
      else if (i === STATE.learnIndex) dot.classList.add('active');
    }
  }

  // Next button status
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.5';
    nextBtn.textContent = STATE.learnIndex === STATE.flashcards.length - 1 ? '完成学习' : '下一个单词';
  }
}

// 翻转动画时长为 0.6s，期间忽略重复触发，避免快速点击导致状态与动画错位
const FLIP_LOCK_MS = 650;
let lastFlipAt = 0;
function toggleCardFlip() {
  const now = Date.now();
  if (now - lastFlipAt < FLIP_LOCK_MS) return;
  lastFlipAt = now;

  const cardEl = document.getElementById('flashcard');
  STATE.isFlipped = !STATE.isFlipped;
  if (cardEl) {
    cardEl.classList.toggle('flipped', STATE.isFlipped);
  }

  const nextBtn = document.getElementById('next-card-btn');
  if (nextBtn && STATE.isFlipped) {
    nextBtn.disabled = false;
    nextBtn.style.opacity = '1';
  }
}

function nextCard() {
  if (!STATE.isFlipped || STATE.sessionCompleted) return;

  if (STATE.learnIndex < STATE.flashcards.length - 1) {
    STATE.learnIndex++;
    renderFlashcard();
  } else {
    // Complete session（sessionCompleted 防止重复点击重复加经验）
    STATE.sessionCompleted = true;
    document.getElementById('learn-session-active').style.display = 'none';
    document.getElementById('learn-session-complete').style.display = 'block';
    addExp(50);
    completeModule('m1');
  }
}

function speakCurrentWord(e) {
  if (e) e.stopPropagation();
  const card = STATE.flashcards[STATE.learnIndex];
  if (!card) return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    showToast('当前浏览器不支持语音朗读');
    return;
  }
  try {
    window.speechSynthesis.cancel(); // 打断上一条朗读，避免排队堆积
    const utterance = new SpeechSynthesisUtterance(card.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis failed', err);
    showToast('语音朗读暂不可用');
  }
}

// Community Logic
function renderCommunity() {
  const feedEl = document.getElementById('community-feed');
  if (!feedEl) return;

  feedEl.innerHTML = STATE.posts.map(post => {
    const safeAuthor = escapeHTML(post.author);
    const safeContent = escapeHTML(post.content);
    const safeTime = escapeHTML(post.time);
    // src 属性同样需要转义；头像先经白名单校验
    const safeAvatar = escapeHTML(ensureAvatar(post.avatar, post.author));

    return `
    <div class="post-card">
      <div class="post-header">
        <img class="user-avatar" src="${safeAvatar}" alt="${safeAuthor}">
        <div>
          <div style="font-weight:700;font-size:14px">${safeAuthor}</div>
          <div style="font-size:12px;color:var(--text-light)">${safeTime}</div>
        </div>
      </div>
      <div class="post-content">${safeContent}</div>
      <div class="post-actions">
        <button class="action-btn ${post.liked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
          <svg viewBox="0 0 24 24" fill="${post.liked ? '#ef4444' : 'none'}" stroke="${post.liked ? '#ef4444' : 'currentColor'}" stroke-width="2" width="16" height="16">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>${post.likes}</span>
        </button>
        <button class="action-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>${post.comments}</span>
        </button>
        <button class="action-btn" onclick="sharePost(${post.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span>分享</span>
        </button>
      </div>
    </div>
  `;
  }).join('');
}

function submitNewPost() {
  const textarea = document.getElementById('new-post-content');
  if (!textarea || !textarea.value.trim()) return;

  const content = textarea.value.trim().slice(0, 500);
  const authorName = STATE.user ? STATE.user.name : '学员';
  const avatarUrl = STATE.user ? STATE.user.avatar : getAvatarSvg('Guest');

  const newPost = {
    id: Date.now(),
    author: authorName,
    avatar: avatarUrl,
    content: content,
    likes: 1,
    comments: 0,
    time: '刚刚',
    liked: true,
  };

  STATE.posts.unshift(newPost);
  saveState();
  textarea.value = '';
  renderCommunity();
}

function toggleLike(id) {
  const post = STATE.posts.find(p => p.id === id);
  if (!post) return;
  post.liked = !post.liked;
  post.likes += post.liked ? 1 : -1;
  saveState();
  renderCommunity();
}

// 剪贴板：优先 Clipboard API，失败或不可用时降级为 execCommand('copy')
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  ta.remove();
  return ok;
}

function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => legacyCopy(text));
  }
  return Promise.resolve(legacyCopy(text));
}

function sharePost(id) {
  copyToClipboard(window.location.href).then(ok => {
    showToast(ok ? '链接已复制到剪贴板！' : '复制失败，请手动复制地址栏中的链接');
  });
}

// 站内非阻塞提示（替代 alert）：单例节点，重复调用会覆盖文案并重置计时
let toastTimer = null;
function showToast(message) {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.className = 'toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 2600);
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  updateUserUI();

  // Route listening
  window.addEventListener('hashchange', handleHashChange);
  navigate(normalizeRoute(window.location.hash));

  // 键盘可达：challenge-card 与闪卡响应 Enter / Space（事件委托，单次注册）
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches('.challenge-card, .flashcard')) return;
    e.preventDefault();
    el.click();
  });

  // Login name input preview
  const loginInput = document.getElementById('login-name-input');
  const loginAvatar = document.getElementById('login-preview-avatar');
  if (loginInput && loginAvatar) {
    loginAvatar.src = getAvatarSvg('Guest');
    loginInput.addEventListener('input', (e) => {
      const val = e.target.value.trim() || 'Guest';
      loginAvatar.src = getAvatarSvg(val);
    });
  }
});
