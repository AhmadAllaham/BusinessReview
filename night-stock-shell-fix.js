(() => {
  'use strict';

  if (window.__BR_NIGHT_STOCK_SHELL_FIX__) return;
  window.__BR_NIGHT_STOCK_SHELL_FIX__ = true;

  const style = document.createElement('style');
  style.id = 'br-night-stock-shell-fix-style';
  style.textContent = `
    html.br-night-mode #stockSection .stock-report-shell{
      position:relative;
      overflow:hidden !important;
      background:
        radial-gradient(circle at 9% 0%,rgba(53,200,183,.065),transparent 24%),
        linear-gradient(145deg,rgba(12,29,47,.98),rgba(6,17,29,.985)) !important;
      border:1px solid rgba(94,158,185,.22) !important;
      border-radius:16px !important;
      box-shadow:
        0 18px 46px rgba(0,0,0,.34),
        0 0 0 1px rgba(53,200,183,.055),
        inset 0 1px 0 rgba(255,255,255,.025) !important;
      color:var(--br-night-text,#eef7fb) !important;
    }

    html.br-night-mode #stockSection .stock-report-shell::before{
      content:"";
      position:absolute;
      inset:0;
      z-index:0;
      pointer-events:none;
      border-radius:inherit;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.025),
        inset 0 0 34px rgba(57,217,255,.012);
    }

    html.br-night-mode #stockSection .stock-report-shell > *{
      position:relative;
      z-index:1;
    }

    html.br-night-mode #stockSection .stock-report-selector{
      margin:0 !important;
      padding:15px 17px 13px !important;
      background:
        linear-gradient(180deg,rgba(14,31,50,.94),rgba(8,21,36,.82)) !important;
      border-bottom:1px solid rgba(94,158,185,.16) !important;
    }

    html.br-night-mode #stockSection .stock-report-selector-label{
      color:#8ce7dd !important;
      text-shadow:0 0 14px rgba(53,200,183,.18);
    }

    html.br-night-mode #stockSection .stock-report-tabs{
      border:1px solid rgba(94,158,185,.22) !important;
      background:rgba(5,17,30,.72) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.025),
        0 8px 20px rgba(0,0,0,.19) !important;
    }

    html.br-night-mode #stockSection .stock-report-tabs button{
      color:#b8cad6 !important;
      background:transparent !important;
      border:1px solid transparent !important;
    }

    html.br-night-mode #stockSection .stock-report-tabs button:hover,
    html.br-night-mode #stockSection .stock-report-tabs button:focus-visible{
      color:#f4fbfd !important;
      background:rgba(53,200,183,.08) !important;
      border-color:rgba(53,200,183,.16) !important;
    }

    html.br-night-mode #stockSection .stock-report-tabs button.active{
      color:#031412 !important;
      background:linear-gradient(135deg,#20a798,#35c8b7 60%,#39d9d2) !important;
      border-color:rgba(118,255,237,.24) !important;
      box-shadow:
        0 7px 18px rgba(21,172,160,.23),
        0 0 18px rgba(53,200,183,.10),
        inset 0 1px 0 rgba(255,255,255,.18) !important;
    }

    html.br-night-mode #stockSection .stock-filter-card{
      margin:15px 16px 16px !important;
    }

    html.br-night-mode #stockSection .table-toolbar{
      border-color:rgba(94,158,185,.18) !important;
    }

    html.br-night-mode #stockSection .stock-table-scroll,
    html.br-night-mode #stockSection .near-expiry-table-scroll{
      background:rgba(4,14,25,.36) !important;
    }

    @media(max-width:760px){
      html.br-night-mode #stockSection .stock-report-selector{
        padding:12px 10px 10px !important;
      }
      html.br-night-mode #stockSection .stock-filter-card{
        margin:11px 10px 12px !important;
      }
    }
  `;

  document.head.appendChild(style);
})();