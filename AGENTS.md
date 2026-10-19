# https-website-cloudflare 项目规范与开发守则

## 1. 项目定位与核心架构

- **项目定位**：本项目（`fortrust-static-center`）是基于 Cloudflare Pages 的**纯静态托管站点**，当前仅承载两部分公开内容：根目录 Landing Page 与 `ai/` 纯前端项目集。
- **核心构成**：
  1. **根目录 Landing Page (`index.html`)**：
     - Cloudflare Pages 产品风格的品牌展示页，无内部资源入口、无自动跳转。
  2. **`ai/` AI 纯前端免构建项目集**：
     - 纯原生免构建前端应用（`block-game`、`cyber-potato`、`internet-museum`、`iot-hub`、`learn-lang`、`stellar-fusion`、`tank-battle`）及 `ai/index.html` 聚合门户。
     - 当前为公开静态托管（无服务端密码门，历史上由 `_worker.js` 提供的鉴权已随其移除）。
  3. **构建方式**：纯静态免构建。`npm run build` 仅为兼容 Cloudflare Pages 构建命令的恒成功 no-op，不做任何实质构建。
- **已迁移模块（重要，勿在本仓库重建）**：
  - 原 `fortrust/` 静态资源中心（产品原型、需求文档、测试样例）已于 2026-10 迁移至内网文件服务器 **filer-server**（本地仓库：`/Users/fortrust/Documents/filer-server`）。
  - 新访问入口：`http://192.168.130.88:8888/fortrust`，受独立密码门保护（密码与环境变量见 filer-server 的 `README.md`：`FORTREST_PASSWORD` / `BIG_FILE_PASSWORD` / `AUTH_PASSWORD`）。
  - 迁移时已同步删除本仓库的 `_worker.js`（原 /fortrust 密码门与 /_view 查看器）与 `scripts/generate-fortrust.js`（目录扫描脚本），两者在 filer-server 中均有对应实现。

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

- **本仓库（Cloudflare Pages）当前无服务端鉴权**：`_worker.js` 已删除，所有静态资源（含 `/ai/*`）公开可访问。历史密码（`/fortrust` 与 `/ai` 密码门）仅存于 Git 历史中，不再有效。
- **现存密码体系**（均在内网 filer-server，详见其 `README.md`）：
  | 作用区域 | 环境变量 | 默认值见 README |
  |---|---|---|
  | 文件服务器管理界面 | `AUTH_PASSWORD` / `AUTH_ENABLED` | 是 |
  | `/fortrust` 资源中心密码门 | `FORTREST_PASSWORD` / `FORTREST_SECRET` | 是 |
  | 大文件上传（>100MB） | `BIG_FILE_PASSWORD` / `BIG_FILE_MB` | 是 |

---

## 4. 常用构建与维护命令

```bash
cd /Users/fortrust/Documents/Projects/gitee/https-website-cloudflare

# 兼容 Cloudflare Pages 构建命令的 no-op（恒成功，无实质构建）
npm run build

# 本地预览（任选其一）
npx wrangler pages dev .
python3 -m http.server 8000
```

---

## 5. Git 提交纪律

- 未经用户明确要求（如明确说「提交」「commit」），绝不自动执行 `git commit`、`git push` 等写操作。
- 完成代码修改和验证后，停在「已修改未提交」状态向用户报告改动清单，由用户自行决定是否提交。
- 用户要求提交时，若涉及 `ai/` 变动，严格执行上述第 2 节的**双仓联动提交与推送**。
