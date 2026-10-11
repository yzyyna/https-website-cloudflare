/* localStorage 存档 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var KEY = 'minicraft_block_game_save_v1';
  var LEGACY_KEY = 'minicraft_eGLM_save_v1';
  /* 损坏存档的原始副本，只保留一份；存在它意味着玩家的旧进度被跳过了，可人工找回 */
  var CORRUPT_KEY = 'minicraft_block_game_save_corrupt_v1';

  function load() {
    var raw;
    try {
      raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    } catch (e) { return null; }
    if (!raw) return null;
    var obj = null;
    try { obj = JSON.parse(raw); } catch (e) { obj = null; }
    if (!obj || typeof obj.seed !== 'number' || isNaN(obj.seed)) {
      /* 必须在调用方 clear() 删除键之前备份，否则损坏数据会永久丢失 */
      try { localStorage.setItem(CORRUPT_KEY, raw); } catch (e) {}
      return null;
    }
    return obj;
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {}
  }

  MC.saveAPI = { load: load, save: save, clear: clear };
})();
