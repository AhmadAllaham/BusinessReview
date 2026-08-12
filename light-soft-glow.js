(() => {
  'use strict';

  if (window.__BR_LIGHT_SOFT_GLOW__) return;
  window.__BR_LIGHT_SOFT_GLOW__ = true;

  const style = document.createElement('style');
  style.id = 'br-light-soft-glow-style';
  style.textContent = `
    html:not(.br-night-mode){
      --br-light-glow:rgba(33,143,130,.12);
      --br-light-glow-soft:rgba(33,143,130,.07);
      --br-light-line:rgba(33,143,130,.18);
      --br-light-shadow:0 8px 24px rgba(22,75,82,.075),0 0 0 1px rgba(33,143,130,.035);
      --br-light-shadow-hover:0 12px 30px rgba(22,75,82,.10),0 0 0 1px rgba(33,143,130,.075);
    }

    html:not(.br-night-mode) body{
      background:
        radial-gradient(circle at 8% -5%,rgba(33,143,130,.055),transparent 26%),
        radial-gradient(circle at 96% 2%,rgba(22,112,101,.04),transparent 22%),
        var(--bg) !important;
    }

    html:not(.br-night-mode) :is(
      .app-header,
      .filter-card,
      .report-card,
      .variance-card,
      .analysis-card,
      .analysis-panel,
      .modal-panel,
      .management-card,
      .status-box,
      .active-filter-bar
    ){
      box-shadow:var(--br-light-shadow) !important;
      transition:box-shadow .2s ease,border-color .2s ease,transform .2s ease !important;
    }

    html:not(.br-night-mode) :is(
      .filter-card,
      .report-card,
      .variance-card,
      .analysis-card,
      .analysis-panel,
      .modal-panel,
      .management-card,
      .active-filter-bar
    ){
      border-color:color-mix(in srgb,var(--border) 78%,#218f82 22%) !important;
    }

    html:not(.br-night-mode) :is(
      .filter-card,
      .report-card,
      .variance-card,
      .analysis-card,
      .analysis-panel,
      .management-card
    ):hover{
      box-shadow:var(--br-light-shadow-hover) !important;
    }

    html:not(.br-night-mode) .app-header{
      box-shadow:0 8px 24px rgba(22,75,82,.07),0 1px 0 rgba(33,143,130,.08) !important;
    }

    html:not(.br-night-mode) .side-nav{
      box-shadow:8px 0 24px rgba(12,45,52,.10),inset -1px 0 0 rgba(89,199,184,.08) !important;
    }

    html:not(.br-night-mode) :is(
      .upload-btn,
      .reset-btn,
      .back-btn,
      .apply-selection,
      .excel-export-btn,
      .gp-toggle-btn,
      .sm-spotlight-btn,
      .management-tool-btn,
      .management-exit-btn,
      .pnl-currency-switch button,
      .performance-currency-switch button,
      .workspace-btn.active,
      .tab-btn.active
    ){
      box-shadow:0 5px 14px rgba(33,143,130,.13) !important;
      transition:box-shadow .18s ease,transform .18s ease,filter .18s ease !important;
    }

    html:not(.br-night-mode) :is(
      .upload-btn,
      .reset-btn,
      .back-btn,
      .apply-selection,
      .excel-export-btn,
      .gp-toggle-btn,
      .sm-spotlight-btn,
      .management-tool-btn,
      .management-exit-btn,
      .pnl-currency-switch button,
      .performance-currency-switch button,
      .workspace-btn.active,
      .tab-btn.active
    ):hover{
      box-shadow:0 8px 20px rgba(33,143,130,.19) !important;
      transform:translateY(-1px);
    }

    html:not(.br-night-mode) .side-nav :is(
      .workspace-btn,
      .side-submenu .tab-btn,
      .side-submenu .algeria-tab-btn,
      .profit-impact-open-btn
    ):hover{
      color:#fff !important;
      font-weight:900 !important;
      border-color:rgba(111,245,225,.42) !important;
      background:linear-gradient(90deg,rgba(9,174,151,.34),rgba(5,89,101,.12)) !important;
      box-shadow:
        0 0 0 1px rgba(79,231,209,.10),
        0 0 13px rgba(52,226,201,.18),
        inset 0 0 12px rgba(93,255,231,.06) !important;
      text-shadow:0 0 7px rgba(147,255,239,.42) !important;
    }

    html:not(.br-night-mode) :is(
      .multi-filter-btn,
      .multi-filter-menu,
      .view-control select,
      .pnl-select,
      .filter select,
      .filter input,
      .analysis-filter select,
      .analysis-filter input,
      .modal-toolbar select,
      .modal-toolbar input
    ){
      transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease !important;
    }

    html:not(.br-night-mode) :is(
      .multi-filter-btn,
      .view-control select,
      .pnl-select,
      .filter select,
      .filter input,
      .analysis-filter select,
      .analysis-filter input,
      .modal-toolbar select,
      .modal-toolbar input
    ):hover{
      border-color:rgba(33,143,130,.35) !important;
      box-shadow:0 0 0 3px rgba(33,143,130,.045) !important;
    }

    html:not(.br-night-mode) :is(
      .multi-filter-btn,
      .view-control select,
      .pnl-select,
      .filter select,
      .filter input,
      .analysis-filter select,
      .analysis-filter input,
      .modal-toolbar select,
      .modal-toolbar input
    ):focus,
    html:not(.br-night-mode) :is(
      .multi-filter-btn,
      .view-control select,
      .pnl-select,
      .filter select,
      .filter input,
      .analysis-filter select,
      .analysis-filter input,
      .modal-toolbar select,
      .modal-toolbar input
    ):focus-visible{
      outline:none !important;
      border-color:#218f82 !important;
      box-shadow:0 0 0 3px rgba(33,143,130,.10),0 5px 16px rgba(33,143,130,.07) !important;
    }

    html:not(.br-night-mode) :is(
      .table-wrap,
      .sm-table-scroll,
      .sales-foc-table-scroll,
      .modal-table-wrap,
      .portal-table-wrap,
      .analysis-table-wrap,
      .pnl-table-wrap,
      .stock-table-wrap,
      [class*="table-scroll"],
      [class*="table-wrap"]
    ){
      box-shadow:0 6px 18px rgba(22,75,82,.055) !important;
      transition:box-shadow .2s ease !important;
    }

    html:not(.br-night-mode) :is(
      .table-wrap,
      .sm-table-scroll,
      .sales-foc-table-scroll,
      .modal-table-wrap,
      .portal-table-wrap,
      .analysis-table-wrap,
      .pnl-table-wrap,
      .stock-table-wrap,
      [class*="table-scroll"],
      [class*="table-wrap"]
    ):hover{
      box-shadow:0 8px 22px rgba(22,75,82,.075) !important;
    }

    html:not(.br-night-mode) :is(
      .kpi-card,
      .summary-card,
      .analysis-kpi,
      .analysis-summary-card,
      .stock-summary-card,
      .pnl-summary-card,
      [class*="metric-card"],
      [class*="summary-card"]
    ){
      box-shadow:0 7px 20px rgba(22,75,82,.065),0 0 0 1px rgba(33,143,130,.035) !important;
      transition:box-shadow .2s ease,transform .2s ease !important;
    }

    html:not(.br-night-mode) :is(
      .kpi-card,
      .summary-card,
      .analysis-kpi,
      .analysis-summary-card,
      .stock-summary-card,
      .pnl-summary-card,
      [class*="metric-card"],
      [class*="summary-card"]
    ):hover{
      box-shadow:0 10px 26px rgba(22,75,82,.09),0 0 0 1px rgba(33,143,130,.065) !important;
      transform:translateY(-1px);
    }

    html:not(.br-night-mode) :is(
      .positive,
      .favorable,
      .variance-badge.positive
    ){
      text-shadow:0 0 12px rgba(7,140,60,.08);
    }

    html:not(.br-night-mode) :is(
      .negative,
      .unfavorable,
      .variance-badge.negative
    ){
      text-shadow:0 0 12px rgba(199,55,55,.07);
    }

    @media (prefers-reduced-motion:reduce){
      html:not(.br-night-mode) *{
        transition:none !important;
      }
      html:not(.br-night-mode) :is(
        .filter-card,
        .report-card,
        .variance-card,
        .analysis-card,
        .analysis-panel,
        .management-card,
        .upload-btn,
        .reset-btn,
        .back-btn,
        .apply-selection,
        .excel-export-btn,
        .gp-toggle-btn,
        .sm-spotlight-btn,
        .management-tool-btn,
        .management-exit-btn,
        .workspace-btn.active,
        .tab-btn.active
      ):hover{
        transform:none !important;
      }
    }
  `;

  document.head.appendChild(style);
})();
