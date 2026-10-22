/**
 * cell-defense: 微血管微流动力学、心跳脉冲与抗体漂移水雷
 * 功能：
 * 1. 血管内红细胞 (Erythrocytes) 与血浆浮游粒子的流体模拟
 * 2. 心跳节律机（每 6 秒一次舒张收缩，推动整场血流涌动）
 * 3. 血管壁弯曲管道与细胞基座槽位渲染
 * 4. Y 型抗体水雷（Antibodies）的自然漂流与相交碰撞
 */
(function(window) {
  'use strict';

  function BloodFlow(width, height) {
    this.width = width;
    this.height = height;

    // 心跳周期控制
    this.pulseInterval = 6.0; // 6秒一次大心跳
    this.pulseTimer = 6.0;
    this.pulseWave = 0; // 0 ~ 1

    // 漂浮红细胞与组织液微粒池 (布朗运动 + 血液流场)
    this.particles = [];
    var count = Math.min(45, Math.floor((width * height) / 22000));
    for (var i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 8 + 6, // 双凹圆盘面红细胞
        vx: Math.random() * 20 + 35,
        vy: (Math.random() - 0.5) * 10,
        alpha: Math.random() * 0.22 + 0.12,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 1.5
      });
    }

    // 血管路径定义（弯曲管道中轴点）
    this.initVesselPath();
  }

  /**
   * 初始化主毛细血管路径与细胞安放位
   */
  BloodFlow.prototype.initVesselPath = function() {
    var w = this.width;
    var h = this.height;

    // S 型弯曲的微循环主血管管道
    this.vesselWaypoints = [
      { x: -30, y: h * 0.22 },
      { x: w * 0.25, y: h * 0.22 },
      { x: w * 0.40, y: h * 0.48 },
      { x: w * 0.20, y: h * 0.72 },
      { x: w * 0.65, y: h * 0.75 },
      { x: w * 0.80, y: h * 0.35 },
      { x: w * 0.92, y: h * 0.35 },
      { x: w + 40, y: h * 0.55 }
    ];

    // 血管管径宽度
    this.vesselWidth = Math.max(76, Math.min(108, w * 0.12));

    // 预设细胞适宜附着槽位 (Slots)
    this.slots = [
      { x: w * 0.16, y: h * 0.38, cell: null },
      { x: w * 0.32, y: h * 0.34, cell: null },
      { x: w * 0.28, y: h * 0.60, cell: null },
      { x: w * 0.45, y: h * 0.62, cell: null },
      { x: w * 0.52, y: h * 0.38, cell: null },
      { x: w * 0.68, y: h * 0.56, cell: null },
      { x: w * 0.74, y: h * 0.20, cell: null },
      { x: w * 0.86, y: h * 0.50, cell: null },
      { x: w * 0.58, y: h * 0.86, cell: null }
    ];
  };

  /**
   * 尺寸更新重算（保留已有绑定 cell 的状态）
   */
  BloodFlow.prototype.resize = function(w, h) {
    var oldSlots = this.slots || [];
    this.width = w;
    this.height = h;
    this.initVesselPath();

    // 尽量把原槽位上已有绑定的细胞重新映射回新比例槽位坐标
    for (var i = 0; i < Math.min(oldSlots.length, this.slots.length); i++) {
      if (oldSlots[i].cell) {
        this.slots[i].cell = oldSlots[i].cell;
        this.slots[i].cell.slot = this.slots[i];
        this.slots[i].cell.x = this.slots[i].x;
        this.slots[i].cell.y = this.slots[i].y;
      }
    }
  };

  /**
   * 流场状态推进
   */
  BloodFlow.prototype.update = function(dt, game) {
    // 1. 心跳周期计算
    this.pulseTimer -= dt;
    if (this.pulseTimer <= 0) {
      this.pulseTimer = this.pulseInterval;
      this.pulseWave = 1.0;
      if (window.CellAudio) {
        window.CellAudio.playHeartbeat();
      }
    }

    if (this.pulseWave > 0) {
      this.pulseWave -= dt * 1.5;
      if (this.pulseWave < 0) this.pulseWave = 0;
    }

    // 2. 推动红细胞流体游弋
    var currentPulseBoost = this.pulseWave * 80;
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      p.x += (p.vx + currentPulseBoost) * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;

      // 循环回流边界
      if (p.x > this.width + 40) {
        p.x = -40;
        p.y = Math.random() * this.height;
      }
    }
  };

  /**
   * 获取某坐标点受心跳微流产生的顺流加成
   */
  BloodFlow.prototype.getCurrentFlowBonus = function(x, y) {
    return this.pulseWave * 45;
  };

  /**
   * 绘制血管背景与红细胞微流
   */
  BloodFlow.prototype.drawBackground = function(ctx) {
    ctx.save();

    // 1. 绘制弯曲血管壁基底 (Vessel Lumen)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 血管外壁胶原组织深色光晕
    ctx.beginPath();
    this.traceVesselPath(ctx);
    ctx.lineWidth = this.vesselWidth + 18;
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.stroke();

    // 血管内壁 (Endothelium)
    ctx.beginPath();
    this.traceVesselPath(ctx);
    ctx.lineWidth = this.vesselWidth;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.stroke();

    // 血管内腔微流荧光带
    ctx.beginPath();
    this.traceVesselPath(ctx);
    ctx.lineWidth = this.vesselWidth - 12;
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.12)';
    ctx.stroke();

    // 血管中心线导流虚线
    ctx.beginPath();
    this.traceVesselPath(ctx);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.2)';
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. 绘制槽位基底座 (Cell Sockets)
    for (var s = 0; s < this.slots.length; s++) {
      var slot = this.slots[s];
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = slot.cell ? 'rgba(16, 185, 129, 0.05)' : 'rgba(56, 189, 248, 0.04)';
      ctx.fill();
      ctx.strokeStyle = slot.cell ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 槽位中心点
      if (!slot.cell) {
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.fill();
      }
    }

    // 3. 绘制漂流的红细胞 (Erythrocyte Discs)
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;

      // 椭圆双凹盘
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius, p.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626';
      ctx.fill();

      // 中央微陷凹坑高光
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 0.45, p.radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#991b1b';
      ctx.fill();

      ctx.restore();
    }

    // 4. 心跳全屏红色收缩光波 (Heartbeat Shock)
    if (this.pulseWave > 0.05) {
      ctx.fillStyle = 'rgba(244, 63, 94, ' + (this.pulseWave * 0.12) + ')';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  };

  /**
   * 路径绘制辅助
   */
  BloodFlow.prototype.traceVesselPath = function(ctx) {
    if (this.vesselWaypoints.length < 2) return;
    ctx.moveTo(this.vesselWaypoints[0].x, this.vesselWaypoints[0].y);
    for (var i = 1; i < this.vesselWaypoints.length - 1; i++) {
      var xc = (this.vesselWaypoints[i].x + this.vesselWaypoints[i + 1].x) / 2;
      var yc = (this.vesselWaypoints[i].y + this.vesselWaypoints[i + 1].y) / 2;
      ctx.quadraticCurveTo(this.vesselWaypoints[i].x, this.vesselWaypoints[i].y, xc, yc);
    }
    var last = this.vesselWaypoints[this.vesselWaypoints.length - 1];
    ctx.lineTo(last.x, last.y);
  };

  window.BloodFlow = BloodFlow;

})(window);
