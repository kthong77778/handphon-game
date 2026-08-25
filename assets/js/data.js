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


  /* ---------- 조리 음식 스킨 ---------- */
  // 탭 수익이 오르면 steps 를 따라 메뉴가 올라간다.
  // at 은 "이 수익부터 이 메뉴" 라는 뜻 (버프·콤보를 뺀 순수 탭 수익 기준).
  // 실제 진행 시뮬레이션에 맞춰 잡았다 — 첫 회차 하루 안에 6단계까지 보이고,
  // 7·8단계는 환생 이후의 목표가 된다. 환생하면 탭 수익과 함께 단계도 내려간다.
  var TAP_STEP_AT = [0, 8, 100, 800, 6e3, 5e4, 1e6, 5e7];

  function ladder(list) {
    return list.map(function (x, i) {
      return { at: TAP_STEP_AT[i], icon: x[0], name: x[1] };
    });
  }

  var TAP_SKINS = [
    {
      id: 'auto', icon: '🍢', name: '분식 성장형',
      desc: '어묵 꼬치에서 시작해 한상 차림까지',
      steps: ladder([
        ['🍢', '어묵 꼬치'], ['🍡', '떡꼬치'], ['🌭', '핫도그'], ['🥟', '왕만두'],
        ['🍤', '모둠튀김'], ['🍜', '라면 정식'], ['🍲', '부대찌개'], ['🍱', '프리미엄 한상']
      ])
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
      id: 'jumeok', icon: '🍙', name: '주먹밥 부락',
      desc: '한 손에 쏙 들어오는 밥',
      steps: ladder([
        ['🍙', '주먹밥'], ['🍘', '구운 주먹밥'], ['🍚', '곱빼기 밥'], ['🥗', '야채 주먹밥'],
        ['🍛', '카레 주먹밥'], ['🍣', '초밥'], ['🍱', '도시락'], ['🍲', '솥밥 한상']
      ])
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
    { id: 'ac25', icon: '📅', name: '개근 사장',      desc: '7일 연속 출석',                  check: function (s) { return s.dailyStreak >= 7; } }
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
    BOOST: BOOST,
    DAILY: DAILY
  };
})();
