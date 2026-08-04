(() => {
  'use strict';

  if (window.__smJuneMonthFixInstalled) return;
  window.__smJuneMonthFixInstalled = true;

  // Keep the Reporting Month filter available to the report logic, but hide
  // it from the S&M interface. The latest actual month remains selected
  // automatically, while users can continue filtering by country.
  function hideSmReportingMonthFilter() {
    const monthFilter = document.getElementById('smSimpleMonthFilter');
    const filterWrapper = monthFilter?.closest('.filter');
    if (!filterWrapper) return;

    filterWrapper.hidden = true;
    filterWrapper.setAttribute('aria-hidden', 'true');
    filterWrapper.dataset.smMonthFilterHidden = 'true';

    const grid = filterWrapper.closest('.sm-filters-grid');
    if (grid) grid.dataset.smMonthFilterHidden = 'true';
  }

  hideSmReportingMonthFilter();

  // Legacy S&M uploads created before the calendar-date fix stored 1 June as
  // 31 May. Correct only that known shifted month boundary while reading the
  // existing Firestore rows, so no data re-upload is required.
  const correctLegacyJuneDate = value => {
    if (value === null || value === undefined || value === '') return value;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const year = value.getUTCFullYear();
      const month = value.getUTCMonth() + 1;
      const day = value.getUTCDate();
      return month === 5 && day === 31
        ? new Date(Date.UTC(year, 5, 1, 12))
        : value;
    }

    const text = String(value).trim();
    const match = text.match(/^(\d{4})-05-31(?:(T|\s).*)?$/);
    return match ? `${match[1]}-06-01` : value;
  };

  if (typeof smSimpleDate === 'function') {
    const originalDate = smSimpleDate;
    smSimpleDate = value => originalDate(correctLegacyJuneDate(value));
  }

  if (typeof smSimpleNormalize === 'function') {
    const originalNormalize = smSimpleNormalize;
    smSimpleNormalize = raw => {
      const normalized = originalNormalize(raw);
      if (!normalized || typeof normalized !== 'object') return normalized;
      return {
        ...normalized,
        Date: correctLegacyJuneDate(normalized.Date)
      };
    };
  }

  if (typeof smSimpleMonthKey === 'function') {
    const originalMonthKey = smSimpleMonthKey;
    smSimpleMonthKey = row => originalMonthKey({
      ...(row || {}),
      Date: correctLegacyJuneDate(row?.Date)
    });
  }

  // Re-apply after report modules finish initializing, in case the filter
  // controls were rebuilt while Firestore rows were loading.
  window.requestAnimationFrame(hideSmReportingMonthFilter);
})();
