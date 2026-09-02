/**
 * Cloudflare Pages Advanced Mode Worker
 *
 * 对 /fortrust/* 提供服务端密码门（真实防护直链访问），
 * 其余路径（如根 landing page）直接透传静态资源。
 *
 * 可选环境变量（Dashboard → Pages 项目 → Settings → Environment variables）：
 *   AUTH_PASSWORD  自定义访问密码（设置后下方默认密码列表失效）
 *   AUTH_SECRET    Cookie 签名密钥（强烈建议设置；未设置时使用内置回退值，
 *                  公开仓库中回退值可被推算，设置后 Cookie 不可伪造）
 *
 * 默认访问密码：fortrust / fortrust2026 / fortrust888
 * 源码中仅存 SHA-256 哈希，不存明文。
 */

const PASSWORD_HASHES = new Set([
  '9fcf7d4dd3fb0caa2075c4ee18f58eea9cd7880506baf304661adce1bd0d14e2',
  'c5cd5203f92554630e21fb3ed1767107594875f2e0d20a151a267637d48860a9',
  '026ac107c02278c84985606fb002cc47801e6a4db00afdb02536e9af75643875'
]);

const COOKIE_NAME = 'ft_auth';
const TTL_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function getSecret(env) {
  return env.AUTH_SECRET || 'ft-fallback::' + [...PASSWORD_HASHES].join('|');
}

function getPasswordHashes(env) {
  // 环境变量密码优先；注意 Workers 中 env 每请求注入，此处按需计算
  return env.AUTH_PASSWORD ? [env.AUTH_PASSWORD] : null;
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

// 防开放重定向：仅允许站内相对路径
function safeNext(raw, fallback) {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return fallback;
}

function loginPage(error, next) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🔐 请输入访问密钥</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#0f172a;
}
.box{background:#fff;border-radius:18px;width:min(440px,100%);padding:36px 32px;text-align:center;
  box-shadow:0 25px 50px -12px rgba(0,0,0,.45);animation:fade .25s cubic-bezier(.16,1,.3,1)}
@keyframes fade{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}
h2{font-size:20px;font-weight:800;margin:0 0 22px;letter-spacing:-.02em}
input{width:100%;padding:13px 16px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;
  outline:none;background:#f8fafc;transition:all .15s ease}
input:focus{background:#fff;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
.err{color:#ef4444;font-size:12px;font-weight:600;min-height:18px;margin:10px 0 4px}
button{width:100%;padding:13px;border:none;border-radius:10px;background:#2563eb;color:#fff;
  font-size:14px;font-weight:700;cursor:pointer;transition:background .15s ease}
button:hover{background:#1d4ed8}
</style>
</head>
<body>
<form method="POST" action="/_auth">
  <div class="box">
    <h2>🔐 请输入访问密钥</h2>
    <input type="password" name="password" placeholder="请输入访问密钥..." autocomplete="current-password" autofocus>
    <div class="err">${error}</div>
    <button type="submit">确认进入</button>
    <input type="hidden" name="next" value="${next}">
  </div>
</form>
</body>
</html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function isAuthed(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await sha256Hex(getSecret(env) + '.' + exp);
  return sig === expected;
}

async function handleAuth(request, env, url) {
  // 登出
  if (url.searchParams.has('logout')) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/fortrust/',
        'Set-Cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
      }
    });
  }
  if (request.method !== 'POST') {
    return loginPage('', '/fortrust/');
  }

  const form = await request.formData();
  const password = String(form.get('password') || '');
  const next = safeNext(String(form.get('next') || '/fortrust/'), '/fortrust/');

  const custom = getPasswordHashes(env);
  const inputHash = await sha256Hex(password);
  let matched;
  if (custom) {
    matched = inputHash === (await sha256Hex(custom[0]));
  } else {
    matched = PASSWORD_HASHES.has(inputHash);
  }

  if (!matched) {
    return loginPage('密钥错误，请重新输入', next);
  }

  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const sig = await sha256Hex(getSecret(env) + '.' + exp);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': next,
      'Set-Cookie': `${COOKIE_NAME}=${exp}.${sig}; Max-Age=${TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
    }
  });
}

// 浏览器原生无法渲染、需经查看器页面解析的文件扩展名
const VIEWER_EXTS = new Set(['.md', '.markdown', '.docx', '.xlsx', '.xls', '.txt']);

function viewerPage(targetUrl) {
  const safeTarget = JSON.stringify(targetUrl);
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>预览 · Fortrust 静态资源中心</title>
<style>
*{box-sizing:border-box}
body{margin:0;display:flex;flex-direction:column;min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  background:#f1f5f9;color:#1f2937}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 20px;background:#fff;border-bottom:1px solid #e2e8f0}
.title{font-size:15px;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.actions{display:flex;gap:8px;flex-shrink:0}
.btn{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;
  border:1px solid #e2e8f0;background:#fff;color:#475569}
.btn:hover{border-color:#2563eb;color:#2563eb}
main{flex:1;overflow:auto;padding:28px 32px;background:#fff}
.status{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  height:60vh;color:#64748b;font-size:14px}
.spinner{width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;
  animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* Markdown 渲染样式 */
.md h1,.md h2,.md h3,.md h4{color:#0f172a;line-height:1.3;margin:1.4em 0 .5em}
.md h1{font-size:26px;border-bottom:2px solid #e2e8f0;padding-bottom:8px}
.md h2{font-size:21px;border-bottom:1px solid #eef2f7;padding-bottom:6px}
.md h3{font-size:17px}
.md p{margin:.7em 0;line-height:1.75}
.md a{color:#2563eb}
.md code{background:#f1f5f9;border:1px solid #e2e8f0;padding:1px 6px;border-radius:4px;
  font-family:ui-monospace,Consolas,Menlo,monospace;font-size:13px;color:#dc2626}
.md pre{background:#0f172a;color:#f8fafc;padding:14px 16px;border-radius:8px;overflow:auto;margin:.8em 0}
.md pre code{background:none;border:none;color:inherit;padding:0}
.md blockquote{margin:.8em 0;padding:8px 16px;border-left:4px solid #93c5fd;background:#eff6ff;
  color:#334155;border-radius:0 6px 6px 0}
.md ul,.md ol{padding-left:1.6em}
.md table{border-collapse:collapse;margin:.9em 0}
.md th,.md td{border:1px solid #cbd5e1;padding:6px 12px;font-size:13px}
.md th{background:#f1f5f9}
.md img{max-width:100%}
.md hr{border:none;border-top:1px solid #e2e8f0;margin:1.5em 0}
/* Word 渲染样式 */
.word{line-height:1.8;font-size:15px}
.word h1,.word h2,.word h3{color:#0f172a;margin:1.2em 0 .5em}
.word table{border-collapse:collapse;margin:12px 0}
.word td,.word th{border:1px solid #cbd5e1;padding:6px 12px;font-size:13px;min-width:64px}
.word img{max-width:100%}
/* Excel 渲染样式 */
.sheet-tab{display:flex;gap:6px;padding:10px 0;overflow-x:auto}
.sheet-tab button{padding:6px 14px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;
  color:#475569;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.sheet-tab button.active{background:#2563eb;border-color:#2563eb;color:#fff}
.sheet{display:none}
.sheet.active{display:block}
.sheet table{border-collapse:collapse}
.sheet td,.sheet th{border:1px solid #cbd5e1;padding:6px 12px;font-size:13px;white-space:nowrap}
</style>
</head>
<body>
<header>
  <div class="title" id="docTitle">加载中…</div>
  <div class="actions">
    <a class="btn" id="dlBtn" download>下载 ⤓</a>
  </div>
</header>
<main><div class="status"><div class="spinner"></div><div>正在加载预览…</div></div></main>
<script>
const TARGET = ${safeTarget};
const name = decodeURIComponent(TARGET.split('/').pop() || '');
document.getElementById('docTitle').textContent = name;
const dl = document.getElementById('dlBtn');
dl.href = TARGET;
dl.setAttribute('download', name);

const ext = (name.match(/\\.[^.]+$/) || [''])[0].toLowerCase();
const main = document.querySelector('main');
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function loadScript(src, check) {
  if (check()) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => check() ? res() : rej(new Error('lib init failed'));
    s.onerror = () => rej(new Error('lib load failed'));
    document.head.appendChild(s);
  });
}

async function render() {
  try {
    if (ext === '.md' || ext === '.markdown') {
      const txt = await (await fetch(TARGET)).text();
      await loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js', () => window.marked);
      main.innerHTML = '<div class="md">' + marked.parse(txt, { breaks: true, gfm: true }) + '</div>';
    } else if (ext === '.docx') {
      const buf = await (await fetch(TARGET)).arrayBuffer();
      await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js', () => window.mammoth);
      const r = await window.mammoth.convertToHtml({ arrayBuffer: buf });
      main.innerHTML = '<div class="word">' + (r.value || '<p style="color:#94a3b8">此 Word 文档为空</p>') + '</div>';
    } else if (ext === '.xlsx' || ext === '.xls') {
      const buf = await (await fetch(TARGET)).arrayBuffer();
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX);
      const wb = window.XLSX.read(buf, { type: 'array' });
      const tabs = wb.SheetNames.map((n, i) =>
        '<button class="' + (i === 0 ? 'active' : '') + '" data-i="' + i + '">' + esc(n) + '</button>').join('');
      const panes = wb.SheetNames.map((n, i) => {
        const html = window.XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' });
        return '<div class="sheet ' + (i === 0 ? 'active' : '') + '" data-i="' + i + '">' + html + '</div>';
      }).join('');
      main.innerHTML =
        '<div class="sheet-tab">' + tabs + '</div>' + panes;
      main.querySelectorAll('.sheet-tab button').forEach(b => b.addEventListener('click', () => {
        main.querySelectorAll('.sheet').forEach(p => p.classList.toggle('active', p.dataset.i === b.dataset.i));
        main.querySelectorAll('.sheet-tab button').forEach(x => x.classList.toggle('active', x === b));
      }));
    } else {
      const txt = await (await fetch(TARGET)).text();
      main.innerHTML = '<pre style="background:#0f172a;color:#f8fafc;padding:20px;border-radius:8px;' +
        'overflow:auto;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all">' + esc(txt) + '</pre>';
    }
  } catch (e) {
    main.innerHTML = '<div class="status"><div style="font-size:32px">😵</div>' +
      '<div>预览加载失败，请尝试下载后查看</div></div>';
  }
}
render();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/_auth') {
      return handleAuth(request, env, url);
    }

    // 新标签页查看器：受密码保护，将不可原生预览的文件渲染为网页
    if (path === '/_view') {
      if (!(await isAuthed(request, env))) {
        return loginPage('', '/fortrust/');
      }
      const target = safeNext(url.searchParams.get('u') || '', '/fortrust/');
      const ext = (target.match(/\.([^./]+)$/i) || [''])[0].toLowerCase();
      if (!target.startsWith('/fortrust/') || !VIEWER_EXTS.has(ext)) {
        // 非查看器类型直接回到原文件（浏览器可原生预览）
        return new Response(null, { status: 302, headers: { 'Location': target } });
      }
      return viewerPage(target);
    }

    // 受保护区：/fortrust 及其下所有资源（含 directory.json、原型、文档）
    if (path === '/fortrust' || path.startsWith('/fortrust/')) {
      if (!(await isAuthed(request, env))) {
        return loginPage('', path + url.search);
      }
    }

    // 其余请求透传静态资源
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return fetch(request);
  }
};
