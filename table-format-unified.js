(() => {
  'use strict';

  if (window.__BR_TABLE_FORMAT_UNIFIED__) return;
  window.__BR_TABLE_FORMAT_UNIFIED__ = true;

  const style = document.createElement('style');
  style.id = 'br-table-format-unified-style';
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

    html.br-night-mode .br-table-shell{
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

    html.br-night-mode .br-table-shell::-webkit-scrollbar{height:9px;width:9px}
    html.br-night-mode .br-table-shell::-webkit-scrollbar-track{background:transparent}
    html.br-night-mode .br-table-shell::-webkit-scrollbar-thumb{
      background:color-mix(in srgb,var(--br-table-accent) 52%,transparent) !important;
      border-radius:999px;
      border:2px solid transparent;
      background-clip:padding-box !important;
    }

    html.br-night-mode table.br-unified-table{
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

    html.br-night-mode table.br-unified-table thead{
      background:var(--br-table-head) !important;
    }

    html.br-night-mode table.br-unified-table thead th{
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

    html.br-night-mode table.br-unified-table thead tr:nth-child(n+2) th{
      top:48px !important;
      z-index:6 !important;
      height:42px !important;
      min-height:42px !important;
      background:var(--br-table-head) !important;
      font-size:11px !important;
    }

    html.br-night-mode table.br-unified-table thead th:first-child{
      left:0;
      z-index:9 !important;
      text-align:left !important;
    }

    html.br-night-mode table.br-unified-table thead tr:nth-child(n+2) th:first-child{
      z-index:8 !important;
    }

    html.br-night-mode table.br-unified-table tbody td,
    html.br-night-mode table.br-unified-table tfoot td{
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

    html.br-night-mode table.br-unified-table tbody tr:nth-child(even):not(.total-row):not(.grand-total):not(.subtotal-row):not([class*="total-row"]) td{
      background:var(--br-table-bg-alt) !important;
    }

    html.br-night-mode table.br-unified-table tbody tr:hover td{
      background:var(--br-table-hover) !important;
    }

    html.br-night-mode table.br-unified-table th:first-child,
    html.br-night-mode table.br-unified-table td:first-child{
      text-align:left !important;
      font-weight:650 !important;
    }

    html.br-night-mode table.br-unified-table th:not(:first-child),
    html.br-night-mode table.br-unified-table td:not(:first-child){
      text-align:right !important;
      font-variant-numeric:tabular-nums !important;
    }

    html.br-night-mode table.br-unified-table th:last-child,
    html.br-night-mode table.br-unified-table td:last-child{
      border-right:0 !important;
    }

    html.br-night-mode table.br-unified-table tbody tr:last-child td,
    html.br-night-mode table.br-unified-table tfoot tr:last-child td{
      border-bottom:0 !important;
    }

    html.br-night-mode table.br-unified-table tr.total-row td,
    html.br-night-mode table.br-unified-table tr.grand-total td,
    html.br-night-mode table.br-unified-table tr.subtotal-row td,
    html.br-night-mode table.br-unified-table tr.pnl-total-row td,
    html.br-night-mode table.br-unified-table tr.sm-total-row td,
    html.br-night-mode table.br-unified-table tr.stock-total-row td,
    html.br-night-mode table.br-unified-table tr[class*="total-row"] td,
    html.br-night-mode table.br-unified-table tfoot td{
      background:var(--br-table-total) !important;
      color:var(--br-table-text) !important;
      font-weight:800 !important;
      border-top:1px solid color-mix(in srgb,var(--br-table-accent) 52%,var(--br-table-line)) !important;
      border-bottom:0 !important;
    }

    html.br-night-mode table.br-unified-table tr.group-row td,
    html.br-night-mode table.br-unified-table tr.category-row td,
    html.br-night-mode table.br-unified-table tr.parent-row td,
    html.br-night-mode table.br-unified-table tr.section-row td,
    html.br-night-mode table.br-unified-table tr[class*="group-row"] td{
      background:var(--br-table-group) !important;
      color:var(--br-table-text) !important;
      font-weight:750 !important;
      border-top:1px solid var(--br-table-line) !important;
    }

    html.br-night-mode table.br-unified-table td.highlight,
    html.br-night-mode table.br-unified-table th.highlight,
    html.br-night-mode table.br-unified-table td[class*="highlight"]{
      background:color-mix(in srgb,var(--br-table-accent) 12%,var(--br-table-bg)) !important;
    }

    html.br-night-mode table.br-unified-table .positive,
    html.br-night-mode table.br-unified-table td.positive,
    html.br-night-mode table.br-unified-table .favorable{
      color:#2bcf7c !important;
      font-weight:750 !important;
    }

    html.br-night-mode table.br-unified-table .negative,
    html.br-night-mode table.br-unified-table td.negative,
    html.br-night-mode table.br-unified-table .unfavorable{
      color:#ff6b76 !important;
      font-weight:750 !important;
    }

    html.br-night-mode table.br-unified-table .drill-link,
    html.br-night-mode table.br-unified-table a{
      color:var(--br-table-accent) !important;
      font-weight:750 !important;
      text-underline-offset:3px;
    }

    html.br-night-mode table.br-unified-table th::after{
      color:var(--br-table-muted) !important;
      opacity:.75 !important;
    }

    html.br-night-mode table.br-unified-table th.sort-asc::after,
    html.br-night-mode table.br-unified-table th.sort-desc::after{
      color:var(--br-table-accent) !important;
      opacity:1 !important;
    }

    html.br-night-mode .br-table-toolbar-unified{
      min-height:52px !important;
      padding:10px 14px !important;
      border:1px solid var(--br-table-line) !important;
      border-bottom:0 !important;
      border-radius:var(--br-table-radius) var(--br-table-radius) 0 0 !important;
      background:var(--br-table-bg-alt) !important;
      color:var(--br-table-muted) !important;
      box-shadow:none !important;
    }

    html.br-night-mode .br-table-toolbar-unified + .br-table-shell,
    html.br-night-mode .br-table-toolbar-unified + * .br-table-shell{
      border-top-left-radius:0 !important;
      border-top-right-radius:0 !important;
    }

    html.br-night-mode table.br-unified-table input,
    html.br-night-mode table.br-unified-table select,
    html.br-night-mode table.br-unified-table button{
      border-color:var(--br-table-line) !important;
      background:var(--br-table-bg-alt) !important;
      color:var(--br-table-text) !important;
    }

    @media(max-width:900px){
      html.br-night-mode table.br-unified-table{font-size:12px !important}
      html.br-night-mode table.br-unified-table thead th{padding:10px 11px !important;font-size:11px !important}
      html.br-night-mode table.br-unified-table tbody td,
      html.br-night-mode table.br-unified-table tfoot td{padding:9px 11px !important;font-size:12px !important}
    }
  `;
  document.head.appendChild(style);

  const wrapperSelectors = [
    '.table-wrap',
    '.sm-table-scroll',
    '.sales-foc-table-scroll',
    '.modal-table-wrap',
    '.portal-table-wrap',
    '.analysis-table-wrap',
    '.pnl-table-wrap',
    '.stock-table-wrap',
    '[class*="table-scroll"]',
    '[class*="table-wrap"]'
  ].join(',');

  function nightModeActive(){
    return document.documentElement.classList.contains('br-night-mode');
  }

  function qualifyTable(table){
    if (!(table instanceof HTMLTableElement)) return false;
    return Boolean(table.closest(
      '.report-section,.report-card,.modal,.management-view,.analysis-section,#managementContent,#businessWorkspace,#mdaWorkspace'
    ));
  }

  function markTable(table){
    if (!nightModeActive() || !qualifyTable(table)) return;
    table.classList.add('br-unified-table');

    let shell = table.closest(wrapperSelectors);
    if (!shell || shell === table) {
      const parent = table.parentElement;
      if (parent && parent.children.length === 1) shell = parent;
    }
    if (shell && shell !== table && !shell.closest('thead,tbody,tfoot')) {
      shell.classList.add('br-table-shell');
    }

    const card = table.closest('.report-card,.modal-panel,.analysis-panel,.management-card');
    const toolbar = card?.querySelector(':scope > .table-toolbar,:scope > .modal-toolbar,:scope > .analysis-toolbar');
    toolbar?.classList.add('br-table-toolbar-unified');
  }

  function unmarkAll(){
    document.querySelectorAll('table.br-unified-table').forEach(table => {
      table.classList.remove('br-unified-table');
    });
    document.querySelectorAll('.br-table-shell').forEach(shell => {
      shell.classList.remove('br-table-shell');
    });
    document.querySelectorAll('.br-table-toolbar-unified').forEach(toolbar => {
      toolbar.classList.remove('br-table-toolbar-unified');
    });
  }

  function scan(root=document){
    if (!nightModeActive()) return;
    if (root instanceof HTMLTableElement) markTable(root);
    root.querySelectorAll?.('table').forEach(markTable);
  }

  function refresh(){
    if (nightModeActive()) scan();
    else unmarkAll();
  }

  refresh();

  const observer = new MutationObserver(records => {
    if (!nightModeActive()) return;
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      scan(node);
    }));
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('brthemechange',refresh);
  window.BRRefreshUnifiedTables = refresh;
})();
