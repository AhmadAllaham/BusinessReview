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
})();
