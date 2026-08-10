(function () {
  'use strict';

  const STORAGE_PREFIX = 'businessReview.filterPreferences.v1';
  const FILTER_SELECTOR = '.multi-filter[id]';
  const RESET_SELECTOR = [
    '#resetBtn',
    '#stockResetBtn',
    '#nearExpiryResetBtn',
    '#smSimpleFilterResetBtn',
    '#pnlResetBtn',
    '#clearAllActiveFilters',
    '.active-filter-chip',
    '.select-visible',
    '.clear-selection',
    '.all-option input'
  ].join(',');

  let storageKey = '';
  let savedFilters = {};
  let restoreQueued = false;
  let restoring = false;
  const restoredFilterIds = new Set();

  function normalizeValues(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(String))];
  }

  function sameValues(left, right) {
    const a = normalizeValues(left).sort();
    const b = normalizeValues(right).sort();
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function readSavedFilters() {
    if (!storageKey) return {};
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeSavedFilters() {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedFilters));
    } catch (_) {
      // The report remains usable when browser storage is unavailable.
    }
  }

  function availableValues(filter) {
    return [...filter.querySelectorAll('.multi-options input')]
      .map(input => String(input.value));
  }

  function snapshotFilters() {
    if (!storageKey || restoring) return;
    document.querySelectorAll(FILTER_SELECTOR).forEach(filter => {
      if (typeof filter._getSelected !== 'function') return;
      savedFilters[filter.id] = normalizeValues(filter._getSelected());
    });
    writeSavedFilters();
  }

  function restoreFilter(filter) {
    if (restoredFilterIds.has(filter.id)) return;
    if (!filter.id || !Object.prototype.hasOwnProperty.call(savedFilters, filter.id)) return;
    if (typeof filter._getSelected !== 'function' || typeof filter._setSelected !== 'function') return;

    const desired = normalizeValues(savedFilters[filter.id]);
    const options = availableValues(filter);

    // Wait until asynchronous Firestore data has populated this filter.
    if (desired.length && !options.length) return;

    const optionSet = new Set(options);
    const allowed = desired.filter(value => optionSet.has(value));

    // A saved value may no longer be available because the dataset or the
    // user's country permissions changed. Never force an unavailable value.
    if (desired.length && !allowed.length) return;

    const current = normalizeValues(filter._getSelected());
    if (sameValues(current, allowed)) {
      restoredFilterIds.add(filter.id);
      return;
    }

    filter._setSelected(allowed);
    if (typeof filter._applySelection === 'function') filter._applySelection();
    restoredFilterIds.add(filter.id);
  }

  function restoreAllFilters() {
    if (!storageKey || restoring) return;
    restoring = true;
    try {
      document.querySelectorAll(FILTER_SELECTOR).forEach(restoreFilter);
    } finally {
      restoring = false;
    }
  }

  function queueRestore() {
    if (!storageKey || restoreQueued) return;
    restoreQueued = true;
    requestAnimationFrame(() => {
      restoreQueued = false;
      restoreAllFilters();
    });
  }

  function startForUser(user) {
    if (!user) return;
    const nextKey = `${STORAGE_PREFIX}.${user.uid}`;
    if (storageKey === nextKey) return;
    storageKey = nextKey;
    savedFilters = readSavedFilters();
    restoredFilterIds.clear();
    queueRestore();

    // Some report filters are created only after their Firestore dataset loads.
    let attempts = 0;
    const retry = setInterval(() => {
      queueRestore();
      attempts += 1;
      if (attempts >= 20) clearInterval(retry);
    }, 500);
  }

  document.addEventListener('change', event => {
    if (event.target.closest(FILTER_SELECTOR)) snapshotFilters();
  });

  document.addEventListener('click', event => {
    if (!event.target.closest(RESET_SELECTOR)) return;
    setTimeout(snapshotFilters, 0);
  });

  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'childList')) queueRestore();
  });

  function init() {
    observer.observe(document.body, { childList: true, subtree: true });
    if (window.firebase && typeof firebase.auth === 'function') {
      firebase.auth().onAuthStateChanged(startForUser);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

// Soft neon treatment for every Show GP% toggle. Keep the inactive state subtle
// and make the enabled/active state more visible without changing button behavior.
(function installShowGpGlow() {
  if (document.getElementById('show-gp-glow-style')) return;
  const style = document.createElement('style');
  style.id = 'show-gp-glow-style';
  style.textContent = `
    .gp-toggle-btn {
      border-color: rgba(33,143,130,.50) !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.08),
        0 0 10px rgba(33,143,130,.15),
        0 0 20px rgba(23,105,168,.07) !important;
      transition: background .18s ease, color .18s ease, border-color .18s ease,
                  box-shadow .18s ease, transform .18s ease, opacity .18s ease !important;
    }

    .gp-toggle-btn:hover:not(:disabled) {
      border-color: rgba(33,143,130,.72) !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.14),
        0 0 14px rgba(33,143,130,.24),
        0 0 28px rgba(23,105,168,.10) !important;
      transform: translateY(-1px);
    }

    .gp-toggle-btn.active,
    .gp-toggle-btn[aria-pressed="true"] {
      border-color: rgba(77,211,194,.82) !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.20),
        0 0 16px rgba(33,143,130,.34),
        0 0 32px rgba(23,105,168,.14),
        inset 0 0 10px rgba(255,255,255,.05) !important;
    }

    .gp-toggle-btn:disabled {
      opacity: .56 !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.06),
        0 0 8px rgba(33,143,130,.11),
        0 0 16px rgba(23,105,168,.05) !important;
    }

    html.br-night-mode .gp-toggle-btn {
      border-color: rgba(71,202,187,.50) !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.12),
        0 0 12px rgba(33,143,130,.22),
        0 0 24px rgba(23,105,168,.11) !important;
    }

    html.br-night-mode .gp-toggle-btn:hover:not(:disabled),
    html.br-night-mode .gp-toggle-btn.active,
    html.br-night-mode .gp-toggle-btn[aria-pressed="true"] {
      border-color: rgba(82,222,204,.86) !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.20),
        0 0 16px rgba(33,143,130,.38),
        0 0 34px rgba(23,105,168,.18),
        inset 0 0 12px rgba(33,143,130,.06) !important;
    }

    @media (prefers-reduced-motion: reduce) {
      .gp-toggle-btn:hover:not(:disabled) { transform: none !important; }
    }
  `;
  document.head.appendChild(style);
})();
