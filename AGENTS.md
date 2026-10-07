# https-website-cloudflare 项目规范与开发守则

## 1. 项目定位与核心架构

- **项目定位**：本项目（`fortrust-static-center`）是基于 Cloudflare Pages 与 Advanced Mode Worker（`_worker.js`）构建的高性能静态资源中心与多模块聚合平台。
- **核心功能模块**：
  1. **`fortrust/` 静态资源中心**：
     - 包含产品原型（App2.0/三一/沃达/维保/Test等）、规范说明书与静态资料。
     - 自动索引：通过 `npm run build`（`node scripts/generate-fortrust.js`）扫描生成 `directory.json`。
     - 访问控制：受 `fortrust` 服务端密码门保护（默认密码：`fortrust` / `fortrust2026` / `fortrust888`，或环境变量 `AUTH_PASSWORD`）。
  2. **`ai/` AI 纯前端免构建项目集**：
     - 包含 6 个纯原生免构建前端应用（`block-game`、`cyber-potato`、`internet-museum`、`iot-hub`、`learn-lang`、`stellar-fusion`）及 `ai/index.html` 聚合门户。
     - 访问控制：受独立密码门保护（默认密码：`lpeng666` / `Lpeng666`，或环境变量 `AI_AUTH_PASSWORD`）。
  3. **根目录 Landing Page (`index.html`)**：
     - 公开首页，提供 Cloudflare 品牌展示及直达 `/ai/` 与 `/fortrust/` 的快捷入口。
  4. **`_worker.js` (Cloudflare Edge Worker)**：
     - 负责 `/fortrust/*` 与 `/ai/*` 的独立密码校验与 7 天 HMAC-SHA256 签名 Cookie 签发（`ft_auth` / `ai_auth`）。
     - 负责 `/_view` 新标签页文档渲染（支持 Markdown / Word docx / Excel xlsx 在线解析预览与 XSS 消毒拦截）。
     - 其余静态资源通过 `env.ASSETS` 边缘直出。

---

## 2. 与 AItestProjects 本地项目双向同步与联动提交规则（最高优先级红线）

- **本地关联仓库路径**：
  `/Users/fortrust/Documents/AItestProjects`
- **双向同步与双仓联动提交约束**：
  1. **双向实时同步**：
     - 当在当前项目修改了 `ai/` 目录下的任何代码、静态文件、文档时，必须立即将改动完整同步至 `/Users/fortrust/Documents/AItestProjects/`。
     - 当在 `AItestProjects` 仓库修改了代码时，也必须实时同步至当前项目的 `ai/` 目录。
  2. **双仓联动提交与推送**：
     - **在当前项目（`https-website-cloudflare`）提交涉及 `ai/` 目录的改动时，必须同步在 `AItestProjects` 仓库执行 Git 提交与推送（`git commit` & `git push`）**。
     - **在 `AItestProjects` 仓库提交时，也必须同步在 `https-website-cloudflare` 执行 Git 提交与推送**。
     - 确保两个 Git 仓库的代码内容与 Git 提交历史严格保持双向对齐。
  3. **标准双向同步指令**：
     - **从当前项目同步至 AItestProjects**：
       ```bash
       rsync -av --delete --exclude='.git' --exclude='.DS_Store' --exclude='.claude' --exclude='.zcode' --exclude='.trae' \
         /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare/ai/ /Users/fortrust/Documents/AItestProjects/
       ```
     - **从 AItestProjects 同步至当前项目**：
       ```bash
       rsync -av --delete --exclude='.git' --exclude='.DS_Store' --exclude='.claude' --exclude='.zcode' --exclude='.trae' \
         /Users/fortrust/Documents/AItestProjects/ /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare/ai/
       ```
  4. **两仓提交推送参考流程**：
     ```bash
     # 1. 提交并推送 AItestProjects
     cd /Users/fortrust/Documents/AItestProjects
     git add -A
     git commit -m "feat: 同步最新改动"
     git push origin master

     # 2. 提交并推送 https-website-cloudflare
     cd /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare
     git add -A
     git commit -m "feat(ai): 同步 AItestProjects 最新改动"
     git push origin master
     ```
  5. 每次同步完成后，建议通过 `diff -rq` 核对 `ai/` 与 `AItestProjects/` 排除隐藏文件后的内容，确保 100% 一致。

---

## 3. 访问密码与鉴权配置

| 作用区域 | 默认访问密码 | 维护 Cookie | 环境变量覆盖 |
|---|---|---|---|
| `/fortrust/*` | `fortrust` / `fortrust2026` / `fortrust888` | `ft_auth` (7 天) | `AUTH_PASSWORD` |
| `/ai/*` | `lpeng666` / `Lpeng666` | `ai_auth` (7 天) | `AI_AUTH_PASSWORD` |
| 全局 Cookie 签名密钥 | 默认内置回退哈希串 | - | `AUTH_SECRET` |

---

## 4. 常用构建与维护命令

```bash
cd /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare

# 重新生成 fortrust 目录索引
npm run build

# 语法检查 Worker 脚本
node -c _worker.js
```

---

## 5. Git 提交纪律

- 未经用户明确要求（如明确说「提交」「commit」），绝不自动执行 `git commit`、`git push` 等写操作。
- 完成代码修改和验证后，停在「已修改未提交」状态向用户报告改动清单，由用户自行决定是否提交。
- 用户要求提交时，若涉及 `ai/` 变动，严格执行上述第 2 节的**双仓联动提交与推送**。
