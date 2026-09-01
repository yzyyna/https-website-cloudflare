const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'fortrust');
const OUTPUT = path.join(ROOT, 'directory.json');
const IGNORE_DIRS = new Set(['.git', '.github', 'node_modules', '.DS_Store']);
const IGNORE_FILES = new Set(['index.html', 'directory.json', '.DS_Store', 'README.md', 'Thumbs.db']);

function encodePath(parts, fileName = '') {
  const segs = ['fortrust', ...parts];
  if (fileName) {
    segs.push(fileName);
    return '/' + segs.map(encodeURIComponent).join('/');
  }
  return '/' + segs.map(encodeURIComponent).join('/') + '/';
}

function scan(dir, relativeParts = []) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !IGNORE_DIRS.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  const nodes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const abs = path.join(dir, entry.name);
    const parts = [...relativeParts, entry.name];

    // 读取该目录下的所有 .html 文件
    const subEntries = fs.readdirSync(abs, { withFileTypes: true })
      .filter(e => !IGNORE_DIRS.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    const htmlFiles = subEntries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.html'))
      .map(e => {
        const isIndex = e.name.toLowerCase() === 'index.html';
        const title = isIndex ? '首页 (index.html)' : e.name.replace(/\.html$/i, '');
        return {
          fileName: e.name,
          title,
          url: encodePath(parts, e.name),
          isIndex
        };
      });

    const hasIndex = htmlFiles.some(f => f.isIndex);
    const children = scan(abs, parts);

    const node = {
      name: entry.name,
      path: '/' + parts.map(encodeURIComponent).join('/') + '/',
      url: hasIndex ? encodePath(parts) : (htmlFiles.length ? htmlFiles[0].url : null),
      hasIndex,
      files: htmlFiles,
      children
    };

    // 只要包含 html 文件或者有包含内容的子目录，就纳入展示
    if (node.files.length > 0 || node.children.length > 0) {
      nodes.push(node);
    }
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

