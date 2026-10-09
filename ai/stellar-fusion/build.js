#!/usr/bin/env node
'use strict';

// 将 src/core.js 注入各版本外壳，生成自包含的 index.html。
// 用法：node build.js          生成并写入
//       node build.js --check  仅校验生成物是否与源码一致（不一致则非零退出）

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MARKER = '<!--STELLAR_SCRIPT-->';
const CORE = 'src/core.js';

const TARGETS = [
  {
    shell: 'src/shells/gemini.html',
    out: 'gemini/index.html',
    brand: { coreName: 'HELIOS-X CORE', gpuFallback: 'WebGL2 Hardware Renderer' }
  },
  {
    shell: 'src/shells/musespark.html',
    out: 'musespark/index.html',
    brand: { coreName: 'HELIOS-7 CORE', gpuFallback: 'WebGL2 renderer' }
  },
  {
    shell: 'src/shells/IndexGLM.html',
    out: 'musespark/IndexGLM.html',
    brand: { coreName: 'HELIOS-7 CORE', gpuFallback: 'WebGL2 renderer' }
  }
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function render(target, core) {
  const shell = read(target.shell);
  if (!shell.includes(MARKER)) throw new Error(`${target.shell} 缺少标记 ${MARKER}`);
  const script = `<script>\nconst BRAND = ${JSON.stringify(target.brand)};\n${core}</script>`;
  return shell.replace(MARKER, () => script);
}

function main() {
  const check = process.argv.includes('--check');
  const core = read(CORE);
  const stale = [];

  for (const target of TARGETS) {
    const html = render(target, core);
    const outPath = path.join(ROOT, target.out);
    if (check) {
      const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
      if (current !== html) stale.push(target.out);
    } else {
      fs.writeFileSync(outPath, html);
      console.log(`built ${target.out}`);
    }
  }

  if (check) {
    if (stale.length) {
      console.error(`生成物过期，请运行 node stellar-fusion/build.js：${stale.join(', ')}`);
      process.exit(1);
    }
    console.log('stellar-fusion 生成物与源码一致');
  }
}

main();
