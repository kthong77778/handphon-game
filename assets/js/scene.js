/* 가게 앞 거리 — 손님들이 오가고, 조리하면 음식이 튀어나온다.
   순수하게 보여주기용이라 게임 수치에는 손대지 않는다. */
var Scene = (function () {

  var MAX_WALKERS = 8;
  var REDUCED = false;   // prefers-reduced-motion 이면 움직임을 줄인다

  // 어떤 손님이 오는지는 스킨과 초당 수익(등급)이 정한다 — Game.crowdTier()
  // 튀는 음식도 지금 조리하는 메뉴의 스킨을 따라간다.

  var SHOP_W = 146;     // 거리 왼쪽에 서 있는 가게 그림의 너비 (px)

  var street = null;    // 손님들이 걸어다니는 층
  var shopEl = null;    // 왼쪽 가게 그림
  var shopSign = '';    // 지금 간판에 걸린 글자
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

    var boosted = State.get().boostLeft > 0;
    // 손님 몰이 중엔 다들 뛰어온다
    var speed = rnd(boosted ? 90 : 34, boosted ? 150 : 62);   // px/s

    var node = document.createElement('div');
    node.className = 'walker' + (boosted ? ' hurry' : '');
    var face = document.createElement('i');
    var body = document.createElement('span');
    var tier = Game.crowdTier();
    var party = Game.partyActive && Game.partyActive();
    // 파티 중엔 셋 중 하나꼴로 파티 전용 손님이 온다 (이모지)
    var val, isParty = false;
    if (party && Math.random() < 0.35) { val = pick(Data.PARTY.guests); isParty = true; }
    else { val = pick(tier.cast); }
    // cast 가 이미지 경로('/' 포함)면 <img> 손님, 아니면 이모지 손님
    var isImg = typeof val === 'string' && val.indexOf('/') >= 0;
    var im = null;
    if (isImg) {
      im = document.createElement('img');
      im.src = 'assets/img/' + val; im.alt = '';
      im.className = 'cust-img';
      im.style.height = Math.round(rnd(40, 54)) + 'px';
      body.appendChild(im);
      node.classList.add('img-cust');
    } else {
      body.textContent = val;
    }
    node.classList.add('t' + (tier.index + 1));
    if (isParty) node.classList.add('party');

    // 등급이 오르면 값나가는 것을 들고 온다 (이미지 손님은 장신구 없음 — 이모지가 위에 뜨면 어색)
    if (!isImg && tier.acc && tier.acc.length) {
      var icon = pick(tier.acc);
      var acc = document.createElement('b');
      acc.className = 'acc' + (Data.HEADWEAR.indexOf(icon) >= 0 ? ' head' : '');
      acc.textContent = icon;
      // face 는 왼쪽으로 걸을 때 좌우 반전되므로, 소지품은 그 바깥에 붙인다
      node.appendChild(acc);
    }
    body.className = 'body';
    // 손님은 오른쪽에서 걸어와 왼쪽 가게로 향한다 — 얼굴도 왼쪽을 본다
    face.className = 'flip';
    face.appendChild(body);
    node.appendChild(face);
    if (isImg) {
      // 이미지 손님은 발이 바닥에 닿게 낮게 앉힌다 (전신 스프라이트)
      node.style.bottom = Math.round(rnd(2, 9)) + 'px';
    } else {
      // 이모지 글리프는 CSS 박스보다 아래로 삐져나오므로 바닥에서 충분히 띄운다
      node.style.bottom = Math.round(rnd(17, 25)) + 'px';
      node.style.fontSize = Math.round(rnd(21, 29)) + 'px';
    }
    node.style.opacity = String(rnd(0.75, 1));

    // 오른쪽에서 걸어와 가게 앞에 섰다가 왔던 길로 돌아간다.
    // 가게를 지나쳐 왼쪽으로 빼면 손님이 가게 그림 위를 덮어 가려 버린다.
    var start = w + 40;
    var turn = rnd(SHOP_W - 6, SHOP_W + 50);
    if (turn > w - 30) turn = Math.max(20, w * 0.55);
    // 이미 걸어온 것처럼 시작하면 거리에 자연스럽게 흩어진다
    var from = progress ? start + (turn - start) * progress : start;
    node.style.transform = 'translateX(' + from + 'px)';

    street.appendChild(node);
    var walker = { node: node, body: body, timer: 0 };
    walkers.push(walker);

    function glide(x, seconds, done) {
      // 시작 위치를 브라우저가 확정하도록 강제로 레이아웃을 읽는다.
      // 이 줄이 없으면 시작·도착 transform 이 같은 프레임에 합쳐져
      // 손님이 출발 지점에 붙박여 있게 된다.
      node.getBoundingClientRect();
      node.style.transition = 'transform ' + seconds.toFixed(2) + 's linear';
      node.style.transform = 'translateX(' + x + 'px)';
      walker.timer = setTimeout(done, seconds * 1000 + 60);
    }

    /** 돌아갈 때는 오른쪽을 보고 걷는다 */
    function goHome() {
      face.className = '';
      glide(start, Math.abs(start - turn) / speed, function () { removeWalker(walker); });
    }

    // 셋 중 하나는 가게 앞에서 주문하고 간다
    var orders = !REDUCED && Math.random() < 0.34;

    glide(turn, Math.abs(turn - from) / speed, function () {
      if (!node.parentNode) return;
      if (!orders) return goHome();
      node.classList.add('waiting');
      bubble(node, orderIcon());
      walker.timer = setTimeout(function () {
        if (!node.parentNode) return;
        node.classList.remove('waiting');
        goHome();
      }, 1100);
    });
  }

  /** 손님이 주문하는 메뉴 — 지금 스킨에서 파는 것 중 하나 */
  function orderIcon() {
    var t = Game.tapStep();
    var steps = Game.tapSkin().steps;
    // 지금 단계까지 나온 메뉴 중에서 (가장 최근 것이 자주 나오게)
    var top = Math.min(steps.length - 1, t.index);
    var i = Math.max(0, top - Math.floor(Math.random() * 3));
    return steps[i].icon;
  }

  function bubble(node, food) {
    var b = document.createElement('u');
    b.className = 'bubble';
    b.textContent = food;
    node.appendChild(b);
    setTimeout(function () { b.remove(); }, 1200);
  }

  /* ---------- 왼쪽 가게 ---------- */

  /** 스킨이 바뀌면 간판만 다시 그린다 (매 프레임 innerHTML 을 갈아끼우지 않는다) */
  function syncShop() {
    if (!shopEl) return;
    var sign = Game.tapSkin().sign || '분식';
    if (sign === shopSign) return;
    shopSign = sign;
    var s = shopEl.querySelector('.shop-sign');   // 그림 간판 위 글자만 갈아끼운다
    if (s) s.textContent = sign;
  }

  /* ---------- 조리할 때 튀는 음식 ---------- */

  function popFood() {
    if (!pops || REDUCED) return;
    var d = document.createElement('div');
    d.className = 'pop';
    // 파티 중엔 파티 음식이 함께 튄다
    if (Game.partyActive && Game.partyActive() && Math.random() < 0.4) {
      var pic = pick(Data.PARTY.foods).icon;
      // 파티 음식은 손그림 PNG — 경로면 <img>, 아니면 이모지
      if (typeof pic === 'string' && pic.indexOf('.png') >= 0) {
        d.innerHTML = '<img class="pop-img" src="assets/img/' + pic + '" alt="">';
      } else {
        d.textContent = pic;
      }
    } else {
      d.textContent = orderIcon();
    }
    // 좌우로 흩어지게
    d.style.setProperty('--dx', Math.round(rnd(-70, 70)) + 'px');
    d.style.setProperty('--rot', Math.round(rnd(-200, 200)) + 'deg');
    pops.appendChild(d);
    setTimeout(function () { d.remove(); }, 800);
  }

  /* ---------- 매 프레임 ---------- */

  var streetTier = -1;

  function tick(dt) {
    if (!street) return;

    // 손님 등급이 오르면 거리도 함께 격이 오른다 (5등급은 레드카펫)
    var ti = Game.crowdTier().index;
    if (ti !== streetTier) {
      street.className = 'street tier' + (ti + 1);
      streetTier = ti;
    }

    syncShop();

    spawnLeft -= dt;
    if (spawnLeft > 0) return;
    spawnLeft = rnd(0.5, 1.6);
    if (walkers.length < targetCrowd()) spawnWalker();
  }

  /** 환생이나 세이브 교체처럼 판을 새로 깔 때 */
  function clear() {
    walkers.slice().forEach(removeWalker);
    streetTier = -1;
  }

  function init(streetEl, popsEl) {
    street = streetEl;
    pops = popsEl;
    // 뒤편 골목 — 손님·가게보다 뒤(z:0). 하늘이 그 뒤로 비친다.
    // 손그림 PNG 배경(하늘 투명)을 CSS 로 깐다. 그림이 없으면 아무것도 안 그려진다.
    var backEl = document.createElement('div');
    backEl.className = 'street-back';
    street.appendChild(backEl);
    shopEl = document.createElement('div');
    shopEl.className = 'shopfront';
    shopEl.innerHTML = '<b class="shop-sign"></b>';   // 빈 간판에 얹는 스킨 글자
    street.appendChild(shopEl);
    syncShop();
    try {
      REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { REDUCED = false; }
    // 처음부터 한산하지 않도록 몇 명 미리, 거리 곳곳에 흩어서 깔아둔다
    for (var i = 0; i < 3; i++) spawnWalker(rnd(0.15, 0.8));
  }

  return { init: init, tick: tick, popFood: popFood, clear: clear };
})();
