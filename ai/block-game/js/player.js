/* 玩家：第一人称物理（AABB 碰撞、重力、跳跃、游泳、飞行） */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var CHUNK = 16, H = 64;

  var HALF_W = 0.3, HEIGHT = 1.8, EYE = 1.62;
  var GRAVITY = 26, JUMP_V = 8.6, MAX_FALL = 42;
  var EPS = 0.001;

  function Player(world, spawn) {
    this.world = world;
    this.pos = spawn.slice(); /* 脚底中心 */
    this.vel = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.stepDist = 0;
    this.walkPhase = 0;
    this.stepTimer = 0;
  }

  Player.prototype.eye = function () {
    return [this.pos[0], this.pos[1] + EYE, this.pos[2]];
  };

  Player.prototype.forward = function () {
    var cp = Math.cos(this.pitch);
    return [Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  };

  Player.prototype.toggleFly = function () {
    this.flying = !this.flying;
    this.vel[1] = 0;
    return this.flying;
  };

  /* input: {mf, ms, jump, shift, ctrl} */
  Player.prototype.update = function (dt, input) {
    var world = this.world;
    var feetBlock = world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.35), Math.floor(this.pos[2]));
    var headBlock = world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 1.5), Math.floor(this.pos[2]));
    var wasInWater = this.inWater;
    this.inWater = feetBlock === MC.BLOCK.WATER;
    this.headInWater = headBlock === MC.BLOCK.WATER;
    if (this.inWater && !wasInWater && this.vel[1] < -1.5) {
      MC.Sound.splash();
    }

    /* 期望水平速度 */
    var speed;
    if (this.flying) speed = (input.ctrl || input.shift) && input.mf > 0 ? 16 : 9.5;
    else if (this.inWater) speed = 2.8;
    else speed = input.shift ? 6.0 : 4.4;

    var fy = this.yaw;
    var fx = Math.sin(fy), fz = -Math.cos(fy);   /* 前向（水平） */
    var rx = Math.cos(fy), rz = Math.sin(fy);    /* 右向 */
    var wx = fx * input.mf + rx * input.ms;
    var wz = fz * input.mf + rz * input.ms;
    var wl = Math.hypot(wx, wz);
    if (wl > 1e-6) { wx = wx / wl * speed; wz = wz / wl * speed; }

    var accel = this.flying ? 30 : (this.onGround ? 40 : (this.inWater ? 14 : 8));
    this.vel[0] = approach(this.vel[0], wx, accel * dt);
    this.vel[2] = approach(this.vel[2], wz, accel * dt);

    /* 垂直运动 */
    if (this.flying) {
      var targetVy = (input.jump ? 1 : 0) * 8 - (input.shift ? 1 : 0) * 8;
      this.vel[1] = approach(this.vel[1], targetVy, 30 * dt);
    } else if (this.inWater) {
      this.vel[1] -= 14 * dt;
      if (this.vel[1] < -3.2) this.vel[1] = -3.2;
      if (input.jump) {
        this.vel[1] = Math.min(this.vel[1] + 34 * dt, 3.0);
      }
    } else {
      this.vel[1] -= GRAVITY * dt;
      if (this.vel[1] < -MAX_FALL) this.vel[1] = -MAX_FALL;
      if (input.jump && this.onGround) {
        this.vel[1] = JUMP_V;
        this.onGround = false;
      }
    }

    /* 离水宽限：贴着岸壁向前游/跳时给一跃助力，能真正爬上 1 格高的岸 */
    if (this.inWater) this.waterClimb = 0.3;
    else this.waterClimb = Math.max(0, (this.waterClimb || 0) - dt);
    if (!this.flying && input.jump && this.hitWall && this.waterClimb > 0 && input.mf !== 0) {
      this.vel[1] = Math.max(this.vel[1], 7.4);
    }

    /* 分轴 + 分步碰撞，防穿透 */
    var move = [this.vel[0] * dt, this.vel[1] * dt, this.vel[2] * dt];
    var maxComp = Math.max(Math.abs(move[0]), Math.abs(move[1]), Math.abs(move[2]));
    var steps = Math.max(1, Math.ceil(maxComp / 0.35));
    if (steps > 10) steps = 10;
    var i, s;
    var wasOnGround = this.onGround;
    this.onGround = false;
    this.hitWall = false;
    for (s = 0; s < steps; s++) {
      /* 先处理垂直轴 Y，确保着地状态确立后再处理水平轴 */
      this._moveAxis(1, move[1] / steps, wasOnGround);
      this._moveAxis(0, move[0] / steps, wasOnGround);
      this._moveAxis(2, move[2] / steps, wasOnGround);
    }

    /* 主动脱困：若玩家初始陷入实体方块，平滑搜索最近开阔空间脱出 */
    if (this._isColliding(this.pos[0], this.pos[1], this.pos[2])) {
      var escaped = false;
      for (var up = 0.5; up <= 3.0; up += 0.5) {
        if (!this._isColliding(this.pos[0], this.pos[1] + up, this.pos[2])) {
          this.pos[1] += up;
          this.vel[1] = 0;
          escaped = true;
          break;
        }
      }
      if (!escaped) {
        var offsets = [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]];
        for (var o = 0; o < offsets.length; o++) {
          if (!this._isColliding(this.pos[0] + offsets[o][0], this.pos[1], this.pos[2] + offsets[o][1])) {
            this.pos[0] += offsets[o][0];
            this.pos[2] += offsets[o][1];
            break;
          }
        }
      }
    }

    /* 地面脚步声与行走连续相位计算 */
    if (this.onGround && !this.flying && !this.inWater) {
      var hSpeed = Math.hypot(this.vel[0], this.vel[2]);
      if (hSpeed > 0.8) {
        this.walkPhase += hSpeed * dt * 4.6;
        this.stepTimer += hSpeed * dt;
        if (this.stepTimer > 2.2) {
          this.stepTimer = 0;
          var underBlock = world.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.2), Math.floor(this.pos[2]));
          MC.Sound.step(underBlock);
        }
      } else {
        this.stepTimer = 0;
      }
    } else {
      this.stepTimer = 0;
    }

    if (this.pos[1] < -20) { /* 兜底：掉出世界重置到出生点 */
      this.pos = this.world.spawn.slice();
      this.vel = [0, 0, 0];
    }
  };

  Player.prototype._isColliding = function (cx, cy, cz) {
    var minX = cx - HALF_W, minY = cy, minZ = cz - HALF_W;
    var maxX = cx + HALF_W, maxY = cy + HEIGHT, maxZ = cz + HALF_W;
    var x0 = Math.floor(minX), x1 = Math.ceil(maxX) - 1;
    var y0 = Math.floor(minY), y1 = Math.ceil(maxY) - 1;
    var z0 = Math.floor(minZ), z1 = Math.ceil(maxZ) - 1;
    var x, y, z;
    for (y = y0; y <= y1; y++) {
      for (z = z0; z <= z1; z++) {
        for (x = x0; x <= x1; x++) {
          if (MC.isSolid(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  };

  Player.prototype._moveAxis = function (axis, amount, wasOnGround) {
    if (amount === 0) return;
    var pos = this.pos;

    /* 垂直方向运动 (axis === 1) */
    if (axis === 1) {
      pos[1] += amount;
      var minX = pos[0] - HALF_W, minY = pos[1], minZ = pos[2] - HALF_W;
      var maxX = pos[0] + HALF_W, maxY = pos[1] + HEIGHT, maxZ = pos[2] + HALF_W;
      var x0 = Math.floor(minX), x1 = Math.ceil(maxX) - 1;
      var y0 = Math.floor(minY), y1 = Math.ceil(maxY) - 1;
      var z0 = Math.floor(minZ), z1 = Math.ceil(maxZ) - 1;
      var x, y, z;
      for (y = y0; y <= y1; y++) {
        for (z = z0; z <= z1; z++) {
          for (x = x0; x <= x1; x++) {
            if (!MC.isSolid(this.world.getBlock(x, y, z))) continue;
            if (amount > 0) {
              pos[1] = y - HEIGHT - EPS;
            } else {
              pos[1] = y + 1 + EPS;
              this.onGround = true;
            }
            this.vel[1] = 0;
            return;
          }
        }
      }
      return;
    }

    /* 水平方向运动 (axis === 0 或 axis === 2) */
    var oldX = pos[0], oldY = pos[1], oldZ = pos[2];
    var targetX = oldX + (axis === 0 ? amount : 0);
    var targetZ = oldZ + (axis === 2 ? amount : 0);

    /* 1. 直接水平移动测试（地面平坦时直接高速通过） */
    if (!this._isColliding(targetX, oldY, targetZ)) {
      pos[0] = targetX;
      pos[2] = targetZ;
      return;
    }

    /* 2. 碰壁！如果处于地面或水边攀爬，尝试平滑跨越（Auto Step-Up 0.6~1.05m 高度） */
    var canStep = (this.onGround || wasOnGround || (this.waterClimb && this.waterClimb > 0)) && !this.flying;
    if (canStep) {
      var stepH = 1.02;
      /* 验证头顶空间无遮挡 */
      if (!this._isColliding(oldX, oldY + stepH, oldZ)) {
        /* 验证抬升后前向无阻挡 */
        if (!this._isColliding(targetX, oldY + stepH, targetZ)) {
          var finalY = oldY + stepH;
          for (var drop = 0.1; drop <= stepH; drop += 0.1) {
            if (this._isColliding(targetX, finalY - 0.1, targetZ)) break;
            finalY -= 0.1;
          }
          pos[0] = targetX;
          pos[1] = finalY;
          pos[2] = targetZ;
          this.onGround = true;
          this.vel[1] = Math.max(0, this.vel[1]);
          return;
        }
      }
    }

    /* 3. 确实撞上高墙，精准计算最近碰撞面，贴合边缘停靠，彻底防止穿墙与坐标覆盖 */
    pos[axis] += amount;
    var minX2 = pos[0] - HALF_W, minY2 = pos[1], minZ2 = pos[2] - HALF_W;
    var maxX2 = pos[0] + HALF_W, maxY2 = pos[1] + HEIGHT, maxZ2 = pos[2] + HALF_W;
    var x02 = Math.floor(minX2), x12 = Math.ceil(maxX2) - 1;
    var y02 = Math.floor(minY2), y12 = Math.ceil(maxY2) - 1;
    var z02 = Math.floor(minZ2), z12 = Math.ceil(maxZ2) - 1;
    var x2, y2, z2;
    var collideMin = Infinity;
    var collideMax = -Infinity;
    var hit = false;

    for (y2 = y02; y2 <= y12; y2++) {
      for (z2 = z02; z2 <= z12; z2++) {
        for (x2 = x02; x2 <= x12; x2++) {
          if (!MC.isSolid(this.world.getBlock(x2, y2, z2))) continue;
          hit = true;
          if (axis === 0) {
            if (x2 < collideMin) collideMin = x2;
            if (x2 > collideMax) collideMax = x2;
          } else {
            if (z2 < collideMin) collideMin = z2;
            if (z2 > collideMax) collideMax = z2;
          }
        }
      }
    }

    if (hit) {
      if (axis === 0) {
        pos[0] = amount > 0 ? collideMin - HALF_W - EPS : collideMax + 1 + HALF_W + EPS;
        this.vel[0] = 0;
      } else {
        pos[2] = amount > 0 ? collideMin - HALF_W - EPS : collideMax + 1 + HALF_W + EPS;
        this.vel[2] = 0;
      }
      this.hitWall = true;
    }
  };

  /* 放置方块时判断是否与玩家碰撞体重叠 */
  Player.prototype.intersectsBlock = function (bx, by, bz) {
    var pos = this.pos;
    return bx + 1 > pos[0] - HALF_W && bx < pos[0] + HALF_W &&
           by + 1 > pos[1] && by < pos[1] + HEIGHT &&
           bz + 1 > pos[2] - HALF_W && bz < pos[2] + HALF_W;
  };

  function approach(cur, target, delta) {
    if (cur < target) return Math.min(cur + delta, target);
    return Math.max(cur - delta, target);
  }

  MC.Player = Player;
  MC.PLAYER_EYE = EYE;
})();
