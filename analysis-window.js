(() => {
  'use strict';

  const MODULE_VERSION = 3;
  if ((window.__BR_ANALYSIS_WINDOW_VERSION__ || 0) >= MODULE_VERSION) return;
  window.__BR_ANALYSIS_WINDOW_VERSION__ = MODULE_VERSION;
  window.__analysisWindowInstalled = true;

  const submenu = document.getElementById('businessSubmenu');
  const workspace = document.getElementById('businessWorkspace');
  if (!submenu || !workspace) return;

  let tab = submenu.querySelector('[data-tab="analysisSection"]');
  if (!tab) {
    tab = document.createElement('button');
    tab.className = 'tab-btn';
    tab.type = 'button';
    tab.dataset.tab = 'analysisSection';
    tab.textContent = 'Analysis';
    submenu.appendChild(tab);
  }

  let section = document.getElementById('analysisSection');
  if (!section) {
    section = document.createElement('section');
    section.id = 'analysisSection';
    section.className = 'report-section analysis-section';
    section.hidden = true;
    workspace.appendChild(section);
  }

  // Keep the Analysis window available, but leave it completely empty.
  section.replaceChildren();
  document.getElementById('analysis-window-style')?.remove();
  document.body.classList.remove('analysis-view', 'analysis-presentation');

  const originalSetBusinessReportTab = window.setBusinessReportTab;
  if (typeof originalSetBusinessReportTab === 'function') {
    const patchedSetBusinessReportTab = function (tabId) {
      originalSetBusinessReportTab.call(this, tabId);
      if (tabId === 'analysisSection') {
        const subtitle = document.getElementById('headerSubtitle');
        if (subtitle) subtitle.textContent = 'Analysis';
      }
    };
    window.setBusinessReportTab = patchedSetBusinessReportTab;
    try { setBusinessReportTab = patchedSetBusinessReportTab; } catch (_) {}
    tab.addEventListener('click', () => patchedSetBusinessReportTab('analysisSection'));
  }

  // The dashboard may still pass Sales rows to this module; intentionally ignore them.
  window.loadSalesAnalysisRows = () => {};

  let analysisAllowed = true;
  const access = window.BRReportAccess;

  function canAccessAnalysis(profile) {
    if (String(profile?.role || '').trim().toLowerCase() === 'admin') return true;
    const hasSavedPermissions = Object.prototype.hasOwnProperty.call(
      profile || {},
      'reportPermissions'
    );
    if (!hasSavedPermissions) return true;
    return Array.isArray(profile.reportPermissions) &&
      profile.reportPermissions.includes('analysis');
  }

  function applyAnalysisVisibility(profile) {
    analysisAllowed = canAccessAnalysis(profile);
    tab.style.display = analysisAllowed ? '' : 'none';
    tab.dataset.reportAccessManaged = 'true';

    if (!analysisAllowed) {
      tab.classList.remove('active');
      section.classList.remove('active');
      section.hidden = true;
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
  }

  if (access) {
    if (!access.catalog.some(item => item.key === 'analysis')) {
      const mdaIndex = access.catalog.findIndex(item => item.key === 'mda');
      const insertAt = mdaIndex >= 0 ? mdaIndex : access.catalog.length;
      access.catalog.splice(insertAt, 0, { key:'analysis', label:'Analysis' });
    }
    if (!access.allKeys.includes('analysis')) access.allKeys.push('analysis');

    const originalResolve = access.resolve.bind(access);
    access.resolve = profile => {
      const resolved = originalResolve(profile);
      if (canAccessAnalysis(profile) && !resolved.includes('analysis')) {
        resolved.push('analysis');
      }
      return resolved;
    };

    const originalHas = access.has.bind(access);
    access.has = key => key === 'analysis' ? analysisAllowed : originalHas(key);
    access.any = keys => keys.some(key => access.has(key));

    const originalApply = access.apply.bind(access);
    access.apply = profile => {
      analysisAllowed = canAccessAnalysis(profile);
      const result = originalApply(profile);
      const merged = new Set(result || []);
      if (analysisAllowed) merged.add('analysis');
      else merged.delete('analysis');
      window.BR_ALLOWED_REPORTS = [...merged];
      applyAnalysisVisibility(profile);
      return [...merged];
    };
  }
})();
