/* 主循环：状态机、区块调度、交互、渲染、存档 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var BLOCK = MC.BLOCK, DEFS = MC.DEFS;

  var canvas = document.getElementById('game');
  var hud, input, renderer, world, player, inventory, particles;
  var state = 'title'; /* title | playing | paused | inventory */
  var expectUnlock = false;
  var settings = { renderDist: 4, muted: false, controlMode: 'auto' };
  var loadedOnce = false;
  var savedExists = false;

  var currentTarget = null;
  var breakTarget = null, breakProgress = 0;
  var placeCooldown = 0;
  var saveTimer = 0;
  var chunkScheduleTimer = 0;
  var lastCheckX = -99999, lastCheckZ = -99999;
  var lastT = performance.now();
  var fpsEMA = 60, statTimer = 0;
  var gameTime = 0.25; /* 0..1 循环，0.25=清晨/正午 */
  var swingAnim = 0;
  var tntList = []; /* 引线激发的 TNT 实体 */
  var dropList = []; /* 物理掉落物实体（自转浮空与磁吸拾取） */
  var stats = { mined: 0, placed: 0 };
  var welcomed = false;
  var airOxygen = 10;
  var visScanTimer = 0, lastVisX = -99999, lastVisZ = -99999, lastVisYaw = -99999, cachedVisible = null;

  /* ---------------- 初始化 ---------------- */
  function boot() {
    /* 防御：个别脚本偶发加载失败时降级（存档退化为内存态），保证游戏一定能启动 */
    if (!MC.saveAPI) {
      var mem = null;
      MC.saveAPI = {
        load: function () { return mem; },
        save: function (d) { mem = d; return true; },
        clear: function () { mem = null; }
      };
    }
    hud = new MC.Hud();
    input = new MC.Input(canvas);
    try {
      renderer = new MC.Renderer(canvas);
    } catch (e) {
      document.getElementById('gl-error').classList.remove('hidden');
      document.getElementById('title-menu').classList.add('hidden');
      console.error(e);
      return;
    }
    hud.atlasCanvas = renderer.atlas.canvas;
    hud.tilePx = renderer.atlas.tilePx;
    hud.cols = renderer.atlas.cols;
    particles = new MC.Particles();

    var saved = MC.saveAPI.load();
    savedExists = !!saved;
    if (saved) {
      world = new MC.World(saved.seed);
      world.loadEdits(saved.edits);
      player = new MC.Player(world, world.spawn);
      if (saved.player && saved.player.pos) {
        var p = saved.player.pos;
        if (isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2])) {
          player.pos = [p[0], p[1], p[2]];
          player.yaw = +saved.player.yaw || 0;
          player.pitch = +saved.player.pitch || 0;
          player.flying = !!saved.player.flying;
        }
      }
      if (saved.settings) {
        if (saved.settings.renderDist) settings.renderDist = Math.max(3, Math.min(12, saved.settings.renderDist | 0));
        settings.muted = !!saved.settings.muted;
        if (saved.settings.controlMode) settings.controlMode = saved.settings.controlMode;
      }
      if (saved.stats) {
        stats.mined = saved.stats.mined | 0;
        stats.placed = saved.stats.placed | 0;
      }
    } else {
      newWorldData();
    }

    if (settings.controlMode) {
      input.setControlMode(settings.controlMode);
    }

    inventory = new MC.Inventory();
    if (saved && saved.inv) {
      inventory.load(saved.inv);
    } else {
      inventory.add(BLOCK.COBBLE, 64);
      inventory.add(BLOCK.PLANK, 64);
      inventory.add(BLOCK.GLASS, 64);
      inventory.add(BLOCK.BRICK, 64);
    }
    if (settings.muted) MC.Sound.muted = true;

    wireInput();
    wireMenus();
    hud.buildHotbar(inventory);
    hud.buildPanel(inventory);
    hud.onCloseInventory = closeInventory;
    hud.onSlotClick = function (idx) {
      inventory.clickSlot(idx);
      MC.Sound.ui();
    };
    hud.onCraftClick = function (recipe) {
      var haveMaterials = true;
      for (var i = 0; i < recipe.cost.length; i++) {
        if (inventory.countItem(recipe.cost[i][0]) < recipe.cost[i][1]) {
          haveMaterials = false;
          break;
        }
      }
      if (!haveMaterials) {
        hud.toast('材料不足');
        return;
      }
      if (inventory.craft(recipe)) {
        MC.Sound.craft();
        hud.toast('制作成功: ' + recipe.name);
      } else {
        hud.toast('⚠️ 背包已满，无多余空间');
      }
    };
    inventory.onChange = function () {
      hud.refreshHotbar(inventory);
      hud.refreshPanel(inventory);
    };
    document.getElementById('sel-dist').value = String(settings.renderDist);
    updateSoundLabel();
    hud.showState('title');
    document.getElementById('title-seed').textContent =
      '种子 ' + world.seed + (savedExists ? ' · 已从存档恢复（自动保存中）' : ' · 进度将自动保存');
    window.addEventListener('beforeunload', doSave);
    requestAnimationFrame(loop);
    /* rAF 饥饿看门狗：浏览器面板不渲染帧时（后台/遮挡）保底 4Hz 推进，
       保证后台自动存档与逻辑不冻结；rAF 正常时 lastT 防重入 */
    setInterval(function () {
      if (performance.now() - lastT > 400) tick(performance.now());
    }, 250);
  }

  function newWorldData() {
    var seed = (Math.random() * 0x7fffffff) | 0;
    world = new MC.World(seed);
    player = new MC.Player(world, world.spawn);
    loadedOnce = false;
    stats.mined = 0;
    stats.placed = 0;
    welcomed = false;
    MC.saveAPI.clear();
  }

  /* ---------------- 输入接线 ---------------- */
  function wireInput() {
    input.onLook = function (dx, dy) {
      if (state !== 'playing') return;
      var s = 0.0022;
      player.yaw += dx * s;
      player.pitch -= dy * s;
      var lim = 1.553;
      if (player.pitch > lim) player.pitch = lim;
      if (player.pitch < -lim) player.pitch = -lim;
    };
    input.onSelect = function (i) {
      if (state !== 'playing' && state !== 'inventory') return;
      inventory.selected = i;
      inventory._emit();
    };
    input.onScroll = function (dir) {
      if (state !== 'playing') return;
      inventory.selected = (inventory.selected + dir + MC.Inventory.HOTBAR) % MC.Inventory.HOTBAR;
      inventory._emit();
    };
    input.onToggleInventory = function () {
      if (state === 'playing') {
        state = 'inventory';
        expectUnlock = true;
        input.exitLock();
        hud.showState('inventory');
      } else if (state === 'inventory') {
        closeInventory();
      }
    };
    input.onToggleFly = function () {
      if (state !== 'playing') return;
      var on = player.toggleFly();
      hud.toast(on ? '飞行模式：开' : '飞行模式：关');
    };
    input.onToggleMute = function () {
      var muted = MC.Sound.toggleMute();
      settings.muted = muted;
      updateSoundLabel();
      hud.toast(muted ? '已静音' : '声音开启');
    };
    input.onPick = function () {
      if (state !== 'playing' || !currentTarget) return;
      var dropId = MC.DROPS[currentTarget.id] || currentTarget.id;
      if (!inventory.pick(dropId)) hud.toast('背包中没有这种方块');
    };
    input.onRequestLock = function () {
      if (state === 'playing' || state === 'paused' || state === 'title') {
        input.requestLock();
      }
    };
    input.onLockError = function () {
      hud.toast('鼠标锁定暂时不可用，请稍半秒再点一次');
    };
    input.onLockChange = function (locked) {
      input.enabled = locked;
      MC.Sound.init();
      if (locked) {
        state = 'playing';
        hud.showState('playing');
        if (!welcomed) {
          welcomed = true;
          hud.toast('欢迎来到方块世界！先砍树试试手感');
          setTimeout(function () {
            if (state === 'playing') {
              var isTouch = input.isTouchActive();
              hud.toast(isTouch ? '按右侧挖掘键采集 · 放置键建造 · 🎒 打开背包' : '长按左键挖掘 · 右键建造 · E 打开背包');
            }
          }, 2200);
        }
      } else {
        if (state === 'playing') {
          if (expectUnlock) {
            state = 'inventory';
          } else {
            state = 'paused';
            doSave();
          }
        }
        expectUnlock = false;
        hud.showState(state);
        input.resetInputs();
        breakProgress = 0;
        breakTarget = null;
        hud.setProgress(0);
      }
    };
  }

  function closeInventory() {
    state = 'playing';
    hud.showState('playing');
    input.requestLock();
  }

  /* ---------------- 菜单 ---------------- */
  function wireMenus() {
    document.getElementById('btn-start').addEventListener('click', function () {
      input.requestLock();
    });
    document.getElementById('btn-resume').addEventListener('click', function () {
      input.requestLock();
    });
    document.getElementById('btn-sound').addEventListener('click', function () {
      var muted = MC.Sound.toggleMute();
      settings.muted = muted;
      updateSoundLabel();
    });
    armConfirm('btn-new', function () {
      newWorldData();
      inventory.clear();
      inventory.add(BLOCK.COBBLE, 64);
      inventory.add(BLOCK.PLANK, 64);
      inventory.add(BLOCK.GLASS, 64);
      inventory.add(BLOCK.BRICK, 64);
      hud.invalidateIcons();
      inventory._emit();
      document.getElementById('title-seed').textContent = '种子 ' + world.seed + ' · 进度将自动保存';
      hud.toast('新世界已生成');
      input.requestLock();
    });
    armConfirm('btn-new2', function () {
      newWorldData();
      inventory.clear();
      inventory.add(BLOCK.COBBLE, 64);
      inventory.add(BLOCK.PLANK, 64);
      inventory.add(BLOCK.GLASS, 64);
      inventory.add(BLOCK.BRICK, 64);
      hud.invalidateIcons();
      inventory._emit();
      hud.toast('新世界已生成');
      input.requestLock();
    });
    var selControl = document.getElementById('sel-control-mode');
    if (selControl) {
      selControl.value = settings.controlMode || 'auto';
      selControl.addEventListener('change', function (e) {
        settings.controlMode = e.target.value;
        input.setControlMode(settings.controlMode);
      });
    }
    document.getElementById('sel-dist').addEventListener('change', function (e) {
      settings.renderDist = +e.target.value || 4;
    });
  }

  function armConfirm(btnId, fn) {
    var btn = document.getElementById(btnId);
    var armed = false, timer = null;
    btn.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        btn.classList.add('armed');
        btn.dataset.orig = btn.textContent;
        btn.textContent = '再点一次确认（清除存档）';
        timer = setTimeout(function () {
          armed = false;
          btn.classList.remove('armed');
          btn.textContent = btn.dataset.orig;
        }, 3500);
      } else {
        clearTimeout(timer);
        armed = false;
        btn.classList.remove('armed');
        btn.textContent = btn.dataset.orig;
        fn();
      }
    });
  }

  function updateSoundLabel() {
    document.getElementById('btn-sound').textContent = MC.Sound.muted ? '声音：关' : '声音：开';
  }

  /* ---------------- 存档 ---------------- */
  function doSave() {
    if (!world) return false;
    var ok = MC.saveAPI.save({
      seed: world.seed,
      edits: world.serializeEdits(),
      player: {
        pos: player.pos, yaw: player.yaw, pitch: player.pitch, flying: player.flying
      },
      inv: inventory.serialize(),
      settings: settings,
      stats: stats
    });
    if (ok) {
      savedExists = true;
    } else {
      if (hud && hud.toast) hud.toast('⚠️ 本地存储空间不足，自动存档失败');
    }
    return ok;
  }

  /* ---------------- 交互（挖掘/放置） ---------------- */
  function igniteTNT(x, y, z) {
    world.setBlock(x, y, z, BLOCK.AIR);
    tntList.push({
      x: x + 0.5, y: y + 0.1, z: z + 0.5,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 3.2,
      vz: (Math.random() - 0.5) * 0.8,
      fuse: 2.5
    });
    MC.Sound.fuse();
    hud.toast('💥 TNT 已激活！快后撤！');
  }

  function explodeTNT(ex, ey, ez) {
    MC.Sound.explode();
    /* 巨大冲击波与火光碎片 */
    for (var p = 0; p < 70; p++) {
      particles.list.push({
        x: ex + (Math.random() - 0.5) * 0.9,
        y: ey + (Math.random() - 0.5) * 0.9,
        z: ez + (Math.random() - 0.5) * 0.9,
        vx: (Math.random() - 0.5) * 14,
        vy: 3 + Math.random() * 9,
        vz: (Math.random() - 0.5) * 14,
        age: 0,
        life: 0.65 + Math.random() * 0.55,
        r: 1.0,
        g: 0.35 + Math.random() * 0.45,
        b: 0.1,
        size: 0.22 + Math.random() * 0.22
      });
    }

    /* 破坏周边半径 3.2m 范围内的所有非基岩方块 */
    var r = 3.2;
    var ix0 = Math.floor(ex - r), ix1 = Math.ceil(ex + r);
    var iy0 = Math.max(1, Math.floor(ey - r)), iy1 = Math.min(MC.WORLD_H - 1, Math.ceil(ey + r));
    var iz0 = Math.floor(ez - r), iz1 = Math.ceil(ez + r);

    for (var by = iy0; by <= iy1; by++) {
      for (var bz = iz0; bz <= iz1; bz++) {
        for (var bx = ix0; bx <= ix1; bx++) {
          var dist = Math.hypot(bx + 0.5 - ex, by + 0.5 - ey, bz + 0.5 - ez);
          if (dist <= r) {
            var bId = world.getBlock(bx, by, bz);
            if (bId === BLOCK.AIR || bId === BLOCK.BEDROCK) continue;
            if (bId === BLOCK.TNT) {
              /* 邻近 TNT 被引爆，短引线形成连锁爆炸 */
              world.setBlock(bx, by, bz, BLOCK.AIR);
              tntList.push({
                x: bx + 0.5, y: by + 0.1, z: bz + 0.5,
                vx: (bx + 0.5 - ex) * 1.2, vy: 4 + Math.random() * 2, vz: (bz + 0.5 - ez) * 1.2,
                fuse: 0.25 + Math.random() * 0.4
              });
            } else {
              world.setBlock(bx, by, bz, BLOCK.AIR);
              if (Math.random() < 0.25) {
                particles.spawnBurst(renderer.atlas, bId, bx, by, bz);
              }
              if (Math.random() < 0.4) {
                var dId = MC.DROPS[bId] || bId;
                spawnDrop(dId, bx, by, bz);
              }
            }
          }
        }
      }
    }

    /* 玩家冲击波击飞 */
    var pEye = player.eye();
    var pDist = Math.hypot(pEye[0] - ex, pEye[1] - ey, pEye[2] - ez);
    if (pDist < 7.5 && pDist > 0.1) {
      var blast = (7.5 - pDist) / 7.5 * 26.0;
      var dx = (pEye[0] - ex) / pDist;
      var dy = (pEye[1] - ey) / pDist;
      var dz = (pEye[2] - ez) / pDist;
      player.vel[0] += dx * blast;
      player.vel[1] += Math.max(10.0, dy * blast + 8.0);
      player.vel[2] += dz * blast;
      player.onGround = false;
      hud.toast('💥 轰！！！');
    }
  }

  function spawnDrop(id, x, y, z) {
    if (dropList.length > 80) dropList.shift();
    dropList.push({
      id: id,
      x: x + 0.5,
      y: y + 0.35,
      z: z + 0.5,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 2.8 + Math.random() * 1.0,
      vz: (Math.random() - 0.5) * 1.6,
      rot: Math.random() * Math.PI * 2,
      bobOffset: Math.random() * Math.PI * 2,
      age: 0
    });
  }

  function doMine(t) {
    var id = world.getBlock(t.x, t.y, t.z);
    if (id === BLOCK.AIR || !isFinite(DEFS[id].hardness)) return;
    var dropId = MC.DROPS[id] || id;
    world.setBlock(t.x, t.y, t.z, BLOCK.AIR);
    particles.spawnBurst(renderer.atlas, id, t.x, t.y, t.z);
    MC.Sound.breakBlock(id);
    if (id !== BLOCK.TNT) {
      spawnDrop(dropId, t.x, t.y, t.z);
    }
    stats.mined++;
    breakProgress = 0;
    breakTarget = null;
  }

  function doPlace(t) {
    if (!t) return;
    /* 右键点击 TNT 直接点火激发 */
    var targetedBlock = world.getBlock(t.x, t.y, t.z);
    if (targetedBlock === BLOCK.TNT) {
      igniteTNT(t.x, t.y, t.z);
      return;
    }
    if (!t.face) return;
    var px = t.x + t.face[0], py = t.y + t.face[1], pz = t.z + t.face[2];
    if (py < 1 || py >= MC.WORLD_H) return;
    var cur = world.getBlock(px, py, pz);
    if (cur !== BLOCK.AIR && cur !== BLOCK.WATER) return;
    var item = inventory.getSelected();
    if (!item) { hud.toast('当前快捷栏格是空的'); return; }
    if (DEFS[item.id].isTool) return; /* 镐子等工具用于开采，不可放置 */
    /* 火把、花等非固体方块不能放进水里悬浮 */
    if (!DEFS[item.id].solid && cur !== BLOCK.AIR) return;
    if (DEFS[item.id].solid && player.intersectsBlock(px, py, pz)) return;
    world.setBlock(px, py, pz, item.id);
    inventory.consumeSelected();
    stats.placed++;
    MC.Sound.place();
  }

  /* ---------------- 区块调度 ---------------- */
  function updateChunks(centerX, centerZ) {
    var R = settings.renderDist;
    var pcx = Math.floor(centerX / MC.CHUNK);
    var pcz = Math.floor(centerZ / MC.CHUNK);
    var budgetData = loadedOnce ? 1 : 12;
    var budgetMesh = loadedOnce ? 1 : 12;
    var dx, dz, d2;

    /* 生成数据（比可视半径多一圈，供网格跨界取方块） */
    var needData = [];
    for (dz = -(R + 1); dz <= R + 1; dz++) {
      for (dx = -(R + 1); dx <= R + 1; dx++) {
        d2 = dx * dx + dz * dz;
        if (d2 > (R + 1.5) * (R + 1.5)) continue;
        var k = world.key(pcx + dx, pcz + dz);
        if (!world.chunks.has(k)) needData.push([d2, pcx + dx, pcz + dz]);
      }
    }
    needData.sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < needData.length && budgetData > 0; i++, budgetData--) {
      world.ensureData(needData[i][1], needData[i][2]);
    }

    /* 构建网格（严格把控单帧时间，超过 4.2ms 立即让出主线程，杜绝行走掉帧） */
    var needMesh = [];
    world.chunks.forEach(function (ch) {
      dx = ch.cx - pcx; dz = ch.cz - pcz;
      d2 = dx * dx + dz * dz;
      if (d2 > (R + 0.5) * (R + 0.5)) return;
      if (!ch.mesh) needMesh.push([d2, ch]);
    });
    needMesh.sort(function (a, b) { return a[0] - b[0]; });
    var meshStart = performance.now();
    for (var j = 0; j < needMesh.length && budgetMesh > 0; j++, budgetMesh--) {
      if (loadedOnce && performance.now() - meshStart > 4.2) break;
      var chm = needMesh[j][1];
      renderer.uploadChunk(chm, MC.buildChunkMesh(world, chm));
    }

    /* 编辑产生的重建 */
    var rebuilt = 0;
    world.dirtySet.forEach(function (key) {
      if (rebuilt >= 2) return;
      var c = world.chunks.get(key);
      world.dirtySet.delete(key);
      if (c && c.mesh) {
        renderer.uploadChunk(c, MC.buildChunkMesh(world, c));
        rebuilt++;
      }
    });

    /* 卸载远处区块 */
    var limit = (R + 3) * (R + 3);
    var toDelete = [];
    world.chunks.forEach(function (c) {
      dx = c.cx - pcx; dz = c.cz - pcz;
      if (dx * dx + dz * dz > limit) toDelete.push(world.key(c.cx, c.cz));
    });
    for (var d = 0; d < toDelete.length; d++) {
      var cd = world.chunks.get(toDelete[d]);
      if (cd) {
        if (cd.mesh) renderer.disposeChunk(cd);
        world.chunks.delete(toDelete[d]);
      }
    }

    if (!loadedOnce && needData.length === 0 && needMesh.length === 0) loadedOnce = true;
  }

  function maybeUpdateChunks(px, pz, dt) {
    chunkScheduleTimer += dt;
    var moved = Math.hypot(px - lastCheckX, pz - lastCheckZ) > 3.5;
    var needsDirty = world.dirtySet.size > 0;
    if (!loadedOnce || needsDirty || moved || chunkScheduleTimer > 0.12) {
      chunkScheduleTimer = 0;
      lastCheckX = px;
      lastCheckZ = pz;
      updateChunks(px, pz);
    }
  }

  /* ---------------- 主循环 ---------------- */
  function tick(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    fpsEMA = fpsEMA * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;

    var locked = input.isLocked();

    /* 疾跑视野拉伸（FOV 平滑过渡） */
    var pi = input.playerInput();
    var sprinting = !player.flying && pi.mf > 0 && (pi.shift || pi.ctrl);
    var targetFov = (75 + (sprinting ? 8 : 0)) * Math.PI / 180;
    renderer.fov += (targetFov - renderer.fov) * Math.min(1, dt * 9);

    if (state === 'playing') {
      player.update(dt, pi);
      maybeUpdateChunks(player.pos[0], player.pos[2], dt);

      /* 目标方块 */
      currentTarget = MC.raycast(world, player.eye(), player.forward(), 5);
      hud.setTargetName(currentTarget ? DEFS[currentTarget.id].name : '');

      /* 挖掘（长按） */
      if (input.mouse.left && currentTarget && locked) {
        swingAnim = Math.sin(now * 0.016);
        var hardness = DEFS[currentTarget.id].hardness;
        var selItem = inventory.getSelected();
        var toolSpeed = 1.0;
        if (selItem && DEFS[selItem.id] && DEFS[selItem.id].isTool) {
          toolSpeed = DEFS[selItem.id].toolSpeed || 2.0;
        }
        var effHardness = hardness / toolSpeed;
        if (isFinite(effHardness)) {
          if (breakTarget &&
              breakTarget.x === currentTarget.x &&
              breakTarget.y === currentTarget.y &&
              breakTarget.z === currentTarget.z) {
            breakProgress += dt / effHardness;
          } else {
            breakTarget = currentTarget;
            breakProgress = dt / effHardness;
          }
          if (breakProgress >= 1) doMine(breakTarget);
        } else {
          breakProgress = 0;
          breakTarget = null;
        }
      } else {
        breakProgress = 0;
        breakTarget = null;
      }
      hud.setProgress(breakProgress > 0 ? breakProgress : 0);

      /* 放置（右键，可长按连放） */
      placeCooldown -= dt;
      if (input.mouse.right && locked && placeCooldown <= 0) {
        swingAnim = 0.85;
        doPlace(currentTarget);
        placeCooldown = 0.24;
      }

      if (!input.mouse.left && placeCooldown <= 0.1) {
        swingAnim = approach(swingAnim, 0, dt * 5.0);
      }

      /* 自动保存 */
      saveTimer += dt;
      if (saveTimer > 12) { saveTimer = 0; doSave(); }
    } else {
      maybeUpdateChunks(player.pos[0], player.pos[2], dt);
      hud.setProgress(0);
      hud.setTargetName('');
      swingAnim = 0;
    }

    /* TNT 引线燃烧与物理下落 */
    for (var ti = tntList.length - 1; ti >= 0; ti--) {
      var tnt = tntList[ti];
      tnt.fuse -= dt;
      var prevTntY = tnt.y;
      tnt.vy = Math.max(-25, tnt.vy - 16 * dt);
      tnt.x += tnt.vx * dt;
      tnt.y += tnt.vy * dt;
      tnt.z += tnt.vz * dt;
      var checkMinTY = Math.floor(tnt.y);
      var checkMaxTY = Math.floor(prevTntY);
      for (var cy = checkMaxTY; cy >= checkMinTY; cy--) {
        if (MC.isSolid(world.getBlock(Math.floor(tnt.x), cy, Math.floor(tnt.z)))) {
          tnt.y = cy + 1.0;
          tnt.vy = 0;
          tnt.vx *= 0.75;
          tnt.vz *= 0.75;
          break;
        }
      }
      if (tnt.fuse <= 0) {
        tntList.splice(ti, 1);
        explodeTNT(tnt.x, tnt.y, tnt.z);
      }
    }

    /* 3D 浮空掉落物物理更新、自转微动与磁吸拾取 */
    var pBodyY = player.pos[1] + 0.8;
    for (var di = dropList.length - 1; di >= 0; di--) {
      var drop = dropList[di];
      drop.age += dt;
      drop.rot += dt * 3.6;
      var prevDropY = drop.y;
      drop.vy = Math.max(-20, drop.vy - 16 * dt);
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.z += drop.vz * dt;

      /* 简易地面碰撞与悬浮轻漾微动（防穿透多阶检测） */
      var checkMinDY = Math.floor(drop.y);
      var checkMaxDY = Math.floor(prevDropY);
      for (var dcy = checkMaxDY; dcy >= checkMinDY; dcy--) {
        if (MC.isSolid(world.getBlock(Math.floor(drop.x), dcy, Math.floor(drop.z)))) {
          drop.y = dcy + 1.05 + Math.sin(drop.age * 4.0 + drop.bobOffset) * 0.06;
          drop.vy = 0;
          drop.vx *= 0.75;
          drop.vz *= 0.75;
          break;
        }
      }

      /* 玩家磁吸检测 (3.2m 内自动加速飞向玩家身体中心) */
      var mdx = player.pos[0] - drop.x;
      var mdy = pBodyY - drop.y;
      var mdz = player.pos[2] - drop.z;
      var mDist = Math.hypot(mdx, mdy, mdz);

      if (mDist < 3.2 && mDist > 0.05) {
        var pull = (3.2 - mDist) / 3.2 * 18.0;
        drop.vx += (mdx / mDist) * pull * dt;
        drop.vy += (mdy / mDist) * pull * dt;
        drop.vz += (mdz / mDist) * pull * dt;
      }

      /* 触碰玩家入包拾取 (身体中心 1.35m 范围内) */
      if (mDist < 1.35) {
        if (inventory.add(drop.id, 1)) {
          MC.Sound.pickup();
          var dropDef = MC.DEFS[drop.id];
          if (dropDef) hud.toast('+1 ' + dropDef.name);
          dropList.splice(di, 1);
          continue;
        }
      }

      if (drop.age > 300) {
        dropList.splice(di, 1);
      }
    }

    /* 昼夜循环推进（4分钟一个完整昼夜） */
    gameTime = (gameTime + dt / 240) % 1.0;
    var dayPhase = gameTime;
    var skyColor, sunLight, timeDesc;
    if (dayPhase < 0.15) {
      /* 清晨日出 (0.0..0.15)：暖橙过渡至晴朗天蓝 */
      var t = dayPhase / 0.15;
      skyColor = [lerp(0.85, 0.55, t), lerp(0.48, 0.75, t), lerp(0.32, 0.98, t)];
      sunLight = lerp(0.68, 1.0, t);
      timeDesc = '清晨';
    } else if (dayPhase < 0.55) {
      /* 白昼正午 (0.15..0.55)：明朗天蓝，阳光最足 */
      skyColor = [0.55, 0.75, 0.98];
      sunLight = 1.0;
      timeDesc = '白昼';
    } else if (dayPhase < 0.7) {
      /* 傍晚黄昏 (0.55..0.7)：晚霞绯红金黄 */
      var t = (dayPhase - 0.55) / 0.15;
      skyColor = [lerp(0.55, 0.88, t), lerp(0.75, 0.42, t), lerp(0.98, 0.28, t)];
      sunLight = lerp(1.0, 0.72, t);
      timeDesc = '黄昏';
    } else {
      /* 深邃星夜 (0.7..1.0)：深蓝暗夜，月光清冷 */
      var t = (dayPhase - 0.7) / 0.3;
      skyColor = [lerp(0.04, 0.85, t), lerp(0.06, 0.48, t), lerp(0.14, 0.32, t)];
      sunLight = lerp(0.42, 0.68, t);
      timeDesc = '夜间';
    }

    /* 更新第一人称手持方块与手臂摆动（平滑阻尼，杜绝抽搐） */
    if (state === 'playing') {
      var selItem = inventory.getSelected();
      var selId = selItem ? selItem.id : null;
      var hSpeed = Math.hypot(player.vel[0], player.vel[2]);
      var bob = player.walkPhase || 0;
      var bobAmp = Math.min(1.0, hSpeed / 4.2);
      hud.updateHand(selId, bob, bobAmp, Math.abs(swingAnim));
    }

    particles.update(dt);

    /* 相机 */
    var eye, fwd;
    if (state === 'title') {
      var sp = world.spawn;
      var a = now * 0.00012;
      eye = [sp[0] + Math.cos(a) * 26, sp[1] + 12, sp[2] + Math.sin(a) * 26];
      var tx = sp[0] - eye[0], ty = sp[1] + 1 - eye[1], tz = sp[2] - eye[2];
      var tl = Math.hypot(tx, ty, tz) || 1;
      fwd = [tx / tl, ty / tl, tz / tl];
    } else {
      eye = player.eye();
      fwd = player.forward();
    }

    /* 可见区块集合（带位移缓存与节流，避免每帧对上百个区块全量扫描和排序） */
    var R = settings.renderDist;
    var ccx = Math.floor(eye[0] / MC.CHUNK), ccz = Math.floor(eye[2] / MC.CHUNK);
    visScanTimer += dt;
    var curYaw = (state === 'title' ? 0 : player.yaw);
    var turnedVis = Math.abs(curYaw - lastVisYaw) > 0.15;
    var movedVis = Math.hypot(eye[0] - lastVisX, eye[2] - lastVisZ) > 1.8;
    if (movedVis || turnedVis || visScanTimer > 0.08 || world.dirtySet.size > 0 || !cachedVisible) {
      visScanTimer = 0;
      lastVisX = eye[0];
      lastVisZ = eye[2];
      lastVisYaw = curYaw;
      cachedVisible = [];
      world.chunks.forEach(function (c) {
        if (!c.mesh) return;
        var ddx = c.cx - ccx, ddz = c.cz - ccz;
        var d2 = ddx * ddx + ddz * ddz;
        if (d2 > (R + 0.5) * (R + 0.5)) return;
        if (state !== 'title' && d2 > 2) {
          var cdx = (c.cx + 0.5) * MC.CHUNK - eye[0];
          var cdz = (c.cz + 0.5) * MC.CHUNK - eye[2];
          var dot = cdx * fwd[0] + cdz * fwd[2];
          if (dot < -18) return;
        }
        cachedVisible.push(c);
      });
      cachedVisible.sort(function (a, b) {
        var da = (a.cx - ccx) * (a.cx - ccx) + (a.cz - ccz) * (a.cz - ccz);
        var db = (b.cx - ccx) * (b.cx - ccx) + (b.cz - ccz) * (b.cz - ccz);
        return da - db;
      });
    }
    var visible = cachedVisible;

    var eyeBlock = world.getBlock(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    var underwater = eyeBlock === BLOCK.WATER && state !== 'title';
    hud.setUnderwater(underwater);
    if (state === 'playing') {
      if (player.headInWater) {
        airOxygen -= dt * 0.5;
        if (airOxygen < 0) airOxygen = 0;
      } else {
        airOxygen = 10;
      }
      hud.setAir(Math.ceil(airOxygen), player.headInWater);
    } else {
      hud.setAir(10, false);
    }
    hud.showHint(state === 'playing' && !locked);

    var pdata = particles.getData();
    renderer.render({
      eye: eye, fwd: fwd,
      chunks: visible,
      target: currentTarget,
      showTarget: state === 'playing' && locked,
      breakProgress: breakProgress,
      particleData: pdata.count > 0 ? pdata.arr.subarray(0, pdata.count * 7) : null,
      particleCount: pdata.count,
      underwater: underwater,
      skyColor: skyColor,
      sunLight: sunLight,
      handLight: !!(selItem && DEFS[selItem.id] && DEFS[selItem.id].light),
      dayPhase: dayPhase,
      time: now * 0.001,
      tntList: tntList,
      dropList: dropList,
      fogFar: (R - 0.25) * MC.CHUNK
    });

    /* 状态栏 */
    statTimer -= dt;
    if (statTimer <= 0) {
      statTimer = 0.2;
      var dirs = ['北 -Z', '东 +X', '南 +Z', '西 -X'];
      var dirIdx = Math.round(((player.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4;
      hud.setStats(
        'FPS ' + Math.round(fpsEMA) +
        '\n坐标 ' + player.pos[0].toFixed(1) + ' / ' + player.pos[1].toFixed(1) + ' / ' + player.pos[2].toFixed(1) +
        '\n朝向 ' + dirs[dirIdx] + ' · ' + timeDesc +
        (player.flying ? '  [飞行]' : '') +
        '\n挖掘 ' + stats.mined + ' · 建造 ' + stats.placed +
        '\n区块 ' + world.chunks.size + ' · 距离 ' + settings.renderDist
      );
    }
  }

  function approach(cur, target, delta) {
    if (cur < target) return Math.min(cur + delta, target);
    return Math.max(cur - delta, target);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    tick(now);
  }

  /* ---------------- 自动化测试钩子 ---------------- */
  window.MCX = {
    get state() { return state; },
    get world() { return world; },
    get player() { return player; },
    get inventory() { return inventory; },
    get target() { return currentTarget; },
    get tntList() { return tntList; },
    get dropList() { return dropList; },
    get stats() { return { mined: stats.mined, placed: stats.placed }; },
    setTime: function (t) { gameTime = t % 1.0; },
    /* 手动推进 n 帧（dt=1/30），供无渲染环境自动化测试用 */
    step: function (n) {
      for (var i = 0; i < n; i++) {
        lastT = performance.now() - 33;
        tick(performance.now());
      }
    },
    igniteTNT: function (x, y, z) { igniteTNT(x, y, z); },
    start: function () { state = 'playing'; hud.showState('playing'); },
    setKey: function (code, down) { input.debugKey(code, down); },
    mine: function () { if (currentTarget) doMine(currentTarget); },
    place: function () { if (currentTarget) doPlace(currentTarget); },
    teleport: function (x, y, z) {
      player.pos = [x, y, z];
      player.vel = [0, 0, 0];
    },
    info: function () {
      return {
        state: state,
        pos: player.pos.slice(),
        onGround: player.onGround,
        chunks: world.chunks.size,
        selected: inventory.selected,
        hotbar: inventory.slots.slice(0, 9).map(function (s) { return s ? [s.id, s.count] : null; })
      };
    }
  };

  /* boot 启动兜底：任何初始化异常都显示在页面上，避免无声黑屏 */
  try {
    boot();
  } catch (e) {
    console.error(e);
    var ge = document.getElementById('gl-error');
    ge.classList.remove('hidden');
    ge.querySelector('p').textContent = '初始化失败：' + e.message + '（请刷新重试）';
    document.getElementById('title-menu').classList.add('hidden');
  }
})();
