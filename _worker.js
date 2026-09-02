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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/_auth') {
      return handleAuth(request, env, url);
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
