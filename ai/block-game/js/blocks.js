/* 方块类型定义 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});

  var BLOCK = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5,
    LOG: 6, LEAVES: 7, PLANK: 8, GLASS: 9, WATER: 10,
    BEDROCK: 11, BRICK: 12, SNOW: 13, COAL: 14,
    IRON_ORE: 15, GOLD_ORE: 16, DIAMOND_ORE: 17,
    CRAFTING_TABLE: 18, BOOKSHELF: 19, TNT: 20,
    GLOWSTONE: 21, FLOWER_RED: 22,
    TORCH: 23, PICKAXE_WOOD: 24, PICKAXE_IRON: 25, PICKAXE_DIAMOND: 26
  };

  /* 贴图图块索引（对应 textures.js 的图集位置） */
  var TILE = {
    GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5,
    LOG_SIDE: 6, LOG_TOP: 7, LEAVES: 8, PLANK: 9, GLASS: 10, WATER: 11,
    BEDROCK: 12, BRICK: 13, SNOW: 14, COAL: 15,
    IRON_ORE: 16, GOLD_ORE: 17, DIAMOND_ORE: 18,
    CRAFTING_TOP: 19, CRAFTING_SIDE: 20,
    BOOKSHELF_SIDE: 21,
    TNT_TOP: 22, TNT_SIDE: 23, TNT_BOTTOM: 24,
    GLOWSTONE: 25, FLOWER_RED: 26,
    TORCH: 27, PICKAXE_WOOD: 28, PICKAXE_IRON: 29, PICKAXE_DIAMOND: 30
  };

  /* name=显示名 top/side/bottom=贴图 solid=参与碰撞 opaque=完全遮蔽相邻面
     translucent=半透明渲染通道 hardness=挖掘秒数 targetable=可被射线选中 light=发光亮度 model=模型 */
  var DEFS = [];
  DEFS[BLOCK.AIR]            = { name: '空气',     solid: false, opaque: false, translucent: false, hardness: 0, targetable: false };
  DEFS[BLOCK.GRASS]          = { name: '草方块',   top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT, solid: true, opaque: true,  translucent: false, hardness: 0.45, targetable: true };
  DEFS[BLOCK.DIRT]           = { name: '泥土',     top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT, solid: true, opaque: true,  translucent: false, hardness: 0.4, targetable: true };
  DEFS[BLOCK.STONE]          = { name: '石头',     top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE, solid: true, opaque: true,  translucent: false, hardness: 1.1, targetable: true };
  DEFS[BLOCK.COBBLE]         = { name: '圆石',     top: TILE.COBBLE, side: TILE.COBBLE, bottom: TILE.COBBLE, solid: true, opaque: true,  translucent: false, hardness: 1.1, targetable: true };
  DEFS[BLOCK.SAND]           = { name: '沙子',     top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND, solid: true, opaque: true,  translucent: false, hardness: 0.4, targetable: true };
  DEFS[BLOCK.LOG]            = { name: '橡木原木', top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP, solid: true, opaque: true,  translucent: false, hardness: 0.8, targetable: true };
  DEFS[BLOCK.LEAVES]         = { name: '树叶',     top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES, solid: true, opaque: false, translucent: false, hardness: 0.15, targetable: true };
  DEFS[BLOCK.PLANK]          = { name: '木板',     top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK, solid: true, opaque: true,  translucent: false, hardness: 0.8, targetable: true };
  DEFS[BLOCK.GLASS]          = { name: '玻璃',     top: TILE.GLASS, side: TILE.GLASS, bottom: TILE.GLASS, solid: true, opaque: false, translucent: true, hardness: 0.25, targetable: true };
  DEFS[BLOCK.WATER]          = { name: '水',       top: TILE.WATER, side: TILE.WATER, bottom: TILE.WATER, solid: false, opaque: false, translucent: true, hardness: 0, targetable: false };
  DEFS[BLOCK.BEDROCK]        = { name: '基岩',     top: TILE.BEDROCK, side: TILE.BEDROCK, bottom: TILE.BEDROCK, solid: true, opaque: true,  translucent: false, hardness: Infinity, targetable: true };
  DEFS[BLOCK.BRICK]          = { name: '砖块',     top: TILE.BRICK, side: TILE.BRICK, bottom: TILE.BRICK, solid: true, opaque: true,  translucent: false, hardness: 1.1, targetable: true };
  DEFS[BLOCK.SNOW]           = { name: '雪块',     top: TILE.SNOW, side: TILE.SNOW, bottom: TILE.SNOW, solid: true, opaque: true,  translucent: false, hardness: 0.3, targetable: true };
  DEFS[BLOCK.COAL]           = { name: '煤矿石',   top: TILE.COAL, side: TILE.COAL, bottom: TILE.COAL, solid: true, opaque: true,  translucent: false, hardness: 1.2, targetable: true };
  DEFS[BLOCK.IRON_ORE]       = { name: '铁矿石',   top: TILE.IRON_ORE, side: TILE.IRON_ORE, bottom: TILE.IRON_ORE, solid: true, opaque: true, translucent: false, hardness: 1.4, targetable: true };
  DEFS[BLOCK.GOLD_ORE]       = { name: '金矿石',   top: TILE.GOLD_ORE, side: TILE.GOLD_ORE, bottom: TILE.GOLD_ORE, solid: true, opaque: true, translucent: false, hardness: 1.5, targetable: true };
  DEFS[BLOCK.DIAMOND_ORE]    = { name: '钻石矿石', top: TILE.DIAMOND_ORE, side: TILE.DIAMOND_ORE, bottom: TILE.DIAMOND_ORE, solid: true, opaque: true, translucent: false, hardness: 1.8, targetable: true };
  DEFS[BLOCK.CRAFTING_TABLE] = { name: '工作台',   top: TILE.CRAFTING_TOP, side: TILE.CRAFTING_SIDE, bottom: TILE.PLANK, solid: true, opaque: true, translucent: false, hardness: 0.8, targetable: true };
  DEFS[BLOCK.BOOKSHELF]      = { name: '书架',     top: TILE.PLANK, side: TILE.BOOKSHELF_SIDE, bottom: TILE.PLANK, solid: true, opaque: true, translucent: false, hardness: 0.7, targetable: true };
  DEFS[BLOCK.TNT]            = { name: 'TNT',      top: TILE.TNT_TOP, side: TILE.TNT_SIDE, bottom: TILE.TNT_BOTTOM, solid: true, opaque: true, translucent: false, hardness: 0.3, targetable: true };
  DEFS[BLOCK.GLOWSTONE]      = { name: '萤石',     top: TILE.GLOWSTONE, side: TILE.GLOWSTONE, bottom: TILE.GLOWSTONE, solid: true, opaque: true, translucent: false, hardness: 0.3, targetable: true, light: 1.0 };
  DEFS[BLOCK.FLOWER_RED]     = { name: '虞美人',   model: 'cross', top: TILE.FLOWER_RED, side: TILE.FLOWER_RED, bottom: TILE.FLOWER_RED, solid: false, opaque: false, translucent: true, hardness: 0.1, targetable: true };
  DEFS[BLOCK.TORCH]          = { name: '火把',     model: 'cross', top: TILE.TORCH, side: TILE.TORCH, bottom: TILE.TORCH, solid: false, opaque: false, translucent: true, hardness: 0.1, targetable: true, light: 1.0 };
  DEFS[BLOCK.PICKAXE_WOOD]   = { name: '木镐',     isTool: true, toolSpeed: 2.2, top: TILE.PICKAXE_WOOD, side: TILE.PICKAXE_WOOD, bottom: TILE.PICKAXE_WOOD, solid: false, opaque: false, translucent: true, hardness: 0.2, targetable: false };
  DEFS[BLOCK.PICKAXE_IRON]   = { name: '铁镐',     isTool: true, toolSpeed: 4.5, top: TILE.PICKAXE_IRON, side: TILE.PICKAXE_IRON, bottom: TILE.PICKAXE_IRON, solid: false, opaque: false, translucent: true, hardness: 0.2, targetable: false };
  DEFS[BLOCK.PICKAXE_DIAMOND]= { name: '钻石镐',   isTool: true, toolSpeed: 8.0, top: TILE.PICKAXE_DIAMOND, side: TILE.PICKAXE_DIAMOND, bottom: TILE.PICKAXE_DIAMOND, solid: false, opaque: false, translucent: true, hardness: 0.2, targetable: false };

  /* 挖掘掉落物：草方块掉泥土，石头掉圆石，其余掉自身 */
  var DROPS = {};
  DROPS[BLOCK.GRASS] = BLOCK.DIRT;
  DROPS[BLOCK.STONE] = BLOCK.COBBLE;

  MC.BLOCK = BLOCK;
  MC.TILE = TILE;
  MC.DEFS = DEFS;
  MC.DROPS = DROPS;

  MC.isSolid = function (id) { return !!(DEFS[id] && DEFS[id].solid); };
  MC.isOpaque = function (id) { return !!(DEFS[id] && DEFS[id].opaque); };
})();
