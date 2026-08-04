(() => {
  'use strict';

  const MODULE_VERSION = 2;
  if ((window.__BR_ACTUAL_GP_MODULE_VERSION__ || 0) >= MODULE_VERSION) return;
  window.__BR_ACTUAL_GP_MODULE_VERSION__ = MODULE_VERSION;

  const USD_TO_JOD = 0.709;
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
  const VIEW_KEYS = {
    Country: 'country',
    Agent: 'agent',
    'Sales Type': 'type',
    'Product Group': 'group',
    Product: 'product'
  };

  const state = {
    sales: [],
    pnl: [],
    profitability: [],
    currency: 'USD',
    view: 'Country',
    showGp: false,
    sort: 'actualSales',
    direction: -1
  };

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

  function hasField(row, aliases) {
    const keys = new Set(Object.keys(row || {}).map(normalizeKey));
    return aliases.some(alias => keys.has(normalizeKey(alias)));
  }

  function normalizeType(value) {
    const key = normalizeKey(value);
    if (key.includes('tms')) return 'TMS';
    if (key.includes('ims')) return 'IMS';
    return String(value ?? '').trim();
  }

  function normalizeSales(row) {
    const actualSalesK = number(row, [
      'Actual Sales YTD 2026', 'Actual Value', 'Actual  Value',
      'Actual Sales', 'Actual', '__actual'
    ]);
    const budgetSalesFull = number(row, [
      'Budget Sales YTD 2026', 'Budget Value', 'Budget  Value',
      'Budget Sales', 'Budget', '__budget'
    ]);

    return {
      year: text(row, ['Year', 'Fiscal Year']),
      month: text(row, ['Month', 'Reporting Month', 'Period']),
      type: normalizeType(text(row, ['Type', 'Sales Type', 'SalesType'])),
      country: text(row, ['Country', 'Market', 'Country Name'], 'Unassigned'),
      sector: text(row, ['Sector']),
      agent: text(row, ['Agent', 'Distributor', 'Customer'], 'Unassigned'),
      group: text(row, [
        'Product Group', 'ProductGroup', 'Brand', 'Family',
        'Product Family', 'Group'
      ], 'Unassigned'),
      product: text(row, [
        'Product Name', 'ProductName', 'Product', 'SKU',
        'Item Description', 'Item'
      ], 'Unassigned'),
      actualSalesK,
      budgetSalesFull,
      budgetSalesK: budgetSalesFull / 1000,
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

  function scenario(value) {
    const key = normalizeKey(value);
    if (key.includes('actual')) return 'Actual';
    if (key.includes('fybudget') || key.includes('fullyearbudget') || key.includes('budgetfy')) {
      return 'FY Budget';
    }
    if (key.includes('budget') || key === 'bud') return 'Budget';
    if (key === 'ly' || key.includes('lastyear')) return 'LY';
    return '';
  }

  function normalizePnl(row) {
    const rowScenario = scenario(text(row, ['Scenario', 'scenario', 'Period', 'Version']));
    const genericGp = number(row, [
      'Gross Profit', 'grossProfit', 'GrossProfit', 'Gross Margin', 'GP'
    ]);
    const explicitActualGpK = number(row, [
      'Actual GP YTD 2026', 'Actual Gross Profit YTD 2026',
      'Actual GP', 'Actual Gross Profit'
    ]);
    const explicitBudgetGpFull = number(row, [
      'Budget GP YTD 2026', 'Budget Gross Profit YTD 2026',
      'Budget GP', 'Budget Gross Profit'
    ]);

    const hasExplicitActual = hasField(row, [
      'Actual GP YTD 2026', 'Actual Gross Profit YTD 2026',
      'Actual GP', 'Actual Gross Profit'
    ]);
    const hasExplicitBudget = hasField(row, [
      'Budget GP YTD 2026', 'Budget Gross Profit YTD 2026',
      'Budget GP', 'Budget Gross Profit'
    ]);

    let actualGpK = hasExplicitActual ? explicitActualGpK : 0;
    let budgetGpFull = hasExplicitBudget ? explicitBudgetGpFull : 0;
    let hasActual = hasExplicitActual;
    let hasBudget = hasExplicitBudget;

    if (rowScenario === 'Actual') {
      actualGpK = genericGp;
      hasActual = true;
    } else if (rowScenario === 'Budget' || rowScenario === 'FY Budget') {
      budgetGpFull = genericGp;
      hasBudget = true;
    } else if (!hasActual && !hasBudget && hasField(row, [
      'Gross Profit', 'grossProfit', 'GrossProfit', 'Gross Margin', 'GP'
    ])) {
      actualGpK = genericGp;
      hasActual = true;
    }

    return {
      year: text(row, ['Year', 'Fiscal Year']),
      month: text(row, ['Month', 'Reporting Month']),
      type: normalizeType(text(row, ['Sales Type', 'salesType', 'Type'])),
      country: text(row, ['Market', 'market', 'Country', 'Country Name']),
      sector: text(row, ['Sector']),
      agent: text(row, ['Agent', 'agent', 'Distributor', 'Customer']),
      group: text(row, ['Product Group', 'Brand', 'Family', 'Product Family']),
      product: text(row, ['Product Name', 'Product', 'SKU']),
      scenario: rowScenario,
      actualGpK,
      budgetGpFull,
      budgetGpK: budgetGpFull / 1000,
      hasActual,
      hasBudget,
      isTotal: ['total', 'grandtotal'].includes(normalizeKey(text(row, ['Sales Type', 'salesType']))) ||
        normalizeKey(text(row, ['Market', 'market'])).includes('totalcompany')
    };
  }

  function normalizeProfitability(row) {
    return {
      country: text(row, ['Country', 'Country Name', 'Market']),
      agent: text(row, ['Agent', 'Sub Market', 'Customer', 'Distributor']),
      group: text(row, ['Brand', 'Product Group'], 'Unassigned'),
      product: text(row, ['Product', 'SKU', 'Product Name']),
      netSales: number(row, ['Net Sales USD', 'Net Sales']),
      grossProfit: number(row, ['Gross Profit USD', 'Gross Profit'])
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

  function matchesSalesFilters(row, ignoreProductFilters = false) {
    return FILTERS.every(([filterId, property]) => {
      if (ignoreProductFilters && (property === 'group' || property === 'product')) return true;
      const values = selected(filterId);
      if (!values.length) return true;
      return values.some(value => sameText(value, row[property]));
    });
  }

  function matchesPnlFilters(row) {
    return FILTERS.every(([filterId, property]) => {
      if (property === 'group' || property === 'product') return true;
      const values = selected(filterId);
      if (!values.length || !String(row[property] ?? '').trim()) return true;
      return values.some(value => sameText(value, row[property]));
    });
  }

  function pnlScopeMatches(pnlRow, salesRow) {
    return ['country', 'agent', 'type', 'group', 'product'].every(property =>
      !pnlRow[property] || sameText(pnlRow[property], salesRow[property])
    );
  }

  function preferredPnlRows(rows) {
    const actual = rows
      .filter(row => row.hasActual && !row.isTotal)
      .map(row => ({ ...row, hasBudget: false, budgetGpK: 0, budgetGpFull: 0 }));

    const genericBudget = rows
      .filter(row => row.hasBudget && !row.isTotal && !row.scenario)
      .map(row => ({ ...row, hasActual: false, actualGpK: 0 }));

    const groups = new Map();
    rows.filter(row => row.hasBudget && !row.isTotal && row.scenario).forEach(row => {
      const key = ['year', 'month', 'type', 'country', 'sector', 'agent', 'group', 'product']
        .map(property => textId(row[property]))
        .join('|');
      if (!groups.has(key)) groups.set(key, { budget: [], fyBudget: [] });
      groups.get(key)[row.scenario === 'FY Budget' ? 'fyBudget' : 'budget']
        .push({ ...row, hasActual: false, actualGpK: 0 });
    });

    const preferredBudget = [...groups.values()].flatMap(group =>
      group.budget.length ? group.budget : group.fyBudget
    );

    return [...actual, ...genericBudget, ...preferredBudget];
  }

  function allocateGp(groupRows, baseSales, pnlRows) {
    let actualGpK = 0;
    let budgetGpK = 0;
    let budgetGpFull = 0;

    pnlRows.forEach(pnlRow => {
      const allRows = baseSales.filter(salesRow => pnlScopeMatches(pnlRow, salesRow));
      const selectedRows = groupRows.filter(salesRow => pnlScopeMatches(pnlRow, salesRow));
      if (!allRows.length || !selectedRows.length) return;

      if (pnlRow.hasActual) {
        const allSales = allRows.reduce((sum, row) => sum + row.actualSalesK, 0);
        const groupSales = selectedRows.reduce((sum, row) => sum + row.actualSalesK, 0);
        const allQty = allRows.reduce((sum, row) => sum + row.actualQty, 0);
        const groupQty = selectedRows.reduce((sum, row) => sum + row.actualQty, 0);
        const share = allSales ? groupSales / allSales : allQty ? groupQty / allQty : 0;
        actualGpK += pnlRow.actualGpK * share;
      }

      if (pnlRow.hasBudget) {
        const allSales = allRows.reduce((sum, row) => sum + row.budgetSalesK, 0);
        const groupSales = selectedRows.reduce((sum, row) => sum + row.budgetSalesK, 0);
        const allQty = allRows.reduce((sum, row) => sum + row.budgetQty, 0);
        const groupQty = selectedRows.reduce((sum, row) => sum + row.budgetQty, 0);
        const share = allSales ? groupSales / allSales : allQty ? groupQty / allQty : 0;
        budgetGpK += pnlRow.budgetGpK * share;
        budgetGpFull += pnlRow.budgetGpFull * share;
      }
    });

    return { actualGpK, budgetGpK, budgetGpFull };
  }

  function profitabilityClass(row, name) {
    const dimension = VIEW_KEYS[state.view];
    const matching = state.profitability.filter(item => sameText(item[dimension], name));
    const netSales = matching.reduce((sum, item) => sum + item.netSales, 0);
    const grossProfit = matching.reduce((sum, item) => sum + item.grossProfit, 0);
    const ratio = netSales
      ? grossProfit / netSales
      : row.budgetSalesK
        ? row.budgetGpK / row.budgetSalesK
        : NaN;

    if (!Number.isFinite(ratio)) return '—';
    return ratio >= 0.5 ? 'H'
      : ratio >= 0.3 ? 'M'
        : ratio >= 0.2 ? 'LH'
          : ratio >= 0.1 ? 'LM'
            : ratio >= 0 ? 'LL' : 'LS';
  }

  function calculateRows() {
    const filteredSales = state.sales.filter(row => matchesSalesFilters(row));
    const baseSales = state.sales.filter(row => matchesSalesFilters(row, true));
    const pnlRows = preferredPnlRows(
      state.pnl.filter(row => matchesPnlFilters(row))
    );
    const dimension = VIEW_KEYS[state.view];
    const groups = new Map();

    filteredSales.forEach(row => {
      const name = String(row[dimension] || 'Unassigned').trim() || 'Unassigned';
      const key = textId(name);
      if (!groups.has(key)) groups.set(key, { name, rows: [] });
      groups.get(key).rows.push(row);
    });

    const output = [...groups.values()].map(group => {
      const sum = property => group.rows.reduce((total, row) => total + row[property], 0);
      const actualSales = sum('actualSalesK');
      const budgetSales = sum('budgetSalesK');
      const budgetSalesFull = sum('budgetSalesFull');
      const actualQty = sum('actualQty');
      const budgetQty = sum('budgetQty');
      const { actualGpK, budgetGpK, budgetGpFull } = allocateGp(group.rows, baseSales, pnlRows);

      const row = {
        name: group.name,
        actualSales,
        budgetSales,
        budgetSalesFull,
        actualQty,
        budgetQty,
        actualGp: actualGpK,
        budgetGp: budgetGpK,
        budgetGpFull
      };

      Object.assign(row, {
        salesVariance: actualSales - budgetSales,
        salesVariancePct: budgetSales ? actualSales / budgetSales - 1 : NaN,
        gpVariance: actualGpK - budgetGpK,
        gpVariancePct: budgetGpK ? actualGpK / budgetGpK - 1 : NaN,
        actualGpPct: actualSales ? actualGpK / actualSales : NaN,
        budgetGpPct: budgetSales ? budgetGpK / budgetSales : NaN,
        actualSalesUnit: actualQty ? actualSales * 1000 / actualQty : NaN,
        budgetSalesUnit: budgetQty ? budgetSalesFull / budgetQty : NaN,
        actualGpUnit: actualQty ? actualGpK * 1000 / actualQty : NaN,
        budgetGpUnit: budgetQty ? budgetGpFull / budgetQty : NaN
      });

      row.gpClass = profitabilityClass(row, row.name);
      return row;
    });

    return output.sort((left, right) => {
      const leftValue = state.sort === 'name' ? textId(left.name) : left[state.sort];
      const rightValue = state.sort === 'name' ? textId(right.name) : right[state.sort];
      const comparison = typeof leftValue === 'string'
        ? String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true })
        : (Number.isFinite(leftValue) ? leftValue : -Infinity) -
          (Number.isFinite(rightValue) ? rightValue : -Infinity);
      return comparison * state.direction;
    });
  }

  function totalRow(rows) {
    const total = {
      name: 'Total',
      actualSales: 0,
      budgetSales: 0,
      budgetSalesFull: 0,
      actualQty: 0,
      budgetQty: 0,
      actualGp: 0,
      budgetGp: 0,
      budgetGpFull: 0
    };

    rows.forEach(row => {
      ['actualSales', 'budgetSales', 'budgetSalesFull', 'actualQty', 'budgetQty',
        'actualGp', 'budgetGp', 'budgetGpFull']
        .forEach(property => { total[property] += Number(row[property]) || 0; });
    });

    Object.assign(total, {
      salesVariance: total.actualSales - total.budgetSales,
      salesVariancePct: total.budgetSales ? total.actualSales / total.budgetSales - 1 : NaN,
      gpVariance: total.actualGp - total.budgetGp,
      gpVariancePct: total.budgetGp ? total.actualGp / total.budgetGp - 1 : NaN,
      actualGpPct: total.actualSales ? total.actualGp / total.actualSales : NaN,
      budgetGpPct: total.budgetSales ? total.budgetGp / total.budgetSales : NaN,
      actualSalesUnit: total.actualQty ? total.actualSales * 1000 / total.actualQty : NaN,
      budgetSalesUnit: total.budgetQty ? total.budgetSalesFull / total.budgetQty : NaN,
      actualGpUnit: total.actualQty ? total.actualGp * 1000 / total.actualQty : NaN,
      budgetGpUnit: total.budgetQty ? total.budgetGpFull / total.budgetQty : NaN,
      gpClass: '—'
    });

    return total;
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function money(value, decimals = 0) {
    if (!Number.isFinite(Number(value))) return '—';
    const converted = Number(value) * (state.currency === 'JOD' ? USD_TO_JOD : 1);
    const formatted = Math.abs(converted).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return converted < 0 ? `(${formatted})` : formatted;
  }

  const percent = value => Number.isFinite(Number(value))
    ? `${(Number(value) * 100).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`
    : '—';

  const varianceClass = value => !Number.isFinite(Number(value)) || value === 0
    ? 'actual-gp-neutral'
    : value > 0 ? 'actual-gp-good' : 'actual-gp-bad';

  const COLUMNS = [
    ['name', 'Dimension'],
    ['actualSales', "Actual Sales ('000)"],
    ['budgetSales', "Budget Sales ('000)"],
    ['salesVariance', 'Sales Variance'],
    ['salesVariancePct', 'Sales Var %'],
    ['actualGp', "Actual GP ('000)"],
    ['budgetGp', "Budget GP ('000)"],
    ['gpVariance', 'GP Variance'],
    ['gpVariancePct', 'GP Var %'],
    ['actualGpPct', 'Actual GP %'],
    ['budgetGpPct', 'Budget GP %'],
    ['actualSalesUnit', 'Actual Sales / Unit'],
    ['budgetSalesUnit', 'Budget Sales / Unit'],
    ['actualGpUnit', 'Actual GP / Unit'],
    ['budgetGpUnit', 'Budget GP / Unit']
  ];

  function tableCell(row, property) {
    if (property === 'name') {
      return `<td class="actual-gp-name">${escapeHtml(row.name)}</td>`;
    }
    if (property === 'salesVariance' || property === 'gpVariance') {
      return `<td class="${varianceClass(row[property])}">${money(row[property])}</td>`;
    }
    if (property.endsWith('Pct')) {
      return `<td class="${property.includes('Variance') ? varianceClass(row[property]) : ''}">${percent(row[property])}</td>`;
    }
    return `<td>${money(row[property], property.endsWith('Unit') ? 2 : 0)}</td>`;
  }

  function render() {
    const table = document.getElementById('actualGpTable');
    if (!table) return;

    const rows = calculateRows();
    const columns = state.showGp ? [...COLUMNS, ['gpClass', 'GP%']] : COLUMNS;
    const count = document.getElementById('actualGpCount');
    const quality = document.getElementById('actualGpDataQuality');

    if (count) count.textContent = `${rows.length.toLocaleString('en-US')} rows`;
    if (quality) {
      const missingActualQty = rows.filter(row => !row.actualQty).length;
      const missingBudgetQty = rows.filter(row => !row.budgetQty).length;
      const missingGp = rows.filter(row => !row.actualGp && !row.budgetGp).length;
      const notes = [];
      if (missingActualQty) notes.push(`${missingActualQty} without Actual QTY`);
      if (missingBudgetQty) notes.push(`${missingBudgetQty} without Budget QTY`);
      if (missingGp) notes.push(`${missingGp} without matching GP`);
      quality.textContent = notes.length ? `· ${notes.join(' · ')}` : '· All calculation inputs available';
      quality.classList.toggle('has-warning', Boolean(notes.length));
    }

    table.innerHTML = `
      <thead><tr>${columns.map(([property, label]) => `
        <th data-gpsort="${property}">
          ${escapeHtml(property === 'name' ? state.view : label)}
          ${state.sort === property ? `<span>${state.direction > 0 ? '▲' : '▼'}</span>` : ''}
        </th>`).join('')}</tr></thead>
      <tbody>
        ${rows.length ? rows.map(row => `
          <tr>
            ${COLUMNS.map(([property]) => tableCell(row, property)).join('')}
            ${state.showGp ? `<td class="actual-gp-class gp-${row.gpClass.toLowerCase()}">${escapeHtml(row.gpClass)}</td>` : ''}
          </tr>`).join('') : `
          <tr><td colspan="${columns.length}" class="actual-gp-empty">No matching data for the selected filters.</td></tr>`}
        ${rows.length ? `
          <tr class="actual-gp-total">
            ${COLUMNS.map(([property]) => tableCell(totalRow(rows), property)).join('')}
            ${state.showGp ? '<td>—</td>' : ''}
          </tr>` : ''}
      </tbody>`;

    table.querySelectorAll('[data-gpsort]').forEach(header => {
      header.onclick = () => {
        const property = header.dataset.gpsort;
        if (state.sort === property) state.direction *= -1;
        else {
          state.sort = property;
          state.direction = property === 'name' ? 1 : -1;
        }
        render();
      };
    });
  }

  function installStyles() {
    if (document.getElementById('actual-gp-style')) return;
    const style = document.createElement('style');
    style.id = 'actual-gp-style';
    style.textContent = `
      #actualGpSection .actual-gp-formulas{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:8px;margin-top:8px}
      #actualGpSection .actual-gp-formulas span{padding:9px;border:1px solid #dbe3ec;border-radius:9px;background:#f8fafc;font-size:12px}
      #actualGpSection .actual-gp-scroll{max-height:calc(100vh - 300px);overflow:auto;border:1px solid #dbe3ec;border-radius:12px}
      #actualGpTable{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
      #actualGpTable th,#actualGpTable td{padding:10px 11px;border-right:1px solid #e5eaf0;border-bottom:1px solid #e5eaf0;text-align:right;white-space:nowrap;background:#fff}
      #actualGpTable th{position:sticky;top:0;z-index:3;background:#162a46;color:#fff;text-align:center;cursor:pointer}
      #actualGpTable th:first-child,#actualGpTable td:first-child{position:sticky;left:0;z-index:2;text-align:left}
      #actualGpTable th:first-child{z-index:4;background:#102139}
      #actualGpTable .actual-gp-good{color:#08783f;background:#eaf8f0;font-weight:700}
      #actualGpTable .actual-gp-bad{color:#bc1f2d;background:#fff0f1;font-weight:700}
      #actualGpTable .actual-gp-total td{position:sticky;bottom:0;background:#eaf0f7;font-weight:800;border-top:2px solid #8ea1b8}
      #actualGpTable .actual-gp-empty{text-align:center;padding:28px}
      .actual-gp-class{text-align:center!important;font-weight:800}
      .actual-gp-class.gp-h,.actual-gp-class.gp-m{background:#0b7043!important;color:#fff}
      .actual-gp-class.gp-lh,.actual-gp-class.gp-lm{background:#f0d36b!important}
      .actual-gp-class.gp-ll{background:#f0a45d!important}
      .actual-gp-class.gp-ls{background:#d84b55!important;color:#fff}
      #actualGpDataQuality{margin-left:7px;color:#0b7043;font-size:12px;font-weight:700}
      #actualGpDataQuality.has-warning{color:#a15b00}
      @media(max-width:900px){#actualGpSection .actual-gp-formulas{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function installUi() {
    if (document.getElementById('actualGpSection')) return;
    installStyles();

    const menu = document.getElementById('businessSubmenu');
    const salesTab = menu?.querySelector('[data-tab="salesSection"]');
    const tab = document.createElement('button');
    tab.className = 'tab-btn';
    tab.type = 'button';
    tab.dataset.tab = 'actualGpSection';
    tab.textContent = 'Actual GP vs Budget GP';
    if (salesTab) salesTab.after(tab);
    else menu?.appendChild(tab);

    const section = document.createElement('section');
    section.id = 'actualGpSection';
    section.className = 'report-section sm-format-theme';
    section.hidden = true;
    section.innerHTML = `
      <article class="report-card">
        <div class="report-head">
          <div>
            <span class="eyebrow">Profitability Performance</span>
            <h2>Actual GP vs Budget GP</h2>
            <p>Sales, gross profit, margin and per-unit performance using the active Sales filters.</p>
          </div>
          <div class="view-control">
            <label for="actualGpView">View by</label>
            <select id="actualGpView">
              ${Object.keys(VIEW_KEYS).map(value => `<option>${value}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="formula-note">
          <strong>Method:</strong>
          <div class="actual-gp-formulas">
            <span>Actual Sales / Unit = Actual Sales × 1,000 ÷ Actual QTY</span>
            <span>Budget Sales / Unit = Budget Sales ÷ Budget QTY</span>
            <span>Actual GP / Unit = Actual GP × 1,000 ÷ Actual QTY</span>
            <span>Budget GP / Unit = Budget GP ÷ Budget QTY</span>
          </div>
        </div>
        <div class="table-toolbar">
          <div><span id="actualGpCount">0 rows</span><span id="actualGpDataQuality"></span></div>
          <div class="toolbar-actions">
            <div class="pnl-currency-switch performance-currency-switch">
              <button class="active" type="button" data-gpcurrency="USD">USD</button>
              <button type="button" data-gpcurrency="JOD">JOD</button>
            </div>
            <button class="gp-toggle-btn" id="actualGpToggle" type="button">Show GP%</button>
            <button class="excel-export-btn" id="actualGpExport" type="button">Export Excel</button>
          </div>
        </div>
        <div class="actual-gp-scroll">
          <table id="actualGpTable" class="sm-reference-table sales-foc-reference-table"></table>
        </div>
      </article>`;

    document.getElementById('salesSection')?.after(section);

    tab.onclick = () => {
      if (typeof window.setBusinessReportTab === 'function') {
        window.setBusinessReportTab('actualGpSection');
      } else {
        document.querySelectorAll('.report-section').forEach(item => {
          item.hidden = true;
          item.classList.remove('active');
        });
        section.hidden = false;
        section.classList.add('active');
      }
      document.querySelectorAll('.sales-only-ui').forEach(item => { item.hidden = false; });
      render();
    };

    document.getElementById('actualGpView').onchange = event => {
      state.view = event.target.value;
      render();
    };

    document.querySelectorAll('[data-gpcurrency]').forEach(button => {
      button.onclick = () => {
        state.currency = button.dataset.gpcurrency;
        document.querySelectorAll('[data-gpcurrency]').forEach(option =>
          option.classList.toggle('active', option === button)
        );
        render();
      };
    });

    document.getElementById('actualGpToggle').onclick = event => {
      state.showGp = !state.showGp;
      event.currentTarget.textContent = state.showGp ? 'Hide GP%' : 'Show GP%';
      render();
    };

    document.getElementById('actualGpExport').onclick = () => {
      const table = document.getElementById('actualGpTable');
      if (typeof XLSX === 'undefined' || !table) return;
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.table_to_sheet(table, { raw: false });
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Actual GP vs Budget GP');
      XLSX.writeFile(
        workbook,
        `Actual_GP_vs_Budget_GP_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    };
  }

  installUi();

  document.addEventListener('change', event => {
    if (FILTERS.some(([filterId]) => event.target.closest?.(`#${filterId}`))) {
      setTimeout(render);
    }
  });

  document.addEventListener('click', event => {
    if (event.target.closest?.('#resetBtn,#clearAllActiveFilters')) setTimeout(render);
  });

  window.loadActualGpRows = (salesRows, pnlRows, profitabilityRows) => {
    state.sales = (salesRows || []).map(normalizeSales);
    state.pnl = (pnlRows || []).map(normalizePnl);
    state.profitability = (profitabilityRows || []).map(normalizeProfitability);

    window.BR_ACTUAL_GP_DIAGNOSTICS = {
      moduleVersion: MODULE_VERSION,
      salesRows: state.sales.length,
      pnlRows: state.pnl.length,
      salesWithActualQty: state.sales.filter(row => row.actualQty).length,
      salesWithBudgetQty: state.sales.filter(row => row.budgetQty).length,
      pnlActualGpRows: state.pnl.filter(row => row.hasActual && !row.isTotal).length,
      pnlBudgetGpRows: state.pnl.filter(row => row.hasBudget && !row.isTotal).length
    };

    render();
  };
})();