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

## 6. 回归测试已接入提交门禁（2026-11-23）

`scripts/check.sh` 在对应目录有改动时自动运行该目录的 `test.js`：`cyber-potato`、`loop-heist`、`cell-defense`、`learn-lang`、`internet-museum`。

- `learn-lang/test.js`：课程解锁链、闪卡会话归属、奖励与「已发奖」标记的落库顺序、首次加载不压历史记录、点赞就地更新。
- `internet-museum/test.js`：导航滚动状态机（程序滚动态的解除与超时兜底、同厅回弹、键盘守卫、宽度变化重对齐）、论坛楼层顺序与楼号、BBCode 解析。只读源码，不校验 bundle（新鲜度由 `build.js --check` 负责）。

这两个是无头验证：用最小 DOM 桩 + 假时钟把源码当普通脚本执行。给它们加用例时，先把对应逻辑改坏、确认新用例会失败，再提交——此前出现过「断言恒真、规则被删掉测试照样全过」的情况。

## 7. 改动前必读的行为约定

- **learn-lang 闪卡会话归属**：只有从课程页的模块卡片进入，会话才归属该模块并记为完成；首页、学习中心的闪卡入口是通用会话，不记模块进度。完成记录每次会话都落库，50 EXP 奖励只发一次。结算区提示由 `completionHint()` 生成，只陈述本次确实改变了什么。
- **internet-museum 导航**：程序滚动态（`isProgrammaticScroll`）期间 scroll 监听器不工作，所以它必须能在被手势打断时解除。新增任何会改变 `.gallery` 滚动位置的手势处理，都要调用 `releaseProgrammaticScroll()`；超时仍未抵达时以实际位置重新检测。`.gallery` 的 CSS 设了 `scroll-behavior: smooth`，`behavior: 'auto'` 实际仍是动画。
- **internet-museum 论坛楼层**：存档回帖的展示楼号按存档顺序派生（6 楼起），不采信存档里的 `floor`，也不回写；「查看更多」展开的历史楼层插在 3 楼之后、回帖之前。
- **loop-heist 视线**：关闭的门/闸门本身可见，但遮挡其后。幽灵若在门关上的那一回合走向门格会被挡住，之后与原录像错位（见 `js/sim.js` 头注）。`test.js` 里 BFS 求解器的去重键必须是完整世界状态，否则「某关无解」的断言不可信。
- **block-game 缓存版本号**：脚本引用带 `?v=N`。线上部署在 Cloudflare 上，JS 会被缓存而 HTML 不会，改了任一脚本后要把 `index.html` 里 15 处版本号整体递增，否则可能出现新旧脚本混用。

## 8. 已知遗留（未修复）

需要产品决策：

- learn-lang：「近 7 天学习活跃度」图表是写死的演示数据，未接真实统计。接入需在存档里新增按日统计字段，属契约变更，须先确认。未登录也能产生进度与社区动态。
- cyber-potato：在线与离线的衰减速率不一致——饱食度 0.15/秒 对 0.02/秒，精力 0.1/秒 对 0.015/秒，开着页面挂机饿得更快。是否有意为之待定。

需要较大改动，或需在真实浏览器中验证：

- internet-museum：
  - `museumStore.getState()` 返回活引用，调用方可绕过白名单直接改状态。已知的旁路（era-2012 点赞）已改走 `update()`，其余未逐一收敛。
  - 2024 展厅点「为什么推荐给我」会同时打开彩蛋弹窗与透明度弹窗，按一次 Esc 两层一起关。
  - 1998 拨号音效不可取消，防重入只靠按钮 `disabled`。
  - 2024 展厅每次偏好变动都整体重建信息流，会打断其它卡片的悬停计分。
  - `.gallery` 同时有 `scroll-snap` 与 `scroll-behavior: smooth`，鼠标拖拽时 `scrollLeft` 赋值是否滞后未在真实浏览器确认。
- stellar-fusion：`webglcontextlost` 里调了 `preventDefault()`，但没有 `webglcontextrestored` 处理，上下文恢复后仍需手动刷新。`src/shells/musespark.html` 有一条断点与另两壳不一致（520px 对 900px）。
- block-game：世界编辑记录（`edits`）只增不减，长期大量使用 TNT 后存档可能超出 localStorage 配额，自动保存会静默失败；氧气耗尽没有任何后果；没有自动化测试。
- 缓存：`cell-defense`、`cyber-potato`、`loop-heist`、`learn-lang` 的脚本引用没有 `?v=` 版本号，存在与上一条 block-game 相同的新旧混用风险。

旧数据：

- 2026-11-23 之前保存的论坛回帖，其正文里机器人写的「回复 N 楼」仍是当年的楼号（展示楼号已按顺序派生，正文不改写）。
