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
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  async function getProfile(uid) {
    const snap = await db.collection("users").doc(uid).get();
    return snap.exists ? { id:snap.id, ...snap.data() } : null;
  }

  async function currentSession() {
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
    const realRequireSession = window.BRPortal.requireSession;
    let skipLegacyDashboardSession = true;

    window.BRPortal.requireSession = function (options={}) {
      if (skipLegacyDashboardSession && options.next === 'index.html') {
        skipLegacyDashboardSession = false;
        return Promise.resolve(null);
      }
      return realRequireSession(options);
    };

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
      try {
        // Load these first so the dashboard cannot resolve to a cached child
        // module. Sales v4 fixes TMS 2025/LY matching and zero fallbacks.
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
