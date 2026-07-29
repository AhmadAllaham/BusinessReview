(async function () {
  const statusBox = document.getElementById("statusBox");
  const showStatus = (message,ok=false,error=false) => {
    if (typeof window.setStatus === "function") return window.setStatus(message,ok,error);
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `status-box${ok?" ok":""}${error?" error":""}`;
  };

  if (!window.BRPortal?.configured) {
    showStatus(window.BRPortal?.error || "Firebase is not configured.",false,true);
    return;
  }

  const session = await BRPortal.requireSession({next:"index.html"});
  if (!session) return;

  const profile = session.profile;
  const isAdmin = profile.role === "admin";
  const allowedCountries = [...new Set(profile.countries || [])];

  const userName = document.getElementById("currentUserName");
  const userScope = document.getElementById("currentUserScope");
  if (userName) userName.textContent = profile.displayName || session.user.email || "User";
  if (userScope) {
    userScope.textContent = isAdmin
      ? "Administrator · All countries"
      : allowedCountries.length
        ? allowedCountries.join(", ")
        : "No countries assigned";
  }
  document.querySelectorAll("[data-admin-only]").forEach(element => {
    element.hidden = !isAdmin;
  });
  document.getElementById("logoutButton")?.addEventListener("click",BRPortal.signOut);

  if (!isAdmin && !allowedCountries.length) {
    showStatus("No countries are assigned to your account. Contact the administrator.",false,true);
    return;
  }

  try {
    showStatus("Loading your authorized dashboard data…");
    const activeSnap = await BRPortal.db.collection("system").doc("activeDataset").get();
    if (!activeSnap.exists || !activeSnap.data().datasetId) {
      showStatus("No active dataset. Ask an administrator to upload Excel data in admin.html.",false,true);
      return;
    }
    const active = activeSnap.data();
    let rowDocs = [];

    if (isAdmin) {
      const snapshot = await BRPortal.db.collection("reportRows")
        .where("datasetId","==",active.datasetId)
        .get();
      rowDocs = snapshot.docs;
    } else {
      const snapshots = await Promise.all(allowedCountries.map(country =>
        BRPortal.db.collection("reportRows")
          .where("datasetId","==",active.datasetId)
          .where("country","==",country)
          .get()
      ));
      rowDocs = snapshots.flatMap(snapshot => snapshot.docs);
    }

    const rows = rowDocs.map(doc => doc.data());
    const bySheet = new Map();
    rows.forEach(row => {
      const key = String(row.sheetName || "").trim();
      if (!bySheet.has(key)) bySheet.set(key,[]);
      bySheet.get(key).push(row.payload || {});
    });

    const sheetEntries = [...bySheet.entries()];
    const sales = sheetEntries.find(([name]) =>
      /\bsales\b/i.test(name) && !/selling|marketing/i.test(name)
    )?.[1] || [];
    const pnl = sheetEntries.find(([name]) =>
      /p\s*&?\s*l|income statement|raw data/i.test(name)
    )?.[1] || [];
    const sm = sheetEntries.find(([name]) =>
      /selling|marketing|s&m/i.test(name)
    )?.[1] || [];

    window.loadSalesRowsFromDatabase?.(sales);
    window.loadPnlRowsFromDatabase?.(pnl);
    window.loadSmRowsFromDatabase?.(sm);

    showStatus(
      `Loaded ${rows.length.toLocaleString("en-US")} authorized rows from ${active.name || "the active dataset"}.`,
      true
    );
  } catch (error) {
    console.error(error);
    const missingIndex = String(error.message || "").includes("index");
    showStatus(
      missingIndex
        ? "Firestore needs the reportRows datasetId + country index. Deploy firestore.indexes.json."
        : (error.message || "Unable to load dashboard data."),
      false,
      true
    );
  }
})();
