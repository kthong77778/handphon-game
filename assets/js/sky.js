/* ---------- 하늘 (시간대 배경) ----------
   실제 시각에 따라 앱 배경(--appbg)이 새벽→낮→노을→밤으로 흐른다.
   '따뜻한 노을(I)' 을 해질녘 구간에 그대로 넣었다 — 저녁이면 그 풍경이 된다.

   구현 메모
   - 새 DOM 을 만들지 않는다. 배경은 #app 이 이미 var(--appbg) 로 칠한다.
     그래서 해/달은 '방사형 그라데이션 한 겹'으로 얹고 하늘은 그 아래 세로
     그라데이션으로 깐다 — 한 줄(--appbg)로 하늘 + 해가 다 들어간다.
   - 색 테마(설정)가 '기본(auto)' 일 때만 하늘을 그린다. 포장마차·중화풍을
     고르면 그 테마의 --appbg 가 이기고 하늘은 손대지 않는다.
   - 수치·세이브에는 일절 관여하지 않는다. 순수 연출. */
var Sky = (function () {
  'use strict';

  // 하루의 색 마디. h=시(0~24), sky=[위,중간,지평선], orb=[해/달 속, 번짐],
  // x/y=해 위치(%), r=반지름(px), i=해·달 세기(0~1, 0이면 안 보임), moon=달이면 1.
  var STOPS = [
    { h: 0,    sky: ['#0b1020', '#0e1428', '#151a30'], orb: ['#e6ecf7', '#aab7d2'], x: 60, y: 22, r: 80,  i: 0.55, moon: 1 },
    { h: 5,    sky: ['#14182f', '#222643', '#3b3550'], orb: ['#f6d8b0', '#c98f86'], x: 24, y: 78, r: 120, i: 0.35, moon: 0 },
    { h: 7,    sky: ['#1f2c4e', '#3a4a72', '#8a7f8e'], orb: ['#ffe3b0', '#e0a070'], x: 33, y: 54, r: 120, i: 0.85, moon: 0 },
    { h: 12,   sky: ['#1e3a63', '#356090', '#6f9bc0'], orb: ['#fff2d6', '#ffd48a'], x: 50, y: 15, r: 100, i: 1,    moon: 0 },
    { h: 16,   sky: ['#2b2452', '#6a3f66', '#b7614f'], orb: ['#ffcf7a', '#ff9a50'], x: 64, y: 46, r: 132, i: 1,    moon: 0 },
    { h: 18.5, sky: ['#2b2150', '#9c4f55', '#e0864f'], orb: ['#ffb45a', '#ff7e3a'], x: 74, y: 71, r: 152, i: 1,    moon: 0 }, // ← 따뜻한 노을(I)
    { h: 20,   sky: ['#241a44', '#4a2b52', '#7c4a58'], orb: ['#e07a44', '#b0502e'], x: 82, y: 88, r: 120, i: 0.45, moon: 0 }, // 막 넘어감
    { h: 21,   sky: ['#181436', '#241d40', '#332a46'], orb: ['#e6ecf7', '#b7c2da'], x: 32, y: 30, r: 82,  i: 0.5,  moon: 1 }, // 달 뜸
    { h: 24,   sky: ['#0b1020', '#0e1428', '#151a30'], orb: ['#e6ecf7', '#aab7d2'], x: 60, y: 22, r: 80,  i: 0.55, moon: 1 }
  ];

  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' +
                    Math.round(x[1] + (y[1] - x[1]) * t) + ',' +
                    Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }
  function rgba(c, a) {
    var x = hex(c);
    return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')';
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 두 마디 사이를 시간 비율로 섞은 한 프레임을 만든다
  function frame(h) {
    var a = STOPS[0], b = STOPS[STOPS.length - 1];
    for (var i = 0; i < STOPS.length - 1; i++) {
      if (h >= STOPS[i].h && h <= STOPS[i + 1].h) { a = STOPS[i]; b = STOPS[i + 1]; break; }
    }
    var span = b.h - a.h;
    var t = span > 0 ? (h - a.h) / span : 0;
    return {
      sky: [mix(a.sky[0], b.sky[0], t), mix(a.sky[1], b.sky[1], t), mix(a.sky[2], b.sky[2], t)],
      core: a.orb[0], glow: a.orb[1], core2: b.orb[0], glow2: b.orb[1], t: t,
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), r: lerp(a.r, b.r, t), inten: lerp(a.i, b.i, t)
    };
  }

  // 프레임을 --appbg 문자열로: [해/달 방사형] 위에 [하늘 세로 그라데이션]
  function toBg(f) {
    var core = mix(f.core, f.core2, f.t), glow = mix(f.glow, f.glow2, f.t);
    // 또렷한 원반(속) → 번짐 → 사라짐. 살짝 뚜렷한 해/달이 보이도록 속을 좁게 밝힌다.
    var orb = 'radial-gradient(' + Math.round(f.r) + 'px ' + Math.round(f.r) + 'px at ' +
      f.x.toFixed(1) + '% ' + f.y.toFixed(1) + '%, ' +
      rgba(core, 0.98 * f.inten) + ' 0%, ' +
      rgba(core, 0.9 * f.inten) + ' 13%, ' +
      rgba(glow, 0.5 * f.inten) + ' 38%, ' +
      rgba(glow, 0) + ' 70%)';
    var sky = 'linear-gradient(180deg, ' + f.sky[0] + ' 0%, ' + f.sky[1] + ' 46%, ' + f.sky[2] + ' 100%)';
    return orb + ', ' + sky;
  }

  function nowHour() {
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  function isAuto() {
    try { return (State.get().theme || 'auto') === 'auto'; } catch (e) { return true; }
  }

  var forced = null;   // 렌더/미리보기용 강제 시각(시). null 이면 실제 시각.

  /** 지금(또는 강제된) 시각의 하늘을 그린다. 기본 테마일 때만. */
  function refresh() {
    if (!isAuto()) return;               // 다른 테마가 배경을 갖고 있으면 비켜준다
    var h = forced == null ? nowHour() : forced;
    document.documentElement.style.setProperty('--appbg', toBg(frame(h)));
  }

  /** 특정 시각을 강제로 물린다(연출 확인용). null 로 풀면 실제 시각. */
  function previewAt(h) { forced = h; refresh(); }

  var timer = null;
  function init() {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 30000);   // 30초마다 (분 단위로 충분히 부드럽다)
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();     // 앱으로 돌아오면 즉시 맞춘다
    });
  }

  return { init: init, refresh: refresh, previewAt: previewAt };
})();
