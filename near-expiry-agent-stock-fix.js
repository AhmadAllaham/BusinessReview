(() => {
  'use strict';

  // Keep the displayed rows limited to items with Nearly Expired exposure,
  // while calculating Agent Stock Qty and total Exposure % from every stock
  // item in the current country / agent / item filter scope.
  if (typeof nearExpiryAggregateRows !== 'function') return;

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

    // allRows retains stock-only items so their Agent Stock Qty remains in
    // the denominator even when those items are hidden from the report.
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
})();
