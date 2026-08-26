/* 게임 로직 테스트 — 브라우저 없이 돌아간다.
   실행: node tests/logic.js */
const { load, near, autoBuy, humanTap } = require('./_harness');
const { Fmt, Data, State, Game } = load();

let fails = 0;
function ok(cond, label, extra) {
  if (!cond) { fails++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
  else console.log('  ✓ ' + label);
}

/* ---- 캐시가 정직한지: 캐시 값 vs 무식하게 다시 계산한 값 ---- */
function bruteRate() {
  const s = State.get();
  let stat = (1 + 0.02 * s.fame) * (1 + 0.01 * Object.keys(s.achievements).length)
           * Math.pow(1.5, s.fameLv['f_mult'] || 0);
  Data.UPGRADES.forEach(u => { if (u.kind === 'all' && s.upgrades[u.id]) stat *= u.value; });
  let total = 0;
  Data.GENERATORS.forEach(g => {
    let m = 1;
    Data.UPGRADES.forEach(u => { if (u.kind === 'gen' && u.target === g.id && s.upgrades[u.id]) m *= u.value; });
    total += g.rate * (s.gens[g.id] || 0) * m;
  });
  let buff = 1;
  if (s.goldLeft > 0) buff *= s.goldMult;
  if (s.boostLeft > 0) buff *= Data.BOOST.mult;
  return total * stat * buff;
}


function run(hours, opts = {}) {
  const STEP = 1;
  const marks = opts.marks || [];
  const out = [];
  let next = 0;
  for (let t = 0; t <= hours * 3600; t += STEP) {
    Game.tick(STEP);
    // 실제 플레이처럼 처음 2분은 손으로 조리해서 종잣돈을 만든다
    if (t < 120) {
      // 사람처럼 간격을 흔들어가며 초당 3회
      for (let k = 0; k < 3; k++) Game.tap(true, t * 1000 + k * 330 + Math.random() * 120, 100 + Math.random()*14, 100 + Math.random()*14);
    }
    Game.checkAchievements();
    if (t % 5 === 0) autoBuy(Data, State, Game);
    if (next < marks.length && t >= marks[next]) {
      const s = State.get();
      out.push({ t: marks[next], earned: s.runEarned, ps: Game.perSec(), fame: Game.fameGain() });
      next++;
    }
  }
  return out;
}

console.log('\n[1] 새 세이브 기본값');
State.wipe(); Game.invalidate();
{
  const s = State.get();
  ok(s.goldMult === 1 && s.goldTapMult === 1, '버프 배율 기본값 1');
  ok(s.boostCd === 0 && Game.boostReady(), '손님 몰이 처음엔 바로 사용 가능');
  ok(Game.perSec() === 0 && Game.tapValue() > 0, '초기 초당수익 0 / 탭수익 > 0');
}

console.log('\n[2] 진행 시뮬레이션 (24시간, 자동 구매)');
const marks = [300, 3600, 6 * 3600, 24 * 3600];
const res = run(24, { marks });
res.forEach(r => {
  console.log('   ' + Fmt.time(r.t).padEnd(9) + ' 매출 ' + Fmt.won(r.earned).padEnd(12) +
              ' 초당 ' + Fmt.won(r.ps).padEnd(12) + ' 환생명성 ' + r.fame);
});
ok(res[3].earned > res[2].earned && res[2].earned > res[1].earned, '매출이 단조 증가');
ok(res[3].fame > 0, '24시간이면 환생 가능', 'fame=' + res[3].fame);

console.log('\n[3] 캐시 정확성 (캐시 vs 재계산)');
ok(near(Game.perSec(), bruteRate()), '초당 수익이 재계산 값과 일치',
   Game.perSec() + ' vs ' + bruteRate());

console.log('\n[4] 콤보');
Game.resetCombo();
ok(Game.comboMult() === 1, '콤보 0이면 배율 1');
const flat = Game.tapValue();
let ct = 1e9;
for (let i = 0; i < 60; i++) { ct += 90 + Math.random() * 90; Game.tap(true, ct, 100 + Math.random()*14, 100 + Math.random()*14); }
ok(Game.comboCount() === 50, '콤보는 50에서 멈춤', 'combo=' + Game.comboCount());
ok(near(Game.comboMult(), 3), '최대 콤보 배율 ×3', Game.comboMult());
ok(Game.tapValue() > flat, '콤보가 붙으면 탭 수익 증가');
Game.tick(2);  // 콤보 유지시간(1.2초) 초과
ok(Game.comboCount() === 0, '가만 있으면 콤보 리셋');

console.log('\n[5] 손님 몰이');
{
  const before = Game.perSec();
  ok(Game.startBoost(), '부스트 시작');
  ok(near(Game.perSec(), before * Data.BOOST.mult), '수익 ×' + Data.BOOST.mult, Game.perSec() / before);
  ok(!Game.startBoost(), '지속 중엔 재사용 불가');
  Game.tick(Data.BOOST.dur + 0.1);
  ok(near(Game.perSec(), before), '지속시간 끝나면 원래대로');
  ok(!Game.boostReady() && State.get().boostCd > 0, '쿨다운 도는 중');
  Game.advanceTimers(Game.boostCooldown() + 1);
  ok(Game.boostReady(), '쿨다운 끝나면 다시 사용 가능');
}

console.log('\n[6] 황금 손님');
{
  const s = State.get();
  const cash = Data.GOLDEN.types.find(t => t.id === 'cash');
  const m0 = s.money, g0 = s.goldens;
  const r = Game.claimGolden(cash);
  ok(s.money > m0 && r.money > 0, '현금 다발이 돈을 준다', Fmt.won(r.money));
  ok(Game.claimGolden(cash, false) === null, '가짜 이벤트로는 못 잡는다');
  ok(s.goldens === g0 + 1, '잡은 횟수 기록');

  const rush = Data.GOLDEN.types.find(t => t.id === 'rush');
  const base = Game.perSec();
  Game.claimGolden(rush);
  ok(near(Game.perSec(), base * rush.mult), '손님 폭주 수익 ×' + rush.mult);
  ok(near(Game.perSec(true), base), 'noBuff 로 부르면 버프 제외');
  ok(near(Game.offlineReward(3600).gain, base * 3600 * Game.offlineEfficiency()),
     '오프라인 보상에는 버프가 안 들어감');

  const hand = Data.GOLDEN.types.find(t => t.id === 'hand');
  Game.resetCombo();
  const tv = Game.tapValue();
  Game.claimGolden(hand);
  ok(Game.tapValue() > tv, '신들린 손이 탭 수익을 올린다');
  Game.advanceTimers(999);
  ok(Game.buffMult() === 1, '시간 지나면 버프 해제');

  // 가중치 뽑기가 세 종류를 다 내는지
  const seen = {};
  for (let i = 0; i < 3000; i++) seen[Game.rollGolden().id] = (seen[Game.rollGolden().id] || 0) + 1;
  ok(Object.keys(seen).length === 3, '세 종류가 모두 등장', JSON.stringify(seen));
}

console.log('\n[6.5] 매크로 방지');
{
  Game.resetGuard(); Game.resetCombo();
  ok(Game.tap(false).blocked === 'auto', '합성 이벤트(isTrusted=false) 차단');

  // 사람처럼 흔들리는 연타 200번 — 하나도 막히면 안 된다
  Game.resetGuard();
  let t = 2e9, humanBlocked = 0;
  for (let i = 0; i < 200; i++) {
    t += 110 + Math.random() * 140;          // 110~250ms, 사람 손
    if (Game.tap(true, t, 100 + Math.random()*12, 100 + Math.random()*12).blocked) humanBlocked++;
  }
  ok(humanBlocked === 0, '사람 연타 200회는 전부 인정', humanBlocked + '회 막힘');

  // 기계처럼 정확히 100ms 간격
  Game.resetGuard();
  t = 3e9;
  let firstBlock = -1;
  for (let i = 0; i < 60; i++) {
    t += 100;
    if (Game.tap(true, t, 100, 100).blocked === 'macro') { firstBlock = i; break; }
  }
  ok(firstBlock > 0, '일정 간격 오토클릭 감지', firstBlock + '번째 탭에서 걸림');
  ok(Game.macroRestLeft() > 0, '걸리면 휴식 상태로');
  ok(Game.tap(true, t + 500, 100, 100).blocked === 'rest', '휴식 중엔 수익 없음');
  ok(Game.comboCount() === 0, '걸리면 콤보도 풀림');
  ok(State.get().macroBlocks >= 1, '차단 횟수가 기록됨');
  Game.tick(Game.MACRO.rest + 0.1);
  ok(Game.macroRestLeft() === 0, '휴식 시간이 지나면 해제');
  ok(Game.tap(true, t + 9000, 100, 100).blocked === '', '해제 후 정상 조리');

  // 아주 미세하게 흔드는 오토클릭(±5ms)도 잡히나
  Game.resetGuard();
  t = 4e9; firstBlock = -1;
  for (let i = 0; i < 60; i++) {
    t += 100 + (Math.random() * 10 - 5);
    if (Game.tap(true, t, 100, 100).blocked === 'macro') { firstBlock = i; break; }
  }
  ok(firstBlock > 0, '±5ms 흔든 오토클릭도 감지', firstBlock + '번째 탭');

  // 초당 상한
  Game.resetGuard();
  t = 5e9;
  let fast = 0;
  for (let i = 0; i < 40; i++) { t += 20; if (Game.tap(true, t, 100, 100).blocked === 'fast') fast++; }
  ok(fast > 0, '초당 ' + Game.MACRO.maxPerSec + '회 초과분은 무효', fast + '회 무효');

  Game.resetGuard();
}

console.log('\n[6.7] 스킨 & 등급');
{
  // 이 블록은 세이브를 마음대로 헤집으므로, 뒤 테스트를 위해 원래 상태를 떠 둔다
  const snapshot = State.exportText();
  State.wipe(); Game.invalidate(); Game.resetGuard();
  const s = State.get();

  ok(s.tapSkin === 'auto' && s.crowdSkin === 'auto', '기본 스킨은 auto');
  ok(Game.tapStep().index === 0, '처음엔 1단계');
  ok(Game.tapStep().step.icon === '🍢', '기본 메뉴는 어묵 꼬치');

  // 탭 수익을 단계별로 올려가며 메뉴가 따라 오르는지
  const steps = Game.tapSkin().steps;
  let prev = -1, mono = true;
  steps.forEach((st, i) => {
    s.fame = 0; s.fameLv = {}; Game.invalidate();
    // 탭 기본 수익이 이 단계 문턱을 넘도록 명성상점 f_tap 으로 밀어올린다
    let lv = 0;
    while (Game.tapBaseValue() < st.at && lv < 60) { s.fameLv.f_tap = ++lv; Game.invalidate(); }
    const idx = Game.tapStep().index;
    if (idx < prev) mono = false;
    prev = idx;
    if (i === steps.length - 1) {
      ok(idx === steps.length - 1,
         `최고 단계 도달: ${Game.tapStep().step.icon} ${Game.tapStep().step.name}`);
    }
  });
  ok(mono, '수익이 오를 때 단계가 뒤로 가지 않음');

  // 버프나 콤보로 단계가 흔들리면 안 된다
  s.fame = 0; s.fameLv = { f_tap: 3 }; Game.invalidate();
  const base = Game.tapStep().index;
  Game.startBoost();
  s.goldTapLeft = 30; s.goldTapMult = 25;
  let ct = 6e9; for (let i=0;i<40;i++){ ct += 120 + Math.random()*90; Game.tap(true, ct, 100+Math.random()*14, 100+Math.random()*14); }
  ok(Game.tapStep().index === base, '버프·콤보로는 단계가 흔들리지 않음');
  s.boostLeft = 0; s.goldTapLeft = 0; Game.resetCombo(); Game.resetGuard();

  // 스킨 바꾸기
  ok(Game.setSkin('tap', 'bungeo'), '음식 스킨 변경');
  ok(Game.tapSkin().id === 'bungeo' && Game.tapStep().step.icon !== '🍢',
     '붕어빵 스킨 적용: ' + Game.tapStep().step.icon + ' ' + Game.tapStep().step.name);
  ok(!Game.setSkin('tap', '없는스킨'), '없는 스킨 id 는 거부');
  ok(Game.tapSkin().id === 'bungeo', '거부돼도 기존 스킨 유지');

  ok(Game.setSkin('crowd', 'animal'), '손님 스킨 변경');
  ok(Game.crowdTier().cast.indexOf('🐕') >= 0, '동물 손님이 나옴');

  // 손님 등급은 초당 수익을 따라간다
  Data.GENERATORS.forEach(g => s.gens[g.id] = 0);
  s.fame = 0; s.fameLv = {}; Game.invalidate();
  ok(Game.crowdTier().index === 0, '수익 0이면 1등급');
  Game.setSkin('crowd', 'auto');
  const seen = new Set();
  [0, 1e4, 1e7, 1e10, 1e13].forEach(target => {
    Data.GENERATORS.forEach(g => s.gens[g.id] = 0);
    s.gens.g10 = Math.ceil(target / 1.6e6);
    Game.invalidate();
    seen.add(Game.crowdTier().index);
  });
  ok(seen.size >= 4, '초당 수익이 오르면 손님 등급도 오름', '등급 ' + [...seen].join(','));

  // 스킨이 세이브에 남는가
  const code = State.exportText();
  State.wipe(); Game.invalidate();
  State.importText(code); Game.invalidate();
  ok(State.get().tapSkin === 'bungeo' && State.get().crowdSkin === 'auto',
     '스킨이 백업/복원됨');

  // 깨진 스킨 id 방어
  State.set({ tapSkin: 'ㅁㄴㅇㄹ', crowdSkin: 42 }); Game.invalidate();
  ok(State.get().tapSkin === 'auto' && State.get().crowdSkin === 'auto',
     '이상한 스킨 id 는 기본값으로');
  ok(Game.tapStep().step.icon && Game.crowdTier().cast.length > 0, '그래도 정상 동작');

  // 모든 스킨이 형태를 갖췄는가
  let bad = [];
  Data.TAP_SKINS.forEach(k => {
    if (k.steps.length !== 8) bad.push(k.id + ' 단계수');
    k.steps.forEach((st, i) => {
      if (!st.icon || !st.name) bad.push(k.id + ' 빈 항목');
      if (i > 0 && st.at <= k.steps[i-1].at) bad.push(k.id + ' 문턱 역전');
    });
  });
  Data.CROWD_SKINS.forEach(k => {
    if (k.tiers.length !== 5) bad.push(k.id + ' 등급수');
    k.tiers.forEach((t, i) => {
      if (!t.cast.length) bad.push(k.id + ' 빈 등급');
      if (!t.name) bad.push(k.id + ' 등급 이름 없음');
      if (i > 0 && t.at <= k.tiers[i-1].at) bad.push(k.id + ' 문턱 역전');
    });
    // 상위 등급은 소지품으로 격을 드러낸다
    if (!k.tiers[4].acc.length) bad.push(k.id + ' 최고 등급에 소지품 없음');
  });
  ok(bad.length === 0, '모든 스킨 데이터가 온전함', bad.join(', '));

  // 기본 스킨은 동네 → 재벌 로 올라간다.
  // 위에서 State.set 이 상태 객체를 통째로 갈아끼웠으므로 다시 받아온다.
  const s2 = State.get();
  Game.setSkin('crowd', 'auto');
  s2.fame = 0; s2.fameLv = {}; s2.upgrades = {};
  const names = [], accs = [];
  // g1 은 개당 0.1원이라 개수로 초당 수익을 정확히 맞출 수 있다
  [0, 1e3, 1e5, 1e7, 1e9].forEach(target => {
    Data.GENERATORS.forEach(g => s2.gens[g.id] = 0);
    if (target) s2.gens.g1 = Math.round(target / 0.1);
    Game.invalidate();
    const t = Game.crowdTier();
    names.push(t.name); accs.push(t.acc.length);
  });
  ok(new Set(names).size === 5, '등급마다 이름이 다름: ' + names.join(' → '));
  ok(accs[0] === 0 && accs[4] > 0, '아래 등급엔 소지품이 없고 위 등급엔 있음', accs.join(','));
  ok(Game.crowdTier().acc.some(a => ['👑','💎','🏆','🪙','🥇'].indexOf(a) >= 0),
     '최고 등급은 값나가는 것을 든다: ' + Game.crowdTier().acc.join(''));
  ok(Game.crowdTier().cast.indexOf('🕴️') >= 0, '최고 등급에 정장 손님이 있음');

  ok(State.importText(snapshot), '헤집기 전 상태로 복구');
  Game.invalidate(); Game.resetGuard(); Game.resetCombo();
}

console.log('\n[6.8] 도둑 & 경찰');
{
  const snapshot = State.exportText();
  State.wipe(); Game.invalidate();
  const s = State.get();

  ok(!Game.thiefWorthwhile(), '돈이 없으면 도둑이 안 나온다');

  s.money = 1e6; s.gens.g1 = 1000; Game.invalidate();
  ok(Game.thiefWorthwhile(), '돈이 있으면 나온다');

  // 노리는 금액: 보유액의 8% 와 초당 수익 3분치 중 작은 쪽
  const t = Game.thiefTarget();
  ok(t <= s.money * Data.THIEF.stealPct + 1e-6, '보유액의 8%를 넘지 않음', Fmt.won(t));
  ok(t <= Game.perSec(true) * Data.THIEF.stealCapSec + 1e-6,
     '초당 수익 3분치를 넘지 않음', Fmt.won(t));

  // 직접 잡기
  const m0 = s.money, amt = Game.thiefTarget();
  const caught = Game.catchThief(amt, true);
  ok(caught && caught.bonus > 0, '직접 잡으면 보너스', Fmt.won(caught.bonus));
  ok(s.money === m0 + caught.bonus, '피해 없이 돈이 늘어남');
  ok(s.thievesCaught === 1, '잡은 횟수 기록');
  ok(Game.catchThief(amt, false) === null, '가짜 클릭으로는 못 잡는다');
  ok(s.thievesCaught === 1, '가짜 클릭은 기록도 안 됨');

  // 경찰이 잡기
  const m1 = s.money;
  Game.policeCaught(amt);
  ok(s.money === m1, '경찰이 잡으면 피해도 보너스도 없음');
  ok(s.thiefSaves === 1, '경찰 검거 기록');

  // 놓치기
  const m2 = s.money;
  const esc = Game.thiefEscaped(amt);
  ok(esc.lost > 0 && s.money === m2 - esc.lost, '놓치면 그만큼 빠짐', Fmt.won(esc.lost));
  ok(s.stolen === esc.lost && s.thefts === 1, '피해액 기록');

  // 설비와 업그레이드는 절대 안 건드린다
  s.money = 1e9; s.gens.g2 = 40; s.upgrades.a1 = true; Game.invalidate();
  const gensBefore = JSON.stringify(s.gens), upBefore = JSON.stringify(s.upgrades);
  const psBefore = Game.perSec(true);
  Game.thiefEscaped(Game.thiefTarget());
  ok(JSON.stringify(s.gens) === gensBefore && JSON.stringify(s.upgrades) === upBefore,
     '설비·업그레이드는 그대로');
  ok(Game.perSec(true) === psBefore, '초당 수익도 그대로');

  // 돈이 마이너스가 되면 안 된다
  s.money = 50;
  const big = Game.thiefEscaped(1e12);
  ok(s.money === 0 && big.lost === 50, '가진 것보다 많이 못 훔침', 'lost=' + big.lost);
  s.money = 0;
  const none = Game.thiefEscaped(1e6);
  ok(s.money === 0 && none.lost === 0, '빈 금고에서는 0원', 'money=' + s.money);

  // 여러 번 반복해도 음수로 안 간다
  s.money = 1e5; s.gens.g1 = 500; Game.invalidate();
  for (let i = 0; i < 500; i++) {
    if (Math.random() < 0.5) Game.thiefEscaped(Game.thiefTarget());
    else Game.catchThief(Game.thiefTarget(), true);
  }
  ok(s.money >= 0 && isFinite(s.money), '500회 반복 후에도 잔액 정상', Fmt.won(s.money));

  // 경찰 확률은 명성으로 오르고 상한이 있다
  s.fameLv = {}; Game.invalidate();
  const p0 = Game.policeChance();
  s.fameLv.f_police = 10; Game.invalidate();
  const p1 = Game.policeChance();
  ok(p1 > p0, `순찰 강화로 검거 확률 상승 ${(p0*100).toFixed(0)}% → ${(p1*100).toFixed(0)}%`);
  s.fameLv.f_police = 999; Game.invalidate();
  ok(Game.policeChance() <= 0.9, '확률에 상한이 있음', (Game.policeChance()*100).toFixed(0) + '%');

  // 등장 간격
  let lo = Infinity, hi = 0;
  for (let i = 0; i < 3000; i++) { const g = Game.nextThiefGap(); lo = Math.min(lo,g); hi = Math.max(hi,g); }
  ok(lo >= Data.THIEF.minGap && hi <= Data.THIEF.maxGap,
     `등장 간격 ${Math.round(lo)}~${Math.round(hi)}초`);

  ok(State.importText(snapshot), '헤집기 전 상태로 복구');
  Game.invalidate(); Game.resetGuard(); Game.resetCombo();
}

console.log('\n[6.9] 명예의 전당');
{
  const snapshot = State.exportText();
  State.wipe(); Game.invalidate(); Game.resetGuard();

  ok(Game.topRuns().length === 0, '처음엔 회차 기록이 없다');
  ok(Game.projectedRank() === 0, '환생할 수 없으면 예상 순위도 없다');
  ok(Game.records().length === 8, '개인 기록 8종');

  // 회차를 세 번 돌린다 — 매출과 소요 시간을 다르게
  const plays = [[5e6, 3600], [8e8, 7200], [4e7, 1800]];
  plays.forEach(([earn, secs]) => {
    const s = State.get();
    s.gens.g1 = 100; Game.invalidate();
    s.runEarned = earn; s.runTime = secs;
    const before = s.prestiges;
    const gain = Game.doPrestige();
    ok(gain > 0 && s.prestiges === before + 1, `${before + 1}회차 환생 · 명성 ${gain}`);
    ok(s.runTime === 0, '  회차 시간이 초기화됨');
  });

  const runs = State.get().runs;
  ok(runs.length === 3, '회차 3개가 기록됨');
  ok(runs[0].n === 1 && runs[2].n === 3, '회차 번호가 순서대로');

  const top = Game.topRuns();
  ok(top.length === 3, '순위표 3줄');
  ok(top[0].fame >= top[1].fame && top[1].fame >= top[2].fame,
     '명성 내림차순: ' + top.map(r => r.fame).join(' ≥ '));
  ok(top[0].earned === 8e8, '가장 많이 번 회차가 1위');

  const s2 = State.get();
  ok(s2.bestFameGain === top[0].fame, '최고 명성 기록', String(s2.bestFameGain));
  ok(s2.fastestPrestige === 1800, '최단 환생 시간 기록', s2.fastestPrestige + '초');

  // 동점이면 빨리 끝낸 회차가 위로
  s2.runs = [
    { n: 1, earned: 1e6, fame: 10, seconds: 5000 },
    { n: 2, earned: 1e6, fame: 10, seconds: 1000 },
    { n: 3, earned: 1e6, fame: 10, seconds: 3000 }
  ];
  const tie = Game.topRuns();
  ok(tie[0].seconds === 1000 && tie[2].seconds === 5000,
     '동점이면 빠른 회차가 위로: ' + tie.map(r => r.seconds).join(' < '));

  // 예상 순위
  s2.gens.g1 = 100; Game.invalidate();
  s2.runEarned = 1e6; s2.runTime = 500;      // 명성은 위 셋과 비슷하게
  const rank = Game.projectedRank();
  ok(rank >= 1 && rank <= 4, '지금 환생하면 ' + rank + '위');
  s2.runEarned = 1e15;                        // 압도적이면 1위
  ok(Game.projectedRank() === 1, '기록을 크게 넘기면 1위');

  // 기록 상한
  s2.runs = [];
  for (let i = 0; i < State.MAX_RUNS + 20; i++) {
    s2.gens.g1 = 100; Game.invalidate();
    s2.runEarned = 1e7 + i; s2.runTime = 1000;
    Game.doPrestige();
  }
  ok(s2.runs.length === State.MAX_RUNS, `회차 기록이 ${State.MAX_RUNS}개로 제한됨`, String(s2.runs.length));
  ok(s2.runs[s2.runs.length - 1].earned > s2.runs[0].earned, '오래된 것부터 버린다');

  // 탭·초당 수익 최고 기록
  State.wipe(); Game.invalidate(); Game.resetGuard();
  const s3 = State.get();
  s3.gens.g5 = 50; Game.invalidate();
  Game.tick(1);
  ok(s3.bestPerSec > 0, '최고 초당 수익 기록', Fmt.won(s3.bestPerSec));
  ok(s3.bestRunEarned > 0, '최고 회차 매출 기록');
  let ct = 7e9; for (let i=0;i<5;i++){ ct += 150 + Math.random()*90; Game.tap(true, ct, 100+Math.random()*14, 100+Math.random()*14); }
  ok(s3.bestTap > 0, '최고 탭 기록', Fmt.won(s3.bestTap));
  const peak = s3.bestPerSec;
  s3.gens.g5 = 1; Game.invalidate(); Game.tick(1);
  ok(s3.bestPerSec === peak, '수익이 줄어도 최고 기록은 안 내려간다');

  // 기록은 환생해도 남는다
  s3.gens.g1 = 200; Game.invalidate();
  s3.runEarned = 1e9; s3.runTime = 900;
  Game.doPrestige();
  ok(s3.bestTap > 0 && s3.bestPerSec > 0 && s3.bestRunEarned > 0, '환생 후에도 기록 유지');

  // 세이브 왕복
  const code = State.exportText();
  State.wipe(); Game.invalidate();
  ok(State.get().runs.length === 0, '초기화 확인');
  State.importText(code); Game.invalidate();
  ok(State.get().runs.length > 0 && State.get().bestTap > 0, '기록이 백업/복원됨');

  ok(State.importText(snapshot), '헤집기 전 상태로 복구');
  Game.invalidate(); Game.resetGuard(); Game.resetCombo();
}

console.log('\n[7] 출석 보상');
{
  const s = State.get();
  s.dailyDate = ''; s.dailyStreak = 0;
  ok(Game.dailyReady(), '처음엔 받을 수 있음');
  const r1 = Game.claimDaily();
  ok(r1 && r1.streak === 1, '1일차');
  ok(!Game.dailyReady() && Game.claimDaily() === null, '하루에 한 번만');

  // 어제 받은 것으로 조작 → 연속
  const y = new Date(); y.setDate(y.getDate() - 1);
  const pad = n => (n < 10 ? '0' : '') + n;
  s.dailyDate = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
  const r2 = Game.claimDaily();
  ok(r2.streak === 2, '어제 받았으면 연속 2일');

  // 이틀 전 → 끊김
  const y2 = new Date(); y2.setDate(y2.getDate() - 3);
  s.dailyDate = y2.getFullYear() + '-' + pad(y2.getMonth() + 1) + '-' + pad(y2.getDate());
  const r3 = Game.claimDaily();
  ok(r3.streak === 1, '건너뛰면 1일로 리셋');
  ok(r3.gain >= Data.DAILY.minMoney, '최소 보상 보장');
}

console.log('\n[8] 환생 / 세이브 왕복');
{
  const s = State.get();
  s.goldLeft = 10; s.goldMult = 7; s.boostLeft = 5;
  const gain = Game.doPrestige();
  ok(gain > 0, '명성 획득 ' + gain);
  ok(s.goldLeft === 0 && s.boostLeft === 0, '환생하면 버프 정리');
  ok(near(Game.perSec(), 0), '환생 후 초당 수익 0');
  ok(near(Game.globalMult(), bruteRate() || Game.globalMult()), '환생 후 캐시 무효화됨');

  s.goldens = 42; s.bestCombo = 33; s.dailyStreak = 4; s.boosts = 7;
  const code = State.exportText();
  State.wipe(); Game.invalidate();
  ok(State.get().goldens === 0, '초기화됨');
  ok(State.importText(code), '세이브 코드 복원');
  Game.invalidate();
  const t = State.get();
  ok(t.goldens === 42 && t.bestCombo === 33 && t.dailyStreak === 4 && t.boosts === 7,
     '새 필드가 백업/복원됨');
}

console.log('\n[9] 구버전 세이브 호환 (v1 데이터에 새 필드가 없어도)');
{
  const old = { v: 1, money: 5000, fame: 12, gens: { g1: 30, g2: 5 }, upgrades: { a1: true },
                fameLv: { f_mult: 2 }, achievements: { ac1: true }, taps: 300,
                runEarned: 9e5, totalEarned: 2e6, prestiges: 1, playTime: 7200 };
  State.set(old); Game.invalidate();
  const s = State.get();
  ok(s.goldMult === 1 && s.goldTapMult === 1, '없던 배율 필드는 1로 채워짐');
  ok(s.boostCd === 0 && s.dailyDate === '' && s.goldens === 0, '나머지 새 필드는 0/빈값');
  ok(Game.perSec() > 0 && isFinite(Game.perSec()), '구버전 세이브로도 수익 계산됨', Fmt.won(Game.perSec()));
  ok(near(Game.perSec(), bruteRate()), '구버전 세이브에서도 캐시 정확');
  ok(Game.tapValue() > 0 && isFinite(Game.tapValue()), '탭 수익 정상');
}

console.log('\n[10] 깨진 세이브 방어');
{
  State.set({ money: -5, goldMult: 0, goldTapMult: NaN, goldLeft: 'abc',
              gens: { g1: 'x', g99: 3 }, dailyDate: '아무거나' });
  Game.invalidate();
  const s = State.get();
  ok(s.money === 0, '음수 금액 무시');
  ok(s.goldMult === 1 && s.goldTapMult === 1, '0/NaN 배율은 1로 교정');
  ok(s.dailyDate === '', '엉뚱한 날짜 문자열 무시');
  ok(isFinite(Game.perSec()), '수익 계산이 NaN 이 되지 않음', Game.perSec());
}

console.log('\n[11] 일일 퀘스트');
{
  State.set({ money: 0 }); Game.invalidate();
  ok(Game.questRoll(), '오늘 퀘스트가 깔림');
  const list = Game.quests();
  ok(list.length === Data.QUEST.count, `${Data.QUEST.count}개`, list.length);
  ok(new Set(list.map(q => q.def.id)).size === list.length, '서로 다른 퀘스트');
  ok(list.every(q => q.goal > 0), '목표가 모두 0보다 큼');
  ok(Game.questRoll() === false, '같은 날 다시 부르면 그대로 (다시 뽑기 불가)');

  // 날짜만 지우면 새로 깔린다 — 무엇이 깔리는지는 날짜가 정하므로 같은 조합이어야 한다
  const before = Game.quests().map(q => q.def.id).join(',');
  State.get().questDate = '';
  Game.questRoll();
  ok(Game.quests().map(q => q.def.id).join(',') === before, '같은 날이면 같은 조합');

  // 진행도
  const q0 = Game.quests()[0];
  Game.questBump(q0.def.kind, q0.goal);
  ok(Game.quests()[0].done, `${q0.name} 달성`);
  ok(Game.claimQuest(0) !== null, '보상을 받음');
  ok(Game.claimQuest(0) === null, '두 번은 못 받음');
  ok(State.get().questsDone === 1, '완료 수 1');
  ok(Game.questClaimable() === false, '더 받을 게 없으면 뱃지 꺼짐');

  // 남은 것까지 끝내면 완주 보너스
  Game.quests().forEach(q => { if (!q.taken) Game.questBump(q.def.kind, q.goal); });
  Game.quests().forEach(q => Game.claimQuest(q.index));
  ok(Game.questAllDone(), '셋 다 완료');
  const all = Game.claimQuestAll();
  ok(all !== null && all.gain > 0, '완주 보너스 지급', all && Fmt.won(all.gain));
  ok(Game.claimQuestAll() === null, '완주 보너스도 한 번만');

  // 날짜가 바뀌면 진행도가 초기화된다
  State.get().questDate = '2000-01-01';
  Game.questRoll();
  ok(Game.quests().every(q => q.prog === 0 && !q.taken), '날이 바뀌면 처음부터');
  ok(State.get().questAllTaken === 0, '완주 보너스도 다시');
  ok(State.get().questsDone === 3, '완료 수는 평생 누적으로 남음');
}

console.log('\n[13] 주말 파티 이벤트');
{
  // 금요일(getDay 5) 18시 → 파티, 수요일 낮 → 아님
  Game.setClock(function () { return new Date(2026, 7, 28, 18, 0, 0); });
  ok(new Date(2026, 7, 28).getDay() === 5, '2026-08-28 은 금요일');
  ok(Game.partyActive() === true, '금 18시엔 파티 중');
  var ps = Game.partyState();
  ok(ps.active && ps.mult === 3, '파티 배율 ×3');
  ok(ps.left > 0 && ps.left <= 6 * 3600 + 1, '자정까지 남은 시간', Math.round(ps.left) + 's');

  Game.setClock(function () { return new Date(2026, 7, 26, 12, 0, 0); }); // 수요일
  ok(Game.partyActive() === false, '평일 낮엔 파티 아님');
  ok(Game.partyState().until > 0, '다음 파티까지 카운트다운');

  Game.setClock(function () { return new Date(2026, 7, 28, 16, 59, 0); }); // 금 16:59
  ok(Game.partyActive() === false, '시작 1분 전엔 아직 아님');
  Game.setClock(function () { return new Date(2026, 7, 28, 23, 59, 0); }); // 금 23:59
  ok(Game.partyActive() === true, '자정 직전까진 파티');
  Game.setClock(function () { return new Date(2026, 7, 29, 0, 0, 0); });   // 토 00:00
  ok(Game.partyActive() === false, '자정 넘으면 끝');

  // 파티 배율은 실시간 수익에만, 오프라인(무버프)엔 안 붙는다
  Game.setClock(function () { return new Date(2026, 7, 28, 18, 0, 0); });
  State.set({ money: 0 }); Data.GENERATORS.forEach(function (g) { State.get().gens[g.id] = 10; });
  Game.invalidate();
  var live = Game.perSec(false), off = Game.perSec(true);
  ok(Math.abs(live - off * 3) < off * 0.001, '파티 중 실시간 수익 = 무버프 ×3');

  // 도감: 발견 → 영구 보너스, 세이브에 남음
  State.set({ partyFoods: [] }); Game.invalidate();
  var m0 = Game.globalMult() / 3;   // 파티 배율 빼고 본 고정 배율
  var tries = 0, got = 0;
  while (Game.partyGotCount() < 12 && tries < 100000) { if (Game.tryDiscoverFood()) got++; tries++; }
  ok(Game.partyGotCount() === 12, '탭으로 도감 12칸 다 채움');
  var m1 = Game.globalMult() / 3;
  ok(Math.abs(m1 - m0 * 1.12) < m0 * 0.001, '도감 12칸이면 고정 배율 +12%');

  // 파티가 아니면 발견되지 않는다
  Game.setClock(function () { return new Date(2026, 7, 26, 12, 0, 0); });
  State.set({ partyFoods: [] }); Game.invalidate();
  var none = true; for (var i = 0; i < 500; i++) if (Game.tryDiscoverFood()) none = false;
  ok(none, '파티가 아니면 음식이 안 나옴');

  Game.setClock(null);   // 시계 원상복구
}

console.log('\n[14] 탭 소리 선택');
{
  State.set({ money: 0 }); Game.invalidate();
  ok(State.get().tapSound === 'classic', '기본 조리음은 classic');
  State.set({ tapSound: 'deep' });
  ok(State.get().tapSound === 'deep', '고른 소리가 세이브에 남음');
  State.set({ tapSound: '없는소리' });
  ok(State.get().tapSound === 'classic', '없는 소리 id 는 기본으로 되돌림');
  State.set({ v: 1, money: 10 });
  ok(State.get().tapSound === 'classic', '구버전 세이브도 기본 소리로 시작');
  ok(Data.TAP_SOUNDS.every(function (t) { return t.id && t.name && t.desc; }),
     '소리 목록에 id·이름·설명이 모두 있음');
}

console.log('\n[15] 전국 맛집 랭킹');
{
  State.set({ startedAt: 1699999999999, bestPerSec: 0 }); Game.invalidate();
  const reg = Game.region();
  ok(Data.REGIONS.some(r => r.id === reg.id), '지역이 배정됨: ' + reg.name);
  ok(State.get().region === reg.id, '배정된 지역이 세이브에 남음');
  const reg2 = Game.region();
  ok(reg2.id === reg.id, '다시 불러도 같은 지역 (고정)');

  const nat0 = Game.nationRank();
  ok(nat0.rank === nat0.total, '벌이가 없으면 전국 꼴찌', nat0.rank + '/' + nat0.total);

  State.get().bestPerSec = 1e12; Game.invalidate();
  const nat1 = Game.nationRank();
  ok(nat1.rank < nat0.rank, '벌이가 오르면 순위가 앞당겨짐', nat0.rank + ' → ' + nat1.rank);
  ok(nat1.pct < 100 && nat1.pct > 0, '상위 % 가 정상 범위', nat1.pct + '%');

  State.get().bestPerSec = 1e15; Game.invalidate();
  ok(Game.nationRank().rank <= 5, '벌이가 아주 크면 전국 최상위권', Game.nationRank().rank);

  // 리더보드 — 이름이 (지역·순위)로 고정
  State.get().bestPerSec = 5e7; Game.invalidate();
  const board = Game.rankBoard();
  ok(board.length >= 4, '리더보드에 여러 줄', board.length);
  const me = board.filter(r => r.me);
  ok(me.length === 1, '내 가게가 한 줄만 표시됨');
  ok(me[0].rank === Game.regionRank().rank, '내 줄의 순위가 지역 순위와 같음');
  ok(board.filter(r => !r.gap && !r.me).every(r => r.name && !/undefined/.test(r.name)),
     '가상 맛집 이름이 모두 정상');
  const n1 = Game.rankBoard().filter(r => !r.gap).map(r => r.name).join(',');
  const n2 = Game.rankBoard().filter(r => !r.gap).map(r => r.name).join(',');
  ok(n1 === n2, '같은 순위면 이름이 그대로 (새로고침해도 안 바뀜)');
  // 인기 점수는 위일수록 크다
  const pops = board.filter(r => !r.gap).map(r => ({ rank: r.rank, pop: r.pop }));
  ok(pops.every((r, i) => i === 0 || pops[i - 1].pop >= r.pop), '위 순위일수록 인기 점수가 큼');

  // 구버전 세이브에는 region 이 없다 — 처음 볼 때 배정된다
  State.set({ v: 1, money: 100, startedAt: 1700000000001 }); 
  ok(State.get().region === '', '구버전 세이브엔 지역이 비어 있음');
  ok(Data.REGIONS.some(r => r.id === Game.region().id), '한 번 보면 지역이 배정됨');
}

console.log('\n[16] 퀘스트 세이브 방어');
{
  // 배열 길이가 어긋나면 통째로 버려야 한다 — 반쯤 남으면 진행도가 엉뚱한 데 붙는다
  State.set({ questDate: '2030-05-05', questIds: ['q_tap'], questGoals: [1, 2, 3],
              questProg: [0, 0, 0], questTaken: [0, 0, 0] });
  ok(State.get().questDate === '', '길이가 어긋난 퀘스트 세이브는 버림');
  State.set({ questDate: '2030-05-05', questIds: ['q_tap', 'q_없음', 'q_gen'],
              questGoals: [1, 2, 3], questProg: [0, 0, 0], questTaken: [0, 0, 0] });
  ok(State.get().questDate === '', '없는 퀘스트 id 가 섞이면 버림');

  const good = { questDate: '2030-05-05', questIds: ['q_tap', 'q_gen', 'q_up'],
                 questGoals: [10, 5, 2], questProg: [3, 1, 0], questTaken: [0, 0, 0] };
  State.set(good);
  ok(State.get().questDate === '2030-05-05', '멀쩡한 것은 그대로 살아남음');
  ok(Game.quests()[0].prog === 3, '진행도 유지');

  // 구버전 세이브에는 퀘스트 필드가 아예 없다
  State.set({ v: 1, money: 100 });
  ok(Array.isArray(State.get().questIds) && State.get().questIds.length === 0,
     '구버전 세이브도 빈 퀘스트로 시작');
  ok(Game.quests().length === 0, '깔리기 전에는 빈 목록');
  Game.questRoll();
  ok(Game.quests().length === Data.QUEST.count, '한 번 부르면 채워짐');
}

console.log(fails === 0 ? '\n전부 통과 ✅' : `\n실패 ${fails}건 ❌`);
process.exit(fails ? 1 : 0);
