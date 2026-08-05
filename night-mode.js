(() => {
  'use strict';

  if (window.__BR_NIGHT_MODE_INSTALLED__) return;
  window.__BR_NIGHT_MODE_INSTALLED__ = true;

  const STORAGE_KEY = 'br-theme';
  const root = document.documentElement;
  let toggleButton = null;

  function savedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch (_) {
      return root.classList.contains('br-night-mode') ? 'dark' : 'light';
    }
  }

  function iconMarkup(theme) {
    return theme === 'dark'
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M5.64 5.64l1.6 1.6M16.76 16.76l1.6 1.6M18.36 5.64l-1.6 1.6M7.24 16.76l-1.6 1.6"></path><circle cx="12" cy="12" r="4.25"></circle></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.25 15.1A8.45 8.45 0 0 1 8.9 3.75 8.5 8.5 0 1 0 20.25 15.1Z"></path></svg>`;
  }

  function updateButton(theme) {
    if (!toggleButton) return;
    const dark = theme === 'dark';
    toggleButton.setAttribute('aria-pressed',String(dark));
    toggleButton.setAttribute('aria-label',dark ? 'Switch to light mode' : 'Switch to night mode');
    toggleButton.title = dark ? 'Light mode' : 'Night mode';
    toggleButton.innerHTML = `${iconMarkup(theme)}<span>${dark ? 'Light' : 'Night'}</span>`;
  }

  function applyTheme(theme,{persist=true}={}) {
    const dark = theme === 'dark';
    root.classList.toggle('br-night-mode',dark);
    root.dataset.brTheme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY,dark ? 'dark' : 'light'); } catch (_) {}
    }
    updateButton(dark ? 'dark' : 'light');
    window.dispatchEvent(new CustomEvent('brthemechange',{
      detail:{theme:dark ? 'dark' : 'light'}
    }));
  }

  function installStyles() {
    if (document.getElementById('br-night-mode-style')) return;
    const style = document.createElement('style');
    style.id = 'br-night-mode-style';
    style.textContent = `
      html.br-night-mode{
        --teal:#35c8b7;
        --teal-dark:#20a798;
        --mint:#163237;
        --bg:#080f1b;
        --red:#ff6974;
        --green:#37d78a;
        --ink:#e9f1f6;
        --muted:#95a7b9;
        --border:#294154;
        --white:#101c2b;
        color-scheme:dark;
      }
      html.br-night-mode body{
        background:
          radial-gradient(circle at 9% -8%,rgba(53,200,183,.16),transparent 30%),
          radial-gradient(circle at 94% 4%,rgba(33,143,130,.13),transparent 28%),
          linear-gradient(145deg,#07101c 0%,#0a1422 42%,#0b1725 100%) !important;
        color:var(--ink) !important;
        min-height:100vh;
      }
      html.br-night-mode body::before{
        content:"";
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:-1;
        background:linear-gradient(115deg,rgba(53,200,183,.035),transparent 36%,rgba(80,180,171,.025));
      }
      html.br-night-mode .app-header{
        background:rgba(10,20,34,.94) !important;
        border-bottom-color:rgba(104,181,176,.18) !important;
        box-shadow:0 10px 32px rgba(0,0,0,.28) !important;
        backdrop-filter:blur(18px);
      }
      html.br-night-mode .app-header h1,
      html.br-night-mode .current-user strong{color:#f5fbff !important}
      html.br-night-mode .app-header p,
      html.br-night-mode .current-user span{color:var(--muted) !important}
      html.br-night-mode .header-company-logo{
        background:#fff !important;
        border-color:rgba(53,200,183,.32) !important;
        box-shadow:0 8px 24px rgba(0,0,0,.24),0 0 22px rgba(53,200,183,.08) !important;
      }
      .theme-toggle{
        min-height:40px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:9px 13px;
        border:1px solid var(--border);
        border-radius:9px;
        background:#fff;
        color:var(--ink);
        font:700 13px/1 Segoe UI,Arial,sans-serif;
        cursor:pointer;
        transition:transform .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease;
      }
      .theme-toggle:hover{transform:translateY(-1px);border-color:var(--teal);box-shadow:0 7px 18px rgba(21,103,95,.12)}
      .theme-toggle:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
      .theme-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      html.br-night-mode .theme-toggle{
        background:linear-gradient(135deg,rgba(53,200,183,.18),rgba(19,48,57,.88));
        color:#dffcf7;
        border-color:rgba(53,200,183,.42);
        box-shadow:0 0 0 1px rgba(53,200,183,.05),0 8px 24px rgba(0,0,0,.25),0 0 24px rgba(53,200,183,.08);
      }
      html.br-night-mode .header-logout,
      html.br-night-mode .reset-btn,
      html.br-night-mode .back-btn,
      html.br-night-mode .database-upload-link,
      html.br-night-mode .secondary-upload{
        background:#152536 !important;
        color:#e7f3f5 !important;
        border-color:#314b5e !important;
      }
      html.br-night-mode .header-logout:hover,
      html.br-night-mode .reset-btn:hover,
      html.br-night-mode .back-btn:hover{background:#1c3347 !important}
      html.br-night-mode .upload-btn:not(.database-upload-link){
        background:linear-gradient(135deg,#2fc2b1,#197e74) !important;
        color:#fff !important;
        box-shadow:0 8px 22px rgba(30,151,140,.18);
      }
      html.br-night-mode .side-nav{
        background:linear-gradient(180deg,#0d1827 0%,#09131f 100%) !important;
        border-right-color:#203748 !important;
        box-shadow:14px 0 34px rgba(0,0,0,.18);
      }
      html.br-night-mode .workspace-btn:hover,
      html.br-night-mode .side-submenu .tab-btn:hover{background:#152b38 !important}
      html.br-night-mode .workspace-btn.active{
        background:linear-gradient(135deg,#278f83,#1b6c65) !important;
        box-shadow:0 7px 22px rgba(26,134,124,.22);
      }
      html.br-night-mode .side-submenu .tab-btn.active{
        background:linear-gradient(90deg,rgba(53,200,183,.16),rgba(53,200,183,.035)) !important;
        border-left-color:#45ddca !important;
        color:#ecfffc !important;
      }
      html.br-night-mode .sidebar-toggle{
        background:#152837 !important;
        border-color:#345160 !important;
        color:#dff5f2 !important;
      }
      html.br-night-mode .filter-card,
      html.br-night-mode .report-card,
      html.br-night-mode .pnl-vertical-card,
      html.br-night-mode .modal-panel,
      html.br-night-mode .management-panel,
      html.br-night-mode .management-kpi,
      html.br-night-mode .management-focus-card,
      html.br-night-mode .stock-dashboard-card,
      html.br-night-mode .stock-dashboard-kpi,
      html.br-night-mode .actual-gp-card,
      html.br-night-mode .actual-gp-kpi,
      html.br-night-mode .analysis-section article,
      html.br-night-mode .analysis-section [class*="card"],
      html.br-night-mode .analysis-section [class*="panel"]{
        background:linear-gradient(145deg,rgba(20,35,52,.97),rgba(14,27,43,.97)) !important;
        border-color:rgba(82,132,151,.30) !important;
        color:var(--ink) !important;
        box-shadow:0 14px 38px rgba(0,0,0,.22),0 0 0 1px rgba(53,200,183,.025) !important;
      }
      html.br-night-mode .report-card:hover,
      html.br-night-mode .stock-dashboard-card:hover,
      html.br-night-mode .analysis-section [class*="card"]:hover{
        border-color:rgba(53,200,183,.28) !important;
      }
      html.br-night-mode .report-head p,
      html.br-night-mode .modal-head p,
      html.br-night-mode .table-toolbar,
      html.br-night-mode small,
      html.br-night-mode [class*="subtitle"],
      html.br-night-mode [class*="hint"]{color:var(--muted) !important}
      html.br-night-mode .eyebrow{color:#63dfd0 !important}
      html.br-night-mode .formula-note,
      html.br-night-mode .pnl-filter-bar-vertical,
      html.br-night-mode .modal-toolbar,
      html.br-night-mode .active-filter-bar{
        background:#122537 !important;
        border-color:#294457 !important;
        color:#c5d5de !important;
      }
      html.br-night-mode .status-box{
        background:#182738 !important;
        border-color:#385167 !important;
        color:#dce8ee !important;
      }
      html.br-night-mode .status-box.ok{background:#11372f !important;border-color:#247d68 !important;color:#c9fff0 !important}
      html.br-night-mode .status-box.error{background:#3c2028 !important;border-color:#8d3f4d !important;color:#ffdce1 !important}
      html.br-night-mode input,
      html.br-night-mode select,
      html.br-night-mode textarea,
      html.br-night-mode .multi-filter-btn,
      html.br-night-mode .multi-filter-menu,
      html.br-night-mode .pnl-select,
      html.br-night-mode .view-control select{
        background:#101e2e !important;
        color:#e8f2f7 !important;
        border-color:#304a5c !important;
      }
      html.br-night-mode input::placeholder,
      html.br-night-mode textarea::placeholder{color:#72889a !important}
      html.br-night-mode select option{background:#101e2e;color:#e8f2f7}
      html.br-night-mode .multi-filter-menu{box-shadow:0 18px 45px rgba(0,0,0,.38) !important}
      html.br-night-mode .multi-option:hover,
      html.br-night-mode .multi-filter-btn:hover{background:#183044 !important}
      html.br-night-mode .all-option,
      html.br-night-mode .multi-filter-actions,
      html.br-night-mode .multi-filter-summary{border-color:#294457 !important}
      html.br-night-mode .clear-selection,
      html.br-night-mode .cancel-selection,
      html.br-night-mode .select-visible{background:#1c3041 !important;color:#d6e5eb !important;border-color:#345064 !important}
      html.br-night-mode .tab-btn:not(.active),
      html.br-night-mode .gp-toggle-btn,
      html.br-night-mode .excel-export-btn,
      html.br-night-mode .sm-spotlight-btn,
      html.br-night-mode [class*="toggle-btn"]:not(.active),
      html.br-night-mode [class*="export-btn"]{
        background:#132436 !important;
        color:#d9e7ed !important;
        border-color:#304a5c !important;
      }
      html.br-night-mode .tab-btn.active,
      html.br-night-mode .gp-toggle-btn.active,
      html.br-night-mode [class*="currency-switch"] button.active,
      html.br-night-mode [class*="toggle-btn"].active{
        background:linear-gradient(135deg,#2fbfae,#187c72) !important;
        color:#fff !important;
        border-color:#40d2c0 !important;
        box-shadow:0 7px 20px rgba(32,163,150,.18);
      }
      html.br-night-mode table{color:#dce8ee !important}
      html.br-night-mode thead th,
      html.br-night-mode .sales-statement-group-head th,
      html.br-night-mode .foc-statement-group-head th,
      html.br-night-mode .stock-statement-group-head th,
      html.br-night-mode .near-expiry-group-head th,
      html.br-night-mode .pnl-group-head th,
      html.br-night-mode .sm-reference-table thead th{
        background:#13283b !important;
        color:#f1f8fb !important;
        border-color:#315064 !important;
      }
      html.br-night-mode .sales-statement-sub-head th,
      html.br-night-mode .foc-statement-sub-head th,
      html.br-night-mode .stock-statement-sub-head th,
      html.br-night-mode .near-expiry-sub-head th,
      html.br-night-mode .pnl-sub-head th{
        background:#102235 !important;
        color:#bcd0da !important;
        border-color:#29485d !important;
      }
      html.br-night-mode th:hover{background:#1a3548 !important}
      html.br-night-mode td{
        background:rgba(15,29,45,.62) !important;
        color:#d9e6ec !important;
        border-color:rgba(73,104,124,.24) !important;
      }
      html.br-night-mode tbody tr:nth-child(even) td{background:rgba(18,35,52,.72) !important}
      html.br-night-mode tbody tr:hover td{background:rgba(44,116,111,.22) !important}
      html.br-night-mode tr.total-row td,
      html.br-night-mode .sm-total-row td,
      html.br-night-mode .pnl-statement-total td{
        background:#173b3d !important;
        color:#effffc !important;
        border-top-color:#35c8b7 !important;
      }
      html.br-night-mode td.highlight{background:#17333e !important}
      html.br-night-mode .positive,
      html.br-night-mode .sm-good,
      html.br-night-mode .pnl-positive{color:#53e39a !important}
      html.br-night-mode .negative,
      html.br-night-mode .sm-bad,
      html.br-night-mode .pnl-negative,
      html.br-night-mode .pnl-amount-negative{color:#ff7f89 !important}
      html.br-night-mode .drill-link,
      html.br-night-mode .stock-drill-button{color:#65e2d3 !important}
      html.br-night-mode .modal-backdrop{background:rgba(2,7,13,.82) !important;backdrop-filter:blur(5px)}
      html.br-night-mode .modal-close{background:#1a3042 !important;color:#e9f4f8 !important}
      html.br-night-mode .active-filter-chip,
      html.br-night-mode [class*="badge"]{
        background:#173746 !important;
        color:#dffbf6 !important;
        border-color:#2e6c71 !important;
      }
      html.br-night-mode .stock-dashboard-bar-track{background:#263b4c !important}
      html.br-night-mode .stock-dashboard-bar-track i{background:linear-gradient(90deg,#218f82,#4cd9c7) !important}
      html.br-night-mode .stock-priority-table,
      html.br-night-mode .stock-market-summary,
      html.br-night-mode .sm-table-scroll,
      html.br-night-mode .table-wrap,
      html.br-night-mode .modal-table-wrap,
      html.br-night-mode [class*="table-scroll"],
      html.br-night-mode [class*="table-wrap"]{scrollbar-color:#36576a #0d1927}
      html.br-night-mode .performance-spotlight-stage,
      html.br-night-mode .pnl-spotlight-stage,
      html.br-night-mode body.performance-table-spotlight,
      html.br-night-mode body.pnl-table-spotlight,
      html.br-night-mode body.sm-table-spotlight{
        background:#07111e !important;
        color:#eaf4f8 !important;
      }
      html.br-night-mode .sm-spotlight-country,
      html.br-night-mode .management-view,
      html.br-night-mode #managementView{
        background:rgba(8,18,30,.96) !important;
        color:#eaf4f8 !important;
      }
      html.br-night-mode .analysis-section{color:#e7f1f5 !important}
      html.br-night-mode .analysis-section [style*="background: white"],
      html.br-night-mode .analysis-section [style*="background:#fff"],
      html.br-night-mode .analysis-section [style*="background: #fff"]{background:#142438 !important}
      html.br-night-mode .analysis-section canvas{filter:saturate(.92) brightness(.96)}
      html.br-night-mode ::selection{background:rgba(53,200,183,.35);color:#fff}
      @media(max-width:760px){
        .theme-toggle{padding:9px 10px}
        .theme-toggle span{display:none}
      }
      @media(prefers-reduced-motion:reduce){.theme-toggle{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function installToggle() {
    const headerActions = document.querySelector('.header-actions');
    const logout = document.getElementById('logoutButton');
    if (!headerActions || !logout || document.getElementById('themeToggle')) return;

    toggleButton = document.createElement('button');
    toggleButton.id = 'themeToggle';
    toggleButton.className = 'theme-toggle';
    toggleButton.type = 'button';
    toggleButton.addEventListener('click',() => {
      applyTheme(root.classList.contains('br-night-mode') ? 'light' : 'dark');
    });
    headerActions.insertBefore(toggleButton,logout);
    updateButton(root.classList.contains('br-night-mode') ? 'dark' : 'light');
  }

  installStyles();
  applyTheme(savedTheme(),{persist:false});

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',installToggle,{once:true});
  } else {
    installToggle();
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById('themeToggle')) installToggle();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();