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

仍需处理的 `alert` / `confirm` 残留（违反第 7 节"禁止阻塞式 alert"）：

- `js/eras/era-2012.js`：说说内容为空时的 `alert`。
- `js/eras/era-2008.js`：回帖内容为空时的 `alert`（提示文案写明"不少于15字"，但代码只校验非空，两者不一致）。
- `js/eggs.js`：清除考古进度的 `window.confirm`。

## 3. block-game：死的触控与飞行 UI

`block-game/index.html` 与 `block-game/css/style.css` 中存在以下元素，但全部 JS 中没有任何对应的事件绑定或读取：

- `#btn-touch-fly`（飞行开关按钮）
- `#btn-touch-down`（飞行下降按钮）
- `#fly-badge`（飞行中提示徽标）
- `#joystick-hint`（摇杆提示文字）

这些元素当前不会产生任何功能，需要决定是补全绑定逻辑，还是删除相应的 HTML 与 CSS。

## 4. 未在真机验证的项目

- tank-battle：仅通过自动化 mock 验证，关卡数值与手感未经实际游玩调优。
- learn-lang：视口相关改动尚未经用户确认。
- cyber-potato：提示文案改动尚未经用户确认。
- stellar-fusion：三个版本的 DOM 与控制台已验证，但重构后的视觉效果未做截图对比。
