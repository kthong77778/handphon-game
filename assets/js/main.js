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
      Sound.play('achv');
      UI.invalidate();
      UI.toast('🏆 ' + got[0].name + ' 달성!' + (got.length > 1 ? ' 외 ' + (got.length - 1) + '개' : ''));
    }
  }

  /* ---------- 핸들러 ---------- */
  var handlers = {
    onTap: function (trusted, x, y) {
      var res = Game.tap(trusted, undefined, x, y);
      if (!res.blocked) announceAchievements();
      return res;
    },

    onGolden: function (res) {
      announceAchievements();
      UI.refresh(true);
      State.save();
    },

    onThief: function (kind, res) {
      announceAchievements();
      UI.refresh(true);
      State.save();
    },

    onPrestige: function () {
      var gain = Game.fameGain();
      if (gain <= 0) return;
      UI.ask({
        emoji: '✨',
        title: '재개업할까요?',
        text: '돈 · 설비 · 업그레이드가 모두 사라집니다.<br>' +
              '대신 <b>명성 ' + Fmt.num(gain) + '</b> 을(를) 영구히 얻습니다.',
        ok: '재개업하기'
      }, function () {
        var first = State.get().prestiges === 0;
        Game.doPrestige();
        Scene.clear();
        announceAchievements();
        UI.invalidate();
        State.save();
        UI.showTab('shop');
        Sound.play('prestige');
        if (first) {
          // 첫 재개업 — 토스트 대신 축하 모달로 특별 선물을 알려준다
          var cp = State.get().coupons;
          UI.ask({
            emoji: '🎊',
            title: '첫 재개업 축하해요!',
            text: '명성 <b>' + Fmt.num(gain) + '</b> 을(를) 얻고 새 출발!<br><br>' +
                  '처음이라 특별 선물이에요:<br>' +
                  '💰 축하 골드 <b>' + Fmt.num(Data.FIRST_PRESTIGE.gold) + '원</b><br>' +
                  '🎟️ 할인 쿠폰 <b>' + cp + '장</b>' +
                  (cp > Data.COUPON.max ? ' <b>(가득 차서 1장 더!)</b>' : '') + '<br><br>' +
                  '쿠폰으로 설비를 싸게 사서 빠르게 다시 키워보세요!',
            ok: '고마워요!',
            oneButton: true
          }, function () {});
        } else {
          UI.toast('✨ 명성 ' + Fmt.num(gain) + ' 획득! 새 출발입니다.');
        }
      });
    },

    /* 테스트 도구 — 지인 테스트 빌드 전용.
       방치형은 후반 구간에 도달하는 데 며칠이 걸려서, 그대로 두면
       설비 7~10 · 조리 7·8단계 · VIP/재벌 손님 같은 콘텐츠의 피드백을
       아예 받을 수 없다. 세이브를 초기화했을 때 복귀 부담을 줄이는 역할도 한다. */
    onDebug: function (kind) {
      var s = State.get();
      var msg;

      if (kind === 'hour' || kind === 'day') {
        var sec = kind === 'hour' ? 3600 : 86400;
        // 오프라인 정산과 같은 방식. playTime · runTime 도 같이 흘러간다
        var before = s.money;
        Game.tick(sec);
        msg = '⏩ ' + Fmt.time(sec) + ' 경과 · +' + Fmt.won(s.money - before);
      } else if (kind === 'money') {
        // 수익이 0인 초반에도 쓸 수 있게 바닥을 깔아둔다
        s.money = Math.max(s.money * 1000, 10000);
        msg = '💰 ' + Fmt.won(s.money);
      } else {
        s.fame += 10;
        Game.invalidate();          // 명성은 전체 배율에 들어간다
        msg = '✨ 명성 ' + Fmt.num(s.fame);
      }

      announceAchievements();
      State.save();
      UI.invalidate();
      UI.refresh(true);
      UI.toast(msg);
    },

    onSave: function () {
      UI.toast(State.save() ? '저장했습니다' : '저장에 실패했습니다');
    },

    onExport: function () {
      var txt = State.exportText();
      if (!txt) { UI.toast('내보내기에 실패했습니다'); return; }
      // 클립보드는 권한이 없으면 조용히 실패하므로, 코드는 언제나 눈으로 볼 수 있게 띄운다
      UI.textDialog({
        emoji: '💾',
        title: '세이브 코드',
        desc: '이 코드를 복사해 두면 다른 기기에서 이어할 수 있습니다.',
        value: txt,
        readonly: true
      });
      State.markBackup();     // 백업했으니 알림 타이머를 리셋
      UI.refreshSaveGuard && UI.refreshSaveGuard();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () {
          UI.toast('세이브 코드를 복사했습니다');
        }, function () {});
      }
    },

    onImport: function () {
      UI.textDialog({
        emoji: '📥',
        title: '세이브 불러오기',
        desc: '내보낸 코드를 붙여넣으세요. 지금 진행 상황은 덮어써집니다.',
        ok: '불러오기'
      }, function (txt) {
        if (!txt || !txt.trim()) return;
        handlers.applyImport(txt.trim());
      });
    },

    applyImport: function (txt) {
      if (State.importText(txt)) {
        Game.invalidate();
        Game.resetCombo();
        Game.resetGuard();
        Scene.clear();
        UI.invalidate();
        UI.refresh(true);
        UI.toast('불러왔습니다');
      } else {
        UI.toast('코드가 올바르지 않습니다');
      }
    },

    onReset: function () {
      UI.ask({
        emoji: '🗑️',
        title: '모든 데이터를 삭제할까요?',
        text: '명성 · 도전과제 · 기록까지 <b>전부</b> 사라집니다.',
        ok: '삭제하기',
        danger: true
      }, function () {
        // 되돌릴 수 없는 일이라 한 번 더 묻는다
        UI.ask({
          emoji: '⚠️',
          title: '되돌릴 수 없습니다',
          text: '정말 진행할까요?',
          ok: '네, 삭제합니다',
          danger: true
        }, function () {
          State.wipe();
          Game.invalidate();
          Game.resetCombo();
          Game.resetGuard();
          Scene.clear();
          UI.invalidate();
          UI.setSheet(false, false);
          UI.refresh(true);
          UI.showTab('shop');
          UI.toast('데이터를 삭제했습니다');
        });
      });
    }
  };

  /* ---------- 게임 루프 ---------- */
  function loop(ts) {
    if (!lastFrame) lastFrame = ts;
    var dt = Math.min((ts - lastFrame) / 1000, MAX_DT);
    lastFrame = ts;

    var saving = UI.powerSaveOn && UI.powerSaveOn();
    if (dt > 0) {
      Game.tick(dt);                     // 수익은 절전 중에도 그대로 흐른다
      if (!saving) UI.tickWorld(dt);     // 거리·손님 연출은 절전 중엔 멈춘다
      uiAcc += dt * 1000;
      saveAcc += dt * 1000;
    }

    if (uiAcc >= UI_MS) {
      uiAcc = 0;
      announceAchievements();
      if (saving) {
        UI.updatePowerSave();            // 어두운 화면엔 돈 숫자만 가볍게 갱신
      } else {
        maybePrestigeIntro();
        UI.refresh();
      }
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
      Sound.play('reward');
      var claim = Game.claimOffline(reward.gain, reward.trucks);
      // 보상을 받은 뒤에 점장이 그 돈으로 설비를 산다 (받기 전엔 살 돈이 없다)
      var hired = Game.runManager(elapsed);
      Game.invalidate();
      announceAchievements();
      State.save();
      UI.refresh(true);
      if (claim && claim.ings && claim.ings.length > 0) {
        UI.toast('🚚 재료 트럭에서 재료 ' + claim.ings.length + '개를 챙겼어요');
      }
      if (hired.count > 0) {
        UI.toast('🧑‍💼 점장이 설비 ' + hired.count + '개를 사뒀습니다');
        Sound.play('buy');
      }
      done();
    });
  }

  /* ---------- 일일 출석 보상 ---------- */
  function settleDaily() {
    if (!Game.dailyReady()) return;
    var res = Game.claimDaily();
    if (!res) return;
    UI.showDaily(res, function () {
      Sound.play('reward');
      announceAchievements();
      State.save();
      UI.refresh(true);
    });
  }

  function settleReturn() {
    settleOffline(settleDaily);
  }

  /** 오래 백업을 안 했고 진행이 쌓였으면 한 번 살짝 알려준다 */
  var backupNagged = false;
  var BACKUP_AFTER = 7 * 24 * 3600 * 1000;   // 7일
  function maybeBackupReminder() {
    if (backupNagged) return;
    var s = State.get();
    var worth = s.totalEarned >= 1e6 || s.prestiges >= 1;
    if (!worth) return;
    var base = s.lastBackup || s.startedAt || State.now();
    if (State.now() - base < BACKUP_AFTER) return;
    backupNagged = true;
    UI.toast('💾 세이브 백업한 지 오래됐어요 — 설정에서 코드를 복사해 두세요');
  }

  /** 홈 화면 앱으로 처음 켰는데 세이브가 비었으면, 저장공간 분리를 안내한다 */
  var STANDALONE_HINT_KEY = 'bunsik_seen_standalone_hint';
  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
             navigator.standalone === true;
    } catch (e) { return false; }
  }
  function maybeStandaloneHint(hadSave) {
    if (hadSave) return;              // 세이브가 있으면 문제 없음
    if (!isStandalone()) return;      // 홈 화면 앱일 때만
    var seen;
    try { seen = localStorage.getItem(STANDALONE_HINT_KEY); } catch (e) {}
    if (seen) return;
    try { localStorage.setItem(STANDALONE_HINT_KEY, '1'); } catch (e) {}
    UI.toast('🏠 홈 화면 앱은 사파리와 저장이 분리돼요. 사파리에서 놀던 세이브가 있으면 설정 → 세이브 불러오기로 옮겨오세요');
  }

  /* ---------- 첫 실행 안내 ---------- */
  function maybeTour() {
    var s = State.get();
    if (s.sawTour) return;
    // 끝까지 봤을 때가 아니라 '띄운 순간' 봤다고 적고 바로 저장한다.
    // 안내 도중에 앱을 닫으면 다음에 또 뜨던 것을 막는다 — 설정에서 언제든
    // 다시 볼 수 있으니 한 번 띄운 것으로 충분하다.
    s.sawTour = 1;
    State.save();
    // 안내가 끝난 뒤에 정산한다. 먼저 띄우면 모달이 겹치고,
    // 아예 건너뛰면 첫날 출석 보상을 그날 못 받는다.
    UI.showTour(0, settleReturn);
  }

  // 첫 환생 안내 — 환생해도 명성이 0이면 의미가 없으니, 명성이 처음 붙는
  // 순간(가게가 제법 커진 시점)에 딱 한 번 친절히 알려준다. 강요가 아니라
  // '잃는 게 아니라 강해진다'를 이해시키는 게 목적. 캐주얼 이탈 방지.
  function maybePrestigeIntro() {
    var s = State.get();
    if (s.sawPrestigeIntro) return;
    if (s.prestiges > 0) { s.sawPrestigeIntro = 1; return; }   // 이미 해본 사람에겐 불필요
    if (!(Game.fameGain() > 0)) return;
    s.sawPrestigeIntro = 1;              // 띄운 순간 봤다고 적는다 (도중 종료 방지)
    State.save();
    UI.ask({
      emoji: '🎉',
      title: '재개업(환생)이 열렸어요!',
      text: '가게가 제법 커졌어요. 이제 <b>재개업</b>을 할 수 있습니다.<br><br>' +
            '가게·설비·업그레이드는 리셋되지만, <b>명성</b>이 영구히 남아 ' +
            '<b>다음 판이 훨씬 빨라져요.</b> 잃는 게 아니라 <b>강해지는</b> 거예요.<br><br>' +
            '급할 것 없으니 원할 때 하시면 됩니다!',
      ok: '환생 보러 가기',
      oneButton: true
    }, function () { UI.showTab('prestige'); });
  }

  /* ---------- 오프라인 보상 알림 ---------- */
  // 완전히 닫힌 앱엔 서버 없이 알림을 못 보낸다. 그래서 앱이 백그라운드로
  // 물러난 '그때' 오프라인 인정 시간이 지나면 울리도록 예약해 둔다.
  // 탭이 살아 있는 동안만 유효하다 — 완전히 종료되면 울리지 않는다.
  var notifyTimer = null;

  function clearOfflineNotify() {
    if (notifyTimer) { clearTimeout(notifyTimer); notifyTimer = null; }
  }

  function scheduleOfflineNotify() {
    clearOfflineNotify();
    // 재접속 알림 스케줄(오프라인 가득 · 다음날 출석)을 한 번 계산한다.
    var schedule = Game.nextNudge();
    // 네이티브 래퍼(앱)가 붙어 있으면 넘겨서, 탭이 완전히 닫혀도 로컬 알림이 울리게 맡긴다.
    // 브릿지가 없으면(순수 웹) 조용히 넘어가고, 아래 웹 단독 폴백만 동작한다.
    if (window.BunsikNative && typeof window.BunsikNative.scheduleNudges === 'function') {
      try { window.BunsikNative.scheduleNudges(schedule); } catch (e) {}
    }
    // 웹 단독 폴백 — 탭이 살아 있는 동안만, 가장 가까운 '오프라인 가득' 알림 하나를 예약한다.
    if (State.get().notifyOffline !== 1) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var off = null;
    for (var i = 0; i < schedule.length; i++) { if (schedule[i].id === 'offline_full') { off = schedule[i]; break; } }
    if (!off || !(off.inSec > 0)) return;
    notifyTimer = setTimeout(function () { fireNudge(off); }, off.inSec * 1000);
  }

  function fireNudge(n) {
    // 서비스워커는 제거됐으므로 일반 Notification 으로 띄운다 (실패해도 조용히 넘어간다)
    try { new Notification('🍢 분식집 키우기', { body: n.body, tag: 'bunsik-' + n.id, renotify: true }); } catch (e) {}
  }

  /* ---------- 시작 ---------- */
  function boot() {
    var hadSave = State.load();
    State.requestPersist();    // 브라우저에 저장소 보호를 한 번 요청 (자동 삭제 방지)
    Game.invalidate();
    Game.questRoll();          // 오늘 퀘스트가 없으면 여기서 깔린다
    Game.michSeasonRoll();     // 달이 바뀌었으면 새 시즌으로
    Game.seedTabsSeen();       // 지금 열린 탭은 조용히 '봤다'로 — 기존 유저에겐 연출을 안 띄운다
    UI.init(handlers);
    if (window.Sky) Sky.init();   // 시간대 하늘 (기본 테마 배경)
    if (State.get().sawTour) settleReturn();
    else maybeTour();          // 처음이면 정산 모달과 겹치지 않게 안내부터
    UI.refresh(true);
    setTimeout(maybeBackupReminder, 4000);   // 첫 정산·모달이 지나간 뒤 살짝
    setTimeout(function () { maybeStandaloneHint(hadSave); }, 4500);
    requestAnimationFrame(loop);

    // 앱이 가려질 때 저장 (모바일에서 탭이 그냥 죽는 경우 대비)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        State.save();
        scheduleOfflineNotify();     // 자리를 비운 순간부터 인정 시간을 잰다
      } else {
        clearOfflineNotify();        // 돌아왔으니 예약을 지운다
        lastFrame = 0;   // 복귀 시 dt 폭주 방지
        Game.resetCombo();
        settleReturn();
      }
    });
    window.addEventListener('pagehide', function () { State.save(); });

    // 더블탭 확대 방지
    document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
