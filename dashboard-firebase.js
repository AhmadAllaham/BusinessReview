(async function () {
  const statusBox = document.getElementById("statusBox");
  const showStatus = (message,ok=false,error=false) => {
    if (typeof window.setStatus === "function") return window.setStatus(message,ok,error);
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `status-box${ok?" ok":""}${error?" error":""}`;
  };

  const loadActualGpModule = () => new Promise((resolve,reject) => {
    if (typeof window.loadActualGpRows === "function") return resolve();
    const existing = document.querySelector('script[data-actual-gp-module]');
    if (existing) {
      existing.addEventListener("load",resolve,{once:true});
      existing.addEventListener("error",reject,{once:true});
      return;
    }
    const script = document.createElement("script");
    script.src = "actual-gp.js?v=20260803-1";
    script.dataset.actualGpModule = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load the Actual GP report module."));
    document.head.appendChild(script);
  });

  const loadNearExpiryStockFix = () => new Promise((resolve,reject) => {
    const existing = document.querySelector('script[data-near-expiry-stock-fix]');
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load",resolve,{once:true});
      existing.addEventListener("error",reject,{once:true});
      return;
    }
    const script = document.createElement("script");
    script.src = "near-expiry-agent-stock-fix.js?v=20260803-3";
    script.dataset.nearExpiryStockFix = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load the Nearly Expired and S&M display updates."));
    document.head.appendChild(script);
  });

  const loadPnlRemainingRatioFix = () => new Promise((resolve,reject) => {
    if (window.__pnlRemainingRatioFixInstalled) return resolve();
    const existing = document.querySelector('script[data-pnl-remaining-ratio-fix]');
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load",resolve,{once:true});
      existing.addEventListener("error",reject,{once:true});
      return;
    }
    const script = document.createElement("script");
    script.src = "pnl-remaining-ratio-fix.js?v=20260803-2";
    script.dataset.pnlRemainingRatioFix = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load the P&L Remaining ratio update."));
    document.head.appendChild(script);
  });

  const loadSalesCanonicalizer = () => new Promise((resolve,reject) => {
    if (typeof window.canonicalizeSalesRows === "function") return resolve();
    const existing = document.querySelector('script[data-sales-canonicalizer]');
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load",resolve,{once:true});
      existing.addEventListener("error",reject,{once:true});
      return;
    }
    const script = document.createElement("script");
    script.src = "sales-ims-canonical.js?v=20260803-1";
    script.dataset.salesCanonicalizer = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load the Sales IMS naming standardizer."));
    document.head.appendChild(script);
  });

  const loadReportAccess = () => new Promise((resolve,reject) => {
    if (window.BRReportAccess) return resolve();
    const existing = document.querySelector('script[data-report-access]');
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load",resolve,{once:true});
      existing.addEventListener("error",reject,{once:true});
      return;
    }
    const script = document.createElement("script");
    script.src = "report-access.js?v=20260803-2";
    script.dataset.reportAccess = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load report-window permissions."));
    document.head.appendChild(script);
  });

  if (!window.BRPortal?.configured) {
    showStatus(window.BRPortal?.error || "Firebase is not configured.",false,true);
    return;
  }

  const session = await BRPortal.requireSession({next:"index.html"});
  if (!session) return;

  const profile = session.profile;
  const isAdmin = profile.role === "admin";
  const allowedCountries = [...new Set(profile.countries || [])];
  const GCC_COUNTRIES = [
    "GCC",
    "UAE",
    "United Arab Emirates",
    "Qatar",
    "Bahrain",
    "Kuwait",
    "Oman"
  ];
  const queryCountries = [...new Set(allowedCountries.flatMap(country =>
    String(country || "").trim().toUpperCase() === "GCC"
      ? GCC_COUNTRIES
      : [String(country || "").trim()]
  ).filter(Boolean))];

  let allowedReports = [];
  try {
    await loadReportAccess();
    allowedReports = window.BRReportAccess?.apply(profile) || [];
  } catch (accessError) {
    console.error(accessError);
    allowedReports = [
      "salesAnalysis","actualGp","focAnalysis","stockLevel",
      "nearlyExpired","stockDashboard","smExpenses","pnl","mda"
    ];
  }
  const allowedReportSet = new Set(allowedReports);
  const hasReport = key => isAdmin || allowedReportSet.has(key);
  const hasAnyReport = keys => keys.some(hasReport);

  const userName = document.getElementById("currentUserName");
  const userScope = document.getElementById("currentUserScope");
  if (userName) userName.textContent = profile.displayName || session.user.email || "User";
  if (userScope) {
    userScope.textContent = isAdmin
      ? "Administrator · All countries · All windows"
      : allowedCountries.length
        ? `${allowedCountries.join(", ")} · ${allowedReports.length} windows`
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

  if (!allowedReports.length) {
    showStatus("No report windows are assigned to your account. Contact the administrator.",false,true);
    return;
  }

  function countryBatches(values,size=10) {
    const batches = [];
    for (let index=0; index<values.length; index+=size) {
      batches.push(values.slice(index,index+size));
    }
    return batches;
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
      const batches = countryBatches(queryCountries);
      const snapshots = await Promise.all(batches.map(countries =>
        BRPortal.db.collection("reportChunks")
          .where("datasetId","==",datasetId)
          .where("country","in",countries)
          .get()
      ));
      chunkDocs = snapshots.flatMap(snapshot => snapshot.docs);
    }
    return chunkDocs
      .sort((a,b)=>{
        const left = a.data();
        const right = b.data();
        return String(left.country || "").localeCompare(String(right.country || "")) ||
          (left.chunkIndex || 0) - (right.chunkIndex || 0);
      })
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
    const needsSales = hasAnyReport(["salesAnalysis","focAnalysis","actualGp"]);
    const needsPnl = hasAnyReport(["pnl","actualGp"]);
    const needsSm = hasReport("smExpenses");
    const needsStock = hasAnyReport(["stockLevel","stockDashboard"]);
    const needsNearlyExpired = hasReport("nearlyExpired");
    const needsProfitability = hasAnyReport([
      "salesAnalysis","focAnalysis","stockLevel","actualGp"
    ]);

    const displayFixPromises = [];
    if (needsNearlyExpired || needsSm) displayFixPromises.push(loadNearExpiryStockFix());
    if (hasReport("pnl")) displayFixPromises.push(loadPnlRemainingRatioFix());
    if (needsSales) displayFixPromises.push(loadSalesCanonicalizer());

    const [sales,pnl,sm,stock,nearlyExpired,profitability] = await Promise.all([
      needsSales ? loadDataset(active.sales) : Promise.resolve([]),
      needsPnl ? loadDataset(active.pnl) : Promise.resolve([]),
      needsSm ? loadDataset(active.sm) : Promise.resolve([]),
      needsStock ? loadDataset(active.stock) : Promise.resolve([]),
      needsNearlyExpired ? loadDataset(active.nearlyExpired) : Promise.resolve([]),
      needsProfitability ? loadDataset(active.profitability) : Promise.resolve([])
    ]);

    const displayFixResults = await Promise.allSettled(displayFixPromises);
    displayFixResults.forEach(result => {
      if (result.status === "rejected") console.error(result.reason);
    });

    const canonicalSales = typeof window.canonicalizeSalesRows === "function"
      ? window.canonicalizeSalesRows(sales)
      : sales;

    if (hasAnyReport(["salesAnalysis","focAnalysis"])) {
      window.loadSalesRowsFromDatabase?.(canonicalSales);
    }
    if (hasReport("pnl")) window.loadPnlRowsFromDatabase?.(pnl);
    if (hasReport("smExpenses")) window.loadSmRowsFromDatabase?.(sm);
    if (hasAnyReport(["stockLevel","stockDashboard"])) {
      window.loadStockRowsFromDatabase?.(stock);
    }
    if (hasReport("nearlyExpired")) {
      window.loadNearlyExpiredRowsFromDatabase?.(nearlyExpired);
    }
    if (hasAnyReport(["salesAnalysis","focAnalysis","stockLevel"])) {
      window.loadProfitabilityRowsFromDatabase?.(profitability);
    }

    if (hasReport("actualGp")) {
      try {
        await loadActualGpModule();
        window.loadActualGpRows?.(canonicalSales,pnl,profitability);
      } catch (moduleError) {
        console.error(moduleError);
      }
    }

    window.BRReportAccess?.apply(profile);

    const loadedReports = [
      needsSales && sales.length ? "Sales" : "",
      needsStock && stock.length ? "Stock" : "",
      needsNearlyExpired && nearlyExpired.length ? "Nearly Expired" : "",
      needsSm && sm.length ? "S&M" : "",
      needsPnl && pnl.length ? "P&L" : "",
      needsProfitability && profitability.length ? "Profitability" : ""
    ].filter(Boolean);
    const totalRows = sales.length + stock.length + nearlyExpired.length + sm.length + pnl.length + profitability.length;
    showStatus(
      loadedReports.length
        ? `Loaded ${totalRows.toLocaleString("en-US")} authorized rows · ${loadedReports.join(" · ")}.`
        : hasReport("mda")
          ? "Your authorized report windows are ready."
          : "No data is available for your authorized report windows.",
      Boolean(loadedReports.length || hasReport("mda")),
      false
    );
  } catch (error) {
    console.error(error);
    const message = String(error.message || "");
    const missingIndex = message.toLowerCase().includes("index");
    const permissions = message.toLowerCase().includes("permission");
    showStatus(
      missingIndex
        ? "Firestore needs the reportChunks datasetId + country index. Deploy firestore.indexes.json."
        : permissions
          ? "Your account cannot read one or more assigned datasets. Check the published Firestore rules and country permissions."
          : (message || "Unable to load dashboard data."),
      false,
      true
    );
  }
})();