/**
 * cell-defense: 游戏核心控制器 (主循环、拖拽融合、神谕技能、波次调度与交互)
 */
(function(window) {
  'use strict';

  // 变异协议池 (Rogue 进化随机库)
  var MUTATION_POOL = [
    { id: 'm_turbo_digest', name: '极速溶酶体', icon: '⚡', desc: '巨噬细胞消化速度提升 50%，产出额外 +20% ATP' },
    { id: 'm_acid_splash', name: '强酸飞溅', icon: '🧪', desc: '中性粒细胞酸液命中时产生 30px 半径范围腐蚀' },
    { id: 'm_y_cluster', name: '多联重抗体', icon: '🧬', desc: 'B淋巴细胞每次多发射一枚抗体水雷，且寿命延长 40%' },
    { id: 'm_dendritic_aura', name: '神经脉冲共振', icon: '📡', desc: '树突细胞抗原扫描半径扩大 30%，附带 20% 减速' },
    { id: 'm_perforin_chain', name: '穿孔连锁裂解', icon: '💥', desc: 'NK杀手消灭目标时，向最近 2 个敌人弹射微型穿孔素' },
    { id: 'm_heart_rush', name: '心肌强韧', icon: '❤️', desc: '心跳微流带来更强推力，且组织活性上限提升 +20 点' }
  ];

  function Game() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // 基础资源与数值
    this.atp = 150;
    this.dna = 0;
    this.health = 100;
    this.maxHealth = 100;

    // 波次管理
    this.wave = 1;
    this.maxWaves = 10;
    this.waveActive = false;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.enemiesToSpawn = [];

    // 游戏倍速与暂停
    this.timeScale = 1.0;
    this.isPaused = false;
    this.isOver = false;

    // 实体容器
    this.cells = [];
    this.enemies = [];
    this.projectiles = [];
    this.sparks = [];
    this.floatingTexts = [];
    this.shockwaves = [];

    // 技能与神谕
    this.adrenalineActive = false;
    this.adrenalineTimer = 0;
    this.feverActive = false;
    this.feverTimer = 0;
    this.interferonActive = false;
    this.interferonTimer = 0;

    this.skills = {
      adrenaline: { cd: 15, currentCd: 0 },
      fever: { cd: 20, currentCd: 0 },
      interferon: { cd: 25, currentCd: 0 }
    };

    // 活跃已选的 Rogue 突变协议
    this.activeMutations = {};

    // 统计
    this.stats = {
      swallowed: 0,
      killed: 0,
      wavesCompleted: 0
    };

    // 拖拽与安放机制
    this.selectedCellType = null;
    this.draggingCell = null;
    this.dragOffset = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0, down: false };

    // 首次对局引导（每步只提示一次）
    this.onboardSeen = {};
    this.onboardHintTimer = null;

    // 拖拽融合时的候选高亮目标
    this.mergeTarget = null;

    // 初始化微流管道系统
    this.bloodFlow = new window.BloodFlow(window.innerWidth, window.innerHeight);

    this.initCanvas();
    this.bindEvents();
    this.renderAvatars();
    this.updateHUD();
    this.refreshResumeEntry();

    // 启动帧循环
    this.lastTime = performance.now();
    var self = this;
    requestAnimationFrame(function(t) { self.loop(t); });
  }

  /**
   * 画布全屏自适应与 DPR 设置
   */
  Game.prototype.initCanvas = function() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    if (this.bloodFlow) {
      this.bloodFlow.resize(this.width, this.height);
    }
  };

  /**
   * 启动关卡波次
   */
  Game.prototype.startWave = function() {
    this.waveActive = true;
    this.enemiesToSpawn = [];

    // 生成波次敌人序列
    var count = 6 + this.wave * 4;
    var hasBoss = this.wave % 5 === 0;

    for (var i = 0; i < count; i++) {
      var r = Math.random();
      var type = 'influenza';
      if (this.wave >= 2 && r > 0.6) type = 'mrsa';
      if (this.wave >= 3 && r > 0.85) type = 'chlamydia';
      this.enemiesToSpawn.push({
        type: type,
        delay: i * (1.8 - Math.min(1.0, this.wave * 0.08))
      });
    }

    if (hasBoss) {
      this.enemiesToSpawn.push({
        type: 'helminth_boss',
        delay: count * 1.2
      });
    }

    this.spawnTimer = 0;
    this.updateHUD();
  };

  /**
   * 主循环更新
   */
  Game.prototype.update = function(dt) {
    if (this.isPaused || this.isOver) return;

    var gameDt = dt * this.timeScale;

    // 1. 神谕技能计时推进
    this.updateSkills(gameDt);

    // 2. 血液微流场更新
    this.bloodFlow.update(gameDt, this);

    // 3. 敌人生成队列调度
    if (this.waveActive && this.enemiesToSpawn.length > 0) {
      this.spawnTimer += gameDt;
      for (var s = this.enemiesToSpawn.length - 1; s >= 0; s--) {
        if (this.spawnTimer >= this.enemiesToSpawn[s].delay) {
          var item = this.enemiesToSpawn.splice(s, 1)[0];
          var enemy = new window.Enemy(item.type, this.bloodFlow.vesselWaypoints);
          this.enemies.push(enemy);
        }
      }
    }

    // 4. 波次结束判定 -> 弹出 Rogue 突变卡
    if (this.waveActive && this.enemiesToSpawn.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this.awaitingMutation = this.wave < this.maxWaves;
      this.stats.wavesCompleted++;
      this.persist();
      if (this.wave < this.maxWaves) {
        this.openMutationModal();
      } else {
        this.gameOver(true);
      }
    }

    // 5. 细胞更新
    for (var c = 0; c < this.cells.length; c++) {
      this.cells[c].update(gameDt, this);
    }

    // 6. 敌人更新与清理
    for (var e = this.enemies.length - 1; e >= 0; e--) {
      var enemy = this.enemies[e];
      enemy.update(gameDt, this);
      if (enemy.dead) {
        this.enemies.splice(e, 1);
      }
    }

    // 7. 投射物 / 抗体水雷更新
    this.updateProjectiles(gameDt);

    // 8. 粒子火花 / 冲击波 / 飘字更新
    this.updateEffects(gameDt);
  };

  /**
   * 投射物与抗体更新
   */
  Game.prototype.updateProjectiles = function(dt) {
    for (var p = this.projectiles.length - 1; p >= 0; p--) {
      var proj = this.projectiles[p];
      
      // 寿命递减 (如抗体水雷)
      if (proj.life !== undefined) {
        proj.life -= dt;
        if (proj.life <= 0) {
          this.projectiles.splice(p, 1);
          continue;
        }
      }

      // 追踪或流体漂移
      if (proj.target && !proj.target.dead) {
        var dx = proj.target.x - proj.x;
        var dy = proj.target.y - proj.y;
        var dist = Math.hypot(dx, dy);
        var step = proj.speed * dt;

        if (dist <= step || dist < 12) {
          // 命中目标
          this.hitTarget(proj, proj.target);
          this.projectiles.splice(p, 1);
          continue;
        } else {
          proj.x += (dx / dist) * step;
          proj.y += (dy / dist) * step;
        }
      } else {
        // 目标已死亡或漂移水雷：顺着血液涌流自然前推
        proj.x += proj.speed * dt * 0.6;
        if (proj.x > this.width + 50 || proj.x < -50 || proj.y > this.height + 50 || proj.y < -50) {
          this.projectiles.splice(p, 1);
          continue;
        }
        // 碰撞检测最近非隐身敌人
        for (var i = 0; i < this.enemies.length; i++) {
          var en = this.enemies[i];
          if (!en.dead && !en.stealth && Math.hypot(en.x - proj.x, en.y - proj.y) <= (en.radius + (proj.radius || 6))) {
            this.hitTarget(proj, en);
            this.projectiles.splice(p, 1);
            break;
          }
        }
      }
    }
  };

  /**
   * 子弹/抗体命中目标
   */
  Game.prototype.hitTarget = function(proj, target) {
    target.takeDamage(proj.damage, this, proj.type);
    this.createSparks(target.x, target.y, 8, proj.color);

    // 强酸飞溅协议
    if (this.activeMutations.m_acid_splash && proj.type === 'acid') {
      for (var i = 0; i < this.enemies.length; i++) {
        var other = this.enemies[i];
        if (other !== target && !other.dead && Math.hypot(other.x - target.x, other.y - target.y) <= 45) {
          other.takeDamage(proj.damage * 0.5, this, 'acid_splash');
        }
      }
    }

    // 抗体锁死减速
    if (proj.type === 'antibody') {
      target.slowTimer = 2.5;
    }
  };

  /**
   * 视觉特效更新
   */
  Game.prototype.updateEffects = function(dt) {
    // 火花粒子
    for (var s = this.sparks.length - 1; s >= 0; s--) {
      var spark = this.sparks[s];
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.life -= dt;
      if (spark.life <= 0) {
        this.sparks.splice(s, 1);
      }
    }

    // 冲击波
    for (var w = this.shockwaves.length - 1; w >= 0; w--) {
      var wave = this.shockwaves[w];
      wave.r += wave.speed * dt;
      wave.alpha -= wave.fade * dt;
      if (wave.alpha <= 0) {
        this.shockwaves.splice(w, 1);
      }
    }

    // 浮动伤害飘字
    for (var f = this.floatingTexts.length - 1; f >= 0; f--) {
      var txt = this.floatingTexts[f];
      txt.y -= 28 * dt;
      txt.alpha -= dt * 1.2;
      if (txt.alpha <= 0) {
        this.floatingTexts.splice(f, 1);
      }
    }
  };

  /**
   * 神谕主动技能冷却
   */
  Game.prototype.updateSkills = function(dt) {
    for (var k in this.skills) {
      if (this.skills[k].currentCd > 0) {
        this.skills[k].currentCd -= dt;
        if (this.skills[k].currentCd < 0) this.skills[k].currentCd = 0;
        var cdElem = document.getElementById('cd-' + k);
        if (cdElem) {
          if (this.skills[k].currentCd > 0) {
            cdElem.style.display = 'flex';
            cdElem.textContent = Math.ceil(this.skills[k].currentCd) + 's';
          } else {
            cdElem.style.display = 'none';
          }
        }
      }
    }

    if (this.adrenalineActive) {
      this.adrenalineTimer -= dt;
      if (this.adrenalineTimer <= 0) {
        this.adrenalineActive = false;
        document.getElementById('skill-adrenaline').classList.remove('active');
      }
    }

    if (this.feverActive) {
      this.feverTimer -= dt;
      if (this.feverTimer <= 0) {
        this.feverActive = false;
        document.getElementById('skill-fever').classList.remove('active');
      }
    }
  };

  /**
   * 绘制帧
   */
  Game.prototype.draw = function() {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. 血管与微流背景
    this.bloodFlow.drawBackground(ctx);

    // 2. 细胞绘制
    for (var c = 0; c < this.cells.length; c++) {
      this.cells[c].draw(ctx);
    }

    // 3. 投射物 / 抗体绘制
    for (var p = 0; p < this.projectiles.length; p++) {
      var proj = this.projectiles[p];
      ctx.save();
      ctx.beginPath();
      if (proj.type === 'antibody') {
        // 绘制 Y 型免疫球蛋白分子结构
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 2.5;
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x - 6, proj.y - 7);
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x + 6, proj.y - 7);
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x, proj.y + 7);
        ctx.stroke();
      } else {
        ctx.arc(proj.x, proj.y, proj.radius || 5, 0, Math.PI * 2);
        ctx.fillStyle = proj.color;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // 4. 敌人绘制
    for (var e = 0; e < this.enemies.length; e++) {
      this.enemies[e].draw(ctx);
    }

    // 5. 特效粒子
    for (var s = 0; s < this.sparks.length; s++) {
      var sp = this.sparks[s];
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 冲击波
    for (var w = 0; w < this.shockwaves.length; w++) {
      var wave = this.shockwaves[w];
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = Math.max(0, wave.alpha);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // 6. 伤害浮动飘字
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (var f = 0; f < this.floatingTexts.length; f++) {
      var txt = this.floatingTexts[f];
      ctx.fillStyle = txt.color;
      ctx.globalAlpha = Math.max(0, txt.alpha);
      ctx.fillText(txt.text, txt.x, txt.y);
      ctx.globalAlpha = 1.0;
    }

    // 6.5 拖拽融合候选高亮：给可融合目标描一圈脉冲光环
    if (this.mergeTarget && !this.mergeTarget.dead) {
      var mt = this.mergeTarget;
      ctx.save();
      ctx.beginPath();
      ctx.arc(mt.x, mt.y, mt.radius + 6, 0, Math.PI * 2);
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }

    // 7. 正在拖拽放置的预览细胞虚影
    if (this.selectedCellType && this.mouse.down) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      var conf = window.CELL_CONFIGS[this.selectedCellType];
      ctx.beginPath();
      ctx.arc(this.mouse.x, this.mouse.y, conf.radius, 0, Math.PI * 2);
      ctx.fillStyle = conf.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  };

  /**
   * 主循环 RAF
   */
  Game.prototype.loop = function(now) {
    var dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1; // 页面失焦防掉帧爆炸

    this.update(dt);
    this.draw();

    // 更新心跳微流剩余时间显示
    var pulseElem = document.getElementById('hud-pulse');
    if (pulseElem && this.bloodFlow) {
      pulseElem.textContent = this.bloodFlow.pulseTimer.toFixed(1) + 's';
    }

    var self = this;
    requestAnimationFrame(function(t) { self.loop(t); });
  };

  /**
   * 增加 ATP 与 基因
   */
  Game.prototype.addATP = function(amount, x, y) {
    this.atp += Math.round(amount);
    this.updateHUD();
  };

  Game.prototype.addDNA = function(amount, x, y) {
    this.dna += amount;
    this.createFloatingText('+' + amount + '🧬', x, y - 25, '#38bdf8');
    this.updateHUD();
  };

  Game.prototype.damageHealth = function(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.gameOver(false);
    }
    this.updateHUD();
  };

  /**
   * 刷新 HUD
   */
  Game.prototype.updateHUD = function() {
    var atpElem = document.getElementById('hud-atp');
    var dnaElem = document.getElementById('hud-dna');
    var healthElem = document.getElementById('hud-health');
    var waveElem = document.getElementById('hud-wave');

    if (atpElem) atpElem.textContent = this.atp;
    if (dnaElem) dnaElem.textContent = this.dna;
    if (healthElem) healthElem.textContent = Math.round((this.health / this.maxHealth) * 100) + '%';
    if (waveElem) waveElem.textContent = 'W' + this.wave + ' / ' + this.maxWaves;

    // 低组织活性告警：血量低于 30% 时红色脉动 + 全屏暗红渐隐
    var critical = this.maxHealth > 0 && (this.health / this.maxHealth) < 0.3;
    if (healthElem) healthElem.classList.toggle('warn', critical);
    var alertLayer = document.getElementById('vignette-alert');
    if (alertLayer) alertLayer.classList.toggle('show', critical);

    // 首次对局引导推进
    if (this.cells.length === 0) {
      this.showOnboardHint('place', '先选中底栏细胞，点击血管旁的虚线基座安放', 7000);
    } else if (this.cells.length < 3) {
      this.showOnboardHint('merge', '把两只同类型同阶的细胞拖拽重叠，即可融合升阶', 7000);
    } else {
      this.showOnboardHint('skill', '神谕技能可扭转战局，注意各自冷却时间', 7000);
    }

    // 刷新卡片可造状态灰显
    var cards = document.querySelectorAll('.cell-card');
    for (var i = 0; i < cards.length; i++) {
      var cType = cards[i].getAttribute('data-type');
      var cfg = window.CELL_CONFIGS[cType];
      if (cfg && this.atp < cfg.cost) {
        cards[i].classList.add('disabled');
      } else {
        cards[i].classList.remove('disabled');
      }
    }
  };

  /**
   * 触发神谕技能
   */
  Game.prototype.triggerSkill = function(name) {
    var sk = this.skills[name];
    if (!sk || sk.currentCd > 0) return;

    if (window.CellAudio) window.CellAudio.playSkill();

    if (name === 'adrenaline') {
      this.adrenalineActive = true;
      this.adrenalineTimer = 5.0;
      sk.currentCd = sk.cd;
      document.getElementById('skill-adrenaline').classList.add('active');
      this.createShockwave(this.width / 2, this.height / 2, 220, '#fbbf24');
    } else if (name === 'fever') {
      this.feverActive = true;
      this.feverTimer = 6.0;
      sk.currentCd = sk.cd;
      document.getElementById('skill-fever').classList.add('active');
      this.createShockwave(this.width / 2, this.height / 2, 220, '#f43f5e');
    } else if (name === 'interferon') {
      sk.currentCd = sk.cd;
      this.health = Math.min(this.maxHealth, this.health + 25);
      this.updateHUD();
      this.createShockwave(this.width / 2, this.height / 2, 220, '#10b981');
    }
  };

  /**
   * 特效工厂函数
   */
  Game.prototype.createSparks = function(x, y, count, color) {
    if (this.sparks.length > 150) {
      this.sparks.splice(0, this.sparks.length - 150);
    }
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var spd = Math.random() * 80 + 30;
      this.sparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 2.5 + 1.2,
        life: Math.random() * 0.4 + 0.25,
        maxLife: 0.5,
        color: color
      });
    }
  };

  Game.prototype.createShockwave = function(x, y, maxR, color) {
    if (this.shockwaves.length > 20) {
      this.shockwaves.splice(0, this.shockwaves.length - 20);
    }
    this.shockwaves.push({
      x: x,
      y: y,
      r: 10,
      maxR: maxR,
      speed: (maxR - 10) / 0.35,
      alpha: 0.8,
      fade: 0.8 / 0.35,
      color: color
    });
  };

  Game.prototype.createFloatingText = function(text, x, y, color) {
    if (this.floatingTexts.length > 40) {
      this.floatingTexts.splice(0, this.floatingTexts.length - 40);
    }
    this.floatingTexts.push({
      text: text,
      x: x,
      y: y,
      color: color || '#ffffff',
      alpha: 1.0
    });
  };

  /**
   * 首次对局引导提示：同一 key 只出现一次，到时长自动淡出
   */
  Game.prototype.showOnboardHint = function(key, text, durationMs) {
    if (this.onboardSeen[key]) return;
    this.onboardSeen[key] = true;

    var hint = document.getElementById('onboard-hint');
    if (!hint) return;

    hint.textContent = text;
    hint.classList.add('show');

    var self = this;
    if (this.onboardHintTimer) clearTimeout(this.onboardHintTimer);
    this.onboardHintTimer = setTimeout(function() {
      hint.classList.remove('show');
      self.onboardHintTimer = null;
    }, durationMs || 6000);
  };

  Game.prototype.hideOnboardHint = function() {
    var hint = document.getElementById('onboard-hint');
    if (hint) hint.classList.remove('show');
    if (this.onboardHintTimer) {
      clearTimeout(this.onboardHintTimer);
      this.onboardHintTimer = null;
    }
  };

  /**
   * 暂停 / 继续：统一收口图标与蒙层，避免按钮文字与实际状态不一致
   */
  Game.prototype.setPaused = function(paused) {
    this.isPaused = !!paused;
    var pBtn = document.getElementById('btn-pause');
    if (pBtn) {
      pBtn.textContent = this.isPaused ? '▶️' : '⏸️';
      pBtn.setAttribute('aria-pressed', this.isPaused ? 'true' : 'false');
    }
    var mask = document.getElementById('modal-pause');
    if (mask) mask.classList.toggle('open', this.isPaused);
    if (this.isPaused) this.persist();
  };

  Game.prototype.togglePause = function() {
    if (this.isOver) return;
    this.setPaused(!this.isPaused);
  };

  /**
   * 写入局内快照；localStorage 不可用时静默失败，不影响游戏
   */
  Game.prototype.persist = function() {
    if (!window.CellSave) return false;
    if (this.isOver) return false;
    return window.CellSave.save(this);
  };

  /**
   * 从快照恢复：复用 save 模块的校验与重建逻辑
   */
  Game.prototype.applyResume = function(data) {
    if (!window.CellSave || !window.CellSave.apply(this, data)) {
      this.resetGame();
      this.startWave();
      return;
    }
    if (data.awaitingMutation) {
      this.openMutationModal();
    } else if (data.waveActive && this.enemiesToSpawn.length > 0) {
      this.startWave();
    } else {
      // 波次间休整：给出下一波提示
      this.showOnboardHint('rest', '防线休整中，下一波即将来袭，可继续布置细胞', 5000);
    }
    this.setPaused(false);
  };

  /**
   * 在开始模态框上显示「继续上次防线」入口与摘要
   */
  Game.prototype.refreshResumeEntry = function() {
    if (!window.CellSave) return;
    var btn = document.getElementById('btn-resume-game');
    var hint = document.getElementById('resume-hint');
    if (!btn) return;

    var data = window.CellSave.load();
    if (!data) {
      btn.hidden = true;
      if (hint) hint.hidden = true;
      return;
    }
    btn.hidden = false;
    if (hint) {
      hint.hidden = false;
      hint.textContent = '已存档：' + window.CellSave.summary(data);
    }
  };

  Game.prototype.addProjectile = function(proj) {
    if (this.projectiles.length > 180) {
      this.projectiles.splice(0, this.projectiles.length - 180);
    }
    this.projectiles.push(proj);
  };

  /**
   * 渲染底部选择栏的微观细胞头像 (纯代码 SVG)
   */
  Game.prototype.renderAvatars = function() {
    var map = {
      'macrophage': '<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="13" fill="#10b981"/><circle cx="14" cy="14" r="5" fill="#047857"/></svg>',
      'neutrophil': '<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="11" fill="#06b6d4"/><circle cx="13" cy="14" r="3.5" fill="#0369a1"/><circle cx="19" cy="17" r="3" fill="#0369a1"/></svg>',
      'dendritic': '<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="8" fill="#f59e0b"/><line x1="16" y1="16" x2="4" y2="6" stroke="#f59e0b" stroke-width="2"/><line x1="16" y1="16" x2="28" y2="7" stroke="#f59e0b" stroke-width="2"/><line x1="16" y1="16" x2="16" y2="30" stroke="#f59e0b" stroke-width="2"/></svg>',
      'bcell': '<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="11" fill="#a855f7"/><circle cx="16" cy="16" r="4.5" fill="#6b21a8"/></svg>',
      'nkcell': '<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#ec4899"/><polygon points="16,4 20,12 28,16 20,20 16,28 12,20 4,16 12,12" fill="#be185d"/></svg>'
    };
    for (var key in map) {
      var elem = document.getElementById('avatar-' + key);
      if (elem) elem.innerHTML = map[key];
    }
  };

  /**
   * 绑定所有交互事件 (桌面鼠标 + 移动端触摸)
   */
  Game.prototype.bindEvents = function() {
    var self = this;

    // 窗口尺寸
    window.addEventListener('resize', function() {
      self.initCanvas();
    });

    // 启动新防线（同时清除旧快照，避免残留状态干扰）
    document.getElementById('btn-start-game').addEventListener('click', function() {
      document.getElementById('modal-start').classList.remove('open');
      if (window.CellAudio) window.CellAudio.init();
      if (window.CellSave) window.CellSave.clear();
      self.resetGame();
      self.startWave();
      self.persist();
    });

    // 继续上次防线
    document.getElementById('btn-resume-game').addEventListener('click', function() {
      document.getElementById('modal-start').classList.remove('open');
      if (window.CellAudio) window.CellAudio.init();
      var data = window.CellSave && window.CellSave.load();
      if (data) {
        self.applyResume(data);
      } else {
        self.resetGame();
        self.startWave();
      }
      self.persist();
    });

    // 重新开始按钮
    document.getElementById('btn-restart').addEventListener('click', function() {
      document.getElementById('modal-gameover').classList.remove('open');
      self.resetGame();
    });

    // 倍速切换
    document.getElementById('btn-speed').addEventListener('click', function() {
      if (self.timeScale === 1.0) {
        self.timeScale = 1.5;
        this.textContent = '⚡ 1.5x';
      } else if (self.timeScale === 1.5) {
        self.timeScale = 2.0;
        this.textContent = '⚡ 2.0x';
      } else {
        self.timeScale = 1.0;
        this.textContent = '⚡ 1.0x';
      }
    });

    // 声音切换
    document.getElementById('btn-sound').addEventListener('click', function() {
      if (window.CellAudio) {
        var on = window.CellAudio.toggleSound();
        this.textContent = on ? '🔊' : '🔇';
      }
    });

    // 暂停切换
    document.getElementById('btn-pause').addEventListener('click', function() {
      self.togglePause();
    });

    document.getElementById('btn-resume').addEventListener('click', function() {
      self.setPaused(false);
    });

    // 底部细胞选择卡点击与悬停提示
    // 触屏没有 hover：点击选中时让 tooltip 常驻，再次点击同一卡片或点击空白处才隐藏
    var cards = document.querySelectorAll('.cell-card');
    var tooltipBox = document.getElementById('tooltip-box');
    var tooltipTitle = document.getElementById('tooltip-title');
    var tooltipDesc = document.getElementById('tooltip-desc');
    var tooltipPinned = false;

    function showTooltip(title, desc, pin) {
      if (tooltipBox && tooltipTitle && tooltipDesc) {
        tooltipTitle.textContent = title;
        tooltipDesc.textContent = desc;
        tooltipBox.classList.add('show');
        tooltipPinned = !!pin;
        tooltipBox.classList.toggle('pinned', !!pin);
      }
    }

    function hideTooltip() {
      if (tooltipBox) tooltipBox.classList.remove('show');
      if (tooltipBox) tooltipBox.classList.remove('pinned');
      tooltipPinned = false;
    }

    cards.forEach(function(card) {
      var type = card.getAttribute('data-type');
      var cfg = window.CELL_CONFIGS[type];
      card.addEventListener('mouseenter', function() {
        if (tooltipPinned) return;
        if (cfg) showTooltip(cfg.name + ' (' + cfg.title + ')', cfg.desc + ' · 消耗⚡' + cfg.cost);
      });
      card.addEventListener('mouseleave', function() {
        if (tooltipPinned) return;
        hideTooltip();
      });

      card.addEventListener('click', function() {
        cards.forEach(function(c) { c.classList.remove('active'); });
        if (self.selectedCellType === type) {
          self.selectedCellType = null;
          hideTooltip();
        } else {
          self.selectedCellType = type;
          this.classList.add('active');
          if (cfg) {
            var affordable = self.atp >= cfg.cost;
            showTooltip(
              cfg.name + ' (' + cfg.title + ')',
              (affordable ? '点击血管旁的虚线基座或空白处即可安放' : 'ATP 不足，还差 ⚡' + (cfg.cost - self.atp) + '，巨噬细胞消化病菌可补充') +
              ' · 消耗⚡' + cfg.cost,
              true
            );
          }
        }
      });
    });

    // 技能按钮点击与提示
    var skillBtns = [
      { id: 'skill-adrenaline', name: 'adrenaline', title: '神谕：肾上腺素激增', desc: '5秒内全场细胞代谢与吞噬速度激增 2.5 倍' },
      { id: 'skill-fever', name: 'fever', title: '神谕：局部发热', desc: '微循环引发 40℃ 局部高温，减速 65% 并破除保护层' },
      { id: 'skill-interferon', name: 'interferon', title: '神谕：干扰素修补', desc: '向血管注入干扰素，紧急修复 +25% 组织活性' }
    ];
    skillBtns.forEach(function(sb) {
      var elem = document.getElementById(sb.id);
      if (elem) {
        elem.addEventListener('mouseenter', function() { showTooltip(sb.title, sb.desc); });
        elem.addEventListener('mouseleave', function() {
          if (tooltipPinned) return;
          hideTooltip();
        });
        elem.addEventListener('click', function() {
          var sk = self.skills[sb.name];
          // 冷却中点击时说明原因，而不是毫无反应
          if (sk && sk.currentCd > 0) {
            showTooltip(sb.title, '冷却中，还需 ' + Math.ceil(sk.currentCd) + ' 秒 · ' + sb.desc, true);
            setTimeout(hideTooltip, 1800);
            return;
          }
          self.triggerSkill(sb.name);
        });
      }
    });

    // 键盘全局快捷键支持 (PC 操作沉浸体验)
    window.addEventListener('keydown', function(e) {
      if (self.isOver) return;
      // 长按连发只响应首次按下，避免按住 1 疯狂切换选中态
      if (e.repeat) return;
      // 弹窗打开时交给浏览器处理（Esc/Enter 作用于按钮），避免误触快捷键
      var modalOpen = document.querySelector('.modal-mask.open');
      if (modalOpen && modalOpen.id !== 'modal-pause') return;
      if (e.code === 'Space') {
        e.preventDefault();
        self.togglePause();
      } else if (e.key === 'Escape') {
        // Esc 取消当前选中的细胞，比反复点卡片更顺手
        if (self.selectedCellType) {
          self.selectedCellType = null;
          cards.forEach(function(c) { c.classList.remove('active'); });
          hideTooltip();
        } else if (self.isPaused) {
          self.setPaused(false);
        }
      } else if (e.key === '1') {
        selectCardByIndex(0);
      } else if (e.key === '2') {
        selectCardByIndex(1);
      } else if (e.key === '3') {
        selectCardByIndex(2);
      } else if (e.key === '4') {
        selectCardByIndex(3);
      } else if (e.key === '5') {
        selectCardByIndex(4);
      } else if (e.key === 'q' || e.key === 'Q') {
        self.triggerSkill('adrenaline');
      } else if (e.key === 'w' || e.key === 'W') {
        self.triggerSkill('fever');
      } else if (e.key === 'e' || e.key === 'E') {
        self.triggerSkill('interferon');
      }
    });

    function selectCardByIndex(idx) {
      if (cards[idx]) cards[idx].click();
    }

    // 页面失焦自动重置交互状态
    window.addEventListener('blur', function() {
      self.mouse.down = false;
      if (self.draggingCell) {
        self.draggingCell.isDragging = false;
        self.draggingCell = null;
      }
    });

    // 切到后台/最小化自动暂停：塔防挂机等于白给，回来后手动继续
    document.addEventListener('visibilitychange', function() {
      if (document.hidden && !self.isOver && !self.isPaused) {
        self.setPaused(true);
      }
    });

    // 画布统一指针交互 (Pointer Events: 兼容鼠标与单多点触控)
    function getPointerPos(e) {
      var rect = self.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    function onPointerDown(e) {
      if (self.isOver) return;
      if (window.CellAudio) window.CellAudio.init();

      var pos = getPointerPos(e);
      self.mouse.x = pos.x;
      self.mouse.y = pos.y;
      self.mouse.down = true;

      // 1. 如果已有选中细胞卡，则尝试在点击位置放置
      if (self.selectedCellType) {
        var conf = window.CELL_CONFIGS[self.selectedCellType];
        if (self.atp >= conf.cost) {
          var placed = self.placeCell(self.selectedCellType, pos.x, pos.y);
          if (placed) {
            self.atp -= conf.cost;
            self.updateHUD();
            if (window.CellAudio) window.CellAudio.playPlace();
            if (navigator.vibrate) navigator.vibrate(20);
          }
        } else {
          // ATP 不足时给出明确反馈，避免误以为点击失灵
          self.createFloatingText('⚡ ATP 不足', pos.x, pos.y - 20, '#f87171');
          if (window.CellAudio) window.CellAudio.playHurt();
        }
        return;
      }

      // 2. 检测点击已有细胞（巨噬细胞点击加速消化，或开始拖拽二合一融合）
      for (var i = self.cells.length - 1; i >= 0; i--) {
        var cell = self.cells[i];
        if (Math.hypot(cell.x - pos.x, cell.y - pos.y) <= cell.radius) {
          // 点击反馈：若为巨噬细胞且体内有消化泡，加速消化
          if (cell.type === 'macrophage' && cell.digestingViruses.length > 0) {
            for (var v = 0; v < cell.digestingViruses.length; v++) {
              cell.digestingViruses[v].timer -= 0.75;
            }
            self.createSparks(cell.x, cell.y, 8, '#34d399');
            if (window.CellAudio) window.CellAudio.playDigest();
            self.createFloatingText('⚡ 消化加速', cell.x, cell.y - 20, '#34d399');
          }

          self.draggingCell = cell;
          cell.isDragging = true;
          self.dragOffset.x = cell.x - pos.x;
          self.dragOffset.y = cell.y - pos.y;
          break;
        }
      }
    }

    function onPointerMove(e) {
      var pos = getPointerPos(e);
      self.mouse.x = pos.x;
      self.mouse.y = pos.y;

      if (self.draggingCell) {
        self.draggingCell.x = pos.x + self.dragOffset.x;
        self.draggingCell.y = pos.y + self.dragOffset.y;
      }

      // 悬停判定
      for (var i = 0; i < self.cells.length; i++) {
        var cell = self.cells[i];
        cell.isHovered = Math.hypot(cell.x - pos.x, cell.y - pos.y) <= cell.radius;
      }

      // 拖拽中实时高亮可融合目标，让玩家看得见「该叠到谁身上」
      if (self.draggingCell) {
        var next = null;
        for (var j = 0; j < self.cells.length; j++) {
          var cand = self.cells[j];
          if (cand !== self.draggingCell && cand.type === self.draggingCell.type &&
              cand.tier === self.draggingCell.tier && cand.tier < 3 &&
              Math.hypot(cand.x - self.draggingCell.x, cand.y - self.draggingCell.y) <= (cand.radius + self.draggingCell.radius) * 1.1) {
            next = cand;
            break;
          }
        }
        if (self.mergeTarget !== next) {
          self.mergeTarget = next;
          if (navigator.vibrate && next) navigator.vibrate(12);
        }
      }
    }

    function onPointerUp(e) {
      self.mouse.down = false;
      if (self.draggingCell) {
        var dragged = self.draggingCell;
        dragged.isDragging = false;
        self.draggingCell = null;

        // 检测是否拖拽到另一只相同类型的细胞上进行融合突变 (Merge & Morph)
        var merged = false;
        for (var i = 0; i < self.cells.length; i++) {
          var target = self.cells[i];
          if (target !== dragged && target.type === dragged.type && target.tier === dragged.tier && target.tier < 3) {
            var dist = Math.hypot(target.x - dragged.x, target.y - dragged.y);
            if (dist <= (target.radius + dragged.radius) * 1.1) {
              // 成功融合！升阶！
              merged = true;
              target.tier++;
              var newConf = window.CELL_CONFIGS[target.type];
              target.baseRadius = newConf.radius * (1 + (target.tier - 1) * 0.28);
              target.range = newConf.range * (1 + (target.tier - 1) * 0.2);
              target.maxHp = 100 * target.tier;
              target.hp = target.maxHp;

              // 释放被融并细胞所占槽位
              if (dragged.slot) dragged.slot.cell = null;

              // 移除被吞并的细胞
              var removeIdx = self.cells.indexOf(dragged);
              if (removeIdx !== -1) self.cells.splice(removeIdx, 1);

              self.createShockwave(target.x, target.y, 80, '#38bdf8');
              self.createSparks(target.x, target.y, 30, '#fbbf24');
              self.createFloatingText('★ 融合升阶 T' + target.tier, target.x, target.y - 30, '#fbbf24');
              self.hideOnboardHint();
              if (window.CellAudio) window.CellAudio.playFuse();
              if (navigator.vibrate) navigator.vibrate([25, 40, 30]);
              self.persist();
              break;
            }
          }
        }

        self.mergeTarget = null;

        // 未融合成功：说明规则，避免玩家反复试错
        if (!merged) {
          if (dragged.tier >= 3) {
            self.createFloatingText('已是最高阶，无法继续融合', dragged.x, dragged.y - 20, '#fbbf24');
          } else {
            var sameType = false;
            for (var k = 0; k < self.cells.length; k++) {
              var other = self.cells[k];
              if (other !== dragged && other.type === dragged.type && other.tier === dragged.tier && other.tier < 3) {
                sameType = true;
                break;
              }
            }
            self.createFloatingText(
              sameType ? '再靠近一点：两只细胞需要重叠松手' : '需要两只同类型同阶的细胞重叠',
              dragged.x, dragged.y - 20, '#f87171'
            );
          }
        }
      }
    }

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  /**
   * 放置新细胞 (智能吸附槽位与防重叠)
   */
  Game.prototype.placeCell = function(type, x, y) {
    var posX = x;
    var posY = y;
    var matchedSlot = null;

    // 查找最近的空槽位吸附 (45px 磁吸半径)
    if (this.bloodFlow && this.bloodFlow.slots) {
      var minD = 45;
      for (var s = 0; s < this.bloodFlow.slots.length; s++) {
        var sl = this.bloodFlow.slots[s];
        if (!sl.cell) {
          var d = Math.hypot(sl.x - x, sl.y - y);
          if (d < minD) {
            minD = d;
            matchedSlot = sl;
          }
        }
      }
      if (matchedSlot) {
        posX = matchedSlot.x;
        posY = matchedSlot.y;
      }
    }

    // 防重叠检测：若点击处已有细胞太近（< 32px 且非同一槽位），不允许叠放建造
    for (var i = 0; i < this.cells.length; i++) {
      var c = this.cells[i];
      if (Math.hypot(c.x - posX, c.y - posY) < 28) {
        this.createFloatingText('位置重叠', posX, posY - 20, '#f87171');
        return false;
      }
    }

    var cell = new window.Cell(type, posX, posY, 1);
    if (matchedSlot) {
      matchedSlot.cell = cell;
      cell.slot = matchedSlot;
    }
    this.cells.push(cell);
    this.createShockwave(posX, posY, 40, cell.color);
    this.createSparks(posX, posY, 14, cell.color);
    this.persist();
    return true;
  };

  /**
   * 开启 Rogue 三选一突变模态框
   */
  Game.prototype.openMutationModal = function() {
    this.isPaused = true;
    var container = document.getElementById('mutation-cards-container');
    container.innerHTML = '';

    // 随机挑选 3 个不重复的突变协议
    var shuffled = MUTATION_POOL.slice().sort(function() { return 0.5 - Math.random(); });
    var choices = shuffled.slice(0, 3);

    var self = this;
    choices.forEach(function(mut) {
      var card = document.createElement('div');
      card.className = 'mutation-card';
      card.innerHTML = [
        '<div class="mutation-icon">' + mut.icon + '</div>',
        '<div class="mutation-name">' + mut.name + '</div>',
        '<div class="mutation-desc">' + mut.desc + '</div>'
      ].join('');

      card.addEventListener('click', function() {
        self.applyMutation(mut.id);
        document.getElementById('modal-mutation').classList.remove('open');
        self.awaitingMutation = false;
        self.wave++;
        self.startWave();
        self.setPaused(false);
        self.persist();
      });

      container.appendChild(card);
    });

    document.getElementById('modal-mutation').classList.add('open');
    // 同步暂停按钮图标，避免显示与实际状态不一致
    this.setPaused(true);
  };

  /**
   * 应用突变增强
   */
  Game.prototype.applyMutation = function(id) {
    this.activeMutations[id] = true;
    if (id === 'm_heart_rush') {
      this.maxHealth += 20;
      this.health += 20;
      this.updateHUD();
    }
  };

  /**
   * 游戏结算
   */
  Game.prototype.gameOver = function(victory) {
    this.isOver = true;
    var modal = document.getElementById('modal-gameover');
    var title = document.getElementById('go-title');
    var desc = document.getElementById('go-desc');
    var stats = document.getElementById('go-stats');

    if (victory) {
      title.textContent = '🎉 宿主完全康复！免疫防线胜利！';
      desc.textContent = '成功清除所有侵袭的烈性病毒与寄生巨虫母体，机体恢复稳态！';
    } else {
      title.textContent = '💀 免疫屏障崩溃';
      desc.textContent = '病原体侵染了宿主核心微循环，组织衰竭...';
    }

    stats.textContent = '最终波次: W' + this.wave + ' | 吞噬病菌: ' + this.stats.swallowed + ' | 消灭总数: ' + this.stats.killed;
    modal.classList.add('open');
    // 结算后不再提供「继续」，清掉旧快照，避免下一次进入时恢复已结束的局
    if (window.CellSave) window.CellSave.clear();
  };

  /**
   * 重置游戏
   */
  Game.prototype.resetGame = function() {
    this.atp = 150;
    this.dna = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.wave = 1;
    this.isOver = false;
    this.isPaused = false;
    this.cells = [];
    this.enemies = [];
    this.enemiesToSpawn = [];
    this.waveActive = false;
    this.spawnTimer = 0;
    this.projectiles = [];
    this.sparks = [];
    this.floatingTexts = [];
    this.shockwaves = [];
    this.activeMutations = {};
    this.stats = { swallowed: 0, killed: 0, wavesCompleted: 0 };
    this.onboardSeen = {};
    this.hideOnboardHint();
    this.mergeTarget = null;
    this.awaitingMutation = false;

    // 重置槽位占用
    if (this.bloodFlow && this.bloodFlow.slots) {
      for (var s = 0; s < this.bloodFlow.slots.length; s++) {
        this.bloodFlow.slots[s].cell = null;
      }
    }

    this.updateHUD();
    this.startWave();
  };

  window.addEventListener('DOMContentLoaded', function() {
    window.gameInstance = new Game();

    // 关闭/刷新页面时保存局内进度，作为断点续玩的兜底
    window.addEventListener('beforeunload', function() {
      var g = window.gameInstance;
      if (g && !g.isOver && g.cells.length > 0) g.persist();
    });
  });

})(window);
