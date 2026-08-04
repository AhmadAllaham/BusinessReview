(() => {
  'use strict';

  // Actual GP vs Budget GP is retired. This lightweight runtime now also
  // standardizes every Saudi country-name variation to one display name: KSA.
  const RETIRED_REPORT_KEY = 'actualGp';
  const access = window.BRReportAccess;

  const normalizeIdentity = value => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '');

  const saudiAliases = new Set([
    'ksa',
    'saudi',
    'saudiarabia',
    'kingdomofsaudiarabia',
    'kingdomofsaudi',
    'saudiarabian',
    'السعودية',
    'المملكةالعربيةالسعودية'
  ]);

  const countryFieldAliases = new Set([
    'country',
    'countryname',
    'market',
    'marketname',
    'salescountry',
    'salesmarket',
    'stockcountry',
    'countrymarket'
  ]);

  function canonicalCountry(value) {
    const display = String(value ?? '').normalize('NFKC').trim();
    const identity = normalizeIdentity(display);
    if (!identity) return display;
    if (saudiAliases.has(identity) || identity.includes('saudi')) return 'KSA';
    return display;
  }

  function canonicalizeCountries(values = []) {
    return [...new Set(
      (values || [])
        .map(canonicalCountry)
        .map(value => String(value || '').trim())
        .filter(Boolean)
    )];
  }

  function canonicalizeRow(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    let changed = false;
    const next = { ...row };

    Object.keys(next).forEach(key => {
      if (!countryFieldAliases.has(normalizeIdentity(key))) return;
      const canonical = canonicalCountry(next[key]);
      if (canonical !== next[key]) {
        next[key] = canonical;
        changed = true;
      }
    });

    return changed ? next : row;
  }

  function canonicalizeRows(rows) {
    return Array.isArray(rows) ? rows.map(canonicalizeRow) : rows;
  }

  window.BRCanonicalCountry = canonicalCountry;
  window.BRCanonicalizeCountries = canonicalizeCountries;
  window.BRCanonicalizeCountryRows = canonicalizeRows;

  function wrapLoader(loader) {
    if (typeof loader !== 'function' || loader.__ksaCountryWrapped) return loader;
    const wrapped = function (rows, ...rest) {
      return loader.call(this, canonicalizeRows(rows), ...rest);
    };
    wrapped.__ksaCountryWrapped = true;
    return wrapped;
  }

  [
    'loadSalesRowsFromDatabase',
    'loadPnlRowsFromDatabase',
    'loadSmRowsFromDatabase',
    'loadStockRowsFromDatabase',
    'loadNearlyExpiredRowsFromDatabase',
    'loadProfitabilityRowsFromDatabase'
  ].forEach(name => {
    if (typeof window[name] === 'function') window[name] = wrapLoader(window[name]);
  });

  // Analysis is installed after this file. Intercept its loader assignment so
  // the executive dashboard receives the same canonical KSA data.
  let analysisLoader = wrapLoader(window.loadSalesAnalysisRows);
  try {
    Object.defineProperty(window, 'loadSalesAnalysisRows', {
      configurable: true,
      enumerable: true,
      get() {
        return analysisLoader;
      },
      set(loader) {
        analysisLoader = wrapLoader(loader);
      }
    });
  } catch (error) {
    console.error('Could not install KSA normalization for Analysis.', error);
  }

  // Expand Saudi permission aliases only for Firestore querying. The rows are
  // still displayed and grouped once under KSA after they are loaded.
  if (window.BRPortal?.requireSession && !window.BRPortal.__ksaSessionWrapped) {
    window.BRPortal.__ksaSessionWrapped = true;
    const originalRequireSession = window.BRPortal.requireSession.bind(window.BRPortal);
    window.BRPortal.requireSession = async function (options = {}) {
      const session = await originalRequireSession(options);
      if (!session?.profile) return session;

      const originalCountries = Array.isArray(session.profile.countries)
        ? session.profile.countries
        : [];
      const expandedCountries = [];

      originalCountries.forEach(country => {
        if (canonicalCountry(country) === 'KSA') {
          expandedCountries.push(
            'KSA',
            'Saudi',
            'Saudi Arabia',
            'Kingdom of Saudi Arabia',
            'Kingdom of Saudi'
          );
        } else {
          expandedCountries.push(country);
        }
      });

      return {
        ...session,
        profile: {
          ...session.profile,
          countries: [...new Set(expandedCountries)]
        }
      };
    };
  }

  function normalizeScopeLabel() {
    const element = document.getElementById('currentUserScope');
    if (!element) return;
    const text = String(element.textContent || '');
    const parts = text.split(' · ');
    if (parts.length < 2 || !parts[0].includes(',')) return;

    const countries = canonicalizeCountries(parts[0].split(','));
    const normalized = `${countries.join(', ')} · ${parts.slice(1).join(' · ')}`;
    if (normalized !== text) element.textContent = normalized;
  }

  const startScopeObserver = () => {
    normalizeScopeLabel();
    const element = document.getElementById('currentUserScope');
    if (!element) return;
    new MutationObserver(normalizeScopeLabel).observe(element, {
      childList: true,
      characterData: true,
      subtree: true
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startScopeObserver, { once:true });
  } else {
    startScopeObserver();
  }

  function removeRetiredUi() {
    document.querySelector('[data-tab="actualGpSection"]')?.remove();
    document.getElementById('actualGpSection')?.remove();
  }

  if (access) {
    const catalogIndex = access.catalog?.findIndex(item => item.key === RETIRED_REPORT_KEY) ?? -1;
    if (catalogIndex >= 0) access.catalog.splice(catalogIndex, 1);

    const keyIndex = access.allKeys?.indexOf(RETIRED_REPORT_KEY) ?? -1;
    if (keyIndex >= 0) access.allKeys.splice(keyIndex, 1);

    const originalResolve = access.resolve?.bind(access);
    if (originalResolve) {
      access.resolve = profile => originalResolve(profile)
        .filter(key => key !== RETIRED_REPORT_KEY);
    }

    const originalApply = access.apply?.bind(access);
    if (originalApply) {
      access.apply = profile => {
        const allowed = originalApply(profile)
          .filter(key => key !== RETIRED_REPORT_KEY);
        window.BR_ALLOWED_REPORTS = allowed;
        removeRetiredUi();
        return allowed;
      };
    }

    const originalHas = access.has?.bind(access);
    access.has = key => key === RETIRED_REPORT_KEY ? false : Boolean(originalHas?.(key));
    access.any = keys => (keys || []).some(key => access.has(key));
  }

  window.loadActualGpRows = undefined;
  removeRetiredUi();
})();
