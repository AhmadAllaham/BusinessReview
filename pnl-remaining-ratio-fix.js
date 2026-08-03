(() => {
  'use strict';

  if (
    window.__pnlRemainingRatioFixInstalled ||
    typeof renderPnlVertical !== 'function'
  ) return;

  window.__pnlRemainingRatioFixInstalled = true;
  const originalRenderPnlVertical = renderPnlVertical;
  let remainingRatioMode = 'ratio';

  try {
    const savedMode = localStorage.getItem('pnlRemainingRatioMode');
    if (savedMode === 'pp' || savedMode === 'ratio') remainingRatioMode = savedMode;
  } catch (_) {}

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

  function ratioValue(totals, config) {
    const denominator = pnlNumber(totals[config.denominator]);
    let ratio = denominator
      ? numeratorValue(totals, config.numerator) / denominator
      : 0;
    if (config.absolute) ratio = Math.abs(ratio);
    return ratio;
  }

  function remainingRatioValue(actual, fyBudget, config) {
    const remainingNumerator =
      numeratorValue(fyBudget, config.numerator) -
      numeratorValue(actual, config.numerator);
    const remainingDenominator =
      pnlNumber(fyBudget[config.denominator]) -
      pnlNumber(actual[config.denominator]);

    let ratio = remainingDenominator
      ? remainingNumerator / remainingDenominator
      : 0;
    if (config.absolute) ratio = Math.abs(ratio);
    return ratio;
  }

  function installStyles() {
    if (document.getElementById('pnlRemainingRatioStyles')) return;
    const style = document.createElement('style');
    style.id = 'pnlRemainingRatioStyles';
    style.textContent = `
      .pnl-remaining-ratio-control{position:relative;display:inline-flex;align-items:center}
      .pnl-remaining-ratio-trigger{width:38px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(148,163,184,.42);border-radius:10px;background:rgba(15,23,42,.72);color:#e2e8f0;padding:0;font:inherit;font-size:18px;font-weight:800;line-height:1;cursor:pointer}
      .pnl-remaining-ratio-trigger:hover,.pnl-remaining-ratio-trigger[aria-expanded="true"]{border-color:rgba(96,165,250,.75);background:rgba(30,41,59,.94)}
      .pnl-remaining-ratio-menu{position:absolute;z-index:80;top:calc(100% + 8px);left:0;min-width:215px;padding:8px;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:#111827;box-shadow:0 18px 45px rgba(0,0,0,.38)}
      .pnl-remaining-ratio-menu[hidden]{display:none}
      .pnl-remaining-ratio-menu-title{padding:5px 10px 8px;color:#f8fafc;font-size:12px;font-weight:800;letter-spacing:.02em;border-bottom:1px solid rgba(148,163,184,.2);margin-bottom:5px}
      .pnl-remaining-ratio-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:8px;background:transparent;color:#cbd5e1;padding:9px 10px;font:inherit;font-size:12px;font-weight:700;text-align:left;cursor:pointer}
      .pnl-remaining-ratio-menu button:hover{background:rgba(51,65,85,.78);color:#fff}
      .pnl-remaining-ratio-menu button.active{background:rgba(37,99,235,.2);color:#bfdbfe}
      .pnl-remaining-ratio-menu small{font-size:10px;font-weight:600;color:#94a3b8}
    `;
    document.head.appendChild(style);
  }

  function updateControlLabel() {
    const trigger = document.querySelector('[data-pnl-remaining-ratio-trigger]');
    if (trigger) {
      const modeLabel = remainingRatioMode === 'pp' ? 'PP' : 'Ratio %';
      trigger.setAttribute('aria-label', `Remaining Ratio options. Current: ${modeLabel}`);
      trigger.title = `Remaining Ratio: ${modeLabel}`;
    }
    document.querySelectorAll('[data-pnl-remaining-ratio-mode]').forEach(button => {
      const active = button.dataset.pnlRemainingRatioMode === remainingRatioMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function closeMenu() {
    const trigger = document.querySelector('[data-pnl-remaining-ratio-trigger]');
    const menu = document.querySelector('[data-pnl-remaining-ratio-menu]');
    if (menu) menu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
  }

  function installControl() {
    installStyles();
    const toolbarLeft = document.querySelector('#pnlSection .pnl-toolbar-left');
    const comparisonSwitch = toolbarLeft?.querySelector('.pnl-comparison-switch');
    if (!toolbarLeft || !comparisonSwitch) return null;

    let control = toolbarLeft.querySelector('.pnl-remaining-ratio-control');
    if (control) return control;

    control = document.createElement('div');
    control.className = 'pnl-remaining-ratio-control';
    control.hidden = true;
    control.innerHTML = `
      <button class="pnl-remaining-ratio-trigger" type="button"
        data-pnl-remaining-ratio-trigger aria-expanded="false"
        aria-label="Remaining Ratio options">
        ⋯
      </button>
      <div class="pnl-remaining-ratio-menu" data-pnl-remaining-ratio-menu hidden>
        <div class="pnl-remaining-ratio-menu-title">Remaining Ratio</div>
        <button type="button" data-pnl-remaining-ratio-mode="ratio" aria-pressed="true">
          <span>Ratio %</span><small>From Remaining values</small>
        </button>
        <button type="button" data-pnl-remaining-ratio-mode="pp" aria-pressed="false">
          <span>PP</span><small>FY Budget % − Actual %</small>
        </button>
      </div>`;
    comparisonSwitch.insertAdjacentElement('afterend', control);

    const trigger = control.querySelector('[data-pnl-remaining-ratio-trigger]');
    const menu = control.querySelector('[data-pnl-remaining-ratio-menu]');

    trigger.addEventListener('click', event => {
      event.stopPropagation();
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
    });

    menu.addEventListener('click', event => event.stopPropagation());
    control.querySelectorAll('[data-pnl-remaining-ratio-mode]').forEach(button => {
      button.addEventListener('click', () => {
        remainingRatioMode = button.dataset.pnlRemainingRatioMode === 'pp'
          ? 'pp'
          : 'ratio';
        try {
          localStorage.setItem('pnlRemainingRatioMode', remainingRatioMode);
        } catch (_) {}
        updateControlLabel();
        closeMenu();
        updateRemainingRatioCells();
      });
    });

    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });

    updateControlLabel();
    return control;
  }

  function syncControlVisibility() {
    const control = installControl();
    if (!control) return;
    control.hidden = pnlComparisonMode !== 'fyBudget';
    if (control.hidden) closeMenu();
  }

  function updateRemainingRatioCells() {
    syncControlVisibility();
    if (pnlComparisonMode !== 'fyBudget') return;

    const rows = pnlFilteredRows();
    const actual = pnlConvertCurrency(pnlScenarioTotals(rows, 'Actual'));
    const fyBudget = pnlConvertCurrency(pnlScenarioTotals(rows, 'FY Budget'));
    const ratioRows = [...document.querySelectorAll(
      '#pnlTable tbody tr.pnl-statement-ratio'
    )];

    ratioConfiguration().forEach((config, index) => {
      const actualRatio = ratioValue(actual, config);
      const fyBudgetRatio = ratioValue(fyBudget, config);
      const value = remainingRatioMode === 'pp'
        ? fyBudgetRatio - actualRatio
        : remainingRatioValue(actual, fyBudget, config);

      const cell = ratioRows[index]?.cells?.[3];
      if (!cell) return;

      cell.classList.remove('pnl-positive', 'pnl-negative', 'pnl-amount-negative');
      if (remainingRatioMode === 'pp') {
        cell.textContent = `${(value * 100).toFixed(1)} pp`;
        cell.classList.toggle('pnl-positive', value > 0);
        cell.classList.toggle('pnl-negative', value < 0);
        cell.title = 'FY Budget ratio minus Actual ratio';
      } else {
        cell.textContent = `${(value * 100).toFixed(1)}%`;
        cell.classList.toggle('pnl-amount-negative', value < 0);
        cell.title = 'Remaining ratio calculated from Remaining values';
      }
    });
  }

  renderPnlVertical = function (...args) {
    originalRenderPnlVertical.apply(this, args);
    updateRemainingRatioCells();
  };

  installControl();
  renderPnlVertical();
})();
