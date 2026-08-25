/* 게임 로직: 수익 계산 / 구매 / 환생 / 오프라인 보상 */
var Game = (function () {

  var GEN_BY_ID = {};
  Data.GENERATORS.forEach(function (g) { GEN_BY_ID[g.id] = g; });

  var UP_BY_ID = {};
  Data.UPGRADES.forEach(function (u) { UP_BY_ID[u.id] = u; });

  var FAME_BY_ID = {};
  Data.FAME_SHOP.forEach(function (f) { FAME_BY_ID[f.id] = f; });

  function S() { return State.get(); }

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
  function achievementCount() {
    return Object.keys(S().achievements).length;
  }

  /** 모든 수익에 곱해지는 전역 배율 */
  function globalMult() {
    var s = S();
    var m = 1;
    m *= 1 + 0.02 * s.fame;                    // 명성 1당 +2%
    m *= 1 + 0.01 * achievementCount();        // 도전과제 1개당 +1%
    m *= Math.pow(1.5, fameLv('f_mult'));      // 명성상점: 전설의 명성
    Data.UPGRADES.forEach(function (u) {
      if (u.kind === 'all' && s.upgrades[u.id]) m *= u.value;
    });
    return m;
  }

  /** 특정 설비에만 붙는 배율 */
  function genMult(id) {
    var s = S();
    var m = 1;
    Data.UPGRADES.forEach(function (u) {
      if (u.kind === 'gen' && u.target === id && s.upgrades[u.id]) m *= u.value;
    });
    return m;
  }

  /* ---------- 설비 ---------- */
  function genCount(id) { return S().gens[id] || 0; }

  function costDiscount() {
    return Math.pow(0.97, fameLv('f_cheap'));
  }

  /** n번째(0-indexed) 하나의 가격 */
  function genCostAt(id, index) {
    var g = GEN_BY_ID[id];
    return g.baseCost * Math.pow(Data.COST_GROWTH, index) * costDiscount();
  }

  /** 지금 amount개를 살 때 총 가격 */
  function genCost(id, amount) {
    amount = amount || 1;
    var owned = genCount(id);
    var g = GEN_BY_ID[id];
    // 등비수열 합
    var r = Data.COST_GROWTH;
    var base = g.baseCost * Math.pow(r, owned) * costDiscount();
    return base * (Math.pow(r, amount) - 1) / (r - 1);
  }

  /** 지금 돈으로 최대 몇 개 살 수 있나 */
  function maxAffordable(id) {
    var g = GEN_BY_ID[id];
    var r = Data.COST_GROWTH;
    var owned = genCount(id);
    var base = g.baseCost * Math.pow(r, owned) * costDiscount();
    var money = S().money;
    if (money < base) return 0;
    var n = Math.floor(Math.log(money * (r - 1) / base + 1) / Math.log(r));
    return Math.max(0, Math.min(n, 1000));
  }

  /** 설비 1종의 초당 수익 */
  function genRate(id) {
    var g = GEN_BY_ID[id];
    return g.rate * genCount(id) * genMult(id) * globalMult();
  }

  /** 전체 초당 수익 */
  function perSec() {
    var total = 0;
    Data.GENERATORS.forEach(function (g) { total += genRate(g.id); });
    return total;
  }

  /* ---------- 탭 ---------- */
  function tapValue() {
    var s = S();
    var base = 1;
    Data.UPGRADES.forEach(function (u) {
      if (u.kind === 'tap' && s.upgrades[u.id]) base *= u.value;
    });
    base *= Math.pow(3, fameLv('f_tap'));

    var pct = 0;
    Data.UPGRADES.forEach(function (u) {
      if (u.kind === 'tapPct' && s.upgrades[u.id]) pct += u.value;
    });

    return base * globalMult() + perSec() * pct;
  }

  function tap() {
    var v = tapValue();
    var s = S();
    s.money += v;
    s.runEarned += v;
    s.totalEarned += v;
    s.taps++;
    return v;
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

  /** 현재 화면에 보여줄 업그레이드 목록 */
  function availableUpgrades() {
    return Data.UPGRADES
      .filter(upgradeUnlocked)
      .sort(function (a, b) {
        if (a.cost !== b.cost) return a.cost - b.cost;
        return (a.order || 0) - (b.order || 0);
      });
  }

  /* ---------- 구매 ---------- */
  function buyGen(id, amount) {
    amount = amount || 1;
    var cost = genCost(id, amount);
    var s = S();
    if (s.money < cost || amount <= 0) return false;
    s.money -= cost;
    s.gens[id] = genCount(id) + amount;
    return true;
  }

  function buyUpgrade(id) {
    var u = UP_BY_ID[id];
    var s = S();
    if (!u || s.upgrades[id]) return false;
    if (s.money < u.cost) return false;
    s.money -= u.cost;
    s.upgrades[id] = true;
    return true;
  }

  function buyFame(id) {
    var s = S();
    var lv = fameLv(id);
    var f = FAME_BY_ID[id];
    if (!f || lv >= f.max) return false;
    var cost = fameCost(id, lv);
    if (s.fame < cost) return false;
    s.fame -= cost;
    s.fameLv[id] = lv + 1;
    return true;
  }

  /* ---------- 환생 ---------- */
  // 이번 회차 매출이 이 값을 넘으면 환생 가능.
  // 명성 = (매출 / BASE) ^ 0.4  -> 2~3시간에 첫 환생, 하루 방치면 수십 단위
  var PRESTIGE_BASE = 1e6;

  /** 지금 환생하면 받을 명성 */
  function fameGain() {
    var s = S();
    if (s.runEarned < PRESTIGE_BASE) return 0;
    return Math.floor(Math.pow(s.runEarned / PRESTIGE_BASE, 0.4));
  }

  /** 다음 명성 1을 더 받으려면 얼마가 더 필요한가 */
  function nextFameAt() {
    var need = Math.pow(fameGain() + 1, 1 / 0.4) * PRESTIGE_BASE;
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

    s.fame += gain;
    s.prestiges++;
    s.money = startMoney();
    s.runEarned = 0;
    s.gens = {};
    // 일반 업그레이드만 초기화 (명성상점/도전과제는 영구)
    s.upgrades = {};

    return gain;
  }

  /* ---------- 오프라인 ---------- */
  function offlineCapSeconds() {
    return (4 + 2 * fameLv('f_offtime')) * 3600;
  }

  function offlineEfficiency() {
    return 0.5 + 0.1 * fameLv('f_offeff');
  }

  /**
   * 자리를 비운 동안의 수익 계산.
   * @returns {{seconds:number, capped:number, gain:number}}
   */
  function offlineReward(elapsedSec) {
    var capped = Math.min(elapsedSec, offlineCapSeconds());
    var gain = perSec() * capped * offlineEfficiency();
    return { seconds: elapsedSec, capped: capped, gain: gain };
  }

  function claimOffline(gain) {
    var s = S();
    s.money += gain;
    s.runEarned += gain;
    s.totalEarned += gain;
    s.offlineClaims++;
  }

  /* ---------- 진행 ---------- */
  function tick(dt) {
    var s = S();
    var gain = perSec() * dt;
    s.money += gain;
    s.runEarned += gain;
    s.totalEarned += gain;
    s.playTime += dt;
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
    return unlocked;
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
    tapValue: tapValue,
    tap: tap,
    globalMult: globalMult,
    achievementCount: achievementCount,
    availableUpgrades: availableUpgrades,
    upgradeUnlocked: upgradeUnlocked,
    buyGen: buyGen,
    buyUpgrade: buyUpgrade,
    buyFame: buyFame,
    fameLv: fameLv,
    fameCost: fameCost,
    fameGain: fameGain,
    nextFameAt: nextFameAt,
    startMoney: startMoney,
    doPrestige: doPrestige,
    PRESTIGE_BASE: PRESTIGE_BASE,
    offlineCapSeconds: offlineCapSeconds,
    offlineEfficiency: offlineEfficiency,
    offlineReward: offlineReward,
    claimOffline: claimOffline,
    tick: tick,
    checkAchievements: checkAchievements,
    hasAffordableUpgrade: hasAffordableUpgrade,
    hasAffordableFame: hasAffordableFame
  };
})();
