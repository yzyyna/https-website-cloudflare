/**
 * 《404 之前：互联网考古馆》- 统一免依赖构建脚本
 * 将 ES 模块安全编译组装为单文件离线 bundle (app.bundle.js)
 *
 * 用法：node build.js          生成 app.bundle.js
 *       node build.js --check  仅校验产物是否与源码一致（不一致则非零退出）
 */

const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'js');
const outputPath = path.join(basePath, 'app.bundle.js');

// 打包顺序即执行顺序；新增或重命名 js/ 模块必须同步修改此清单
const SECTIONS = [
  { file: 'state.js', label: '状态管理' },
  { file: 'audio.js', label: '音频合成' },
  { file: 'navigation.js', label: '导航驱动' },
  { file: 'eggs.js', label: '彩蛋系统' },
  { file: 'eras/era-1998.js', label: '1998 拨号接入室' },
  { file: 'eras/era-2003.js', label: '2003 个人主页花园' },
  { file: 'eras/era-2008.js', label: '2008 深夜论坛' },
  { file: 'eras/era-2012.js', label: '2012 青春空间' },
  { file: 'eras/era-2024.js', label: '2024 算法走廊' },
  { file: 'eras/era-2099.js', label: '2099 网页遗址修复中心' },
  { file: 'app.js', label: '主程序启动' }
];

function collectSources(prefix = '') {
  return fs.readdirSync(path.join(basePath, prefix), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return collectSources(rel);
    return rel.endsWith('.js') && rel !== 'app.bundle.js' ? [rel] : [];
  });
}

function stripModuleSyntax(code) {
  return code
    .replace(/import\s+.*?;\n/g, '')
    .replace(/export\s+(const|class|function)\s+/g, '$1 ');
}

function buildBundle() {
  const listed = new Set(SECTIONS.map((section) => section.file));
  const unlisted = collectSources().filter((file) => !listed.has(file));
  if (unlisted.length) {
    throw new Error(`未登记到 build.js 的 js 模块，请加入 SECTIONS：${unlisted.join(', ')}`);
  }

  const body = SECTIONS.map(({ file, label }) => {
    const code = stripModuleSyntax(fs.readFileSync(path.join(basePath, file), 'utf8'));
    return `  // === ${label} (${path.basename(file)}) ===\n  ${code}`;
  }).join('\n\n');

  return `(() => {\n  "use strict";\n${body}\n})();`;
}

function main() {
  const bundled = buildBundle();

  if (process.argv.includes('--check')) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (current !== bundled) {
      console.error('app.bundle.js 已过期，请运行 node internet-museum/build.js');
      process.exit(1);
    }
    console.log('internet-museum 产物与源码一致');
    return;
  }

  console.log('📦 正在从源码构建 app.bundle.js...');
  fs.writeFileSync(outputPath, bundled, 'utf8');
  console.log(`✅ 构建成功！产物已输出至: ${outputPath} (${bundled.length} 字节)`);
}

main();
