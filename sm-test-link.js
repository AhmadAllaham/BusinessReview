(() => {
  'use strict';

  async function installTestLink() {
    const session = await window.BRPortal?.currentSession?.();
    if (!session?.profile || session.profile.role !== 'admin') return;

    const submenu = document.getElementById('businessSubmenu');
    if (!submenu || submenu.querySelector('[data-sm-expense-test-link]')) return;

    const button = document.createElement('button');
    button.className = 'tab-btn';
    button.type = 'button';
    button.dataset.smExpenseTestLink = 'true';
    button.textContent = 'TEST';
    button.addEventListener('click',() => {
      location.href = 'test-v3.html';
    });

    const pnlButton = submenu.querySelector('[data-tab="pnlSection"]');
    submenu.insertBefore(button,pnlButton || null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',installTestLink,{once:true});
  } else {
    installTestLink();
  }
})();
