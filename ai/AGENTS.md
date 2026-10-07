# AItestProjects 项目规范与开发守则

## 1. 核心架构原则

- **纯原生免构建架构**：全项目子应用必须保持纯原生前端技术栈（HTML5 + CSS3 + 原生 JavaScript / WebGL），禁止引入 Webpack / Vite / npm / node_modules 或重型外置框架依赖，确保双击 `index.html` 或通过任意静态 HTTP 服务器即可 100% 离线流畅运行。
- **多模型产物归并**：同 Prompt 由多模型（如 Gemini、GLM、DeepSeek 等）生成的项目应在子目录下独立保留对比版本，并在主入口提供切换对比能力。

---

## 2. 外部项目强制完全同步与联动提交规则（最高优先级红线）

- **同步目标路径**：
  `/Users/fortrust/Documents/Projects/gitee/https-website-cloudflare/ai`
- **同步与联动提交约束**：
  1. 本项目（`AItestProjects`）为 AI 纯前端免构建项目集的源头开发仓库。
  2. **修改后实时同步**：后续任何会话中的改动（包括写功能、修 Bug、调样式、重构、改文档、加文件），完成修改与测试后，必须立即且完整同步至目标项目的 `ai` 目录。
  3. **双仓联动提交**：**一旦用户要求提交本项目（`AItestProjects`），必须在提交本仓库的同时，将改动同步至 `https-website-cloudflare/ai` 目录，并同步在 `https-website-cloudflare` 项目执行 Git 提交（保持两仓提交历史与代码状态严格对齐）。**
  4. 执行同步的标准指令：
     ```bash
     rsync -av --delete --exclude='.git' --exclude='.DS_Store' --exclude='.claude' --exclude='.zcode' --exclude='.trae' /Users/fortrust/Documents/AItestProjects/ /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare/ai/
     ```
  5. 目标仓库提交参考指令：
     ```bash
     cd /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare
     git add ai/
     git commit -m "feat(ai): 同步 AItestProjects 最新改动与优化"
     ```
  6. 同步完成后需核对两边文件差异（`diff -rq`），确保 100% 一致。

---

## 3. 子项目清单与职责

| 子项目目录 | 项目名称 | 核心技术与特色 |
|---|---|---|
| `block-game` | 体素方块 3D 沙盒 | 纯原生 WebGL 1.0 + 贪心网格优化 + 昼夜循环 + 物理防穿透 |
| `cyber-potato` | 赛博电子土豆 | 像素打工碳水宠物 + 状态机离线推演 + Web Audio 合成 |
| `internet-museum` | 互联网考古馆 | 1998~2099 穿越互动展厅 + 纯代码 Web Audio 拨号音效 + 遗迹修复 |
| `iot-hub` | 实时数据调度控制台 | 5万级设备虚拟列表 + 内存安全调度 + 命令模式 Undo/Redo |
| `learn-lang` | 多语种学习平台 | 3D 翻转记忆闪卡 + 本地纯 SVG 动态头像 + 学习活跃度图表 |
| `stellar-fusion` | 3D 星际能源监控中心 | WebGL2 + 多模型（Gemini/GLM/MuseSpark）归并对照 |

---

## 4. 代码质量与安全纪律

- **XSS 与模板防注入**：所有动态拼接 `innerHTML` 的用户输入或外部数据，必须经过严格的 `escapeHTML` 转义。
- **事件与定时器防泄漏**：全局监听器（EventBus/Window）必须单次初始化，列表/卡片重绘前必须清理悬挂定时器（如 hoverTimer）。
- **Git 提交纪律**：未经用户明确要求（明确说「提交」「commit」），绝不自动执行 `git commit` / `git push` 等写操作。
