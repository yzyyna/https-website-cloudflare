# HELIOS-X · 3D Interstellar Energy Command

> 纯 **HTML5 + CSS3 + 原生 WebGL 2.0 (GLSL ES 3.00)** 实现的单文件沉浸式 3D 星际能源指挥中心。
> 零第三方 3D 引擎库（无 Three.js / Babylon.js 等任何外部框架），完全基于原生 GLSL 着色器与矩阵变换构建，双击 `index.html` 离线秒开。

---

## 🌟 核心特性

1. **纯手写原生 WebGL 2.0 渲染架构**
   - 彻底摆脱庞大 3D 引擎依赖，从零封装 ShaderManager、Program 缓存、VAO 顶点缓冲管理及矩阵库。
   - 包含多 Pass 帧缓冲（FBO）后处理管线：Bright 提亮提取 → 双重高斯模糊（Blur A/B）→ 合成 Glow 辉光、色差（Chromatic Aberration）、扫描线与暗角（Vignette）。
2. **Procedural 3D 天体与能量核心**
   - **HELIOS-X 能量核心**：多层旋转约束环 + 能量外壳 + 12 股螺旋能量粒子流（Stream Orbits）。
   - **写实地球体与大气散射**：具备大气层光照散射着色器模型与自转。
   - **星际能源管网**：全球各大主要枢纽节点、同步轨道卫星与深空轨道空间站之间的动态脉冲能量连线。
3. **精准 3D 射线拾取系统 (Raycaster)**
   - 视口像素反投影计算空间射线（Screen-to-Ray），支持高灵敏度空间节点选中、悬停高亮与固定跟随 Tooltip 浮层。
4. **科幻毛玻璃 HUD 界面 (Cyber Glassmorphism)**
   - 四角仪表盘系统：
     - `hudTL`：核心等离子体温度、聚变通量与磁约束状态。
     - `hudTR`：全球电网负荷平稳度与频率波动监测。
     - `hudBL`：GPU 渲染器信息、实时 FPS 与当前分辨率指标。
     - `hudBR`：实时发电功率（TW）与宏观传输吞吐。
5. **实时可视化数据图表 (Canvas Charts)**
   - 内置 5 种基于 HTML5 Canvas 手绘的高刷新率图表：折线图（Line）、面积图（Area）、柱状图（Bars）、径向图（Radial）与波形图（Wave）。
6. **时间旅行回放 (Timeline Scrubbing)**
   - 支持拖拽历史时间轴进行能量流状态回放，模拟时空穿梭观察过去 60 秒内网络突发过载与波动。
7. **环境音效合成 (Web Audio API)**
   - 内建纯代码程序化合成的电磁嗡鸣音效与按钮交互声，无需外部音频资源文件。

---

## 📁 项目结构

```
.
├── index.html       # 自包含单文件，内置全部 CSS 样式、GLSL Shader 与原生 WebGL2 业务脚本
└── README.md        # 本项目技术说明文档
```

---

## 🚀 启动与运行

- **硬件要求**：支持 WebGL 2.0 的现代浏览器（Chrome / Edge / Firefox / Safari 15+），开启硬件加速。
- **直接运行**：双击 `index.html` 即可在浏览器全屏浏览。
- **本地服务（可选）**：
  ```bash
  python3 -m http.server 8080
  # 访问 http://localhost:8080
  ```
