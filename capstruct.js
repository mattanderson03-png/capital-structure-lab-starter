// capstruct.js: the finance math for the AGE Capital Structure App.
// Plain functions only. Nothing here touches the page, so every function
// can be checked with Node, for example:
//   node -e "const c=require('./capstruct.js'); console.log(c.round(0.14025*100,2))"

(function (root) {
  'use strict';

  // ---------- CSV helpers ----------

  // Parse a simple CSV (no quoted commas) into an array of row objects.
  function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const cells = line.split(',');
      const row = {};
      headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
      return row;
    });
  }

  // Turn a number cell into a number; a blank cell becomes null.
  function num(s) {
    return s === '' || s === undefined || s === null ? null : Number(s);
  }

  // Turn item/value rows into an object keyed by item (or assumption).
  function keyValue(rows, keyCol) {
    const out = {};
    rows.forEach(r => { out[r[keyCol]] = num(r.value); });
    return out;
  }

  // ---------- Rounding (half up on the decimal value) ----------

  // toFixed rounds the binary value, so 14.025 shows as 14.02.
  // toPrecision(12) removes the binary noise first, then we round half up.
  function round(x, d) {
    const f = Math.pow(10, d);
    return Math.round(Number((x * f).toPrecision(12))) / f;
  }

  // ---------- Statistics ----------

  function expected(probs, values) {
    return probs.reduce((s, p, i) => s + p * values[i], 0);
  }

  function stdDev(probs, values) {
    const m = expected(probs, values);
    return Math.sqrt(probs.reduce((s, p, i) => s + p * Math.pow(values[i] - m, 2), 0));
  }

  // ---------- Firm U and Firm L (question c) ----------

  // scenarios: [{probability, sales, operating_costs}]
  // Returns each year's income statement plus E(ROE), σ(ROE), CV, E(TIE), σ(TIE).
  function exampleFirm(scenarios, totalAssets, debt, rate, taxRate) {
    const equity = totalAssets - debt;
    const interest = rate * debt;
    const probs = scenarios.map(s => s.probability);
    const years = scenarios.map(s => {
      const ebit = s.sales - s.operating_costs;
      const ebt = ebit - interest;
      const taxes = taxRate * ebt;
      const netIncome = ebt - taxes;
      return {
        probability: s.probability,
        sales: s.sales,
        operatingCosts: s.operating_costs,
        ebit, interest, ebt, taxes, netIncome,
        roe: netIncome / equity,
        tie: interest > 0 ? ebit / interest : null
      };
    });
    const roes = years.map(y => y.roe);
    const eRoe = expected(probs, roes);
    const sdRoe = stdDev(probs, roes);
    let eTie = null, sdTie = null;
    if (interest > 0) {
      const ties = years.map(y => y.tie);
      eTie = expected(probs, ties);
      sdTie = stdDev(probs, ties);
    }
    return { assets: totalAssets, debt, equity, rate, years, eRoe, sdRoe, cv: sdRoe / eRoe, eTie, sdTie };
  }

  // ---------- CDSS at each amount of borrowing (question d) ----------

  // EBIT = sales × (1 − variable cost rate) − fixed costs
  function cdssEbit(cdss) {
    return cdss.sales * (1 - cdss.variable_cost_rate) - cdss.fixed_costs;
  }

  // One row of the banker's schedule → both buyback methods.
  // cdss: values from cdss.csv; T: tax rate; row: {debt, cost_of_debt, cost_of_equity}
  function cdssAtDebt(cdss, T, row) {
    const ebit = cdssEbit(cdss);
    const D = row.debt;
    const rd = row.cost_of_debt === null ? 0 : row.cost_of_debt;
    const rs = row.cost_of_equity;
    const n = cdss.shares_outstanding;
    const P0 = cdss.share_price;
    const A = cdss.total_assets;
    const mgmt = cdss.management_share;

    const interest = rd * D;
    const netIncome = (ebit - interest) * (1 - T);
    const tie = interest > 0 ? ebit / interest : null;

    // Case method: buy back at today's price P0.
    const caseRepurchased = D / P0;
    const caseRemaining = n - caseRepurchased;
    const caseEps = netIncome / caseRemaining;
    const casePrice = caseEps / rs;
    const waccBook = (D / A) * rd * (1 - T) + ((A - D) / A) * rs;

    // New-price method: buy back at the price after the announcement.
    const S = netIncome / rs;
    const V = S + D;
    const newPrice = V / n;
    const newRepurchased = D / newPrice;
    const newRemaining = n - newRepurchased;
    const newEps = netIncome / newRemaining;
    const waccMarket = (D / V) * rd * (1 - T) + (S / V) * rs;

    return {
      debt: D, rd: row.cost_of_debt, rs, ebit, interest, netIncome, tie,
      caseMethod: {
        repurchased: caseRepurchased, remaining: caseRemaining,
        eps: caseEps, dps: caseEps, price: casePrice, wacc: waccBook,
        mgmtStake: managementStake(mgmt, n, caseRepurchased, caseRemaining)
      },
      newPriceMethod: {
        S, V, repurchased: newRepurchased, remaining: newRemaining,
        eps: newEps, dps: newEps, price: newPrice, wacc: waccMarket,
        mgmtStake: managementStake(mgmt, n, newRepurchased, newRemaining),
        // Checks from CLAUDE.md: EPS = r_s × P, and WACC = EBIT(1 − T) / V
        epsCheck: rs * newPrice,
        waccCheck: ebit * (1 - T) / V
      }
    };
  }

  // Management doesn't sell, so its stake rises as outside shares are bought back.
  function managementStake(mgmtShare, n, repurchased, remaining) {
    const outside = (1 - mgmtShare) * n;
    const eps = 1e-9;
    if (repurchased > outside + eps) return { status: 'must_sell', value: null };
    if (Math.abs(repurchased - outside) <= eps) return { status: 'all_outside_gone', value: 1 };
    return { status: 'ok', value: (mgmtShare * n) / remaining };
  }

  // All rows of the schedule.
  function cdssTable(cdss, T, schedule) {
    return schedule.map(row => cdssAtDebt(cdss, T, row));
  }

  // Index of the best value; on an exact tie (after rounding to display), take the smaller debt.
  function argBest(rows, getter, better, decimals) {
    let best = 0;
    for (let i = 1; i < rows.length; i++) {
      const a = round(getter(rows[i]), decimals);
      const b = round(getter(rows[best]), decimals);
      if (better(a, b)) best = i;
    }
    return best;
  }

  function summary(rows) {
    const hi = (a, b) => a > b, lo = (a, b) => a < b;
    return {
      bestPriceCase: argBest(rows, r => r.caseMethod.price, hi, 2),
      bestPriceNew: argBest(rows, r => r.newPriceMethod.price, hi, 2),
      highestEpsCase: argBest(rows, r => r.caseMethod.eps, hi, 2),
      highestEpsNew: argBest(rows, r => r.newPriceMethod.eps, hi, 2),
      lowestWaccBook: argBest(rows, r => r.caseMethod.wacc, lo, 4),
      lowestWaccMarket: argBest(rows, r => r.newPriceMethod.wacc, lo, 4)
    };
  }

  // Check that EPS / r_s at $0 debt equals today's price in cdss.csv.
  function zeroDebtCheck(cdss, rows) {
    const zero = rows.find(r => r.debt === 0);
    if (!zero) return { ok: false, message: 'The schedule has no $0 row.' };
    const p = zero.caseMethod.price;
    return { ok: round(p, 2) === round(cdss.share_price, 2), price: p };
  }

  const api = {
    parseCSV, num, keyValue, round, expected, stdDev,
    exampleFirm, cdssEbit, cdssAtDebt, cdssTable, managementStake, summary, zeroDebtCheck
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CapStruct = api;
})(typeof window !== 'undefined' ? window : this);
