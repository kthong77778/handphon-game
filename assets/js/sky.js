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
  // x/y=해 위치(%), r=반지름(px), i=해·달 세기(0~1), star=별 세기(0~1, 밤에만).
  // 국면을 뚜렷이 구분한다: 밤은 아주 어둡고 차가운 달+별, 아침은 밝고 상쾌한
  // 파랑+분홍금 해돋이, 노을은 깊고 따뜻한 앰버(I). 아침(시원)과 노을(따뜻)이
  // 서로 헷갈리지 않게 색온도를 반대로 뒀다.
  var STOPS = [
    { h: 0,    sky: ['#070a14', '#0b1020', '#121830'], orb: ['#dfe8fb', '#9fb0d6'], x: 64, y: 20, r: 76,  i: 0.6,  star: 1 },    // 깊은 밤
    { h: 4,    sky: ['#0a0f1f', '#12182f', '#1c2340'], orb: ['#dfe8fb', '#9fb0d6'], x: 40, y: 16, r: 76,  i: 0.5,  star: 0.85 },
    { h: 5.5,  sky: ['#152238', '#2b3a5a', '#5a4f66'], orb: ['#ffd7c0', '#e79a8a'], x: 22, y: 80, r: 120, i: 0.4,  star: 0.2 },  // 동틀녘 (지평선 살짝 분홍)
    { h: 7,    sky: ['#20406e', '#4a76a8', '#f0b48a'], orb: ['#fff0d0', '#ffc98a'], x: 31, y: 58, r: 132, i: 0.95, star: 0 },     // 아침 해돋이 — 시원한 파랑 + 분홍금
    { h: 9,    sky: ['#215089', '#3f79ad', '#8fb4cf'], orb: ['#fff4dc', '#ffdca0'], x: 40, y: 34, r: 112, i: 1,    star: 0 },     // 맑은 아침
    { h: 12.5, sky: ['#1f3f74', '#356fa6', '#77a6c8'], orb: ['#fff6e2', '#ffe0a8'], x: 52, y: 14, r: 100, i: 1,    star: 0 },     // 한낮 (제일 밝은 파랑)
    { h: 16,   sky: ['#2b2b5c', '#6a4470', '#c26a52'], orb: ['#ffcf7a', '#ff9a50'], x: 64, y: 46, r: 134, i: 1,    star: 0 },     // 오후, 물들기 시작
    { h: 18.5, sky: ['#2b2150', '#9c4f55', '#e0864f'], orb: ['#ffb45a', '#ff7e3a'], x: 74, y: 70, r: 154, i: 1,    star: 0 },     // ← 따뜻한 노을(I)
    { h: 20,   sky: ['#201a42', '#43284f', '#6e4658'], orb: ['#e07a44', '#b0502e'], x: 82, y: 88, r: 120, i: 0.4,  star: 0.15 },  // 땅거미
    { h: 21.5, sky: ['#0d1226', '#141a34', '#20263f'], orb: ['#dfe8fb', '#a7b6da'], x: 30, y: 27, r: 80,  i: 0.6,  star: 0.7 },   // 밤 시작, 달 뜸
    { h: 24,   sky: ['#070a14', '#0b1020', '#121830'], orb: ['#dfe8fb', '#9fb0d6'], x: 64, y: 20, r: 76,  i: 0.6,  star: 1 }
  ];

  // 밤하늘 별 — 상단 하늘에 고정 배치(작은 점). 낮엔 star=0 이라 사라진다.
  var STARS = [[10, 9], [22, 15], [35, 7], [48, 12], [63, 8], [77, 14], [88, 10],
               [16, 22], [42, 20], [70, 24], [30, 6], [55, 18]];

  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  // 두 hex 색을 t 비율로 섞어 [r,g,b] 숫자 배열로 돌려준다 (문자열로 두 번 변환하지 않는다)
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return [Math.round(x[0] + (y[0] - x[0]) * t),
            Math.round(x[1] + (y[1] - x[1]) * t),
            Math.round(x[2] + (y[2] - x[2]) * t)];
  }
  function rgb(v) { return 'rgb(' + v[0] + ',' + v[1] + ',' + v[2] + ')'; }
  function rgba(v, a) { return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 두 마디 사이를 시간 비율로 섞은 한 프레임을 만든다 (색은 [r,g,b] 배열로 보관)
  function frame(h) {
    var a = STOPS[0], b = STOPS[STOPS.length - 1];
    for (var i = 0; i < STOPS.length - 1; i++) {
      if (h >= STOPS[i].h && h <= STOPS[i + 1].h) { a = STOPS[i]; b = STOPS[i + 1]; break; }
    }
    var span = b.h - a.h;
    var t = span > 0 ? (h - a.h) / span : 0;
    return {
      sky: [mix(a.sky[0], b.sky[0], t), mix(a.sky[1], b.sky[1], t), mix(a.sky[2], b.sky[2], t)],
      core: mix(a.orb[0], b.orb[0], t), glow: mix(a.orb[1], b.orb[1], t),
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), r: lerp(a.r, b.r, t),
      inten: lerp(a.i, b.i, t), star: lerp(a.star, b.star, t)
    };
  }

  // 프레임을 --appbg 문자열로: [해/달 방사형] 위에 [하늘 세로 그라데이션]
  function toBg(f) {
    // 또렷한 원반(속) → 번짐 → 사라짐. 살짝 뚜렷한 해/달이 보이도록 속을 좁게 밝힌다.
    var orb = 'radial-gradient(' + Math.round(f.r) + 'px ' + Math.round(f.r) + 'px at ' +
      f.x.toFixed(1) + '% ' + f.y.toFixed(1) + '%, ' +
      rgba(f.core, 0.98 * f.inten) + ' 0%, ' +
      rgba(f.core, 0.9 * f.inten) + ' 13%, ' +
      rgba(f.glow, 0.5 * f.inten) + ' 38%, ' +
      rgba(f.glow, 0) + ' 70%)';
    var sky = 'linear-gradient(180deg, ' + rgb(f.sky[0]) + ' 0%, ' + rgb(f.sky[1]) + ' 46%, ' + rgb(f.sky[2]) + ' 100%)';
    // 별 — 밤에만(star>0.03). 작은 점을 여러 겹으로. 낮엔 통째로 빠져 문자열이 짧아진다.
    var stars = '';
    if (f.star > 0.03) {
      for (var i = 0; i < STARS.length; i++) {
        var a = (0.55 + (i % 3) * 0.15) * f.star;   // 밝기 조금씩 다르게
        stars += 'radial-gradient(1.5px 1.5px at ' + STARS[i][0] + '% ' + STARS[i][1] + '%, ' +
          'rgba(255,255,255,' + a.toFixed(2) + ') 0%, rgba(255,255,255,0) 100%), ';
      }
    }
    return stars + orb + ', ' + sky;
  }

  // 게임 안의 하루 — 현실 시각이 아니라 자체 시계로 돈다.
  // 하루 한 바퀴 = DAY_MIN 분. 플레이하는 동안 해가 실제로 움직여 노을·밤이 흐른다.
  // 벽시계(Date.now)를 그대로 접어 쓰므로 저장할 게 없다 — 껐다 켜도 계속 이어진다.
  var DAY_MIN = 12;                       // 하루 길이(분). 여기만 바꾸면 빨라지고 느려진다.
  var DAY_MS = DAY_MIN * 60000;
  function nowHour() {
    return ((Date.now() % DAY_MS) / DAY_MS) * 24;   // 0~24 (게임 시각)
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
    timer = setInterval(refresh, 2000);    // 2초마다 — 빨라진 하루라 해가 스르르 움직인다
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();     // 앱으로 돌아오면 즉시 맞춘다
    });
  }

  /** 절전 모드에서 하늘 갱신 인터벌을 멈추고/되살린다 */
  function pause(on) {
    if (on) {
      if (timer) { clearInterval(timer); timer = null; }
    } else if (!timer) {
      refresh();
      timer = setInterval(refresh, 2000);
    }
  }

  return { init: init, refresh: refresh, previewAt: previewAt, pause: pause };
})();
