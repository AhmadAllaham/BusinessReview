(() => {
  'use strict';

  if (window.__salesFyBudgetInstalled) return;
  if (
    typeof renderSalesTable !== 'function' ||
    typeof filtered !== 'function' ||
    typeof getSelected !== 'function'
  ) return;

  window.__salesFyBudgetInstalled = true;

  let salesComparisonMode = 'standard';
  const originalRenderSalesTable = renderSalesTable;

  const identity = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');

  function rowsMatchingSalesFilters(options = {}) {
    const ignoreMonth = options.ignoreMonth === true;
    return (rawData || []).filter(row => (salesFilterIds || []).every(id => {
      if (ignoreMonth && id === 'monthFilter') return true;
      const selected = getSelected(id);
      const column = document.getElementById(id)?.dataset.column || '';
      return !selected.length || selected.includes(String(row[column] ?? ''));
    }));
  }

  function salesFyAggregate(actualRows, budgetRows, dimension) {
    const grouped = new Map();

    const ensure = row => {
      const displayName = dimKey(row, dimension);
      const key = identity(displayName);
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: displayName,
          actual: 0,
          fyBudget: 0
        });
      }
      return grouped.get(key);
    };

    (actualRows || []).forEach(row => {
      ensure(row).actual += Number(row.__actual) || 0;
    });

    (budgetRows || []).forEach(row => {
      ensure(row).fyBudget += Number(row.__budget) || 0;
    });

    return [...grouped.values()]
      .filter(row => row.actual || row.fyBudget)
      .sort((left, right) => right.actual - left.actual);
  }

  function salesFyTableHtml(rows, dimension) {
    const dimensionLabel = dimension === 'Country' ? 'Market' : dimension;
    const totals = rows.reduce((total, row) => ({
      actual: total.actual + row.actual,
      fyBudget: total.fyBudget + row.fyBudget
    }), { actual: 0, fyBudget: 0 });

    const makeRow = (row, total = false) => {
      const remaining = row.fyBudget - row.actual;
      const gpClass = profitabilityVisible
        ? profitabilityClass(total ? '' : dimension, total ? '' : row.name, { type:'sales' })
        : '';

      return `<tr${total ? ' class="total-row"' : ''}>
        <td>${esc(row.name)}</td>
        <td>${salesStatementValue(row.actual)}</td>
        <td>${salesStatementValue(row.fyBudget)}</td>
        <td class="${remaining < 0 ? 'sales-statement-negative' : ''}">${salesStatementValue(remaining)}</td>
        ${profitabilityVisible ? profitabilityCell(gpClass) : ''}
      </tr>`;
    };

    return `<thead>
      <tr class="sales-statement-group-head sales-fy-budget-head">
        <th data-sort-index="0">${esc(dimensionLabel)}</th>
        <th data-sort-index="1">Actual YTD (${performanceCurrency})</th>
        <th data-sort-index="2">FY Budget <small class="sales-fy-period">12 Months</small> (${performanceCurrency})</th>
        <th data-sort-index="3">Remaining (${performanceCurrency})</th>
        ${profitabilityVisible ? '<th data-no-sort="true">GP%</th>' : ''}
      </tr>
    </thead>
    <tbody>${rows.map(row => makeRow(row)).join('')}${rows.length
      ? makeRow({ name:'Total', ...totals }, true)
      : `<tr><td colspan="${profitabilityVisible ? 5 : 4}" class="stock-empty">No Sales data matches the selected filters.</td></tr>`}
    </tbody>`;
  }

  function renderSalesFyBudget(actualRows) {
    const table = document.getElementById('salesTable');
    const view = document.getElementById('salesView');
    if (!table || !view) return;

    const dimension = view.value;
    const fullYearBudgetRows = rowsMatchingSalesFilters({ ignoreMonth:true });
    const data = salesFyAggregate(actualRows, fullYearBudgetRows, dimension);

    const count = document.getElementById('salesCount');
    if (count) count.textContent = `${data.length.toLocaleString('en-US')} rows`;

    table.innerHTML = salesFyTableHtml(data, dimension);

    if (dimension === 'Country') {
      table.querySelectorAll('tbody tr:not(.total-row) td:first-child').forEach(cell => {
        cell.classList.add('drill-link');
        cell.addEventListener('click', () => openCountry(cell.textContent));
      });
    }

    setupResizableColumns(table);
  }

  renderSalesTable = function (rows) {
    if (salesComparisonMode === 'fyBudget') {
      renderSalesFyBudget(rows || filtered());
      return;
    }
    originalRenderSalesTable(rows);
  };

  function installSalesComparisonControls() {
    const toolbarActions = document.querySelector('#salesSection .table-toolbar .toolbar-actions');
    if (!toolbarActions || toolbarActions.querySelector('[data-sales-comparison]')) return;

    if (!document.getElementById('sales-fy-budget-style')) {
      const style = document.createElement('style');
      style.id = 'sales-fy-budget-style';
      style.textContent = `
        .sales-fy-period {
          display: inline-block;
          margin-inline-start: 5px;
          font-size: 10px;
          line-height: 1;
          font-weight: 600;
          opacity: .72;
          white-space: nowrap;
          vertical-align: middle;
        }
        .sales-comparison-switch {
          flex: 0 0 auto;
        }
      `;
      document.head.appendChild(style);
    }

    const switcher = document.createElement('div');
    switcher.className = 'pnl-view-switch pnl-comparison-switch sales-comparison-switch';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Sales comparison mode');
    switcher.innerHTML = `
      <button class="active" type="button" data-sales-comparison="standard" aria-pressed="true">Budget &amp; LY</button>
      <button type="button" data-sales-comparison="fyBudget" aria-pressed="false">FY Budget</button>`;

    const currencySwitch = toolbarActions.querySelector('.performance-currency-switch');
    toolbarActions.insertBefore(switcher, currencySwitch || toolbarActions.firstChild);

    switcher.querySelectorAll('[data-sales-comparison]').forEach(button => {
      button.addEventListener('click', () => {
        salesComparisonMode = button.dataset.salesComparison === 'fyBudget'
          ? 'fyBudget'
          : 'standard';

        switcher.querySelectorAll('[data-sales-comparison]').forEach(option => {
          const active = option === button;
          option.classList.toggle('active', active);
          option.setAttribute('aria-pressed', String(active));
        });

        renderSalesTable(filtered());
      });
    });
  }

  installSalesComparisonControls();
  renderSalesTable(filtered());
})();
