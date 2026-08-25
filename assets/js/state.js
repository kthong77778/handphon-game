/* 세이브 데이터 관리 (localStorage) */
var State = (function () {

  var KEY = 'bunsik_idle_save_v1';
  var VERSION = 1;

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
      startedAt: now(),
      lastSeen: now()
    };
  }

  /** 저장된 값이 깨져 있어도 기본값으로 채워서 돌려준다 */
  function normalize(raw) {
    var s = fresh();
    if (!raw || typeof raw !== 'object') return s;

    var numKeys = ['money', 'runEarned', 'totalEarned', 'taps', 'fame',
                   'prestiges', 'playTime', 'offlineClaims', 'startedAt', 'lastSeen'];
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
    exportText: exportText,
    importText: importText,
    now: now
  };
})();
