(() => {
  'use strict';

  const COUNTRY_CODES = {
    KSA:'sa',
    'Saudi Arabia':'sa',
    Jordan:'jo',
    UAE:'ae',
    'United Arab Emirates':'ae',
    Qatar:'qa',
    Bahrain:'bh',
    Kuwait:'kw',
    Oman:'om',
    Iraq:'iq',
    Lebanon:'lb',
    Libya:'ly',
    Sudan:'sd',
    Algeria:'dz',
    Zambia:'zm',
    Uganda:'ug',
    USA:'us',
    UK:'gb'
  };

  function installStyle() {
    if (document.getElementById('header-flag-image-style')) return;
    const style = document.createElement('style');
    style.id = 'header-flag-image-style';
    style.textContent = `
      .header-country-flag-image{
        display:block;
        width:30px;
        height:22px;
        object-fit:cover;
        border-radius:3px;
        box-shadow:0 0 0 1px rgba(15,35,55,.1);
      }
      .header-country-flag-fallback{
        font-size:12px;
        font-weight:800;
        letter-spacing:.04em;
      }
    `;
    document.head.appendChild(style);
  }

  function upgradeBadge(badge) {
    if (!(badge instanceof HTMLElement) || badge.dataset.flagImageReady === 'true') return;
    const country = String(
      badge.getAttribute('aria-label') || badge.title || ''
    ).trim();
    const code = COUNTRY_CODES[country];
    if (!code) return;

    const image = document.createElement('img');
    image.className = 'header-country-flag-image';
    image.src = `https://flagcdn.com/w40/${code}.png`;
    image.srcset = `https://flagcdn.com/w80/${code}.png 2x`;
    image.alt = `${country} flag`;
    image.loading = 'eager';
    image.decoding = 'async';
    image.addEventListener('error',() => {
      badge.replaceChildren();
      const fallback = document.createElement('span');
      fallback.className = 'header-country-flag-fallback';
      fallback.textContent = country.slice(0,3).toUpperCase();
      badge.appendChild(fallback);
    },{once:true});

    badge.replaceChildren(image);
    badge.dataset.flagImageReady = 'true';
  }

  function upgradeAll() {
    installStyle();
    document.querySelectorAll('.header-country-flag').forEach(upgradeBadge);
  }

  upgradeAll();
  const observer = new MutationObserver(upgradeAll);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
