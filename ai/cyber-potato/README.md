# 🥔 赛博电子土豆 (Cyber Potato)

> **一颗会饿、会困、会超频过载，连续被冷落还会撰写辞职信的像素打工土豆。**  
> 纯原生免构建架构（零依赖、双击即可离线运行），纯 CSS 像素级动画 + localStorage 持久化 + Web Audio API 原生合成音效。

[![Build: Zero Dependency](https://img.shields.io/badge/Build-Zero%20Dependency-brightgreen.svg)](#)
[![JavaScript: Vanilla ES6+](https://img.shields.io/badge/JavaScript-Vanilla%20ES6+-yellow.svg)](#)
[![Audio: Web Audio API](https://img.shields.io/badge/Audio-Web%20Audio%208--bit-blue.svg)](#)
[![Storage: localStorage](https://img.shields.io/badge/Storage-localStorage-orange.svg)](#)

---

## 🌟 核心特性与玩法

1. **三维生命与打工生理指标**：
   - 🌾 **淀粉储量 (饱食度)**：随时间自然下降；跌破 25% 身体发皱干瘪、拒不思考、大呼要化肥。
   - ⚡️ **电池电压 (精力值)**：随时间衰减；低于 25% 眼皮耷拉打瞌睡；点击关灯睡觉进入梦乡并快速充满。
   - 🧠 **打工精神状态 (心智)**：随时间缓慢下降；通过摸摸头或喂书学习可恢复。

2. **☕️ 喂咖啡超频过载 (Overclock Mode)**：
   - 连续投喂浓缩咖啡，核心温度与精力暴涨！
   - 超过安全阈值后触发**极速过载狂暴**：
     - 纯 CSS 高频剧烈抽搐抖动 (Jitter / Glitch)；
     - 瞳孔变成刺眼电光蓝闪电，头顶冒出翻滚蒸气云；
     - 打字机以两倍速狂喷暴躁程序员梗台词；
     - 多次过载后，土豆眼部将**变异长出赛博发光义眼与排线**！

3. **📖 喂书学习与学术进化 (Academic Glasses)**：
   - 累计逼它读书 3 次，土豆脸上“啪”的一声**硬生生戴上黑框像素眼镜**！
   - 吐槽语气突变，自动开启老学究冷嘲热讽模式（引用热力学第二定律、薛定谔理论等）。

4. **💼 连续冷落写辞职信 (Resignation Letter)**：
   - 离线演算推演机制：关闭网页重新打开时，系统自动推演时间差；
   - 若**连续离线超过 24 小时**（或心智与饥饿同时归零），土豆将背上行李小木棍包袱，并在屏幕中央弹出鲜红盖章的**《自愿解除碳水劳动合同声明》**；
   - 玩家可选择：
     - **下跪挽留（加发红包与化肥）**：状态大幅回升，并因抗议生命力当场**长出生化幼芽**配件！
     - **批准滚蛋（重置孵化）**：放生土豆，换一颗崭新的新手土豆重新培养。

5. **👔 奇怪配件与衣橱图鉴**：
   - 衣橱配件：老学究眼镜 👓、赛博义眼 👁️、生化嫩绿幼芽 🌱、剧毒红伞蘑菇 🍄、打工人领带 👔、暴发户大金链 🪙。
   - 解锁的衣橱配件可在衣橱中自由穿戴或卸下。辞职小行囊 📦 不在衣橱中，辞职状态下自动显示。

6. **🎵 原生 Web Audio API 8-bit 音效**：
   - 零外部音频文件加载，通过代码实时合成进食音、超频激光扫频、Q弹受击 Boing、辞职盖章重击、打字机嗒嗒声等。支持一键静音。

7. **⏳ 时光机调试台**：
   - 内置时光机工具，支持快速快进 1 小时、8 小时（过夜）、24 小时（即刻体验辞职信与离线推演），方便测试与展示。

---

## 🚀 启动与体验方式

本项目为纯原生架构，**无任何 npm 依赖与打包编译环节**：

1. **直接双击运行**：
   - 在文件管理器或 Finder 中直接双击打开 `index.html` 即可畅玩。
2. **通过本地静态服务启动**：
   ```bash
   cd /Users/fortrust/Documents/AItestProjects
   python3 -m http.server 8080
   ```
   浏览器访问：[http://localhost:8080/cyber-potato/](http://localhost:8080/cyber-potato/)

---

## 📂 目录架构

```text
cyber-potato/
├── index.html          # 主界面（复古掌机终端外壳、CRT 像素屏幕、控制面板、弹窗）
├── README.md           # 项目详细说明文档
├── test.js             # Node 逻辑测试（node test.js）
├── css/
│   ├── style.css       # 掌机外壳质感、CRT 扫描线、控制面板与模态弹窗样式
│   ├── potato.css      # 纯 CSS 像素土豆形体、面部五官、配件槽位与状态样式
│   └── anim.css        # 呼吸、过载抽搐、受击 Q 弹形变、蒸汽、气泡等关键帧动画
└── js/
    ├── audio.js        # Web Audio API 8-bit 复古声音合成单例
    ├── dialogue.js     # 吐槽文案池与打字机输出引擎
    ├── accessories.js  # 奇怪配件解锁逻辑、生长规则与衣橱控制器
    ├── state.js        # 核心状态机、离线时间推演与 localStorage 持久化
    └── app.js          # 主交互绑定、事件调度与连击检测
```
