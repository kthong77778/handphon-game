/* 노드에서 게임 로직만 떼어 돌리기 위한 공용 로더.
   브라우저 없이 format/data/state/game 을 그대로 실행한다. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** localStorage 흉내 */
function fakeStorage() {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
}

/**
 * 게임 모듈을 새 컨텍스트에 올려 돌려준다.
 * @param {string[]} [files] 올릴 파일 (기본: 브라우저가 필요 없는 것들)
 */
function load(files) {
  files = files || ['format', 'data', 'state', 'game'];
  const ctx = {
    console, Date, Math, JSON, isFinite, Number, Object, Array, String, parseInt,
    navigator: {},
    localStorage: fakeStorage(),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    unescape, escape
  };
  vm.createContext(ctx);
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', `${f}.js`), 'utf8');
    vm.runInContext(src, ctx, { filename: `${f}.js` });
  }
  return ctx;
}

/** 통과/실패를 세는 간단한 리포터 */
function reporter() {
  let fails = 0;
  return {
    ok(cond, label, extra) {
      if (!cond) { fails++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
      else console.log('  ✓ ' + label + (extra ? '  → ' + extra : ''));
    },
    section(name) { console.log('\n' + name); },
    finish() {
      console.log(fails === 0 ? '\n전부 통과 ✅' : `\n실패 ${fails}건 ❌`);
      process.exit(fails ? 1 : 0);
    },
    get fails() { return fails; }
  };
}

/** 부동소수 비교 */
function near(a, b, tol = 1e-9) {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * 가성비가 가장 좋은 설비·업그레이드를 자동으로 사들인다.
 * 진행 시뮬레이션에서 "실제로 플레이하면 이쯤" 을 재는 데 쓴다.
 */
function autoBuy(Data, State, Game) {
  for (let guard = 0; guard < 200; guard++) {
    const up = Game.availableUpgrades().find(u => u.cost <= State.get().money);
    if (up) { Game.buyUpgrade(up.id); continue; }

    let best = null, bestScore = Infinity;
    Data.GENERATORS.forEach(g => {
      if (!Game.genUnlocked(g.id)) return;
      const cost = Game.genCost(g.id, 1);
      if (cost > State.get().money) return;
      const score = cost / (g.rate || 1e-9);
      if (score < bestScore) { bestScore = score; best = g.id; }
    });
    if (!best) return;
    Game.buyGen(best, 1);
  }
}

/** 사람처럼 간격이 흔들리는 탭 (매크로 방지에 걸리지 않는다) */
function humanTap(Game, atMs) {
  return Game.tap(true, atMs, 100 + Math.random() * 14, 100 + Math.random() * 14);
}

module.exports = { ROOT, load, reporter, near, autoBuy, humanTap, fakeStorage };
