(async function () {
  const session = await window.BRPortal?.requireSession?.({admin:true,next:"admin.html"});
  if (!session) return;

  const db = BRPortal.db;
  const MAX_CHUNK_BYTES = 700000;
  const MAX_ROWS_PER_CHUNK = 400;
  // Firestore limits one Commit request to about 10 MiB. With chunks capped at
  // 700 KB, eight writes keep each request comfortably below that limit.
  const WRITES_PER_BATCH = 8;
  const state = { file:null, workbook:null, sheets:[], rows:[], countries:[], chunks:[] };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g,char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  })[char]);
  const reportLabels = {
    sales:"Sales · Sales Analysis & IMS FOC",
    stock:"Stock Level",
    sm:"Selling & Marketing Expenses",
    pnl:"P&L"
  };

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

  function normalizeHeader(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/&/g,"and")
      .replace(/[^a-z0-9]+/g,"");
  }

  function pnlHeaderIndex(matrix) {
    const scenarioNames = new Set(["scenario","period","version"]);
    const marketNames = new Set(["market","country","countryname"]);
    const metricNames = new Set([
      "grosssales","netsales","salesreturns","discounts","commissions",
      "cogs","costofgoodssold","grossprofit","sellingandmarketing",
      "sm","netincome","netprofit"
    ]);
    return matrix.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return headers.some(header => scenarioNames.has(header)) &&
        headers.some(header => marketNames.has(header)) &&
        headers.some(header => metricNames.has(header));
    });
  }

  function headerValue(row,names) {
    const key = Object.keys(row).find(item =>
      names.includes(String(item).trim().toLowerCase())
    );
    return key ? String(row[key] ?? "").trim() : "";
  }

  function parseWorkbook(workbook,reportType) {
    const parsedSheets = [];
    const allRows = [];
    const countrySet = new Set();

    workbook.SheetNames.forEach(sheetName => {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{
        header:1,defval:"",raw:true,cellDates:true
      });
      const headerIndex = reportType === "pnl"
        ? pnlHeaderIndex(matrix)
        : firstNonEmptyRow(matrix);
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
          const rawCountry = headerValue(payload,["country","country name","market"]);
          const country = rawCountry && !/^total\b/i.test(rawCountry)
            ? rawCountry
            : "__GLOBAL__";
          if (country !== "__GLOBAL__") countrySet.add(country);
          return {
            sheetName,
            rowNumber:headerIndex + index + 2,
            country,
            payload
          };
        });
      parsedSheets.push({name:sheetName,rowCount:rows.length,headers});
      allRows.push(...rows);
    });

    if (reportType === "pnl" && !parsedSheets.length) {
      throw new Error(
        "No valid P&L table was found. The header must include Scenario/Period, Market/Country, and P&L value columns."
      );
    }
    return {
      sheets:parsedSheets,
      rows:allRows,
      countries:[...countrySet].sort((a,b)=>a.localeCompare(b))
    };
  }

  function buildChunks(rows) {
    const byCountry = new Map();
    rows.forEach(row => {
      if (!byCountry.has(row.country)) byCountry.set(row.country,[]);
      byCountry.get(row.country).push({
        sheetName:row.sheetName,
        rowNumber:row.rowNumber,
        payload:row.payload
      });
    });

    const chunks = [];
    byCountry.forEach((countryRows,country) => {
      let current = [];
      countryRows.forEach(row => {
        const rowBytes = new Blob([JSON.stringify(row)]).size;
        if (rowBytes > MAX_CHUNK_BYTES) {
          throw new Error(`Row ${row.rowNumber} in sheet "${row.sheetName}" is too large for Firestore.`);
        }
        const candidate = [...current,row];
        const candidateBytes = new Blob([JSON.stringify(candidate)]).size;
        if (current.length && (
          current.length >= MAX_ROWS_PER_CHUNK ||
          candidateBytes > MAX_CHUNK_BYTES
        )) {
          chunks.push({country,rows:current});
          current = [row];
        } else {
          current = candidate;
        }
      });
      if (current.length) chunks.push({country,rows:current});
    });
    return chunks;
  }

  function renderSummary() {
    $("rowCount").value = state.rows.length.toLocaleString("en-US");
    $("countryCount").value = state.countries.length.toLocaleString("en-US");
    $("chunkCount").value = state.chunks.length.toLocaleString("en-US");
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
      const parsed = parseWorkbook(state.workbook,$("reportType").value);
      state.sheets = parsed.sheets;
      state.rows = parsed.rows;
      state.countries = parsed.countries;
      if (!state.rows.length) throw new Error("No data rows were found.");
      state.chunks = buildChunks(state.rows);
      renderSummary();
      $("datasetName").value = file.name.replace(/\.[^.]+$/,"");
      $("uploadButton").disabled = false;
      show(
        "fileStatus",
        `${state.rows.length.toLocaleString("en-US")} rows are ready in ${state.chunks.length.toLocaleString("en-US")} Firestore writes.`,
        "success"
      );
    } catch (error) {
      state.chunks = [];
      $("uploadButton").disabled = true;
      show("fileStatus",error.message || "Unable to read the workbook.","error");
    }
  }

  async function refreshCountryList() {
    const active = await db.collection("datasets").where("active","==",true).get();
    const countries = [...new Set(active.docs.flatMap(doc => doc.data().countries || []))]
      .sort((a,b)=>a.localeCompare(b));
    await db.collection("system").doc("countries").set({
      values:countries,
      updatedAt:BRPortal.serverTimestamp()
    });
  }

  async function upload() {
    const datasetName = $("datasetName").value.trim();
    const reportType = $("reportType").value;
    if (!datasetName || !reportType || !state.rows.length || !state.chunks.length) {
      show("uploadStatus","Select a report type, enter a dataset name, and choose a workbook.","error");
      return;
    }

    const button = $("uploadButton");
    const datasetRef = db.collection("datasets").doc();
    const datasetId = datasetRef.id;
    let uploadedRows = 0;
    let uploadedChunks = 0;

    button.disabled = true;
    $("progress").hidden = false;
    $("progressBar").style.width = "0%";
    show("uploadStatus","Creating dataset…");

    try {
      await datasetRef.set({
        name:datasetName,
        reportType,
        reportingPeriod:$("reportingPeriod").value.trim(),
        fileName:state.file.name,
        sheets:state.sheets.map(sheet => ({name:sheet.name,rowCount:sheet.rowCount})),
        countries:state.countries,
        rowCount:state.rows.length,
        chunkCount:state.chunks.length,
        status:"uploading",
        active:false,
        uploadedBy:session.user.uid,
        uploadedByEmail:session.user.email,
        uploadedAt:BRPortal.serverTimestamp()
      });

      for (let start=0; start<state.chunks.length; start+=WRITES_PER_BATCH) {
        const batch = db.batch();
        state.chunks.slice(start,start + WRITES_PER_BATCH).forEach((chunk,index) => {
          const chunkRef = db.collection("reportChunks").doc();
          batch.set(chunkRef,{
            datasetId,
            reportType,
            country:chunk.country,
            chunkIndex:start + index,
            rowCount:chunk.rows.length,
            rows:chunk.rows,
            createdAt:BRPortal.serverTimestamp()
          });
        });
        await batch.commit();
        const completed = state.chunks.slice(start,start + WRITES_PER_BATCH);
        uploadedChunks += completed.length;
        uploadedRows += completed.reduce((sum,chunk)=>sum + chunk.rows.length,0);
        $("progressBar").style.width = `${Math.round(uploadedChunks / state.chunks.length * 100)}%`;
        show(
          "uploadStatus",
          `Uploaded ${uploadedRows.toLocaleString("en-US")} of ${state.rows.length.toLocaleString("en-US")} rows…`
        );
      }

      const previousActive = await db.collection("datasets").where("active","==",true).get();
      const activationBatch = db.batch();
      previousActive.docs
        .filter(doc => doc.data().reportType === reportType && doc.id !== datasetId)
        .forEach(doc => activationBatch.update(doc.ref,{active:false}));
      activationBatch.set(datasetRef,{
        status:"complete",
        active:true,
        completedAt:BRPortal.serverTimestamp(),
        uploadedRows,
        uploadedChunks
      },{merge:true});
      activationBatch.set(db.collection("system").doc("activeDatasets"),{
        [reportType]:datasetId,
        [`${reportType}Name`]:datasetName,
        updatedAt:BRPortal.serverTimestamp(),
        updatedBy:session.user.uid
      },{merge:true});
      await activationBatch.commit();
      await refreshCountryList();

      show(
        "uploadStatus",
        `${reportLabels[reportType]} uploaded and activated successfully.`,
        "success"
      );
      await loadDatasets();
    } catch (error) {
      await datasetRef.set({
        status:"failed",
        uploadedRows,
        uploadedChunks,
        error:String(error.message || error),
        completedAt:BRPortal.serverTimestamp()
      },{merge:true}).catch(()=>{});
      show("uploadStatus",error.message || "Upload failed.","error");
    } finally {
      button.disabled = false;
    }
  }

  async function activateDataset(datasetId,name,reportType) {
    const active = await db.collection("datasets").where("active","==",true).get();
    const batch = db.batch();
    active.docs
      .filter(doc => doc.data().reportType === reportType)
      .forEach(doc => batch.update(doc.ref,{active:false}));
    batch.update(db.collection("datasets").doc(datasetId),{active:true});
    batch.set(db.collection("system").doc("activeDatasets"),{
      [reportType]:datasetId,
      [`${reportType}Name`]:name,
      updatedAt:BRPortal.serverTimestamp(),
      updatedBy:session.user.uid
    },{merge:true});
    await batch.commit();
    await refreshCountryList();
    await loadDatasets();
  }

  async function loadDatasets() {
    const snap = await db.collection("datasets").orderBy("uploadedAt","desc").limit(50).get();
    const datasets = snap.docs.map(doc => ({id:doc.id,...doc.data()}));
    const target = $("datasetsTable");
    if (!datasets.length) {
      target.className = "portal-empty";
      target.textContent = "No datasets uploaded yet.";
      return;
    }
    target.className = "portal-table-wrap";
    target.innerHTML = `<table class="portal-table">
      <thead><tr><th>Report</th><th>Name</th><th>File</th><th>Rows</th><th>Writes</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${datasets.map(dataset => `<tr>
        <td>${escapeHtml(reportLabels[dataset.reportType] || dataset.reportType || "Legacy")}</td>
        <td>${escapeHtml(dataset.name || "Unnamed")}</td>
        <td>${escapeHtml(dataset.fileName || "—")}</td>
        <td>${Number(dataset.rowCount || 0).toLocaleString("en-US")}</td>
        <td>${Number(dataset.chunkCount || dataset.rowCount || 0).toLocaleString("en-US")}</td>
        <td>${dataset.active ? '<span class="portal-badge">Active</span>' : escapeHtml(dataset.status || "—")}</td>
        <td>${dataset.status === "complete" && !dataset.active && dataset.reportType
          ? `<button class="portal-button ghost activate-dataset" data-id="${dataset.id}" data-name="${escapeHtml(dataset.name || "")}" data-type="${dataset.reportType}" type="button">Activate</button>`
          : "—"}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  $("datasetsTable").addEventListener("click",async event => {
    const button = event.target.closest(".activate-dataset");
    if (!button) return;
    button.disabled = true;
    try {
      await activateDataset(button.dataset.id,button.dataset.name,button.dataset.type);
    } catch (error) {
      show("uploadStatus",error.message || "Could not activate the dataset.","error");
    }
  });

  $("logoutButton").addEventListener("click",BRPortal.signOut);
  $("reportType").addEventListener("change",async () => {
    if (!state.workbook || !state.file) return;
    await readFile(state.file);
  });
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
