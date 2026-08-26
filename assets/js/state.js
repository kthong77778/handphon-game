/* 세이브 데이터 관리 (localStorage) */
var State = (function () {

  var KEY = 'bunsik_idle_save_v1';
  var VERSION = 3;
  var MAX_RUNS = 50;      // 회차 기록은 이만큼만 들고 있는다

  function now() { return Date.now(); }

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
      sawTour: 0,        // 첫 실행 안내를 봤는가 (0/1)
      autoBought: 0,     // 점장이 대신 산 설비 수
      sheetUp: 0,        // 가게 탭 시트를 올려둔 상태인가 (0/1)
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
                   'questAllTaken', 'questsDone'];
    numKeys.forEach(function (k) {
      var v = Number(raw[k]);
      if (isFinite(v) && v >= 0) s[k] = v;
    });

    var mapKeys = ['gens', 'upgrades', 'fameLv', 'achievements'];
    mapKeys.forEach(function (k) {
      if (raw[k] && typeof raw[k] === 'object') {
        Object.keys(raw[k]).forEach(function (id) {
          var v = raw[k][id];
          if (k === 'upgrades' || k === 'achievements') {
            if (v) s[k][id] = true;
          } else {
            var n = Math.floor(Number(v));
            if (isFinite(n) && n > 0) s[k][id] = n;
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
    now: now
  };
})();
