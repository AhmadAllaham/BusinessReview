(async function () {
  const session = await window.BRPortal?.requireSession?.({admin:true,next:"setting.html"});
  if (!session) return;

  const db = BRPortal.db;
  let countries = [];
  let users = [];

  const reportCatalog = [
    {key:"salesAnalysis",label:"Sales Analysis"},
    {key:"actualGp",label:"Actual GP vs Budget GP"},
    {key:"focAnalysis",label:"IMS FOC Analysis"},
    {key:"stockLevel",label:"Stock Level"},
    {key:"nearlyExpired",label:"Nearly Expired"},
    {key:"stockDashboard",label:"Stock Dashboard"},
    {key:"smExpenses",label:"Selling & Marketing Expenses"},
    {key:"pnl",label:"P&L"},
    {key:"analysis",label:"Analysis"},
    {key:"mda",label:"MD&A"}
  ];
  const allReportKeys = reportCatalog.map(report => report.key);
  const reportLabelByKey = new Map(reportCatalog.map(report => [report.key,report.label]));

  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  })[char]);

  function show(id,message,type="") {
    const el = document.getElementById(id);
    el.textContent = message;
    el.className = `portal-status show ${type}`.trim();
  }

  function countryCheckboxes(targetId,selected=[],disabled=false) {
    const target = document.getElementById(targetId);
    if (!countries.length) {
      target.innerHTML = '<div class="portal-empty">Upload Excel data first to build the country list.</div>';
      return;
    }
    const selectedSet = new Set(selected);
    target.innerHTML = countries.map(country => `
      <label class="country-option">
        <input type="checkbox" value="${escapeHtml(country)}" ${selectedSet.has(country)?"checked":""} ${disabled?"disabled":""}>
        <span>${escapeHtml(country)}</span>
      </label>`).join("");
  }

  function reportCheckboxes(targetId,selected=allReportKeys,disabled=false) {
    const target = document.getElementById(targetId);
    const selectedSet = new Set(selected);
    target.innerHTML = reportCatalog.map(report => `
      <label class="country-option">
        <input type="checkbox" value="${escapeHtml(report.key)}" ${selectedSet.has(report.key)?"checked":""} ${disabled?"disabled":""}>
        <span>${escapeHtml(report.label)}</span>
      </label>`).join("");
  }

  function selectedValues(targetId) {
    return [...document.querySelectorAll(`#${targetId} input:checked`)].map(input => input.value);
  }

  function selectedCountries(targetId) {
    return selectedValues(targetId);
  }

  function selectedReports(targetId) {
    return selectedValues(targetId).filter(key => allReportKeys.includes(key));
  }

  function userReports(user) {
    if (user?.role === "admin") return [...allReportKeys];
    if (!Object.prototype.hasOwnProperty.call(user || {},"reportPermissions")) {
      return [...allReportKeys];
    }
    return Array.isArray(user.reportPermissions)
      ? user.reportPermissions.filter(key => allReportKeys.includes(key))
      : [];
  }

  function reportSummary(user) {
    const permissions = userReports(user);
    if (user?.role === "admin" || permissions.length === allReportKeys.length) return "All windows";
    if (!permissions.length) return "No window access";
    return permissions.map(key => reportLabelByKey.get(key) || key).join(", ");
  }

  function syncUserActivationButton(user) {
    const button = document.getElementById("toggleUserActiveButton");
    const activeCheckbox = document.getElementById("editActive");
    const isSelf = Boolean(user && user.id === session.user.uid);
    const isActive = !user || user.active !== false;

    button.disabled = !user || isSelf;
    button.textContent = isActive ? "Deactivate user" : "Reactivate user";
    button.classList.toggle("danger",isActive);
    button.classList.toggle("secondary",!isActive);
    button.title = isSelf ? "You cannot deactivate your own administrator account." : "";
    activeCheckbox.disabled = !user || isSelf;
    document.getElementById("editRole").disabled = !user || isSelf;
  }

  async function loadCountries() {
    const snap = await db.collection("system").doc("countries").get();
    countries = snap.exists ? [...new Set(snap.data().values || [])].sort((a,b)=>a.localeCompare(b)) : [];
    countryCheckboxes("newCountryList");
    reportCheckboxes("newReportList",allReportKeys);
  }

  async function loadUsers() {
    const previouslySelected = document.getElementById("editUserSelect")?.value || "";
    const snap = await db.collection("users").orderBy("email").get();
    users = snap.docs.map(doc => ({id:doc.id,...doc.data()}));

    const select = document.getElementById("editUserSelect");
    select.innerHTML = '<option value="">Select a user</option>' + users.map(user =>
      `<option value="${user.id}">${escapeHtml(user.displayName || user.email)} · ${escapeHtml(user.email || "")}</option>`
    ).join("");
    if (users.some(user => user.id === previouslySelected)) select.value = previouslySelected;

    const table = document.getElementById("usersTable");
    if (!users.length) {
      table.className = "portal-empty";
      table.textContent = "No users found.";
      return;
    }
    table.className = "portal-table-wrap";
    table.innerHTML = `<table class="portal-table">
      <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Countries</th><th>Report windows</th></tr></thead>
      <tbody>${users.map(user => `<tr>
        <td>${escapeHtml(user.displayName || "—")}</td>
        <td>${escapeHtml(user.email || "—")}</td>
        <td><span class="portal-badge">${escapeHtml(user.role || "user")}</span></td>
        <td>${user.active === false ? "Inactive" : "Active"}</td>
        <td>${escapeHtml((user.countries || []).join(", ") || "No access")}</td>
        <td>${escapeHtml(reportSummary(user))}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  document.getElementById("logoutButton").addEventListener("click",BRPortal.signOut);

  document.getElementById("createUserForm").addEventListener("submit",async event => {
    event.preventDefault();
    const button = document.getElementById("createUserButton");
    button.disabled = true;
    show("createUserStatus","Creating account…");

    const secondaryName = `user-creator-${Date.now()}`;
    let secondaryApp;
    try {
      secondaryApp = firebase.initializeApp(BRPortal.config,secondaryName);
      const credential = await secondaryApp.auth().createUserWithEmailAndPassword(
        document.getElementById("newEmail").value.trim(),
        document.getElementById("newPassword").value
      );
      const profile = {
        email:credential.user.email,
        displayName:document.getElementById("displayName").value.trim(),
        role:document.getElementById("newRole").value,
        countries:selectedCountries("newCountryList"),
        reportPermissions:selectedReports("newReportList"),
        active:true,
        createdBy:session.user.uid,
        createdAt:BRPortal.serverTimestamp(),
        updatedAt:BRPortal.serverTimestamp()
      };
      await db.collection("users").doc(credential.user.uid).set(profile);
      event.target.reset();
      countryCheckboxes("newCountryList");
      reportCheckboxes("newReportList",allReportKeys);
      show("createUserStatus","User created successfully.","success");
      await loadUsers();
    } catch (error) {
      show("createUserStatus",error.message || "Could not create the user.","error");
    } finally {
      if (secondaryApp) await secondaryApp.delete().catch(()=>{});
      button.disabled = false;
    }
  });

  document.getElementById("editUserSelect").addEventListener("change",event => {
    const user = users.find(item => item.id === event.target.value);
    const enabled = Boolean(user);
    document.getElementById("editDisplayName").disabled = !enabled;
    document.getElementById("editRole").disabled = !enabled;
    document.getElementById("saveUserButton").disabled = !enabled;
    syncUserActivationButton(user);

    if (!user) {
      document.getElementById("editDisplayName").value = "";
      document.getElementById("editActive").checked = false;
      countryCheckboxes("editCountryList",[],true);
      reportCheckboxes("editReportList",[],true);
      return;
    }
    document.getElementById("editDisplayName").value = user.displayName || "";
    document.getElementById("editRole").value = user.role || "user";
    document.getElementById("editActive").checked = user.active !== false;
    countryCheckboxes("editCountryList",user.countries || []);
    reportCheckboxes("editReportList",userReports(user));
  });

  document.getElementById("toggleUserActiveButton").addEventListener("click",async () => {
    const select = document.getElementById("editUserSelect");
    const user = users.find(item => item.id === select.value);
    if (!user || user.id === session.user.uid) return;

    const activate = user.active === false;
    const name = user.displayName || user.email || "this user";
    if (!activate && !window.confirm(
      `Deactivate ${name}? They will no longer be able to access the dashboard.`
    )) return;

    const button = document.getElementById("toggleUserActiveButton");
    button.disabled = true;
    try {
      await db.collection("users").doc(user.id).update({
        active:activate,
        updatedBy:session.user.uid,
        updatedAt:BRPortal.serverTimestamp()
      });
      show(
        "editUserStatus",
        activate ? "User reactivated successfully." : "User access deactivated successfully.",
        "success"
      );
      await loadUsers();
      select.value = user.id;
      select.dispatchEvent(new Event("change"));
    } catch (error) {
      show("editUserStatus",error.message || "Could not update the user status.","error");
      syncUserActivationButton(user);
    }
  });

  document.getElementById("editUserForm").addEventListener("submit",async event => {
    event.preventDefault();
    const uid = document.getElementById("editUserSelect").value;
    if (!uid) return;
    const button = document.getElementById("saveUserButton");
    button.disabled = true;
    try {
      await db.collection("users").doc(uid).update({
        displayName:document.getElementById("editDisplayName").value.trim(),
        role:document.getElementById("editRole").value,
        active:document.getElementById("editActive").checked,
        countries:selectedCountries("editCountryList"),
        reportPermissions:selectedReports("editReportList"),
        updatedBy:session.user.uid,
        updatedAt:BRPortal.serverTimestamp()
      });
      show("editUserStatus","Country and report-window permissions updated.","success");
      await loadUsers();
    } catch (error) {
      show("editUserStatus",error.message || "Could not update permissions.","error");
    } finally {
      button.disabled = false;
    }
  });

  try {
    await loadCountries();
    await loadUsers();
  } catch (error) {
    show("editUserStatus",error.message || "Unable to load settings.","error");
  }
})();
