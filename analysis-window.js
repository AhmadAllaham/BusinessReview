(() => {
  'use strict';

  const MODULE_VERSION = 2;
  if ((window.__BR_ANALYSIS_WINDOW_VERSION__ || 0) >= MODULE_VERSION) return;
  window.__BR_ANALYSIS_WINDOW_VERSION__ = MODULE_VERSION;
  window.__analysisWindowInstalled = true;

  const USD_TO_JOD = 0.709;
  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const FILTERS = [
    ['yearFilter', 'year'],
    ['monthFilter', 'month'],
    ['typeFilter', 'type'],
    ['countryFilter', 'country'],
    ['sectorFilter', 'sector'],
    ['agentFilter', 'agent'],
    ['groupFilter', 'group'],
    ['productFilter', 'product']
  ];
  const DIMENSIONS = {
    Country: 'country',
    Agent: 'agent',
    'Product Group': 'group',
    Product: 'product',
    'Sales Type': 'type'
  };

  const state = {
    rows: [],
    currency: 'USD',
    budgetMode: 'ytd',
    dimension: 'Country',
    topN: 10,
    renderQueued: false
  };

  const submenu = document.getElementById('businessSubmenu');
  const workspace = document.getElementById('businessWorkspace');
  if (!submenu || !workspace) return;

  const normalizeKey = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

  const textId = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const sameText = (left, right) => textId(left) === textId(right);

  function toNumber(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value).trim();
    const parsed = Number(text.replace(/[(),%$]/g, '').replace(/,/g, ''));
    if (!Number.isFinite(parsed)) return 0;
    return /^\(.*\)$/.test(text) ? -Math.abs(parsed) : parsed;
  }

  function rowIndex(row) {
    return new Map(Object.keys(row || {}).map(key => [normalizeKey(key), key]));
  }

  function pick(row, aliases) {
    const index = rowIndex(row);
    for (const alias of aliases) {
      const key = index.get(normalizeKey(alias));
      if (key !== undefined) return row[key];
    }
    return undefined;
  }

  function text(row, aliases, fallback = '') {
    const value = pick(row, aliases);
    return value == null ? fallback : String(value).trim();
  }

  function number(row, aliases) {
    return toNumber(pick(row, aliases));
  }

  function normalizeType(value) {
    const key = normalizeKey(value);
    if (key.includes('tms')) return 'TMS';
    if (key.includes('ims')) return 'IMS';
    return String(value ?? '').trim() || 'Unassigned';
  }

  function monthNumber(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getMonth() + 1;
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value >= 1 && value <= 12) return Math.trunc(value);
      if (value > 20000 && value < 100000) {
        const date = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86400000);
        return date.getUTCMonth() + 1;
      }
    }
    const compact = normalizeKey(value);
    if (/^(?:0?[1-9]|1[0-2])$/.test(compact)) return Number(compact);
    const aliases = {
      jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,
      may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,
      sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,
      dec:12,december:12
    };
    for (const [name, month] of Object.entries(aliases)) {
      if (compact === name || compact.startsWith(name)) return month;
    }
    return 0;
  }

  function normalizeRow(row) {
    const actual = number(row, [
      'Actual Value', 'Actual  Value', 'Actual Sales YTD 2026',
      'Actual Sales', 'Actual', '__actual'
    ]);
    const budget = number(row, [
      'Budget Value', 'Budget  Value', 'Budget Sales YTD 2026',
      'Budget Sales', 'Budget', '__budget'
    ]);
    const ly = number(row, [
      'LY', 'LY Value', 'Last Year', 'Last Year Value',
      'Actual LY', 'Actual Sales YTD 2025', '__ly'
    ]);

    return {
      year: Number(text(row, ['Year', 'Fiscal Year', 'Reporting Year'])) || 0,
      month: monthNumber(text(row, ['Month', 'Reporting Month', 'Period'])),
      type: normalizeType(text(row, ['Type', 'Sales Type', 'SalesType', 'Channel'])),
      country: text(row, ['Country', 'Market', 'Country Name'], 'Unassigned'),
      sector: text(row, ['Sector'], 'Unassigned'),
      agent: text(row, ['Agent', 'Distributor', 'Customer'], 'Unassigned'),
      group: text(row, [
        'Product Group', 'ProductGroup', 'Brand', 'Family',
        'Product Family', 'Group'
      ], 'Unassigned'),
      product: text(row, [
        'Product Name', 'ProductName', 'Product', 'SKU',
        'Item Description', 'Item'
      ], 'Unassigned'),
      actual,
      budget,
      ly,
      actualQty: number(row, [
        'Actual QTY', 'Actual Qty', 'Actual Quantity', 'Actual Units',
        'Total Actual Q', 'Total Actual Qty', 'QTY Actual',
        'Actual QTY YTD 2026', 'Actual Quantity YTD 2026'
      ]),
      budgetQty: number(row, [
        'Budget QTY', 'Budget Qty', 'Budget Quantity', 'Budget Units',
        'Total Budget Q', 'Total Budget Qty', 'QTY Budget',
        'Budget QTY YTD 2026', 'Budget Quantity YTD 2026'
      ])
    };
  }

  function selected(filterId) {
    const element = document.getElementById(filterId);
    if (!element) return [];
    if (typeof element._getSelected === 'function') {
      return (element._getSelected() || []).map(String);
    }
    return [...element.querySelectorAll('.multi-options input:checked')]
      .map(input => input.value)
      .filter(value => value !== '__ALL__');
  }

  function currentYear() {
    const selectedYears = selected('yearFilter')
      .map(Number)
      .filter(Number.isFinite);
    if (selectedYears.length) return Math.max(...selectedYears);
    const years = state.rows.map(row => row.year).filter(Boolean);
    return years.length ? Math.max(...years) : new Date().getFullYear();
  }

  function matchesFilters(row, options = {}) {
    const year = options.year ?? currentYear();
    if (!options.ignoreYear && row.year && row.year !== year) return false;

    return FILTERS.every(([filterId, property]) => {
      if (property === 'year') return true;
      if (options.ignoreMonth && property === 'month') return true;
      const values = selected(filterId);
      if (!values.length) return true;
      if (property === 'month') {
        return values.some(value => monthNumber(value) === row.month);
      }
      return values.some(value => sameText(value, row[property]));
    });
  }

  const currentRows = options => state.rows.filter(row => matchesFilters(row, options));

  function previousYearRows(options = {}) {
    const year = currentYear() - 1;
    return state.rows.filter(row => {
      if (row.year !== year) return false;
      return matchesFilters(row, { ...options, year, ignoreYear:true });
    });
  }

  function ensureGroup(map, name) {
    const display = String(name || 'Unassigned').trim() || 'Unassigned';
    const key = textId(display);
    if (!map.has(key)) {
      map.set(key, {
        name: display,
        actual: 0,
        budget: 0,
        lyDirect: 0,
        lyFallback: 0,
        actualQty: 0,
        budgetQty: 0
      });
    }
    return map.get(key);
  }

  function groupedPerformance(dimension = state.dimension) {
    const property = DIMENSIONS[dimension] || 'country';
    const actualRows = currentRows();
    const budgetRows = state.budgetMode === 'fy'
      ? currentRows({ ignoreMonth:true })
      : actualRows;
    const priorRows = previousYearRows();
    const map = new Map();

    actualRows.forEach(row => {
      const group = ensureGroup(map, row[property]);
      group.actual += row.actual;
      group.lyDirect += row.ly;
      group.actualQty += row.actualQty;
    });

    budgetRows.forEach(row => {
      const group = ensureGroup(map, row[property]);
      group.budget += row.budget;
      group.budgetQty += row.budgetQty;
    });

    priorRows.forEach(row => {
      ensureGroup(map, row[property]).lyFallback += row.actual;
    });

    const rows = [...map.values()].map(row => {
      const ly = Math.abs(row.lyDirect) > 1e-9 ? row.lyDirect : row.lyFallback;
      const variance = row.actual - row.budget;
      const actualPrice = row.actualQty ? row.actual / row.actualQty : NaN;
      const budgetPrice = row.budgetQty ? row.budget / row.budgetQty : NaN;
      return {
        ...row,
        ly,
        variance,
        variancePct: row.budget ? variance / Math.abs(row.budget) : NaN,
        achievement: row.budget ? row.actual / Math.abs(row.budget) : NaN,
        growth: ly ? (row.actual - ly) / Math.abs(ly) : NaN,
        actualPrice,
        budgetPrice,
        priceVariance: Number.isFinite(actualPrice) && Number.isFinite(budgetPrice)
          ? actualPrice - budgetPrice
          : NaN,
        qtyVariance: row.actualQty - row.budgetQty
      };
    });

    const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
    rows.forEach(row => {
      row.contribution = totalActual ? row.actual / totalActual : 0;
    });
    return rows;
  }

  function summaryMetrics() {
    const rows = groupedPerformance('Country');
    const totals = rows.reduce((total, row) => {
      total.actual += row.actual;
      total.budget += row.budget;
      total.ly += row.ly;
      total.actualQty += row.actualQty;
      total.budgetQty += row.budgetQty;
      return total;
    }, { actual:0, budget:0, ly:0, actualQty:0, budgetQty:0 });

    totals.variance = totals.actual - totals.budget;
    totals.achievement = totals.budget ? totals.actual / Math.abs(totals.budget) : NaN;
    totals.growth = totals.ly ? (totals.actual - totals.ly) / Math.abs(totals.ly) : NaN;
    totals.actualPrice = totals.actualQty ? totals.actual / totals.actualQty : NaN;
    totals.budgetPrice = totals.budgetQty ? totals.budget / totals.budgetQty : NaN;
    totals.priceVariance = Number.isFinite(totals.actualPrice) && Number.isFinite(totals.budgetPrice)
      ? totals.actualPrice - totals.budgetPrice
      : NaN;
    totals.qtyVariance = totals.actualQty - totals.budgetQty;
    return totals;
  }

  function monthlyTrend() {
    const yearRows = currentRows({ ignoreMonth:true });
    const priorRows = previousYearRows({ ignoreMonth:true });
    const months = MONTHS.map((name, index) => ({
      month:index + 1,
      name,
      short:MONTH_SHORT[index],
      actual:0,
      budget:0,
      lyDirect:0,
      lyFallback:0
    }));

    yearRows.forEach(row => {
      if (!row.month) return;
      const month = months[row.month - 1];
      month.actual += row.actual;
      month.budget += row.budget;
      month.lyDirect += row.ly;
    });
    priorRows.forEach(row => {
      if (row.month) months[row.month - 1].lyFallback += row.actual;
    });

    return months.map(month => ({
      ...month,
      ly: Math.abs(month.lyDirect) > 1e-9 ? month.lyDirect : month.lyFallback
    }));
  }

  function salesMix() {
    const map = new Map();
    currentRows().forEach(row => {
      const key = row.type || 'Unassigned';
      map.set(key, (map.get(key) || 0) + row.actual);
    });
    const rows = [...map].map(([name, value]) => ({ name, value }));
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    rows.forEach(row => { row.share = total ? row.value / total : 0; });
    return rows.sort((left, right) => right.value - left.value);
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[character]);

  function currencyRate() {
    return state.currency === 'JOD' ? USD_TO_JOD : 1;
  }

  function numberFormat(value, decimals = 0) {
    if (!Number.isFinite(Number(value))) return '—';
    const number = Number(value);
    const formatted = Math.abs(number).toLocaleString('en-US', {
      minimumFractionDigits:decimals,
      maximumFractionDigits:decimals
    });
    return number < 0 ? `(${formatted})` : formatted;
  }

  function moneyK(value, decimals = 0) {
    return numberFormat((Number(value) || 0) * currencyRate() / 1000, decimals);
  }

  function moneyUnit(value, decimals = 2) {
    if (!Number.isFinite(Number(value))) return '—';
    return numberFormat(Number(value) * currencyRate(), decimals);
  }

  function percent(value, decimals = 1) {
    if (!Number.isFinite(Number(value))) return '—';
    return `${(Number(value) * 100).toLocaleString('en-US', {
      minimumFractionDigits:decimals,
      maximumFractionDigits:decimals
    })}%`;
  }

  function compactAxis(value) {
    const number = Math.abs((Number(value) || 0) * currencyRate() / 1000);
    if (number >= 1000000) return `${(number / 1000000).toFixed(1)}m`;
    if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
    return number.toFixed(number >= 100 ? 0 : 1);
  }

  function tone(value) {
    return !Number.isFinite(Number(value)) || value === 0
      ? 'neutral'
      : value > 0 ? 'positive' : 'negative';
  }

  function kpiCard(label, value, meta, valueTone = 'neutral') {
    return `
      <article class="analysis-kpi ${valueTone}">
        <span>${escapeHtml(label)}</span>
        <strong>${value}</strong>
        <small>${meta}</small>
      </article>`;
  }

  function trendSvg(data) {
    const width = 960;
    const height = 315;
    const left = 66;
    const right = 22;
    const top = 24;
    const bottom = 46;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maximum = Math.max(1, ...data.flatMap(row => [row.actual, row.budget, row.ly].map(Math.abs)));
    const y = value => top + plotHeight - Math.abs(value) / maximum * plotHeight;
    const groupWidth = plotWidth / data.length;
    const barWidth = Math.min(22, groupWidth * 0.28);
    const grid = [0, .25, .5, .75, 1].map(ratio => {
      const gridY = top + plotHeight - ratio * plotHeight;
      return `
        <line x1="${left}" y1="${gridY}" x2="${width - right}" y2="${gridY}" class="analysis-grid-line" />
        <text x="${left - 10}" y="${gridY + 4}" text-anchor="end" class="analysis-axis-label">${escapeHtml(compactAxis(maximum * ratio))}</text>`;
    }).join('');

    const bars = data.map((row, index) => {
      const center = left + groupWidth * index + groupWidth / 2;
      const actualY = y(row.actual);
      const budgetY = y(row.budget);
      const base = top + plotHeight;
      return `
        <rect x="${center - barWidth - 2}" y="${actualY}" width="${barWidth}" height="${Math.max(0, base - actualY)}" rx="4" class="analysis-bar-actual">
          <title>${row.name} Actual: ${moneyK(row.actual)}</title>
        </rect>
        <rect x="${center + 2}" y="${budgetY}" width="${barWidth}" height="${Math.max(0, base - budgetY)}" rx="4" class="analysis-bar-budget">
          <title>${row.name} Budget: ${moneyK(row.budget)}</title>
        </rect>
        <text x="${center}" y="${height - 18}" text-anchor="middle" class="analysis-axis-label">${row.short}</text>`;
    }).join('');

    const points = data.map((row, index) => {
      const x = left + groupWidth * index + groupWidth / 2;
      return `${x},${y(row.ly)}`;
    }).join(' ');
    const dots = data.map((row, index) => {
      const x = left + groupWidth * index + groupWidth / 2;
      return `<circle cx="${x}" cy="${y(row.ly)}" r="3.5" class="analysis-line-dot"><title>${row.name} LY: ${moneyK(row.ly)}</title></circle>`;
    }).join('');

    return `
      <svg class="analysis-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly sales trend">
        ${grid}
        ${bars}
        <polyline points="${points}" class="analysis-line-ly" />
        ${dots}
      </svg>`;
  }

  function rankingHtml(rows) {
    const ranking = [...rows]
      .sort((left, right) => right.actual - left.actual)
      .slice(0, state.topN);
    const maximum = Math.max(1, ...ranking.flatMap(row => [Math.abs(row.actual), Math.abs(row.budget)]));
    if (!ranking.length) return '<div class="analysis-no-data">No ranking data for the selected filters.</div>';

    return ranking.map((row, index) => {
      const actualWidth = Math.min(100, Math.abs(row.actual) / maximum * 100);
      const budgetPosition = Math.min(100, Math.abs(row.budget) / maximum * 100);
      return `
        <div class="analysis-rank-row">
          <div class="analysis-rank-label"><b>${index + 1}</b><span title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span></div>
          <div class="analysis-rank-track">
            <i style="width:${actualWidth}%"></i>
            <em style="left:${budgetPosition}%" title="Budget ${moneyK(row.budget)}"></em>
          </div>
          <div class="analysis-rank-value">
            <strong>${moneyK(row.actual)}</strong>
            <small class="${tone(row.variancePct)}">${percent(row.variancePct)}</small>
          </div>
        </div>`;
    }).join('');
  }

  function mixHtml(rows) {
    const palette = ['#0f766e','#1e5a88','#3fa7a0','#f2a65a','#7a6bbd','#d36c7c'];
    let cursor = 0;
    const segments = rows.map((row, index) => {
      const start = cursor;
      cursor += row.share * 360;
      return `${palette[index % palette.length]} ${start}deg ${cursor}deg`;
    });
    const background = segments.length
      ? `conic-gradient(${segments.join(',')})`
      : 'conic-gradient(#e7eef2 0deg 360deg)';
    const total = rows.reduce((sum, row) => sum + row.value, 0);

    return `
      <div class="analysis-mix-layout">
        <div class="analysis-donut" style="background:${background}">
          <div><strong>${moneyK(total)}</strong><span>${state.currency} '000</span></div>
        </div>
        <div class="analysis-mix-legend">
          ${rows.length ? rows.map((row, index) => `
            <div><i style="background:${palette[index % palette.length]}"></i><span>${escapeHtml(row.name)}</span><b>${percent(row.share, 1)}</b></div>`).join('')
            : '<div class="analysis-no-data">No sales mix data.</div>'}
        </div>
      </div>`;
  }

  function performanceTable(rows) {
    const sorted = [...rows].sort((left, right) => left.variance - right.variance);
    const selectedRows = [
      ...sorted.slice(0, Math.min(5, sorted.length)),
      ...sorted.slice(-Math.min(5, sorted.length)).reverse()
    ].filter((row, index, array) => array.findIndex(item => textId(item.name) === textId(row.name)) === index);

    if (!selectedRows.length) return '<div class="analysis-no-data">No variance data.</div>';
    return `
      <div class="analysis-table-wrap">
        <table class="analysis-table">
          <thead><tr><th>${escapeHtml(state.dimension)}</th><th>Actual</th><th>${state.budgetMode === 'fy' ? 'FY Budget' : 'Budget'}</th><th>Variance</th><th>Var %</th><th>Vs LY</th><th>Contribution</th></tr></thead>
          <tbody>${selectedRows.map(row => `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              <td>${moneyK(row.actual)}</td>
              <td>${moneyK(row.budget)}</td>
              <td class="${tone(row.variance)}">${moneyK(row.variance)}</td>
              <td class="${tone(row.variancePct)}">${percent(row.variancePct)}</td>
              <td class="${tone(row.growth)}">${percent(row.growth)}</td>
              <td>${percent(row.contribution)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function unitTable(rows) {
    const useful = [...rows]
      .filter(row => row.actualQty || row.budgetQty)
      .sort((left, right) => right.actual - left.actual)
      .slice(0, state.topN);
    if (!useful.length) return '<div class="analysis-no-data">Quantity data is not available for the selected scope.</div>';

    return `
      <div class="analysis-table-wrap">
        <table class="analysis-table analysis-unit-table">
          <thead><tr><th>${escapeHtml(state.dimension)}</th><th>Actual QTY</th><th>Budget QTY</th><th>QTY Var</th><th>Actual Price / Unit</th><th>Budget Price / Unit</th><th>Price Var</th></tr></thead>
          <tbody>${useful.map(row => `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              <td>${numberFormat(row.actualQty)}</td>
              <td>${numberFormat(row.budgetQty)}</td>
              <td class="${tone(row.qtyVariance)}">${numberFormat(row.qtyVariance)}</td>
              <td>${moneyUnit(row.actualPrice)}</td>
              <td>${moneyUnit(row.budgetPrice)}</td>
              <td class="${tone(row.priceVariance)}">${moneyUnit(row.priceVariance)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function insightHtml(rows, totals) {
    const byActual = [...rows].sort((left, right) => right.actual - left.actual);
    const byVariance = [...rows].sort((left, right) => right.variance - left.variance);
    const top = byActual[0];
    const best = byVariance[0];
    const risk = byVariance[byVariance.length - 1];
    const concentration = byActual.slice(0, 3).reduce((sum, row) => sum + row.contribution, 0);
    const insights = [];

    insights.push(`Sales are <strong class="${tone(totals.variance)}">${percent(totals.achievement)}</strong> of ${state.budgetMode === 'fy' ? 'FY Budget' : 'Budget'}, with a variance of <strong class="${tone(totals.variance)}">${moneyK(totals.variance)} ${state.currency} '000</strong>.`);
    if (top) insights.push(`<strong>${escapeHtml(top.name)}</strong> is the largest contributor at ${percent(top.contribution)} of Actual Sales.`);
    if (best && best.variance > 0) insights.push(`Best favorable variance: <strong>${escapeHtml(best.name)}</strong> at ${moneyK(best.variance)} ${state.currency} '000.`);
    if (risk && risk.variance < 0) insights.push(`Largest performance gap: <strong>${escapeHtml(risk.name)}</strong> at ${moneyK(risk.variance)} ${state.currency} '000.`);
    if (byActual.length >= 3) insights.push(`Top 3 ${escapeHtml(state.dimension)} entries represent <strong>${percent(concentration)}</strong> of sales, indicating ${concentration >= .65 ? 'high' : concentration >= .45 ? 'moderate' : 'balanced'} concentration.`);

    return insights.map((insight, index) => `<div><b>${index + 1}</b><p>${insight}</p></div>`).join('');
  }

  function scopeText() {
    const parts = [];
    FILTERS.forEach(([id, property]) => {
      const values = selected(id);
      if (!values.length) return;
      const label = property === 'group' ? 'Product Group' : property[0].toUpperCase() + property.slice(1);
      parts.push(`${label}: ${values.length === 1 ? values[0] : `${values.length} selected`}`);
    });
    return parts.length ? parts.join(' · ') : 'All available Sales data';
  }

  function exportAnalysis() {
    if (typeof XLSX === 'undefined') return;
    const rows = groupedPerformance();
    const monthly = monthlyTrend();
    const workbook = XLSX.utils.book_new();
    const detail = rows.map(row => ({
      [state.dimension]: row.name,
      'Actual Sales': row.actual,
      [state.budgetMode === 'fy' ? 'FY Budget' : 'Budget']: row.budget,
      'Variance': row.variance,
      'Variance %': row.variancePct,
      'Achievement %': row.achievement,
      'Last Year': row.ly,
      'Growth vs LY %': row.growth,
      'Contribution %': row.contribution,
      'Actual QTY': row.actualQty,
      'Budget QTY': row.budgetQty,
      'Actual Price / Unit': row.actualPrice,
      'Budget Price / Unit': row.budgetPrice,
      'Price Variance': row.priceVariance
    }));
    const trend = monthly.map(row => ({
      Month:row.name,
      Actual:row.actual,
      Budget:row.budget,
      'Last Year':row.ly
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detail), 'Performance');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trend), 'Monthly Trend');
    XLSX.writeFile(workbook, `Sales_Analysis_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function togglePresentation() {
    const active = !document.body.classList.contains('analysis-presentation');
    document.body.classList.toggle('analysis-presentation', active);
    const button = document.getElementById('analysisPresentation');
    if (button) button.textContent = active ? 'Exit Presentation' : 'Presentation';
    if (active && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!active && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  function render() {
    const root = document.getElementById('analysisDashboard');
    if (!root) return;

    if (!state.rows.length) {
      root.innerHTML = `
        <div class="analysis-empty-state">
          <div class="analysis-empty-icon" aria-hidden="true">A</div>
          <h3>No Sales data loaded</h3>
          <p>Upload or activate the Sales dataset to populate the Analysis dashboard.</p>
        </div>`;
      return;
    }

    const rows = groupedPerformance();
    const totals = summaryMetrics();
    const trend = monthlyTrend();
    const mix = salesMix();
    const budgetLabel = state.budgetMode === 'fy' ? 'FY Budget' : 'Budget';
    const year = currentYear();

    root.innerHTML = `
      <div class="analysis-scope-line"><span>${escapeHtml(scopeText())}</span><b>${escapeHtml(String(year))} · ${escapeHtml(budgetLabel)}</b></div>
      <div class="analysis-kpi-grid">
        ${kpiCard('Actual Sales', moneyK(totals.actual), `${state.currency} '000`, 'neutral')}
        ${kpiCard(budgetLabel, moneyK(totals.budget), `${state.currency} '000`, 'neutral')}
        ${kpiCard('Sales Variance', moneyK(totals.variance), `${state.currency} '000`, tone(totals.variance))}
        ${kpiCard('Achievement', percent(totals.achievement), `Actual ÷ ${budgetLabel}`, tone(totals.variance))}
        ${kpiCard('Last Year', moneyK(totals.ly), `${state.currency} '000`, 'neutral')}
        ${kpiCard('Growth vs LY', percent(totals.growth), 'Year-on-year', tone(totals.growth))}
        ${kpiCard('Actual Quantity', numberFormat(totals.actualQty), `Variance ${numberFormat(totals.qtyVariance)}`, tone(totals.qtyVariance))}
        ${kpiCard('Average Price / Unit', moneyUnit(totals.actualPrice), `${state.currency} · Var ${moneyUnit(totals.priceVariance)}`, tone(totals.priceVariance))}
      </div>

      <section class="analysis-insights">
        <div class="analysis-section-title"><div><span>Executive Insights</span><h3>What management should notice</h3></div></div>
        <div class="analysis-insight-grid">${insightHtml(rows, totals)}</div>
      </section>

      <div class="analysis-dashboard-grid analysis-top-grid">
        <section class="analysis-panel analysis-wide">
          <div class="analysis-section-title"><div><span>12-Month Trend</span><h3>Actual vs Budget vs Last Year</h3></div><div class="analysis-legend"><i class="actual"></i>Actual <i class="budget"></i>Budget <i class="ly"></i>LY</div></div>
          <div class="analysis-chart-scroll">${trendSvg(trend)}</div>
        </section>
        <section class="analysis-panel">
          <div class="analysis-section-title"><div><span>Sales Mix</span><h3>IMS vs TMS contribution</h3></div></div>
          ${mixHtml(mix)}
        </section>
      </div>

      <div class="analysis-dashboard-grid">
        <section class="analysis-panel">
          <div class="analysis-section-title"><div><span>Ranking</span><h3>Top ${state.topN} by ${escapeHtml(state.dimension)}</h3></div><small>Bar = Actual · Marker = Budget</small></div>
          <div class="analysis-ranking">${rankingHtml(rows)}</div>
        </section>
        <section class="analysis-panel analysis-wide">
          <div class="analysis-section-title"><div><span>Performance Exceptions</span><h3>Largest favorable and unfavorable variances</h3></div></div>
          ${performanceTable(rows)}
        </section>
      </div>

      <section class="analysis-panel analysis-full-panel">
        <div class="analysis-section-title"><div><span>Price & Volume</span><h3>Quantity and sales price per unit analysis</h3></div><small>Top ${state.topN} by Actual Sales</small></div>
        ${unitTable(rows)}
      </section>`;
  }

  function queueRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  let tab = submenu.querySelector('[data-tab="analysisSection"]');
  if (!tab) {
    tab = document.createElement('button');
    tab.className = 'tab-btn';
    tab.type = 'button';
    tab.dataset.tab = 'analysisSection';
    tab.textContent = 'Analysis';
    submenu.appendChild(tab);
  }

  let section = document.getElementById('analysisSection');
  if (!section) {
    section = document.createElement('section');
    section.id = 'analysisSection';
    section.className = 'report-section analysis-section';
    section.hidden = true;
    section.innerHTML = `
      <article class="report-card analysis-report-card">
        <div class="analysis-page-head">
          <div>
            <span class="eyebrow">Sales Business Intelligence</span>
            <h2>Analysis</h2>
            <p>Executive Sales dashboard covering performance, trends, mix, contribution, price and volume.</p>
          </div>
          <div class="analysis-controls">
            <label>Comparison<select id="analysisBudgetMode"><option value="ytd">Budget YTD</option><option value="fy">FY Budget · 12 Months</option></select></label>
            <label>Breakdown<select id="analysisDimension">${Object.keys(DIMENSIONS).map(value => `<option>${value}</option>`).join('')}</select></label>
            <label>Top<select id="analysisTopN"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label>
            <div class="analysis-button-group" role="group" aria-label="Analysis currency"><button class="active" type="button" data-analysis-currency="USD">USD</button><button type="button" data-analysis-currency="JOD">JOD</button></div>
            <button id="analysisExport" class="analysis-action" type="button">Export Excel</button>
            <button id="analysisPresentation" class="analysis-action" type="button">Presentation</button>
          </div>
        </div>
        <div id="analysisDashboard"></div>
      </article>`;
    workspace.appendChild(section);
  }

  if (!document.getElementById('analysis-window-style')) {
    const style = document.createElement('style');
    style.id = 'analysis-window-style';
    style.textContent = `
      body.analysis-view .sales-header-upload{display:none!important}
      .analysis-report-card{min-height:680px;overflow:hidden;border:1px solid #dce9e6;background:#f6f9fb;box-shadow:0 10px 28px rgba(15,118,110,.08)}
      .analysis-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px 22px;border-bottom:1px solid #dce9e6;background:linear-gradient(180deg,#fff 0%,#f3faf8 100%)}
      .analysis-page-head h2{margin:4px 0 0;color:#173f3b;font-size:27px;line-height:1.2}.analysis-page-head p{margin:7px 0 0;color:#64748b;font-size:14px}
      .analysis-controls{display:flex;align-items:flex-end;justify-content:flex-end;gap:8px;flex-wrap:wrap}.analysis-controls label{display:grid;gap:4px;color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.analysis-controls select,.analysis-action{height:36px;border:1px solid #cbd9df;border-radius:9px;background:#fff;color:#173f3b;padding:0 10px;font:700 12px inherit}.analysis-action{cursor:pointer}.analysis-action:hover{border-color:#159b8d;color:#0f766e}
      .analysis-button-group{display:flex;height:36px;border:1px solid #cbd9df;border-radius:9px;overflow:hidden;background:#fff}.analysis-button-group button{min-width:44px;border:0;border-right:1px solid #dce5e9;background:#fff;color:#64748b;font-weight:800;cursor:pointer}.analysis-button-group button:last-child{border-right:0}.analysis-button-group button.active{background:#0f766e;color:#fff}
      #analysisDashboard{padding:16px}.analysis-scope-line{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;padding:9px 12px;border:1px solid #dfe8ec;border-radius:10px;background:#fff;color:#64748b;font-size:12px}.analysis-scope-line b{color:#173f3b}
      .analysis-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px}.analysis-kpi{position:relative;min-height:104px;padding:14px 15px;border:1px solid #dce6ea;border-radius:13px;background:#fff;box-shadow:0 4px 13px rgba(15,35,55,.045);overflow:hidden}.analysis-kpi:after{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:#8aa1ae}.analysis-kpi.positive:after{background:#159b70}.analysis-kpi.negative:after{background:#d34b58}.analysis-kpi span{display:block;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.analysis-kpi strong{display:block;margin-top:8px;color:#153b50;font-size:25px;line-height:1.1}.analysis-kpi small{display:block;margin-top:7px;color:#7b8b98;font-size:11px}.analysis-kpi.positive strong{color:#0a7b50}.analysis-kpi.negative strong{color:#bf3443}
      .analysis-insights,.analysis-panel{margin-top:12px;border:1px solid #dce6ea;border-radius:14px;background:#fff;box-shadow:0 5px 16px rgba(15,35,55,.04)}.analysis-insights{padding:15px}.analysis-section-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.analysis-section-title span{color:#0f766e;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.analysis-section-title h3{margin:3px 0 0;color:#173f3b;font-size:16px}.analysis-section-title small{color:#7b8b98;font-size:11px}.analysis-insight-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:8px}.analysis-insight-grid>div{display:flex;gap:9px;align-items:flex-start;padding:10px;border-radius:10px;background:#f6faf9}.analysis-insight-grid b{display:grid;place-items:center;flex:0 0 24px;height:24px;border-radius:50%;background:#dff2ed;color:#0f766e;font-size:11px}.analysis-insight-grid p{margin:2px 0 0;color:#526676;font-size:12px;line-height:1.45}.analysis-insight-grid .positive,.analysis-table .positive,.analysis-rank-value .positive{color:#087a4d}.analysis-insight-grid .negative,.analysis-table .negative,.analysis-rank-value .negative{color:#c03745}
      .analysis-dashboard-grid{display:grid;grid-template-columns:minmax(330px,.9fr) minmax(500px,1.45fr);gap:12px}.analysis-top-grid{grid-template-columns:minmax(560px,1.65fr) minmax(300px,.75fr)}.analysis-panel{padding:15px;min-width:0}.analysis-wide{min-width:0}.analysis-full-panel{margin-top:12px}.analysis-chart-scroll{overflow-x:auto}.analysis-trend-svg{display:block;width:100%;min-width:700px;height:auto}.analysis-grid-line{stroke:#e7eef2;stroke-width:1}.analysis-axis-label{fill:#758795;font-size:10px;font-weight:700}.analysis-bar-actual{fill:#0f766e}.analysis-bar-budget{fill:#9dc8da}.analysis-line-ly{fill:none;stroke:#e79545;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.analysis-line-dot{fill:#fff;stroke:#e79545;stroke-width:2}.analysis-legend{display:flex;align-items:center;gap:6px;color:#687b88;font-size:10px}.analysis-legend i{width:10px;height:10px;border-radius:3px}.analysis-legend .actual{background:#0f766e}.analysis-legend .budget{background:#9dc8da}.analysis-legend .ly{width:14px;height:3px;background:#e79545}
      .analysis-mix-layout{display:grid;grid-template-columns:150px 1fr;align-items:center;gap:18px;min-height:245px}.analysis-donut{width:150px;height:150px;border-radius:50%;display:grid;place-items:center}.analysis-donut>div{width:94px;height:94px;border-radius:50%;display:grid;place-content:center;text-align:center;background:#fff;box-shadow:0 0 0 1px #e7eef2}.analysis-donut strong{color:#153b50;font-size:18px}.analysis-donut span{margin-top:3px;color:#7b8b98;font-size:9px}.analysis-mix-legend{display:grid;gap:9px}.analysis-mix-legend>div{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:8px;color:#546877;font-size:12px}.analysis-mix-legend i{width:9px;height:9px;border-radius:50%}.analysis-mix-legend b{color:#173f3b}
      .analysis-ranking{display:grid;gap:10px;max-height:390px;overflow:auto;padding-right:4px}.analysis-rank-row{display:grid;grid-template-columns:minmax(115px,1fr) minmax(150px,1.5fr) 82px;align-items:center;gap:9px}.analysis-rank-label{display:flex;align-items:center;gap:7px;min-width:0;color:#425b6b;font-size:11px;font-weight:700}.analysis-rank-label b{display:grid;place-items:center;flex:0 0 21px;height:21px;border-radius:6px;background:#edf4f5;color:#0f766e;font-size:9px}.analysis-rank-label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.analysis-rank-track{position:relative;height:12px;border-radius:8px;background:#edf2f5}.analysis-rank-track i{position:absolute;inset:0 auto 0 0;border-radius:8px;background:linear-gradient(90deg,#0f766e,#35a99c)}.analysis-rank-track em{position:absolute;top:-3px;width:2px;height:18px;background:#173f3b}.analysis-rank-value{text-align:right}.analysis-rank-value strong{display:block;color:#173f3b;font-size:11px}.analysis-rank-value small{font-size:9px;font-weight:800}
      .analysis-table-wrap{overflow:auto;max-height:400px;border:1px solid #e2e9ed;border-radius:10px}.analysis-table{width:100%;border-collapse:separate;border-spacing:0;font-size:11px}.analysis-table th,.analysis-table td{padding:9px 10px;border-right:1px solid #e6ecef;border-bottom:1px solid #e6ecef;text-align:right;white-space:nowrap;background:#fff}.analysis-table th{position:sticky;top:0;z-index:2;background:#173f3b;color:#fff;text-align:center;font-size:10px}.analysis-table th:first-child,.analysis-table td:first-child{text-align:left}.analysis-table tbody tr:hover td{background:#f4faf8}.analysis-table td.positive{background:#edf9f3;color:#087a4d;font-weight:800}.analysis-table td.negative{background:#fff1f2;color:#c03745;font-weight:800}.analysis-unit-table td:first-child{max-width:220px;overflow:hidden;text-overflow:ellipsis}.analysis-no-data{display:grid;place-items:center;min-height:170px;color:#7b8b98;font-size:12px;text-align:center}.analysis-empty-state{min-height:520px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:42px 24px;text-align:center}.analysis-empty-icon{width:86px;height:86px;display:grid;place-items:center;margin-bottom:18px;border-radius:24px;background:linear-gradient(145deg,#0b3158,#159b8d);color:#fff;font-size:34px;font-weight:950;box-shadow:0 14px 30px rgba(11,49,88,.18)}.analysis-empty-state h3{margin:0;color:#0b3158;font-size:25px}.analysis-empty-state p{max-width:620px;margin:10px 0 0;color:#6b7a88;font-size:15px;line-height:1.65}
      body.analysis-presentation{overflow:auto;background:#f3f7f8}body.analysis-presentation .app-header,body.analysis-presentation .report-sidebar,body.analysis-presentation .sales-only-ui,body.analysis-presentation #activeFilterBar{display:none!important}body.analysis-presentation .report-layout{display:block!important}body.analysis-presentation .report-main{width:100%!important;max-width:none!important;padding:10px!important}body.analysis-presentation #analysisSection{display:block!important}body.analysis-presentation .analysis-report-card{border:0;box-shadow:none}body.analysis-presentation .analysis-page-head{position:sticky;top:0;z-index:20}body.analysis-presentation .analysis-kpi strong{font-size:29px}
      @media(max-width:1250px){.analysis-kpi-grid{grid-template-columns:repeat(2,minmax(160px,1fr))}.analysis-insight-grid{grid-template-columns:1fr 1fr}.analysis-dashboard-grid,.analysis-top-grid{grid-template-columns:1fr}.analysis-controls{max-width:620px}.analysis-page-head{flex-direction:column}.analysis-mix-layout{grid-template-columns:170px 1fr}}
      @media(max-width:720px){#analysisDashboard{padding:10px}.analysis-kpi-grid,.analysis-insight-grid{grid-template-columns:1fr}.analysis-rank-row{grid-template-columns:1fr}.analysis-rank-track{order:3}.analysis-rank-value{text-align:left}.analysis-mix-layout{grid-template-columns:1fr;justify-items:center}.analysis-page-head{padding:15px}.analysis-controls{justify-content:flex-start}.analysis-scope-line{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  const originalSetBusinessReportTab = window.setBusinessReportTab;
  if (typeof originalSetBusinessReportTab === 'function') {
    const patchedSetBusinessReportTab = function (tabId) {
      originalSetBusinessReportTab.call(this, tabId);
      const isAnalysis = tabId === 'analysisSection';
      document.body.classList.toggle('analysis-view', isAnalysis);
      if (isAnalysis) {
        const subtitle = document.getElementById('headerSubtitle');
        if (subtitle) subtitle.textContent = 'Sales Analysis · Executive Dashboard';
        queueRender();
      }
    };
    window.setBusinessReportTab = patchedSetBusinessReportTab;
    try { setBusinessReportTab = patchedSetBusinessReportTab; } catch (_) {}
    tab.addEventListener('click', () => patchedSetBusinessReportTab('analysisSection'));
  }

  document.getElementById('analysisBudgetMode')?.addEventListener('change', event => {
    state.budgetMode = event.target.value === 'fy' ? 'fy' : 'ytd';
    render();
  });
  document.getElementById('analysisDimension')?.addEventListener('change', event => {
    state.dimension = DIMENSIONS[event.target.value] ? event.target.value : 'Country';
    render();
  });
  document.getElementById('analysisTopN')?.addEventListener('change', event => {
    state.topN = Math.max(5, Number(event.target.value) || 10);
    render();
  });
  document.querySelectorAll('[data-analysis-currency]').forEach(button => {
    button.addEventListener('click', () => {
      state.currency = button.dataset.analysisCurrency === 'JOD' ? 'JOD' : 'USD';
      document.querySelectorAll('[data-analysis-currency]').forEach(option => {
        option.classList.toggle('active', option === button);
      });
      render();
    });
  });
  document.getElementById('analysisExport')?.addEventListener('click', exportAnalysis);
  document.getElementById('analysisPresentation')?.addEventListener('click', togglePresentation);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('analysis-presentation')) {
      document.body.classList.remove('analysis-presentation');
      const button = document.getElementById('analysisPresentation');
      if (button) button.textContent = 'Presentation';
    }
  });

  document.addEventListener('change', event => {
    if (FILTERS.some(([id]) => event.target.closest?.(`#${id}`))) queueRender();
  });
  document.addEventListener('click', event => {
    if (event.target.closest?.('.multi-option,.select-visible,.clear-selection,#resetBtn,#clearAllActiveFilters')) {
      setTimeout(queueRender, 25);
    }
  });

  window.loadSalesAnalysisRows = rows => {
    state.rows = (rows || []).map(normalizeRow);
    window.BR_SALES_ANALYSIS_DIAGNOSTICS = {
      version:MODULE_VERSION,
      rows:state.rows.length,
      years:[...new Set(state.rows.map(row => row.year).filter(Boolean))].sort(),
      rowsWithActual:state.rows.filter(row => row.actual).length,
      rowsWithBudget:state.rows.filter(row => row.budget).length,
      rowsWithLy:state.rows.filter(row => row.ly).length,
      rowsWithActualQty:state.rows.filter(row => row.actualQty).length,
      rowsWithBudgetQty:state.rows.filter(row => row.budgetQty).length
    };
    queueRender();
  };

  let analysisAllowed = true;
  const access = window.BRReportAccess;

  function canAccessAnalysis(profile) {
    if (profile?.role === 'admin') return true;
    const hasSavedPermissions = Object.prototype.hasOwnProperty.call(profile || {}, 'reportPermissions');
    if (!hasSavedPermissions) return true;
    return Array.isArray(profile.reportPermissions) && profile.reportPermissions.includes('analysis');
  }

  function applyAnalysisVisibility(profile) {
    analysisAllowed = canAccessAnalysis(profile);
    tab.style.display = analysisAllowed ? '' : 'none';
    tab.dataset.reportAccessManaged = 'true';

    if (!analysisAllowed) {
      tab.classList.remove('active');
      section.classList.remove('active');
      section.hidden = true;
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    const businessButton = document.querySelector('[data-workspace="businessWorkspace"]');
    const businessWorkspace = document.getElementById('businessWorkspace');
    if (businessButton) businessButton.style.display = '';
    if (businessWorkspace) businessWorkspace.style.display = '';

    const visibleActiveTab = submenu.querySelector('.tab-btn.active:not([style*="display: none"])');
    if (!visibleActiveTab) {
      if (businessButton && !businessButton.classList.contains('active')) businessButton.click();
      tab.click();
    }
  }

  if (access) {
    if (!access.catalog.some(item => item.key === 'analysis')) {
      const mdaIndex = access.catalog.findIndex(item => item.key === 'mda');
      const insertAt = mdaIndex >= 0 ? mdaIndex : access.catalog.length;
      access.catalog.splice(insertAt, 0, { key:'analysis', label:'Analysis' });
    }
    if (!access.allKeys.includes('analysis')) access.allKeys.push('analysis');

    const originalResolve = access.resolve.bind(access);
    access.resolve = profile => {
      const resolved = originalResolve(profile);
      if (canAccessAnalysis(profile) && !resolved.includes('analysis')) resolved.push('analysis');
      return resolved;
    };

    const originalHas = access.has.bind(access);
    access.has = key => key === 'analysis' ? analysisAllowed : originalHas(key);
    access.any = keys => keys.some(key => access.has(key));

    const originalApply = access.apply.bind(access);
    access.apply = profile => {
      analysisAllowed = canAccessAnalysis(profile);
      const result = originalApply(profile);
      const merged = new Set(result || []);
      if (analysisAllowed) merged.add('analysis');
      else merged.delete('analysis');
      window.BR_ALLOWED_REPORTS = [...merged];
      applyAnalysisVisibility(profile);
      return [...merged];
    };
  }

  render();
})();
