(async function () {
  const session = await window.BRPortal?.requireSession?.({admin:true,next:"admin.html"});
  if (!session) return;

  const db = BRPortal.db;
  const state = { file:null, workbook:null, sheets:[], rows:[], countries:[] };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  })[char]);

  function show(id,message,type="") {
    const el = $(id);
    el.textContent = message;
    el.className = `portal-status show ${type}`.trim();
  }

  function normalizeValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (value === undefined || value === null) return "";
    if (typeof value === "number" && !Number.isFinite(value)) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  }

  function firstNonEmptyRow(matrix) {
    return matrix.findIndex(row => row.some(value => String(value ?? "").trim() !== ""));
  }

  function headerValue(row,names) {
    const key = Object.keys(row).find(item =>
      names.includes(String(item).trim().toLowerCase())
    );
    return key ? String(row[key] ?? "").trim() : "";
  }

  function parseWorkbook(workbook) {
    const parsedSheets = [];
    const allRows = [];
    const countrySet = new Set();

    workbook.SheetNames.forEach(sheetName => {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{
        header:1,defval:"",raw:true,cellDates:true
      });
      const headerIndex = firstNonEmptyRow(matrix);
      if (headerIndex < 0) return;
      const headers = matrix[headerIndex].map((value,index) =>
        String(value || `Column ${index + 1}`).trim()
      );
      const rows = matrix.slice(headerIndex + 1)
        .filter(row => row.some(value => String(value ?? "").trim() !== ""))
        .map((values,index) => {
          const payload = Object.fromEntries(headers.map((header,columnIndex) => [
            header,normalizeValue(values[columnIndex])
          ]));
          const country = headerValue(payload,["country","country name","market"]);
          if (country && !/^total\b/i.test(country)) countrySet.add(country);
          return {
            sheetName,
            rowNumber:headerIndex + index + 2,
            country:country || "__GLOBAL__",
            payload
          };
        });
      parsedSheets.push({name:sheetName,rowCount:rows.length,headers});
      allRows.push(...rows);
    });

    return {
      sheets:parsedSheets,
      rows:allRows,
      countries:[...countrySet].sort((a,b)=>a.localeCompare(b))
    };
  }

  function renderSummary() {
    $("rowCount").value = state.rows.length.toLocaleString("en-US");
    $("countryCount").value = state.countries.length.toLocaleString("en-US");
    if (!state.sheets.length) {
      $("sheetSummary").className = "portal-empty";
      $("sheetSummary").textContent = "No usable sheets were found.";
      return;
    }
    $("sheetSummary").className = "portal-table-wrap";
    $("sheetSummary").innerHTML = `<table class="portal-table">
      <thead><tr><th>Sheet</th><th>Rows</th><th>Columns</th></tr></thead>
      <tbody>${state.sheets.map(sheet => `<tr>
        <td>${escapeHtml(sheet.name)}</td>
        <td>${sheet.rowCount.toLocaleString("en-US")}</td>
        <td>${sheet.headers.length.toLocaleString("en-US")}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  async function readFile(file) {
    try {
      state.file = file;
      $("fileName").textContent = file.name;
      show("fileStatus","Reading workbook…");
      state.workbook = XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
      const parsed = parseWorkbook(state.workbook);
      state.sheets = parsed.sheets;
      state.rows = parsed.rows;
      state.countries = parsed.countries;
      renderSummary();
      $("datasetName").value = file.name.replace(/\.[^.]+$/,"");
      const oversizedRow = state.rows.findIndex(row =>
        new Blob([JSON.stringify(row.payload)]).size > 900000
      );
      if (oversizedRow !== -1) {
        throw new Error(`Workbook row ${state.rows[oversizedRow].rowNumber} is too large for one Firestore document.`);
      }
      if (state.rows.length > 19000) {
        throw new Error("This workbook exceeds 19,000 rows. Split it into smaller files to stay within the Firestore free daily write quota.");
      }
      if (!state.rows.length) throw new Error("No data rows were found.");
      $("uploadButton").disabled = false;
      show("fileStatus",`${state.rows.length.toLocaleString("en-US")} rows ready to upload.`,"success");
    } catch (error) {
      $("uploadButton").disabled = true;
      show("fileStatus",error.message || "Unable to read the workbook.","error");
    }
  }

  async function upload() {
    const datasetName = $("datasetName").value.trim();
    if (!datasetName || !state.rows.length) {
      show("uploadStatus","Enter a dataset name and select a workbook.","error");
      return;
    }

    const button = $("uploadButton");
    const datasetRef = db.collection("datasets").doc();
    const datasetId = datasetRef.id;
    const batchSize = 350;
    let uploaded = 0;

    button.disabled = true;
    $("progress").hidden = false;
    $("progressBar").style.width = "0%";
    show("uploadStatus","Creating dataset…");

    try {
      await datasetRef.set({
        name:datasetName,
        reportingPeriod:$("reportingPeriod").value.trim(),
        fileName:state.file.name,
        sheets:state.sheets.map(sheet => ({name:sheet.name,rowCount:sheet.rowCount})),
        countries:state.countries,
        rowCount:state.rows.length,
        status:"uploading",
        active:false,
        uploadedBy:session.user.uid,
        uploadedByEmail:session.user.email,
        uploadedAt:BRPortal.serverTimestamp()
      });

      for (let start=0; start<state.rows.length; start+=batchSize) {
        const batch = db.batch();
        state.rows.slice(start,start + batchSize).forEach(row => {
          const rowRef = db.collection("reportRows").doc();
          batch.set(rowRef,{
            datasetId,
            sheetName:row.sheetName,
            rowNumber:row.rowNumber,
            country:row.country,
            payload:row.payload,
            createdAt:BRPortal.serverTimestamp()
          });
        });
        await batch.commit();
        uploaded = Math.min(start + batchSize,state.rows.length);
        $("progressBar").style.width = `${Math.round(uploaded / state.rows.length * 100)}%`;
        show("uploadStatus",`Uploaded ${uploaded.toLocaleString("en-US")} of ${state.rows.length.toLocaleString("en-US")} rows…`);
      }

      const activationBatch = db.batch();
      activationBatch.set(datasetRef,{
        status:"complete",active:true,completedAt:BRPortal.serverTimestamp(),uploadedRows:uploaded
      },{merge:true});
      activationBatch.set(db.collection("system").doc("activeDataset"),{
        datasetId,name:datasetName,updatedAt:BRPortal.serverTimestamp(),updatedBy:session.user.uid
      });
      activationBatch.set(db.collection("system").doc("countries"),{
        values:state.countries,updatedAt:BRPortal.serverTimestamp()
      });
      await activationBatch.commit();

      const oldActive = await db.collection("datasets").where("active","==",true).get();
      const deactivate = db.batch();
      oldActive.docs.filter(doc => doc.id !== datasetId).forEach(doc => deactivate.update(doc.ref,{active:false}));
      if (oldActive.docs.some(doc => doc.id !== datasetId)) await deactivate.commit();

      show("uploadStatus","Upload completed and the dataset is now active.","success");
      await loadDatasets();
    } catch (error) {
      await datasetRef.set({
        status:"failed",uploadedRows:uploaded,error:String(error.message || error),completedAt:BRPortal.serverTimestamp()
      },{merge:true}).catch(()=>{});
      show("uploadStatus",error.message || "Upload failed.","error");
    } finally {
      button.disabled = false;
    }
  }

  async function activateDataset(datasetId,name) {
    const active = await db.collection("datasets").where("active","==",true).get();
    const batch = db.batch();
    active.docs.forEach(doc => batch.update(doc.ref,{active:false}));
    batch.update(db.collection("datasets").doc(datasetId),{active:true});
    batch.set(db.collection("system").doc("activeDataset"),{
      datasetId,name,updatedAt:BRPortal.serverTimestamp(),updatedBy:session.user.uid
    });
    await batch.commit();
    await loadDatasets();
  }

  async function loadDatasets() {
    const snap = await db.collection("datasets").orderBy("uploadedAt","desc").limit(20).get();
    const datasets = snap.docs.map(doc => ({id:doc.id,...doc.data()}));
    const target = $("datasetsTable");
    if (!datasets.length) {
      target.className = "portal-empty";
      target.textContent = "No datasets uploaded yet.";
      return;
    }
    target.className = "portal-table-wrap";
    target.innerHTML = `<table class="portal-table">
      <thead><tr><th>Name</th><th>File</th><th>Rows</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${datasets.map(dataset => `<tr>
        <td>${escapeHtml(dataset.name || "Unnamed")}</td>
        <td>${escapeHtml(dataset.fileName || "—")}</td>
        <td>${Number(dataset.rowCount || 0).toLocaleString("en-US")}</td>
        <td>${dataset.active ? '<span class="portal-badge">Active</span>' : escapeHtml(dataset.status || "—")}</td>
        <td>${dataset.status === "complete" && !dataset.active
          ? `<button class="portal-button ghost activate-dataset" data-id="${dataset.id}" data-name="${escapeHtml(dataset.name || "")}" type="button">Activate</button>`
          : "—"}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  $("datasetsTable").addEventListener("click",async event => {
    const button = event.target.closest(".activate-dataset");
    if (!button) return;
    button.disabled = true;
    try {
      await activateDataset(button.dataset.id,button.dataset.name);
    } catch (error) {
      show("uploadStatus",error.message || "Could not activate the dataset.","error");
    }
  });

  $("logoutButton").addEventListener("click",BRPortal.signOut);
  $("excelFile").addEventListener("change",event => event.target.files[0] && readFile(event.target.files[0]));
  $("uploadButton").addEventListener("click",upload);
  const dropZone = $("dropZone");
  ["dragenter","dragover"].forEach(type => dropZone.addEventListener(type,event => {
    event.preventDefault(); dropZone.classList.add("dragging");
  }));
  ["dragleave","drop"].forEach(type => dropZone.addEventListener(type,event => {
    event.preventDefault(); dropZone.classList.remove("dragging");
  }));
  dropZone.addEventListener("drop",event => event.dataTransfer.files[0] && readFile(event.dataTransfer.files[0]));

  await loadDatasets().catch(error => show("uploadStatus",error.message || "Unable to load dataset history.","error"));
})();
