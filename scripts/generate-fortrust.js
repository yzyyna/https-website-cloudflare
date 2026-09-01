const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'fortrust');
const OUTPUT = path.join(ROOT, 'directory.json');
const IGNORE = new Set(['.git', '.github', 'node_modules', '.DS_Store']);

function encodePath(parts) {
  return '/fortrust/' + parts.map(encodeURIComponent).join('/') + '/';
}

function scan(dir, relativeParts = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !IGNORE.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  const nodes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const abs = path.join(dir, entry.name);
    const parts = [...relativeParts, entry.name];
    const hasIndex = fs.existsSync(path.join(abs, 'index.html'));

    const node = {
      name: entry.name,
      path: '/' + parts.map(encodeURIComponent).join('/') + '/',
      url: hasIndex ? encodePath(parts) : null,
      hasIndex,
      children: scan(abs, parts)
    };

    // 只有真正包含页面或子目录的目录才进入导航。
    if (node.hasIndex || node.children.length) nodes.push(node);
  }

  return nodes;
}

if (!fs.existsSync(ROOT)) {
  throw new Error(`目录不存在: ${ROOT}`);
}

const result = scan(ROOT);
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');

console.log(`Fortrust directory generated: ${OUTPUT}`);
console.log(`Top-level directories: ${result.length}`);
