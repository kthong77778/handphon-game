/* 소리 — WebAudio 로 그때그때 합성한다.
   음원 파일을 쓰지 않는 이유: 이 게임은 빌드 과정이 없는 정적 사이트이고,
   한 장으로 묶어 배포하는 경우도 있어서 외부 파일에 기대면 소리가 사라진다. */
var Sound = (function () {

  var ctx = null;
  var master = null;
  var ready = false;
  var blocked = false;   // 오디오를 아예 못 쓰는 환경

  /** 브라우저는 사용자가 건드리기 전에는 소리를 못 내게 막는다 */
  function wake() {
    if (blocked) return false;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { blocked = true; return false; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.22;      // 게임 소리는 작게 깔린다
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      ready = true;
      return true;
    } catch (e) {
      blocked = true;
      return false;
    }
  }

  function on() { return ready && !blocked && State.get().mute === 0; }

  /**
   * 짧은 음 하나.
   * @param {{freq:number, to?:number, dur?:number, type?:string, vol?:number, delay?:number}} o
   */
  function beep(o) {
    if (!on()) return;
    try {
      var t0 = ctx.currentTime + (o.delay || 0);
      var dur = o.dur || 0.09;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);

      // 딸깍거리지 않게 여닫는다
      var vol = (o.vol === undefined ? 1 : o.vol);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  /** 치익 하는 잡음 (조리·도둑) */
  function noise(dur, vol, hz) {
    if (!on()) return;
    try {
      var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = hz || 1800; f.Q.value = 0.8;
      var g = ctx.createGain(); g.gain.value = vol || 0.5;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) {}
  }

  /* ---------- 게임이 부르는 소리들 ---------- */

  var SOUNDS = {
    // 조리 — 콤보가 오를수록 음이 높아진다
    tap: function (combo) {
      var step = Math.min(combo || 0, 24);
      beep({ freq: 320 + step * 14, to: 420 + step * 18, dur: 0.06, vol: 0.5, type: 'square' });
      noise(0.05, 0.16, 2600);
    },
    buy:     function () { beep({ freq: 480, to: 720, dur: 0.1, vol: .7 }); },
    upgrade: function () { beep({ freq: 520, to: 780, dur: .1, vol: .7 });
                           beep({ freq: 780, to: 1040, dur: .12, vol: .6, delay: .08 }); },
    // 단계 상승 — 세 음이 올라간다
    levelup: function () { [523, 659, 784].forEach(function (f, i) {
                             beep({ freq: f, dur: .16, vol: .7, delay: i * 0.07, type: 'triangle' }); }); },
    golden:  function () { [784, 988, 1319].forEach(function (f, i) {
                             beep({ freq: f, dur: .2, vol: .65, delay: i * 0.06 }); }); },
    // 도둑 — 내려가는 음으로 불안하게
    thief:   function () { beep({ freq: 300, to: 150, dur: .3, vol: .7, type: 'sawtooth' });
                           noise(0.25, 0.2, 700); },
    caught:  function () { beep({ freq: 660, to: 990, dur: .14, vol: .75 });
                           beep({ freq: 990, dur: .18, vol: .6, delay: .12 }); },
    lost:    function () { beep({ freq: 260, to: 90, dur: .45, vol: .75, type: 'sawtooth' }); },
    boost:   function () { beep({ freq: 300, to: 900, dur: .35, vol: .7, type: 'sawtooth' }); },
    prestige:function () { [523, 659, 784, 1047].forEach(function (f, i) {
                             beep({ freq: f, dur: .26, vol: .7, delay: i * 0.1 }); }); },
    achv:    function () { beep({ freq: 880, dur: .1, vol: .6 });
                           beep({ freq: 1175, dur: .16, vol: .55, delay: .09 }); },
    reward:  function () { [659, 880].forEach(function (f, i) {
                             beep({ freq: f, dur: .18, vol: .6, delay: i * 0.08 }); }); },
    blocked: function () { beep({ freq: 200, to: 140, dur: .2, vol: .6, type: 'square' }); }
  };

  /** 이름으로 소리를 낸다. 없는 이름은 조용히 무시한다. */
  function play(name, arg) {
    var f = SOUNDS[name];
    if (f) f(arg);
  }

  function muted() { return State.get().mute > 0; }

  function setMuted(m) {
    State.get().mute = m ? 1 : 0;
    if (!m) wake();
  }

  /** 오디오는 사용자가 화면을 처음 건드릴 때만 열 수 있다 */
  function arm() {
    function once() {
      wake();
      document.removeEventListener('pointerdown', once);
      document.removeEventListener('keydown', once);
    }
    document.addEventListener('pointerdown', once);
    document.addEventListener('keydown', once);
  }

  return { arm: arm, play: play, muted: muted, setMuted: setMuted, wake: wake };
})();
