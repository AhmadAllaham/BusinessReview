(() => {
  'use strict';

  if (
    window.__pnlRemainingRatioFixInstalled ||
    typeof renderPnlVertical !== 'function'
  ) return;

  window.__pnlRemainingRatioFixInstalled = true;
  const originalRenderPnlVertical = renderPnlVertical;

  function ratioConfiguration() {
    return [
      {
        numerator: 'cogs',
        denominator: 'grossSales',
        absolute: true
      },
      ...(pnlCogsExpanded ? [
        {
          numerator: 'actualCogs',
          denominator: 'grossSales',
          absolute: true
        },
        {
          numerator: 'focCogs',
          denominator: 'netSales',
          absolute: true
        }
      ] : []),
      {
        numerator: 'grossProfit',
        denominator: 'netSales',
        absolute: false
      },
      {
        numerator: 'sm',
        denominator: 'netSales',
        absolute: true
      },
      {
        numerator: 'netIncome',
        denominator: 'netSales',
        absolute: false
      }
    ];
  }

  function numeratorValue(totals, key) {
    if (key === 'cogs') {
      return pnlNumber(totals.actualCogs) + pnlNumber(totals.focCogs);
    }
    return pnlNumber(totals[key]);
  }

  function updateRemainingRatioCells() {
    if (pnlComparisonMode !== 'fyBudget') return;

    const rows = pnlFilteredRows();
    const actual = pnlConvertCurrency(pnlScenarioTotals(rows, 'Actual'));
    const fyBudget = pnlConvertCurrency(pnlScenarioTotals(rows, 'FY Budget'));
    const ratioRows = [...document.querySelectorAll(
      '#pnlTable tbody tr.pnl-statement-ratio'
    )];

    ratioConfiguration().forEach((config, index) => {
      const remainingNumerator =
        numeratorValue(fyBudget, config.numerator) -
        numeratorValue(actual, config.numerator);
      const remainingDenominator =
        pnlNumber(fyBudget[config.denominator]) -
        pnlNumber(actual[config.denominator]);

      let remainingRatio = remainingDenominator
        ? remainingNumerator / remainingDenominator
        : 0;
      if (config.absolute) remainingRatio = Math.abs(remainingRatio);

      const cell = ratioRows[index]?.cells?.[3];
      if (!cell) return;

      cell.textContent = `${(remainingRatio * 100).toFixed(1)}%`;
      cell.classList.remove('pnl-positive', 'pnl-negative');
      cell.classList.toggle('pnl-amount-negative', remainingRatio < 0);
      cell.title = 'Remaining ratio calculated from Remaining values';
    });
  }

  renderPnlVertical = function (...args) {
    originalRenderPnlVertical.apply(this, args);
    updateRemainingRatioCells();
  };

  renderPnlVertical();
})();
