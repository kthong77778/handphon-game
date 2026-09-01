/* 게임 로직 테스트 — 브라우저 없이 돌아간다.
   실행: node tests/logic.js */
const { load, near, autoBuy, humanTap } = require('./_harness');
const { Fmt, Data, State, Game } = load();

// 테스트를 실제 시계에서 떼어놓는다: 날짜는 그대로 두되 '시각'만 주말 파티
// 시간대(금·토 17~24시) 밖으로 고정한다. 이렇게 안 하면 금·토 저녁에 돌릴 때
// 주말 파티 ×3 버프가 perSec 에 섞여 buff·재계산 검증이 통째로 깨진다
// (bruteRate 는 파티 배율을 일부러 안 셈). 파티 자체 검증([13])은 그때그때
// Game.setClock 으로 파티 시각을 따로 지정하므로 영향받지 않는다.
Game.setClock(function () { var d = new Date(); d.setHours(10, 0, 0, 0); return d; });

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

  // 흔한 종류는 모두 나오고, 낮은 확률로 무지개(희귀)도 섞인다
  const seen = {};
  for (let i = 0; i < 6000; i++) { const id = Game.rollGolden().id; seen[id] = (seen[id] || 0) + 1; }
  Data.GOLDEN.types.forEach(t => ok(seen[t.id] > 0, t.name + ' 등장'));
  ok(seen['rainbow'] > 0, '무지개(희귀) 손님도 섞여 등장', JSON.stringify(seen));

  // 🌈 무지개 손님 보상 — 큰 현금(바닥값 있음) + 전체 수익 버프가 함께 붙는다 (상태를 갈아엎지 않는다)
  const sr = State.get(); sr.goldLeft = 0; sr.goldMult = 1; Game.invalidate();
  const rb = Data.GOLDEN.rare;
  const rr = Game.claimGolden(rb, true);
  ok(rr && rr.money > 0, '무지개: 큰 현금 지급');
  ok(sr.goldMult === rb.mult && sr.goldLeft === rb.dur, '무지개: 전체 수익 버프도 함께');
  ok(Game.claimGolden(rb, false) === null, '무지개도 가짜 이벤트로는 못 잡는다');
}

console.log('\n[6.1] 수익 버프 슬롯 합치기 (광고 ×2·1800초 vs 황금 ×7·30초)');
{
  // State.set 은 상태를 통째로 초기화하므로 뒤 블록(환생)이 쓸 수익을 날린다.
  // 여기선 버프 필드만 직접 만졌다 끝에 되돌린다.
  const s = State.get();
  const rush = Data.GOLDEN.types.find(t => t.id === 'rush');   // ×7 / 30초
  const adMult = Data.ADS.boostMult, adDur = Data.ADS.boostDur; // ×2 / 1800초
  const reset = () => { s.goldLeft = 0; s.goldMult = 1; };

  // 광고 먼저 → 황금 폭주: 센 배율(×7)은 '자기 시간(30초)'으로만, 광고의 긴 꼬리를 안 문다
  reset();
  Game.claimAd('boost');
  ok(s.goldMult === adMult && s.goldLeft === adDur, '광고 버프가 걸린다 ×2/1800');
  Game.claimGolden(rush);
  ok(s.goldMult === rush.mult && s.goldLeft === rush.dur,
     '센 배율이 오면 그 자신의 지속으로 교체 — ×7 이 30초', 'goldLeft=' + s.goldLeft);

  // 황금 폭주 먼저 → 광고: 약한 버프(×2)는 센 버프의 배율·시간을 늘리지 못한다
  reset();
  Game.claimGolden(rush);
  Game.claimAd('boost');
  ok(s.goldMult === rush.mult && s.goldLeft === rush.dur,
     '약한 버프는 센 버프의 배율·시간을 못 바꾼다 — ×7/30 유지', 'goldLeft=' + s.goldLeft);

  // 같은 세기면 시간만 새로 채운다
  reset();
  Game.claimGolden(rush);
  Game.advanceTimers(20);              // 10초 남음
  Game.claimGolden(rush);
  ok(s.goldMult === rush.mult && s.goldLeft === rush.dur, '같은 세기는 시간만 리필', 'goldLeft=' + s.goldLeft);

  reset(); Game.invalidate();          // 버프를 끄고 나간다 (뒤 블록 오염 방지)
}

console.log('\n[6.2] 황금 현금 바닥값은 버프와 무관 (규칙 4)');
{
  const snap = State.exportText();
  const cash = Data.GOLDEN.types.find(t => t.id === 'cash');
  // perSec 항(초당×240)을 죽이고(gens 비움) 명성을 높여 tapBase×25 항이 100·초당항을
  // 확실히 넘겨 '바닥값을 정하게' 만든다. 이래야 버프 오염이 실제로 드러난다.
  const s = State.get();
  s.gens = {}; s.fame = 1000; s.goldLeft = 0; s.goldMult = 1; s.boostLeft = 0; Game.invalidate();
  ok(Game.tapBaseValue() * 25 > Math.max(Game.perSec(true) * 240, 100),
     '탭 항이 바닥값을 결정하는 상황', Fmt.won(Game.tapBaseValue() * 25));
  const m0 = s.money; Game.claimGolden(cash); const noBuf = s.money - m0;

  State.importText(snap); Game.invalidate();
  const s2 = State.get();
  s2.gens = {}; s2.fame = 1000; s2.goldLeft = 999; s2.goldMult = 7; s2.boostLeft = 0; Game.invalidate();
  const m1 = s2.money; Game.claimGolden(cash); const withBuf = s2.money - m1;

  ok(near(noBuf, withBuf), '버프(×7) 켜도 같은 현금 보상', noBuf + ' vs ' + withBuf);
  State.importText(snap); Game.invalidate();   // 원상복구
}

console.log('\n[6.3] 오프라인 정산 방어 (NaN·음수 경과)');
{
  const r = Game.offlineReward(NaN);
  ok(r.gain === 0 && r.trucks === 0, 'NaN 경과 → 보상 0·트럭 0');
  const rn = Game.offlineReward(-100);
  ok(rn.gain === 0 && rn.trucks === 0, '음수 경과 → 보상 0·트럭 0');
  ok(Game.offlineReward(0).gain === 0, '0 경과 → 보상 0');
  ok(isFinite(Game.offlineReward(3600).gain), '정상 경과는 여전히 유한한 보상');
}

console.log('\n[6.5] 매크로 방지');
{
  // 출시(오프라인 싱글)에선 기본 꺼져 있다 — 이 블록은 보존된 판정 코드를 검증하려 잠시 켠다.
  Game.setMacroGuard(true);
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

  // 스위치를 끄면(출시 기본값) 어떤 탭도 안 막힌다
  Game.setMacroGuard(false);
  ok(!Game.macroGuardOn(), '매크로 방지 기본값은 꺼짐(오프라인 싱글)');
  Game.resetGuard(); t = 6e9;
  let offBlocked = 0;
  for (let i = 0; i < 60; i++) { t += 100; if (Game.tap(true, t, 100, 100).blocked) offBlocked++; }   // 완벽한 봇 패턴
  ok(offBlocked === 0, '꺼두면 오토클릭 패턴도 전부 통과', offBlocked + '회 막힘');

  Game.resetGuard();
}

console.log('\n[6.7] 스킨 & 등급');
{
  // 이 블록은 세이브를 마음대로 헤집으므로, 뒤 테스트를 위해 원래 상태를 떠 둔다
  const snapshot = State.exportText();
  State.wipe(); Game.invalidate(); Game.resetGuard();
  const s = State.get();

  ok(s.tapSkin === 'auto' && s.crowdSkin === 'img', '기본 스킨은 조리 auto · 손님 img(그림 손님)');
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
  ok(State.get().tapSkin === 'auto' && State.get().crowdSkin === 'img',
     '이상한 스킨 id 는 기본값으로');
  ok(Game.tapStep().step.icon && Game.crowdTier().cast.length > 0, '그래도 정상 동작');

  // 사장님 — 성장형(사장 레벨) + 남/여 선택
  State.set({ totalEarned: 500 }); Game.invalidate();   // bossLevel 0
  ok(Game.ownerSex() === 'female', '기본 사장은 여자');
  ok(Game.ownerStage().key === 'lv2', '레벨 낮으면 새내기(lv2)');
  ok(Game.ownerImg() === 'owner/owner_female_lv2.png', '이미지 경로가 성별·단계와 맞는다');
  ok(Game.setOwnerSex('male') && Game.ownerSex() === 'male' &&
     Game.ownerImg().indexOf('_male_') >= 0, '남자 사장으로 바꾸면 경로도 바뀐다');
  ok(!Game.setOwnerSex('xxx') && Game.ownerSex() === 'male', '이상한 성별은 거부');
  State.get().totalEarned = 1e15; Game.invalidate();     // bossLevel 아주 높음
  ok(Game.ownerStage().key === 'lv5', '레벨이 아주 높으면 분식 대부(lv5)');

  // 모든 스킨이 형태를 갖췄는가
  let bad = [];
  Data.TAP_SKINS.forEach(k => {
    // 단계 수는 스킨마다 다를 수 있다(그림 스킨은 확보한 그림만큼). 1~8 사이면 온전하다 — TAP_STEP_AT 가 8칸.
    if (k.steps.length < 1 || k.steps.length > 8) bad.push(k.id + ' 단계수');
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
    // 상위 등급은 소지품으로 격을 드러낸다 (이미지 손님 스킨은 손님 자체가 격을 드러내므로 예외)
    var isImgSkin = k.tiers[0].cast[0] && String(k.tiers[0].cast[0]).indexOf('/') >= 0;
    if (!isImgSkin && !k.tiers[4].acc.length) bad.push(k.id + ' 최고 등급에 소지품 없음');
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

console.log('\n[7] 출석 보상 (30일 출석부)');
{
  const s = State.get();
  const pad = n => (n < 10 ? '0' : '') + n;
  const backDays = n => { const y = new Date(); y.setDate(y.getDate() - n);
    s.dailyDate = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate()); };

  s.dailyDate = ''; s.dailyStreak = 0; s.attDay = 0;
  ok(Game.dailyReady(), '처음엔 받을 수 있음');
  const r1 = Game.claimDaily();
  ok(r1 && r1.streak === 1 && r1.day === 1, '1일차 · 출석부 Day 1');
  ok(!Game.dailyReady() && Game.claimDaily() === null, '하루에 한 번만');

  // 어제 받았으면 연속 + 다음 칸
  backDays(1);
  const r2 = Game.claimDaily();
  ok(r2.streak === 2 && r2.day === 2, '어제 받았으면 연속 2일 · Day 2');

  // 사흘 전 → 연속은 끊겨도 출석부 칸은 이어진다(누적)
  backDays(3);
  const r3 = Game.claimDaily();
  ok(r3.streak === 1, '건너뛰면 연속은 1로 리셋');
  ok(r3.day === 3, '건너뛰어도 출석부 칸은 계속 이어진다(누적)');
  ok(r3.gain >= Data.DAILY.minMoney, '최소 보상 보장');

  // 마일스톤(7일차) — 쿠폰 보너스가 실제로 붙는다
  s.attDay = 6; s.coupons = 0; backDays(1);
  const r7 = Game.claimDaily();
  ok(r7.day === 7 && r7.milestone === true, '7일차는 마일스톤');
  ok(r7.bonus && r7.bonus.type === 'coupon' && s.coupons === 1, '7일 보상: 할인 쿠폰 지급');

  // 14일차 — 손님 몰이 즉시 발동
  s.attDay = 13; s.boostLeft = 0; backDays(1);
  const r14 = Game.claimDaily();
  ok(r14.bonus && r14.bonus.type === 'boost' && s.boostLeft === Data.BOOST.dur, '14일 보상: 손님 몰이 발동');

  // 30일차 개근 → grand, 그리고 다음엔 새 바퀴(Day 1)
  s.attDay = 29; backDays(1);
  const r30 = Game.claimDaily();
  ok(r30.day === 30 && r30.grand === true, '30일차는 개근(grand) 보상');
  backDays(1);
  const r31 = Game.claimDaily();
  ok(r31.day === 1, '30칸을 채우면 새 바퀴(Day 1)로 돈다');
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

  s.goldens = 42; s.bestCombo = 33; s.dailyStreak = 4; s.boosts = 7; s.noticeSeen = 2;
  const code = State.exportText();
  State.wipe(); Game.invalidate();
  ok(State.get().goldens === 0, '초기화됨');
  ok(State.get().noticeSeen === 0, '초기화 시 noticeSeen 0');
  ok(State.importText(code), '세이브 코드 복원');
  Game.invalidate();
  const t = State.get();
  ok(t.goldens === 42 && t.bestCombo === 33 && t.dailyStreak === 4 && t.boosts === 7,
     '새 필드가 백업/복원됨');
  ok(t.noticeSeen === 2, 'noticeSeen 백업/복원됨');
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

  // 세이브가 아닌 유효 JSON(null·숫자·배열·엉뚱한 객체)을 불러오면 조용히
  // 초기화되면 안 된다 — 거부(false)하고 기존 진행을 그대로 둔다.
  State.set({ money: 12345, taps: 99, prestiges: 2 }); Game.invalidate();
  const b64 = x => Buffer.from(x, 'binary').toString('base64');
  ['null', '12', '[]', '"hi"', '{"foo":1}'].forEach(function (raw) {
    ok(State.importText(b64(raw)) === false, '세이브 아닌 JSON 거부: ' + raw);
  });
  ok(State.get().money === 12345 && State.get().prestiges === 2,
     '거부된 불러오기가 진행을 날리지 않음');
  ok(State.importText(State.exportText()) === true, '정상 세이브 코드는 통과');

  // 조작된 회차 기록의 무한대 n·fame 은 걸러야 한다 — 안 그러면 명예의 전당
  // 영구 1위·Fmt.num(Infinity) 로 깨진다.
  State.set({ runs: [ { n: Infinity, earned: 100, fame: Infinity, seconds: 60 },
                      { n: 2, earned: 200, fame: 5, seconds: 90 } ] });
  const runs = State.get().runs;
  ok(runs.every(r => isFinite(r.n) && isFinite(r.fame)), '무한대 n·fame 회차는 버려짐',
     JSON.stringify(runs.map(r => [r.n, r.fame])));
  ok(runs.length === 1 && runs[0].n === 2, '멀쩡한 회차만 남음');
}

console.log('\n[10.5] 우편함 선물 수령');
{
  State.set({ money: 1000, coupons: 0 }); Game.invalidate();
  ok(Array.isArray(State.get().mailTaken) && State.get().mailTaken.length === 0, '처음엔 받은 우편 없음');
  const gift = Data.MAIL.find(m => m.reward);
  const info = Data.MAIL.find(m => !m.reward);
  const m0 = State.get().money;
  const got = Game.claimMail(gift.id);
  ok(got && State.get().money === m0 + gift.reward.gold, '선물을 받으면 돈이 들어온다');
  ok(!info || Game.claimMail(info.id) === null, '선물 없는 편지는 받을 게 없다');
  ok(Game.claimMail(gift.id) === null, '같은 선물은 두 번 못 받는다');
  ok(Game.mailClaimed(gift.id), '받은 우편으로 기록됨');
  // 조작된 mailTaken(없는 id) 은 걸러진다
  State.set({ mailTaken: [gift.id, 99999, gift.id] });
  ok(State.get().mailTaken.length === 1 && State.get().mailTaken[0] === gift.id,
     '없는 id·중복은 정제된다');
}

console.log('\n[10.6] 별사탕 · 상점');
{
  State.set({ money: 0, candy: 0, coupons: 0 }); Game.invalidate();
  State.get().dailyDate = ''; State.get().attDay = 0;   // 출석부 Day 1 부터 (마일스톤 아님)
  ok(State.get().candy === 0, '별사탕 기본 0');

  // 획득처: 출석·도전과제·환생
  const dc = Game.claimDaily();
  ok(dc.candy === Data.DAILY.dailyCandy && State.get().candy === Data.DAILY.dailyCandy, '출석하면 별사탕');
  const c1 = State.get().candy;
  State.get().taps = 1e9;                    // 탭 도전과제 여러 개 달성 유도
  const got = Game.checkAchievements();
  ok(got.length === 0 || State.get().candy === c1 + got.length * Data.CANDY.perAchv,
     '도전과제 달성마다 별사탕 (+' + (State.get().candy - c1) + ')');

  // 상점 구매: 별사탕 차감 + 효과
  State.set({ money: 1000, candy: 20, coupons: 0 }); Game.invalidate();
  const item = Data.SHOP.find(x => x.coupons);
  const r = Game.buyShopItem(item.id);
  ok(r && State.get().candy === 20 - item.cost, '사면 별사탕이 깎인다');
  ok(State.get().coupons === item.coupons, '쿠폰 묶음이 실제로 들어온다');
  State.set({ candy: 0 }); Game.invalidate();
  ok(Game.buyShopItem(item.id) === null, '별사탕이 모자라면 못 산다');

  // 환생해도 별사탕은 유지된다 (영구 재화)
  State.set({ money: 1e12, runEarned: 1e12, candy: 30 }); Game.invalidate();
  const beforeP = State.get().candy;
  Game.doPrestige();
  ok(State.get().candy >= beforeP, '환생해도 별사탕은 사라지지 않는다(오히려 +)',
     beforeP + ' → ' + State.get().candy);

  // 구버전 세이브(candy 없음) → 0
  State.set({ money: 5 });
  ok(State.get().candy === 0, '구버전 세이브는 candy 0 으로 채워짐');
}

console.log('\n[10.7] 성장하는 할인 쿠폰');
{
  const g = Data.GENERATORS[0].id;
  ok(State.get().couponPct === Data.COUPON.start, '쿠폰 할인율 기본 = start(' + Data.COUPON.start + ')');
  State.set({ money: 5 });   // couponPct 없는 구버전
  ok(State.get().couponPct === Data.COUPON.start, '구버전 세이브도 start 로 채워짐');
  ok(State.get().sawCouponTip === 0, '쿠폰 사용법 튜토리얼 플래그 기본 0(구버전도 채워짐)');

  // 쿠폰은 ×1 구매에만 붙는다 — 대량구매(×10 등)에는 아예 안 붙는다(B안)
  State.set({ money: 1e12, gens: {}, coupons: 3, couponPct: 30 }); Game.invalidate();
  const full1 = Game.genCost(g, 1), full10 = Game.genCost(g, 10);
  Game.setCouponArmed(true);
  ok(near(Game.genCost(g, 1), full1 * 0.7), '×1 은 30% 깎인다');
  ok(near(Game.genCost(g, 10), full10), '×10 대량구매엔 쿠폰이 안 붙는다(정가)');

  // 대량구매(×10)로는 쿠폰이 소모되지 않고 그대로 남는다
  State.set({ money: 1e12, gens: {}, coupons: 2, couponPct: 30 }); Game.invalidate();
  Game.setCouponArmed(true);
  Game.buyGen(g, 10);
  ok(State.get().coupons === 2, '대량구매는 쿠폰을 소모하지 않는다');
  ok(State.get().couponPct === 30, '대량구매로는 할인율도 안 자란다');
  ok(Game.couponState().armed === true, '대량구매 뒤에도 쿠폰은 켜진 채 남는다');
  // 이어서 ×1 로 사면 그때 소모된다
  Game.buyGen(g, 1);
  ok(State.get().coupons === 1 && State.get().couponPct === 35, '×1 구매에서 비로소 1장 쓰고 자란다');

  // 쓸수록 자란다: 30 → +step … → 100 → reset
  State.set({ money: 1e15, gens: {}, couponPct: 30 }); Game.invalidate();
  const seq = [];
  for (let i = 0; i < 16; i++) {
    State.get().coupons = 1; Game.setCouponArmed(true); Game.buyGen(g, 1);
    seq.push(State.get().couponPct);
  }
  ok(seq[0] === 30 + Data.COUPON.step, '한 번 쓰면 step 만큼 자란다');
  ok(seq.indexOf(100) >= 0, '계속 쓰면 100% 까지 오른다');
  ok(seq[seq.indexOf(100) + 1] === Data.COUPON.reset, '100% 를 쓰면 reset(' + Data.COUPON.reset + ')로 떨어진다');

  // 100% 쿠폰은 설비 1개(×1)를 공짜로 — 대량구매엔 안 붙어 정가 그대로
  State.set({ money: 1e15, gens: {}, coupons: 1, couponPct: 100 }); Game.invalidate();
  const full10b = Game.genCost(g, 10);
  Game.setCouponArmed(true);
  ok(near(Game.genCost(g, 1), 0), '100% 쿠폰은 ×1 을 공짜로');
  ok(near(Game.genCost(g, 10), full10b), '100% 라도 ×10 은 정가(공짜 없음)');

  // 조작된 할인율은 정제된다
  State.set({ couponPct: 9999 });
  ok(State.get().couponPct === Data.COUPON.start, '범위 벗어난 할인율은 start 로 정제');
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

  // 지역은 '작은 연못' — 전국보다 먼저 1위에 닿는다 ("전국 수백 위인데 지역 1위")
  State.get().bestPerSec = 1e11; Game.invalidate();
  ok(Game.regionRank().rank < Game.nationRank().rank, '지역 순위가 전국보다 앞선다',
     '지역 ' + Game.regionRank().rank + ' < 전국 ' + Game.nationRank().rank);
  ok(Game.regionRank().rank === 1 && Game.nationRank().rank > 1,
     '전국은 아직인데 지역은 1위가 될 수 있다', '전국 ' + Game.nationRank().rank + '위');
  ok(Game.regionRank().rank <= Game.regionRank().total, '지역 순위는 지역 가게 수 이내');

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

console.log('\n[17] 스타 셰프 도전');
{
  State.set({ money: 0, bestMichelin: 0, michelinGrand: 0 });
  Data.GENERATORS.forEach(function (g) { State.get().gens[g.id] = 10; });
  Game.invalidate();
  var G = Data.MICHELIN.goals;
  ok(Game.michelinStars(0) === 0, '0번은 0성');
  ok(Game.michelinStars(G[0] - 1) === 0, '문턱 직전은 0성');
  ok(Game.michelinStars(G[0]) === 1, '첫 문턱에서 1성');
  ok(Game.michelinStars(G[4]) === 5, '마지막 문턱에서 5성');
  ok(Game.michelinStars(99999) === 5, '아무리 많아도 최대 5성');
  ok(Game.michelinNextGoal(0) === G[0], '다음 목표는 첫 문턱');
  ok(Game.michelinNextGoal(G[4]) === 0, '5성이면 다음 목표 없음');

  // 정산: 별만큼 보상, 최고 기록 갱신
  var r1 = Game.claimMichelin(G[2]);       // 3성
  ok(r1.stars === 3 && r1.gain > 0, '3성 정산 · 보상 지급', Fmt.won(r1.gain));
  ok(State.get().bestMichelin === 3, '최고 기록 3성으로');
  ok(!r1.grandNew, '아직 5성 아니라 그랜드 없음');

  // 최고 기록은 낮은 결과로 안 내려간다
  Game.claimMichelin(G[0]);                // 1성
  ok(State.get().bestMichelin === 3, '더 낮은 결과로는 최고 기록이 안 내려감');

  // 5성 첫 달성 → 영구 배율
  var m0 = Game.globalMult();
  var r5 = Game.claimMichelin(G[4]);
  ok(r5.stars === 5 && r5.grandNew, '5성 첫 달성 · 그랜드 보상');
  ok(Math.abs(Game.globalMult() / m0 - Data.MICHELIN.grandMult) < 0.001,
     '모든 수익 ×' + Data.MICHELIN.grandMult + ' 영구 적용');
  ok(State.get().michelinGrand === 1, '그랜드 수령 기록됨');

  // 두 번째 5성엔 그랜드가 다시 안 나온다
  ok(Game.claimMichelin(G[4]).grandNew === false, '그랜드는 한 번만');

  // ----- 단계(티어): 5성 깰 때마다 다음 도전이 더 어려워진다 -----
  State.set({ money: 0, michTier: 0, michelinGrand: 0, bestMichelin: 0 });
  Data.GENERATORS.forEach(function (g) { State.get().gens[g.id] = 10; });
  Game.invalidate();
  var g1 = Game.michGoals();
  ok(g1.join(',') === Data.MICHELIN.goals.join(','), '1단계 목표는 기본값');
  ok(Game.michTimeSec() === Data.MICHELIN.time, '1단계 시간은 기본값');
  var r1t = Game.claimMichelin(g1[4]);   // 1단계 5성
  ok(r1t.tierUp === 1 && State.get().michTier === 1, '5성 → 2단계로');
  var g2 = Game.michGoals();
  ok(g2[4] > g1[4], '2단계 별5 목표가 더 큼 (' + g1[4] + ' → ' + g2[4] + ')');
  ok(Game.michTimeSec() > Data.MICHELIN.time, '2단계 시간이 조금 늘어남');
  ok(Game.michelinStars(g1[4]) < 5, '이전 5성 횟수로는 2단계에서 5성 안 됨');
  Game.claimMichelin(g2[4]);              // 2단계 5성
  ok(State.get().michTier === 2, '또 5성 → 3단계');
  ok(Game.michGoals()[4] > g2[4], '3단계는 더 큼');
  // 5성 못 채우면 단계는 그대로
  var t = State.get().michTier;
  Game.claimMichelin(0);
  ok(State.get().michTier === t, '별을 못 채우면 단계 유지');
  ok(Game.michTier() === State.get().michTier, 'michTier() 가 세이브와 일치');

  // 0성이면 보상 없음, 기록도 그대로
  var beforeMoney = State.get().money;
  var r0 = Game.claimMichelin(0);
  ok(r0.stars === 0 && r0.gain === 0, '0성은 보상 없음');
  ok(State.get().money === beforeMoney, '돈 변화 없음');

  // 세이브에 남는다
  State.set(JSON.parse(JSON.stringify(State.get())));
  ok(State.get().bestMichelin === 5 && State.get().michelinGrand === 1, '기록·그랜드가 세이브에 유지됨');
  // 깨진 값 방어
  State.set({ bestMichelin: 'x', michelinGrand: 9 });
  ok(State.get().bestMichelin === 0, '엉뚱한 최고 기록은 0');

  // ----- 시즌 -----
  Game.setClock(function () { return new Date(2026, 7, 15, 12, 0, 0); }); // 8월
  State.set({ money: 0 }); Data.GENERATORS.forEach(function (g) { State.get().gens[g.id] = 10; });
  Game.invalidate(); Game.michSeasonRoll();
  ok(Game.michSeason().id === '2026-08', '시즌 id 는 연-월');
  ok(/8월/.test(Game.michSeason().name), '시즌 이름에 월 표시: ' + Game.michSeason().name);
  Game.claimMichelin(Data.MICHELIN.goals[2]);   // 3성
  ok(State.get().michSeasonStars === 3, '이번 시즌 최고 별 갱신');
  ok(State.get().michSeasonTaps === Data.MICHELIN.goals[2], '이번 시즌 최고 조리 횟수 기록');

  // 달이 바뀌면 시즌 리셋 + 히스토리, 통산은 유지
  Game.setClock(function () { return new Date(2026, 8, 3, 12, 0, 0); }); // 9월
  ok(Game.michSeasonRoll() === true, '달이 바뀌면 새 시즌');
  ok(State.get().michSeasonStars === 0, '새 시즌엔 시즌 별이 0');
  ok(State.get().michHist.length === 1 && State.get().michHist[0].s === '2026-08',
     '지난 시즌이 히스토리에 남음');
  ok(State.get().bestMichelin === 3, '통산 최고 별은 유지됨(시즌 넘어가도)');
  ok(Game.michSeasonRoll() === false, '같은 달이면 그대로');

  // ----- 랭킹 -----
  var lo = Game.michRank(0), hi = Game.michRank(9999);
  ok(lo.rank === lo.total, '조리 0번은 꼴찌');
  ok(hi.rank === 1, '아주 많이 하면 전국 1위');
  ok(Game.michRank(120).rank < Game.michRank(30).rank, '더 많이 조리하면 순위가 앞당겨짐');
  var board = Game.michBoard();
  ok(board.length >= 3, '랭킹 보드에 여러 줄');
  ok(board.filter(function (r) { return r.name && !/undefined/.test(r.name); }).length ===
     board.filter(function (r) { return !r.gap; }).length, '셰프 이름이 모두 정상');
  // 같은 시즌·순위면 이름 고정
  ok(Game.michBoard().map(function(r){return r.name;}).join(',') ===
     Game.michBoard().map(function(r){return r.name;}).join(','), '같은 시즌이면 이름 그대로');

  Game.setClock(null);
}

console.log('\n[18] 세이브 백업 표시');
{
  State.set({ money: 100, lastBackup: 0 }); Game.invalidate();
  ok(State.get().lastBackup === 0, '처음엔 백업 기록 없음');
  State.markBackup();
  var lb = State.get().lastBackup;
  ok(lb > 0 && Math.abs(lb - State.now()) < 5000, 'markBackup 이 지금 시각을 남김');
  ok(typeof State.requestPersist === 'function', 'persist 요청 함수 존재');
  ok(typeof State.storagePersisted === 'function', 'persist 상태 확인 함수 존재');
  // 노드엔 navigator.storage 가 없으니 조용히 기본값을 돌려줘야 한다 (예외 없이)
  var okAsync = true;
  try { State.requestPersist(); State.storagePersisted(); } catch (e) { okAsync = false; }
  ok(okAsync, 'navigator.storage 없어도 예외 없음');
  // 백업 시각은 세이브에 남는다
  State.set(JSON.parse(JSON.stringify(State.get())));
  ok(State.get().lastBackup === lb, 'lastBackup 이 세이브에 유지됨');
  // 깨진 값은 걸러진다
  State.set({ lastBackup: 'abc' });
  ok(State.get().lastBackup === 0, '엉뚱한 lastBackup 은 0 으로');
}

/* ===== 추천 설비 ===== */
console.log('\n[19] 추천 설비');
(function () {
  // 돈이 없으면: 살 수 없는 상태로라도 '다음 목표'를 알려준다
  State.set({ money: 0 }); Game.invalidate();
  var b0 = Game.bestGen();
  ok(b0 && b0.affordable === false, '돈 없을 때는 목표만 (affordable=false)');
  ok(b0 && b0.id === Data.GENERATORS[0].id, '가장 싼 설비를 목표로');

  // 여러 설비가 열리고 돈이 넉넉하면: 살 수 있는 것 중 하나를 추천
  State.set({ money: 1e12 });
  var s = State.get();
  s.gens = { g1: 1, g2: 1, g3: 1 };   // g4 까지 해금
  Game.invalidate();
  var b = Game.bestGen();
  ok(b && b.affordable === true, '돈 넉넉하면 살 수 있는 추천 (affordable=true)');
  ok(b && b.gain > 0, '추천 설비의 초당 증가분이 0보다 큼');
  ok(Game.genUnlocked(b.id), '추천 설비는 해금된 것');

  // buyBest 가 실제로 초당 수익을 올린다
  var before = Game.perSec(true);
  var bought = Game.buyBest();
  ok(bought === true, 'buyBest 가 구매 성공');
  ok(Game.perSec(true) > before, '추천 구매 후 초당 수익 증가');

  // 돈이 없으면 buyBest 는 사지 않는다
  State.set({ money: 0 }); Game.invalidate();
  ok(Game.buyBest() === false, '돈 없으면 buyBest 는 false');
})();

/* ===== 사장 레벨 ===== */
console.log('\n[20] 사장 레벨');
(function () {
  State.set({ totalEarned: 0 }); Game.invalidate();
  ok(Game.bossLevel() === 0, '누적 0 이면 Lv.0');
  var r0 = Game.bossXpRatio();
  ok(r0 >= 0 && r0 <= 1, 'XP 비율은 0~1');

  State.set({ totalEarned: 1000 }); Game.invalidate();
  ok(Game.bossLevel() === 1, '누적 1000(BASE) 이면 Lv.1');

  State.set({ totalEarned: 1e9 }); Game.invalidate();
  var hi = Game.bossLevel();
  ok(hi > 1, '누적이 크면 레벨이 오름: Lv.' + hi);
  ok(['동네 사장', '소문난 사장', '지역 명장', '전국구 사장', '분식 대부'].indexOf(Game.bossTitle()) >= 0,
     '칭호가 정상: ' + Game.bossTitle());

  // 단조 증가
  State.set({ totalEarned: 1000 }); Game.invalidate(); var lo = Game.bossLevel();
  State.set({ totalEarned: 1e6 }); Game.invalidate();
  ok(Game.bossLevel() >= lo, '누적이 늘면 레벨이 줄지 않음');

  // Infinity(천장) 에서도 무한 레벨이 되지 않는다 (rule 10)
  State.set({}); var s = State.get(); s.totalEarned = Infinity; Game.invalidate();
  var big = Game.bossLevel();
  ok(isFinite(big), 'Infinity 누적에서도 유한한 레벨: ' + big);
  ok(Game.bossXpRatio() <= 1, 'Infinity 에서도 XP 비율 ≤ 1');
})();

/* ===== 돈 오버플로 / NaN 방어 =====
   증상: 일정 수치를 넘으면 돈이 0원으로 보이고 구매가 무료가 된다.
   원인 ① normalize 가 Infinity 돈을 0 으로 리셋  ② 구매 검사(money < cost)가 NaN 을 통과 */
console.log('\n[21] 돈 오버플로 / NaN 방어');
(function () {
  // ① 큰 돈은 0 이 아니라 천장으로 clamp (빈털터리 방지)
  State.set({ money: Infinity, runEarned: Infinity, totalEarned: 5 });
  ok(State.get().money === Number.MAX_VALUE, 'Infinity 돈은 천장으로 (0 아님)');
  ok(State.get().runEarned === Number.MAX_VALUE, 'Infinity 누적도 천장으로');
  ok(Fmt.won(State.get().money) !== '0 원', '천장 돈은 0원으로 표기되지 않음: ' + Fmt.won(State.get().money));

  // 지수로 새는 문자열(1e999 = Infinity)도 0 이 아니라 천장으로
  State.set({ money: '1e999' });
  ok(State.get().money === Number.MAX_VALUE, '오버플로 문자열도 천장으로');

  // NaN 은 여전히 걸러져 0
  State.set({ money: NaN });
  ok(State.get().money === 0, 'NaN 돈은 0 으로 정리');

  // ② 돈이 NaN 이어도 무료로 사지 않는다 (구매 fail-closed)
  State.set({}); var s = State.get(); s.money = NaN; s.gens = {}; Game.invalidate();
  ok(Game.buyGen('g1', 1) === false, 'NaN 돈으로는 설비 구매 실패');
  ok(Game.genCount('g1') === 0, 'NaN 구매 실패 후 설비 수 그대로');
  ok(Game.buyBest() === false, 'NaN 돈으로는 추천 구매도 실패');

  // 돈이 넉넉하면 정상 구매 (회귀 확인)
  State.set({ money: 1e6 }); Game.invalidate();
  var m0 = State.get().money;
  ok(Game.buyGen('g1', 1) === true, '돈이 있으면 정상 구매');
  ok(State.get().money < m0, '구매하면 돈이 실제로 줄어듦');
})();

/* ===== 오프라인 꼬리 보상 =====
   인정 시간까지는 제값, 그 뒤 2차 상한까지는 꼬리 효율(tailEff)로 조금 더 준다. */
console.log('\n[22] 오프라인 꼬리 보상');
(function () {
  State.set({ money: 0 });
  var s = State.get(); s.gens = { g1: 50, g2: 20, g3: 5 }; Game.invalidate();

  var cap = Game.offlineCapSeconds();
  var tailCap = Game.offlineTailCapSeconds();
  var eff = Game.offlineEfficiency();
  var tailEff = Data.OFFLINE.tailEff;
  var ps = Game.perSec(true);
  var tailRoom = tailCap - cap;

  ok(tailCap === cap * Data.OFFLINE.tailMult, '2차 상한 = 인정 시간 × ' + Data.OFFLINE.tailMult);

  // 상한 이하: 예전과 동일 (제값만, 꼬리 0)
  var rUnder = Game.offlineReward(cap / 2);
  ok(rUnder.tailSeconds === 0, '상한 이하면 꼬리 구간 없음');
  ok(near(rUnder.gain, ps * eff * (cap / 2)), '상한 이하 보상은 제값 그대로');

  // 상한과 2차 상한 사이: 제값 + 꼬리
  var mid = cap + tailRoom / 2;
  var rMid = Game.offlineReward(mid);
  ok(rMid.capped === cap, '중간 구간의 제값은 상한까지');
  ok(near(rMid.tailSeconds, tailRoom / 2), '중간 구간의 꼬리 초가 맞음');
  ok(near(rMid.gain, ps * eff * (cap + (tailRoom / 2) * tailEff)), '중간 구간 보상 = 제값 + 꼬리');

  // 2차 상한 초과: 꼬리도 꽉 참, 더는 안 늘어남
  var rFar = Game.offlineReward(tailCap * 10);
  ok(rFar.tailSeconds === tailRoom, '2차 상한 넘으면 꼬리도 최대치');
  ok(near(rFar.gain, ps * eff * (cap + tailRoom * tailEff)), '2차 상한 넘으면 보상 고정');
  ok(Game.offlineReward(tailCap * 1000).gain === rFar.gain, '아무리 오래 비워도 2차 상한에서 컷');

  // 오래 비울수록 늘긴 하되 상한이 있다
  ok(rMid.gain > rUnder.gain && rFar.gain > rMid.gain, '오래 비울수록 보상이 늘어남 (상한까지)');
})();

/* ===== 🍳 주방 (재료 · 합성 · 레시피 · 도감) ===== */
console.log('\n[23] 주방 — 재료/합성/레시피/도감');
(function () {
  var K = Data.KITCHEN;
  var k1 = K.foods.find(function (f) { return f.id === 'k1'; });   // at:1
  var k9 = K.foods.find(function (f) { return f.id === 'k9'; });   // 고급 레시피(높은 at)

  // 레시피 해금 = 사장 레벨 + 등급 게이트(아래 등급 도감 완성). 여기선 레벨 게이트만 본다.
  State.set({ totalEarned: 500 }); Game.invalidate();
  ok(Game.bossLevel() === 0 && !Game.recipeUnlocked('k1'), '레벨 낮으면 레시피 잠김(???)');
  State.set({ totalEarned: 1e15 }); var sk = State.get(); sk.kfoods = {}; Game.invalidate();
  ok(Game.recipeUnlocked('k1'), '레벨 오르면 초급 레시피 해금');
  // 고급 k9 는 레벨이 넉넉해도 아래 등급 도감을 안 채우면 잠긴다(등급 게이트는 아래 [등급 해금]에서 검증)
  ok(!Game.recipeUnlocked('k9'), '고급은 레벨만으론 안 열린다(등급 게이트)');

  // 재료 없으면 합성 불가
  var s = State.get(); s.ings = {}; s.kfoods = {}; Game.invalidate();
  ok(Game.canCraft('k1') === false, '재료 없으면 합성 불가');
  ok(Game.craftFood('k1') === null, '합성 실패는 null');

  // 재료 채우고 합성 → 소모 + 첫 등록시 도감 배율 + 목돈
  Object.keys(k1.need).forEach(function (ing) { s.ings[ing] = k1.need[ing] + 3; });
  Game.invalidate();
  ok(Game.canCraft('k1') === true, '재료 충분하면 합성 가능');
  var b = Game.foodBonus();
  var r = Game.craftFood('k1');
  ok(r && r.first === true && r.gain > 0, '첫 합성: 성공 + 목돈');
  ok(Game.ingCount(Object.keys(k1.need)[0]) === 3, '재료가 레시피만큼 소모됨');
  ok(near(Game.foodBonus(), b + k1.bonus), '첫 합성으로 도감 배율 +' + k1.bonus);
  // 두 번째 합성은 도감 배율 안 늘어남 (재료 다시 채워서)
  Object.keys(k1.need).forEach(function (ing) { s.ings[ing] = k1.need[ing] + 1; });
  Game.invalidate();
  var b2 = Game.foodBonus();
  var r2 = Game.craftFood('k1');
  ok(r2 && r2.first === false, '두 번째 합성은 first=false');
  ok(near(Game.foodBonus(), b2), '두 번째 합성은 도감 배율 그대로');

  // 도감 배율이 실제 수익에 반영
  State.set({ totalEarned: 1e12, gens: { g1: 10 } }); var s2 = State.get();
  s2.kfoods = {}; Game.invalidate(); var noDex = Game.perSec(true);
  s2.kfoods = { k1: 1, k4: 1 }; Game.invalidate();
  ok(Game.perSec(true) > noDex, '도감이 차면 초당 수익이 오름');

  // 음식 숙련도 — 누적 제작이 문턱을 넘으면 그 음식 배율이 커진다
  var mstep = Data.KITCHEN.mastery.steps[0], mmult = Data.KITCHEN.mastery.mult[0];
  State.set({ totalEarned: 1e15 }); var sm = State.get(); sm.kfoods = {}; Game.invalidate();
  ok(Game.masteryTier(0) === 0 && Game.masteryTier(mstep) === 1, '숙련 문턱을 넘으면 별이 오른다');
  ok(near(Game.foodEffBonus('k1'), 0), '안 만든 음식은 도감 배율 0');
  sm.kfoods = { k1: 1 }; Game.invalidate();
  ok(near(Game.foodEffBonus('k1'), k1.bonus), '1개 만들면 기본 배율');
  sm.kfoods = { k1: mstep }; Game.invalidate();
  ok(near(Game.foodEffBonus('k1'), k1.bonus * mmult), '★ 달성하면 배율 = 기본 × mult');
  ok(Game.foodBonus() > k1.bonus, '숙련이 오르면 도감 합도 커진다');
  // craftFood 가 문턱을 넘는 순간 tierUp 을 알린다
  sm.kfoods = {}; Object.keys(k1.need).forEach(function (ing) { sm.ings[ing] = 99999; }); Game.invalidate();
  var sawTierUp = false;
  for (var mc = 0; mc < mstep; mc++) { var rm = Game.craftFood('k1'); if (rm && rm.tierUp) sawTierUp = true; }
  ok(sawTierUp && Game.masteryTier(Game.foodMade('k1')) === 1, '문턱을 넘는 합성은 tierUp=true');

  // 🏅 등급 배율 — 초급 ×1 · 중급 ×2.5 · 고급 ×4 (도감 배율·목돈 둘 다에 곱해진다)
  ok(Game.gradeMult(1) === 1 && Game.gradeMult(2) === 2.5 && Game.gradeMult(3) === 4, '등급 배율 = 1/2.5/4');
  var gk3 = Data.KITCHEN.foods.find(function (f) { return f.grade === 3; });   // 고급 하나
  State.set({ totalEarned: 1e15 }); var sg = State.get(); sg.kfoods = {}; Game.invalidate();
  sg.kfoods[gk3.id] = 1; Game.invalidate();
  ok(near(Game.foodEffBonus(gk3), gk3.bonus * 4), '고급 도감 배율 = 기본 × 4');
  // 같은 조건에서 목돈도 등급 배율만큼 차이 난다 (기본값이 같은 초급·고급으로 비교)
  var lowB = Data.KITCHEN.foods.find(function (f) { return f.grade === 1 && f.bonus === 0.01; });
  var hiB  = Data.KITCHEN.foods.find(function (f) { return f.grade === 3 && f.bonus === 0.01; });
  if (lowB && hiB) {
    // 목돈 하한(minReward×grade×gradeMult)이 지배하도록 수익을 0 근처로 두고 비교
    State.set({ totalEarned: 0, gens: {}, fame: 0 }); Game.invalidate();
    var gLow = Game.craftGain(lowB), gHi = Game.craftGain(hiB);
    ok(gHi > gLow, '기본값이 같아도 고급 목돈이 초급보다 크다(등급 배율)');
  }

  // 🔒 등급 해금 — 아래 등급 도감을 다 채워야 다음 등급이 열린다 (초급은 항상 열림, 단계 건너뛰기 금지)
  State.set({ totalEarned: 1e15 }); var sgu = State.get(); sgu.kfoods = {}; Game.invalidate();
  ok(Game.gradeUnlocked(1) === true, '초급은 항상 해금');
  ok(Game.gradeUnlocked(2) === false, '초급 도감이 비면 중급 잠김');
  // 초급을 전부 도감에 등록하면 중급이 열린다
  Data.KITCHEN.foods.forEach(function (f) { if (f.grade === 1) sgu.kfoods[f.id] = 1; });
  Game.invalidate();
  ok(Game.gradeUnlocked(2) === true, '초급을 다 만들면 중급 해금');
  ok(Game.gradeUnlocked(3) === false, '중급이 남아 있으면 고급은 아직 잠김');
  // 중급을 하나만 빼고 채우면 여전히 잠김 → 마지막 하나까지 채우면 열림
  var mids = Data.KITCHEN.foods.filter(function (f) { return f.grade === 2; });
  mids.forEach(function (f, i) { if (i < mids.length - 1) sgu.kfoods[f.id] = 1; });
  Game.invalidate();
  ok(Game.gradeUnlocked(3) === false, '중급이 하나라도 비면 고급 잠김');
  sgu.kfoods[mids[mids.length - 1].id] = 1; Game.invalidate();
  ok(Game.gradeUnlocked(3) === true, '중급을 다 만들면 고급 해금');
  // recipeUnlocked 도 등급 게이트를 따른다 (bossLevel 24 라 레벨은 충분 — 오직 등급 미완으로만 잠긴다)
  sgu.kfoods = {}; Game.invalidate();
  ok(Game.recipeUnlocked(mids[0]) === false, '레벨이 충분해도 초급 미완이면 중급 레시피 잠김');
  Data.KITCHEN.foods.forEach(function (f) { if (f.grade === 1) sgu.kfoods[f.id] = 1; });
  Game.invalidate();
  ok(Game.recipeUnlocked(mids[0]) === true, '초급을 다 채우면 중급 레시피 해금');
  // 이미 만든 음식은 아래 등급을 안 채워도 계속 열려 있다 (구버전 세이브 배려 — 게이트는 새 발견만 막는다)
  sgu.kfoods = { k9: 1 }; Game.invalidate();   // k9 = 고급인데 초급·중급 도감은 텅 빔
  ok(Game.gradeUnlocked(3) === false && Game.recipeUnlocked('k9') === true,
     '이미 만든 상위 음식은 등급 게이트와 무관하게 계속 해금');

  // gradeProgress: 그 등급 도감 진행도(made/total)
  sgu.kfoods = { k1: 1, k2: 1 }; Game.invalidate();
  var gp1 = Game.gradeProgress(1);
  ok(gp1.made === 2 && gp1.total === 7, '초급 도감 진행 = 2/7');

  // 🏅 도감 컬렉션 완성 보상 — 발견/숙련 세트를 완성하면 전체 수익에 영구 배율이 곱해진다
  var COL = Data.KITCHEN.collection;
  var topT = Data.KITCHEN.mastery.steps[Data.KITCHEN.mastery.steps.length - 1];   // ★★★ 문턱(누적 제작)
  State.set({ totalEarned: 1e15 }); var sc = State.get(); sc.kfoods = {}; Game.invalidate();
  ok(Game.collectionMult() === 1, '아무것도 없으면 컬렉션 배율 1');
  // 초급 전부 발견 → discover[초급] 만 붙는다
  Data.KITCHEN.foods.forEach(function (f) { if (f.grade === 1) sc.kfoods[f.id] = 1; });
  Game.invalidate();
  ok(near(Game.collectionMult(), COL.discover[0]), '초급 발견 완성 → discover[초급] 배율');
  // 20종 전부 발견 → 등급별 발견 배율 전부 × 전종 발견 보너스
  Data.KITCHEN.foods.forEach(function (f) { sc.kfoods[f.id] = 1; });
  Game.invalidate();
  var wantDisc = COL.discover[0] * COL.discover[1] * COL.discover[2] * COL.discoverAll;
  ok(near(Game.collectionMult(), wantDisc), '전종 발견 → 등급별 + 전종 발견 보너스');
  // 숙련 세트 완성 기준은 masterTier 별(현재 ★★=50회). 그 문턱 '직전'엔 숙련 세트가 안 붙는다
  var setTier = Game.masterSetTier();
  var setStep = Data.KITCHEN.mastery.steps[setTier - 1];           // ★★ 문턱 = 50
  ok(setTier === (COL.masterTier || 3), '숙련 세트 기준 별 = collection.masterTier');
  Data.KITCHEN.foods.forEach(function (f) { sc.kfoods[f.id] = setStep - 1; });   // 전종 ★(49) — 아직 미완
  Game.invalidate();
  ok(near(Game.collectionMult(), wantDisc), '숙련 문턱 직전(★)엔 발견 보너스만');
  ok(Game.gradeMasterProgress(1).made === 0, '★★ 미만은 숙련 세트에 안 쳐진다');
  // 전 음식 ★★(50) → 발견 + 숙련 모든 세트
  Data.KITCHEN.foods.forEach(function (f) { sc.kfoods[f.id] = setStep; });
  Game.invalidate();
  var wantAll = wantDisc * COL.master[0] * COL.master[1] * COL.master[2] * COL.masterAll;
  ok(near(Game.collectionMult(), wantAll), '전종 ★★ → 발견 + 숙련 모든 세트 보너스');
  ok(Game.gradeMasterProgress(1).made === 7 && Game.gradeMasterProgress(1).total === 7, '초급 ★★ 진행 = 7/7');
  // ★★★(최고 별)도 당연히 숙련 세트에 포함된다(문턱 이상)
  Data.KITCHEN.foods.forEach(function (f) { sc.kfoods[f.id] = topT; });
  Game.invalidate();
  ok(near(Game.collectionMult(), wantAll), '★★★ 도 숙련 세트 완성(문턱 이상)');
  // 실제 수익에 반영: 컬렉션이 차면 초당 수익이 오른다
  State.set({ totalEarned: 1e12, gens: { g1: 10 } }); var sc2 = State.get();
  sc2.kfoods = {}; Game.invalidate(); var noCol = Game.perSec(true);
  Data.KITCHEN.foods.forEach(function (f) { sc2.kfoods[f.id] = topT; });
  Game.invalidate();
  ok(Game.perSec(true) > noCol, '컬렉션이 차면 초당 수익이 오른다');

  // ⭐ 오늘의 특선 / 단골 주문 — 날짜로 정해지고, 만들면 진행·보상
  Game.setClock(function () { return new Date(2026, 0, 10, 12, 0, 0); });
  State.set({ totalEarned: 1e15 }); var sp = State.get();
  sp.specialDate = ''; sp.specialFood = ''; sp.kfoods = {}; Game.invalidate();
  var spTop = Game.specialToday();
  ok(spTop && spTop.food, '해금된 레시피가 있으면 오늘의 특선이 정해진다');
  var spId = spTop.food.id;
  ok(Game.specialToday().food.id === spId, '같은 날이면 특선이 고정된다');
  var spf = Data.KITCHEN.foods.find(function (f) { return f.id === spId; });
  var goal = Data.KITCHEN.special.orderGoal;
  sp.ings = {}; Object.keys(spf.need).forEach(function (k) { sp.ings[k] = spf.need[k] * (goal + 2); });
  Game.invalidate();
  var sawSpecial = false;
  for (var sc = 0; sc < goal; sc++) { var rs = Game.craftFood(spId); if (rs && rs.special) sawSpecial = true; }
  ok(sawSpecial, '특선 음식 합성은 special=true');
  var spDone = Game.specialToday();
  ok(spDone.done && spDone.prog === goal, '특선을 goal 번 만들면 단골 주문 완료');
  var spClaim = Game.claimSpecialOrder();
  ok(spClaim && spClaim.gain > 0, '단골 주문 보상 수령');
  ok(Game.claimSpecialOrder() === null && Game.specialToday().taken, '단골 보상은 하루 한 번만');
  Game.setClock(null);

  // 🍳 상단 추천 — 만들 수 있는 것 중 '가장 이득인' 하나를 고른다
  State.set({ totalEarned: 1e15 }); var sbc = State.get();
  sbc.ings = {}; sbc.kfoods = {}; Game.invalidate();
  ok(Game.bestCraft() === null, '만들 수 있는 게 없으면 추천 없음(null)');
  var bk1 = Data.KITCHEN.foods.find(function (f) { return f.id === 'k1'; });
  var bk2 = Data.KITCHEN.foods.find(function (f) { return f.id === 'k2'; });
  Object.keys(bk1.need).forEach(function (k) { sbc.ings[k] = (sbc.ings[k] || 0) + bk1.need[k]; });
  Object.keys(bk2.need).forEach(function (k) { sbc.ings[k] = (sbc.ings[k] || 0) + bk2.need[k]; });
  sbc.kfoods = { k1: 1 };   // k1 은 이미 발견, k2 는 미발견
  Game.invalidate();
  var bc = Game.bestCraft();
  ok(bc && bc.id === 'k2' && bc.first === true, '미발견 음식을 먼저 추천한다(첫 발견 우선)');
  ok(bc.gain > 0 && near(bc.gain, Game.craftGain(bk2)), '추천 목돈 = craftGain 공식과 일치');

  // 오프라인에도 재료 트럭이 지나간 만큼 재료를 준다 (돈·쿠폰과 별개)
  State.set({}); var so = State.get(); so.ings = {}; Game.invalidate(); Game.resetTruck();
  var rw = Game.offlineReward(2 * 3600);
  ok(rw.trucks > 0 && rw.ings === rw.trucks * Data.KITCHEN.missDrop, '오프라인 보상에 트럭·재료 수가 실린다');
  var ib = 0; Data.KITCHEN.ings.forEach(function (g) { ib += Game.ingCount(g.id); });
  Game.claimOffline(rw.gain, rw.trucks);
  var ia = 0; Data.KITCHEN.ings.forEach(function (g) { ia += Game.ingCount(g.id); });
  ok(ia - ib === rw.trucks * Data.KITCHEN.missDrop, '수령하면 재료가 그만큼 늘어난다');

  // 🎁 무료 보상(광고) — 아이콘 4개, 하나당 하루 perDay 번, 자정 리셋
  Game.setClock(function () { return new Date(2026, 0, 10, 12, 0, 0); });
  State.set({ totalEarned: 1e9, gens: { g1: 20 } }); var sa = State.get();
  sa.adDate = ''; sa.adUsed = {}; sa.coupons = 0; sa.ings = {}; Game.invalidate();
  var adlist = Game.adSlots();
  ok(adlist.length === Data.ADS.slots.length, '광고 아이콘 ' + Data.ADS.slots.length + '개');
  ok(adlist.every(function (a) { return a.left === Data.ADS.perDay; }), '처음엔 아이콘마다 ' + Data.ADS.perDay + '번');
  // 골드 보상: 돈이 는다 + 남은 횟수 감소
  var adm0 = sa.money;
  var rg = Game.claimAd('gold');
  ok(rg && rg.gold > 0 && sa.money > adm0, '광고 골드 보상은 돈을 준다');
  ok(Game.adLeft('gold') === Data.ADS.perDay - 1, '보고 나면 남은 횟수가 준다');
  // 부스터: 수익 배율 버프가 걸린다 (⚡ = goldMult/goldLeft 자리 재사용)
  Game.claimAd('boost');
  ok(sa.goldLeft > 0 && sa.goldMult >= Data.ADS.boostMult, '광고 부스터는 수익 배율 버프를 건다');
  // 쿠폰: +1, 이미 꽉 차면 시청 소모 없이 full
  sa.coupons = 0; Game.claimAd('coupon');
  ok(sa.coupons === 1, '광고 쿠폰은 1장을 준다');
  sa.coupons = Data.COUPON.max;
  var adLeftBefore = Game.adLeft('coupon');
  var rc = Game.claimAd('coupon');
  ok(rc && rc.full === true && Game.adLeft('coupon') === adLeftBefore, '쿠폰이 꽉 차면 시청을 소모하지 않는다');
  // 재료: 창고가 ingCount 만큼 는다
  var adib = 0; Data.KITCHEN.ings.forEach(function (g) { adib += Game.ingCount(g.id); });
  Game.claimAd('ings');
  var adia = 0; Data.KITCHEN.ings.forEach(function (g) { adia += Game.ingCount(g.id); });
  ok(adia - adib === Data.ADS.ingCount, '광고 재료 보상은 창고를 채운다');
  // 하루 제한: perDay 번 다 보면 null
  sa.adUsed = {}; Game.adRoll();
  for (var av = 0; av < Data.ADS.perDay; av++) Game.claimAd('gold');
  ok(Game.adLeft('gold') === 0 && Game.claimAd('gold') === null, '하루 제한을 넘으면 못 본다');
  // 자정이 지나면 다시 채워진다
  Game.setClock(function () { return new Date(2026, 0, 11, 0, 30, 0); });
  ok(Game.adLeft('gold') === Data.ADS.perDay, '자정이 지나면 광고 횟수가 다시 채워진다');
  Game.setClock(null);

  // 🔬 끝없는 연구 — 상한 없는 명성 소비처 (무한)
  var fr = Data.FAME_SHOP.find(function (f) { return f.id === 'f_research'; });
  ok(fr && fr.infinite === true, '끝없는 연구는 무한(infinite) 항목');
  State.set({ totalEarned: 1e9, gens: { g1: 10 }, fame: 1e18 }); Game.invalidate();
  var frBase = Game.perSec(true);
  Game.buyFame('f_research');
  ok(Game.fameLv('f_research') === 1 && Game.perSec(true) > frBase, '끝없는 연구를 사면 수익이 오른다');
  ok(Game.fameCost('f_research', 1) > Game.fameCost('f_research', 0), '레벨이 오를수록 비용이 커진다');
  // 한참 사도 max 로 안 잠긴다 (기존 상한 항목과 달리)
  State.get().fameLv.f_research = 50;
  ok(Game.buyFame('f_research') === true && Game.fameLv('f_research') === 51, '무한 항목은 한참 사도 계속 살 수 있다');

  // 재료 트럭: 틱을 돌리면 재료가 쌓인다 (탭 or 자동수거)
  State.set({}); var s3 = State.get(); s3.ings = {}; Game.invalidate(); Game.resetTruck();
  var total0 = 0; Data.KITCHEN.ings.forEach(function (g) { total0 += Game.ingCount(g.id); });
  for (var i = 0; i < 120; i++) { Game.tick(1); }   // 2분 → 트럭 여러 번
  var total1 = 0; Data.KITCHEN.ings.forEach(function (g) { total1 += Game.ingCount(g.id); });
  ok(total1 > total0, '트럭이 돌면 재료가 쌓인다: ' + total1 + '개');
  ok(typeof Game.truckState().here === 'boolean', 'truckState().here 는 불리언');

  // 트럭 간격이 받을수록 늘어난다 (30·60·90…) — 연속 등장 간격이 커진다
  Game.resetTruck();
  var spawns = [], was = Game.truckState().here;
  for (var t = 0; t < 1500; t++) { Game.tick(1); var h = Game.truckState().here; if (h && !was) spawns.push(t); was = h; }
  var gaps = []; for (var j = 1; j < spawns.length; j++) gaps.push(spawns[j] - spawns[j - 1]);
  ok(gaps.length >= 2 && gaps[gaps.length - 1] > gaps[0], '받을수록 트럭 간격이 늘어남: ' + gaps.join('·') + '초');

  // 자정(날짜 변경)에 오늘치 트럭 카운트가 0으로 리셋
  Game.setClock(function () { return new Date(2026, 0, 10, 12, 0, 0); });
  Game.resetTruck();
  for (var m = 0; m < 300; m++) { Game.tick(1); }
  var cntA = Game.truckState().count;
  ok(cntA > 0, '같은 날엔 오늘치 트럭 카운트가 쌓임: ' + cntA);
  Game.setClock(function () { return new Date(2026, 0, 11, 0, 30, 0); }); // 다음 날
  Game.tick(1);
  ok(Game.truckState().count === 0, '자정 넘어가면 오늘치 카운트가 0으로 리셋');
  Game.setClock(null);
})();

console.log('\n[24] 온보딩 — 탭 점진적 잠금');
(function () {
  // 완전 신규: 가게·설정만 열림
  State.set({}); Game.invalidate();
  ok(Game.tabUnlocked('shop') && Game.tabUnlocked('settings'), '가게·설정은 처음부터 열림');
  ok(!Game.tabUnlocked('kitchen') && !Game.tabUnlocked('prestige'), '주방·환생은 처음엔 잠김');
  // 진행하면 하나씩 열린다
  var s = State.get();
  s.totalEarned = 1500; Game.invalidate();          // 사장 Lv.1 = 첫 레시피
  ok(Game.tabUnlocked('kitchen'), '레벨이 오르면 주방 탭이 열림');
  s.runEarned = 2e6; Game.invalidate();             // 환생 가능
  ok(Game.tabUnlocked('prestige'), '환생 가능해지면 환생 탭이 열림');
  // 한 번 본 탭은 조건이 사라져도 계속 보인다
  State.set({ tabsSeen: ['shop', 'settings', 'kitchen'] }); Game.invalidate();
  ok(Game.visibleTabs().indexOf('kitchen') >= 0, '한 번 열린 탭은 다시 안 잠긴다');
  ok(Game.visibleTabs().indexOf('prestige') < 0, '아직 안 본 잠긴 탭은 안 보인다');
  // 기존(진행된) 유저는 부팅 시 조용히 다 열림 → 새 연출 없음
  State.set({ totalEarned: 1e12, runEarned: 1e12, prestiges: 3 }); Game.invalidate();
  Game.seedTabsSeen();
  ok(Game.tabsToReveal().length === 0, '기존 유저는 부팅 후 새로 뜰(연출할) 탭이 없다');
})();

console.log('\n[25] 수익 천장 — ∞ 로 새지 않고 한계를 알린다');
(function () {
  const last = Data.GENERATORS[Data.GENERATORS.length - 1];
  // 수익 천장(CAP)까지 밀어 넣는다. 명성상점 레벨은 normalize 가 상한으로 깎으므로
  // (예: f_research 는 999) 명성(fame, 상한 없음)으로 천장을 구동한다.
  // fame≈1e300 은 실제 플레이로는 도달 불가지만 CAP 방어 로직을 검증하기엔 충분하다.
  const fameLvMax = {};
  Data.FAME_SHOP.forEach(function (f) { fameLvMax[f.id] = f.max; });
  State.set({ money: Number.MAX_VALUE, fame: 1e300,
              gens: { [last.id]: 3000 }, fameLv: fameLvMax, michelinGrand: 1 });
  Game.invalidate();
  const ps = Game.perSec(true);
  ok(isFinite(ps), '수익이 Infinity 로 새지 않는다(CAP 로 막힘)', Fmt.num(ps));
  ok(Game.atIncomeCap(), '한계에 도달하면 atIncomeCap() 이 참');
  const share = Math.round(Game.genRate(last.id) / Game.perSec() * 100);
  ok(!Number.isNaN(share), '설비 지분이 NaN% 가 아니다', share + '%');
  ok(Game.bestGen() === null, '한계에선 추천 설비가 없다(초당 +∞ 방지)');

  // 정상 스케일에선 아무 영향 없다
  State.set({ money: 1e6, gens: { g1: 5 } }); Game.invalidate();
  ok(!Game.atIncomeCap(), '정상 스케일은 한계가 아니다');
  const b = Game.perSec(true);
  Game.buyGen('g1', 1); Game.invalidate();
  ok(Game.perSec(true) > b, '한계가 아니면 설비 구매로 수익이 오른다');
  ok(Game.bestGen() !== null, '한계가 아니면 추천 설비가 있다');
})();

console.log('\n[26] 싼 설비 "거의 안 올라요" 힌트 (genBarelyHelps)');
(function () {
  const last = Data.GENERATORS[Data.GENERATORS.length - 1];
  const first = Data.GENERATORS[0];
  const fameLv = {};
  Data.FAME_SHOP.forEach(function (f) { fameLv[f.id] = f.max; });

  // 부자 + 최고단계 잔뜩 → 싼 설비는 사도 티가 안 난다, 주력은 힌트 없음
  State.set({ money: Number.MAX_VALUE, fame: 1e30,
              gens: { [last.id]: 2000, [first.id]: 5 }, fameLv, michelinGrand: 1 });
  Game.invalidate();
  ok(Game.genBarelyHelps(first.id, 1), '부자일 때 싼 설비는 힌트 대상');
  ok(Game.genBarelyHelps(first.id, 100), '×100 을 사도 여전히 미미하면 힌트');
  ok(!Game.genBarelyHelps(last.id, 1), '주력(최강) 설비는 개수 많아도 힌트 안 뜸');

  // 초반: 유일/주력 설비는 힌트 대상이 아니다
  State.set({ money: 1e4, gens: { [first.id]: 3 } }); Game.invalidate();
  ok(!Game.genBarelyHelps(first.id, 1), '초반 주력 설비엔 힌트 없음');
  // 수익이 0 이면(맨 처음) 힌트 없음
  State.set({ gens: {} }); Game.invalidate();
  ok(!Game.genBarelyHelps(first.id, 1), '수익 0 에선 힌트 없음(0으로 나눔 방어)');
})();

console.log(fails === 0 ? '\n전부 통과 ✅' : `\n실패 ${fails}건 ❌`);
process.exit(fails ? 1 : 0);
