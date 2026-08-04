(() => {
  'use strict';

  if (window.__analysisWindowInstalled) return;
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
    section.innerHTML = `
      <article class="report-card analysis-report-card">
        <div class="analysis-page-head">
          <div>
            <span class="eyebrow">Business Intelligence</span>
            <h2>Analysis</h2>
            <p>This workspace is ready for the next management analysis.</p>
          </div>
        </div>
        <div class="analysis-empty-state">
          <div class="analysis-empty-icon" aria-hidden="true">A</div>
          <h3>Analysis workspace</h3>
          <p>The new window is active and ready for its reports, KPIs, charts, and tables.</p>
        </div>
      </article>`;
    workspace.appendChild(section);
  }

  if (!document.getElementById('analysis-window-style')) {
    const style = document.createElement('style');
    style.id = 'analysis-window-style';
    style.textContent = `
      body.analysis-view .sales-only-ui,
      body.analysis-view #activeFilterBar,
      body.analysis-view .sales-header-upload {
        display: none !important;
      }

      .analysis-report-card {
        min-height: 620px;
        overflow: hidden;
        border: 1px solid #dce9e6;
        background: #fff;
        box-shadow: 0 10px 28px rgba(15,118,110,.08);
      }

      .analysis-page-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        padding: 20px 22px;
        border-bottom: 1px solid #dce9e6;
        background: linear-gradient(180deg,#fbfefd 0%,#f3faf8 100%);
      }

      .analysis-page-head h2 {
        margin: 4px 0 0;
        color: #173f3b;
        font-size: 25px;
        line-height: 1.2;
      }

      .analysis-page-head p {
        margin: 7px 0 0;
        color: #64748b;
        font-size: 14px;
      }

      .analysis-empty-state {
        min-height: 500px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 42px 24px;
        text-align: center;
      }

      .analysis-empty-icon {
        width: 86px;
        height: 86px;
        display: grid;
        place-items: center;
        margin-bottom: 18px;
        border-radius: 24px;
        background: linear-gradient(145deg,#0b3158,#159b8d);
        color: #fff;
        font-size: 34px;
        font-weight: 950;
        box-shadow: 0 14px 30px rgba(11,49,88,.18);
      }

      .analysis-empty-state h3 {
        margin: 0;
        color: #0b3158;
        font-size: 25px;
      }

      .analysis-empty-state p {
        max-width: 620px;
        margin: 10px 0 0;
        color: #6b7a88;
        font-size: 15px;
        line-height: 1.65;
      }
    `;
    document.head.appendChild(style);
  }

  const originalSetBusinessReportTab = window.setBusinessReportTab;
  if (typeof originalSetBusinessReportTab === 'function') {
    const patchedSetBusinessReportTab = function (tabId) {
      originalSetBusinessReportTab.call(this, tabId);
      const isAnalysis = tabId === 'analysisSection';
      document.body.classList.toggle('analysis-view', isAnalysis);

      if (isAnalysis) {
        const subtitle = document.getElementById('headerSubtitle');
        if (subtitle) subtitle.textContent = 'Business Analysis · Management Insights';
      }
    };

    window.setBusinessReportTab = patchedSetBusinessReportTab;
    try {
      setBusinessReportTab = patchedSetBusinessReportTab;
    } catch (_) {}

    tab.addEventListener('click', () => patchedSetBusinessReportTab('analysisSection'));
  }

  let analysisAllowed = true;
  const access = window.BRReportAccess;

  function canAccessAnalysis(profile) {
    if (profile?.role === 'admin') return true;
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
    const businessButton = document.querySelector('[data-workspace="businessWorkspace"]');
    const businessWorkspace = document.getElementById('businessWorkspace');
    if (businessButton) businessButton.style.display = '';
    if (businessWorkspace) businessWorkspace.style.display = '';

    const visibleActiveTab = submenu.querySelector('.tab-btn.active:not([style*="display: none"])');
    if (!visibleActiveTab) {
      if (businessButton && !businessButton.classList.contains('active')) businessButton.click();
      tab.click();
    }
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
      if (canAccessAnalysis(profile) && !resolved.includes('analysis')) resolved.push('analysis');
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