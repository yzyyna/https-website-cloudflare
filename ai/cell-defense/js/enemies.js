/**
 * cell-defense: 病原体生态系统与血管沿线游走 AI
 * 涵盖：
 * 1. 冠状流感病毒 (Influenza) - 高速穿梭，刺突分生
 * 2. 耐药金黄色葡萄球菌 (MRSA) - 蜡质生物厚壳
 * 3. 拟态幽灵衣原体 (Chlamydia) - 隐身潜伏
 * 4. 巨型线虫幼虫 (Giant Helminth Boss) - 庞大体躯，多段肢节
 */
(function(window) {
  'use strict';

  var ENEMY_CONFIGS = {
    influenza: {
      name: '刺突流感病毒',
      speed: 75,
      hp: 65,
      radius: 12,
      color: '#f43f5e',
      glow: 'rgba(244, 63, 94, 0.5)',
      dnaDrop: 0.35,
      reward: 10
    },
    mrsa: {
      name: '耐药金葡菌',
      speed: 45,
      hp: 190,
      radius: 16,
      color: '#eab308',
      glow: 'rgba(234, 179, 8, 0.5)',
      armor: 0.3, // 减免 30% 普通酸液伤害
      dnaDrop: 0.6,
      reward: 20
    },
    chlamydia: {
      name: '幽灵衣原体',
      speed: 85,
      hp: 55,
      radius: 11,
      color: '#c084fc',
      glow: 'rgba(192, 132, 252, 0.5)',
      stealth: true,
      dnaDrop: 0.5,
      reward: 15
    },
    helminth_boss: {
      name: '寄生巨虫·母体',
      speed: 32,
      hp: 1400,
      radius: 36,
      color: '#fb7185',
      glow: 'rgba(251, 113, 133, 0.7)',
      isBoss: true,
      dnaDrop: 1.0,
      reward: 120
    }
  };

  /**
   * 病原体构造函数
   */
  function Enemy(type, path) {
    this.id = 'enemy_' + Math.random().toString(36).substr(2, 9);
    this.type = type;
    var conf = ENEMY_CONFIGS[type];
    this.conf = conf;
    this.name = conf.name;
    this.maxHp = conf.hp;
    this.hp = this.maxHp;
    this.baseSpeed = conf.speed;
    this.speed = this.baseSpeed;
    this.radius = conf.radius;
    this.color = conf.color;
    this.glow = conf.glow;
    this.isBoss = !!conf.isBoss;
    this.armor = conf.armor || 0;
    this.stealth = !!conf.stealth;

    // 路径移动
    this.path = path || [];
    this.currentWaypointIndex = 0;
    this.x = this.path.length > 0 ? this.path[0].x : 0;
    this.y = this.path.length > 0 ? this.path[0].y : 0;

    // 状态机制
    this.dead = false;
    this.beingSwallowed = false;
    this.markedTimer = 0; // 树突标记
    this.boostMult = 1.0;
    this.slowTimer = 0;
    this.feverTimer = 0; // 高热发烧减速

    // 视觉振荡与刺突
    this.animTime = Math.random() * 10;
    this.spikes = Math.floor(Math.random() * 4) + 8; // 刺突数量

    // Boss 多节身体模拟
    if (this.isBoss) {
      this.segments = [];
      for (var s = 0; s < 6; s++) {
        this.segments.push({ x: this.x, y: this.y, radius: this.radius * (1 - s * 0.12) });
      }
    }
  }

  /**
   * 状态推进与寻路
   */
  Enemy.prototype.update = function(dt, game) {
    if (this.dead || this.beingSwallowed) return;

    this.animTime += dt * 3.5;

    // 标记减速状态恢复
    if (this.markedTimer > 0) {
      this.markedTimer -= dt;
      if (this.markedTimer <= 0) {
        this.boostMult = 1.0;
        if (this.conf.stealth) this.stealth = true;
      }
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
    }
    if (this.feverTimer > 0) {
      this.feverTimer -= dt;
    }

    // 速度计算（基础 + 发热技能减速 + 心跳微流推进）
    var speedMult = 1.0;
    if (this.slowTimer > 0) speedMult *= 0.55;
    if (this.feverTimer > 0 || game.feverActive) speedMult *= 0.35;
    
    // 心跳涌流额外推力 (顺流加速)
    var pulseBonus = game.bloodFlow ? game.bloodFlow.getCurrentFlowBonus(this.x, this.y) : 0;
    var currentSpeed = (this.baseSpeed * speedMult) + pulseBonus;

    // 路径移动
    if (this.path && this.currentWaypointIndex < this.path.length) {
      var targetPt = this.path[this.currentWaypointIndex];
      var dx = targetPt.x - this.x;
      var dy = targetPt.y - this.y;
      var dist = Math.hypot(dx, dy);
      var moveStep = currentSpeed * dt;

      if (dist <= moveStep) {
        this.x = targetPt.x;
        this.y = targetPt.y;
        this.currentWaypointIndex++;
        // 到达末端感染宿主核心
        if (this.currentWaypointIndex >= this.path.length) {
          this.reachEnd(game);
          return;
        }
      } else {
        this.x += (dx / dist) * moveStep;
        this.y += (dy / dist) * moveStep;
      }
    }

    // Boss 关节跟随平滑物理
    if (this.isBoss && this.segments) {
      var prevX = this.x;
      var prevY = this.y;
      for (var s = 0; s < this.segments.length; s++) {
        var seg = this.segments[s];
        var sx = prevX - seg.x;
        var sy = prevY - seg.y;
        var sdist = Math.hypot(sx, sy);
        var targetDist = 18;
        if (sdist > targetDist) {
          seg.x += (sx / sdist) * (sdist - targetDist) * 0.45;
          seg.y += (sy / sdist) * (sdist - targetDist) * 0.45;
        }
        prevX = seg.x;
        prevY = seg.y;
      }
    }
  };

  /**
   * 承受伤害
   */
  Enemy.prototype.takeDamage = function(amount, game, damageType) {
    if (this.dead) return;

    var finalDamage = amount;
    // 树突标记易伤加成
    if (this.markedTimer > 0) {
      finalDamage *= this.boostMult;
    }
    // 金葡菌物理/生化护甲减免
    if (this.armor > 0 && damageType !== 'perforin') {
      finalDamage *= (1 - this.armor);
    }

    this.hp -= finalDamage;

    // 弹出飘字
    game.createFloatingText('-' + Math.round(finalDamage), this.x, this.y - 10, '#f87171');

    if (this.hp <= 0) {
      this.hp = 0;
      this.die(game);
    }
  };

  /**
   * 阵亡并结算掉落
   */
  Enemy.prototype.die = function(game) {
    if (this.dead) return;
    this.dead = true;

    // 粒子火花
    game.createSparks(this.x, this.y, this.isBoss ? 35 : 12, this.color);
    if (this.isBoss) {
      game.createShockwave(this.x, this.y, 60, '#fb7185');
    }

    // 结算 ATP 与 RNA 掉落
    game.addATP(this.conf.reward, this.x, this.y);
    if (Math.random() < this.conf.dnaDrop) {
      game.addDNA(1, this.x, this.y);
    }

    game.stats.killed++;
  };

  /**
   * 到达防线终点，侵染宿主
   */
  Enemy.prototype.reachEnd = function(game) {
    this.dead = true;
    var damage = this.isBoss ? 30 : 8;
    game.damageHealth(damage);
    game.createShockwave(this.x, this.y, 45, '#ef4444');
    if (window.CellAudio) window.CellAudio.playHurt();
  };

  /**
   * 绘制病原体外形（刺突、膜蛋白与荧光显微镜光影）
   */
  Enemy.prototype.draw = function(ctx) {
    if (this.dead || this.beingSwallowed) return;

    ctx.save();

    // 隐身幽灵半透明
    if (this.stealth) {
      ctx.globalAlpha = 0.18;
    }

    // 1. Boss 身体节段绘制
    if (this.isBoss && this.segments) {
      for (var s = this.segments.length - 1; s >= 0; s--) {
        var seg = this.segments[s];
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#9f1239';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 2. 刺突流感病毒绘制 (Spike Glycoprotein)
    if (this.type === 'influenza') {
      // 辐射刺突
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.8;
      for (var k = 0; k < this.spikes; k++) {
        var ang = (k / this.spikes) * Math.PI * 2 + Math.sin(this.animTime) * 0.1;
        var len = this.radius * 1.5;
        var sx = this.x + Math.cos(ang) * len;
        var sy = this.y + Math.sin(ang) * len;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // 刺突末梢球体 (S-Protein)
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fda4af';
        ctx.fill();
      }
    }

    // 3. 病毒核心圆
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.glow;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. 树突抗原标记荧光环
    if (this.markedTimer > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. 血条 (非满血或 Boss 始终显示)
    if (this.hp < this.maxHp || this.isBoss) {
      var barW = Math.max(22, this.radius * 2);
      var barH = 3.5;
      var bx = this.x - barW / 2;
      var by = this.y - this.radius - 8;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(bx, by, barW, barH);

      var pct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = pct > 0.4 ? '#22c55e' : '#ef4444';
      ctx.fillRect(bx, by, barW * pct, barH);
    }

    ctx.restore();
  };

  window.Enemy = Enemy;
  window.ENEMY_CONFIGS = ENEMY_CONFIGS;

})(window);
