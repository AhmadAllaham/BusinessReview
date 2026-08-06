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