/**
 * cell-defense: 生物软体细胞模拟、伪足物理及吞噬消化系统
 * 特性：
 * 1. 动态变形虫细胞膜（正弦扰动 + 样条插值闭合）
 * 2. 伪足（Pseudopod）向猎物物理延伸
 * 3. 内部液泡吞噬（Vacuole Phagocytosis）与溶酶体消化代谢
 * 4. 融合突变星级（Tier 1 -> Tier 2 -> Tier 3）
 */
(function(window) {
  'use strict';

  // 基础配置表
  var CELL_CONFIGS = {
    macrophage: {
      name: '巨噬细胞',
      title: '吞噬巨兽',
      cost: 60,
      radius: 28,
      range: 110,
      color: '#10b981',
      nucleusColor: '#059669',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      desc: '伸出柔性伪足卷入病菌，消化后产出巨额 ATP',
      maxSwallow: 3,
      digestTime: 2.5
    },
    neutrophil: {
      name: '中性粒',
      title: '溶菌先锋',
      cost: 80,
      radius: 22,
      range: 160,
      color: '#06b6d4',
      nucleusColor: '#0284c7',
      glowColor: 'rgba(6, 182, 212, 0.45)',
      desc: '高频喷吐溶菌酶酸液飞沫，阵亡时化为 DNA 黏阻网',
      fireRate: 0.6,
      damage: 26
    },
    dendritic: {
      name: '树突细胞',
      title: '抗原雷达',
      cost: 100,
      radius: 24,
      range: 220,
      color: '#f59e0b',
      nucleusColor: '#d97706',
      glowColor: 'rgba(245, 158, 11, 0.45)',
      desc: '向外发散神经元式长突触，破除隐形并使周围友军伤害 +120%',
      boostMult: 2.2
    },
    bcell: {
      name: 'B淋巴细胞',
      title: '抗体工厂',
      cost: 120,
      radius: 25,
      range: 190,
      color: '#a855f7',
      nucleusColor: '#7e22ce',
      glowColor: 'rgba(168, 85, 247, 0.45)',
      desc: '向四周释放随血液漂移的 Y 型抗体水雷，大面积锁死病毒',
      fireRate: 1.2
    },
    nkcell: {
      name: 'NK杀手',
      title: '穿孔裂解者',
      cost: 150,
      radius: 26,
      range: 140,
      color: '#ec4899',
      nucleusColor: '#be185d',
      glowColor: 'rgba(236, 72, 153, 0.45)',
      desc: '注入高能穿孔素，使目标瞬间内爆并对周围产生范围殉爆',
      fireRate: 1.5,
      damage: 130
    }
  };

  /**
   * 单体细胞构造函数
   */
  function Cell(type, x, y, tier) {
    this.id = 'cell_' + Math.random().toString(36).substr(2, 9);
    this.type = type;
    this.tier = tier || 1; // 1: 基础, 2: 突变体, 3: 终极体
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    
    var conf = CELL_CONFIGS[type];
    this.baseRadius = conf.radius * (1 + (this.tier - 1) * 0.28);
    this.radius = this.baseRadius;
    this.range = conf.range * (1 + (this.tier - 1) * 0.2);
    this.color = conf.color;
    this.nucleusColor = conf.nucleusColor;
    this.glowColor = conf.glowColor;

    // 软体扰动控制点 (12个顶点平滑闭合)
    this.pointCount = 12;
    this.phases = [];
    for (var i = 0; i < this.pointCount; i++) {
      this.phases.push(Math.random() * Math.PI * 2);
    }
    this.breathTime = Math.random() * 10;

    // 伪足伸展系统（主要供巨噬细胞和树突细胞）
    this.pseudopods = []; // { targetEnemy, progress: 0~1, returning: false }

    // 巨噬细胞体内消化泡队列 (Phagosome Vacuoles)
    this.digestingViruses = []; // { name, timer, maxTime, color }
    this.maxSwallow = (conf.maxSwallow || 3) + (this.tier - 1) * 2;
    this.digestTime = Math.max(1.0, (conf.digestTime || 2.5) - (this.tier - 1) * 0.5);

    // 冷却计时器
    this.cooldown = 0;
    this.isDragging = false;
    this.isHovered = false;

    // 细胞状态
    this.hp = 100 * this.tier;
    this.maxHp = this.hp;
  }

  /**
   * 更新细胞状态
   */
  Cell.prototype.update = function(dt, game) {
    this.breathTime += dt * 2.5;

    // 消化饱胀形变反馈
    var digestionCount = this.digestingViruses.length;
    var swellFactor = 1 + digestionCount * 0.15;
    this.radius = this.baseRadius * swellFactor;

    // 1. 巨噬细胞：处理体内的消化泡 (Vacuoles)
    if (this.type === 'macrophage' && digestionCount > 0) {
      var digestSpeedMult = (game.adrenalineActive ? 2.5 : 1.0) * (game.activeMutations.m_turbo_digest ? 1.5 : 1.0);
      for (var d = this.digestingViruses.length - 1; d >= 0; d--) {
        var vac = this.digestingViruses[d];
        vac.timer -= dt * digestSpeedMult;
        if (vac.timer <= 0) {
          // 消化完成：产出 ATP 与 基因
          this.digestingViruses.splice(d, 1);
          var atpReward = Math.round((vac.reward || 12) * this.tier * (game.activeMutations.m_turbo_digest ? 1.2 : 1.0));
          var dnaReward = Math.random() < 0.4 ? 1 : 0;
          game.addATP(atpReward, this.x, this.y);
          if (dnaReward > 0) game.addDNA(dnaReward, this.x, this.y);
          if (window.CellAudio) window.CellAudio.playDigest();
          game.createFloatingText('+' + atpReward + '⚡', this.x, this.y - 15, '#34d399');
        }
      }
    }

    // 2. 伪足物理延伸与回收
    if (this.pseudopods.length > 0) {
      for (var p = this.pseudopods.length - 1; p >= 0; p--) {
        var pod = this.pseudopods[p];
        if (!pod.returning) {
          pod.progress += dt * 3.8;
          if (pod.progress >= 1.0) {
            pod.progress = 1.0;
            pod.returning = true;
            // 抓到猎物，卷入体内
            if (pod.targetEnemy && !pod.targetEnemy.dead) {
              this.swallowEnemy(pod.targetEnemy, game);
            }
          }
        } else {
          pod.progress -= dt * 4.2;
          if (pod.progress <= 0) {
            this.pseudopods.splice(p, 1);
          }
        }
      }
    }

    // 冷却推进
    if (this.cooldown > 0) {
      this.cooldown -= dt * (game.adrenalineActive ? 2.0 : 1.0);
    }

    // 战斗逻辑
    if (!this.isDragging) {
      this.act(dt, game);
    }
  };

  /**
   * 细胞攻击/运作逻辑
   */
  Cell.prototype.act = function(dt, game) {
    var enemies = game.enemies;
    if (!enemies || enemies.length === 0) return;

    // 1. 巨噬细胞：寻找范围内的非隐身、非巨型 Boss 敌人伸出伪足吞噬
    if (this.type === 'macrophage') {
      if (this.digestingViruses.length < this.maxSwallow && this.cooldown <= 0) {
        var target = this.findNearestEnemy(enemies, this.range, function(e) {
          return !e.beingSwallowed && !e.dead && !e.isBoss && !e.stealth;
        });
        if (target) {
          target.beingSwallowed = true;
          this.pseudopods.push({
            targetEnemy: target,
            destX: target.x,
            destY: target.y,
            progress: 0,
            returning: false
          });
          this.cooldown = 0.4;
          if (window.CellAudio) window.CellAudio.playSwallow();
        }
      }
    }
    // 2. 中性粒细胞：高频喷吐溶菌酶酸液 (不可瞄准未破隐的潜伏敌人)
    else if (this.type === 'neutrophil') {
      if (this.cooldown <= 0) {
        var targetN = this.findNearestEnemy(enemies, this.range, function(e) { return !e.dead && !e.stealth; });
        if (targetN) {
          this.shootAcid(targetN, game);
          this.cooldown = CELL_CONFIGS.neutrophil.fireRate / (this.tier * 0.7);
        }
      }
    }
    // 3. 树突细胞：常态扫描周围敌人并赋予抗原标记（破隐并提供易伤增幅）
    else if (this.type === 'dendritic') {
      var scanRange = this.range * (game.activeMutations.m_dendritic_aura ? 1.3 : 1.0);
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.dead) {
          var dist = Math.hypot(e.x - this.x, e.y - this.y);
          if (dist <= scanRange) {
            e.markedTimer = 0.5; // 标记持续时间
            e.boostMult = CELL_CONFIGS.dendritic.boostMult * this.tier;
            e.stealth = false; // 破隐
            if (game.activeMutations.m_dendritic_aura) {
              e.slowTimer = Math.max(e.slowTimer, 0.4);
            }
          }
        }
      }
    }
    // 4. B淋巴细胞：生产抗体水雷，顺血液漂移
    else if (this.type === 'bcell') {
      if (this.cooldown <= 0) {
        var targetB = this.findNearestEnemy(enemies, this.range, function(e) { return !e.dead && !e.stealth; });
        if (targetB) {
          this.shootAntibody(targetB, game);
          this.cooldown = CELL_CONFIGS.bcell.fireRate;
        }
      }
    }
    // 5. NK 细胞：为目标注入高能穿孔素
    else if (this.type === 'nkcell') {
      if (this.cooldown <= 0) {
        var targetK = this.findNearestEnemy(enemies, this.range, function(e) { return !e.dead && !e.stealth; });
        if (targetK) {
          this.firePerforin(targetK, game);
          this.cooldown = CELL_CONFIGS.nkcell.fireRate;
        }
      }
    }
  };

  /**
   * 巨噬细胞把敌人完全吸入体内消化
   */
  Cell.prototype.swallowEnemy = function(enemy, game) {
    if (enemy.dead) return;
    enemy.dead = true;
    var reward = enemy.maxHp >= 100 ? 25 : 12;
    this.digestingViruses.push({
      name: enemy.type,
      timer: this.digestTime,
      maxTime: this.digestTime,
      color: enemy.color,
      radius: Math.min(enemy.radius, 12),
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * (this.radius * 0.5),
      reward: reward
    });
    game.stats.swallowed++;
    game.createSparks(this.x, this.y, 8, '#34d399');
  };

  /**
   * 中性粒细胞喷吐酸液弹
   */
  Cell.prototype.shootAcid = function(target, game) {
    var dmg = CELL_CONFIGS.neutrophil.damage * this.tier;
    game.addProjectile({
      type: 'acid',
      x: this.x,
      y: this.y,
      target: target,
      speed: 380,
      damage: dmg,
      color: '#06b6d4',
      radius: 4 + this.tier
    });
    if (window.CellAudio) window.CellAudio.playAcid();
  };

  /**
   * B淋巴细胞发射抗体
   */
  Cell.prototype.shootAntibody = function(target, game) {
    var baseCount = this.tier >= 2 ? 2 : 1;
    var count = baseCount + (game.activeMutations.m_y_cluster ? 1 : 0);
    var lifetime = game.activeMutations.m_y_cluster ? 7.0 : 4.5;
    for (var k = 0; k < count; k++) {
      var angleOffset = (k - (count - 1) / 2) * 0.35;
      game.addProjectile({
        type: 'antibody',
        x: this.x,
        y: this.y,
        target: target,
        angleOffset: angleOffset,
        speed: 260,
        damage: 18 * this.tier,
        color: '#a855f7',
        life: lifetime,
        driftWithBlood: true // 具备沿血液微流漂移特性
      });
    }
    if (window.CellAudio) window.CellAudio.playAntibody();
  };

  /**
   * NK 细胞注入穿孔素
   */
  Cell.prototype.firePerforin = function(target, game) {
    var dmg = CELL_CONFIGS.nkcell.damage * this.tier;
    var wasAlive = !target.dead;
    target.takeDamage(dmg, game, 'perforin');
    game.createSparks(target.x, target.y, 16, '#ec4899');
    game.createShockwave(target.x, target.y, 35, '#ec4899');
    if (window.CellAudio) window.CellAudio.playPerforin();

    // 穿孔连锁裂解协议 (m_perforin_chain)
    if (game.activeMutations.m_perforin_chain && wasAlive && target.dead) {
      var chained = 0;
      for (var i = 0; i < game.enemies.length; i++) {
        var e = game.enemies[i];
        if (e !== target && !e.dead && !e.stealth && Math.hypot(e.x - target.x, e.y - target.y) <= 120) {
          e.takeDamage(dmg * 0.45, game, 'perforin_chain');
          game.createSparks(e.x, e.y, 10, '#ec4899');
          chained++;
          if (chained >= 2) break;
        }
      }
    }
  };

  /**
   * 寻找范围内最近的敌人
   */
  Cell.prototype.findNearestEnemy = function(enemies, maxRange, filterFn) {
    var best = null;
    var bestDist = maxRange;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (filterFn && !filterFn(e)) continue;
      var d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  };

  /**
   * 绘制细胞自身（阿米巴柔性外膜 + 细胞核 + 伪足 + 消化泡）
   */
  Cell.prototype.draw = function(ctx) {
    ctx.save();

    // 1. 绘制射程圈 (选中/悬停时高亮)
    if (this.isHovered || this.isDragging) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.fillStyle = this.glowColor.replace('0.45', '0.08');
      ctx.fill();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. 绘制树突细胞向四周伸展的细长触手 (Dendritic Spines)
    if (this.type === 'dendritic') {
      var spineCount = 8 + this.tier * 2;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.8;
      for (var s = 0; s < spineCount; s++) {
        var baseAng = (s / spineCount) * Math.PI * 2;
        var wobble = Math.sin(this.breathTime * 1.5 + s) * 0.15;
        var len = this.radius * 1.8 + Math.cos(this.breathTime + s * 2) * 6;
        var ex = this.x + Math.cos(baseAng + wobble) * len;
        var ey = this.y + Math.sin(baseAng + wobble) * len;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.quadraticCurveTo(
          this.x + Math.cos(baseAng) * (len * 0.5),
          this.y + Math.sin(baseAng) * (len * 0.5) + Math.sin(this.breathTime) * 4,
          ex, ey
        );
        ctx.stroke();

        // 触突尖端亮核
        ctx.beginPath();
        ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fde68a';
        ctx.fill();
      }
    }

    // 3. 绘制正在捕食的伪足 (Pseudopods)
    if (this.pseudopods.length > 0) {
      for (var p = 0; p < this.pseudopods.length; p++) {
        var pod = this.pseudopods[p];
        var curX = this.x + (pod.destX - this.x) * pod.progress;
        var curY = this.y + (pod.destY - this.y) * pod.progress;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        // 伪足波浪弯曲
        var midX = (this.x + curX) * 0.5 + Math.sin(this.breathTime * 3) * 12;
        var midY = (this.y + curY) * 0.5 + Math.cos(this.breathTime * 3) * 12;
        ctx.quadraticCurveTo(midX, midY, curX, curY);
        ctx.lineWidth = 8 * (1 - pod.progress * 0.4);
        ctx.strokeStyle = this.color;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 伪足末端张开的杯口 (Phagocytic Cup)
        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#6ee7b7';
        ctx.fill();
      }
    }

    // 4. 计算阿米巴细胞膜 12 点样条
    var points = [];
    var step = (Math.PI * 2) / this.pointCount;
    for (var i = 0; i < this.pointCount; i++) {
      var angle = i * step;
      // 正弦扰动模拟生物细胞质流动
      var rOffset = Math.sin(this.breathTime + this.phases[i]) * (this.radius * 0.12);
      var currentR = this.radius + rOffset;
      points.push({
        x: this.x + Math.cos(angle) * currentR,
        y: this.y + Math.sin(angle) * currentR
      });
    }

    // 绘制细胞膜与外发光
    ctx.beginPath();
    ctx.moveTo((points[0].x + points[this.pointCount - 1].x) / 2, (points[0].y + points[this.pointCount - 1].y) / 2);
    for (var j = 0; j < this.pointCount; j++) {
      var nextIndex = (j + 1) % this.pointCount;
      var midPtX = (points[j].x + points[nextIndex].x) / 2;
      var midPtY = (points[j].y + points[nextIndex].y) / 2;
      ctx.quadraticCurveTo(points[j].x, points[j].y, midPtX, midPtY);
    }
    ctx.closePath();

    // 渐变细胞质填充
    var grad = ctx.createRadialGradient(
      this.x - this.radius * 0.2, this.y - this.radius * 0.2, this.radius * 0.1,
      this.x, this.y, this.radius * 1.1
    );
    grad.addColorStop(0, this.color);
    grad.addColorStop(0.7, this.nucleusColor);
    grad.addColorStop(1, '#021815');
    ctx.fillStyle = grad;
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = this.isHovered ? 20 : 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 5. 内部细胞核 (Nucleus)
    ctx.beginPath();
    var nucR = this.radius * 0.38;
    var nucX = this.x + Math.cos(this.breathTime * 0.8) * 2.5;
    var nucY = this.y + Math.sin(this.breathTime * 0.8) * 2.5;
    ctx.arc(nucX, nucY, nucR, 0, Math.PI * 2);
    ctx.fillStyle = this.nucleusColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 6. 体内消化泡 (Vacuoles)
    if (this.digestingViruses.length > 0) {
      for (var v = 0; v < this.digestingViruses.length; v++) {
        var vac = this.digestingViruses[v];
        var vx = this.x + Math.cos(vac.angle + this.breathTime * 0.5) * (vac.dist + 6);
        var vy = this.y + Math.sin(vac.angle + this.breathTime * 0.5) * (vac.dist + 6);
        
        ctx.beginPath();
        ctx.arc(vx, vy, vac.radius, 0, Math.PI * 2);
        ctx.fillStyle = vac.color || '#ef4444';
        ctx.globalAlpha = 0.75 * (vac.timer / vac.maxTime);
        ctx.fill();

        // 消化液泡外圈 (溶酶体酸泡)
        ctx.beginPath();
        ctx.arc(vx, vy, vac.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#a7f3d0';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    // 7. 突变等阶标志 (Tier Stars)
    if (this.tier > 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      var stars = this.tier === 2 ? '★★' : '★★★';
      ctx.fillText(stars, this.x, this.y - this.radius - 6);
    }

    ctx.restore();
  };

  window.Cell = Cell;
  window.CELL_CONFIGS = CELL_CONFIGS;

})(window);
