(() => {
  'use strict';

  if (!window.XLSX?.utils?.sheet_to_json) return;

  const originalSheetToJson = window.XLSX.utils.sheet_to_json;

  function calendarDate(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return value;

    // Excel dates represent calendar days. Preserve the local calendar
    // components instead of using toISOString(), which can move midnight to
    // the previous UTC day in time zones such as Jordan.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function normalizeRow(row) {
    if (Array.isArray(row)) return row.map(calendarDate);
    if (!row || typeof row !== 'object') return row;
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, calendarDate(value)])
    );
  }

  window.XLSX.utils.sheet_to_json = function (...args) {
    const result = originalSheetToJson.apply(this, args);
    return Array.isArray(result) ? result.map(normalizeRow) : result;
  };
})();
