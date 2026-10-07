# HELIOS & STELLAR · 3D 星际能源控制台 (双模型对标项目)

> 纯 **HTML5 + CSS3 + 原生 WebGL 2.0 (GLSL ES 3.00)** 实现的 3D 星际能源与聚变监控指挥系统。
> 本项目由**完全相同的提示词**分别输入 **Google Gemini** 与 **MuseSpark** 生成，整合在同一项目目录下用于横向技术架构与渲染表现对标。零外部 3D 引擎依赖（无 Three.js），双击任意 `index.html` 即可直接离线体验。

---

## 📁 目录与版本结构

```
stellar-fusion/
├── index.html            # 聚合门户主页（双版本直观对比与内嵌切换预览）
├── README.md             # 本说明文档
├── gemini/               # Google Gemini 生成版本（HELIOS-X Command）
│   ├── index.html        # 单文件自包含源码
│   └── README.md         # Gemini 版技术细节说明
└── musespark/            # MuseSpark 生成版本（STELLAR CORE Fusion）
    ├── index.html        # 单文件自包含源码（深度优化版）
    ├── IndexGLM.html     # HELIOS-7 基准对照版本
    └── README.md         # MuseSpark 版技术细节说明
```

---

## 🌟 双模型横向对标亮点

| 维度 | Google Gemini 版 (`./gemini/`) | MuseSpark 版 (`./musespark/`) |
| :--- | :--- | :--- |
| **项目代号** | **HELIOS-X Command** | **STELLAR CORE Fusion** |
| **视觉基调** | 青蓝电磁流 + 极简暗黑星空 | 青蓝与紫曜双色调高对比能量场 |
| **核心天体** | 12 股螺旋等离子体流 + 旋转约束环 | 三轴差速磁约束光环 + 能量光晕 |
| **后处理管线** | 提取高亮 → 双重高斯模糊 → Glow/色差/扫描线 | 多级 FBO 降采样泛光合成 + 径向暗角 |
| **容灾与性能** | 矩阵与着色器级手工极致轻量化 | **自适应看门狗**（监测丢帧自动降采样降级） |
| **交互与拾取** | 精准像素级屏幕反投影射线拾取 (Raycaster) | 空间节点拾取 + 响应式抽屉与十字准星 |
| **图表系统** | 5 款纯原生 Canvas 高帧率图表 | 5 款毛玻璃 Cyber 风格实时遥测图表 |
| **音效系统** | 纯 Web Audio 算法程序化合成电磁环境音 | 视听多维动态呈现 |

---

## 🚀 启动与体验方式

1. **直接双击运行（免服务）**：
   - 双击 `stellar-fusion/index.html` 打开聚合门户，支持一键在页面内切换预览或新窗口打开各版本。
   - 亦可直接双击 `gemini/index.html` 或 `musespark/index.html` 进行独立体验。
2. **通过本地静态服务**：
   ```bash
   cd /Users/fortrust/Documents/AItestProjects
   python3 -m http.server 8080
   ```
   - 访问门户：[http://localhost:8080/stellar-fusion/](http://localhost:8080/stellar-fusion/)
   - 直达 Gemini 版：[http://localhost:8080/stellar-fusion/gemini/](http://localhost:8080/stellar-fusion/gemini/)
   - 直达 MuseSpark 版：[http://localhost:8080/stellar-fusion/musespark/](http://localhost:8080/stellar-fusion/musespark/)
