(() => {
  'use strict';

  if (window.__BR_NIGHT_FORMAT_UNIFIED__) return;
  window.__BR_NIGHT_FORMAT_UNIFIED__ = true;

  const style = document.createElement('style');
  style.id = 'br-night-format-unified-style';
  style.textContent = `
    html.br-night-mode {
      --br-night-bg-0:#050b15;
      --br-night-bg-1:#081321;
      --br-night-bg-2:#0b1929;
      --br-night-panel:#0d1c2d;
      --br-night-panel-2:#102238;
      --br-night-panel-3:#132a43;
      --br-night-line:rgba(118,177,206,.18);
      --br-night-line-strong:rgba(53,200,183,.34);
      --br-night-text:#eef7fb;
      --br-night-muted:#94aabd;
      --br-night-teal:#35c8b7;
      --br-night-cyan:#39d9ff;
      --br-night-teal-soft:rgba(53,200,183,.12);
      --br-night-cyan-soft:rgba(57,217,255,.10);
      --br-night-shadow:0 16px 42px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.025);
      --br-night-glow:0 0 0 1px rgba(53,200,183,.10), 0 14px 42px rgba(8,180,190,.08);
      --br-night-radius:16px;
      --br-night-radius-sm:10px;
    }

    html.br-night-mode body {
      background:
        radial-gradient(circle at 12% -4%,rgba(53,200,183,.12),transparent 28%),
        radial-gradient(circle at 91% 6%,rgba(57,217,255,.08),transparent 25%),
        linear-gradient(145deg,var(--br-night-bg-0),var(--br-night-bg-1) 42%,#071522 100%) !important;
      color:var(--br-night-text) !important;
    }

    html.br-night-mode .app-header {
      background:rgba(7,17,29,.92) !important;
      border-bottom:1px solid var(--br-night-line) !important;
      box-shadow:0 12px 34px rgba(0,0,0,.24) !important;
      backdrop-filter:blur(18px) saturate(120%);
    }

    html.br-night-mode .app-header h1,
    html.br-night-mode .report-head h2,
    html.br-night-mode .filter-card-head h2,
    html.br-night-mode .variance-head h2,
    html.br-night-mode .analysis-section h2,
    html.br-night-mode .analysis-section h3,
    html.br-night-mode .modal-head h2 {
      color:var(--br-night-text) !important;
      letter-spacing:-.015em;
    }

    html.br-night-mode .app-header p,
    html.br-night-mode .report-head p,
    html.br-night-mode .modal-head p,
    html.br-night-mode .pnl-empty-state,
    html.br-night-mode .current-user span,
    html.br-night-mode .table-toolbar,
    html.br-night-mode .analysis-section p {
      color:var(--br-night-muted) !important;
    }

    html.br-night-mode .header-company-logo {
      background:#fff !important;
      border-color:rgba(255,255,255,.14) !important;
      box-shadow:0 8px 24px rgba(0,0,0,.24) !important;
    }

    html.br-night-mode .side-nav {
      background:
        linear-gradient(180deg,rgba(9,23,38,.98),rgba(5,14,25,.98)) !important;
      border-right:1px solid var(--br-night-line) !important;
      box-shadow:12px 0 34px rgba(0,0,0,.16);
    }

    html.br-night-mode .workspace-btn,
    html.br-night-mode .side-submenu .tab-btn {
      border:1px solid transparent !important;
      color:#b6c8d4 !important;
      transition:background .18s ease,border-color .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease;
    }

    html.br-night-mode .workspace-btn:hover,
    html.br-night-mode .side-submenu .tab-btn:hover {
      background:rgba(53,200,183,.075) !important;
      border-color:rgba(53,200,183,.14) !important;
      color:#fff !important;
      transform:translateX(2px);
    }

    html.br-night-mode .workspace-btn.active,
    html.br-night-mode .side-submenu .tab-btn.active {
      background:linear-gradient(135deg,rgba(53,200,183,.22),rgba(57,217,255,.10)) !important;
      border-color:rgba(53,200,183,.34) !important;
      color:#fff !important;
      box-shadow:0 0 22px rgba(53,200,183,.12), inset 0 1px 0 rgba(255,255,255,.05) !important;
    }

    html.br-night-mode .app-shell {
      background:transparent !important;
    }

    html.br-night-mode .filter-card,
    html.br-night-mode .report-card,
    html.br-night-mode .variance-card,
    html.br-night-mode .analysis-card,
    html.br-night-mode .analysis-panel,
    html.br-night-mode .analysis-kpi,
    html.br-night-mode .stock-dashboard-card,
    html.br-night-mode .modal-panel,
    html.br-night-mode .management-panel,
    html.br-night-mode .management-card,
    html.br-night-mode [class*="summary-card"],
    html.br-night-mode [class*="metric-card"] {
      background:
        linear-gradient(145deg,rgba(16,34,56,.96),rgba(9,23,39,.96)) !important;
      border:1px solid var(--br-night-line) !important;
      border-radius:var(--br-night-radius) !important;
      box-shadow:var(--br-night-shadow) !important;
      color:var(--br-night-text) !important;
    }

    html.br-night-mode .filter-card,
    html.br-night-mode .report-card,
    html.br-night-mode .analysis-card,
    html.br-night-mode .analysis-panel,
    html.br-night-mode .stock-dashboard-card {
      position:relative;
      overflow:visible;
    }

    html.br-night-mode .filter-card::before,
    html.br-night-mode .report-card::before,
    html.br-night-mode .analysis-card::before,
    html.br-night-mode .analysis-panel::before,
    html.br-night-mode .stock-dashboard-card::before {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025), inset 0 0 34px rgba(57,217,255,.012);
    }

    html.br-night-mode .filter-card:hover,
    html.br-night-mode .report-card:hover,
    html.br-night-mode .analysis-card:hover,
    html.br-night-mode .analysis-panel:hover,
    html.br-night-mode .stock-dashboard-card:hover {
      border-color:rgba(53,200,183,.28) !important;
      box-shadow:var(--br-night-glow) !important;
    }

    html.br-night-mode .report-head,
    html.br-night-mode .filter-card-head,
    html.br-night-mode .variance-head,
    html.br-night-mode .modal-head,
    html.br-night-mode .analysis-header,
    html.br-night-mode .analysis-toolbar,
    html.br-night-mode .table-toolbar,
    html.br-night-mode .modal-toolbar,
    html.br-night-mode .pnl-filter-bar-vertical,
    html.br-night-mode .formula-note {
      background:rgba(7,18,31,.34) !important;
      border-color:var(--br-night-line) !important;
    }

    html.br-night-mode .eyebrow,
    html.br-night-mode .analysis-eyebrow {
      color:var(--br-night-teal) !important;
      text-shadow:0 0 18px rgba(53,200,183,.20);
      letter-spacing:.13em;
    }

    html.br-night-mode button,
    html.br-night-mode select,
    html.br-night-mode input,
    html.br-night-mode textarea,
    html.br-night-mode .multi-filter-btn,
    html.br-night-mode .multi-filter-menu,
    html.br-night-mode .pnl-select,
    html.br-night-mode .view-control select {
      font-family:inherit;
    }

    html.br-night-mode select,
    html.br-night-mode input,
    html.br-night-mode textarea,
    html.br-night-mode .multi-filter-btn,
    html.br-night-mode .pnl-select,
    html.br-night-mode .view-control select,
    html.br-night-mode .analysis-upload-box,
    html.br-night-mode .analysis-select {
      background:rgba(8,22,37,.88) !important;
      color:var(--br-night-text) !important;
      border:1px solid var(--br-night-line) !important;
      border-radius:var(--br-night-radius-sm) !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025) !important;
    }

    html.br-night-mode select:focus,
    html.br-night-mode input:focus,
    html.br-night-mode textarea:focus,
    html.br-night-mode .multi-filter-btn:focus,
    html.br-night-mode .pnl-select:focus,
    html.br-night-mode .view-control select:focus {
      outline:none !important;
      border-color:rgba(53,200,183,.72) !important;
      box-shadow:0 0 0 3px rgba(53,200,183,.11),0 0 24px rgba(53,200,183,.08) !important;
    }

    html.br-night-mode .multi-filter-menu {
      background:#0b1b2c !important;
      border:1px solid rgba(53,200,183,.24) !important;
      border-radius:12px !important;
      box-shadow:0 20px 55px rgba(0,0,0,.52) !important;
      backdrop-filter:blur(18px);
    }

    html.br-night-mode .multi-option:hover,
    html.br-night-mode .multi-option:focus-within {
      background:rgba(53,200,183,.08) !important;
    }

    html.br-night-mode .upload-btn,
    html.br-night-mode .apply-selection,
    html.br-night-mode .excel-export-btn,
    html.br-night-mode .gp-toggle-btn.active,
    html.br-night-mode .pnl-currency-switch button.active,
    html.br-night-mode .performance-currency-switch button.active,
    html.br-night-mode .analysis-primary-btn,
    html.br-night-mode .analysis-upload-btn {
      background:linear-gradient(135deg,#20a798,#35c8b7 58%,#38d4d4) !important;
      border:1px solid rgba(120,255,239,.24) !important;
      color:#031312 !important;
      box-shadow:0 10px 26px rgba(22,160,153,.20),0 0 24px rgba(53,200,183,.10) !important;
      font-weight:800 !important;
    }

    html.br-night-mode .database-upload-link,
    html.br-night-mode .header-logout,
    html.br-night-mode .reset-btn,
    html.br-night-mode .back-btn,
    html.br-night-mode .sm-spotlight-btn,
    html.br-night-mode .excel-export-btn,
    html.br-night-mode .gp-toggle-btn,
    html.br-night-mode .pnl-currency-switch button,
    html.br-night-mode .performance-currency-switch button,
    html.br-night-mode .analysis-secondary-btn,
    html.br-night-mode .management-tool-btn {
      background:rgba(10,27,44,.92) !important;
      color:var(--br-night-text) !important;
      border:1px solid var(--br-night-line) !important;
      border-radius:10px !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025) !important;
    }

    html.br-night-mode .database-upload-link:hover,
    html.br-night-mode .header-logout:hover,
    html.br-night-mode .reset-btn:hover,
    html.br-night-mode .back-btn:hover,
    html.br-night-mode .sm-spotlight-btn:hover,
    html.br-night-mode .excel-export-btn:hover,
    html.br-night-mode .gp-toggle-btn:hover,
    html.br-night-mode .pnl-currency-switch button:hover,
    html.br-night-mode .performance-currency-switch button:hover,
    html.br-night-mode .analysis-secondary-btn:hover,
    html.br-night-mode .management-tool-btn:hover {
      border-color:rgba(53,200,183,.42) !important;
      background:rgba(53,200,183,.09) !important;
      box-shadow:0 0 22px rgba(53,200,183,.08) !important;
    }

    html.br-night-mode .active-filter-bar,
    html.br-night-mode .active-filter-chip,
    html.br-night-mode .filter-chip,
    html.br-night-mode .variance-badge,
    html.br-night-mode .portal-badge,
    html.br-night-mode .analysis-badge {
      background:rgba(53,200,183,.085) !important;
      border:1px solid rgba(53,200,183,.20) !important;
      color:#bff8f1 !important;
      border-radius:999px !important;
    }

    html.br-night-mode .status-box {
      background:rgba(33,88,109,.17) !important;
      color:#c7edf7 !important;
      border:1px solid rgba(57,217,255,.20) !important;
      border-radius:12px !important;
    }

    html.br-night-mode .status-box.ok {
      background:rgba(25,130,87,.15) !important;
      color:#a7f3cf !important;
      border-color:rgba(55,215,138,.24) !important;
    }

    html.br-night-mode .status-box.error {
      background:rgba(177,54,66,.17) !important;
      color:#ffc2c7 !important;
      border-color:rgba(255,105,116,.26) !important;
    }

    html.br-night-mode .sm-table-scroll,
    html.br-night-mode .table-wrap,
    html.br-night-mode .modal-table-wrap,
    html.br-night-mode .analysis-table-wrap,
    html.br-night-mode .pnl-table-wrap {
      background:rgba(5,15,27,.34) !important;
      border-top:1px solid var(--br-night-line) !important;
      border-radius:0 0 var(--br-night-radius) var(--br-night-radius);
      scrollbar-color:rgba(53,200,183,.38) rgba(6,17,29,.72);
      scrollbar-width:thin;
    }

    html.br-night-mode table,
    html.br-night-mode .sm-reference-table,
    html.br-night-mode .sales-foc-reference-table,
    html.br-night-mode .analysis-table,
    html.br-night-mode .pnl-table,
    html.br-night-mode .portal-table {
      width:100%;
      border-collapse:separate !important;
      border-spacing:0 !important;
      color:var(--br-night-text) !important;
      background:transparent !important;
    }

    html.br-night-mode thead th,
    html.br-night-mode table thead th,
    html.br-night-mode .sm-reference-table thead th,
    html.br-night-mode .analysis-table thead th,
    html.br-night-mode .pnl-table thead th,
    html.br-night-mode .portal-table thead th {
      background:linear-gradient(180deg,#132b43,#0e2135) !important;
      color:#dff7fb !important;
      border-top:1px solid rgba(255,255,255,.025) !important;
      border-bottom:1px solid rgba(53,200,183,.24) !important;
      border-right:1px solid rgba(117,163,187,.09) !important;
      box-shadow:0 8px 18px rgba(0,0,0,.14) !important;
      font-size:12px !important;
      font-weight:800 !important;
      letter-spacing:.015em;
      text-transform:none;
    }

    html.br-night-mode tbody td,
    html.br-night-mode table tbody td,
    html.br-night-mode .sm-reference-table tbody td,
    html.br-night-mode .analysis-table tbody td,
    html.br-night-mode .pnl-table tbody td,
    html.br-night-mode .portal-table tbody td {
      background:rgba(9,24,40,.52) !important;
      color:#d9e8ef !important;
      border-bottom:1px solid rgba(118,177,206,.105) !important;
      border-right:1px solid rgba(118,177,206,.055) !important;
      transition:background .15s ease,color .15s ease,box-shadow .15s ease;
    }

    html.br-night-mode tbody tr:nth-child(even) td,
    html.br-night-mode table tbody tr:nth-child(even) td {
      background:rgba(13,31,50,.57) !important;
    }

    html.br-night-mode tbody tr:hover td,
    html.br-night-mode table tbody tr:hover td {
      background:linear-gradient(90deg,rgba(53,200,183,.105),rgba(57,217,255,.045)) !important;
      color:#fff !important;
      box-shadow:inset 0 1px 0 rgba(53,200,183,.10),inset 0 -1px 0 rgba(53,200,183,.10) !important;
    }

    html.br-night-mode tr.total-row td,
    html.br-night-mode .total-row td,
    html.br-night-mode .grand-total-row td,
    html.br-night-mode .pnl-total-row td,
    html.br-night-mode .sm-total-row td,
    html.br-night-mode tfoot td {
      background:linear-gradient(90deg,rgba(35,131,125,.26),rgba(16,52,70,.78)) !important;
      color:#fff !important;
      border-top:1px solid rgba(53,200,183,.56) !important;
      border-bottom:1px solid rgba(53,200,183,.24) !important;
      font-weight:850 !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.035) !important;
    }

    html.br-night-mode th:first-child,
    html.br-night-mode td:first-child {
      border-left:0 !important;
    }

    html.br-night-mode th:last-child,
    html.br-night-mode td:last-child {
      border-right:0 !important;
    }

    html.br-night-mode th:hover {
      background:linear-gradient(180deg,#173650,#10283d) !important;
    }

    html.br-night-mode th::after {
      color:#6f96a8 !important;
    }

    html.br-night-mode th.sort-asc::after,
    html.br-night-mode th.sort-desc::after {
      color:var(--br-night-cyan) !important;
    }

    html.br-night-mode td.highlight,
    html.br-night-mode .highlight,
    html.br-night-mode .selected-cell {
      background:rgba(53,200,183,.10) !important;
      box-shadow:inset 3px 0 0 rgba(53,200,183,.54) !important;
    }

    html.br-night-mode .positive,
    html.br-night-mode .favorable,
    html.br-night-mode [class*="positive"] {
      color:#42e39a !important;
    }

    html.br-night-mode .negative,
    html.br-night-mode .unfavorable,
    html.br-night-mode [class*="negative"] {
      color:#ff747e !important;
    }

    html.br-night-mode .drill-link,
    html.br-night-mode a:not(.upload-btn) {
      color:#67e8dc !important;
      text-decoration-color:rgba(103,232,220,.40) !important;
    }

    html.br-night-mode .modal-backdrop {
      background:rgba(1,7,14,.80) !important;
      backdrop-filter:blur(8px);
    }

    html.br-night-mode .modal-panel {
      background:linear-gradient(145deg,#10243a,#081727) !important;
      border:1px solid rgba(53,200,183,.24) !important;
      box-shadow:0 34px 100px rgba(0,0,0,.68),0 0 40px rgba(53,200,183,.08) !important;
    }

    html.br-night-mode .modal-close,
    html.br-night-mode .sm-spotlight-exit {
      background:rgba(255,255,255,.055) !important;
      border:1px solid var(--br-night-line) !important;
      color:#fff !important;
    }

    html.br-night-mode .management-view,
    html.br-night-mode .management-shell,
    html.br-night-mode .sm-spotlight-shell,
    html.br-night-mode .spotlight-shell {
      background:
        radial-gradient(circle at top left,rgba(53,200,183,.12),transparent 30%),
        linear-gradient(145deg,#06101c,#091827 56%,#081523) !important;
      color:var(--br-night-text) !important;
    }

    html.br-night-mode .analysis-section {
      color:var(--br-night-text) !important;
    }

    html.br-night-mode .analysis-section [class*="card"],
    html.br-night-mode .analysis-section [class*="panel"],
    html.br-night-mode .analysis-section [class*="box"] {
      border-color:var(--br-night-line) !important;
    }

    html.br-night-mode .analysis-section [class*="kpi"],
    html.br-night-mode .analysis-section [class*="metric"] {
      background:linear-gradient(145deg,rgba(18,42,66,.94),rgba(9,24,41,.96)) !important;
      border:1px solid rgba(53,200,183,.18) !important;
      border-radius:14px !important;
      box-shadow:0 12px 30px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.025) !important;
    }

    html.br-night-mode ::-webkit-scrollbar {
      width:9px;
      height:9px;
    }

    html.br-night-mode ::-webkit-scrollbar-track {
      background:rgba(5,15,27,.72);
    }

    html.br-night-mode ::-webkit-scrollbar-thumb {
      background:linear-gradient(180deg,rgba(53,200,183,.56),rgba(32,112,104,.72));
      border-radius:999px;
      border:2px solid rgba(5,15,27,.72);
    }

    html.br-night-mode ::selection {
      background:rgba(53,200,183,.34);
      color:#fff;
    }

    @media (max-width:900px) {
      html.br-night-mode .filter-card,
      html.br-night-mode .report-card,
      html.br-night-mode .analysis-card,
      html.br-night-mode .analysis-panel {
        border-radius:13px !important;
      }
    }
  `;

  document.head.appendChild(style);
})();
