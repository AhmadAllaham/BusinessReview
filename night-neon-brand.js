(() => {
  'use strict';

  if (window.__BR_NIGHT_NEON_BRAND__) return;
  window.__BR_NIGHT_NEON_BRAND__ = true;

  const style = document.createElement('style');
  style.id = 'br-night-neon-brand-style';
  style.textContent = `
    /* Dar Al Dawa branded neon theme — Night Mode only */
    html.br-night-mode body {
      --br-brand-teal:#218f82;
      --br-brand-navy:#0b3158;
      --br-brand-blue:#1769a8;
      --br-brand-teal-glow:rgba(33,143,130,.58);
      --br-brand-blue-glow:rgba(23,105,168,.48);
      --br-night-bg-0:#030911 !important;
      --br-night-bg-1:#05121d !important;
      --br-night-bg-2:#071827 !important;
      --br-night-panel:#081827 !important;
      --br-night-panel-2:#0a1d2e !important;
      --br-night-panel-3:#0c2440 !important;
      --br-night-line:rgba(33,143,130,.22) !important;
      --br-night-line-strong:rgba(23,105,168,.42) !important;
      --br-night-text:#eef7fb !important;
      --br-night-muted:#8fa6b7 !important;
      --br-night-teal:#218f82 !important;
      --br-night-cyan:#1769a8 !important;
      --br-night-teal-soft:rgba(33,143,130,.12) !important;
      --br-night-cyan-soft:rgba(23,105,168,.11) !important;
      --br-night-shadow:0 18px 46px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.025) !important;
      --br-night-glow:0 0 0 1px rgba(33,143,130,.22), 0 0 18px rgba(33,143,130,.16), 0 0 36px rgba(23,105,168,.08), 0 18px 46px rgba(0,0,0,.30) !important;
      background:
        radial-gradient(circle at 10% -5%,rgba(33,143,130,.16),transparent 30%),
        radial-gradient(circle at 92% 3%,rgba(11,49,88,.38),transparent 31%),
        radial-gradient(circle at 76% 78%,rgba(23,105,168,.08),transparent 34%),
        linear-gradient(145deg,#030911,#05121d 44%,#061522 100%) !important;
      color:#eef7fb !important;
    }

    html.br-night-mode body::before {
      content:"";
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index:-1;
      background-image:
        linear-gradient(rgba(33,143,130,.025) 1px,transparent 1px),
        linear-gradient(90deg,rgba(23,105,168,.018) 1px,transparent 1px);
      background-size:44px 44px;
      mask-image:linear-gradient(to bottom,rgba(0,0,0,.35),transparent 72%);
    }

    html.br-night-mode body .app-header {
      position:sticky !important;
      background:linear-gradient(180deg,rgba(4,14,24,.97),rgba(5,17,29,.94)) !important;
      border-bottom:1px solid rgba(33,143,130,.24) !important;
      box-shadow:0 12px 34px rgba(0,0,0,.30),0 0 26px rgba(33,143,130,.07) !important;
      backdrop-filter:blur(18px) saturate(125%);
    }

    html.br-night-mode body .app-header::after {
      content:"";
      position:absolute;
      left:2.5%;
      right:2.5%;
      bottom:-1px;
      height:1px;
      pointer-events:none;
      background:linear-gradient(90deg,transparent,rgba(33,143,130,.72),rgba(23,105,168,.62),transparent);
      box-shadow:0 0 10px rgba(33,143,130,.38),0 0 16px rgba(23,105,168,.20);
    }

    html.br-night-mode body .header-company-logo {
      background:transparent !important;
      border:0 !important;
      box-shadow:none !important;
      filter:drop-shadow(0 0 7px rgba(33,143,130,.28)) drop-shadow(0 0 12px rgba(23,105,168,.16)) !important;
    }

    html.br-night-mode body .side-nav {
      background:linear-gradient(180deg,rgba(4,15,25,.99),rgba(3,10,18,.99)) !important;
      border-right:1px solid rgba(33,143,130,.20) !important;
      box-shadow:10px 0 34px rgba(0,0,0,.22),4px 0 24px rgba(11,49,88,.12) !important;
    }

    html.br-night-mode body .workspace-btn,
    html.br-night-mode body .side-submenu .tab-btn,
    html.br-night-mode body .side-submenu .algeria-tab-btn,
    html.br-night-mode body .profit-impact-open-btn {
      color:#b7c9d5 !important;
      border:1px solid transparent !important;
      transition:background .22s ease,border-color .22s ease,color .22s ease,box-shadow .22s ease,transform .22s ease !important;
    }

    html.br-night-mode body .workspace-btn:hover,
    html.br-night-mode body .side-submenu .tab-btn:hover,
    html.br-night-mode body .side-submenu .algeria-tab-btn:hover,
    html.br-night-mode body .profit-impact-open-btn:hover {
      background:linear-gradient(90deg,rgba(9,174,151,.28),rgba(11,49,88,.16)) !important;
      border-color:rgba(93,235,214,.38) !important;
      color:#fff !important;
      font-weight:900 !important;
      box-shadow:0 0 14px rgba(52,226,201,.18),inset 0 0 12px rgba(93,255,231,.05) !important;
      text-shadow:0 0 7px rgba(147,255,239,.40) !important;
      transform:translateX(2px);
    }

    html.br-night-mode body .workspace-btn.active,
    html.br-night-mode body .side-submenu .tab-btn.active {
      background:linear-gradient(135deg,rgba(33,143,130,.28),rgba(11,49,88,.56)) !important;
      border-color:rgba(33,143,130,.62) !important;
      color:#fff !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.12),
        0 0 12px rgba(33,143,130,.22),
        0 0 28px rgba(23,105,168,.11),
        inset 0 0 16px rgba(33,143,130,.05) !important;
    }

    html.br-night-mode body .sidebar-toggle {
      background:rgba(7,25,39,.94) !important;
      border-color:rgba(33,143,130,.30) !important;
      color:#dff8f5 !important;
      box-shadow:0 0 12px rgba(33,143,130,.08) !important;
    }

    html.br-night-mode body .filter-card,
    html.br-night-mode body .report-card,
    html.br-night-mode body .sm-report-shell,
    html.br-night-mode body .analysis-card,
    html.br-night-mode body .analysis-panel,
    html.br-night-mode body .stock-dashboard-card,
    html.br-night-mode body .variance-card,
    html.br-night-mode body .management-panel,
    html.br-night-mode body .modal-panel {
      background:linear-gradient(145deg,rgba(8,24,39,.97),rgba(4,15,26,.98)) !important;
      border:1px solid rgba(33,143,130,.27) !important;
      border-radius:14px !important;
      box-shadow:
        0 0 0 1px rgba(11,49,88,.18),
        0 0 14px rgba(33,143,130,.10),
        0 0 30px rgba(23,105,168,.055),
        0 18px 44px rgba(0,0,0,.30),
        inset 0 1px 0 rgba(255,255,255,.025) !important;
      color:#eef7fb !important;
    }

    html.br-night-mode body .filter-card:hover,
    html.br-night-mode body .report-card:hover,
    html.br-night-mode body .analysis-card:hover,
    html.br-night-mode body .analysis-panel:hover,
    html.br-night-mode body .stock-dashboard-card:hover {
      border-color:rgba(33,143,130,.48) !important;
      box-shadow:
        0 0 0 1px rgba(33,143,130,.16),
        0 0 18px rgba(33,143,130,.17),
        0 0 34px rgba(23,105,168,.09),
        0 20px 48px rgba(0,0,0,.32) !important;
    }

    html.br-night-mode body .filter-card::after,
    html.br-night-mode body .report-card::after,
    html.br-night-mode body .analysis-card::after,
    html.br-night-mode body .stock-dashboard-card::after {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      background:linear-gradient(120deg,rgba(33,143,130,.025),transparent 35%,rgba(23,105,168,.025) 72%,transparent);
      box-shadow:inset 0 0 22px rgba(33,143,130,.025) !important;
    }

    html.br-night-mode body .report-head,
    html.br-night-mode body .filter-card-head,
    html.br-night-mode body .table-toolbar,
    html.br-night-mode body .modal-head,
    html.br-night-mode body .modal-toolbar,
    html.br-night-mode body .pnl-filter-bar-vertical,
    html.br-night-mode body .formula-note,
    html.br-night-mode body .analysis-header,
    html.br-night-mode body .analysis-toolbar {
      background:linear-gradient(180deg,rgba(7,22,36,.64),rgba(5,17,29,.52)) !important;
      border-color:rgba(33,143,130,.16) !important;
    }

    html.br-night-mode body .eyebrow,
    html.br-night-mode body .analysis-eyebrow,
    html.br-night-mode body .side-nav-title {
      color:#55c9ba !important;
      text-shadow:0 0 7px rgba(33,143,130,.34),0 0 15px rgba(33,143,130,.15) !important;
    }

    html.br-night-mode body .pnl-summary-strip {
      background:linear-gradient(180deg,rgba(5,15,26,.98),rgba(6,20,32,.96)) !important;
      border-top:1px solid rgba(33,143,130,.13) !important;
      border-bottom:1px solid rgba(23,105,168,.16) !important;
      gap:12px !important;
    }

    html.br-night-mode body .pnl-summary-box,
    html.br-night-mode body .near-expiry-kpis > *,
    html.br-night-mode body [class*="summary-card"],
    html.br-night-mode body [class*="metric-card"],
    html.br-night-mode body .analysis-kpi {
      background:linear-gradient(145deg,rgba(8,26,41,.96),rgba(5,17,29,.98)) !important;
      border:1px solid rgba(33,143,130,.34) !important;
      border-radius:12px !important;
      box-shadow:
        0 0 10px rgba(33,143,130,.10),
        0 0 22px rgba(23,105,168,.055),
        inset 0 0 12px rgba(33,143,130,.025) !important;
      color:#eef7fb !important;
      transition:border-color .22s ease,box-shadow .22s ease,transform .22s ease !important;
    }

    html.br-night-mode body .pnl-summary-box:hover,
    html.br-night-mode body .near-expiry-kpis > *:hover,
    html.br-night-mode body [class*="summary-card"]:hover,
    html.br-night-mode body [class*="metric-card"]:hover,
    html.br-night-mode body .analysis-kpi:hover {
      border-color:rgba(33,143,130,.60) !important;
      box-shadow:0 0 15px rgba(33,143,130,.20),0 0 28px rgba(23,105,168,.08) !important;
      transform:translateY(-1px);
    }

    html.br-night-mode body .pnl-summary-box:nth-child(4) {
      border-color:rgba(23,105,168,.48) !important;
      box-shadow:0 0 12px rgba(23,105,168,.14),0 0 24px rgba(33,143,130,.055) !important;
    }

    html.br-night-mode body .pnl-summary-box strong,
    html.br-night-mode body .analysis-kpi strong,
    html.br-night-mode body [class*="summary-card"] strong,
    html.br-night-mode body [class*="metric-card"] strong {
      color:#f2fbff !important;
      text-shadow:0 0 10px rgba(33,143,130,.16) !important;
    }

    html.br-night-mode body select,
    html.br-night-mode body input,
    html.br-night-mode body textarea,
    html.br-night-mode body .multi-filter-btn,
    html.br-night-mode body .pnl-select,
    html.br-night-mode body .view-control select,
    html.br-night-mode body .analysis-select,
    html.br-night-mode body .analysis-upload-box {
      background:linear-gradient(180deg,rgba(5,18,30,.96),rgba(4,14,24,.98)) !important;
      color:#eaf5fb !important;
      border:1px solid rgba(33,143,130,.24) !important;
      border-radius:9px !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.02),0 0 8px rgba(11,49,88,.08) !important;
    }

    html.br-night-mode body select:focus,
    html.br-night-mode body input:focus,
    html.br-night-mode body textarea:focus,
    html.br-night-mode body .multi-filter-btn:focus,
    html.br-night-mode body .pnl-select:focus,
    html.br-night-mode body .view-control select:focus {
      outline:none !important;
      border-color:rgba(33,143,130,.78) !important;
      box-shadow:0 0 0 2px rgba(33,143,130,.12),0 0 12px rgba(33,143,130,.22),0 0 22px rgba(23,105,168,.08) !important;
    }

    html.br-night-mode body .multi-filter-menu {
      background:linear-gradient(180deg,#071a2a,#05131f) !important;
      border:1px solid rgba(33,143,130,.38) !important;
      box-shadow:0 18px 54px rgba(0,0,0,.55),0 0 22px rgba(33,143,130,.10) !important;
    }

    html.br-night-mode body .multi-option:hover,
    html.br-night-mode body .multi-option:focus-within {
      background:linear-gradient(90deg,rgba(33,143,130,.11),rgba(11,49,88,.16)) !important;
    }

    html.br-night-mode body .upload-btn,
    html.br-night-mode body .apply-selection,
    html.br-night-mode body .gp-toggle-btn.active,
    html.br-night-mode body .pnl-currency-switch button.active,
    html.br-night-mode body .performance-currency-switch button.active,
    html.br-night-mode body .tab-btn.active,
    html.br-night-mode body .analysis-primary-btn,
    html.br-night-mode body .analysis-upload-btn {
      background:linear-gradient(135deg,#218f82 0%,#176f80 46%,#0b3158 100%) !important;
      border:1px solid rgba(71,202,187,.64) !important;
      color:#f5ffff !important;
      text-shadow:0 0 6px rgba(255,255,255,.10) !important;
      box-shadow:0 0 10px rgba(33,143,130,.28),0 0 22px rgba(23,105,168,.10),inset 0 1px 0 rgba(255,255,255,.08) !important;
    }

    html.br-night-mode body .database-upload-link,
    html.br-night-mode body .header-logout,
    html.br-night-mode body .reset-btn,
    html.br-night-mode body .back-btn,
    html.br-night-mode body .sm-spotlight-btn,
    html.br-night-mode body .excel-export-btn,
    html.br-night-mode body .gp-toggle-btn,
    html.br-night-mode body .pnl-currency-switch button,
    html.br-night-mode body .performance-currency-switch button,
    html.br-night-mode body .analysis-secondary-btn,
    html.br-night-mode body .management-tool-btn,
    html.br-night-mode body .stock-report-switch button {
      background:rgba(5,19,31,.94) !important;
      color:#eaf5fb !important;
      border:1px solid rgba(33,143,130,.26) !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.02),0 0 8px rgba(11,49,88,.08) !important;
    }

    html.br-night-mode body .database-upload-link:hover,
    html.br-night-mode body .header-logout:hover,
    html.br-night-mode body .reset-btn:hover,
    html.br-night-mode body .back-btn:hover,
    html.br-night-mode body .sm-spotlight-btn:hover,
    html.br-night-mode body .excel-export-btn:hover,
    html.br-night-mode body .gp-toggle-btn:hover,
    html.br-night-mode body .pnl-currency-switch button:hover,
    html.br-night-mode body .performance-currency-switch button:hover,
    html.br-night-mode body .analysis-secondary-btn:hover,
    html.br-night-mode body .management-tool-btn:hover,
    html.br-night-mode body .stock-report-switch button:hover {
      border-color:rgba(33,143,130,.62) !important;
      background:linear-gradient(135deg,rgba(33,143,130,.12),rgba(11,49,88,.20)) !important;
      box-shadow:0 0 12px rgba(33,143,130,.16),0 0 22px rgba(23,105,168,.07) !important;
    }

    html.br-night-mode body .table-toolbar {
      background:linear-gradient(180deg,rgba(5,18,29,.96),rgba(4,14,24,.98)) !important;
      border-top-color:rgba(33,143,130,.16) !important;
      border-bottom:1px solid rgba(23,105,168,.16) !important;
    }

    html.br-night-mode body .sm-table-scroll,
    html.br-night-mode body .table-wrap,
    html.br-night-mode body .modal-table-wrap,
    html.br-night-mode body .analysis-table-wrap,
    html.br-night-mode body .pnl-table-wrap,
    html.br-night-mode body .near-expiry-table-scroll {
      background:rgba(3,12,21,.74) !important;
      border:1px solid rgba(33,143,130,.22) !important;
      border-top-color:rgba(33,143,130,.30) !important;
      box-shadow:inset 0 0 18px rgba(11,49,88,.07),0 0 14px rgba(33,143,130,.05) !important;
      scrollbar-color:rgba(33,143,130,.68) rgba(4,14,24,.92) !important;
    }

    html.br-night-mode body table,
    html.br-night-mode body .sm-reference-table,
    html.br-night-mode body .sales-foc-reference-table,
    html.br-night-mode body .analysis-table,
    html.br-night-mode body .pnl-table,
    html.br-night-mode body .portal-table {
      background:transparent !important;
      color:#edf7fb !important;
    }

    html.br-night-mode body thead th,
    html.br-night-mode body table thead th,
    html.br-night-mode body .sm-reference-table thead th,
    html.br-night-mode body .analysis-table thead th,
    html.br-night-mode body .pnl-table thead th,
    html.br-night-mode body .portal-table thead th {
      background:linear-gradient(180deg,#0d2c49,#091d31) !important;
      color:#e9f8fb !important;
      border-top:1px solid rgba(33,143,130,.18) !important;
      border-bottom:1px solid rgba(33,143,130,.48) !important;
      border-right:1px solid rgba(23,105,168,.18) !important;
      box-shadow:0 5px 14px rgba(0,0,0,.17),0 2px 8px rgba(33,143,130,.04) !important;
      text-shadow:0 0 7px rgba(33,143,130,.08) !important;
    }

    html.br-night-mode body tbody td,
    html.br-night-mode body table tbody td,
    html.br-night-mode body .sm-reference-table tbody td,
    html.br-night-mode body .analysis-table tbody td,
    html.br-night-mode body .pnl-table tbody td,
    html.br-night-mode body .portal-table tbody td {
      background:rgba(5,17,29,.78) !important;
      border-bottom-color:rgba(33,143,130,.11) !important;
      border-right-color:rgba(23,105,168,.08) !important;
      color:#e3eef4 !important;
    }

    html.br-night-mode body tbody tr:nth-child(even) td,
    html.br-night-mode body table tbody tr:nth-child(even) td {
      background:rgba(7,22,36,.82) !important;
    }

    html.br-night-mode body tbody tr:hover td,
    html.br-night-mode body table tbody tr:hover td {
      background:linear-gradient(90deg,rgba(33,143,130,.11),rgba(11,49,88,.16)) !important;
      box-shadow:inset 0 1px 0 rgba(33,143,130,.08),inset 0 -1px 0 rgba(23,105,168,.08) !important;
    }

    html.br-night-mode body tr.total-row td,
    html.br-night-mode body .sm-total-row td,
    html.br-night-mode body .pnl-subtotal td,
    html.br-night-mode body .pnl-statement-total td {
      background:linear-gradient(90deg,rgba(33,143,130,.17),rgba(11,49,88,.24)) !important;
      border-top:1px solid rgba(33,143,130,.68) !important;
      border-bottom:1px solid rgba(23,105,168,.28) !important;
      color:#f4fcff !important;
      box-shadow:inset 0 1px 8px rgba(33,143,130,.05) !important;
      font-weight:800 !important;
    }

    html.br-night-mode body .active-filter-bar,
    html.br-night-mode body .active-filter-chip,
    html.br-night-mode body .filter-chip,
    html.br-night-mode body .portal-badge,
    html.br-night-mode body .analysis-badge {
      background:linear-gradient(135deg,rgba(33,143,130,.12),rgba(11,49,88,.18)) !important;
      border:1px solid rgba(33,143,130,.30) !important;
      color:#c9f4ee !important;
      box-shadow:0 0 8px rgba(33,143,130,.05) !important;
    }

    html.br-night-mode body .drill-link,
    html.br-night-mode body .stock-drill-button,
    html.br-night-mode body a:not(.upload-btn) {
      color:#57cfc0 !important;
      text-shadow:0 0 7px rgba(33,143,130,.14) !important;
    }

    html.br-night-mode body .dot.favorable { box-shadow:0 0 7px currentColor; }
    html.br-night-mode body .dot.unfavorable { box-shadow:0 0 7px currentColor; }

    html.br-night-mode body .positive,
    html.br-night-mode body .pnl-positive,
    html.br-night-mode body .sm-good {
      text-shadow:0 0 6px currentColor !important;
    }

    html.br-night-mode body .negative,
    html.br-night-mode body .pnl-negative,
    html.br-night-mode body .pnl-amount-negative,
    html.br-night-mode body .sm-bad {
      text-shadow:0 0 5px currentColor !important;
    }

    html.br-night-mode body ::selection {
      background:rgba(33,143,130,.38);
      color:#fff;
    }

    @media (prefers-reduced-motion: reduce) {
      html.br-night-mode body *,
      html.br-night-mode body *::before,
      html.br-night-mode body *::after {
        transition:none !important;
        animation:none !important;
      }
    }
  `;

  document.head.appendChild(style);
})();
