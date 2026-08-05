(() => {
  'use strict';

  let displayCountries = [];
  const legacyAliasesByCountry = new Map();
  const KNOWN_QUERY_ALIASES = {
    KSA:[
      'KSA','Ksa','ksa','Saudi','SAUDI','saudi',
      'Saudi Arabia','SAUDI ARABIA','saudi arabia',
      'Kingdom of Saudi Arabia'
    ],
    UAE:['UAE','United Arab Emirates']
  };

  function countryIdentity(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g,'');
  }

  function canonicalCountry(value) {
    const raw = String(value ?? '').trim().replace(/\s+/g,' ');
    if (!raw) return '';

    const key = countryIdentity(raw);
    const known = {
      ksa:'KSA',
      saudi:'KSA',
      saudiarabia:'KSA',
      kingdomofsaudiarabia:'KSA',
      uae:'UAE',
      unitedarabemirates:'UAE',
      usa:'USA',
      unitedstates:'USA',
      unitedstatesofamerica:'USA',
      uk:'UK',
      unitedkingdom:'UK',
      gcc:'GCC',
      gcccommon:'GCC Common'
    };
    if (known[key]) return known[key];

    return raw
      .toLocaleLowerCase('en-US')
      .replace(/(^|[\s/-])([a-z])/g,(_,separator,letter) =>
        `${separator}${letter.toLocaleUpperCase('en-US')}`
      );
  }

  function rawCountryList(values) {
    const source = Array.isArray(values)
      ? values
      : values == null || values === ''
        ? []
        : [values];
    return [...new Set(source
      .map(value => String(value ?? '').trim())
      .filter(Boolean))];
  }

  function canonicalCountryList(values) {
    return [...new Set(rawCountryList(values)
      .map(canonicalCountry)
      .filter(Boolean))];
  }

  function rememberLegacyAliases(values) {
    legacyAliasesByCountry.clear();
    const rawCountries = rawCountryList(values);
    const canonicalCountries = canonicalCountryList(rawCountries);

    canonicalCountries.forEach(canonical => {
      const aliases = new Set([canonical,...(KNOWN_QUERY_ALIASES[canonical] || [])]);
      rawCountries
        .filter(raw => canonicalCountry(raw) === canonical)
        .forEach(raw => aliases.add(raw));
      legacyAliasesByCountry.set(canonical,aliases);
    });
  }

  function normalizeProfile(profile) {
    if (!profile || typeof profile !== 'object') return profile;

    rememberLegacyAliases(profile.countries);
    const canonicalCountries = canonicalCountryList(profile.countries);
    displayCountries = canonicalCountries;
    const activeValue = String(profile.active ?? 'true')
      .trim()
      .toLocaleLowerCase('en-US');

    return {
      ...profile,
      role:String(profile.role || 'user').trim().toLocaleLowerCase('en-US'),
      active:profile.active === false || activeValue === 'false' ? false : true,
      countries:canonicalCountries,
      __displayCountries:canonicalCountries
    };
  }

  function normalizeSession(session) {
    if (!session || typeof session !== 'object') return session;
    return { ...session, profile:normalizeProfile(session.profile) };
  }

  function installProfileCompatibility() {
    const portal = window.BRPortal;
    if (!portal || portal.__profileCompatibilityInstalled) return;

    ['requireSession','currentSession','waitForAuth'].forEach(methodName => {
      const original = portal[methodName];
      if (typeof original !== 'function') return;
      portal[methodName] = async function (...args) {
        return normalizeSession(await original.apply(this,args));
      };
    });

    if (typeof portal.getProfile === 'function') {
      const originalGetProfile = portal.getProfile;
      portal.getProfile = async function (...args) {
        return normalizeProfile(await originalGetProfile.apply(this,args));
      };
    }

    portal.__profileCompatibilityInstalled = true;
  }

  function mergedSnapshot(snapshots) {
    const documentMap = new Map();
    snapshots.forEach(snapshot => {
      (snapshot?.docs || []).forEach(doc => {
        const key = doc.ref?.path || doc.id;
        if (!documentMap.has(key)) documentMap.set(key,doc);
      });
    });
    const docs = [...documentMap.values()];
    return {
      docs,
      size:docs.length,
      empty:docs.length === 0,
      forEach(callback,thisArg) {
        docs.forEach(callback,thisArg);
      }
    };
  }

  function installLegacyCountryChunkReader() {
    const portal = window.BRPortal;
    const db = portal?.db;
    if (!db || db.__legacyCountryChunkReaderInstalled) return;

    const originalCollection = db.collection.bind(db);

    function wrapReportChunkQuery(query,constraints=[]) {
      return new Proxy(query,{
        get(target,property) {
          if (property === 'where') {
            return (field,operator,value) => wrapReportChunkQuery(
              target.where(field,operator,value),
              [...constraints,{field,operator,value}]
            );
          }

          if (property === 'get') {
            return async (...args) => {
              const countryConstraint = constraints.find(constraint =>
                constraint.field === 'country' &&
                constraint.operator === '=='
              );
              if (!countryConstraint) return target.get(...args);

              const canonical = canonicalCountry(countryConstraint.value);
              const aliases = [...(legacyAliasesByCountry.get(canonical) || [
                countryConstraint.value
              ])];
              if (aliases.length <= 1) return target.get(...args);

              const otherConstraints = constraints.filter(constraint =>
                constraint !== countryConstraint
              );
              const results = await Promise.allSettled(aliases.map(alias => {
                let aliasQuery = originalCollection('reportChunks');
                otherConstraints.forEach(constraint => {
                  aliasQuery = aliasQuery.where(
                    constraint.field,
                    constraint.operator,
                    constraint.value
                  );
                });
                return aliasQuery.where('country','==',alias).get(...args);
              }));

              const fulfilled = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);
              if (fulfilled.length) return mergedSnapshot(fulfilled);

              const firstFailure = results.find(result => result.status === 'rejected');
              throw firstFailure?.reason || new Error(
                `Unable to load ${canonical || countryConstraint.value} data.`
              );
            };
          }

          const value = Reflect.get(target,property,target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    }

    db.collection = function (collectionPath) {
      const reference = originalCollection(collectionPath);
      return collectionPath === 'reportChunks'
        ? wrapReportChunkQuery(reference)
        : reference;
    };

    db.__legacyCountryChunkReaderInstalled = true;
  }

  function normalizeCountryRow(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    const next = { ...row };
    Object.keys(next).forEach(key => {
      const normalizedKey = countryIdentity(key);
      if (['country','countryname','market','marketname'].includes(normalizedKey)) {
        next[key] = canonicalCountry(next[key]);
      }
    });
    return next;
  }

  function normalizeCountryRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(normalizeCountryRow);
  }

  function wrapRowLoader(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__countryCanonicalized) return;

    const wrapped = function (...args) {
      const normalizedArgs = args.map(value =>
        Array.isArray(value) ? normalizeCountryRows(value) : value
      );
      return original.apply(this,normalizedArgs);
    };
    wrapped.__countryCanonicalized = true;
    window[name] = wrapped;

    try {
      if (name === 'loadSalesRowsFromDatabase') loadSalesRowsFromDatabase = wrapped;
      if (name === 'loadSalesAnalysisRows') loadSalesAnalysisRows = wrapped;
      if (name === 'loadPnlRowsFromDatabase') loadPnlRowsFromDatabase = wrapped;
      if (name === 'loadSmRowsFromDatabase') loadSmRowsFromDatabase = wrapped;
      if (name === 'loadStockRowsFromDatabase') loadStockRowsFromDatabase = wrapped;
      if (name === 'loadNearlyExpiredRowsFromDatabase') loadNearlyExpiredRowsFromDatabase = wrapped;
      if (name === 'loadProfitabilityRowsFromDatabase') loadProfitabilityRowsFromDatabase = wrapped;
      if (name === 'loadActualGpRows') loadActualGpRows = wrapped;
    } catch (_) {}
  }

  function installAllCountryMerges() {
    [
      'loadSalesRowsFromDatabase',
      'loadSalesAnalysisRows',
      'loadPnlRowsFromDatabase',
      'loadSmRowsFromDatabase',
      'loadStockRowsFromDatabase',
      'loadNearlyExpiredRowsFromDatabase',
      'loadProfitabilityRowsFromDatabase',
      'loadActualGpRows'
    ].forEach(wrapRowLoader);

    window.BRCanonicalCountry = canonicalCountry;
    window.BRCanonicalStockCountry = canonicalCountry;
  }

  function installCountryScopeDisplay() {
    const update = () => {
      const scope = document.getElementById('currentUserScope');
      if (!scope || !displayCountries.length) return;
      const text = String(scope.textContent || '');
      const suffix = text.match(/·\s*(\d+)\s+windows\s*$/i);
      const next = suffix
        ? `${displayCountries.join(', ')} · ${suffix[1]} windows`
        : displayCountries.join(', ');
      if (scope.textContent !== next) scope.textContent = next;
    };

    update();
    const observer = new MutationObserver(update);
    const start = () => {
      const scope = document.getElementById('currentUserScope');
      if (scope) observer.observe(scope,{childList:true,subtree:true,characterData:true});
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded',start,{once:true});
    } else {
      start();
    }
  }

  async function installTestLink() {
    const session = await window.BRPortal?.currentSession?.();
    if (!session?.profile || session.profile.role !== 'admin') return;

    const submenu = document.getElementById('businessSubmenu');
    if (!submenu || submenu.querySelector('[data-sm-expense-test-link]')) return;

    const button = document.createElement('button');
    button.className = 'tab-btn';
    button.type = 'button';
    button.dataset.smExpenseTestLink = 'true';
    button.textContent = 'TEST';
    button.addEventListener('click',() => {
      location.href = 'test-v3.html';
    });

    const pnlButton = submenu.querySelector('[data-tab="pnlSection"]');
    submenu.insertBefore(button,pnlButton || null);
  }

  installProfileCompatibility();
  installLegacyCountryChunkReader();
  installAllCountryMerges();
  installCountryScopeDisplay();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',installTestLink,{once:true});
  } else {
    installTestLink();
  }
})();
