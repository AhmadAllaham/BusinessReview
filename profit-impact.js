(() => {
  'use strict';

  const RATE = 0.709;
  const state = { sales: [], margins: [], currency: 'USD', sort: 'impact', asc: true };
  const ids = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const num = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim().replace(/,/g, '').replace(/^\((.*)\)$/, '-$1').replace(/%$/, '');
    const result = Number(text);
    return Number.isFinite(result) ? result : 0;
  };
  const keyNorm = value => norm(value).replace(/[^\p{L}\p{N}]+/gu, '');
  const read = (row, aliases) => {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(row || {}, alias)) return row[alias];
    }
    const wanted = new Set(aliases.map(keyNorm));
    const key = Object.keys(row || {}).find(item => wanted.has(keyNorm(item)));
    return key === undefined ? '' : row[key];
  };

  const fields = {
    country: ['Country','Country Name','Market','country'],
    agent: ['Agent','Sub Market','Submarket','Customer','Distributor','agent'],
    brand: ['__brand','Brand','Family','Product Family','Product Group','brand'],
    product: ['__product','Product Name','Product','SKU','product'],
    year: ['Year','Fiscal Year','year'],
    month: ['Month','Reporting Month','Period','month'],
    actual: ['__actual','Actual  Value','Actual Value','Actual'],
    budget: ['__budget','Budget  Value','Budget Value','Budget'],
    netSales: ['Net Sales USD','Net Sales','Budget Net Sales','netsales'],
    grossProfit: ['Gross Profit USD','Gross Profit','Budget Gross Profit','grossprofit']
  };

  function salesRow(row) {
    return {
      country: String(read(row, fields.country) || 'Unassigned').trim(),
      agent: String(read(row, fields.agent) || 'Unassigned').trim(),
      brand: String(read(row, fields.brand) || 'Unassigned').trim(),
      product: String(read(row, fields.product) || 'Unassigned').trim(),
      year: String(read(row, fields.year) || '').trim(),
      month: String(read(row, fields.month) || '').trim(),
      actual: num(read(row, fields.actual)),
      budget: num(read(row, fields.budget))
    };
  }

  function marginRow(row) {
    return {
      country: String(read(row, fields.country) || '').trim(),
      agent: String(read(row, fields.agent) || '').trim(),
      brand: String(read(row, fields.brand) || '').trim(),
      product: String(read(row, fields.product) || '').trim(),
      sales: num(read(row, fields.netSales)),
      gp: num(read(row, fields.grossProfit))
    };
  }

  function makeKey(country, agent, brand, product) {
    return [country, agent, brand, product].map(norm).join('|');
  }

  function marginIndex(rows) {
    const maps = [new Map(), new Map(), new Map(), new Map(), new Map()];
    const add = (map, key, row) => {
      if (!key.endsWith(`|${norm(row.product)}`) || !norm(row.product)) return;
      const item = map.get(key) || { sales: 0, gp: 0 };
      item.sales += row.sales;
      item.gp += row.gp;
      map.set(key, item);
    };
    rows.forEach(row => {
      add(maps[0], makeKey(row.country,row.agent,row.brand,row.product), row);
      add(maps[1], makeKey(row.country,'',row.brand,row.product), row);
      add(maps[2], makeKey(row.country,'','',row.product), row);
      add(maps[3], makeKey('','',row.brand,row.product), row);
      add(maps[4], makeKey('','','',row.product), row);
    });
    return maps;
  }

  function marginFor(row, maps) {
    const keys = [
      makeKey(row.country,row.agent,row.brand,row.product),
      makeKey(row.country,'',row.brand,row.product),
      makeKey(row.country,'','',row.product),
      makeKey('','',row.brand,row.product),
      makeKey('','','',row.product)
    ];
    for (let index = 0; index < maps.length; index += 1) {
      const item = maps[index].get(keys[index]);
      if (item && Math.abs(item.sales) > 1e-9) return item.gp / item.sales;
    }
    return null;
  }

  function unique(rows, key) {
    return [...new Set(rows.map(row => row[key]).filter(Boolean))].sort((a,b) => a.localeCompare(b,undefined,{numeric:true}));
  }

  function fillSelect(id, values, label) {
    const select = ids(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">All ${esc(label)}</option>${values.map(value => `<option>${esc(value)}</option>`).join('')}`;
    if (values.includes(current)) select.value = current;
  }

  function prepareFilters() {
    fillSelect('profitImpactYear', unique(state.sales,'year'), 'Years');
    fillSelect('profitImpactMonth', unique(state.sales,'month'), 'Months');
    fillSelect('profitImpactCountry', unique(state.sales,'country'), 'Markets');
    fillSelect('profitImpactAgent', unique(state.sales,'agent'), 'Agents');
    fillSelect('profitImpactBrand', unique(state.sales,'brand'), 'Product Groups');
    fillSelect('profitImpactProduct', unique(state.sales,'product'), 'Products');
  }

  function selectedRows() {
    const filters = [
      ['profitImpactYear','year'], ['profitImpactMonth','month'], ['profitImpactCountry','country'],
      ['profitImpactAgent','agent'], ['profitImpactBrand','brand'], ['profitImpactProduct','product']
    ];
    return state.sales.filter(row => filters.every(([id,key]) => !ids(id)?.value || row[key] === ids(id).value));
  }

  function buildAnalysis() {
    const maps = marginIndex(state.margins);
    const grouped = new Map();
    selectedRows().forEach(row => {
      const key = makeKey(row.country,row.agent,row.brand,row.product);
      const item = grouped.get(key) || {...row, actual:0, budget:0};
      item.actual += row.actual;
      item.budget += row.budget;
      grouped.set(key,item);
    });
    let unmatched = 0;
    const rows = [...grouped.values()].map(row => {
      const margin = marginFor(row,maps);
      if (margin === null) unmatched += 1;
      const variance = row.actual - row.budget;
      return {
        ...row, margin, variance,
        budgetGp: margin === null ? null : row.budget * margin,
        estimatedActualGp: margin === null ? null : row.actual * margin,
        impact: margin === null ? null : variance * margin
      };
    }).filter(row => row.margin !== null);
    const query = norm(ids('profitImpactSearch')?.value);
    return {
      unmatched,
      rows: query ? rows.filter(row => [row.product,row.brand,row.country,row.agent].some(value => norm(value).includes(query))) : rows
    };
  }

  function converted(value) { return value * (state.currency === 'JOD' ? RATE : 1); }
  function money(value) {
    if (value === null || !Number.isFinite(value)) return '—';
    const rounded = Math.round(converted(value) / 1000);
    return rounded < 0 ? `(${Math.abs(rounded).toLocaleString('en-US')})` : rounded.toLocaleString('en-US');
  }
  function percent(value) {
    if (!Number.isFinite(value)) return '—';
    const text = `${(Math.abs(value) * 100).toFixed(1)}%`;
    return value < 0 ? `(${text})` : text;
  }
  function marginClass(margin) {
    if (margin >= .5) return 'H'; if (margin >= .3) return 'M'; if (margin >= .2) return 'LH';
    if (margin >= .1) return 'LM'; if (margin >= 0) return 'LL'; return 'LS';
  }

  function render() {
    const result = buildAnalysis();
    const rows = [...result.rows];
    const direction = state.asc ? 1 : -1;
    rows.sort((a,b) => {
      const av = state.sort === 'product' ? a.product : Number(a[state.sort] ?? 0);
      const bv = state.sort === 'product' ? b.product : Number(b[state.sort] ?? 0);
      return typeof av === 'string' ? direction * av.localeCompare(bv) : direction * (av-bv);
    });
    const total = rows.reduce((sum,row) => sum + row.impact,0);
    const positive = rows.filter(row => row.impact > 0).reduce((best,row) => row.impact > (best?.impact ?? -Infinity) ? row : best,null);
    const negative = rows.filter(row => row.impact < 0).reduce((best,row) => row.impact < (best?.impact ?? Infinity) ? row : best,null);
    ids('profitImpactTotal').textContent = money(total);
    ids('profitImpactPositive').textContent = positive ? `${positive.product} · ${money(positive.impact)}` : '—';
    ids('profitImpactNegative').textContent = negative ? `${negative.product} · ${money(negative.impact)}` : '—';
    ids('profitImpactCoverage').textContent = `${rows.length.toLocaleString('en-US')} matched · ${result.unmatched.toLocaleString('en-US')} unmatched`;
    ids('profitImpactCurrencyLabel').textContent = `${state.currency} ’000`;
    ids('profitImpactCount').textContent = `${rows.length.toLocaleString('en-US')} products`;
    ids('profitImpactUnmatched').textContent = result.unmatched ? `${result.unmatched} product combinations were excluded because no Budget GP% match was found.` : 'All displayed product combinations have a Budget GP% match.';
    ids('profitImpactBody').innerHTML = rows.length ? rows.map(row => `<tr>
      <td>${esc(row.product)}</td><td>${esc(row.brand)}</td><td>${esc(row.country)}</td><td>${esc(row.agent)}</td>
      <td><span class="profit-impact-margin gp-${marginClass(row.margin).toLowerCase()}">${percent(row.margin)} · ${marginClass(row.margin)}</span></td>
      <td>${money(row.budget)}</td><td>${money(row.actual)}</td>
      <td class="${row.variance < 0 ? 'negative' : row.variance > 0 ? 'positive' : ''}">${money(row.variance)}</td>
      <td>${money(row.budgetGp)}</td><td>${money(row.estimatedActualGp)}</td>
      <td class="profit-impact-value ${row.impact < 0 ? 'negative' : row.impact > 0 ? 'positive' : ''}">${money(row.impact)}</td>
      <td><span class="profit-impact-badge ${row.impact < 0 ? 'negative' : row.impact > 0 ? 'positive' : 'neutral'}">${row.impact < 0 ? 'Negative' : row.impact > 0 ? 'Positive' : 'Neutral'}</span></td>
    </tr>`).join('') : '<tr><td class="profit-impact-empty" colspan="12">No matching products for the selected filters.</td></tr>';
    document.querySelectorAll('[data-profit-impact-sort]').forEach(th => {
      th.classList.toggle('sort-asc',state.sort === th.dataset.profitImpactSort && state.asc);
      th.classList.toggle('sort-desc',state.sort === th.dataset.profitImpactSort && !state.asc);
    });
  }

  function modalHtml() {
    return `<div id="profitImpactModal" class="profit-impact-modal" aria-hidden="true">
      <div class="profit-impact-backdrop" data-profit-impact-close></div>
      <section class="profit-impact-panel" role="dialog" aria-modal="true" aria-labelledby="profitImpactTitle">
        <header class="profit-impact-head"><div><span>TEST WINDOW · NOT YET APPROVED</span><h2 id="profitImpactTitle">Product Profitability Impact</h2><p>Impact of product sales variance using each product’s Budget GP%.</p></div><button type="button" data-profit-impact-close aria-label="Close">×</button></header>
        <div id="profitImpactLoading" class="profit-impact-loading">Loading Sales and Budget profitability data…</div>
        <div id="profitImpactContent" hidden>
          <div class="profit-impact-formula"><strong>GP Impact</strong> = (Actual Sales − Budget Sales) × Budget GP% <span>Estimated impact only — not Actual GP.</span></div>
          <div class="profit-impact-filters">
            <label>Year<select id="profitImpactYear"></select></label><label>Month<select id="profitImpactMonth"></select></label>
            <label>Market<select id="profitImpactCountry"></select></label><label>Agent<select id="profitImpactAgent"></select></label>
            <label>Product Group<select id="profitImpactBrand"></select></label><label>Product<select id="profitImpactProduct"></select></label>
            <label class="profit-impact-search">Search<input id="profitImpactSearch" type="search" placeholder="Search product or market"></label>
            <button id="profitImpactReset" type="button">Reset</button>
          </div>
          <div class="profit-impact-cards">
            <article><span>Total Estimated GP Impact</span><strong id="profitImpactTotal">—</strong></article>
            <article class="positive-card"><span>Largest Positive Impact</span><strong id="profitImpactPositive">—</strong></article>
            <article class="negative-card"><span>Largest Negative Impact</span><strong id="profitImpactNegative">—</strong></article>
            <article><span>Data Coverage</span><strong id="profitImpactCoverage">—</strong></article>
          </div>
          <div class="profit-impact-toolbar"><div><strong id="profitImpactCount">0 products</strong><span id="profitImpactUnmatched"></span></div><div class="profit-impact-currency"><span id="profitImpactCurrencyLabel">USD ’000</span><button class="active" data-profit-impact-currency="USD">USD</button><button data-profit-impact-currency="JOD">JOD</button></div></div>
          <div class="profit-impact-table-wrap"><table><thead><tr>
            <th data-profit-impact-sort="product">Product</th><th>Product Group</th><th>Market</th><th>Agent</th>
            <th data-profit-impact-sort="margin">Budget GP%</th><th data-profit-impact-sort="budget">Budget Sales</th><th data-profit-impact-sort="actual">Actual Sales</th>
            <th data-profit-impact-sort="variance">Sales Variance</th><th data-profit-impact-sort="budgetGp">Budget GP Value</th><th data-profit-impact-sort="estimatedActualGp">Estimated Actual GP Contribution</th>
            <th data-profit-impact-sort="impact" class="sort-asc">GP Impact</th><th>Impact</th>
          </tr></thead><tbody id="profitImpactBody"></tbody></table></div>
          <footer class="profit-impact-foot">This test view uses Budget GP% as a constant margin. It explains the impact of selling more or less of each product; it does not measure actual cost or actual product margin.</footer>
        </div>
      </section>
    </div>`;
  }

  async function open() {
    const modal = ids('profitImpactModal');
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('profit-impact-open');
    ids('profitImpactLoading').hidden = false; ids('profitImpactContent').hidden = true;
    try {
      if (typeof window.BREnsureProfitImpactData !== 'function') throw new Error('The data service is not ready yet. Please try again.');
      const source = await window.BREnsureProfitImpactData();
      state.sales = (source.sales || []).map(salesRow).filter(row => row.product && (row.actual || row.budget));
      state.margins = (source.profitability || []).map(marginRow).filter(row => row.product && (row.sales || row.gp));
      prepareFilters(); render(); ids('profitImpactLoading').hidden = true; ids('profitImpactContent').hidden = false;
    } catch (error) {
      ids('profitImpactLoading').textContent = error?.message || 'Unable to load the analysis data.';
      ids('profitImpactLoading').classList.add('error');
    }
  }
  function close() { const modal=ids('profitImpactModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('profit-impact-open'); }

  function init() {
    document.body.insertAdjacentHTML('beforeend',modalHtml());
    document.querySelectorAll('[data-profit-impact-open]').forEach(button => button.addEventListener('click',open));
    document.querySelectorAll('[data-profit-impact-close]').forEach(button => button.addEventListener('click',close));
    ['profitImpactYear','profitImpactMonth','profitImpactCountry','profitImpactAgent','profitImpactBrand','profitImpactProduct'].forEach(id => ids(id).addEventListener('change',render));
    ids('profitImpactSearch').addEventListener('input',render);
    ids('profitImpactReset').addEventListener('click',() => { document.querySelectorAll('#profitImpactModal select').forEach(select => {select.value='';}); ids('profitImpactSearch').value=''; render(); });
    document.querySelectorAll('[data-profit-impact-currency]').forEach(button => button.addEventListener('click',() => { state.currency=button.dataset.profitImpactCurrency; document.querySelectorAll('[data-profit-impact-currency]').forEach(item=>item.classList.toggle('active',item===button)); render(); }));
    document.querySelectorAll('[data-profit-impact-sort]').forEach(th => th.addEventListener('click',() => { const key=th.dataset.profitImpactSort; state.asc=state.sort===key?!state.asc:key==='impact'; state.sort=key; render(); }));
    document.addEventListener('keydown',event => { if(event.key==='Escape' && ids('profitImpactModal').classList.contains('open')) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
