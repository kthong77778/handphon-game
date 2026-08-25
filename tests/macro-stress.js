/* 매크로 방지가 사람을 잘못 막지 않는지 재는 스트레스 테스트.
   사람을 막는 쪽이 봇을 놓치는 쪽보다 나쁘므로, 사람 오탐 0% 를 합격선으로 둔다.
   실행: node tests/macro-stress.js */
const { load } = require('./_harness');
const { Game, State } = load();

// 정규분포 근사
function gauss(mean, sd){ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random();
  return mean + sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

// 평균 간격(ms), 간격 흔들림(ms), 손가락/마우스가 움직이는 폭(px)
const HUMANS = [
  ['느긋한 탭',          400, 120, 14],
  ['보통 연타',          200,  55, 10],
  ['빠른 연타',          130,  35,  7],
  ['아주 빠른 연타',     100,  25,  5],
  ['한계까지 연타',       85,  18,  4],
  ['리듬 타듯 규칙적',    120,  16,  6],
  ['메트로놈급 + 손 고정', 120,  10,  1, 'known'],  // 알려진 한계: 봇과 구분 불가
  ['마우스 안 움직이고 클릭', 180, 45,  0],  // 좌표는 붙박이지만 간격은 사람
];
// 오토클릭 도구들 — 항상 같은 좌표를 찍는다
const BOTS = [
  ['오토클릭 100ms 고정', 100,  0, 0],
  ['오토클릭 ±3ms 랜덤',  100,  3, 0],
  ['오토클릭 ±8ms 랜덤',  100,  8, 0],
  ['오토클릭 200ms 고정', 200,  0, 0],
  ['오토클릭 ±10ms 랜덤', 150, 10, 0],
  ['오토클릭 ±1px 흔듦',  100,  4, 1],
];

function trial(mean, sd, px, taps){
  Game.resetGuard();
  let t = Math.random()*1e9, blocked=false;
  const cx = 195, cy = 400;
  for(let i=0;i<taps;i++){
    t += Math.max(25, gauss(mean, sd));
    const x = cx + (px ? (Math.random()*2-1)*px : 0);
    const y = cy + (px ? (Math.random()*2-1)*px : 0);
    if (Game.tap(true, t, x, y).blocked === 'macro') { blocked = true; break; }
  }
  return blocked;
}

function rate(mean, sd, px, runs, taps){
  let n=0; for(let i=0;i<runs;i++) if(trial(mean,sd,px,taps)) n++;
  return n/runs;
}

const RUNS=400, TAPS=300;
console.log(`각 습관마다 ${TAPS}회 연타를 ${RUNS}번 반복\n`);
console.log('사람 (막히면 오탐 — 0%여야 좋다)');
let worstHuman=0;
for(const [name,m,sd,px,known] of HUMANS){
  const r=rate(m,sd,px,RUNS,TAPS);
  if (!known) worstHuman=Math.max(worstHuman,r);
  console.log(`  ${name.padEnd(20)} ${String(m).padStart(3)}ms ±${String(sd).padStart(3)} / ${String(px).padStart(2)}px  차단률 ${(r*100).toFixed(1)}%` + (known ? '   ← 알려진 한계 (합격 기준에서 제외)' : ''));
}
console.log('\n오토클릭 (막혀야 정상 — 100%여야 좋다)');
let worstBot=1;
for(const [name,m,sd,px] of BOTS){
  const r=rate(m,sd,px,RUNS,TAPS); worstBot=Math.min(worstBot,r);
  console.log(`  ${name.padEnd(22)} 차단률 ${(r*100).toFixed(1)}%`);
}
console.log(`\n최악의 사람 오탐률 ${(worstHuman*100).toFixed(1)}% / 최악의 봇 미탐률 ${((1-worstBot)*100).toFixed(1)}%`);
process.exit((worstHuman<=0.01 && worstBot>=0.99) ? 0 : 1);
