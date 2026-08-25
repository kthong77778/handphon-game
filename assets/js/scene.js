/* 가게 앞 거리 — 손님들이 오가고, 조리하면 음식이 튀어나온다.
   순수하게 보여주기용이라 게임 수치에는 손대지 않는다. */
var Scene = (function () {

  var MAX_WALKERS = 8;
  var REDUCED = false;   // prefers-reduced-motion 이면 움직임을 줄인다

  // 상반신만 그려지는 이모지(🧑 등)는 머리만 떠다니는 것처럼 보인다.
  // 전신으로 그려지는 것들만 골라 쓴다.
  var CUSTOMERS = ['🚶', '🚶‍♀️', '🚶‍♂️', '🏃', '🏃‍♀️', '🏃‍♂️',
                   '🧍', '🧍‍♀️', '🧍‍♂️', '💃', '🕺', '🚴', '🐕', '🐈'];
  var FOODS = ['🍢', '🍜', '🥟', '🍤', '🍙', '🌭', '🥠', '🍡'];

  var street = null;    // 손님들이 걸어다니는 층
  var pops = null;      // 조리할 때 음식이 튀는 층
  var walkers = [];
  var spawnLeft = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- 손님 ---------- */

  /** 초당 수익이 오를수록 거리가 붐빈다 */
  function targetCrowd() {
    var ps = Game.perSec(true);
    var tier = ps <= 0 ? 0 : Math.min(6, Math.floor(Math.log(ps + 1) / Math.LN10));
    var n = 1 + tier;                                   // 1 ~ 7
    if (State.get().boostLeft > 0) n += 3;              // 손님 몰이 중엔 북적북적
    return Math.min(MAX_WALKERS, n);
  }

  function removeWalker(w) {
    var i = walkers.indexOf(w);
    if (i >= 0) walkers.splice(i, 1);
    if (w.node.parentNode) w.node.remove();
    clearTimeout(w.timer);
  }

  /**
   * 손님 한 명을 내보낸다.
   * @param {number} [progress] 0~1. 주면 이미 그만큼 걸어온 상태로 시작한다.
   *   (처음 화면을 채울 때 다들 가장자리에 뭉치지 않게 하려고 쓴다)
   */
  function spawnWalker(progress) {
    if (!street || walkers.length >= MAX_WALKERS) return;
    var w = street.clientWidth;
    if (w < 40) return;

    var rightward = Math.random() < 0.5;
    var boosted = State.get().boostLeft > 0;
    var span = w + 80;
    // 손님 몰이 중엔 다들 뛰어온다
    var speed = rnd(boosted ? 90 : 34, boosted ? 150 : 62);   // px/s
    var dur = span / speed;   // 끝에서 끝까지 걸리는 시간 (아래에서 남은 거리로 다시 잰다)

    var node = document.createElement('div');
    node.className = 'walker' + (boosted ? ' hurry' : '');
    var face = document.createElement('i');
    var body = document.createElement('span');
    body.textContent = pick(CUSTOMERS);
    body.className = 'body';
    if (!rightward) face.className = 'flip';
    face.appendChild(body);
    node.appendChild(face);
    // 이모지 글리프는 CSS 박스보다 아래로 삐져나오므로 바닥에서 충분히 띄운다
    node.style.bottom = Math.round(rnd(17, 25)) + 'px';
    node.style.fontSize = Math.round(rnd(21, 29)) + 'px';
    node.style.opacity = String(rnd(0.75, 1));

    var start = rightward ? -40 : w + 40;
    var to = rightward ? w + 40 : -40;
    // 이미 걸어온 것처럼 시작하면 거리에 자연스럽게 흩어진다
    var from = progress ? start + (to - start) * progress : start;
    node.style.transform = 'translateX(' + from + 'px)';

    street.appendChild(node);
    var walker = { node: node, body: body, timer: 0 };
    walkers.push(walker);

    // 셋 중 하나는 가게 앞에 멈춰서 주문하고 간다
    var orders = !REDUCED && Math.random() < 0.34;
    var stopX = rightward ? rnd(w * 0.3, w * 0.55) : rnd(w * 0.45, w * 0.7);

    function glide(x, seconds, done) {
      node.style.transition = 'transform ' + seconds.toFixed(2) + 's linear';
      // 브라우저가 시작 위치를 인식하도록 한 프레임 미룬다
      requestAnimationFrame(function () {
        node.style.transform = 'translateX(' + x + 'px)';
      });
      walker.timer = setTimeout(done, seconds * 1000 + 60);
    }

    // 이미 지나친 자리에서 주문하려 들면 안 된다
    if (orders && (rightward ? stopX <= from : stopX >= from)) orders = false;

    if (orders) {
      var legA = Math.abs(stopX - from) / speed;
      var legB = Math.abs(to - stopX) / speed;
      glide(stopX, legA, function () {
        if (!node.parentNode) return;
        node.classList.add('waiting');
        bubble(node, pick(FOODS));
        walker.timer = setTimeout(function () {
          if (!node.parentNode) return;
          node.classList.remove('waiting');
          glide(to, legB, function () { removeWalker(walker); });
        }, 1100);
      });
    } else {
      glide(to, Math.abs(to - from) / speed, function () { removeWalker(walker); });
    }
  }

  function bubble(node, food) {
    var b = document.createElement('u');
    b.className = 'bubble';
    b.textContent = food;
    node.appendChild(b);
    setTimeout(function () { b.remove(); }, 1200);
  }

  /* ---------- 조리할 때 튀는 음식 ---------- */

  function popFood() {
    if (!pops || REDUCED) return;
    var d = document.createElement('div');
    d.className = 'pop';
    d.textContent = pick(FOODS);
    // 좌우로 흩어지게
    d.style.setProperty('--dx', Math.round(rnd(-70, 70)) + 'px');
    d.style.setProperty('--rot', Math.round(rnd(-200, 200)) + 'deg');
    pops.appendChild(d);
    setTimeout(function () { d.remove(); }, 800);
  }

  /* ---------- 매 프레임 ---------- */

  function tick(dt) {
    if (!street) return;
    spawnLeft -= dt;
    if (spawnLeft > 0) return;
    spawnLeft = rnd(0.5, 1.6);
    if (walkers.length < targetCrowd()) spawnWalker();
  }

  /** 환생이나 세이브 교체처럼 판을 새로 깔 때 */
  function clear() {
    walkers.slice().forEach(removeWalker);
  }

  function init(streetEl, popsEl) {
    street = streetEl;
    pops = popsEl;
    try {
      REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { REDUCED = false; }
    // 처음부터 한산하지 않도록 몇 명 미리, 거리 곳곳에 흩어서 깔아둔다
    for (var i = 0; i < 3; i++) spawnWalker(rnd(0.15, 0.8));
  }

  return { init: init, tick: tick, popFood: popFood, clear: clear };
})();
