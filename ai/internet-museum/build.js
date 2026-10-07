/**
 * 《404 之前：互联网考古馆》- 统一免依赖构建脚本
 * 将 ES 模块安全编译组装为单文件离线 bundle (app.bundle.js)
 */

const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'js');

console.log('📦 正在从源码构建 app.bundle.js...');

const stateCode = fs.readFileSync(path.join(basePath, 'state.js'), 'utf8')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ');

const audioCode = fs.readFileSync(path.join(basePath, 'audio.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ');

const navCode = fs.readFileSync(path.join(basePath, 'navigation.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ');

const eggsCode = fs.readFileSync(path.join(basePath, 'eggs.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ');

const era1998 = fs.readFileSync(path.join(basePath, 'eras/era-1998.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+function\s+/g, 'function ');

const era2003 = fs.readFileSync(path.join(basePath, 'eras/era-2003.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+function\s+/g, 'function ');

const era2008 = fs.readFileSync(path.join(basePath, 'eras/era-2008.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+function\s+/g, 'function ');

const era2012 = fs.readFileSync(path.join(basePath, 'eras/era-2012.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+function\s+/g, 'function ');

const era2024 = fs.readFileSync(path.join(basePath, 'eras/era-2024.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+function\s+/g, 'function ');

const era2099 = fs.readFileSync(path.join(basePath, 'eras/era-2099.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '')
  .replace(/export\s+function\s+/g, 'function ');

const appCode = fs.readFileSync(path.join(basePath, 'app.js'), 'utf8')
  .replace(/import\s+.*?;\n/g, '');

const bundled = `(() => {
  "use strict";
  // === 状态管理 (state.js) ===
  ${stateCode}

  // === 音频合成 (audio.js) ===
  ${audioCode}

  // === 导航驱动 (navigation.js) ===
  ${navCode}

  // === 彩蛋系统 (eggs.js) ===
  ${eggsCode}

  // === 1998 拨号接入室 (era-1998.js) ===
  ${era1998}

  // === 2003 个人主页花园 (era-2003.js) ===
  ${era2003}

  // === 2008 深夜论坛 (era-2008.js) ===
  ${era2008}

  // === 2012 青春空间 (era-2012.js) ===
  ${era2012}

  // === 2024 算法走廊 (era-2024.js) ===
  ${era2024}

  // === 2099 网页遗址修复中心 (era-2099.js) ===
  ${era2099}

  // === 主程序启动 (app.js) ===
  ${appCode}
})();`;

const outputPath = path.join(basePath, 'app.bundle.js');
fs.writeFileSync(outputPath, bundled, 'utf8');
console.log(`✅ 构建成功！产物已输出至: ${outputPath} (${bundled.length} 字节)`);
