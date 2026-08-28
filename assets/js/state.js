/* 세이브 데이터 관리 (localStorage) */
var State = (function () {

  var KEY = 'bunsik_idle_save_v1';
  var VERSION = 3;
  var MAX_RUNS = 50;      // 회차 기록은 이만큼만 들고 있는다

  function now() { return Date.now(); }

  /* 지금 Data 에 실제로 존재하는 id 만 인정한다.
     밸런스를 고치다 항목을 지우면 옛 세이브에 그 id 가 남는데,
     특히 achievements 는 개수가 그대로 전체 배율(+1%)에 들어가므로
     사라진 도전과제가 유령 배율을 계속 주게 된다. */
  function idSet(list) {
    var m = {};
    list.forEach(function (x) { m[x.id] = true; });
    return m;
  }

  var VALID = {
    gens: idSet(Data.GENERATORS),
    upgrades: idSet(Data.UPGRADES),
    fameLv: idSet(Data.FAME_SHOP),
    achievements: idSet(Data.ACHIEVEMENTS),
    ings: idSet(Data.KITCHEN.ings),
    kfoods: idSet(Data.KITCHEN.foods)
  };

  // 명성상점 레벨 상한 (max 를 낮췄을 때 초과분이 남지 않게)
  var FAME_MAX = {};
  Data.FAME_SHOP.forEach(function (f) { FAME_MAX[f.id] = f.max; });

  function fresh() {
    return {
      v: VERSION,
      money: 0,
      runEarned: 0,      // 이번 회차 누적 매출 (환생 시 초기화)
      totalEarned: 0,    // 전체 누적 매출 (영구)
      taps: 0,
      gens: {},          // 설비id -> 개수
      upgrades: {},      // 업그레이드id -> true
      fameLv: {},        // 명성상점id -> 레벨
      achievements: {},  // 도전과제id -> true
      fame: 0,
      prestiges: 0,
      playTime: 0,       // 초
      offlineClaims: 0,

      // 버프 (남은 시간은 초, 온라인일 때만 줄어든다)
      boostLeft: 0,      // 손님 몰이 남은 시간
      boostCd: 0,        // 손님 몰이 쿨다운 남은 시간
      boosts: 0,         // 손님 몰이 사용 횟수
      goldLeft: 0,       // 황금 손님 수익 버프 남은 시간
      goldMult: 1,       // 그 버프의 배율
      goldTapLeft: 0,    // 황금 손님 탭 버프 남은 시간
      goldTapMult: 1,
      goldens: 0,        // 황금 손님 잡은 횟수
      macroBlocks: 0,    // 매크로로 판정돼 막힌 횟수
      thievesCaught: 0,  // 직접 잡은 도둑
      thiefSaves: 0,     // 경찰이 잡아준 횟수
      thefts: 0,         // 놓친 횟수
      stolen: 0,         // 도둑맞은 총액
      bestCombo: 0,      // 최고 콤보

      mute: 0,           // 소리 끄기 (0/1)
      tapSound: 'classic', // 조리음 종류 (Data.TAP_SOUNDS 의 id)
      notifyOffline: 0,  // 오프라인 보상 가득 참 알림 (0/1)
      lastBackup: 0,     // 마지막으로 세이브 코드를 내보낸 시각 (백업 알림용)
      bestMichelin: 0,   // 미슐랭 도전 최고 별 (0~5, 통산)
      michelinGrand: 0,  // 5성 영구 보상을 받았는가 (0/1)
      michBestTaps: 0,   // 한 판 최고 조리 횟수 (통산, 랭킹용)
      michTier: 0,       // 미슐랭 도전 단계 (0부터 · 5성 깰 때마다 +1, 다음이 더 어려워짐)
      michSeason: '',    // 지금 시즌 id (YYYY-MM)
      michSeasonStars: 0,// 이번 시즌 최고 별
      michSeasonTaps: 0, // 이번 시즌 최고 조리 횟수
      michHist: [],      // 지난 시즌 기록 [{s, stars, taps}]
      sawTour: 0,        // 첫 실행 안내를 봤는가 (0/1)
      autoBought: 0,     // 점장이 대신 산 설비 수
      sheetUp: 0,        // 가게 탭 시트를 올려둔 상태인가 (0/1)
      region: '',        // 전국 맛집 랭킹에서 내 가게가 속한 지역 (한 번 배정되면 고정)
      partyFoods: [],    // 주말 파티에서 모은 음식 도감 (id 배열)
      ings: {},          // 🍳 주방 재료 창고 (재료id -> 개수)
      kfoods: {},        // 🍳 주방 음식 도감 (음식id -> 만든 횟수, 1 이상이면 도감 등록)
      truckCount: 0,     // 오늘 온 재료 트럭 수 — 올수록 다음 트럭 간격이 30초씩 늘고, 자정에 0으로 리셋
      truckDay: '',      // truckCount 가 속한 날짜 (YYYY-MM-DD)
      tapSkin: 'auto',   // 조리 음식 스킨 id
      crowdSkin: 'auto', // 손님 스킨 id

      // 명예의 전당 — 환생해도 남는 개인 기록
      runTime: 0,        // 이번 회차 경과 시간 (초)
      bestRunEarned: 0,  // 한 회차 최고 매출
      bestPerSec: 0,     // 최고 순간 초당 수익
      bestTap: 0,        // 한 번에 가장 많이 번 탭
      bestFameGain: 0,   // 한 번에 얻은 최고 명성
      fastestPrestige: 0,// 최단 환생 소요 시간 (초, 0이면 기록 없음)
      runs: [],          // 역대 회차 기록 (최근 50개)

      dailyDate: '',     // 마지막 출석 보상 날짜 (YYYY-MM-DD)
      dailyStreak: 0,
      dailyClaims: 0,

      // 일일 퀘스트 — 날짜가 바뀌면 game.js 의 questRoll() 이 새로 깐다
      questDate: '',     // 지금 깔린 퀘스트가 어느 날 것인가
      questIds: [],      // 오늘의 퀘스트 id (Data.QUEST.count 개)
      questGoals: [],    // 각 목표치 ('오늘 벌기' 는 그날 수익에 맞춰 정해진다)
      questProg: [],     // 각 진행도
      questTaken: [],    // 보상을 받았는가 (0/1)
      questAllTaken: 0,  // 셋 다 끝낸 보너스를 받았는가 (0/1)
      questsDone: 0,     // 지금까지 끝낸 퀘스트 수 (평생)

      startedAt: now(),
      lastSeen: now()
    };
  }

  /** 저장된 값이 깨져 있어도 기본값으로 채워서 돌려준다 */
  function normalize(raw) {
    var s = fresh();
    if (!raw || typeof raw !== 'object') return s;

    var numKeys = ['money', 'runEarned', 'totalEarned', 'taps', 'fame',
                   'prestiges', 'playTime', 'offlineClaims', 'startedAt', 'lastSeen',
                   'boostLeft', 'boostCd', 'boosts', 'goldLeft', 'goldMult',
                   'goldTapLeft', 'goldTapMult', 'goldens', 'macroBlocks', 'bestCombo',
                   'thievesCaught', 'thiefSaves', 'thefts', 'stolen',
                   'runTime', 'bestRunEarned', 'bestPerSec', 'bestTap',
                   'bestFameGain', 'fastestPrestige',
                   'dailyStreak', 'dailyClaims', 'sheetUp', 'mute', 'sawTour', 'autoBought',
                   'questAllTaken', 'questsDone', 'notifyOffline', 'lastBackup',
                   'bestMichelin', 'michelinGrand', 'michBestTaps', 'michSeasonStars', 'michSeasonTaps', 'michTier',
                   'truckCount'];
    // 큰 돈이 저장 중 Infinity 로 새면(구버전 세이브 등) 0 으로 리셋하지 말고 천장으로 clamp.
    // 0 으로 밀면 최고 부자가 빈털터리가 되고, 화면엔 '0원' 인데 구매만 되는 것처럼 보인다.
    var CAPV = Number.MAX_VALUE;
    var clampKeys = { money: 1, runEarned: 1, totalEarned: 1, bestRunEarned: 1, stolen: 1 };
    numKeys.forEach(function (k) {
      var v = Number(raw[k]);
      if (clampKeys[k] && v > CAPV) v = CAPV;   // Infinity·오버플로 → 천장 (NaN 은 그대로 걸러진다)
      if (isFinite(v) && v >= 0) s[k] = v;
    });

    var mapKeys = ['gens', 'upgrades', 'fameLv', 'achievements', 'ings', 'kfoods'];
    mapKeys.forEach(function (k) {
      if (raw[k] && typeof raw[k] === 'object') {
        Object.keys(raw[k]).forEach(function (id) {
          if (!VALID[k][id]) return;          // 지워졌거나 이름이 바뀐 항목은 버린다
          var v = raw[k][id];
          if (k === 'upgrades' || k === 'achievements') {
            if (v) s[k][id] = true;
          } else {
            var n = Math.floor(Number(v));
            if (!isFinite(n) || n <= 0) return;
            if (k === 'fameLv') n = Math.min(n, FAME_MAX[id]);
            s[k][id] = n;
          }
        });
      }
    });

    // 배율은 1 미만으로 내려가면 안 된다 (0이 저장돼 있으면 수익이 통째로 사라진다)
    if (!(s.goldMult >= 1)) s.goldMult = 1;
    if (!(s.goldTapMult >= 1)) s.goldTapMult = 1;

    // 회차 기록 — 숫자만 추리고 개수를 제한한다 (깨진 값이 순위표를 망치지 않게)
    if (Array.isArray(raw.runs)) {
      s.runs = raw.runs.filter(function (r) {
        return r && typeof r === 'object';
      }).map(function (r) {
        return {
          n: Math.max(0, Math.floor(Number(r.n)) || 0),
          earned: Math.max(0, Number(r.earned) || 0),
          fame: Math.max(0, Math.floor(Number(r.fame)) || 0),
          seconds: Math.max(0, Number(r.seconds) || 0)
        };
      }).filter(function (r) {
        return isFinite(r.earned) && isFinite(r.seconds);
      }).slice(-MAX_RUNS);
    }

    // 미슐랭 시즌 기록
    if (typeof raw.michSeason === 'string' && /^\d{4}-\d{2}$/.test(raw.michSeason)) {
      s.michSeason = raw.michSeason;
    }
    if (Array.isArray(raw.michHist)) {
      s.michHist = raw.michHist.filter(function (h) {
        return h && typeof h === 'object' && /^\d{4}-\d{2}$/.test(h.s);
      }).map(function (h) {
        return { s: h.s, stars: Math.max(0, Math.min(5, Math.floor(Number(h.stars) || 0))),
                 taps: Math.max(0, Math.floor(Number(h.taps) || 0)) };
      }).slice(-Data.MICHELIN.histKeep);
    }

    // 파티 도감 — 실제로 있는 음식 id 만, 중복 없이
    if (Array.isArray(raw.partyFoods)) {
      var seen = {};
      s.partyFoods = raw.partyFoods.filter(function (id) {
        if (seen[id]) return false;
        seen[id] = 1;
        return Data.PARTY.foods.some(function (f) { return f.id === id; });
      });
    }

    // 재료 트럭 카운트가 속한 날짜 (형식이 맞을 때만)
    if (typeof raw.truckDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.truckDay)) s.truckDay = raw.truckDay;

    // 지역은 실제로 있는 것일 때만 받는다 (없으면 game.js 가 처음 볼 때 배정한다)
    if (typeof raw.region === 'string') {
      for (var ri = 0; ri < Data.REGIONS.length; ri++) {
        if (Data.REGIONS[ri].id === raw.region) { s.region = raw.region; break; }
      }
    }

    // 탭 소리도 실제로 있는 것일 때만 받는다
    if (typeof raw.tapSound === 'string') {
      for (var si = 0; si < Data.TAP_SOUNDS.length; si++) {
        if (Data.TAP_SOUNDS[si].id === raw.tapSound) { s.tapSound = raw.tapSound; break; }
      }
    }

    // 스킨은 실제로 있는 id 일 때만 받는다 (없는 걸 넣으면 화면이 비어버린다)
    ['tapSkin', 'crowdSkin'].forEach(function (k) {
      var list = k === 'tapSkin' ? Data.TAP_SKINS : Data.CROWD_SKINS;
      var v = raw[k];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === v) { s[k] = v; return; }
      }
    });

    if (typeof raw.dailyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dailyDate)) {
      s.dailyDate = raw.dailyDate;
    }

    // 퀘스트 — 네 배열의 길이가 어긋나면 통째로 버린다.
    // 반쯤 깨진 채로 두면 진행도가 엉뚱한 퀘스트에 붙는다.
    if (typeof raw.questDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.questDate)) {
      var n = Data.QUEST.count;
      var ids = Array.isArray(raw.questIds) ? raw.questIds : [];
      var okIds = ids.length === n && ids.every(function (id) {
        return Data.QUESTS.some(function (q) { return q.id === id; });
      });
      function nums(v) {
        if (!Array.isArray(v) || v.length !== n) return null;
        var out = v.map(function (x) { return Math.max(0, Number(x) || 0); });
        return out.every(isFinite) ? out : null;
      }
      var goals = nums(raw.questGoals), prog = nums(raw.questProg), taken = nums(raw.questTaken);
      if (okIds && goals && prog && taken) {
        s.questDate = raw.questDate;
        s.questIds = ids.slice();
        s.questGoals = goals;
        s.questProg = prog;
        s.questTaken = taken.map(function (x) { return x ? 1 : 0; });
      }
    }

    if (!s.startedAt) s.startedAt = now();
    if (!s.lastSeen) s.lastSeen = now();
    return s;
  }

  var data = fresh();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) { data = fresh(); return false; }
      data = normalize(JSON.parse(raw));
      return true;
    } catch (e) {
      console.warn('세이브 불러오기 실패, 새로 시작합니다.', e);
      data = fresh();
      return false;
    }
  }

  /** 세이브 코드를 백업했다고 표시 (백업 알림 타이머 리셋) */
  function markBackup() {
    data.lastBackup = now();
    save();
  }

  /** 브라우저에 '이 저장소를 지우지 말아줘' 라고 한 번 요청한다 */
  function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist && navigator.storage.persisted) {
        return navigator.storage.persisted().then(function (already) {
          if (already) return true;
          return navigator.storage.persist();
        }).catch(function () { return false; });
      }
    } catch (e) {}
    return Promise.resolve(false);
  }

  /** 저장소가 브라우저에 의해 보호되고 있는가 (모르면 null) */
  function storagePersisted() {
    try {
      if (navigator.storage && navigator.storage.persisted) return navigator.storage.persisted();
    } catch (e) {}
    return Promise.resolve(null);
  }

  function save() {
    try {
      data.lastSeen = now();
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('저장 실패', e);
      return false;
    }
  }

  function wipe() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    data = fresh();
  }

  /** 세이브를 base64 문자열로 (백업용) */
  function exportText() {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    } catch (e) {
      return '';
    }
  }

  function importText(txt) {
    try {
      var obj = JSON.parse(decodeURIComponent(escape(atob(String(txt).trim()))));
      data = normalize(obj);
      save();
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    get: function () { return data; },
    set: function (d) { data = normalize(d); },
    fresh: fresh,
    load: load,
    save: save,
    wipe: wipe,
    MAX_RUNS: MAX_RUNS,
    exportText: exportText,
    importText: importText,
    markBackup: markBackup,
    requestPersist: requestPersist,
    storagePersisted: storagePersisted,
    now: now
  };
})();
