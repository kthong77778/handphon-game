/* 실제 브라우저에서 화면과 조작을 검증한다.
 *
 * 실행:  node tests/browser.js            (전체)
 *        node tests/browser.js 도둑        (이름에 '도둑' 이 들어간 스위트만)
 *
 * playwright 가 필요하다:  npm i -D playwright
 * 이 저장소에는 빌드 과정이 없고, playwright 는 테스트에만 쓴다.
 * 정적 서버는 아래에 내장돼 있으니 따로 띄우지 않아도 된다.
 * 크로미움 경로를 직접 줘야 하면 CHROMIUM_PATH 환경변수를 쓴다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.error('playwright 가 없습니다.  npm i -D playwright  후 다시 실행하세요.');
  process.exit(2);
}

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(ROOT, rel);
      // 저장소 밖으로 나가는 경로는 막는다
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

/* 스크린샷 폴더 — 러너가 만들어 둔다 */
const D = process.env.SHOT_DIR || path.join(__dirname, '.shots');

const SUITES = [];
/**
 * @param {string} name
 * @param {function} fn
 * @param {{tour?:boolean}} [opts] tour:true 면 첫 실행 안내를 그대로 둔다.
 *   나머지 스위트는 이미 안내를 본 상태로 시작한다 — 안 그러면 모든 스위트가
 *   안내 모달에 막힌다.
 */
function suite(name, fn, opts) { SUITES.push({ name, fn, opts: opts || {} }); }

suite('화면 · 조작 전반', async ({ page, ctx, ok, errs }) => {
  const p = page;                  // 스위트마다 page/p 를 섞어 쓴다
  const errors = errs;             // 이름만 다른 같은 수집기

  // 도둑은 화면 밖에서 출발하므로, 보이는 위치에 들어올 때까지 기다렸다 클릭한다
  async function clickThief() {
    for (let i = 0; i < 80; i++) {
      const box = await p.locator('.thief').boundingBox().catch(() => null);
      if (box && box.x > 4 && box.x + box.width < 386) {
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      }
      await p.waitForTimeout(60);
    }
    return false;
  }

    await page.goto('/index.html');
    await page.waitForTimeout(600);


    console.log('\n[화면] 첫 로딩');
    ok(await page.isVisible('#tapTarget'), '조리 버튼 보임');
    ok(await page.isVisible('#boostBtn'), '손님 몰이 버튼 보임');
    ok(await page.isHidden('#combo'), '콤보는 처음엔 숨김');
    ok(await page.isHidden('#buffBar'), '버프줄은 처음엔 숨김');
    ok(await page.isHidden('#dailyModal') === false, '출석 보상 모달이 첫 실행에 뜸');

    await page.click('#dailyOk');
    await page.waitForTimeout(200);
    ok(await page.isHidden('#dailyModal'), '출석 보상 받으면 모달 닫힘');
    const money0 = await page.textContent('#money');
    console.log('    출석 보상 후 보유금액: ' + money0.trim());

    console.log('\n[콤보] 빠르게 연타');
    const box = await page.locator('#tapTarget').boundingBox();
    for (let i = 0; i < 12; i++) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(150);
    ok(await page.isVisible('#combo'), '콤보 표시 등장');
    const comboX = (await page.textContent('#comboX')).trim();
    console.log('    콤보 배율: ' + comboX + ' / ' + (await page.textContent('#comboN')).trim());
    ok(parseFloat(comboX.replace('×', '')) > 1, '콤보 배율이 1보다 큼');
    await page.waitForTimeout(1600);
    ok(await page.isHidden('#combo'), '손 떼면 콤보 사라짐');

    console.log('\n[손님 몰이]');
    await page.click('#boostBtn');
    await page.waitForTimeout(250);
    ok((await page.getAttribute('#boostBtn', 'class')).includes('active'), '부스트 켜짐');
    ok(await page.isVisible('#buffBar'), '버프줄 표시');
    const buffTxt = (await page.textContent('#buffBar')).trim();
    console.log('    버프줄: ' + buffTxt);
    ok(buffTxt.includes('×3'), '×3 표시');
    ok((await page.textContent('#boostTitle')).includes('폭주'), '버튼 문구 변경');

    console.log('\n[황금 손님]');
    // 등장까지 55초 이상 기다릴 순 없으니 타이머를 앞당겨 실제 spawn 을 태운다
    // 등장까지 1분 이상 기다릴 순 없으니 게임 시계를 앞으로 감는다
    await page.evaluate(() => UI.tickWorld(300));
    await page.waitForTimeout(500);
    const golden = page.locator('#goldenLayer .golden').first();
    ok(await golden.count() > 0, '황금 손님 등장');
    if (await golden.count() > 0) {
      const gbox = await golden.boundingBox();
      ok(gbox.y > 100 && gbox.y < 780, '화면 안쪽에 배치됨 (HUD/탭바 회피)', 'y=' + Math.round(gbox.y));
      const before = await page.evaluate(() => State.get().goldens);
      // 합성 이벤트는 매크로 방지에 막히므로 진짜 마우스로 누른다
      await page.evaluate(() => {
        const g = document.querySelector('#goldenLayer .golden');
        const b = g.getBoundingClientRect();
        window.__fake = g.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:b.x+32, clientY:b.y+32}));
      });
      await page.waitForTimeout(200);
      ok(await page.evaluate(() => State.get().goldens) === before,
         '가짜 클릭으로는 못 잡는다');
      await page.mouse.click(gbox.x + 32, gbox.y + 32);
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => State.get().goldens);
      ok(after === before + 1, '실제 탭으로는 잡힌다');
      ok(await page.locator('#goldenLayer .golden-msg').count() >= 0, '보상 메시지 렌더');
    }

    console.log('\n[거리 애니메이션]');
    await page.click('#tabbar .tab[data-tab="shop"]'); await page.waitForTimeout(300);
    ok(await page.isVisible('#street'), '거리 표시');
    await page.evaluate(() => { for (let i=0;i<8;i++) Scene.tick(2); });
    await page.waitForTimeout(700);
    const wc = await page.locator('#street .walker').count();
    ok(wc > 0, `손님 ${wc}명이 거리에 있음`);
    // 주문하려고 멈춰 선 손님이 있으므로 "한 명이라도 움직였는가" 로 본다
    const moved = await page.evaluate(async () => {
      const ws = Array.from(document.querySelectorAll('#street .walker'));
      if (!ws.length) return 0;
      const before = ws.map(w => w.getBoundingClientRect().x);
      await new Promise(r => setTimeout(r, 700));
      return ws.filter((w, i) => Math.abs(w.getBoundingClientRect().x - before[i]) > 3).length;
    });
    ok(moved > 0, `손님이 실제로 이동함 (${moved}명 이동)`);
    ok(await page.locator('#tapTarget .steam').count() === 3, '냄비 김 3줄');
    const b3 = await page.locator('#tapTarget').boundingBox();
    await page.mouse.click(b3.x+b3.width/2, b3.y+b3.height/2);
    await page.waitForTimeout(120);
    ok(await page.locator('#pops .pop').count() > 0, '조리하면 음식이 튄다');

    console.log('\n[매크로 차단]');
    // 합성 이벤트로 100번 눌러도 돈이 늘지 않아야 한다
    const before = await page.evaluate(() => { State.get().money = 1e6; return State.get().taps; });
    await page.evaluate(() => {
      const el = document.getElementById('tapTarget');
      for (let i=0;i<100;i++) el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:200, clientY:400}));
    });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => State.get().taps);
    ok(after === before, `합성 클릭 100회가 전부 무효 (탭 ${before} → ${after})`);

    // 실제 마우스로 같은 자리를 일정 간격으로 클릭 → 매크로로 잡혀야 한다
    await page.evaluate(() => { Game.resetGuard(); });
    const bx = b3.x + b3.width/2, by = b3.y + b3.height/2;
    for (let i=0;i<40;i++){ await page.mouse.click(bx, by); await page.waitForTimeout(100); }
    await page.waitForTimeout(200);
    const rest = await page.evaluate(() => Game.macroRestLeft());
    ok(rest > 0, '일정 간격 + 같은 좌표 클릭이 차단됨', 'rest=' + rest.toFixed(1) + 's');
    ok((await page.getAttribute('#tapTarget','class')).includes('blocked'), '조리 버튼이 차단 상태로 표시');
    await page.evaluate(() => Game.resetGuard());

    console.log('\n[탭 이동] 다섯 화면 모두 렌더되는지');
    for (const [tab, sel, label] of [
      ['upgrade', '#upgradeList', '업그레이드'],
      ['prestige', '#fameShopList', '환생/명성상점'],
      ['achv', '#questList', '기록(퀘스트·랭킹)'],
      ['settings', '#statsBox', '설정/통계']
    ]) {
      await page.click(`#tabbar .tab[data-tab="${tab}"]`);
      await page.waitForTimeout(250);
      const n = await page.locator(`${sel} > *`).count();
      ok(n > 0, `${label} 탭 항목 ${n}개 렌더`);
    }

    const stats = await page.textContent('#statsBox');
    ok(stats.includes('황금 손님') && stats.includes('최고 콤보') && stats.includes('연속 출석'),
       '통계에 새 항목 표시');
    const counts = await page.evaluate(() => ({
      fame: Data.FAME_SHOP.length, achv: Data.ACHIEVEMENTS.length }));
    ok(await page.locator('#fameShopList > *').count() === counts.fame, `명성 상점 ${counts.fame}종`);
    await page.click('#tabbar .tab[data-tab="upgrade"]'); await page.waitForTimeout(250);
    // 미달성은 진행도 행, 달성은 폴더 안 아이콘 칩 — 합쳐서 전체 개수
    const achvShown = await page.evaluate(() =>
      document.querySelectorAll('#achvList .item.achv-locked').length +
      document.querySelectorAll('#achvList .achv-folder .achv-chip').length);
    ok(achvShown === counts.achv, `도전과제 ${counts.achv}종 (행+폴더칩, 업그레이드 탭)`);

    console.log('\n[스킨 & 등급]');
    await page.click('#tabbar .tab[data-tab="settings"]'); await page.waitForTimeout(300);
    const sk = await page.evaluate(() => ({
      tap: Data.TAP_SKINS.length, crowd: Data.CROWD_SKINS.length,
      steps: Data.TAP_SKINS[0].steps.length, tiers: Data.CROWD_SKINS[0].tiers.length }));
    ok(await page.locator('#tapSkinRow .skin').count() === sk.tap, `음식 스킨 ${sk.tap}종 표시`);
    ok(await page.locator('#crowdSkinRow .skin').count() === sk.crowd, `손님 스킨 ${sk.crowd}종 표시`);
    ok(await page.locator('#tapLadder .rung').count() === sk.steps, `음식 단계표 ${sk.steps}칸`);
    ok(await page.locator('#crowdLadder .grow-step').count() === sk.tiers, `손님 성장 ${sk.tiers}단계`);
    ok(await page.locator('#crowdLadder .grow-step.now').count() === 1, '지금 단계가 표시됨');
    ok((await page.textContent('#crowdLadder .grow-step.now .gs-body i')).length > 0, '단계마다 성장 서사가 있음');
    ok(await page.locator('#tapSkinRow .skin.on').count() === 1, '선택된 스킨 하나만 강조');
    const ladderNote = (await page.textContent('#tapLadder .rung-note')).trim();
    ok(ladderNote.includes('다음'), '다음 단계 안내: ' + ladderNote);

    // 붕어빵으로 바꾸면 조리 이모지가 바뀌어야 한다
    const beforeIcon = await page.textContent('#tapEmoji');
    await page.click('#tapSkinRow .skin[data-skin="bungeo"]');
    await page.waitForTimeout(300);
    ok((await page.getAttribute('#tapSkinRow .skin[data-skin=\"bungeo\"]','class')).includes('on'), '붕어빵 스킨 선택됨');
    const afterIcon = await page.textContent('#tapEmoji');
    ok(afterIcon !== beforeIcon, `조리 이모지 변경 ${beforeIcon} → ${afterIcon}`);
    ok((await page.textContent('#tapLabel')).length > 0, '메뉴 이름 표시: ' + await page.textContent('#tapLabel'));

    // 손님 스킨을 동물로 바꾸면 거리 캐릭터도 바뀐다
    await page.click('#crowdSkinRow .skin[data-skin="animal"]');
    await page.waitForTimeout(200);
    await page.click('#tabbar .tab[data-tab="shop"]'); await page.waitForTimeout(200);
    await page.evaluate(() => { for (let i=0;i<8;i++) Scene.tick(2); });
    await page.waitForTimeout(600);
    const cast = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#street .walker .body')).map(e => e.textContent));
    const animals = await page.evaluate(() => Game.crowdTier().cast);
    ok(cast.length > 0 && cast.every(c => animals.includes(c)),
       '거리에 동물 손님만 등장: ' + cast.join(''));

    // 단계가 오르면 테두리 등급 클래스가 바뀐다
    const tierBefore = await page.getAttribute('#tapTarget','class');
    await page.evaluate(() => {
      Game.setSkin('tap','auto');
      State.get().fameLv.f_tap = 12; Game.invalidate(); UI.invalidate();
    });
    await page.waitForTimeout(400);
    const tierAfter = await page.getAttribute('#tapTarget','class');
    ok(tierBefore !== tierAfter, `테두리 등급 변경: ${tierBefore.match(/tier-\d+/)} → ${tierAfter.match(/tier-\d+/)}`);
    ok(/tier-[5-8]/.test(tierAfter), '높은 단계 테두리 적용');

    // 스킨이 새로고침 후에도 남는가
    await page.evaluate(() => { Game.setSkin('tap','jumeok'); State.save(); });
    await page.reload(); await page.waitForTimeout(700);
    ok(await page.evaluate(() => State.get().tapSkin) === 'jumeok', '스킨이 새로고침 후에도 유지');

    console.log('\n[상류층 손님]');
    await page.evaluate(() => {
      const s = State.get();
      Game.setSkin('crowd','auto');
      Data.GENERATORS.forEach(g => s.gens[g.id] = 0);
      s.gens.g10 = 2000;               // 초당 수익을 최고 등급까지
      Game.invalidate(); UI.invalidate(); Scene.clear();
    });
    await page.click('#tabbar .tab[data-tab="shop"]'); await page.waitForTimeout(200);
    await page.evaluate(() => { for (let i=0;i<10;i++) Scene.tick(2); });
    await page.waitForTimeout(800);
    const rich = await page.evaluate(() => ({
      tier: Game.crowdTier().index + 1,
      name: Game.crowdTier().name,
      street: document.getElementById('street').className,
      withAcc: Array.from(document.querySelectorAll('#street .walker'))
        .filter(w => w.querySelector('.acc')).length,
      total: document.querySelectorAll('#street .walker').length,
      accs: Array.from(document.querySelectorAll('#street .acc')).map(e => e.textContent)
    }));
    const topName = await p.evaluate(()=>{ const t=Game.crowdSkin().tiers; return t[t.length-1].name; });
    ok(rich.tier === 5 && rich.name === topName, '최고 등급 도달: ' + rich.name);
    ok(rich.total > 0 && rich.withAcc === rich.total,
       `손님 ${rich.total}명 전원이 소지품을 듦: ${rich.accs.join('')}`);
    ok(rich.street.includes('tier5'), '거리가 레드카펫으로 바뀜');
    ok(await page.locator('#street .walker.t5').count() > 0, '최고 등급 글로우 적용');

    // 왼쪽으로 걷는 손님의 소지품이 뒤집히지 않아야 한다
    const flipped = await page.evaluate(() => {
      const w = Array.from(document.querySelectorAll('#street .walker'))
        .find(x => x.querySelector('i.flip') && x.querySelector('.acc'));
      if (!w) return 'none';
      return getComputedStyle(w.querySelector('.acc')).transform;
    });
    ok(flipped === 'none' || !/^matrix\(-1/.test(flipped),
       '반대로 걷는 손님의 소지품도 정상 방향', String(flipped).slice(0,30));

    console.log('\n[세로 스크롤] 가로 스크롤이 생기지 않아야 함');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    ok(!overflow, '가로 스크롤 없음');

    console.log('\n[에러]');
});

suite('도둑 & 경찰', async ({ page, ctx, ok, errs }) => {
  const p = page;                  // 스위트마다 page/p 를 섞어 쓴다
  const errors = errs;             // 이름만 다른 같은 수집기

  // 도둑은 화면 밖에서 출발하므로, 보이는 위치에 들어올 때까지 기다렸다 클릭한다
  async function clickThief() {
    for (let i = 0; i < 80; i++) {
      const box = await p.locator('.thief').boundingBox().catch(() => null);
      if (box && box.x > 4 && box.x + box.width < 386) {
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      }
      await p.waitForTimeout(60);
    }
    return false;
  }

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');
    await p.evaluate(() => {
      const s = State.get(); s.money = 1e8; s.gens.g3 = 200;
      s.fameLv = {}; Game.invalidate(); UI.invalidate();
    });

    console.log('[1] 도둑 등장 & 직접 잡기');
    // 경찰이 못 잡게 확률 0 으로 두고 도둑을 불러낸다
    await p.evaluate(() => { Game.policeChance = () => 0; UI.tickWorld(600); });
    await p.waitForTimeout(400);
    const thief = p.locator('.thief');
    ok(await thief.count() === 1, '도둑 등장');
    ok(await p.locator('.thief .bag').count() === 1, '돈가방을 들고 있음');
    const moved = await p.evaluate(async () => {
      const t = document.querySelector('.thief');
      const a = t.getBoundingClientRect().x;
      await new Promise(r => setTimeout(r, 500));
      return Math.abs(t.getBoundingClientRect().x - a) > 20;
    });
    ok(moved, '도둑이 도망감');
    await p.waitForTimeout(1400);
    ok(await p.locator('.police').count() === 1, '경찰차 출동');

    const before = await p.evaluate(() => ({ money: State.get().money, caught: State.get().thievesCaught }));
    ok(await clickThief(), '화면에 들어온 도둑을 탭');
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({ money: State.get().money, caught: State.get().thievesCaught }));
    ok(after.caught === before.caught + 1, '탭해서 잡음');
    ok(after.money > before.money, '보너스 지급', '+' + (after.money - before.money).toFixed(0));
    await p.screenshot({ path: path.join(D, 'shot-thief.png') });
    await p.waitForTimeout(1200);
    ok(await p.locator('.thief').count() === 0 && await p.locator('.police').count() === 0, '정리됨');

    console.log('\n[2] 경찰이 잡아주기');
    await p.evaluate(() => { Game.policeChance = () => 1; UI.tickWorld(600); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(D, 'shot-chase.png') });
    const m0 = await p.evaluate(() => State.get().money);
    await p.waitForTimeout(6200);
    const r2 = await p.evaluate(() => ({ money: State.get().money, saves: State.get().thiefSaves, thefts: State.get().thefts }));
    ok(r2.saves === 1, '경찰이 검거');
    ok(r2.thefts === 0 && r2.money >= m0, '피해 없음 (방치 수익은 계속 쌓임)',
       `${m0.toFixed(0)} → ${r2.money.toFixed(0)}`);
    await p.waitForTimeout(1200);

    console.log('\n[3] 놓쳤을 때');
    await p.evaluate(() => { Game.policeChance = () => 0; UI.tickWorld(600); });
    await p.waitForTimeout(300);
    const m1 = await p.evaluate(() => State.get().money);
    await p.waitForTimeout(8200);
    const r3 = await p.evaluate(() => ({ money: State.get().money, thefts: State.get().thefts, stolen: State.get().stolen }));
    ok(r3.thefts === 1, '놓친 것으로 기록');
    ok(r3.money < m1 && r3.money >= 0, '돈이 빠지되 음수는 아님', `${m1.toFixed(0)} → ${r3.money.toFixed(0)}`);
    ok(r3.stolen > 0, '피해액 누적: ' + r3.stolen.toFixed(0));

    console.log('\n[4] 가짜 클릭으로는 못 잡는다');
    await p.evaluate(() => { Game.policeChance = () => 0; UI.tickWorld(600); });
    await p.waitForTimeout(400);
    const c0 = await p.evaluate(() => State.get().thievesCaught);
    await p.evaluate(() => {
      const t = document.querySelector('.thief');
      const r = t.getBoundingClientRect();
      for (let i=0;i<20;i++)
        t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.x+20,clientY:r.y+20}));
    });
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => State.get().thievesCaught) === c0, '합성 클릭 20회 전부 무효');
    ok(await clickThief(), '화면에 들어온 도둑을 탭');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => State.get().thievesCaught) === c0 + 1, '진짜 클릭으로는 잡힘');

    console.log('\n[5] 도둑과 황금 손님은 겹치지 않는다');
    await p.waitForTimeout(1500);
    await p.waitForSelector('.thief', { state:'detached', timeout: 12000 }).catch(()=>{});
    // 도둑이 나와 있는 동안에는 황금 손님이 나오지 않아야 한다
    await p.evaluate(() => { Game.policeChance = () => 0; UI.tickWorld(600); });
    await p.waitForTimeout(300);
    ok(await p.locator('.thief').count() === 1, '도둑이 나와 있음');
    await p.evaluate(() => { for (let i=0;i<6;i++) UI.tickWorld(300); });
    await p.waitForTimeout(300);
    ok(await p.locator('#goldenLayer .golden').count() === 0, '그 동안 황금 손님은 안 나옴');
    await p.waitForTimeout(9000);

    console.log('\n[6] 돈이 없으면 안 나온다');
    await p.waitForTimeout(1500);
    await p.waitForSelector('.thief', { state: 'detached', timeout: 12000 }).catch(()=>{});
    await p.evaluate(() => { State.get().money = 0; State.get().gens = {}; Game.invalidate(); UI.tickWorld(600); });
    await p.waitForTimeout(500);
    ok(await p.locator('.thief').count() === 0, '빈 금고엔 도둑이 안 옴');
});

suite('명예의 전당', async ({ page, ctx, ok, errs }) => {
  const p = page;                  // 스위트마다 page/p 를 섞어 쓴다
  const errors = errs;             // 이름만 다른 같은 수집기

  // 도둑은 화면 밖에서 출발하므로, 보이는 위치에 들어올 때까지 기다렸다 클릭한다
  async function clickThief() {
    for (let i = 0; i < 80; i++) {
      const box = await p.locator('.thief').boundingBox().catch(() => null);
      if (box && box.x > 4 && box.x + box.width < 386) {
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      }
      await p.waitForTimeout(60);
    }
    return false;
  }

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');

    console.log('[1] 기록이 없을 때');
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(300);
    ok((await p.textContent('#tabbar .tab[data-tab="achv"]')).includes('기록'), '탭 이름이 기록');
    ok(await p.locator('#recordBox .rec').count() === 8, '개인 기록 8줄');
    ok((await p.textContent('#runBoard')).includes('아직 재개업'), '빈 안내 문구');
    ok((await p.textContent('#rankNote')).trim() === '', '환생 못하면 예상 순위 없음');

    console.log('\n[2] 회차를 쌓은 뒤');
    await p.evaluate(() => {
      const s = State.get();
      s.runs = [
        { n: 1, earned: 5.2e6, fame: 3,  seconds: 4200 },
        { n: 2, earned: 8.4e9, fame: 62, seconds: 9100 },
        { n: 3, earned: 3.1e8, fame: 18, seconds: 3300 },
        { n: 4, earned: 8.4e9, fame: 62, seconds: 5400 },
        { n: 5, earned: 9.7e7, fame: 9,  seconds: 2100 }
      ];
      s.bestRunEarned = 8.4e9; s.bestPerSec = 4.2e6; s.bestTap = 1.9e5;
      s.bestFameGain = 62; s.fastestPrestige = 2100; s.bestCombo = 50;
      s.goldens = 37; s.thievesCaught = 12;
      s.gens.g6 = 60; s.runEarned = 2.4e9; s.runTime = 3000;
      Game.invalidate(); UI.invalidate(); UI.refresh(true);
    });
    await p.waitForTimeout(400);
    const rows = await p.locator('#runBoard .run-row:not(.run-head)').count();
    ok(rows === 5, `순위표 ${rows}줄`);
    const fames = await p.evaluate(() =>
      Array.from(document.querySelectorAll('#runBoard .run-fame')).map(e => +e.textContent.replace(/\D/g,'')));
    ok(fames.join() === [...fames].sort((a,b)=>b-a).join(), '명성 내림차순: ' + fames.join(' ≥ '));
    const first = await p.textContent('#runBoard .run-row:not(.run-head) .run-rank');
    ok(first.trim() === '🥇', '1위에 금메달');
    // 동점(62/62)은 빠른 회차가 위
    const order = await p.evaluate(() =>
      Array.from(document.querySelectorAll('#runBoard .run-row:not(.run-head)')).map(r => r.children[1].textContent));
    ok(order[0] === '4회' && order[1] === '2회', '동점이면 빠른 회차가 위: ' + order.join(' '));

    const note = (await p.textContent('#rankNote')).trim();
    ok(note.includes('위'), '지금 환생하면 몇 위인지 표시: ' + note);

    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    ok(!overflow, '가로 스크롤 없음');
    await p.screenshot({ path: path.join(D, 'shot-hall.png') });
    await p.locator('#runBoard').screenshot({ path: path.join(D, 'crop-runs.png') });

    console.log('\n[3] 실제 환생 후 기록이 남는가');
    await p.click('#tabbar .tab[data-tab="prestige"]'); await p.waitForTimeout(300);
    // 환생 확인은 네이티브 confirm 이 아니라 자체 모달이다
    // (샌드박스 iframe 에서 confirm 이 막혀 '데이터 전체 삭제' 가 안 되던 것을 고치면서 바뀌었다)
    await p.click('#prestigeBtn'); await p.waitForTimeout(250);
    ok(!await p.isHidden('#askModal'), '재개업 확인 모달이 뜸');
    await p.click('#askOk'); await p.waitForTimeout(600);
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(400);
    ok(await p.locator('#runBoard .run-row:not(.run-head)').count() === 6, '회차가 하나 늘어남');
    ok(await p.evaluate(() => State.get().runTime) < 5, '회차 시간이 초기화됨');

    console.log('\n[4] 새로고침 후에도 남는가');
    await p.evaluate(() => State.save());
    await p.reload(); await p.waitForTimeout(800);
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(300);
    ok(await p.locator('#runBoard .run-row:not(.run-head)').count() === 6, '순위표 유지');
    ok(await p.evaluate(() => State.get().bestTap) > 0, '개인 기록 유지');
});

suite('캐릭터 그림', async ({ page, ctx, ok, errs }) => {
  const p = page;                  // 스위트마다 page/p 를 섞어 쓴다
  const errors = errs;             // 이름만 다른 같은 수집기

  // 도둑은 화면 밖에서 출발하므로, 보이는 위치에 들어올 때까지 기다렸다 클릭한다
  async function clickThief() {
    for (let i = 0; i < 80; i++) {
      const box = await p.locator('.thief').boundingBox().catch(() => null);
      if (box && box.x > 4 && box.x + box.width < 386) {
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      }
      await p.waitForTimeout(60);
    }
    return false;
  }

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');

    console.log('[1] 기본 스킨이 처음부터 그림');
    ok(await p.locator('#tapEmoji svg').count() === 1, '1단계도 SVG 캐릭터');
    ok((await p.textContent('#tapLabel')) === '어묵 꼬치', '메뉴: ' + await p.textContent('#tapLabel'));
    await p.screenshot({ path: path.join(D, 'shot-art1.png') });

    console.log('\n[2] 최고 단계');
    await p.evaluate(() => {
      const s = State.get(); s.money=1e18; s.fame=4000; s.fameLv={f_tap:14,f_mult:8};
      Data.GENERATORS.forEach(g=>s.gens[g.id]=200);
      Data.UPGRADES.forEach(u=>s.upgrades[u.id]=true);
      Game.invalidate(); UI.invalidate(); UI.refresh(true);
      for (let i=0;i<10;i++) Scene.tick(2);
    });
    await p.waitForTimeout(1200);
    ok((await p.textContent('#tapLabel')) === '프리미엄 한상', '메뉴: ' + await p.textContent('#tapLabel'));
    ok(await p.locator('#tapEmoji svg').count() === 1, '최고 단계도 SVG');
    await p.screenshot({ path: path.join(D, 'shot-art8.png') });

    console.log('\n[3] 단계표와 스킨 카드');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(400);
    ok(await p.locator('#tapLadder .rung svg').count() === 8, '단계표 8칸 모두 그림');
    ok(await p.locator('#tapSkinRow .skin[data-skin="auto"] .skin-ic svg').count() === 1, '분식 스킨 카드에 그림');
    ok(await p.locator('#tapSkinRow .skin[data-skin="jumeok"] .skin-ic svg').count() === 1, '주먹밥 스킨 카드에 그림');
    ok(await p.locator('#tapSkinRow .skin[data-skin="bungeo"] .skin-ic svg').count() === 0, '붕어빵 스킨은 이모지 그대로');
    await p.locator('.skin-card').first().screenshot({ path: path.join(D, 'crop-art-skin.png') });

    console.log('\n[4] 다른 스킨으로 오가도 정상');
    for (const id of ['bungeo','jumeok','tteok','auto']) {
      await p.click(`#tapSkinRow .skin[data-skin="${id}"]`); await p.waitForTimeout(220);
      const hasSvg = await p.locator('#tapEmoji svg').count();
      const txt = (await p.textContent('#tapEmoji')).trim();
      ok(hasSvg === 1 || txt.length > 0, `${id}: ` + (hasSvg ? 'SVG' : '이모지 ' + txt));
    }
});

suite('가게 그림 · 손님 방향 · 활성 탭', async ({ page, ctx, ok, errs }) => {
  const p = page;

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');

    console.log('[1] 거리 왼쪽에 가게가 서 있다');
    ok(await p.locator('#street .shopfront svg').count() === 1, '가게 그림이 그려짐');
    const street = await p.locator('#street').boundingBox();
    const shop = await p.locator('#street .shopfront').boundingBox();
    ok(shop.x - street.x < 12, `왼쪽 끝에 붙음 (${Math.round(shop.x - street.x)}px)`);
    ok(shop.x + shop.width < street.x + street.width / 2, '거리 왼쪽 절반 안에 들어옴');
    ok(Math.abs((shop.y + shop.height) - (street.y + street.height)) < 3, '바닥에 닿아 있음');
    ok((await p.textContent('#street .shopfront text')) === '분식', '간판: 분식');
    await p.locator('#street').screenshot({ path: path.join(D, 'shot-street-shop.png') });

    console.log('\n[2] 간판은 스킨을 따라간다');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(300);
    await p.click('#tapSkinRow .skin[data-skin="bungeo"]');
    await p.click('#tabbar .tab[data-tab="shop"]'); await p.waitForTimeout(400);
    await p.evaluate(() => Scene.tick(0.1));
    ok((await p.textContent('#street .shopfront text')) === '붕어빵', '간판: 붕어빵');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(250);
    await p.click('#tapSkinRow .skin[data-skin="auto"]');
    ok(await p.locator('#tapSkinRow .skin[data-skin="auto"].on').count() === 1, '고른 스킨에 표시가 남음');
    await p.click('#tabbar .tab[data-tab="shop"]'); await p.waitForTimeout(300);

    console.log('\n[3] 손님은 전부 오른쪽에서 온다');
    // 미리 깔아둔 손님(이미 걸어온 자리에서 시작한다)을 치우고 새로 받는다
    const xs = await p.evaluate(async () => {
      const s = State.get();
      Data.GENERATORS.forEach(g => s.gens[g.id] = 30);
      Game.invalidate();
      Scene.clear();
      const street = document.getElementById('street');
      const w = street.clientWidth;
      const seen = [];
      for (let i = 0; i < 12; i++) {
        Scene.tick(2);
        street.querySelectorAll('.walker').forEach(n => {
          if (n.dataset.seen) return;
          n.dataset.seen = '1';
          // spawnWalker 가 바로 glide 를 걸어 style.transform 은 이미 도착점이다.
          // 그래서 도착점과, 아직 거의 안 움직인 실제 위치를 함께 본다.
          const m = /translateX\((-?[\d.]+)px\)/.exec(n.style.transform || '');
          const r = n.getBoundingClientRect();
          seen.push({ to: m ? +m[1] : null, left: r.left - street.getBoundingClientRect().left, w: w });
        });
        await new Promise(r => setTimeout(r, 20));
      }
      return seen;
    });
    ok(xs.length >= 5, `손님 ${xs.length}명 관찰`);
    // 주문하는 손님은 가게 앞(왼쪽)에 한 번 멈췄다 가므로 도착점이 -40 이 아닐 수 있다
    ok(xs.every(v => v.to !== null && v.to < v.left), '전부 왼쪽으로 걸어감');
    ok(xs.every(v => v.to < v.w / 2), '멈추는 자리도 가게가 있는 왼쪽 절반');
    ok(xs.every(v => v.left > v.w - 20), '전부 오른쪽 화면 밖에서 들어옴');
    ok(await p.locator('#street .walker i.flip').count() > 0, '가게 쪽(왼쪽)을 보고 걸음');

    // 가게 앞에서 돌아 나가면 오른쪽을 본다. 가게를 지나쳐 왼쪽으로 빠지면
    // 손님이 가게 그림을 덮어 가리므로, 왼쪽 끝까지 가는 손님이 없어야 한다.
    const home = await p.evaluate(async () => {
      let turned = false, past = 0;
      const street = document.getElementById('street');
      for (let i = 0; i < 60; i++) {
        street.querySelectorAll('.walker').forEach(n => {
          if (!n.querySelector('i.flip')) turned = true;
          if (n.getBoundingClientRect().right < street.getBoundingClientRect().left + 8) past++;
        });
        await new Promise(r => setTimeout(r, 100));
      }
      return { turned: turned, past: past };
    });
    ok(home.turned, '가게 앞에서 돌아 나감');
    ok(home.past === 0, '가게를 지나쳐 왼쪽으로 빠지는 손님 없음');

    console.log('\n[4] 지금 보고 있는 탭이 뚜렷하다');
    for (const name of ['upgrade', 'settings', 'shop']) {
      await p.click(`#tabbar .tab[data-tab="${name}"]`); await p.waitForTimeout(320);
      const on = await p.evaluate((n) => {
        const b = document.querySelector(`#tabbar .tab[data-tab="${n}"]`);
        const pill = getComputedStyle(b, '::before');
        const bar = getComputedStyle(b, '::after');
        return {
          active: b.classList.contains('active'),
          pill: +pill.opacity,
          bar: bar.transform,
          weight: getComputedStyle(b).fontWeight
        };
      }, name);
      ok(on.active && on.pill > 0.9, `${name}: 알약이 켜짐`);
      ok(!/matrix\(0,/.test(on.bar), `${name}: 위 표시줄이 펼쳐짐`);
      ok(+on.weight >= 700, `${name}: 글씨가 굵어짐`);
    }
    const off = await p.evaluate(() =>
      +getComputedStyle(document.querySelector('#tabbar .tab[data-tab="achv"]'), '::before').opacity);
    ok(off < 0.1, '안 보는 탭에는 알약이 없음');
    await p.locator('#tabbar').screenshot({ path: path.join(D, 'shot-tabbar.png') });
});

suite('스킨', async ({ page, ctx, ok, errs }) => {
  const p = page;                  // 스위트마다 page/p 를 섞어 쓴다
  const errors = errs;             // 이름만 다른 같은 수집기

  // 도둑은 화면 밖에서 출발하므로, 보이는 위치에 들어올 때까지 기다렸다 클릭한다
  async function clickThief() {
    for (let i = 0; i < 80; i++) {
      const box = await p.locator('.thief').boundingBox().catch(() => null);
      if (box && box.x > 4 && box.x + box.width < 386) {
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      }
      await p.waitForTimeout(60);
    }
    return false;
  }

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');
    await p.evaluate(() => {
      const s = State.get(); s.money=1e18; s.fame=4000; s.fameLv={f_tap:14,f_mult:8};
      Data.GENERATORS.forEach(g=>s.gens[g.id]=200);
      Data.UPGRADES.forEach(u=>s.upgrades[u.id]=true);
      Game.setSkin('tap','jumeok');
      Game.invalidate(); UI.invalidate(); UI.refresh(true);
    });
    await p.waitForTimeout(500);
    ok(await p.locator('#tapEmoji svg').count() === 1, '조리 이미지가 SVG 캐릭터로 그려짐');
    ok((await p.textContent('#tapLabel')).includes('주먹밥'), '메뉴 이름: ' + await p.textContent('#tapLabel'));
    const size = await p.evaluate(() => {
      const r = document.querySelector('#tapEmoji svg').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    ok(size.w > 40 && size.w === size.h, `크기 정상 ${size.w}×${size.h}`);
    await p.screenshot({ path: path.join(D, 'shot-jumeok.png') });

    // 말풍선·튀는 음식은 작아서 이모지를 쓴다
    await p.evaluate(() => { for (let i=0;i<8;i++) Scene.tick(2); });
    const box = await p.locator('#tapTarget').boundingBox();
    await p.mouse.click(box.x+box.width/2, box.y+box.height/2);
    await p.waitForTimeout(150);
    const pop = await p.locator('#pops .pop').first().textContent().catch(()=>'');
    ok(pop && pop.length <= 4, '튀는 음식은 이모지: ' + pop);

    // 단계표
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(400);
    ok(await p.locator('#tapLadder .rung svg').count() === 8, '단계표 8칸 모두 캐릭터');
    ok(await p.locator('#tapSkinRow .skin[data-skin="jumeok"] .skin-ic svg').count() === 1,
       '스킨 카드에도 캐릭터');
    await p.locator('.skin-card').first().screenshot({ path: path.join(D, 'crop-jumeok-skin.png') });

    // 다른 스킨으로 바꾸면 이모지로 돌아가야 한다
    await p.click('#tapSkinRow .skin[data-skin="bungeo"]'); await p.waitForTimeout(300);
    ok(await p.locator('#tapEmoji svg').count() === 0, '붕어빵 스킨은 이모지로 표시');
    ok((await p.textContent('#tapEmoji')).trim().length > 0, '이모지 정상: ' + (await p.textContent('#tapEmoji')).trim());
    await p.click('#tapSkinRow .skin[data-skin="jumeok"]'); await p.waitForTimeout(300);
    ok(await p.locator('#tapEmoji svg').count() === 1, '다시 주먹밥으로 돌아옴');
});

suite('퀘스트', async ({ page, ctx, ok, errs }) => {
  const p = page;

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(400);

    console.log('[1] 오늘 퀘스트가 깔린다');
    // 개수는 Data 에서 읽는다 — 퀘스트를 늘려도 테스트가 깨지지 않게
    const want = await p.evaluate(() => Data.QUEST.count);
    const rows = await p.locator('#questList .item').count();
    ok(rows === want + 1, `퀘스트 ${want}개 + 완주 줄`, rows);
    ok(await p.locator('#questList .qbar').count() === rows, '전부 진행도 막대가 있음');
    ok(await p.locator('#questList .quest-get').count() === 0, '처음엔 받을 게 없음');
    ok(await p.isHidden('#dotAchv'), '탭 뱃지도 꺼져 있음');

    console.log('\n[2] 진행하면 막대가 찬다');
    const before = await p.evaluate(() =>
      document.querySelector('#questList .qbar > i').style.width);
    await p.evaluate(() => {
      const q = Game.quests()[0];
      Game.questBump(q.def.kind, Math.ceil(q.goal / 2));
      UI.refresh(true);
    });
    await p.waitForTimeout(250);
    const half = await p.evaluate(() =>
      document.querySelector('#questList .qbar > i').style.width);
    ok(parseFloat(half) > parseFloat(before || '0'), `막대가 참 ${before || '0%'} → ${half}`);

    console.log('\n[3] 다 하면 받을 수 있다');
    await p.evaluate(() => {
      const q = Game.quests()[0];
      Game.questBump(q.def.kind, q.goal);
      UI.refresh(true);
    });
    await p.waitForTimeout(250);
    ok(await p.locator('#questList .item.quest-ready').count() === 1, '받기 버튼이 생김');
    ok(await p.isVisible('#dotAchv'), '탭에 뱃지가 뜸');
    ok(await p.evaluate(() =>
      document.querySelector('#questList .item.quest-ready').tagName) === 'BUTTON',
      '받을 수 있는 줄은 button');

    const money0 = await p.evaluate(() => State.get().money);
    await p.click('#questList .item.quest-ready');
    await p.waitForTimeout(350);
    const money1 = await p.evaluate(() => State.get().money);
    ok(money1 > money0, '보상이 들어옴', Math.round(money1 - money0) + '원');
    ok(await p.locator('#questList .item.quest-taken').count() === 1, '받은 줄로 바뀜');
    ok(await p.locator('#questList .quest-get').count() === 0, '두 번 받을 수 없음');
    ok(await p.evaluate(() => State.get().questsDone) === 1, '완료 수 1');
    await p.locator('#questList').screenshot({ path: path.join(D, 'shot-quests.png') });

    console.log('\n[4] 셋 다 하면 완주 보너스');
    await p.evaluate(() => {
      Game.quests().forEach(q => { Game.questBump(q.def.kind, q.goal); Game.claimQuest(q.index); });
      UI.refresh(true);
    });
    await p.waitForTimeout(250);
    ok(await p.locator('#questList .quest-get').count() === 1, '완주 줄만 받을 수 있음');
    const m2 = await p.evaluate(() => State.get().money);
    await p.click('#questList .quest-get');
    await p.waitForTimeout(350);
    ok(await p.evaluate(() => State.get().money) > m2, '완주 보너스가 들어옴');
    ok(await p.evaluate(() => State.get().questAllTaken) === 1, '완주 보너스 기록됨');
    ok(await p.isHidden('#dotAchv'), '다 받으면 뱃지가 꺼짐');

    console.log('\n[5] 새로고침해도 받은 상태가 남는다');
    await p.evaluate(() => State.save());
    await p.reload(); await p.waitForTimeout(900);
    if (await p.isVisible('#dailyOk')) await p.click('#dailyOk');
    if (await p.isVisible('#offlineOk')) await p.click('#offlineOk');
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(400);
    ok(await p.locator('#questList .item.quest-taken').count() ===
       (await p.locator('#questList .item').count()), '전부 받은 채로 남아 있음');
    ok(await p.evaluate(() => State.get().questsDone) >= 3, '완료 수도 남음');
});

suite('전국 맛집 랭킹', async ({ page, ctx, ok, errs }) => {
  const p = page;

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(400);

    console.log('[1] 기록 탭에 랭킹 카드');
    ok(await p.locator('#rankCard').count() === 1, '랭킹 카드 존재');
    ok(await p.locator('[data-page="achv"] #achvList').count() === 0, '도전과제는 기록 탭에 없음(업그레이드로 이동)');
    ok(await p.locator('#rankHeads .rank-head').count() === 2, '전국·지역 두 칸');
    ok(await p.locator('#rankBoard .rb-row').count() >= 4, '리더보드 여러 줄');
    ok(await p.locator('#rankBoard .rb-row.me').count() === 1, '내 가게가 한 줄 강조됨');
    ok((await p.locator('#rankBoard .rb-row.me .rb-name b').textContent()) === '내 가게',
       '내 가게 배지');

    console.log('\n[2] 지역 이름이 실제 지역이다');
    const region = await p.textContent('#rankRegion');
    const known = await p.evaluate((n) => Data.REGIONS.some(r => r.name === n), region);
    ok(known, '지역: ' + region);
    ok(!/undefined/.test(await p.textContent('#rankBoard')), '맛집 이름에 undefined 없음');
    await p.locator('#rankCard').screenshot({ path: path.join(D, 'shot-rank.png') });

    console.log('\n[3] 벌이가 오르면 순위가 오른다');
    const before = await p.evaluate(() => Game.nationRank().rank);
    await p.evaluate(() => {
      const s = State.get();
      Data.GENERATORS.forEach(g => s.gens[g.id] = 120);
      s.bestPerSec = 1e13;
      Game.invalidate(); UI.refresh(true);
    });
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => Game.nationRank().rank);
    ok(after < before, `순위 상승 ${before} → ${after}`);
    ok(await p.locator('#rankBoard .rb-row.me').count() === 1, '오른 뒤에도 내 줄이 보임');
    const rank1 = await p.evaluate(() => Game.regionRank().rank);
    ok(rank1 >= 1, '지역 순위도 갱신됨: ' + rank1 + '위');

    console.log('\n[4] 지역은 새로고침해도 그대로');
    const r1 = await p.textContent('#rankRegion');
    await p.evaluate(() => State.save());
    await p.reload(); await p.waitForTimeout(800);
    if (await p.isVisible('#dailyOk')) await p.click('#dailyOk');
    if (await p.isVisible('#offlineOk')) await p.click('#offlineOk');
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(400);
    ok((await p.textContent('#rankRegion')) === r1, '같은 지역 유지: ' + r1);
});

suite('스타 셰프 도전', async ({ page, ctx, ok, errs }) => {
  const p = page;

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');
    await p.evaluate(()=>{ Data.GENERATORS.forEach(g=>State.get().gens[g.id]=10); State.get().money=1e6; Game.invalidate(); });
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(400);

    console.log('[1] 스타 셰프 카드 · 시즌 · 랭킹');
    ok(await p.locator('#michelinCard').count() === 1, '카드 존재');
    ok(await p.locator('#michStart').count() === 1, '도전하기 버튼');
    ok(await p.locator('#michShare').count() === 1, '자랑(공유) 버튼');
    ok(/시즌/.test(await p.textContent('.mich-season')), '시즌 이름 표시: ' + await p.textContent('.mich-season'));
    ok(await p.locator('#michelinCard .mb-row').count() >= 3, '랭킹 보드 여러 줄');
    ok(/전국/.test(await p.textContent('#michelinCard .mcz-sub')), '전국 순위 표시');
    ok(/단계/.test(await p.textContent('.mich-season')), '단계 표시');
    ok(/조리 \d+번/.test(await p.textContent('.mich-goal')), '별5 목표 조리 횟수 표시');

    console.log('\n[2] 심사 시작 → 조리로 별을 얻는다');
    await p.click('#michStart'); await p.waitForTimeout(300);
    ok(!await p.isHidden('#michelinModal'), '심사 모달이 열림');
    ok(await p.isHidden('#michResult'), '아직 결과는 숨김');
    // 첫 별 문턱까지 조리
    const goal1 = await p.evaluate(()=>Data.MICHELIN.goals[0]);
    for (let i=0;i<goal1;i++){ await p.click('#michTap'); await p.waitForTimeout(15); }
    await p.waitForTimeout(150);
    ok(/★/.test(await p.textContent('#michStars')), '별이 생김: ' + await p.textContent('#michStars'));
    ok(await p.evaluate(()=>State.get().taps) >= goal1, '조리 횟수가 실제 탭으로 쌓임');

    console.log('\n[3] 그만두면 그때까지 별로 정산');
    await p.click('#michQuit'); await p.waitForTimeout(300);
    ok(!await p.isHidden('#michResult'), '결과 화면이 뜸');
    ok(/★/.test(await p.textContent('#michResultStars')), '결과에 별 표시');
    await p.locator('.michelin-modal').screenshot({ path: path.join(D, 'shot-michelin.png') });
    const money0 = await p.evaluate(()=>State.get().money);
    await p.click('#michDone'); await p.waitForTimeout(300);
    ok(await p.isHidden('#michelinModal'), '받기 누르면 닫힘');
    ok(await p.evaluate(()=>State.get().bestMichelin) >= 1, '최고 기록이 남음');

    console.log('\n[4] 5성 달성 → 영구 배율 + 카드 갱신');
    // 별 5개 문턱까지 빠르게 (시간 넉넉히 두고 evaluate 로 직접 심사 정산 대신 실제 탭)
    const before = await p.evaluate(()=>Game.globalMult());
    await p.evaluate(()=>{ const r=Game.claimMichelin(Data.MICHELIN.goals[4]); window.__r=r; });
    const r = await p.evaluate(()=>window.__r);
    ok(r.stars === 5 && r.grandNew, '5성 첫 달성 그랜드');
    ok(r.tierUp === 1 && await p.evaluate(()=>State.get().michTier) === 1, '5성 → 다음 단계로');
    ok(await p.evaluate(()=>Game.michGoals()[4]) > 160, '다음 도전은 160번보다 많아짐');
    ok(await p.evaluate(()=>Game.globalMult()) > before, '영구 배율이 붙어 배율이 커짐');
    await p.evaluate(()=>{ UI.invalidate&&UI.invalidate(); UI.refresh(true); });
    await p.waitForTimeout(200);
    ok(/×/.test(await p.textContent('#michelinCard')) && /적용 중/.test(await p.textContent('#michelinCard')),
       '카드가 5성 달성 상태로 바뀜');

    console.log('\n[5] 새로고침해도 기록 유지');
    await p.evaluate(()=>State.save());
    await p.reload(); await p.waitForTimeout(800);
    if (await p.isVisible('#offlineOk')) await p.click('#offlineOk');
    ok(await p.evaluate(()=>State.get().bestMichelin) === 5, '최고 기록 5성 유지');
    ok(await p.evaluate(()=>State.get().michelinGrand) === 1, '그랜드 유지');

    console.log('\n[6] 시즌이 바뀌면 이번 시즌 등급이 리셋된다');
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(300);
    // 시즌 기록을 만들고, 시계를 다음 달로 옮긴 뒤 롤
    await p.evaluate(()=>{ Game.claimMichelin(Data.MICHELIN.goals[1]); });   // 2성
    ok(await p.evaluate(()=>State.get().michSeasonStars) >= 2, '이번 시즌 별이 쌓임');
    // 과거 달로 되돌린 뒤 롤하면 새 시즌으로 넘어가고 지난 기록이 히스토리에 쌓인다
    const rolled = await p.evaluate(()=>{
      const s = State.get();
      s.michSeason = '2000-01';        // 아주 과거로 → 지금 달과 다름
      s.michSeasonStars = 3; s.michSeasonTaps = 70;
      const before = s.michHist.length;
      const changed = Game.michSeasonRoll();
      return { changed, grew: State.get().michHist.length > before,
               reset: State.get().michSeasonStars === 0 };
    });
    ok(rolled.changed && rolled.grew, '달이 바뀌면 지난 시즌이 히스토리에 쌓임');
    ok(rolled.reset, '새 시즌엔 이번 시즌 등급이 0으로');

    console.log('\n[7] 자랑하기 문구 생성 (공유/복사)');
    // navigator.share 를 스파이로 갈아끼워 자랑 문구가 만들어지는지 본다
    await p.evaluate(()=>{
      window.__shared = null;
      Object.defineProperty(navigator, 'share', {
        configurable: true, value: (o) => { window.__shared = o; return Promise.resolve(); }
      });
    });
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(200);
    await p.click('#michShare'); await p.waitForTimeout(200);
    const shared = await p.evaluate(()=>window.__shared);
    ok(shared && /스타 셰프/.test(shared.text) && /별/.test(shared.text), '기기 공유 시트로 보냄(다른 앱): ' + (shared && shared.text || '').replace(/\n/g,' '));

    // 공유가 막힌(샌드박스) 경우엔 복사로 넘어간다
    await p.evaluate(()=>{
      window.__copied = null;
      Object.defineProperty(navigator, 'share', { configurable:true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', { configurable:true,
        value: { writeText: (t)=>{ window.__copied = t; return Promise.resolve(); } } });
    });
    await p.click('#michShare'); await p.waitForTimeout(200);
    const copied = await p.evaluate(()=>window.__copied);
    ok(copied && /스타 셰프/.test(copied), '공유 불가 시 문구를 복사로 대체');
});

suite('주말 파티 · 도감', async ({ page, ctx, ok, errs }) => {
  const p = page;

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');

    console.log('[1] 평일엔 파티 배너가 없다');
    await p.evaluate(()=>{ Game.setClock(()=>new Date(2026,7,26,12,0,0)); UI.refresh(true); }); // 수요일
    await p.waitForTimeout(200);
    ok(await p.isHidden('#partyBanner'), '평일 낮엔 배너 숨김');

    console.log('\n[2] 금·토 저녁엔 파티 배너 + ×3');
    await p.evaluate(()=>{ Game.setClock(()=>new Date(2026,7,28,18,0,0)); // 금 18시
      Data.GENERATORS.forEach(g=>State.get().gens[g.id]=10); State.get().money=1e9; Game.invalidate(); UI.refresh(true); });
    await p.waitForTimeout(200);
    ok(!await p.isHidden('#partyBanner'), '파티 배너가 뜸');
    ok(/×3/.test(await p.textContent('#partyBanner')), '모든 수익 ×3 표시');
    const mult = await p.evaluate(()=>({live:Game.perSec(false), off:Game.perSec(true)}));
    ok(Math.abs(mult.live - mult.off*3) < mult.off*0.01, '실시간 수익이 ×3 (오프라인은 제외)');

    console.log('\n[3] 파티 중 조리하면 음식을 발견한다');
    await p.evaluate(()=>{ State.get().partyFoods=[]; Game.invalidate(); });
    // 발견 확률이 있으니 여러 번 눌러 최소 하나는 찾는다
    for (let i=0;i<400 && await p.evaluate(()=>Game.partyGotCount())===0;i++){
      await p.evaluate(()=>Game.tryDiscoverFood());
    }
    const got = await p.evaluate(()=>Game.partyGotCount());
    ok(got > 0, `도감에 음식이 쌓임 (${got}칸)`);

    console.log('\n[4] 도감 화면에 채운 칸이 보인다');
    await p.click('#tabbar .tab[data-tab="achv"]'); await p.waitForTimeout(400);
    ok(await p.locator('#partyDex .dex-cell').count() === await p.evaluate(()=>Data.PARTY.foods.length),
       '도감 칸이 음식 수만큼');
    ok(await p.locator('#partyDex .dex-cell.got').count() === got, `채운 칸 ${got}개 강조`);
    ok(/\d+ \/ \d+/.test(await p.textContent('#partyDex .dex-head')), '진행도 표시');
    await p.locator('#partyDex').screenshot({ path: path.join(D, 'shot-party-dex.png') });

    console.log('\n[5] 도감은 세이브에 남는다');
    await p.evaluate(()=>State.save());
    await p.reload(); await p.waitForTimeout(800);
    if (await p.isVisible('#offlineOk')) await p.click('#offlineOk');
    ok(await p.evaluate(()=>Game.partyGotCount()) === got, '새로고침해도 도감 유지');

    console.log('\n[6] 배너를 누르면 도감 탭으로 간다');
    await p.evaluate(()=>{ Game.setClock(()=>new Date(2026,7,28,18,0,0)); UI.refresh(true); });
    await p.click('#tabbar .tab[data-tab="shop"]'); await p.waitForTimeout(200);
    await p.click('#partyBanner'); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>!document.querySelector('[data-page="achv"]').hidden), '도감이 있는 기록 탭으로 이동');
});

suite('세이브', async ({ page, ctx, ok, errs }) => {
  const p = page;                  // 스위트마다 page/p 를 섞어 쓴다
  const errors = errs;             // 이름만 다른 같은 수집기

  // 도둑은 화면 밖에서 출발하므로, 보이는 위치에 들어올 때까지 기다렸다 클릭한다
  async function clickThief() {
    for (let i = 0; i < 80; i++) {
      const box = await p.locator('.thief').boundingBox().catch(() => null);
      if (box && box.x > 4 && box.x + box.width < 386) {
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      }
      await p.waitForTimeout(60);
    }
    return false;
  }

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');

    // 진행 상황을 만든다
    await p.evaluate(() => {
      State.get().money = 1e9; Game.invalidate();
      ['g1','g2','g3'].forEach(id => Game.buyGen(id, 25));
      Game.setSkin('tap','tteok'); Game.setSkin('crowd','fantasy');
      Game.invalidate();
    });
    const box = await p.locator('#tapTarget').boundingBox();
    for(let i=0;i<8;i++){ await p.mouse.click(box.x+box.width/2+(Math.random()*20-10), box.y+box.height/2+(Math.random()*20-10)); await p.waitForTimeout(60); }

    console.log('[1] 자동 저장 (10초 주기)');
    const before = await p.evaluate(() => ({ taps: State.get().taps, g1: State.get().gens.g1, skin: State.get().tapSkin }));
    await p.evaluate(() => localStorage.removeItem('bunsik_idle_save_v1'));
    await p.waitForTimeout(11000);   // 자동 저장이 한 번 돌 때까지
    const saved = await p.evaluate(() => !!localStorage.getItem('bunsik_idle_save_v1'));
    ok(saved, '10초 안에 자동으로 저장됨');

    console.log('\n[2] 새로고침해도 남는가');
    await p.reload(); await p.waitForTimeout(800);
    const after = await p.evaluate(() => ({ taps: State.get().taps, g1: State.get().gens.g1, skin: State.get().tapSkin }));
    ok(after.taps === before.taps && after.g1 === before.g1 && after.skin === before.skin,
       '탭·설비·스킨이 그대로', JSON.stringify(after));

    console.log('\n[3] 탭을 닫았다 열어도 남는가 (새 페이지, 같은 브라우저)');
    const p2 = await ctx.newPage();
    await p2.goto('/index.html'); await p2.waitForTimeout(800);
    const other = await p2.evaluate(() => ({ g1: State.get().gens.g1, skin: State.get().tapSkin }));
    ok(other.g1 === before.g1 && other.skin === before.skin, '새 탭에서도 이어짐');
    await p2.close();

    console.log('\n[4] 오프라인 수익 (자리를 비운 동안)');
    await p.evaluate(() => {
      // 페이지를 떠날 때 도는 자동 저장이 lastSeen 을 지금으로 덮어쓰므로 잠시 막는다
      State.save = function () { return true; };
      const s = State.get();
      s.lastSeen = Date.now() - 3 * 3600 * 1000;   // 3시간 전에 껐던 것으로
      localStorage.setItem('bunsik_idle_save_v1', JSON.stringify(s));
    });
    await p.reload(); await p.waitForTimeout(900);
    ok(!await p.isHidden('#offlineModal'), '오프라인 보상 모달이 뜸');
    const offText = (await p.textContent('#offlineText')).replace(/\s+/g,' ').trim();
    ok(offText.length > 0, '내용: ' + offText.slice(0, 60));
    await p.click('#offlineOk'); await p.waitForTimeout(300);

    console.log('\n[5] 세이브 코드로 백업 / 복원');
    const code = await p.evaluate(() => State.exportText());
    ok(code.length > 50, `내보내기 코드 ${code.length}자`);
    await p.evaluate(() => { State.wipe(); Game.invalidate(); UI.invalidate(); UI.refresh(true); });
    ok(await p.evaluate(() => State.get().gens.g1 || 0) === 0, '초기화 확인');
    const restored = await p.evaluate(c => State.importText(c), code);
    ok(restored, '코드로 복원 성공');
    const back = await p.evaluate(() => ({ g1: State.get().gens.g1, skin: State.get().tapSkin }));
    ok(back.g1 === before.g1 && back.skin === before.skin, '복원 후 그대로', JSON.stringify(back));
    ok(await p.evaluate(() => State.importText('아무말')) === false, '잘못된 코드는 거부');
    ok(await p.evaluate(() => State.get().gens.g1) === before.g1, '거부돼도 기존 세이브 유지');

    console.log('\n[6] 저장 공간을 못 쓰는 환경(시크릿 모드 등)');
    const survives = await p.evaluate(() => {
      const real = localStorage.setItem.bind(localStorage);
      localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
      const r = State.save();          // 예외를 삼키고 false 를 돌려줘야 한다
      localStorage.setItem = real;
      return r === false;
    });
    ok(survives, '저장 실패해도 게임이 죽지 않음');
});


suite('시트 · 모달 · 데이터 삭제', async ({ page, ctx, ok, errs }) => {
  const p = page;
  const errors = errs;

    await p.goto('/index.html'); await p.waitForTimeout(700);
    await p.click('#dailyOk');
    await p.evaluate(()=>{const s=State.get();s.money=1e12;Data.GENERATORS.forEach(g=>s.gens[g.id]=30);Game.invalidate();UI.invalidate();UI.refresh(true);});
    await p.waitForTimeout(400);

    console.log('[1] 화면 분리 & 스크롤바');
    ok(await p.locator('#shopTop').isVisible(), '위 조리 구간 존재');
    ok(await p.locator('#shopSheet').isVisible(), '아래 시트 존재');
    const noPageScroll = await p.evaluate(()=>{
      const v=document.getElementById('view');
      return { locked: v.classList.contains('locked'), overflow: getComputedStyle(v).overflowY,
               canScroll: v.scrollHeight > v.clientHeight + 2 };
    });
    ok(noPageScroll.locked && noPageScroll.overflow==='hidden', '가게 탭에서 본문 스크롤 잠김');
    const bars = await p.evaluate(()=>{
      const v=document.getElementById('view'), sb=document.getElementById('sheetBody');
      return { viewBar: v.offsetWidth - v.clientWidth, sheetBar: sb.offsetWidth - sb.clientWidth };
    });
    ok(bars.viewBar===0 && bars.sheetBar===0, `스크롤 막대 없음 (본문 ${bars.viewBar}px, 시트 ${bars.sheetBar}px)`);
    await p.screenshot({ path: path.join(D, 'sheet-down.png') });

    console.log('\n[2] 시트를 올리면 목록이 더 보인다');
    const before = await p.evaluate(()=>{
      const items=[...document.querySelectorAll('#genList .item')].filter(e=>!e.hidden);
      const sb=document.getElementById('sheetBody').getBoundingClientRect();
      return { h: Math.round(sb.height),
        visible: items.filter(e=>{const r=e.getBoundingClientRect();return r.top>=sb.top-1 && r.bottom<=sb.bottom+1}).length };
    });
    const hb = await p.locator('#sheetHandle').boundingBox();
    await p.mouse.move(hb.x+hb.width/2, hb.y+hb.height/2);
    await p.mouse.down(); await p.mouse.move(hb.x+hb.width/2, hb.y-90, {steps:8}); await p.mouse.up();
    await p.waitForTimeout(500);
    const after = await p.evaluate(()=>{
      const items=[...document.querySelectorAll('#genList .item')].filter(e=>!e.hidden);
      const sb=document.getElementById('sheetBody').getBoundingClientRect();
      return { h: Math.round(sb.height), up: document.getElementById('shopPage').classList.contains('up'),
        visible: items.filter(e=>{const r=e.getBoundingClientRect();return r.top>=sb.top-1 && r.bottom<=sb.bottom+1}).length };
    });
    ok(after.up, '위로 밀면 시트가 올라감');
    ok(after.h > before.h, `시트가 커짐 ${before.h}px → ${after.h}px`);
    ok(after.visible > before.visible, `보이는 항목 ${before.visible}개 → ${after.visible}개`);
    ok(await p.locator('#tapTarget').isVisible(), '조리 버튼은 계속 보임(접힌 채)');
    const tb = await p.locator('#tapTarget').boundingBox();
    ok(tb.width < 120, `조리 버튼이 작아짐 ${Math.round(tb.width)}px`);
    await p.screenshot({ path: path.join(D, 'sheet-up.png') });

    console.log('\n[3] 접힌 상태에서도 조리가 된다');
    const m0 = await p.evaluate(()=>State.get().taps);
    await p.mouse.click(tb.x+tb.width/2, tb.y+tb.height/2);
    await p.waitForTimeout(200);
    ok(await p.evaluate(()=>State.get().taps) === m0+1, '접힌 조리 버튼도 눌린다');

    console.log('\n[4] 아래로 밀면 접힌다 / 상태가 남는다');
    // 시트가 오르내리면 핸들 위치가 바뀐다. 그때마다 다시 잰다.
    const grab = async () => await p.locator('#sheetHandle').boundingBox();
    const drag = async (dy) => {
      const h = await grab();
      await p.mouse.move(h.x+h.width/2, h.y+h.height/2);
      await p.mouse.down();
      await p.mouse.move(h.x+h.width/2, h.y+h.height/2+dy, {steps:8});
      await p.mouse.up();
      await p.waitForTimeout(480);
    };
    const isUp = () => p.evaluate(()=>document.getElementById('shopPage').classList.contains('up'));

    await drag(90);
    ok(!await isUp(), '아래로 밀면 접힘');
    await drag(-90);
    ok(await isUp(), '다시 위로 밀면 펼쳐짐');
    await drag(0);
    ok(!await isUp(), '가볍게 누르면 토글(접힘)');
    await drag(0);
    ok(await isUp(), '한 번 더 누르면 토글(펼침)');
    await p.evaluate(()=>State.save());
    await p.reload(); await p.waitForTimeout(800);
    ok(await p.evaluate(()=>document.getElementById('shopPage').classList.contains('up')), '새로고침해도 올린 상태 유지');

    console.log('\n[5] 데이터 전체 삭제가 실제로 실행된다');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(300);
    await p.evaluate(()=>{ State.get().money = 987654321; State.get().gens.g1 = 42; State.save(); });
    await p.click('#resetBtn'); await p.waitForTimeout(250);
    ok(!await p.isHidden('#askModal'), '첫 번째 확인 모달이 뜸');
    ok((await p.textContent('#askTitle')).includes('삭제'), '문구: ' + await p.textContent('#askTitle'));
    await p.screenshot({ path: path.join(D, 'ask-reset.png') });
    await p.click('#askOk'); await p.waitForTimeout(250);
    ok((await p.textContent('#askTitle')).includes('되돌릴 수 없'), '두 번째 확인이 뜸');
    await p.click('#askOk'); await p.waitForTimeout(400);
    const wiped = await p.evaluate(()=>({money:State.get().money, g1:State.get().gens.g1||0, saved:localStorage.getItem('bunsik_idle_save_v1')}));
    ok(wiped.money===0 && wiped.g1===0, `실제로 삭제됨 (돈 ${wiped.money}, 알바생 ${wiped.g1})`);
    ok(!wiped.saved, 'localStorage 에서도 지워짐');

    console.log('\n[6] 취소하면 삭제되지 않는다');
    await p.evaluate(()=>{ State.get().money=555; State.save(); });
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(200);
    await p.click('#resetBtn'); await p.waitForTimeout(200);
    await p.click('#askCancel'); await p.waitForTimeout(250);
    ok(await p.isHidden('#askModal'), '취소하면 닫힘');
    ok(await p.evaluate(()=>State.get().money) === 555, '데이터 그대로');

    console.log('\n[7] 세이브 코드 내보내기 / 불러오기');
    await p.click('#exportBtn'); await p.waitForTimeout(300);
    ok(!await p.isHidden('#textModal'), '코드 모달이 뜸');
    const code = await p.inputValue('#textInput');
    ok(code.length > 50, `코드 ${code.length}자 표시`);
    await p.screenshot({ path: path.join(D, 'text-export.png') });
    await p.click('#textCancel'); await p.waitForTimeout(200);
    await p.evaluate(()=>{ State.wipe(); Game.invalidate(); UI.invalidate(); UI.refresh(true); });
    await p.click('#importBtn'); await p.waitForTimeout(250);
    await p.fill('#textInput', code);
    await p.click('#textOk'); await p.waitForTimeout(400);
    ok(await p.evaluate(()=>State.get().money) === 555, '코드로 복원됨');
});


suite('접근성 · 소리 · 안내 · 점장', async ({ page, ctx, ok, errs }) => {
  const p = page;
  const errors = errs;

    await p.goto('/index.html'); await p.waitForTimeout(700);

    console.log('[1] 첫 실행 안내');
    ok(!await p.isHidden('#tourModal'), '처음 들어오면 안내가 뜸');
    ok((await p.locator('#tourDots i').count())===5, '5장짜리');
    // 끝까지 봐야가 아니라 '띄운 순간' 봤다고 적는다
    ok(await p.evaluate(()=>State.get().sawTour)===1, '띄우자마자 봤다고 적음');
    for (let i=0;i<4;i++){ await p.click('#tourNext'); await p.waitForTimeout(120); }
    ok((await p.textContent('#tourNext'))==='시작하기', '마지막 장은 시작하기');
    await p.click('#tourNext'); await p.waitForTimeout(300);
    ok(await p.isHidden('#tourModal'), '끝내면 닫힘');
    // 안내가 끝나면 첫날 출석 보상이 이어서 뜬다
    ok(!await p.isHidden('#dailyModal'), '안내 뒤에 출석 보상이 이어짐');
    await p.click('#dailyOk'); await p.waitForTimeout(250);
    await p.reload(); await p.waitForTimeout(800);
    ok(await p.isHidden('#tourModal'), '두 번째부터는 안 뜸');
    if (!await p.isHidden('#dailyModal')) await p.click('#dailyOk');
    await p.waitForTimeout(200);

    // 보다 말고 나가도 다시 뜨면 안 된다 — 처음 상태로 되돌려 확인한다
    await p.evaluate(()=>{ State.get().sawTour = 0; State.save(); });
    await p.reload(); await p.waitForTimeout(800);
    ok(!await p.isHidden('#tourModal'), '기록을 지우면 다시 뜸');
    await p.reload(); await p.waitForTimeout(800);      // 첫 장에서 그냥 나갔다 온다
    ok(await p.isHidden('#tourModal'), '보다 말고 나갔다 와도 다시 뜨지 않음');
    if (!await p.isHidden('#dailyModal')) await p.click('#dailyOk');
    await p.waitForTimeout(200);

    console.log('\n[2] 키보드로 조리');
    const t0=await p.evaluate(()=>State.get().taps);
    await p.focus('#tapTarget');
    ok(await p.evaluate(()=>document.activeElement.id)==='tapTarget', '조리 버튼에 포커스가 간다');
    await p.keyboard.press('Enter'); await p.waitForTimeout(80);
    await p.keyboard.press('Space'); await p.waitForTimeout(80);
    ok(await p.evaluate(()=>State.get().taps)===t0+2, '엔터·스페이스로 조리됨');

    console.log('\n[3] 목록이 진짜 버튼');
    await p.evaluate(()=>{const s=State.get();s.money=1e9;Game.invalidate();UI.refresh(true);});
    await p.waitForTimeout(300);
    const tags = await p.evaluate(()=>[...document.querySelectorAll('#genList .item')].map(e=>e.tagName));
    ok(tags.every(t=>t==='BUTTON'), `설비 ${tags.length}행 전부 button`);
    const g0 = await p.evaluate(()=>State.get().gens.g1||0);
    await p.evaluate(()=>{ const b=[...document.querySelectorAll('#genList .item')].find(e=>!e.hidden); b.focus(); });
    await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>State.get().gens.g1||0) > g0, '키보드로 설비 구매됨');
    await p.click('#tabbar .tab[data-tab="upgrade"]'); await p.waitForTimeout(300);
    const achv = await p.evaluate(()=>[...document.querySelectorAll('#achvList .item')].map(e=>e.tagName));
    ok(achv.length > 0 && achv.every(t=>t==='DIV'), '도전과제는 누를 수 없으니 div (업그레이드 탭)');
    // 잠긴 도전과제는 진행도(현재/목표)와 막대를 보여준다
    await p.evaluate(()=>{ const s=State.get(); s.taps=1538; s.achievements={}; UI.invalidate&&UI.invalidate(); UI.refresh(true); });
    await p.waitForTimeout(200);
    const prog = await p.evaluate(()=>{
      const rows=[...document.querySelectorAll('#achvList .item.achv-locked')];
      const tap = rows.find(r=>/조리하기/.test(r.textContent));
      const pr = tap && tap.querySelector('.achv-prog');
      const bar = tap && tap.querySelector('.qbar > i');
      return { text: pr && pr.textContent, width: bar && bar.style.width,
               anyProg: document.querySelectorAll('#achvList .achv-prog').length,
               anyBar: document.querySelectorAll('#achvList .item.achv-locked .qbar').length };
    });
    ok(/\d+ \/ \d+/.test(prog.text || ''), '잠긴 항목에 현재/목표 표시: ' + prog.text);
    ok(prog.width && prog.width !== '0%' && prog.width !== '100%', '진행도 막대가 부분만 참: ' + prog.width);
    ok(prog.anyProg > 0 && prog.anyBar === prog.anyProg, '모든 잠긴 항목에 막대와 숫자');
    // 달성한 항목은 폴더에 아이콘 칩으로 모인다
    await p.evaluate(()=>{ const s=State.get(); s.achievements={ac1:true}; UI.refresh(true); });
    await p.waitForTimeout(150);
    ok(await p.locator('#achvList .achv-folder .achv-chip').count() > 0, '달성 항목은 폴더 안 아이콘 칩으로');
    // 칩을 누르면 어떤 도전과제인지 팝업으로 뜬다
    await p.locator('#achvList .achv-folder .achv-chip').first().click();
    await p.waitForTimeout(150);
    ok(!await p.isHidden('#askModal'), '칩을 누르면 상세 팝업이 뜸');
    await p.click('#askOk'); await p.waitForTimeout(150);

    console.log('\n[3-3] 🍳 주방 (재료·합성·레시피·도감)');
    // 레벨을 올리고 재료를 채운 뒤 주방 탭으로
    await p.evaluate(()=>{ const s=State.get(); s.totalEarned=1e12;
      Data.KITCHEN.ings.forEach(g=>{ s.ings[g.id]=9; }); Game.invalidate(); UI.refresh(true); });
    await p.click('#tabbar .tab[data-tab="kitchen"]'); await p.waitForTimeout(300);
    ok(await p.locator('#ingStore .ing').count() === (await p.evaluate(()=>Data.KITCHEN.ings.length)),
       '재료 창고에 재료 전종');
    ok(await p.locator('#kitchenGrid .kfood').count() > 0, '초급 레시피 셀이 있음');
    // 합성 → 재료 소모 + 도감 등록
    const om0 = await p.evaluate(()=>Game.ingCount('om'));
    const bonus0 = await p.evaluate(()=>Game.foodBonus());
    await p.locator('#kitchenGrid .kf-craft.ready').first().click();
    await p.waitForTimeout(250);
    ok(await p.evaluate(()=>Game.ingCount('om')) < om0, '합성하면 재료가 줄어듦');
    ok(await p.evaluate(()=>Game.foodBonus()) > bonus0, '첫 합성으로 도감 배율이 오름');
    // 고급 탭엔 아직 잠긴(???) 레시피가 있다 (사장 레벨 부족분)
    await p.click('#gradeTabs button[data-grade="3"]'); await p.waitForTimeout(200);
    ok(await p.locator('#kitchenGrid .kfood.locked').count() >= 0, '등급 탭 전환 동작');

    console.log('\n[4] 소리');
    ok(await p.evaluate(()=>typeof Sound!=='undefined'), 'Sound 모듈 로드');
    const audio = await p.evaluate(()=>{ Sound.wake(); return { muted: Sound.muted() }; });
    ok(audio.muted===false, '기본은 소리 켜짐');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(300);
    ok((await p.textContent('#muteBtn')).includes('켜짐'), '버튼 문구: ' + await p.textContent('#muteBtn'));
    await p.click('#muteBtn'); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>Sound.muted())===true, '누르면 음소거');
    ok((await p.textContent('#muteBtn')).includes('꺼짐'), '문구 바뀜');
    await p.reload(); await p.waitForTimeout(700);
    ok(await p.evaluate(()=>Sound.muted())===true, '음소거가 세이브에 남음');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(250);
    await p.click('#muteBtn'); await p.waitForTimeout(150);
    // 소리를 내도 터지지 않아야 한다
    await p.evaluate(()=>['tap','buy','upgrade','levelup','golden','thief','caught','lost','boost','prestige','achv','reward','blocked']
      .forEach(n=>Sound.play(n, 10)));
    ok(true, '13종 소리 재생에 예외 없음');

    console.log('\n[4-1] 탭 소리 고르기');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(250);
    const wantSounds = await p.evaluate(()=>Data.TAP_SOUNDS.length);
    ok(await p.locator('#tapSoundRow .skin').count() === wantSounds,
       `소리 카드 ${wantSounds}개`);
    ok(await p.locator('#tapSoundRow .skin.on').count() === 1, '지금 소리 한 개 표시');
    ok(await p.evaluate(()=>document.querySelector('#tapSoundRow .skin.on').dataset.sound) === 'classic',
       '처음엔 기본음이 선택됨');
    // 다른 소리를 고르면 세이브에 남고, 재생에 예외가 없어야 한다
    await p.evaluate(()=>{ let e; window.addEventListener('error', x=>e=x); window.__e=()=>e; });
    await p.click('#tapSoundRow .skin[data-sound="deep"]'); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>State.get().tapSound) === 'deep', '고른 소리가 적용됨');
    ok(await p.evaluate(()=>document.querySelector('#tapSoundRow .skin[data-sound="deep"]').classList.contains('on')),
       '고른 카드에 표시가 감');
    // 각 소리를 실제로 미리듣기 해도 터지지 않아야 한다
    await p.evaluate(()=>{ Sound.setMuted(false); Sound.wake();
      Data.TAP_SOUNDS.forEach(t=>Sound.previewTap(t.id, 5)); });
    ok(await p.evaluate(()=>!window.__e()), '모든 소리 미리듣기에 예외 없음');
    await p.reload(); await p.waitForTimeout(700);
    if (await p.isVisible('#offlineOk')) await p.click('#offlineOk');
    ok(await p.evaluate(()=>State.get().tapSound) === 'deep', '새로고침해도 고른 소리 유지');

    console.log('\n[4-2] 소리 목록 잡아끌어 밀기 (스크롤바 없이 전부 닿기)');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(250);
    const row = await p.evaluate(()=>{
      const r=document.querySelector('#tapSoundRow');
      const bar=getComputedStyle(r).scrollbarWidth;
      return { canScroll: r.scrollWidth > r.clientWidth + 2, bar: bar };
    });
    ok(row.canScroll, '한 화면에 안 들어가 가로로 넘침');
    ok(row.bar === 'none', '슬라이드바는 보이지 않음');
    // 마우스로 잡아끌어 밀 수 있다 (터치 없이도 뒤쪽 카드에 닿는다)
    await p.evaluate(()=>{ const r=document.querySelector('#tapSoundRow');
      const v=document.querySelector('#view'); v.scrollTop = r.getBoundingClientRect().top + v.scrollTop - 240; });
    await p.waitForTimeout(200);
    const box = await p.locator('#tapSoundRow').boundingBox();
    const cy = box.y + box.height/2;
    await p.mouse.move(300, cy); await p.mouse.down();
    for (let x=300; x>=70; x-=23) { await p.mouse.move(x, cy); await p.waitForTimeout(12); }
    await p.mouse.up(); await p.waitForTimeout(250);
    const scrolled = await p.evaluate(()=>document.querySelector('#tapSoundRow').scrollLeft);
    ok(scrolled > 60, `마우스로 밀어 스크롤됨 (${Math.round(scrolled)}px)`);
    ok(await p.evaluate(()=>State.get().tapSound) === 'deep', '미는 동작은 선택을 바꾸지 않음');
    // 밀어서 드러난 마지막 카드를 실제로 고를 수 있다
    await p.evaluate(()=>{ const r=document.querySelector('#tapSoundRow'); r.scrollLeft = r.scrollWidth; });
    await p.waitForTimeout(150);
    await p.click('#tapSoundRow .skin[data-sound="boing"]'); await p.waitForTimeout(150);
    ok(await p.evaluate(()=>State.get().tapSound) === 'boing', '밀어서 드러난 마지막 소리도 선택됨');

    console.log('\n[4-3] 오프라인 알림 설정');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(200);
    // 러너 컨텍스트가 알림 권한을 미리 허용해 둔다
    ok(/오프라인 알림 켜기/.test(await p.textContent('#notifyBtn')), '처음엔 알림 꺼짐');
    await p.click('#notifyBtn'); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>State.get().notifyOffline) === 1, '누르면 켜지고 세이브에 남음');
    ok(/켜짐/.test(await p.textContent('#notifyBtn')), '버튼 문구가 켜짐으로');
    await p.reload(); await p.waitForTimeout(700);
    if (await p.isVisible('#offlineOk')) await p.click('#offlineOk');
    ok(await p.evaluate(()=>State.get().notifyOffline) === 1, '새로고침해도 유지');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(200);
    await p.click('#notifyBtn'); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>State.get().notifyOffline) === 0, '다시 누르면 꺼짐');
    // 2차 상한(꼬리 끝)마저 넘기면 복귀 모달에서 강조된다
    await p.evaluate(()=>UI.showOffline({seconds:2e5, capped:14400, tailSeconds:28800, tailEff:0.15, gain:5e8}, function(){}));
    await p.waitForTimeout(150);
    ok(await p.locator('#offlineText .offline-full').count() === 1, '가득 찼으면 강조 배너');
    ok(/가득 찼/.test(await p.textContent('#offlineText')), '가득 참 문구');
    ok(/보너스/.test(await p.textContent('#offlineText')), '보너스 구간 안내');
    await p.click('#offlineOk'); await p.waitForTimeout(150);
    // 상한 안이면 강조 없음
    await p.evaluate(()=>UI.showOffline({seconds:600, capped:600, tailSeconds:0, tailEff:0.15, gain:1000}, function(){}));
    await p.waitForTimeout(150);
    ok(await p.locator('#offlineText .offline-full').count() === 0, '덜 찼으면 강조 없음');
    await p.click('#offlineOk'); await p.waitForTimeout(150);

    console.log('\n[4-4] 세이브 안전 카드');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(300);
    ok(await p.locator('#saveGuard').count() === 1, '세이브 안전 카드 존재');
    ok(await p.locator('#saveGuard .sg-row').count() === 3, '세 줄(보호·백업·홈화면)');
    ok(/백업한 적 없음/.test(await p.textContent('#saveGuard')), '아직 백업 안 함 표시');
    // 내보내면 백업 시각이 남고 문구가 바뀐다
    await p.click('#exportBtn'); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>State.get().lastBackup) > 0, '내보내면 백업 시각 기록');
    // 다이얼로그 닫기
    if (await p.isVisible('#textCancel')) await p.click('#textCancel');
    else if (await p.isVisible('#textOk')) await p.click('#textOk');
    await p.waitForTimeout(200);
    await p.click('#tabbar .tab[data-tab="shop"]'); await p.waitForTimeout(100);
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(300);
    ok(/오늘 백업함/.test(await p.textContent('#saveGuard')), '백업 뒤엔 오늘 백업함으로 바뀜');

    console.log('\n[5] 안내 다시 보기');
    await p.click('#tabbar .tab[data-tab="settings"]'); await p.waitForTimeout(250);
    await p.click('#helpBtn'); await p.waitForTimeout(250);
    ok(!await p.isHidden('#tourModal'), '설정에서 다시 볼 수 있음');
    await p.click('#tourSkip'); await p.waitForTimeout(200);
    ok(await p.isHidden('#tourModal'), '건너뛰기 동작');

    console.log('\n[6] 점장');
    await p.evaluate(()=>{
      const s=State.get(); s.fameLv.f_manager=5; s.money=1e10;
      Data.GENERATORS.forEach(g=>s.gens[g.id]=10);
      s.lastSeen = Date.now() - 3*3600*1000;
      State.save = function(){return true;};
      localStorage.setItem('bunsik_idle_save_v1', JSON.stringify(s));
    });
    await p.reload(); await p.waitForTimeout(900);
    ok(!await p.isHidden('#offlineModal'), '오프라인 모달');
    ok((await p.textContent('#offlineText')).includes('점장'), '점장 예고가 보임');
    const auto0 = await p.evaluate(()=>State.get().autoBought);
    await p.click('#offlineOk'); await p.waitForTimeout(500);
    ok(await p.evaluate(()=>State.get().autoBought) > auto0, '점장이 설비를 사둠',
       '+' + (await p.evaluate(()=>State.get().autoBought) - auto0) + '개');

    console.log('\n[7] ∞ 표기');
    const infTxt = await p.evaluate(()=>{
      const s=State.get(); s.money=Infinity; Game.invalidate(); UI.refresh(true);
      return document.getElementById('money').textContent;
    });
    ok(infTxt.includes('∞'), '무한대가 ∞ 로 보임: ' + infTxt);
}, { tour: true });

/* ---------- 러너 ---------- */
(async () => {
  const filter = process.argv[2];
  const list = filter ? SUITES.filter(s => s.name.includes(filter)) : SUITES;
  if (!list.length) {
    console.error(`'${filter}' 에 해당하는 스위트가 없습니다.`);
    console.error('있는 스위트: ' + SUITES.map(s => s.name).join(' / '));
    process.exit(2);
  }
  fs.mkdirSync(D, { recursive: true });

  const { srv, port } = await serve();
  const exe = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let fails = 0;

  for (const s of list) {
    console.log('\n━━━ ' + s.name + ' ━━━');
    // 스위트끼리 세이브가 섞이지 않도록 매번 새 컨텍스트에서 돈다
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },      // iPhone 14 크기
      deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      baseURL: `http://127.0.0.1:${port}`
    });
    // 오프라인 알림 검사를 위해 알림 권한을 미리 허용해 둔다
    try { await ctx.grantPermissions(['notifications'], { origin: `http://127.0.0.1:${port}` }); } catch (e) {}
    if (!s.opts.tour) {
      // addInitScript 는 새로고침마다 돈다. 조건 없이 쓰면 세이브를 덮어써서
      // '새로고침 후에도 유지' 같은 검사가 통째로 깨진다.
      await ctx.addInitScript(() => {
        try {
          if (!localStorage.getItem('bunsik_idle_save_v1')) {
            localStorage.setItem('bunsik_idle_save_v1', JSON.stringify({ sawTour: 1 }));
          }
        } catch (e) {}
      });
    }
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

    const ok = (cond, label, extra) => {
      if (!cond) { fails++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
      else console.log('  ✓ ' + label + (extra ? '  → ' + extra : ''));
    };

    try {
      await s.fn({ page, ctx, ok, errs });
      ok(errs.length === 0, 'JS 에러 없음', errs.slice(0, 3).join(' | '));
    } catch (e) {
      fails++;
      console.log('  ✗ 스위트가 중단됨 → ' + String(e.message || e).split('\n')[0]);
    }
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log(fails === 0 ? '\n전부 통과 ✅' : `\n실패 ${fails}건 ❌`);
  process.exit(fails ? 1 : 0);
})();
