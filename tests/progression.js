/* 진행 속도와 단계 도달성 — 실제로 플레이하면 언제 무엇이 열리는지 잰다.
   밸런스 수치를 건드렸다면 반드시 이걸 돌려 결과를 확인할 것.
   실행: node tests/progression.js */
const { load, autoBuy, humanTap } = require('./_harness');
const { Fmt, Data, State, Game } = load();


// 24시간 + 환생 2회까지 이어서, 단계가 언제 오르는지 기록
let food=-1, crowd=-1;
const log=[];
let elapsed=0, prestiges=0;
for(let t=0;t<=7*24*3600;t++){
  Game.tick(1);
  // 실제 플레이처럼: 회차 초반엔 열심히 탭하고, 이후엔 가끔 들러 잠깐씩 탭한다
  const early = State.get().runEarned < 2000;
  const checkIn = (t % 1800) < 20;
  if (early || checkIn) {
    for (let k=0;k<3;k++) Game.tap(true, t*1000+k*330+Math.random()*120, 100+Math.random()*14, 100+Math.random()*14);
  }
  Game.checkAchievements();
  if(t%5===0)autoBuy(Data, State, Game);
  elapsed=t;
  const f=Game.tapStep(), c=Game.crowdTier();
  if(f.index!==food){ food=f.index; log.push(['🍽 음식', Fmt.time(t), `${f.index+1}단계 ${f.step.icon} ${f.step.name}`, '탭 '+Fmt.won(Game.tapBaseValue())]); }
  if(c.index!==crowd){ crowd=c.index; log.push(['🚶 손님', Fmt.time(t), `${c.index+1}등급 ${c.cast.join('')}`, '초당 '+Fmt.won(Game.perSec(true))]); }
  // 환생 가능해지고 명성이 충분히 쌓이면 환생 (실제 플레이처럼)
  if(prestiges<8 && Game.fameGain()>=Math.max(30, State.get().fame*0.6)){ Game.doPrestige(); prestiges++; log.push(['✨ 환생', Fmt.time(t), `${prestiges}회차 · 명성 ${State.get().fame}`, '']); food=-1; crowd=-1; }
}
console.log('7일 자동 플레이 (환생 반복)\n');
log.forEach(r=>console.log(`${r[0]}  ${r[1].padEnd(10)} ${r[2].padEnd(26)} ${r[3]}`));
console.log(`\n최종: ${Game.tapStep().index+1}/8 단계, 손님 ${Game.crowdTier().index+1}/5 등급`);
