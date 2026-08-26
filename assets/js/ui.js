/* 화면 그리기 / 입력 처리 */
var UI = (function () {

  var el = {};
  var currentTab = 'shop';
  var buyAmt = 1;          // 1 | 10 | 'max'
  var sig = {};            // 목록 재생성 여부 판단용 서명
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }

  function cache() {
    ['money', 'rate', 'fameChip', 'multChip', 'tapZone', 'tapTarget', 'tapPower',
     'genList', 'upgradeList', 'upgradeHint', 'fameShopList', 'achvList', 'statsBox',
     'questList',
     'pFameNow', 'pFameGain', 'pMultNext', 'prestigeBtn', 'prestigeReq',
     'dotUpgrade', 'dotPrestige', 'dotAchv', 'buyAmt', 'toast',
     'offlineModal', 'offlineText', 'offlineOk',
     'buffBar', 'partyBanner', 'partyHint', 'partyDex', 'combo', 'comboX', 'comboN', 'comboFill',
     'boostBtn', 'boostTitle', 'boostSub', 'goldenLayer', 'street', 'pops',
     'dailyModal', 'dailyText', 'streakDots', 'dailyOk',
     'tapEmoji', 'tapLabel', 'recordBox', 'runBoard', 'rankNote',
     'rankRegion', 'rankCard', 'rankHeads', 'rankBoard',
     'tapSkinRow', 'tapSkinNow', 'tapLadder', 'tapSoundRow', 'tapSoundNow',
     'crowdSkinRow', 'crowdSkinNow', 'crowdLadder',
     'shopPage', 'shopTop', 'shopSheet', 'sheetHandle', 'sheetHint', 'sheetBody',
     'tourModal', 'tourEmoji', 'tourTitle', 'tourText', 'tourDots', 'tourNext', 'tourSkip',
     'muteBtn', 'helpBtn',
     'askModal', 'askEmoji', 'askTitle', 'askText', 'askOk', 'askCancel',
     'textModal', 'textEmoji', 'textTitle', 'textDesc', 'textInput', 'textOk', 'textCancel',
     'saveBtn', 'exportBtn', 'importBtn', 'resetBtn'].forEach(function (id) {
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

  function makeItem(iconText, opts) {
    // div + click 이면 키보드로 살 수 없고 스크린리더가 버튼으로 읽지 않는다.
    // 누를 수 있는 행은 button, 보여주기만 하는 행(도전과제)은 div 로 만든다.
    var row = document.createElement(opts && opts.static ? 'div' : 'button');
    if (row.tagName === 'BUTTON') row.type = 'button';
    row.className = 'item';
    row.innerHTML =
      '<div class="item-icon"></div>' +
      '<div class="item-body">' +
        '<div class="item-name"><span class="nm"></span><span class="item-lv" hidden></span></div>' +
        '<div class="item-desc"></div>' +
      '</div>' +
      '<div class="item-cost"></div>';
    row.querySelector('.item-icon').textContent = iconText;
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
      var row = makeItem(g.icon);
      row.dataset.gen = g.id;
      row.addEventListener('click', function () { onBuyGen(g.id); });
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

    Data.GENERATORS.forEach(function (g, i) {
      var r = genRows[g.id];
      if (!r) return;
      if (i >= visible) { r.row.hidden = true; return; }
      r.row.hidden = false;

      var count = Game.genCount(g.id);
      var unlocked = Game.genUnlocked(g.id);
      var amt = amountFor(g.id);
      var cost = Game.genCost(g.id, amt);
      var canBuy = unlocked && money >= cost;

      r.p.nm.textContent = unlocked ? g.name : '???';
      if (count > 0) {
        r.p.lv.hidden = false;
        r.p.lv.textContent = count + '개';
      } else {
        r.p.lv.hidden = true;
      }

      if (!unlocked) {
        r.p.desc.textContent = '이전 설비를 1개 구매하면 열립니다';
      } else if (count > 0) {
        r.p.desc.textContent = '초당 ' + Fmt.rate(Game.genRate(g.id)) + '원 (전체의 ' + sharePct(g.id) + ')';
      } else {
        r.p.desc.textContent = g.desc;
      }

      r.p.cost.innerHTML = Fmt.num(cost) + '<small>' +
        (buyAmt === 'max' ? (canBuy ? '×' + amt : '×1') : '×' + amt) + '</small>';
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
    var amt = amountFor(id);
    if (buyAmt === 'max') {
      amt = Game.maxAffordable(id);
      if (amt < 1) { toast('돈이 부족합니다'); return; }
    }
    if (Game.buyGen(id, amt)) {
      Sound.play('buy');
      buzz(8);
      refresh(true);
    } else {
      toast('돈이 부족합니다');
    }
  }

  /* ---------- 업그레이드 목록 ---------- */

  function renderUpgrades() {
    var list = Game.availableUpgrades();
    var newSig = list.map(function (u) { return u.id; }).join(',');

    if (sig.up !== newSig) {
      sig.up = newSig;
      el.upgradeList.innerHTML = '';
      list.forEach(function (u) {
        var row = makeItem(u.icon);
        row.dataset.up = u.id;
        var p = parts(row);
        p.nm.textContent = u.name;
        p.desc.textContent = u.desc;
        row.addEventListener('click', function () {
          if (Game.buyUpgrade(u.id)) {
            Sound.play('upgrade');
            buzz(12);
            toast(u.name + ' 구매!');
            refresh(true);
          } else {
            toast('돈이 부족합니다');
          }
        });
        el.upgradeList.appendChild(row);
      });
      el.upgradeHint.textContent = list.length
        ? '한 번만 구매하면 영구적으로 적용됩니다. (환생 시 초기화)'
        : '조리를 더 하거나 설비를 늘리면 새 업그레이드가 열립니다.';
    }

    var money = State.get().money;
    Array.prototype.forEach.call(el.upgradeList.children, function (row) {
      var u = Game.UP_BY_ID[row.dataset.up];
      if (!u) return;
      var ok = money >= u.cost;
      var costEl = row.querySelector('.item-cost');
      costEl.textContent = Fmt.num(u.cost);
      costEl.className = 'item-cost ' + (ok ? 'ok' : 'no');
      row.className = 'item' + (ok ? ' buyable' : '');
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
        var row = makeItem(f.icon);
        row.dataset.fame = f.id;
        var p = parts(row);
        var lv = Game.fameLv(f.id);
        p.nm.textContent = f.name;
        p.lv.hidden = false;
        p.lv.textContent = 'Lv.' + lv + '/' + f.max;
        p.desc.textContent = f.desc;
        row.addEventListener('click', function () {
          if (Game.fameLv(f.id) >= f.max) { toast('이미 최대 레벨입니다'); return; }
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
      var maxed = lv >= f.max;
      var cost = Game.fameCost(f.id, lv);
      var ok = !maxed && s.fame >= cost;
      var costEl = row.querySelector('.item-cost');
      costEl.innerHTML = maxed ? 'MAX' : ('✨' + Fmt.num(cost));
      costEl.className = 'item-cost ' + (maxed ? '' : (ok ? 'ok' : 'no'));
      row.className = 'item' + (ok ? ' buyable' : '') + (maxed ? ' owned' : '');
    });
  }

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
            '<span class="dex-ic">' + (mine ? f.icon : '❔') + '</span>' +
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

    // 위쪽 요약 — 전국 / 지역 순위
    el.rankHeads.innerHTML =
      head('전국', '🇰🇷', nat.rank, nat.total, '상위 ' + nat.pct + '%') +
      head(reg.region.name, '📍', reg.rank, reg.total, reg.region.name + ' 안에서');

    function head(label, ic, rank, total, sub) {
      return '<div class="rank-head">' +
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
      return '<div class="rec"><span class="rec-ic">' + r.icon + '</span>' +
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

    // 달성 개수가 바뀌면 목록을 새로 짓는다 (달성/미달성 모양이 다르므로)
    if (sig.achv !== done) {
      sig.achv = done;
      el.achvList.innerHTML = '';
      achvRows = {};
      Data.ACHIEVEMENTS.forEach(function (a) {
        var got = !!s.achievements[a.id];
        var row = makeItem(got ? a.icon : '🔒', { static: true });
        var p = parts(row);
        p.nm.textContent = a.name;
        p.desc.textContent = a.desc;
        if (got) {
          p.cost.innerHTML = '<span class="achv-check">✔</span>';
          row.className = 'item achv-done';
        } else {
          // 잠긴 항목은 진행도(1,538 / 10,000)와 막대를 보여준다
          var bar = document.createElement('div');
          bar.className = 'qbar';
          bar.innerHTML = '<i></i>';
          p.desc.appendChild(bar);
          p.cost.innerHTML = '<span class="achv-prog"></span>';
          row.className = 'item achv-locked';
          achvRows[a.id] = { def: a, bar: bar.firstChild, txt: p.cost.firstChild };
        }
        el.achvList.appendChild(row);
      });
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

  /* ---------- 환생 화면 ---------- */

  function renderPrestige() {
    var s = State.get();
    var gain = Game.fameGain();

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
    el.muteBtn.textContent = Sound.muted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐';
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
      ['오프라인 인정 시간', Fmt.time(Game.offlineCapSeconds())],
      ['오프라인 효율', Math.round(Game.offlineEfficiency() * 100) + '%'],
      ['총 플레이 시간', Fmt.time(s.playTime)]
    ];
    el.statsBox.innerHTML = rows.map(function (r) {
      return '<div class="stat-row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>';
    }).join('');
  }

  /* ---------- HUD ---------- */

  function updateHud() {
    var s = State.get();
    el.money.textContent = Fmt.won(s.money);
    el.rate.textContent = '초당 ' + Fmt.rate(Game.perSec()) + ' 원';
    el.fameChip.textContent = '✨ 명성 ' + Fmt.num(s.fame);
    el.multChip.textContent = Fmt.mult(Game.globalMult());
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
      var ct = Game.crowdTier();
      ladderEl.innerHTML = cur.tiers.map(function (tr, i) {
        var cls = i < ct.index ? 'done' : (i === ct.index ? 'now' : '');
        return '<span class="rung ' + cls + '" title="' + tr.name + '">' +
               tr.cast[0] + (tr.acc.length ? '<u>' + tr.acc[0] + '</u>' : '') + '</span>';
      }).join('');
      var nxt = cur.tiers[ct.index + 1];
      ladderEl.innerHTML += '<span class="rung-note"><b>' + ct.name + '</b>' + (nxt
        ? ' · 다음은 ' + nxt.name + ' (초당 ' + Fmt.won(nxt.at) + ')'
        : ' · 마지막 등급입니다') + '</span>';
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
        b.querySelector('.skin-ic').textContent = t.icon;
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
    node.textContent = type.icon;
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
      '초당 수익 ' + Fmt.time(res.seconds) + '치 — <b>' + Fmt.won(res.gain) + '</b>';

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

  function refresh(force) {
    updateHud();
    if (currentTab === 'shop') updateGenList();
    else if (currentTab === 'upgrade') { renderUpgrades(); renderAchievements(); }
    else if (currentTab === 'prestige') { renderPrestige(); renderFameShop(); }
    else if (currentTab === 'achv') { renderQuests(); renderPartyDex(); renderRanking(); renderHallOfFame(); }
    else if (currentTab === 'settings') { renderStats(); renderSkins(); renderTapSound(); updateMuteBtn(); }
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
    var lost = reward.seconds - reward.capped;
    var txt = '자리를 비운 ' + Fmt.time(reward.seconds) + ' 동안<br>' +
              '<b>' + Fmt.won(reward.gain) + '</b>을 벌었습니다.';
    if (lost > 60) {
      txt += '<br><span style="font-size:12px">(최대 ' + Fmt.time(reward.capped) +
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
        toast('🎉 파티 음식 발견! ' + found.icon + ' ' + found.name);
        floatText(x, y - 26, found.icon);
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
        updateGenList();
      });
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

    el.muteBtn.addEventListener('click', function () {
      Sound.setMuted(!Sound.muted());
      updateMuteBtn();
      State.save();
      if (!Sound.muted()) Sound.play('buy');
    });
    el.helpBtn.addEventListener('click', function () { showTour(0); });

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
    buildSteam();
    Scene.init(el.street, el.pops);
    buildGenList();
    bind(handlers);
    bindSheet();
    [el.tapSoundRow, el.tapSkinRow, el.crowdSkinRow].forEach(enableDragScroll);
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
    showTour: showTour,
    setSheet: setSheet,
    tickWorld: tickWorld,
    toast: toast,
    invalidate: function () { sig = {}; buffSig = ''; lookSig = ''; skinSig = ''; }
  };
})();
