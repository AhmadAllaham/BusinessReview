(() => {
  'use strict';

  if (document.getElementById('business-review-readability-style')) return;

  const style = document.createElement('style');
  style.id = 'business-review-readability-style';
  style.textContent = `
    /* Slightly larger typography for on-screen reporting. */
    #salesTable tbody td,
    #focTable tbody td,
    #countryDetailTable.sales-statement-detail tbody td,
    #countryDetailTable.foc-statement-detail tbody td,
    .stock-statement-table tbody td,
    .near-expiry-table tbody td,
    #smSimpleTable tbody td,
    #pnlTable tbody td,
    #actualGpTable tbody td,
    .actual-gp-table tbody td {
      font-size: 15px !important;
      line-height: 1.4 !important;
    }

    #salesTable thead th,
    #focTable thead th,
    #countryDetailTable.sales-statement-detail thead th,
    #countryDetailTable.foc-statement-detail thead th,
    .stock-statement-table thead th,
    .near-expiry-table thead th,
    #smSimpleTable thead th,
    #pnlTable thead th,
    #actualGpTable thead th,
    .actual-gp-table thead th {
      font-size: 14px !important;
      line-height: 1.25 !important;
    }

    #salesTable thead .sales-statement-sub-head th,
    #focTable thead .foc-statement-sub-head th,
    #countryDetailTable .sales-statement-sub-head th,
    #countryDetailTable .foc-statement-sub-head th,
    .stock-statement-table thead .stock-statement-sub-head th,
    .near-expiry-table thead .near-expiry-sub-head th,
    #smSimpleTable thead .sm-statement-column-head th,
    #pnlTable thead .pnl-sub-head th {
      font-size: 12px !important;
    }

    .table-toolbar,
    .modal-toolbar,
    .view-control label,
    .filter label,
    .multi-filter-btn,
    .pnl-view-switch button,
    .pnl-currency-switch button,
    .excel-export-btn,
    .management-view-btn,
    .sm-spotlight-btn {
      font-size: 13px !important;
    }

    .report-head h2,
    .filter-card-head h2,
    .modal-head h2 {
      font-size: 23px !important;
    }

    /* Presentation and Spotlight modes need stronger visibility from distance. */
    body.performance-table-spotlight table tbody td,
    body.sm-table-spotlight #smSimpleTable tbody td,
    body.pnl-table-spotlight #pnlTable tbody td,
    .management-table-stage tbody td {
      font-size: 17px !important;
      line-height: 1.45 !important;
    }

    body.performance-table-spotlight table thead th,
    body.sm-table-spotlight #smSimpleTable thead th,
    body.pnl-table-spotlight #pnlTable thead th,
    .management-table-stage thead th {
      font-size: 15px !important;
    }

    .management-heading h2 {
      font-size: 25px !important;
    }

    .management-kpi strong,
    .management-focus-card strong {
      font-size: 27px !important;
    }

    @media (max-width: 700px) {
      #salesTable tbody td,
      #focTable tbody td,
      .stock-statement-table tbody td,
      .near-expiry-table tbody td,
      #smSimpleTable tbody td,
      #pnlTable tbody td,
      #actualGpTable tbody td,
      .actual-gp-table tbody td {
        font-size: 13px !important;
      }

      #salesTable thead th,
      #focTable thead th,
      .stock-statement-table thead th,
      .near-expiry-table thead th,
      #smSimpleTable thead th,
      #pnlTable thead th,
      #actualGpTable thead th,
      .actual-gp-table thead th {
        font-size: 12px !important;
      }
    }
  `;

  document.head.appendChild(style);
})();
