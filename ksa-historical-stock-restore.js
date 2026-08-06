(() => {
  'use strict';

  if (window.__BR_KSA_HISTORICAL_STOCK_RESTORE__) return;
  window.__BR_KSA_HISTORICAL_STOCK_RESTORE__ = true;

  const FALLBACK_TOTAL_USD = 38954560.27027098;
  const FORMULA =
    '(Goods Qty 2025 + Goods Qty 2026 + Bonus Qty 2025 + Bonus Qty 2026) × Price 2026';

  const normalizeIdentity = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '');

  const canonicalCountry = value => {
    if (typeof window.BRCanonicalCountry === 'function') {
      return window.BRCanonicalCountry(value);
    }
    const identity = normalizeIdentity(value);
    return identity === 'ksa' || identity.includes('saudi')
      ? 'KSA'
      : String(value ?? '').trim();
  };

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

  function activeHistoricalData() {
    const active = window.BRKsaStockHistoricalSales;
    if (active && typeof active === 'object') return active;

    return {
      totalUsd:FALLBACK_TOTAL_USD,
      byProductGroup:{},
      formula:FORMULA,
      source:'embedded fallback'
    };
  }

  function historicalForCurrentScope() {
    const active = activeHistoricalData();
    const groups = active.byProductGroup && typeof active.byProductGroup === 'object'
      ? active.byProductGroup
      : {};
    const selected = selectedStockGroups();

    if (selected.length && Object.keys(groups).length) {
      const selectedKeys = new Set(selected.map(normalizeIdentity));
      return Object.entries(groups).reduce(
        (total,[name,value]) => selectedKeys.has(normalizeIdentity(name))
          ? total + (Number(value) || 0)
          : total,
        0
      );
    }

    const uploadedTotal = Number(active.totalUsd);
    if (Number.isFinite(uploadedTotal)) return uploadedTotal;

    const embeddedTotal = Number(window.BRKsaStockHistoricalProductSales?.totalUsd);
    return Number.isFinite(embeddedTotal)
      ? embeddedTotal
      : FALLBACK_TOTAL_USD;
  }

  function installRendererOverride() {
    const originalRenderer = window.stockStatementTableHtml;
    if (
      typeof originalRenderer !== 'function' ||
      originalRenderer.__ksaHistoricalMarketWrapped
    ) return false;

    const wrappedRenderer = function (
      rows,
      totals,
      dimension = 'Brand',
      clickable = false,
      profitabilityScope = {type:'stock'},
      ...rest
    ) {
      const dimensionKey = normalizeIdentity(dimension);
      const isMarket = dimensionKey === 'market' || dimensionKey === 'country';

      if (!isMarket) {
        return originalRenderer.call(
          this,
          rows,
          totals,
          dimension,
          clickable,
          profitabilityScope,
          ...rest
        );
      }

      const nextRows = Array.isArray(rows)
        ? rows.map(row => ({...row}))
        : [];
      const ksaIndex = nextRows.findIndex(row =>
        canonicalCountry(row?.name) === 'KSA'
      );

      if (ksaIndex < 0) {
        return originalRenderer.call(
          this,
          rows,
          totals,
          dimension,
          clickable,
          profitabilityScope,
          ...rest
        );
      }

      const previousHistorical = Number(nextRows[ksaIndex].historical) || 0;
      const replacementHistorical = historicalForCurrentScope();
      nextRows[ksaIndex].historical = replacementHistorical;

      const nextTotals = {
        ...(totals || {}),
        historical:
          (Number(totals?.historical) || 0) -
          previousHistorical +
          replacementHistorical
      };

      return originalRenderer.call(
        this,
        nextRows,
        nextTotals,
        dimension,
        clickable,
        profitabilityScope,
        ...rest
      );
    };

    wrappedRenderer.__ksaHistoricalMarketWrapped = true;
    window.stockStatementTableHtml = wrappedRenderer;
    return true;
  }

  function ensureRendererOverride() {
    if (installRendererOverride()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installRendererOverride() || attempts >= 200) clearInterval(timer);
    },25);
  }

  function refreshStockLevel() {
    try {
      if (typeof window.renderStockLevel === 'function') {
        window.renderStockLevel();
      }
    } catch (error) {
      console.error('Unable to refresh KSA Historical Sales.',error);
    }
  }

  async function loadActiveHistoricalSales() {
    try {
      await window.BRPortal?.persistenceReady;
      const session = typeof window.BRPortal?.waitForAuth === 'function'
        ? await window.BRPortal.waitForAuth()
        : {user:window.BRPortal?.auth?.currentUser};
      if (!session?.user) return;

      const db = window.BRPortal?.db;
      if (!db) return;

      const snapshot = await db
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

      const totalUsd = Number(data.totalUsd);
      window.BRKsaStockHistoricalSales = Object.freeze({
        totalUsd:Number.isFinite(totalUsd) ? totalUsd : FALLBACK_TOTAL_USD,
        byProductGroup:Object.freeze(groups),
        formula:String(data.formula || FORMULA),
        sourceFile:String(data.sourceFile || ''),
        reportingPeriod:String(data.reportingPeriod || '')
      });

      refreshStockLevel();
    } catch (error) {
      console.error('Unable to load the active KSA Historical Sales.',error);
    }
  }

  ensureRendererOverride();
  window.BRKsaHistoricalRestoreReady = loadActiveHistoricalSales();
})();