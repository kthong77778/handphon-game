/* 숫자 / 시간 표기 유틸 */
var Fmt = (function () {

  // 한국식 큰 수 단위 (1만 배씩 올라감)
  var UNIT_TABLE = [
    { v: 1e48, s: '극' },
    { v: 1e44, s: '재' },
    { v: 1e40, s: '정' },
    { v: 1e36, s: '간' },
    { v: 1e32, s: '구' },
    { v: 1e28, s: '양' },
    { v: 1e24, s: '자' },
    { v: 1e20, s: '해' },
    { v: 1e16, s: '경' },
    { v: 1e12, s: '조' },
    { v: 1e8, s: '억' },
    { v: 1e4, s: '만' }
  ];

  function comma(n) {
    return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function trim(x) {
    // 자릿수에 따라 소수점 개수 조절
    var d = x < 10 ? 2 : (x < 100 ? 1 : 0);
    var s = x.toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    return s;
  }

  /** 큰 수를 한국식 단위로 (예: 1.23억) */
  function num(n) {
    if (n === null || n === undefined || !isFinite(n)) return '0';
    if (n < 0) return '-' + num(-n);
    if (n < 1e4) return comma(n);
    if (n >= 1e52) return n.toExponential(2).replace('e+', 'e');
    for (var i = 0; i < UNIT_TABLE.length; i++) {
      var u = UNIT_TABLE[i];
      if (n >= u.v) return trim(n / u.v) + u.s;
    }
    return comma(n);
  }

  /** 초당 수치처럼 작은 값도 보여줘야 하는 경우 */
  function rate(n) {
    if (!isFinite(n) || n <= 0) return '0';
    if (n < 1) return n.toFixed(2);
    if (n < 100) return n.toFixed(1);
    return num(n);
  }

  /** 돈 표기 */
  function won(n) {
    return num(n) + ' 원';
  }

  /** 초 -> "1시간 23분" */
  function time(sec) {
    sec = Math.max(0, Math.floor(sec));
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (d > 0) return d + '일 ' + h + '시간';
    if (h > 0) return h + '시간 ' + m + '분';
    if (m > 0) return m + '분 ' + s + '초';
    return s + '초';
  }

  /** 배율 표기 (×1.25) */
  function mult(x) {
    if (x >= 1000) return '×' + num(x);
    return '×' + x.toFixed(2);
  }

  return { num: num, rate: rate, won: won, time: time, mult: mult, comma: comma };
})();
