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

  async function loadDataset(datasetId) {
    if (!datasetId) return [];
    let chunkDocs = [];
    if (isAdmin) {
      const snapshot = await BRPortal.db.collection("reportChunks")
        .where("datasetId","==",datasetId)
        .get();
      chunkDocs = snapshot.docs;
    } else {
      const snapshots = await Promise.all(allowedCountries.map(country =>
        BRPortal.db.collection("reportChunks")
          .where("datasetId","==",datasetId)
          .where("country","==",country)
          .get()
      ));
      chunkDocs = snapshots.flatMap(snapshot => snapshot.docs);
    }
    return chunkDocs
      .sort((a,b)=>(a.data().chunkIndex || 0) - (b.data().chunkIndex || 0))
      .flatMap(doc => doc.data().rows || [])
      .map(row => row.payload || {});
  }

  try {
    showStatus("Loading your authorized dashboard data…");
    const activeSnap = await BRPortal.db.collection("system").doc("activeDatasets").get();
    if (!activeSnap.exists) {
      showStatus("No active reports. Ask an administrator to upload the Excel files in admin.html.",false,true);
      return;
    }

    const active = activeSnap.data();
    const [sales,pnl,sm,stock,nearlyExpired] = await Promise.all([
      loadDataset(active.sales),
      loadDataset(active.pnl),
      loadDataset(active.sm),
      loadDataset(active.stock),
      loadDataset(active.nearlyExpired)
    ]);

    window.loadSalesRowsFromDatabase?.(sales);
    window.loadPnlRowsFromDatabase?.(pnl);
    window.loadSmRowsFromDatabase?.(sm);
    window.loadStockRowsFromDatabase?.(stock);
    window.loadNearlyExpiredRowsFromDatabase?.(nearlyExpired);

    const loadedReports = [
      sales.length ? "Sales" : "",
      stock.length ? "Stock" : "",
      nearlyExpired.length ? "Nearly Expired" : "",
      sm.length ? "S&M" : "",
      pnl.length ? "P&L" : ""
    ].filter(Boolean);
    const totalRows = sales.length + stock.length + nearlyExpired.length + sm.length + pnl.length;
    showStatus(
      loadedReports.length
        ? `Loaded ${totalRows.toLocaleString("en-US")} authorized rows · ${loadedReports.join(" · ")}.`
        : "No report files have been uploaded yet.",
      Boolean(loadedReports.length),
      false
    );
  } catch (error) {
    console.error(error);
    const missingIndex = String(error.message || "").toLowerCase().includes("index");
    showStatus(
      missingIndex
        ? "Firestore needs the reportChunks datasetId + country index. Deploy firestore.indexes.json."
        : (error.message || "Unable to load dashboard data."),
      false,
      true
    );
  }
})();
