# 已知遗留问题与排坑清单

> 以下为代码现状核查结论，修改相关模块前先阅读；文档描述若与代码冲突，以代码为准。规范与守则见 `AGENTS.md`。

## 1. stellar-fusion：三版本由生成流程统一

`gemini/index.html`、`musespark/index.html`、`musespark/IndexGLM.html` 已不再手工维护。共享渲染与交互逻辑位于 `src/core.js`，三个页面壳位于 `src/shells/`，由 `node stellar-fusion/build.js` 注入品牌配置（`BRAND`）后生成。

- 修改共享逻辑：只改 `src/core.js`，然后重新运行 `build.js`。
- 修改页面结构或样式：改对应的 `src/shells/*.html`。
- 修改品牌文案或 GPU 回退名：改 `build.js` 中的 `TARGETS`。
- 校验生成物是否过期：`node stellar-fusion/build.js --check`。

旧文档中"三版本差异仅约 90 行、需人工三版同步"的描述已过时。

## 2. internet-museum：打包清单已登记并受守卫保护

`js/app.bundle.js` 由 `build.js` 按 `SECTIONS` 登记表拼接生成，`index.html` 只加载 bundle。

- 新增、删除或重命名 `js/` 下的模块后，必须同步修改 `SECTIONS`。未登记的模块会导致构建报错退出。
- 每次修改源码后运行 `node internet-museum/build.js`，提交前可用 `--check` 确认 bundle 未过期。

`alert` / `confirm` 已全部消除（2026-10-11）：空说说与空回帖改用 `eggsManager.showToast` 非阻塞提示（回帖同时补上 15 字长度校验，与文案一致）；重置进度改用两步确认按钮（5 秒内再次点击确认），无阻塞弹窗。

## 3. block-game：飞行触控按钮已补绑定（2026-10-11）

`#btn-touch-fly`（开关飞行）、`#btn-touch-down`（按住下降，Shift 语义）、`#fly-badge`（飞行徽标）之前是死元素，现已在 `js/input.js`（`touchDescend` 状态＋触控/`click` 双绑定）与 `js/main.js`（`onToggleFly` 同步徽标/按钮显隐）中补齐绑定。`#joystick-hint` 为纯静态提示文字（`pointer-events: none`），无需绑定。

## 4. 全局原生阻塞式弹窗彻底清零与交互优化（2026-10-25）

- `iot-hub`：原遗留的 1 处导入数据 `confirm()` 及 4 处标签/分组 `prompt()` 全部消除，升级为基于 `.modal` 的统一非阻塞 `appPrompt` 与内嵌式多级状态确认；
- `tank-battle`：新增本地历史最高纪录（High Score）持久化存储与 HUD 实时高亮显示；
- `block-game` 与 `cell-defense`：所有 Web Audio 程序化音效调用均已接入 `safe(...)` 防抛防护层，系统休眠唤醒或策略拦截静默降级，主游戏循环与交互零阻断；
- `stellar-fusion`：三版本横向对标文档（Gemini / MuseSpark / HELIOS-7）与直达导航已全面统一润色闭环。

## 5. 待用户确认与验证的事项

- tank-battle：仅通过自动化 mock 验证，关卡数值与手感未经实际游玩调优。
- learn-lang：视口相关改动尚未经用户确认。
- cyber-potato：重置存档已由阻塞式 `confirm` 改为两步确认按钮（5 秒内再次点击），提示文案与新交互尚未经用户确认。
- stellar-fusion：三个版本的 DOM 与控制台已验证，但重构后的视觉效果未做截图对比；HUD 左下 `NETWORK/NODES` 由静态占位改为实时遥测（告警时显示 DEGRADED，NODES 显示城市+空间站+卫星总数），视觉效果待确认。
