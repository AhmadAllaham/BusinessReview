(() => {
  'use strict';

  if (window.__actualGp2026FixInstalled) return;
  window.__actualGp2026FixInstalled = true;

  const normalizeKey = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

  const toNumber = value => {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value).trim();
    const parsed = Number(text.replace(/[(),%$]/g, '').replace(/,/g, ''));
    if (!Number.isFinite(parsed)) return 0;
    return /^\(.*\)$/.test(text) ? -Math.abs(parsed) : parsed;
  };

  function findEntry(row, aliases) {
    const keys = new Map(Object.keys(row || {}).map(key => [normalizeKey(key), key]));
    for (const alias of aliases) {
      const key = keys.get(normalizeKey(alias));
      if (key !== undefined) return { key, value:row[key] };
    }
    return null;
  }

  function removeOldYearMetrics(row) {
    Object.keys(row).forEach(key => {
      const normalized = normalizeKey(key);
      if (
        normalized.includes('2025') &&
        (normalized.includes('sales') || normalized.includes('grossprofit') || normalized.includes('gp'))
      ) {
        delete row[key];
      }
    });
  }

  function normalizeSalesRow(source) {
    if (!source || typeof source !== 'object') return source;
    if (source.__actualGp2026Normalized === true) return source;

    const row = { ...source };
    removeOldYearMetrics(row);

    const actualSales = findEntry(source, [
      'Actual Sales YTD 2026',
      'Actual Value',
      'Actual  Value',
      'Actual Sales',
      'Actual'
    ]);
    const budgetSales = findEntry(source, [
      'Budget Sales YTD 2026',
      'Budget Value',
      'Budget  Value',
      'Budget Sales',
      'Budget'
    ]);
    const actualQty = findEntry(source, [
      'Actual QTY', 'Actual Qty', 'Actual Quantity', 'Actual Units',
      'Total Actual Q', 'Total Actual Qty', 'QTY Actual'
    ]);
    const budgetQty = findEntry(source, [
      'Budget QTY', 'Budget Qty', 'Budget Quantity', 'Budget Units',
      'Total Budget Q', 'Total Budget Qty', 'QTY Budget'
    ]);

    // Actual Sales is stored in thousands. Budget Sales is stored in full
    // currency units, so convert Budget to thousands before comparing it with
    // Actual. Budget quantity is scaled by the same factor so Budget per Unit
    // remains equal to the original full Budget value divided by Budget QTY.
    if (actualSales) row['Actual Value'] = toNumber(actualSales.value);
    if (budgetSales) row['Budget Value'] = toNumber(budgetSales.value) / 1000;
    if (actualQty) row['Actual QTY'] = toNumber(actualQty.value);
    if (budgetQty) row['Budget QTY'] = toNumber(budgetQty.value) / 1000;

    row.__actualGp2026Normalized = true;
    return row;
  }

  function scenarioOf(row) {
    const entry = findEntry(row, ['Scenario', 'Period', 'Version']);
    const value = normalizeKey(entry?.value);
    if (value.includes('actual')) return 'actual';
    if (value.includes('budget')) return 'budget';
    return '';
  }

  function normalizePnlRow(source) {
    if (!source || typeof source !== 'object') return source;
    if (source.__actualGp2026Normalized === true) return source;

    const row = { ...source };
    removeOldYearMetrics(row);

    const actualGp = findEntry(source, [
      'Actual GP YTD 2026',
      'Actual Gross Profit YTD 2026',
      'Actual GP',
      'Actual Gross Profit'
    ]);
    const budgetGp = findEntry(source, [
      'Budget GP YTD 2026',
      'Budget Gross Profit YTD 2026',
      'Budget GP',
      'Budget Gross Profit'
    ]);
    const grossProfit = findEntry(source, [
      'Gross Profit', 'GrossProfit', 'Gross Margin', 'GP'
    ]);
    const scenario = scenarioOf(source);

    // Actual GP is stored in thousands. Budget GP is stored in full currency
    // units and must be converted to thousands for a valid GP comparison.
    if (actualGp) row['Actual GP'] = toNumber(actualGp.value);
    if (budgetGp) row['Budget GP'] = toNumber(budgetGp.value) / 1000;

    // Scenario-based P&L files may use one Gross Profit field instead of
    // separate Actual/Budget columns. Normalize only Budget scenarios.
    if (grossProfit && scenario === 'budget') {
      row[grossProfit.key] = toNumber(grossProfit.value) / 1000;
    }

    row.__actualGp2026Normalized = true;
    return row;
  }

  function wrapLoader(loader) {
    if (typeof loader !== 'function' || loader.__actualGp2026Wrapped) return loader;

    const wrapped = function (salesRows, pnlRows, profitabilityRows) {
      const normalizedSales = (salesRows || []).map(normalizeSalesRow);
      const normalizedPnl = (pnlRows || []).map(normalizePnlRow);

      window.BR_ACTUAL_GP_DIAGNOSTICS = {
        year: 2026,
        salesRows: normalizedSales.length,
        pnlRows: normalizedPnl.length,
        budgetSalesConvertedToThousands: normalizedSales.filter(row =>
          Object.prototype.hasOwnProperty.call(row, 'Budget Value')
        ).length,
        budgetGpConvertedToThousands: normalizedPnl.filter(row =>
          Object.prototype.hasOwnProperty.call(row, 'Budget GP')
        ).length
      };

      return loader.call(this, normalizedSales, normalizedPnl, profitabilityRows || []);
    };

    wrapped.__actualGp2026Wrapped = true;
    return wrapped;
  }

  let assignedLoader = window.loadActualGpRows;

  try {
    Object.defineProperty(window, 'loadActualGpRows', {
      configurable: true,
      enumerable: true,
      get() {
        return assignedLoader;
      },
      set(loader) {
        assignedLoader = wrapLoader(loader);
      }
    });

    if (typeof assignedLoader === 'function') {
      const current = assignedLoader;
      window.loadActualGpRows = current;
    }
  } catch (error) {
    console.error('Could not install the Actual GP 2026 calculation fix.', error);
  }
})();
