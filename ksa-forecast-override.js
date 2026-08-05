(() => {
  'use strict';

  const KSA_FORECAST_TOTAL_USD = 24320641.28984;
  const KSA_FORECAST_FORMULA =
    '(From July to Dec QTY + Bonus FY Budget QTY) × Unit Price';

  const ksaForecastByGroup = Object.freeze({
    'Ambolar':53351.297999999995,
    'Amlodar - Amolar':12366.8694,
    'Amoxydar - Moxidad':147280.65300000002,
    'Amuretic':3010.3326,
    'Anxetin':211891.13999999998,
    'Azord - Xevaneer':445559.2191,
    'Capocard':228088.2289,
    'Carbatol':8909.26344,
    'Cephadar':81400.3344,
    'Ciprodar - Qurex':687309.6888,
    'Claridar':389871.387,
    'Clavodar':5421254.1192,
    'Cloracef':236668.1976,
    'Daroxime':298647.972,
    'Diclogesic':247691.007,
    'Doxydar':368876.6352,
    'Erythrodar':18157.446,
    'Esperal-Espedar-Tiaqueen':76412.8998,
    'Famodar':241888.896,
    'Gamcet':1101091.32,
    'Gizlan':32991.87,
    'Gizlan Duo - Gizamlo':24957,
    'Hairgrow':3665050.416,
    'Liblab - Avilop':1754950.6,
    'Loratan - Loradad':54194.832,
    'Lovista - Evadad':153445.509,
    'Matador - Livador':272826.495,
    'Mixif - Murex':945355.3092,
    'Motrinex':664320.096,
    'Mycoheal':551269.4652,
    'Myogesic':26973,
    'Rina':3301297.344,
    'Rozitta - Robust':547722,
    'Sucrazide':1029.483,
    'Tyra 20 Mg':1106344.98,
    'Tyra 5 Mg':580602.573,
    'Zarlan - Xivar':357583.41
  });

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
    return identity === 'ksa' || identity.includes('saudi') ? 'KSA' : String(value ?? '').trim();
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

  function forecastForCurrentScope() {
    const selectedGroups = selectedStockGroups();
    if (!selectedGroups.length) return KSA_FORECAST_TOTAL_USD;

    const selectedKeys = new Set(selectedGroups.map(normalizeIdentity));
    return Object.entries(ksaForecastByGroup)
      .reduce((total,[group,value]) => (
        selectedKeys.has(normalizeIdentity(group))
          ? total + (Number(value) || 0)
          : total
      ),0);
  }

  function installForecastOverride() {
    const originalRenderer = window.stockStatementTableHtml;
    if (
      typeof originalRenderer !== 'function' ||
      originalRenderer.__ksaForecastTableWrapped
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

      const previousForecast = Number(nextRows[ksaIndex].forecast) || 0;
      const replacementForecast = forecastForCurrentScope();
      nextRows[ksaIndex].forecast = replacementForecast;

      const nextTotals = {
        ...(totals || {}),
        forecast:
          (Number(totals?.forecast) || 0) -
          previousForecast +
          replacementForecast
      };

      return originalRenderer.call(
        this,
        nextRows,
        nextTotals,
        dimension,
        ...rest
      );
    };

    wrappedRenderer.__ksaForecastTableWrapped = true;
    window.stockStatementTableHtml = wrappedRenderer;
  }

  window.BRKsaStockForecastSales = Object.freeze({
    totalUsd:KSA_FORECAST_TOTAL_USD,
    byProductGroup:ksaForecastByGroup,
    formula:KSA_FORECAST_FORMULA,
    sourceFile:'Rolling Forecast From July to Dec.2026(1).xlsx',
    sourceSheet:'Forcast KSA',
    includedProducts:77,
    missingUnitPriceProducts:0,
    bonusQtyErrorsTreatedAsZero:3
  });

  installForecastOverride();
})();
