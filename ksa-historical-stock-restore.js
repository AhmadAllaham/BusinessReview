(() => {
  'use strict';

  if (window.__BR_KSA_HISTORICAL_STOCK_RESTORE__) return;
  window.__BR_KSA_HISTORICAL_STOCK_RESTORE__ = true;

  const ORIGINAL_TOTAL_USD = 38954560.27027098;
  const FORMULA =
    '(Goods Qty 2025 + Goods Qty 2026 + Bonus Qty 2025 + Bonus Qty 2026) × Price 2026';

  const normalizeIdentity = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '');

  function selectedStockGroups() {
    const filter = document.getElementById('stockProductGroupFilter');
    if (!filter) return [];

    if (typeof filter._getSelected === 'function') {
      return filter._getSelected().map(String).filter(Boolean);
    }

    if (typeof window.getSelected === 'function') {
      return (window.getSelected('stockProductGroupFilter') || [])
        .map(String)
        .filter(Boolean);
    }

    return [...filter.querySelectorAll('.multi-options input:checked')]
      .map(input => String(input.value || ''))
      .filter(Boolean);
  }

  function historicalForCurrentScope() {
    const selected = selectedStockGroups();
    const groups = window.BRKsaStockHistoricalSales?.byProductGroup;

    if (
      selected.length &&
      groups &&
      typeof groups === 'object' &&
      Object.keys(groups).length
    ) {
      const selectedKeys = new Set(selected.map(normalizeIdentity));
      return Object.entries(groups).reduce(
        (total,[name,value]) => selectedKeys.has(normalizeIdentity(name))
          ? total + (Number(value) || 0)
          : total,
        0
      );
    }

    const embeddedTotal = Number(window.BRKsaStockHistoricalProductSales?.totalUsd);
    return Number.isFinite(embeddedTotal) && embeddedTotal > 0
      ? embeddedTotal
      : ORIGINAL_TOTAL_USD;
  }

  window.BRGetKsaHistoricalStockSales = historicalForCurrentScope;
  window.BRKsaStockHistoricalRestore = Object.freeze({
    totalUsd:ORIGINAL_TOTAL_USD,
    formula:FORMULA
  });

  function refreshStockLevel() {
    try {
      if (typeof window.renderStockLevel === 'function') {
        window.renderStockLevel();
      }
    } catch (error) {
      console.error('Unable to refresh KSA Historical Sales.',error);
    }
  }

  async function loadHistoricalGroups() {
    try {
      await window.BRPortal?.persistenceReady;
      const session = typeof window.BRPortal?.waitForAuth === 'function'
        ? await window.BRPortal.waitForAuth()
        : {user:window.BRPortal?.auth?.currentUser};
      if (!session?.user || !window.BRPortal?.db) return;

      const snapshot = await window.BRPortal.db
        .collection('system')
        .doc('ksaHistoricalSales')
        .get();
      if (!snapshot.exists) return;

      const data = snapshot.data() || {};
      const groups = Array.isArray(data.groups)
        ? Object.fromEntries(data.groups
            .map(group => [String(group?.name || '').trim(),Number(group?.value) || 0])
            .filter(([name]) => name))
        : data.byProductGroup && typeof data.byProductGroup === 'object'
          ? {...data.byProductGroup}
          : {};

      window.BRKsaStockHistoricalSales = Object.freeze({
        totalUsd:ORIGINAL_TOTAL_USD,
        byProductGroup:Object.freeze(groups),
        formula:String(data.formula || FORMULA),
        sourceFile:String(data.sourceFile || ''),
        reportingPeriod:String(data.reportingPeriod || '')
      });

      refreshStockLevel();
    } catch (error) {
      console.error('Unable to load KSA Historical Sales groups.',error);
    }
  }

  window.BRKsaHistoricalRestoreReady = loadHistoricalGroups();
})();

(() => {
  'use strict';

  if (window.__BR_KSA_PNL_COMPENSATION_NOTE__) return;
  window.__BR_KSA_PNL_COMPENSATION_NOTE__ = true;

  const NOTE_LABEL = 'FOC (COMPENSATION)';
  const AFTER_LABEL = 'Net Income after FOC Compensation';
  const NOTE_VALUE = -174;

  const normalizeMarket = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '');

  function isSaudiMarket(value) {
    const market = normalizeMarket(value);
    return market === 'ksa' ||
      market === 'saudi' ||
      market === 'saudiarabia' ||
      market === 'kingdomofsaudiarabia' ||
      market.startsWith('ksa') ||
      market.includes('saudiarabia');
  }

  function selectedPnlMarkets() {
    const filter = document.getElementById('pnlMarketFilter');
    if (!filter) return [];

    if (typeof filter._getSelected === 'function') {
      return filter._getSelected().map(String).filter(Boolean);
    }

    if (typeof window.getSelected === 'function') {
      return (window.getSelected('pnlMarketFilter') || [])
        .map(String)
        .filter(Boolean);
    }

    return [...filter.querySelectorAll('.multi-options input:checked')]
      .map(input => String(input.value || ''))
      .filter(value => value && value !== '__ALL__');
  }

  function shouldShowNote() {
    const markets = selectedPnlMarkets();
    return markets.length === 1 && isSaudiMarket(markets[0]);
  }

  function currentNetIncome() {
    if (
      typeof pnlFilteredRows === 'function' &&
      typeof pnlScenarioTotals === 'function' &&
      typeof pnlConvertCurrency === 'function'
    ) {
      const totals=pnlConvertCurrency(
        pnlScenarioTotals(pnlFilteredRows(),'Actual')
      );
      return Number(totals?.netIncome) || 0;
    }

    const table=document.getElementById('pnlTable');
    const netIncomeRow=[...(table?.tBodies?.[0]?.rows || [])].find(row =>
      normalizeMarket(row.cells?.[0]?.textContent) === 'netincome'
    );
    const text=String(netIncomeRow?.cells?.[1]?.textContent || '').trim();
    const accounting=/^\(.*\)$/.test(text);
    const number=Number(text.replace(/[(),]/g,'').replace(/[^0-9.-]/g,''));
    return Number.isFinite(number)
      ? accounting ? -Math.abs(number) : number
      : 0;
  }

  function formatAmount(value) {
    if (typeof pnlFormat === 'function') return pnlFormat(value);
    const rounded=Math.round(Number(value) || 0);
    return rounded < 0
      ? `(${Math.abs(rounded).toLocaleString('en-US')})`
      : rounded.toLocaleString('en-US');
  }

  function buildInformationalRow(label,value,className) {
    const table=document.getElementById('pnlTable');
    const isFyBudgetView=Boolean(
      table?.querySelector('thead .pnl-fy-budget-head')
    );
    const totalColumns=isFyBudgetView ? 4 : 8;
    const row=document.createElement('tr');
    row.className=className;
    row.dataset.ksaPnlCompensationNote='true';

    const labelCell=document.createElement('td');
    labelCell.textContent=label;
    labelCell.style.fontWeight='800';
    row.appendChild(labelCell);

    const actualCell=document.createElement('td');
    actualCell.textContent=formatAmount(value);
    actualCell.style.fontWeight='800';
    if (value < 0) actualCell.classList.add('pnl-amount-negative');
    row.appendChild(actualCell);

    for (let index=2; index<totalColumns; index+=1) {
      row.appendChild(document.createElement('td'));
    }
    return row;
  }

  function addCompensationNote() {
    const table=document.getElementById('pnlTable');
    const body=table?.tBodies?.[0];
    if (!body) return;

    body.querySelectorAll('[data-ksa-pnl-compensation-note]')
      .forEach(row => row.remove());

    if (!shouldShowNote()) return;

    const netIncomeAfter=currentNetIncome()+NOTE_VALUE;
    const compensationRow=buildInformationalRow(
      NOTE_LABEL,
      NOTE_VALUE,
      'pnl-ksa-compensation-note'
    );
    compensationRow.title='Negative FOC compensation; informational only and excluded from the original P&L calculations and KPIs.';

    const afterRow=buildInformationalRow(
      AFTER_LABEL,
      netIncomeAfter,
      'pnl-ksa-net-income-after-compensation pnl-subtotal pnl-statement-total'
    );
    afterRow.title='Net Income plus the negative FOC Compensation; informational only.';

    const ratioSpacer=body.querySelector('.pnl-ratio-spacer');
    if (ratioSpacer) {
      body.insertBefore(compensationRow,ratioSpacer);
      body.insertBefore(afterRow,ratioSpacer);
    } else {
      body.appendChild(compensationRow);
      body.appendChild(afterRow);
    }
  }

  const originalRenderPnlVertical=window.renderPnlVertical;
  if (typeof originalRenderPnlVertical === 'function') {
    window.renderPnlVertical=function (...args) {
      const result=originalRenderPnlVertical.apply(this,args);
      addCompensationNote();
      return result;
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => setTimeout(addCompensationNote,0),
      {once:true}
    );
  } else {
    setTimeout(addCompensationNote,0);
  }
})();
