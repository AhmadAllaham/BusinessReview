(() => {
  'use strict';

  function stockCountryIdentity(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g,'');
  }

  function canonicalStockCountry(value) {
    const raw = String(value ?? '').trim().replace(/\s+/g,' ');
    if (!raw) return '';

    let standardized = raw;
    if (typeof window.BRCanonicalCountry === 'function') {
      try {
        standardized = String(window.BRCanonicalCountry(raw) || raw)
          .trim()
          .replace(/\s+/g,' ');
      } catch (_) {
        standardized = raw;
      }
    }

    const key = stockCountryIdentity(standardized);
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

    return standardized
      .toLocaleLowerCase('en-US')
      .replace(/(^|[\s/-])([a-z])/g,(_,separator,letter) =>
        `${separator}${letter.toLocaleUpperCase('en-US')}`
      );
  }

  function normalizeProfile(profile) {
    if (!profile || typeof profile !== 'object') return profile;

    const rawCountries = profile.countries;
    const countries = Array.isArray(rawCountries)
      ? rawCountries
      : rawCountries == null || rawCountries === ''
        ? []
        : [rawCountries];

    const activeValue = String(profile.active ?? 'true')
      .trim()
      .toLocaleLowerCase('en-US');

    return {
      ...profile,
      role:String(profile.role || 'user').trim().toLocaleLowerCase('en-US'),
      active:profile.active === false || activeValue === 'false' ? false : true,
      countries:[...new Set(countries
        .map(country => String(country ?? '').trim())
        .filter(Boolean))]
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

  function installStockCountryMerge() {
    const originalLoader = window.loadStockRowsFromDatabase;
    if (
      typeof originalLoader !== 'function' ||
      originalLoader.__stockCountryCaseMerged
    ) return;

    const wrappedLoader = function (rows,...rest) {
      const normalizedRows = (Array.isArray(rows) ? rows : []).map(row => {
        const next = { ...(row || {}) };
        const countryKey = Object.keys(next).find(key =>
          ['country','countryname','market'].includes(stockCountryIdentity(key))
        );
        if (countryKey) next[countryKey] = canonicalStockCountry(next[countryKey]);
        if (Object.prototype.hasOwnProperty.call(next,'Country')) {
          next.Country = canonicalStockCountry(next.Country);
        }
        return next;
      });
      return originalLoader.call(this,normalizedRows,...rest);
    };

    wrappedLoader.__stockCountryCaseMerged = true;
    window.loadStockRowsFromDatabase = wrappedLoader;
    window.BRCanonicalStockCountry = canonicalStockCountry;
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
  installStockCountryMerge();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',installTestLink,{once:true});
  } else {
    installTestLink();
  }
})();
