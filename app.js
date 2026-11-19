// app.js: reads the CSV files, runs the math in capstruct.js and fills the page.
(function () {
  'use strict';
  const C = window.CapStruct;

  // ---------- Formatting (half up on the decimal value, via C.round) ----------
  function withCommas(x, d) {
    const r = C.round(x, d);
    const neg = r < 0;
    const parts = Math.abs(r).toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + parts.join('.');
  }
  const dollars = x => (x < 0 ? '−$' + withCommas(-x, 0) : '$' + withCommas(x, 0));
  const cents = x => '$' + withCommas(x, 2);
  const pct = x => withCommas(x * 100, 2) + '%';
  const mult = x => (x === null ? 'n/a' : withCommas(x, 2) + '×');
  const shares = x => withCommas(x, 2);

  function stakeText(s) {
    if (s.status === 'must_sell') return 'Mgmt would have to sell';
    if (s.status === 'all_outside_gone') return '100.00%*';
    return pct(s.value);
  }

  // ---------- Loading ----------
  async function loadCSV(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Could not read ' + path);
    return C.parseCSV(await res.text());
  }

  async function loadAll() {
    const [cdssRows, assumptions, schedule, firms, scenarios] = await Promise.all([
      loadCSV('data/cdss.csv'),
      loadCSV('data/assumptions.csv'),
      loadCSV('data/banker_schedule.csv'),
      loadCSV('data/example_firms.csv'),
      loadCSV('data/ebit_scenarios.csv')
    ]);
    return {
      cdss: C.keyValue(cdssRows, 'item'),
      T: C.keyValue(assumptions, 'assumption').tax_rate,
      schedule: schedule.map(r => ({
        debt: C.num(r.debt), cost_of_debt: C.num(r.cost_of_debt), cost_of_equity: C.num(r.cost_of_equity)
      })),
      firms: C.keyValue(firms, 'item'),
      scenarios: scenarios.map(r => ({
        probability: C.num(r.probability), sales: C.num(r.sales), operating_costs: C.num(r.operating_costs)
      }))
    };
  }

  // ---------- Table helper ----------
  // selCol: index of a data column to highlight (0 = first column after the label), or null.
  function fillTable(table, header, rows, selCol) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const sel = i => (selCol !== undefined && selCol !== null && i === selCol + 1 ? ' class="sel"' : '');
    let html = '<thead><tr>' + header.map((h, i) => '<th' + sel(i) + '>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>';
    rows.forEach(r => {
      const cls = r.cls ? ' class="' + r.cls + '"' : '';
      if (r.group) {
        html += '<tr class="group"><td colspan="' + header.length + '">' + esc(r.group) + '</td></tr>';
      } else {
        html += '<tr' + cls + '>' + r.cells.map((c, i) => '<td' + sel(i) + '>' + esc(c) + '</td>').join('') + '</tr>';
      }
    });
    table.innerHTML = html + '</tbody>';
  }

  // ---------- Firm U and Firm L ----------
  function renderFirms(d, debtL) {
    const f = d.firms;
    const U = C.exampleFirm(d.scenarios, f.total_assets, 0, f.interest_rate, d.T);
    const L = C.exampleFirm(d.scenarios, f.total_assets, debtL, f.interest_rate, d.T);

    document.getElementById('firml-debt-value').textContent = dollars(debtL) +
      (debtL === f.firm_l_debt ? ' (the case)' : '');
    document.getElementById('firms-note').textContent =
      'Both firms have ' + dollars(f.total_assets) + ' of assets and a ' + pct(d.T) + ' tax rate. Firm L has ' +
      dollars(debtL) + ' of debt. The interest rate is held at ' + pct(f.interest_rate) +
      ' at every amount, so the slider shows what debt does to Firm L\'s return and risk, not how lenders would respond. ' +
      'ROE uses book equity (assets − debt).';

    const header = ['', ...U.years.map(y => 'U · p=' + y.probability), ...L.years.map(y => 'L · p=' + y.probability)];
    const line = (label, fn) => ({ cells: [label, ...U.years.map(fn), ...L.years.map(fn)] });
    const neg = x => (x === 0 ? '$0' : '(' + dollars(x) + ')');
    fillTable(document.getElementById('firms-years'), header, [
      { cells: ['Equity', ...U.years.map(() => dollars(U.equity)), ...L.years.map(() => dollars(L.equity))] },
      line('Sales', y => dollars(y.sales)),
      line('Oper. costs', y => neg(y.operatingCosts)),
      line('EBIT', y => dollars(y.ebit)),
      line('Interest', y => neg(y.interest)),
      line('EBT', y => dollars(y.ebt)),
      line('Taxes', y => neg(y.taxes)),
      line('Net income', y => dollars(y.netIncome)),
      line('ROE', y => pct(y.roe)),
      line('TIE', y => mult(y.tie))
    ]);

    fillTable(document.getElementById('firms-summary'), ['', 'Firm U', 'Firm L'], [
      { cells: ['E(ROE)', pct(U.eRoe), pct(L.eRoe)] },
      { cells: ['σ(ROE)', pct(U.sdRoe), pct(L.sdRoe)] },
      { cells: ['CV', mult(U.cv).replace('×', ''), mult(L.cv).replace('×', '')] },
      { cells: ['E(TIE)', mult(U.eTie), mult(L.eTie)] },
      { cells: ['σ(TIE)', mult(U.sdTie), mult(L.sdTie)] }
    ]);
  }

  // ---------- CDSS ----------
  // sel: index of the banker's row picked on the debt slider (highlighted in both tables).
  function renderCdss(d, rows, sel) {
    const s = C.summary(rows);
    const ebit = C.cdssEbit(d.cdss);

    document.getElementById('cdss-note').textContent =
      'EBIT = ' + dollars(d.cdss.sales) + ' × (1 − ' + pct(d.cdss.variable_cost_rate) + ') − ' +
      dollars(d.cdss.fixed_costs) + ' = ' + dollars(ebit) + ' at every amount of debt. ' +
      withCommas(d.cdss.shares_outstanding, 0) + ' shares at ' + cents(d.cdss.share_price) +
      ' today; book assets ' + dollars(d.cdss.total_assets) + '; management owns ' +
      pct(d.cdss.management_share) + '. All earnings are paid out, so dividends per share = EPS.';

    const zc = C.zeroDebtCheck(d.cdss, rows);
    document.getElementById('zero-check').innerHTML = zc.ok
      ? '<p class="ok">Check passed: EPS ÷ r_s with no debt = ' + cents(zc.price) + ', today\'s price.</p>'
      : '<p class="warning">Warning: with no debt, EPS ÷ r_s = ' + (zc.price ? cents(zc.price) : 'n/a') +
        ', which does not equal today\'s price of ' + cents(d.cdss.share_price) + '. Check the schedule.</p>';

    const header = ['Debt', ...rows.map(r => dollars(r.debt))];
    const rdText = r => (r.rd === null ? '—' : pct(r.rd));
    const common = [
      { cells: ['r_d', ...rows.map(rdText)] },
      { cells: ['r_s', ...rows.map(r => pct(r.rs))] },
      { cells: ['Interest', ...rows.map(r => dollars(r.interest))] },
      { cells: ['Net income', ...rows.map(r => dollars(r.netIncome))] }
    ];
    const mark = i => (i === s.bestPriceCase ? '★' : '');

    fillTable(document.getElementById('case-table'), header, [
      ...common,
      { cells: ['Shares repurchased', ...rows.map(r => shares(r.caseMethod.repurchased))] },
      { cells: ['Shares remaining', ...rows.map(r => shares(r.caseMethod.remaining))] },
      { cells: ['EPS (= DPS)', ...rows.map(r => cents(r.caseMethod.eps))] },
      { cells: ['TIE', ...rows.map(r => mult(r.tie))] },
      { cells: ['Share price', ...rows.map((r, i) => cents(r.caseMethod.price) + mark(i))], cls: 'best' },
      { cells: ['WACC, book weights', ...rows.map(r => pct(r.caseMethod.wacc))] },
      { cells: ['Mgmt\'s stake', ...rows.map(r => stakeText(r.caseMethod.mgmtStake))] }
    ], sel);

    const markNew = i => (i === s.bestPriceNew ? '★' : '');
    fillTable(document.getElementById('new-table'), header, [
      ...common,
      { cells: ['Value of equity S', ...rows.map(r => dollars(r.newPriceMethod.S))] },
      { cells: ['Value of firm V', ...rows.map(r => dollars(r.newPriceMethod.V))] },
      { cells: ['Share price', ...rows.map((r, i) => cents(r.newPriceMethod.price) + markNew(i))], cls: 'best' },
      { cells: ['Shares repurchased', ...rows.map(r => shares(r.newPriceMethod.repurchased))] },
      { cells: ['Shares remaining', ...rows.map(r => shares(r.newPriceMethod.remaining))] },
      { cells: ['EPS (= DPS)', ...rows.map(r => cents(r.newPriceMethod.eps))] },
      { cells: ['TIE', ...rows.map(r => mult(r.tie))] },
      { cells: ['WACC, market weights', ...rows.map(r => pct(r.newPriceMethod.wacc))] },
      { cells: ['Mgmt\'s stake', ...rows.map(r => stakeText(r.newPriceMethod.mgmtStake))] }
    ], sel);

    const amt = i => dollars(rows[i].debt);
    const items = [
      'Highest price, case method: ' + amt(s.bestPriceCase) + ' (' + cents(rows[s.bestPriceCase].caseMethod.price) + ')',
      'Highest price, new-price method: ' + amt(s.bestPriceNew) + ' (' + cents(rows[s.bestPriceNew].newPriceMethod.price) + ')',
      'Lowest WACC, book weights: ' + amt(s.lowestWaccBook) + ' (' + pct(rows[s.lowestWaccBook].caseMethod.wacc) + ')',
      'Lowest WACC, market weights: ' + amt(s.lowestWaccMarket) + ' (' + pct(rows[s.lowestWaccMarket].newPriceMethod.wacc) + ')',
      'Highest EPS: ' + amt(s.highestEpsCase) + ' (case method), ' + amt(s.highestEpsNew) + ' (new-price method)'
    ];
    const picks = [s.bestPriceCase, s.bestPriceNew, s.lowestWaccBook, s.lowestWaccMarket];
    items.push(picks.every(p => p === picks[0])
      ? 'Both prices and both WACCs point to the same amount: ' + amt(picks[0]) + '.'
      : 'These do not all agree, so no single amount is picked here.');
    if (rows.some(r => r.caseMethod.mgmtStake.status === 'all_outside_gone' || r.newPriceMethod.mgmtStake.status === 'all_outside_gone')) {
      items.push('* 100.00%: the buyback would retire every outside share, leaving no outside shareholders.');
    }
    document.getElementById('cdss-summary').innerHTML = items.map(t => '<li>' + t + '</li>').join('');
  }

  // ---------- CDSS debt lever ----------
  // Side-by-side view of both buyback methods at the amount picked on the slider.
  function renderCdssLever(d, rows, i) {
    const r = rows[i], a = r.caseMethod, b = r.newPriceMethod;
    document.getElementById('cdss-debt-value').textContent = dollars(r.debt);
    fillTable(document.getElementById('cdss-lever-table'),
      ['At ' + dollars(r.debt), 'Case (' + cents(d.cdss.share_price) + ')', 'New price'], [
        { cells: ['r_d', r.rd === null ? '—' : pct(r.rd), r.rd === null ? '—' : pct(r.rd)] },
        { cells: ['r_s', pct(r.rs), pct(r.rs)] },
        { cells: ['Share price', cents(a.price), cents(b.price)], cls: 'best' },
        { cells: ['Shares repurchased', shares(a.repurchased), shares(b.repurchased)] },
        { cells: ['Shares remaining', shares(a.remaining), shares(b.remaining)] },
        { cells: ['EPS', cents(a.eps), cents(b.eps)] },
        { cells: ['Dividends per share', cents(a.dps), cents(b.dps)] },
        { cells: ['TIE', mult(r.tie), mult(r.tie)] },
        { cells: ['WACC', pct(a.wacc), pct(b.wacc)] },
        { cells: ['Mgmt\'s share', stakeText(a.mgmtStake), stakeText(b.mgmtStake)] }
      ]);
    const notes = ['WACC uses book weights with the case method and market weights with the new-price method.'];
    [a, b].forEach((m, k) => {
      const label = k === 0 ? 'case method' : 'new-price method';
      if (m.mgmtStake.status === 'all_outside_gone') notes.push('* With the ' + label + ', the buyback retires every outside share: no outside shareholders would be left.');
      if (m.mgmtStake.status === 'must_sell') notes.push('Warning: with the ' + label + ', the buyback needs more shares than outside investors own, so management would have to sell.');
    });
    document.getElementById('cdss-lever-note').textContent = notes.join(' ');
  }

  // Button rule: if both methods pick the same amount, go there; if not, go to the
  // case method's amount and name both. (Ties already go to the smaller debt in C.summary.)
  function pickFor(rows, caseIdx, newIdx, what) {
    if (caseIdx === newIdx) return { idx: caseIdx, note: what + ': both methods pick ' + dollars(rows[caseIdx].debt) + '.' };
    return {
      idx: caseIdx,
      note: what + ': the case method picks ' + dollars(rows[caseIdx].debt) + ' and the new-price method picks ' +
        dollars(rows[newIdx].debt) + '. The slider moved to the case method\'s amount.'
    };
  }

  // ---------- Start ----------
  loadAll().then(d => {
    const rows = C.cdssTable(d.cdss, d.T, d.schedule);
    const s = C.summary(rows);

    // CDSS slider: one stop per row of the banker's schedule, nothing in between.
    const cdssSlider = document.getElementById('cdss-slider');
    cdssSlider.max = String(rows.length - 1);
    const caseRow = rows.findIndex(r => r.debt === d.cdss.debt);
    cdssSlider.value = String(caseRow >= 0 ? caseRow : 0);
    document.getElementById('cdss-ticks').innerHTML =
      rows.map(r => '<span>' + (r.debt >= 1e6 ? '$' + r.debt / 1e6 + 'M' : '$' + r.debt / 1000 + 'k') + '</span>').join('');
    const buttonNote = document.getElementById('cdss-button-note');
    const showCdss = () => {
      const i = Number(cdssSlider.value);
      renderCdssLever(d, rows, i);
      renderCdss(d, rows, i);
    };
    cdssSlider.addEventListener('input', () => { buttonNote.textContent = ''; showCdss(); });
    document.getElementById('btn-best-price').addEventListener('click', () => {
      const p = pickFor(rows, s.bestPriceCase, s.bestPriceNew, 'Best price');
      cdssSlider.value = String(p.idx); buttonNote.textContent = p.note; showCdss();
    });
    document.getElementById('btn-highest-eps').addEventListener('click', () => {
      const p = pickFor(rows, s.highestEpsCase, s.highestEpsNew, 'Highest EPS');
      cdssSlider.value = String(p.idx); buttonNote.textContent = p.note; showCdss();
    });

    // Firm L slider: 0 to slider_max in steps of slider_step, from example_firms.csv.
    const f = d.firms;
    const lSlider = document.getElementById('firml-slider');
    lSlider.max = String(f.slider_max);
    lSlider.step = String(f.slider_step);
    lSlider.value = String(f.firm_l_debt);
    document.getElementById('btn-case').textContent = 'Case (' + dollars(f.firm_l_debt) + ')';
    const showFirms = () => renderFirms(d, Number(lSlider.value));
    lSlider.addEventListener('input', showFirms);
    document.getElementById('btn-case').addEventListener('click', () => { lSlider.value = String(f.firm_l_debt); showFirms(); });

    showCdss();
    showFirms();
    document.getElementById('status').textContent = '';
  }).catch(err => {
    const el = document.getElementById('status');
    el.className = 'status error';
    el.textContent = err.message + '. The page reads the files in data/, so it must be opened from a web server (GitHub Pages, or a local server), not by double-clicking index.html.';
  });
})();
