/* 게임 로직: 수익 계산 / 구매 / 환생 / 오프라인 보상 */
var Game = (function () {

  var GEN_BY_ID = {};
  Data.GENERATORS.forEach(function (g) { GEN_BY_ID[g.id] = g; });

  var UP_BY_ID = {};
  Data.UPGRADES.forEach(function (u) { UP_BY_ID[u.id] = u; });

  var FAME_BY_ID = {};
  Data.FAME_SHOP.forEach(function (f) { FAME_BY_ID[f.id] = f; });

  var MAIL_BY_ID = {};
  Data.MAIL.forEach(function (m) { MAIL_BY_ID[m.id] = m; });

  var SHOP_BY_ID = {};
  Data.SHOP.forEach(function (it) { SHOP_BY_ID[it.id] = it; });

  function S() { return State.get(); }

  // 자바스크립트 수는 1e308 을 넘으면 Infinity 가 되고, 그 뒤 Infinity - Infinity 는
  // NaN 이라 세이브가 통째로 망가진다. 더하기 전에 천장을 씌운다.
  var CAP = Number.MAX_VALUE;
  function cap(v) { return v > CAP ? CAP : (v >= 0 ? v : 0); }

  /** 번 돈을 안전하게 더한다 */
  function earn(s, amount) {
    if (!isFinite(amount) || amount <= 0) {
      if (amount === Infinity) amount = CAP;
      else return 0;
    }
    s.money = cap(s.money + amount);
    s.runEarned = cap(s.runEarned + amount);
    s.totalEarned = cap(s.totalEarned + amount);
    questBump('earn', amount);
    return amount;
  }

  /* ---------- 명성 상점 레벨 ---------- */
  function fameLv(id) { return S().fameLv[id] || 0; }

  function fameCost(id, lv) {
    var f = FAME_BY_ID[id];
    if (!f) return Infinity;
    if (lv === undefined) lv = fameLv(id);
    if (lv >= f.max) return Infinity;
    return Math.ceil(f.baseCost * Math.pow(f.costGrow, lv));
  }

  /* ---------- 배율 ---------- */
  // 배율 계산은 업그레이드 65종을 매번 훑어야 해서, 값이 바뀔 때만 다시 계산한다.
  // 세이브를 건드리는 곳은 반드시 bump() 를 불러 캐시를 무효화할 것.
  var cacheVer = 0;
  var cache = { ver: -1 };

  function bump() { cacheVer++; }

  function calc() {
    if (cache.ver === cacheVer) return cache;
    var s = S();

    // 버프를 뺀, 모든 수익에 곱해지는 고정 배율
    var stat = 1;
    stat *= 1 + 0.02 * s.fame;                    // 명성 1당 +2%
    stat *= 1 + 0.01 * achievementCount();        // 도전과제 1개당 +1%
    stat *= Math.pow(1.5, fameLv('f_mult'));      // 명성상점: 전설의 명성
    stat *= Math.pow(3, fameLv('f_legend'));      // 명성상점: 분식 왕조 (후반 소비처)
    stat *= Math.pow(1.05, fameLv('f_research'));  // 명성상점: 끝없는 연구 (상한 없는 소비처)
    stat *= 1 + Data.PARTY.dexBonus * (s.partyFoods ? s.partyFoods.length : 0);  // 파티 도감 1칸당 +1%
    stat *= 1 + foodBonus();                                 // 🍳 주방 음식 도감 (등급별 영구 배율)
    if (s.michelinGrand) stat *= Data.MICHELIN.grandMult;   // 스타 셰프 별 5개 영구 배율

    var genM = {};
    Data.GENERATORS.forEach(function (g) { genM[g.id] = 1; });

    var tapBase = 1;
    var tapPct = 0;

    Data.UPGRADES.forEach(function (u) {
      if (!s.upgrades[u.id]) return;
      if (u.kind === 'all') stat *= u.value;
      else if (u.kind === 'gen') { if (genM[u.target]) genM[u.target] *= u.value; }
      else if (u.kind === 'tap') tapBase *= u.value;
      else if (u.kind === 'tapPct') tapPct += u.value;
    });
    tapBase *= Math.pow(3, fameLv('f_tap'));
    stat = cap(stat);          // 오버플로우(Infinity) 방지 — 규칙 10

    // 버프를 뺀 초당 수익
    var base = 0;
    Data.GENERATORS.forEach(function (g) {
      base += g.rate * (s.gens[g.id] || 0) * genM[g.id];
    });
    base = cap(base * stat);   // Infinity 로 새면 수익이 ∞ 로 굳고 지분이 NaN% 가 된다

    cache.ver = cacheVer;
    cache.stat = stat;
    cache.genM = genM;
    cache.tapBase = cap(tapBase);
    cache.tapPct = tapPct;
    cache.base = base;
    return cache;
  }

  function achievementCount() {
    return Object.keys(S().achievements).length;
  }

  /* ---------- 버프 (황금 손님 / 손님 몰이) ---------- */

  /** 수익에 곱해지는 일시적 배율 */
  function buffMult() {
    var s = S();
    var m = 1;
    if (s.goldLeft > 0) m *= s.goldMult;
    if (s.boostLeft > 0) m *= Data.BOOST.mult;
    if (partyActive()) m *= Data.PARTY.mult;     // 주말 파티 ×3 (오프라인엔 안 붙는다)
    return m;
  }

  /** 지금 켜져 있는 버프 목록 (HUD 표시용) */
  function activeBuffs() {
    var s = S();
    var out = [];
    if (s.boostLeft > 0) out.push({ icon: '📣', label: '×' + Data.BOOST.mult, left: s.boostLeft });
    if (s.goldLeft > 0) out.push({ icon: '⚡', label: '×' + Fmt.num(s.goldMult), left: s.goldLeft });
    if (s.goldTapLeft > 0) out.push({ icon: '👐', label: '탭 ×' + Fmt.num(s.goldTapMult), left: s.goldTapLeft });
    return out;
  }

  /** 자리를 비운 동안에도 버프와 쿨다운은 흘러간다 (돈은 offlineReward 가 따로 계산) */
  function advanceTimers(sec) { tickBuffs(sec); }

  /** 남은 시간을 dt 만큼 흘려보낸다 */
  function tickBuffs(dt) {
    var s = S();
    if (s.boostLeft > 0) s.boostLeft = Math.max(0, s.boostLeft - dt);
    if (s.boostCd > 0) s.boostCd = Math.max(0, s.boostCd - dt);
    if (s.goldLeft > 0) s.goldLeft = Math.max(0, s.goldLeft - dt);
    if (s.goldTapLeft > 0) s.goldTapLeft = Math.max(0, s.goldTapLeft - dt);
    if (comboLeft > 0) {
      comboLeft = Math.max(0, comboLeft - dt);
      if (comboLeft === 0) combo = 0;
    }
    if (restLeft > 0) restLeft = Math.max(0, restLeft - dt);
  }

  /* ---------- 콤보 (빠르게 연타하면 붙는 배율) ---------- */
  var COMBO_WINDOW = 1.2;   // 이 시간 안에 다시 탭해야 콤보 유지 (초)
  var COMBO_MAX = 50;       // 여기까지만 오른다
  var COMBO_STEP = 0.04;    // 콤보 1당 +4%

  var combo = 0;
  var comboLeft = 0;

  function comboCount() { return combo; }
  function comboRatio() { return COMBO_WINDOW > 0 ? comboLeft / COMBO_WINDOW : 0; }
  function comboMult() { return 1 + Math.min(combo, COMBO_MAX) * COMBO_STEP; }

  function pushCombo() {
    combo = Math.min(combo + 1, COMBO_MAX);
    comboLeft = COMBO_WINDOW;
    var s = S();
    if (combo > s.bestCombo) s.bestCombo = combo;
    questBump('combo', combo);
  }

  function resetCombo() { combo = 0; comboLeft = 0; }

  /** 모든 수익에 곱해지는 최종 배율 (버프 포함) */
  function globalMult() {
    return calc().stat * buffMult();
  }

  /** 특정 설비에만 붙는 배율 */
  function genMult(id) {
    return calc().genM[id] || 1;
  }

  /* ---------- 설비 ---------- */
  function genCount(id) { return S().gens[id] || 0; }

  function costDiscount() {
    return Math.pow(0.97, fameLv('f_cheap'));
  }

  /* 🎟️ 할인 쿠폰 — '쓰기'를 켠 상태(couponArmed)에서 설비·업그레이드를 사면
     그 한 번만 discount 만큼 깎이고 쿠폰 1장이 소모된다. 무장 여부는 저장하지
     않는 일시 상태다. couponFactor 는 가격 계산 곳곳에 곱해져 미리보기도 맞춘다. */
  var couponArmed = false;
  /** 지금 쿠폰이 켜져 있고 쓸 수 있으면 할인 비율(0~1), 아니면 0 */
  function couponDisc() {
    var s = S();
    return (couponArmed && s.coupons > 0) ? Math.min(1, (s.couponPct || 0) / 100) : 0;
  }
  /** 업그레이드(단일 아이템)용 가격 배율. 설비는 '1개만' 이라 couponDisc 를 따로 쓴다. */
  function couponFactor() { return 1 - couponDisc(); }
  function setCouponArmed(v) { couponArmed = !!v && S().coupons > 0; return couponArmed; }
  function couponState() {
    var s = S();
    return { count: s.coupons, max: Data.COUPON.max,
             armed: couponArmed && s.coupons > 0, pct: s.couponPct || 0 };
  }
  // 구매가 실제로 성사됐을 때만 부른다: 쿠폰 1장 소모 + 무장 해제 + 할인율 성장.
  // 100% 를 쓰면 reset 로 떨어지고, 아니면 step 만큼 자라 100% 까지 오른다.
  function useCouponIfArmed() {
    var s = S();
    if (couponArmed && s.coupons > 0) {
      s.coupons -= 1;
      couponArmed = false;
      var c = Data.COUPON;
      if ((s.couponPct || 0) >= 100) s.couponPct = c.reset;
      else s.couponPct = Math.min(100, (s.couponPct || c.start) + c.step);
      return true;
    }
    couponArmed = false;
    return false;
  }

  /** n번째(0-indexed) 하나의 가격 (쿠폰 제외한 정가) */
  function genCostAt(id, index) {
    var g = GEN_BY_ID[id];
    return g.baseCost * Math.pow(Data.COST_GROWTH, index) * costDiscount();
  }

  /** 지금 amount개를 살 때 총 가격. 쿠폰 할인은 '다음 1개'에만 붙는다(대량 전체 아님). */
  function genCost(id, amount) {
    amount = amount || 1;
    var owned = genCount(id);
    var g = GEN_BY_ID[id];
    var r = Data.COST_GROWTH;
    var base = g.baseCost * Math.pow(r, owned) * costDiscount();   // 다음 1개 정가
    var full = base * (Math.pow(r, amount) - 1) / (r - 1);         // amount개 정가 합
    return full - couponDisc() * base;                            // 쿠폰은 다음 1개만 깎는다
  }

  /** 지금 돈으로 최대 몇 개 살 수 있나 */
  function maxAffordable(id) {
    var g = GEN_BY_ID[id];
    var r = Data.COST_GROWTH;
    var owned = genCount(id);
    var base = g.baseCost * Math.pow(r, owned) * costDiscount();   // 쿠폰 제외 정가
    // 쿠폰이 다음 1개를 깎아주니, 그만큼 돈이 더 있는 셈 치고 계산한다
    var money = S().money + couponDisc() * base;
    if (money < base) return 0;
    var n = Math.floor(Math.log(money * (r - 1) / base + 1) / Math.log(r));
    return Math.max(0, Math.min(n, 1000));
  }

  /** 설비 1종의 초당 수익 (noBuff 면 일시 버프를 뺀 값) */
  function genRate(id, noBuff) {
    var c = calc();
    var g = GEN_BY_ID[id];
    return cap(g.rate * genCount(id) * (c.genM[id] || 1) * c.stat * (noBuff ? 1 : buffMult()));
  }

  /** 전체 초당 수익 (noBuff 면 일시 버프를 뺀 값) */
  function perSec(noBuff) {
    return cap(calc().base * (noBuff ? 1 : buffMult()));
  }

  /** 수익이 수의 천장(CAP)에 닿아 더는 못 오르는 상태 — 설비를 더 사도 소용없다.
     이때 가게 구매 버튼을 활성으로 두면 헛돈만 쓰게 되므로 UI 가 이걸 본다. */
  function atIncomeCap() { return perSec(true) >= CAP; }

  /** 이 설비를 1개 더 살 때 오르는 초당 수익(버프 제외). 개수와 무관 — rate 는 선형이다. */
  function genUnitGain(id) {
    var c = calc();
    var g = GEN_BY_ID[id];
    return cap(g.rate * (c.genM[id] || 1) * c.stat);
  }

  /** amt 개를 더 살 때 오르는 초당 수익이 지금 수익에서 차지하는 비율.
     수익이 0 이면(초기) 1 로 본다. */
  function genGainShare(id, amt) {
    var ps = perSec(true);
    if (!(ps > 0)) return 1;
    return cap(genUnitGain(id) * (amt || 1)) / ps;
  }

  /** 지금 열린 설비 중 개당 수익이 가장 큰 값(최강 설비의 한 개 값) */
  function bestUnitGain() {
    var best = 0;
    Data.GENERATORS.forEach(function (g) {
      if (!genUnlocked(g.id)) return;
      var u = genUnitGain(g.id);
      if (u > best) best = u;
    });
    return best;
  }

  /** amt 개를 사도 초당 수익을 눈에 띄게(0.1% 이상) 못 올리고, 최강 설비도 아닌가.
     부자일 때 싼/낮은 단계 설비가 여기 해당한다 — 화면 숫자가 안 움직여 '안 오른다'처럼
     보인다. 주력·다음 단계(개당 값이 가장 큰) 설비는 개수가 많아도 여기 걸리지 않는다. */
  function genBarelyHelps(id, amt) {
    var ps = perSec(true);
    if (!(ps > 0)) return false;                 // 초반(수익 0)엔 뭐든 의미 있다
    if (genGainShare(id, amt) >= 0.001) return false;  // amt 사면 티가 난다
    return genUnitGain(id) < bestUnitGain();      // 최강 설비면 힌트를 띄우지 않는다
  }

  /* ---------- 매크로(오토클릭) 방지 ---------- */
  // 사람을 잘못 막는 쪽이 봇을 놓치는 쪽보다 훨씬 나쁘다.
  // 그래서 서로 독립적인 신호가 "동시에" 맞을 때만 막고, 벌은 몇 초 쉬는 것으로 끝낸다.
  //
  //  1) isTrusted  — 스크립트가 만든 가짜 클릭. 여기서 대부분 걸러진다.
  //  2) 초당 상한  — 하드웨어 오토클릭이라도 이득을 못 보게 한다.
  //  3) 간격 + 좌표 — 간격이 기계처럼 고르고 '동시에' 좌표가 픽셀 단위로 붙박이일 때.
  //     간격만 보면 리듬 타듯 치는 사람이 걸린다. 좌표만 보면 마우스를 안 움직이는
  //     사람이 걸린다. 둘 다여야 봇이다.
  var MACRO = {
    maxPerSec: 14,     // 사람이 낼 수 있는 현실적인 연타 상한
    sample: 32,        // 판단에 쓸 표본 수
    maxCv: 0.09,       // 간격의 변동계수(표준편차/평균)가 이보다 작으면 기계적
    maxSpread: 2,      // 탭 좌표가 이 픽셀 안에서만 움직이면 붙박이
    rest: 5            // 걸렸을 때 조리가 멈추는 시간 (초)
  };

  var taps = [];       // 최근 탭 {t, x, y}
  var restLeft = 0;

  function meanOf(a) {
    var m = 0;
    for (var i = 0; i < a.length; i++) m += a[i];
    return m / a.length;
  }

  function stdev(a, m) {
    var v = 0;
    for (var i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m);
    return Math.sqrt(v / a.length);
  }

  function spread(a) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < a.length; i++) {
      if (a[i] < lo) lo = a[i];
      if (a[i] > hi) hi = a[i];
    }
    return hi - lo;
  }

  /** 표본이 기계처럼 보이는가 */
  function looksAutomated() {
    if (taps.length < MACRO.sample) return false;

    var gaps = [], xs = [], ys = [], i;
    for (i = 1; i < taps.length; i++) gaps.push(taps[i].t - taps[i - 1].t);
    for (i = 0; i < taps.length; i++) { xs.push(taps[i].x); ys.push(taps[i].y); }

    var m = meanOf(gaps);
    if (m <= 0) return false;
    if (stdev(gaps, m) / m >= MACRO.maxCv) return false;   // 간격이 사람만큼 흔들린다

    // 좌표를 모르면(합성/키보드 등) 간격만으로는 단정하지 않는다
    if (!isFinite(xs[0])) return false;
    return spread(xs) <= MACRO.maxSpread && spread(ys) <= MACRO.maxSpread;
  }

  /**
   * 이번 탭을 인정할지 판단한다.
   * @returns {string} 빈 문자열이면 정상, 아니면 막은 이유
   *   'auto'  스크립트가 만든 가짜 이벤트
   *   'fast'  초당 상한 초과
   *   'macro' 간격과 좌표가 둘 다 기계적
   *   'rest'  macro 로 걸려서 쉬는 중
   */
  function judgeTap(trusted, t, x, y) {
    if (trusted === false) return 'auto';
    if (restLeft > 0) return 'rest';

    taps.push({ t: t, x: x, y: y });
    if (taps.length > MACRO.sample) taps.shift();

    // 최근 1초 안에 몇 번이나 눌렸나
    var n = 0;
    for (var i = taps.length - 1; i >= 0 && t - taps[i].t < 1000; i--) n++;
    if (n > MACRO.maxPerSec) return 'fast';

    if (looksAutomated()) {
      restLeft = MACRO.rest;
      taps.length = 0;
      S().macroBlocks++;
      resetCombo();
      return 'macro';
    }
    return '';
  }

  function macroRestLeft() { return restLeft; }

  function resetGuard() { taps.length = 0; restLeft = 0; }

  /* ---------- 탭 ---------- */
  /** 한 번 탭할 때 버는 돈 (콤보 · 황금 손님 탭 버프 포함) */
  function tapValue() {
    var s = S();
    var c = calc();
    var tapM = (s.goldTapLeft > 0 ? s.goldTapMult : 1) * comboMult();
    return (c.tapBase * tapM * c.stat * buffMult()) + (perSec() * c.tapPct);
  }

  /**
   * 조리 1회.
   * @param {boolean} trusted 실제 사용자 입력이면 true (합성 이벤트는 false)
   * @param {number} at 탭 시각(ms). 테스트에서 주입할 수 있게 열어둔다.
   * @param {number} x 탭 좌표. 모르면 생략 — 그땐 좌표 신호를 쓰지 않는다.
   * @param {number} y
   * @returns {{value:number, blocked:string}}
   */
  function tap(trusted, at, x, y) {
    var blocked = judgeTap(trusted !== false,
                           at === undefined ? State.now() : at,
                           x === undefined ? NaN : x,
                           y === undefined ? NaN : y);
    if (blocked) return { value: 0, blocked: blocked };

    pushCombo();
    var v = tapValue();
    var s = S();
    earn(s, v);
    s.taps++;
    questBump('tap', 1);
    if (v > s.bestTap) s.bestTap = v;
    return { value: v, blocked: '' };
  }

  /* ---------- 스킨 & 등급 ---------- */

  var TAP_SKIN_BY_ID = {};
  Data.TAP_SKINS.forEach(function (k) { TAP_SKIN_BY_ID[k.id] = k; });

  var CROWD_SKIN_BY_ID = {};
  Data.CROWD_SKINS.forEach(function (k) { CROWD_SKIN_BY_ID[k.id] = k; });

  /** 버프·콤보를 뺀 순수 탭 수익. 등급이 버프 때문에 오르내리면 안 된다. */
  function tapBaseValue() {
    var c = calc();
    return c.tapBase * c.stat + perSec(true) * c.tapPct;
  }

  function tapSkin() {
    return TAP_SKIN_BY_ID[S().tapSkin] || Data.TAP_SKINS[0];
  }

  function crowdSkin() {
    return CROWD_SKIN_BY_ID[S().crowdSkin] || Data.CROWD_SKINS[0];
  }

  /** 지금 조리하는 메뉴 (0부터 시작하는 단계 번호 포함) */
  function tapStep() {
    var steps = tapSkin().steps;
    var v = tapBaseValue();
    var i = 0;
    for (var k = 0; k < steps.length; k++) {
      if (v >= steps[k].at) i = k;
    }
    return { index: i, total: steps.length, step: steps[i] };
  }

  /** 다음 메뉴까지 얼마가 더 필요한가 (마지막 단계면 null) */
  function nextTapStep() {
    var t = tapStep();
    var steps = tapSkin().steps;
    if (t.index >= steps.length - 1) return null;
    var nx = steps[t.index + 1];
    return { step: nx, need: Math.max(0, nx.at - tapBaseValue()) };
  }

  /** 지금 거리에 나올 손님 후보들 */
  function crowdTier() {
    var tiers = crowdSkin().tiers;
    var ps = perSec(true);
    var i = 0;
    for (var k = 0; k < tiers.length; k++) {
      if (ps >= tiers[k].at) i = k;
    }
    return {
      index: i, total: tiers.length,
      name: tiers[i].name,
      cast: tiers[i].cast,
      acc: tiers[i].acc || [],
      story: tiers[i].story || ''
    };
  }

  function setSkin(kind, id) {
    var list = kind === 'tap' ? Data.TAP_SKINS : Data.CROWD_SKINS;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      S()[kind === 'tap' ? 'tapSkin' : 'crowdSkin'] = id;
      return true;
    }
    return false;
  }

  /* ---------- 해금 조건 ---------- */
  function genUnlocked(id) {
    var idx = Data.GENERATORS.findIndex(function (g) { return g.id === id; });
    if (idx <= 0) return true;
    // 이전 설비를 1개 이상 가지고 있으면 해금
    var prev = Data.GENERATORS[idx - 1];
    return genCount(prev.id) >= 1 || genCount(id) >= 1;
  }

  function upgradeUnlocked(u) {
    var s = S();
    if (s.upgrades[u.id]) return false; // 이미 구매
    if (u.needGen && genCount(u.needGen.id) < u.needGen.count) return false;
    if (u.needTaps && s.taps < u.needTaps) return false;
    if (u.needEarned && s.runEarned < u.needEarned) return false;
    return true;
  }

  /** 지금 바로 살 수 있는(해금된) 업그레이드만 — 추천/알림 판정에 쓴다 */
  function availableUpgrades() {
    return Data.UPGRADES
      .filter(upgradeUnlocked)
      .sort(function (a, b) {
        if (a.cost !== b.cost) return a.cost - b.cost;
        return (a.order || 0) - (b.order || 0);
      });
  }

  /** 목록에 보여줄 전체 업그레이드 — 이미 산 것만 빼고, 잠긴 것도 포함한다.
      해금된 것을 위로, 그다음 가격순. (탭 목록에서 잠긴 것도 조건과 함께 보여준다) */
  function allUpgrades() {
    return Data.UPGRADES
      .filter(function (u) { return !S().upgrades[u.id]; })
      .sort(function (a, b) {
        var ua = upgradeUnlocked(a), ub = upgradeUnlocked(b);
        if (ua !== ub) return ua ? -1 : 1;
        if (a.cost !== b.cost) return a.cost - b.cost;
        return (a.order || 0) - (b.order || 0);
      });
  }

  /* ---------- 구매 ---------- */
  function buyGen(id, amount) {
    amount = amount || 1;
    var cost = genCost(id, amount);
    var s = S();
    // `>=` 로 검사한다: `money < cost` 는 money 가 NaN 이면 false 라 검사를 통과해
    // 무료로 사지고, money 는 NaN 인 채(화면엔 0원) 남는다. `!(money >= cost)` 는 NaN 을 막는다.
    if (!(s.money >= cost) || amount <= 0) return false;
    s.money -= cost;
    s.gens[id] = genCount(id) + amount;
    useCouponIfArmed();               // 성사됐으니 쿠폰(있으면) 1장 소모
    questBump('gen', amount);
    bump();
    return true;
  }

  function upgradeCost(id) {
    var u = UP_BY_ID[id];
    return u ? u.cost * couponFactor() : 0;   // 쿠폰 무장 시 할인가
  }

  function buyUpgrade(id) {
    var u = UP_BY_ID[id];
    var s = S();
    if (!u || s.upgrades[id]) return false;
    var cost = u.cost * couponFactor();
    if (!(s.money >= cost)) return false;      // NaN fail-closed (무료 구매 방지)
    s.money -= cost;
    s.upgrades[id] = true;
    useCouponIfArmed();                        // 성사됐으니 쿠폰(있으면) 1장 소모
    questBump('up', 1);
    bump();
    return true;
  }

  function buyFame(id) {
    var s = S();
    var lv = fameLv(id);
    var f = FAME_BY_ID[id];
    if (!f || lv >= f.max) return false;
    var cost = fameCost(id, lv);
    if (!(s.fame >= cost)) return false;   // NaN fail-closed (무료 강화 방지)
    s.fame -= cost;
    s.fameLv[id] = lv + 1;
    bump();
    return true;
  }

  /* ---------- 환생 ---------- */
  // 이번 회차 매출이 이 값을 넘으면 환생 가능.
  // 명성 = (매출 / BASE) ^ FAME_EXP  -> 2~3시간에 첫 환생, 하루 방치면 수십 단위
  var PRESTIGE_BASE = 1e6;
  // 지수를 낮출수록 '큰 회차'의 명성이 줄어 환생 스노우볼이 완만해진다(문턱값의 첫 환생은 그대로).
  // 0.4 → 0.37: 큰 매출일수록 명성을 덜 줘 후반 폭주를 늦춘다(명성 소비처 수명↑).
  var FAME_EXP = 0.37;

  /** 지금 환생하면 받을 명성 */
  function fameGain() {
    var s = S();
    if (s.runEarned < PRESTIGE_BASE) return 0;
    return Math.floor(Math.pow(s.runEarned / PRESTIGE_BASE, FAME_EXP));
  }

  /** 다음 명성 1을 더 받으려면 얼마가 더 필요한가 */
  function nextFameAt() {
    var need = Math.pow(fameGain() + 1, 1 / FAME_EXP) * PRESTIGE_BASE;
    return need;
  }

  function startMoney() {
    var lv = fameLv('f_start');
    return lv > 0 ? 10 * Math.pow(100, lv) : 0;
  }

  function doPrestige() {
    var gain = fameGain();
    if (gain <= 0) return 0;
    var s = S();
    var firstEver = (s.prestiges === 0);   // 첫 환생인가 (보상은 딱 한 번)

    // 명예의 전당에 이번 회차를 남긴다
    s.runs.push({
      n: s.prestiges + 1,
      earned: s.runEarned,
      fame: gain,
      seconds: s.runTime
    });
    if (s.runs.length > State.MAX_RUNS) s.runs = s.runs.slice(-State.MAX_RUNS);
    if (gain > s.bestFameGain) s.bestFameGain = gain;
    if (!s.fastestPrestige || s.runTime < s.fastestPrestige) s.fastestPrestige = s.runTime;

    s.fame += gain;
    s.prestiges++;
    addCandy(Data.CANDY.perPrestige || 0);   // 환생 이정표마다 별사탕 (환생해도 유지)
    s.runTime = 0;
    s.money = startMoney();
    s.runEarned = 0;
    s.gens = {};
    // 일반 업그레이드만 초기화 (명성상점/도전과제는 영구)
    s.upgrades = {};

    // 회차가 끝나면 일시 버프도 함께 정리
    s.goldLeft = 0;
    s.goldTapLeft = 0;
    s.boostLeft = 0;
    resetCombo();

    // 첫 환생 축하 보상 — 리셋을 '이벤트'로. 딱 한 번.
    if (firstEver) {
      s.money += Data.FIRST_PRESTIGE.gold;                 // 축하 골드로 빠른 재시작
      // 쿠폰: 최대치(3)로 채우되, 이미 꽉 차 있으면 예외로 1장 더(4)
      s.coupons = (s.coupons >= Data.COUPON.max)
        ? Data.COUPON.max + 1
        : Data.COUPON.max;
    }

    bump();
    return gain;
  }

  /* ---------- 점장 (오프라인 자동 구매) ---------- */

  function managerBuys() {
    return Data.MANAGER.buysPerLv * fameLv('f_manager');
  }

  /**
   * 자리를 비운 동안 점장이 설비를 대신 산다.
   * 보유 금액의 일부는 남겨둔다 — 돌아와서 쓸 돈이 하나도 없으면 그것도 답답하다.
   * @returns {{count:number, spent:number, items:Object}}
   */
  function runManager(elapsedSec) {
    var s = S();
    var budgetLeft = managerBuys();
    var result = { count: 0, spent: 0, items: {} };
    if (budgetLeft <= 0 || elapsedSec < Data.MANAGER.minOfflineSec) return result;

    var floor = s.money * Data.MANAGER.keepRatio;

    for (var i = 0; i < budgetLeft; i++) {
      // 살 수 있는 것 중 초당 수익이 가장 많이 오르는 것 하나.
      // 가성비(가격÷수익)로 고르면 언제나 제일 싼 알바생만 사서, 큰돈을 쥐고
      // 돌아왔는데도 수익이 그대로다.
      var best = null, bestGain = 0;
      for (var k = 0; k < Data.GENERATORS.length; k++) {
        var g = Data.GENERATORS[k];
        if (!genUnlocked(g.id)) continue;
        if (genCost(g.id, 1) > s.money - floor) continue;
        var gain = g.rate * (calc().genM[g.id] || 1);
        if (gain > bestGain) { bestGain = gain; best = g; }
      }
      if (!best) break;
      var paid = genCost(best.id, 1);
      if (!buyGen(best.id, 1)) break;
      result.count++;
      result.spent += paid;
      result.items[best.id] = (result.items[best.id] || 0) + 1;
    }
    s.autoBought += result.count;
    return result;
  }

  /* ---------- 추천 설비 ----------
     "지금 사면 초당 수익이 가장 많이 오르는 것" 하나를 고른다.
     가성비(가격÷수익)로 고르면 늘 제일 싼 알바생만 나와서 큰돈을 쥐고도
     추천이 시시해진다 — 자동구매(runManager)와 같은 '절대 수익 증가' 기준을 쓴다.
     살 수 있는 게 하나도 없으면, 다음으로 모을 목표(제일 싼 설비)를 알려준다. */
  function bestGen() {
    if (atIncomeCap()) return null;   // 수익이 한계면 추천할 게 없다 ('초당 +∞' 방지)
    var s = S(), c = calc(), money = s.money;
    var best = null, bestGain = 0, target = null, targetCost = Infinity;
    for (var k = 0; k < Data.GENERATORS.length; k++) {
      var g = Data.GENERATORS[k];
      if (!genUnlocked(g.id)) continue;
      var cost = genCost(g.id, 1);
      var gain = g.rate * (c.genM[g.id] || 1) * c.stat;   // 1개 살 때 오르는 초당 수익
      if (cost < targetCost) { targetCost = cost; target = g; }
      if (money >= cost && gain > bestGain) { bestGain = gain; best = g; }
    }
    if (best) {
      return { id: best.id, icon: best.icon, name: best.name,
               cost: genCost(best.id, 1), gain: bestGain, affordable: true };
    }
    if (target) {
      return { id: target.id, icon: target.icon, name: target.name, cost: targetCost,
               gain: target.rate * (c.genM[target.id] || 1) * c.stat, affordable: false };
    }
    return null;   // 열린 설비가 하나도 없다 (이론상 없음)
  }

  /** 추천 설비를 1개 산다. 살 수 없으면 false. */
  function buyBest() {
    var b = bestGen();
    if (!b || !b.affordable) return false;
    return buyGen(b.id, 1);
  }

  /* ---------- 사장 레벨 ----------
     누적 매출(totalEarned)로 오르는 '사장 레벨'. 수익 배율에는 영향을 주지 않는다 —
     성장감을 보여주는 표시용이라 밸런스·세이브를 건드리지 않는다.
     레벨당 약 3.16배(10^0.5)씩 누적 매출이 필요하다. */
  var BOSS_BASE = 1000;   // Lv.1 시작선(누적 매출)
  var BOSS_STEP = 0.5;    // 레벨 간격(로그10)

  function bossProgress() {
    var t = S().totalEarned;
    if (!(t > 0)) return { level: 0, ratio: 0 };
    if (!isFinite(t)) return { level: 99, ratio: 1 };   // 천장(Infinity)에서 무한 레벨 방지
    if (t < BOSS_BASE) return { level: 0, ratio: t / BOSS_BASE };
    var x = Math.log(t / BOSS_BASE) / Math.LN10 / BOSS_STEP;
    return { level: Math.floor(x) + 1, ratio: x - Math.floor(x) };
  }
  function bossLevel() { return bossProgress().level; }
  function bossXpRatio() { var r = bossProgress().ratio; return r < 0 ? 0 : (r > 1 ? 1 : r); }
  function bossTitle() {
    var L = bossLevel();
    if (L >= 20) return '분식 대부';
    if (L >= 15) return '전국구 사장';
    if (L >= 10) return '지역 명장';
    if (L >= 5)  return '소문난 사장';
    return '동네 사장';
  }

  /* ---------- 사장님 (성장형 · 남/여) ----------
     사장 레벨이 오르면 모습이 바뀐다. 성별은 세이브(ownerSex)에서. */
  function ownerSex() { return S().ownerSex === 'male' ? 'male' : 'female'; }
  function setOwnerSex(id) {
    if (id !== 'male' && id !== 'female') return false;
    S().ownerSex = id; return true;
  }
  /** 지금 사장 레벨에 맞는 성장 단계 */
  function ownerStage() {
    var lv = bossLevel(), st = Data.OWNER.stages, cur = st[0];
    for (var i = 0; i < st.length; i++) if (lv >= st[i].at) cur = st[i];
    return cur;
  }
  /** 지금 보여줄 사장 이미지 경로 (assets/img/ 기준) */
  function ownerImg() { return 'owner/owner_' + ownerSex() + '_' + ownerStage().key + '.png'; }

  /* ---------- 🍳 주방 (재료 트럭 · 합성 · 레시피 · 음식 도감) ---------- */
  var FOOD_BY_ID = {};
  Data.KITCHEN.foods.forEach(function (f) { FOOD_BY_ID[f.id] = f; });

  /* 음식 숙련도 — 같은 음식을 누적으로 만들수록 그 음식의 도감 배율이 커진다.
     steps 문턱을 넘을 때마다 별(★)이 하나씩 오르고, mult 로 배율을 교체한다(합이 아니라). */
  function masteryTier(count) {
    var st = Data.KITCHEN.mastery.steps, t = 0;
    for (var i = 0; i < st.length; i++) if (count >= st[i]) t = i + 1;
    return t;   // 0 = 아직 없음, 1~3 = ★~★★★
  }
  function masteryMult(count) {
    var t = masteryTier(count);
    return t === 0 ? 1 : Data.KITCHEN.mastery.mult[t - 1];
  }
  /** 그 음식의 지금 도감 배율 (기본 bonus × 숙련 배율). 1개 이상 만들었을 때만 유효 */
  function foodEffBonus(f) {
    if (typeof f === 'string') f = FOOD_BY_ID[f];
    if (!f) return 0;
    var c = S().kfoods[f.id] || 0;
    return c >= 1 ? f.bonus * masteryMult(c) : 0;
  }

  /** 만든 음식(도감) 영구 배율의 합 (calc 에 곱해진다) — 숙련도까지 반영한다 */
  function foodBonus() {
    var sum = 0;
    Data.KITCHEN.foods.forEach(function (f) { sum += foodEffBonus(f); });
    return sum;
  }

  function ingCount(id) { return S().ings[id] || 0; }
  function foodMade(id) { return S().kfoods[id] || 0; }

  /** 레시피 해금: 사장 레벨이 음식의 at 이상이면 조합이 보인다 (몰라도 재료는 쌓인다) */
  function recipeUnlocked(f) {
    if (typeof f === 'string') f = FOOD_BY_ID[f];
    return !!f && bossLevel() >= f.at;
  }

  /** 지금 창고 재료로 이 음식을 만들 수 있나 */
  function canCraft(id) {
    var f = FOOD_BY_ID[id];
    if (!f || !recipeUnlocked(f)) return false;
    var s = S();
    for (var k in f.need) { if ((s.ings[k] || 0) < f.need[k]) return false; }
    return true;
  }

  /**
   * 합성: 레시피대로 재료를 소모해 음식을 만든다.
   * 처음 만들면 도감에 등록되며 영구 배율이 붙고, 누적 제작이 숙련 문턱을 넘으면 배율이 더 커진다(둘 다 캐시 무효화).
   * 오늘의 특선 음식이면 목돈이 ×특선배율이고 단골 주문 진행도가 오른다.
   * @returns {{food:Object, first:boolean, gain:number, special:boolean, tier:number, tierUp:boolean}|null}
   */
  function craftFood(id) {
    var f = FOOD_BY_ID[id];
    if (!canCraft(id)) return null;
    var s = S();
    for (var k in f.need) { s.ings[k] -= f.need[k]; }
    var before = foodMade(id);
    var first = !(before >= 1);
    s.kfoods[id] = before + 1;
    var tierUp = masteryTier(before + 1) > masteryTier(before);
    if (first || tierUp) bump();   // 도감 등록·숙련 상승으로 배율이 바뀌면 캐시 무효화

    // 오늘의 특선이면 목돈 ×배율 + 단골 주문 진행
    var sp = specialToday();
    var special = !!(sp && sp.food.id === id);
    var mult = special ? Data.KITCHEN.special.mult : 1;
    var gain = earn(s, Math.max(f.sec * perSec(true), Data.MICHELIN.minReward * f.grade) * mult);
    if (special) s.specialProg = (s.specialProg || 0) + 1;

    return { food: f, first: first, gain: gain, special: special,
             tier: masteryTier(before + 1), tierUp: tierUp };
  }

  /* ---- ⭐ 오늘의 특선 / 단골 주문 ----
     매일 '해금된 레시피 중 하나'가 특선이 된다. 무엇인지는 날짜가 정하므로 새로고침으로 바꿀 수 없다.
     특선을 만들면 목돈이 ×배율이고, 하루 orderGoal 번 만들면 단골 주문 보상을 받는다. */
  function specialRoll() {
    var s = S(), t = today();
    if (s.specialDate === t && s.specialFood && FOOD_BY_ID[s.specialFood]) return false;
    // 해금된 레시피 중에서 날짜 시드로 하나 고른다 (없으면 오늘은 특선 없음)
    var pool = Data.KITCHEN.foods.filter(recipeUnlocked);
    var pick = pool.length ? pool[daySeed(t + '#special') % pool.length].id : '';
    s.specialDate = t;
    s.specialFood = pick;
    s.specialProg = 0;
    s.specialTaken = 0;
    return true;
  }

  /** 화면에 뿌릴 오늘의 특선 (해금된 레시피가 없으면 null) */
  function specialToday() {
    specialRoll();
    var s = S();
    var f = s.specialFood && FOOD_BY_ID[s.specialFood];
    if (!f) return null;
    var goal = Data.KITCHEN.special.orderGoal;
    var prog = Math.min(s.specialProg || 0, goal);
    return { food: f, mult: Data.KITCHEN.special.mult, goal: goal, prog: prog,
             done: prog >= goal, taken: !!s.specialTaken };
  }

  /** 단골 주문 보상 수령 (완료했고 아직 안 받았을 때만) */
  function claimSpecialOrder() {
    var sp = specialToday();
    if (!sp || !sp.done || sp.taken) return null;
    var s = S();
    var gain = earn(s, Math.max(perSec(true) * Data.KITCHEN.special.orderSec, Data.KITCHEN.special.minOrder));
    s.specialTaken = 1;
    return { food: sp.food, gain: gain };
  }

  /* ---------- 🎁 무료 보상 (광고) ----------
     아이콘 4개, 하나당 하루 perDay 번(자정 리셋). claimAd() 가 실제 보상을 준다.
     '30초 시청' 자체는 ui.js 가 카운트다운으로 흉내내고, 다 보면 claimAd 를 부른다. */
  var AD_BY_ID = {};
  Data.ADS.slots.forEach(function (a) { AD_BY_ID[a.id] = a; });

  /** 날짜가 바뀌었으면 오늘치 광고 시청 횟수를 리셋한다 */
  function adRoll() {
    var s = S(), t = today();
    if (s.adDate !== t) { s.adDate = t; s.adUsed = {}; }
  }
  /** 이 슬롯을 오늘 몇 번 더 볼 수 있나 */
  function adLeft(id) { adRoll(); return Math.max(0, Data.ADS.perDay - (S().adUsed[id] || 0)); }
  /** 화면에 뿌릴 광고 슬롯 목록 */
  function adSlots() {
    adRoll();
    return Data.ADS.slots.map(function (a) {
      return { def: a, left: adLeft(a.id), max: Data.ADS.perDay };
    });
  }
  /** '수익 배율' 버프를 건다 — 황금 손님(손님 폭주)과 광고(수익 2배)가 같은
     자리(⚡)를 쓴다(세이브 필드 추가 없음). 둘의 세기·지속이 크게 달라서
     (광고 ×2·1800초 vs 황금 ×7·30초) 배율도 시간도 각각 max 로 합치면
     "센 배율 + 긴 시간"(×7 이 30분)이 새어나갔다. 그래서:
       - 걸린 게 없으면 그대로 건다
       - 더 센 배율이 오면 그 배율 + '그 자신의' 지속으로 교체
         (약한 버프의 긴 꼬리를 센 배율에 물려주지 않는다)
       - 같은 세기면 시간만 새로/길게
       - 더 약하면 무시 (약한 버프로 센 버프의 시간을 늘리지 않는다)
     대가로, 센 버프가 오면 약한 버프의 남은 시간은 희생된다(반대로 약한
     버프는 센 버프 중엔 허탕). 인플레이션(과지급)을 막는 쪽을 택했다. */
  function applyIncomeBuff(mult, dur) {
    var s = S();
    if (s.goldLeft <= 0 || mult > s.goldMult) {
      s.goldMult = mult; s.goldLeft = dur;
    } else if (mult === s.goldMult) {
      s.goldLeft = Math.max(s.goldLeft, dur);
    }
  }

  /**
   * 광고를 끝까지 본 뒤 보상을 지급한다. 오늘 남은 횟수가 없으면 null.
   * 쿠폰이 이미 꽉 찼으면 시청을 소모하지 않고 { full:true } 를 돌려준다(허탕 방지).
   * @returns {{slot:Object, gold?:number, boost?:Object, coupon?:boolean, ings?:Array, full?:boolean}|null}
   */
  function claimAd(id) {
    var a = AD_BY_ID[id];
    if (!a) return null;
    adRoll();
    if (adLeft(id) <= 0) return null;
    var s = S();

    // 쿠폰이 꽉 찬 상태면 시청을 낭비시키지 않는다
    if (id === 'coupon' && s.coupons >= Data.COUPON.max) return { slot: a, full: true };

    s.adUsed[id] = (s.adUsed[id] || 0) + 1;
    var out = { slot: a };
    if (id === 'gold') {
      out.gold = earn(s, Math.max(perSec(true) * Data.ADS.goldSec, Data.ADS.goldMin));
    } else if (id === 'boost') {
      applyIncomeBuff(Data.ADS.boostMult, Data.ADS.boostDur);
      out.boost = { mult: Data.ADS.boostMult, dur: Data.ADS.boostDur };
    } else if (id === 'coupon') {
      s.coupons += 1;
      out.coupon = true;
    } else if (id === 'ings') {
      out.ings = dropIngredients(Data.ADS.ingCount);
    }
    return out;
  }

  /* ---------- 우편함 ----------
     Data.MAIL 의 편지. reward 가 있으면 한 번 받을 수 있고, 받은 id 는
     s.mailTaken 에 남는다(출석·이정표 보상은 여기 없고 자동지급이다). */
  function mailClaimed(id) { return S().mailTaken.indexOf(id) >= 0; }

  /** 우편 선물을 받는다. 이미 받았거나 선물이 없으면 null. */
  function claimMail(id) {
    var m = MAIL_BY_ID[id];
    var s = S();
    if (!m || !m.reward || mailClaimed(id)) return null;
    if (m.reward.gold) earn(s, m.reward.gold);
    if (m.reward.coupons) {
      s.coupons = Math.min((s.coupons || 0) + m.reward.coupons, Data.COUPON.max + 1);
    }
    s.mailTaken.push(id);
    return m.reward;
  }

  /* ---------- 별사탕 상점 ----------
     별사탕(s.candy)으로 소비 아이템을 산다. 반복 구매 가능. */
  function addCandy(n) { var s = S(); s.candy = Math.max(0, (s.candy || 0) + n); }

  /** 상점 아이템을 산다. 별사탕이 모자라면 null, 사면 지급 내역을 돌려준다. */
  function buyShopItem(id) {
    var it = SHOP_BY_ID[id];
    var s = S();
    if (!it || !((s.candy || 0) >= it.cost)) return null;
    s.candy -= it.cost;
    var out = { item: it };
    if (it.coupons) {
      s.coupons = Math.min((s.coupons || 0) + it.coupons, Data.COUPON.max + 1);
      out.coupons = it.coupons;
    }
    if (it.boost) { applyIncomeBuff(it.boost.mult, it.boost.dur); out.boost = it.boost; }
    if (it.goldSec) {
      var amt = Math.max(perSec(true) * it.goldSec, 5000);   // 초반에도 허탕이 아니게 바닥
      earn(s, amt);
      out.gold = amt;
    }
    if (it.ings) { out.ings = dropIngredients(it.ings); }
    return out;
  }

  /* ---- 재료 트럭 ----
     받을수록 다음 간격이 30초씩 늘어난다: 30·60·90·… 오늘 온 횟수(s.truckCount)는
     세이브하되 자정(날짜 변경)에 0으로 리셋한다. 남은 시간(truckLeft)만 세션 변수다. */
  var truckHere = 0;    // 트럭이 머무는 남은 시간(0=없음)
  var truckLeft = Data.KITCHEN.truckEvery;   // 다음 트럭까지 남은 시간(초)

  /** 날짜가 바뀌었으면 오늘치 트럭 카운트를 리셋한다 */
  function truckDayRoll() {
    var s = S(), t = today();
    if (s.truckDay !== t) { s.truckDay = t; s.truckCount = 0; }
  }

  /** 지금 기준 다음 트럭까지의 간격(초). 30 × (오늘 온 횟수+1) */
  function truckGap() { truckDayRoll(); return Data.KITCHEN.truckEvery * ((S().truckCount || 0) + 1); }

  function dropIngredients(n) {
    var s = S(), all = Data.KITCHEN.ings, got = [];
    for (var i = 0; i < n; i++) {
      var ing = all[Math.floor(Math.random() * all.length)];
      s.ings[ing.id] = (s.ings[ing.id] || 0) + 1;
      got.push(ing);
    }
    return got;
  }

  /** 매 틱 트럭 타이머. 트럭이 그냥 지나가면 missDrop 만큼 자동 수거(방치 배려) */
  function tickTruck(dt) {
    truckDayRoll();   // 자정을 넘겼으면 오늘치 카운트를 리셋
    if (truckHere > 0) {
      truckHere -= dt;
      if (truckHere <= 0) { truckHere = 0; dropIngredients(Data.KITCHEN.missDrop); }
      return;
    }
    truckLeft -= dt;
    if (truckLeft <= 0) {
      truckHere = Data.KITCHEN.truckLife;
      truckDayRoll();
      var s = S(); s.truckCount = (s.truckCount || 0) + 1;   // 한 대 왔으니 오늘치 +1 → 다음 간격 30초 증가
      truckLeft += truckGap();
    }
  }

  /** 트럭을 탭해서 재료를 더 받는다 (있을 때만).
      낮은 확률로 🎟️ 할인 쿠폰도 하나 얹어준다 (최대치까지만). */
  function grabTruck() {
    if (truckHere <= 0) return null;
    truckHere = 0;
    var got = dropIngredients(Data.KITCHEN.tapDrop);
    var s = S(), coupon = false;
    if (s.coupons < Data.COUPON.max && Math.random() < Data.COUPON.dropChance) {
      s.coupons += 1;
      coupon = true;
    }
    return { ings: got, coupon: coupon };
  }

  /** 자리를 비운 동안 트럭이 몇 대나 지나갔을지 센다.
      간격이 30·60·90…로 escalating 이라 개수가 저절로 완만해진다(방치 농사 방지).
      오늘치 카운트(truckCount)에서 이어 세므로, 이미 많이 받은 날은 적게 준다. */
  function offlineTrucks(secs) {
    if (!(secs > 0)) return 0;   // NaN·음수·0 모두 차단 (secs<=0 은 NaN 을 놓친다)
    truckDayRoll();                                  // 자정을 넘겼으면 오늘치는 0부터
    var every = Data.KITCHEN.truckEvery, c = S().truckCount || 0;
    var t = 0, n = 0;
    while (n < 5000) {                               // 안전장치
      var gap = every * (c + n + 1);
      if (t + gap > secs) break;
      t += gap; n++;
    }
    return n;
  }

  function truckState() { return { here: truckHere > 0, hereLeft: truckHere, nextIn: truckLeft, count: S().truckCount || 0 }; }

  /** 트럭 타이머를 처음 상태로. 테스트에서 오늘치 카운트까지 초기화한다(실제 부팅에 불러도 안전). */
  function resetTruck() { truckHere = 0; truckLeft = Data.KITCHEN.truckEvery; var s = S(); s.truckCount = 0; s.truckDay = today(); }

  /* ---------- 명예의 전당 ---------- */

  /** 역대 회차를 명성 순으로. 동점이면 빨리 끝낸 회차가 위로. */
  function topRuns(limit) {
    return S().runs.slice().sort(function (a, b) {
      if (b.fame !== a.fame) return b.fame - a.fame;
      return a.seconds - b.seconds;
    }).slice(0, limit || 10);
  }

  /** 지금 환생하면 역대 몇 위가 되는가 (1부터, 순위 밖이면 0) */
  function projectedRank() {
    var gain = fameGain();
    if (gain <= 0) return 0;
    var s = S();
    var better = 0;
    for (var i = 0; i < s.runs.length; i++) {
      var r = s.runs[i];
      if (r.fame > gain || (r.fame === gain && r.seconds < s.runTime)) better++;
    }
    return better + 1;
  }

  /** 개인 최고 기록 모음 */
  function records() {
    var s = S();
    return [
      { icon: 'record/rec_sales.png', name: '한 회차 최고 매출', value: Fmt.won(s.bestRunEarned) },
      { icon: 'record/rec_persec.png', name: '최고 순간 초당 수익', value: Fmt.won(s.bestPerSec) },
      { icon: 'record/rec_tap.png', name: '한 번에 가장 많이 번 탭', value: Fmt.won(s.bestTap) },
      { icon: 'record/rec_fame.png', name: '한 번에 얻은 최고 명성', value: Fmt.num(s.bestFameGain) },
      { icon: 'record/rec_speed.png', name: '최단 환생 시간', value: s.fastestPrestige ? Fmt.time(s.fastestPrestige) : '—' },
      { icon: 'record/rec_combo.png', name: '최고 콤보', value: Fmt.comma(s.bestCombo) + '콤보' },
      { icon: 'record/rec_golden.png', name: '잡은 황금 손님', value: Fmt.comma(s.goldens) + '명' },
      { icon: 'record/rec_thief.png', name: '직접 잡은 도둑', value: Fmt.comma(s.thievesCaught) + '명' }
    ];
  }

  /* ---------- 주말 파티 이벤트 ---------- */

  // 테스트에서 시계를 고정할 수 있게 해 둔다 (기본은 실제 시각)
  var clockFn = null;
  function nowDate() { return clockFn ? clockFn() : new Date(); }
  function setClock(fn) { clockFn = fn; }

  /** 지금 주말 파티 중인가 (금·토 17~24시, 기기 시간) */
  function partyActive() {
    var d = nowDate();
    var day = d.getDay();
    if (Data.PARTY.days.indexOf(day) < 0) return false;
    var h = d.getHours();
    return h >= Data.PARTY.startHour && h < Data.PARTY.endHour;
  }

  /** 파티 상태 — 진행 중이면 남은 초, 아니면 다음 파티까지 남은 초 */
  function partyState() {
    var d = nowDate();
    if (partyActive()) {
      var end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Data.PARTY.endHour, 0, 0);
      return { active: true, mult: Data.PARTY.mult, left: Math.max(0, (end - d) / 1000) };
    }
    return { active: false, until: secToNextParty(d) };
  }

  /** 다음 파티 시작까지 남은 초 */
  function secToNextParty(d) {
    for (var add = 0; add < 8; add++) {
      var day = (d.getDay() + add) % 7;
      if (Data.PARTY.days.indexOf(day) >= 0) {
        var start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add,
                             Data.PARTY.startHour, 0, 0);
        if (start > d) return Math.floor((start - d) / 1000);
      }
    }
    return 0;
  }

  /* ---------- 파티 음식 도감 ---------- */

  function partyFoodsAll() { return Data.PARTY.foods; }
  function partyGot(id) { return S().partyFoods.indexOf(id) >= 0; }
  function partyGotCount() { return S().partyFoods.length; }

  /**
   * 파티 중 탭할 때 새 음식을 발견하려 시도한다.
   * @returns {{icon,name,id}|null} 새로 발견한 음식, 없으면 null
   */
  function tryDiscoverFood() {
    if (!partyActive()) return null;
    if (Math.random() >= Data.PARTY.findChance) return null;
    var s = S();
    var left = Data.PARTY.foods.filter(function (f) { return s.partyFoods.indexOf(f.id) < 0; });
    if (!left.length) return null;
    var food = left[Math.floor(Math.random() * left.length)];
    s.partyFoods.push(food.id);
    bump();                    // 도감 보너스가 늘었으니 수익 캐시 무효화
    return food;
  }

  /* ---------- 스타 셰프 도전 ---------- */

  function michTier() { return S().michTier || 0; }
  /** 지금 단계의 별 1~5 목표 (단계가 오를수록 커진다) */
  function michGoals() {
    var f = Math.pow(Data.MICHELIN.tierGrowth, michTier());
    return Data.MICHELIN.goals.map(function (g) { return Math.round(g * f); });
  }
  /** 지금 단계의 심사 시간 (초) */
  function michTimeSec() {
    return Data.MICHELIN.time + Data.MICHELIN.timePerTier * michTier();
  }

  function michelinStars(taps) {
    var g = michGoals(), n = 0;
    for (var i = 0; i < g.length; i++) if (taps >= g[i]) n = i + 1;
    return n;
  }
  function michelinNextGoal(taps) {
    var g = michGoals();
    for (var i = 0; i < g.length; i++) if (taps < g[i]) return g[i];
    return 0;
  }
  function bestMichelin() { return S().bestMichelin; }
  function michelinGrandDone() { return S().michelinGrand === 1; }

  /* ----- 시즌 ----- */

  function seasonId() {
    var d = nowDate();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function seasonName(id) {
    var m = parseInt(String(id).split('-')[1], 10) - 1;
    var nm = Data.MICHELIN.seasons[(m + 12) % 12] || '';
    return (m + 1) + '월 · ' + nm;
  }
  function michSeason() { return { id: seasonId(), name: seasonName(seasonId()) }; }

  /** 달이 바뀌었으면 지난 시즌 기록을 보관하고 이번 시즌을 새로 연다 */
  function michSeasonRoll() {
    var s = S();
    var now = seasonId();
    if (s.michSeason === now) return false;
    // 이전 시즌에 기록이 있으면 히스토리에 남긴다
    if (s.michSeason && (s.michSeasonStars > 0 || s.michSeasonTaps > 0)) {
      s.michHist.push({ s: s.michSeason, stars: s.michSeasonStars, taps: s.michSeasonTaps });
      if (s.michHist.length > Data.MICHELIN.histKeep) s.michHist = s.michHist.slice(-Data.MICHELIN.histKeep);
    }
    s.michSeason = now;
    s.michSeasonStars = 0;
    s.michSeasonTaps = 0;
    return true;
  }

  /* ----- 랭킹 (연출용) ----- */

  /** 한 판 조리 횟수로 전국 셰프 순위 */
  function michRank(taps) {
    var N = Data.MICHELIN.rankTotal;
    var t = Math.min(1, Math.max(0, taps) / Data.MICHELIN.tapCap);
    var rank = Math.max(1, Math.min(N, Math.round(N * Math.pow(1 - t, 2))));
    var pct = Math.max(0.1, Math.round(rank / N * 1000) / 10);
    return { rank: rank, total: N, pct: pct };
  }
  /** (시즌·순위) 로 정해지는 가상 셰프 이름 */
  function michChefName(rank) {
    var h = hashStr(seasonId() + '#chef#' + rank);
    var a = Data.RANK_AREAS[h % Data.RANK_AREAS.length];
    var sur = Data.MICHELIN.chefSurnames[(h >>> 5) % Data.MICHELIN.chefSurnames.length];
    var t = Data.MICHELIN.chefTitles[(h >>> 11) % Data.MICHELIN.chefTitles.length];
    return a + ' ' + sur + ' ' + t;
  }
  /** 내 앞뒤 셰프를 곁들인 미니 리더보드 (연출) */
  function michBoard() {
    var s = S();
    var myTaps = s.michSeasonTaps;
    var my = michRank(myTaps).rank;
    var rows = [], want = [], i;
    for (i = 1; i <= 3; i++) want.push(i);
    for (i = my - 1; i <= my + 1; i++) if (i >= 1) want.push(i);
    want = want.filter(function (v, k) { return want.indexOf(v) === k; })
               .sort(function (a, b) { return a - b; });
    var prev = 0;
    want.forEach(function (rank) {
      if (rank - prev > 1) rows.push({ gap: true });
      rows.push({ rank: rank, me: (rank === my && myTaps > 0),
        name: (rank === my && myTaps > 0) ? '나' : michChefName(rank) });
      prev = rank;
    });
    return rows;
  }

  /** 심사 종료 정산 — @returns {{stars,gain,best,grandNew,seasonBest,rank}} */
  function claimMichelin(taps) {
    var s = S();
    michSeasonRoll();
    var stars = michelinStars(taps);
    var gain = 0;
    if (stars > 0) {
      gain = earn(s, Math.max(Data.MICHELIN.minReward * stars,
                              perSec(true) * Data.MICHELIN.starSec * stars));
    }
    if (stars > s.bestMichelin) s.bestMichelin = stars;
    if (taps > s.michBestTaps) s.michBestTaps = taps;
    var seasonBest = false;
    if (stars > s.michSeasonStars) { s.michSeasonStars = stars; seasonBest = true; }
    if (taps > s.michSeasonTaps) s.michSeasonTaps = taps;
    var grandNew = false;
    if (stars >= 5 && !s.michelinGrand) { s.michelinGrand = 1; bump(); grandNew = true; }
    // 5성을 채우면 다음 단계로 — 다음 도전은 목표가 더 높아진다
    var tierUp = 0;
    if (stars >= 5) {
      s.michTier = (s.michTier || 0) + 1;
      tierUp = s.michTier;
      // 단계 돌파 보너스 (올라간 단계에 비례)
      gain += earn(s, Math.max(Data.MICHELIN.minReward * 10,
                               perSec(true) * Data.MICHELIN.starSec * 5 * tierUp));
    }
    return { stars: stars, gain: gain, best: s.bestMichelin, grandNew: grandNew,
             seasonBest: seasonBest, rank: michRank(taps), tierUp: tierUp, tier: s.michTier };
  }

    /* ---------- 전국 맛집 랭킹 (연출용) ---------- */

  // 문자열 하나로 정해지는 값 — 이름·지역을 고정하는 데 쓴다
  function hashStr(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  /** 내 가게가 속한 지역 — 한 번 배정되면 세이브에 남아 바뀌지 않는다 */
  function region() {
    var s = S();
    var found = null, i;
    for (i = 0; i < Data.REGIONS.length; i++) {
      if (Data.REGIONS[i].id === s.region) found = Data.REGIONS[i];
    }
    if (found) return found;
    // 아직 없으면 시작 시각으로 정한다 (가중치 반영)
    var pool = [];
    Data.REGIONS.forEach(function (r) {
      for (var k = 0; k < r.weight; k++) pool.push(r);
    });
    var pick = pool[hashStr('region#' + s.startedAt) % pool.length];
    s.region = pick.id;
    return pick;
  }

  /** 내 가게의 인기 점수 — 최고 순간 초당 수익, 지금 벌이가 더 크면 그것 */
  function popScore() {
    return Math.max(bestScore(), perSec(true));
    function bestScore() { return S().bestPerSec || 0; }
  }

  /** 점수를 전국 순위로. 벌이가 오를수록 순위가 앞당겨진다 (1위에 가까워짐). */
  function nationRank() {
    var N = Data.RANK.nationTotal;
    var lv = Math.log(popScore() + 1) / Math.LN10;          // 0 ~ 15+
    var t = Math.min(1, lv / Data.RANK.maxScore);           // 0 ~ 1
    var rank = Math.round(N * Math.pow(1 - t, 3));           // 뒤에서부터 앞으로
    rank = Math.max(1, Math.min(N, rank));
    var pct = Math.max(0.1, Math.round(rank / N * 1000) / 10); // 상위 %
    return { rank: rank, total: N, pct: pct };
  }

  /** 지역 순위 — '작은 연못'. 전국보다 낮은 점수에서 지역 1위에 닿아
      "전국 수백 위인데 우리 지역 1위" 가 가능하다. total 은 지역 몫(작음). */
  function regionRank() {
    var r = region();
    var total = 0, mine = 0;
    Data.REGIONS.forEach(function (x) { total += x.weight; if (x.id === r.id) mine = x.weight; });
    var share = mine / total;
    var regTotal = Math.max(Data.RANK.regionMin, Math.round(Data.RANK.nationTotal * share));
    // 지역은 상한을 낮춰(maxScore×regionTopFrac) 더 일찍 1위에 닿게 한다
    var lv = Math.log(popScore() + 1) / Math.LN10;
    var t = Math.min(1, lv / (Data.RANK.maxScore * Data.RANK.regionTopFrac));
    var rank = Math.round(regTotal * Math.pow(1 - t, 3));
    rank = Math.max(1, Math.min(regTotal, rank));
    return { rank: rank, total: regTotal, region: r };
  }

  /** 순위 하나의 인기 점수 (위일수록 큼) */
  function rankPop(rank) {
    return Math.max(1, Math.round(9990000 / Math.pow(rank, 0.82)));
  }

  /** (지역, 순위) 로 정해지는 가상 맛집 이름 */
  function rankName(regionId, rank) {
    var h = hashStr(regionId + '#' + rank);
    var a = Data.RANK_AREAS[h % Data.RANK_AREAS.length];
    var f = Data.RANK_FOODS[(h >>> 5) % Data.RANK_FOODS.length];
    var t = Data.RANK_TITLES[(h >>> 11) % Data.RANK_TITLES.length];
    return a + ' ' + f + t;
  }

  /**
   * 내 지역 리더보드 — 상위 3곳 + (필요하면 …) + 내 앞뒤.
   * @returns {Array<{rank,name,pop,me,gap}>}
   */
  function rankBoard() {
    var rr = regionRank();
    var R = rr.rank, total = rr.total, rid = rr.region.id;
    var rows = [];
    var want = [];
    var i;
    // 상위 3곳
    for (i = 1; i <= Math.min(3, total); i++) want.push(i);
    // 내 앞뒤 (겹치면 위에서 걸러진다)
    for (i = R - 1; i <= R + 1; i++) if (i >= 1 && i <= total) want.push(i);
    // 중복 제거하고 정렬
    want = want.filter(function (v, k) { return want.indexOf(v) === k; })
               .sort(function (a, b) { return a - b; });

    var prev = 0;
    want.forEach(function (rank) {
      if (rank - prev > 1) rows.push({ gap: true });          // … 표시
      rows.push({
        rank: rank,
        name: rank === R ? myShopName() : rankName(rid, rank),
        pop: rankPop(rank),
        me: rank === R
      });
      prev = rank;
    });
    return rows;
  }

  /** 내 가게 이름 — 스킨 간판을 딴다 */
  function myShopName() {
    var sign = tapSkin().sign || '분식';
    return '우리 ' + sign + '집';
  }

  /* ---------- 온보딩 — 탭 점진적 잠금 ----------
     신규 유저에게 화면을 한꺼번에 안 쏟아붓는다. 진행에 따라 탭을 하나씩 연다.
     조건은 전부 세이브 상태에서 파생 → 기존 유저는 처음 켜자마자 다 열려 있다.
     한 번 열린(본) 탭은 s.tabsSeen 에 적혀 다시 잠기지 않는다. */
  var ALL_TABS = ['shop', 'upgrade', 'kitchen', 'prestige', 'achv', 'settings'];
  var TAB_NAME = { shop: '가게', upgrade: '업그레이드', kitchen: '주방', prestige: '환생', achv: '기록', settings: '설정' };

  function genTotal() { var s = S(), n = 0; for (var k in s.gens) n += s.gens[k] || 0; return n; }

  /** 진행도로 '지금 열려 있어야 하는' 탭들 */
  function unlockedTabs() {
    var s = S(), out = ['shop', 'settings'];              // 가게·설정은 늘 열림
    if (genTotal() >= 3 || s.totalEarned >= 300) out.push('upgrade');   // 설비 몇 개 사면
    if (bossLevel() >= 1) out.push('kitchen');            // 사장 Lv.1 = 첫 레시피
    if (bossLevel() >= 2 || s.prestiges >= 1) out.push('achv');         // 퀘스트·무료보상·랭킹
    if (s.runEarned >= PRESTIGE_BASE || s.prestiges >= 1) out.push('prestige'); // 환생 가능
    return out;
  }
  function tabUnlocked(id) { return unlockedTabs().indexOf(id) >= 0; }
  function tabName(id) { return TAB_NAME[id] || id; }

  /** 아직 '봤다'고 안 적힌 새 잠금 해제 (연출용) */
  function tabsToReveal() {
    var seen = S().tabsSeen || [];
    return unlockedTabs().filter(function (id) { return seen.indexOf(id) < 0; });
  }
  /** 탭을 봤다고 적는다 (다시 연출 안 함) */
  function markTabsSeen(ids) {
    var s = S();
    if (!Array.isArray(s.tabsSeen)) s.tabsSeen = [];
    ids.forEach(function (id) { if (ALL_TABS.indexOf(id) >= 0 && s.tabsSeen.indexOf(id) < 0) s.tabsSeen.push(id); });
  }
  /** 부팅 시 지금 열린 탭을 조용히 '봤다'고 적는다 — 기존 진행분엔 연출을 안 띄운다 */
  function seedTabsSeen() { markTabsSeen(unlockedTabs()); }
  /** 화면에 실제로 보일 탭 = 열렸거나 이미 본 것 (탭바 순서 유지) */
  function visibleTabs() {
    var seen = S().tabsSeen || [], un = unlockedTabs();
    return ALL_TABS.filter(function (id) { return seen.indexOf(id) >= 0 || un.indexOf(id) >= 0; });
  }

  /* ---------- 오프라인 ---------- */
  function offlineCapSeconds() {
    return (4 + 2 * fameLv('f_offtime')) * 3600;
  }

  function offlineEfficiency() {
    return 0.5 + 0.1 * fameLv('f_offeff');
  }

  /** 오프라인 2차 상한(꼬리 끝) — 여기를 넘으면 더 이상 안 준다 */
  function offlineTailCapSeconds() {
    return offlineCapSeconds() * Data.OFFLINE.tailMult;
  }

  /**
   * 자리를 비운 동안의 수익 계산.
   * 인정 시간(capped)까지는 제 효율, 그 뒤 2차 상한까지는 꼬리 효율(tailEff)로 조금 더 준다.
   * @returns {{seconds:number, capped:number, tailSeconds:number, tailEff:number, gain:number}}
   */
  function offlineReward(elapsedSec) {
    // 이상한 경과값(NaN·음수·0)이 들어오면 NaN 보상·트럭 5000개가 새지 않게 바로 0.
    // 지금 호출처(main.js)는 항상 유한한 양수를 넘기지만, 방어를 함수 안에 둔다.
    if (!(elapsedSec > 0)) {
      return { seconds: 0, capped: 0, tailSeconds: 0,
               tailEff: Data.OFFLINE.tailEff, gain: 0, trucks: 0, ings: 0 };
    }
    var cap = offlineCapSeconds();
    var capped = Math.min(elapsedSec, cap);                       // 제값 구간(초)
    var tailRoom = offlineTailCapSeconds() - cap;                 // 꼬리 구간 길이
    var tailSeconds = Math.min(Math.max(elapsedSec - cap, 0), tailRoom);  // 실제로 인정된 꼬리(초)
    // 자리를 비운 동안에는 일시 버프가 흐르지 않으므로 버프를 뺀 수익으로 계산한다
    var eff = offlineEfficiency();
    var gain = perSec(true) * eff * (capped + tailSeconds * Data.OFFLINE.tailEff);
    // 재료 트럭도 자리를 비운 만큼(제값 구간 기준) 지나갔다 — 재료만 자동 수거한다(돈·쿠폰 없음)
    var trucks = offlineTrucks(capped);
    return { seconds: elapsedSec, capped: capped, tailSeconds: tailSeconds,
             tailEff: Data.OFFLINE.tailEff, gain: gain,
             trucks: trucks, ings: trucks * Data.KITCHEN.missDrop };
  }

  /** 오프라인 보상을 실제로 지급. 돈에 더해, 지나간 트럭 수만큼 재료를 자동 수거한다.
      @returns {{ings:Array}} 받은 재료 목록(연출용) */
  function claimOffline(gain, trucks) {
    var s = S();
    earn(s, gain);
    s.offlineClaims++;
    var got = [];
    if (trucks > 0) {
      got = dropIngredients(trucks * Data.KITCHEN.missDrop);
      s.truckCount = (s.truckCount || 0) + trucks;   // 다음 간격 escalation 을 이어간다
    }
    return { ings: got };
  }

  /* ---------- 진행 ---------- */
  var questCheckLeft = 0;

  function tick(dt) {
    var s = S();
    tickBuffs(dt);
    tickTruck(dt);

    // 자정을 넘기면 퀘스트가 새로 깔린다.
    // 매 프레임 Date 를 새로 만들 이유가 없어 10초에 한 번만 본다.
    questCheckLeft -= dt;
    if (questCheckLeft <= 0) { questCheckLeft = 10; questRoll(); specialRoll(); adRoll(); }

    var rate = perSec();
    var gain = earn(s, rate * dt);
    s.playTime += dt;
    s.runTime += dt;

    // 명예의 전당 기록 갱신
    if (rate > s.bestPerSec) s.bestPerSec = rate;
    if (s.runEarned > s.bestRunEarned) s.bestRunEarned = s.runEarned;
    return gain;
  }

  /** 새로 달성된 도전과제 목록을 돌려준다 */
  function checkAchievements() {
    var s = S();
    var unlocked = [];
    Data.ACHIEVEMENTS.forEach(function (a) {
      if (s.achievements[a.id]) return;
      var ok = false;
      try { ok = a.check(s); } catch (e) { ok = false; }
      if (ok) {
        s.achievements[a.id] = true;
        unlocked.push(a);
      }
    });
    if (unlocked.length) {
      bump();   // 도전과제 개수가 전체 배율에 들어간다
      addCandy(unlocked.length * (Data.CANDY.perAchv || 0));   // 이정표마다 별사탕 (자동지급)
    }
    return unlocked;
  }

  /* ---------- 황금 손님 ---------- */

  /** 다음 황금 손님이 올 때까지의 대기 시간 (초) */
  function nextGoldenGap() {
    var g = Data.GOLDEN;
    var scale = Math.pow(g.gapPerLv, fameLv('f_gold'));
    if (partyActive()) scale *= Data.PARTY.goldenScale;   // 파티 중엔 더 자주
    return (g.minGap + Math.random() * (g.maxGap - g.minGap)) * scale;
  }

  /** 등장할 황금 손님 종류를 가중치로 하나 뽑는다 */
  function rollGolden() {
    var types = Data.GOLDEN.types;
    var total = 0;
    types.forEach(function (t) { total += t.weight; });
    var r = Math.random() * total;
    for (var i = 0; i < types.length; i++) {
      r -= types[i].weight;
      if (r <= 0) return types[i];
    }
    return types[0];
  }

  /**
   * 황금 손님을 잡았을 때의 처리.
   * @returns {{type:object, money:number, text:string}}
   */
  function claimGolden(type, trusted) {
    if (trusted === false) return null;
    var s = S();
    s.goldens++;
    var money = 0;
    var text;
    questBump('golden', 1);

    if (type.id === 'cash') {
      // 초반에 초당 수익이 0이어도 허탕이 되지 않도록 탭 수익으로 바닥을 깐다
      // 바닥값은 버프·콤보를 뺀 값으로 — 버프 켠 채 잡았다고 부풀면 안 된다(규칙 4)
      money = Math.max(perSec(true) * 240, tapBaseValue() * 25, 100);
      earn(s, money);
      text = '💰 ' + Fmt.won(money) + ' 획득!';
    } else if (type.id === 'rush') {
      // 광고 '수익 2배'와 같은 슬롯을 쓴다 — 합치는 규칙은 applyIncomeBuff 참고
      applyIncomeBuff(type.mult, type.dur);
      text = '⚡ ' + type.dur + '초 동안 수익 ×' + type.mult + '!';
    } else {
      s.goldTapMult = Math.max(s.goldTapLeft > 0 ? s.goldTapMult : 1, type.mult);
      s.goldTapLeft = Math.max(s.goldTapLeft, type.dur);
      text = '👐 ' + type.dur + '초 동안 탭 수익 ×' + type.mult + '!';
    }

    return { type: type, money: money, text: text };
  }

  /* ---------- 도둑 & 경찰 ---------- */

  function nextThiefGap() {
    var t = Data.THIEF;
    return t.minGap + Math.random() * (t.maxGap - t.minGap);
  }

  /** 도둑이 노리는 금액. 설비·업그레이드는 절대 건드리지 않는다. */
  function thiefTarget() {
    var t = Data.THIEF;
    var s = S();
    return Math.min(s.money * t.stealPct, perSec(true) * t.stealCapSec);
  }

  /** 지금 도둑을 내보낼 만한가 (훔칠 게 없으면 안 나온다) */
  function thiefWorthwhile() {
    return thiefTarget() >= Data.THIEF.minSteal;
  }

  /** 경찰이 자동으로 잡아줄 확률 */
  function policeChance() {
    var t = Data.THIEF;
    return Math.min(0.9, t.policeBase + t.policePerLv * fameLv('f_police'));
  }

  /**
   * 도둑을 직접 잡았다.
   * @returns {{bonus:number, saved:number}|null} 가짜 이벤트면 null
   */
  function catchThief(amount, trusted) {
    if (trusted === false) return null;
    var s = S();
    var bonus = amount * Data.THIEF.catchBonus;
    earn(s, bonus);
    s.thievesCaught++;
    questBump('thief', 1);
    return { bonus: bonus, saved: amount };
  }

  /** 경찰이 잡아줬다 — 피해는 없지만 보너스도 없다 */
  function policeCaught(amount) {
    S().thiefSaves++;
    return { saved: amount };
  }

  /** 놓쳤다 — 이때 비로소 돈이 빠진다 */
  function thiefEscaped(amount) {
    var s = S();
    // 계산한 뒤 돈이 줄었을 수도 있으니 다시 한 번 막는다
    var lost = Math.max(0, Math.min(amount, s.money));
    s.money -= lost;
    s.stolen += lost;
    s.thefts++;
    return { lost: lost };
  }

  /* ---------- 손님 몰이 (부스트 버튼) ---------- */

  function boostCooldown() {
    return Data.BOOST.cd * Math.pow(Data.BOOST.cdPerLv, fameLv('f_boost'));
  }

  function boostReady() {
    var s = S();
    return s.boostCd <= 0 && s.boostLeft <= 0;
  }

  function startBoost() {
    var s = S();
    if (!boostReady()) return false;
    s.boostLeft = Data.BOOST.dur;
    s.boostCd = boostCooldown() + Data.BOOST.dur;   // 효과가 끝난 뒤부터 쿨다운이 도는 셈
    s.boosts++;
    questBump('boost', 1);
    return true;
  }

  /* ---------- 일일 출석 보상 ---------- */

  /** 로컬 기준 오늘 날짜 (YYYY-MM-DD) */
  function today() {
    var d = nowDate();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function shiftDay(dateStr, days) {
    var p = String(dateStr).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + days);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dailyReady() { return S().dailyDate !== today(); }

  /**
   * 출석 보상 지급. 하루 한 번만 받을 수 있다.
   * @returns {{streak:number, gain:number}|null}
   */
  function claimDaily() {
    var s = S();
    var t = today();
    if (s.dailyDate === t) return null;

    // 어제 받았으면 연속, 아니면 처음부터
    s.dailyStreak = (s.dailyDate && shiftDay(s.dailyDate, 1) === t) ? s.dailyStreak + 1 : 1;
    s.dailyDate = t;
    s.dailyClaims++;

    var d = Data.DAILY;
    var days = Math.min(s.dailyStreak, d.maxStreak);
    var seconds = d.baseSeconds + d.perStreak * (days - 1);
    var gain = Math.max(perSec(true) * seconds, d.minMoney);
    earn(s, gain);
    var candy = Data.DAILY.candy || 0;
    if (candy) addCandy(candy);            // 출석하면 별사탕도 (상점 재화)

    return { streak: s.dailyStreak, days: days, seconds: seconds, gain: gain, candy: candy };
  }

  /* ---------- 일일 퀘스트 ---------- */

  var QUEST_BY_ID = {};
  Data.QUESTS.forEach(function (q) { QUEST_BY_ID[q.id] = q; });

  /** 날짜 문자열 하나로 정해지는 값 — 같은 날이면 언제 켜도 같은 퀘스트가 나온다 */
  function daySeed(dateStr) {
    var h = 2166136261;
    for (var i = 0; i < dateStr.length; i++) {
      h ^= dateStr.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  /** '오늘 벌기' 처럼 그날 형편에 맞춰야 하는 목표 */
  function questGoalFor(def) {
    if (!def.money) return def.goal;
    return Math.max(Data.QUEST.minEarn, Math.floor(perSec(true) * Data.QUEST.earnSec));
  }

  /**
   * 날짜가 바뀌었으면 오늘 퀘스트를 새로 깐다.
   * 무엇이 깔릴지는 날짜가 정하므로 새로고침으로 다시 뽑을 수 없다.
   */
  function questRoll() {
    var s = S();
    var t = today();
    if (s.questDate === t && s.questIds.length === Data.QUEST.count) return false;

    var pool = Data.QUESTS.slice();
    var seed = daySeed(t);
    // 순서를 섞는다 (같은 날이면 항상 같은 순서)
    for (var i = pool.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      var j = seed % (i + 1);
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var picked = pool.slice(0, Data.QUEST.count);

    s.questDate = t;
    s.questIds = picked.map(function (q) { return q.id; });
    s.questGoals = picked.map(questGoalFor);
    s.questProg = picked.map(function () { return 0; });
    s.questTaken = picked.map(function () { return 0; });
    s.questAllTaken = 0;
    return true;
  }

  /** 화면에 뿌릴 오늘 퀘스트 */
  function quests() {
    var s = S();
    return s.questIds.map(function (id, i) {
      var def = QUEST_BY_ID[id];
      var goal = s.questGoals[i] || 1;
      var prog = Math.min(s.questProg[i] || 0, goal);
      return {
        def: def,
        index: i,
        goal: goal,
        prog: prog,
        done: prog >= goal,
        taken: !!s.questTaken[i],
        name: def.money ? '오늘 ' + Fmt.num(goal) + ' 원 벌기' : def.name
      };
    });
  }

  /**
   * 사건이 일어났다고 알린다.
   * @param {string} kind Data.QUESTS 의 kind
   * @param {number} n 얼마나
   */
  function questBump(kind, n) {
    var s = S();
    if (!(n > 0)) return;
    for (var i = 0; i < s.questIds.length; i++) {
      var def = QUEST_BY_ID[s.questIds[i]];
      if (!def || def.kind !== kind) continue;
      // 콤보처럼 '최고 기록' 인 것은 더하면 안 된다
      s.questProg[i] = def.max ? Math.max(s.questProg[i] || 0, n)
                               : cap((s.questProg[i] || 0) + n);
    }
  }

  function questReward(seconds) {
    return Math.max(Data.QUEST.minMoney, perSec(true) * seconds);
  }

  /** 하나 받기. 못 받는 상태면 null */
  function claimQuest(i) {
    var s = S();
    var list = quests();
    var q = list[i];
    if (!q || !q.done || q.taken) return null;
    s.questTaken[i] = 1;
    s.questsDone++;
    var gain = questReward(Data.QUEST.rewardSec);
    earn(s, gain);
    return { name: q.name, gain: gain };
  }

  function questAllDone() {
    var list = quests();
    return list.length > 0 && list.every(function (q) { return q.taken; });
  }

  /** 셋 다 받은 뒤의 보너스 — 돈에 더해 손님 몰이를 한 번 채워준다 */
  function claimQuestAll() {
    var s = S();
    if (!questAllDone() || s.questAllTaken) return null;
    s.questAllTaken = 1;
    var gain = questReward(Data.QUEST.allSec);
    earn(s, gain);
    var freeBoost = s.boostLeft <= 0;
    if (freeBoost) s.boostCd = 0;     // 바로 쓸 수 있게 쿨다운을 지운다
    return { gain: gain, boost: freeBoost };
  }

  /** 뱃지용: 지금 받을 게 있나 */
  function questClaimable() {
    var s = S();
    if (quests().some(function (q) { return q.done && !q.taken; })) return true;
    return questAllDone() && !s.questAllTaken;
  }

  /** 뱃지(빨간 점)용: 지금 살 수 있는 게 있나 */
  function hasAffordableUpgrade() {
    var money = S().money;
    return availableUpgrades().some(function (u) { return money >= u.cost; });
  }

  function hasAffordableFame() {
    var fame = S().fame;
    return Data.FAME_SHOP.some(function (f) {
      return fameLv(f.id) < f.max && fame >= fameCost(f.id);
    });
  }

  return {
    GEN_BY_ID: GEN_BY_ID,
    UP_BY_ID: UP_BY_ID,
    FAME_BY_ID: FAME_BY_ID,
    genCount: genCount,
    genCost: genCost,
    genCostAt: genCostAt,
    genRate: genRate,
    genUnlocked: genUnlocked,
    maxAffordable: maxAffordable,
    perSec: perSec,
    atIncomeCap: atIncomeCap,
    genBarelyHelps: genBarelyHelps,
    tapValue: tapValue,
    tap: tap,
    globalMult: globalMult,
    achievementCount: achievementCount,
    availableUpgrades: availableUpgrades,
    allUpgrades: allUpgrades,
    upgradeUnlocked: upgradeUnlocked,
    buyGen: buyGen,
    buyUpgrade: buyUpgrade,
    upgradeCost: upgradeCost,
    setCouponArmed: setCouponArmed,
    couponState: couponState,
    buyFame: buyFame,
    fameLv: fameLv,
    fameCost: fameCost,
    fameGain: fameGain,
    nextFameAt: nextFameAt,
    startMoney: startMoney,
    doPrestige: doPrestige,
    PRESTIGE_BASE: PRESTIGE_BASE,
    managerBuys: managerBuys,
    runManager: runManager,
    topRuns: topRuns,
    region: region,
    nationRank: nationRank,
    regionRank: regionRank,
    rankBoard: rankBoard,
    myShopName: myShopName,
    ownerSex: ownerSex,
    setOwnerSex: setOwnerSex,
    ownerStage: ownerStage,
    ownerImg: ownerImg,
    visibleTabs: visibleTabs,
    tabsToReveal: tabsToReveal,
    markTabsSeen: markTabsSeen,
    seedTabsSeen: seedTabsSeen,
    tabUnlocked: tabUnlocked,
    tabName: tabName,
    projectedRank: projectedRank,
    records: records,
    offlineCapSeconds: offlineCapSeconds,
    offlineTailCapSeconds: offlineTailCapSeconds,
    offlineEfficiency: offlineEfficiency,
    offlineReward: offlineReward,
    offlineTrucks: offlineTrucks,
    claimOffline: claimOffline,
    tick: tick,
    checkAchievements: checkAchievements,
    hasAffordableUpgrade: hasAffordableUpgrade,
    hasAffordableFame: hasAffordableFame,

    invalidate: bump,
    MACRO: MACRO,
    macroRestLeft: macroRestLeft,
    resetGuard: resetGuard,
    buffMult: buffMult,
    activeBuffs: activeBuffs,
    advanceTimers: advanceTimers,
    comboCount: comboCount,
    comboRatio: comboRatio,
    comboMult: comboMult,
    resetCombo: resetCombo,
    bestGen: bestGen,
    buyBest: buyBest,
    bossLevel: bossLevel,
    bossXpRatio: bossXpRatio,
    bossTitle: bossTitle,
    foodBonus: foodBonus,
    foodEffBonus: foodEffBonus,
    masteryTier: masteryTier,
    masteryMult: masteryMult,
    ingCount: ingCount,
    foodMade: foodMade,
    recipeUnlocked: recipeUnlocked,
    canCraft: canCraft,
    craftFood: craftFood,
    specialToday: specialToday,
    claimSpecialOrder: claimSpecialOrder,
    adSlots: adSlots,
    adLeft: adLeft,
    adRoll: adRoll,
    claimAd: claimAd,
    mailClaimed: mailClaimed,
    claimMail: claimMail,
    buyShopItem: buyShopItem,
    grabTruck: grabTruck,
    truckState: truckState,
    resetTruck: resetTruck,
    nextGoldenGap: nextGoldenGap,
    rollGolden: rollGolden,
    claimGolden: claimGolden,
    nextThiefGap: nextThiefGap,
    thiefTarget: thiefTarget,
    thiefWorthwhile: thiefWorthwhile,
    policeChance: policeChance,
    catchThief: catchThief,
    policeCaught: policeCaught,
    thiefEscaped: thiefEscaped,
    boostCooldown: boostCooldown,
    boostReady: boostReady,
    startBoost: startBoost,
    dailyReady: dailyReady,
    partyActive: partyActive,
    michelinStars: michelinStars,
    michelinNextGoal: michelinNextGoal,
    bestMichelin: bestMichelin,
    michelinGrandDone: michelinGrandDone,
    claimMichelin: claimMichelin,
    michSeason: michSeason,
    michSeasonRoll: michSeasonRoll,
    michTier: michTier,
    michGoals: michGoals,
    michTimeSec: michTimeSec,
    michRank: michRank,
    michBoard: michBoard,
    partyState: partyState,
    setClock: setClock,
    partyFoodsAll: partyFoodsAll,
    partyGot: partyGot,
    partyGotCount: partyGotCount,
    tryDiscoverFood: tryDiscoverFood,
    questRoll: questRoll,
    quests: quests,
    questBump: questBump,
    claimQuest: claimQuest,
    questAllDone: questAllDone,
    claimQuestAll: claimQuestAll,
    questClaimable: questClaimable,
    tapBaseValue: tapBaseValue,
    tapSkin: tapSkin,
    crowdSkin: crowdSkin,
    tapStep: tapStep,
    nextTapStep: nextTapStep,
    crowdTier: crowdTier,
    setSkin: setSkin,
    claimDaily: claimDaily
  };
})();
