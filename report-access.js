(() => {
  'use strict';

  if (window.BRReportAccess) return;

  const catalog = [
    { key: 'salesAnalysis', label: 'Sales Analysis' },
    { key: 'actualGp', label: 'Actual GP vs Budget GP' },
    { key: 'focAnalysis', label: 'IMS FOC Analysis' },
    { key: 'stockLevel', label: 'Stock Level' },
    { key: 'nearlyExpired', label: 'Nearly Expired' },
    { key: 'stockDashboard', label: 'Stock Dashboard' },
    { key: 'smExpenses', label: 'Selling & Marketing Expenses' },
    { key: 'pnl', label: 'P&L' },
    { key: 'mda', label: 'MD&A' }
  ];
  const allKeys = catalog.map(item => item.key);
  const businessKeys = allKeys.filter(key => key !== 'mda');
  let allowed = new Set(allKeys);
  let observer = null;
  let stockPatched = false;
  let activating = false;

  const staticTabs = {
    salesAnalysis: 'salesSection',
    actualGp: 'actualGpSection',
    focAnalysis: 'focSection',
    smExpenses: 'smExpensesSection',
    pnl: 'pnlSection'
  };

  const stockModes = {
    stockLevel: 'stock',
    nearlyExpired: 'nearlyExpired',
    stockDashboard: 'dashboard'
  };

  function resolve(profile) {
    if (profile?.role === 'admin') return [...allKeys];
    const hasSavedPermissions = Object.prototype.hasOwnProperty.call(
      profile || {},
      'reportPermissions'
    );
    if (!hasSavedPermissions) return [...allKeys];
    if (!Array.isArray(profile.reportPermissions)) return [];
    return [...new Set(profile.reportPermissions.filter(key => allKeys.includes(key)))];
  }

  function has(key) {
    return allowed.has(key);
  }

  function any(keys) {
    return keys.some(has);
  }

  function setVisible(element, visible) {
    if (!element) return;
    element.dataset.reportAccessManaged = 'true';
    element.style.display = visible ? '' : 'none';
    if (!visible) {
      element.classList.remove('active');
      element.setAttribute('aria-hidden', 'true');
    } else {
      element.removeAttribute('aria-hidden');
    }
  }

  function firstAllowedStockMode() {
    return Object.entries(stockModes).find(([key]) => has(key))?.[1] || '';
  }

  function enforceStockAccess() {
    const stockAllowed = any(Object.keys(stockModes));
    const stockTab = document.querySelector('[data-tab="stockSection"]');
    const stockSection = document.getElementById('stockSection');
    setVisible(stockTab, stockAllowed);
    if (!stockAllowed) setVisible(stockSection, false);

    Object.entries(stockModes).forEach(([key, mode]) => {
      const button = document.querySelector(`[data-stock-display="${mode}"]`);
      setVisible(button, has(key));
    });
  }

  function patchStockMode() {
    if (stockPatched || typeof window.setStockDisplayMode !== 'function') return;
    stockPatched = true;
    const original = window.setStockDisplayMode;
    window.setStockDisplayMode = function (requestedMode) {
      const permittedModes = Object.entries(stockModes)
        .filter(([key]) => has(key))
        .map(([, mode]) => mode);
      const safeMode = permittedModes.includes(requestedMode)
        ? requestedMode
        : permittedModes[0];
      if (!safeMode) return;
      original.call(this, safeMode);
      enforceStockAccess();
    };
  }

  function enforceStaticAccess() {
    Object.entries(staticTabs).forEach(([key, sectionId]) => {
      const tab = document.querySelector(`[data-tab="${sectionId}"]`);
      const section = document.getElementById(sectionId);
      setVisible(tab, has(key));
      if (!has(key)) setVisible(section, false);
    });

    enforceStockAccess();

    const businessButton = document.querySelector('[data-workspace="businessWorkspace"]');
    const businessWorkspace = document.getElementById('businessWorkspace');
    const businessAllowed = any(businessKeys);
    setVisible(businessButton, businessAllowed);
    if (!businessAllowed) setVisible(businessWorkspace, false);

    const mdaButton = document.querySelector('[data-workspace="mdaWorkspace"]');
    const mdaWorkspace = document.getElementById('mdaWorkspace');
    setVisible(mdaButton, has('mda'));
    if (!has('mda')) setVisible(mdaWorkspace, false);
  }

  function activateFirstAllowed() {
    if (activating) return;
    activating = true;
    try {
      const activeTab = document.querySelector('.side-submenu .tab-btn.active');
      if (activeTab && activeTab.style.display !== 'none') {
        if (activeTab.dataset.tab === 'stockSection') {
          patchStockMode();
          const mode = firstAllowedStockMode();
          if (mode) window.setStockDisplayMode?.(mode);
        }
        return;
      }

      const tabOrder = [
        ['salesAnalysis', 'salesSection'],
        ['actualGp', 'actualGpSection'],
        ['focAnalysis', 'focSection'],
        ['stockLevel', 'stockSection'],
        ['nearlyExpired', 'stockSection'],
        ['stockDashboard', 'stockSection'],
        ['smExpenses', 'smExpensesSection'],
        ['pnl', 'pnlSection']
      ];
      const target = tabOrder.find(([key, sectionId]) =>
        has(key) && document.querySelector(`[data-tab="${sectionId}"]`)
      );

      if (target) {
        const [, sectionId] = target;
        const businessButton = document.querySelector('[data-workspace="businessWorkspace"]');
        if (businessButton && !businessButton.classList.contains('active')) businessButton.click();
        document.querySelector(`[data-tab="${sectionId}"]`)?.click();
        if (sectionId === 'stockSection') {
          patchStockMode();
          const mode = firstAllowedStockMode();
          if (mode) window.setStockDisplayMode?.(mode);
        }
        return;
      }

      if (has('mda')) {
        document.querySelector('[data-workspace="mdaWorkspace"]')?.click();
      }
    } finally {
      activating = false;
    }
  }

  function apply(profile) {
    allowed = new Set(resolve(profile));
    window.BR_ALLOWED_REPORTS = [...allowed];
    patchStockMode();
    enforceStaticAccess();
    activateFirstAllowed();

    if (!observer) {
      observer = new MutationObserver(() => {
        enforceStaticAccess();
        patchStockMode();
        activateFirstAllowed();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return [...allowed];
  }

  window.BRReportAccess = {
    catalog,
    allKeys,
    resolve,
    apply,
    has,
    any
  };
})();
