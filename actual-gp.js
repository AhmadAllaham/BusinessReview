(() => {
  'use strict';

  // The Actual GP vs Budget GP report has been retired. This lightweight shim
  // runs before dashboard-firebase.js so the retired permission cannot trigger
  // Sales, P&L or Profitability dataset loading.
  const REPORT_KEY = 'actualGp';
  const access = window.BRReportAccess;

  function removeRetiredUi() {
    document.querySelector('[data-tab="actualGpSection"]')?.remove();
    document.getElementById('actualGpSection')?.remove();
  }

  if (access) {
    const catalogIndex = access.catalog?.findIndex(item => item.key === REPORT_KEY) ?? -1;
    if (catalogIndex >= 0) access.catalog.splice(catalogIndex, 1);

    const keyIndex = access.allKeys?.indexOf(REPORT_KEY) ?? -1;
    if (keyIndex >= 0) access.allKeys.splice(keyIndex, 1);

    const originalResolve = access.resolve?.bind(access);
    if (originalResolve) {
      access.resolve = profile => originalResolve(profile)
        .filter(key => key !== REPORT_KEY);
    }

    const originalApply = access.apply?.bind(access);
    if (originalApply) {
      access.apply = profile => {
        const allowed = originalApply(profile)
          .filter(key => key !== REPORT_KEY);
        window.BR_ALLOWED_REPORTS = allowed;
        removeRetiredUi();
        return allowed;
      };
    }

    const originalHas = access.has?.bind(access);
    access.has = key => key === REPORT_KEY ? false : Boolean(originalHas?.(key));
    access.any = keys => (keys || []).some(key => access.has(key));
  }

  window.loadActualGpRows = undefined;
  removeRetiredUi();
})();
