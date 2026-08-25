/* 게임 밸런스 데이터 (설비 / 업그레이드 / 명성상점 / 도전과제) */
var Data = (function () {

  /* ---------- 설비 & 직원 ---------- */
  // baseCost: 1개째 가격, rate: 1개당 초당 수익, 가격은 1개 살 때마다 1.15배
  var COST_GROWTH = 1.15;

  var GENERATORS = [
    { id: 'g1',  icon: '🧑‍🍳', name: '알바생',          desc: '떡볶이를 대신 저어줍니다',        baseCost: 15,     rate: 0.1 },
    { id: 'g2',  icon: '🍲',  name: '떡볶이 냄비',      desc: '쉬지 않고 보글보글',              baseCost: 100,    rate: 1 },
    { id: 'g3',  icon: '🍤',  name: '튀김기',           desc: '바삭함은 돈이 됩니다',            baseCost: 1100,   rate: 8 },
    { id: 'g4',  icon: '🥟',  name: '순대 찜기',        desc: '김이 모락모락',                   baseCost: 12000,  rate: 47 },
    { id: 'g5',  icon: '🍙',  name: '김밥 장인',        desc: '1초에 한 줄을 맙니다',            baseCost: 130000, rate: 260 },
    { id: 'g6',  icon: '🛵',  name: '배달 오토바이',    desc: '동네를 통째로 배달권으로',        baseCost: 1.4e6,  rate: 1400 },
    { id: 'g7',  icon: '🏬',  name: '프랜차이즈 지점',  desc: '내 이름을 건 2호점',              baseCost: 2e7,    rate: 7800 },
    { id: 'g8',  icon: '🏭',  name: '중앙 주방 공장',   desc: '떡을 톤 단위로 뽑아냅니다',       baseCost: 3.3e8,  rate: 44000 },
    { id: 'g9',  icon: '✈️',  name: '해외 진출 본부',   desc: 'K-분식의 세계화',                 baseCost: 5.1e9,  rate: 260000 },
    { id: 'g10', icon: '🚀',  name: '우주 분식 스테이션', desc: '무중력 떡볶이, 특허 출원 중',   baseCost: 7.5e10, rate: 1.6e6 }
  ];

  /* ---------- 업그레이드 ---------- */
  // kind: 'gen'(특정 설비 배율) | 'tap'(탭 배율) | 'tapPct'(탭에 초당수익 % 추가) | 'all'(전체 배율)
  var UPGRADES = [];

  // 설비별 강화: 보유 수가 임계치를 넘으면 해금
  var GEN_TIERS = [
    { need: 10,  costX: 60,     mult: 2, roman: 'I' },
    { need: 25,  costX: 600,    mult: 2, roman: 'II' },
    { need: 50,  costX: 6000,   mult: 2, roman: 'III' },
    { need: 100, costX: 60000,  mult: 2, roman: 'IV' },
    { need: 150, costX: 600000, mult: 3, roman: 'V' }
  ];

  GENERATORS.forEach(function (g) {
    GEN_TIERS.forEach(function (t, i) {
      UPGRADES.push({
        id: g.id + '_u' + (i + 1),
        icon: g.icon,
        name: g.name + ' 강화 ' + t.roman,
        desc: g.name + ' 수익 ×' + t.mult + ' (' + t.need + '개 보유 시)',
        cost: g.baseCost * t.costX,
        kind: 'gen',
        target: g.id,
        value: t.mult,
        needGen: { id: g.id, count: t.need },
        order: 100 + i * 10
      });
    });
  });

  // 탭(직접 조리) 강화
  [
    { id: 't1', icon: '👌', name: '손목 스냅',       desc: '탭 수익 ×2',  cost: 150,   mult: 2, taps: 10 },
    { id: 't2', icon: '🙌', name: '양손 조리',       desc: '탭 수익 ×2',  cost: 5000,  mult: 2, taps: 50 },
    { id: 't3', icon: '🔥', name: '불맛 내기',       desc: '탭 수익 ×3',  cost: 1.2e5, mult: 3, taps: 150 },
    { id: 't4', icon: '🌪️', name: '신들린 손놀림',   desc: '탭 수익 ×3',  cost: 5e6,   mult: 3, taps: 400 },
    { id: 't5', icon: '⚡', name: '초음속 젓가락',   desc: '탭 수익 ×4',  cost: 2e8,   mult: 4, taps: 800 },
    { id: 't6', icon: '💥', name: '분식의 신',       desc: '탭 수익 ×5',  cost: 1e11,  mult: 5, taps: 1500 }
  ].forEach(function (u, i) {
    UPGRADES.push({
      id: u.id, icon: u.icon, name: u.name, desc: u.desc,
      cost: u.cost, kind: 'tap', value: u.mult,
      needTaps: u.taps, order: 10 + i
    });
  });

  // 탭이 초당 수익의 일부를 함께 벌어들이게 하는 업그레이드
  [
    { id: 'tp1', icon: '🥄', name: '감으로 조리',     pct: 0.01, cost: 1e6 },
    { id: 'tp2', icon: '📿', name: '30년 손맛',       pct: 0.02, cost: 1e9 },
    { id: 'tp3', icon: '👑', name: '전설의 레시피',   pct: 0.05, cost: 1e13 }
  ].forEach(function (u, i) {
    UPGRADES.push({
      id: u.id, icon: u.icon, name: u.name,
      desc: '탭 할 때 초당 수익의 ' + Math.round(u.pct * 100) + '%를 추가 획득',
      cost: u.cost, kind: 'tapPct', value: u.pct,
      needEarned: u.cost / 4, order: 40 + i
    });
  });

  // 전체 배율
  [
    { id: 'a1', icon: '🧼', name: '위생 등급 A',     mult: 1.25, cost: 1e5 },
    { id: 'a2', icon: '🎫', name: '단골 손님 카드',  mult: 1.25, cost: 1e7 },
    { id: 'a3', icon: '📱', name: 'SNS 맛집 인증',   mult: 1.3,  cost: 1e9 },
    { id: 'a4', icon: '📺', name: '방송 출연',       mult: 1.4,  cost: 1e11 },
    { id: 'a5', icon: '⭐', name: '미쉐린 분식',     mult: 1.5,  cost: 1e14 },
    { id: 'a6', icon: '🌏', name: '분식 제국',       mult: 2,    cost: 1e17 }
  ].forEach(function (u, i) {
    UPGRADES.push({
      id: u.id, icon: u.icon, name: u.name,
      desc: '모든 수익 ×' + u.mult,
      cost: u.cost, kind: 'all', value: u.mult,
      needEarned: u.cost / 3, order: 1 + i
    });
  });

  /* ---------- 명성 상점 (환생 재화로 구매, 영구) ---------- */
  // cost = baseCost * costGrow^level, max 까지 반복 구매
  var FAME_SHOP = [
    {
      id: 'f_mult', icon: '💰', name: '전설의 명성',
      desc: '모든 수익 ×1.5 (중첩)',
      baseCost: 1, costGrow: 2.2, max: 20
    },
    {
      id: 'f_tap', icon: '✋', name: '명인의 손',
      desc: '탭 수익 ×3 (중첩)',
      baseCost: 1, costGrow: 2.0, max: 15
    },
    {
      id: 'f_offtime', icon: '⏰', name: '무인 주문 시스템',
      desc: '오프라인 수익 인정 시간 +2시간',
      baseCost: 2, costGrow: 1.8, max: 12
    },
    {
      id: 'f_offeff', icon: '🤖', name: '자동 조리 로봇',
      desc: '오프라인 수익 효율 +10%',
      baseCost: 3, costGrow: 1.9, max: 10
    },
    {
      id: 'f_start', icon: '🏦', name: '창업 지원금',
      desc: '재개업 후 시작 자금 ×100 증가',
      baseCost: 2, costGrow: 2.4, max: 12
    },
    {
      id: 'f_cheap', icon: '🏷️', name: '단체 구매 계약',
      desc: '모든 설비 가격 -3%',
      baseCost: 5, costGrow: 2.6, max: 10
    },
    {
      id: 'f_gold', icon: '🌟', name: '황금 손님 단골화',
      desc: '황금 손님이 8% 더 자주 옵니다',
      baseCost: 3, costGrow: 2.0, max: 12
    },
    {
      id: 'f_boost', icon: '📣', name: '확성기',
      desc: '손님 몰이 쿨다운 -8%',
      baseCost: 4, costGrow: 2.1, max: 10
    },
    {
      id: 'f_police', icon: '🚓', name: '야간 순찰',
      desc: '경찰이 도둑을 잡아줄 확률 +7%p',
      baseCost: 3, costGrow: 1.9, max: 10
    }
  ];

  /* ---------- 황금 손님 ---------- */
  // 일정 시간마다 화면을 가로질러 지나간다. 잡으면 셋 중 하나.
  var GOLDEN = {
    minGap: 55,        // 등장 간격 (초) 최소
    maxGap: 130,       // 등장 간격 (초) 최대
    life: 9,           // 화면에 머무는 시간 (초)
    gapPerLv: 0.92,    // 명성상점 f_gold 1레벨당 간격 배율
    types: [
      {
        id: 'cash', icon: '💰', name: '현금 다발', weight: 5,
        desc: '초당 수익 4분치를 즉시 획득'
      },
      {
        id: 'rush', icon: '⚡', name: '손님 폭주', weight: 3,
        desc: '30초 동안 모든 수익 ×7', mult: 7, dur: 30
      },
      {
        id: 'hand', icon: '👐', name: '신들린 손', weight: 2,
        desc: '30초 동안 탭 수익 ×25', mult: 25, dur: 30
      }
    ]
  };

  /* ---------- 도둑 & 경찰 ---------- */
  // 가끔 도둑이 금고를 노리고 화면을 가로지른다.
  // 탭해서 직접 잡으면 피해가 없고 보너스까지, 경찰이 잡으면 피해만 없다.
  // 놓치면 그때 돈이 빠진다 — 설비와 업그레이드는 건드리지 않는다.
  var THIEF = {
    minGap: 200,          // 등장 간격 (초) 최소
    maxGap: 460,          // 등장 간격 (초) 최대
    life: 7.5,            // 화면을 가로지르는 시간 (초). 이 안에 탭해야 한다
    stealPct: 0.08,       // 보유 금액의 이만큼을 노린다
    stealCapSec: 180,     // 다만 초당 수익 3분치를 넘지 않는다
    minSteal: 100,        // 훔칠 게 이보다 적으면 아예 나타나지 않는다
    catchBonus: 0.5,      // 직접 잡으면 노렸던 금액의 이만큼을 보너스로
    policeBase: 0.15,     // 경찰이 자동으로 잡을 기본 확률
    policePerLv: 0.07,    // 명성상점 f_police 1레벨당 +7%p
    policeStart: 0.22,    // 도둑이 이만큼 지났을 때 경찰이 출발
    policeCatchAt: 0.72   // 이 지점에서 따라잡는다
  };

  /* ---------- 손님 몰이 (부스트 버튼) ---------- */
  var BOOST = {
    mult: 3,           // 배율
    dur: 60,           // 지속 시간 (초)
    cd: 900,           // 쿨다운 (초) — 명성상점 f_boost 로 줄어든다
    cdPerLv: 0.92
  };

  /* ---------- 일일 출석 보상 ---------- */
  // 하루 한 번, 초당 수익 기준으로 지급. 연속 출석하면 늘어난다 (최대 7일치).
  var DAILY = {
    baseSeconds: 1800,     // 1일차: 초당 수익 30분치
    perStreak: 1800,       // 연속 1일마다 +30분치
    maxStreak: 7,
    minMoney: 500          // 초반(수익 0)에도 최소한 이만큼은 준다
  };



  /* ---------- 주먹밥 캐릭터 (인라인 SVG) ----------
     이모지에는 얼굴 달린 주먹밥이 없어서 직접 그린다.
     단계가 오를수록 재료가 얹히고 표정이 살아난다. */

  function onigiri(o) {
    var body = o.body || '#fdfdfb';
    var eyes = o.eyes || 'dot';
    var parts = [];

    // 밥 몸통 (모서리 둥근 삼각형)
    parts.push('<path d="M50 11c6 0 10 4 12 8l26 55c4 8 0 16-8 16H20c-8 0-12-8-8-16l26-55c2-4 6-8 12-8z" ' +
               'fill="' + body + '" stroke="rgba(0,0,0,.16)" stroke-width="2"/>');

    // 위에 얹는 재료
    if (o.top) parts.push(o.top);

    // 김 띠
    parts.push('<path d="M28 62h44c3 0 5 2 5 5v13c0 3-2 5-5 5H28c-3 0-5-2-5-5V67c0-3 2-5 5-5z" fill="#2f3540"/>');

    // 볼터치
    if (o.blush) {
      parts.push('<ellipse cx="30" cy="53" rx="7" ry="4.5" fill="#ffa8b6" opacity=".75"/>');
      parts.push('<ellipse cx="70" cy="53" rx="7" ry="4.5" fill="#ffa8b6" opacity=".75"/>');
    }

    // 눈
    if (eyes === 'happy') {
      parts.push('<path d="M34 48c3-4 8-4 11 0M55 48c3-4 8-4 11 0" stroke="#2f3540" stroke-width="3.4" ' +
                 'fill="none" stroke-linecap="round"/>');
    } else if (eyes === 'shades') {
      parts.push('<path d="M31 43h38v4c0 5.5-4.5 9-10 9s-9-3.5-9.5-8c-.5 4.5-4 8-9.5 8s-10-3.5-10-9z" ' +
                 'fill="#2f3540"/><path d="M34 46h9M57 46h9" stroke="rgba(255,255,255,.35)" ' +
                 'stroke-width="2" stroke-linecap="round"/>');
    } else if (eyes === 'star') {
      parts.push('<path d="M39 41l3 6 6 1-4.5 4.5 1 6-5.5-3-5.5 3 1-6L30 48l6-1z" fill="#2f3540"/>');
      parts.push('<path d="M64 41l3 6 6 1-4.5 4.5 1 6-5.5-3-5.5 3 1-6L58 48l6-1z" fill="#2f3540"/>');
    } else {
      parts.push('<ellipse cx="39" cy="48" rx="4" ry="5" fill="#2f3540"/>');
      parts.push('<ellipse cx="61" cy="48" rx="4" ry="5" fill="#2f3540"/>');
    }

    // 입
    parts.push(o.mouth ||
      '<path d="M44 56c2 2.5 10 2.5 12 0" stroke="#2f3540" stroke-width="3" fill="none" stroke-linecap="round"/>');

    // 머리 위 장식
    if (o.hat) parts.push(o.hat);

    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
           parts.join('') + '</svg>';
  }

  var CROWN = '<path d="M36 16l5 7 9-11 9 11 5-7 2 12H34z" fill="#ffcc44" stroke="#c99a17" stroke-width="1.5"/>';
  var SPARK = '<path d="M84 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffe07a"/>' +
              '<path d="M16 26l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="#ffe07a"/>';

  var ONIGIRI = [
    // 1 주먹밥
    onigiri({}),
    // 2 구운 주먹밥 — 살짝 노릇하게
    onigiri({ body: '#f7e7c3', eyes: 'happy',
      top: '<path d="M38 30c6 3 18 3 24 0" stroke="#d9a441" stroke-width="3.5" fill="none" stroke-linecap="round"/>' }),
    // 3 곱빼기 — 참깨를 뿌렸다
    onigiri({ eyes: 'happy', blush: true,
      top: '<g fill="#6b5b3e"><circle cx="42" cy="32" r="2"/><circle cx="55" cy="28" r="2"/>' +
           '<circle cx="60" cy="36" r="2"/><circle cx="47" cy="39" r="2"/></g>' }),
    // 4 야채 주먹밥 — 초록 야채
    onigiri({ body: '#eef7e4', eyes: 'happy', blush: true,
      top: '<g fill="#66bb52"><ellipse cx="44" cy="33" rx="7" ry="4" transform="rotate(-18 44 33)"/>' +
           '<ellipse cx="58" cy="31" rx="7" ry="4" transform="rotate(14 58 31)"/></g>' +
           '<circle cx="51" cy="38" r="3.5" fill="#ff7a5c"/>' }),
    // 5 카레 주먹밥
    onigiri({ body: '#ffe9b0', eyes: 'shades',
      top: '<path d="M34 29c7-7 25-7 32 0-5 5-27 5-32 0z" fill="#d98a22"/>' }),
    // 6 초밥 — 연어 한 점
    onigiri({ eyes: 'happy', blush: true,
      top: '<path d="M31 33c8-9 30-9 38 0-8 7-30 7-38 0z" fill="#ff8f66"/>' +
           '<path d="M34 32c8-6 24-6 32 0" stroke="#fff0e6" stroke-width="2.6" fill="none"/>' }),
    // 7 도시락 — 반찬을 이고 있다
    onigiri({ body: '#fffdf6', eyes: 'star', blush: true,
      top: '<g><rect x="30" y="24" width="40" height="12" rx="3" fill="#8b5cf6"/>' +
           '<circle cx="39" cy="30" r="3.4" fill="#ffcc44"/><circle cx="50" cy="30" r="3.4" fill="#4ade80"/>' +
           '<circle cx="61" cy="30" r="3.4" fill="#ff7a5c"/></g>' }),
    // 8 황금 주먹밥
    onigiri({ body: '#ffd75e', eyes: 'star', blush: true,
      top: '<path d="M34 33c8-7 24-7 32 0-8 5-24 5-32 0z" fill="#fff3c4"/>',
      hat: CROWN + SPARK,
      mouth: '<path d="M42 55c3 5 13 5 16 0" stroke="#2f3540" stroke-width="3" fill="none" stroke-linecap="round"/>' })
  ];


  /* ---------- 분식 캐릭터 (인라인 SVG) ----------
     기본 스킨은 누구나 처음 보는 화면이라 이모지 대신 직접 그린다.
     주먹밥 스킨과 같은 얼굴 규칙을 써서 톤을 맞춘다. */

  var INK = '#2f3540';

  // 눈·입·볼터치를 한 곳에서 만든다 (모든 캐릭터가 같은 얼굴 규칙을 쓰게)
  function face(o) {
    o = o || {};
    var cx = o.cx === undefined ? 50 : o.cx;
    var cy = o.cy === undefined ? 50 : o.cy;
    var gap = o.gap || 11;
    var sc = o.scale || 1;
    var p = [];

    if (o.blush) {
      p.push('<ellipse cx="' + (cx - gap - 8 * sc) + '" cy="' + (cy + 6 * sc) + '" rx="' + (6 * sc) +
             '" ry="' + (4 * sc) + '" fill="#ffa8b6" opacity=".7"/>');
      p.push('<ellipse cx="' + (cx + gap + 8 * sc) + '" cy="' + (cy + 6 * sc) + '" rx="' + (6 * sc) +
             '" ry="' + (4 * sc) + '" fill="#ffa8b6" opacity=".7"/>');
    }

    if (o.eyes === 'happy') {
      p.push('<path d="M' + (cx - gap - 5 * sc) + ' ' + cy + 'q' + (5 * sc) + ' ' + (-6 * sc) + ' ' + (10 * sc) + ' 0' +
             'M' + (cx + gap - 5 * sc) + ' ' + cy + 'q' + (5 * sc) + ' ' + (-6 * sc) + ' ' + (10 * sc) + ' 0" ' +
             'stroke="' + INK + '" stroke-width="' + (3.2 * sc) + '" fill="none" stroke-linecap="round"/>');
    } else if (o.eyes === 'wink') {
      p.push('<ellipse cx="' + (cx - gap) + '" cy="' + cy + '" rx="' + (3.6 * sc) + '" ry="' + (4.6 * sc) + '" fill="' + INK + '"/>');
      p.push('<path d="M' + (cx + gap - 5 * sc) + ' ' + cy + 'q' + (5 * sc) + ' ' + (-6 * sc) + ' ' + (10 * sc) + ' 0" ' +
             'stroke="' + INK + '" stroke-width="' + (3.2 * sc) + '" fill="none" stroke-linecap="round"/>');
    } else if (o.eyes === 'star') {
      [-gap, gap].forEach(function (dx) {
        var x = cx + dx, y = cy;
        p.push('<path d="M' + x + ' ' + (y - 6 * sc) + 'l' + (1.8 * sc) + ' ' + (4 * sc) + 'l' + (4.4 * sc) + ' .6l' +
               (-3.2 * sc) + ' ' + (3.1 * sc) + 'l.8 ' + (4.3 * sc) + 'l' + (-3.8 * sc) + ' ' + (-2.1 * sc) + 'l' +
               (-3.8 * sc) + ' ' + (2.1 * sc) + 'l.8 ' + (-4.3 * sc) + 'l' + (-3.2 * sc) + ' ' + (-3.1 * sc) + 'l' +
               (4.4 * sc) + ' -.6z" fill="' + INK + '"/>');
      });
    } else {
      p.push('<ellipse cx="' + (cx - gap) + '" cy="' + cy + '" rx="' + (3.6 * sc) + '" ry="' + (4.6 * sc) + '" fill="' + INK + '"/>');
      p.push('<ellipse cx="' + (cx + gap) + '" cy="' + cy + '" rx="' + (3.6 * sc) + '" ry="' + (4.6 * sc) + '" fill="' + INK + '"/>');
    }

    var my = cy + (o.mouthY === undefined ? 9 : o.mouthY) * sc;
    if (o.mouth === 'open') {
      p.push('<path d="M' + (cx - 6 * sc) + ' ' + my + 'q' + (6 * sc) + ' ' + (8 * sc) + ' ' + (12 * sc) + ' 0z" fill="' + INK + '"/>');
    } else if (o.mouth === 'cat') {
      p.push('<path d="M' + (cx - 7 * sc) + ' ' + my + 'q' + (3.5 * sc) + ' ' + (4 * sc) + ' ' + (7 * sc) + ' 0q' +
             (3.5 * sc) + ' ' + (4 * sc) + ' ' + (7 * sc) + ' 0" stroke="' + INK + '" stroke-width="' + (2.8 * sc) +
             '" fill="none" stroke-linecap="round"/>');
    } else {
      p.push('<path d="M' + (cx - 6 * sc) + ' ' + my + 'q' + (6 * sc) + ' ' + (4.5 * sc) + ' ' + (12 * sc) + ' 0" ' +
             'stroke="' + INK + '" stroke-width="' + (2.9 * sc) + '" fill="none" stroke-linecap="round"/>');
    }
    return p.join('');
  }

  function svg(inner) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
           inner + '</svg>';
  }

  var STICK = '<rect x="46.5" y="52" width="7" height="42" rx="3.5" fill="#e0bd85" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/>';
  var STEAM = '<g fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round">' +
              '<path d="M38 20q5-5 0-10"/><path d="M50 16q5-5 0-10"/><path d="M62 20q5-5 0-10"/></g>';
  var CROWN2 = '<path d="M35 12l5 7 10-11 10 11 5-7 2 13H33z" fill="#ffcc44" stroke="#c99a17" stroke-width="1.5"/>';
  var SPARK2 = '<path d="M87 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffe07a"/>' +
               '<path d="M12 30l1.6 4 4 1.6-4 1.6L12 41l-1.6-3.8-4-1.6 4-1.6z" fill="#ffe07a"/>';

  var SNACKS = [
    // 1 어묵 꼬치 — 꼬치에 꿴 어묵 세 장
    svg(STICK +
      '<g stroke="rgba(0,0,0,.15)" stroke-width="1.5">' +
      '<rect x="24" y="58" width="52" height="17" rx="6" fill="#eed6a2"/>' +
      '<rect x="22" y="30" width="56" height="22" rx="7" fill="#f7e4bc"/>' +
      '<rect x="24" y="8" width="52" height="17" rx="6" fill="#eed6a2"/>' +
      '</g>' +
      '<g stroke="#dcc08a" stroke-width="2" fill="none" stroke-linecap="round">' +
      '<path d="M30 66q6-4 12 0t12 0 12 0"/><path d="M30 16q6-4 12 0t12 0 12 0"/></g>' +
      face({ cy: 39, gap: 10, mouthY: 8 })),

    // 2 떡꼬치 — 고추장 양념을 뒤집어썼다
    svg(STICK +
      '<g stroke="rgba(0,0,0,.14)" stroke-width="1.5">' +
      '<rect x="28" y="56" width="44" height="18" rx="9" fill="#e0503a"/>' +
      '<rect x="28" y="34" width="44" height="18" rx="9" fill="#ef6042"/>' +
      '<rect x="28" y="12" width="44" height="18" rx="9" fill="#e0503a"/>' +
      '</g>' +
      '<path d="M30 40q10 5 20 0t20 0" stroke="#ffb199" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      face({ cy: 43, gap: 10, eyes: 'happy', mouthY: 7 })),

    // 3 핫도그 — 케첩 지그재그
    svg('<rect x="46.5" y="72" width="7" height="22" rx="3.5" fill="#e0bd85"/>' +
      '<rect x="26" y="12" width="48" height="66" rx="24" fill="#e6a councils"/>'.replace('#e6a councils', '#e8ab4e') +
      '<rect x="26" y="12" width="48" height="66" rx="24" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="2"/>' +
      '<path d="M32 22q9 6 18 0t18 0M32 38q9 6 18 0t18 0M32 54q9 6 18 0t18 0" ' +
      'stroke="#e0503a" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".9"/>' +
      face({ cy: 44, gap: 10, blush: true, mouthY: 8 })),

    // 4 왕만두 — 김이 모락모락
    svg(STEAM +
      '<path d="M50 26c16 0 30 11 30 26 0 12-13 20-30 20S20 64 20 52c0-15 14-26 30-26z" ' +
      'fill="#fdf6e6" stroke="rgba(0,0,0,.16)" stroke-width="2"/>' +
      '<path d="M28 36q6-8 11 0M44 32q6-8 12 0M61 36q6-8 11 0" stroke="rgba(0,0,0,.16)" ' +
      'stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      face({ cy: 52, gap: 11, eyes: 'happy', blush: true, mouthY: 9 })),

    // 5 모둠튀김 — 새우튀김
    svg(// 새우 꼬리 — 튀김옷 밖으로 부채처럼 펼쳐진다
      '<path d="M62 72q12 2 18 10l-8 3 5 7-11-2-2 8-8-9z" fill="#ff8f66" ' +
      'stroke="rgba(0,0,0,.14)" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M50 12c14 0 24 12 24 28 0 20-11 34-24 34S26 60 26 40C26 24 36 12 50 12z" ' +
      'fill="#f3b martial"/>'.replace('#f3b martial', '#f2b950') +
      '<path d="M50 12c14 0 24 12 24 28 0 20-11 34-24 34S26 60 26 40C26 24 36 12 50 12z" ' +
      'fill="none" stroke="rgba(0,0,0,.15)" stroke-width="2"/>' +
      '<g fill="#e09b30"><circle cx="36" cy="26" r="3"/><circle cx="64" cy="30" r="3"/>' +
      '<circle cx="40" cy="66" r="3"/><circle cx="62" cy="62" r="3"/></g>' +
      face({ cy: 44, gap: 10, eyes: 'wink', mouthY: 8 })),

    // 6 라면 정식 — 면과 계란
    svg(STEAM +
      '<path d="M22 44h56q-3 30-28 30T22 44z" fill="#e8e3f5" stroke="rgba(0,0,0,.16)" stroke-width="2"/>' +
      '<path d="M18 40h64v7H18z" rx="3" fill="#8b5cf6"/>' +
      '<g stroke="#f5d76e" stroke-width="3.4" fill="none" stroke-linecap="round">' +
      '<path d="M30 40q4-9 10-4M46 40q4-11 10-3M62 40q3-8 8-3"/></g>' +
      '<circle cx="64" cy="56" r="8" fill="#fffdf5"/><circle cx="64" cy="56" r="4" fill="#ffbf47"/>' +
      '<g fill="#5fb85f"><circle cx="34" cy="54" r="3"/><circle cx="44" cy="62" r="3"/></g>' +
      face({ cy: 55, cx: 45, gap: 9, scale: .85, eyes: 'happy', blush: true, mouthY: 8 })),

    // 7 부대찌개 — 보글보글 끓는 냄비
    svg('<g fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round">' +
      '<path d="M34 22q5-6 0-12"/><path d="M50 18q5-6 0-12"/><path d="M66 22q5-6 0-12"/></g>' +
      // 손잡이
      '<rect x="4" y="40" width="16" height="7" rx="3.5" fill="#4a4560"/>' +
      '<rect x="80" y="40" width="16" height="7" rx="3.5" fill="#4a4560"/>' +
      // 냄비
      '<path d="M16 38h68v18q0 26-34 26T16 56z" fill="#6b6480" stroke="rgba(0,0,0,.22)" stroke-width="2"/>' +
      // 국물
      '<ellipse cx="50" cy="40" rx="30" ry="7" fill="#c9452f"/>' +
      '<path d="M20 40q0 14 30 14t30-14v4q0 14-30 14T20 44z" fill="#c9452f"/>' +
      // 건더기와 거품
      '<ellipse cx="36" cy="38" rx="8" ry="4" fill="#f2b950" transform="rotate(-12 36 38)"/>' +
      '<ellipse cx="62" cy="41" rx="8" ry="4" fill="#f7e4bc" transform="rotate(10 62 41)"/>' +
      '<circle cx="46" cy="36" r="3" fill="#ffd9a0" opacity=".95"/>' +
      face({ cy: 62, gap: 10, eyes: 'happy', mouth: 'open', mouthY: 8 })),

    // 8 프리미엄 한상 — 왕관 쓴 도시락
    svg(CROWN2 + SPARK2 +
      // 반찬이 담긴 윗칸
      '<rect x="14" y="28" width="72" height="26" rx="6" fill="#ffe9a8" stroke="#c99a17" stroke-width="2"/>' +
      '<g stroke="rgba(0,0,0,.15)" stroke-width="1.5">' +
      '<rect x="20" y="33" width="20" height="16" rx="3" fill="#fffdf5"/>' +
      '<rect x="43" y="33" width="15" height="16" rx="3" fill="#ff8f66"/>' +
      '<rect x="61" y="33" width="19" height="16" rx="3" fill="#8fd18f"/></g>' +
      '<circle cx="30" cy="41" r="4" fill="#ff7a5c"/>' +
      // 얼굴이 올라가는 앞판
      '<path d="M12 54h76v22q0 8-8 8H20q-8 0-8-8z" fill="#ffd75e" stroke="#c99a17" stroke-width="2"/>' +
      face({ cy: 66, gap: 11, eyes: 'star', blush: true, mouthY: 8 })),
  ];

  /* ---------- 조리 음식 스킨 ---------- */
  // 탭 수익이 오르면 steps 를 따라 메뉴가 올라간다.
  // at 은 "이 수익부터 이 메뉴" 라는 뜻 (버프·콤보를 뺀 순수 탭 수익 기준).
  // 실제 진행 시뮬레이션에 맞춰 잡았다 — 첫 회차 하루 안에 6단계까지 보이고,
  // 7·8단계는 환생 이후의 목표가 된다. 환생하면 탭 수익과 함께 단계도 내려간다.
  var TAP_STEP_AT = [0, 8, 100, 800, 6e3, 5e4, 1e6, 5e7];

  // svgs 를 주면 큰 화면과 단계표에서는 그림을, 말풍선처럼 작은 곳에서는 이모지를 쓴다
  function ladder(list, svgs) {
    return list.map(function (x, i) {
      return { at: TAP_STEP_AT[i], icon: x[0], name: x[1], svg: svgs ? svgs[i] : null };
    });
  }

  var TAP_SKINS = [
    {
      id: 'auto', icon: '🍢', svg: SNACKS[0], name: '분식 성장형',
      desc: '어묵 꼬치에서 시작해 한상 차림까지',
      steps: ladder([
        ['🍢', '어묵 꼬치'], ['🍡', '떡꼬치'], ['🌭', '핫도그'], ['🥟', '왕만두'],
        ['🍤', '모둠튀김'], ['🍜', '라면 정식'], ['🍲', '부대찌개'], ['🍱', '프리미엄 한상']
      ], SNACKS)
    },
    {
      id: 'bungeo', icon: '🐟', name: '붕어빵 가게',
      desc: '겨울 간식으로 통일',
      steps: ladder([
        ['🐟', '붕어빵'], ['🐠', '슈크림 붕어빵'], ['🥚', '계란빵'], ['🥞', '호떡'],
        ['🍞', '델리만쥬'], ['🥐', '크림 붕어빵'], ['🍰', '붕어빵 케이크'], ['🐡', '황금 붕어빵']
      ])
    },
    {
      id: 'jumeok', icon: '🍙', svg: ONIGIRI[3], name: '주먹밥 부락',
      desc: '얼굴 달린 주먹밥 친구들',
      steps: ladder([
        ['🍙', '주먹밥'], ['🍘', '구운 주먹밥'], ['🍚', '깨 주먹밥'], ['🥗', '야채 주먹밥'],
        ['🍛', '카레 주먹밥'], ['🍣', '연어 주먹밥'], ['🍱', '도시락 주먹밥'], ['🏆', '황금 주먹밥']
      ], ONIGIRI)
    },
    {
      id: 'tteok', icon: '🍡', name: '떡·디저트',
      desc: '달달한 것만 골라서',
      steps: ladder([
        ['🍡', '경단'], ['🧁', '컵케이크'], ['🍮', '푸딩'], ['🥮', '월병'],
        ['🍧', '빙수'], ['🍨', '아이스크림'], ['🍰', '조각 케이크'], ['🎂', '홀 케이크']
      ])
    },
    {
      id: 'noodle', icon: '🍜', name: '면 요리',
      desc: '국물부터 볶음까지',
      steps: ladder([
        ['🍜', '라면'], ['🥢', '잔치국수'], ['🍝', '파스타'], ['🥡', '짜장면'],
        ['🍲', '전골'], ['🥘', '해물찜'], ['🍛', '카레우동'], ['🦞', '랍스터 라면']
      ])
    }
  ];

  /* ---------- 손님 스킨 ---------- */
  // 초당 수익이 오르면 거리에 오는 손님의 격이 올라간다.
  // 상반신만 그려지는 이모지는 머리만 떠다니는 것처럼 보이므로 전신만 골랐다.
  var CROWD_TIER_AT = [0, 300, 5e4, 5e6, 5e8];

  // cast: 걸어다닐 인물 (상반신만 그려지는 이모지는 머리만 떠다녀 보여서 제외)
  // acc:  인물 옆에 붙는 소지품/장신구. 등급이 올라갈수록 값나가는 것을 든다.
  // head: acc 중 머리 위에 얹어야 자연스러운 것들
  var HEADWEAR = ['👑', '🎩', '⛑️', '🧢', '👒'];

  function crowd(list) {
    return list.map(function (t, i) {
      return { at: CROWD_TIER_AT[i], name: t[0], cast: t[1], acc: t[2] || [] };
    });
  }

  var CROWD_SKINS = [
    {
      id: 'auto', icon: '🚶', name: '동네 → 재벌',
      desc: '소문이 나면 돈 있는 손님이 찾아옵니다',
      tiers: crowd([
        ['동네 손님',    ['🚶', '🚶‍♀️', '🧍', '🧍‍♀️', '🐕']],
        ['소문 난 가게', ['🏃', '🏃‍♀️', '🚶‍♂️', '🚴', '🛴']],
        ['차려입은 손님', ['🕴️', '💃', '🕺', '🚶‍♀️', '🚶‍♂️'], ['🎩', '🕶️', '👜', '🌹', '📸']],
        ['VIP 손님',     ['🕴️', '💃', '🕺', '🚶', '🏃'],       ['💼', '🥂', '💍', '🎻', '📸']],
        ['재벌 손님',    ['🕴️', '💃', '🕺', '🚶‍♀️', '🕴️'],   ['👑', '💎', '🏆', '🪙', '🥇']]
      ])
    },
    {
      id: 'animal', icon: '🐕', name: '동물 친구들',
      desc: '작은 동물부터 공룡까지',
      tiers: crowd([
        ['동네 동물',  ['🐕', '🐈', '🐇', '🐧']],
        ['숲 친구들',  ['🐿️', '🦆', '🐐', '🐑']],
        ['목장 손님',  ['🐎', '🦌', '🐖', '🦩'], ['🎀', '🔔']],
        ['맹수 손님',  ['🐅', '🐆', '🦒', '🐘'], ['👑', '💎']],
        ['전설의 짐승', ['🐉', '🦖', '🦕', '🦍'], ['👑', '🔥', '⚡']]
      ])
    },
    {
      id: 'fantasy', icon: '🧙', name: '판타지',
      desc: '마법사와 용이 줄을 섭니다',
      tiers: crowd([
        ['견습생',   ['🧙', '🧝', '🥷', '🧍']],
        ['모험가',   ['🧚', '🧜', '🧛', '🧙']],
        ['영웅',     ['🦸', '🦹', '🧟', '🧝'], ['⚔️', '🛡️', '✨']],
        ['대마법사', ['🧞', '🦸', '🧚', '🧙'], ['🔮', '📜', '⚡']],
        ['신화',     ['🐉', '🦖', '🧞', '🦸'], ['👑', '🔥', '🌟']]
      ])
    },
    {
      id: 'ride', icon: '🛵', name: '탈것 거리',
      desc: '자전거에서 우주선까지',
      tiers: crowd([
        ['자전거',   ['🚶', '🚲', '🛴', '🛹']],
        ['오토바이', ['🛵', '🏍️', '🚗', '🚲']],
        ['자가용',   ['🚙', '🚕', '🚌', '🛵']],
        ['대형차',   ['🚚', '🚛', '🚓', '🚙'], ['💨']],
        ['하늘길',   ['🚀', '🛸', '🚁', '✈️'], ['💨', '🌟']]
      ])
    }
  ];

  /* ---------- 도전과제 ---------- */
  // 하나 달성할 때마다 전체 수익 +1%
  function genCount(s, id) { return s.gens[id] || 0; }

  var ACHIEVEMENTS = [
    { id: 'ac1',  icon: '👋', name: '첫 손님',        desc: '처음으로 조리하기',              check: function (s) { return s.taps >= 1; } },
    { id: 'ac2',  icon: '💪', name: '손맛 견습',      desc: '100번 조리하기',                 check: function (s) { return s.taps >= 100; } },
    { id: 'ac3',  icon: '🦾', name: '조리 기계',      desc: '1,000번 조리하기',               check: function (s) { return s.taps >= 1000; } },
    { id: 'ac4',  icon: '🔨', name: '무쇠 손목',      desc: '10,000번 조리하기',              check: function (s) { return s.taps >= 10000; } },
    { id: 'ac5',  icon: '🪙', name: '첫 매출',        desc: '누적 1,000원 벌기',              check: function (s) { return s.runEarned >= 1000; } },
    { id: 'ac6',  icon: '💵', name: '동네 맛집',      desc: '누적 100만원 벌기',              check: function (s) { return s.runEarned >= 1e6; } },
    { id: 'ac7',  icon: '💎', name: '지역 명물',      desc: '누적 10억원 벌기',               check: function (s) { return s.runEarned >= 1e9; } },
    { id: 'ac8',  icon: '🏆', name: '전국구',         desc: '누적 1조원 벌기',                check: function (s) { return s.runEarned >= 1e12; } },
    { id: 'ac9',  icon: '🌟', name: '억만장자 분식',  desc: '누적 1해원 벌기',                check: function (s) { return s.runEarned >= 1e20; } },
    { id: 'ac10', icon: '🧑‍🍳', name: '사장님 소리',   desc: '알바생 10명 고용',               check: function (s) { return genCount(s, 'g1') >= 10; } },
    { id: 'ac11', icon: '🍲', name: '냄비 부자',      desc: '떡볶이 냄비 25개',               check: function (s) { return genCount(s, 'g2') >= 25; } },
    { id: 'ac12', icon: '🛵', name: '배달 왕국',      desc: '배달 오토바이 25대',             check: function (s) { return genCount(s, 'g6') >= 25; } },
    { id: 'ac13', icon: '🏬', name: '프랜차이즈',     desc: '지점 10개 오픈',                 check: function (s) { return genCount(s, 'g7') >= 10; } },
    { id: 'ac14', icon: '🚀', name: '우주 진출',      desc: '우주 분식 스테이션 1개',         check: function (s) { return genCount(s, 'g10') >= 1; } },
    { id: 'ac15', icon: '📦', name: '만물상',         desc: '모든 종류의 설비 1개씩 보유',    check: function (s) { return GENERATORS.every(function (g) { return genCount(s, g.id) >= 1; }); } },
    { id: 'ac16', icon: '✨', name: '첫 재개업',      desc: '환생 1회',                       check: function (s) { return s.prestiges >= 1; } },
    { id: 'ac17', icon: '🌀', name: '윤회의 사장',    desc: '환생 5회',                       check: function (s) { return s.prestiges >= 5; } },
    { id: 'ac18', icon: '🔮', name: '분식의 화신',    desc: '명성 100 보유',                  check: function (s) { return s.fame >= 100; } },
    { id: 'ac19', icon: '😴', name: '방치의 미학',    desc: '오프라인 수익 1회 수령',         check: function (s) { return s.offlineClaims >= 1; } },
    { id: 'ac20', icon: '⏳', name: '하루 영업',      desc: '총 플레이 시간 24시간',          check: function (s) { return s.playTime >= 86400; } },
    { id: 'ac21', icon: '🌟', name: '황금 손님',      desc: '황금 손님 1명 잡기',             check: function (s) { return s.goldens >= 1; } },
    { id: 'ac22', icon: '💫', name: '황금 인맥',      desc: '황금 손님 50명 잡기',            check: function (s) { return s.goldens >= 50; } },
    { id: 'ac23', icon: '🎯', name: '연속 조리',      desc: '콤보 50 달성',                   check: function (s) { return s.bestCombo >= 50; } },
    { id: 'ac24', icon: '📣', name: '호객의 달인',    desc: '손님 몰이 10회 사용',            check: function (s) { return s.boosts >= 10; } },
    { id: 'ac25', icon: '📅', name: '개근 사장',      desc: '7일 연속 출석',                  check: function (s) { return s.dailyStreak >= 7; } },
    { id: 'ac26', icon: '🚨', name: '현행범 체포',    desc: '도둑 1명 직접 잡기',             check: function (s) { return s.thievesCaught >= 1; } },
    { id: 'ac27', icon: '🥋', name: '분식집 자경단',  desc: '도둑 25명 직접 잡기',            check: function (s) { return s.thievesCaught >= 25; } },
    { id: 'ac28', icon: '🚓', name: '든든한 순찰',    desc: '경찰이 도둑을 10번 잡아줌',      check: function (s) { return s.thiefSaves >= 10; } }
  ];

  return {
    COST_GROWTH: COST_GROWTH,
    GENERATORS: GENERATORS,
    UPGRADES: UPGRADES,
    FAME_SHOP: FAME_SHOP,
    ACHIEVEMENTS: ACHIEVEMENTS,
    TAP_SKINS: TAP_SKINS,
    CROWD_SKINS: CROWD_SKINS,
    HEADWEAR: HEADWEAR,
    GOLDEN: GOLDEN,
    THIEF: THIEF,
    BOOST: BOOST,
    DAILY: DAILY
  };
})();
