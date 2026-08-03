(() => {
  'use strict';

  // Keep stock calculation support for compatibility with the uploaded data,
  // but remove Agent Stock Qty and Exposure % from all Nearly Expired tables.
  if (typeof nearExpiryAggregateRows === 'function') {
    nearExpiryAggregateRows = function (rows, key, fallback) {
      const grouped = new Map();

      (rows || []).forEach(row => {
        const name = String(row[key] || fallback).trim() || fallback;
        if (!grouped.has(name)) {
          grouped.set(name, {
            name,
            agentStockQty: 0,
            withinSixQty: 0,
            sixPlusQty: 0,
            withinSixValue: 0,
            sixPlusValue: 0
          });
        }

        const item = grouped.get(name);
        item.agentStockQty += Number(row.__agentStockQty) || 0;
        item.withinSixQty += Number(row.__withinSixQty) || 0;
        item.sixPlusQty += Number(row.__sixPlusQty) || 0;
        item.withinSixValue += Number(row.__withinSixValue) || 0;
        item.sixPlusValue += Number(row.__sixPlusValue) || 0;
      });

      const enrich = item => {
        const totalQty = item.withinSixQty + item.sixPlusQty;
        const totalValue = item.withinSixValue + item.sixPlusValue;
        return {
          ...item,
          totalQty,
          totalValue,
          unitPrice: totalQty ? totalValue / totalQty : 0,
          exposure: item.agentStockQty ? totalQty / item.agentStockQty : null
        };
      };

      const allRows = [...grouped.values()].map(enrich);
      const data = allRows
        .filter(item => item.totalQty !== 0)
        .sort((a, b) => b.totalValue - a.totalValue);

      const totals = enrich(allRows.reduce((total, row) => ({
        name: 'Total',
        agentStockQty: total.agentStockQty + row.agentStockQty,
        withinSixQty: total.withinSixQty + row.withinSixQty,
        sixPlusQty: total.sixPlusQty + row.sixPlusQty,
        withinSixValue: total.withinSixValue + row.withinSixValue,
        sixPlusValue: total.sixPlusValue + row.sixPlusValue
      }), {
        agentStockQty: 0,
        withinSixQty: 0,
        sixPlusQty: 0,
        withinSixValue: 0,
        sixPlusValue: 0
      }));

      return { data, totals };
    };
  }

  if (typeof nearExpiryTableHtml === 'function') {
    nearExpiryTableHtml = function (
      rows,
      totals,
      dimension = 'Market',
      clickable = false,
      showUnitPrice = false
    ) {
      const indexOffset = showUnitPrice ? 1 : 0;
      const makeRow = (row, total = false) => `<tr${total ? ' class="total-row"' : ''}>
        <td>${clickable && !total
          ? `<button class="stock-drill-button" type="button" data-near-expiry-drill="${esc(row.name)}">${esc(row.name)}</button>`
          : esc(row.name)}</td>
        ${showUnitPrice ? `<td>${total ? '—' : nearExpiryMoney(row.unitPrice, 2)}</td>` : ''}
        <td class="near-expiry-within">${nearExpiryQty(row.withinSixQty)}</td>
        <td class="near-expiry-within">${nearExpiryMoney(row.withinSixValue)}</td>
        <td class="near-expiry-plus">${nearExpiryQty(row.sixPlusQty)}</td>
        <td class="near-expiry-plus">${nearExpiryMoney(row.sixPlusValue)}</td>
        <td>${nearExpiryQty(row.totalQty)}</td>
        <td class="near-expiry-total-value">${nearExpiryMoney(row.totalValue)}</td>
      </tr>`;

      const columns = showUnitPrice ? 8 : 7;
      return `<colgroup>
        <col style="width:${showUnitPrice ? '300' : '220'}px">
        ${showUnitPrice ? '<col style="width:115px">' : ''}
        <col style="width:120px"><col style="width:145px">
        <col style="width:120px"><col style="width:145px">
        <col style="width:130px"><col style="width:155px">
      </colgroup>
      <thead>
        <tr class="near-expiry-group-head">
          <th rowspan="2" data-sort-index="0">${esc(dimension)}</th>
          ${showUnitPrice
            ? `<th rowspan="2" data-sort-index="1">Unit Price (${nearExpiryCurrency})</th>`
            : ''}
          <th colspan="2" data-no-sort="true" class="near-expiry-within-head">Nearly Expired Goods · Within 6M</th>
          <th colspan="2" data-no-sort="true" class="near-expiry-plus-head">Nearly Expired · 6M+</th>
          <th colspan="2" data-no-sort="true">Total Exposure</th>
        </tr>
        <tr class="near-expiry-sub-head">
          <th data-sort-index="${1 + indexOffset}">Quantity</th>
          <th data-sort-index="${2 + indexOffset}">Value (${nearExpiryCurrency})</th>
          <th data-sort-index="${3 + indexOffset}">Quantity</th>
          <th data-sort-index="${4 + indexOffset}">Value (${nearExpiryCurrency})</th>
          <th data-sort-index="${5 + indexOffset}">Total Qty</th>
          <th data-sort-index="${6 + indexOffset}">Total Value (${nearExpiryCurrency})</th>
        </tr>
      </thead>
      <tbody>${(rows || []).map(row => makeRow(row)).join('')}${rows?.length
        ? makeRow(totals, true)
        : `<tr><td colspan="${columns}" class="stock-empty">No Nearly Expired items match the selected filters.</td></tr>`}
      </tbody>`;
    };
  }

  document.querySelectorAll('.near-expiry-formula').forEach(element => element.remove());

  // S&M dates were previously stored with toISOString(). In Jordan, a date
  // such as 1 June at local midnight became 31 May 21:00 UTC. Read timestamps
  // as local calendar dates so the reporting month remains June.
  const padDatePart = value => String(value).padStart(2, '0');

  function smCalendarParts(value) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate()
      };
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const decoded = window.XLSX?.SSF?.parse_date_code?.(value);
      if (decoded?.y && decoded?.m && decoded?.d) {
        return { year: decoded.y, month: decoded.m, day: decoded.d };
      }
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate()
      };
    }

    const text = String(value).trim();
    const dateOnly = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dateOnly) {
      return {
        year: Number(dateOnly[1]),
        month: Number(dateOnly[2]),
        day: Number(dateOnly[3])
      };
    }

    const regional = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (regional) {
      const year = Number(regional[3]) < 100
        ? 2000 + Number(regional[3])
        : Number(regional[3]);
      return {
        year,
        month: Number(regional[2]),
        day: Number(regional[1])
      };
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate()
    };
  }

  function smCalendarDate(value) {
    const parts = smCalendarParts(value);
    return parts
      ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
      : null;
  }

  if (typeof smSimpleDate === 'function') {
    smSimpleDate = smCalendarDate;
  }

  if (typeof smSimpleNormalize === 'function') {
    smSimpleNormalize = function (raw) {
      const get = name => {
        const key = Object.keys(raw || {}).find(item =>
          String(item).trim().toLowerCase() === name.toLowerCase()
        );
        return key === undefined ? '' : raw[key];
      };
      const parts = smCalendarParts(get('Date'));
      return {
        Expense: String(get('Expense') || '').trim(),
        Country: String(get('Country') || '').trim(),
        Period: String(get('Period') || '').trim(),
        Date: parts
          ? `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`
          : '',
        Amount: smSimpleAmount(get('Amount'))
      };
    };
  }

  if (typeof smSimpleMonthKey === 'function') {
    smSimpleMonthKey = function (row) {
      const parts = smCalendarParts(row?.Date);
      return parts
        ? `${parts.year}-${padDatePart(parts.month)}`
        : '';
    };
  }
})();
