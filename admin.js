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
    profitability:"Budget 2026 · Product Profitability",
    stock:"Stock Level",
    nearlyExpired:"Stock Level · Nearly Expired",
    sm:"Selling & Marketing Expenses",
    pnl:"P&L",
    dadAlgeria:"DAD Algeria · P&L + S&M + G&A + Stock Level"
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
      "grosssales","netsales","return","salesreturns","actualreturn","actualreturns",
      "expectedreturn","expectedreturns","discounts","commissions",
      "cogs","actualcogs","goodscogs","foccogs","costofgoodssold",
      "grossprofit","sellingandmarketing",
      "sm","netincome","netprofit"
    ]);
    return matrix.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return headers.some(header => scenarioNames.has(header)) &&
        headers.some(header => marketNames.has(header)) &&
        headers.some(header => metricNames.has(header));
    });
  }

  function stockHeaderIndex(matrix) {
    const required = [
      "country","agent","brand","sku","stock","historicalsales","forecastsales"
    ];
    return matrix.findIndex(row => {
      const headers = new Set(row.map(normalizeHeader));
      return required.every(header => headers.has(header));
    });
  }

  function nearlyExpiredHeaderIndex(matrix) {
    const required = [
      "country","partyname","itemdescription","unitprice",
      "nearlyexpiredgoods6month","nearlyexpired6m"
    ];
    return matrix.findIndex(row => {
      const headers = new Set(row.map(normalizeHeader));
      return required.every(header => headers.has(header));
    });
  }

  function profitabilityHeaderIndex(matrix) {
    const required = ["market","brand","sku","netsalesusd","grossprofitusd"];
    return matrix.findIndex(row => {
      const headers = new Set(row.map(normalizeHeader));
      return required.every(header => headers.has(header));
    });
  }

  function canonicalCountry(value) {
    const raw = String(value ?? "").trim();
    const key = normalizeHeader(raw);
    const known = {
      bahrain:"Bahrain",
      iraq:"Iraq",
      jordan:"Jordan",
      kuwait:"Kuwait",
      lebanon:"Lebanon",
      libya:"Libya",
      oman:"Oman",
      qatar:"Qatar",
      ksa:"KSA",
      saudiarabia:"KSA",
      uae:"UAE",
      unitedarabemirates:"UAE"
    };
    if (known[key]) return known[key];
    return raw.toLowerCase().replace(/(^|[\s-])\S/g,letter => letter.toUpperCase());
  }

  function numberValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const parsed = Number(
      text.replace(/,/g,"").replace(/^\((.*)\)$/, "-$1").replace(/[^0-9.-]/g,"")
    );
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function stockPayload(headers,values) {
    const source = Object.fromEntries(headers.map((header,index) => [
      normalizeHeader(header),normalizeValue(values[index])
    ]));
    const read = (...names) => {
      const key = names.map(normalizeHeader).find(name => Object.hasOwn(source,name));
      return key ? source[key] : "";
    };
    const brand = String(read("brand","product group") || "Unassigned").trim();
    return {
      Country:canonicalCountry(read("country","country name","market")),
      Agent:String(read("agent","customer","distributor") || "").trim(),
      Brand:brand,
      SKU:String(read("sku","product","product name") || "").trim(),
      "Product Group":String(read("product group","group") || brand).trim(),
      Month:String(read("month","reporting month","period") || "").trim(),
      "Stock $":numberValue(read("stock","stock $","stock value")),
      "Historical Sales $":numberValue(read("historical sales","historical sales $")),
      "Forecast Sales $":numberValue(read("forecast sales","forecast sales $","forcast sales"))
    };
  }

  function nearlyExpiredPayload(headers,values) {
    const entries = headers.map((header,index) => ({
      raw:String(header || "").trim(),
      key:normalizeHeader(header),
      value:normalizeValue(values[index])
    }));
    const read = (...names) => {
      const normalized = names.map(normalizeHeader);
      return entries.find(entry => normalized.includes(entry.key))?.value ?? "";
    };
    const unitPrice = numberValue(read("unit price","price"));
    const withinSixQty = numberValue(read("nearly expired goods 6 month"));
    const sixPlusQty = numberValue(read("nearly expired 6m +","nearly expired 6m"));
    const agentStockQty = numberValue(read(
      "june agent stock","agent stock","agent stock qty","stock quantity"
    ));
    const withinSixValue = withinSixQty * unitPrice;
    const sixPlusValue = sixPlusQty * unitPrice;
    return {
      Country:canonicalCountry(read("country","country name","market")),
      Agent:String(read("party name","agent","customer","distributor") || "").trim(),
      Item:String(read("item description","product","product name","sku") || "").trim(),
      "Unit Price":unitPrice,
      "Agent Stock Qty":agentStockQty,
      "Nearly Expired Within 6M Qty":withinSixQty,
      "Nearly Expired 6M+ Qty":sixPlusQty,
      "Nearly Expired Within 6M Value":withinSixValue,
      "Nearly Expired 6M+ Value":sixPlusValue,
      "Total Nearly Expired Qty":withinSixQty + sixPlusQty,
      "Total Nearly Expired Value":withinSixValue + sixPlusValue
    };
  }

  function profitabilityPayload(headers,values) {
    const source = Object.fromEntries(headers.map((header,index) => [
      normalizeHeader(header),normalizeValue(values[index])
    ]));
    const read = (...names) => {
      const key = names.map(normalizeHeader).find(name => Object.hasOwn(source,name));
      return key ? source[key] : "";
    };
    return {
      Country:canonicalCountry(read("market","country","country name")),
      Agent:String(read("sub market","agent","customer","distributor") || "").trim(),
      Brand:String(read("brand","product group") || "Unassigned").trim(),
      Product:String(read("sku","product","product name") || "").trim(),
      "Net Sales USD":numberValue(read("net sales usd","net sales")),
      "Gross Profit USD":numberValue(read("gross profit usd","gross profit"))
    };
  }

  function dadAlgeriaRows(matrix,sheetName,report) {
    const headerIndex = matrix.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return headers.includes("actual") && headers.includes("budget") && headers.includes("ly");
    });
    if (headerIndex < 0) return [];

    const headers = matrix[headerIndex].map(normalizeHeader);
    const actualIndex = headers.indexOf("actual");
    const budgetIndex = headers.indexOf("budget");
    const lyIndex = headers.indexOf("ly");
    let labelIndex = headers.indexOf("expensescategory");
    if (labelIndex < 0) {
      labelIndex = matrix[headerIndex].findIndex((value,index) =>
        index < Math.min(actualIndex,budgetIndex,lyIndex) && String(value ?? "").trim()
      );
    }
    if (labelIndex < 0) labelIndex = Math.max(0,actualIndex - 1);

    return matrix.slice(headerIndex + 1).map((values,index) => {
      const line = String(values[labelIndex] ?? "").trim();
      if (!line) return null;
      return {
        sheetName,
        rowNumber:headerIndex + index + 2,
        country:"Algeria",
        payload:{
          Country:"Algeria",
          Report:report,
          Line:line,
          Actual:numberValue(values[actualIndex]),
          Budget:numberValue(values[budgetIndex]),
          LY:numberValue(values[lyIndex]),
          "Display Order":index + 1
        }
      };
    }).filter(Boolean);
  }

  function dadAlgeriaFinalRows(matrix,sheetName) {
    const headerIndex = matrix.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return headers.includes("scenario") &&
        headers.includes("grosssales") &&
        headers.includes("netsales") &&
        headers.includes("grossprofit");
    });
    if (headerIndex < 0) return [];

    const rawHeaders = matrix[headerIndex].map(value => String(value ?? "").trim());
    const headers = rawHeaders.map(normalizeHeader);
    const scenarioIndex = headers.indexOf("scenario");
    const dimensionHeaders = new Set([
      "salestype","market","country","countryname","agent","scenario","period","version"
    ]);
    const metricIndexes = headers
      .map((header,index) => ({header,index}))
      .filter(item => item.header && !dimensionHeaders.has(item.header));
    const scenarioRows = {actual:[],budget:[],ly:[],fyBudget:[]};

    matrix.slice(headerIndex + 1).forEach(values => {
      const scenario = normalizeHeader(values[scenarioIndex]);
      const key = scenario === "actual" || scenario.startsWith("actual")
        ? "actual"
        : scenario === "fybudget" || scenario.includes("fullyearbudget") || scenario === "budgetfy"
          ? "fyBudget"
          : scenario === "budget" || scenario === "budgetytd" || scenario.startsWith("budgetytd")
            ? "budget"
            : scenario === "ly" || scenario.startsWith("ly") || scenario.includes("lastyear")
              ? "ly"
              : "";
      if (key) scenarioRows[key].push(values);
    });

    if (!scenarioRows.actual.length || !scenarioRows.budget.length || !scenarioRows.ly.length) {
      return [];
    }
    if (!scenarioRows.fyBudget.length) {
      throw new Error("P&L final requires a Scenario row named FY Budget. Check the Scenario column before uploading.");
    }

    const scenarioTotal = (scenario,index) => scenarioRows[scenario]
      .reduce((sum,values) => sum + numberValue(values[index]),0);

    return metricIndexes.map(({index},order) => ({
      sheetName,
      rowNumber:headerIndex + 2,
      country:"Algeria",
      payload:{
        Country:"Algeria",
        Report:"pnl",
        Line:rawHeaders[index],
        Actual:scenarioTotal("actual",index),
        Budget:scenarioTotal("budget",index),
        LY:scenarioTotal("ly",index),
        "FY Budget":scenarioTotal("fyBudget",index),
        "Display Order":order + 1
      }
    }));
  }

  function dadAlgeriaStockRows(matrix,sheetName) {
    const headerIndex = stockHeaderIndex(matrix);
    if (headerIndex < 0) return [];
    const headers = matrix[headerIndex].map((value,index) =>
      String(value || `Column ${index + 1}`).trim()
    );
    return matrix.slice(headerIndex + 1)
      .filter(values => values.some(value => String(value ?? "").trim() !== ""))
      .map((values,index) => {
        const stock = stockPayload(headers,values);
        if (!stock.Brand && !stock.SKU) return null;
        return {
          sheetName,
          rowNumber:headerIndex + index + 2,
          country:"Algeria",
          payload:{
            ...stock,
            Country:"Algeria",
            Report:"stock",
            "Display Order":index + 1
          }
        };
      })
      .filter(Boolean);
  }

  function parseDadAlgeriaWorkbook(workbook) {
    const parsedSheets = [];
    const rows = [];
    const finalPnlSheet = workbook.SheetNames.find(sheetName => {
      const name = normalizeHeader(sheetName);
      return name === "pandlfinal" || name === "pnlfinal";
    });
    workbook.SheetNames.forEach(sheetName => {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{
        header:1,defval:"",raw:true,cellDates:true
      });
      const name = normalizeHeader(sheetName);
      let report = "";
      const isFinalPnl = sheetName === finalPnlSheet;
      if (isFinalPnl) report = "pnlFinal";
      else if (!finalPnlSheet && (name.includes("plalgeria") || name.includes("pandlalgeria"))) report = "pnl";
      else if (name.includes("smexpenses") || name.includes("sandmexpenses")) report = "sm";
      else if (name.includes("gaexpenses") || name.includes("gandaexpenses")) report = "ga";
      else if (name.includes("stocklevel")) report = "stock";
      if (!report) return;

      const sheetRows = report === "pnlFinal"
        ? dadAlgeriaFinalRows(matrix,sheetName)
        : report === "stock"
          ? dadAlgeriaStockRows(matrix,sheetName)
          : dadAlgeriaRows(matrix,sheetName,report);
      if (!sheetRows.length) return;
      parsedSheets.push({
        name:sheetName,
        rowCount:sheetRows.length,
        headers:Object.keys(sheetRows[0].payload)
      });
      rows.push(...sheetRows);
    });

    const reports = new Set(rows.map(row => row.payload.Report));
    if (!reports.has("pnl") || !reports.has("sm") || !reports.has("ga") || !reports.has("stock")) {
      throw new Error("DAD Algeria requires P&L final, S&M Expenses, G&A Expenses, and Stock Level sheets.");
    }
    return {sheets:parsedSheets,rows,countries:["Algeria"]};
  }

  function headerValue(row,names) {
    const key = Object.keys(row).find(item =>
      names.map(normalizeHeader).includes(normalizeHeader(item))
    );
    return key ? String(row[key] ?? "").trim() : "";
  }

  function parseWorkbook(workbook,reportType) {
    if (reportType === "dadAlgeria") return parseDadAlgeriaWorkbook(workbook);
    const parsedSheets = [];
    const allRows = [];
    const countrySet = new Set();

    workbook.SheetNames.forEach(sheetName => {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{
        header:1,defval:"",raw:true,cellDates:true
      });
      const headerIndex = reportType === "pnl"
        ? pnlHeaderIndex(matrix)
        : reportType === "profitability"
          ? profitabilityHeaderIndex(matrix)
        : reportType === "stock"
          ? stockHeaderIndex(matrix)
          : reportType === "nearlyExpired"
            ? nearlyExpiredHeaderIndex(matrix)
            : firstNonEmptyRow(matrix);
      if (headerIndex < 0) return;
      const headers = matrix[headerIndex].map((value,index) =>
        String(value || `Column ${index + 1}`).trim()
      );
      const rows = matrix.slice(headerIndex + 1)
        .filter(row => row.some(value => String(value ?? "").trim() !== ""))
        .map((values,index) => {
          const payload = reportType === "stock"
            ? stockPayload(headers,values)
            : reportType === "nearlyExpired"
              ? nearlyExpiredPayload(headers,values)
              : reportType === "profitability"
                ? profitabilityPayload(headers,values)
              : Object.fromEntries(headers.map((header,columnIndex) => [
                header,normalizeValue(values[columnIndex])
              ]));
          const rawCountry = headerValue(payload,["country","country name","market"]);
          const country = rawCountry && !/^total\b/i.test(rawCountry)
            ? rawCountry
            : "__GLOBAL__";
          return {
            sheetName,
            rowNumber:headerIndex + index + 2,
            country,
            payload
          };
        })
        .filter(row => reportType !== "profitability" || (
          row.payload.Product && (
            numberValue(row.payload["Net Sales USD"]) !== 0 ||
            numberValue(row.payload["Gross Profit USD"]) !== 0
          )
        ));
      rows.forEach(row=>{
        if (row.country !== "__GLOBAL__") countrySet.add(row.country);
      });
      parsedSheets.push({name:sheetName,rowCount:rows.length,headers});
      allRows.push(...rows);
    });

    if (reportType === "pnl" && !parsedSheets.length) {
      throw new Error(
        "No valid P&L table was found. The header must include Scenario/Period, Market/Country, and P&L value columns."
      );
    }
    if (reportType === "stock" && !parsedSheets.length) {
      throw new Error(
        "No valid Stock Level table was found. Required columns: Country, Agent, Brand, SKU, Stock, Historical Sales, and Forecast Sales."
      );
    }
    if (reportType === "nearlyExpired" && !parsedSheets.length) {
      throw new Error(
        "No valid Nearly Expired table was found. Required columns: Country, Party Name, Item Description, Unit Price, Nearly Expired Goods 6 Month, and Nearly Expired 6M+."
      );
    }
    if (reportType === "profitability" && !parsedSheets.length) {
      throw new Error(
        "No valid profitability table was found. Required columns: Market, Brand, SKU, Net Sales USD, and Gross Profit USD."
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
    const reportingPeriod = $("reportingPeriod").value.trim();
    if (!datasetName || !reportType || !state.rows.length || !state.chunks.length) {
      show("uploadStatus","Select a report type, enter a dataset name, and choose a workbook.","error");
      return;
    }
    if (reportType === "stock" && !reportingPeriod) {
      show("uploadStatus","Enter the Stock Level reporting period so the Month filter can be populated.","error");
      $("reportingPeriod").focus();
      return;
    }

    const uploadRows = reportType === "stock"
      ? state.rows.map(row => ({
        ...row,
        payload:{...row.payload,Month:row.payload.Month || reportingPeriod}
      }))
      : state.rows;
    const uploadChunks = reportType === "stock" ? buildChunks(uploadRows) : state.chunks;

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
        reportingPeriod,
        fileName:state.file.name,
        sheets:state.sheets.map(sheet => ({name:sheet.name,rowCount:sheet.rowCount})),
        countries:state.countries,
        rowCount:uploadRows.length,
        chunkCount:uploadChunks.length,
        status:"uploading",
        active:false,
        uploadedBy:session.user.uid,
        uploadedByEmail:session.user.email,
        uploadedAt:BRPortal.serverTimestamp()
      });

      for (let start=0; start<uploadChunks.length; start+=WRITES_PER_BATCH) {
        const batch = db.batch();
        uploadChunks.slice(start,start + WRITES_PER_BATCH).forEach((chunk,index) => {
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
        const completed = uploadChunks.slice(start,start + WRITES_PER_BATCH);
        uploadedChunks += completed.length;
        uploadedRows += completed.reduce((sum,chunk)=>sum + chunk.rows.length,0);
        $("progressBar").style.width = `${Math.round(uploadedChunks / uploadChunks.length * 100)}%`;
        show(
          "uploadStatus",
          `Uploaded ${uploadedRows.toLocaleString("en-US")} of ${uploadRows.length.toLocaleString("en-US")} rows…`
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
