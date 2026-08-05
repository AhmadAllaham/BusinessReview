(() => {
  'use strict';

  if (window.__BR_LIGHT_COMPARISON_HEADERS__) return;
  window.__BR_LIGHT_COMPARISON_HEADERS__ = true;

  const style = document.createElement('style');
  style.id = 'br-light-comparison-headers-style';
  style.textContent = `
    html:not(.br-night-mode) :is(
      #salesTable thead .sales-statement-sub-head th,
      #focTable thead .foc-statement-sub-head th,
      #countryDetailTable.sales-statement-detail thead .sales-statement-sub-head th,
      #countryDetailTable.foc-statement-detail thead .foc-statement-sub-head th,
      #pnlTable thead .pnl-sub-head th,
      .stock-statement-table thead .stock-statement-sub-head th
    ){
      background:#0b3158 !important;
      color:#ffffff !important;
      border-top:1px solid #0b3158 !important;
      border-bottom:1px solid #0b3158 !important;
      border-right-color:#ffffff !important;
      font-weight:800 !important;
    }

    html:not(.br-night-mode) :is(
      #salesTable thead .sales-statement-sub-head th,
      #focTable thead .foc-statement-sub-head th,
      #countryDetailTable.sales-statement-detail thead .sales-statement-sub-head th,
      #countryDetailTable.foc-statement-detail thead .foc-statement-sub-head th,
      #pnlTable thead .pnl-sub-head th,
      .stock-statement-table thead .stock-statement-sub-head th
    )::after{
      color:rgba(255,255,255,.72) !important;
    }

    html:not(.br-night-mode) :is(
      #salesTable thead .sales-statement-sub-head th,
      #focTable thead .foc-statement-sub-head th,
      #countryDetailTable.sales-statement-detail thead .sales-statement-sub-head th,
      #countryDetailTable.foc-statement-detail thead .foc-statement-sub-head th,
      #pnlTable thead .pnl-sub-head th,
      .stock-statement-table thead .stock-statement-sub-head th
    ):hover{
      background:#123d68 !important;
    }
  `;
  document.head.appendChild(style);
})();
