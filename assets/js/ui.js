/* 화면 그리기 / 입력 처리 */
var UI = (function () {

  var el = {};
  var currentTab = 'shop';
  var currentGrade = 1;    // 주방 합성 등급 탭
  var buyAmt = 1;          // 1 | 10 | 100 | 'max'
  var sig = {};            // 목록 재생성 여부 판단용 서명
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }

  function cache() {
    ['money', 'rate', 'fameChip', 'fameNum', 'multChip', 'tapZone', 'tapTarget', 'tapPower',
     'genList', 'upgradeList', 'upgradeHint', 'fameShopList', 'achvList', 'statsBox',
     'questList',
     'adCard', 'adModal', 'adEmoji', 'adCount', 'adBar', 'adNote', 'adQuit',
     'pFameNow', 'pFameGain', 'pMultNext', 'prestigeBtn', 'prestigeReq',
     'dotUpgrade', 'dotPrestige', 'dotAchv', 'buyAmt', 'toast',
     'offlineModal', 'offlineText', 'offlineOk',
     'buffBar', 'partyBanner', 'partyHint', 'partyDex', 'combo', 'comboX', 'comboN', 'comboFill',
     'bossChip', 'bossXpFill', 'recoBar', 'recoIcon', 'recoName', 'recoDesc', 'recoCost',
     'ingStore', 'gradeTabs', 'kitchenGrid', 'truckPop', 'dotKitchen', 'specialCard',
     'craftReco', 'craftRecoIcon', 'craftRecoTag', 'craftRecoName', 'craftRecoDesc', 'craftRecoBtn',
     'dexCollection',
     'boostBtn', 'boostTitle', 'boostSub', 'goldenLayer', 'street', 'pops',
     'couponChip',
     'dailyModal', 'dailyText', 'streakDots', 'dailyOk',
     'tapEmoji', 'tapLabel', 'recordBox', 'runBoard', 'rankNote',
     'rankRegion', 'rankCard', 'rankHeads', 'rankBoard',
     'tapSkinRow', 'tapSkinNow', 'tapLadder', 'tapSoundRow', 'tapSoundNow',
     'crowdSkinRow', 'crowdSkinNow', 'crowdLadder', 'themeRow', 'themeNow',
     'prestigeOwner', 'ownerStage', 'ownerSexNow', 'ownerPick',
     'shopPage', 'shopTop', 'shopSheet', 'sheetHandle', 'sheetHint', 'sheetBody',
     'tourModal', 'tourEmoji', 'tourTitle', 'tourText', 'tourDots', 'tourNext', 'tourSkip',
     'muteBtn', 'muteIc', 'muteTx', 'notifyBtn', 'helpBtn',
     'powerSaveBtn', 'powerSave', 'psMoney', 'powerSaveExit',
     'noticeBtn', 'noticeDot', 'noticeModal', 'noticeList', 'noticeClose',
     'mailBtn', 'mailDot', 'mailModal', 'mailList', 'mailClose',
     'shopBtn', 'shopModal', 'candyNum', 'shopList', 'shopClose', 'candyChip', 'candyHud',
     'askModal', 'askEmoji', 'askTitle', 'askText', 'askOk', 'askCancel',
     'textModal', 'textEmoji', 'textTitle', 'textDesc', 'textInput', 'textOk', 'textCancel',
     'saveBtn', 'exportBtn', 'importBtn', 'resetBtn', 'saveGuard',
     'dbgHour', 'dbgDay', 'dbgMoney', 'dbgFame',
     'michelinCard', 'michelinModal', 'michPlay', 'michStars', 'michBar', 'michCount',
     'michNext', 'michTime', 'michTap', 'michTapEmoji', 'michResult', 'michResultEmoji',
     'michResultStars', 'michResultText', 'michDone', 'michQuit', 'michShareResult'].forEach(function (id) {
      el[id] = $(id);
    });
  }

  /* ---------- 공통 위젯 ---------- */

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 1800);
  }

  /* ---------- 절전 모드 ----------
     화면을 검게 덮되 게임 루프는 계속 돈다(전경이면 실시간, 잠기면 복귀 시
     오프라인 정산). main 의 루프가 powerSaveOn() 을 보고 무거운 렌더·연출을
     건너뛰어 배터리를 아낀다. 새로고침하면 풀리는 일시 모드라 세이브엔 안 남긴다. */
  var powerSave = false;
  function powerSaveOn() { return powerSave; }
  function updatePowerSave() {
    if (el.psMoney) el.psMoney.textContent = Fmt.won(State.get().money);
  }
  function enterPowerSave() {
    powerSave = true;
    el.powerSave.hidden = false;
    updatePowerSave();
    if (window.Sky && Sky.pause) Sky.pause(true);   // 하늘 갱신 인터벌도 멈춘다
  }
  function exitPowerSave() {
    powerSave = false;
    el.powerSave.hidden = true;
    if (window.Sky && Sky.pause) Sky.pause(false);
    refresh(true);                                   // 어두운 동안 밀린 화면을 한 번에 갱신
  }

  /* ---------- 공지사항 ----------
     Data.NOTICES 의 최신 id 가 세이브 noticeSeen 보다 크면 📢 에 빨간 점.
     열면 최신 id 를 봤다고 적어 뱃지를 끈다. */
  function latestNoticeId() {
    var m = 0;
    Data.NOTICES.forEach(function (n) { if (n.id > m) m = n.id; });
    return m;
  }
  function updateNoticeBadge() {
    if (el.noticeDot) el.noticeDot.hidden = !(latestNoticeId() > (State.get().noticeSeen || 0));
  }
  function showNotices() {
    var html = '';
    Data.NOTICES.forEach(function (n) {
      html += '<div class="notice-item"><div class="notice-head"><b></b>' +
              '<span class="notice-date"></span></div><p></p></div>';
    });
    el.noticeList.innerHTML = html;
    // 텍스트는 textContent 로 넣어 안전하게 (제목·본문에 사용자 입력은 없지만 습관)
    var items = el.noticeList.children;
    Data.NOTICES.forEach(function (n, i) {
      var it = items[i];
      it.querySelector('b').textContent = n.title;
      it.querySelector('.notice-date').textContent = n.date;
      it.querySelector('p').textContent = n.body;
    });
    el.noticeModal.hidden = false;
    // 봤다고 기록 → 뱃지 끄기
    var s = State.get();
    if (latestNoticeId() > (s.noticeSeen || 0)) { s.noticeSeen = latestNoticeId(); State.save(); }
    updateNoticeBadge();
  }

  /* ---------- 우편함 ----------
     안 읽은 편지(id > mailSeen)나, 아직 안 받은 선물이 있으면 ✉️ 에 빨간 점. */
  function latestMailId() {
    var m = 0;
    Data.MAIL.forEach(function (n) { if (n.id > m) m = n.id; });
    return m;
  }
  function mailHasAlert() {
    var s = State.get();
    if (latestMailId() > (s.mailSeen || 0)) return true;              // 안 읽은 편지
    return Data.MAIL.some(function (m) {                              // 안 받은 선물
      return m.reward && !Game.mailClaimed(m.id);
    });
  }
  function updateMailBadge() {
    if (el.mailDot) el.mailDot.hidden = !mailHasAlert();
  }
  function rewardText(r) {
    var parts = [];
    if (r.gold) parts.push('💰 ' + Fmt.won(r.gold));
    if (r.coupons) parts.push('🎟️ 쿠폰 ' + r.coupons + '장');
    return parts.join(' · ');
  }
  function renderMailList() {
    el.mailList.innerHTML = '';
    Data.MAIL.forEach(function (m) {
      var it = document.createElement('div');
      it.className = 'notice-item mail-item';
      it.innerHTML =
        '<div class="notice-head"><b></b><span class="notice-date"></span></div>' +
        '<div class="mail-from"></div><p></p>';
      it.querySelector('b').textContent = m.title;
      it.querySelector('.notice-date').textContent = m.date;
      it.querySelector('.mail-from').textContent = 'From. ' + m.from;
      it.querySelector('p').textContent = m.body;
      if (m.reward) {
        if (Game.mailClaimed(m.id)) {
          var done = document.createElement('div');
          done.className = 'mail-done';
          done.textContent = '✔ 받았어요 — ' + rewardText(m.reward);
          it.appendChild(done);
        } else {
          var rw = document.createElement('div');
          rw.className = 'mail-reward';
          rw.textContent = '🎁 ' + rewardText(m.reward);
          it.appendChild(rw);
          var btn = document.createElement('button');
          btn.className = 'btn mail-claim';
          btn.type = 'button';
          btn.textContent = '받기';
          btn.addEventListener('click', function () {
            var got = Game.claimMail(m.id);
            if (got) {
              Sound.play('reward');
              toast('🎁 선물을 받았어요! ' + rewardText(got));
              State.save();
              renderMailList();
              updateMailBadge();
              refresh(true);
            }
          });
          it.appendChild(btn);
        }
      }
      el.mailList.appendChild(it);
    });
  }
  function showMail() {
    renderMailList();
    el.mailModal.hidden = false;
    var s = State.get();
    if (latestMailId() > (s.mailSeen || 0)) { s.mailSeen = latestMailId(); State.save(); }
    updateMailBadge();
  }

  /* ---------- 별사탕 상점 ----------
     별사탕(재화)으로 소비 아이템을 산다. 초록(살 수 있음)일 때 오른쪽 값 버튼을
     눌러야 사진다(다른 목록과 같은 규칙). */
  function updateCandy() {
    var c = State.get().candy || 0;
    if (el.candyHud) el.candyHud.textContent = Fmt.comma(c);
    if (el.candyNum) el.candyNum.textContent = Fmt.comma(c);
  }
  function shopBoughtMsg(got) {
    if (got.coupons) return '🎟️ 쿠폰 ' + got.coupons + '장 받았어요';
    if (got.boost) return '📣 ' + Math.round(got.boost.dur / 60) + '분 동안 수익 ×' + got.boost.mult + '!';
    if (got.gold) return '💰 ' + Fmt.won(got.gold) + ' 받았어요';
    if (got.ings) return '📦 재료 ' + got.ings.length + '개를 챙겼어요';
    return '구매 완료!';
  }
  function renderShopList() {
    el.shopList.innerHTML = '';
    var candy = State.get().candy || 0;
    Data.SHOP.forEach(function (it) {
      var row = makeItem(it.icon, { buyBtn: true });
      var p = parts(row);
      p.nm.textContent = it.name;
      p.desc.textContent = it.desc;
      var ok = candy >= it.cost;
      p.cost.innerHTML = '🍬 ' + it.cost;
      p.cost.className = 'item-cost ' + (ok ? 'ok' : 'no');
      row.className = 'item' + (ok ? ' buyable' : '');
      p.cost.addEventListener('click', function () {
        if (!row.classList.contains('buyable')) { toast('별사탕이 부족해요'); return; }
        var got = Game.buyShopItem(it.id);
        if (got) {
          Sound.play('buy');
          toast(shopBoughtMsg(got));
          State.save();
          renderShopList();
          updateCandy();
          refresh(true);
        }
      });
      el.shopList.appendChild(row);
    });
  }
  function showShop() {
    renderShopList();
    updateCandy();
    el.shopModal.hidden = false;
  }

  function floatText(x, y, text) {
    var d = document.createElement('div');
    d.className = 'float';
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    el.tapZone.appendChild(d);
    setTimeout(function () { d.remove(); }, 900);
  }

  function buzz(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  /* ---------- 아이템 행 만들기 ---------- */

  // 원으로 사는 버튼(설비·업그레이드)에 붙이는 작은 ₩ 동전 — 매출 알약과 통일.
  // 초록/어두운 고정색 버튼 위라 금색은 고정으로 둔다(테마와 무관).
  var COST_COIN =
    '<svg class="cost-coin" width="16" height="16" viewBox="0 0 40 40" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="17" fill="#ffce54" stroke="#b9861a" stroke-width="2.5"/>' +
      '<circle cx="20" cy="20" r="12.5" fill="none" stroke="#e0b84a" stroke-width="1.6"/>' +
      '<text x="20" y="27" text-anchor="middle" font-size="17" font-weight="800"' +
        ' fill="#8a6212" font-family="system-ui,-apple-system,sans-serif">₩</text>' +
    '</svg>';

  // 아이콘 값에 '.png' 가 들어 있으면 그림(assets/img/), 아니면 이모지 텍스트.
  function iconIsImg(icon) { return typeof icon === 'string' && icon.indexOf('.png') >= 0; }
  function iconHtml(icon, cls) {
    return iconIsImg(icon)
      ? '<img class="' + (cls || 'ico-img') + '" src="assets/img/' + icon + '" alt="">'
      : (icon || '');
  }
  function setIcon(elm, icon) {
    if (iconIsImg(icon)) elm.innerHTML = iconHtml(icon);
    else elm.textContent = icon;
  }

  function makeItem(iconText, opts) {
    opts = opts || {};
    // 세 종류:
    //  - buyBtn : 행은 div(컨테이너), 오른쪽 .item-cost 만 button — 그 '구매' 버튼만
    //             눌러야 사진다. 행 몸통(이름·설명)을 눌러도 구매되지 않는다.
    //  - static : 보여주기만 하는 행(도전과제) — div, 클릭 없음.
    //  - 기본   : 행 전체가 button (광고 슬롯 등 행 전체가 하나의 동작).
    // div + click 이면 키보드로 못 쓰고 스크린리더가 버튼으로 안 읽으므로,
    // 누를 수 있는 것은 반드시 button 으로 둔다(규칙 11).
    var asButton = !opts.static && !opts.buyBtn;
    var row = document.createElement(asButton ? 'button' : 'div');
    if (asButton) row.type = 'button';
    row.className = 'item';
    var cost = opts.buyBtn
      ? '<button class="item-cost" type="button"></button>'
      : '<div class="item-cost"></div>';
    row.innerHTML =
      '<div class="item-icon"></div>' +
      '<div class="item-body">' +
        '<div class="item-name"><span class="nm"></span><span class="item-lv" hidden></span></div>' +
        '<div class="item-desc"></div>' +
      '</div>' +
      cost;
    setIcon(row.querySelector('.item-icon'), iconText);
    return row;
  }

  function parts(row) {
    return {
      icon: row.querySelector('.item-icon'),
      nm: row.querySelector('.nm'),
      lv: row.querySelector('.item-lv'),
      desc: row.querySelector('.item-desc'),
      cost: row.querySelector('.item-cost')
    };
  }

  /* ---------- 설비 목록 ---------- */

  var genRows = {};

  function buildGenList() {
    el.genList.innerHTML = '';
    genRows = {};
    Data.GENERATORS.forEach(function (g) {
      var row = makeItem(g.icon, { buyBtn: true });
      row.dataset.gen = g.id;
      // 오른쪽 '구매' 버튼만 눌러야 산다 (행 몸통은 클릭해도 아무 일 없음)
      row.querySelector('.item-cost').addEventListener('click', function () { onBuyGen(g.id); });
      el.genList.appendChild(row);
      genRows[g.id] = { row: row, p: parts(row) };
    });
  }

  function visibleGenCount() {
    var last = 0;
    Data.GENERATORS.forEach(function (g, i) {
      if (Game.genUnlocked(g.id)) last = i;
    });
    return Math.min(Data.GENERATORS.length, last + 2); // 다음 설비 1개까지 미리보기
  }

  function amountFor(id) {
    if (buyAmt === 'max') return Math.max(1, Game.maxAffordable(id));
    return buyAmt;
  }

  function updateGenList() {
    var money = State.get().money;
    var visible = visibleGenCount();
    var atCap = Game.atIncomeCap();   // 수익 한계면 설비를 더 사도 안 오른다

    Data.GENERATORS.forEach(function (g, i) {
      var r = genRows[g.id];
      if (!r) return;
      if (i >= visible) { r.row.hidden = true; return; }
      r.row.hidden = false;

      var count = Game.genCount(g.id);
      var unlocked = Game.genUnlocked(g.id);
      var amt = amountFor(g.id);
      var cost = Game.genCost(g.id, amt);
      var canBuy = unlocked && money >= cost && !atCap;
      // 부자일 때 싼/낮은 단계 설비 — 사도 화면 숫자가 안 움직인다.
      // 구매는 막지 않고 힌트만 준다(주력·다음 단계 설비엔 안 뜬다).
      var lowEff = unlocked && !atCap && Game.genBarelyHelps(g.id, amt);

      r.p.nm.textContent = unlocked ? g.name : '???';
      if (count > 0) {
        r.p.lv.hidden = false;
        r.p.lv.textContent = count + '개';
      } else {
        r.p.lv.hidden = true;
      }

      if (!unlocked) {
        r.p.desc.textContent = '이전 설비를 1개 구매하면 열립니다';
      } else if (atCap) {
        r.p.desc.textContent = '🔝 수익이 한계에 도달해 더 사도 오르지 않아요';
      } else if (lowEff) {
        // 한 줄이라 말줄임에 잘리지 않게 짧게 — 긴 수익 문자열은 빼고 힌트만 준다
        r.p.desc.textContent = '💤 지금 사도 수익이 거의 안 올라요';
      } else if (count > 0) {
        r.p.desc.textContent = '초당 ' + Fmt.rate(Game.genRate(g.id)) + '원 (전체의 ' + sharePct(g.id) + ')';
      } else {
        r.p.desc.textContent = g.desc;
      }
      r.row.classList.toggle('loweff', lowEff);

      r.p.cost.innerHTML = COST_COIN + '<span class="cnum">' + Fmt.num(cost) + '<small>' +
        (buyAmt === 'max' ? (canBuy ? '×' + amt : '×1') : '×' + amt) + '</small></span>';
      r.p.cost.className = 'item-cost ' + (canBuy ? 'ok' : 'no');
      r.row.className = 'item' + (canBuy ? ' buyable' : '') + (unlocked ? '' : ' locked');
    });
  }

  function sharePct(id) {
    var total = Game.perSec();
    if (total <= 0) return '0%';
    return Math.round(Game.genRate(id) / total * 100) + '%';
  }

  function onBuyGen(id) {
    if (!Game.genUnlocked(id)) { toast('아직 잠겨 있습니다'); return; }
    if (Game.atIncomeCap()) { toast('🔝 수익이 한계에 도달했어요 — 더 사도 오르지 않아요'); return; }
    // 초록(활성)일 때만 산다 — 화면이 회색이면(돈 부족) 눌러도 안 사진다
    if (genRows[id] && !genRows[id].row.classList.contains('buyable')) { toast('돈이 부족합니다'); return; }
    var amt = amountFor(id);
    if (buyAmt === 'max') {
      amt = Game.maxAffordable(id);
      if (amt < 1) { toast('돈이 부족합니다'); return; }
    }
    var before = Game.couponState().pct;   // 쿠폰을 썼는지·자랐는지 알려주기 위해
    if (Game.buyGen(id, amt)) {
      Sound.play('buy');
      buzz(8);
      var m = couponGrewMsg(before);
      if (m) toast(m);
      refresh(true);
    } else {
      toast('돈이 부족합니다');
    }
  }

  /* ---------- 추천 설비 바 ----------
     "다음에 뭘 사지?"를 없앤다 — 지금 가장 이득인 설비 하나를 원터치로 산다. */
  function updateReco() {
    var b = Game.bestGen();
    if (!b) { el.recoBar.hidden = true; return; }
    el.recoBar.hidden = false;
    setIcon(el.recoIcon, b.icon);
    el.recoName.textContent = b.name;
    el.recoDesc.textContent = '초당 +' + Fmt.num(b.gain);
    el.recoCost.textContent = Fmt.num(b.cost);
    el.recoBar.classList.toggle('ready', b.affordable);
    el.recoBar.classList.toggle('saving', !b.affordable);
  }

  function onBuyBest() {
    var b = Game.bestGen();
    if (!b) return;
    if (!b.affordable) { toast(b.name + ' 까지 조금 더 모아요'); return; }
    if (Game.buyBest()) {
      Sound.play('buy');
      buzz(8);
      toast('✔ ' + b.name + ' 구매!');
      refresh(true);
    } else {
      toast('돈이 부족합니다');
    }
  }

  /* ---------- 업그레이드 목록 ---------- */

  function genNameById(id) {
    for (var i = 0; i < Data.GENERATORS.length; i++) {
      if (Data.GENERATORS[i].id === id) return Data.GENERATORS[i].name;
    }
    return '설비';
  }

  // 잠긴 업그레이드의 해금 조건 문구 (해금됐으면 '')
  function upgradeLockText(u) {
    var s = State.get();
    if (u.needGen && (s.gens[u.needGen.id] || 0) < u.needGen.count) {
      return genNameById(u.needGen.id) + ' ' + u.needGen.count + '개 필요';
    }
    if (u.needTaps && s.taps < u.needTaps) return '조리 ' + Fmt.num(u.needTaps) + '회 필요';
    if (u.needEarned && s.runEarned < u.needEarned) return '이번 판 누적 ' + Fmt.won(u.needEarned) + '원 필요';
    return '';
  }

  function renderUpgrades() {
    // 살 수 있는 것만이 아니라 전체 목록: 해금된 것 위, 잠긴 것은 조건과 함께 아래.
    // (이미 산 것만 제외) — 해금 상태가 바뀌면 다시 그리도록 서명에 포함한다.
    var list = Game.allUpgrades();
    var newSig = list.map(function (u) { return u.id + (Game.upgradeUnlocked(u) ? '1' : '0'); }).join(',');

    if (sig.up !== newSig) {
      sig.up = newSig;
      el.upgradeList.innerHTML = '';
      list.forEach(function (u) {
        var locked = !Game.upgradeUnlocked(u);
        var row = makeItem(u.icon, { buyBtn: true });
        row.dataset.up = u.id;
        var p = parts(row);
        p.nm.textContent = u.name;
        p.desc.textContent = locked ? ('🔒 ' + upgradeLockText(u) + ' · ' + u.desc) : u.desc;
        // 오른쪽 '구매' 버튼만 눌러야 산다 (행 몸통은 클릭해도 아무 일 없음)
        row.querySelector('.item-cost').addEventListener('click', function () {
          if (!Game.upgradeUnlocked(u)) { toast('🔒 ' + upgradeLockText(u)); return; }
          // 초록(활성)일 때만 산다 — 화면이 회색이면(돈 부족) 눌러도 안 사진다.
          // buyable 클래스는 updateUpgrades 가 매 렌더마다 최신으로 갱신한다.
          if (!row.classList.contains('buyable')) { toast('돈이 부족합니다'); return; }
          var before = Game.couponState().pct;
          if (Game.buyUpgrade(u.id)) {
            Sound.play('upgrade');
            buzz(12);
            var m = couponGrewMsg(before);
            toast(m ? (u.name + ' 구매! ' + m) : (u.name + ' 구매!'));
            refresh(true);
          } else {
            toast('돈이 부족합니다');
          }
        });
        el.upgradeList.appendChild(row);
      });
      el.upgradeHint.textContent = list.length
        ? '한 번 사면 영구 적용돼요. 잠긴 것(🔒)은 조건을 채우면 열립니다.'
        : '업그레이드를 모두 구매했어요!';
    }

    var money = State.get().money;
    Array.prototype.forEach.call(el.upgradeList.children, function (row) {
      var u = Game.UP_BY_ID[row.dataset.up];
      if (!u) return;
      var locked = !Game.upgradeUnlocked(u);
      var cost = Game.upgradeCost(u.id);   // 쿠폰 무장 시 할인가
      var ok = !locked && money >= cost;
      var costEl = row.querySelector('.item-cost');
      costEl.innerHTML = COST_COIN + '<span class="cnum">' + Fmt.num(cost) + '</span>';
      costEl.className = 'item-cost ' + (ok ? 'ok' : 'no');
      row.className = 'item' + (ok ? ' buyable' : '') + (locked ? ' locked' : '');
    });
  }

  /* ---------- 명성 상점 ---------- */

  function renderFameShop() {
    var s = State.get();
    var newSig = Data.FAME_SHOP.map(function (f) { return Game.fameLv(f.id); }).join(',');

    if (sig.fame !== newSig) {
      sig.fame = newSig;
      el.fameShopList.innerHTML = '';
      Data.FAME_SHOP.forEach(function (f) {
        var row = makeItem(f.icon, { buyBtn: true });
        row.dataset.fame = f.id;
        var p = parts(row);
        var lv = Game.fameLv(f.id);
        p.nm.textContent = f.name;
        p.lv.hidden = false;
        p.lv.textContent = f.infinite ? ('Lv.' + lv + ' ∞') : ('Lv.' + lv + '/' + f.max);
        p.desc.textContent = f.desc;
        // 오른쪽 '구매' 버튼만 눌러야 산다 (행 몸통은 클릭해도 아무 일 없음)
        row.querySelector('.item-cost').addEventListener('click', function () {
          if (Game.fameLv(f.id) >= f.max) { toast('이미 최대 레벨입니다'); return; }
          // 초록(활성)일 때만 산다 — 화면이 회색이면(명성 부족) 눌러도 안 강화된다
          if (!row.classList.contains('buyable')) { toast('명성이 부족합니다'); return; }
          if (Game.buyFame(f.id)) {
            Sound.play('upgrade');
            buzz(12);
            toast(f.name + ' 강화!');
            refresh(true);
          } else {
            toast('명성이 부족합니다');
          }
        });
        el.fameShopList.appendChild(row);
      });
    }

    Array.prototype.forEach.call(el.fameShopList.children, function (row) {
      var f = Game.FAME_BY_ID[row.dataset.fame];
      if (!f) return;
      var lv = Game.fameLv(f.id);
      var maxed = !f.infinite && lv >= f.max;   // 무한 항목은 MAX 로 안 잠긴다
      var cost = Game.fameCost(f.id, lv);
      var ok = !maxed && s.fame >= cost;
      var costEl = row.querySelector('.item-cost');
      costEl.innerHTML = maxed ? 'MAX' : ('✨' + Fmt.num(cost));
      costEl.className = 'item-cost ' + (maxed ? '' : (ok ? 'ok' : 'no'));
      row.className = 'item' + (ok ? ' buyable' : '') + (maxed ? ' owned' : '');
    });
  }

  /* ---------- 스타 셰프 도전 ---------- */

  function starStr(n) {
    n = Math.max(0, Math.min(5, n));
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function renderMichelin() {
    Game.michSeasonRoll();
    var s = State.get();
    var season = Game.michSeason();
    var grand = Game.michelinGrandDone();
    var rank = Game.michRank(s.michSeasonTaps);
    var mark = season.id + '|' + s.michSeasonStars + '|' + s.michSeasonTaps + '|' +
               s.bestMichelin + '|' + grand;
    if (sig.mich === mark) return;
    sig.mich = mark;

    var board = Game.michBoard().map(function (r) {
      if (r.gap) return '<div class="mb-gap">⋯</div>';
      var medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank + '위';
      return '<div class="mb-row' + (r.me ? ' me' : '') + '">' +
        '<span class="mb-rank">' + medal + '</span>' +
        '<span class="mb-name">' + escape(r.name) + (r.me ? ' <b>나</b>' : '') + '</span></div>';
    }).join('');

    var hist = '';
    if (s.michHist && s.michHist.length) {
      var last = s.michHist[s.michHist.length - 1];
      var lm = parseInt(last.s.split('-')[1], 10);
      hist = '<div class="mich-hist">지난 시즌(' + lm + '월) ' + starStr(last.stars) + '</div>';
    }

    el.michelinCard.innerHTML =
      '<div class="mich-season">🗓️ ' + escape(season.name) + ' 시즌 · ' +
        '<b class="mich-tier">' + (Game.michTier() + 1) + '단계</b></div>' +
      '<div class="mich-goal">별 5개 목표: 제한 ' + Game.michTimeSec() + '초 안에 조리 ' +
        Fmt.comma(Game.michGoals()[4]) + '번</div>' +
      '<div class="mich-card-top">' +
        '<div><div class="mcz-label">이번 시즌 등급</div>' +
          '<div class="mcz-stars">' + starStr(s.michSeasonStars) + '</div>' +
          '<div class="mcz-sub">🍴 전국 ' + Fmt.comma(rank.rank) + '위 · 상위 ' + rank.pct + '%' +
            ' · 통산 ' + starStr(s.bestMichelin) + '</div></div>' +
        '<div class="mich-btns">' +
          '<button class="btn michelin-start" id="michStart">🌟 도전</button>' +
          '<button class="btn michelin-share" id="michShare">📣 자랑</button>' +
        '</div>' +
      '</div>' +
      '<div class="mich-board">' + board + '</div>' +
      hist +
      '<div class="mcz-prize' + (grand ? ' done' : '') + '">' +
        (grand ? '✅ 5성 달성! <b>모든 수익 ×' + Data.MICHELIN.grandMult + '</b> 영구 적용 중'
               : '🏆 별 5개를 채우면 <b>모든 수익 ×' + Data.MICHELIN.grandMult + '</b> 를 영구히 받습니다') +
      '</div>';
    document.getElementById('michStart').addEventListener('click', startMichelin);
    document.getElementById('michShare').addEventListener('click', function () { shareMichelin(); });
  }

  /* ----- 기록 자랑하기 (홍보) ----- */
  function shareMichelin() {
    var s = State.get();
    var season = Game.michSeason();
    var stars = s.michSeasonStars;
    var rank = Game.michRank(s.michSeasonTaps).rank;
    var url = '';
    try { url = location.href; } catch (e) {}
    var text = '🌟 분식집 키우기 · 스타 셰프 도전\n' +
      season.name + ' 시즌 ' + starStr(stars) + ' (별 ' + stars + '개)\n' +
      '전국 셰프 ' + Fmt.comma(rank) + '위! 너도 도전해봐 👉';
    var full = text + (url ? ' ' + url : '');
    var data = { title: '분식집 키우기 · 스타 셰프 도전', text: text };
    if (url) data.url = url;

    // 1순위: 기기 공유 시트 (카톡·인스타·문자 등 다른 앱으로 바로 보내기).
    // 아티팩트 같은 샌드박스나 미지원 브라우저면 복사로 넘어간다.
    var canShare = false;
    try {
      canShare = !!navigator.share && (!navigator.canShare || navigator.canShare(data));
    } catch (e) { canShare = false; }

    if (canShare) {
      var p;
      try { p = navigator.share(data); } catch (e) { copyOrShow(full); return; }
      if (p && p.then) {
        p.then(function () {
          toast('공유했어요! 자랑 고마워요 🙌');
        }, function (err) {
          // 사용자가 공유창을 닫은 것(AbortError)은 조용히 넘기고,
          // 권한이 막힌 경우(NotAllowedError 등)만 복사로 대체한다
          if (err && (err.name === 'AbortError' || err.name === 'CanceledError')) return;
          copyOrShow(full);
        });
      }
      return;
    }
    copyOrShow(full);
  }

  function copyOrShow(full) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(function () {
        toast('자랑 문구를 복사했어요! 붙여넣어 홍보하세요');
      }, function () { showShareText(full); });
    } else {
      showShareText(full);
    }
  }
  function showShareText(full) {
    textDialog({ emoji: '📣', title: '기록 자랑하기',
      desc: '이 문구를 복사해 친구에게 붙여넣어 자랑하세요!', value: full, readonly: true });
  }

  // ----- 심사 진행 -----
  var michRun = null;   // { taps, left, timer }

  function startMichelin() {
    Sound.wake();
    michRun = { taps: 0, left: Game.michTimeSec(), total: Game.michTimeSec(), last: State.now() };
    el.michResult.hidden = true;
    el.michPlay.hidden = false;
    el.michTapEmoji.textContent = Game.tapStep().step.icon || '🍢';
    paintMichelin();
    el.michelinModal.hidden = false;
    if (michRun.timer) clearInterval(michRun.timer);
    michRun.timer = setInterval(michTick, 100);
  }

  function michTick() {
    if (!michRun) return;
    var now = State.now();
    michRun.left -= (now - michRun.last) / 1000;
    michRun.last = now;
    if (michRun.left <= 0) { michRun.left = 0; paintMichelin(); endMichelin(); return; }
    paintMichelin();
  }

  function paintMichelin() {
    if (!michRun) return;
    var stars = Game.michelinStars(michRun.taps);
    var next = Game.michelinNextGoal(michRun.taps);
    el.michStars.textContent = starStr(stars);
    el.michCount.textContent = michRun.taps;
    el.michNext.textContent = next ? '다음 별까지 ' + Math.max(0, next - michRun.taps) + '번' : '⭐ 만점!';
    el.michTime.textContent = Math.ceil(michRun.left) + 's';
    el.michBar.style.width = (michRun.left / michRun.total * 100) + '%';
  }

  function michTapPress(ev) {
    if (!michRun || michRun.left <= 0) return;
    ev.preventDefault();
    var pt = (ev.touches && ev.touches[0]) || ev;
    var res = michTapFn(ev.isTrusted !== false,
      typeof pt.clientX === 'number' ? pt.clientX : undefined,
      typeof pt.clientX === 'number' ? pt.clientY : undefined);
    if (res.blocked) { showBlocked(res.blocked); return; }
    michRun.taps++;
    var before = el.michStars.textContent;
    paintMichelin();
    // 별이 하나 올라가면 소리·연출
    if (el.michStars.textContent !== before && el.michStars.textContent.indexOf('★') >= 0) {
      Sound.play('levelup'); buzz(20);
    } else {
      Sound.play('tap', Game.comboCount());
    }
    el.michTap.classList.add('hit');
    setTimeout(function () { el.michTap.classList.remove('hit'); }, 70);
  }

  function endMichelin() {
    if (michRun && michRun.timer) clearInterval(michRun.timer);
    var taps = michRun ? michRun.taps : 0;
    var r = Game.claimMichelin(taps);
    michRun = null;
    el.michPlay.hidden = true;
    el.michResult.hidden = false;
    el.michResultStars.textContent = starStr(r.stars);
    el.michResultEmoji.textContent = r.stars >= 5 ? '🏆' : r.stars > 0 ? '🎉' : '😢';
    var txt = r.stars > 0
      ? '별 <b>' + r.stars + '개</b> · ' + Fmt.won(r.gain) + ' 획득!'
      : '별을 하나도 못 얻었어요. 다시 도전해 보세요!';
    if (r.grandNew) txt += '<br><span class="mich-grand">🏆 별 5개 만점! 모든 수익 ×' +
      Data.MICHELIN.grandMult + ' 영구 획득!</span>';
    if (r.tierUp) txt += '<br><span class="mich-tierup">🔥 ' + r.tierUp +
      '단계 돌파! 다음 도전은 조리 ' + Fmt.comma(Game.michGoals()[4]) + '번으로 더 어려워집니다</span>';
    el.michResultText.innerHTML = txt;
    if (r.grandNew) { Sound.play('prestige'); }
    else if (r.stars > 0) { Sound.play('reward'); }
    sig.mich = '';
  }

  function quitMichelin() {
    // 그만두면 그때까지의 별로 정산한다 (딴 별은 아깝지 않게)
    endMichelin();
  }

  function closeMichelinResult() {
    el.michelinModal.hidden = true;
    Game.invalidate();
    UI.invalidate && UI.invalidate();
    announceMichelinAchv();
    State.save();
    refresh(true);
  }

  function announceMichelinAchv() {
    var got = Game.checkAchievements();
    if (got.length) { Sound.play('achv'); toast('🏆 ' + got[0].name + ' 달성!'); }
  }

  /* ---------- 주말 파티 도감 ---------- */

  /* ---------- 주말 파티 도감 ---------- */

  function renderPartyDex() {
    var got = Game.partyGotCount();
    var all = Game.partyFoodsAll();
    var ps = Game.partyState();
    var mark = got + '|' + (ps.active ? 'on' : 'off');
    if (sig.partydex === mark) { updateDexHint(ps, got, all.length); return; }
    sig.partydex = mark;

    el.partyDex.innerHTML =
      '<div class="dex-head">' +
        '<b>' + got + ' / ' + all.length + '</b>' +
        '<span>모으면 모든 수익 +' + Math.round(got * Data.PARTY.dexBonus * 100) + '%</span>' +
      '</div>' +
      '<div class="dex-grid">' +
        all.map(function (f) {
          var mine = Game.partyGot(f.id);
          return '<div class="dex-cell' + (mine ? ' got' : '') + '" title="' +
            (mine ? f.name : '???') + '">' +
            '<span class="dex-ic">' + (mine ? iconHtml(f.icon) : '❔') + '</span>' +
            '<span class="dex-nm">' + (mine ? f.name : '???') + '</span></div>';
        }).join('') +
      '</div>';
    updateDexHint(ps, got, all.length);
  }

  function updateDexHint(ps, got, total) {
    if (ps.active) {
      el.partyHint.innerHTML = '🎉 <b>지금 파티 중!</b> 조리하면 새 음식을 발견합니다. (남은 ' +
        fmtClock(ps.left) + ')';
    } else if (got >= total) {
      el.partyHint.textContent = '도감을 다 채웠습니다! 파티가 열리면 또 놀러 오세요.';
    } else {
      el.partyHint.innerHTML = '금·토 저녁 5시~자정에 파티가 열립니다. 다음 파티까지 <b>' +
        fmtClock(ps.until) + '</b>.';
    }
  }

  /* ---------- 전국 맛집 랭킹 ---------- */

  function renderRanking() {
    var nat = Game.nationRank();
    var reg = Game.regionRank();
    var mark = reg.region.id + '|' + reg.rank + '|' + nat.rank;
    if (sig.rank === mark) return;
    sig.rank = mark;

    el.rankRegion.textContent = reg.region.name;

    // 위쪽 요약 — 전국 / 지역 순위. 지역은 '작은 연못'이라 1위·상위권에 먼저 닿는다.
    var regSub = reg.rank === 1 ? '🥇 우리 지역 1위'
               : reg.rank <= 3 ? '🏅 지역 상위권'
               : reg.region.name + ' 안에서';
    el.rankHeads.innerHTML =
      head('전국', '🇰🇷', nat.rank, nat.total, '상위 ' + nat.pct + '%', false) +
      head(reg.region.name, '📍', reg.rank, reg.total, regSub, reg.rank <= 3);

    function head(label, ic, rank, total, sub, hot) {
      return '<div class="rank-head' + (hot ? ' hot' : '') + '">' +
        '<div class="rh-top">' + ic + ' ' + label + '</div>' +
        '<div class="rh-rank"><b>' + Fmt.comma(rank) + '</b><span>위</span></div>' +
        '<div class="rh-sub">' + sub + ' · ' + Fmt.comma(total) + '곳</div>' +
        '</div>';
    }

    // 리더보드
    el.rankBoard.innerHTML = '';
    Game.rankBoard().forEach(function (r) {
      var row = document.createElement('div');
      if (r.gap) {
        row.className = 'rb-gap';
        row.textContent = '⋯';
        el.rankBoard.appendChild(row);
        return;
      }
      row.className = 'rb-row' + (r.me ? ' me' : '') + (r.rank <= 3 ? ' top' : '');
      var medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '';
      row.innerHTML =
        '<span class="rb-rank">' + (medal || r.rank) + '</span>' +
        '<span class="rb-name">' + escape(r.name) + (r.me ? ' <b>내 가게</b>' : '') + '</span>' +
        '<span class="rb-pop">🔥 ' + Fmt.comma(r.pop) + '</span>';
      el.rankBoard.appendChild(row);
    });
  }

  function escape(t) {
    return String(t).replace(/[&<>]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
    });
  }

  /* ---------- 명예의 전당 ---------- */

  function renderHallOfFame() {
    var s = State.get();

    el.recordBox.innerHTML = Game.records().map(function (r) {
      return '<div class="rec"><span class="rec-ic">' + iconHtml(r.icon) + '</span>' +
             '<span class="rec-nm">' + r.name + '</span>' +
             '<span class="rec-v">' + r.value + '</span></div>';
    }).join('');

    var runs = Game.topRuns(10);
    if (!runs.length) {
      el.runBoard.innerHTML =
        '<p class="hint small center" style="margin:6px 0">아직 재개업한 적이 없습니다.<br>' +
        '첫 재개업을 마치면 이곳에 회차 기록이 쌓입니다.</p>';
    } else {
      el.runBoard.innerHTML =
        '<div class="run-row run-head"><span>순위</span><span>회차</span>' +
        '<span>매출</span><span>명성</span><span>소요</span></div>' +
        runs.map(function (r, i) {
          var medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
          return '<div class="run-row' + (i < 3 ? ' top' : '') + '">' +
                 '<span class="run-rank">' + medal + '</span>' +
                 '<span>' + r.n + '회</span>' +
                 '<span>' + Fmt.won(r.earned) + '</span>' +
                 '<span class="run-fame">✨' + Fmt.num(r.fame) + '</span>' +
                 '<span>' + Fmt.time(r.seconds) + '</span></div>';
        }).join('');
    }

    // 지금 환생하면 몇 위인가 — 환생을 미룰지 말지 판단하게 해준다
    var rank = Game.projectedRank();
    if (rank > 0) {
      el.rankNote.textContent = '지금 재개업하면 ' + rank + '위';
      el.rankNote.className = 'rank-note' + (rank <= 3 ? ' hot' : '');
    } else {
      el.rankNote.textContent = '';
      el.rankNote.className = 'rank-note';
    }
  }

  /* ---------- 오늘의 퀘스트 ---------- */

  /** 진행도 막대 하나 */
  function questBar(ratio) {
    var b = document.createElement('div');
    b.className = 'qbar';
    var i = document.createElement('i');
    i.style.width = Math.round(Math.min(1, ratio) * 100) + '%';
    b.appendChild(i);
    return b;
  }

  function questRow(o) {
    // 받을 수 있을 때만 누를 수 있다 — 그 외에는 보여주기만 하는 행
    var row = makeItem(o.icon, { static: !o.claim });
    var p = parts(row);
    p.nm.textContent = o.name;
    p.desc.textContent = o.sub;
    p.desc.appendChild(questBar(o.ratio));
    row.className = 'item quest' + (o.taken ? ' quest-taken' : (o.claim ? ' quest-ready' : ''));
    p.cost.innerHTML = o.taken ? '<span class="achv-check">✔</span>'
                      : (o.claim ? '<span class="quest-get">받기</span>'
                                 : '<small>' + o.right + '</small>');
    if (o.claim) row.addEventListener('click', o.onClaim);
    return row;
  }

  function renderQuests() {
    var s = State.get();
    var list = Game.quests();
    var all = Game.questAllDone();
    var mark = s.questDate + '|' + s.questAllTaken + '|' + list.map(function (q) {
      return q.prog + '/' + q.goal + (q.taken ? 't' : '');
    }).join(',');
    if (sig.quest === mark) return;
    sig.quest = mark;

    el.questList.innerHTML = '';
    list.forEach(function (q) {
      el.questList.appendChild(questRow({
        icon: q.def.icon,
        name: q.name,
        sub: q.taken ? '보상을 받았습니다'
                     : Fmt.num(q.prog) + ' / ' + Fmt.num(q.goal),
        right: Math.floor(q.prog / q.goal * 100) + '%',
        ratio: q.prog / q.goal,
        taken: q.taken,
        claim: q.done && !q.taken,
        onClaim: function () {
          var r = Game.claimQuest(q.index);
          if (!r) return;
          Sound.play('reward');
          toast('📋 ' + r.name + ' 완료 · ' + Fmt.won(r.gain));
          sig.quest = '';
          refresh(true);
        }
      }));
    });

    // 넷째 줄 — 셋 다 끝냈을 때의 보너스
    var doneN = list.filter(function (q) { return q.taken; }).length;
    el.questList.appendChild(questRow({
      icon: '🎁',
      name: '오늘 퀘스트 완주',
      sub: s.questAllTaken ? '보상을 받았습니다' : doneN + ' / ' + list.length,
      right: Math.floor(doneN / Math.max(1, list.length) * 100) + '%',
      ratio: doneN / Math.max(1, list.length),
      taken: !!s.questAllTaken,
      claim: all && !s.questAllTaken,
      onClaim: function () {
        var r = Game.claimQuestAll();
        if (!r) return;
        Sound.play('levelup');
        toast('🎁 완주 보너스 ' + Fmt.won(r.gain) + (r.boost ? ' · 손님 몰이 충전!' : ''));
        sig.quest = '';
        refresh(true);
      }
    }));
  }

  /* ---------- 🎁 무료 보상 (광고) ---------- */

  function renderAds() {
    var slots = Game.adSlots();
    var mark = slots.map(function (a) { return a.left; }).join(',');
    if (sig.ad === mark) return;   // 남은 횟수가 바뀔 때만 다시 그린다
    sig.ad = mark;

    el.adCard.innerHTML = slots.map(function (a) {
      var out = a.left <= 0;
      return '<button type="button" class="ad-slot' + (out ? ' out' : '') + '" data-ad="' + a.def.id + '"' +
        (out ? ' disabled' : '') + '>' +
        '<span class="ad-ic">' + iconHtml(a.def.icon) + '</span>' +
        '<span class="ad-tx"><b>' + a.def.name + '</b><small>' + a.def.desc + '</small></span>' +
        '<span class="ad-left">' + (out ? '내일 다시' : '▶ ' + a.left + '/' + a.max) + '</span>' +
        '</button>';
    }).join('');
    Array.prototype.forEach.call(el.adCard.querySelectorAll('.ad-slot'), function (btn) {
      btn.addEventListener('click', function () { openAd(btn.dataset.ad); });
    });
  }

  // 광고 시청(30초 시뮬). adRun 이 있으면 시청 중.
  var adRun = null;   // { id, left, timer }

  function paintAd() {
    if (!adRun) return;
    var def = null, slots = Data.ADS.slots;
    for (var i = 0; i < slots.length; i++) if (slots[i].id === adRun.id) def = slots[i];
    setIcon(el.adEmoji, def ? def.icon : '📺');
    el.adCount.textContent = adRun.left;
    var pct = (1 - adRun.left / Data.ADS.watchSec) * 100;
    el.adBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  function openAd(id) {
    if (adRun) return;                       // 이미 보는 중
    if (Game.adLeft(id) <= 0) { toast('오늘은 다 봤어요 — 내일 다시 오세요'); return; }
    adRun = { id: id, left: Data.ADS.watchSec, timer: null };
    paintAd();
    el.adNote.textContent = '잠시만요 — 광고가 끝나면 보상을 드려요';
    el.adModal.hidden = false;
    adRun.timer = setInterval(function () {
      adRun.left -= 1;
      if (adRun.left <= 0) finishAd();
      else paintAd();
    }, 1000);
  }

  function closeAd() {
    if (adRun && adRun.timer) clearInterval(adRun.timer);
    adRun = null;
    el.adModal.hidden = true;
  }

  function finishAd() {
    var id = adRun ? adRun.id : null;
    closeAd();
    if (!id) return;
    var r = Game.claimAd(id);
    if (!r) return;
    if (r.full) { toast('🎟️ 쿠폰이 이미 꽉 찼어요 (횟수는 그대로예요)'); refresh(true); return; }
    Sound.play('reward');
    buzz(14);
    var msg = '🎁 ';
    if (r.gold != null) msg += r.slot.name + ' · ' + Fmt.won(r.gold);
    else if (r.boost) msg += '수익 ×' + r.boost.mult + ' · ' + Fmt.time(r.boost.dur) + ' 발동!';
    else if (r.coupon) msg += '🎟️ 할인 쿠폰 1장 획득!';
    else if (r.ings) msg += '🚚 재료 ' + r.ings.length + '개 획득!';
    else msg += r.slot.name;
    toast(msg);
    sig.ad = '';   // 남은 횟수 갱신
    refresh(true);
  }

  /* ---------- 도전과제 ---------- */

  var achvRows = {};   // 잠긴 항목의 진행도 막대를 매번 갱신하려고 참조를 들고 있는다

  function achvNum(v, fmt) {
    if (fmt === 'time') return Fmt.time(Math.floor(v));
    if (fmt === 'num') return Fmt.num(v);
    return Fmt.comma(Math.floor(v));
  }

  function renderAchievements() {
    var s = State.get();
    var done = Object.keys(s.achievements).length;

    // 달성 개수가 바뀌면 목록을 새로 짓는다 (미달성=행, 달성=폴더로 모음)
    if (sig.achv !== done) {
      sig.achv = done;
      el.achvList.innerHTML = '';
      achvRows = {};
      var earned = [];
      Data.ACHIEVEMENTS.forEach(function (a) {
        if (s.achievements[a.id]) { earned.push(a); return; }
        // 미달성: 진행도(1,538 / 10,000)와 막대를 보여준다
        var row = makeItem('🔒', { static: true });
        var p = parts(row);
        p.nm.textContent = a.name;
        p.desc.textContent = a.desc;
        var bar = document.createElement('div');
        bar.className = 'qbar';
        bar.innerHTML = '<i></i>';
        p.desc.appendChild(bar);
        p.cost.innerHTML = '<span class="achv-prog"></span>';
        row.className = 'item achv-locked';
        achvRows[a.id] = { def: a, bar: bar.firstChild, txt: p.cost.firstChild };
        el.achvList.appendChild(row);
      });

      // 달성한 도전과제는 폴더에 모은다 — 아이콘을 누르면 무엇인지 뜬다
      if (earned.length) {
        var folder = document.createElement('div');
        folder.className = 'achv-folder';
        folder.innerHTML = '<div class="achv-folder-head"><span>🗂 달성한 도전과제</span>' +
          '<b>' + earned.length + ' / ' + Data.ACHIEVEMENTS.length + '</b></div>' +
          '<div class="achv-grid"></div>';
        var grid = folder.querySelector('.achv-grid');
        earned.forEach(function (a) {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'achv-chip';
          chip.textContent = a.icon;
          chip.setAttribute('aria-label', a.name + ' · 달성 완료');
          chip.addEventListener('click', function () {
            ask({ emoji: a.icon, title: a.name,
                  text: a.desc + '<br><span class="achv-earned">✔ 달성 완료 · 모든 수익 +1%</span>',
                  ok: '닫기', oneButton: true }, function () {});
          });
          grid.appendChild(chip);
        });
        el.achvList.appendChild(folder);
      }
    }

    // 잠긴 항목의 진행도는 값이 바뀌니 매번 갱신한다
    Object.keys(achvRows).forEach(function (id) {
      var r = achvRows[id];
      var pr = r.def.prog(s);
      var cur = Math.min(pr.cur, pr.goal);
      r.bar.style.width = Math.round(Math.min(1, pr.cur / pr.goal) * 100) + '%';
      r.txt.textContent = achvNum(cur, r.def.fmt) + ' / ' + achvNum(pr.goal, r.def.fmt);
    });
  }

  /* ---------- 🍳 주방 (재료 · 합성 · 레시피 · 도감) ---------- */

  var ING_BY_ID = {}; Data.KITCHEN.ings.forEach(function (g) { ING_BY_ID[g.id] = g; });
  var FOOD_BY_ID_U = {}; Data.KITCHEN.foods.forEach(function (f) { FOOD_BY_ID_U[f.id] = f; });
  var kitchenCells = {};

  function renderIngStore() {
    if (!el.ingStore.firstChild) {
      el.ingStore.innerHTML = Data.KITCHEN.ings.map(function (g) {
        return '<div class="ing" data-ing="' + g.id + '"><span class="ing-ic">' + iconHtml(g.icon) +
               '</span><span class="ing-n">0</span></div>';
      }).join('');
    }
    Data.KITCHEN.ings.forEach(function (g) {
      var n = el.ingStore.querySelector('[data-ing="' + g.id + '"] .ing-n');
      if (n) n.textContent = Fmt.comma(Game.ingCount(g.id));
    });
  }

  /** 도감 배율 % 를 보기 좋게 (정수면 정수, 아니면 소수 첫째 자리) */
  function foodPctStr(x) { var v = Math.round(x * 1000) / 10; return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1); }
  function masteryStr(tier) { return '★★★'.slice(0, tier) + '☆☆☆'.slice(0, 3 - tier); }
  /** 누적 제작 안내: '제작 52 · ★★★까지 200' / 최고면 '제작 250 · 숙련 최고 ★★★' */
  function masteryHint(count) {
    var steps = Data.KITCHEN.mastery.steps, tier = Game.masteryTier(count);
    if (tier >= steps.length) return '제작 ' + Fmt.comma(count) + ' · 숙련 최고 ★★★';
    return '제작 ' + Fmt.comma(count) + ' · ' + masteryStr(tier + 1) + '까지 ' + Fmt.comma(steps[tier]);
  }

  function gradeName(g) {
    var e = Data.KITCHEN.grades.filter(function (x) { return x.g === g; })[0];
    return e ? e.name : '';
  }
  function needTotal(f) { var t = 0; for (var k in f.need) t += f.need[k]; return t; }
  // 등급 배지: '고급 효과 ×3' — 재료를 더 쓰는 대신 효과가 크다는 걸 정면에 보인다
  function gradeBadge(f) {
    return '<span class="kf-grade g' + f.grade + '">' + gradeName(f.grade) +
           ' 효과 ×' + Game.gradeMult(f.grade) + '</span>';
  }

  function buildKitchenGrid() {
    el.kitchenGrid.innerHTML = '';
    kitchenCells = {};
    var sp = Game.specialToday();
    var specialId = sp ? sp.food.id : '';
    Data.KITCHEN.foods.filter(function (f) { return f.grade === currentGrade; }).forEach(function (f) {
      var unlocked = Game.recipeUnlocked(f);
      var count = Game.foodMade(f.id);
      var made = count >= 1;
      var isSpecial = f.id === specialId;
      var cell = document.createElement('div');
      cell.className = 'kfood' + (unlocked ? '' : ' locked') + (made ? ' done' : '') + (isSpecial ? ' special' : '');
      if (!unlocked) {
        var lockTxt;
        if (!Game.gradeUnlocked(f.grade)) {
          // 아래 등급 도감을 다 채워야 열리는 경우 — 진행도까지 보여준다
          var gp = Game.gradeProgress(f.grade - 1);
          lockTxt = '🔒 ' + gradeName(f.grade - 1) + ' 도감 ' + gp.made + '/' + gp.total +
                    ' 을 채우면 해금 · 재료 ' + needTotal(f) + '개';
        } else {
          lockTxt = '사장 Lv.' + f.at + ' 에 레시피 해금 · 재료 ' + needTotal(f) + '개';
        }
        cell.innerHTML = '<div class="kf-head"><span class="kf-icon">❓</span>' +
          '<span class="kf-name">??? 미발견</span>' + gradeBadge(f) + '</div>' +
          '<div class="kf-lock">' + lockTxt + '</div>';
      } else {
        var needHtml = Object.keys(f.need).map(function (k) {
          return '<span class="need" data-need="' + k + '"><span class="need-ic">' + iconHtml(ING_BY_ID[k].icon) +
                 '</span><b class="need-c">0</b><span class="need-max">/' + f.need[k] + '</span></span>';
        }).join('');
        var tier = Game.masteryTier(count);
        cell.innerHTML =
          '<div class="kf-head"><span class="kf-icon">' + iconHtml(f.icon) + '</span>' +
            '<span class="kf-name">' + f.name + '</span>' +
            gradeBadge(f) +
            (isSpecial ? '<span class="kf-special">⭐특선</span>' : '') +
            (made ? '<span class="kf-badge">' + (tier > 0 ? masteryStr(tier) + ' ' : '✔ ') +
                    '+' + foodPctStr(Game.foodEffBonus(f)) + '%</span>' : '') + '</div>' +
          '<div class="kf-need"><span class="need-total">🧺 재료 ' + needTotal(f) + '</span>' + needHtml + '</div>' +
          (made ? '<div class="kf-mastery">' + masteryHint(count) + '</div>' : '') +
          '<button type="button" class="kf-craft" data-food="' + f.id + '">합성' +
            (isSpecial ? ' <b>×' + sp.mult + '</b>' : '') + '</button>';
        cell.querySelector('.kf-craft').addEventListener('click', function () { onCraft(f.id); });
      }
      el.kitchenGrid.appendChild(cell);
      kitchenCells[f.id] = cell;
    });
  }

  function updateKitchenGrid() {
    Object.keys(kitchenCells).forEach(function (id) {
      var f = FOOD_BY_ID_U[id];
      if (!Game.recipeUnlocked(f)) return;
      var cell = kitchenCells[id];
      Object.keys(f.need).forEach(function (k) {
        var wrap = cell.querySelector('[data-need="' + k + '"]');
        if (!wrap) return;
        var have = Game.ingCount(k);
        wrap.querySelector('.need-c').textContent = have;
        wrap.classList.toggle('short', have < f.need[k]);
      });
      // 누적 제작 안내는 만들 때마다 바뀌므로 매번 갱신 (별 등급 상승은 sig 로 다시 그린다)
      var mel = cell.querySelector('.kf-mastery');
      if (mel) mel.textContent = masteryHint(Game.foodMade(id));
      var btn = cell.querySelector('.kf-craft');
      if (btn) { var ok = Game.canCraft(id); btn.disabled = !ok; btn.classList.toggle('ready', ok); }
    });
  }

  function renderSpecial() {
    var sp = Game.specialToday();
    // 매 프레임 innerHTML 을 다시 쓰지 않는다 — 바뀐 게 있을 때만 그린다(DOM churn 방지)
    var ssig = sp ? (sp.food.id + '|' + sp.prog + '|' + (sp.taken ? 't' : sp.done ? 'd' : 'p')) : 'none';
    if (sig.special === ssig) return;
    sig.special = ssig;
    if (!sp) { el.specialCard.hidden = true; return; }
    el.specialCard.hidden = false;
    el.specialCard.classList.toggle('ready', sp.done && !sp.taken);
    var right = sp.taken ? '<span class="sp-done">보상 완료 ✔</span>'
              : sp.done ? '<span class="sp-claim">단골 보상 받기</span>'
              : '<span class="sp-prog">단골 주문 ' + sp.prog + '/' + sp.goal + '</span>';
    el.specialCard.innerHTML =
      '<div class="sp-left"><span class="sp-ic">' + iconHtml(sp.food.icon) + '</span>' +
        '<div class="sp-txt"><b>오늘의 특선 · ' + sp.food.name + '</b>' +
        '<span>만들 때 목돈 ×' + sp.mult + ' · ' + sp.goal + '번 만들면 단골 보상</span></div></div>' +
      '<div class="sp-right">' + right + '</div>';
  }

  function dexChip(short, o) {
    return '<span class="dex-chip' + (o.done ? ' done' : '') + '">' +
           short + ' ' + (o.done ? '✓' : o.made + '/' + o.total) + '</span>';
  }

  /** 🏅 도감 컬렉션 진행/보상 카드 — 발견·숙련 세트와 지금까지 번 영구 배율을 보여준다 */
  function updateDexCollection() {
    var c = Game.collectionStatus();
    // 주방 초입(아무것도 발견 못 함)엔 굳이 안 띄운다
    if (!c.discover.some(function (d) { return d.made > 0; })) {
      el.dexCollection.hidden = true; sig.dexCol = 'none'; return;
    }
    var dsig = c.mult + '|' +
      c.discover.map(function (d) { return d.made + '/' + d.total; }).join(',') + '|' +
      c.master.map(function (m) { return m.made + '/' + m.total; }).join(',');
    if (sig.dexCol === dsig) return;
    sig.dexCol = dsig;
    el.dexCollection.hidden = false;
    var names = ['초', '중', '고'];
    function row(label, arr, all, allIcon) {
      var chips = arr.map(function (o, i) { return dexChip(names[i], o); }).join('');
      chips += '<span class="dex-chip all' + (all.done ? ' done' : '') + '">' + allIcon + ' 전종</span>';
      return '<div class="dex-col-row"><span class="dex-col-label">' + label + '</span>' + chips + '</div>';
    }
    var stars = '★'.repeat(Game.masterSetTier());   // 숙련 세트 완성 기준 별 (지금은 ★★)
    var allDone = c.discoverAll.done && c.masterAll.done;
    el.dexCollection.innerHTML =
      '<div class="dex-col-head"><b>🏅 도감 컬렉션</b>' +
        '<span class="dex-col-mult">전체 수익 ×' + c.mult.toFixed(2) + '</span></div>' +
      row('발견', c.discover, c.discoverAll, '🏅') +
      row('숙련' + stars, c.master, c.masterAll, '👑') +
      (allDone ? '<p class="dex-col-hint done">🎉 도감 완전 정복! 최대 보상을 받고 있어요.</p>'
               : '<p class="dex-col-hint">등급을 <b>다 발견</b>하거나 <b>모두 ' + stars + '</b>로 만들면 전체 수익이 영구히 올라요.</p>');
  }

  function renderKitchen() {
    renderIngStore();
    renderSpecial();
    updateCraftReco();
    updateDexCollection();
    var sp = Game.specialToday();
    // 제작 여부(0/1) + 숙련 등급을 함께 서명에 넣는다 — 첫 제작(0→1)이 곧 등급 해금·도감 배지로
    // 이어지므로, 숙련 문턱을 아직 안 넘었어도 그리드를 다시 그려야 한다.
    var tiers = Data.KITCHEN.foods.map(function (f) {
      var c = Game.foodMade(f.id);
      return (c >= 1 ? '1' : '0') + Game.masteryTier(c);
    }).join('');
    var gsig = currentGrade + '|' + Game.bossLevel() + '|' + tiers + '|' + (sp ? sp.food.id : '');
    if (sig.kitchen !== gsig) { sig.kitchen = gsig; buildKitchenGrid(); }
    updateKitchenGrid();
  }

  /* ---------- 🍳 주방 상단 추천 ("지금 만들 수 있어요") ----------
     재료가 다 모인 것 중 가장 이득인 음식 하나를 맨 위에서 원터치로 만든다.
     아무것도 못 만들면 숨긴다. 우선순위(첫 발견>숙련>특선>목돈)에 따라 안내가 바뀐다. */
  function updateCraftReco() {
    if (!el.craftReco) return;
    var b = Game.bestCraft();
    if (!b) { el.craftReco.hidden = true; return; }
    el.craftReco.hidden = false;
    setIcon(el.craftRecoIcon, b.food.icon);
    el.craftRecoName.textContent = b.food.name;
    el.craftRecoTag.textContent =
      b.first   ? '🎉 새 음식 발견!' :
      b.tierUp  ? '🌟 숙련 별이 오를 차례!' :
      b.special ? '⭐ 오늘의 특선' :
                  '✔ 지금 만들 수 있어요';
    el.craftRecoDesc.textContent = '목돈 +' + Fmt.won(b.gain);
  }

  function onCraft(id) {
    var r = Game.craftFood(id);
    if (!r) { toast('재료가 부족해요'); return; }
    Sound.play(r.first || r.tierUp ? 'levelup' : 'buy');
    buzz(r.tierUp ? 16 : 12);
    if (r.tierUp) {
      toast('🌟 ' + r.food.name + ' 숙련 ' + masteryStr(r.tier) + ' 달성! +' + Fmt.won(r.gain));
    } else {
      toast((r.first ? '🎉 새 음식 발견! ' : (r.special ? '⭐ ' : '🍳 ')) + r.food.name + '  +' + Fmt.won(r.gain));
    }
    if (r.first || r.tierUp) sig.kitchen = '';   // 도감 등록·숙련 상승 → 구조 다시 그림
    refresh(true);
  }

  /** 단골 주문 보상 수령 (특선 배너 탭) */
  function onSpecialClaim() {
    var r = Game.claimSpecialOrder();
    if (!r) return;
    Sound.play('reward');
    buzz(14);
    toast('🧑‍🍳 단골 주문 완료! ' + r.food.name + '  +' + Fmt.won(r.gain));
    refresh(true);
  }

  function updateTruck() {
    var here = Game.truckState().here;
    if (el.truckPop.hidden !== !here) el.truckPop.hidden = !here;
    // 주방 탭 점: 트럭이 왔거나 · 합성 가능한 게 있거나 · 단골 주문 보상이 대기 중이면
    var any = here;
    if (!any) for (var i = 0; i < Data.KITCHEN.foods.length; i++) {
      if (Game.canCraft(Data.KITCHEN.foods[i].id)) { any = true; break; }
    }
    if (!any) { var sp = Game.specialToday(); if (sp && sp.done && !sp.taken) any = true; }
    el.dotKitchen.hidden = !any;
  }

  function grabTruckUI() {
    var res = Game.grabTruck();
    el.truckPop.hidden = true;
    if (!res) return;
    var got = res.ings || [];
    // 재료 아이콘이 그림이라 토스트엔 이름으로 보여준다 (중복 제거)
    var names = got.map(function (g) { return g.name; });
    var uniq = names.filter(function (n, i) { return names.indexOf(n) === i; });
    var msg = got.length ? ('🚚 재료 +' + got.length + ' (' + uniq.join(', ') + ')') : '';
    if (res.coupon) msg += (msg ? ' · ' : '') + '🎟️ 할인 쿠폰!';
    if (msg) { Sound.play('buy'); buzz(res.coupon ? 14 : 8); toast(msg); }
    if (res.coupon || currentTab === 'kitchen') refresh(true);  // 쿠폰 바 갱신
  }

  /* ---------- 환생 화면 ---------- */

  /* ---------- 사장님 선택 (남/여) ---------- */
  function renderOwnerPick() {
    var cur = Game.ownerSex();
    var stageKey = Game.ownerStage().key;
    el.ownerSexNow.textContent = cur === 'male' ? '남자 사장' : '여자 사장';
    var osig = cur + '|' + stageKey;   // 성별·단계가 바뀔 때만 다시 그린다
    if (sig.owner === osig) return;
    sig.owner = osig;
    el.ownerPick.innerHTML = Data.OWNER.sexes.map(function (sx) {
      return '<button type="button" class="owner-card' + (sx.id === cur ? ' on' : '') + '" data-sex="' + sx.id + '">' +
        '<img src="assets/img/owner/owner_' + sx.id + '_' + stageKey + '.png" alt="">' +
        '<span>' + sx.name + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(el.ownerPick.querySelectorAll('.owner-card'), function (btn) {
      btn.addEventListener('click', function () {
        if (Game.setOwnerSex(btn.dataset.sex)) {
          Sound.play('buy'); buzz(8); sig.owner = ''; State.save(); refresh(true);
        }
      });
    });
  }

  function renderPrestige() {
    var s = State.get();
    var gain = Game.fameGain();

    // 사장님 — 성별·성장 단계에 맞는 이미지
    var oImg = 'assets/img/' + Game.ownerImg();
    if (el.prestigeOwner.getAttribute('src') !== oImg) el.prestigeOwner.src = oImg;
    el.ownerStage.textContent = Game.ownerStage().name;

    el.pFameNow.textContent = Fmt.num(s.fame);
    el.pFameGain.textContent = '+' + Fmt.num(gain);

    var nextMult = (1 + 0.02 * (s.fame + gain)) *
                   (1 + 0.01 * Game.achievementCount()) *
                   Math.pow(1.5, Game.fameLv('f_mult'));
    el.pMultNext.textContent = Fmt.mult(nextMult);

    el.prestigeBtn.disabled = gain <= 0;
    el.prestigeBtn.textContent = gain > 0 ? ('재개업하고 명성 ' + Fmt.num(gain) + ' 받기') : '아직 재개업할 수 없습니다';

    if (gain <= 0) {
      var need = Game.PRESTIGE_BASE - s.runEarned;
      el.prestigeReq.textContent = '이번 회차에 ' + Fmt.won(Math.max(0, need)) + '을 더 벌면 재개업할 수 있습니다.';
    } else {
      el.prestigeReq.textContent = '다음 명성까지 ' +
        Fmt.won(Math.max(0, Game.nextFameAt() - s.runEarned)) + ' 남음.';
    }
  }

  function updateMuteBtn() {
    var off = Sound.muted();
    el.muteIc.src = 'assets/img/ui/ui_sound_' + (off ? 'off' : 'on') + '.png';
    el.muteTx.textContent = off ? '소리 꺼짐' : '소리 켜짐';
  }

  /* ---------- 세이브 안전 안내 ---------- */

  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
             navigator.standalone === true;
    } catch (e) { return false; }
  }

  var sgPersist = 'unknown';    // 저장소 보호 여부 (한 번만 확인해 캐시)
  var sgPersistAsked = false;

  function persistLine() {
    if (sgPersist === true) return '이 브라우저가 <b class="sg-ok">저장소를 보호 중</b>이에요';
    if (sgPersist === false) return '이 브라우저는 오래 안 켜면 세이브를 지울 수 있어요';
    return '저장소 보호 여부를 확인 중…';
  }

  function refreshSaveGuard() {
    if (!el.saveGuard) return;
    var s = State.get();

    // 저장소 보호 여부는 한 번만 물어보고, 답이 오면 다시 그린다
    if (!sgPersistAsked) {
      sgPersistAsked = true;
      State.storagePersisted().then(function (ok) {
        sgPersist = (ok === true) ? true : (ok === false ? false : 'unknown');
        sig.guard = '';                 // 다시 그리도록
        if (currentTab === 'settings') refreshSaveGuard();
      });
    }

    var days = s.lastBackup ? Math.floor((State.now() - s.lastBackup) / 86400000) : null;
    var stand = isStandalone();
    var mark = days + '|' + stand + '|' + sgPersist;
    if (sig.guard === mark) return;     // 값이 그대로면 다시 그리지 않는다 (깜빡임 방지)
    sig.guard = mark;

    var backupLine = days === null
      ? '<b class="sg-warn">아직 백업한 적 없음</b> — 아래 <b>세이브 내보내기</b>로 코드를 복사해 두세요'
      : (days === 0 ? '오늘 백업함 👍'
                    : days + '일 전에 백업함' + (days >= 7 ? ' <b class="sg-warn">— 다시 해두면 좋아요</b>' : ''));

    var homeLine = stand
      ? '홈 화면 앱으로 실행 중 — 저장이 더 오래 보관됩니다 👍'
      : '<b>홈 화면에 추가</b>해서 쓰면 세이브가 더 오래 남습니다';

    el.saveGuard.innerHTML =
      '<div class="sg-row"><span class="sg-ic">🛡️</span><span>' + persistLine() + '</span></div>' +
      '<div class="sg-row"><span class="sg-ic">💾</span><span>' + backupLine + '</span></div>' +
      '<div class="sg-row"><span class="sg-ic">📲</span><span>' + homeLine + '</span></div>' +
      '<p class="sg-note">이 게임은 세이브를 기기 브라우저에만 담습니다. ' +
        '브라우저가 오래 안 쓴 데이터를 지우면(특히 아이폰 사파리는 약 7일) 사라질 수 있어요. ' +
        '가끔 <b>세이브 내보내기</b>로 코드를 백업해 두면 안전합니다.</p>';
  }

  function updateNotifyBtn() {
    var on = State.get().notifyOffline === 1;
    var supported = ('Notification' in window);
    if (!supported) {
      el.notifyBtn.textContent = '🔔 이 기기는 알림을 지원하지 않아요';
      el.notifyBtn.disabled = true;
      return;
    }
    var denied = (window.Notification && Notification.permission === 'denied');
    if (denied) {
      el.notifyBtn.textContent = '🔕 알림이 브라우저에서 차단됨';
    } else {
      el.notifyBtn.textContent = on ? '🔔 오프라인 알림 켜짐' : '🔔 오프라인 알림 켜기';
    }
  }

  /* ---------- 통계 ---------- */

  function renderStats() {
    var s = State.get();
    var rows = [
      ['보유 금액', Fmt.won(s.money)],
      ['초당 수익', Fmt.won(Game.perSec())],
      ['탭 수익', Fmt.won(Game.tapValue())],
      ['조리 메뉴', Game.tapStep().step.name +
        ' (' + (Game.tapStep().index + 1) + '/' + Game.tapStep().total + '단계)'],
      ['손님 등급', (Game.crowdTier().index + 1) + '/' + Game.crowdTier().total],
      ['전체 배율', Fmt.mult(Game.globalMult())],
      ['이번 회차 매출', Fmt.won(s.runEarned)],
      ['전체 누적 매출', Fmt.won(s.totalEarned)],
      ['총 조리 횟수', Fmt.comma(s.taps) + '회'],
      ['현재 버프 배율', Fmt.mult(Game.buffMult())],
      ['최고 콤보', Fmt.comma(s.bestCombo) + '콤보'],
      ['황금 손님', Fmt.comma(s.goldens) + '명'],
      ['손님 몰이 사용', Fmt.comma(s.boosts) + '회'],
      ['자동 연타 차단', Fmt.comma(s.macroBlocks) + '회'],
      ['점장이 산 설비', Fmt.comma(s.autoBought) + '개'],
      ['직접 잡은 도둑', Fmt.comma(s.thievesCaught) + '명'],
      ['경찰이 잡아준 도둑', Fmt.comma(s.thiefSaves) + '명'],
      ['도둑맞은 금액', Fmt.won(s.stolen) + ' (' + Fmt.comma(s.thefts) + '회)'],
      ['연속 출석', Fmt.comma(s.dailyStreak) + '일'],
      ['보유 명성', Fmt.num(s.fame)],
      ['재개업 횟수', Fmt.comma(s.prestiges) + '회'],
      ['도전과제', Game.achievementCount() + ' / ' + Data.ACHIEVEMENTS.length],
      ['오프라인 인정 시간', Fmt.time(Game.offlineCapSeconds()) +
        ' (+' + Fmt.time(Game.offlineTailCapSeconds() - Game.offlineCapSeconds()) + ' 보너스)'],
      ['오프라인 효율', Math.round(Game.offlineEfficiency() * 100) + '% (보너스 ' +
        Math.round(Game.offlineEfficiency() * Data.OFFLINE.tailEff * 100) + '%)'],
      ['총 플레이 시간', Fmt.time(s.playTime)]
    ];
    // 매크로 방지를 꺼둔 동안엔 항상 0이라 통계에서 뺀다 (다시 켜면 자동으로 나타난다)
    if (!Game.macroGuardOn()) rows = rows.filter(function (r) { return r[0] !== '자동 연타 차단'; });
    el.statsBox.innerHTML = rows.map(function (r) {
      return '<div class="stat-row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>';
    }).join('');
  }

  /* ---------- HUD ---------- */

  function updateHud() {
    var s = State.get();
    el.money.textContent = Fmt.won(s.money);
    el.rate.textContent = '초당 ' + Fmt.rate(Game.perSec()) + ' 원';
    el.fameNum.textContent = Fmt.num(s.fame);
    el.multChip.textContent = Fmt.mult(Game.globalMult());
    el.bossChip.textContent = '사장 Lv.' + Game.bossLevel() + ' · ' + Game.bossTitle();
    el.bossXpFill.style.transform = 'scaleX(' + Game.bossXpRatio().toFixed(3) + ')';
    updateTapLook();

    var rest = Game.macroRestLeft();
    el.tapTarget.classList.toggle('blocked', rest > 0);
    el.tapPower.textContent = rest > 0
      ? Math.ceil(rest) + '초 후 재개'
      : '+' + Fmt.num(Game.tapValue()) + ' 원';

    el.dotUpgrade.hidden = !Game.hasAffordableUpgrade();
    el.dotPrestige.hidden = !(Game.fameGain() > 0 || Game.hasAffordableFame());
    el.dotAchv.hidden = !Game.questClaimable();

    updateBuffBar();
    updatePartyBanner();
    updateCombo();
    updateBoostBtn();
    updateCoupon();
    updateTruck();
  }

  /* ---------- 주말 파티 배너 ---------- */

  var partySig = '';

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s2 = sec % 60;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return (h > 0 ? h + ':' + pad(m) + ':' + pad(s2) : m + ':' + pad(s2));
  }

  function updatePartyBanner() {
    var ps = Game.partyState();
    if (!ps.active) {
      if (!el.partyBanner.hidden) { el.partyBanner.hidden = true; partySig = ''; }
      return;
    }
    el.partyBanner.hidden = false;
    var mark = Math.ceil(ps.left);
    if (mark === partySig) return;
    partySig = mark;
    el.partyBanner.innerHTML =
      '<span class="pb-tag">🎉 주말 파티</span>' +
      '<span class="pb-mult">모든 수익 ×' + Data.PARTY.mult + '</span>' +
      '<span class="pb-time">⏳ ' + fmtClock(ps.left) + '</span>';
  }

  /* ---------- 버프 표시줄 ---------- */

  var buffSig = '';

  function updateBuffBar() {
    var list = Game.activeBuffs();
    if (!list.length) {
      el.buffBar.hidden = true;
      buffSig = '';
      return;
    }
    el.buffBar.hidden = false;
    // 남은 초가 바뀔 때만 다시 그린다 (100ms 마다 innerHTML 을 갈아끼우지 않도록)
    var newSig = list.map(function (b) {
      return b.icon + b.label + Math.ceil(b.left);
    }).join('|');
    if (newSig === buffSig) return;
    buffSig = newSig;

    el.buffBar.innerHTML = list.map(function (b) {
      return '<span class="buff"><span>' + b.icon + ' ' + b.label + '</span>' +
             '<span class="t">' + Math.ceil(b.left) + 's</span></span>';
    }).join('');
  }

  /* ---------- 조리 음식 모양 ---------- */

  var lookSig = '';

  function updateTapLook() {
    var t = Game.tapStep();
    var sig = Game.tapSkin().id + '#' + t.index;
    if (sig === lookSig) return;

    var levelUp = lookSig && lookSig.split('#')[0] === Game.tapSkin().id &&
                  t.index > Number(lookSig.split('#')[1]);
    lookSig = sig;

    if (t.step.svg) el.tapEmoji.innerHTML = t.step.svg;
    else el.tapEmoji.textContent = t.step.icon;
    el.tapLabel.textContent = t.step.name;
    // 단계가 오를수록 테두리가 화려해진다
    el.tapTarget.className = el.tapTarget.className
      .replace(/\btier-\d+\b/g, '').trim() + ' tier-' + (t.index + 1);

    if (levelUp) {
      el.tapEmoji.classList.remove('levelup');
      void el.tapEmoji.offsetWidth;          // 애니메이션 재시작
      el.tapEmoji.classList.add('levelup');
      toast('🎉 ' + t.step.name + ' 개시!');
      Sound.play('levelup');
      buzz(24);
    }
  }

  /* ---------- 스킨 고르기 ---------- */

  var skinSig = '';

  function skinRow(kind, list, rowEl, nowEl, ladderEl) {
    var cur = kind === 'tap' ? Game.tapSkin() : Game.crowdSkin();

    if (!rowEl.children.length) {
      list.forEach(function (k) {
        var b = document.createElement('button');
        b.className = 'skin';
        b.dataset.skin = k.id;
        b.innerHTML = '<span class="skin-ic"></span><span class="skin-nm"></span>';
        var ic = b.querySelector('.skin-ic');
        if (k.svg) ic.innerHTML = k.svg; else ic.textContent = k.icon;
        b.querySelector('.skin-nm').textContent = k.name;
        b.addEventListener('click', function () {
          if (Game.setSkin(kind, k.id)) {
            lookSig = '';                 // 모양을 즉시 새로 그린다
            skinSig = '';
            if (kind === 'crowd') Scene.clear();
            buzz(12);
            toast(k.name + ' 적용!');
            State.save();
            refresh(true);
          }
        });
        rowEl.appendChild(b);
      });
    }

    Array.prototype.forEach.call(rowEl.children, function (b) {
      b.classList.toggle('on', b.dataset.skin === cur.id);
    });

    nowEl.textContent = cur.name;

    // 이 스킨의 단계표 — 지금 어디까지 왔는지 보여준다
    if (kind === 'tap') {
      var t = Game.tapStep();
      ladderEl.innerHTML = cur.steps.map(function (st, i) {
        var cls = i < t.index ? 'done' : (i === t.index ? 'now' : '');
        return '<span class="rung ' + cls + '" title="' + st.name + '">' +
               (st.svg || st.icon) + '</span>';
      }).join('');
      var nx = Game.nextTapStep();
      ladderEl.innerHTML += '<span class="rung-note">' + (nx
        ? '다음 · ' + nx.step.name + ' (탭 수익 ' + Fmt.won(nx.step.at) + ')'
        : '마지막 단계입니다') + '</span>';
    } else {
      // 스킨마다 개성 있는 5단계 성장 — 이름·서사·문턱을 함께 보여준다
      var ct = Game.crowdTier();
      var steps = cur.tiers.map(function (tr, i) {
        var cls = i < ct.index ? 'done' : (i === ct.index ? 'now' : 'wait');
        var c0 = tr.cast[0];
        var face = (typeof c0 === 'string' && c0.indexOf('/') >= 0
                     ? '<img class="gs-cust" src="assets/img/' + c0 + '" alt="">' : c0) +
                   (tr.acc.length ? '<u>' + tr.acc[0] + '</u>' : '');
        var when = i === 0 ? '시작' : '초당 ' + Fmt.won(tr.at);
        return '<div class="grow-step ' + cls + '">' +
                 '<span class="gs-face">' + face + '</span>' +
                 '<span class="gs-body"><b>' + tr.name + '</b>' +
                   '<i>' + tr.story + '</i></span>' +
                 '<span class="gs-when">' + when + '</span>' +
               '</div>';
      }).join('');
      var nxt = cur.tiers[ct.index + 1];
      var foot = nxt
        ? '다음 단계 <b>' + nxt.name + '</b> · 초당 ' + Fmt.won(nxt.at) + ' 부터'
        : '<b>' + ct.name + '</b> — 최고 단계에 도달했습니다!';
      ladderEl.innerHTML = '<div class="grow">' + steps + '</div>' +
                           '<div class="grow-foot">' + foot + '</div>';
    }
  }

  /* ---------- 화면 테마 (색 스킨) ---------- */

  // 테마가 덮어쓰는 CSS 변수 전부 — 먼저 지운 뒤(=기본으로 복귀) 고른 테마 값을 얹는다.
  var THEME_VARS = ['--bg', '--bg2', '--card', '--card2', '--line', '--txt', '--dim',
                    '--gold', '--good', '--bad', '--accent', '--accent2',
                    '--appbg', '--hud', '--tabbar', '--tapbg'];

  function applyTheme(id) {
    var t = null;
    for (var i = 0; i < Data.THEMES.length; i++) {
      if (Data.THEMES[i].id === id) { t = Data.THEMES[i]; break; }
    }
    var root = document.documentElement;
    THEME_VARS.forEach(function (v) { root.style.removeProperty(v); });
    if (t && t.vars) {
      Object.keys(t.vars).forEach(function (k) { root.style.setProperty(k, t.vars[k]); });
    }
    // 기본 테마면 시간대 하늘이 --appbg 를 다시 그린다 (전환 순간 깜빡임 방지)
    if (window.Sky) Sky.refresh();
  }

  function renderThemes() {
    var rowEl = el.themeRow;
    if (!rowEl) return;

    if (!rowEl.children.length) {
      Data.THEMES.forEach(function (t) {
        var b = document.createElement('button');
        b.className = 'skin';
        b.dataset.theme = t.id;
        var sw = (t.sw || []).map(function (c) {
          return '<i style="background:' + c + '"></i>';
        }).join('');
        b.innerHTML = '<span class="skin-ic theme-sw">' + sw + '</span>' +
                      '<span class="skin-nm"></span>';
        b.querySelector('.skin-nm').textContent = t.name;
        b.addEventListener('click', function () {
          var s = State.get();
          if (s.theme === t.id) return;
          s.theme = t.id;
          applyTheme(t.id);
          buzz(12);
          State.save();
          toast(t.name + ' 테마 적용!');
          markThemes();
        });
        rowEl.appendChild(b);
      });
    }
    markThemes();

    function markThemes() {
      var now = State.get().theme || 'auto';
      Array.prototype.forEach.call(rowEl.children, function (b) {
        b.classList.toggle('on', b.dataset.theme === now);
      });
      var meta = Data.THEMES.filter(function (t) { return t.id === now; })[0];
      if (el.themeNow) el.themeNow.textContent = meta ? meta.name : '';
    }
  }

  /* ---------- 탭 소리 고르기 ---------- */

  var soundCombo = 0, soundTimer = null;

  function renderTapSound() {
    var cur = State.get().tapSound || 'classic';
    var rowEl = el.tapSoundRow;

    if (!rowEl.children.length) {
      Data.TAP_SOUNDS.forEach(function (t) {
        var b = document.createElement('button');
        b.className = 'skin';
        b.dataset.sound = t.id;
        b.innerHTML = '<span class="skin-ic"></span><span class="skin-nm"></span>' +
                      '<span class="skin-sub"></span>';
        b.querySelector('.skin-ic').innerHTML = iconHtml(t.icon, 'tap-img');
        b.querySelector('.skin-nm').textContent = t.name;
        b.querySelector('.skin-sub').textContent = t.desc;
        b.addEventListener('click', function () {
          var s = State.get();
          var changed = s.tapSound !== t.id;
          s.tapSound = t.id;
          // 누를 때마다 연타 흉내로 음을 살짝 올려 실제 느낌을 들려준다
          soundCombo = Math.min(soundCombo + 1, 20);
          clearTimeout(soundTimer);
          soundTimer = setTimeout(function () { soundCombo = 0; }, 900);
          Sound.wake();
          Sound.previewTap(t.id, soundCombo);
          buzz(8);
          if (changed) { State.save(); toast(t.name + ' 적용!'); }
          markTapSound();
        });
        rowEl.appendChild(b);
      });
    }
    markTapSound();

    function markTapSound() {
      var now = State.get().tapSound || 'classic';
      Array.prototype.forEach.call(rowEl.children, function (b) {
        b.classList.toggle('on', b.dataset.sound === now);
      });
      var meta = Data.TAP_SOUNDS.filter(function (t) { return t.id === now; })[0];
      el.tapSoundNow.textContent = meta ? meta.name : '';
    }
  }

  function renderSkins() {
    var s = State.get();
    var sig = s.tapSkin + '/' + s.crowdSkin + '/' +
              Game.tapStep().index + '/' + Game.crowdTier().index;
    if (sig === skinSig) return;
    skinSig = sig;
    skinRow('tap', Data.TAP_SKINS, el.tapSkinRow, el.tapSkinNow, el.tapLadder);
    skinRow('crowd', Data.CROWD_SKINS, el.crowdSkinRow, el.crowdSkinNow, el.crowdLadder);
  }

  /* ---------- 매크로 안내 ---------- */

  var blockToastAt = 0;

  function showBlocked(reason) {
    if (reason === 'auto' || reason === 'fast') return;   // 조용히 무시
    var now = Date.now();
    if (now - blockToastAt < 2500) return;                // 토스트 도배 방지
    blockToastAt = now;
    Sound.play('blocked');
    toast(reason === 'macro'
      ? '🤖 자동 연타가 감지돼 잠시 조리를 멈춥니다'
      : '잠시 후 다시 조리할 수 있습니다');
  }

  /* ---------- 콤보 ---------- */

  function updateCombo() {
    var n = Game.comboCount();
    if (n <= 1) { el.combo.hidden = true; return; }
    el.combo.hidden = false;
    el.comboX.textContent = '×' + Game.comboMult().toFixed(1);
    el.comboN.textContent = 'COMBO ' + n;
    el.comboFill.style.transform = 'scaleX(' + Game.comboRatio().toFixed(3) + ')';
    el.combo.classList.toggle('hot', n >= 30);
  }

  /* ---------- 손님 몰이 버튼 ---------- */

  function updateBoostBtn() {
    var s = State.get();
    var b = el.boostBtn;
    if (s.boostLeft > 0) {
      b.className = 'boost-btn active';
      el.boostTitle.textContent = '손님 폭주 중!';
      el.boostSub.textContent = '모든 수익 ×' + Data.BOOST.mult + ' · ' + Fmt.time(s.boostLeft) + ' 남음';
    } else if (s.boostCd > 0) {
      b.className = 'boost-btn cooling';
      el.boostTitle.textContent = '손님 몰이';
      el.boostSub.textContent = '준비까지 ' + Fmt.time(s.boostCd);
    } else {
      b.className = 'boost-btn';
      el.boostTitle.textContent = '손님 몰이';
      el.boostSub.textContent = Data.BOOST.dur + '초 동안 모든 수익 ×' + Data.BOOST.mult;
    }
  }

  /** 구매 직전 할인율(before)과 지금을 비교해 성장/리셋 안내 문구를 만든다.
     쿠폰을 안 썼으면 빈 문자열. */
  function couponGrewMsg(before) {
    var pct = Game.couponState().pct;
    if (pct === before) return '';
    if (before >= 100 && pct < 100) return '🎟️ 100% 쿠폰 사용! ' + pct + '%부터 다시 자라요';
    if (pct >= 100) return '🎟️ 쿠폰 할인 100% 완성! 다음 설비 1개는 공짜예요';
    return '🎟️ 쿠폰 할인 ' + pct + '% 로 자랐어요';
  }
  function couponCountStr(c) {
    // 총 보유 가능량까지: 2/3. 첫 환생 예외로 3장을 넘으면 (3)+1.
    return c.count > c.max ? '(' + c.max + ')+' + (c.count - c.max) : c.count + '/' + c.max;
  }
  function updateCoupon() {
    if (!el.couponChip) return;
    var c = Game.couponState();
    if (c.count <= 0) { el.couponChip.hidden = true; return; }   // 없으면 숨긴다
    el.couponChip.hidden = false;
    // 자라는 할인율을 앞세우고, '1개만' 적용을 정면에 늘 보이게 박아둔다: 🎟️ 30% · 2/3 · 1개만
    el.couponChip.textContent = '🎟️ ' + c.pct + '% · ' + couponCountStr(c) + ' · 1개만';
    el.couponChip.classList.toggle('armed', c.armed);           // 켜면 금색 강조
    el.couponChip.title = c.armed
      ? '다음 ×1 구매(설비/업그레이드 1개) −' + c.pct + '% 적용 중 · 쓰면 자라요 (눌러서 끄기)'
      : '눌러서 다음 ×1 구매(설비/업그레이드 1개)에 −' + c.pct + '% · 쓸수록 자라요';
    maybeCouponTip();   // 쿠폰이 처음 생기면 사용법을 한 번 알려준다
  }

  /* ---------- 쿠폰 사용법 튜토리얼 (처음 한 번) ----------
     쿠폰이 '1개만' 적용된다는 건 스스로 알기 어렵다. 처음 쿠폰이 생겼을 때
     한 번만 팝업으로 알려주고, 다시는 안 뜬다(sawCouponTip). 다른 안내가
     떠 있으면 겹치지 않게 미루고, 다음 갱신 때 다시 시도한다. */
  function maybeCouponTip() {
    var s = State.get();
    if (s.sawCouponTip) return;
    if (Game.couponState().count <= 0) return;                 // 쿠폰이 실제로 생겼을 때만
    if (document.querySelector('.modal:not([hidden])')) return; // 다른 팝업 위에 겹치지 않게
    s.sawCouponTip = 1; State.save();
    ask({ oneButton: true, emoji: '🎟️', ok: '알겠어요', title: '할인 쿠폰 사용법',
      text: '쿠폰은 <b>설비·업그레이드 1개(×1)</b>에만 쓸 수 있어요.<br>' +
            '<b>×10·×100·최대</b> 같은 대량구매엔 붙지 않습니다.<br><br>' +
            '할인율은 쓸수록 <b>자라서 100%</b>까지 오르니,<br>' +
            '<b>비싼 설비 하나</b>에 몰아 쓰면 가장 이득이에요!' }, function () {});
  }

  /* ---------- 황금 손님 ---------- */

  var goldTimer = 0;      // 다음 등장까지 남은 시간
  var goldNode = null;    // 지금 떠 있는 손님
  var goldLife = 0;       // 그 손님이 사라지기까지 남은 시간
  var onGolden = null;    // 잡았을 때 부를 콜백 (main.js 가 넣어준다)

  function armGolden() { goldTimer = Game.nextGoldenGap(); }

  function despawnGolden(popped) {
    if (!goldNode) return;
    var n = goldNode;
    goldNode = null;
    if (popped) {
      n.classList.add('pop');
      setTimeout(function () { n.remove(); }, 320);
    } else {
      n.remove();
    }
  }

  function spawnGolden() {
    despawnGolden(false);
    var type = Game.rollGolden();
    var layer = el.goldenLayer;
    var w = layer.clientWidth || 360;
    var h = layer.clientHeight || 640;
    var size = 64;

    var node = document.createElement('div');
    node.className = 'golden';
    setIcon(node, type.icon);
    // 상단 HUD 와 하단 탭바를 피해서 배치
    node.style.left = Math.round(12 + Math.random() * Math.max(1, w - size - 24)) + 'px';
    node.style.top = Math.round(h * 0.22 + Math.random() * Math.max(1, h * 0.45)) + 'px';

    var caught = false;
    node.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (caught) return;
      caught = true;
      var rect = node.getBoundingClientRect();
      var layerRect = layer.getBoundingClientRect();
      var res = Game.claimGolden(type, ev.isTrusted !== false);
      if (!res) { caught = false; return; }
      goldenMsg(rect.left - layerRect.left + size / 2, rect.top - layerRect.top, res.text);
      despawnGolden(true);
      buzz(20);
      armGolden();
      if (onGolden) onGolden(res);
    });

    layer.appendChild(node);
    goldNode = node;
    goldLife = Data.GOLDEN.life;
    toast('🌟 황금 손님이 왔어요!');
    Sound.play('golden');
    buzz(14);
  }

  function goldenMsg(x, y, text) {
    var d = document.createElement('div');
    d.className = 'golden-msg';
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    el.goldenLayer.appendChild(d);
    setTimeout(function () { d.remove(); }, 1350);
  }

  /* ---------- 도둑 & 경찰 ---------- */

  var thiefTimer = 0;
  var thiefBusy = false;    // 도둑이 화면에 있는 동안엔 겹쳐 내보내지 않는다
  var onThief = null;
  var michTapFn = null;   // main.js 의 onTap (스타 셰프 조리에 재사용)

  function armThief() { thiefTimer = Game.nextThiefGap(); }

  function runner(cls, icon, y) {
    var node = document.createElement('div');
    node.className = cls;
    var face = document.createElement('i');
    var body = document.createElement('span');
    body.className = 'body';
    body.textContent = icon;
    face.appendChild(body);
    node.appendChild(face);
    node.style.top = Math.round(y) + 'px';
    return node;
  }

  function glideTo(node, x, seconds) {
    // 시작 위치를 브라우저가 확정하도록 강제로 레이아웃을 읽는다.
    // 이 줄이 없으면 시작·도착 transform 이 같은 프레임에 합쳐져
    // 트랜지션이 아예 시작되지 않는다 (프레임 타이밍에 따라 되다 말다 한다).
    node.getBoundingClientRect();
    node.style.transition = 'transform ' + seconds.toFixed(2) + 's linear';
    node.style.transform = 'translateX(' + x + 'px)';
  }

  function spawnThief() {
    if (thiefBusy || !Game.thiefWorthwhile()) return;
    thiefBusy = true;

    var T = Data.THIEF;
    var layer = el.goldenLayer;
    var w = layer.clientWidth || 360;
    var h = layer.clientHeight || 640;
    var y = h * 0.3 + Math.random() * h * 0.32;

    var amount = Game.thiefTarget();
    // 도둑 아이콘 폭이 50px 남짓이라, 딱 가려질 만큼만 밖에서 출발시킨다.
    // 여유를 크게 잡으면 화면에 보이지도 않는 동안 제한 시간이 흘러간다.
    var EDGE = 56;
    var rightward = Math.random() < 0.5;
    var from = rightward ? -EDGE : w + EDGE;
    var to = rightward ? w + EDGE : -EDGE;
    var caughtByPolice = Math.random() < Game.policeChance();

    var thief = runner('thief', '🦹', y);
    if (!rightward) thief.querySelector('i').className = 'flip';
    var bag = document.createElement('b');
    bag.className = 'bag';
    // 황금 손님의 '현금 다발' 💰 과 헷갈리지 않게 다른 아이콘을 쓴다
    bag.textContent = '💸';
    thief.appendChild(bag);
    thief.style.transform = 'translateX(' + from + 'px)';
    layer.appendChild(thief);

    var police = runner('police', '🚓', y + 6);
    if (!rightward) police.querySelector('i').className = 'flip';
    police.style.transform = 'translateX(' + from + 'px)';

    var timers = [];
    var settled = false;

    function cleanup() {
      timers.forEach(clearTimeout);
      timers.length = 0;
      [thief, police].forEach(function (n) { if (n.parentNode) n.remove(); });
      thiefBusy = false;
      armThief();
    }

    function finish(kind, res) {
      if (settled) return;
      settled = true;
      thief.style.pointerEvents = 'none';
      if (onThief) onThief(kind, res);
      timers.push(setTimeout(cleanup, kind === 'escaped' ? 200 : 900));
    }

    // 탭해서 직접 잡기
    thief.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (settled) return;
      var res = Game.catchThief(amount, ev.isTrusted !== false);
      if (!res) return;                       // 가짜 클릭은 무시
      thief.classList.add('nabbed');
      var r = thief.getBoundingClientRect(), lr = layer.getBoundingClientRect();
      goldenMsg(r.left - lr.left + 26, r.top - lr.top, '🚨 +' + Fmt.won(res.bonus));
      Sound.play('caught');
      buzz(28);
      finish('caught', res);
    });

    toast('🚨 도둑이다! 탭해서 잡으세요');
    Sound.play('thief');
    buzz([14, 60, 14]);
    glideTo(thief, to, T.life);

    // 경찰 출동
    timers.push(setTimeout(function () {
      if (settled) return;
      layer.appendChild(police);
      var remain = T.life * (1 - T.policeStart);
      // 잡을 거면 도둑보다 빨리 달려가 따라붙는다
      glideTo(police, caughtByPolice ? from + (to - from) * T.policeCatchAt : to,
              caughtByPolice ? T.life * (T.policeCatchAt - T.policeStart) : remain);
    }, T.life * T.policeStart * 1000));

    if (caughtByPolice) {
      timers.push(setTimeout(function () {
        if (settled) return;
        thief.style.transition = 'none';
        thief.classList.add('nabbed');
        var res = Game.policeCaught(amount);
        var r = thief.getBoundingClientRect(), lr = layer.getBoundingClientRect();
        goldenMsg(r.left - lr.left + 26, r.top - lr.top, '🚓 검거!');
        toast('🚓 경찰이 도둑을 잡았습니다');
        Sound.play('caught');
        finish('police', res);
      }, T.life * T.policeCatchAt * 1000));
    }

    // 놓침
    timers.push(setTimeout(function () {
      if (settled) return;
      var res = Game.thiefEscaped(amount);
      toast('💸 도둑에게 ' + Fmt.won(res.lost) + '을 털렸습니다');
      Sound.play('lost');
      buzz(40);
      finish('escaped', res);
    }, T.life * 1000 + 60));
  }

  /** 매 프레임 호출 — 황금 손님과 도둑의 등장/퇴장을 관리한다 */
  function tickWorld(dt) {
    Scene.tick(dt);

    // 도둑과 황금 손님은 같은 층을 쓰므로 겹쳐 내보내지 않는다.
    // 둘 다 탭해야 하는 것이라 겹치면 무엇을 눌러야 할지 알 수 없다.
    thiefTimer -= dt;
    if (thiefTimer <= 0 && !goldNode) {
      if (Game.thiefWorthwhile()) spawnThief();
      else armThief();          // 훔칠 게 없으면 다음 기회에
    }

    if (goldNode) {
      goldLife -= dt;
      if (goldLife <= 0) { despawnGolden(false); armGolden(); }
      return;
    }
    goldTimer -= dt;
    if (goldTimer <= 0 && !thiefBusy) spawnGolden();
  }

  /* ---------- 출석 보상 모달 ---------- */

  function showDaily(res, onOk) {
    var d = Data.DAILY;
    el.dailyText.innerHTML =
      '<b>' + res.streak + '일째</b> 출석했습니다.<br>' +
      '초당 수익 ' + Fmt.time(res.seconds) + '치 — <b>' + Fmt.won(res.gain) + '</b>' +
      (res.candy ? '<br>🍬 별사탕 <b>' + res.candy + '</b> 도 받았어요' : '');

    var dots = '';
    for (var i = 1; i <= d.maxStreak; i++) {
      dots += '<i class="' + (i <= res.days ? 'on' : '') + '"></i>';
    }
    el.streakDots.innerHTML = dots;

    el.dailyModal.hidden = false;
    el.dailyOk.onclick = function () {
      el.dailyModal.hidden = true;
      if (onOk) onOk();
    };
  }

  /* ---------- 탭 전환 ---------- */

  function showTab(name) {
    if (Game.visibleTabs().indexOf(name) < 0) name = 'shop';   // 아직 안 열린 탭이면 가게로
    currentTab = name;
    Array.prototype.forEach.call(document.querySelectorAll('.tab-page'), function (p) {
      p.hidden = p.dataset.page !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tabbar .tab'), function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    var view = $('view');
    view.scrollTop = 0;
    view.classList.toggle('locked', name === 'shop');
    refresh(true);
  }

  /* ---------- 전체 갱신 ---------- */

  /** 온보딩 — 진행에 따라 하단 탭을 하나씩 연다. 새로 열리면 알린다. */
  function renderTabs() {
    var reveal = Game.tabsToReveal();
    if (reveal.length) {
      Game.markTabsSeen(reveal);
      reveal.forEach(function (id) { toast('🎉 새 기능 열림 — ' + Game.tabName(id) + '!'); });
      Sound.play('levelup');
    }
    var vis = Game.visibleTabs();
    Array.prototype.forEach.call(document.querySelectorAll('#tabbar .tab'), function (b) {
      b.hidden = vis.indexOf(b.dataset.tab) < 0;
      if (reveal.indexOf(b.dataset.tab) >= 0) {
        b.classList.add('just-open');
        setTimeout(function () { b.classList.remove('just-open'); }, 2600);
      }
    });
  }

  function refresh(force) {
    updateHud();
    updateNoticeBadge();
    updateMailBadge();
    updateCandy();
    renderTabs();
    if (currentTab === 'shop') { updateGenList(); updateReco(); }
    else if (currentTab === 'upgrade') { renderUpgrades(); renderAchievements(); }
    else if (currentTab === 'kitchen') renderKitchen();
    else if (currentTab === 'prestige') { renderPrestige(); renderFameShop(); }
    else if (currentTab === 'achv') { renderAds(); renderQuests(); renderMichelin(); renderPartyDex(); renderRanking(); renderHallOfFame(); }
    else if (currentTab === 'settings') { renderStats(); renderThemes(); renderSkins(); renderOwnerPick(); renderTapSound(); updateMuteBtn(); updateNotifyBtn(); refreshSaveGuard(); }
    if (force) { /* 강제 갱신 시 별도 처리 없음 */ }
  }

  /* ---------- 확인 · 텍스트 모달 ----------
     샌드박스 iframe(아티팩트 등)에서는 confirm/prompt 가 조용히 막힌다.
     실제로 '데이터 전체 삭제' 가 눌러도 아무 일이 없었다. 직접 만든 모달을 쓴다. */

  /**
   * @param {{emoji?:string, title:string, text:string, ok?:string, cancel?:string, danger?:boolean}} o
   * @param {function} onYes 확인을 눌렀을 때
   */
  function ask(o, onYes) {
    el.askEmoji.textContent = o.emoji || '❓';
    el.askTitle.textContent = o.title;
    el.askText.innerHTML = o.text;
    el.askOk.textContent = o.ok || '확인';
    el.askCancel.textContent = o.cancel || '취소';
    el.askCancel.hidden = !!o.oneButton;   // 정보용 팝업은 '확인' 하나만
    el.askOk.className = 'btn big' + (o.danger ? ' danger' : '');
    el.askModal.hidden = false;

    function close() {
      el.askModal.hidden = true;
      el.askOk.onclick = el.askCancel.onclick = null;
    }
    el.askOk.onclick = function () { close(); onYes(); };
    el.askCancel.onclick = close;
  }

  /**
   * @param {{emoji?:string, title:string, desc?:string, value?:string,
   *          readonly?:boolean, ok?:string, cancel?:string}} o
   * @param {function(string)} [onOk] 값을 받아 처리 (읽기 전용이면 생략)
   */
  function textDialog(o, onOk) {
    el.textEmoji.textContent = o.emoji || '💾';
    el.textTitle.textContent = o.title;
    el.textDesc.innerHTML = o.desc || '';
    el.textDesc.hidden = !o.desc;
    el.textInput.value = o.value || '';
    el.textInput.readOnly = !!o.readonly;
    el.textOk.textContent = o.ok || '확인';
    el.textCancel.textContent = o.cancel || '닫기';
    el.textOk.hidden = !onOk;
    el.textModal.hidden = false;

    function close() {
      el.textModal.hidden = true;
      el.textOk.onclick = el.textCancel.onclick = null;
    }
    el.textOk.onclick = function () {
      var v = el.textInput.value;
      close();
      onOk(v);
    };
    el.textCancel.onclick = close;

    if (o.readonly) {
      // 바로 복사할 수 있게 전체 선택해 둔다
      setTimeout(function () {
        try { el.textInput.focus(); el.textInput.select(); } catch (e) {}
      }, 60);
    }
  }

  /* ---------- 첫 실행 안내 ----------
     콤보·황금 손님·도둑·시트는 알려주지 않으면 스스로 발견해야 한다. */

  var TOUR = [
    { emoji: '🍢', title: '분식집을 물려받았습니다',
      text: '가운데를 <b>탭</b>하면 조리해서 돈을 법니다.<br>' +
            '빠르게 연타하면 <b>콤보</b>가 붙어 수익이 최대 3배까지 오릅니다.' },
    { emoji: '🧑‍🍳', title: '설비를 사면 알아서 법니다',
      text: '아래 시트의 손잡이를 <b>위로 밀면</b> 설비를 한 번에 더 볼 수 있습니다.<br>' +
            '설비는 자리를 비운 동안에도 돈을 벌어둡니다.' },
    { emoji: '🌟', title: '황금 손님을 놓치지 마세요',
      text: '가끔 화면을 가로지릅니다. <b>탭해서 잡으면</b> 큰 보상이나<br>' +
            '한동안 수익이 몇 배로 뛰는 버프를 받습니다.' },
    { emoji: '🦹', title: '도둑도 옵니다',
      text: '💸 을 들고 도망칩니다. <b>7초 안에 탭하면</b> 피해 없이 보너스까지,<br>' +
            '놓치면 그때 돈이 빠집니다. 경찰이 잡아줄 때도 있습니다.' },
    { emoji: '✨', title: '재개업으로 더 멀리',
      text: '가게를 정리하면 <b>명성</b>이 남아 모든 수익을 영구히 올립니다.<br>' +
            '반복할수록 같은 자리까지 훨씬 빨리 돌아옵니다.' }
  ];

  var tourAt = 0;
  var tourDone = null;

  /**
   * @param {number} [from] 시작 장
   * @param {function} [onDone] 끝났을 때 (첫 실행이면 여기서 출석·오프라인 정산을 잇는다)
   */
  function showTour(from, onDone) {
    tourAt = from || 0;
    tourDone = onDone || null;
    drawTour();
    el.tourModal.hidden = false;
  }

  function drawTour() {
    var t = TOUR[tourAt];
    el.tourEmoji.textContent = t.emoji;
    el.tourTitle.textContent = t.title;
    el.tourText.innerHTML = t.text;
    el.tourNext.textContent = (tourAt === TOUR.length - 1) ? '시작하기' : '다음';
    el.tourSkip.hidden = (tourAt === TOUR.length - 1);
    el.tourDots.innerHTML = TOUR.map(function (_, i) {
      return '<i class="' + (i === tourAt ? 'on' : '') + '"></i>';
    }).join('');
  }

  function endTour() {
    el.tourModal.hidden = true;
    State.get().sawTour = 1;
    State.save();
    var f = tourDone; tourDone = null;
    if (f) f();
  }

  function bindTour() {
    el.tourNext.addEventListener('click', function () {
      Sound.play('buy');
      if (tourAt < TOUR.length - 1) { tourAt++; drawTour(); }
      else endTour();
    });
    el.tourSkip.addEventListener('click', endTour);
  }

  /* ---------- 가게 시트 (위: 조리 / 아래: 목록) ---------- */

  function sheetUp() { return State.get().sheetUp > 0; }

  function setSheet(up, save) {
    var s = State.get();
    // 접을 때 목록 스크롤을 되돌린다. 남겨두면 아래 스크롤 감지가 곧바로 다시 펼친다.
    if (!up && el.sheetBody) el.sheetBody.scrollTop = 0;
    s.sheetUp = up ? 1 : 0;
    el.shopPage.classList.toggle('up', !!up);
    el.sheetHandle.setAttribute('aria-expanded', up ? 'true' : 'false');
    el.sheetHandle.setAttribute('aria-label', up ? '설비 목록 접기' : '설비 목록 펼치기');
    el.sheetHint.textContent = up ? '아래로 밀어 접기' : '위로 밀어 더 보기';
    if (save) State.save();
  }

  function bindSheet() {
    var startY = 0, moved = 0, dragging = false;

    function down(ev) {
      dragging = true;
      moved = 0;
      startY = (ev.touches ? ev.touches[0].clientY : ev.clientY);
      if (el.sheetHandle.setPointerCapture && ev.pointerId !== undefined) {
        try { el.sheetHandle.setPointerCapture(ev.pointerId); } catch (e) {}
      }
    }
    function move(ev) {
      if (!dragging) return;
      var y = (ev.touches ? ev.touches[0].clientY : ev.clientY);
      moved = y - startY;
    }
    function up(ev) {
      if (!dragging) return;
      dragging = false;
      ev.preventDefault();
      // 살짝 눌렀으면 토글, 확실히 끌었으면 그 방향으로
      if (moved < -28) setSheet(true, true);
      else if (moved > 28) setSheet(false, true);
      else setSheet(!sheetUp(), true);
      buzz(6);
    }

    if (window.PointerEvent) {
      el.sheetHandle.addEventListener('pointerdown', down);
      el.sheetHandle.addEventListener('pointermove', move);
      el.sheetHandle.addEventListener('pointerup', up);
      el.sheetHandle.addEventListener('pointercancel', function () { dragging = false; });
    } else {
      el.sheetHandle.addEventListener('touchstart', down, { passive: true });
      el.sheetHandle.addEventListener('touchmove', move, { passive: true });
      el.sheetHandle.addEventListener('touchend', up);
      el.sheetHandle.addEventListener('click', function () { setSheet(!sheetUp(), true); });
    }

    // 목록을 위로 스크롤해 올리려 하면 자연스럽게 시트가 열린다
    el.sheetBody.addEventListener('scroll', function () {
      if (!sheetUp() && el.sheetBody.scrollTop > 24) setSheet(true, true);
    }, { passive: true });
  }

  /* ---------- 오프라인 모달 ---------- */

  function showOffline(reward, onOk) {
    var tailCap = Game.offlineTailCapSeconds();
    var maxedOut = reward.seconds - tailCap > 1;   // 2차 상한(꼬리 끝)마저 넘겼다
    var pct = Math.round(reward.tailEff * 100);
    var txt = '';
    if (maxedOut) {
      // 돌아왔을 때 '가득 찼었다'를 눈에 띄게 알린다 (꼬리까지 다 찼을 때만)
      txt += '<div class="offline-full">🔔 오프라인 보상이 <b>가득 찼었어요!</b><br>' +
             '<span>더 자주 들르면 한 푼도 안 놓쳐요</span></div>';
    }
    txt += '자리를 비운 ' + Fmt.time(reward.seconds) + ' 동안<br>' +
           '<b>' + Fmt.won(reward.gain) + '</b>을 벌었습니다.';
    if (reward.tailSeconds > 60) {
      // 제값 구간 + 보너스(꼬리) 구간을 나눠 보여준다
      txt += '<br><span style="font-size:12px">⏱ ' + Fmt.time(reward.capped) +
             ' 제값 + ' + Fmt.time(reward.tailSeconds) + ' 보너스(' + pct + '%)</span>';
    }
    if (reward.trucks > 0) {
      // 재료 트럭도 자리를 비운 만큼 지나갔다 — 재료를 자동으로 챙겨 온다
      txt += '<br><span style="font-size:12px">🚚 재료 트럭 ' + reward.trucks +
             '대 · 재료 ' + reward.ings + '개 챙김</span>';
    }
    if (maxedOut) {
      txt += '<br><span style="font-size:12px">(최대 ' + Fmt.time(tailCap) +
             '까지만 인정 — 명성 상점에서 늘릴 수 있어요)</span>';
    }
    if (Game.managerBuys() > 0) {
      txt += '<br><span style="font-size:12px">🧑‍💼 점장이 이 돈으로 설비를 최대 ' +
             Game.managerBuys() + '개까지 사둡니다</span>';
    }
    el.offlineText.innerHTML = txt;
    el.offlineModal.hidden = false;
    el.offlineOk.onclick = function () {
      el.offlineModal.hidden = true;
      onOk();
    };
  }

  /* ---------- 입력 바인딩 ---------- */

  function bind(handlers) {
    // 탭 클릭 (조리)
    var press = function (ev) {
      ev.preventDefault();

      var rect = el.tapZone.getBoundingClientRect();
      var pt = (ev.changedTouches && ev.changedTouches[0]) || ev;
      var hasPos = typeof pt.clientX === 'number';
      var x = (hasPos ? pt.clientX : rect.left + rect.width / 2) - rect.left;
      var y = (hasPos ? pt.clientY : rect.top + rect.height / 2) - rect.top;

      // isTrusted 가 false 면 스크립트가 만들어낸 가짜 입력이다.
      // 좌표도 함께 넘겨야 매크로 판정이 간격만 보고 사람을 막지 않는다.
      // 키보드 입력은 좌표가 없다 — 좌표 신호 없이 간격만으로는 매크로로 몰지 않는다
      var res = handlers.onTap(ev.isTrusted !== false,
                               hasPos ? x : undefined, hasPos ? y : undefined);
      if (res.blocked) { showBlocked(res.blocked); return; }

      el.tapTarget.classList.add('hit');
      setTimeout(function () { el.tapTarget.classList.remove('hit'); }, 70);

      floatText(x, y, '+' + Fmt.num(res.value));
      Scene.popFood();
      Sound.play('tap', Game.comboCount());
      buzz(6);

      // 파티 중이면 새 음식을 발견할 수 있다
      var found = Game.tryDiscoverFood();
      if (found) {
        Sound.play('reward');
        // 레시피 아이콘은 이제 그림(경로 문자열)이라 토스트·플로트에 그대로 넣으면 경로가 보인다.
        var fico = iconIsImg(found.icon) ? '🍽' : found.icon;
        toast('🎉 파티 음식 발견! ' + fico + ' ' + found.name);
        floatText(x, y - 26, fico);
        sig.partydex = '';
      }
      updateHud();
    };
    // pointerdown 하나로 터치/마우스를 모두 처리 (중복 입력 방지)
    // 스페이스·엔터로도 조리할 수 있게 (키보드 사용자와 스크린리더)
    el.tapTarget.addEventListener('keydown', function (ev) {
      if (ev.key !== ' ' && ev.key !== 'Enter') return;
      if (ev.repeat) return;              // 누르고 있으면 연타로 세지 않는다
      ev.preventDefault();
      press(ev);
    });

    if (window.PointerEvent) {
      el.tapTarget.addEventListener('pointerdown', press);
    } else {
      el.tapTarget.addEventListener('touchstart', press, { passive: false });
      el.tapTarget.addEventListener('mousedown', press);
    }

    // 하단 탭
    Array.prototype.forEach.call(document.querySelectorAll('#tabbar .tab'), function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });

    // 파티 배너를 누르면 도감으로 데려간다
    el.partyBanner.addEventListener('click', function () { showTab('achv'); });

    // 구매 수량
    Array.prototype.forEach.call(el.buyAmt.children, function (b) {
      b.addEventListener('click', function () {
        buyAmt = b.dataset.amt === 'max' ? 'max' : Number(b.dataset.amt);
        Array.prototype.forEach.call(el.buyAmt.children, function (o) {
          o.classList.toggle('active', o === b);
        });
        // 쿠폰은 ×1 구매에만 붙는다 — 대량구매로 바꾸면 알려준다(쿠폰은 그대로 남는다)
        if (buyAmt !== 1 && Game.couponState().armed) {
          toast('🎟️ 쿠폰은 ×1 구매에만 적용돼요 (그대로 남겨둘게요)');
        }
        updateGenList();
      });
    });

    el.recoBar.addEventListener('click', onBuyBest);

    el.couponChip.addEventListener('click', function () {
      var c = Game.couponState();
      var on = Game.setCouponArmed(!c.armed);
      buzz(8);
      if (on) toast(buyAmt === 1
        ? ('🎟️ 다음 ×1 구매 −' + c.pct + '%!')
        : ('🎟️ 쿠폰 켰어요 · ×1 구매에만 −' + c.pct + '% 적용돼요'));
      else toast('쿠폰 사용을 껐어요');
      refresh(true);   // 무장 상태 + 할인가 미리보기를 다시 그린다
    });

    el.truckPop.addEventListener('click', grabTruckUI);
    el.craftReco.addEventListener('click', function () {
      var b = Game.bestCraft();
      if (!b) { toast('재료가 부족해요'); return; }
      onCraft(b.id);   // 합성·토스트·다시그리기는 기존 경로 그대로
    });
    el.specialCard.addEventListener('click', onSpecialClaim);
    el.gradeTabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-grade]');
      if (!b) return;
      currentGrade = +b.dataset.grade;
      Array.prototype.forEach.call(el.gradeTabs.children, function (o) { o.classList.toggle('active', o === b); });
      sig.kitchen = '';
      renderKitchen();
    });

    el.boostBtn.addEventListener('click', function () {
      var st = State.get();
      if (st.boostLeft > 0) { toast('이미 손님이 몰려 있습니다'); return; }
      if (st.boostCd > 0) { toast('준비까지 ' + Fmt.time(st.boostCd) + ' 남았습니다'); return; }
      if (Game.startBoost()) {
        Sound.play('boost');
        buzz(20);
        toast('📣 ' + Data.BOOST.dur + '초 동안 수익 ×' + Data.BOOST.mult + '!');
        refresh(true);
      }
    });

    onGolden = handlers.onGolden;
    onThief = handlers.onThief;
    michTapFn = handlers.onTap;

    // 스타 셰프 심사 조리 버튼
    if (window.PointerEvent) el.michTap.addEventListener('pointerdown', michTapPress);
    else { el.michTap.addEventListener('touchstart', michTapPress, { passive: false });
           el.michTap.addEventListener('mousedown', michTapPress); }
    el.michTap.addEventListener('keydown', function (ev) {
      if (ev.key !== ' ' && ev.key !== 'Enter') return;
      if (ev.repeat) return; ev.preventDefault(); michTapPress(ev);
    });
    el.michDone.addEventListener('click', closeMichelinResult);
    el.michShareResult.addEventListener('click', function () { shareMichelin(); });
    el.michQuit.addEventListener('click', quitMichelin);

    el.adQuit.addEventListener('click', function () {
      closeAd();
      toast('광고를 끝까지 봐야 보상을 받아요');
    });

    el.muteBtn.addEventListener('click', function () {
      Sound.setMuted(!Sound.muted());
      updateMuteBtn();
      State.save();
      if (!Sound.muted()) Sound.play('buy');
    });
    el.notifyBtn.addEventListener('click', function () {
      var s = State.get();
      if (!('Notification' in window)) { toast('이 기기는 알림을 지원하지 않아요'); return; }
      if (s.notifyOffline === 1) {                 // 끄기
        s.notifyOffline = 0; State.save(); updateNotifyBtn();
        toast('오프라인 알림을 껐습니다'); return;
      }
      // 켜기 — 권한을 물어본다 (버튼 클릭이라 제스처 안에서 호출된다)
      if (Notification.permission === 'granted') {
        s.notifyOffline = 1; State.save(); updateNotifyBtn();
        toast('오프라인 보상이 가득 차면 알려드릴게요');
      } else if (Notification.permission === 'denied') {
        toast('브라우저 설정에서 알림을 허용해 주세요');
      } else {
        Notification.requestPermission().then(function (perm) {
          if (perm === 'granted') {
            s.notifyOffline = 1; State.save();
            toast('오프라인 보상이 가득 차면 알려드릴게요');
          } else {
            toast('알림 권한이 없어 켜지 못했습니다');
          }
          updateNotifyBtn();
        });
      }
    });
    el.helpBtn.addEventListener('click', function () { showTour(0); });
    el.powerSaveBtn.addEventListener('click', enterPowerSave);
    el.powerSaveExit.addEventListener('click', exitPowerSave);
    el.noticeBtn.addEventListener('click', showNotices);
    el.noticeClose.addEventListener('click', function () { el.noticeModal.hidden = true; });
    el.mailBtn.addEventListener('click', showMail);
    el.mailClose.addEventListener('click', function () { el.mailModal.hidden = true; });
    el.shopBtn.addEventListener('click', showShop);
    el.shopClose.addEventListener('click', function () { el.shopModal.hidden = true; });

    // 테스트 도구 (테스트 빌드 전용 — 정식 버전에서는 index.html 에서 통째로 뺀다)
    [['dbgHour', 'hour'], ['dbgDay', 'day'],
     ['dbgMoney', 'money'], ['dbgFame', 'fame']].forEach(function (pair) {
      var node = el[pair[0]];
      if (node) node.addEventListener('click', function () { handlers.onDebug(pair[1]); });
    });

    el.prestigeBtn.addEventListener('click', handlers.onPrestige);
    el.saveBtn.addEventListener('click', handlers.onSave);
    el.exportBtn.addEventListener('click', handlers.onExport);
    el.importBtn.addEventListener('click', handlers.onImport);
    el.resetBtn.addEventListener('click', handlers.onReset);
  }

  /** 조리 중일 땐 냄비에서 김이 오르게 */
  function buildSteam() {
    ['', 's2', 's3'].forEach(function (c) {
      var d = document.createElement('div');
      d.className = 'steam ' + c;
      el.tapTarget.appendChild(d);
    });
  }

  /* ---------- 가로 목록을 잡아끌어 밀기 ---------- */
  // 스크롤바는 숨겨 두고, 손가락·마우스 둘 다 잡아끌어 밀 수 있게 한다.
  // 터치는 브라우저 기본 스크롤이 이미 되니 마우스/펜만 직접 처리한다.
  function enableDragScroll(row) {
    if (!row || row._drag) return;
    row._drag = true;
    var wrap = row.parentNode;

    // 끝까지 밀면 오른쪽 페이드 힌트를 끈다
    function syncEnd() {
      if (!wrap || !wrap.classList.contains('skin-wrap')) return;
      var atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      wrap.classList.toggle('at-end', atEnd);
    }
    row.addEventListener('scroll', syncEnd, { passive: true });
    setTimeout(syncEnd, 0);

    var down = false, moved = false, captured = false, startX = 0, startLeft = 0, pid = null;

    row.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;      // 터치는 기본 스크롤에 맡긴다
      down = true; moved = false; captured = false;
      startX = e.clientX; startLeft = row.scrollLeft; pid = e.pointerId;
      // 여기서 곧바로 캡처하면 click 이 카드가 아니라 목록으로 가서 선택이 안 된다.
      // 실제로 밀기 시작(임계값 초과)한 뒤에만 캡처한다.
    });
    row.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        try { row.setPointerCapture(pid); captured = true; } catch (x) {}
      }
      if (moved) row.scrollLeft = startLeft - dx;
    });
    function end() {
      down = false;
      try { if (captured && pid !== null) row.releasePointerCapture(pid); } catch (x) {}
      captured = false; pid = null;
      // 밀고 난 직후의 click 은 카드 선택으로 새지 않게 잠깐 막는다
      if (moved) setTimeout(function () { moved = false; }, 0);
    }
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
    // 드래그였으면 카드 click 을 삼킨다 (선택 방지)
    row.addEventListener('click', function (e) {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);
  }

  function init(handlers) {
    cache();
    applyTheme(State.get().theme);   // 저장된 테마를 화면에 먼저 입힌다
    buildSteam();
    Scene.init(el.street, el.pops);
    buildGenList();
    bind(handlers);
    bindSheet();
    [el.tapSoundRow, el.tapSkinRow, el.crowdSkinRow, el.themeRow].forEach(enableDragScroll);
    bindTour();
    setSheet(sheetUp(), false);
    Sound.arm();
    armGolden();
    armThief();
    showTab('shop');
  }

  return {
    init: init,
    refresh: refresh,
    updateHud: updateHud,
    showTab: showTab,
    showOffline: showOffline,
    showDaily: showDaily,
    ask: ask,
    textDialog: textDialog,
    refreshSaveGuard: refreshSaveGuard,
    showTour: showTour,
    setSheet: setSheet,
    tickWorld: tickWorld,
    toast: toast,
    powerSaveOn: powerSaveOn,
    updatePowerSave: updatePowerSave,
    invalidate: function () { sig = {}; buffSig = ''; lookSig = ''; skinSig = ''; }
  };
})();
