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

  function matchingKeys(row, dimensionName) {
    const aliases = aliasSets[dimensionName];
    return Object.keys(row || {}).filter(key => aliases.has(normalizeHeader(key)));
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

  window.canonicalizeSalesRows = function canonicalizeSalesRows(rows) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const maps = Object.fromEntries(dimensions.map(dimension => [
      dimension.name,
      buildCanonicalMap(sourceRows, dimension.name)
    ]));

    return sourceRows.map(row => {
      const normalizedRow = { ...(row || {}) };

      dimensions.forEach(dimension => {
        matchingKeys(normalizedRow, dimension.name).forEach(key => {
          const current = cleanDisplay(normalizedRow[key]);
          if (!current) return;
          normalizedRow[key] = maps[dimension.name].get(identity(current)) || current;
        });
      });

      return normalizedRow;
    });
  };
})();
