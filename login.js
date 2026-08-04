(function () {
  const form = document.getElementById("loginForm");
  const button = document.getElementById("loginButton");
  const status = document.getElementById("loginStatus");

  function show(message,type="") {
    status.textContent = message;
    status.className = `portal-status show ${type}`.trim();
  }

  if (!window.BRPortal?.configured) {
    show(window.BRPortal?.error || "Firebase is not configured.","error");
    button.disabled = true;
    return;
  }

  const params = new URLSearchParams(location.search);
  if (params.get("error") === "inactive") {
    show("This account is inactive. Contact the administrator.","error");
  }

  BRPortal.persistenceReady
    .then(() => BRPortal.waitForAuth())
    .then(session => {
      if (session?.user && session.profile?.active !== false) {
        location.replace(params.get("next") || "index.html");
      }
    });

  form.addEventListener("submit",async event => {
    event.preventDefault();
    button.disabled = true;
    show("Signing in…");
    try {
      await BRPortal.persistenceReady;
      const credential = await BRPortal.auth.signInWithEmailAndPassword(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );
      const profile = await BRPortal.getProfile(credential.user.uid);
      if (!profile || profile.active === false) {
        await BRPortal.auth.signOut();
        throw new Error("This account has not been activated by the administrator.");
      }
      location.replace(params.get("next") || "index.html");
    } catch (error) {
      show(error.message || "Unable to sign in.","error");
      button.disabled = false;
    }
  });
})();
