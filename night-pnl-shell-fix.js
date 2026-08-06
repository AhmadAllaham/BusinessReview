(() => {
  'use strict';

  if (window.__BR_NIGHT_PNL_SHELL_FIX__) return;
  window.__BR_NIGHT_PNL_SHELL_FIX__ = true;

  const style = document.createElement('style');
  style.id = 'br-night-pnl-shell-fix-style';
  style.textContent = `
    html.br-night-mode #pnlSection .pnl-vertical-card{
      overflow:hidden !important;
      background:
        radial-gradient(circle at 10% 0%,rgba(53,200,183,.055),transparent 24%),
        linear-gradient(145deg,rgba(12,29,47,.985),rgba(6,17,29,.99)) !important;
      border:1px solid rgba(94,158,185,.22) !important;
      border-radius:16px !important;
      box-shadow:
        0 18px 46px rgba(0,0,0,.34),
        0 0 0 1px rgba(53,200,183,.05),
        inset 0 1px 0 rgba(255,255,255,.025) !important;
    }

    html.br-night-mode #pnlSection .pnl-shared-filter-card{
      margin:0 !important;
      border:0 !important;
      border-bottom:1px solid rgba(94,158,185,.18) !important;
      border-radius:0 !important;
      background:
        linear-gradient(180deg,rgba(14,31,50,.96),rgba(8,21,36,.9)) !important;
      box-shadow:none !important;
    }

    html.br-night-mode #pnlSection .pnl-summary-strip{
      position:relative;
      gap:12px !important;
      padding:16px 18px !important;
      background:
        linear-gradient(180deg,rgba(9,24,40,.96),rgba(7,19,33,.97)) !important;
      border-top:0 !important;
      border-bottom:1px solid rgba(94,158,185,.18) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.018),
        inset 0 -1px 0 rgba(53,200,183,.025) !important;
    }

    html.br-night-mode #pnlSection .pnl-summary-strip::before{
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      background:
        radial-gradient(circle at 8% 10%,rgba(53,200,183,.045),transparent 20%),
        radial-gradient(circle at 88% 0%,rgba(57,217,255,.025),transparent 23%);
    }

    html.br-night-mode #pnlSection .pnl-summary-box{
      position:relative;
      z-index:1;
      background:
        linear-gradient(145deg,rgba(17,38,61,.96),rgba(10,25,42,.98)) !important;
      border:1px solid rgba(94,158,185,.2) !important;
      border-radius:12px !important;
      box-shadow:
        0 9px 24px rgba(0,0,0,.19),
        inset 0 1px 0 rgba(255,255,255,.025) !important;
      color:var(--br-night-text,#eef7fb) !important;
    }

    html.br-night-mode #pnlSection .pnl-summary-box:hover{
      border-color:rgba(53,200,183,.34) !important;
      box-shadow:
        0 11px 28px rgba(0,0,0,.22),
        0 0 18px rgba(53,200,183,.07),
        inset 0 1px 0 rgba(255,255,255,.035) !important;
    }

    html.br-night-mode #pnlSection .pnl-summary-box > span{
      color:#9fb4c1 !important;
    }

    html.br-night-mode #pnlSection .pnl-summary-box > strong{
      color:#f2fbfd !important;
      text-shadow:0 0 18px rgba(57,217,255,.035);
    }

    html.br-night-mode #pnlSection .pnl-summary-box > small{
      color:#91a8b7 !important;
    }

    html.br-night-mode #pnlSection .pnl-summary-box > small.positive,
    html.br-night-mode #pnlSection .pnl-summary-box > small.pnl-positive{
      color:#62e4b0 !important;
    }

    html.br-night-mode #pnlSection .pnl-summary-box > small.negative,
    html.br-night-mode #pnlSection .pnl-summary-box > small.pnl-negative{
      color:#ff7882 !important;
    }

    html.br-night-mode #pnlSection > .pnl-vertical-card > .table-toolbar{
      background:rgba(8,22,37,.96) !important;
      border-top:0 !important;
      border-bottom:1px solid rgba(94,158,185,.18) !important;
    }

    html.br-night-mode #pnlSection .pnl-table-wrap{
      background:rgba(4,14,25,.4) !important;
      border-top:0 !important;
    }

    @media(max-width:700px){
      html.br-night-mode #pnlSection .pnl-summary-strip{
        padding:12px 10px !important;
      }
    }
  `;

  document.head.appendChild(style);
})();