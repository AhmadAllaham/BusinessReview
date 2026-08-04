(function () {
  const config = window.BR_FIREBASE_CONFIG || {};
  const configured = Boolean(
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !String(config.apiKey).startsWith("REPLACE_")
  );

  if (!configured) {
    window.BRPortal = {
      configured:false,
      error:"Firebase is not configured. Update firebase-config.js first."
    };
    return;
  }

  if (!window.firebase) {
    window.BRPortal = {
      configured:false,
      error:"Firebase SDK could not be loaded."
    };
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
  const auth = app.auth();
  const db = app.firestore();

  // Keep authentication only for the current browser session. This avoids a
  // shared computer remaining signed in after all browser windows are closed.
  const persistenceReady = auth
    .setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .catch(error => {
      console.error("Unable to set session authentication persistence.", error);
    });

  async function getProfile(uid) {
    const snap = await db.collection("users").doc(uid).get();
    return snap.exists ? { id:snap.id, ...snap.data() } : null;
  }

  async function currentSession() {
    await persistenceReady;
    const user = auth.currentUser;
    if (!user) return null;
    const profile = await getProfile(user.uid);
    return { user, profile };
  }

  function waitForAuth() {
    return new Promise(resolve => {
      const unsubscribe = auth.onAuthStateChanged(async user => {
        unsubscribe();
        if (!user) return resolve(null);
        try {
          resolve({ user, profile:await getProfile(user.uid) });
        } catch (error) {
          resolve({ user, profile:null, error });
        }
      });
    });
  }

  async function requireSession(options={}) {
    await persistenceReady;
    const session = await waitForAuth();
    if (!session?.user) {
      location.replace(`Login.html?next=${encodeURIComponent(options.next || location.pathname.split("/").pop() || "index.html")}`);
      return null;
    }
    if (!session.profile || session.profile.active === false) {
      await auth.signOut();
      location.replace("Login.html?error=inactive");
      return null;
    }
    if (options.admin && session.profile.role !== "admin") {
      location.replace("index.html");
      return null;
    }
    return session;
  }

  async function signOut() {
    await auth.signOut();
    location.replace("Login.html");
  }

  window.BRPortal = {
    configured:true,
    config,
    app,
    auth,
    db,
    persistenceReady,
    getProfile,
    currentSession,
    waitForAuth,
    requireSession,
    signOut,
    serverTimestamp:firebase.firestore.FieldValue.serverTimestamp
  };

  const pageName = location.pathname.split('/').pop() || 'index.html';
  const isDashboardPage = pageName.toLowerCase() === 'index.html' || pageName === '';
  if (isDashboardPage && !window.__BR_LATEST_DASHBOARD_BOOTSTRAP__) {
    window.__BR_LATEST_DASHBOARD_BOOTSTRAP__ = true;

    // Do not expose or activate any dashboard UI before Firebase confirms both
    // the authenticated user and an enabled application profile.
    const dashboardBody = document.body;
    if (dashboardBody) {
      dashboardBody.style.visibility = 'hidden';
      dashboardBody.style.pointerEvents = 'none';
      dashboardBody.setAttribute('aria-busy', 'true');
    }

    const realRequireSession = window.BRPortal.requireSession;
    const dashboardSessionPromise = realRequireSession({ next:'index.html' });
    let skipLegacyDashboardSession = true;

    // index.html still contains an old pinned dashboard script. Prevent that
    // copy from running; the authenticated bootstrap below loads one fresh
    // runtime after access has been verified.
    window.BRPortal.requireSession = function (options={}) {
      if (skipLegacyDashboardSession && options.next === 'index.html') {
        skipLegacyDashboardSession = false;
        return Promise.resolve(null);
      }
      return realRequireSession(options);
    };

    function revealDashboard() {
      if (!dashboardBody) return;
      dashboardBody.style.visibility = '';
      dashboardBody.style.pointerEvents = '';
      dashboardBody.removeAttribute('aria-busy');
    }

    function loadFreshScript(src,attribute) {
      return new Promise((resolve,reject) => {
        const existing = document.querySelector(`script[${attribute}]`);
        if (existing) {
          if (existing.dataset.loaded === 'true') return resolve();
          existing.addEventListener('load',resolve,{once:true});
          existing.addEventListener('error',reject,{once:true});
          return;
        }
        const script = document.createElement('script');
        script.src = `${src}${src.includes('?') ? '&' : '?'}v=${Date.now()}`;
        script.setAttribute(attribute,'true');
        script.onload = () => {
          script.dataset.loaded = 'true';
          resolve();
        };
        script.onerror = () => reject(new Error(`Unable to load ${src}`));
        document.body.appendChild(script);
      });
    }

    window.addEventListener('DOMContentLoaded', async () => {
      if (document.querySelector('script[data-latest-dashboard-runtime]')) return;
      const status = document.getElementById('statusBox');

      // An unauthenticated or disabled account is redirected by
      // requireSession and never reaches any dashboard loader below.
      const verifiedSession = await dashboardSessionPromise;
      if (!verifiedSession) return;

      revealDashboard();

      try {
        // Install the S&M calendar reader before its rows are loaded. The
        // second patch corrects legacy 31 May records that actually represent
        // the June reporting month.
        await loadFreshScript(
          'near-expiry-agent-stock-fix.js',
          'data-near-expiry-stock-fix'
        );
        await loadFreshScript(
          'sm-june-month-fix.js',
          'data-sm-june-month-fix'
        );

        await Promise.all([
          loadFreshScript('sales-ims-canonical.js','data-latest-sales-canonical'),
          loadFreshScript('report-access.js','data-latest-report-access')
        ]);

        const script = document.createElement('script');
        script.src = `dashboard-firebase.js?v=${Date.now()}`;
        script.dataset.latestDashboardRuntime = 'true';
        script.onerror = () => {
          if (status) {
            status.textContent = 'Unable to load the latest dashboard version. Refresh the page.';
            status.className = 'status-box error';
          }
        };
        document.body.appendChild(script);
      } catch (error) {
        console.error(error);
        if (status) {
          status.textContent = error.message || 'Unable to load the latest dashboard fixes.';
          status.className = 'status-box error';
        }
      }
    }, { once:true });
  }
})();
