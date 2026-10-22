/**
 * cell-defense: 纯原生 Web Audio 合成音效引擎 (零外链依赖，纯数学波形)
 */
(function(window) {
  'use strict';

  var ctx = null;
  var enabled = true;
  var lastSoundTime = {};

  function init() {
    try {
      if (!ctx) {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          ctx = new AudioContextClass();
        }
      }
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(function() {});
      }
    } catch (e) {
      // 优雅降级：静音运行
      ctx = null;
    }
  }

  // 节流辅助（防止数百个敌人同时死亡或被吞噬时爆音）
  function shouldThrottle(type, intervalMs) {
    var now = performance.now();
    if (lastSoundTime[type] && now - lastSoundTime[type] < intervalMs) {
      return true;
    }
    lastSoundTime[type] = now;
    return false;
  }

  // 1. 吞噬音 (Gulp / Pop) - 巨噬细胞伪足卷入
  function playSwallow() {
    if (!enabled || !ctx) return;
    if (shouldThrottle('swallow', 60)) return;

    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = 'sine';
    // 扫频：160Hz 快速爬升至 420Hz 然后骤降至 90Hz，形成逼真水润气泡吞咽感
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.17);
  }

  // 2. 溶酶体消化泡分解音 (Digest Fizz)
  function playDigest() {
    if (!enabled || !ctx) return;
    if (shouldThrottle('digest', 90)) return;

    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 3. 中性粒细胞酸液喷吐 (Acid Spit)
  function playAcid() {
    if (!enabled || !ctx) return;
    if (shouldThrottle('acid', 75)) return;

    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.09);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 4. B淋巴细胞发射抗体水雷 (Antibody Shoot)
  function playAntibody() {
    if (!enabled || !ctx) return;
    if (shouldThrottle('antibody', 80)) return;

    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.08);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  // 5. NK 细胞穿孔素内部爆破 (Perforin Burst)
  function playPerforin() {
    if (!enabled || !ctx) return;
    if (shouldThrottle('perforin', 80)) return;

    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.23);
  }

  // 6. 心跳双重脉动音 (Heartbeat: Lub-Dub)
  function playHeartbeat() {
    if (!enabled || !ctx) return;

    var now = ctx.currentTime;
    // Lub (第一心音)
    var osc1 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65, now);
    osc1.frequency.exponentialRampToValueAtTime(32, now + 0.18);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.19);

    // Dub (第二心音，稍短促清亮)
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(85, now + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.28, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.36);
  }

  // 7. 细胞融合进化音 (Merge & Morph Chord)
  function playFuse() {
    if (!enabled || !ctx) return;
    var now = ctx.currentTime;
    var notes = [440, 554.37, 659.25, 880]; // A 大调升序分解琶音
    notes.forEach(function(freq, index) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var t = now + index * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.21);
    });
  }

  // 8. 放置细胞 (Place Cell)
  function playPlace() {
    if (!enabled || !ctx) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.1);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // 9. 神谕技能释放 (Skill Super)
  function playSkill() {
    if (!enabled || !ctx) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  // 10. 受击/组织受损警报 (Damage Alarm)
  function playHurt() {
    if (!enabled || !ctx) return;
    if (shouldThrottle('hurt', 200)) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  function toggleSound() {
    enabled = !enabled;
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  window.CellAudio = {
    init: init,
    playSwallow: playSwallow,
    playDigest: playDigest,
    playAcid: playAcid,
    playAntibody: playAntibody,
    playPerforin: playPerforin,
    playHeartbeat: playHeartbeat,
    playFuse: playFuse,
    playPlace: playPlace,
    playSkill: playSkill,
    playHurt: playHurt,
    toggleSound: toggleSound,
    isEnabled: isEnabled
  };

})(window);
