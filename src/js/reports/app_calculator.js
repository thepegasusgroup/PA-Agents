// ── Reports app: Calculator ──
// Standard 4-function: enter operand, pick operator, enter next operand, =.
// State lives on Reports._calc — preserved across re-renders so re-opening
// the app keeps the current display. Plus/minus toggles sign, % divides by
// 100, C clears display, AC resets everything.

Reports._calc = {
  display: '0',
  prev: null,
  op: null,
  justEvaluated: false,  // true right after =, so next digit replaces display
};

Reports._renderCalculator = function () {
  this.titleEl.textContent = 'Calculator';

  // Operator buttons use orange; clear/sign/% use light gray; digits use dark.
  const keys = [
    [{ t: 'AC', k: 'ac', c: 'fn' }, { t: '+/−', k: 'neg', c: 'fn' }, { t: '%', k: 'pct', c: 'fn' }, { t: '÷', k: 'div', c: 'op' }],
    [{ t: '7', k: '7' }, { t: '8', k: '8' }, { t: '9', k: '9' }, { t: '×', k: 'mul', c: 'op' }],
    [{ t: '4', k: '4' }, { t: '5', k: '5' }, { t: '6', k: '6' }, { t: '−', k: 'sub', c: 'op' }],
    [{ t: '1', k: '1' }, { t: '2', k: '2' }, { t: '3', k: '3' }, { t: '+', k: 'add', c: 'op' }],
    [{ t: '0', k: '0', wide: true }, { t: '.', k: 'dot' }, { t: '=', k: 'eq', c: 'op' }],
  ];

  let html = `<div class="rp-calc">
    <div class="rp-calc-display" id="rpCalcDisplay">${this._esc(this._calc.display)}</div>
    <div class="rp-calc-keys">`;
  for (const row of keys) {
    for (const key of row) {
      const cls = 'rp-calc-key' + (key.c ? ' ' + key.c : '') + (key.wide ? ' wide' : '');
      html += `<button class="${cls}" data-k="${key.k}">${key.t}</button>`;
    }
  }
  html += '</div></div>';
  this.content.innerHTML = html;

  this.content.querySelectorAll('.rp-calc-key').forEach(btn => {
    btn.addEventListener('click', () => this._calcPress(btn.dataset.k));
  });
};

Reports._calcUpdateDisplay = function () {
  const el = document.getElementById('rpCalcDisplay');
  if (el) el.textContent = this._calc.display;
};

// Format a number for display: cap at 12 significant digits, strip trailing
// zeros after the decimal point, fall back to exponential for very large/small.
Reports._calcFormat = function (n) {
  if (!isFinite(n)) return 'Error';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12 || (abs < 1e-6 && abs > 0)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  // Up to 10 fractional digits, trimmed
  let str = n.toPrecision(12);
  if (str.includes('.')) str = str.replace(/\.?0+$/, '');
  return str;
};

Reports._calcCompute = function (a, b, op) {
  switch (op) {
    case 'add': return a + b;
    case 'sub': return a - b;
    case 'mul': return a * b;
    case 'div': return b === 0 ? Infinity : a / b;
  }
  return b;
};

Reports._calcPress = function (key) {
  const c = this._calc;
  const isDigit = /^[0-9]$/.test(key);

  if (isDigit) {
    if (c.display === '0' || c.justEvaluated || c._awaitingOperand) {
      c.display = key;
      c.justEvaluated = false;
      c._awaitingOperand = false;
    } else if (c.display.replace('-', '').length < 12) {
      c.display += key;
    }
  } else if (key === 'dot') {
    if (c.justEvaluated || c._awaitingOperand) {
      c.display = '0.';
      c.justEvaluated = false;
      c._awaitingOperand = false;
    } else if (!c.display.includes('.')) {
      c.display += '.';
    }
  } else if (key === 'ac') {
    c.display = '0';
    c.prev = null;
    c.op = null;
    c.justEvaluated = false;
    c._awaitingOperand = false;
  } else if (key === 'neg') {
    if (c.display !== '0') {
      c.display = c.display.startsWith('-') ? c.display.slice(1) : '-' + c.display;
    }
  } else if (key === 'pct') {
    const n = parseFloat(c.display) / 100;
    c.display = this._calcFormat(n);
    c.justEvaluated = true;
  } else if (['add', 'sub', 'mul', 'div'].includes(key)) {
    const current = parseFloat(c.display);
    if (c.prev !== null && c.op && !c._awaitingOperand) {
      // Chain operations: evaluate the pending op first
      const result = this._calcCompute(c.prev, current, c.op);
      c.display = this._calcFormat(result);
      c.prev = result;
    } else {
      c.prev = current;
    }
    c.op = key;
    c._awaitingOperand = true;
    c.justEvaluated = false;
  } else if (key === 'eq') {
    if (c.prev !== null && c.op) {
      const current = parseFloat(c.display);
      const result = this._calcCompute(c.prev, current, c.op);
      c.display = this._calcFormat(result);
      c.prev = null;
      c.op = null;
      c.justEvaluated = true;
      c._awaitingOperand = false;
    }
  }

  this._calcUpdateDisplay();
};
