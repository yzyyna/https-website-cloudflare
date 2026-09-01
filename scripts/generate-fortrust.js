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

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function scan(dir, relativeParts = []) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !IGNORE_DIRS.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

  const nodes = [];
  const rootDirectFiles = [];

  // 如果是在 fortrust/ 根目录，检查是否有直接放置的独立 .html 文件
  if (relativeParts.length === 0) {
    const directHtmls = entries
      .filter(e => e.isFile() && !IGNORE_FILES.has(e.name) && /\.(html|htm)$/i.test(e.name))
      .map(e => {
        const filePath = path.join(dir, e.name);
        const stat = fs.statSync(filePath);
        return {
          fileName: e.name,
          title: e.name.replace(/\.(html|htm)$/i, ''),
          url: encodePath([], e.name),
          size: formatSize(stat.size),
          mtime: stat.mtime.toISOString().split('T')[0],
          isIndex: false
        };
      });

    if (directHtmls.length > 0) {
      nodes.push({
        name: '独立页面 / 单文件原型',
        path: '/fortrust/',
        url: directHtmls[0].url,
        hasIndex: false,
        files: directHtmls,
        children: []
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const abs = path.join(dir, entry.name);
    const parts = [...relativeParts, entry.name];

    // 读取该目录下的所有 .html / .htm 文件
    const subEntries = fs.readdirSync(abs, { withFileTypes: true })
      .filter(e => !IGNORE_DIRS.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

    const htmlFiles = subEntries
      .filter(e => e.isFile() && /\.(html|htm)$/i.test(e.name))
      .map(e => {
        const filePath = path.join(abs, e.name);
        const stat = fs.statSync(filePath);
        const isIndex = e.name.toLowerCase() === 'index.html';
        const title = isIndex ? '首页 (index.html)' : e.name.replace(/\.(html|htm)$/i, '');
        return {
          fileName: e.name,
          title,
          url: encodePath(parts, e.name),
          size: formatSize(stat.size),
          mtime: stat.mtime.toISOString().split('T')[0],
          isIndex
        };
      });

    const hasIndex = htmlFiles.some(f => f.isIndex);
    const children = scan(abs, parts);

    const node = {
      name: entry.name,
      path: encodePath(parts),
      url: hasIndex ? encodePath(parts) : (htmlFiles.length ? htmlFiles[0].url : null),
      hasIndex,
      files: htmlFiles,
      children
    };

    // 只要包含 html 文件或者包含有效子目录，就纳入展示
    if (node.files.length > 0 || node.children.length > 0) {
      nodes.push(node);
    }
  }

  return nodes;
}

if (!fs.existsSync(ROOT)) {
  throw new Error(`目录不存在: ${ROOT}`);
}

const tree = scan(ROOT);
const outputData = {
  buildTime: new Date().toISOString(),
  data: tree
};

fs.writeFileSync(OUTPUT, JSON.stringify(outputData, null, 2), 'utf8');

console.log(`Fortrust directory generated: ${OUTPUT}`);
console.log(`Top-level items: ${tree.length}`);
