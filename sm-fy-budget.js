(() => {
  // Selling & Marketing Expenses: add a second comparison view using
  // Actual, FY Budget and Remaining without changing the existing report.
  let smComparisonMode = 'standard';
  let smFySort = { index: 0, ascending: true };

  const normalizePeriod = value => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

  smSimplePeriod = function (value) {
    const normalized = normalizePeriod(value);
    if (
      normalized.includes('fybudget') ||
      normalized.includes('fullyearbudget') ||
      normalized.includes('annualbudget') ||
      normalized === 'budgetfy'
    ) return 'fyBudget';
    if (
      normalized === 'ly' ||
      normalized === 'py' ||
      normalized.startsWith('ly') ||
      normalized.includes('lastyear') ||
      normalized.includes('previousyear') ||
      normalized.includes('prioryear')
    ) return 'ly';
    if (normalized.includes('budget') || normalized === 'bud' || normalized === 'bdg') return 'budget';
    if (normalized.includes('actual') || normalized === 'act') return 'actual';
    return normalized;
  };

  // Reporting Month should be driven by Actual rows only. FY Budget may
  // contain all twelve months and must not create future month filter values.
  smSimpleFilterData = function () {
    return smSimpleRows
      .filter(row => smSimplePeriod(row.Period) === 'actual')
      .map(row => ({
        'Reporting Month': smSimpleMonthLabel(smSimpleMonthKey(row)),
        'Country': row.Country
      }))
      .filter(row => row['Reporting Month'] && row.Country);
  };

  smSimpleAggregate = function () {
    const selectedMonthLabels = getSelected('smSimpleMonthFilter');
    const selectedCountries = getSelected('smSimpleCountryFilter');

    const actualMonthKeys = [...new Set(smSimpleRows
      .filter(row => smSimplePeriod(row.Period) === 'actual')
      .map(smSimpleMonthKey)
      .filter(Boolean))]
      .sort()
      .reverse();

    const selectedMonthKeys = selectedMonthLabels.length
      ? actualMonthKeys.filter(key => selectedMonthLabels.includes(smSimpleMonthLabel(key)))
      : actualMonthKeys;

    const selectedCountrySet = new Set(
      selectedCountries.length
        ? selectedCountries
        : [...new Set(smSimpleRows.map(row => row.Country).filter(Boolean))]
    );

    if (!selectedMonthKeys.length || !selectedCountrySet.size) return [];

    const selectedPeriods = selectedMonthKeys.map(key => ({
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7))
    }));
    const selectedYears = new Set(selectedPeriods.map(period => period.year));

    const map = new Map();
    const getItem = expense => {
      if (!map.has(expense)) {
        map.set(expense, {
          expense,
          actual: 0,
          budget: 0,
          fyBudget: 0,
          ly: 0,
          explicitLy: new Map(),
          priorActual: new Map()
        });
      }
      return map.get(expense);
    };

    smSimpleRows.forEach(row => {
      if (!selectedCountrySet.has(row.Country)) return;

      const date = smSimpleDate(row.Date);
      if (!date) return;

      const rowYear = date.getUTCFullYear();
      const rowMonth = date.getUTCMonth() + 1;
      const period = smSimplePeriod(row.Period);
      const item = getItem(row.Expense || 'Unassigned');
      const amount = Math.abs(Number(row.Amount) || 0);

      // FY Budget is annual: include every FY Budget row in the selected year,
      // regardless of the currently selected reporting month.
      if (period === 'fyBudget' && selectedYears.has(rowYear)) {
        item.fyBudget += amount;
      }

      selectedPeriods.forEach(({ year, month }) => {
        if (rowMonth !== month) return;
        const periodKey = `${year}-${String(month).padStart(2, '0')}`;
        if (rowYear === year && period === 'actual') item.actual += amount;
        if (rowYear === year && period === 'budget') item.budget += amount;
        if (rowYear === year - 1 && period === 'actual') {
          item.priorActual.set(
            periodKey,
            (item.priorActual.get(periodKey) || 0) + amount
          );
        }
        if ((rowYear === year || rowYear === year - 1) && period === 'ly') {
          item.explicitLy.set(
            periodKey,
            (item.explicitLy.get(periodKey) || 0) + amount
          );
        }
      });
    });

    return [...map.values()].map(item => {
      item.ly = selectedPeriods.reduce((total, { year, month }) => {
        const periodKey = `${year}-${String(month).padStart(2, '0')}`;
        return total + (
          item.explicitLy.has(periodKey)
            ? item.explicitLy.get(periodKey)
            : (item.priorActual.get(periodKey) || 0)
        );
      }, 0);
      delete item.explicitLy;
      delete item.priorActual;
      return item;
    })
      .filter(item => item.actual || item.budget || item.fyBudget || item.ly)
      .sort((a, b) => b.actual - a.actual);
  };

  const standardHeader = () => `<thead>
    <tr class="sm-statement-group-head">
      <th rowspan="2" data-sm-fy-sort-index="0">Item</th>
      <th class="sm-actual-head" rowspan="2" data-sm-fy-sort-index="1">Actual</th>
      <th rowspan="2" data-sm-fy-sort-index="2">Budget</th>
      <th class="sm-statement-group" colspan="2">Vs. Budget</th>
      <th rowspan="2" data-sm-fy-sort-index="5">LY</th>
      <th class="sm-statement-group" colspan="2">Vs. Last Year</th>
    </tr>
    <tr class="sm-statement-column-head">
      <th data-sm-fy-sort-index="3">${smSimpleCurrency}</th>
      <th data-sm-fy-sort-index="4">%</th>
      <th data-sm-fy-sort-index="6">${smSimpleCurrency}</th>
      <th data-sm-fy-sort-index="7">%</th>
    </tr>
  </thead>`;

  const fyBudgetHeader = () => `<thead>
    <tr class="sm-statement-group-head sm-fy-budget-head">
      <th data-sm-fy-sort-index="0">Item</th>
      <th class="sm-actual-head" data-sm-fy-sort-index="1">Actual (${smSimpleCurrency})</th>
      <th data-sm-fy-sort-index="2">FY Budget (${smSimpleCurrency})</th>
      <th data-sm-fy-sort-index="3">Remaining (${smSimpleCurrency})</th>
    </tr>
  </thead>`;

  renderSmExpenses = function () {
    const table = document.getElementById('smSimpleTable');
    if (!table) return;

    const rows = smSimpleAggregate();
    const count = document.getElementById('smSimpleCount');
    if (count) count.textContent = `${rows.length.toLocaleString('en-US')} rows`;

    table.innerHTML = smComparisonMode === 'fyBudget'
      ? `${fyBudgetHeader()}<tbody></tbody>`
      : `${standardHeader()}<tbody></tbody>`;

    const tbody = table.tBodies[0];
    const columns = smComparisonMode === 'fyBudget' ? 4 : 8;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${columns}" class="sm-no-data">No matching data for the selected month and country.</td></tr>`;
      setupResizableColumns(table);
      return;
    }

    const totals = { actual: 0, budget: 0, fyBudget: 0, ly: 0 };
    tbody.innerHTML = rows.map(row => {
      totals.actual += row.actual;
      totals.budget += row.budget;
      totals.fyBudget += row.fyBudget;
      totals.ly += row.ly;

      if (smComparisonMode === 'fyBudget') {
        const remaining = row.fyBudget - row.actual;
        return `<tr>
          <td>${esc(row.expense)}</td>
          <td>${smSimpleFormat(row.actual)}</td>
          <td>${smSimpleFormat(row.fyBudget)}</td>
          <td class="${smSimpleCellClass(remaining, true)}">${smSimpleFormat(remaining)}</td>
        </tr>`;
      }

      const vsBudget = row.budget - row.actual;
      const vsBudgetPct = row.budget ? row.actual / row.budget - 1 : NaN;
      const vsLy = row.ly - row.actual;
      const vsLyPct = row.ly ? row.actual / row.ly - 1 : NaN;
      return `<tr>
        <td>${esc(row.expense)}</td>
        <td>${smSimpleFormat(row.actual)}</td>
        <td>${smSimpleFormat(row.budget)}</td>
        <td class="${smSimpleCellClass(vsBudget, true)}">${smSimpleFormat(vsBudget)}</td>
        <td class="${smSimpleCellClass(vsBudgetPct, false)}">${smSimplePercent(vsBudgetPct)}</td>
        <td>${smSimpleFormat(row.ly)}</td>
        <td class="${smSimpleCellClass(vsLy, true)}">${smSimpleFormat(vsLy)}</td>
        <td class="${smSimpleCellClass(vsLyPct, false)}">${smSimplePercent(vsLyPct)}</td>
      </tr>`;
    }).join('');

    if (smComparisonMode === 'fyBudget') {
      const remaining = totals.fyBudget - totals.actual;
      tbody.insertAdjacentHTML('beforeend', `<tr class="sm-total-row">
        <td>Total</td>
        <td>${smSimpleFormat(totals.actual)}</td>
        <td>${smSimpleFormat(totals.fyBudget)}</td>
        <td class="${smSimpleCellClass(remaining, true)}">${smSimpleFormat(remaining)}</td>
      </tr>`);
    } else {
      const totalVsBudget = totals.budget - totals.actual;
      const totalVsBudgetPct = totals.budget ? totals.actual / totals.budget - 1 : NaN;
      const totalVsLy = totals.ly - totals.actual;
      const totalVsLyPct = totals.ly ? totals.actual / totals.ly - 1 : NaN;
      tbody.insertAdjacentHTML('beforeend', `<tr class="sm-total-row">
        <td>Total</td>
        <td>${smSimpleFormat(totals.actual)}</td>
        <td>${smSimpleFormat(totals.budget)}</td>
        <td class="${smSimpleCellClass(totalVsBudget, true)}">${smSimpleFormat(totalVsBudget)}</td>
        <td class="${smSimpleCellClass(totalVsBudgetPct, false)}">${smSimplePercent(totalVsBudgetPct)}</td>
        <td>${smSimpleFormat(totals.ly)}</td>
        <td class="${smSimpleCellClass(totalVsLy, true)}">${smSimpleFormat(totalVsLy)}</td>
        <td class="${smSimpleCellClass(totalVsLyPct, false)}">${smSimplePercent(totalVsLyPct)}</td>
      </tr>`);
    }

    setupResizableColumns(table);
  };

  function sortableValue(cell) {
    const source = String(cell?.textContent || '').trim();
    if (!source) return '';
    const accounting = /^\(.*\)$/.test(source);
    const cleaned = source.replace(/[(),%,$]/g, '').replace(/,/g, '').trim();
    const number = Number(cleaned);
    if (Number.isFinite(number) && /\d/.test(cleaned)) {
      return accounting ? -Math.abs(number) : number;
    }
    return source.toLowerCase();
  }

  function sortSmTable(index) {
    const table = document.getElementById('smSimpleTable');
    const tbody = table?.tBodies?.[0];
    if (!tbody) return;

    const ascending = smFySort.index === index ? !smFySort.ascending : true;
    smFySort = { index, ascending };
    const rows = [...tbody.rows];
    const total = rows.find(row => row.classList.contains('sm-total-row'));
    const data = rows.filter(row =>
      !row.classList.contains('sm-total-row') && !row.querySelector('.sm-no-data')
    );

    data.sort((left, right) => {
      const a = sortableValue(left.cells[index]);
      const b = sortableValue(right.cells[index]);
      const result = typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
      return ascending ? result : -result;
    });

    data.forEach(row => tbody.appendChild(row));
    if (total) tbody.appendChild(total);
  }

  function installComparisonControls() {
    const toolbar = document.querySelector('#smExpensesSection .table-toolbar');
    const count = document.getElementById('smSimpleCount');
    if (!toolbar || !count || document.querySelector('[data-sm-comparison]')) return;

    const left = document.createElement('div');
    left.className = 'pnl-toolbar-left sm-comparison-toolbar';
    toolbar.insertBefore(left, toolbar.firstChild);
    left.appendChild(count);

    const switcher = document.createElement('div');
    switcher.className = 'pnl-view-switch pnl-comparison-switch';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Selling and Marketing comparison mode');
    switcher.innerHTML = `
      <button class="active" type="button" data-sm-comparison="standard" aria-pressed="true">Budget &amp; LY</button>
      <button type="button" data-sm-comparison="fyBudget" aria-pressed="false">FY Budget</button>`;
    left.appendChild(switcher);

    switcher.querySelectorAll('[data-sm-comparison]').forEach(button => {
      button.addEventListener('click', () => {
        smComparisonMode = button.dataset.smComparison === 'fyBudget' ? 'fyBudget' : 'standard';
        switcher.querySelectorAll('[data-sm-comparison]').forEach(option => {
          const active = option === button;
          option.classList.toggle('active', active);
          option.setAttribute('aria-pressed', String(active));
        });
        renderSmExpenses();
      });
    });

    document.getElementById('smSimpleTable')?.addEventListener('click', event => {
      const header = event.target.closest('th[data-sm-fy-sort-index]');
      if (header) sortSmTable(Number(header.dataset.smFySortIndex));
    });
  }

  installComparisonControls();
  renderSmExpenses();
})();
