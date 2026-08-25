/* 부팅 / 게임 루프 / 저장 */
(function () {

  var AUTOSAVE_MS = 10000;
  var UI_MS = 100;          // 화면 갱신 주기
  var MAX_DT = 1;           // 한 프레임에 인정할 최대 시간(초)

  var lastFrame = 0;
  var uiAcc = 0;
  var saveAcc = 0;

  /* ---------- 도전과제 알림 ---------- */
  function announceAchievements() {
    var got = Game.checkAchievements();
    if (got.length) {
      UI.invalidate();
      UI.toast('🏆 ' + got[0].name + ' 달성!' + (got.length > 1 ? ' 외 ' + (got.length - 1) + '개' : ''));
    }
  }

  /* ---------- 핸들러 ---------- */
  var handlers = {
    onTap: function () {
      var v = Game.tap();
      announceAchievements();
      return v;
    },

    onGolden: function (res) {
      announceAchievements();
      UI.refresh(true);
      State.save();
    },

    onPrestige: function () {
      var gain = Game.fameGain();
      if (gain <= 0) return;
      var msg = '재개업하면 돈 · 설비 · 업그레이드가 모두 사라집니다.\n' +
                '대신 명성 ' + Fmt.num(gain) + ' 을(를) 영구히 얻습니다.\n\n진행할까요?';
      if (!confirm(msg)) return;
      Game.doPrestige();
      announceAchievements();
      UI.invalidate();
      State.save();
      UI.showTab('shop');
      UI.toast('✨ 명성 ' + Fmt.num(gain) + ' 획득! 새 출발입니다.');
    },

    onSave: function () {
      UI.toast(State.save() ? '저장했습니다' : '저장에 실패했습니다');
    },

    onExport: function () {
      var txt = State.exportText();
      if (!txt) { UI.toast('내보내기에 실패했습니다'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () {
          UI.toast('세이브 코드를 복사했습니다');
        }, function () {
          prompt('아래 코드를 복사해서 보관하세요', txt);
        });
      } else {
        prompt('아래 코드를 복사해서 보관하세요', txt);
      }
    },

    onImport: function () {
      var txt = prompt('세이브 코드를 붙여넣으세요');
      if (!txt) return;
      if (State.importText(txt)) {
        Game.invalidate();
        Game.resetCombo();
        UI.invalidate();
        UI.refresh(true);
        UI.toast('불러왔습니다');
      } else {
        UI.toast('코드가 올바르지 않습니다');
      }
    },

    onReset: function () {
      if (!confirm('정말 모든 데이터를 삭제할까요?\n명성과 도전과제까지 전부 사라집니다.')) return;
      if (!confirm('되돌릴 수 없습니다. 정말 진행할까요?')) return;
      State.wipe();
      Game.invalidate();
      Game.resetCombo();
      UI.invalidate();
      UI.refresh(true);
      UI.showTab('shop');
      UI.toast('데이터를 삭제했습니다');
    }
  };

  /* ---------- 게임 루프 ---------- */
  function loop(ts) {
    if (!lastFrame) lastFrame = ts;
    var dt = Math.min((ts - lastFrame) / 1000, MAX_DT);
    lastFrame = ts;

    if (dt > 0) {
      Game.tick(dt);
      UI.tickWorld(dt);
      uiAcc += dt * 1000;
      saveAcc += dt * 1000;
    }

    if (uiAcc >= UI_MS) {
      uiAcc = 0;
      announceAchievements();
      UI.refresh();
    }

    if (saveAcc >= AUTOSAVE_MS) {
      saveAcc = 0;
      State.save();
    }

    requestAnimationFrame(loop);
  }

  /* ---------- 오프라인 정산 ---------- */
  // 오프라인 모달과 출석 모달이 동시에 뜨면 겹치므로 순서대로 이어서 띄운다.
  function settleOffline(next) {
    function done() { if (next) next(); }

    var s = State.get();
    var elapsed = (State.now() - s.lastSeen) / 1000;
    if (elapsed <= 1) { done(); return; }

    // 잠깐(1분 미만) 자리를 비운 정도는 모달 없이 100% 지급
    if (elapsed < 60) {
      Game.tick(elapsed);
      done();
      return;
    }

    var reward = Game.offlineReward(elapsed);
    // 버프 지속시간과 손님 몰이 쿨다운도 자리를 비운 만큼 흘려보낸다
    Game.advanceTimers(elapsed);

    if (reward.gain <= 0) { done(); return; }
    UI.showOffline(reward, function () {
      Game.claimOffline(reward.gain);
      announceAchievements();
      State.save();
      UI.refresh(true);
      done();
    });
  }

  /* ---------- 일일 출석 보상 ---------- */
  function settleDaily() {
    if (!Game.dailyReady()) return;
    var res = Game.claimDaily();
    if (!res) return;
    UI.showDaily(res, function () {
      announceAchievements();
      State.save();
      UI.refresh(true);
    });
  }

  function settleReturn() {
    settleOffline(settleDaily);
  }

  /* ---------- 시작 ---------- */
  function boot() {
    State.load();
    Game.invalidate();
    UI.init(handlers);
    settleReturn();
    UI.refresh(true);
    requestAnimationFrame(loop);

    // 앱이 가려질 때 저장 (모바일에서 탭이 그냥 죽는 경우 대비)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        State.save();
      } else {
        lastFrame = 0;   // 복귀 시 dt 폭주 방지
        Game.resetCombo();
        settleReturn();
      }
    });
    window.addEventListener('pagehide', function () { State.save(); });

    // 더블탭 확대 방지
    document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });

    // 오프라인 실행용 서비스워커
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
