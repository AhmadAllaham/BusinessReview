(async function () {
  'use strict';

  const session = await window.BRPortal?.requireSession?.({
    admin:true,
    next:'admin.html'
  });
  if (!session || !window.XLSX || !window.BRPortal?.db) return;

  const grid = document.querySelector('.portal-grid');
  if (!grid || document.getElementById('ksaHistoricalCard')) return;

  const card = document.createElement('section');
  card.id = 'ksaHistoricalCard';
  card.className = 'portal-card wide';
  card.innerHTML = `
    <div class="portal-card-head">
      <span class="portal-eyebrow">KSA Stock Level</span>
      <h2>Upload Saudi Historical Sales</h2>
    </div>
    <div class="portal-card-body">
      <p class="portal-note">
        Upload the workbook containing <b>2025 Sales</b> and <b>2026 Sales</b>.
        The system calculates each product using
        (Goods Qty 2025 + Goods Qty 2026 + Bonus Qty 2025 + Bonus Qty 2026) × Price 2026,
        then updates KSA only in the main Stock Level table.
      </p>
      <div class="portal-row">
        <div class="portal-field">
          <label for="ksaHistoricalPeriod">Reporting period</label>
          <input id="ksaHistoricalPeriod" placeholder="July 2026">
        </div>
        <div class="portal-field">
          <label for="ksaHistoricalFile">Sales workbook</label>
          <input id="ksaHistoricalFile" type="file" accept=".xlsx,.xls,.xlsm">
        </div>
      </div>
      <div class="portal-row portal-row-three">
        <div class="portal-field">
          <label>Total Historical Sales USD</label>
          <input id="ksaHistoricalTotal" value="0" disabled>
        </div>
        <div class="portal-field">
          <label>Included products</label>
          <input id="ksaHistoricalIncluded" value="0" disabled>
        </div>
        <div class="portal-field">
          <label>Missing 2026 price</label>
          <input id="ksaHistoricalExcluded" value="0" disabled>
        </div>
      </div>
      <div id="ksaHistoricalPreview" class="portal-empty">
        Select a workbook to calculate the KSA Historical Sales.
      </div>
      <div class="portal-actions">
        <button id="ksaHistoricalUpload" class="portal-button" type="button" disabled>
          Upload and activate for KSA
        </button>
      </div>
      <div id="ksaHistoricalStatus" class="portal-status"></div>
      <div id="ksaHistoricalCurrent" class="portal-status"></div>
    </div>`;

  const historyCard = [...grid.children].find(element =>
    element.querySelector?.('.portal-eyebrow')?.textContent.trim() === 'History'
  );
  grid.insertBefore(card, historyCard || null);

  const $ = id => document.getElementById(id);
  const state = { file:null, result:null };
  const FORMULA =
    '(Goods Qty 2025 + Goods Qty 2026 + Bonus Qty 2025 + Bonus Qty 2026) × Price 2026';

  function show(message,type='') {
    const element = $('ksaHistoricalStatus');
    element.textContent = message;
    element.className = `portal-status show ${type}`.trim();
  }

  function normalizeHeader(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/&/g,'and')
      .replace(/[^a-z0-9]+/g,'');
  }

  function numberValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    const parsed = Number(
      text
        .replace(/,/g,'')
        .replace(/^\((.*)\)$/,'-$1')
        .replace(/[^0-9.-]/g,'')
    );
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isKsaCustomer(value) {
    const identity = normalizeHeader(value);
    return identity.includes('saudi') || identity.includes('ksa');
  }

  function findHeaderIndex(matrix) {
    const required = [
      'customer','productgroup','productname',
      'goodsquantity','goodsvalue','bonusquantity'
    ];
    return matrix.findIndex(row => {
      const headers = new Set(row.map(normalizeHeader));
      return required.every(header => headers.has(header));
    });
  }

  function readSheet(workbook,sheetName,year) {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{
      header:1,
      defval:'',
      raw:true,
      cellDates:true
    });
    const headerIndex = findHeaderIndex(matrix);
    if (headerIndex < 0) {
      throw new Error(
        `${year} sheet is missing Customer, Product Group, Product Name, Goods Quantity, Goods Value, or Bonus Quantity.`
      );
    }

    const headers = matrix[headerIndex].map(normalizeHeader);
    const column = name => headers.indexOf(normalizeHeader(name));
    const customerIndex = column('Customer');
    const groupIndex = column('Product Group');
    const productIndex = column('Product Name');
    const goodsQtyIndex = column('Goods Quantity');
    const goodsValueIndex = column('Goods Value');
    const bonusQtyIndex = column('Bonus Quantity');
    const products = new Map();
    let sourceRows = 0;

    matrix.slice(headerIndex + 1).forEach(row => {
      if (!isKsaCustomer(row[customerIndex])) return;
      const product = String(row[productIndex] ?? '').trim();
      if (!product || /^total\b/i.test(product)) return;
      const group = String(row[groupIndex] ?? '').trim() || 'Unassigned';
      if (!products.has(product)) {
        products.set(product,{
          product,
          group,
          goodsQty:0,
          goodsValue:0,
          bonusQty:0
        });
      }
      const item = products.get(product);
      if (item.group === 'Unassigned' && group !== 'Unassigned') item.group = group;
      item.goodsQty += numberValue(row[goodsQtyIndex]);
      item.goodsValue += numberValue(row[goodsValueIndex]);
      item.bonusQty += numberValue(row[bonusQtyIndex]);
      sourceRows += 1;
    });

    if (!sourceRows) throw new Error(`No Saudi rows were found in the ${year} sheet.`);
    return { products, sourceRows };
  }

  function findYearSheet(workbook,year) {
    const exact = workbook.SheetNames.find(name =>
      new RegExp(`(^|\\D)${year}(\\D|$)`).test(String(name))
    );
    if (exact) return exact;
    throw new Error(`A worksheet containing ${year} in its name was not found.`);
  }

  function calculate(workbook) {
    const sheet2025 = findYearSheet(workbook,2025);
    const sheet2026 = findYearSheet(workbook,2026);
    const data2025 = readSheet(workbook,sheet2025,2025);
    const data2026 = readSheet(workbook,sheet2026,2026);
    const productNames = new Set([
      ...data2025.products.keys(),
      ...data2026.products.keys()
    ]);
    const groups = new Map();
    const excluded = [];
    let totalUsd = 0;
    let includedProducts = 0;

    productNames.forEach(product => {
      const previous = data2025.products.get(product) || {
        group:'Unassigned',goodsQty:0,goodsValue:0,bonusQty:0
      };
      const current = data2026.products.get(product) || {
        group:'Unassigned',goodsQty:0,goodsValue:0,bonusQty:0
      };
      const currentGoodsQty = Number(current.goodsQty) || 0;
      const currentGoodsValue = Number(current.goodsValue) || 0;
      if (!currentGoodsQty) {
        excluded.push(product);
        return;
      }

      const price2026 = currentGoodsValue / currentGoodsQty;
      if (!Number.isFinite(price2026)) {
        excluded.push(product);
        return;
      }

      const totalQty =
        (Number(previous.goodsQty) || 0) +
        currentGoodsQty +
        (Number(previous.bonusQty) || 0) +
        (Number(current.bonusQty) || 0);
      const historicalSales = totalQty * price2026;
      const group = String(current.group || previous.group || 'Unassigned').trim() || 'Unassigned';

      groups.set(group,(groups.get(group) || 0) + historicalSales);
      totalUsd += historicalSales;
      includedProducts += 1;
    });

    const groupRows = [...groups.entries()]
      .map(([name,value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    if (!includedProducts) {
      throw new Error('No products with a valid 2026 selling price were found for Saudi Arabia.');
    }

    return {
      totalUsd,
      groups:groupRows,
      includedProducts,
      excludedProducts:excluded,
      excludedProductsWithout2026Price:excluded.length,
      sourceRows2025:data2025.sourceRows,
      sourceRows2026:data2026.sourceRows,
      sheet2025,
      sheet2026
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g,char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    })[char]);
  }

  function renderResult(result) {
    $('ksaHistoricalTotal').value = result.totalUsd.toLocaleString('en-US',{
      minimumFractionDigits:2,
      maximumFractionDigits:2
    });
    $('ksaHistoricalIncluded').value = result.includedProducts.toLocaleString('en-US');
    $('ksaHistoricalExcluded').value = result.excludedProductsWithout2026Price.toLocaleString('en-US');
    $('ksaHistoricalPreview').className = 'portal-table-wrap';
    $('ksaHistoricalPreview').innerHTML = `<table class="portal-table">
      <thead><tr><th>Product Group</th><th>Historical Sales USD</th></tr></thead>
      <tbody>${result.groups.map(group => `<tr>
        <td>${escapeHtml(group.name)}</td>
        <td>${group.value.toLocaleString('en-US',{
          minimumFractionDigits:2,
          maximumFractionDigits:2
        })}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  $('ksaHistoricalFile').addEventListener('change',async event => {
    const file = event.target.files?.[0];
    state.file = file || null;
    state.result = null;
    $('ksaHistoricalUpload').disabled = true;
    if (!file) return;

    try {
      show('Reading and calculating Saudi Historical Sales…');
      const workbook = XLSX.read(await file.arrayBuffer(),{
        type:'array',
        cellDates:true
      });
      state.result = calculate(workbook);
      renderResult(state.result);
      $('ksaHistoricalUpload').disabled = false;
      show(
        `Ready: ${state.result.totalUsd.toLocaleString('en-US',{
          minimumFractionDigits:2,
          maximumFractionDigits:2
        })} USD.`,
        'success'
      );
    } catch (error) {
      console.error(error);
      show(error.message || 'Unable to calculate the KSA Historical Sales.','error');
    }
  });

  $('ksaHistoricalUpload').addEventListener('click',async () => {
    if (!state.file || !state.result) return;
    const button = $('ksaHistoricalUpload');
    button.disabled = true;
    try {
      show('Uploading and activating KSA Historical Sales…');
      const period = String($('ksaHistoricalPeriod').value || '').trim();
      await BRPortal.db.collection('system').doc('ksaHistoricalSales').set({
        schemaVersion:1,
        country:'KSA',
        reportingPeriod:period,
        sourceFile:state.file.name,
        totalUsd:state.result.totalUsd,
        groups:state.result.groups,
        formula:FORMULA,
        includedProducts:state.result.includedProducts,
        excludedProductsWithout2026Price:
          state.result.excludedProductsWithout2026Price,
        excludedProducts:state.result.excludedProducts,
        sourceRows2025:state.result.sourceRows2025,
        sourceRows2026:state.result.sourceRows2026,
        sourceSheet2025:state.result.sheet2025,
        sourceSheet2026:state.result.sheet2026,
        uploadedByUid:session.user.uid,
        uploadedByEmail:session.user.email || '',
        uploadedAt:BRPortal.serverTimestamp()
      },{merge:false});

      show(
        `Activated ${state.result.totalUsd.toLocaleString('en-US',{
          minimumFractionDigits:2,
          maximumFractionDigits:2
        })} USD for KSA Stock Level.`,
        'success'
      );
      loadCurrentUpload();
    } catch (error) {
      console.error(error);
      show(error.message || 'Unable to upload KSA Historical Sales.','error');
    } finally {
      button.disabled = !state.result;
    }
  });

  async function loadCurrentUpload() {
    const element = $('ksaHistoricalCurrent');
    try {
      const snapshot = await BRPortal.db.collection('system').doc('ksaHistoricalSales').get();
      if (!snapshot.exists) {
        element.textContent = 'No uploaded KSA Historical Sales yet; the dashboard is using its initial fallback value.';
        element.className = 'portal-status show';
        return;
      }
      const data = snapshot.data() || {};
      const total = numberValue(data.totalUsd);
      const period = String(data.reportingPeriod || 'Period not specified');
      const source = String(data.sourceFile || 'Unknown file');
      element.textContent = `Current active: ${total.toLocaleString('en-US',{
        minimumFractionDigits:2,
        maximumFractionDigits:2
      })} USD · ${period} · ${source}`;
      element.className = 'portal-status show success';
    } catch (error) {
      console.error(error);
      element.textContent = 'Unable to read the currently active KSA Historical Sales.';
      element.className = 'portal-status show error';
    }
  }

  loadCurrentUpload();
})();
