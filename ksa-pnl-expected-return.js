(() => {
  'use strict';

  if (window.__BR_KSA_PNL_EXPECTED_RETURN__) return;
  if (
    typeof renderPnlVertical !== 'function' ||
    typeof pnlScenarioTotals !== 'function'
  ) return;

  window.__BR_KSA_PNL_EXPECTED_RETURN__ = true;

  const originalScenarioTotals = pnlScenarioTotals;
  const originalRenderPnlVertical = renderPnlVertical;
  let excludeExpectedReturn = true;

  function countryKey(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g, '');
  }

  function isKsa(value) {
    return [
      'ksa',
      'saudi',
      'saudiarabia',
      'kingdomofsaudiarabia'
    ].includes(countryKey(value));
  }

  function selectedPnlMarkets() {
    const selected = typeof getSelected === 'function'
      ? getSelected('pnlMarketFilter').map(String).filter(Boolean)
      : [];

    if (selected.length) return [...new Set(selected.map(countryKey).filter(Boolean))];

    if (typeof pnlFilteredRows !== 'function') return [];
    return [...new Set(
      pnlFilteredRows()
        .map(row => String(row?.market || '').trim())
        .filter(market => market && !countryKey(market).includes('totalcompany'))
        .map(countryKey)
        .filter(Boolean)
    )];
  }

  function isKsaOnlyScope() {
    const markets = selectedPnlMarkets();
    return markets.length === 1 && isKsa(markets[0]);
  }

  function isSaudiAssignedUser() {
    const scope=window.BR_CURRENT_USER_SCOPE;
    if (!scope || scope.isAdmin) return false;
    const countries=[...new Set(
      (Array.isArray(scope.countries) ? scope.countries : [scope.countries])
        .map(countryKey)
        .filter(Boolean)
    )];
    return countries.length === 1 && isKsa(countries[0]);
  }

  function adjustmentEnabled() {
    return excludeExpectedReturn && isSaudiAssignedUser() && isKsaOnlyScope();
  }

  pnlScenarioTotals = function (rows, scenario) {
    const totals = originalScenarioTotals.call(this, rows, scenario);
    if (scenario !== 'Actual' || !adjustmentEnabled()) return totals;

    const adjusted = { ...totals };
    const numberValue = value => typeof pnlNumber === 'function'
      ? pnlNumber(value)
      : Number(value) || 0;
    const actualReturn = numberValue(adjusted.actualReturn);
    const expectedReturn = numberValue(adjusted.expectedReturn);
    const totalReturn = actualReturn + expectedReturn;
    const addBack = -totalReturn;

    // Exclude the complete Return from Saudi Actual. Budget, LY and FY Budget remain reported.
    adjusted.actualReturn = 0;
    adjusted.expectedReturn = 0;
    adjusted.netSales = numberValue(adjusted.netSales) + addBack;
    adjusted.grossProfit = numberValue(adjusted.grossProfit) + addBack;
    adjusted.netIncome = numberValue(adjusted.netIncome) + addBack;

    return adjusted;
  };

  function installStyles() {
    if (document.getElementById('pnlKsaExpectedReturnStyles')) return;
    const style = document.createElement('style');
    style.id = 'pnlKsaExpectedReturnStyles';
    style.textContent = `
      .pnl-ksa-return-control{
        display:flex;
        align-items:center;
        gap:8px;
        padding:5px 7px 5px 10px;
        border:1px solid rgba(33,143,130,.28);
        border-radius:10px;
        background:rgba(231,244,242,.72);
        box-shadow:0 4px 13px rgba(33,143,130,.08);
      }
      .pnl-ksa-return-control[hidden]{display:none!important}
      .pnl-ksa-return-label{
        display:flex;
        flex-direction:column;
        line-height:1.1;
        white-space:nowrap;
      }
      .pnl-ksa-return-label strong{
        color:#173f3b;
        font-size:11px;
        font-weight:850;
      }
      .pnl-ksa-return-label small{
        margin-top:3px;
        color:#687b82;
        font-size:9px;
        font-weight:700;
      }
      .pnl-ksa-return-switch{
        display:inline-flex;
        gap:3px;
        padding:3px;
        border-radius:8px;
        background:rgba(15,49,88,.08);
      }
      .pnl-ksa-return-switch button{
        min-height:28px;
        border:0;
        border-radius:6px;
        padding:5px 9px;
        background:transparent;
        color:#52646d;
        font:inherit;
        font-size:10px;
        font-weight:800;
        cursor:pointer;
        white-space:nowrap;
      }
      .pnl-ksa-return-switch button.active{
        background:#0f766e;
        color:#fff;
        box-shadow:0 4px 11px rgba(15,118,110,.19);
      }
      .pnl-ksa-return-control.is-adjusted{
        border-color:rgba(15,118,110,.48);
        background:rgba(218,242,237,.92);
      }
      html.br-night-mode .pnl-ksa-return-control{
        border-color:rgba(53,200,183,.34);
        background:rgba(16,34,56,.88);
        box-shadow:0 7px 20px rgba(0,0,0,.22),0 0 15px rgba(53,200,183,.07);
      }
      html.br-night-mode .pnl-ksa-return-label strong{color:#eaf7f5}
      html.br-night-mode .pnl-ksa-return-label small{color:#94aabd}
      html.br-night-mode .pnl-ksa-return-switch{background:rgba(255,255,255,.055)}
      html.br-night-mode .pnl-ksa-return-switch button{color:#a9bbc8}
      html.br-night-mode .pnl-ksa-return-switch button.active{
        background:#35a899;
        color:#fff;
      }
      html.br-night-mode .pnl-ksa-return-control.is-adjusted{
        border-color:rgba(57,217,195,.5);
        background:rgba(17,63,68,.62);
      }
      @media(max-width:1050px){
        .pnl-ksa-return-control{order:20;width:100%;justify-content:space-between}
      }
    `;
    document.head.appendChild(style);
  }

  function installControl() {
    installStyles();
    const toolbarLeft = document.querySelector('#pnlSection .pnl-toolbar-left');
    if (!toolbarLeft) return null;

    let control = toolbarLeft.querySelector('[data-pnl-ksa-return-control]');
    if (control) return control;

    control = document.createElement('div');
    control.className = 'pnl-ksa-return-control';
    control.dataset.pnlKsaReturnControl = 'true';
    control.hidden = true;
    control.innerHTML = `
      <span class="pnl-ksa-return-label">
        <strong>KSA Return</strong>
        <small>Actual only · Budget unchanged</small>
      </span>
      <span class="pnl-ksa-return-switch" role="group" aria-label="KSA Actual Return treatment">
        <button class="active" type="button" data-pnl-ksa-return-mode="reported" aria-pressed="true">Included</button>
        <button type="button" data-pnl-ksa-return-mode="excluded" aria-pressed="false">Excluded</button>
      </span>`;

    const comparisonSwitch = toolbarLeft.querySelector('.pnl-comparison-switch');
    if (comparisonSwitch) comparisonSwitch.insertAdjacentElement('afterend', control);
    else toolbarLeft.appendChild(control);

    control.querySelectorAll('[data-pnl-ksa-return-mode]').forEach(button => {
      button.addEventListener('click', () => {
        if (!isSaudiAssignedUser() || !isKsaOnlyScope()) return;
        excludeExpectedReturn = button.dataset.pnlKsaReturnMode === 'excluded';
        syncControl();
        renderPnlVertical();
      });
    });

    return control;
  }

  function syncControl() {
    const control = installControl();
    if (!control) return;

    const canUseControl=isSaudiAssignedUser() && isKsaOnlyScope();
    if (!canUseControl) excludeExpectedReturn = true;
    control.hidden = !canUseControl;
    control.classList.toggle('is-adjusted', canUseControl && excludeExpectedReturn);

    control.querySelectorAll('[data-pnl-ksa-return-mode]').forEach(button => {
      const mode = button.dataset.pnlKsaReturnMode;
      const active = mode === (excludeExpectedReturn ? 'excluded' : 'reported');
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    control.title = excludeExpectedReturn
      ? 'Actual excludes Return. Budget remains unchanged.'
      : 'Actual and Budget are shown as reported.';
  }

  renderPnlVertical = function (...args) {
    syncControl();
    return originalRenderPnlVertical.apply(this, args);
  };

  document.addEventListener('br:user-scope-ready',syncControl);
  installControl();
  syncControl();
})();