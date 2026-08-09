(function initDadAlgeria(){
  'use strict';

  const byId=id=>document.getElementById(id);
  const USD_TO_JOD=0.709;
  const state={currency:'USD',pnl:[],sm:[],ga:[],fileName:''};

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

  function isTotalRow(row){
    return /(^total\b|gross sales|net sales|gross profit|operating profit|net income|profit before)/.test(row.key);
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
    if(!table) return;
    if(!rows.length){
      table.innerHTML=`${statementHeader(firstLabel,expenseFormat)}<tbody><tr><td colspan="8" class="algeria-empty-cell">Upload the Algeria workbook to display this report.</td></tr></tbody>`;
      if(count) count.textContent='Waiting for upload';
      return;
    }
    const body=rows.map(row=>{
      const vb=row.actual-row.budget;
      const vl=row.actual-row.ly;
      const rowClass=isTotalRow(row)
        ?(expenseFormat?'total-row sm-total-row':'pnl-subtotal pnl-statement-total')
        :'';
      return `<tr class="${rowClass}">
        <td>${escapeHtml(row.label)}</td>
        <td class="${amountClass(row.actual)}">${formatAmount(row.actual)}</td>
        <td class="${amountClass(row.budget)}">${formatAmount(row.budget)}</td>
        <td class="${varianceClass(vb)} ${amountClass(vb)}">${formatAmount(vb)}</td>
        <td class="${varianceClass(vb)}">${variancePercent(vb,row.budget)}</td>
        <td class="${amountClass(row.ly)}">${formatAmount(row.ly)}</td>
        <td class="${varianceClass(vl)} ${amountClass(vl)}">${formatAmount(vl)}</td>
        <td class="${varianceClass(vl)}">${variancePercent(vl,row.ly)}</td>
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
    return row||{actual:0,budget:0,ly:0};
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
    const header=`<thead><tr class="pnl-group-head"><th>Ratio</th><th>Actual</th><th>Budget</th><th>Vs Budget</th><th>LY</th><th>Vs LY</th></tr></thead>`;
    const body=ratioDefinitions.map(([label,numerator,denominator,absolute])=>{
      const actual=ratioValue(numerator.actual,denominator.actual,absolute);
      const budget=ratioValue(numerator.budget,denominator.budget,absolute);
      const ly=ratioValue(numerator.ly,denominator.ly,absolute);
      const vb=actual-budget;
      const vl=actual-ly;
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${formatPercent(actual)}</td><td>${formatPercent(budget)}</td>
        <td class="${varianceClass(vb)}">${Number.isFinite(vb)?`${(vb*100).toFixed(1)} pp`:'—'}</td>
        <td>${formatPercent(ly)}</td>
        <td class="${varianceClass(vl)}">${Number.isFinite(vl)?`${(vl*100).toFixed(1)} pp`:'—'}</td>
      </tr>`;
    }).join('');
    table.innerHTML=`${header}<tbody>${body}</tbody>`;
  }

  function renderAll(){
    renderStatement('algeriaPnlTable',state.pnl,'P&L Line','algeriaPnlCount');
    renderStatement('algeriaSmTable',state.sm,'S&M Expense','algeriaSmCount');
    renderStatement('algeriaGaTable',state.ga,'G&A Expense','algeriaGaCount');
    renderRatios();
  }

  function setTab(panelId){
    document.querySelectorAll('.algeria-tab-btn').forEach(button=>{
      button.classList.toggle('active',button.dataset.algeriaTab===panelId);
    });
    document.querySelectorAll('.algeria-panel').forEach(panel=>{
      panel.classList.toggle('active',panel.id===panelId);
    });
  }

  document.querySelectorAll('.algeria-tab-btn').forEach(button=>{
    button.addEventListener('click',event=>{
      event.stopPropagation();
      setTab(button.dataset.algeriaTab);
    });
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

  window.loadDadAlgeriaRowsFromDatabase=function(rows){
    const normalized=(rows||[]).map((row,index)=>({
      label:String(row.Line??row.line??'').trim(),
      actual:readNumber(row.Actual??row.actual),
      budget:readNumber(row.Budget??row.budget),
      ly:readNumber(row.LY??row.ly),
      key:normalizeText(row.Line??row.line),
      order:readNumber(row['Display Order']??row.displayOrder??index+1),
      report:compact(row.Report??row.report)
    })).filter(row=>row.label).sort((a,b)=>a.order-b.order);
    state.pnl=normalized.filter(row=>row.report==='pnl');
    state.sm=normalized.filter(row=>row.report==='sm');
    state.ga=normalized.filter(row=>row.report==='ga');
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
    status.textContent=`Source: Data Admin · ${state.pnl.length} P&L · ${state.sm.length} S&M · ${state.ga.length} G&A · USD '000`;
  };

  window.renderAlgeriaReports=renderAll;
  renderAll();
})();
