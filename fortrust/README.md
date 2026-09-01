# Fortrust 静态资源中心

## 目录

```text
https-website-cloudflare/
├── fortrust/
│   ├── index.html
│   ├── directory.json              # 自动生成，不需要手动修改
│   ├── App2服务到期提醒功能/
│   │   └── 原型/
│   │       └── index.html
│   └── 其他项目/
└── scripts/
    └── generate-fortrust.js
```

## 工作方式

Cloudflare Pages 构建时执行：

```bash
npm run build
```

脚本会递归扫描 `fortrust/` 下所有目录。

- 目录存在 `index.html`：显示“查看”按钮。
- 目录没有 `index.html`，但下面还有项目：显示为可展开的目录节点。
- 自动处理中文目录名和空格。
- 新增目录后只要 Git push，不需要修改首页 HTML。
