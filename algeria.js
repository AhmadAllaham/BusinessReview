(function initDadAlgeria(){
  'use strict';

  const byId=id=>document.getElementById(id);
  const USD_TO_JOD=0.709;
  const state={currency:'USD',pnlComparison:'standard',pnl:[],sm:[],ga:[],stock:[],stockBrand:'',fileName:''};

  function normalizeText(value){
    return String(value??'')
      .normalize('NFKC')
      .trim()
      .replace(/&/g,' and ')
      .replace(/[^a-zA-Z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .toLowerCase();
  }

  function compact(value){return normalizeText(value).replace(/\s/g,'');}

  function readNumber(value){
    if(value===null||value===undefined||value==='') return 0;
    if(typeof value==='number') return Number.isFinite(value)?value:0;
    let text=String(value).trim().replace(/,/g,'').replace(/\s/g,'');
    const negative=/^\(.*\)$/.test(text);
    text=text.replace(/[()]/g,'').replace(/[^0-9.+-]/g,'');
    const number=Number(text);
    if(!Number.isFinite(number)) return 0;
    return negative?-Math.abs(number):number;
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>'"]/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[char]));
  }

  function findSheet(workbook,type){
    const names=workbook.SheetNames||[];
    const tests={
      pnl:name=>name.includes('p and l')||name.includes('pnl')||
        (name.includes('profit')&&name.includes('loss')),
      sm:name=>name.includes('s and m')||name.includes('sm expenses')||
        (name.includes('selling')&&name.includes('marketing')),
      ga:name=>name.includes('g and a')||name.includes('ga expenses')||
        (name.includes('general')&&name.includes('administrative'))
    };
    return names.find(sheetName=>tests[type](normalizeText(sheetName)))||'';
  }

  function scenarioColumns(rows){
    let best=null;
    rows.forEach((row,rowIndex)=>{
      const cells=(row||[]).map(normalizeText);
      const actual=cells.findIndex(cell=>cell==='actual'||cell.startsWith('actual '));
      const budget=cells.findIndex(cell=>cell==='budget'||cell.startsWith('budget '));
      const ly=cells.findIndex(cell=>
        cell==='ly'||cell.startsWith('ly ')||cell.includes('last year')||cell==='2025'
      );
      const score=(actual>=0?1:0)+(budget>=0?1:0)+(ly>=0?1:0);
      if(!best||score>best.score) best={rowIndex,actual,budget,ly,score};
    });
    if(!best||best.actual<0||best.budget<0){
      throw new Error('Actual and Budget columns were not found.');
    }
    if(best.ly<0){
      const row=rows[best.rowIndex]||[];
      best.ly=row.findIndex((_,index)=>index>Math.max(best.actual,best.budget));
    }
    return best;
  }

  function labelColumn(rows,headerIndex,metricIndexes){
    const firstMetric=Math.min(...metricIndexes.filter(index=>index>=0));
    let bestIndex=0;
    let bestScore=-1;
    for(let column=0;column<firstMetric;column+=1){
      let score=0;
      for(let rowIndex=headerIndex+1;rowIndex<Math.min(rows.length,headerIndex+80);rowIndex+=1){
        const value=rows[rowIndex]?.[column];
        const text=String(value??'').trim();
        if(text&&Number.isNaN(Number(text.replace(/,/g,'')))) score+=1;
      }
      if(score>bestScore){bestScore=score;bestIndex=column;}
    }
    return bestIndex;
  }

  function parseStatementSheet(workbook,sheetName){
    if(!sheetName) return [];
    const rows=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{
      header:1,defval:'',raw:true,blankrows:false
    });
    const columns=scenarioColumns(rows);
    const labelIndex=labelColumn(rows,columns.rowIndex,[columns.actual,columns.budget,columns.ly]);
    const output=[];
    for(let index=columns.rowIndex+1;index<rows.length;index+=1){
      const row=rows[index]||[];
      const label=String(row[labelIndex]??'').trim();
      if(!label) continue;
      const key=normalizeText(label);
      if(!key||key.includes('%')||key.includes('ratio')) continue;
      const actual=readNumber(row[columns.actual]);
      const budget=readNumber(row[columns.budget]);
      const ly=columns.ly>=0?readNumber(row[columns.ly]):0;
      if(!actual&&!budget&&!ly&&!/(sales|profit|cost|expenses|income|margin|return|discount|ristourne|resoutne|total)/i.test(label)) continue;
      output.push({label,actual,budget,ly,key,order:index});
    }
    return output;
  }

  function converted(value){
    return value*(state.currency==='JOD'?USD_TO_JOD:1);
  }

  function formatAmount(value){
    const number=converted(value);
    const rounded=Math.abs(number)<100?number.toFixed(1):Math.round(number).toLocaleString('en-US');
    return number<0&&rounded==='0.0'?'-0.0':rounded;
  }

  function formatPercent(value){
    if(!Number.isFinite(value)) return '—';
    return `${(value*100).toFixed(1)}%`;
  }

  function variancePercent(variance,comparison){
    if(!comparison) return variance?'—':'0.0%';
    return formatPercent(variance/Math.abs(comparison));
  }

  function amountClass(value){return value<0?'pnl-amount-negative':'';}
  function varianceClass(value){return value>0?'pnl-positive positive':value<0?'pnl-negative negative':'';}
  function expenseVarianceClass(value){return value>0?'sm-good':value<0?'sm-bad':'sm-zero';}

  function isTotalRow(row){
    return /(^total\b|gross sales|net sales|gross profit|operating profit|net income|profit before|profit for(?: the)? year)/.test(row.key);
  }

  function statementHeader(firstLabel,expenseFormat=false){
    const currency=`${state.currency} '000`;
    if(expenseFormat){
      return `<thead>
        <tr class="sm-statement-group-head">
          <th rowspan="2">${escapeHtml(firstLabel)}</th>
          <th class="sm-actual-head" rowspan="2">Actual<br><small>${currency}</small></th>
          <th rowspan="2">Budget<br><small>${currency}</small></th>
          <th class="sm-statement-group" colspan="2">Vs. Budget</th>
          <th rowspan="2">LY<br><small>${currency}</small></th>
          <th class="sm-statement-group" colspan="2">Vs. Last Year</th>
        </tr>
        <tr class="sm-statement-column-head"><th>${currency}</th><th>%</th><th>${currency}</th><th>%</th></tr>
      </thead>`;
    }
    if(state.pnlComparison==='fyBudget'){
      return `<thead>
        <tr class="pnl-group-head pnl-fy-budget-head">
          <th>${escapeHtml(firstLabel)}</th>
          <th>Actual<br><small>${currency}</small></th>
          <th>FY Budget<br><small>${currency}</small></th>
          <th>Remaining<br><small>${currency}</small></th>
        </tr>
      </thead>`;
    }
    return `<thead>
      <tr class="pnl-group-head">
        <th rowspan="2">${escapeHtml(firstLabel)}</th>
        <th rowspan="2">Actual<br><small>${currency}</small></th>
        <th rowspan="2">Budget<br><small>${currency}</small></th>
        <th colspan="2">Vs Budget</th>
        <th rowspan="2">LY<br><small>${currency}</small></th>
        <th colspan="2">Vs LY</th>
      </tr>
      <tr class="pnl-sub-head"><th>${currency}</th><th>%</th><th>${currency}</th><th>%</th></tr>
    </thead>`;
  }

  function renderStatement(tableId,rows,firstLabel,countId){
    const table=byId(tableId);
    const count=byId(countId);
    const expenseFormat=tableId!=='algeriaPnlTable';
    const fyBudgetFormat=!expenseFormat&&state.pnlComparison==='fyBudget';
    if(!table) return;
    if(!expenseFormat) table.classList.toggle('algeria-pnl-fy-budget',fyBudgetFormat);
    if(!rows.length){
      table.innerHTML=`${statementHeader(firstLabel,expenseFormat)}<tbody><tr><td colspan="${fyBudgetFormat?4:8}" class="algeria-empty-cell">Upload the Algeria workbook to display this report.</td></tr></tbody>`;
      if(count) count.textContent='Waiting for upload';
      return;
    }
    const body=rows.map(row=>{
      const vb=row.actual-row.budget;
      const vl=row.actual-row.ly;
      const remaining=row.fyBudget-row.actual;
      const rowClass=isTotalRow(row)
        ?(expenseFormat?'total-row sm-total-row':'pnl-subtotal pnl-statement-total')
        :'';
      return fyBudgetFormat?`<tr class="${rowClass}">
        <td>${escapeHtml(row.label)}</td>
        <td class="${amountClass(row.actual)}">${formatAmount(row.actual)}</td>
        <td class="${amountClass(row.fyBudget)}">${formatAmount(row.fyBudget)}</td>
        <td class="${varianceClass(remaining)} ${amountClass(remaining)}">${formatAmount(remaining)}</td>
      </tr>`:`<tr class="${rowClass}">
        <td>${escapeHtml(row.label)}</td>
        <td class="${amountClass(row.actual)}">${formatAmount(row.actual)}</td>
        <td class="${amountClass(row.budget)}">${formatAmount(row.budget)}</td>
        <td class="${expenseFormat?expenseVarianceClass(vb):varianceClass(vb)} ${amountClass(vb)}">${formatAmount(vb)}</td>
        <td class="${expenseFormat?expenseVarianceClass(vb):varianceClass(vb)}">${variancePercent(vb,row.budget)}</td>
        <td class="${amountClass(row.ly)}">${formatAmount(row.ly)}</td>
        <td class="${expenseFormat?expenseVarianceClass(vl):varianceClass(vl)} ${amountClass(vl)}">${formatAmount(vl)}</td>
        <td class="${expenseFormat?expenseVarianceClass(vl):varianceClass(vl)}">${variancePercent(vl,row.ly)}</td>
      </tr>`;
    }).join('');
    table.innerHTML=`${statementHeader(firstLabel,expenseFormat)}<tbody>${body}</tbody>`;
    if(count) count.textContent=`${rows.length.toLocaleString('en-US')} lines · ${state.currency} '000`;
  }

  function findLine(rows,aliases){
    const normalizedAliases=aliases.map(normalizeText);
    let row=rows.find(item=>normalizedAliases.includes(item.key));
    if(row) return row;
    row=rows.find(item=>normalizedAliases.some(alias=>item.key.includes(alias)));
    return row||{actual:0,budget:0,ly:0,fyBudget:0};
  }

  function ratioValue(numerator,denominator,absolute=true){
    if(!denominator) return NaN;
    const ratio=numerator/denominator;
    return absolute?Math.abs(ratio):ratio;
  }

  function renderRatios(){
    const table=byId('algeriaRatioTable');
    if(!table) return;
    if(!state.pnl.length){
      table.innerHTML='<tbody><tr><td class="algeria-empty-cell">Ratios will appear after uploading the workbook.</td></tr></tbody>';
      return;
    }
    const lines={
      grossSales:findLine(state.pnl,['Gross Sales','Total Gross Sales']),
      netSales:findLine(state.pnl,['Net Sales','Total Net Sales']),
      grossProfit:findLine(state.pnl,['Gross Profit','Gross Margin']),
      cogs:findLine(state.pnl,['Cost of Sales','COGS','Total COGS']),
      sm:findLine(state.pnl,['S&M Expenses','Selling & Marketing Expenses','Selling and Marketing Expenses','S&M']),
      ga:findLine(state.pnl,['G&A Expenses','General & Administrative Expenses','General and Administrative Expenses','G&A']),
      returns:findLine(state.pnl,['Returns','Return','Sales Return']),
      discount:findLine(state.pnl,['Discount','Discounts','Sales Discount']),
      ristourne:findLine(state.pnl,['Ristourne','Resoutne','Ristورن','Rebate'])
    };
    const ratioDefinitions=[
      ['GM%',lines.grossProfit,lines.netSales,false],
      ['COGS / Sales',lines.cogs,lines.netSales,true],
      ['S&M / Sales',lines.sm,lines.netSales,true],
      ['G&A / Sales',lines.ga,lines.netSales,true],
      ['Returns / Gross Sales',lines.returns,lines.grossSales,true],
      ['Discount / Gross Sales',lines.discount,lines.grossSales,true],
      ['Ristourne / Gross Sales',lines.ristourne,lines.grossSales,true],
      ['S&M / Gross Sales',lines.sm,lines.grossSales,true]
    ];
    const fyBudgetFormat=state.pnlComparison==='fyBudget';
    table.classList.toggle('algeria-ratio-fy-budget',fyBudgetFormat);
    const header=fyBudgetFormat
      ?`<thead><tr class="pnl-group-head pnl-fy-budget-head"><th>Ratio</th><th>Actual</th><th>FY Budget</th><th>Remaining</th></tr></thead>`
      :`<thead><tr class="pnl-group-head"><th>Ratio</th><th>Actual</th><th>Budget</th><th>Vs Budget</th><th>LY</th><th>Vs LY</th></tr></thead>`;
    const body=ratioDefinitions.map(([label,numerator,denominator,absolute])=>{
      const actual=ratioValue(numerator.actual,denominator.actual,absolute);
      const budget=ratioValue(numerator.budget,denominator.budget,absolute);
      const ly=ratioValue(numerator.ly,denominator.ly,absolute);
      const fyBudget=ratioValue(numerator.fyBudget,denominator.fyBudget,absolute);
      const vb=actual-budget;
      const vl=actual-ly;
      const remaining=fyBudget-actual;
      return fyBudgetFormat?`<tr>
        <td>${escapeHtml(label)}</td>
        <td>${formatPercent(actual)}</td>
        <td>${formatPercent(fyBudget)}</td>
        <td class="${varianceClass(remaining)}">${Number.isFinite(remaining)?`${(remaining*100).toFixed(1)} pp`:'—'}</td>
      </tr>`:`<tr>
        <td>${escapeHtml(label)}</td>
        <td>${formatPercent(actual)}</td><td>${formatPercent(budget)}</td>
        <td class="${varianceClass(vb)}">${Number.isFinite(vb)?`${(vb*100).toFixed(1)} pp`:'—'}</td>
        <td>${formatPercent(ly)}</td>
        <td class="${varianceClass(vl)}">${Number.isFinite(vl)?`${(vl*100).toFixed(1)} pp`:'—'}</td>
      </tr>`;
    }).join('');
    table.innerHTML=`${header}<tbody>${body}</tbody>`;
  }

  function stockCoverage(stock,sales,multiplier){
    return sales?stock/sales*multiplier:0;
  }

  function aggregateStock(rows,key,fallback){
    const grouped=new Map();
    rows.forEach(row=>{
      const name=String(row[key]||fallback).trim()||fallback;
      if(!grouped.has(name)) grouped.set(name,{name,stock:0,historical:0,forecast:0});
      const item=grouped.get(name);
      item.stock+=row.stock;
      item.historical+=row.historical;
      item.forecast+=row.forecast;
    });
    const data=[...grouped.values()].sort((a,b)=>b.stock-a.stock);
    const totals=data.reduce((sum,row)=>({
      stock:sum.stock+row.stock,
      historical:sum.historical+row.historical,
      forecast:sum.forecast+row.forecast
    }),{stock:0,historical:0,forecast:0});
    return {data,totals};
  }

  function renderStock(){
    const table=byId('algeriaStockTable');
    const count=byId('algeriaStockCount');
    if(!table) return;
    const source=state.stockBrand
      ?state.stock.filter(row=>normalizeText(row.brand)===normalizeText(state.stockBrand))
      :state.stock;
    const dimension=state.stockBrand?'sku':'brand';
    const {data,totals}=aggregateStock(source,dimension,state.stockBrand?'Unassigned SKU':'Unassigned Brand');
    const currency=`${state.currency} '000`;
    const rows=data.map(row=>`<tr>
      <td><button class="stock-drill-button" type="button" data-algeria-stock-value="${escapeHtml(row.name)}">${escapeHtml(row.name)}</button></td>
      <td>${formatAmount(row.stock)}</td>
      <td>${formatAmount(row.historical)}</td>
      <td>${formatAmount(row.forecast)}</td>
      <td>${stockCoverage(row.stock,row.historical,12).toFixed(1)}</td>
      <td>${stockCoverage(row.stock,row.forecast,6).toFixed(1)}</td>
    </tr>`).join('');
    const totalRow=data.length?`<tr class="total-row">
      <td>Total</td><td>${formatAmount(totals.stock)}</td>
      <td>${formatAmount(totals.historical)}</td><td>${formatAmount(totals.forecast)}</td>
      <td>${stockCoverage(totals.stock,totals.historical,12).toFixed(1)}</td>
      <td>${stockCoverage(totals.stock,totals.forecast,6).toFixed(1)}</td>
    </tr>`:'';
    const dimensionLabel=state.stockBrand
      ?`<button class="algeria-stock-back" type="button" data-algeria-stock-back>← ${escapeHtml(state.stockBrand)}</button>`
      :'Brand';
    table.innerHTML=`<colgroup><col style="width:250px"><col style="width:145px">
      <col style="width:180px"><col style="width:180px"><col style="width:180px"><col style="width:180px"></colgroup>
      <thead>
        <tr class="stock-statement-group-head">
          <th rowspan="2">${dimensionLabel}</th>
          <th rowspan="2">Stock (${currency})</th>
          <th rowspan="2">Historical Sales (${currency})</th>
          <th rowspan="2">Forecast Sales (${currency})</th>
          <th colspan="2">Monthly Coverage</th>
        </tr>
        <tr class="stock-statement-sub-head"><th>Historical average</th><th>Forecasted average</th></tr>
      </thead>
      <tbody>${rows||'<tr><td colspan="6" class="stock-empty">Upload the Algeria workbook to display Stock Level.</td></tr>'}${totalRow}</tbody>`;
    table.querySelector('[data-algeria-stock-back]')?.addEventListener('click',()=>{
      state.stockBrand='';
      renderStock();
    });
    if(!state.stockBrand){
      table.querySelectorAll('[data-algeria-stock-value]').forEach(button=>{
        button.addEventListener('click',()=>{
          state.stockBrand=button.dataset.algeriaStockValue||'';
          renderStock();
        });
      });
    }else{
      table.querySelectorAll('[data-algeria-stock-value]').forEach(button=>{
        button.disabled=true;
        button.classList.add('algeria-stock-sku');
      });
    }
    if(count) count.textContent=state.stock.length
      ?`${state.stock.length.toLocaleString('en-US')} SKUs · ${currency}`
      :'Waiting for upload';
  }
  function renderAll(){
    renderStatement('algeriaPnlTable',state.pnl,'P&L Line','algeriaPnlCount');
    renderStatement('algeriaSmTable',state.sm,'S&M Expense','algeriaSmCount');
    renderStatement('algeriaGaTable',state.ga,'G&A Expense','algeriaGaCount');
    renderRatios();
    renderStock();
  }

  function setTab(panelId){
    document.querySelectorAll('.algeria-tab-btn').forEach(button=>{
      button.classList.toggle('active',button.dataset.algeriaTab===panelId);
    });
    document.querySelectorAll('.algeria-panel').forEach(panel=>{
      panel.classList.toggle('active',panel.id===panelId);
    });
  }

  let spotlightState=null;

  function setAlgeriaSpotlight(cardId,active){
    if(active&&spotlightState) setAlgeriaSpotlight(spotlightState.card.id,false);
    const card=byId(cardId);
    const button=document.querySelector(`[data-algeria-spotlight="${cardId}"]`);
    if(!card||!button) return;

    if(active){
      spotlightState={card,parent:card.parentNode,nextSibling:card.nextSibling};
      card.classList.add('algeria-spotlight-stage');
      document.body.appendChild(card);
      document.body.classList.add('algeria-table-spotlight');
      button.setAttribute('aria-pressed','true');
      button.querySelector('span').textContent='Exit spotlight';
      card.querySelector('.table-wrap,.algeria-table-scroll,.algeria-stock-scroll')?.scrollTo({top:0,left:0});
      button.focus();
      return;
    }

    if(spotlightState?.card!==card) return;
    const {parent,nextSibling}=spotlightState;
    card.classList.remove('algeria-spotlight-stage');
    if(nextSibling&&nextSibling.parentNode===parent) parent.insertBefore(card,nextSibling);
    else parent.appendChild(card);
    spotlightState=null;
    document.body.classList.remove('algeria-table-spotlight');
    button.setAttribute('aria-pressed','false');
    button.querySelector('span').textContent='Spotlight';
    button.focus();
  }

  document.querySelectorAll('.algeria-tab-btn').forEach(button=>{
    button.addEventListener('click',event=>{
      event.stopPropagation();
      setTab(button.dataset.algeriaTab);
    });
  });

  document.querySelectorAll('[data-algeria-spotlight]').forEach(button=>{
    button.addEventListener('click',()=>{
      const cardId=button.dataset.algeriaSpotlight;
      setAlgeriaSpotlight(cardId,spotlightState?.card?.id!==cardId);
    });
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&spotlightState) setAlgeriaSpotlight(spotlightState.card.id,false);
  });

  document.querySelectorAll('[data-algeria-currency]').forEach(button=>{
    button.addEventListener('click',()=>{
      state.currency=button.dataset.algeriaCurrency==='JOD'?'JOD':'USD';
      document.querySelectorAll('[data-algeria-currency]').forEach(option=>{
        const active=option.dataset.algeriaCurrency===state.currency;
        option.classList.toggle('active',active);
        option.setAttribute('aria-pressed',String(active));
      });
      renderAll();
    });
  });

  document.querySelectorAll('[data-algeria-pnl-comparison]').forEach(button=>{
    button.addEventListener('click',()=>{
      state.pnlComparison=button.dataset.algeriaPnlComparison==='fyBudget'?'fyBudget':'standard';
      document.querySelectorAll('[data-algeria-pnl-comparison]').forEach(option=>{
        const active=option.dataset.algeriaPnlComparison===state.pnlComparison;
        option.classList.toggle('active',active);
        option.setAttribute('aria-pressed',String(active));
      });
      renderStatement('algeriaPnlTable',state.pnl,'P&L Line','algeriaPnlCount');
      renderRatios();
    });
  });

  window.loadDadAlgeriaRowsFromDatabase=function(rows){
    const rawRows=rows||[];
    const normalized=rawRows.filter(row=>compact(row.Report??row.report)!=='stock').map((row,index)=>({
      label:String(row.Line??row.line??'').trim(),
      actual:readNumber(row.Actual??row.actual),
      budget:readNumber(row.Budget??row.budget),
      ly:readNumber(row.LY??row.ly),
      fyBudget:readNumber(row['FY Budget']??row.FYBudget??row.fyBudget),
      key:normalizeText(row.Line??row.line),
      order:readNumber(row['Display Order']??row.displayOrder??index+1),
      report:compact(row.Report??row.report)
    })).filter(row=>row.label).sort((a,b)=>a.order-b.order);
    state.pnl=normalized.filter(row=>row.report==='pnl');
    state.sm=normalized.filter(row=>row.report==='sm');
    state.ga=normalized.filter(row=>row.report==='ga');
    state.stock=rawRows.filter(row=>compact(row.Report??row.report)==='stock').map(row=>({
      country:String(row.Country??row.country??'Algeria').trim(),
      agent:String(row.Agent??row.agent??'').trim(),
      brand:String(row.Brand??row.brand??row['Product Group']??'Unassigned Brand').trim()||'Unassigned Brand',
      sku:String(row.SKU??row.sku??row.Product??'Unassigned SKU').trim()||'Unassigned SKU',
      stock:readNumber(row['Stock $']??row.Stock??row.stock),
      historical:readNumber(row['Historical Sales $']??row['Historical Sales']??row.historical),
      forecast:readNumber(row['Forecast Sales $']??row['Forecast Sales']??row.forecast)
    }));
    if(state.stockBrand&&!state.stock.some(row=>normalizeText(row.brand)===normalizeText(state.stockBrand))) state.stockBrand='';
    renderAll();
    const status=byId('algeriaUploadStatus');
    if(!status) return;
    status.classList.remove('error');
    if(!normalized.length){
      status.classList.remove('success');
      status.textContent='No active DAD Algeria dataset. Upload it from Data Admin.';
      return;
    }
    status.classList.add('success');
    status.textContent=`Source: Data Admin · ${state.pnl.length} P&L · ${state.sm.length} S&M · ${state.ga.length} G&A · ${state.stock.length} Stock SKUs · USD '000`;
  };

  window.renderAlgeriaReports=renderAll;
  renderAll();
})();
