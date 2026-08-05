(() => {
  'use strict';

  if (window.__BR_TABLE_FORMAT_NIGHT_ONLY__) return;
  window.__BR_TABLE_FORMAT_NIGHT_ONLY__ = true;

  // Remove classes left by the earlier formatter so the normal/light theme
  // returns exactly to the original table CSS.
  document.querySelectorAll('table.br-unified-table').forEach(table => {
    table.classList.remove('br-unified-table');
  });
  document.querySelectorAll('.br-table-shell').forEach(element => {
    element.classList.remove('br-table-shell');
  });
  document.querySelectorAll('.br-table-toolbar-unified').forEach(element => {
    element.classList.remove('br-table-toolbar-unified');
  });

  document.getElementById('br-table-format-unified-style')?.remove();

  const style = document.createElement('style');
  style.id = 'br-table-format-night-only-style';
  style.textContent = `
    html.br-night-mode{
      --br-table-bg:#0d1c2d;
      --br-table-bg-alt:#102238;
      --br-table-head:#132a43;
      --br-table-head-2:#17314d;
      --br-table-total:#12363d;
      --br-table-group:#10283c;
      --br-table-line:rgba(122,177,205,.22);
      --br-table-line-soft:rgba(122,177,205,.12);
      --br-table-text:#eaf4f8;
      --br-table-muted:#94aabd;
      --br-table-accent:#39d9c3;
      --br-table-hover:rgba(53,200,183,.085);
      --br-table-shadow:0 16px 42px rgba(0,0,0,.30),0 0 0 1px rgba(53,200,183,.06);
      --br-table-radius:14px;
    }

    html.br-night-mode :is(
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
      position:relative !important;
      overflow:auto !important;
      max-width:100% !important;
      border:1px solid var(--br-table-line) !important;
      border-radius:var(--br-table-radius) !important;
      background:var(--br-table-bg) !important;
      box-shadow:var(--br-table-shadow) !important;
      scrollbar-color:var(--br-table-accent) transparent;
      scrollbar-width:thin;
      backdrop-filter:blur(10px) saturate(112%);
    }

    html.br-night-mode :is(
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
    )::-webkit-scrollbar{height:9px;width:9px}

    html.br-night-mode :is(
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
    )::-webkit-scrollbar-track{background:transparent}

    html.br-night-mode :is(
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
    )::-webkit-scrollbar-thumb{
      background:color-mix(in srgb,var(--br-table-accent) 52%,transparent) !important;
      border-radius:999px;
      border:2px solid transparent;
      background-clip:padding-box !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table{
      width:100% !important;
      min-width:max-content;
      margin:0 !important;
      border:0 !important;
      border-collapse:separate !important;
      border-spacing:0 !important;
      table-layout:auto !important;
      background:var(--br-table-bg) !important;
      color:var(--br-table-text) !important;
      font-family:Segoe UI,Arial,sans-serif !important;
      font-size:13px !important;
      line-height:1.35 !important;
      box-shadow:none !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table thead{
      background:var(--br-table-head) !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table thead th{
      position:sticky !important;
      top:0 !important;
      z-index:7 !important;
      min-height:48px !important;
      height:48px !important;
      padding:11px 14px !important;
      border:0 !important;
      border-right:1px solid var(--br-table-line-soft) !important;
      border-bottom:1px solid var(--br-table-line) !important;
      background:linear-gradient(180deg,var(--br-table-head-2),var(--br-table-head)) !important;
      color:var(--br-table-text) !important;
      font-size:12px !important;
      font-weight:800 !important;
      letter-spacing:.025em !important;
      line-height:1.25 !important;
      text-transform:none !important;
      vertical-align:middle !important;
      white-space:nowrap !important;
      box-shadow:inset 0 -1px 0 var(--br-table-line-soft) !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table thead tr:nth-child(n+2) th{
      top:48px !important;
      z-index:6 !important;
      height:42px !important;
      min-height:42px !important;
      background:var(--br-table-head) !important;
      font-size:11px !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(tbody,tfoot) td{
      height:43px !important;
      min-height:43px !important;
      padding:10px 14px !important;
      border:0 !important;
      border-right:1px solid var(--br-table-line-soft) !important;
      border-bottom:1px solid var(--br-table-line-soft) !important;
      background:var(--br-table-bg) !important;
      color:var(--br-table-text) !important;
      font-size:13px !important;
      font-weight:500 !important;
      line-height:1.35 !important;
      vertical-align:middle !important;
      white-space:nowrap !important;
      transition:background-color .16s ease,color .16s ease !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table tbody tr:nth-child(even):not(.total-row):not(.grand-total):not(.subtotal-row):not([class*="total-row"]) td{
      background:var(--br-table-bg-alt) !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table tbody tr:hover td{
      background:var(--br-table-hover) !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(th,td):first-child{
      text-align:left !important;
      font-weight:650 !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(th,td):not(:first-child){
      text-align:right !important;
      font-variant-numeric:tabular-nums !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(th,td):last-child{
      border-right:0 !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(
      tr.total-row,
      tr.grand-total,
      tr.subtotal-row,
      tr.pnl-total-row,
      tr.sm-total-row,
      tr.stock-total-row,
      tr[class*="total-row"]
    ) td,
    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table tfoot td{
      background:var(--br-table-total) !important;
      color:var(--br-table-text) !important;
      font-weight:800 !important;
      border-top:1px solid color-mix(in srgb,var(--br-table-accent) 52%,var(--br-table-line)) !important;
      border-bottom:0 !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(
      tr.group-row,
      tr.category-row,
      tr.parent-row,
      tr.section-row,
      tr[class*="group-row"]
    ) td{
      background:var(--br-table-group) !important;
      color:var(--br-table-text) !important;
      font-weight:750 !important;
      border-top:1px solid var(--br-table-line) !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(td.highlight,th.highlight,td[class*="highlight"]){
      background:color-mix(in srgb,var(--br-table-accent) 12%,var(--br-table-bg)) !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(.positive,.favorable){
      color:#2bcf7c !important;
      font-weight:750 !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(.negative,.unfavorable){
      color:#ff6b76 !important;
      font-weight:750 !important;
    }

    html.br-night-mode :is(
      .report-section,
      .report-card,
      .modal,
      .management-view,
      .analysis-section,
      #managementContent,
      #businessWorkspace,
      #mdaWorkspace
    ) table :is(.drill-link,a){
      color:var(--br-table-accent) !important;
      font-weight:750 !important;
      text-underline-offset:3px;
    }

    html.br-night-mode :is(.table-toolbar,.modal-toolbar,.analysis-toolbar){
      min-height:52px !important;
      padding:10px 14px !important;
      border-color:var(--br-table-line) !important;
      background:var(--br-table-bg-alt) !important;
      color:var(--br-table-muted) !important;
      box-shadow:none !important;
    }

    @media(max-width:900px){
      html.br-night-mode :is(
        .report-section,
        .report-card,
        .modal,
        .management-view,
        .analysis-section,
        #managementContent,
        #businessWorkspace,
        #mdaWorkspace
      ) table{font-size:12px !important}

      html.br-night-mode :is(
        .report-section,
        .report-card,
        .modal,
        .management-view,
        .analysis-section,
        #managementContent,
        #businessWorkspace,
        #mdaWorkspace
      ) table thead th{padding:10px 11px !important;font-size:11px !important}

      html.br-night-mode :is(
        .report-section,
        .report-card,
        .modal,
        .management-view,
        .analysis-section,
        #managementContent,
        #businessWorkspace,
        #mdaWorkspace
      ) table :is(tbody,tfoot) td{padding:9px 11px !important;font-size:12px !important}
    }
  `;

  document.head.appendChild(style);
})();
