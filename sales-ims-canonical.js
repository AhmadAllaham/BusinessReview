(() => {
  'use strict';

  if (window.canonicalizeSalesRows) return;

  const dimensions = [
    {
      name: 'type',
      aliases: ['Type', 'Sales Type', 'SalesType']
    },
    {
      name: 'country',
      aliases: ['Country', 'Market', 'Country Name', 'CountryName']
    },
    {
      name: 'sector',
      aliases: ['Sector']
    },
    {
      name: 'agent',
      aliases: ['Agent', 'Distributor', 'Customer']
    },
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

  function typeValue(row) {
    for (const key of matchingKeys(row, 'type')) {
      const value = cleanDisplay(row[key]);
      if (value) return value;
    }
    return '';
  }

  function isImsRow(row) {
    const normalized = identity(typeValue(row)).replace(/[^a-z0-9]+/g, '');
    return normalized === 'ims' || normalized.includes('imssales');
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

    if (dimensionName === 'type') {
      canonical.set('ims', 'IMS');
      canonical.set('tms', 'TMS');
    }

    return canonical;
  }

  function installSalesLyRuntimeFix() {
    if (window.__salesLyRuntimeFixInstalled) return;
    if (
      typeof filteredLY !== 'function' ||
      typeof aggregate !== 'function' ||
      typeof getSelected !== 'function'
    ) return;

    window.__salesLyRuntimeFixInstalled = true;
    const actualAliasSet = new Set([
      'actual','actualvalue','actualsales','actualsalesvalue'
    ]);

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
      return identity(value);
    }

    function matchesSelected(column, rowValue, selectedValues) {
      if (!selectedValues.length) return true;
      const rowIdentity = filterIdentity(column, rowValue);
      return selectedValues.some(value => filterIdentity(column, value) === rowIdentity);
    }

    function historicalAmount(row) {
      const hasExplicitActual = Object.keys(row || {}).some(key =>
        actualAliasSet.has(normalizeHeader(key)) &&
        row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== ''
      );
      return hasExplicitActual
        ? Number(row.__actual) || 0
        : Number(row.__ly) || Number(row.__actual) || 0;
    }

    filteredLY = function () {
      const selectedYears = getSelected('yearFilter');
      const availableYears = rawData
        .map(row => yearNumber(row.Year))
        .filter(Number.isFinite)
        .filter(Boolean);
      const baseYears = (selectedYears.length ? selectedYears : [Math.max(...availableYears)])
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
      const historicalGroups = new Set();

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
            actualFoc: 0,
            budgetFoc: 0,
            products: new Set()
          });
        }
        return { key, value: grouped.get(key) };
      };

      for (const row of rows || []) {
        const group = ensureGroup(row).value;
        group.actual += Number(row.__actual) || 0;
        group.budget += Number(row.__budget) || 0;
        group.lyFallback += Number(row.__ly) || 0;
        group.products.add(identity(row.__product));
        if (identity(row.Type) === 'ims') {
          group.actualFoc += Number(row.__actualBonus) || 0;
          group.budgetFoc += Number(row.__budgetBonus) || 0;
        }
      }

      for (const row of lySource || []) {
        const { key, value: group } = ensureGroup(row);
        historicalGroups.add(key);
        group.ly += historicalAmount(row);
        group.products.add(identity(row.__product));
      }

      grouped.forEach((group, key) => {
        if (!historicalGroups.has(key)) group.ly = group.lyFallback;
        delete group.lyFallback;
      });

      return [...grouped.values()];
    };
  }

  window.canonicalizeSalesRows = function canonicalizeSalesRows(rows) {
    const sourceRows = Array.isArray(rows) ? rows : [];
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
          normalizedRow[key] = maps[dimension.name].get(identity(current)) || current;
        });

        const standardKey = standardKeys[dimension.name];
        if (standardKey && (normalizedRow[standardKey] === undefined || normalizedRow[standardKey] === '')) {
          const value = keys.length ? normalizedRow[keys[0]] : '';
          if (value !== '') normalizedRow[standardKey] = value;
        }
      });

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

      return normalizedRow;
    });

    installSalesLyRuntimeFix();
    return normalizedRows;
  };

  installSalesLyRuntimeFix();
})();
