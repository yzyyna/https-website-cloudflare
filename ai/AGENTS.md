# AItestProjects 项目规范与开发守则

> 全部子应用的统一开发约束，任何会话开工前必读。第 2 节「双仓同步红线」为最高优先级：任何改动（含文档）验证通过后必须立即同步，不得拖延。

## 1. 核心架构原则

- **纯原生免构建**：只用 HTML5 + CSS3 + 原生 JS/WebGL；禁止 Webpack/Vite/npm/node_modules 及重型外置框架；双击 `index.html` 或经任意静态服务须 100% 离线流畅运行。
- **零外部资产**：禁 CDN、外部字体、外链图片/音频、第三方在线接口（含头像/图表/特效类 API）；素材一律程序化生成或内联（Canvas 贴图、Web Audio 合成、内联 SVG/Data URI）。
- **多模型归并**：同 Prompt 的多模型产物在子目录独立保留对比版本，主入口提供切换对比能力。
- **优雅降级**：WebGL 获取失败、localStorage 不可用（隐私模式）、AudioContext 受限等必须降级（提示面板/内存兜底/纯文字流程），禁止未捕获异常导致白屏。

## 2. 双仓同步与联动提交（最高优先级红线）

- **同步目标**：`/Users/fortrust/Documents/Projects/gitee/https-website-cloudflare/ai`；本项目为源头开发仓库。
- **实时同步**：任何改动（功能、Bug、样式、重构、文档、加文件）完成并验证后，必须立即完整同步；标准指令 `scripts/sync-mirror.sh --dry-run`（预览）→ `scripts/sync-mirror.sh`（同步并自动核对）。等价于 `rsync -av --delete --exclude=.git --exclude=.DS_Store --exclude=.claude --exclude=.zcode --exclude=.trae --exclude=scripts <源>/ <镜像>/`。
- **联动提交**：用户要求提交本项目时，必须同时同步镜像目录并在 `https-website-cloudflare` 仓库执行提交（`cd <镜像仓库> && git add ai/ && git commit`），保持两仓提交历史与代码状态严格对齐；提交信息语义对应——源仓用具体 scope，镜像仓统一 `feat(ai): 同步 …` / `fix(ai): 同步 …`。
- **同步后核对**：`diff -rq` 确保两仓 100% 一致。
- **提交纪律**：提交前两仓均 `git status` 核对改动范围与主题一致；禁止 `git commit -a` 盲提交，禁止混入无关改动。
- **提交后汇报红线**：每次提交并推送后，必须立即向用户输出「分批提交与推送记录」，不得只回「已推送」。固定模板（多批逐行列出）：

  | 批次 | 源仓提交 | 镜像仓联动提交 |
  |---|---|---|
  | 1 | `<短哈希>` `<type>(<scope>): <中文提交信息>` | `<短哈希>` `<type>(ai): 同步 …` |

  表后必附三条核验要点：① 源仓已推送至 `<源仓远程地址>`（master）；② 镜像仓已推送至 `<镜像仓远程地址>`（master）；③ 提交前已运行 `sync-mirror.sh` 并以 `diff -rq` 核验两仓 100% 一致，两仓 `git status` 状态（若有遗留未提交改动，须如实注明归属与处理方式）。
- **排除项**：`.git` / `.DS_Store` / `.claude` / `.zcode` / `.trae` / `scripts/` 有意不同步（本地工具配置与开发脚本不进部署仓；`.trae` 源仓有 Git 跟踪但同步时排除）。

## 3. 运行方式与校验

- 根目录：门户 `index.html`、`README.md`、本文件、`LICENSE`（Apache 2.0）、`KNOWN_ISSUES.md`、`scripts/`（`check.sh` 提交前校验、`sync-mirror.sh` 同步；两者不同步镜像）。
- **双击运行是首要验证路径**，由此三条硬约束：① 禁止浏览器直接加载 ES Module（`file://` 被 CORS 拦截），需模块化必须提供打包脚本产出普通 `<script>`（参考 `internet-museum/build.js`）；② 禁止 `fetch`/XHR 读取本地文件；③ 禁止任何外部网络请求。
- **提交前校验**：`scripts/check.sh`——只查本次改动的 `.js`/`.html` 语法 + `internet-museum`/`stellar-fusion` 的 `build.js --check` 产物新鲜度 + 涉及项目的单元测试（如 `cyber-potato/test.js`），不做全项目扫描（禁全量 ESLint/tsc）。
- 本地静态服务（可选）：根目录 `python3 -m http.server 8080`，访问 `http://localhost:8080/<子目录>/`。
- 浏览器基线：Chrome/Edge/Safari/Firefox 现代版；移动端兼顾 iOS Safari 与 Android Chrome。

## 4. 子项目清单与维护要点

| 目录 | 项目 | 核心技术 | 关键结构 / 维护要点 |
|---|---|---|---|
| `block-game` | 体素方块 3D 沙盒 | WebGL 1.0 + 区块化剔除 + 双通道光照 + 昼夜循环 + 物理防穿透 | 15 个普通 `<script>` 按依赖序加载（全局 `MC`）；新增模块须同步 `index.html` 引入顺序 |
| `cyber-potato` | 赛博电子土豆 | 像素宠物 + 状态机离线推演 + Web Audio | `js/` 五个普通模块；CSS 分 style/potato/anim 三层 |
| `internet-museum` | 互联网考古馆 | 1998~2099 展厅 + 纯代码拨号音效 + 遗迹修复与 6 彩蛋 | ES Module 源码在 `js/`、`js/eras/`；交付物 `js/app.bundle.js` 由 `build.js` 生成 |
| `iot-hub` | 实时数据调度控制台 | 5 万级设备虚拟列表 + 命令模式 Undo/Redo | 单文件 `index.html`（约 1.1k 行） |
| `learn-lang` | 多语种学习平台 | 3D 翻转闪卡 + 本地纯 SVG 动态头像 + 活跃度图表 | `index.html` + `js/app.js` + `css/style.css`；hash 路由六视图 SPA |
| `stellar-fusion` | 3D 星际能源监控中心 | WebGL2 + 多模型（Gemini/GLM/MuseSpark）归并对照 | 共享内核 `src/core.js` + 页面壳 `src/shells/`，`build.js` 生成三份单文件（生成物勿手改）；聚合页 iframe 切换预览 |
| `tank-battle` | 3D 坦克大战进化版 | WebGL 1.0 + 多视角 + 5 大关卡/泰坦 BOSS + 合成音效 | 单文件 `index.html`（约 3.7k 行，10 个编号逻辑区） |
| `cell-defense` | 细胞防线：微观免疫战 | Canvas 2D + 阿米巴软体物理 + 吞噬消化 + 基因融合 + 血液微流控 | 5 个普通 `<script>` 按依赖序加载（全局解耦）；双击即玩 |
| `loop-heist` | 时光回放小偷 | 回合制潜行 + 循环录像幽灵 + Canvas 2D + 合成音效 | `js/levels.js`→`sim.js`→`audio.js`→`render.js`→`main.js`；`node loop-heist/test.js` 内核单测 |
| `pelican-bicycle` | 鹈鹕踩单车六模型对标 | 同题 Prompt + 六版独立单文件 + 盲评聚合 | `index.html` 聚合页（iframe 切换 / 盲评评分 / localStorage）；六个 `<模型>/index.html` 为各模型原始产出，**手改会破坏对标公平性**，仅修兼容 Bug 并注明 |

## 5. 新子应用接入（按序完成，缺一不可）

1. 独立子目录 + 自包含入口 `index.html` + 子项目 `README.md`（运行方式、操作、技术要点、已知限制）。
2. 资产合规：遵守第 1 节零外链、全程序化或内联。
3. favicon：内联 SVG Data URI 或本地 `favicon.svg`。
4. 移动端：`viewport-fit=cover`、安全区 `env(safe-area-inset-*)`、可点击目标 ≥44px；需要时加 PWA 元数据与触觉反馈。
5. 门户注册：根 `index.html` 新增卡片，`data-category` ∈ `webgl`/`interactive`/`productivity`，链接指向子目录。
6. 总览维护：更新根 `README.md` 总览表与本文件第 4 节。
7. 同步收尾：执行第 2 节同步流程并核对差异。

## 6. 代码质量与安全纪律

- **XSS 防注入**：动态拼接 `innerHTML` 的用户输入/外部数据必须严格 `escapeHTML`；富文本「先转义、再放行白名单标记」（参考 internet-museum 伪 BBCode）；`data:` URI 使用前做前缀白名单校验。
- **事件与定时器防泄漏**：全局监听器单次初始化；列表/卡片重绘前清理悬挂定时器；防抖/节流与 rAF 句柄必须可取消；页面卸载/失焦清理输入与运行状态。
- **输入健壮性**：失焦清空按键状态；过滤 `KeyboardEvent.repeat`；触摸按 `identifier` 隔离多点触控；鼠标事件校验 `pointerType === 'mouse'` 防触屏误触。
- **存储数据防御**：localStorage 恢复须类型白名单 + 数值 sanitize（防 NaN 污染），损坏/篡改数据不得崩溃；写入 try/catch 兜底配额异常；各应用独立存储键并带版本号。
- **可测试性**：复杂应用暴露只读调试句柄（如 `window.MCX`、`window.__app`），不得含敏感信息。
- **Git 提交纪律**：未经用户明确要求（明确说「提交」「commit」），绝不自动执行 `git commit`/`git push` 等写操作。

## 7. 性能与兼容护栏

- **WebGL**：上下文获取失败必须降级提示（禁阻塞式 `alert`）；DPR ≤2；粒子设全局上限；索引可能超 65,535 的网格用 `Uint32Array` 并先检查 `OES_element_index_uint`，不可用时按 65,535 顶点拆批改 `Uint16Array`（参考 block-game `splitForU16`）。
- **大数据渲染**：千级以上列表必须虚拟滚动 + 只渲染可视区 + 增量刷新（参考 iot-hub：phantom 撑高 + translateY + rAF 合批）。
- **高频事件节流**：滚动/鼠标移动/开火等必须节流或防抖（音效数十 ms 级、HUD 约 0.2s、scroll 约 60ms）。
- **主循环**：渲染统一 rAF 驱动，逻辑与渲染分离；后台掉帧用看门狗兜底推进（参考 block-game）。
- **移动端**：安全区适配、44px 触摸目标、iOS AudioContext 手势解锁、`navigator.vibrate` 静默降级。

## 8. 提交信息规范

- Conventional Commits：`<type>(<scope>): <中文描述>`；type ∈ feat/fix/style/refactor/docs/chore；scope 用子项目目录名或公共范围（`portal`/`ui`/`git`）；描述一句话讲清「做了什么 + 影响/原因」；多子项目同类改动可合并为 `ui` 级提交。
- 联动仓库固定句式：`feat(ai): 同步 AItestProjects 最新改动与优化`。
- 提交并推送完成后，按第 2 节「提交后汇报红线」输出「分批提交与推送记录」，交用户核验。

## 9. 工作流守则

> 已知遗留问题与排坑见 `KNOWN_ISSUES.md`，修改相关模块前先阅读；文档与实现冲突时以代码为准，核实后再修文档（文档描述可能随重构漂移）。

1. **生成物只改源头**：stellar-fusion 三版本由 `src/core.js` + `src/shells/` 生成，internet-museum 的 `app.bundle.js` 由 `js/` 源码生成；改后必须重跑对应 `build.js`，禁手改生成物；internet-museum 新增/重命名 `js/` 模块须登记 `build.js` 的 `SECTIONS`。
2. **开工前/收工后核对两仓**：`git status` + `diff -rq` 检查两仓未同步/未提交改动，避免与他人未完成任务叠加。
