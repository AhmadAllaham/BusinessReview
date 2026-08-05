(async function () {
  'use strict';

  const statusBox = document.getElementById('statusBox');
  const showStatus = (message,ok=false,error=false) => {
    if (typeof window.setStatus === 'function') return window.setStatus(message,ok,error);
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `status-box${ok ? ' ok' : ''}${error ? ' error' : ''}`;
  };

  function loadScriptOnce(src,attribute) {
    return new Promise((resolve,reject) => {
      const existing = document.querySelector(`script[${attribute}]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.setAttribute(attribute,'true');
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(script);
    });
  }

  const loadActualGpModule = () => {
    if (typeof window.loadActualGpRows === 'function') return Promise.resolve();
    return loadScriptOnce('actual-gp.js?v=20260805-2','data-actual-gp-module');
  };

  const loadNearExpiryStockFix = () => {
    if (document.querySelector('script[data-near-expiry-stock-fix][data-loaded="true"]')) {
      return Promise.resolve();
    }
    return loadScriptOnce(
      'near-expiry-agent-stock-fix.js?v=20260805-2',
      'data-near-expiry-stock-fix'
    );
  };

  const loadPnlRemainingRatioFix = () => {
    if (window.__pnlRemainingRatioFixInstalled) return Promise.resolve();
    return loadScriptOnce(
      'pnl-remaining-ratio-fix.js?v=20260805-2',
      'data-pnl-remaining-ratio-fix'
    );
  };

  const loadSalesCanonicalizer = () => {
    if (typeof window.canonicalizeSalesRows === 'function') return Promise.resolve();
    return loadScriptOnce(
      'sales-ims-canonical.js?v=20260805-2',
      'data-sales-canonicalizer'
    );
  };

  const loadReportAccess = () => {
    if (window.BRReportAccess) return Promise.resolve();
    return loadScriptOnce('report-access.js?v=20260805-2','data-report-access');
  };

  if (!window.BRPortal?.configured) {
    showStatus(window.BRPortal?.error || 'Firebase is not configured.',false,true);
    return;
  }

  const session = await BRPortal.requireSession({next:'index.html'});
  if (!session) return;

  const profile = session.profile || {};
  const isAdmin = String(profile.role || '').trim().toLowerCase() === 'admin';
  const rawCountries = Array.isArray(profile.countries)
    ? profile.countries
    : profile.countries == null || profile.countries === ''
      ? []
      : [profile.countries];
  const allowedCountries = [...new Set(rawCountries.map(value => String(value || '').trim()).filter(Boolean))];
  const GCC_COUNTRIES = [
    'GCC','UAE','United Arab Emirates','Qatar','Bahrain','Kuwait','Oman'
  ];
  const queryCountries = [...new Set(allowedCountries.flatMap(country =>
    country.toUpperCase() === 'GCC' ? GCC_COUNTRIES : [country]
  ))];

  let allowedReports = [];
  try {
    await loadReportAccess();
    allowedReports = window.BRReportAccess?.apply(profile) || [];
  } catch (accessError) {
    console.error(accessError);
    allowedReports = [
      'salesAnalysis','actualGp','focAnalysis','stockLevel',
      'nearlyExpired','stockDashboard','smExpenses','pnl','analysis','mda'
    ];
  }

  const allowedReportSet = new Set(allowedReports);
  const hasReport = key => isAdmin || allowedReportSet.has(key);

  const userName = document.getElementById('currentUserName');
  const userScope = document.getElementById('currentUserScope');
  if (userName) userName.textContent = profile.displayName || session.user.email || 'User';
  if (userScope) {
    const displayCountries = profile.__displayCountries || allowedCountries;
    userScope.textContent = isAdmin
      ? 'Administrator · All countries · All windows'
      : displayCountries.length
        ? `${displayCountries.join(', ')} · ${allowedReports.length} windows`
        : 'No countries assigned';
  }
  document.querySelectorAll('[data-admin-only]').forEach(element => {
    element.hidden = !isAdmin;
  });
  document.getElementById('logoutButton')?.addEventListener('click',BRPortal.signOut);

  if (!isAdmin && !allowedCountries.length) {
    showStatus('No countries are assigned to your account. Contact the administrator.',false,true);
    return;
  }
  if (!allowedReports.length) {
    showStatus('No report windows are assigned to your account. Contact the administrator.',false,true);
    return;
  }

  showStatus('Preparing your authorized dashboard…');
  const activeSnap = await BRPortal.db.collection('system').doc('activeDatasets').get();
  if (!activeSnap.exists) {
    showStatus('No active reports. Ask an administrator to upload the Excel files in admin.html.',false,true);
    return;
  }
  const active = activeSnap.data();

  const datasetPromiseCache = new Map();
  const reportPromiseCache = new Map();
  const data = {
    sales:null,
    pnl:null,
    sm:null,
    stock:null,
    nearlyExpired:null,
    profitability:null,
    analysisCost:null
  };
  const mounted = new Set();

  async function loadDataset(datasetId) {
    if (!datasetId) return [];
    if (datasetPromiseCache.has(datasetId)) return datasetPromiseCache.get(datasetId);

    const promise = (async () => {
      let chunkDocs = [];
      if (isAdmin) {
        const snapshot = await BRPortal.db.collection('reportChunks')
          .where('datasetId','==',datasetId)
          .get();
        chunkDocs = snapshot.docs;
      } else {
        const snapshots = await Promise.all(queryCountries.map(country =>
          BRPortal.db.collection('reportChunks')
            .where('datasetId','==',datasetId)
            .where('country','==',country)
            .get()
        ));
        chunkDocs = snapshots.flatMap(snapshot => snapshot.docs);
      }

      return chunkDocs
        .sort((leftDoc,rightDoc) => {
          const left = leftDoc.data();
          const right = rightDoc.data();
          return String(left.country || '').localeCompare(String(right.country || '')) ||
            (left.chunkIndex || 0) - (right.chunkIndex || 0);
        })
        .flatMap(doc => doc.data().rows || [])
        .map(row => row.payload || {});
    })();

    datasetPromiseCache.set(datasetId,promise);
    try {
      return await promise;
    } catch (error) {
      datasetPromiseCache.delete(datasetId);
      throw error;
    }
  }

  async function getSales() {
    if (data.sales) return data.sales;
    await loadSalesCanonicalizer();
    const rows = await loadDataset(active.sales);
    data.sales = typeof window.canonicalizeSalesRows === 'function'
      ? window.canonicalizeSalesRows(rows)
      : rows;
    return data.sales;
  }

  async function mountSales() {
    const rows = await getSales();
    if (!mounted.has('sales')) {
      window.loadSalesRowsFromDatabase?.(rows);
      mounted.add('sales');
    }
    return rows;
  }

  async function getPnl() {
    if (data.pnl) return data.pnl;
    data.pnl = await loadDataset(active.pnl);
    return data.pnl;
  }

  async function mountPnl() {
    await loadPnlRemainingRatioFix();
    const rows = await getPnl();
    if (!mounted.has('pnl')) {
      window.loadPnlRowsFromDatabase?.(rows);
      mounted.add('pnl');
    }
    return rows;
  }

  async function getStock() {
    if (!data.stock) data.stock = await loadDataset(active.stock);
    return data.stock;
  }

  async function mountStock() {
    const rows = await getStock();
    if (!mounted.has('stock')) {
      window.loadStockRowsFromDatabase?.(rows);
      mounted.add('stock');
    }
    return rows;
  }

  async function mountSm() {
    await loadNearExpiryStockFix();
    if (!data.sm) data.sm = await loadDataset(active.sm);
    if (!mounted.has('sm')) {
      window.loadSmRowsFromDatabase?.(data.sm);
      mounted.add('sm');
    }
    return data.sm;
  }

  async function getNearlyExpired() {
    if (!data.nearlyExpired) {
      data.nearlyExpired = await loadDataset(active.nearlyExpired);
    }
    return data.nearlyExpired;
  }

  async function mountNearlyExpired() {
    await loadNearExpiryStockFix();
    const rows = await getNearlyExpired();
    if (!mounted.has('nearlyExpired')) {
      window.loadNearlyExpiredRowsFromDatabase?.(rows);
      mounted.add('nearlyExpired');
    }
    return rows;
  }

  async function getProfitability() {
    if (!data.profitability) {
      data.profitability = await loadDataset(active.profitability);
    }
    return data.profitability;
  }

  async function mountProfitability() {
    const rows = await getProfitability();
    if (!mounted.has('profitability')) {
      window.loadProfitabilityRowsFromDatabase?.(rows);
      mounted.add('profitability');
    }
    return rows;
  }

  async function getAnalysisCost() {
    if (!data.analysisCost) {
      data.analysisCost = await loadDataset(active.analysisCost);
    }
    return data.analysisCost;
  }

  async function mountActualGp() {
    const [sales,pnl,profitability] = await Promise.all([
      getSales(),
      getPnl(),
      mountProfitability()
    ]);
    await loadActualGpModule();
    if (!mounted.has('actualGp')) {
      window.loadActualGpRows?.(sales,pnl,profitability);
      mounted.add('actualGp');
    }
  }

  async function mountAnalysis() {
    const canUseSales = hasReport('salesAnalysis') || hasReport('focAnalysis') || hasReport('actualGp');
    const canUsePnl = hasReport('pnl');
    const canUseStock = hasReport('stockLevel') || hasReport('stockDashboard');
    const canUseNearExpiry = hasReport('nearlyExpired');
    const canUseProfitability = hasReport('actualGp') || hasReport('salesAnalysis') || hasReport('stockLevel');

    const [sales,pnl,stock,nearlyExpired,profitability,cost] = await Promise.all([
      canUseSales ? getSales() : Promise.resolve([]),
      canUsePnl ? getPnl() : Promise.resolve([]),
      canUseStock ? getStock() : Promise.resolve([]),
      canUseNearExpiry ? getNearlyExpired() : Promise.resolve([]),
      canUseProfitability ? getProfitability() : Promise.resolve([]),
      getAnalysisCost()
    ]);

    window.loadIntegratedAnalysisData?.({
      sales,
      pnl,
      stock,
      nearlyExpired,
      profitability,
      cost
    });
    mounted.add('analysis');
  }

  const reportLabels = {
    salesAnalysis:'Sales',
    focAnalysis:'FOC',
    actualGp:'Actual GP',
    stockLevel:'Stock Level',
    stockDashboard:'Stock Dashboard',
    nearlyExpired:'Nearly Expired',
    smExpenses:'S&M',
    pnl:'P&L',
    analysis:'Analysis',
    mda:'MD&A'
  };

  async function ensureReport(reportKey,{quiet=false}={}) {
    if (!reportKey || !hasReport(reportKey)) return;
    if (reportPromiseCache.has(reportKey)) return reportPromiseCache.get(reportKey);

    const promise = (async () => {
      if (!quiet) showStatus(`Loading ${reportLabels[reportKey] || 'report'} data…`);

      switch (reportKey) {
        case 'salesAnalysis':
        case 'focAnalysis':
          await mountSales();
          break;
        case 'actualGp':
          await mountActualGp();
          break;
        case 'stockLevel':
        case 'stockDashboard':
          await mountStock();
          break;
        case 'nearlyExpired':
          await mountNearlyExpired();
          break;
        case 'smExpenses':
          await mountSm();
          break;
        case 'pnl':
          await mountPnl();
          break;
        case 'analysis':
          await mountAnalysis();
          break;
        case 'mda':
          break;
        default:
          return;
      }

      window.BRReportAccess?.apply(profile);
      if (!quiet) showStatus(`${reportLabels[reportKey] || 'Report'} is ready.`,true,false);
    })();

    reportPromiseCache.set(reportKey,promise);
    try {
      return await promise;
    } catch (error) {
      reportPromiseCache.delete(reportKey);
      if (!quiet) {
        const message = String(error?.message || error || 'Unable to load report data.');
        showStatus(
          message.toLowerCase().includes('index')
            ? 'Firestore needs the reportChunks datasetId + country index.'
            : message.toLowerCase().includes('permission')
              ? 'Your account cannot read this report dataset. Check the country permission.'
              : message,
          false,
          true
        );
      }
      throw error;
    }
  }

  function stockReportKey() {
    const mode = document.querySelector('[data-stock-display].active')?.dataset.stockDisplay;
    if (mode === 'nearlyExpired') return 'nearlyExpired';
    if (mode === 'dashboard') return 'stockDashboard';
    return 'stockLevel';
  }

  function reportKeyForTab(tabId) {
    return {
      salesSection:'salesAnalysis',
      focSection:'focAnalysis',
      actualGpSection:'actualGp',
      stockSection:stockReportKey(),
      smExpensesSection:'smExpenses',
      pnlSection:'pnl',
      analysisSection:'analysis'
    }[tabId] || '';
  }

  function firstAuthorizedReport() {
    const activeTab = document.querySelector('.side-submenu .tab-btn.active');
    const activeKey = reportKeyForTab(activeTab?.dataset.tab);
    if (activeKey && hasReport(activeKey)) return activeKey;

    return [
      'salesAnalysis','actualGp','focAnalysis','stockLevel','nearlyExpired',
      'stockDashboard','smExpenses','pnl','analysis','mda'
    ].find(hasReport) || '';
  }

  document.addEventListener('click',event => {
    const tab = event.target instanceof Element
      ? event.target.closest('[data-tab]')
      : null;
    if (tab) {
      setTimeout(() => {
        const key = reportKeyForTab(tab.dataset.tab);
        ensureReport(key).catch(console.error);
      },0);
      return;
    }

    const stockMode = event.target instanceof Element
      ? event.target.closest('[data-stock-display]')
      : null;
    if (stockMode) {
      setTimeout(() => ensureReport(stockReportKey()).catch(console.error),0);
    }
  });

  const initialReport = firstAuthorizedReport();
  try {
    await ensureReport(initialReport);
  } catch (error) {
    console.error(error);
    return;
  }

  if (hasReport('salesAnalysis') || hasReport('focAnalysis') || hasReport('stockLevel')) {
    const preloadProfitability = () => mountProfitability().catch(error => console.error(error));
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preloadProfitability,{timeout:5000});
    } else {
      setTimeout(preloadProfitability,2500);
    }
  }
})();