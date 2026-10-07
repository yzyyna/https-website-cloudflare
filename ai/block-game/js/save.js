/* localStorage 存档 */
(function () {
  'use strict';
  var MC = (window.MC = window.MC || {});
  var KEY = 'minicraft_block_game_save_v1';
  var LEGACY_KEY = 'minicraft_eGLM_save_v1';

  function load() {
    try {
      var raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj.seed !== 'number' || isNaN(obj.seed)) return null;
      return obj;
    } catch (e) { return null; }
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
