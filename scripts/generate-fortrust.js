const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'fortrust');
const OUTPUT = path.join(ROOT, 'directory.json');
const IGNORE_DIRS = new Set(['.git', '.github', 'node_modules', '.DS_Store']);
const IGNORE_FILES = new Set(['index.html', 'directory.json', '.DS_Store', 'README.md', 'Thumbs.db', 'package.json']);

const ALLOWED_EXTS = new Set([
  // 网页（新标签页打开）
  '.html', '.htm',
  // 可预览文档/媒体（弹窗直接预览）
  '.pdf', '.md', '.txt',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  '.mp4', '.webm', '.mp3',
  // 需下载文档/附件（直接启动下载）
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.zip', '.rar', '.7z', '.tar', '.gz'
]);

function getFileType(ext) {
  ext = (ext || '').toLowerCase();
  const label = ext.replace(/^\./, '').toUpperCase() || 'FILE';
  if (['.html', '.htm'].includes(ext)) {
    return { category: 'html', label, icon: '📄', isHtml: true, actionType: 'new_tab' };
  }
  if (ext === '.pdf') {
    return { category: 'pdf', label, icon: '📕', isHtml: false, actionType: 'preview' };
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
    return { category: 'image', label, icon: '🖼️', isHtml: false, actionType: 'preview' };
  }
  if (['.mp4', '.webm'].includes(ext)) {
    return { category: 'video', label, icon: '🎬', isHtml: false, actionType: 'preview' };
  }
  if (ext === '.mp3') {
    return { category: 'audio', label, icon: '🎵', isHtml: false, actionType: 'preview' };
  }
  if (['.md', '.txt'].includes(ext)) {
    return { category: 'text', label, icon: '📃', isHtml: false, actionType: 'preview' };
  }
  if (['.docx', '.doc'].includes(ext)) {
    return { category: 'word', label, icon: '📝', isHtml: false, actionType: 'download' };
  }
  if (['.xlsx', '.xls'].includes(ext)) {
    return { category: 'excel', label, icon: '📊', isHtml: false, actionType: 'download' };
  }
  if (['.pptx', '.ppt'].includes(ext)) {
    return { category: 'ppt', label, icon: '📑', isHtml: false, actionType: 'download' };
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
    return { category: 'archive', label, icon: '📦', isHtml: false, actionType: 'download' };
  }
  return { category: 'file', label, icon: '📎', isHtml: false, actionType: 'download' };
}

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

  // 如果是在 fortrust/ 根目录，检查是否有直接放置的独立文件
  if (relativeParts.length === 0) {
    const directFiles = entries
      .filter(e => {
        if (!e.isFile() || IGNORE_FILES.has(e.name)) return false;
        const ext = path.extname(e.name).toLowerCase();
        return ALLOWED_EXTS.has(ext);
      })
      .map(e => {
        const filePath = path.join(dir, e.name);
        const stat = fs.statSync(filePath);
        const ext = path.extname(e.name);
        const typeInfo = getFileType(ext);
        return {
          fileName: e.name,
          title: e.name.replace(new RegExp(`\\${ext}$`, 'i'), ''),
          ext: ext.toLowerCase(),
          category: typeInfo.category,
          typeLabel: typeInfo.label,
          icon: typeInfo.icon,
          isHtml: typeInfo.isHtml,
          actionType: typeInfo.actionType,
          url: encodePath([], e.name),
          size: formatSize(stat.size),
          mtime: stat.mtime.toISOString().split('T')[0],
          isIndex: false
        };
      });

    if (directFiles.length > 0) {
      nodes.push({
        name: '独立文件 / 根目录资源',
        path: '/fortrust/',
        url: directFiles[0].url,
        hasIndex: false,
        files: directFiles,
        children: []
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const abs = path.join(dir, entry.name);
    const parts = [...relativeParts, entry.name];

    const subEntries = fs.readdirSync(abs, { withFileTypes: true })
      .filter(e => !IGNORE_DIRS.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

    const validFiles = subEntries
      .filter(e => {
        if (!e.isFile() || IGNORE_FILES.has(e.name)) return false;
        const ext = path.extname(e.name).toLowerCase();
        return ALLOWED_EXTS.has(ext);
      })
      .map(e => {
        const filePath = path.join(abs, e.name);
        const stat = fs.statSync(filePath);
        const ext = path.extname(e.name);
        const typeInfo = getFileType(ext);
        const isIndex = e.name.toLowerCase() === 'index.html';
        const title = isIndex ? '首页 (index.html)' : e.name.replace(new RegExp(`\\${ext}$`, 'i'), '');
        return {
          fileName: e.name,
          title,
          ext: ext.toLowerCase(),
          category: typeInfo.category,
          typeLabel: typeInfo.label,
          icon: typeInfo.icon,
          isHtml: typeInfo.isHtml,
          actionType: typeInfo.actionType,
          url: encodePath(parts, e.name),
          size: formatSize(stat.size),
          mtime: stat.mtime.toISOString().split('T')[0],
          isIndex
        };
      });

    const hasIndex = validFiles.some(f => f.isIndex);
    const children = scan(abs, parts);

    const node = {
      name: entry.name,
      path: encodePath(parts),
      url: hasIndex ? encodePath(parts) : (validFiles.length ? validFiles[0].url : null),
      hasIndex,
      files: validFiles,
      children
    };

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
