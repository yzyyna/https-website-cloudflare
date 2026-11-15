/**
 * cell-defense: 微血管微流动力学、心跳脉冲与抗体漂移水雷
 * 功能：
 * 1. 血管内红细胞 (Erythrocytes) 与血浆浮游粒子的流体模拟
 * 2. 心跳节律机（每 6 秒一次舒张收缩，推动整场血流涌动）
 * 3. 血管壁弯曲管道与细胞基座槽位渲染（槽位沿管壁生成，自动避开 HUD 遮挡区）
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

    // 血管路径与基座槽位（基于安全可视区计算）
    this.initVesselPath();
  }

  /**
   * 测量安全可视区：排除顶部 HUD 与底部操作台的遮挡
   * 移动端横竖屏切换、桌面缩放窗口后，槽位都不会再被 UI 盖住
   */
  BloodFlow.prototype.measureSafeRect = function() {
    var padX = 14;
    var top = 56;
    var bottom = this.height - 56;

    // 无头/测试环境下没有完整 DOM，直接走兜底值
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      var header = document.querySelector('.hud-header');
      if (header) {
        var hb = header.getBoundingClientRect();
        if (hb && hb.bottom > top) top = hb.bottom;
      }
      var footer = document.querySelector('.hud-footer');
      if (footer) {
        var fb = footer.getBoundingClientRect();
        if (fb && fb.top > 0 && fb.top < bottom) bottom = fb.top;
      }
    }

    // 极端小屏兜底：至少保留 200px 高度的可操作带
    if (bottom - top < 200) {
      var mid = (top + bottom) / 2;
      top = Math.max(6, mid - 100);
      bottom = Math.min(this.height - 6, mid + 100);
    }

    var gap = 16;
    return {
      x0: padX,
      y0: top + gap,
      x1: Math.max(padX + 120, this.width - padX),
      y1: Math.max(top + gap + 180, bottom - gap)
    };
  };

  /**
   * 初始化主毛细血管路径与细胞安放位（全部位于安全可视区内）
   */
  BloodFlow.prototype.initVesselPath = function() {
    var rect = this.measureSafeRect();
    this.safeRect = rect;

    var w = rect.x1 - rect.x0;
    var h = rect.y1 - rect.y0;

    // S 型弯曲的微循环主血管管道（在安全区内蜿蜒，保证敌人始终可见可打）
    this.vesselWaypoints = [
      { x: rect.x0 - 46, y: rect.y0 + h * 0.16 },
      { x: rect.x0 + w * 0.26, y: rect.y0 + h * 0.16 },
      { x: rect.x0 + w * 0.40, y: rect.y0 + h * 0.48 },
      { x: rect.x0 + w * 0.20, y: rect.y0 + h * 0.80 },
      { x: rect.x0 + w * 0.66, y: rect.y0 + h * 0.82 },
      { x: rect.x0 + w * 0.82, y: rect.y0 + h * 0.46 },
      { x: rect.x1 + 46, y: rect.y0 + h * 0.28 }
    ];

    // 血管管径宽度（按屏宽自适应，小屏不臃肿）
    this.vesselWidth = Math.max(64, Math.min(104, w * 0.13));

    this.buildSlots();
  };

  /**
   * 把贝塞尔控制点密集采样为带切线方向的折线
   */
  BloodFlow.prototype.samplePolyline = function(pts, step) {
    var poly = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var d = Math.hypot(b.x - a.x, b.y - a.y);
      var steps = Math.max(2, Math.ceil(d / step));
      for (var s = 0; s < steps; s++) {
        var t = s / steps;
        poly.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          tx: (b.x - a.x) / (d || 1),
          ty: (b.y - a.y) / (d || 1)
        });
      }
    }
    var last = pts[pts.length - 1];
    poly.push({ x: last.x, y: last.y, tx: 1, ty: 0 });
    return poly;
  };

  /**
   * 沿血管管壁生成细胞基座槽位：交替分布于管道两侧，采样后用松弛迭代保证最小间距
   */
  BloodFlow.prototype.buildSlots = function() {
    var rect = this.safeRect;
    var poly = this.samplePolyline(this.vesselWaypoints, 22);

    // 槽位数量按可视区短边推导：小屏 8 个，大屏最多 14 个
    var minDim = Math.min(rect.x1 - rect.x0, rect.y1 - rect.y0);
    var slotCount = Math.max(8, Math.min(14, Math.round(minDim / 82)));
    var minGap = minDim < 520 ? 52 : 74;
    var margin = 34;
    var offset = this.vesselWidth * 0.62 + 26;

    var clampX = function(v) { return Math.max(rect.x0 + margin, Math.min(rect.x1 - margin, v)); };
    var clampY = function(v) { return Math.max(rect.y0 + margin, Math.min(rect.y1 - margin, v)); };

    var startIdx = Math.floor(poly.length * 0.06);
    var endIdx = Math.floor(poly.length * 0.94);
    var span = Math.max(1, endIdx - startIdx);

    var slots = [];
    var k, p, side, nx, ny, wobble, idx, jitter;
    for (k = 0; k < slotCount; k++) {
      // 均匀采样 + 轻微抖动，避免呆板的等距直线
      jitter = ((k * 37) % 11) / 11 - 0.5;
      idx = Math.round(startIdx + span * ((k + 0.5) / slotCount) + jitter * (span / slotCount) * 0.5);
      idx = Math.max(startIdx, Math.min(endIdx, idx));
      p = poly[idx];

      // 管道法线方向，交替左右两侧布点
      side = (k % 2 === 0) ? 1 : -1;
      nx = -p.ty * side;
      ny = p.tx * side;
      wobble = 0.8 + (((k * 53) % 7) / 7) * 0.5;

      slots.push({
        x: clampX(p.x + nx * offset * wobble),
        y: clampY(p.y + ny * offset * wobble),
        cell: null
      });
    }

    // 松弛迭代：把相距小于 minGap 的槽位成对推开，再夹回安全区，直到全部满足间距
    var iter, i, j, a, b, dx, dy, d, push, moved;
    for (iter = 0; iter < 16; iter++) {
      moved = false;
      for (i = 0; i < slots.length; i++) {
        for (j = i + 1; j < slots.length; j++) {
          a = slots[i];
          b = slots[j];
          dx = b.x - a.x;
          dy = b.y - a.y;
          d = Math.hypot(dx, dy);
          if (d >= minGap) continue;
          if (d < 0.001) { dx = 1; dy = 0; d = 1; }
          push = (minGap - d) * 0.5;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
          moved = true;
        }
      }
      for (i = 0; i < slots.length; i++) {
        slots[i].x = clampX(slots[i].x);
        slots[i].y = clampY(slots[i].y);
      }
      if (!moved) break;
    }

    this.slots = slots;
  };

  /**
   * 尺寸更新重算：重排血管与槽位，并把已有细胞重新绑定到最近新槽位
   */
  BloodFlow.prototype.resize = function(w, h) {
    var oldCells = [];
    if (this.slots) {
      for (var i = 0; i < this.slots.length; i++) {
        if (this.slots[i].cell) oldCells.push(this.slots[i].cell);
      }
    }

    this.width = w;
    this.height = h;
    this.initVesselPath();

    // 已有细胞按距离重绑到新槽位，避免缩放后悬空或丢失基座
    for (var c = 0; c < oldCells.length; c++) {
      var cell = oldCells[c];
      var best = null;
      var bestD = Infinity;
      for (var s = 0; s < this.slots.length; s++) {
        var sl = this.slots[s];
        if (sl.cell) continue;
        var d = Math.hypot(sl.x - cell.x, sl.y - cell.y);
        if (d < bestD) {
          bestD = d;
          best = sl;
        }
      }
      if (best) {
        best.cell = cell;
        cell.slot = best;
        cell.x = best.x;
        cell.y = best.y;
      } else {
        cell.slot = null;
        // 无空槽时约束回安全区内，防止被 HUD 遮挡
        cell.x = Math.max(this.safeRect.x0 + 34, Math.min(this.safeRect.x1 - 34, cell.x));
        cell.y = Math.max(this.safeRect.y0 + 34, Math.min(this.safeRect.y1 - 34, cell.y));
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
    var pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.5;
    for (var s = 0; s < this.slots.length; s++) {
      var slot = this.slots[s];
      var empty = !slot.cell;
      // 空槽呼吸光环：明确告诉玩家「这里可以放」
      if (empty) {
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 20 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, ' + (0.05 + pulse * 0.05) + ')';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(slot.x, slot.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = empty ? 'rgba(56, 189, 248, 0.04)' : 'rgba(16, 185, 129, 0.05)';
      ctx.fill();
      ctx.strokeStyle = empty ? 'rgba(56, 189, 248, ' + (0.24 + pulse * 0.16) + ')' : 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = empty ? 1.6 : 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 槽位中心点
      if (empty) {
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
    if (!this.vesselWaypoints || this.vesselWaypoints.length < 2) return;
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
