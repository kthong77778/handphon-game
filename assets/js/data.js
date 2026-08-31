/* 게임 밸런스 데이터 (설비 / 업그레이드 / 명성상점 / 도전과제) */
var Data = (function () {

  /* ---------- 설비 & 직원 ---------- */
  // baseCost: 1개째 가격, rate: 1개당 초당 수익, 가격은 1개 살 때마다 1.15배
  var COST_GROWTH = 1.15;

  var GENERATORS = [
    { id: 'g1',  icon: 'gen/gen_alba.png', name: '알바생',          desc: '떡볶이를 대신 저어줍니다',        baseCost: 15,     rate: 0.1 },
    { id: 'g2',  icon: 'equip_tteokbokki.png', name: '떡볶이 냄비', desc: '쉬지 않고 보글보글',       baseCost: 100,    rate: 1 },
    { id: 'g3',  icon: 'gen/gen_fryer.png',  name: '튀김기',           desc: '바삭함은 돈이 됩니다',            baseCost: 1100,   rate: 8 },
    { id: 'g4',  icon: 'gen/gen_steamer.png',  name: '만두 찜기',        desc: '김이 모락모락 찐만두',            baseCost: 12000,  rate: 47 },
    { id: 'g5',  icon: 'gen/gen_gimbap_master.png',  name: '김밥 장인',        desc: '1초에 한 줄을 맙니다',            baseCost: 130000, rate: 260 },
    { id: 'g6',  icon: 'gen/gen_delivery.png',  name: '배달 오토바이',    desc: '동네를 통째로 배달권으로',        baseCost: 1.4e6,  rate: 1400 },
    { id: 'g7',  icon: 'gen/gen_franchise.png',  name: '프랜차이즈 지점',  desc: '내 이름을 건 2호점',              baseCost: 2e7,    rate: 7800 },
    { id: 'g8',  icon: 'gen/gen_factory.png',  name: '중앙 주방 공장',   desc: '떡을 톤 단위로 뽑아냅니다',       baseCost: 3.3e8,  rate: 44000 },
    { id: 'g9',  icon: 'gen/gen_overseas.png',  name: '해외 진출 본부',   desc: 'K-분식의 세계화',                 baseCost: 5.1e9,  rate: 260000 },
    { id: 'g10', icon: 'gen/gen_space.png',  name: '우주 분식 스테이션', desc: '무중력 떡볶이, 특허 출원 중',   baseCost: 7.5e10, rate: 1.6e6 }
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
    { id: 't1', icon: 'up/up_t1.png', name: '손목 스냅',       desc: '탭 수익 ×2',  cost: 150,   mult: 2, taps: 10 },
    { id: 't2', icon: 'up/up_t2.png', name: '양손 조리',       desc: '탭 수익 ×2',  cost: 5000,  mult: 2, taps: 50 },
    { id: 't3', icon: 'up/up_t3.png', name: '불맛 내기',       desc: '탭 수익 ×3',  cost: 1.2e5, mult: 3, taps: 150 },
    { id: 't4', icon: 'up/up_t4.png', name: '신들린 손놀림',   desc: '탭 수익 ×3',  cost: 5e6,   mult: 3, taps: 400 },
    { id: 't5', icon: 'up/up_t5.png', name: '초음속 젓가락',   desc: '탭 수익 ×4',  cost: 2e8,   mult: 4, taps: 800 },
    { id: 't6', icon: 'up/up_t6.png', name: '분식의 신',       desc: '탭 수익 ×5',  cost: 1e11,  mult: 5, taps: 1500 }
  ].forEach(function (u, i) {
    UPGRADES.push({
      id: u.id, icon: u.icon, name: u.name, desc: u.desc,
      cost: u.cost, kind: 'tap', value: u.mult,
      needTaps: u.taps, order: 10 + i
    });
  });

  // 탭이 초당 수익의 일부를 함께 벌어들이게 하는 업그레이드
  [
    { id: 'tp1', icon: 'up/up_tp1.png', name: '감으로 조리',     pct: 0.01, cost: 1e6 },
    { id: 'tp2', icon: 'up/up_tp2.png', name: '30년 손맛',       pct: 0.02, cost: 1e9 },
    { id: 'tp3', icon: 'up/up_tp3.png', name: '전설의 레시피',   pct: 0.05, cost: 1e13 }
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
    { id: 'a1', icon: 'up/up_a1.png', name: '위생 등급 A',     mult: 1.25, cost: 1e5 },
    { id: 'a2', icon: 'up/up_a2.png', name: '단골 손님 카드',  mult: 1.25, cost: 1e7 },
    { id: 'a3', icon: 'up/up_a3.png', name: 'SNS 맛집 인증',   mult: 1.3,  cost: 1e9 },
    { id: 'a4', icon: 'up/up_a4.png', name: '방송 출연',       mult: 1.4,  cost: 1e11 },
    { id: 'a5', icon: 'up/up_a5.png', name: '미쉐린 분식',     mult: 1.5,  cost: 1e14 },
    { id: 'a6', icon: 'up/up_a6.png', name: '분식 제국',       mult: 2,    cost: 1e17 }
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
      id: 'f_mult', icon: 'fame/fame_legend.png', name: '전설의 명성',
      desc: '모든 수익 ×1.5 (중첩)',
      baseCost: 1, costGrow: 2.2, max: 20
    },
    {
      id: 'f_tap', icon: 'fame/fame_master_hand.png', name: '명인의 손',
      desc: '탭 수익 ×3 (중첩)',
      baseCost: 1, costGrow: 2.0, max: 15
    },
    {
      id: 'f_offtime', icon: 'fame/fame_kiosk.png', name: '무인 주문 시스템',
      desc: '오프라인 수익 인정 시간 +2시간',
      baseCost: 2, costGrow: 1.8, max: 12
    },
    {
      id: 'f_offeff', icon: 'fame/fame_robot.png', name: '자동 조리 로봇',
      desc: '오프라인 수익 효율 +10%',
      baseCost: 3, costGrow: 1.9, max: 10
    },
    {
      id: 'f_start', icon: 'fame/fame_fund.png', name: '창업 지원금',
      desc: '재개업 후 시작 자금 ×100 증가',
      baseCost: 2, costGrow: 2.4, max: 12
    },
    {
      id: 'f_cheap', icon: 'fame/fame_contract.png', name: '단체 구매 계약',
      desc: '모든 설비 가격 -3%',
      baseCost: 5, costGrow: 2.6, max: 10
    },
    {
      id: 'f_gold', icon: 'fame/fame_vip_star.png', name: '황금 손님 단골화',
      desc: '황금 손님이 8% 더 자주 옵니다',
      baseCost: 3, costGrow: 2.0, max: 12
    },
    {
      id: 'f_boost', icon: 'fame/fame_megaphone.png', name: '확성기',
      desc: '손님 몰이 쿨다운 -8%',
      baseCost: 4, costGrow: 2.1, max: 10
    },
    {
      id: 'f_police', icon: 'fame/fame_patrol.png', name: '야간 순찰',
      desc: '경찰이 도둑을 잡아줄 확률 +7%p',
      baseCost: 3, costGrow: 1.9, max: 10
    },
    {
      id: 'f_manager', icon: 'fame/fame_manager.png', name: '점장 고용',
      desc: '자리를 비운 동안 설비를 대신 사둡니다 (레벨당 +2회)',
      baseCost: 8, costGrow: 2.3, max: 10
    },
    {
      id: 'f_legend', icon: 'fame/fame_crown.png', name: '분식 왕조',
      desc: '모든 수익 ×3 (중첩) — 후반 명성 소비처',
      baseCost: 5000, costGrow: 3.2, max: 25
    },
    {
      // 상한 없는 명성 소비처 — 명성상점을 다 채운 장기 유저에게 '항상 살 게 있는' 목적지.
      // 효과(×1.05)보다 비용(×1.55)이 빨리 커져 파워 스파이크 없이 끝없이 이어진다.
      // max 는 형식상 큰 값(999) — 비용이 기하급수라 사실상 무한이다.
      id: 'f_research', icon: 'fame/fame_research.png', name: '끝없는 연구',
      desc: '모든 수익 ×1.05 (중첩 · 상한 없음 ∞)',
      baseCost: 50, costGrow: 1.55, max: 999, infinite: true
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
        id: 'cash', icon: 'event/event_cash.png', name: '현금 다발', weight: 5,
        desc: '초당 수익 4분치를 즉시 획득'
      },
      {
        id: 'rush', icon: 'event/event_boost.png', name: '손님 폭주', weight: 3,
        desc: '30초 동안 모든 수익 ×7', mult: 7, dur: 30
      },
      {
        id: 'hand', icon: 'event/event_golden_hand.png', name: '신들린 손', weight: 2,
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

  /* ---------- 점장 (오프라인 자동 구매) ---------- */
  // 돌아왔을 때 돈만 쌓여 있고 직접 다 사야 하는 게 방치형에서 가장 지치는 부분이다.
  // 점장은 자리를 비운 동안 가성비가 좋은 설비를 대신 사둔다.
  var MANAGER = {
    buysPerLv: 2,        // 명성상점 레벨당 살 수 있는 횟수
    minOfflineSec: 300,  // 5분은 넘게 비워야 일한다
    keepRatio: 0.25      // 보유 금액의 이만큼은 남겨둔다 (돌아와서 쓸 돈)
  };

  /* ---------- 오프라인 보상 ---------- */
  // 인정 시간(상한)까지는 제값(offlineEfficiency), 그 뒤 2차 상한까지는 꼬리 효율로 '찔끔' 더 준다.
  // 오래 비워도 손해가 덜하게 하되, 자주 접속하는 이득은 유지 — tailMult 는 상한 배수, tailEff 는 꼬리 효율.
  var OFFLINE = {
    tailMult: 3,    // 2차 상한 = 인정 시간 × 3 (기본 4h→12h, 풀강 28h→84h)
    tailEff: 0.15   // 꼬리 구간은 제 효율의 15% 만 인정
  };

  /* ---------- 일일 출석 보상 ---------- */
  // 하루 한 번, 초당 수익 기준으로 지급. 연속 출석하면 늘어난다 (최대 7일치).
  var DAILY = {
    baseSeconds: 1800,     // 1일차: 초당 수익 30분치
    perStreak: 1800,       // 연속 1일마다 +30분치
    maxStreak: 7,
    minMoney: 500,         // 초반(수익 0)에도 최소한 이만큼은 준다
    candy: 3               // 출석하면 별사탕도 같이
  };

  /* ---------- 별사탕 (🍬) — 상점 전용 재화 ----------
     돈·명성과 별개다. 출석·도전과제(이정표)·환생으로 자동으로 모이고,
     상점에서 소비 아이템을 사는 데 쓴다. 환생해도 사라지지 않는다. */
  var CANDY = {
    perAchv: 2,       // 도전과제 하나 달성마다
    perPrestige: 5    // 환생 한 번마다
  };

  // 별사탕 상점 — 소비 아이템(반복 구매). cost 는 별사탕 개수.
  var SHOP = [
    { id: 'coupon', icon: '🎟️', name: '할인 쿠폰 묶음', desc: '설비·업그레이드를 싸게 사는 쿠폰 3장', cost: 8, coupons: 3 },
    { id: 'boost',  icon: '📣', name: '수익 2배 · 30분', desc: '30분 동안 모든 수익이 ×2', cost: 5, boost: { mult: 2, dur: 1800 } },
    { id: 'gold',   icon: '💰', name: '골드 뭉치',      desc: '지금 초당 수익 10분치를 즉시 지급', cost: 6, goldSec: 600 },
    { id: 'ings',   icon: '📦', name: '재료 묶음',      desc: '조리 재료 5개를 랜덤으로', cost: 4, ings: 5 }
  ];



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
  /* ---------- 가게 앞 그림 ---------- */
  // 거리 왼쪽에 서 있는 포장마차. 손님은 오른쪽에서 걸어와 이 앞에 선다.
  // 간판 글자만 스킨을 따라간다 (분식 / 붕어빵 / 주먹밥 ...).
  function shopFront(sign) {
    var ink = 'stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"';
    return '<svg viewBox="0 0 132 92" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      // 불 켜진 온기 + 바닥 그림자
      '<ellipse cx="66" cy="46" rx="62" ry="40" fill="rgba(255,190,90,.13)"/>' +
      '<ellipse cx="66" cy="89" rx="52" ry="3.4" fill="rgba(0,0,0,.4)"/>' +
      // 기둥
      '<rect x="12" y="26" width="6" height="62" rx="2" fill="#6b4a2c" ' + ink + '/>' +
      '<rect x="114" y="26" width="6" height="62" rx="2" fill="#6b4a2c" ' + ink + '/>' +
      // 몸통 + 판매대
      '<rect x="16" y="60" width="100" height="28" rx="3" fill="#8a5a33" ' + ink + '/>' +
      '<rect x="12" y="55" width="108" height="7" rx="3" fill="#c98a4b" ' + ink + '/>' +
      // 천막 (굵은 스캘럽)
      '<path d="M8 32 L20 14 H112 L124 32 Z" fill="#e0503f" ' + ink + '/>' +
      '<g fill="#fff4e0" opacity=".92">' +
        '<path d="M36 14h15l-4 18H31z"/><path d="M64 14h15v18H64z"/>' +
        '<path d="M92 14h15l4 18H96z"/></g>' +
      '<path d="M8 32 L20 14 H112 L124 32 Z" fill="none" ' + ink + '/>' +
      '<path d="M8 32 a9.7 9.7 0 0 0 19.3 0 a9.7 9.7 0 0 0 19.3 0 a9.7 9.7 0 0 0 19.3 0 a9.7 9.7 0 0 0 19.3 0 a9.7 9.7 0 0 0 19.3 0 a9.7 9.7 0 0 0 19.3 0" fill="#e0503f" ' + ink + '/>' +
      // 간판
      '<rect x="41" y="15" width="50" height="15" rx="4" fill="#fff4e0" ' + ink + '/>' +
      '<text x="66" y="26" text-anchor="middle" font-size="11" font-weight="800"' +
        ' fill="#c0392b" font-family="system-ui,-apple-system,sans-serif">' + sign + '</text>' +
      // 등불 (왼쪽에 하나만 — 또렷하게)
      '<line x1="24" y1="33" x2="24" y2="39" stroke="' + INK + '" stroke-width="1.4"/>' +
      '<ellipse cx="24" cy="45" rx="6" ry="7" fill="#ffcf5a" ' + ink + '/>' +
      '<ellipse cx="24" cy="45" rx="6" ry="7" fill="#ffe89a" opacity=".5"/>' +
      // 냄비에서 오르는 김
      '<g class="smoke" fill="none" stroke="#ffffff" stroke-opacity=".45"' +
        ' stroke-width="2.4" stroke-linecap="round">' +
        '<path d="M40 51q4-5 0-9"/><path d="M50 51q4-5 0-9"/></g>' +
      // 어묵 꼬치 + 국물 냄비
      '<g stroke="#c98a4b" stroke-width="2.6" stroke-linecap="round">' +
        '<path d="M36 53v-10"/><path d="M42 52v-10"/><path d="M48 53v-10"/></g>' +
      '<g fill="#f7e4bc" ' + ink + '>' +
        '<rect x="32.5" y="42" width="7" height="9" rx="3"/>' +
        '<rect x="38.5" y="41" width="7" height="9" rx="3"/>' +
        '<rect x="44.5" y="42" width="7" height="9" rx="3"/></g>' +
      '<path d="M30 53h26l-3 8H33z" fill="#aeb6c2" ' + ink + '/>' +
      '<ellipse cx="43" cy="53" rx="13" ry="3.4" fill="#8f99a8" ' + ink + '/>' +
      // 주인 — 판매대 뒤라 어깨 위만 보인다 (파란 앞치마)
      '<path d="M74 61q13-14 26 0v6H74z" fill="#4a7ab5" ' + ink + '/>' +
      '<circle cx="87" cy="47" r="8" fill="#f6d3ae" ' + ink + '/>' +
      '<path d="M79 45q8-11 16 0z" fill="#fff4e0" ' + ink + '/>' +
      '<rect x="79" y="44" width="16" height="4" rx="2" fill="#e0503f" ' + ink + '/>' +
      '<g fill="' + INK + '"><circle cx="84" cy="48" r="1.3"/><circle cx="90" cy="48" r="1.3"/></g>' +
      '<path d="M84.5 51q2.5 2 5 0" fill="none" stroke="' + INK + '"' +
        ' stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  // 거리 뒤편 골목 — 실루엣 건물 + 창문 불빛 + 가로등 + 나무.
  // 위(하늘)·아래(바닥)는 투명이라 시간대 하늘과 거리 바닥이 그대로 비친다.
  // 손님(z:2)·가게(z:1) 뒤(z:0)에 깔린다. 나중에 손그림 PNG/애니메이션으로 갈아끼우기 쉽게
  // 독립 레이어(.street-back)로 둔다. 수치와는 무관한 순수 배경.
  function alleyBack() {
    var p = [], BASE = 58;   // 바닥선 (viewBox 84, 거리 바닥과 맞물린다)

    // 창문 한 칸. st: warm/cool/off/flick. flick 은 은은히 깜빡인다.
    function win(x, y, st, idx) {
      var col = st === 'cool' ? '#bcd0ff' : (st === 'off' ? '#3a2f45' : '#ffcf7a');
      var op = st === 'off' ? '.5' : '.95';
      var fl = st === 'flick';
      return '<rect class="' + (fl ? 'alley-win' : '') + '" ' +
        (fl ? 'style="animation-delay:' + ((idx % 7) * 0.5).toFixed(1) + 's" ' : '') +
        'x="' + x + '" y="' + y + '" width="6" height="7" rx="1" fill="' + col + '" opacity="' + op + '"/>';
    }
    // 불 켜진 간판 (뒤에 은은한 후광)
    function sign(x, y, w, h, col, flick) {
      return '<rect x="' + (x - 2) + '" y="' + (y - 2) + '" width="' + (w + 4) + '" height="' + (h + 4) + '" rx="2.5" fill="' + col + '" opacity=".22"/>' +
        '<rect class="' + (flick ? 'alley-win' : '') + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5" fill="' + col + '"/>';
    }

    /* --- 원경: 흐릿한 뒤 건물 실루엣 (깊이감). 근경보다 살짝 밝은 남보라 = 안개 낀 거리 --- */
    var far = [[108, 40, 20], [150, 44, 26], [196, 38, 18], [246, 42, 24], [300, 46, 22], [348, 44, 16]];
    far.forEach(function (b, i) {
      var top = BASE - b[2];
      p.push('<rect x="' + b[0] + '" y="' + top + '" width="' + (b[1] - b[0]) + '" height="' + b[2] + '" fill="#2a2340" opacity=".7"/>');
      p.push(win(b[0] + 5, top + 5, i % 2 ? 'cool' : 'warm', i));   // 창 하나씩만 은은히
    });

    /* --- 근경: 앞 건물 (디테일 + 옥상 소품 + 간판) --- */
    var blds = [
      { x: 122, w: 48, h: 42, roof: 'tank', sign: ['#e0674a', 1] },   // 붉은 간판 (분식집)
      { x: 176, w: 36, h: 30, roof: 'chimney' },
      { x: 218, w: 52, h: 46, roof: 'antenna', sign: ['#5cc9d6', 0] }, // 청록 네온
      { x: 276, w: 38, h: 26, roof: 'ac' },
      { x: 320, w: 56, h: 38, roof: 'flat', sign: ['#ffcf6a', 0] }     // 노란 간판
    ];
    blds.forEach(function (b, bi) {
      var top = BASE - b.h;
      // 어떤 하늘에도 또렷하게 — 근경은 거의 검게. 옥상엔 따뜻한 테두리 빛(역광 분리감).
      p.push('<rect x="' + b.x + '" y="' + top + '" width="' + b.w + '" height="' + b.h + '" fill="#17111f"/>');
      p.push('<rect x="' + b.x + '" y="' + top + '" width="' + b.w + '" height="1.4" fill="#a06a48" opacity=".6"/>');
      // 옥상 소품
      if (b.roof === 'chimney') {
        p.push('<rect x="' + (b.x + b.w - 12) + '" y="' + (top - 9) + '" width="6" height="9" fill="#2a1e34"/>');
        p.push('<g class="alley-smoke" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.6" stroke-linecap="round"><path d="M' + (b.x + b.w - 9) + ' ' + (top - 10) + 'q4 -4 0 -8"/></g>');
      } else if (b.roof === 'tank') {
        p.push('<rect x="' + (b.x + b.w - 18) + '" y="' + (top - 9) + '" width="13" height="9" rx="2.5" fill="#2a1e34"/><rect x="' + (b.x + b.w - 14) + '" y="' + (top - 12) + '" width="2" height="3" fill="#2a1e34"/>');
      } else if (b.roof === 'antenna') {
        p.push('<path d="M' + (b.x + 8) + ' ' + top + ' l0 -12 M' + (b.x + 4) + ' ' + (top - 8) + ' l8 3 M' + (b.x + 12) + ' ' + (top - 8) + ' l-8 3" stroke="#2a1e34" stroke-width="1.4" fill="none"/>');
      } else if (b.roof === 'ac') {
        p.push('<rect x="' + (b.x + 4) + '" y="' + (top - 6) + '" width="12" height="6" rx="1.5" fill="#2a1e34"/>');
      }
      // 창문 격자
      var cols = Math.floor((b.w - 8) / 12), rows = Math.floor((b.h - 12) / 12);
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var k = (r + c + b.x);
        var st = (k % 5 === 0) ? 'off' : (k % 7 === 1 ? 'flick' : (k % 4 === 0 ? 'cool' : 'warm'));
        p.push(win(b.x + 6 + c * 12, top + 8 + r * 12, st, k));
      }
      // 간판 (건물 아래쪽에 가로로)
      if (b.sign) p.push(sign(b.x + 4, BASE - 11, b.w - 8, 7, b.sign[0], b.sign[1]));
    });

    /* --- 앞 소품 --- */
    // 나무 (풍성하게)
    p.push('<g><rect x="298" y="47" width="4" height="11" fill="#3a2a1c"/>' +
      '<ellipse cx="300" cy="41" rx="14" ry="12" fill="#274a2c"/>' +
      '<ellipse cx="291" cy="45" rx="8" ry="8" fill="#213f26"/>' +
      '<ellipse cx="309" cy="45" rx="8" ry="8" fill="#213f26"/>' +
      '<ellipse cx="300" cy="36" rx="7" ry="7" fill="#2c522f"/></g>');
    // 가로등 (앞, 등불 후광 맥동)
    p.push('<g><rect x="250" y="16" width="3" height="42" fill="#2a2036"/>' +
      '<path d="M251.5 18 q10 -2 12 6" fill="none" stroke="#2a2036" stroke-width="3"/>' +
      '<circle cx="264" cy="26" r="4.5" fill="#ffe6a0"/>' +
      '<circle class="alley-lamp" cx="264" cy="26" r="11" fill="#ffdd88" opacity=".26"/></g>');

    /* --- 처마 전구 줄 (포장마차 골목 느낌) --- */
    var lights = '<path d="M118 9 Q248 26 380 9" stroke="#4a3f2e" stroke-width="1" fill="none"/>';
    for (var lx = 132; lx <= 368; lx += 21) {
      var t = (lx - 118) / 262, ly = 9 + 17 * (t * (1 - t) * 4);   // 가운데가 처지는 곡선
      lights += '<line x1="' + lx + '" y1="' + ly.toFixed(1) + '" x2="' + lx + '" y2="' + (ly + 3).toFixed(1) + '" stroke="#4a3f2e" stroke-width=".8"/>';
      lights += '<circle class="' + (lx % 42 === 6 ? 'alley-win' : '') + '" cx="' + lx + '" cy="' + (ly + 4.5).toFixed(1) + '" r="2" fill="#ffd777"/>';
    }
    p.push('<g>' + lights + '</g>');

    return '<svg viewBox="0 0 390 84" preserveAspectRatio="xMidYMax slice" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + p.join('') + '</svg>';
  }

  var TAP_STEP_AT = [0, 8, 100, 800, 6e3, 5e4, 1e6, 5e7];

  // svgs 를 주면 큰 화면과 단계표에서는 그림을, 말풍선처럼 작은 곳에서는 이모지를 쓴다
  function ladder(list, svgs) {
    return list.map(function (x, i) {
      return { at: TAP_STEP_AT[i], icon: x[0], name: x[1], svg: svgs ? svgs[i] : null };
    });
  }

  // 그림 스킨 — svg 자리(=innerHTML 로 그려지는 곳)에 <img> 를 넣는다.
  // 손그림 PNG 는 assets/img/skin/ 에 있다. SVG 문자열과 같은 자리를 그대로 쓴다.
  function simg(file) {
    return '<img class="tap-img" src="assets/img/skin/' + file + '.png" alt="">';
  }
  var RICE = ['skin_rice_plain', 'skin_rice_grilled', 'skin_rice_sesame', 'skin_rice_veggie',
              'skin_rice_curry', 'skin_rice_salmon', 'skin_rice_golden'].map(simg);
  var DESS = ['skin_dess_cupcake', 'skin_dess_pudding', 'skin_dess_mooncake', 'skin_dess_bingsu',
              'skin_dess_icecream', 'skin_dess_cake'].map(simg);
  var NOODLE = ['skin_noodle_janchi', 'skin_noodle_jjajang', 'skin_noodle_pasta',
                'skin_noodle_seafood', 'skin_noodle_lobster'].map(simg);
  var BUNG = ['skin_bung_plain', 'skin_bung_creamfish', 'skin_bung_eggbread', 'skin_bung_hotteok',
              'skin_bung_delimanju', 'skin_bung_cream', 'skin_bung_cake', 'skin_bung_golden'].map(simg);
  var CHICK = ['skin_chick_fried', 'skin_chick_fries', 'skin_chick_burger',
               'skin_chick_pizza', 'skin_chick_taco'].map(simg);
  var BAKE = ['skin_bake_bagel', 'skin_bake_baguette', 'skin_bake_waffle',
              'skin_bake_donut', 'skin_bake_applepie'].map(simg);
  var MEAT = ['skin_meat_pork', 'skin_meat_bacon', 'skin_meat_steak'].map(simg);
  // 기본 스킨(분식 성장형) 8단계 손그림 — 어묵꼬치→떡꼬치→핫도그→왕만두→모둠튀김→라면정식→부대찌개→프리미엄한상
  var SNACK = ['skin_snack_1', 'skin_snack_2', 'skin_snack_3', 'skin_snack_4',
               'skin_snack_5', 'skin_snack_6', 'skin_snack_7', 'skin_snack_8'].map(simg);

  var TAP_SKINS = [
    {
      id: 'auto', sign: '분식', icon: '🍢', svg: SNACK[0], name: '분식 성장형',
      desc: '어묵 꼬치에서 시작해 한상 차림까지',
      steps: ladder([
        ['🍢', '어묵 꼬치'], ['🍡', '떡꼬치'], ['🌭', '핫도그'], ['🥟', '왕만두'],
        ['🍤', '모둠튀김'], ['🍜', '라면 정식'], ['🍲', '부대찌개'], ['🍱', '프리미엄 한상']
      ], SNACK)
    },
    {
      id: 'bungeo', sign: '붕어빵', icon: '🐟', svg: BUNG[0], name: '붕어빵 가게',
      desc: '손그림 겨울 간식 — 붕어빵에서 황금 붕어빵까지',
      steps: ladder([
        ['🐟', '붕어빵'], ['🐠', '슈크림 붕어빵'], ['🥚', '계란빵'], ['🥞', '호떡'],
        ['🍞', '델리만쥬'], ['🥐', '크림 붕어빵'], ['🍰', '붕어빵 케이크'], ['🐡', '황금 붕어빵']
      ], BUNG)
    },
    {
      id: 'jumeok', sign: '주먹밥', icon: '🍙', svg: RICE[0], name: '주먹밥 부락',
      desc: '손그림 주먹밥 — 김밥용 김부터 황금 주먹밥까지',
      steps: ladder([
        ['🍙', '주먹밥'], ['🍘', '구운 주먹밥'], ['🍚', '깨 주먹밥'], ['🥗', '야채 주먹밥'],
        ['🍛', '카레 주먹밥'], ['🍣', '연어 주먹밥'], ['🏆', '황금 주먹밥']
      ], RICE)
    },
    {
      id: 'tteok', sign: '디저트', icon: '🎂', svg: DESS[5], name: '디저트 가게',
      desc: '손그림 디저트 — 컵케이크에서 홀케이크까지',
      steps: ladder([
        ['🧁', '컵케이크'], ['🍮', '푸딩'], ['🥮', '월병'],
        ['🍧', '빙수'], ['🍨', '아이스크림'], ['🎂', '케이크']
      ], DESS)
    },
    {
      id: 'noodle', sign: '면집', icon: '🍜', svg: NOODLE[4], name: '면 요리',
      desc: '손그림 면 요리 — 잔치국수에서 랍스터 라면까지',
      steps: ladder([
        ['🥢', '잔치국수'], ['🥡', '짜장면'], ['🍝', '파스타'],
        ['🥘', '해물찜'], ['🦞', '랍스터 라면']
      ], NOODLE)
    },
    {
      id: 'chicken', sign: '치킨', icon: '🍗', svg: CHICK[0], name: '치킨 야식집',
      desc: '손그림 야식 — 후라이드에서 타코까지',
      steps: ladder([
        ['🍗', '후라이드'], ['🍟', '감자튀김'], ['🍔', '치즈버거'],
        ['🍕', '피자'], ['🌮', '타코']
      ], CHICK)
    },
    {
      id: 'bakery', sign: '베이커리', icon: '🥐', svg: BAKE[0], name: '카페 베이커리',
      desc: '손그림 갓 구운 빵 — 베이글에서 애플파이까지',
      steps: ladder([
        ['🥯', '베이글'], ['🥖', '바게트'], ['🧇', '와플'],
        ['🍩', '도넛'], ['🥧', '애플파이']
      ], BAKE)
    },
    {
      id: 'bbq', sign: '고깃집', icon: '🍖', svg: MEAT[0], name: '고깃집',
      desc: '손그림 숯불 구이 — 삼겹살·베이컨·스테이크',
      steps: ladder([
        ['🍖', '삼겹살'], ['🥓', '베이컨'], ['🥩', '스테이크']
      ], MEAT)
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
      return { at: CROWD_TIER_AT[i], name: t[0], cast: t[1], acc: t[2] || [], story: t[3] || '' };
    });
  }

  /* ---------- 사장님 (성장형 · 남/여 선택) ----------
     사장 레벨(bossLevel)이 오르면 모습이 바뀐다: 앞치마 새내기 → 요리사 → 정장 사장 → 분식 대부.
     이미지는 assets/img/owner/owner_<sex>_<key>.png. 환생(재개업) 화면에 크게 나온다. */
  var OWNER = {
    sexes: [
      { id: 'female', name: '여자 사장', pick: 'lv2' },
      { id: 'male',   name: '남자 사장', pick: 'lv2' }
    ],
    stages: [
      { at: 0,  key: 'lv2', name: '새내기 사장' },   // 앞치마 알바
      { at: 5,  key: 'lv3', name: '요리사 사장' },   // 요리사 모자
      { at: 10, key: 'lv4', name: '정장 사장' },     // 정장 · 프랜차이즈
      { at: 20, key: 'lv5', name: '분식 대부' }      // 왕관 · 대부
    ]
  };

  var CROWD_SKINS = [
    {
      // 그림 손님 — cast 가 이미지 경로('cust/..png', '/' 포함)면 scene/미리보기가 <img> 로 그린다.
      // acc(장신구 이모지)는 이미지 위에 어색해서 비운다. 등급이 오를수록 진귀한 손님이 온다.
      id: 'img', icon: '🧑‍🍳', name: '단골 손님',
      desc: '학생·직장인부터 전설의 손님까지 — 그림으로 찾아옵니다',
      tiers: crowd([
        ['첫 손님',     ['cust/student.png', 'cust/office.png', 'cust/dog.png', 'cust/cat.png'], [],
          '학생과 직장인, 강아지·고양이가 먼저 온다'],
        ['입소문',      ['cust/rabbit.png', 'cust/hamster.png', 'cust/dog.png'], [],
          '작은 친구들이 소문 듣고 몰려온다'],
        ['북적북적',    ['cust/bear.png', 'cust/robot.png', 'cust/cat.png'], [],
          '곰과 로봇까지 줄을 선다'],
        ['진귀한 손님', ['cust/fairy.png', 'cust/ghost.png'], [],
          '요정과 유령이 밤에 찾아온다'],
        ['전설의 손님', ['cust/dragon.png', 'cust/dokkaebi.png'], [],
          '용과 도깨비가 강림했다']
      ])
    },
    {
      id: 'auto', icon: '🚶', name: '동네 → 재벌',
      desc: '소문이 나면 돈 있는 손님이 찾아옵니다',
      tiers: crowd([
        ['동네 주민',    ['🚶', '🚶‍♀️', '🧍', '🧍‍♀️', '🐕'], [],
          '퇴근길에 하나씩 사 먹는 단골들'],
        ['소문난 맛집',  ['🏃', '🏃‍♀️', '🚶‍♂️', '🚴', '🛴'], [],
          'SNS를 보고 일부러 찾아온다'],
        ['멋 낸 손님',   ['🕴️', '💃', '🕺', '🚶‍♀️', '🚶‍♂️'], ['🎩', '🕶️', '👜', '🌹', '📸'],
          '데이트 코스에 분식집이 들어갔다'],
        ['VIP 손님',     ['🕴️', '💃', '🕺', '🚶', '🏃'],       ['💼', '🥂', '💍', '🎻', '📸'],
          '기사 딸린 차에서 내려 줄을 선다'],
        ['재벌 회장',    ['🕴️', '💃', '🕺', '🚶‍♀️', '🕴️'],   ['👑', '💎', '🏆', '🪙', '🥇'],
          '가게를 통째로 사겠다고 한다']
      ])
    },
    {
      id: 'animal', icon: '🐕', name: '동물 친구들',
      desc: '작은 동물부터 전설의 짐승까지',
      tiers: crowd([
        ['골목 친구',     ['🐕', '🐈', '🐇', '🐧'], [],
          '길고양이와 강아지가 먼저 알아본다'],
        ['숲에서 온 친구', ['🐿️', '🦆', '🐐', '🐑'], [],
          '산에서 냄새를 맡고 내려왔다'],
        ['목장 손님',     ['🐎', '🦌', '🐖', '🦩'], ['🎀', '🔔'],
          '리본 단 가축들이 단체로 몰려온다'],
        ['밀림의 지배자', ['🐅', '🐆', '🦒', '🐘'], ['👑', '💎'],
          '왕관 쓴 맹수들이 자리를 차지한다'],
        ['전설의 짐승',   ['🐉', '🦖', '🦕', '🦍'], ['👑', '🔥', '⚡'],
          '용과 거대 짐승이 강림했다']
      ])
    },
    {
      id: 'fantasy', icon: '🧙', name: '판타지',
      desc: '견습 마법사에서 신화까지',
      tiers: crowd([
        ['견습 마법사', ['🧙', '🧝', '🥷', '🧍'], [],
          '동전 몇 닢으로 겨우 사 먹는다'],
        ['모험가 파티', ['🧚', '🧜', '🧛', '🧙'], [],
          '던전을 다녀온 길에 들른다'],
        ['영웅',       ['🦸', '🦹', '🧟', '🧝'], ['⚔️', '🛡️', '✨'],
          '세계를 구하고 허기진 영웅들'],
        ['대마법사',   ['🧞', '🦸', '🧚', '🧙'], ['🔮', '📜', '⚡'],
          '순간이동으로 줄을 선다'],
        ['신화의 존재', ['🐉', '🦖', '🧞', '🦸'], ['👑', '🔥', '🌟'],
          '신들이 분식의 맛을 탐낸다']
      ])
    },
    {
      id: 'ride', icon: '🛵', name: '탈것 거리',
      desc: '자전거에서 우주선까지',
      tiers: crowd([
        ['자전거·킥보드', ['🚶', '🚲', '🛴', '🛹'], [],
          '동네 한 바퀴 돌다 들른다'],
        ['오토바이족',   ['🛵', '🏍️', '🚗', '🚲'], [],
          '배달하다 자기가 사 먹는다'],
        ['자가용 손님',   ['🚙', '🚕', '🚌', '🛵'], [],
          '드라이브스루처럼 창문을 연다'],
        ['대형차 행렬',   ['🚚', '🚛', '🚓', '🚙'], ['💨'],
          '트럭째로 사 간다'],
        ['우주선',       ['🚀', '🛸', '🚁', '✈️'], ['💨', '🌟'],
          '은하 끝에서 소문 듣고 왔다']
      ])
    },
    {
      id: 'sea', icon: '🐬', name: '바다 친구들',
      desc: '물가에서 용왕까지',
      tiers: crowd([
        ['물가 친구',   ['🐢', '🦆', '🐧', '🦭'], [],
          '얕은 물에서 첫 손님이 온다'],
        ['물살 탄 무리', ['🐟', '🐠', '🐡', '🦆'], [],
          '떼 지어 물살을 타고 몰려온다'],
        ['큰 바다 손님', ['🐬', '🦈', '🦭', '🐢'], ['🫧'],
          '고래가 물살을 가르며 다가온다'],
        ['심해의 주인',  ['🐙', '🦑', '🦞', '🦀'], ['🫧', '💎'],
          '보물을 든 심해 생물이 올라온다'],
        ['용왕 납시오',  ['🐋', '🐉', '🦈', '🐬'], ['👑', '🌊', '🌟'],
          '용왕이 친히 바다를 열고 납시었다']
      ])
    },
    {
      id: 'bug', icon: '🦋', name: '곤충 정원',
      desc: '풀숲 벌레에서 거대 곤충까지',
      tiers: crowd([
        ['풀숲 벌레',   ['🐜', '🐛', '🐌', '🦗'], [],
          '가장 먼저 기어 나온 손님들'],
        ['날개 손님',   ['🦋', '🐝', '🐞', '🦟'], [],
          '꽃가루 대신 분식을 찾아 날아온다'],
        ['정원 지킴이', ['🕷️', '🦂', '🐍', '🦎'], ['🌿'],
          '왕관 쓴 정원의 파수꾼들'],
        ['숲의 주인',   ['🐢', '🦔', '🐍', '🦎'], ['🌿', '👑'],
          '느릿느릿, 그러나 위엄 있게'],
        ['전설의 곤충', ['🐉', '🦖', '🦕', '🐲'], ['👑', '🔥', '🌟'],
          '고대에서 깨어난 거대 곤충들']
      ])
    }
  ];

  /* ---------- 도전과제 ---------- */
  // 하나 달성할 때마다 전체 수익 +1%
  /* ---------- 탭 소리 (합성은 sound.js) ---------- */
  // 플레이어가 취향대로 고르는 조리음. classic 이 기본.
  var TAP_SOUNDS = [
    { id: 'classic', icon: 'sound/snd_classic.png', name: '기본음',    desc: '맑게 올라가는 전자음' },
    { id: 'tight',   icon: 'sound/snd_tight.png', name: '짧은 뽁',   desc: '딱 끊기는 뽁, 연타에 잘 붙는다' },
    { id: 'juicy',   icon: 'sound/snd_juicy.png', name: '촉촉한 뽁', desc: '젤리 터지는 물기 있는 소리' },
    { id: 'deep',    icon: 'sound/snd_deep.png', name: '깊은 뽁',   desc: '묵직하고 통 큰 저음' },
    { id: 'bubble',  icon: 'sound/snd_bubble.png', name: '뽁뽁이',    desc: '에어캡 터지듯 톡 쏘게' },
    { id: 'boing',   icon: 'sound/snd_boing.png', name: '탱글 뽁',   desc: '끝에 튕기는 고무 같은 뽁' }
  ];

  /* ---------- 주말 파티 이벤트 ---------- */
  // 금·토 오후 5시~자정, 실제 시계 기준으로 열린다. 서버가 없으니 기기 시간을 본다.
  var PARTY = {
    days: [5, 6],          // 금(5) · 토(6)
    startHour: 17,         // 17시부터
    endHour: 24,           // 24시(자정)까지
    mult: 3,               // 파티 중 실시간 수익 ×3 (오프라인 보상엔 안 붙는다)
    goldenScale: 0.5,      // 황금 손님 등장 간격 ×0.5 (두 배 자주)
    findChance: 0.03,      // 파티 중 탭 한 번당 새 음식을 발견할 확률
    dexBonus: 0.01,        // 도감 한 칸당 모든 수익 +1% (영구)
    // 파티에서만 나오는 음식 — 모으면 도감이 채워진다
    foods: [
      { id: 'pf1',  icon: 'party/pf1.png', name: '파티 피자' },
      { id: 'pf2',  icon: 'party/pf2.png', name: '양념치킨' },
      { id: 'pf3',  icon: 'party/pf3.png', name: '핫도그' },
      { id: 'pf4',  icon: 'party/pf4.png', name: '수제버거' },
      { id: 'pf5',  icon: 'party/pf5.png', name: '타코' },
      { id: 'pf6',  icon: 'party/pf6.png', name: '팝콘' },
      { id: 'pf7',  icon: 'party/pf7.png', name: '치즈 플래터' },
      { id: 'pf8',  icon: 'party/pf8.png', name: '도넛 타워' },
      { id: 'pf9',  icon: 'party/pf9.png', name: '컵케이크' },
      { id: 'pf10', icon: 'party/pf10.png', name: '파티 케이크' },
      { id: 'pf11', icon: 'party/pf11.png', name: '막대사탕' },
      { id: 'pf12', icon: 'party/pf12.png', name: '샴페인' }
    ],
    // 파티에만 오는 손님 (전신 이모지만 — 거리 규칙 6)
    guests: ['🕺', '💃', '🧑‍🎤', '🧑‍🎄', '🎅', '🤶']
  };

  /* ---------- 🍳 주방 (재료 트럭 · 합성 · 레시피 · 음식 도감) ----------
     재료 트럭이 주기적으로 와서 재료를 떨군다 → 재료를 쌓아 레시피대로 합성 → 음식 완성.
     레시피(조합)는 사장 레벨로 하나씩 해금된다 — 해금 전엔 '??? 미발견' 으로 조합을 가린다.
     음식을 처음 만들면 도감에 등록되며 모든 수익이 영구 +bonus, 만들 때마다 목돈(sec 초치)을 준다.
     ※ 주말 파티 도감(PARTY.foods)과는 별개의 새 도감이다. */
  var KITCHEN = {
    truckEvery: 30,     // 트럭이 오는 간격 (초)
    truckLife: 12,      // 트럭이 머무는 시간 (초) — 이 안에 탭하면 더 많이 준다
    tapDrop: 4,         // 탭해서 받으면 재료 이만큼 (탭이 자동수거의 2배 — 손을 대는 보람)
    missDrop: 2,        // 못 잡고 지나가면 이만큼만 자동 수거 (방치 배려 · 오프라인 트럭도 이 값)

    // 재료 12종 — 종류가 늘면 랜덤 드롭이 얕아지므로 위 tapDrop·missDrop 을 함께 키웠다.
    // 새 재료(새우·감자·버섯·옥수수)는 중·고급 레시피에서 주로 쓴다.
    ings: [
      { id: 'fl', icon: 'ing/mat_flour.png', name: '밀가루' },
      { id: 'gj', icon: 'ing/mat_gochujang.png', name: '고추장' },
      { id: 'eg', icon: 'ing/mat_egg.png', name: '계란' },
      { id: 'om', icon: 'ing/mat_odeng.png', name: '어묵' },
      { id: 'vg', icon: 'ing/mat_vegetable.png', name: '야채' },
      { id: 'rc', icon: 'ing/mat_rice.png', name: '쌀' },
      { id: 'ch', icon: 'ing/mat_cheese.png', name: '치즈' },
      { id: 'mt', icon: 'ing/mat_meat.png', name: '고기' },
      { id: 'sh', icon: 'ing/mat_shrimp.png', name: '새우' },
      { id: 'pt', icon: 'ing/mat_potato.png', name: '감자' },
      { id: 'ms', icon: 'ing/mat_mushroom.png', name: '버섯' },
      { id: 'cn', icon: 'ing/mat_corn.png', name: '옥수수' }
    ],

    // 🍳 음식 숙련도 — 같은 음식을 누적으로 만들수록 그 음식의 도감 배율이 커진다.
    // s.kfoods[id] 에 이미 '만든 횟수' 가 쌓이므로 세이브 필드를 새로 만들지 않는다.
    // steps 문턱을 넘을 때마다 별(★)이 오르고, 그 음식 bonus 에 mult 를 곱한다(합이 아니라 교체).
    mastery: {
      steps: [10, 50, 200],   // ★ · ★★ · ★★★ 누적 제작 문턱
      mult:  [1.5, 2, 3]      // 그 음식 도감 배율 ×
    },

    // ⭐ 오늘의 특선 / 단골 주문 — 매일 해금된 레시피 중 하나가 특선이 된다(날짜로 고정).
    // 특선 음식은 만들 때 목돈이 ×mult. 하루 orderGoal 번 만들면 단골 주문 보상을 받는다.
    special: {
      mult: 3,          // 특선 음식 목돈 배율
      orderGoal: 3,     // 단골 주문: 특선을 이만큼 만들면 완료
      orderSec: 1800,   // 완료 보상 = 초당 수익 × 이만큼
      minOrder: 1000    // 아직 수익이 없을 때의 최소 보상
    },

    // 음식 = 레시피. grade 1 초급 / 2 중급 / 3 고급.
    // at: 이 사장 레벨이 되면 레시피가 해금된다. need: 재료 소모량. bonus: 도감 영구 배율(+). sec: 만들 때 목돈(초당×sec).
    foods: [
      // 초급 (7종)
      { id: 'k1',  icon: 'equip_odeng.png', name: '어묵탕', grade: 1, at: 1, bonus: 0.01, sec: 60, need: { om: 2, vg: 2 } },
      { id: 'k2',  icon: 'food/food_tteokbokki.png', name: '떡볶이',    grade: 1, at: 2,  bonus: 0.01,  sec: 90,   need: { gj: 2, fl: 2, om: 1 } },
      { id: 'k3',  icon: 'food/food_gimbap.png', name: '김밥',      grade: 1, at: 3,  bonus: 0.01,  sec: 120,  need: { rc: 2, eg: 1, vg: 2 } },
      { id: 'k10', icon: 'food/food_eggroll.png', name: '계란말이',  grade: 1, at: 4,  bonus: 0.01,  sec: 150,  need: { eg: 3, vg: 1 } },
      { id: 'k16', icon: 'food/food_fries.png', name: '감자튀김',  grade: 1, at: 5,  bonus: 0.01,  sec: 190,  need: { pt: 3, cn: 1 } },
      { id: 'k17', icon: 'food/food_shrimp_fry.png', name: '새우튀김',  grade: 1, at: 6,  bonus: 0.015, sec: 240,  need: { sh: 3, fl: 2 } },
      { id: 'k21', icon: 'food/food_toast.png', name: '토스트',    grade: 1, at: 7,  bonus: 0.015, sec: 300,  need: { fl: 2, eg: 2, ch: 1 } },
      // 중급 (7종)
      { id: 'k4',  icon: 'food/food_ramen.png', name: '라면',      grade: 2, at: 8,  bonus: 0.02,  sec: 360,  need: { fl: 3, vg: 2, eg: 2 } },
      { id: 'k5',  icon: 'food/food_hotdog.png', name: '핫도그',    grade: 2, at: 9,  bonus: 0.02,  sec: 460,  need: { fl: 3, mt: 3 } },
      { id: 'k11', icon: 'food/food_kimchi_friedrice.png', name: '김치볶음밥', grade: 2, at: 10, bonus: 0.02,  sec: 580,  need: { rc: 3, gj: 2, eg: 1 } },
      { id: 'k6',  icon: 'food/food_mandu.png', name: '만두',      grade: 2, at: 11, bonus: 0.02,  sec: 660,  need: { fl: 3, mt: 2, vg: 2, ms: 1 } },
      { id: 'k12', icon: 'food/food_cheese_rabokki.png', name: '치즈라볶이', grade: 2, at: 12, bonus: 0.025, sec: 780,  need: { fl: 3, gj: 2, ch: 2 } },
      { id: 'k18', icon: 'food/food_mushroom_stew.png', name: '버섯전골',  grade: 2, at: 13, bonus: 0.025, sec: 920,  need: { ms: 3, vg: 2, mt: 2 } },
      { id: 'k19', icon: 'food/food_corn_cheese.png', name: '옥수수치즈범벅', grade: 2, at: 14, bonus: 0.025, sec: 1100, need: { cn: 3, ch: 3 } },
      // 고급 (6종)
      { id: 'k7',  icon: 'food/food_cheese_gimbap.png', name: '치즈김밥',  grade: 3, at: 15, bonus: 0.03,  sec: 1300, need: { rc: 3, ch: 3, eg: 2 } },
      { id: 'k13', icon: 'food/food_seafood_pancake.png', name: '해물파전',  grade: 3, at: 16, bonus: 0.03,  sec: 1600, need: { fl: 3, om: 2, sh: 2, vg: 2 } },
      { id: 'k8',  icon: '🍲', name: '부대찌개',  grade: 3, at: 17, bonus: 0.03,  sec: 1900, need: { mt: 4, ch: 2, gj: 2, ms: 1 } },
      { id: 'k14', icon: 'food/food_galbitang.png', name: '갈비탕',    grade: 3, at: 18, bonus: 0.035, sec: 2500, need: { mt: 5, vg: 2, pt: 2 } },
      { id: 'k9',  icon: 'food/food_platter.png', name: '모둠 한상', grade: 3, at: 19, bonus: 0.035, sec: 3600, need: { om: 3, rc: 3, mt: 3, ch: 2 } },
      { id: 'k20', icon: 'food/food_grand_feast.png', name: '왕특선 정식', grade: 3, at: 20, bonus: 0.04,  sec: 5200, need: { mt: 4, sh: 3, ch: 3, cn: 2, pt: 2 } }
    ],
    grades: [
      { g: 1, name: '초급' },
      { g: 2, name: '중급' },
      { g: 3, name: '고급' }
    ]
  };

  /* ---------- 스타 셰프 도전 (액티브 던전) ---------- */
  // 제한 시간 안에 조리(탭)를 많이 할수록 별을 얻는다. 방치가 아니라 손 실력 도전.
  // 별 5개(만점)를 처음 채우면 영구 배율이라는 큰 보상을 준다.
  var MICHELIN = {
    time: 25,                         // 심사 시간 (초)
    goals: [15, 40, 75, 115, 160],    // 별 1~5 문턱 (1단계 기준 · 이번 판 조리 횟수)
    tierGrowth: 1.2,                  // 5성을 깰수록 목표가 ×1.2 씩 늘어난다
    timePerTier: 3,                   // 단계가 오를수록 심사 시간도 조금씩 늘려 준다(초)
    starSec: 40,                      // 별 하나당 보상 = 초당 수익 × 이만큼(초)
    minReward: 500,                   // 아직 수익이 없을 때의 별당 최소 보상
    grandMult: 1.5,                   // 5성 첫 달성 시 모든 수익 ×1.5 (영구)
    // ---- 시즌 & 랭킹 (연출용) ----
    rankTotal: 8000,                  // 스타 셰프 랭킹 가상 셰프 수
    tapCap: 240,                      // 랭킹 계산 상한 (이만큼 조리하면 전국 1위권)
    histKeep: 6,                      // 지난 시즌 기록 보관 수
    // 달마다 바뀌는 시즌 이름 (getMonth 0~11)
    seasons: ['새해 특선', '정월 대보름', '봄맞이 신상', '벚꽃 미식', '가정의 달', '초여름 별미',
              '한여름 불맛', '늦여름 야식', '가을 정찬', '단풍 미식', '초겨울 온기', '연말 만찬'],
    chefSurnames: ['김', '이', '박', '최', '정', '한', '오', '유', '백', '신', '서', '강'],
    chefTitles: ['셰프', '장인', '명장', '대가', '거장', '마스터', '요리사', '달인']
  };

  /* ---------- 전국 맛집 랭킹 (연출용) ---------- */
  // 서버가 없는 오프라인 게임이라 실제 다른 플레이어는 없다.
  // 내 가게의 인기(초당 수익)를 기준으로, 가상의 전국 맛집들 사이에
  // 내 순위를 지역별로 매겨 보여준다. 이름은 (지역·순위)로 정해져서
  // 새로고침해도 바뀌지 않는다.
  var RANK = {
    nationTotal: 12000,   // 전국 맛집 수 (연출용 고정값)
    maxScore: 15,         // log10(초당수익) 상한 — 이쯤이면 전국 1위
    // 지역은 '작은 연못' — 전국 상한보다 낮은 점수(maxScore×regionTopFrac)에서 지역 1위에 닿는다.
    // 그래서 "전국 수백 위인데 우리 지역 1위" 같은 뿌듯함이 생긴다.
    regionTopFrac: 0.72,  // 지역 1위 도달 점수 = 전국 1위 점수 × 이 값
    regionMin: 50         // 아주 작은 지역이라도 최소 이만큼의 가게가 있는 연못으로 친다
  };

  // 지역 — weight 가 클수록 배정될 확률이 높다 (인구 느낌)
  var REGIONS = [
    { id: 'seoul',   name: '서울',   weight: 5 },
    { id: 'gyeonggi',name: '경기',   weight: 5 },
    { id: 'busan',   name: '부산',   weight: 3 },
    { id: 'incheon', name: '인천',   weight: 2 },
    { id: 'daegu',   name: '대구',   weight: 2 },
    { id: 'daejeon', name: '대전',   weight: 2 },
    { id: 'gwangju', name: '광주',   weight: 2 },
    { id: 'ulsan',   name: '울산',   weight: 1 },
    { id: 'gangwon', name: '강원',   weight: 1 },
    { id: 'chungcheong', name: '충청', weight: 2 },
    { id: 'jeolla',  name: '전라',   weight: 2 },
    { id: 'gyeongsang', name: '경상', weight: 2 },
    { id: 'jeju',    name: '제주',   weight: 1 }
  ];

  // 가상 맛집 이름 재료 — 동네 + 메뉴 + 칭호
  var RANK_AREAS = ['종로', '홍대', '강남', '명동', '해운대', '서면', '동성로',
    '노량진', '신촌', '이태원', '을지로', '부평', '수원역', '정자동', '청담',
    '성수', '망원', '연남', '광안리', '남포동', '유성', '둔산', '봉명', '삼산',
    '전대', '구월동', '수유리', '왕십리', '사직동', '경리단', '샤로수길', '먹자골목'];
  var RANK_FOODS = ['떡볶이', '김밥', '순대', '튀김', '라면', '어묵', '붕어빵',
    '호떡', '만두', '핫도그', '분식', '오뎅', '꼬치', '토스트', '도넛'];
  var RANK_TITLES = ['천국', '명가', '왕', '나라', '대장', '성지', '본점',
    '1번지', '골목', '맛집', '반점', '노포', '달인', '집'];

  /* ---------- 일일 퀘스트 ---------- */
  // 도전과제가 '평생 한 번' 이라면 퀘스트는 '오늘 하루' 다.
  // 매일 자정에 세 개가 새로 깔린다. 어떤 세 개인지는 날짜로 정해져서
  // 새로고침해도 바뀌지 않는다 (돌려 뽑기를 막는다).
  var QUEST = {
    count: 3,          // 하루에 깔리는 개수
    rewardSec: 420,    // 하나당 보상 = 초당 수익 × 이만큼
    allSec: 900,       // 셋 다 끝내면 추가로
    minMoney: 300,     // 아직 수익이 없을 때의 최소 보상
    earnSec: 600,      // '오늘 벌기' 목표 = 초당 수익 × 이만큼
    minEarn: 400
  };

  // kind: 진행도를 올리는 사건. max 면 합이 아니라 최고 기록으로 친다.
  var QUESTS = [
    { id: 'q_tap',    kind: 'tap',    icon: 'quest/q_tap.png', goal: 60,  name: '조리 60번' },
    { id: 'q_gen',    kind: 'gen',    icon: 'quest/q_gen.png', goal: 12,  name: '설비 12개 사기' },
    { id: 'q_up',     kind: 'up',     icon: 'quest/q_up.png', goal: 2,   name: '업그레이드 2개 사기' },
    { id: 'q_combo',  kind: 'combo',  icon: 'quest/q_combo.png', goal: 25,  name: '콤보 25 만들기', max: true },
    { id: 'q_golden', kind: 'golden', icon: 'quest/q_golden.png', goal: 3,   name: '황금 손님 3명 받기' },
    { id: 'q_thief',  kind: 'thief',  icon: 'quest/q_thief.png', goal: 2,   name: '도둑 2명 잡기' },
    { id: 'q_boost',  kind: 'boost',  icon: 'quest/q_boost.png', goal: 2,   name: '손님 몰이 2번 쓰기' },
    { id: 'q_earn',   kind: 'earn',   icon: 'quest/q_earn.png', goal: 0,   name: '오늘 벌기', money: true }
  ];

  function genCount(s, id) { return s.gens[id] || 0; }

  var ACHIEVEMENTS = [
    { id: 'ac1',  icon: '👋', name: '첫 손님',        desc: '처음으로 조리하기',              prog: function (s) { return { cur: s.taps, goal: 1 }; }, check: function (s) { return s.taps >= 1; } },
    { id: 'ac2',  icon: '💪', name: '손맛 견습',      desc: '100번 조리하기',                 prog: function (s) { return { cur: s.taps, goal: 100 }; }, check: function (s) { return s.taps >= 100; } },
    { id: 'ac3',  icon: '🦾', name: '조리 기계',      desc: '1,000번 조리하기',               prog: function (s) { return { cur: s.taps, goal: 1000 }; }, check: function (s) { return s.taps >= 1000; } },
    { id: 'ac4',  icon: '🔨', name: '무쇠 손목',      desc: '10,000번 조리하기',              prog: function (s) { return { cur: s.taps, goal: 10000 }; }, check: function (s) { return s.taps >= 10000; } },
    { id: 'ac5',  icon: '🪙', name: '첫 매출',        desc: '누적 1,000원 벌기',              prog: function (s) { return { cur: s.runEarned, goal: 1000 }; }, check: function (s) { return s.runEarned >= 1000; } },
    { id: 'ac6',  icon: '💵', name: '동네 맛집',      desc: '누적 100만원 벌기',              prog: function (s) { return { cur: s.runEarned, goal: 1000000 }; }, fmt: 'num', check: function (s) { return s.runEarned >= 1e6; } },
    { id: 'ac7',  icon: '💎', name: '지역 명물',      desc: '누적 10억원 벌기',               prog: function (s) { return { cur: s.runEarned, goal: 1000000000 }; }, fmt: 'num', check: function (s) { return s.runEarned >= 1e9; } },
    { id: 'ac8',  icon: '🏆', name: '전국구',         desc: '누적 1조원 벌기',                prog: function (s) { return { cur: s.runEarned, goal: 1000000000000 }; }, fmt: 'num', check: function (s) { return s.runEarned >= 1e12; } },
    { id: 'ac9',  icon: '🌟', name: '억만장자 분식',  desc: '누적 1해원 벌기',                prog: function (s) { return { cur: s.runEarned, goal: 1e+20 }; }, fmt: 'num', check: function (s) { return s.runEarned >= 1e20; } },
    { id: 'ac10', icon: '🧑‍🍳', name: '사장님 소리',   desc: '알바생 10명 고용',               prog: function (s) { return { cur: genCount(s, 'g1'), goal: 10 }; }, check: function (s) { return genCount(s, 'g1') >= 10; } },
    { id: 'ac11', icon: '🍲', name: '냄비 부자',      desc: '떡볶이 냄비 25개',               prog: function (s) { return { cur: genCount(s, 'g2'), goal: 25 }; }, check: function (s) { return genCount(s, 'g2') >= 25; } },
    { id: 'ac12', icon: '🛵', name: '배달 왕국',      desc: '배달 오토바이 25대',             prog: function (s) { return { cur: genCount(s, 'g6'), goal: 25 }; }, check: function (s) { return genCount(s, 'g6') >= 25; } },
    { id: 'ac13', icon: '🏬', name: '프랜차이즈',     desc: '지점 10개 오픈',                 prog: function (s) { return { cur: genCount(s, 'g7'), goal: 10 }; }, check: function (s) { return genCount(s, 'g7') >= 10; } },
    { id: 'ac14', icon: '🚀', name: '우주 진출',      desc: '우주 분식 스테이션 1개',         prog: function (s) { return { cur: genCount(s, 'g10'), goal: 1 }; }, check: function (s) { return genCount(s, 'g10') >= 1; } },
    { id: 'ac15', icon: '📦', name: '만물상',         desc: '모든 종류의 설비 1개씩 보유',    prog: function (s) { return { cur: GENERATORS.filter(function (g) { return genCount(s, g.id) >= 1; }).length, goal: GENERATORS.length }; }, check: function (s) { return GENERATORS.every(function (g) { return genCount(s, g.id) >= 1; }); } },
    { id: 'ac16', icon: '✨', name: '첫 재개업',      desc: '환생 1회',                       prog: function (s) { return { cur: s.prestiges, goal: 1 }; }, check: function (s) { return s.prestiges >= 1; } },
    { id: 'ac17', icon: '🌀', name: '윤회의 사장',    desc: '환생 5회',                       prog: function (s) { return { cur: s.prestiges, goal: 5 }; }, check: function (s) { return s.prestiges >= 5; } },
    { id: 'ac18', icon: '🔮', name: '분식의 화신',    desc: '명성 100 보유',                  prog: function (s) { return { cur: s.fame, goal: 100 }; }, check: function (s) { return s.fame >= 100; } },
    { id: 'ac19', icon: '😴', name: '방치의 미학',    desc: '오프라인 수익 1회 수령',         prog: function (s) { return { cur: s.offlineClaims, goal: 1 }; }, check: function (s) { return s.offlineClaims >= 1; } },
    { id: 'ac20', icon: '⏳', name: '하루 영업',      desc: '총 플레이 시간 24시간',          prog: function (s) { return { cur: s.playTime, goal: 86400 }; }, fmt: 'time', check: function (s) { return s.playTime >= 86400; } },
    { id: 'ac21', icon: '🌟', name: '황금 손님',      desc: '황금 손님 1명 잡기',             prog: function (s) { return { cur: s.goldens, goal: 1 }; }, check: function (s) { return s.goldens >= 1; } },
    { id: 'ac22', icon: '💫', name: '황금 인맥',      desc: '황금 손님 50명 잡기',            prog: function (s) { return { cur: s.goldens, goal: 50 }; }, check: function (s) { return s.goldens >= 50; } },
    { id: 'ac23', icon: '🎯', name: '연속 조리',      desc: '콤보 50 달성',                   prog: function (s) { return { cur: s.bestCombo, goal: 50 }; }, check: function (s) { return s.bestCombo >= 50; } },
    { id: 'ac24', icon: '📣', name: '호객의 달인',    desc: '손님 몰이 10회 사용',            prog: function (s) { return { cur: s.boosts, goal: 10 }; }, check: function (s) { return s.boosts >= 10; } },
    { id: 'ac25', icon: '📅', name: '개근 사장',      desc: '7일 연속 출석',                  prog: function (s) { return { cur: s.dailyStreak, goal: 7 }; }, check: function (s) { return s.dailyStreak >= 7; } },
    { id: 'ac26', icon: '🚨', name: '현행범 체포',    desc: '도둑 1명 직접 잡기',             prog: function (s) { return { cur: s.thievesCaught, goal: 1 }; }, check: function (s) { return s.thievesCaught >= 1; } },
    { id: 'ac27', icon: '🥋', name: '분식집 자경단',  desc: '도둑 25명 직접 잡기',            prog: function (s) { return { cur: s.thievesCaught, goal: 25 }; }, check: function (s) { return s.thievesCaught >= 25; } },
    { id: 'ac28', icon: '🚓', name: '든든한 순찰',    desc: '경찰이 도둑을 10번 잡아줌',      prog: function (s) { return { cur: s.thiefSaves, goal: 10 }; }, check: function (s) { return s.thiefSaves >= 10; } },
    { id: 'ac29', icon: '🧑‍💼', name: '믿음직한 점장',  desc: '점장이 대신 산 설비 100개',      prog: function (s) { return { cur: s.autoBought, goal: 100 }; }, check: function (s) { return s.autoBought >= 100; } },
    { id: 'ac30', icon: '🌀', name: '백 번의 재개업',  desc: '환생 100회',                     prog: function (s) { return { cur: s.prestiges, goal: 100 }; }, check: function (s) { return s.prestiges >= 100; } },
    { id: 'ac31', icon: '💠', name: '명성 100만',      desc: '명성 100만 보유',                prog: function (s) { return { cur: s.fame, goal: 1000000 }; }, fmt: 'num', check: function (s) { return s.fame >= 1e6; } },
    { id: 'ac32', icon: '👑', name: '분식 왕조',       desc: '분식 왕조 10레벨',               prog: function (s) { return { cur: (s.fameLv.f_legend || 0), goal: 10 }; }, check: function (s) { return (s.fameLv.f_legend || 0) >= 10; } },
    { id: 'ac33', icon: '♾️', name: '천문학적',        desc: '누적 1극원 벌기',                prog: function (s) { return { cur: s.totalEarned, goal: 1e+48 }; }, fmt: 'num', check: function (s) { return s.totalEarned >= 1e48; } },
    { id: 'ac34', icon: '📋', name: '성실한 사장',     desc: '퀘스트 10개 완료',               prog: function (s) { return { cur: s.questsDone, goal: 10 }; }, check: function (s) { return s.questsDone >= 10; } },
    { id: 'ac35', icon: '🗂️', name: '퀘스트 수집가',   desc: '퀘스트 60개 완료',               prog: function (s) { return { cur: s.questsDone, goal: 60 }; }, check: function (s) { return s.questsDone >= 60; } },
    { id: 'ac36', icon: '⭐', name: '스타 셰프 입성',   desc: '스타 셰프 도전에서 별 1개',      prog: function (s) { return { cur: s.bestMichelin, goal: 1 }; }, check: function (s) { return s.bestMichelin >= 1; } },
    { id: 'ac37', icon: '🌟', name: '5스타 셰프',      desc: '스타 셰프 도전에서 별 5개',      prog: function (s) { return { cur: s.bestMichelin, goal: 5 }; }, check: function (s) { return s.bestMichelin >= 5; } }
  ];

  /* ---------- 할인 쿠폰 (아이템) ----------
     재료 트럭·광고·상점·우편으로 얻는 '쓸 수 있는 횟수'(count, 최대 max장)와,
     쓸수록 자라는 '할인율'(couponPct)이 따로 있다.
     '쿠폰 쓰기'를 켠 채 설비·업그레이드를 사면 그 한 번에 지금 할인율만큼 깎이고
     쿠폰 1장이 소모된다 — 할인은 '설비 1개'에만 붙는다(대량구매 전체가 아니라).
     쓸 때마다 할인율이 step 씩 자라 100%까지 오르고, 100% 를 쓰면 reset 로
     떨어진 뒤 다시 자란다. start 는 맨 처음 값. 매출 배율과는 무관. */
  var COUPON = { icon: '🎟️', max: 3, dropChance: 0.18, start: 30, step: 5, reset: 70 };

  /* 첫 환생(재개업) 축하 보상 — 딱 한 번. 리셋을 '손해'가 아니라 '이벤트'로.
     쿠폰은 최대치(3)로 채우되, 이미 꽉 차 있으면 예외로 1장 더(4) 준다. */
  var FIRST_PRESTIGE = { gold: 30000 };

  /* ---------- 🎁 무료 보상 (광고) ----------
     아이콘 4개, 하나당 하루 3번(자정 리셋). 지금은 '30초 시청'을 카운트다운 모달로
     시뮬레이션한다 — 정적 사이트라 실제 보상형 광고 SDK 를 못 붙인다. 나중에 앱으로
     포장하거나 광고 SDK 가 생기면 ui.js 의 시청 자리(30초 타이머)에 실제 광고만 끼우면 된다.
     보상은 게임의 네 경제(돈·버프·상점·주방)를 하나씩 건드린다. */
  var ADS = {
    watchSec: 30,   // 한 번 시청 시간(초) — 실제 광고로 교체될 자리
    perDay: 3,      // 아이콘 하나당 하루 시청 횟수 (자정 리셋)
    boostMult: 2,   // '수익 2배' 버프 배율
    boostDur: 1800, // '수익 2배' 지속(초) = 30분
    goldSec: 3600,  // '보너스 골드' = 초당 수익 × 이만큼(초) = 1시간치
    goldMin: 5000,  // 아직 수익이 없을 때의 최소 골드
    ingCount: 12,   // '재료' 로 주는 랜덤 재료 개수
    slots: [
      { id: 'gold',   icon: 'event/event_bonus_gold.png', name: '보너스 골드', desc: '1시간치 수익을 목돈으로' },
      { id: 'boost',  icon: 'event/event_double_coin.png', name: '수익 2배',   desc: '30분 동안 모든 수익 ×2' },
      { id: 'coupon', icon: 'event/event_coupon.png', name: '할인 쿠폰',   desc: '설비·업그레이드 할인권 1장' },
      { id: 'ings',   icon: 'event/event_material_box.png', name: '재료 한 아름', desc: '주방 재료 여러 개' }
    ]
  };

  /* ---------- 화면 테마 (색 스킨) ----------
     기본(auto)은 style.css 의 :root 값을 그대로 쓰고, 나머지는 CSS 변수만 덮어쓴다.
     폰트·이미지는 손대지 않는다 — 외부 파일 없이 색만 바꾸는 자기완결형 스킨이다.
     sw 는 설정 화면의 미리보기 색막대(배경·강조·금색). */
  var THEMES = [
    {
      id: 'auto', icon: '🌌', name: '기본',
      sw: ['#141024', '#8b5cf6', '#ffcc44']
      // vars 없음 = :root 기본값
    },
    {
      id: 'pojang', icon: '🏮', name: '포장마차',
      sw: ['#17110c', '#ff9f43', '#ffce54'],
      vars: {
        '--bg': '#17110c', '--bg2': '#2b2015', '--card': '#33261a', '--card2': '#3a2a19',
        '--line': '#503a24', '--txt': '#fbeeda', '--dim': '#c3a982',
        '--gold': '#ffce54', '--good': '#8bbf5a', '--bad': '#e0533a',
        '--accent': '#ff9f43', '--accent2': '#e0533a',
        '--appbg': 'radial-gradient(130% 60% at 50% 0%, #2e1e10 0%, #1c140d 46%, #150f09 100%)',
        '--hud': 'linear-gradient(180deg, #241a12, #1a1410)',
        '--tabbar': 'rgba(28,20,13,0.97)',
        '--tapbg': 'radial-gradient(circle at 35% 30%, #4a3420, #241810 70%)'
      }
    },
    {
      id: 'china', icon: '🏮', name: '중화풍',
      sw: ['#16110c', '#c8963f', '#c8632a'],
      vars: {
        '--bg': '#16110c', '--bg2': '#241a12', '--card': '#1e1813', '--card2': '#2a2018',
        '--line': '#3a2f22', '--txt': '#e6dcc4', '--dim': '#9a876a',
        '--gold': '#e0b45f', '--good': '#9db35a', '--bad': '#b5432f',
        '--accent': '#c8963f', '--accent2': '#c8632a',
        '--appbg': 'radial-gradient(120% 55% at 50% 0%, #2a2018 0%, #16110c 46%, #100c09 100%)',
        '--hud': 'linear-gradient(180deg, #241a12, #1a1410)',
        '--tabbar': 'rgba(18,13,9,0.97)',
        '--tapbg': 'radial-gradient(circle at 50% 40%, #2a2018, #120d09 72%)'
      }
    }
  ];

  // 공지사항 — id 가 클수록 최신. 최신 id 가 세이브의 noticeSeen 보다 크면
  // 헤더 📢 에 빨간 점이 뜬다. 새 소식을 추가할 땐 위에 더 큰 id 로 넣는다.
  var NOTICES = [
    { id: 4, date: '2026-08-31', title: '🎟️ 할인 쿠폰이 성장해요',
      body: '쿠폰 할인율이 이제 30%에서 시작해 쓸수록 5%p씩 자라 100%까지 오릅니다. 100% 쿠폰을 쓰면 설비 1개가 공짜! 그 뒤엔 70%로 떨어져 다시 자라요. (할인은 대량구매 전체가 아니라 설비 1개에만 붙어요)' },
    { id: 3, date: '2026-08-31', title: '🛒 상점 · ✉️ 우편함이 열렸어요',
      body: '출석 · 도전과제 · 환생으로 모이는 새 재화 "별사탕(🍬)"으로 상점에서 쿠폰·부스트·골드·재료를 살 수 있어요. 받은 소식과 선물은 우편함에 담깁니다. 헤더 오른쪽 아이콘을 눌러보세요!' },
    { id: 2, date: '2026-08-31', title: '🌙 절전 모드가 생겼어요',
      body: '화면을 어둡게 해 배터리를 아끼면서도 가게는 계속 돌아가요. 설정에서 켜고, "절전모드 해제"를 누르면 다시 나옵니다.' },
    { id: 1, date: '2026-08-31', title: '🍢 분식집 키우기에 오신 걸 환영해요',
      body: '어묵 꼬치부터 시작해 전국 최고의 분식집으로 키워보세요. 자리를 비워도 가게는 계속 돈을 벌어요. 재개업(환생)으로 명성을 쌓으면 더 빨라집니다!' }
  ];

  // 우편함 — 받은 편지. reward 가 있으면 한 번 받을 수 있다(mailTaken 에 기록).
  // 출석·이정표 보상은 자동지급이라 여기 없다 — 개업 선물·안내 편지 위주다.
  var MAIL = [
    { id: 1, date: '2026-08-31', from: '분식집 운영팀', title: '🎁 개업 축하 선물이에요',
      body: '분식집 키우기를 시작해 주셔서 고마워요! 개업 축하 선물을 담아 보냅니다. 아래 "받기"로 챙기세요.',
      reward: { gold: 5000, coupons: 1 } },
    { id: 2, date: '2026-08-31', from: '분식집 운영팀', title: '자리를 비워도 가게는 돌아가요',
      body: '앱을 꺼두거나 절전 모드를 켜도 가게는 계속 돈을 벌어요. 다시 오면 그동안 번 돈을 정산해 드립니다. 편하게 다녀오세요!' }
  ];

  return {
    COST_GROWTH: COST_GROWTH,
    NOTICES: NOTICES,
    MAIL: MAIL,
    CANDY: CANDY,
    SHOP: SHOP,
    GENERATORS: GENERATORS,
    UPGRADES: UPGRADES,
    FAME_SHOP: FAME_SHOP,
    ACHIEVEMENTS: ACHIEVEMENTS,
    COUPON: COUPON,
    FIRST_PRESTIGE: FIRST_PRESTIGE,
    ADS: ADS,
    THEMES: THEMES,
    TAP_SKINS: TAP_SKINS,
    CROWD_SKINS: CROWD_SKINS,
    OWNER: OWNER,
    HEADWEAR: HEADWEAR,
    shopFront: shopFront,
    alleyBack: alleyBack,
    GOLDEN: GOLDEN,
    THIEF: THIEF,
    MANAGER: MANAGER,
    OFFLINE: OFFLINE,
    BOOST: BOOST,
    DAILY: DAILY,
    QUEST: QUEST,
    QUESTS: QUESTS,
    RANK: RANK,
    REGIONS: REGIONS,
    RANK_AREAS: RANK_AREAS,
    RANK_FOODS: RANK_FOODS,
    RANK_TITLES: RANK_TITLES,
    TAP_SOUNDS: TAP_SOUNDS,
    PARTY: PARTY,
    KITCHEN: KITCHEN,
    MICHELIN: MICHELIN
  };
})();
