(() => {
  'use strict';

  const FIX_VERSION = 4;
  if ((window.__BR_SALES_CANONICAL_VERSION__ || 0) >= FIX_VERSION) return;
  window.__BR_SALES_CANONICAL_VERSION__ = FIX_VERSION;

  const dimensions = [
    { name: 'type', aliases: ['Type', 'Sales Type', 'SalesType', 'Channel'] },
    { name: 'country', aliases: ['Country', 'Market', 'Country Name', 'CountryName'] },
    { name: 'sector', aliases: ['Sector'] },
    { name: 'agent', aliases: ['Agent', 'Distributor', 'Customer'] },
    {
      name: 'productGroup',
      aliases: ['Product Group', 'ProductGroup', 'Brand', 'Family', 'Product Family', 'Group']
    },
    {
      name: 'product',
      aliases: ['Product Name', 'ProductName', 'Product', 'Item Description', 'Item', 'SKU']
    }
  ];

  const standardKeys = {
    type: 'Type',
    country: 'Country',
    sector: 'Sector',
    agent: 'Agent',
    productGroup: 'Product Group',
    product: 'Product Name'
  };

  const yearAliases = ['Year', 'Fiscal Year', 'FiscalYear', 'Reporting Year'];
  const monthAliases = ['Month', 'Reporting Month', 'ReportingMonth', 'Period Month'];
  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const monthAliasesByNumber = {
    jan:1,january:1,
    feb:2,february:2,
    mar:3,march:3,
    apr:4,april:4,
    may:5,
    jun:6,june:6,
    jul:7,july:7,
    aug:8,august:8,
    sep:9,sept:9,september:9,
    oct:10,october:10,
    nov:11,november:11,
    dec:12,december:12
  };

  const normalizeHeader = value => String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '');

  const identity = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');

  const cleanDisplay = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');

  const aliasSets = Object.fromEntries(dimensions.map(dimension => [
    dimension.name,
    new Set(dimension.aliases.map(normalizeHeader))
  ]));
  const yearAliasSet = new Set(yearAliases.map(normalizeHeader));
  const monthAliasSet = new Set(monthAliases.map(normalizeHeader));

  const genericActualAliases = new Set([
    'actual', 'actualvalue', 'actualsales', 'actualsalesvalue',
    'actualsalesytd', 'actualytd', 'salesactual', 'salesactualvalue',
    'tmssales', 'tmsvalue', 'salesvalue'
  ]);
  const genericBudgetAliases = new Set([
    'budget', 'budgetvalue', 'budgetsales', 'budgetsalesvalue',
    'budgetsalesytd', 'budgetytd', 'salesbudget', 'salesbudgetvalue'
  ]);
  const genericLyAliases = new Set([
    'ly', 'lyvalue', 'lastyear', 'lastyearvalue', 'actually',
    'previousyear', 'previousyearvalue', 'previousyearactual',
    'lastyearactual', 'lastyearsales', 'actualsalesly'
  ]);
  const excludedMetricTokens = [
    'bonus', 'foc', 'qty', 'quantity', 'unit', 'units', 'price',
    'gp', 'grossprofit', 'margin', 'percent', 'percentage', 'pct'
  ];

  function matchingKeys(row, dimensionName) {
    const aliases = aliasSets[dimensionName];
    return Object.keys(row || {}).filter(key => aliases.has(normalizeHeader(key)));
  }

  function matchingAliasKeys(row, aliases) {
    return Object.keys(row || {}).filter(key => aliases.has(normalizeHeader(key)));
  }

  function firstMatchingValue(row, aliases) {
    const key = matchingAliasKeys(row, aliases)[0];
    return key === undefined ? '' : row[key];
  }

  function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  function numericValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    const normalized = text
      .replace(/,/g, '')
      .replace(/^\((.*)\)$/, '-$1')
      .replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function yearNumber(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getFullYear();
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value >= 1900 && value <= 2200) return Math.trunc(value);
      if (value > 20000 && value < 100000) {
        const date = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86400000);
        return date.getUTCFullYear();
      }
    }
    const text = cleanDisplay(value);
    const match = text.match(/(?:19|20|21)\d{2}/);
    return match ? Number(match[0]) : 0;
  }

  function monthNumber(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getMonth() + 1;
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value >= 1 && value <= 12) return Math.trunc(value);
      if (value > 20000 && value < 100000) {
        const date = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86400000);
        return date.getUTCMonth() + 1;
      }
    }

    const text = identity(value);
    if (!text) return 0;
    if (/^(?:0?[1-9]|1[0-2])$/.test(text)) return Number(text);

    const compact = text.replace(/[^a-z0-9]+/g, '');
    for (const [name, number] of Object.entries(monthAliasesByNumber)) {
      if (compact === name || compact.startsWith(name)) return number;
    }

    const iso = text.match(/(?:19|20|21)\d{2}[-/.](0?[1-9]|1[0-2])(?:[-/.]|$)/);
    if (iso) return Number(iso[1]);
    const dayFirst = text.match(/^(?:0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](?:19|20|21)\d{2}$/);
    return dayFirst ? Number(dayFirst[1]) : 0;
  }

  function canonicalYear(value) {
    const year = yearNumber(value);
    return year ? String(year) : cleanDisplay(value);
  }

  function canonicalMonth(value) {
    const month = monthNumber(value);
    return month ? monthNames[month - 1] : cleanDisplay(value);
  }

  function canonicalType(value) {
    const compact = normalizeHeader(value);
    if (!compact) return '';
    if (compact.includes('tms')) return 'TMS';
    if (compact.includes('ims')) return 'IMS';
    return cleanDisplay(value);
  }

  function typeValue(row) {
    for (const key of matchingKeys(row, 'type')) {
      const value = cleanDisplay(row[key]);
      if (value) return value;
    }
    return '';
  }

  function isImsRow(row) {
    return canonicalType(typeValue(row)) === 'IMS';
  }

  function addVariant(store, value, order) {
    const display = cleanDisplay(value);
    const key = identity(display);
    if (!display || !key) return;

    if (!store.has(key)) store.set(key, new Map());
    const variants = store.get(key);
    const current = variants.get(display) || { count: 0, first: order };
    current.count += 1;
    current.first = Math.min(current.first, order);
    variants.set(display, current);
  }

  function preferredVariant(variants) {
    if (!variants?.size) return '';
    return [...variants.entries()]
      .sort((left, right) =>
        right[1].count - left[1].count ||
        left[1].first - right[1].first ||
        left[0].localeCompare(right[0], undefined, { sensitivity: 'base' })
      )[0][0];
  }

  function buildCanonicalMap(rows, dimensionName) {
    const imsVariants = new Map();
    const allVariants = new Map();

    (rows || []).forEach((row, rowIndex) => {
      matchingKeys(row, dimensionName).forEach((key, keyIndex) => {
        const order = rowIndex * 20 + keyIndex;
        addVariant(allVariants, row[key], order);
        if (isImsRow(row)) addVariant(imsVariants, row[key], order);
      });
    });

    const canonical = new Map();
    const identities = new Set([...allVariants.keys(), ...imsVariants.keys()]);
    identities.forEach(key => {
      const preferred = preferredVariant(imsVariants.get(key)) ||
        preferredVariant(allVariants.get(key));
      if (preferred) canonical.set(key, preferred);
    });

    return canonical;
  }

  function metricHeaderIsSafe(normalizedHeader) {
    return !excludedMetricTokens.some(token => normalizedHeader.includes(token));
  }

  function metricYearFromHeader(normalizedHeader) {
    const match = normalizedHeader.match(/(?:19|20|21)\d{2}/);
    return match ? Number(match[0]) : 0;
  }

  function findMetricValue(row, kind, targetYear = 0, options = {}) {
    const genericSet = kind === 'actual'
      ? genericActualAliases
      : kind === 'budget'
        ? genericBudgetAliases
        : genericLyAliases;
    const candidates = [];

    Object.keys(row || {}).forEach((key, index) => {
      const normalized = normalizeHeader(key);
      const value = row[key];
      if (!hasValue(value) || !metricHeaderIsSafe(normalized)) return;

      const headerYear = metricYearFromHeader(normalized);
      const hasActual = normalized.includes('actual');
      const hasBudget = normalized.includes('budget');
      const hasSales = normalized.includes('sales') ||
        normalized.includes('value') ||
        normalized.includes('tms') ||
        normalized === 'actual' ||
        normalized === 'budget';
      const isLy = genericLyAliases.has(normalized) ||
        normalized.includes('lastyear') ||
        normalized.includes('previousyear');

      let matches = false;
      if (kind === 'actual') {
        matches = genericSet.has(normalized) ||
          (hasActual && hasSales && !isLy) ||
          Boolean(targetYear && headerYear === targetYear && hasSales && !hasBudget && !isLy);
      } else if (kind === 'budget') {
        matches = genericSet.has(normalized) || (hasBudget && hasSales);
      } else {
        matches = isLy;
      }
      if (!matches) return;

      if (targetYear && headerYear && headerYear !== targetYear) return;
      if (options.requireYear && !headerYear) return;
      if (options.excludeYear && headerYear === options.excludeYear) return;

      let score = 0;
      if (genericSet.has(normalized)) score += 100;
      if (targetYear && headerYear === targetYear) score += 120;
      if (hasActual && kind === 'actual') score += 30;
      if (normalized.includes('sales') || normalized.includes('tms')) score += 20;
      if (normalized.includes('ytd')) score += 10;
      if (!headerYear) score += 5;
      candidates.push({ value, score, index });
    });

    candidates.sort((left, right) => right.score - left.score || left.index - right.index);
    return candidates.length ? candidates[0].value : '';
  }

  function detectedDatasetYear(rows) {
    const years = [];
    (rows || []).forEach(row => {
      const rowYear = yearNumber(firstMatchingValue(row, yearAliasSet));
      if (rowYear) years.push(rowYear);
      Object.keys(row || {}).forEach(key => {
        const normalized = normalizeHeader(key);
        if (!metricHeaderIsSafe(normalized)) return;
        if (!(normalized.includes('actual') || normalized.includes('budget') || normalized.includes('sales'))) return;
        const headerYear = metricYearFromHeader(normalized);
        if (headerYear) years.push(headerYear);
      });
    });
    return years.length ? Math.max(...years) : 0;
  }

  function standardizeSalesMetrics(row, datasetYear) {
    const normalizedRow = row;
    const rowYear = yearNumber(normalizedRow.Year) || datasetYear;
    const previousYear = rowYear ? rowYear - 1 : 0;

    const currentActual =
      findMetricValue(normalizedRow, 'actual', rowYear) ||
      findMetricValue(normalizedRow, 'actual', 0, { excludeYear: previousYear });
    const currentBudget =
      findMetricValue(normalizedRow, 'budget', rowYear) ||
      findMetricValue(normalizedRow, 'budget');
    const explicitLy = findMetricValue(normalizedRow, 'ly');
    const previousYearActual = previousYear
      ? findMetricValue(normalizedRow, 'actual', previousYear, { requireYear: true })
      : '';

    if (hasValue(currentActual)) normalizedRow['Actual Value'] = currentActual;
    if (hasValue(currentBudget)) normalizedRow['Budget Value'] = currentBudget;
    if (hasValue(explicitLy)) normalizedRow.LY = explicitLy;
    else if (hasValue(previousYearActual)) normalizedRow.LY = previousYearActual;

    if (!yearNumber(normalizedRow.Year) && datasetYear) normalizedRow.Year = String(datasetYear);
  }

  function installSalesLyRuntimeFix() {
    if ((window.__salesLyRuntimeFixInstalled || 0) >= FIX_VERSION) return;
    if (
      typeof filteredLY !== 'function' ||
      typeof aggregate !== 'function' ||
      typeof getSelected !== 'function'
    ) return;

    window.__salesLyRuntimeFixInstalled = FIX_VERSION;

    function filterIdentity(column, value) {
      const normalizedColumn = normalizeHeader(column);
      if (normalizedColumn === 'month' || normalizedColumn === 'reportingmonth') {
        const month = monthNumber(value);
        return month ? `month:${month}` : `month:${identity(value)}`;
      }
      if (normalizedColumn === 'year' || normalizedColumn === 'fiscalyear') {
        const year = yearNumber(value);
        return year ? `year:${year}` : `year:${identity(value)}`;
      }
      if (normalizedColumn === 'type' || normalizedColumn === 'salestype') {
        return canonicalType(value).toLocaleLowerCase('en-US');
      }
      return identity(value);
    }

    function matchesSelected(column, rowValue, selectedValues) {
      if (!selectedValues.length) return true;
      const rowIdentity = filterIdentity(column, rowValue);
      return selectedValues.some(value => filterIdentity(column, value) === rowIdentity);
    }

    function historicalAmount(row) {
      const actual = numericValue(row.__actual);
      const ly = numericValue(row.__ly);
      return Math.abs(actual) > 1e-9 ? actual : ly;
    }

    filteredLY = function () {
      const selectedYears = getSelected('yearFilter');
      const availableYears = rawData
        .map(row => yearNumber(row.Year))
        .filter(Number.isFinite)
        .filter(Boolean);
      const latestAvailableYear = availableYears.length ? Math.max(...availableYears) : 0;
      const baseYears = (selectedYears.length ? selectedYears : [latestAvailableYear])
        .map(yearNumber)
        .filter(Boolean);
      const lyYears = new Set(baseYears.map(year => year - 1));

      return rawData.filter(row => {
        if (!lyYears.has(yearNumber(row.Year))) return false;
        return salesFilterIds
          .filter(id => id !== 'yearFilter')
          .every(id => {
            const selected = getSelected(id);
            const column = $(id)?.dataset.column || '';
            return matchesSelected(column, row[column], selected);
          });
      });
    };

    aggregate = function (rows, dimension, lySource = filteredLY()) {
      const grouped = new Map();

      const ensureGroup = row => {
        const displayName = dimKey(row, dimension);
        const key = identity(displayName);
        if (!grouped.has(key)) {
          grouped.set(key, {
            name: displayName,
            actual: 0,
            budget: 0,
            ly: 0,
            lyFallback: 0,
            lyRows: 0,
            lyNonZero: false,
            actualFoc: 0,
            budgetFoc: 0,
            products: new Set()
          });
        }
        return grouped.get(key);
      };

      for (const row of rows || []) {
        const group = ensureGroup(row);
        group.actual += numericValue(row.__actual);
        group.budget += numericValue(row.__budget);
        group.lyFallback += numericValue(row.__ly);
        group.products.add(identity(row.__product));
        if (canonicalType(row.Type) === 'IMS') {
          group.actualFoc += numericValue(row.__actualBonus);
          group.budgetFoc += numericValue(row.__budgetBonus);
        }
      }

      for (const row of lySource || []) {
        const group = ensureGroup(row);
        const amount = historicalAmount(row);
        group.lyRows += 1;
        group.ly += amount;
        if (Math.abs(amount) > 1e-9) group.lyNonZero = true;
        group.products.add(identity(row.__product));
      }

      grouped.forEach(group => {
        if (!group.lyRows || (!group.lyNonZero && Math.abs(group.lyFallback) > 1e-9)) {
          group.ly = group.lyFallback;
        }
        delete group.lyFallback;
        delete group.lyRows;
        delete group.lyNonZero;
      });

      return [...grouped.values()];
    };
  }

  window.canonicalizeSalesRows = function canonicalizeSalesRows(rows) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const datasetYear = detectedDatasetYear(sourceRows);
    const maps = Object.fromEntries(dimensions.map(dimension => [
      dimension.name,
      buildCanonicalMap(sourceRows, dimension.name)
    ]));

    const normalizedRows = sourceRows.map(row => {
      const normalizedRow = { ...(row || {}) };

      dimensions.forEach(dimension => {
        const keys = matchingKeys(normalizedRow, dimension.name);
        keys.forEach(key => {
          const current = cleanDisplay(normalizedRow[key]);
          if (!current) return;
          normalizedRow[key] = dimension.name === 'type'
            ? canonicalType(current)
            : maps[dimension.name].get(identity(current)) || current;
        });

        const standardKey = standardKeys[dimension.name];
        if (standardKey && (normalizedRow[standardKey] === undefined || normalizedRow[standardKey] === '')) {
          const value = keys.length ? normalizedRow[keys[0]] : '';
          if (value !== '') {
            normalizedRow[standardKey] = dimension.name === 'type'
              ? canonicalType(value)
              : value;
          }
        }
      });

      if (normalizedRow.Type !== undefined) normalizedRow.Type = canonicalType(normalizedRow.Type);

      const yearValue = firstMatchingValue(normalizedRow, yearAliasSet);
      if (yearValue !== '') {
        matchingAliasKeys(normalizedRow, yearAliasSet).forEach(key => {
          normalizedRow[key] = canonicalYear(normalizedRow[key]);
        });
        normalizedRow.Year = canonicalYear(yearValue);
      }

      const monthValue = firstMatchingValue(normalizedRow, monthAliasSet);
      if (monthValue !== '') {
        matchingAliasKeys(normalizedRow, monthAliasSet).forEach(key => {
          normalizedRow[key] = canonicalMonth(normalizedRow[key]);
        });
        normalizedRow.Month = canonicalMonth(monthValue);
      }

      standardizeSalesMetrics(normalizedRow, datasetYear);
      return normalizedRow;
    });

    const priorYear = datasetYear ? datasetYear - 1 : 0;
    const tmsRows = normalizedRows.filter(row => canonicalType(row.Type) === 'TMS');
    const tmsPriorRows = tmsRows.filter(row => yearNumber(row.Year) === priorYear);
    window.BR_SALES_LY_DIAGNOSTICS = {
      version: FIX_VERSION,
      datasetYear,
      rows: normalizedRows.length,
      tmsRows: tmsRows.length,
      rowsWithLy: normalizedRows.filter(row => Math.abs(numericValue(row.LY)) > 1e-9).length,
      priorYearRows: normalizedRows.filter(row => yearNumber(row.Year) === priorYear).length,
      tmsPriorYearRows: tmsPriorRows.length,
      tmsPriorYearValue: tmsPriorRows.reduce((total, row) => total + numericValue(row['Actual Value']), 0),
      tmsEmbeddedLyValue: tmsRows.reduce((total, row) => total + numericValue(row.LY), 0)
    };

    installSalesLyRuntimeFix();
    return normalizedRows;
  };

  installSalesLyRuntimeFix();
})();
