(function () {
  'use strict';

  // Apply the saved theme before the dashboard is revealed to avoid a light flash.
  try {
    const savedTheme = localStorage.getItem('br-theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('br-night-mode',savedTheme === 'dark');
    document.documentElement.dataset.brTheme = savedTheme;
    document.documentElement.style.colorScheme = savedTheme;
  } catch (_) {}

  const config = window.BR_FIREBASE_CONFIG || {};
  const configured = Boolean(
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !String(config.apiKey).startsWith('REPLACE_')
  );

  if (!configured) {
    window.BRPortal = {
      configured:false,
      error:'Firebase is not configured. Update firebase-config.js first.'
    };
    return;
  }

  if (!window.firebase) {
    window.BRPortal = {
      configured:false,
      error:'Firebase SDK could not be loaded.'
    };
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
  const auth = app.auth();
  const db = app.firestore();
  const ASSET_VERSION = '20260812-mda-cleared1';

  // Persist immutable monthly report chunks locally. After the first successful
  // load, reopening the same dataset can use IndexedDB instead of downloading
  // every Firestore chunk again.
  const firestorePersistenceReady = db.enablePersistence({synchronizeTabs:true})
    .then(() => true)
    .catch(error => {
      if (!['failed-precondition','unimplemented'].includes(error?.code)) {
        console.error('Unable to enable Firestore offline cache.',error);
      }
      return false;
    });

  const persistenceReady = auth
    .setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .catch(error => {
      console.error('Unable to set session authentication persistence.',error);
    });

  async function getProfile(uid) {
    await firestorePersistenceReady;
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? {id:snap.id,...snap.data()} : null;
  }

  async function currentSession() {
    await persistenceReady;
    const user = auth.currentUser;
    if (!user) return null;
    const profile = await getProfile(user.uid);
    return {user,profile};
  }

  function waitForAuth() {
    return new Promise(resolve => {
      const unsubscribe = auth.onAuthStateChanged(async user => {
        unsubscribe();
        if (!user) return resolve(null);
        try {
          resolve({user,profile:await getProfile(user.uid)});
        } catch (error) {
          resolve({user,profile:null,error});
        }
      });
    });
  }

  async function requireSession(options={}) {
    await persistenceReady;
    const session = await waitForAuth();
    if (!session?.user) {
      location.replace(
        `Login.html?next=${encodeURIComponent(
          options.next || location.pathname.split('/').pop() || 'index.html'
        )}`
      );
      return null;
    }
    if (!session.profile || session.profile.active === false) {
      await auth.signOut();
      location.replace('Login.html?error=inactive');
      return null;
    }
    if (
      options.admin &&
      String(session.profile.role || '').trim().toLowerCase() !== 'admin'
    ) {
      location.replace('index.html');
      return null;
    }
    return session;
  }

  async function signOut() {
    await auth.signOut();
    location.replace('Login.html');
  }

  window.BRPortal = {
    configured:true,
    config,
    app,
    auth,
    db,
    persistenceReady,
    firestorePersistenceReady,
    getProfile,
    currentSession,
    waitForAuth,
    requireSession,
    signOut,
    serverTimestamp:firebase.firestore.FieldValue.serverTimestamp
  };

  const pageName = location.pathname.split('/').pop() || 'index.html';
  const isDashboardPage = pageName.toLowerCase() === 'index.html' || pageName === '';
  if (!isDashboardPage || window.__BR_LATEST_DASHBOARD_BOOTSTRAP__) return;
  window.__BR_LATEST_DASHBOARD_BOOTSTRAP__ = true;

  const dashboardBody = document.body;
  if (dashboardBody) {
    dashboardBody.style.visibility = 'hidden';
    dashboardBody.style.pointerEvents = 'none';
    dashboardBody.setAttribute('aria-busy','true');
  }

  const realRequireSession = window.BRPortal.requireSession;
  const dashboardSessionPromise = realRequireSession({next:'index.html'});

  function revealDashboard() {
    if (!dashboardBody) return;
    dashboardBody.style.visibility = '';
    dashboardBody.style.pointerEvents = '';
    dashboardBody.removeAttribute('aria-busy');
  }

  function versioned(src) {
    return `${src}${src.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
  }

  function loadCachedScript(src,attribute) {
    return new Promise((resolve,reject) => {
      const existing = document.querySelector(`script[${attribute}]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }

      const script = document.createElement('script');
      script.src = versioned(src);
      script.setAttribute(attribute,'true');
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.body.appendChild(script);
    });
  }

  function waitFor(test,message,timeout=10000) {
    return new Promise((resolve,reject) => {
      const started=Date.now();
      const check=() => {
        if (test()) return resolve();
        if (Date.now()-started >= timeout) return reject(new Error(message));
        setTimeout(check,25);
      };
      check();
    });
  }

  window.addEventListener('DOMContentLoaded',async () => {
    if (document.querySelector('script[data-latest-dashboard-runtime]')) return;
    const status = document.getElementById('statusBox');
    const verifiedSession = await dashboardSessionPromise;
    if (!verifiedSession) return;
    window.__BR_VERIFIED_SESSION__ = verifiedSession;

    // The session is valid, so make the interface usable immediately. Formatting
    // helpers continue loading in parallel instead of blocking the whole page.
    revealDashboard();

    Promise.allSettled([
      loadCachedScript('night-mode.js','data-br-night-mode'),
      loadCachedScript('night-format-unified.js','data-br-night-format-unified'),
      loadCachedScript('night-stock-shell-fix.js','data-br-night-stock-shell-fix'),
      loadCachedScript('night-pnl-shell-fix.js','data-br-night-pnl-shell-fix'),
      loadCachedScript('table-format-unified.js','data-br-table-format-unified'),
      loadCachedScript('light-comparison-headers.js','data-br-light-comparison-headers'),
      loadCachedScript('light-soft-glow.js','data-br-light-soft-glow'),
      loadCachedScript('light-header-card-glow.js','data-br-light-header-card-glow'),
      loadCachedScript('ksa-pnl-expected-return.js','data-br-ksa-pnl-expected-return')
    ]).then(async results => {
      results.forEach(result => {
        if (result.status === 'rejected') console.error('Unable to load dashboard formatting.',result.reason);
      });
      try {
        await loadCachedScript('night-neon-brand.js','data-br-night-neon-brand');
      } catch (error) {
        console.error('Unable to load branded Night Mode.',error);
      }
    });

    try {
      await loadCachedScript('report-access.js','data-latest-report-access');

      // Only functional patches required by the first report block startup.
      // Pure formatting and report-specific helpers continue in the background.
      const startupScripts = [
        loadCachedScript('sales-fy-budget.js','data-sales-fy-budget'),
        loadCachedScript('sm-test-link.js','data-sm-test-link')
      ];
      await Promise.all(startupScripts);

      const script = document.createElement('script');
      script.src = versioned('dashboard-firebase.js');
      script.dataset.latestDashboardRuntime = 'true';
      script.onerror = () => {
        if (!status) return;
        status.textContent = 'Unable to load the latest dashboard version. Refresh the page.';
        status.className = 'status-box error';
      };
      document.body.appendChild(script);

      const loadDeferredHelpers = () => Promise.allSettled([
        loadCachedScript('report-readability.js','data-report-readability'),
        loadCachedScript('sm-june-month-fix.js','data-sm-june-month-fix'),
        loadCachedScript('ksa-forecast-override.js','data-ksa-forecast-override'),
        loadCachedScript('header-flag-images.js','data-header-flag-images')
      ]).then(results => results.forEach(result => {
        if (result.status === 'rejected') {
          console.error('Unable to load a deferred dashboard helper.',result.reason);
        }
      }));
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadDeferredHelpers,{timeout:5000});
      } else {
        setTimeout(loadDeferredHelpers,1200);
      }
    } catch (error) {
      console.error(error);
      if (!status) return;
      status.textContent = error.message || 'Unable to load the dashboard startup files.';
      status.className = 'status-box error';
    }
  },{once:true});
})();
