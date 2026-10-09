# AItestProjects 项目规范与开发守则

> 本文件是全部子应用的统一开发约束，任何会话开始工作前必须先阅读。第 2 节「双仓同步红线」为最高优先级：任何改动（含文档）完成并通过验证后必须立即同步，不允许拖延到"下次一起同步"。

## 1. 核心架构原则

- **纯原生免构建架构**：全项目子应用必须保持纯原生前端技术栈（HTML5 + CSS3 + 原生 JavaScript / WebGL），禁止引入 Webpack / Vite / npm / node_modules 或重型外置框架依赖，确保双击 `index.html` 或通过任意静态 HTTP 服务器即可 100% 离线流畅运行。
- **零外部资产依赖**：禁止 CDN、外部字体、外链图片/音频、第三方在线接口（含头像、图表、特效类 API）。字体、图标、贴图、音效、头像、图表素材必须程序化生成或内联（Canvas 程序化贴图、Web Audio 合成、内联 SVG / Data URI）。
- **多模型产物归并**：同 Prompt 由多模型（如 Gemini、GLM、DeepSeek 等）生成的项目应在子目录下独立保留对比版本，并在主入口提供切换对比能力。
- **渐进增强与优雅降级**：WebGL 获取失败、localStorage 不可用（隐私模式）、AudioContext 受限等异常环境，必须优雅降级（提示面板 / 内存兜底 / 纯文字流程），禁止未捕获异常导致白屏。

---

## 2. 外部项目强制完全同步与联动提交规则（最高优先级红线）

- **同步目标路径**：
  `/Users/fortrust/Documents/Projects/gitee/https-website-cloudflare/ai`
- **同步与联动提交约束**：
  1. 本项目（`AItestProjects`）为 AI 纯前端免构建项目集的源头开发仓库。
  2. **修改后实时同步**：后续任何会话中的改动（包括写功能、修 Bug、调样式、重构、改文档、加文件），完成修改与测试后，必须立即且完整同步至目标项目的 `ai` 目录。
  3. **双仓联动提交**：**一旦用户要求提交本项目（`AItestProjects`），必须在提交本仓库的同时，将改动同步至 `https-website-cloudflare/ai` 目录，并同步在 `https-website-cloudflare` 项目执行 Git 提交（保持两仓提交历史与代码状态严格对齐）。**
  4. 执行同步的标准指令（脚本已内置排除规则、`diff -rq` 校验与 `--dry-run` 预览）：
     ```bash
     scripts/sync-mirror.sh --dry-run   # 预览
     scripts/sync-mirror.sh             # 同步并核对两侧一致
     ```
     底层等价于 `rsync -av --delete --exclude=.git --exclude=.DS_Store --exclude=.claude --exclude=.zcode --exclude=.trae --exclude=scripts <源>/ <镜像>/`。
  5. 目标仓库提交参考指令：
     ```bash
     cd /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare
     git add ai/
     git commit -m "feat(ai): 同步 AItestProjects 最新改动与优化"
     ```
  6. 同步完成后需核对两边文件差异（`diff -rq`），确保 100% 一致。
  7. 提交前两仓均需 `git status` 确认改动范围与本次主题一致，禁止 `git commit -a` 盲提交；两仓提交信息语义对应（源仓库用具体 scope，联动仓库统一 `feat(ai): 同步 …` / `fix(ai): 同步 …`）。
- **同步排除说明**：`.git` / `.DS_Store` / `.claude` / `.zcode` / `.trae` / `scripts/` 为有意排除——工具本地配置与仓库内部开发脚本不进入部署仓库（注：`.trae` 在源仓库有 Git 跟踪，但同步时排除）。

---

## 3. 目录结构与运行方式

```
AItestProjects/
├── index.html        # 门户主页（Apple 极简风卡片导航 + 分类筛选）
├── README.md         # 项目总览（新增子项目需同步维护）
├── AGENTS.md         # 本规范文件
├── LICENSE           # Apache 2.0
├── KNOWN_ISSUES.md   # 已知遗留问题与排坑清单
├── scripts/          # 仓库级开发脚本（不同步至镜像仓库）
│   ├── check.sh      # 提交前校验：仅检查本次改动涉及的文件 + 生成物新鲜度 + 单元测试
│   └── sync-mirror.sh # 同步至 https-website-cloudflare/ai 并核对差异
├── block-game/       # 各子项目目录，结构与维护要点见第 4 节
├── cyber-potato/
├── internet-museum/
├── iot-hub/
├── learn-lang/
├── stellar-fusion/
└── tank-battle/
```

- **提交前校验**：运行 `scripts/check.sh`。它只对当前改动的 `.js` / `.html` 做语法检查，并运行 `internet-museum/build.js --check`、`stellar-fusion/build.js --check` 与（涉及时）`cyber-potato/test.js`，不做全项目扫描。

- **双击运行（首要验证路径）**：任意子目录的 `index.html` 在 `file://` 协议下必须完整可用。由此产生三条硬约束：
  1. 禁止依赖浏览器直接加载 ES Module（`file://` 下会被 CORS 拦截）；需要模块化时必须提供打包脚本产出普通 `<script>`（参考 `internet-museum/build.js`）。
  2. 禁止 `fetch` / `XHR` 读取本地文件。
  3. 禁止任何外部网络请求（与第 1 节零外部资产一致）。
- **本地静态服务（可选）**：在仓库根目录执行 `python3 -m http.server 8080`，访问 `http://localhost:8080/<子目录>/`。
- **浏览器基线**：Chrome / Edge / Safari / Firefox 现代版本；移动端需同时兼顾 iOS Safari 与 Android Chrome。

---

## 4. 子项目清单与职责

| 子项目目录 | 项目名称 | 核心技术与特色 | 关键结构 |
|---|---|---|---|
| `block-game` | 体素方块 3D 沙盒 | 纯原生 WebGL 1.0 + 区块化隐藏面剔除 + 双通道光照 + 昼夜循环 + 物理防穿透 | 15 个普通 `<script>` 模块按依赖顺序加载（全局 `MC` 命名空间）；新增模块须同步 `index.html` 引入顺序 |
| `cyber-potato` | 赛博电子土豆 | 像素打工碳水宠物 + 状态机离线推演 + Web Audio 合成 | `js/` 五个普通脚本模块；CSS 分 style / potato / anim 三层 |
| `internet-museum` | 互联网考古馆 | 1998~2099 穿越互动展厅 + 纯代码 Web Audio 拨号音效 + 遗迹修复与 6 彩蛋 | ES Module 源码在 `js/` 与 `js/eras/`；交付物为 `js/app.bundle.js`（`node build.js` 生成） |
| `iot-hub` | 实时数据调度控制台 | 5 万级设备虚拟列表 + 内存安全调度 + 命令模式 Undo/Redo | 单文件 `index.html`（约 1.1k 行，内置基础组件与全部逻辑） |
| `learn-lang` | 多语种学习平台 | 3D 翻转记忆闪卡 + 本地纯 SVG 动态头像 + 学习活跃度图表 | `index.html` + `js/app.js` + `css/style.css`，hash 路由六视图 SPA |
| `stellar-fusion` | 3D 星际能源监控中心 | WebGL2 + 多模型（Gemini/GLM/MuseSpark）归并对照 | 共享内核 `src/core.js` + 页面壳 `src/shells/`，由 `build.js` 生成三份单文件版本（生成物，勿手改）；聚合页 iframe 切换预览 |
| `tank-battle` | 3D 经典坦克大战进化版 | 纯原生 WebGL 1.0 + 多视角切换 + 5 大关卡/泰坦 BOSS 战 + Web Audio 合成音效 | 单文件 `index.html`（约 3.7k 行，内分 10 个编号逻辑区） |

---

## 5. 新子应用接入规范

新增子应用必须按顺序完成，缺一不可：

1. **创建目录与文档**：独立子目录，入口 `index.html` 自包含或仅引用同目录静态资源；提供子项目 `README.md`（运行方式、操作说明、技术要点、已知限制）。
2. **资产合规**：遵守第 1 节——零外链、全程序化生成或内联。
3. **图标**：提供 favicon（内联 SVG Data URI 或本地 `favicon.svg`）。
4. **移动端适配**：`viewport-fit=cover`、安全区 `env(safe-area-inset-*)`、可点击目标 ≥44px，需要时加 PWA 元数据与触觉反馈。
5. **门户注册**：在根 `index.html` 新增卡片，`data-category` 必须为 `webgl` / `interactive` / `productivity` 之一，启动链接指向子目录。
6. **总览维护**：同步更新根 `README.md` 项目总览表与本文件第 4 节清单。
7. **同步收尾**：完成后执行第 2 节同步流程并核对差异。

---

## 6. 代码质量与安全纪律

- **XSS 与模板防注入**：所有动态拼接 `innerHTML` 的用户输入或外部数据，必须经过严格的 `escapeHTML` 转义；富文本采用「先转义、再放行白名单标记」范式（参考 internet-museum 论坛伪 BBCode）；`data:` URI（如头像）使用前必须做前缀白名单校验。
- **事件与定时器防泄漏**：全局监听器（EventBus/Window）必须单次初始化，列表/卡片重绘前必须清理悬挂定时器（如 hoverTimer）；防抖/节流定时器与 rAF 句柄必须可取消；页面卸载或失焦时必须清理输入与运行状态。
- **输入健壮性**：失焦必须清空按键状态；过滤 `KeyboardEvent.repeat` 防长按重复触发；触摸事件按 `identifier` 隔离多点触控；鼠标事件判断 `pointerType === 'mouse'`，防止触屏模拟鼠标引发误触（参考 tank-battle 开火卡死修复）。
- **存储数据防御**：localStorage 恢复必须类型白名单校验 + 数值 sanitize（防 `NaN` 污染），损坏/篡改数据不得导致崩溃；写入使用 try/catch 兜底配额异常；各应用使用独立存储键并带版本号（如 `minicraft_block_game_save_v1`）。
- **可测试性**：复杂应用建议暴露只读调试句柄（如 `window.MCX`、`window.__app`）以支持自动化测试，不得包含敏感信息。
- **Git 提交纪律**：未经用户明确要求（明确说「提交」「commit」），绝不自动执行 `git commit` / `git push` 等写操作。

---

## 7. 性能与兼容性护栏

- **WebGL**：上下文获取失败必须降级提示，禁止阻塞式 `alert`；DPR 上限 ≤2；粒子数量设全局上限；索引数可能超过 65,535 的网格必须使用 `Uint32Array` 且在使用前检查 `OES_element_index_uint` 扩展是否可用；扩展不可用时必须按 65,535 顶点拆分批次改用 `Uint16Array`（参考 block-game `js/renderer.js` 的 `splitForU16`）。
- **大数据渲染**：千级以上列表必须虚拟滚动 + 只渲染可视区 + 增量刷新（参考 iot-hub：phantom 撑高 + translateY 偏移 + rAF 合批）。
- **高频事件节流**：滚动/鼠标移动/开火等高频事件必须节流或防抖（音效触发间隔数十 ms 级、HUD 刷新约 0.2s、scroll 约 60ms 防抖）。
- **主循环**：渲染统一由 rAF 驱动，逻辑与渲染分离；后台掉帧可用看门狗兜底推进（参考 block-game）。
- **移动端**：安全区适配、44px 触摸目标、iOS AudioContext 手势解锁、震动反馈（`navigator.vibrate` 静默降级）。

---

## 8. 提交信息规范

- 采用 Conventional Commits：`<type>(<scope>): <中文描述>`，type 取 `feat` / `fix` / `style` / `refactor` / `docs` / `chore`。
- `<scope>` 使用子项目目录名（`tank-battle`、`block-game`…）或公共范围（`portal`、`ui`、`git`）。
- 描述须概括「做了什么 + 影响/原因」，一句话说清；多个子项目同类改动可合并为 `ui` 级提交。
- 示例（取自真实提交历史，保持同风格）：
  - `feat(tank-battle): 新增 3D 坦克大战钢铁风暴并更新 AI 门户描述与数据`
  - `fix(tank-battle): 根治开火卡死与移动开火原地卡，重构多点触控隔离与音效节流`
  - `style(ui): 全子项目 UI 视觉质感升级（卡片渐变、阴影层次、悬浮微交互）`
  - `feat(ai): 同步 AItestProjects 最新改动与优化`（联动仓库固定句式）
- 提交前执行 `git status` 确认范围，禁止把与本次主题无关的改动混入提交。

---

## 9. 工作流守则

> 具体的已知遗留问题与排坑记录见根目录 `KNOWN_ISSUES.md`，修改相关模块前先阅读。

1. **生成物只改源头**：stellar-fusion 的三份版本由 `src/core.js` 与 `src/shells/` 生成，internet-museum 的 `js/app.bundle.js` 由 `js/` 源码生成。修改后必须重新运行对应 `build.js`，禁止手改生成物。新增或重命名 internet-museum 的 `js/` 模块，须同步登记到 `build.js` 的 `SECTIONS`，否则构建会报错。
2. **文档与实现可能漂移**：历次重构后部分描述滞后（如 block-game 曾被描述为"贪心网格优化"，实测为逐面剔除）。发现不一致时先核实代码，再修正文档。
3. **开工前核对两仓状态**：先 `git status` + `diff -rq` 检查两仓是否已有未同步/未提交改动，避免与他人的未完成任务叠加；工作结束后同样核对。
