(() => {
  'use strict';

  if (window.__BR_LIGHT_HEADER_CARD_GLOW__) return;
  window.__BR_LIGHT_HEADER_CARD_GLOW__ = true;

  const style = document.createElement('style');
  style.id = 'br-light-header-card-glow-style';
  style.textContent = `
    html:not(.br-night-mode) .app-header{
      isolation:isolate;
      overflow:visible !important;
      background:transparent !important;
      border:0 !important;
      box-shadow:none !important;
    }

    html:not(.br-night-mode) .app-header::before{
      content:"";
      position:absolute;
      inset:7px 14px;
      z-index:-2;
      pointer-events:none;
      border:1px solid rgba(69,178,170,.40);
      border-radius:20px;
      background:
        radial-gradient(circle at 3% 16%,rgba(57,217,255,.115),transparent 25%),
        radial-gradient(circle at 96% 18%,rgba(116,93,255,.075),transparent 23%),
        linear-gradient(180deg,rgba(255,255,255,.985),rgba(249,252,253,.975));
      box-shadow:
        0 12px 30px rgba(24,73,82,.095),
        0 0 15px rgba(53,200,183,.105),
        -7px 0 17px rgba(57,217,255,.085),
        7px 0 17px rgba(94,108,255,.055),
        inset 0 1px 0 rgba(255,255,255,.98),
        inset 0 -1px 0 rgba(33,143,130,.075);
      transition:box-shadow .22s ease,border-color .22s ease,filter .22s ease;
    }

    html:not(.br-night-mode) .app-header::after{
      content:"";
      position:absolute;
      inset:8px 15px;
      z-index:-1;
      pointer-events:none;
      border-radius:19px;
      border:1px solid rgba(255,255,255,.78);
      background:
        linear-gradient(100deg,rgba(255,255,255,.36),transparent 30%,transparent 70%,rgba(255,255,255,.22));
      box-shadow:
        inset 0 0 22px rgba(53,200,183,.035),
        inset 0 0 1px rgba(255,255,255,.95);
    }

    html:not(.br-night-mode) .app-header > *{
      position:relative;
      z-index:1;
    }

    html:not(.br-night-mode) .app-header:hover::before{
      border-color:rgba(53,200,183,.50);
      box-shadow:
        0 15px 36px rgba(24,73,82,.115),
        0 0 20px rgba(53,200,183,.135),
        -8px 0 20px rgba(57,217,255,.105),
        8px 0 20px rgba(94,108,255,.07),
        inset 0 1px 0 rgba(255,255,255,1),
        inset 0 -1px 0 rgba(33,143,130,.09);
    }

    html:not(.br-night-mode) .app-header .brand-mark{
      box-shadow:
        0 7px 18px rgba(33,143,130,.16),
        0 0 0 1px rgba(255,255,255,.42),
        inset 0 1px 0 rgba(255,255,255,.22) !important;
    }

    html:not(.br-night-mode) .app-header :is(
      .header-logout,
      .theme-toggle,
      .upload-btn,
      .database-upload-link,
      .secondary-upload,
      .header-country-flag
    ){
      box-shadow:
        0 5px 14px rgba(24,73,82,.08),
        inset 0 1px 0 rgba(255,255,255,.62) !important;
    }

    html:not(.br-night-mode) .app-header.header-auto-hidden::before,
    html:not(.br-night-mode) .app-header.header-auto-hidden::after{
      opacity:.96;
    }

    @media(max-width:700px){
      html:not(.br-night-mode) .app-header::before{inset:5px 7px;border-radius:16px}
      html:not(.br-night-mode) .app-header::after{inset:6px 8px;border-radius:15px}
    }
  `;

  document.head.appendChild(style);
})();
