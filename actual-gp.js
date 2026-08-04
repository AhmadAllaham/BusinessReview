(() => {
  'use strict';

  // Actual GP vs Budget GP is retired. This runtime also standardizes Saudi
  // country-name variations and applies the KSA Historical Sales override used
  // only by the main Stock Level market table.
  const RETIRED_REPORT_KEY = 'actualGp';
  const access = window.BRReportAccess;
  const KSA_FORMULA =
    '(Goods Qty 2025 + Goods Qty 2026 + Bonus Qty 2025 + Bonus Qty 2026) × Price 2026';

  const normalizeIdentity = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '');

  const saudiAliases = new Set([
    'ksa',
    'saudi',
    'saudiarabia',
    'kingdomofsaudiarabia',
    'kingdomofsaudi',
    'saudiarabian',
    'السعودية',
    'المملكةالعربيةالسعودية'
  ]);

  const countryFieldAliases = new Set([
    'country',
    'countryname',
    'market',
    'marketname',
    'salescountry',
    'salesmarket',
    'stockcountry',
    'countrymarket'
  ]);

  function canonicalCountry(value) {
    const display = String(value ?? '').normalize('NFKC').trim();
    const identity = normalizeIdentity(display);
    if (!identity) return display;
    if (saudiAliases.has(identity) || identity.includes('saudi')) return 'KSA';
    return display;
  }

  function canonicalizeCountries(values = []) {
    return [...new Set(
      (values || [])
        .map(canonicalCountry)
        .map(value => String(value || '').trim())
        .filter(Boolean)
    )];
  }

  function canonicalizeRow(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    let changed = false;
    const next = { ...row };

    Object.keys(next).forEach(key => {
      if (!countryFieldAliases.has(normalizeIdentity(key))) return;
      const canonical = canonicalCountry(next[key]);
      if (canonical !== next[key]) {
        next[key] = canonical;
        changed = true;
      }
    });

    return changed ? next : row;
  }

  function canonicalizeRows(rows) {
    return Array.isArray(rows) ? rows.map(canonicalizeRow) : rows;
  }

  window.BRCanonicalCountry = canonicalCountry;
  window.BRCanonicalizeCountries = canonicalizeCountries;
  window.BRCanonicalizeCountryRows = canonicalizeRows;

  function wrapLoader(loader) {
    if (typeof loader !== 'function' || loader.__ksaCountryWrapped) return loader;
    const wrapped = function (rows, ...rest) {
      return loader.call(this, canonicalizeRows(rows), ...rest);
    };
    wrapped.__ksaCountryWrapped = true;
    return wrapped;
  }

  [
    'loadSalesRowsFromDatabase',
    'loadPnlRowsFromDatabase',
    'loadSmRowsFromDatabase',
    'loadStockRowsFromDatabase',
    'loadNearlyExpiredRowsFromDatabase',
    'loadProfitabilityRowsFromDatabase'
  ].forEach(name => {
    if (typeof window[name] === 'function') window[name] = wrapLoader(window[name]);
  });

  // Analysis is installed after this file. Intercept its loader assignment so
  // the executive dashboard receives the same canonical KSA data.
  let analysisLoader = wrapLoader(window.loadSalesAnalysisRows);
  try {
    Object.defineProperty(window, 'loadSalesAnalysisRows', {
      configurable: true,
      enumerable: true,
      get() {
        return analysisLoader;
      },
      set(loader) {
        analysisLoader = wrapLoader(loader);
      }
    });
  } catch (error) {
    console.error('Could not install KSA normalization for Analysis.', error);
  }

  // Expand Saudi aliases for Firestore queries. Loaded rows are still grouped
  // and displayed once under KSA.
  if (window.BRPortal?.requireSession && !window.BRPortal.__ksaSessionWrapped) {
    window.BRPortal.__ksaSessionWrapped = true;
    const originalRequireSession = window.BRPortal.requireSession.bind(window.BRPortal);
    window.BRPortal.requireSession = async function (options = {}) {
      const session = await originalRequireSession(options);
      if (!session?.profile) return session;

      const originalCountries = Array.isArray(session.profile.countries)
        ? session.profile.countries
        : [];
      const expandedCountries = [];

      originalCountries.forEach(country => {
        if (canonicalCountry(country) === 'KSA') {
          expandedCountries.push(
            'KSA',
            'Saudi',
            'Saudi Arabia',
            'Kingdom of Saudi Arabia',
            'Kingdom of Saudi'
          );
        } else {
          expandedCountries.push(country);
        }
      });

      return {
        ...session,
        profile: {
          ...session.profile,
          countries: [...new Set(expandedCountries)]
        }
      };
    };
  }

  function normalizeScopeLabel() {
    const element = document.getElementById('currentUserScope');
    if (!element) return;
    const text = String(element.textContent || '');
    const parts = text.split(' · ');
    if (parts.length < 2 || !parts[0].includes(',')) return;

    const countries = canonicalizeCountries(parts[0].split(','));
    const normalized = `${countries.join(', ')} · ${parts.slice(1).join(' · ')}`;
    if (normalized !== text) element.textContent = normalized;
  }

  const startScopeObserver = () => {
    normalizeScopeLabel();
    const element = document.getElementById('currentUserScope');
    if (!element) return;
    new MutationObserver(normalizeScopeLabel).observe(element, {
      childList: true,
      characterData: true,
      subtree: true
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startScopeObserver, { once:true });
  } else {
    startScopeObserver();
  }

  function removeRetiredUi() {
    document.querySelector('[data-tab="actualGpSection"]')?.remove();
    document.getElementById('actualGpSection')?.remove();
  }

  if (access) {
    const catalogIndex = access.catalog?.findIndex(item => item.key === RETIRED_REPORT_KEY) ?? -1;
    if (catalogIndex >= 0) access.catalog.splice(catalogIndex, 1);

    const keyIndex = access.allKeys?.indexOf(RETIRED_REPORT_KEY) ?? -1;
    if (keyIndex >= 0) access.allKeys.splice(keyIndex, 1);

    const originalResolve = access.resolve?.bind(access);
    if (originalResolve) {
      access.resolve = profile => originalResolve(profile)
        .filter(key => key !== RETIRED_REPORT_KEY);
    }

    const originalApply = access.apply?.bind(access);
    if (originalApply) {
      access.apply = profile => {
        const allowed = originalApply(profile)
          .filter(key => key !== RETIRED_REPORT_KEY);
        window.BR_ALLOWED_REPORTS = allowed;
        removeRetiredUi();
        return allowed;
      };
    }

    const originalHas = access.has?.bind(access);
    access.has = key => key === RETIRED_REPORT_KEY ? false : Boolean(originalHas?.(key));
    access.any = keys => (keys || []).some(key => access.has(key));
  }

  const FALLBACK_KSA_TOTAL_USD = 38954560.270270966;
  const fallbackKsaByGroup = Object.freeze({
    'Ambolar':723448.794978320017,
    'Amlodar - Amolar':54537.407020800005,
    'Amoxydar - Moxidad':135501.053455980000,
    'Amuretic':1610.621271400000,
    'Anxetin':598662.313373800018,
    'Aphrodil':0,
    'Azord - Xevaneer':541150.739071337623,
    'Capocard':560147.980154398479,
    'Carbatol':1647352.004237499787,
    'Cephadar':211346.188184360508,
    'Ciprodar - Qurex':849877.869952380075,
    'Claridar':684938.635671080556,
    'Clavodar':8288767.741969339550,
    'Cloracef':338549.784780886956,
    'Daroxime':846997.566013055388,
    'Diclogesic':583542.896990849986,
    'Doxydar':864901.634919309989,
    'Erythrodar':40606.149599600001,
    'Esperal-Espedar-Tiaqueen':24485.625542010002,
    'Famodar':404429.937250519986,
    'Gamcet':1519566.250814499799,
    'Gizlan':9409.882347350002,
    'Gizlan Duo - Gizamlo':15994.040058000002,
    'Hairgrow':5201285.927455300465,
    'Liblab - Avilop':3418784.065363799687,
    'Loratan - Loradad':76074.169113450000,
    'Lovista - Evadad':332466.647802800057,
    'Matador - Livador':274862.499812069931,
    'Mixif - Murex':1588733.747171400115,
    'Motrinex':923297.863686639932,
    'Mycoheal':842393.198796230019,
    'Myogesic':70628.813370720003,
    'Nerva Foot Care':-366.211200300000,
    'Rina':3955235.068956419826,
    'Rozitta - Robust':625969.835648400011,
    'Sucrazide':0,
    'Tyra 20 Mg':1352406.368512319867,
    'Tyra 5 Mg':839434.943819200154,
    'Vitadad - DivaD':381922.115028150030,
    'Zarlan - Xivar':125606.099277599991
  });

  let activeKsaTotalUsd = FALLBACK_KSA_TOTAL_USD;
  let activeKsaByGroup = { ...fallbackKsaByGroup };
  let activeKsaMetadata = {
    source:'fallback',
    reportingPeriod:'',
    sourceFile:'',
    excludedProductsWithout2026Price:6
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

  function ksaHistoricalSalesForCurrentScope() {
    const selectedGroups = selectedStockGroups();
    if (!selectedGroups.length) return activeKsaTotalUsd;

    const selectedKeys = new Set(selectedGroups.map(normalizeIdentity));
    return Object.entries(activeKsaByGroup)
      .reduce((total,[group,value]) => (
        selectedKeys.has(normalizeIdentity(group))
          ? total + (Number(value) || 0)
          : total
      ),0);
  }

  function publishKsaState() {
    window.BRKsaStockHistoricalSales = Object.freeze({
      totalUsd:activeKsaTotalUsd,
      byProductGroup:Object.freeze({ ...activeKsaByGroup }),
      formula:KSA_FORMULA,
      ...activeKsaMetadata
    });
  }

  function parseUploadedGroups(data) {
    if (Array.isArray(data?.groups)) {
      return Object.fromEntries(
        data.groups
          .map(item => [String(item?.name || '').trim(),Number(item?.value)])
          .filter(([name,value]) => name && Number.isFinite(value))
      );
    }
    if (data?.byProductGroup && typeof data.byProductGroup === 'object') {
      return Object.fromEntries(
        Object.entries(data.byProductGroup)
          .map(([name,value]) => [String(name).trim(),Number(value)])
          .filter(([name,value]) => name && Number.isFinite(value))
      );
    }
    return {};
  }

  function applyUploadedKsaData(data) {
    const groups = parseUploadedGroups(data);
    const calculatedTotal = Object.values(groups)
      .reduce((total,value) => total + (Number(value) || 0),0);
    const suppliedTotal = Number(data?.totalUsd);
    const total = Number.isFinite(suppliedTotal) ? suppliedTotal : calculatedTotal;
    if (!Object.keys(groups).length || !Number.isFinite(total)) return false;

    activeKsaTotalUsd = total;
    activeKsaByGroup = groups;
    activeKsaMetadata = {
      source:'firestore',
      reportingPeriod:String(data.reportingPeriod || ''),
      sourceFile:String(data.sourceFile || ''),
      includedProducts:Number(data.includedProducts) || 0,
      excludedProductsWithout2026Price:
        Number(data.excludedProductsWithout2026Price) || 0,
      uploadedAt:data.uploadedAt || null
    };
    publishKsaState();
    window.renderStockLevel?.();
    return true;
  }

  async function loadUploadedKsaData() {
    try {
      const snapshot = await window.BRPortal?.db
        ?.collection('system')
        .doc('ksaHistoricalSales')
        .get();
      if (snapshot?.exists) applyUploadedKsaData(snapshot.data() || {});
    } catch (error) {
      console.error('Unable to load uploaded KSA Historical Sales.',error);
    }
    return window.BRKsaStockHistoricalSales;
  }

  function installKsaStockTableHistoricalOverride() {
    const originalRenderer = window.stockStatementTableHtml;
    if (
      typeof originalRenderer !== 'function' ||
      originalRenderer.__ksaHistoricalTableWrapped
    ) return;

    const wrappedRenderer = function (
      rows,
      totals,
      dimension = 'Brand',
      ...rest
    ) {
      const dimensionKey = normalizeIdentity(dimension);
      if (dimensionKey !== 'market' && dimensionKey !== 'country') {
        return originalRenderer.call(this,rows,totals,dimension,...rest);
      }

      const nextRows = Array.isArray(rows)
        ? rows.map(row => ({ ...row }))
        : [];
      const ksaIndex = nextRows.findIndex(row =>
        canonicalCountry(row?.name) === 'KSA'
      );

      if (ksaIndex < 0) {
        return originalRenderer.call(this,rows,totals,dimension,...rest);
      }

      const previousHistorical = Number(nextRows[ksaIndex].historical) || 0;
      const replacementHistorical = ksaHistoricalSalesForCurrentScope();
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
        ...rest
      );
    };

    wrappedRenderer.__ksaHistoricalTableWrapped = true;
    window.stockStatementTableHtml = wrappedRenderer;
  }

  publishKsaState();
  installKsaStockTableHistoricalOverride();
  window.BRKsaHistoricalSalesReady = loadUploadedKsaData();

  window.loadActualGpRows = undefined;
  removeRetiredUi();
})();
