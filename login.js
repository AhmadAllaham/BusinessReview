(function () {
  const form = document.getElementById("loginForm");
  const button = document.getElementById("loginButton");
  const status = document.getElementById("loginStatus");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberPassword = document.getElementById("rememberPassword");
  const rememberedEmailKey = "brPortalRememberedEmail";

  function show(message,type="") {
    status.textContent = message;
    status.className = `portal-status show ${type}`.trim();
  }

  if (!window.BRPortal?.configured) {
    show(window.BRPortal?.error || "Firebase is not configured.","error");
    button.disabled = true;
    return;
  }

  const rememberedEmail = localStorage.getItem(rememberedEmailKey);
  if (rememberedEmail) {
    emailInput.value = rememberedEmail;
    rememberPassword.checked = true;
  }

  if (window.PasswordCredential && navigator.credentials?.get) {
    navigator.credentials.get({ password: true, mediation: "optional" })
      .then(credential => {
        if (!credential || emailInput.value || passwordInput.value) return;
        emailInput.value = credential.id || "";
        passwordInput.value = credential.password || "";
        rememberPassword.checked = true;
      })
      .catch(() => {});
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
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const credential = await BRPortal.auth.signInWithEmailAndPassword(email,password);
      const profile = await BRPortal.getProfile(credential.user.uid);
      if (!profile || profile.active === false) {
        await BRPortal.auth.signOut();
        throw new Error("This account has not been activated by the administrator.");
      }
      if (rememberPassword.checked) {
        localStorage.setItem(rememberedEmailKey,email);
        if (window.PasswordCredential && navigator.credentials?.store) {
          await navigator.credentials.store(new PasswordCredential({
            id: email,
            password,
            name: profile?.displayName || email
          })).catch(() => {});
        }
      } else {
        localStorage.removeItem(rememberedEmailKey);
        if (navigator.credentials?.preventSilentAccess) {
          await navigator.credentials.preventSilentAccess().catch(() => {});
        }
      }
      location.replace(params.get("next") || "index.html");
    } catch (error) {
      show(error.message || "Unable to sign in.","error");
      button.disabled = false;
    }
  });
})();
