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
     'pFameNow', 'pFameGain', 'pMultNext', 'prestigeBtn', 'prestigeReq',
     'dotUpgrade', 'dotPrestige', 'buyAmt', 'toast',
     'offlineModal', 'offlineText', 'offlineOk',
     'buffBar', 'combo', 'comboX', 'comboN', 'comboFill',
     'boostBtn', 'boostTitle', 'boostSub', 'goldenLayer', 'street', 'pops',
     'dailyModal', 'dailyText', 'streakDots', 'dailyOk',
     'tapEmoji', 'tapLabel', 'recordBox', 'runBoard', 'rankNote',
     'tapSkinRow', 'tapSkinNow', 'tapLadder',
     'crowdSkinRow', 'crowdSkinNow', 'crowdLadder',
     'saveBtn', 'exportBtn', 'importBtn', 'resetBtn',
     'dbgHour', 'dbgDay', 'dbgMoney', 'dbgFame'].forEach(function (id) {
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

  function makeItem(iconText) {
    var row = document.createElement('div');
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

  /* ---------- 도전과제 ---------- */

  function renderAchievements() {
    var s = State.get();
    var done = Object.keys(s.achievements).length;
    if (sig.achv === done) return;
    sig.achv = done;

    el.achvList.innerHTML = '';
    Data.ACHIEVEMENTS.forEach(function (a) {
      var got = !!s.achievements[a.id];
      var row = makeItem(got ? a.icon : '🔒');
      var p = parts(row);
      p.nm.textContent = a.name;
      p.desc.textContent = a.desc;
      p.cost.innerHTML = got ? '<span class="achv-check">✔</span>' : '<small>+1%</small>';
      row.className = 'item ' + (got ? 'achv-done' : 'achv-locked');
      el.achvList.appendChild(row);
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

    updateBuffBar();
    updateCombo();
    updateBoostBtn();
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
      buzz(28);
      finish('caught', res);
    });

    toast('🚨 도둑이다! 탭해서 잡으세요');
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
        finish('police', res);
      }, T.life * T.policeCatchAt * 1000));
    }

    // 놓침
    timers.push(setTimeout(function () {
      if (settled) return;
      var res = Game.thiefEscaped(amount);
      toast('💸 도둑에게 ' + Fmt.won(res.lost) + '을 털렸습니다');
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
    $('view').scrollTop = 0;
    refresh(true);
  }

  /* ---------- 전체 갱신 ---------- */

  function refresh(force) {
    updateHud();
    if (currentTab === 'shop') updateGenList();
    else if (currentTab === 'upgrade') renderUpgrades();
    else if (currentTab === 'prestige') { renderPrestige(); renderFameShop(); }
    else if (currentTab === 'achv') { renderHallOfFame(); renderAchievements(); }
    else if (currentTab === 'settings') { renderStats(); renderSkins(); }
    if (force) { /* 강제 갱신 시 별도 처리 없음 */ }
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
      var x = (pt.clientX || rect.width / 2) - rect.left;
      var y = (pt.clientY || rect.height / 2) - rect.top;

      // isTrusted 가 false 면 스크립트가 만들어낸 가짜 입력이다.
      // 좌표도 함께 넘겨야 매크로 판정이 간격만 보고 사람을 막지 않는다.
      var res = handlers.onTap(ev.isTrusted !== false, x, y);
      if (res.blocked) { showBlocked(res.blocked); return; }

      el.tapTarget.classList.add('hit');
      setTimeout(function () { el.tapTarget.classList.remove('hit'); }, 70);

      floatText(x, y, '+' + Fmt.num(res.value));
      Scene.popFood();
      buzz(6);
      updateHud();
    };
    // pointerdown 하나로 터치/마우스를 모두 처리 (중복 입력 방지)
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
        buzz(20);
        toast('📣 ' + Data.BOOST.dur + '초 동안 수익 ×' + Data.BOOST.mult + '!');
        refresh(true);
      }
    });

    onGolden = handlers.onGolden;
    onThief = handlers.onThief;

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

  function init(handlers) {
    cache();
    buildSteam();
    Scene.init(el.street, el.pops);
    buildGenList();
    bind(handlers);
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
    tickWorld: tickWorld,
    toast: toast,
    invalidate: function () { sig = {}; buffSig = ''; lookSig = ''; skinSig = ''; }
  };
})();
