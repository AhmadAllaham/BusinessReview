(() => {
  'use strict';

  const KSA_FORECAST_TOTAL_USD = 24320641.28984;
  const KSA_FORECAST_FORMULA =
    '(From July to Dec QTY + Bonus FY Budget QTY) × Unit Price';

  const ksaForecastByGroup = Object.freeze({
  "Ambolar": 53351.297999999995,
  "Amlodar - Amolar": 12366.8694,
  "Amoxydar - Moxidad": 147280.65300000002,
  "Amuretic": 3010.3326,
  "Anxetin": 211891.13999999998,
  "Azord - Xevaneer": 445559.2191,
  "Capocard": 228088.2289,
  "Carbatol": 8909.26344,
  "Cephadar": 81400.3344,
  "Ciprodar - Qurex": 687309.6888,
  "Claridar": 389871.387,
  "Clavodar": 5421254.1192,
  "Cloracef": 236668.1976,
  "Daroxime": 298647.972,
  "Diclogesic": 247691.007,
  "Doxydar": 368876.6352,
  "Erythrodar": 18157.446,
  "Esperal-Espedar-Tiaqueen": 76412.8998,
  "Famodar": 241888.896,
  "Gamcet": 1101091.32,
  "Gizlan": 32991.87,
  "Gizlan Duo - Gizamlo": 24957.0,
  "Hairgrow": 3665050.416,
  "Liblab - Avilop": 1754950.6,
  "Loratan - Loradad": 54194.832,
  "Lovista - Evadad": 153445.509,
  "Matador - Livador": 272826.495,
  "Mixif - Murex": 945355.3092,
  "Motrinex": 664320.096,
  "Mycoheal": 551269.4652,
  "Myogesic": 26973.0,
  "Rina": 3301297.344,
  "Rozitta - Robust": 547722.0,
  "Sucrazide": 1029.483,
  "Tyra 20 Mg": 1106344.98,
  "Tyra 5 Mg": 580602.573,
  "Zarlan - Xivar": 357583.41
});
  const ksaForecastByProduct = Object.freeze({
  "Ambolar 15 Mg Syrup 100 Ml": 53351.297999999995,
  "Amlodar - Amolar 10 Mg Caps 28": 8643.5328,
  "Amlodar - Amolar 5 Mg Caps 28": 3723.3365999999996,
  "Amoxydar - Moxidad 250 Mg Caps 20": 7431.021,
  "Amoxydar - Moxidad 500 Mg Caps 20": 139849.632,
  "Amuretic 5/50 Mg Tabs 30": 3010.3326,
  "Anxetin 20 Mg Caps 30": 211891.13999999998,
  "Azord - Xevaneer 16 Mg Tabs 30": 114648.054,
  "Azord - Xevaneer 8 Mg Tabs 30": 330911.1651,
  "Capocard 25 Mg Tabs 20": 228088.2289,
  "Carbatol 200 Mg Tabs 50": 8909.26344,
  "Cephadar 125 Mg Susp 100 Ml": 1559.48208,
  "Cephadar 250 Mg Caps 20": 44383.47432,
  "Cephadar 250 Mg Susp 100 Ml": 19518.6888,
  "Cephadar 500 Mg Caps 20": 15938.6892,
  "Ciprodar - Qurex 500 Mg Tabs 10": 254770.56,
  "Ciprodar - Qurex 500 Mg Tabs 14": 432539.1288,
  "Claridar 250 Mg Tabs 14": 33952.785,
  "Claridar 500 Mg Tabs 14": 355918.602,
  "Clavodar 1 Gm Tabs 14": 4184703.0,
  "Clavodar 312.5 Mg Susp 100 Ml": 194268.16199999998,
  "Clavodar 457 Mg Susp 70 Ml": 165886.152,
  "Clavodar 625 Mg Tabs 20": 876396.8052,
  "Cloracef 125 Mg Susp 60 Ml": 25637.1552,
  "Cloracef 250 Mg Caps 16": 12730.68,
  "Cloracef 250 Mg Susp 60 Ml": 55614.8304,
  "Cloracef 500 Mg Caps 16": 142685.532,
  "Daroxime 125 Mg Susp 50 Ml": 26366.688,
  "Daroxime 250 Mg Susp 50 Ml": 27142.83,
  "Daroxime 500 Mg Tabs 14": 245138.454,
  "Diclogesic 50 Mg Tabs 20": 139672.458,
  "Diclogesic Gel 50 Gm": 108018.549,
  "Doxydar 100 Mg Caps 10": 368876.6352,
  "Erythrodar 250 Mg Tabs 20": 18157.446,
  "Esperal-Espedar-Tiaqueen 300 Mg Tabs 30": 76412.8998,
  "Famodar 20 Mg Tabs 30": 66043.836,
  "Famodar 40 Mg Tabs 30": 175845.06,
  "Gamcet 5/10 Mg Tabs 30": 237250.62,
  "Gamcet 5/20 Mg Tabs 30": 330578.28,
  "Gamcet 5/40 Mg Tabs 30": 533262.42,
  "Gizlan 150 Mg Caps 30": 28118.34,
  "Gizlan 300 Mg Caps 30": 4873.53,
  "Gizlan Duo - Gizamlo 150 Mg/5 Mg Tabs 30": 8299.8,
  "Gizlan Duo - Gizamlo 300 Mg/10 Mg Tabs 30": 8299.8,
  "Gizlan Duo - Gizamlo 300 Mg/5 Mg Tabs 30": 8357.4,
  "Hairgrow 2% Solution 50 Ml": 1141950.816,
  "Hairgrow 5% Solution 50 Ml": 2523099.6,
  "Liblab - Avilop 10 Mg Tabs 30": 558577.26,
  "Liblab - Avilop 20 Mg Tabs 30": 1196373.34,
  "Loratan - Loradad 10 Mg Tabs 10": 54194.832,
  "Lovista - Evadad 10 Mg Tabs 28": 49107.753,
  "Lovista - Evadad 20 Mg Tabs 28": 104337.756,
  "Matador - Livador 10 Mg Tabs 30": 94409.415,
  "Matador - Livador 20 Mg Tabs 30": 178417.08,
  "Mixif - Murex 400 Mg Tabs 5": 235386.516,
  "Mixif - Murex 400 Mg Tabs 7": 709968.7932,
  "Motrinex 7.5 Mg Tabs 10": 664320.096,
  "Mycoheal 2% Cream 30 Gm": 29198.1,
  "Mycoheal Oral Gel 40 Gm": 508154.0012,
  "Mycoheal Vag 400 Mg Supp 3": 13917.363999999998,
  "Myogesic Tabs 30": 26973.0,
  "Rina 10 Mg Tabs 30": 157411.296,
  "Rina 5 Mg Tabs 30": 100526.048,
  "Rina D 2.5/120 Mg Tabs 30": 3043360.0,
  "Rozitta - Robust 10/10 Mg Tabs 30": 365148.0,
  "Rozitta - Robust 10/20 Mg Tabs 30": 182574.0,
  "Sucrazide 5 Mg Tabs 30": 1029.483,
  "Tyra 20 Mg Tabs 4": 1106344.98,
  "Tyra 5 Mg Tabs 30": 580602.573,
  "Zarlan - Xivar 10 Mg Tabs 30": 163625.04,
  "Zarlan - Xivar 15 Mg Tabs 30": 193958.37
});
  const ksaHistoricalByProduct = Object.freeze({
  "Ambolar 15 Mg Syrup 100 Ml": 723448.79497832,
  "Amlodar - Amolar 10 Mg Caps 28": 54537.407020800005,
  "Amlodar - Amolar 5 Mg Caps 28": 0,
  "Amoxydar - Moxidad 250 Mg Caps 20": -225.9234064,
  "Amoxydar - Moxidad 500 Mg Caps 20": 135726.97686238,
  "Amuretic 5/50 Mg Tabs 30": 1610.6212713999998,
  "Anxetin 20 Mg Caps 30": 598662.3133738,
  "Aphrodil 50 Mg Tabs 4": 0,
  "Azord - Xevaneer 16 Mg Tabs 30": 360276.08694955535,
  "Azord - Xevaneer 8 Mg Tabs 30": 180874.65212178227,
  "Capocard 25 Mg Tabs 20": 560147.9801543985,
  "Carbatol 200 Mg Tabs 50": 1647352.0042374998,
  "Cephadar 125 Mg Susp 100 Ml": 107486.55258943998,
  "Cephadar 250 Mg Caps 20": 37151.763368240485,
  "Cephadar 250 Mg Susp 100 Ml": 17962.059778560014,
  "Cephadar 500 Mg Caps 20": 48745.812448120014,
  "Ciprodar - Qurex 500 Mg Tabs 10": 585291.7181030999,
  "Ciprodar - Qurex 500 Mg Tabs 14": 264586.1518492802,
  "Claridar 250 Mg Tabs 14": 130574.08228797997,
  "Claridar 500 Mg Tabs 14": 554364.5533831005,
  "Clavodar 1 Gm Tabs 14": 6014205.117654121,
  "Clavodar 312.5 Mg Susp 100 Ml": 487566.5845769674,
  "Clavodar 457 Mg Susp 70 Ml": 490121.83903641964,
  "Clavodar 625 Mg Tabs 20": 1296874.2007018314,
  "Cloracef 125 Mg Susp 60 Ml": 171672.10101056,
  "Cloracef 250 Mg Caps 16": 34340.947320260006,
  "Cloracef 250 Mg Susp 60 Ml": 39297.189229200005,
  "Cloracef 500 Mg Caps 16": 93239.54722086696,
  "Daroxime 125 Mg Susp 50 Ml": 60945.85784969998,
  "Daroxime 250 Mg Susp 50 Ml": 473466.4243717999,
  "Daroxime 250 Mg Tabs 10": 0,
  "Daroxime 500 Mg Tabs 14": 312585.28379155544,
  "Diclogesic 50 Mg Tabs 20": 0,
  "Diclogesic Gel 50 Gm": 583542.89699085,
  "Diclogesic Retard 100 Mg Tabs 500": 0,
  "Doxydar 100 Mg Caps 10": 864901.63491931,
  "Erythrodar 250 Mg Tabs 20": 0,
  "Esperal-Espedar-Tiaqueen 300 Mg Tabs 30": 24485.62554201,
  "Famodar 20 Mg Tabs 30": 101057.49650148003,
  "Famodar 40 Mg Tabs 30": 303372.44074903993,
  "Gamcet 5/10 Mg Tabs 30": 268177.8742875,
  "Gamcet 5/20 Mg Tabs 30": 611969.907567,
  "Gamcet 5/40 Mg Tabs 30": 639418.46896,
  "Gizlan 150 Mg Caps 30": 8553.208003350001,
  "Gizlan 300 Mg Caps 30": 856.6743440000001,
  "Gizlan Duo - Gizamlo 150 Mg/5 Mg Tabs 30": 7660.204520000001,
  "Gizlan Duo - Gizamlo 300 Mg/10 Mg Tabs 30": 3640.9563720000005,
  "Gizlan Duo - Gizamlo 300 Mg/5 Mg Tabs 30": 4692.879165999999,
  "Hairgrow 2% Solution 50 Ml": 1954295.0388687002,
  "Hairgrow 5% Solution 50 Ml": 3246990.8885866,
  "Liblab - Avilop 10 Mg Tabs 30": 1126175.0400732,
  "Liblab - Avilop 20 Mg Tabs 30": 2292609.0252905996,
  "Loratan - Loradad 10 Mg Tabs 10": 76074.16911345,
  "Lovista - Evadad 10 Mg Tabs 28": 115017.90138000003,
  "Lovista - Evadad 20 Mg Tabs 28": 217448.74642280003,
  "Matador - Livador 10 Mg Tabs 30": 122953.12054670999,
  "Matador - Livador 20 Mg Tabs 30": 151909.37926535998,
  "Mixif - Murex 400 Mg Tabs 5": 701615.2265011,
  "Mixif - Murex 400 Mg Tabs 7": 887118.5206703001,
  "Motrinex 7.5 Mg Tabs 10": 923297.86368664,
  "Mycoheal 2% Cream 30 Gm": 214230.76606139998,
  "Mycoheal Oral Gel 40 Gm": 623284.3286664,
  "Mycoheal Vag 400 Mg Supp 3": 4878.104068430001,
  "Myogesic Tabs 30": 70628.81337072,
  "Nerva Foot Care Cream 100 Gm": -366.2112003,
  "Rina 10 Mg Tabs 30": 486099.87899180007,
  "Rina 5 Mg Tabs 30": -37139.23446018,
  "Rina D 2.5/120 Mg Tabs 30": 3506274.4244248,
  "Rozitta - Robust 10/10 Mg Tabs 30": 478334.4549168,
  "Rozitta - Robust 10/20 Mg Tabs 30": 147635.3807316,
  "Sucrazide 5 Mg Tabs 30": 0,
  "Tyra 20 Mg Tabs 4": 1352406.3685123199,
  "Tyra 5 Mg Tabs 30": 839434.9438192002,
  "Vitadad - DivaD 50000 IU Caps 4": 381922.11502815003,
  "Zarlan - Xivar 10 Mg Tabs 30": 57327.8074272,
  "Zarlan - Xivar 15 Mg Tabs 30": 68278.2918504
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

  function sumMapForSelectedGroups(source) {
    const selectedGroups = selectedStockGroups();
    if (!selectedGroups.length) {
      return Object.values(source)
        .reduce((total,value) => total + (Number(value) || 0),0);
    }

    const selectedKeys = new Set(selectedGroups.map(normalizeIdentity));
    return Object.entries(source)
      .reduce((total,[group,value]) => (
        selectedKeys.has(normalizeIdentity(group))
          ? total + (Number(value) || 0)
          : total
      ),0);
  }

  function forecastForCurrentScope() {
    return sumMapForSelectedGroups(ksaForecastByGroup);
  }

  function currentHistoricalByGroup() {
    const source = window.BRKsaStockHistoricalSales?.byProductGroup;
    return source && typeof source === 'object' ? source : {};
  }

  function currentForecastByGroup() {
    const source = window.BRKsaStockForecastSales?.byProductGroup;
    return source && typeof source === 'object'
      ? source
      : ksaForecastByGroup;
  }

  function normalizedLookup(source) {
    const lookup = new Map();
    Object.entries(source || {}).forEach(([name,value]) => {
      const key = normalizeIdentity(name);
      if (key) lookup.set(key,Number(value) || 0);
    });
    return lookup;
  }

  function applyDrilldownValues(rows,historicalSource,forecastSource) {
    const historicalLookup = normalizedLookup(historicalSource);
    const forecastLookup = normalizedLookup(forecastSource);

    return (Array.isArray(rows) ? rows : []).map(row => {
      const key = normalizeIdentity(row?.name);
      return {
        ...row,
        historical:historicalLookup.get(key) || 0,
        forecast:forecastLookup.get(key) || 0
      };
    });
  }

  function totalOf(rows,key) {
    return rows.reduce(
      (total,row) => total + (Number(row?.[key]) || 0),
      0
    );
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
      clickable = false,
      profitabilityScope = {type:'stock'},
      ...rest
    ) {
      const dimensionKey = normalizeIdentity(dimension);
      const isMarket =
        dimensionKey === 'market' || dimensionKey === 'country';
      const isBrand =
        dimensionKey === 'brand' || dimensionKey === 'productgroup';
      const isProduct =
        dimensionKey === 'sku' ||
        dimensionKey === 'product' ||
        dimensionKey === 'productname';

      if (isMarket) {
        const nextRows = Array.isArray(rows)
          ? rows.map(row => ({ ...row }))
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
          clickable,
          profitabilityScope,
          ...rest
        );
      }

      const isKsaDrilldown =
        (isBrand || isProduct) &&
        canonicalCountry(profitabilityScope?.country) === 'KSA';

      if (!isKsaDrilldown) {
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

      const nextRows = applyDrilldownValues(
        rows,
        isProduct ? ksaHistoricalByProduct : currentHistoricalByGroup(),
        isProduct ? ksaForecastByProduct : currentForecastByGroup()
      );
      const nextTotals = {
        ...(totals || {}),
        historical:totalOf(nextRows,'historical'),
        forecast:totalOf(nextRows,'forecast')
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

    wrappedRenderer.__ksaForecastTableWrapped = true;
    window.stockStatementTableHtml = wrappedRenderer;
  }

  window.BRKsaStockForecastSales = Object.freeze({
    totalUsd:KSA_FORECAST_TOTAL_USD,
    byProductGroup:ksaForecastByGroup,
    byProduct:ksaForecastByProduct,
    formula:KSA_FORECAST_FORMULA,
    sourceFile:'Rolling Forecast From July to Dec.2026(1).xlsx',
    sourceSheet:'Forcast KSA',
    includedProducts:77,
    missingUnitPriceProducts:0,
    bonusQtyErrorsTreatedAsZero:3
  });

  window.BRKsaStockHistoricalProductSales = Object.freeze({
    totalUsd:38954560.27027098,
    byProduct:ksaHistoricalByProduct,
    sourceFile:'KSA Historical sales.xlsx'
  });

  installForecastOverride();
})();
