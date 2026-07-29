let rawData = [];
let pnlData = [];
let activeCountry = '';
let activeBrand = '';
let activeFocGroup = '';
let detailMode = 'sales';

const $ = id => document.getElementById(id);
const salesFilterIds = ['yearFilter','monthFilter','typeFilter','countryFilter','sectorFilter','agentFilter','groupFilter','productFilter'];
const aliases = {
  actual:['Actual  Value','Actual Value','Actual'],
  budget:['Budget  Value','Budget Value','Budget'],
  ly:['LY','Last Year','LY Value','Last Year Value','Actual LY'],
  bonusPct:['Budget Bonus%','Budget Bonus %','Budget Bonus% xx'],
  actualBonus:['Actual Bonus Value','Actual FOC','Actual Bonus'],
  budgetBonus:['Budget Bonus Value','Budget FOC','Budget Bonus'],
  brand:['Brand','Family','Product Family','Product Group'],
  product:['Product Name','Product'],
  group:['Product Group','Group']
};

function num(v){
  if(v===null||v===undefined||v==='') return 0;
  if(typeof v==='number') return v;
  return Number(String(v).replace(/,/g,'').replace(/\((.*)\)/,'-$1'))||0;
}
function field(row,names){for(const n of names){if(Object.prototype.hasOwnProperty.call(row,n)) return row[n];} return '';}
function fmt(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
function pct(n,d){if(!d) return n?'>200%':'0%'; const x=n/d; return Math.abs(x)>2?`${x>0?'>':'<'}200%`:`${Math.round(x*100)}%`;}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function normalize(row){
  const bonusRaw=num(field(row,aliases.bonusPct));
  return {...row,
    __actual:num(field(row,aliases.actual)),
    __budget:num(field(row,aliases.budget)),
    __ly:num(field(row,aliases.ly)),
    __bonusPct:bonusRaw>1?bonusRaw/100:bonusRaw,
    __actualBonus:num(field(row,aliases.actualBonus)),
    __budgetBonus:num(field(row,aliases.budgetBonus)),
    __brand:String(field(row,aliases.brand)||'Unassigned').trim(),
    __product:String(field(row,aliases.product)||'Unassigned').trim(),
    __group:String(field(row,aliases.group)||'Unassigned').trim()
  };
}

function setStatus(msg,ok=false,error=false){
  const box=$('statusBox'); box.innerHTML=msg; box.className='status-box'+(ok?' ok':'')+(error?' error':'');
}

$('fileInput').addEventListener('change',async e=>{
  const file=e.target.files[0]; if(!file) return;
  try{
    setStatus('Reading Excel file…');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const salesName=wb.SheetNames.find(n=>n.trim().toLowerCase()==='sales')||wb.SheetNames[0];
    rawData=XLSX.utils.sheet_to_json(wb.Sheets[salesName],{defval:''}).map(normalize);
    if(!rawData.length) throw new Error('No sales rows found.');
    buildAllSalesFilters(true); renderAll();
    const pnlName=wb.SheetNames.find(n=>['p&l','pl','income statement'].includes(n.trim().toLowerCase()));
    if(pnlName) loadPnlSheet(wb.Sheets[pnlName]);
    setStatus(`Loaded ${rawData.length.toLocaleString('en-US')} sales rows from sheet: ${esc(salesName)}`,true);
  }catch(err){setStatus(esc(err.message),false,true);}
});

function uniqueValues(data,col){
  return [...new Set(data.map(r=>String(r[col]??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

function createMultiFilter(el,data,col,onChange,defaultValues=[]){
  el.dataset.filterLabel=col;
  const values=uniqueValues(data,col);
  const defaults=new Set(defaultValues.map(String));

  el.innerHTML=`
    <button type="button" class="multi-filter-btn" aria-expanded="false">
      <span>All</span><b>⌄</b>
    </button>
    <div class="multi-filter-menu" hidden>
      <div class="multi-filter-search">
        <input type="search" placeholder="Search…" aria-label="Search ${esc(col)}" autocomplete="off">
      </div>
      <div class="multi-filter-summary">
        <span class="multi-filter-count">0 of ${values.length} selected</span>
        <div class="multi-filter-quick-actions">
          <button type="button" class="select-visible">Select visible</button>
          <button type="button" class="clear-selection">Clear all</button>
        </div>
      </div>
      <label class="multi-option all-option">
        <input type="checkbox" value="__ALL__" ${defaults.size?'':'checked'}>
        <span>All</span>
      </label>
      <div class="multi-options">
        ${values.map(v=>`
          <label class="multi-option" data-filter-text="${esc(String(v).toLowerCase())}">
            <input type="checkbox" value="${esc(v)}" ${defaults.has(String(v))?'checked':''}>
            <span>${esc(v)}</span>
          </label>
        `).join('')}
      </div>
      <div class="multi-filter-actions">
        <button type="button" class="cancel-selection">Close</button>
        <button type="button" class="apply-selection">Apply</button>
      </div>
    </div>`;

  const btn=el.querySelector('.multi-filter-btn');
  const menu=el.querySelector('.multi-filter-menu');
  const search=menu.querySelector('.multi-filter-search input');
  const all=menu.querySelector('input[value="__ALL__"]');
  const boxes=[...menu.querySelectorAll('.multi-options input')];
  const labels=[...menu.querySelectorAll('.multi-options .multi-option')];
  const countEl=menu.querySelector('.multi-filter-count');
  const selectVisibleBtn=menu.querySelector('.select-visible');
  const clearBtn=menu.querySelector('.clear-selection');
  const applyBtn=menu.querySelector('.apply-selection');
  const closeBtn=menu.querySelector('.cancel-selection');

  const visibleBoxes=()=>labels
    .filter(label=>!label.hidden)
    .map(label=>label.querySelector('input'));

  const updateLabel=()=>{
    const selected=boxes.filter(x=>x.checked).map(x=>x.value);
    const isAll=selected.length===0;

    btn.querySelector('span').textContent=
      isAll
        ? 'All'
        : selected.length===1
          ? selected[0]
          : `${selected.length} selected`;

    all.checked=isAll;
    all.indeterminate=false;
    countEl.textContent=isAll
      ? `All ${values.length} selected`
      : `${selected.length} of ${values.length} selected`;
  };

  const filterOptions=()=>{
    const q=search.value.trim().toLowerCase();
    labels.forEach(label=>{
      const text=label.dataset.filterText||'';
      label.hidden=q!==''&&!text.includes(q);

      const span=label.querySelector('span');
      const original=label.querySelector('input').value;
      if(!q){
        span.textContent=original;
      }else{
        const index=original.toLowerCase().indexOf(q);
        if(index>=0){
          span.innerHTML=
            `${esc(original.slice(0,index))}<mark>${esc(original.slice(index,index+q.length))}</mark>${esc(original.slice(index+q.length))}`;
        }else{
          span.textContent=original;
        }
      }
    });

    const visible=visibleBoxes();
    selectVisibleBtn.disabled=visible.length===0;
  };

  btn.addEventListener('click',e=>{
    e.stopPropagation();
    closeOtherMenus(el);
    menu.hidden=!menu.hidden;
    btn.setAttribute('aria-expanded',String(!menu.hidden));
    if(!menu.hidden){
      search.focus();
      search.select();
    }
  });

  menu.addEventListener('click',e=>e.stopPropagation());

  search.addEventListener('input',filterOptions);

  search.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      menu.hidden=true;
      btn.setAttribute('aria-expanded','false');
      btn.focus();
      return;
    }

    if(e.key==='Enter'){
      const visible=visibleBoxes();
      if(visible.length===1){
        visible[0].checked=true;
        updateLabel();
        applyBtn.click();
      }
    }
  });

  all.addEventListener('change',()=>{
    if(all.checked){
      boxes.forEach(box=>box.checked=false);
      all.indeterminate=false;
    }
    updateLabel();
  });

  boxes.forEach(box=>box.addEventListener('change',()=>{
    const selectedCount=boxes.filter(x=>x.checked).length;

    if(selectedCount>0){
      all.checked=false;
      all.indeterminate=false;
    }else{
      all.checked=true;
      all.indeterminate=false;
    }

    updateLabel();
  }));

  selectVisibleBtn.addEventListener('click',()=>{
    visibleBoxes().forEach(box=>box.checked=true);
    all.checked=false;
    all.indeterminate=false;
    updateLabel();
  });

  clearBtn.addEventListener('click',()=>{
    boxes.forEach(box=>box.checked=false);
    all.checked=true;
    all.indeterminate=false;
    updateLabel();
  });

  closeBtn.addEventListener('click',()=>{
    menu.hidden=true;
    btn.setAttribute('aria-expanded','false');
  });

  applyBtn.addEventListener('click',()=>{
    updateLabel();
    menu.hidden=true;
    btn.setAttribute('aria-expanded','false');

    // Ensure the selected values are available before dependent filters rebuild.
    const selectedNow=boxes
      .filter(box=>box.checked)
      .map(box=>String(box.value));
    el._getSelected=()=>[...selectedNow];

    btn.classList.add('filter-applied');
    setTimeout(()=>btn.classList.remove('filter-applied'),450);
    onChange();
    updateActiveFilterChips();
  });

  // Expose the current selection so the dashboard tables can read it.
  // Without this, Apply appears to work but filtered() always receives [].
  el._getSelected=()=>boxes
    .filter(box=>box.checked)
    .map(box=>String(box.value));

  el._setSelected=(selectedValues=[])=>{
    const selectedSet=new Set(selectedValues.map(String));
    boxes.forEach(box=>{
      box.checked=selectedSet.has(String(box.value));
    });
    all.checked=selectedSet.size===0;
    all.indeterminate=false;
    updateLabel();
  };

  updateLabel();
  updateActiveFilterChips();
}
function closeOtherMenus(except){document.querySelectorAll('.multi-filter').forEach(el=>{if(el!==except){const m=el.querySelector('.multi-filter-menu');const b=el.querySelector('.multi-filter-btn');if(m){m.hidden=true;b?.setAttribute('aria-expanded','false');}}});}
document.addEventListener('click',()=>closeOtherMenus(null));

function getSelected(id){return $(id)?._getSelected?.()||[];}

function captureSelections(ids){
  return Object.fromEntries(ids.map(id=>[id,getSelected(id)]));
}
function rowsForFilterOptions(data,ids,selections,excludeId){
  return data.filter(r=>ids.every(id=>{
    if(id===excludeId)return true;
    const selected=selections[id]||[];
    const col=$(id).dataset.column;
    return !selected.length||selected.includes(String(r[col]??''));
  }));
}
function stabilizeSelections(data,ids,selections){
  const stable=Object.fromEntries(ids.map(id=>[id,[...(selections[id]||[])]]));
  for(let pass=0;pass<ids.length+2;pass++){
    let changed=false;
    for(const id of ids){
      const col=$(id).dataset.column;
      const available=new Set(uniqueValues(rowsForFilterOptions(data,ids,stable,id),col));
      const kept=(stable[id]||[]).filter(v=>available.has(String(v)));
      if(kept.length!==(stable[id]||[]).length){stable[id]=kept;changed=true;}
    }
    if(!changed)break;
  }
  return stable;
}
function rebuildDependentFilters(data,ids,selections,onApply){
  const stable=stabilizeSelections(data,ids,selections);
  ids.forEach(id=>{
    const el=$(id),col=el.dataset.column;
    const optionRows=rowsForFilterOptions(data,ids,stable,id);
    createMultiFilter(el,optionRows,col,()=>onApply(id),stable[id]||[]);
  });
}
function buildAllSalesFilters(reset=false){
  const years=uniqueValues(rawData,'Year').map(Number).filter(Number.isFinite);
  const latestYear=years.length?String(Math.max(...years)):'';
  const selections=reset
    ?Object.fromEntries(salesFilterIds.map(id=>[id,id==='yearFilter'&&latestYear?[latestYear]:[]]))
    :captureSelections(salesFilterIds);
  rebuildDependentFilters(rawData,salesFilterIds,selections,()=>{
    buildAllSalesFilters(false);
    renderAll();
  });
}
function filtered(){
  return rawData.filter(r=>salesFilterIds.every(id=>{const sel=getSelected(id);const col=$(id).dataset.column;return !sel.length||sel.includes(String(r[col]??''));}));
}
function filteredLY(){
  const selectedYears=getSelected('yearFilter');
  const baseYears=(selectedYears.length?selectedYears:uniqueValues(rawData,'Year').slice(-1)).map(Number).filter(Number.isFinite);
  const lyYears=new Set(baseYears.map(y=>String(y-1)));
  return rawData.filter(r=>{
    if(!lyYears.has(String(r.Year??''))) return false;
    return salesFilterIds.filter(id=>id!=='yearFilter').every(id=>{const sel=getSelected(id);const col=$(id).dataset.column;return !sel.length||sel.includes(String(r[col]??''));});
  });
}
$('resetBtn').addEventListener('click',()=>{buildAllSalesFilters(true);renderAll();});
$('salesView').addEventListener('change',renderAll);
$('focView').addEventListener('change',renderAll);

function setBusinessReportTab(tabId){
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.report-section').forEach(x=>{
    x.classList.remove('active');
    x.hidden=true;
  });

  const button=document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const section=$(tabId);

  if(button) button.classList.add('active');
  if(section){
    section.classList.add('active');
    section.hidden=false;
  }

  // The shared upload/status/filter area belongs to Sales, FOC and Variance.
  // Hide it completely in the P&L page so the P&L tab contains only P&L.
  const isPnl=tabId==='pnlSection';
  const isSmExpense=tabId==='smExpensesSection';
  document.body.classList.toggle('pnl-clean-view',isPnl);
  document.body.classList.toggle('sm-expense-view',isSmExpense);

  const headerSubtitle=$('headerSubtitle');
  if(headerSubtitle){
    headerSubtitle.textContent=isPnl
      ? 'Profit & Loss · Actual vs Budget vs Last Year'
      : isSmExpense
        ? 'Selling & Marketing Expenses · Actual vs Budget vs Last Year'
        : 'Sales Actual vs Budget vs LY · TMS & IMS · FOC for IMS only';
  }

  if(isPnl && typeof renderPnlVertical==='function'){
    renderPnlVertical();
  }
  if(isSmExpense && typeof renderSmExpenses==='function'){
    renderSmExpenses();
  }
}

document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
  setBusinessReportTab(btn.dataset.tab);
}));

// Keep the initial Sales view consistent.
setBusinessReportTab(
  document.querySelector('.tab-btn.active')?.dataset.tab || 'salesSection'
);

function sum(rows,key){return rows.reduce((a,r)=>a+(typeof key==='function'?key(r):Number(r[key])||0),0);}
function dimKey(r,dim){
  return dim==='Brand'?r.__brand:dim==='Product Name'?r.__product:dim==='Product Group'?r.__group:String(r[dim]||'Unassigned');
}
function aggregate(rows,dim,lySource=filteredLY()){
  const m=new Map();
  for(const r of rows){
    const k=dimKey(r,dim);
    if(!m.has(k))m.set(k,{name:k,actual:0,budget:0,ly:0,actualFoc:0,budgetFoc:0,products:new Set()});
    const x=m.get(k);x.actual+=r.__actual;x.budget+=r.__budget;x.products.add(r.__product);
    if(String(r.Type).toUpperCase()==='IMS'){x.actualFoc+=r.__actualBonus;x.budgetFoc+=r.__budgetBonus;}
  }
  for(const r of lySource){
    const k=dimKey(r,dim);
    if(!m.has(k))m.set(k,{name:k,actual:0,budget:0,ly:0,actualFoc:0,budgetFoc:0,products:new Set()});
    const x=m.get(k);x.ly+=r.__actual;x.products.add(r.__product);
  }
  return [...m.values()];
}
function renderAll(){if(!rawData.length)return;const rows=filtered();renderSalesTable(rows);renderFocTable(rows);renderVariance(rows);}

function renderSalesTable(rows){
  const dim=$('salesView').value; const data=aggregate(rows,dim).sort((a,b)=>b.actual-a.actual);
  $('salesCount').textContent=`${data.length.toLocaleString('en-US')} rows`;
  $('salesTable').innerHTML=tableHtml(['Name','Actual','Budget','Vs Budget','Vs Budget %','LY','Vs LY','Vs LY %'],data.map(x=>[x.name,x.actual,x.budget,x.actual-x.budget,pct(x.actual-x.budget,x.budget),x.ly,x.actual-x.ly,pct(x.actual-x.ly,x.ly)]),true);
  if(dim==='Country') [...$('salesTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')].forEach(td=>{td.classList.add('drill-link');td.addEventListener('click',()=>openCountry(td.textContent));});
}
function ratePct(n,d){return d?`${Math.round((n/d)*100)}%`:'0%';}
function renderFocTable(rows){
  const dim=$('focView').value;
  const data=aggregate(
    rows.filter(r=>String(r.Type).toUpperCase()==='IMS'),
    dim,
    []
  ).sort((a,b)=>b.actual-a.actual);

  $('focCount').textContent=`${data.length.toLocaleString('en-US')} rows`;

  const tableRows=data.map(x=>{
    const actualRate=x.actual?x.actualFoc/x.actual:0;
    const budgetRate=x.actual?x.budgetFoc/x.actual:0;
    return {
      name:x.name,
      actual:x.actual,
      actualFoc:x.actualFoc,
      actualRate,
      budgetFoc:x.budgetFoc,
      budgetRate,
      varianceRate:actualRate-budgetRate
    };
  });

  const totals=tableRows.reduce(
    (t,r)=>({
      actual:t.actual+r.actual,
      actualFoc:t.actualFoc+r.actualFoc,
      budgetFoc:t.budgetFoc+r.budgetFoc
    }),
    {actual:0,actualFoc:0,budgetFoc:0}
  );

  $('focTable').innerHTML=focTableHtml(tableRows,totals);

  if(dim==='Country'){
    [...$('focTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')]
      .forEach(td=>{
        td.classList.add('drill-link');
        td.title='Click to view products';
        td.addEventListener('click',()=>openFocCountry(td.textContent));
      });
  }
}
function focTableHtml(rows,totals){
  const headers=['Name','Actual','Actual FG','Actual FG %','Bud FG','Budget FG %','FG Variance %'];
  let h='<thead><tr>'+headers.map(x=>`<th>${esc(x)}</th>`).join('')+'</tr></thead><tbody>';
  const makeRow=(r,total=false)=>{
    const cls=r.varianceRate<=0?'positive':'negative';
    return `<tr${total?' class="total-row"':''}><td>${esc(r.name)}</td><td>${fmt(r.actual)}</td><td>${fmt(r.actualFoc)}</td><td>${ratePct(r.actualFoc,r.actual)}</td><td>${fmt(r.budgetFoc)}</td><td>${ratePct(r.budgetFoc,r.actual)}</td><td class="highlight ${cls}">${Math.round(r.varianceRate*100)}%</td></tr>`;
  };
  rows.forEach(r=>h+=makeRow(r));
  if(rows.length){
    const actualRate=totals.actual?totals.actualFoc/totals.actual:0;
    const budgetRate=totals.actual?totals.budgetFoc/totals.actual:0;
    h+=makeRow({name:'Total',...totals,actualRate,budgetRate,varianceRate:actualRate-budgetRate},true);
  }
  return h+'</tbody>';
}
function renderVariance(rows){
  const d=aggregate(rows,'Product Name').map(x=>({...x,v:x.actual-x.budget}));
  const neg=d.filter(x=>x.v<0).sort((a,b)=>a.v-b.v).slice(0,10),pos=d.filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,10);
  const h=['Product','Actual','Budget','Vs Budget','Vs Budget %','LY','Vs LY'];
  $('negativeTable').innerHTML=tableHtml(h,neg.map(x=>[x.name,x.actual,x.budget,x.v,pct(x.v,x.budget),x.ly,x.actual-x.ly]));
  $('positiveTable').innerHTML=tableHtml(h,pos.map(x=>[x.name,x.actual,x.budget,x.v,pct(x.v,x.budget),x.ly,x.actual-x.ly]));
}
function tableHtml(headers,rows,total=false,foc=false){
  let h='<thead><tr>'+headers.map(x=>`<th>${esc(x)}</th>`).join('')+'</tr></thead><tbody>';
  rows.forEach(row=>h+='<tr>'+row.map((v,i)=>cell(v,i,foc)).join('')+'</tr>');
  if(total&&rows.length){const t=headers.map((_,i)=>i===0?'Total':rows.reduce((a,r)=>a+(typeof r[i]==='number'?r[i]:0),0));if(foc){t[2]='';t[6]=pct(t[5],t[4]);}else{t[4]=pct(t[3],t[2]);t[7]=pct(t[6],t[5]);}h+='<tr class="total-row">'+t.map((v,i)=>cell(v,i,foc)).join('')+'</tr>';}
  return h+'</tbody>';
}
function cell(v,i,foc){
  if(i===0)return `<td>${esc(v)}</td>`;
  if(foc&&i===2)return `<td>${Math.round(Number(v||0)*100)}%</td>`;
  const isPct=typeof v==='string'&&v.includes('%'); const n=typeof v==='number'?v:null;
  const variance=(!foc&&[3,6].includes(i))||(foc&&i===5); const cls=variance&&n!==null?(n>=0?'positive':'negative'):'';
  const hi=(!foc&&[3,4,6,7].includes(i))||(foc&&[3,4,5,6].includes(i));
  return `<td class="${cls}${hi?' highlight':''}">${isPct?v:fmt(v)}</td>`;
}

function openCountry(country){
  detailMode='sales';
  activeCountry=country;
  activeBrand='';
  activeFocGroup='';
  $('countryModal').classList.add('open');
  $('countryModal').setAttribute('aria-hidden','false');
  renderCountryBrands();
}

function openFocCountry(country){
  detailMode='foc';
  activeCountry=country;
  activeBrand='';
  activeFocGroup='';
  $('countryModal').classList.add('open');
  $('countryModal').setAttribute('aria-hidden','false');
  renderFocCountryGroups();
}

function detailBaseRows(){
  return filtered().filter(r=>String(r.Country||'')===activeCountry);
}

function detailLyRows(){
  return filteredLY().filter(r=>String(r.Country||'')===activeCountry);
}

function focDetailRows(){
  return detailBaseRows().filter(r=>String(r.Type||'').toUpperCase()==='IMS');
}

function focDetailTableHtml(rows, totalLabel='Total'){
  const totals=rows.reduce(
    (t,r)=>({
      actual:t.actual+r.actual,
      actualFoc:t.actualFoc+r.actualFoc,
      budgetFoc:t.budgetFoc+r.budgetFoc
    }),
    {actual:0,actualFoc:0,budgetFoc:0}
  );

  let html=focTableHtml(rows,totals);
  if(totalLabel!=='Total'){
    html=html.replace('<td>Total</td>',`<td>${esc(totalLabel)}</td>`);
  }
  return html;
}

function renderCountryBrands(){
  detailMode='sales';
  activeBrand='';
  activeFocGroup='';
  $('backToBrands').hidden=true;
  $('backToBrands').textContent='← Back';
  $('countryModalTitle').textContent=activeCountry;
  $('countryModalSubtitle').textContent='Brand totals — click a brand to view products';
  $('countryDetailHint').textContent='Click any brand to view its products';

  const data=aggregate(detailBaseRows(),'Brand',detailLyRows()).sort((a,b)=>b.actual-a.actual);
  $('countryDetailCount').textContent=`${data.length} brands`;
  $('countryDetailTable').innerHTML=tableHtml(
    ['Brand','Products','Actual','Budget','Vs Budget','Vs Budget %','LY','Vs LY','Vs LY %'],
    data.map(x=>[
      x.name,x.products.size,x.actual,x.budget,x.actual-x.budget,
      pct(x.actual-x.budget,x.budget),x.ly,x.actual-x.ly,pct(x.actual-x.ly,x.ly)
    ]),
    true
  );

  [...$('countryDetailTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')]
    .forEach(td=>{
      td.classList.add('drill-link');
      td.addEventListener('click',()=>renderBrandProducts(td.textContent));
    });
}

function renderBrandProducts(brand){
  detailMode='sales';
  activeBrand=brand;
  $('backToBrands').hidden=false;
  $('backToBrands').textContent='← Back to Brands';
  $('countryModalTitle').textContent=`${activeCountry} · ${brand}`;
  $('countryModalSubtitle').textContent='Product detail';
  $('countryDetailHint').textContent='Product level';

  const rows=detailBaseRows().filter(r=>r.__brand===brand);
  const lyRows=detailLyRows().filter(r=>r.__brand===brand);
  const data=aggregate(rows,'Product Name',lyRows).sort((a,b)=>b.actual-a.actual);

  $('countryDetailCount').textContent=`${data.length} products`;
  $('countryDetailTable').innerHTML=tableHtml(
    ['Product','Actual','Budget','Vs Budget','Vs Budget %','LY','Vs LY','Vs LY %'],
    data.map(x=>[
      x.name,x.actual,x.budget,x.actual-x.budget,
      pct(x.actual-x.budget,x.budget),x.ly,x.actual-x.ly,pct(x.actual-x.ly,x.ly)
    ]),
    true
  );
}

function renderFocCountryGroups(){
  detailMode='foc';
  activeFocGroup='';
  $('backToBrands').hidden=true;
  $('backToBrands').textContent='← Back to Product Groups';
  $('countryModalTitle').textContent=`${activeCountry} · IMS FOC`;
  $('countryModalSubtitle').textContent='Product Group-level FOC utilization — click a group to view products';
  $('countryDetailHint').textContent='Click any Product Group to view its products';

  const data=aggregate(focDetailRows(),'Product Group',[]).sort((a,b)=>b.actual-a.actual);
  const tableRows=data.map(x=>{
    const actualRate=x.actual?x.actualFoc/x.actual:0;
    const budgetRate=x.actual?x.budgetFoc/x.actual:0;
    return {
      name:x.name,
      actual:x.actual,
      actualFoc:x.actualFoc,
      budgetFoc:x.budgetFoc,
      varianceRate:actualRate-budgetRate
    };
  });

  $('countryDetailCount').textContent=`${tableRows.length} product groups`;
  $('countryDetailTable').innerHTML=focDetailTableHtml(tableRows);

  [...$('countryDetailTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')]
    .forEach(td=>{
      td.classList.add('drill-link');
      td.title='Click to view products';
      td.addEventListener('click',()=>renderFocGroupProducts(td.textContent));
    });
}

function renderFocGroupProducts(group){
  detailMode='foc-product';
  activeFocGroup=group;
  $('backToBrands').hidden=false;
  $('backToBrands').textContent='← Back to Product Groups';
  $('countryModalTitle').textContent=`${activeCountry} · ${group}`;
  $('countryModalSubtitle').textContent='FOC utilization by product';
  $('countryDetailHint').textContent='Product level';

  const groupRows=focDetailRows().filter(r=>
    String(r['Product Group']||r.__group||'').trim()===group
  );

  const data=aggregate(groupRows,'Product Name',[]).sort((a,b)=>b.actual-a.actual);
  const tableRows=data.map(x=>{
    const actualRate=x.actual?x.actualFoc/x.actual:0;
    const budgetRate=x.actual?x.budgetFoc/x.actual:0;
    return {
      name:x.name,
      actual:x.actual,
      actualFoc:x.actualFoc,
      budgetFoc:x.budgetFoc,
      varianceRate:actualRate-budgetRate
    };
  });

  $('countryDetailCount').textContent=`${tableRows.length} products`;
  $('countryDetailTable').innerHTML=focDetailTableHtml(tableRows);
}

$('backToBrands').addEventListener('click',()=>{
  if(detailMode==='foc-product'){
    renderFocCountryGroups();
  }else{
    renderCountryBrands();
  }
});

function closeModal(){
  $('countryModal').classList.remove('open');
  $('countryModal').setAttribute('aria-hidden','true');
}

$('closeCountryModal').addEventListener('click',closeModal);
document.querySelector('[data-close-modal]').addEventListener('click',closeModal);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

// P&L vertical report

let pnlRawData = [{"salesType":"Private","market":"Algeria","agent":"aa","scenario":"Actual","grossSales":10185.9658903956,"salesReturns":-149.498027552778,"discounts":-1669.79548660085,"commissions":0.0,"restoun":-1334.36153164182,"netSales":7032.31084460015,"cogs":-3768.95028916569,"grossProfit":3263.36055543446,"sm":0.0,"netIncome":3263.36055543446},{"salesType":"Private","market":"Algeria","agent":"aa","scenario":"Budget","grossSales":13049.3427814815,"salesReturns":-130.584643703704,"discounts":-1874.02641433025,"commissions":0.0,"restoun":-1709.41413061552,"netSales":9335.31759283201,"cogs":-4612.0,"grossProfit":4723.31759283201,"sm":0.0,"netIncome":4723.31759283201},{"salesType":"Private","market":"Algeria","agent":"aa","scenario":"LY","grossSales":14447.0856697351,"salesReturns":88.621948028413,"discounts":-3252.83856112226,"commissions":0.0,"restoun":-1756.15373765867,"netSales":9526.71531898254,"cogs":-5565.39068514485,"grossProfit":3961.32463383769,"sm":0.0,"netIncome":3961.32463383769},{"salesType":"Private","market":"Jordan","agent":"aa","scenario":"Actual","grossSales":8212.60822849113,"salesReturns":-607.711935119883,"discounts":-0.602471086036671,"commissions":-893.856992947814,"restoun":0.0,"netSales":6710.43682933739,"cogs":-2503.66928139789,"grossProfit":4206.7675479395,"sm":-1370.55834555712,"netIncome":2836.20920238238},{"salesType":"Private","market":"Jordan","agent":"aa","scenario":"Budget","grossSales":10540.1907993615,"salesReturns":-422.586087730844,"discounts":0.0,"commissions":-1214.79176593003,"restoun":0.0,"netSales":8902.81294570062,"cogs":-3124.03576059352,"grossProfit":5778.7771851071,"sm":-1662.76402657147,"netIncome":4116.01315853563},{"salesType":"Private","market":"Jordan","agent":"aa","scenario":"LY","grossSales":9221.16798194889,"salesReturns":-298.53215796897,"discounts":-5.95696755994358,"commissions":-1199.04629619182,"restoun":0.0,"netSales":7717.63256022815,"cogs":-2607.14298787917,"grossProfit":5110.48957234898,"sm":-1844.22209590973,"netIncome":3266.26747643925},{"salesType":"Private","market":"KSA","agent":"aa","scenario":"Actual","grossSales":7301.55418617771,"salesReturns":710.541141043724,"discounts":-170.188489421721,"commissions":-626.866810296191,"restoun":0.0,"netSales":7215.04002750352,"cogs":-4023.64767923429,"grossProfit":3191.39234826923,"sm":0.0,"netIncome":3191.39234826923},{"salesType":"Private","market":"KSA","agent":"aa","scenario":"Budget","grossSales":8463.29167548113,"salesReturns":-338.531667019245,"discounts":-167.7857086,"commissions":-677.063334038491,"restoun":0.0,"netSales":7279.91096582339,"cogs":-3786.31267032322,"grossProfit":3493.59829550017,"sm":0.0,"netIncome":3493.59829550017},{"salesType":"Private","market":"KSA","agent":"aa","scenario":"LY","grossSales":4036.82641076643,"salesReturns":-54.7531297602257,"discounts":-150.076964739069,"commissions":-360.503888939351,"restoun":0.0,"netSales":3471.49242732779,"cogs":-1928.99214279178,"grossProfit":1542.50028453601,"sm":0.0,"netIncome":1542.50028453601},{"salesType":"Private","market":"Iraq","agent":"aa","scenario":"Actual","grossSales":6308.14379830747,"salesReturns":0.0,"discounts":-254.835201692525,"commissions":-628.866779971791,"restoun":0.0,"netSales":5424.44181664316,"cogs":-2850.96935056746,"grossProfit":2573.4724660757,"sm":-166.638781382229,"netIncome":2406.8336846934712},{"salesType":"Private","market":"Iraq","agent":"aa","scenario":"Budget","grossSales":9278.35924837957,"salesReturns":0.0,"discounts":-77.0711726,"commissions":-1179.48386625693,"restoun":0.0,"netSales":8021.80420952263,"cogs":-5300.77472005725,"grossProfit":2721.02948946538,"sm":-253.139772256667,"netIncome":2467.8897172087127},{"salesType":"Private","market":"Iraq","agent":"aa","scenario":"LY","grossSales":9095.42748236953,"salesReturns":0.0,"discounts":-461.204174894217,"commissions":-909.542757404796,"restoun":0.0,"netSales":7724.68055007052,"cogs":-4805.41415344591,"grossProfit":2919.26639662461,"sm":-190.755504795487,"netIncome":2728.510891829123},{"salesType":"Private","market":"UAE","agent":"aa","scenario":"Actual","grossSales":3558.11173342736,"salesReturns":-282.135177715092,"discounts":-216.496138222849,"commissions":-383.857327997179,"restoun":0.0,"netSales":2675.62308949224,"cogs":-1403.28315535815,"grossProfit":1272.33993413409,"sm":-830.478212976022,"netIncome":441.8617211580681},{"salesType":"Private","market":"UAE","agent":"aa","scenario":"Budget","grossSales":5037.57169666667,"salesReturns":-302.2543018,"discounts":-198.842086,"commissions":-503.757169666667,"restoun":0.0,"netSales":4032.7181392,"cogs":-1779.42877067403,"grossProfit":2253.28936852597,"sm":-810.712818903385,"netIncome":1442.576549622585},{"salesType":"Private","market":"UAE","agent":"aa","scenario":"LY","grossSales":5005.84718758815,"salesReturns":-235.552348377997,"discounts":-166.878702397743,"commissions":-468.727396332863,"restoun":0.0,"netSales":4134.68874047955,"cogs":-2129.82544794338,"grossProfit":2004.86329253617,"sm":-717.157231029619,"netIncome":1287.7060615065511},{"salesType":"Private","market":"Libya","agent":"aa","scenario":"Actual","grossSales":3606.19540197461,"salesReturns":0.0,"discounts":0.0,"commissions":-257.064839210155,"restoun":0.0,"netSales":3349.13056276446,"cogs":-1633.25304354902,"grossProfit":1715.87751921544,"sm":-193.297688293371,"netIncome":1522.579830922069},{"salesType":"Private","market":"Libya","agent":"aa","scenario":"Budget","grossSales":2821.33115333333,"salesReturns":0.0,"discounts":-56.4266230666667,"commissions":-141.066557666667,"restoun":0.0,"netSales":2623.8379726,"cogs":-1472.96454728129,"grossProfit":1150.87342531871,"sm":-38.741125,"netIncome":1112.13230031871},{"salesType":"Private","market":"Libya","agent":"aa","scenario":"LY","grossSales":2855.30014245416,"salesReturns":0.0,"discounts":0.0,"commissions":-142.765028208745,"restoun":0.0,"netSales":2712.53511424542,"cogs":-1692.17988864762,"grossProfit":1020.3552255978,"sm":-47.0926304654443,"netIncome":973.2625951323557},{"salesType":"Private","market":"Qatar","agent":"aa","scenario":"Actual","grossSales":1316.2888448519,"salesReturns":-95.5930507757405,"discounts":-27.57976022567,"commissions":-131.040205007052,"restoun":0.0,"netSales":1062.07582884344,"cogs":-326.128680494177,"grossProfit":735.947148349264,"sm":-302.381521861777,"netIncome":433.565626487487},{"salesType":"Private","market":"Qatar","agent":"aa","scenario":"Budget","grossSales":1369.948955,"salesReturns":-41.09846865,"discounts":-15.30362355,"commissions":-136.9948955,"restoun":0.0,"netSales":1176.5519673,"cogs":-467.743086545567,"grossProfit":708.808880754433,"sm":-252.92630382988,"netIncome":455.88257692455295},{"salesType":"Private","market":"Qatar","agent":"aa","scenario":"LY","grossSales":1226.71556417489,"salesReturns":17.6983342736248,"discounts":-24.1495007052186,"commissions":-122.327129055007,"restoun":0.0,"netSales":1097.93726868829,"cogs":-499.685696286569,"grossProfit":598.251572401725,"sm":-231.498805359662,"netIncome":366.75276704206294},{"salesType":"Private","market":"Sudan","agent":"aa","scenario":"Actual","grossSales":810.141970380818,"salesReturns":0.0,"discounts":0.0,"commissions":-86.8816205923836,"restoun":0.0,"netSales":723.260349788434,"cogs":-387.768625572378,"grossProfit":335.491724216056,"sm":-93.7770874471086,"netIncome":241.7146367689474},{"salesType":"Private","market":"Sudan","agent":"aa","scenario":"Budget","grossSales":1320.37,"salesReturns":0.0,"discounts":0.0,"commissions":-184.036275,"restoun":0.0,"netSales":1136.333725,"cogs":-631.078795441841,"grossProfit":505.254929558159,"sm":-60.57625,"netIncome":444.678679558159},{"salesType":"Private","market":"Sudan","agent":"aa","scenario":"LY","grossSales":409.501540197461,"salesReturns":-17.1087700987306,"discounts":0.0,"commissions":-55.2827108603667,"restoun":0.0,"netSales":337.110059238364,"cogs":-229.436206849431,"grossProfit":107.673852388933,"sm":-58.9147658674189,"netIncome":48.7590865215141},{"salesType":"Private","market":"Lebanon","agent":"aa","scenario":"Actual","grossSales":501.526650211566,"salesReturns":43.0739844851904,"discounts":-1.83046967559944,"commissions":-50.1526629055007,"restoun":0.0,"netSales":492.617502115656,"cogs":-194.923389069373,"grossProfit":297.694113046283,"sm":-179.551349788434,"netIncome":118.142763257849},{"salesType":"Private","market":"Lebanon","agent":"aa","scenario":"Budget","grossSales":833.784753333333,"salesReturns":-33.3513901333333,"discounts":0.0,"commissions":-83.3784753333333,"restoun":0.0,"netSales":717.054887866667,"cogs":-363.961340450637,"grossProfit":353.09354741603,"sm":-204.970981843575,"netIncome":148.122565572455},{"salesType":"Private","market":"Lebanon","agent":"aa","scenario":"LY","grossSales":458.169551480959,"salesReturns":43.0136840620592,"discounts":0.0,"commissions":-45.8169534555712,"restoun":0.0,"netSales":455.366282087447,"cogs":-193.270756775565,"grossProfit":262.095525311882,"sm":-171.892142454161,"netIncome":90.20338285772101},{"salesType":"Private","market":"Oman","agent":"aa","scenario":"Actual","grossSales":24.5008589562765,"salesReturns":47.9717912552891,"discounts":-3.66703385049365,"commissions":-1.22504231311707,"restoun":0.0,"netSales":67.5805740479549,"cogs":-7.21452078751236,"grossProfit":60.3660532604425,"sm":-140.611341325811,"netIncome":-80.2452880653685},{"salesType":"Private","market":"Oman","agent":"aa","scenario":"Budget","grossSales":702.59672125,"salesReturns":-42.076003275,"discounts":-8.93389337999999,"commissions":-35.1298360625,"restoun":0.0,"netSales":616.4569885325,"cogs":-264.452321216671,"grossProfit":352.004667315829,"sm":-173.240042132828,"netIncome":178.76462518300102},{"salesType":"Private","market":"Oman","agent":"aa","scenario":"LY","grossSales":281.032781382229,"salesReturns":-136.83610719323,"discounts":-9.57335260930889,"commissions":-14.0516361071932,"restoun":0.0,"netSales":120.571685472497,"cogs":-94.8179479060989,"grossProfit":25.7537375663976,"sm":-100.345665726375,"netIncome":-74.5919281599774},{"salesType":"Private","market":"Bahrain","agent":"aa","scenario":"Actual","grossSales":631.231310296192,"salesReturns":0.0,"discounts":0.0,"commissions":-217.65605719323,"restoun":0.0,"netSales":413.575253102962,"cogs":-246.018241522273,"grossProfit":167.557011580689,"sm":-48.1655966149506,"netIncome":119.39141496573839},{"salesType":"Private","market":"Bahrain","agent":"aa","scenario":"Budget","grossSales":619.697503,"salesReturns":0.0,"discounts":0.0,"commissions":-216.89412605,"restoun":0.0,"netSales":402.80337695,"cogs":-220.617640720375,"grossProfit":182.185736229625,"sm":-10.4423695345557,"netIncome":171.7433666950693},{"salesType":"Private","market":"Bahrain","agent":"aa","scenario":"LY","grossSales":487.688830895628,"salesReturns":0.0,"discounts":0.0,"commissions":-166.700926124119,"restoun":0.0,"netSales":320.987904771509,"cogs":-257.523658016651,"grossProfit":63.4642467548583,"sm":0.0,"netIncome":63.4642467548583},{"salesType":"Private","market":"Kuwait","agent":"aa","scenario":"Actual","grossSales":451.917124118477,"salesReturns":-11.8732073342736,"discounts":-8.30333850493653,"commissions":-45.0462150916784,"restoun":0.0,"netSales":386.694363187588,"cogs":-139.524186790189,"grossProfit":247.170176397399,"sm":-149.682437235543,"netIncome":97.48773916185598},{"salesType":"Private","market":"Kuwait","agent":"aa","scenario":"Budget","grossSales":538.293835,"salesReturns":-18.840284225,"discounts":-5.5352895,"commissions":-53.8293835,"restoun":0.0,"netSales":460.088877775,"cogs":-208.635903773511,"grossProfit":251.452974001489,"sm":-151.848241637659,"netIncome":99.60473236383001},{"salesType":"Private","market":"Kuwait","agent":"aa","scenario":"LY","grossSales":136.339560564175,"salesReturns":19.1946403385049,"discounts":-4.63317489421721,"commissions":-14.0115594104372,"restoun":0.0,"netSales":136.889466598025,"cogs":-88.2594730613005,"grossProfit":48.629993536725,"sm":-123.89170944993,"netIncome":-75.261715913205},{"salesType":"Private","market":"Uganda","agent":"aa","scenario":"Actual","grossSales":238.63123977433,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":238.63123977433,"cogs":-101.089125195016,"grossProfit":137.542114579314,"sm":-62.0914992947814,"netIncome":75.45061528453259},{"salesType":"Private","market":"Uganda","agent":"aa","scenario":"Budget","grossSales":413.42,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":413.42,"cogs":-241.289284768939,"grossProfit":172.130715231061,"sm":-12.0,"netIncome":160.130715231061},{"salesType":"Private","market":"Uganda","agent":"aa","scenario":"LY","grossSales":210.786489421721,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":210.786489421721,"cogs":-126.368193506313,"grossProfit":84.4182959154078,"sm":0.0,"netIncome":84.4182959154078},{"salesType":"Private","market":"Somali","agent":"aa","scenario":"Actual","grossSales":76.3194104372356,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":76.3194104372356,"cogs":-50.8335613540197,"grossProfit":25.4858490832158,"sm":0.0,"netIncome":25.4858490832158},{"salesType":"Private","market":"Somali","agent":"aa","scenario":"Budget","grossSales":157.925,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":157.925,"cogs":-152.723787152142,"grossProfit":5.20121284785836,"sm":0.0,"netIncome":5.20121284785836},{"salesType":"Private","market":"Somali","agent":"aa","scenario":"LY","grossSales":210.512802538787,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":210.512802538787,"cogs":-184.150591481887,"grossProfit":26.3622110569,"sm":0.0,"netIncome":26.3622110569},{"salesType":"Private","market":"South Sudan","agent":"aa","scenario":"Actual","grossSales":22.7419012693935,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":22.7419012693935,"cogs":-14.0219008635908,"grossProfit":8.72000040580268,"sm":0.0,"netIncome":8.72000040580268},{"salesType":"Private","market":"South Sudan","agent":"aa","scenario":"Budget","grossSales":109.87,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":109.87,"cogs":-68.377988355575,"grossProfit":41.492011644425,"sm":0.0,"netIncome":41.492011644425},{"salesType":"Private","market":"South Sudan","agent":"aa","scenario":"LY","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Private","market":"Zambia","agent":"aa","scenario":"Actual","grossSales":40.2801509167842,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":40.2801509167842,"cogs":-29.3847726504806,"grossProfit":10.8953782663036,"sm":-14.3018942172073,"netIncome":-3.4065159509036995},{"salesType":"Private","market":"Zambia","agent":"aa","scenario":"Budget","grossSales":64.62,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":64.62,"cogs":-49.045350735687,"grossProfit":15.574649264313,"sm":-2.28,"netIncome":13.294649264313001},{"salesType":"Private","market":"Zambia","agent":"aa","scenario":"LY","grossSales":41.71,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":41.71,"cogs":-31.0100358290745,"grossProfit":10.6999641709255,"sm":0.0,"netIncome":10.6999641709255},{"salesType":"Private","market":"Morocco","agent":"aa","scenario":"Actual","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Private","market":"Morocco","agent":"aa","scenario":"Budget","grossSales":23.1,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":23.1,"cogs":-10.3139701127561,"grossProfit":12.786029887244,"sm":0.0,"netIncome":12.786029887244},{"salesType":"Private","market":"Morocco","agent":"aa","scenario":"LY","grossSales":39.424,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":39.424,"cogs":-16.9426893595919,"grossProfit":22.4813106404081,"sm":0.0,"netIncome":22.4813106404081},{"salesType":"Private","market":"Yemen","agent":"aa","scenario":"Actual","grossSales":381.945469675599,"salesReturns":0.0,"discounts":-3.52609308885755,"commissions":-57.2918307475317,"restoun":0.0,"netSales":321.12754583921,"cogs":-296.867144242311,"grossProfit":24.2604015968989,"sm":0.0,"netIncome":24.2604015968989},{"salesType":"Private","market":"Yemen","agent":"aa","scenario":"Budget","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Private","market":"Yemen","agent":"aa","scenario":"LY","grossSales":316.036750352609,"salesReturns":0.0,"discounts":16.676,"commissions":-47.4055204513399,"restoun":0.0,"netSales":285.307229901269,"cogs":-214.808027658632,"grossProfit":70.4992022426373,"sm":0.0,"netIncome":70.4992022426373},{"salesType":"Private","market":"Syria","agent":"aa","scenario":"Actual","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Private","market":"Syria","agent":"aa","scenario":"Budget","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Private","market":"Syria","agent":"aa","scenario":"LY","grossSales":53.8267997179126,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":53.8267997179126,"cogs":-44.9783206558856,"grossProfit":8.84847906202699,"sm":0.0,"netIncome":8.84847906202699},{"salesType":"Private","market":"HKG","agent":"aa","scenario":"Actual","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Private","market":"HKG","agent":"aa","scenario":"Budget","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Private","market":"HKG","agent":"aa","scenario":"LY","grossSales":9.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":9.0,"cogs":-4.76009753098485,"grossProfit":4.23990246901515,"sm":0.0,"netIncome":4.23990246901515},{"salesType":"Private","market":"Total Private","agent":"aa","scenario":"Actual","grossSales":43668.1041696625,"salesReturns":-345.224481713563,"discounts":-2356.82448236954,"commissions":-3379.80638427362,"restoun":-1334.36153164182,"netSales":36251.8872896639,"cogs":-17977.5469478138,"grossProfit":18274.3403418501,"sm":-3551.53575599436,"netIncome":14722.80458585574},{"salesType":"Private","market":"Total Private","agent":"aa","scenario":"Budget","grossSales":55343.714122287,"salesReturns":-1329.32284653713,"discounts":-2403.92481102691,"commissions":-4426.42568500462,"restoun":-1709.41413061552,"netSales":45474.6266491028,"cogs":-22753.755938203,"grossProfit":22720.8707108998,"sm":-3633.64193171002,"netIncome":19087.22877918978},{"salesType":"Private","market":"Total Private","agent":"aa","scenario":"LY","grossSales":48542.3995455886,"salesReturns":-574.253906696552,"discounts":-4058.63539892198,"commissions":-3546.18180254161,"restoun":-1756.15373765867,"netSales":38607.1746997698,"cogs":-20714.9570007707,"grossProfit":17892.2176989991,"sm":-3485.77055105783,"netIncome":14406.447147941268},{"salesType":"Tender","market":"Jordan","agent":"aa","scenario":"Actual","grossSales":843.370126939351,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":843.370126939351,"cogs":-612.48604090268,"grossProfit":230.884086036672,"sm":0.0,"netIncome":230.884086036672},{"salesType":"Tender","market":"Jordan","agent":"aa","scenario":"Budget","grossSales":2335.04848,"salesReturns":-1.21806,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":2333.83042,"cogs":-1576.54437502818,"grossProfit":757.286044971824,"sm":0.0,"netIncome":757.286044971824},{"salesType":"Tender","market":"Jordan","agent":"aa","scenario":"LY","grossSales":1376.1679038057,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":1376.1679038057,"cogs":-999.423152534671,"grossProfit":376.744751271028,"sm":0.0,"netIncome":376.744751271028},{"salesType":"Tender","market":"KSA","agent":"aa","scenario":"Actual","grossSales":1861.61417489422,"salesReturns":0.0,"discounts":0.0,"commissions":-167.54527574048,"restoun":0.0,"netSales":1694.06889915374,"cogs":-690.806114245415,"grossProfit":1003.26278490832,"sm":0.0,"netIncome":1003.26278490832},{"salesType":"Tender","market":"KSA","agent":"aa","scenario":"Budget","grossSales":1421.48712,"salesReturns":0.0,"discounts":0.0,"commissions":-127.9338408,"restoun":0.0,"netSales":1293.5532792,"cogs":-673.0,"grossProfit":620.5532792,"sm":0.0,"netIncome":620.5532792},{"salesType":"Tender","market":"KSA","agent":"aa","scenario":"LY","grossSales":1643.84640023498,"salesReturns":0.0,"discounts":0.0,"commissions":-147.141644205924,"restoun":0.0,"netSales":1496.70475602905,"cogs":-609.997044219522,"grossProfit":886.707711809532,"sm":0.0,"netIncome":886.707711809532},{"salesType":"Tender","market":"UAE","agent":"aa","scenario":"Actual","grossSales":422.253101551481,"salesReturns":0.0,"discounts":0.0,"commissions":-21.1126550775741,"restoun":0.0,"netSales":401.140446473907,"cogs":-227.263623413258,"grossProfit":173.876823060649,"sm":0.0,"netIncome":173.876823060649},{"salesType":"Tender","market":"UAE","agent":"aa","scenario":"Budget","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Tender","market":"UAE","agent":"aa","scenario":"LY","grossSales":0.0,"salesReturns":0.0,"discounts":0.0,"commissions":0.0,"restoun":0.0,"netSales":0.0,"cogs":0.0,"grossProfit":0.0,"sm":0.0,"netIncome":0.0},{"salesType":"Tender","market":"Qatar","agent":"aa","scenario":"Actual","grossSales":209.054461212976,"salesReturns":0.0,"discounts":0.0,"commissions":-10.4527230606488,"restoun":0.0,"netSales":198.601738152327,"cogs":-87.4330944992948,"grossProfit":111.168643653032,"sm":0.0,"netIncome":111.168643653032},{"salesType":"Tender","market":"Qatar","agent":"aa","scenario":"Budget","grossSales":258.72018,"salesReturns":0.0,"discounts":0.0,"commissions":-12.936009,"restoun":0.0,"netSales":245.784171,"cogs":-119.551550031212,"grossProfit":126.232620968788,"sm":0.0,"netIncome":126.232620968788},{"salesType":"Tender","market":"Qatar","agent":"aa","scenario":"LY","grossSales":152.929379407616,"salesReturns":0.0,"discounts":0.0,"commissions":-7.64646897038082,"restoun":0.0,"netSales":145.282910437236,"cogs":0.0,"grossProfit":145.282910437236,"sm":0.0,"netIncome":145.282910437236},{"salesType":"Tender","market":"Bahrain","agent":"aa","scenario":"Actual","grossSales":151.971662905501,"salesReturns":0.0,"discounts":0.0,"commissions":-7.59858314527504,"restoun":0.0,"netSales":144.373079760226,"cogs":-62.3960098730606,"grossProfit":81.977069887165,"sm":0.0,"netIncome":81.977069887165},{"salesType":"Tender","market":"Bahrain","agent":"aa","scenario":"Budget","grossSales":47.7921,"salesReturns":0.0,"discounts":0.0,"commissions":-2.389605,"restoun":0.0,"netSales":45.402495,"cogs":-34.9901648842421,"grossProfit":10.412330115758,"sm":0.0,"netIncome":10.412330115758}];

const pnlLineConfig = [
  { key: 'grossSales', label: 'Gross Sales' },
  { key: 'salesReturns', label: 'Sales Returns' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'commissions', label: 'Commissions' },
  { key: 'restoun', label: 'Restoun' },
  { key: 'netSales', label: 'Net Sales', subtotal: true },
  { key: 'cogs', label: 'COGS' },
  { key: 'grossProfit', label: 'Gross Profit', subtotal: true },
  { key: 'sm', label: 'S&M' },
  { key: 'netIncome', label: 'Net Income', total: true }
];

function pnlNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pnlFormat(v) {
  const n = Math.round(pnlNumber(v));
  return n < 0
    ? `(${Math.abs(n).toLocaleString('en-US')})`
    : n.toLocaleString('en-US');
}

function pnlPercent(n, d) {
  if (!d) return '—';
  return `${((n / Math.abs(d)) * 100).toFixed(1)}%`;
}

function pnlUnique(key) {
  return [...new Set(pnlRawData.map(r => String(r[key] || '').trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b));
}

function pnlFilterData() {
  return pnlRawData
    .filter(r => !['Total','Grand Total'].includes(String(r.salesType || '')))
    .filter(r => !String(r.market || '').toLowerCase().includes('total company'))
    .map(r => ({
      'Agent': String(r.agent || '').trim(),
      'Market': String(r.market || '').trim(),
      'Sales Type': String(r.salesType || '').trim()
    }));
}

function initPnlFilters() {
  rebuildPnlFilters(true);

  const resetBtn = $('pnlResetBtn');
  if (resetBtn && !resetBtn.dataset.pnlBound) {
    resetBtn.addEventListener('click', () => {
      rebuildPnlFilters(true);
      renderPnlVertical();
    });
    resetBtn.dataset.pnlBound = '1';
  }

  const fileInput = $('pnlFileInput');
  if (fileInput && !fileInput.dataset.pnlBound) {
    fileInput.addEventListener('change', handlePnlExcelUpload);
    fileInput.dataset.pnlBound = '1';
  }
}

function rebuildPnlFilters(reset=false) {
  const ids = ['pnlAgentFilter','pnlMarketFilter','pnlSalesTypeFilter'];
  const data = pnlFilterData();
  const selections = reset
    ? Object.fromEntries(ids.map(id => [id, []]))
    : captureSelections(ids);

  ids.forEach(id => {
    const el = $(id);
    const column = el.dataset.column;
    createMultiFilter(el, data, column, () => {
      rebuildPnlFilters(false);
      renderPnlVertical();
    }, selections[id] || []);
  });
}

function pnlFilteredRows() {
  const agents = getSelected('pnlAgentFilter');
  const markets = getSelected('pnlMarketFilter');
  const salesTypes = getSelected('pnlSalesTypeFilter');

  const allFiltersEmpty = !agents.length && !markets.length && !salesTypes.length;

  if (allFiltersEmpty) {
    const grandTotal = pnlRawData.filter(r =>
      r.salesType === 'Grand Total' && r.market === 'Total Company'
    );
    if (grandTotal.length) return grandTotal;
  }

  if (!agents.length && markets.length === 1 && !salesTypes.length) {
    const marketTotal = pnlRawData.filter(r =>
      r.salesType === 'Total' && r.market === markets[0]
    );
    if (marketTotal.length) return marketTotal;
  }

  return pnlRawData.filter(r =>
    !['Total','Grand Total'].includes(String(r.salesType || '')) &&
    !String(r.market || '').toLowerCase().includes('total company') &&
    (!agents.length || agents.includes(String(r.agent || ''))) &&
    (!markets.length || markets.includes(String(r.market || ''))) &&
    (!salesTypes.length || salesTypes.includes(String(r.salesType || '')))
  );
}

function pnlScenarioTotals(rows, scenario) {
  const result = Object.fromEntries(pnlLineConfig.map(x => [x.key, 0]));
  rows.filter(r => r.scenario === scenario).forEach(r => {
    pnlLineConfig.forEach(line => result[line.key] += pnlNumber(r[line.key]));
  });
  return result;
}

function pnlVarianceClass(value) {
  return value > 0 ? 'pnl-positive' : value < 0 ? 'pnl-negative' : '';
}

function pnlRatio(value, netSales) {
  return netSales ? value / netSales : 0;
}

function pnlRatioFormat(value, netSales) {
  if (!netSales) return '—';
  return `${(pnlRatio(value, netSales) * 100).toFixed(1)}%`;
}

function pnlPointFormat(value) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;
}

function renderPnlVertical() {
  const rows = pnlFilteredRows();
  const actual = pnlScenarioTotals(rows, 'Actual');
  const budget = pnlScenarioTotals(rows, 'Budget');
  const ly = pnlScenarioTotals(rows, 'LY');

  const table = $('pnlTable');
  if (!table) return;

  let html = `
    <thead>
      <tr>
        <th>P&amp;L Line</th>
        <th>Actual</th>
        <th>Budget</th>
        <th>LY</th>
        <th>Vs Budget</th>
        <th>Vs Budget %</th>
        <th>Vs LY</th>
        <th>Vs LY %</th>
      </tr>
    </thead>
    <tbody>`;

  pnlLineConfig.forEach(line => {
    const a = actual[line.key];
    const b = budget[line.key];
    const l = ly[line.key];
    const vb = a - b;
    const vl = a - l;
    const rowClass = line.total ? 'pnl-total' : line.subtotal ? 'pnl-subtotal' : '';

    html += `
      <tr class="${rowClass}">
        <td>${line.label}</td>
        <td>${pnlFormat(a)}</td>
        <td>${pnlFormat(b)}</td>
        <td>${pnlFormat(l)}</td>
        <td class="${pnlVarianceClass(vb)}">${pnlFormat(vb)}</td>
        <td class="pnl-percent ${pnlVarianceClass(vb)}">${pnlPercent(vb,b)}</td>
        <td class="${pnlVarianceClass(vl)}">${pnlFormat(vl)}</td>
        <td class="pnl-percent ${pnlVarianceClass(vl)}">${pnlPercent(vl,l)}</td>
      </tr>`;
  });

  html += '</tbody>';
  table.innerHTML = html;

  const marginTable = $('pnlMarginTable');
  if (marginTable) {
    const marginRows = [
      { label: 'COGS %', numerator: 'cogs' },
      { label: 'GP %', numerator: 'grossProfit' },
      { label: 'S&M %', numerator: 'sm' },
      { label: 'Net Profit %', numerator: 'netIncome' }
    ];

    let marginHtml = `
      <thead>
        <tr>
          <th>Margin Analysis</th>
          <th>Actual</th>
          <th>Budget</th>
          <th>LY</th>
          <th>Vs Budget</th>
          <th>Vs LY</th>
        </tr>
      </thead>
      <tbody>`;

    marginRows.forEach(row => {
      const actualRatio = pnlRatio(actual[row.numerator], actual.netSales);
      const budgetRatio = pnlRatio(budget[row.numerator], budget.netSales);
      const lyRatio = pnlRatio(ly[row.numerator], ly.netSales);
      const vsBudgetPoints = actualRatio - budgetRatio;
      const vsLyPoints = actualRatio - lyRatio;

      marginHtml += `
        <tr>
          <td>${row.label}</td>
          <td>${pnlRatioFormat(actual[row.numerator], actual.netSales)}</td>
          <td>${pnlRatioFormat(budget[row.numerator], budget.netSales)}</td>
          <td>${pnlRatioFormat(ly[row.numerator], ly.netSales)}</td>
          <td class="${pnlVarianceClass(vsBudgetPoints)}">${pnlPointFormat(vsBudgetPoints)}</td>
          <td class="${pnlVarianceClass(vsLyPoints)}">${pnlPointFormat(vsLyPoints)}</td>
        </tr>`;
    });

    marginHtml += '</tbody>';
    marginTable.innerHTML = marginHtml;
  }

  const netSalesVar = actual.netSales - budget.netSales;
  const gpVar = actual.grossProfit - budget.grossProfit;
  const niVar = actual.netIncome - budget.netIncome;
  const actualGpMargin = actual.netSales ? actual.grossProfit / actual.netSales : 0;
  const budgetGpMargin = budget.netSales ? budget.grossProfit / budget.netSales : 0;

  $('pnlNetSalesKpi').textContent = pnlFormat(actual.netSales);
  $('pnlGrossProfitKpi').textContent = pnlFormat(actual.grossProfit);
  $('pnlNetIncomeKpi').textContent = pnlFormat(actual.netIncome);
  $('pnlGpMarginKpi').textContent = `${(actualGpMargin*100).toFixed(1)}%`;

  const netEl = $('pnlNetSalesVar');
  const gpEl = $('pnlGrossProfitVar');
  const niEl = $('pnlNetIncomeVar');
  const gmEl = $('pnlGpMarginVar');

  netEl.textContent = `Vs Budget ${pnlFormat(netSalesVar)}`;
  gpEl.textContent = `Vs Budget ${pnlFormat(gpVar)}`;
  niEl.textContent = `Vs Budget ${pnlFormat(niVar)}`;
  gmEl.textContent = `Budget ${(budgetGpMargin*100).toFixed(1)}%`;

  [ [netEl,netSalesVar], [gpEl,gpVar], [niEl,niVar] ].forEach(([el,v]) => {
    el.classList.remove('positive','negative');
    if (v > 0) el.classList.add('positive');
    if (v < 0) el.classList.add('negative');
  });

  $('pnlCount').textContent = `${pnlLineConfig.length} P&L lines`;
}


function pnlNormalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function pnlFindHeaderIndex(rows) {
  return rows.findIndex(row => {
    const normalized = row.map(pnlNormalizeHeader);
    return normalized.includes('salestype') &&
           normalized.includes('market') &&
           normalized.includes('agent') &&
           normalized.includes('scenario');
  });
}

function pnlReadNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;

  let text = String(value).trim();
  let negative = false;

  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/,/g, '').replace(/[^\d.-]/g, '');
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return negative ? -Math.abs(number) : number;
}

function pnlMapWorkbookRows(rows, headerIndex) {
  const header = rows[headerIndex].map(pnlNormalizeHeader);
  const col = name => header.indexOf(pnlNormalizeHeader(name));

  const required = ['Sales Type', 'Market', 'Agent', 'Scenario'];
  const missing = required.filter(name => col(name) < 0);
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  const numericColumns = {
    grossSales: 'Gross Sales',
    salesReturns: 'Sales Returns',
    discounts: 'Discounts',
    commissions: 'Commissions',
    restoun: 'Restoun',
    netSales: 'Net Sales',
    cogs: 'COGS',
    grossProfit: 'Gross Profit',
    sm: 'S&M',
    netIncome: 'Net Income'
  };

  const mapped = rows.slice(headerIndex + 1)
    .filter(row => row && row.some(cell => String(cell ?? '').trim() !== ''))
    .map(row => {
      const record = {
        salesType: String(row[col('Sales Type')] || '').trim(),
        market: String(row[col('Market')] || '').trim(),
        agent: String(row[col('Agent')] || '').trim(),
        scenario: String(row[col('Scenario')] || '').trim()
      };

      Object.entries(numericColumns).forEach(([key, label]) => {
        const index = col(label);
        record[key] = index >= 0 ? pnlReadNumber(row[index]) : 0;
      });

      return record;
    })
    .filter(row => ['actual', 'budget', 'ly'].includes(row.scenario.toLowerCase()))
    .map(row => ({
      ...row,
      scenario: row.scenario.toLowerCase() === 'actual'
        ? 'Actual'
        : row.scenario.toLowerCase() === 'budget'
          ? 'Budget'
          : 'LY'
    }));

  if (!mapped.length) {
    throw new Error('No Actual, Budget, or LY records were found in the selected workbook.');
  }

  return mapped;
}

async function handlePnlExcelUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const status = $('pnlUploadStatus');
  status?.classList.remove('success', 'error');
  if (status) {
    status.innerHTML = '<span class="pnl-status-dot"></span><span>Reading P&amp;L workbook...</span>';
  }

  try {
    if (typeof XLSX === 'undefined') {
      throw new Error('Excel reader is unavailable. Check your internet connection and reload the report.');
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true
    });

    const preferredSheet = workbook.SheetNames.find(name =>
      ['raw data', 'p&l', 'pl', 'income statement'].includes(name.trim().toLowerCase())
    ) || workbook.SheetNames[0];

    const sheet = workbook.Sheets[preferredSheet];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true
    });

    const headerIndex = pnlFindHeaderIndex(rows);
    if (headerIndex < 0) {
      throw new Error('The required P&L header row was not found.');
    }

    pnlRawData = pnlMapWorkbookRows(rows, headerIndex);

    ['pnlAgentFilter','pnlMarketFilter','pnlSalesTypeFilter'].forEach(id => {
      if ($(id)) $(id).value = 'All';
    });

    rebuildPnlFilters();
    renderPnlVertical();

    if (status) {
      status.classList.add('success');
      status.innerHTML = `<span class="pnl-status-dot"></span><span>Loaded: <strong>${esc(file.name)}</strong> · Sheet: <strong>${esc(preferredSheet)}</strong> · ${pnlRawData.length.toLocaleString('en-US')} records</span>`;
    }
  } catch (error) {
    console.error(error);
    if (status) {
      status.classList.add('error');
      status.innerHTML = `<span class="pnl-status-dot"></span><span>${esc(error.message || 'Unable to read the P&L workbook.')}</span>`;
    }
  } finally {
    event.target.value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPnlFilters();
  renderPnlVertical();
});


/* Sidebar collapse / expand */
(function () {
  function initSidebarToggle() {
    const layout = document.querySelector('.report-layout');
    const toggle = document.getElementById('sidebarToggle');
    const icon = toggle?.querySelector('.sidebar-toggle-icon');

    if (!layout || !toggle || toggle.dataset.bound === '1') return;

    const applyState = (collapsed) => {
      layout.classList.toggle('sidebar-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute(
        'aria-label',
        collapsed ? 'Expand navigation' : 'Collapse navigation'
      );
      toggle.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
      if (icon) icon.textContent = collapsed ? '»' : '«';

      try {
        localStorage.setItem('businessReviewSidebarCollapsed', collapsed ? '1' : '0');
      } catch (_) {}
    };

    let savedCollapsed = false;
    try {
      savedCollapsed = localStorage.getItem('businessReviewSidebarCollapsed') === '1';
    } catch (_) {}

    applyState(savedCollapsed);

    toggle.addEventListener('click', () => {
      applyState(!layout.classList.contains('sidebar-collapsed'));
    });

    toggle.dataset.bound = '1';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarToggle);
  } else {
    initSidebarToggle();
  }
})();




/* Active filter summary */
function getDashboardFilterElements(){
  return [...document.querySelectorAll('.multi-filter')]
    .filter(el=>!['sm','pnl'].includes(el.dataset.filterScope) && typeof el._getSelected==='function');
}

function removeFilterValue(filterEl,value){
  const selected=filterEl._getSelected().map(String);
  const remaining=selected.filter(item=>item!==String(value));
  filterEl._setSelected(remaining);

  const applyButton=filterEl.querySelector('.apply-selection');
  if(applyButton){
    applyButton.click();
  }else{
    updateActiveFilterChips();
  }
}

function clearDashboardFilter(filterEl){
  filterEl._setSelected([]);
  const applyButton=filterEl.querySelector('.apply-selection');
  if(applyButton){
    applyButton.click();
  }
}

function updateActiveFilterChips(){
  const bar=document.getElementById('activeFilterBar');
  const chips=document.getElementById('activeFilterChips');
  if(!bar||!chips) return;

  chips.innerHTML='';
  let chipCount=0;

  getDashboardFilterElements().forEach(filterEl=>{
    const selected=filterEl._getSelected().map(String);
    if(!selected.length) return;

    const label=filterEl.dataset.filterLabel||'Filter';

    selected.forEach(value=>{
      const chip=document.createElement('button');
      chip.type='button';
      chip.className='active-filter-chip';
      chip.title=`Remove ${label}: ${value}`;
      chip.innerHTML=`<span class="chip-label">${esc(label)}:</span><span>${esc(value)}</span><b aria-hidden="true">×</b>`;
      chip.addEventListener('click',()=>removeFilterValue(filterEl,value));
      chips.appendChild(chip);
      chipCount++;
    });
  });

  bar.hidden=chipCount===0;
}

document.addEventListener('click',event=>{
  if(event.target.closest('#clearAllActiveFilters')){
    const filters=getDashboardFilterElements().filter(el=>el._getSelected().length);
    filters.forEach(el=>el._setSelected([]));

    // Trigger the dashboard refresh once using the first available Apply action.
    const applyButton=filters[0]?.querySelector('.apply-selection');
    if(applyButton){
      applyButton.click();
    }else{
      updateActiveFilterChips();
    }
  }
});

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(updateActiveFilterChips,0);
});

/* Universal sortable tables */
(function () {
  const sortState = new WeakMap();

  function parseSortableValue(cell) {
    const raw = (cell?.textContent || '').trim();
    if (!raw) return { type: 'text', value: '' };

    let text = raw.replace(/,/g, '').replace(/\s+/g, ' ').trim();
    let negative = false;

    if (/^\(.*\)$/.test(text)) {
      negative = true;
      text = text.slice(1, -1);
    }

    const isPercent = text.endsWith('%');
    if (isPercent) text = text.slice(0, -1);

    if (/^[<>]\s*200$/.test(text)) {
      return {
        type: 'number',
        value: text.startsWith('<') ? -200 : 200
      };
    }

    const numeric = Number(text.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(numeric) && /[\d]/.test(text)) {
      return {
        type: 'number',
        value: negative ? -Math.abs(numeric) : numeric
      };
    }

    return {
      type: 'text',
      value: raw.toLocaleLowerCase()
    };
  }

  function clearSortIndicators(table) {
    table.querySelectorAll('thead th').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      th.removeAttribute('aria-sort');
    });
  }

  function sortTable(table, columnIndex) {
    const tbody = table.tBodies?.[0];
    if (!tbody) return;

    const previous = sortState.get(table) || { column: -1, direction: 'desc' };
    const direction =
      previous.column === columnIndex && previous.direction === 'asc'
        ? 'desc'
        : 'asc';

    const rows = [...tbody.rows];
    const totalRows = rows.filter(row => row.classList.contains('total-row'));
    const dataRows = rows.filter(row => !row.classList.contains('total-row'));

    dataRows.sort((rowA, rowB) => {
      const a = parseSortableValue(rowA.cells[columnIndex]);
      const b = parseSortableValue(rowB.cells[columnIndex]);

      let result;
      if (a.type === 'number' && b.type === 'number') {
        result = a.value - b.value;
      } else {
        result = String(a.value).localeCompare(String(b.value), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      }

      return direction === 'asc' ? result : -result;
    });

    dataRows.forEach(row => tbody.appendChild(row));
    totalRows.forEach(row => tbody.appendChild(row));

    clearSortIndicators(table);
    const header = table.tHead?.rows?.[0]?.cells?.[columnIndex];
    if (header) {
      header.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
      header.setAttribute(
        'aria-sort',
        direction === 'asc' ? 'ascending' : 'descending'
      );
    }

    sortState.set(table, { column: columnIndex, direction });
  }

  document.addEventListener('click', event => {
    const header = event.target.closest(
      '#salesTable thead th, #focTable thead th, #varianceTable thead th, #countryDetailTable thead th, #pnlTable thead th'
    );

    if (!header) return;

    const table = header.closest('table');
    if (!table) return;

    sortTable(table, header.cellIndex);
  });

  document.addEventListener('keydown', event => {
    const header = event.target.closest(
      '#salesTable thead th, #focTable thead th, #varianceTable thead th, #countryDetailTable thead th, #pnlTable thead th'
    );

    if (!header || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();

    const table = header.closest('table');
    if (table) sortTable(table, header.cellIndex);
  });

  function makeHeadersAccessible() {
    document
      .querySelectorAll(
        '#salesTable thead th, #focTable thead th, #varianceTable thead th, #countryDetailTable thead th, #pnlTable thead th'
      )
      .forEach(th => {
        if (!th.hasAttribute('tabindex')) th.setAttribute('tabindex', '0');
        if (!th.title) th.title = 'Click to sort';
      });
  }

  const observer = new MutationObserver(makeHeadersAccessible);
  observer.observe(document.body, { childList: true, subtree: true });
  makeHeadersAccessible();
})();


// ============================================================
// Selling & Marketing Expenses — uploaded workbook structure:
// Expense | Country | Period | Date | Amount
// Actual for the selected year, Budget for selected year,
// and LY = Actual for the prior year.
// ============================================================
const smAttachedRows = [{"Expense":"Salaries and employees benefits","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":525.6124386459803},{"Expense":"Depreciations","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":10.118916784203096},{"Expense":"Office Expenses","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":21.579438645980254},{"Expense":"Travel & Transportation","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":20.695280677009873},{"Expense":"Governmental Fees","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":20.838139633286318},{"Expense":"Professional expenses","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":93.9161382228491},{"Expense":"Samples","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":2.4807475317348375},{"Expense":"Others","Country":"UAE","Period":"Actual","Date":"2026-03-01","Amount":5.6361622002820875},{"Expense":"Salaries and employees benefits","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":91.04828772919605},{"Expense":"Depreciations","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":6.3002299012694},{"Expense":"Office Expenses","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":0.4142073342736248},{"Expense":"Travel & Transportation","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":12.57850634696756},{"Expense":"Professional expenses","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":3.858156558533145},{"Expense":"Advertising & promotional expenses","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":23.592236953455576},{"Expense":"Samples","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Kuwait","Period":"Actual","Date":"2026-03-01","Amount":1.6230973201692525},{"Expense":"Salaries and employees benefits","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":164.43045275035263},{"Expense":"Depreciations","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":0.1599139633286319},{"Expense":"Office Expenses","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":0.8568758815232723},{"Expense":"Travel & Transportation","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":0.07077574047954865},{"Expense":"Governmental Fees","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":53.93025246826516},{"Expense":"Professional expenses","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":14.579062059238364},{"Expense":"Advertising & promotional expenses","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":38.16063892806768},{"Expense":"Samples","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":1.153119887165021},{"Expense":"Others","Country":"Qatar","Period":"Actual","Date":"2026-03-01","Amount":5.010227080394923},{"Expense":"Salaries and employees benefits","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":4.0},{"Expense":"Office Expenses","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":0.4527503526093089},{"Expense":"Travel & Transportation","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":1.2},{"Expense":"Professional expenses","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Samples","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":0.5430183356840621},{"Expense":"Others","Country":"Bahrain","Period":"Actual","Date":"2026-03-01","Amount":0.5},{"Expense":"Salaries and employees benefits","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":92.82765585331451},{"Expense":"Depreciations","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":7.842716502115657},{"Expense":"Office Expenses","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":0.6399026798307476},{"Expense":"Travel & Transportation","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":5.920688293370945},{"Expense":"Governmental Fees","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":25.97933850493653},{"Expense":"Professional expenses","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":0.028559943582510575},{"Expense":"Advertising & promotional expenses","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":4.164464033850493},{"Expense":"Samples","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Oman","Period":"Actual","Date":"2026-03-01","Amount":1.6900253878702403},{"Expense":"Salaries and employees benefits","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":583.549429622708},{"Expense":"Depreciations","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":3.9999999999999996},{"Expense":"Travel & Transportation","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":35.77999012693935},{"Expense":"Governmental Fees","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":33.0},{"Expense":"Professional expenses","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":143.41339915373794},{"Expense":"Samples","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":7.4700000000000015},{"Expense":"Others","Country":"UAE","Period":"Budget","Date":"2026-03-01","Amount":3.4999999999999996},{"Expense":"Salaries and employees benefits","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":90.30314095272759},{"Expense":"Depreciations","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":0.49999999999999994},{"Expense":"Governmental Fees","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":8.775100684931504},{"Expense":"Professional expenses","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":0.9999999999999999},{"Expense":"Advertising & promotional expenses","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":48.77},{"Expense":"Samples","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":1.5},{"Expense":"Others","Country":"Kuwait","Period":"Budget","Date":"2026-03-01","Amount":0.75},{"Expense":"Salaries and employees benefits","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":201.0991038298796},{"Expense":"Depreciations","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":0.9999999999999999},{"Expense":"Travel & Transportation","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":5.499999999999999},{"Expense":"Governmental Fees","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":2.060533333333333},{"Expense":"Professional expenses","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":0.49999999999999994},{"Expense":"Advertising & promotional expenses","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":38.16666666666667},{"Expense":"Samples","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":3.0},{"Expense":"Others","Country":"Qatar","Period":"Budget","Date":"2026-03-01","Amount":1.5999999999999999},{"Expense":"Salaries and employees benefits","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":3.9},{"Expense":"Professional expenses","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":6.4},{"Expense":"Samples","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Bahrain","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":108.90470254621039},{"Expense":"Depreciations","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":13.0},{"Expense":"Governmental Fees","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":10.669336459975616},{"Expense":"Professional expenses","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":12.669336459975618},{"Expense":"Advertising & promotional expenses","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":23.516666666666666},{"Expense":"Samples","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":3.480000000000001},{"Expense":"Others","Country":"Oman","Period":"Budget","Date":"2026-03-01","Amount":0.9999999999999999},{"Expense":"Salaries and employees benefits","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":544.5693503526094},{"Expense":"Depreciations","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":9.396110014104371},{"Expense":"Office Expenses","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":5.94379125528914},{"Expense":"Travel and transportation","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":18.962967559943582},{"Expense":"Governmental Fees","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":47.67624033850494},{"Expense":"Professional expenses","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":80.58413681241184},{"Expense":"Samples","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":7.095566995768689},{"Expense":"Others","Country":"UAE","Period":"Actual","Date":"2025-03-01","Amount":3.0611650211565586},{"Expense":"Salaries and employees benefits","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":87.10664739069111},{"Expense":"Depreciations","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":7.264850493653033},{"Expense":"Office Expenses","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":0.6378631875881523},{"Expense":"Travel & Transportation","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":0.02919605077574048},{"Expense":"Governmental Fees","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":6.293459802538787},{"Expense":"Professional expenses","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":0.3348730606488011},{"Expense":"Advertising & promotional expenses","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":20.422957686882935},{"Expense":"Samples","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":0.4819167842031029},{"Expense":"Others","Country":"Kuwait","Period":"Actual","Date":"2025-03-01","Amount":0.75},{"Expense":"Salaries and employees benefits","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":192.53061354019744},{"Expense":"Depreciations","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":0.35238787023977436},{"Expense":"Office Expenses","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":1.1016995768688294},{"Expense":"Travel & Transportation","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":1.7075458392101552},{"Expense":"Professional expenses","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":1.4190705218617772},{"Expense":"Advertising & promotional expenses","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":28.262562764456984},{"Expense":"Samples","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":4.00293370944993},{"Expense":"Others","Country":"Qatar","Period":"Actual","Date":"2025-03-01","Amount":2.1219915373765867},{"Expense":"Salaries and employees benefits","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.02538787023977433},{"Expense":"Office Expenses","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.15937940761636107},{"Expense":"Travel & Transportation","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Professional expenses","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Samples","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Others","Country":"Bahrain","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":79.44725387870241},{"Expense":"Depreciations","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":7.101086036671369},{"Expense":"Office Expenses","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":0.6092722143864598},{"Expense":"Travel & Transportation","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":1.1885190409026798},{"Expense":"Governmental Fees","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":7.776143864598025},{"Expense":"Professional expenses","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":1.4572073342736251},{"Expense":"Samples","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":2.227132581100141},{"Expense":"Others","Country":"Oman","Period":"Actual","Date":"2025-03-01","Amount":1.0990775740479548},{"Expense":"Salaries and employees benefits","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":936.2375655853316},{"Expense":"Depreciations","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":16.692758815232725},{"Expense":"Office Expenses","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":12.433854724964737},{"Expense":"Travel & Transportation","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":25.728843441466854},{"Expense":"Governmental Fees","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":68.23913681241184},{"Expense":"Professional expenses","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":64.79684203102963},{"Expense":"Advertising & promotional expenses","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":182.07720451339915},{"Expense":"Samples","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":40.99784767277856},{"Expense":"Others","Country":"Jordan","Period":"Actual","Date":"2026-03-01","Amount":15.742049365303245},{"Expense":"Salaries and employees benefits","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":942.274860522708},{"Expense":"Depreciations","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":54.99999999999999},{"Expense":"Office Expenses","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":12.996166834575861},{"Expense":"Travel & Transportation","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":27.89999999999999},{"Expense":"Governmental Fees","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":83.99987306064881},{"Expense":"Professional expenses","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":48.17389999999998},{"Expense":"Advertising & promotional expenses","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":395.9998},{"Expense":"Samples","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":89.79},{"Expense":"Others","Country":"Jordan","Period":"Budget","Date":"2026-03-01","Amount":6.629426153536168},{"Expense":"Salaries and employees benefits","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":913.7468956276444},{"Expense":"Depreciations","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":12.077634696755993},{"Expense":"Office Expenses","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":9.316753173483779},{"Expense":"Travel & Transportation","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":26.965444287729195},{"Expense":"Governmental Fees","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":101.72601974612131},{"Expense":"Professional expenses","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":37.437609308885754},{"Expense":"Advertising & promotional expenses","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":210.44400423131168},{"Expense":"Samples","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":105.75528772919603},{"Expense":"Others","Country":"Jordan","Period":"Actual","Date":"2025-03-01","Amount":12.284057827926658},{"Expense":"Salaries and employees benefits","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":90.26588152327221},{"Expense":"Depreciations","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":36.6272581100142},{"Expense":"Office Expenses","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":1.09},{"Expense":"Travel & Transportation","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":11.560252468265164},{"Expense":"Governmental Fees","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":11.909885754583922},{"Expense":"Professional expenses","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":0.1471622002820876},{"Expense":"Samples","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":12.943702397743301},{"Expense":"Others","Country":"Iraq","Period":"Actual","Date":"2026-03-01","Amount":2.0946389280677007},{"Expense":"Salaries and employees benefits","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":138.7965},{"Expense":"Depreciations","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":3.0},{"Expense":"Travel & Transportation","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":9.0},{"Expense":"Governmental Fees","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":26.253272256666666},{"Expense":"Professional expenses","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":23.999999999999993},{"Expense":"Samples","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":49.59000000000001},{"Expense":"Others","Country":"Iraq","Period":"Budget","Date":"2026-03-01","Amount":2.5},{"Expense":"Salaries and employees benefits","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":83.2379407616361},{"Expense":"Depreciations","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":29.098866008462625},{"Expense":"Office Expenses","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":3.086026798307476},{"Expense":"Governmental Fees","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":43.53478138222849},{"Expense":"Professional expenses","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":0.9466488011283509},{"Expense":"Samples","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":28.591190409026797},{"Expense":"Others","Country":"Iraq","Period":"Actual","Date":"2025-03-01","Amount":2.3488334273624827},{"Expense":"Salaries and employees benefits","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":11.0},{"Expense":"Depreciations","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":0.9026798307475318},{"Expense":"Governmental Fees","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":1.3844146685472496},{"Expense":"Professional expenses","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":1.1993935119887165},{"Expense":"Samples","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Libya","Period":"Actual","Date":"2026-03-01","Amount":4.12050916784203},{"Expense":"Salaries and employees benefits","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":4.5},{"Expense":"Governmental Fees","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":0.241125},{"Expense":"Professional expenses","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":32.0},{"Expense":"Samples","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Libya","Period":"Budget","Date":"2026-03-01","Amount":1.9999999999999998},{"Expense":"Salaries and employees benefits","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":0.6001410437235543},{"Expense":"Governmental Fees","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":17.666322990126936},{"Expense":"Professional expenses","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":27.318607898448523},{"Expense":"Samples","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Others","Country":"Libya","Period":"Actual","Date":"2025-03-01","Amount":6.727234132581101},{"Expense":"Salaries and employees benefits","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":58.45505077574048},{"Expense":"Depreciations","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":0.12179266572637518},{"Expense":"Office Expenses","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":7.873906911142455},{"Expense":"Professional expenses","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":2.0},{"Expense":"Advertising & promotional expenses","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Samples","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Sudan","Period":"Actual","Date":"2026-03-01","Amount":5.159200282087447},{"Expense":"Salaries and employees benefits","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":60.57625},{"Expense":"Depreciations","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Professional expenses","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Samples","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Sudan","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":58.45505077574048},{"Expense":"Depreciations","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":0.12179266572637518},{"Expense":"Office Expenses","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":7.873906911142455},{"Expense":"Professional expenses","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":2.0},{"Expense":"Advertising & promotional expenses","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Samples","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Others","Country":"Sudan","Period":"Actual","Date":"2025-03-01","Amount":5.159200282087447},{"Expense":"Salaries and employees benefits","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":106.8035077574048},{"Expense":"Depreciations","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":1.3105077574047959},{"Expense":"Office Expenses","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":0.21017489421720734},{"Expense":"Travel & Transportation","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":3.66018335684062},{"Expense":"Professional expenses","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":7.908000000000001},{"Expense":"Samples","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Lebanon","Period":"Actual","Date":"2026-03-01","Amount":13.47897743300423},{"Expense":"Salaries and employees benefits","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":132.0759818435754},{"Expense":"Depreciations","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":2.065},{"Expense":"Governmental Fees","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":3.63},{"Expense":"Professional expenses","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":1.9999999999999998},{"Expense":"Advertising & promotional expenses","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":39.0},{"Expense":"Samples","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":3.0},{"Expense":"Others","Country":"Lebanon","Period":"Budget","Date":"2026-03-01","Amount":23.2},{"Expense":"Salaries and employees benefits","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":134.14112411847674},{"Expense":"Depreciations","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":1.266722143864598},{"Expense":"Office Expenses","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":0.4346502115655853},{"Expense":"Travel & Transportation","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":0.038300423131170665},{"Expense":"Governmental Fees","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":0.49238363892806775},{"Expense":"Professional expenses","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":3.6599985895627642},{"Expense":"Advertising & promotional expenses","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":15.39578279266573},{"Expense":"Samples","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":2.150056417489422},{"Expense":"Others","Country":"Lebanon","Period":"Actual","Date":"2025-03-01","Amount":14.363124118476728},{"Expense":"Salaries and employees benefits","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":8.502115655853315},{"Expense":"Professional expenses","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Samples","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Uganda","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":6.0},{"Expense":"Professional expenses","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Samples","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Uganda","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":2.849083215796897},{"Expense":"Professional expenses","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Samples","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":7.0874471086036674},{"Expense":"Others","Country":"Uganda","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.2736248236953456},{"Expense":"Professional expenses","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Samples","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Zambia","Period":"Actual","Date":"2026-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":1.0},{"Expense":"Professional expenses","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Samples","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Others","Country":"Zambia","Period":"Budget","Date":"2026-03-01","Amount":0.0},{"Expense":"Salaries and employees benefits","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Depreciations","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Office Expenses","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Travel & Transportation","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Governmental Fees","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.2538787023977433},{"Expense":"Professional expenses","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Advertising & promotional expenses","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Samples","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0},{"Expense":"Others","Country":"Zambia","Period":"Actual","Date":"2025-03-01","Amount":0.0}];
let smSimpleRows = smAttachedRows.map(row => ({...row}));

function smSimpleDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if(typeof value === 'number'){
    const epoch = new Date(Date.UTC(1899,11,30));
    return new Date(epoch.getTime() + value * 86400000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function smSimpleAmount(value){
  if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value ?? '').trim();
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[(),]/g,'').replace(/[^0-9.-]/g,'');
  const amount = Number(text);
  return Number.isFinite(amount) ? (negative ? -Math.abs(amount) : amount) : 0;
}

function smSimpleNormalize(raw){
  const get = name => {
    const key = Object.keys(raw).find(k => String(k).trim().toLowerCase() === name.toLowerCase());
    return key === undefined ? '' : raw[key];
  };
  const date = smSimpleDate(get('Date'));
  return {
    Expense: String(get('Expense') || '').trim(),
    Country: String(get('Country') || '').trim(),
    Period: String(get('Period') || '').trim(),
    Date: date ? date.toISOString().slice(0,10) : '',
    Amount: smSimpleAmount(get('Amount'))
  };
}

function smSimpleMonthKey(row){
  const d = smSimpleDate(row.Date);
  return d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}` : '';
}

function smSimpleMonthLabel(key){
  const [year,month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(Date.UTC(year,month-1,1)));
}

function smSimpleFormat(value){
  const rounded = Math.round(Number(value)||0);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString('en-US')})` : rounded.toLocaleString('en-US');
}

function smSimplePercent(value){
  if(!Number.isFinite(value)) return '—';
  return `${Math.round(value*100)}%`;
}

function smSimpleFilterData(){
  return smSimpleRows.map(row=>({
    'Reporting Month': smSimpleMonthLabel(smSimpleMonthKey(row)),
    'Country': row.Country
  })).filter(row=>row['Reporting Month'] && row.Country);
}

function smSimplePopulateFilters(){
  const monthEl = $('smSimpleMonthFilter');
  const countryEl = $('smSimpleCountryFilter');
  if(!monthEl || !countryEl) return;

  const filterData = smSimpleFilterData();
  const actualMonthKeys = [...new Set(smSimpleRows
    .filter(r=>String(r.Period).toLowerCase()==='actual')
    .map(smSimpleMonthKey)
    .filter(Boolean))]
    .sort()
    .reverse();

  const latestMonthLabel = actualMonthKeys[0] ? smSimpleMonthLabel(actualMonthKeys[0]) : '';
  const countries = [...new Set(smSimpleRows.map(r=>r.Country).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
  const defaultCountry = countries.includes('Jordan') ? 'Jordan' : (countries[0] || '');

  createMultiFilter(
    monthEl,
    filterData,
    'Reporting Month',
    renderSmExpenses,
    latestMonthLabel ? [latestMonthLabel] : []
  );

  createMultiFilter(
    countryEl,
    filterData,
    'Country',
    renderSmExpenses,
    defaultCountry ? [defaultCountry] : []
  );
}

function smSimpleAggregate(){
  const selectedMonthLabels = getSelected('smSimpleMonthFilter');
  const selectedCountries = getSelected('smSimpleCountryFilter');

  const actualMonthKeys = [...new Set(smSimpleRows
    .filter(r=>String(r.Period).toLowerCase()==='actual')
    .map(smSimpleMonthKey)
    .filter(Boolean))]
    .sort()
    .reverse();

  const selectedMonthKeys = selectedMonthLabels.length
    ? actualMonthKeys.filter(key=>selectedMonthLabels.includes(smSimpleMonthLabel(key)))
    : actualMonthKeys;

  const selectedCountrySet = new Set(
    selectedCountries.length
      ? selectedCountries
      : [...new Set(smSimpleRows.map(r=>r.Country).filter(Boolean))]
  );

  if(!selectedMonthKeys.length || !selectedCountrySet.size) return [];

  const selectedPeriods = selectedMonthKeys.map(key=>({
    year:Number(key.slice(0,4)),
    month:Number(key.slice(5,7))
  }));

  const map = new Map();
  const getItem = expense => {
    if(!map.has(expense)) map.set(expense,{expense,actual:0,budget:0,ly:0});
    return map.get(expense);
  };

  smSimpleRows.forEach(row=>{
    if(!selectedCountrySet.has(row.Country)) return;

    const d = smSimpleDate(row.Date);
    if(!d) return;

    const rowYear = d.getUTCFullYear();
    const rowMonth = d.getUTCMonth()+1;
    const period = String(row.Period).trim().toLowerCase();
    const item = getItem(row.Expense || 'Unassigned');

    selectedPeriods.forEach(({year,month})=>{
      if(rowMonth !== month) return;
      if(rowYear === year && period === 'actual') item.actual += Math.abs(row.Amount);
      if(rowYear === year && period === 'budget') item.budget += Math.abs(row.Amount);
      if(rowYear === year-1 && period === 'actual') item.ly += Math.abs(row.Amount);
    });
  });

  return [...map.values()]
    .filter(x=>x.actual || x.budget || x.ly)
    .sort((a,b)=>b.actual-a.actual);
}

function smSimpleCellClass(value, expenseVariance=true){
  if(value === 0) return 'sm-zero';
  if(expenseVariance) return value > 0 ? 'sm-good' : 'sm-bad';
  return value > 0 ? 'sm-bad' : 'sm-good';
}

function renderSmExpenses(){
  const tbody = document.querySelector('#smSimpleTable tbody');
  if(!tbody) return;
  const rows = smSimpleAggregate();

  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="8" class="sm-no-data">No matching data for the selected month and country.</td></tr>';
    return;
  }

  let totals={actual:0,budget:0,ly:0};
  tbody.innerHTML = rows.map(row=>{
    totals.actual += row.actual;
    totals.budget += row.budget;
    totals.ly += row.ly;
    const vsBudget = row.budget-row.actual;
    const vsBudgetPct = row.budget ? row.actual/row.budget-1 : NaN;
    const vsLy = row.ly-row.actual;
    const vsLyPct = row.ly ? row.actual/row.ly-1 : NaN;
    return `<tr>
      <td>${esc(row.expense)}</td>
      <td>${smSimpleFormat(row.actual)}</td>
      <td>${smSimpleFormat(row.budget)}</td>
      <td class="${smSimpleCellClass(vsBudget,true)}">${smSimpleFormat(vsBudget)}</td>
      <td class="${smSimpleCellClass(vsBudgetPct,false)}">${smSimplePercent(vsBudgetPct)}</td>
      <td>${smSimpleFormat(row.ly)}</td>
      <td class="${smSimpleCellClass(vsLy,true)}">${smSimpleFormat(vsLy)}</td>
      <td class="${smSimpleCellClass(vsLyPct,false)}">${smSimplePercent(vsLyPct)}</td>
    </tr>`;
  }).join('');

  const totalVsBudget=totals.budget-totals.actual;
  const totalVsBudgetPct=totals.budget?totals.actual/totals.budget-1:NaN;
  const totalVsLy=totals.ly-totals.actual;
  const totalVsLyPct=totals.ly?totals.actual/totals.ly-1:NaN;

  tbody.insertAdjacentHTML('beforeend',`<tr class="sm-total-row">
    <td>Total</td>
    <td>${smSimpleFormat(totals.actual)}</td>
    <td>${smSimpleFormat(totals.budget)}</td>
    <td class="${smSimpleCellClass(totalVsBudget,true)}">${smSimpleFormat(totalVsBudget)}</td>
    <td class="${smSimpleCellClass(totalVsBudgetPct,false)}">${smSimplePercent(totalVsBudgetPct)}</td>
    <td>${smSimpleFormat(totals.ly)}</td>
    <td class="${smSimpleCellClass(totalVsLy,true)}">${smSimpleFormat(totalVsLy)}</td>
    <td class="${smSimpleCellClass(totalVsLyPct,false)}">${smSimplePercent(totalVsLyPct)}</td>
  </tr>`);
}

async function smSimpleUpload(event){
  const file = event.target.files?.[0];
  if(!file) return;
  const status = $('smSimpleStatus');
  try{
    status.textContent='Reading file…';
    const workbook = XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const sheetName = workbook.SheetNames.find(n=>/selling|marketing|expense/i.test(n)) || workbook.SheetNames[0];
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{defval:'',raw:true});
    const normalized = raw.map(smSimpleNormalize).filter(r=>r.Expense && r.Country && r.Period && r.Date);
    if(!normalized.length) throw new Error('The file must contain: Expense, Country, Period, Date and Amount.');
    smSimpleRows = normalized;
    smSimplePopulateFilters();
    renderSmExpenses();
    status.textContent=`Source: ${file.name} · ${normalized.length.toLocaleString('en-US')} rows`;
    status.classList.remove('error');
  }catch(error){
    status.textContent=error.message;
    status.classList.add('error');
  }finally{
    event.target.value='';
  }
}

function initSmSimpleReport(){
  const upload=$('smSimpleFileInput');
  const resetData=$('smSimpleResetBtn');
  const resetFilters=$('smSimpleFilterResetBtn');

  if(upload) upload.addEventListener('change',smSimpleUpload);

  if(resetData) resetData.addEventListener('click',()=>{
    smSimpleRows=smAttachedRows.map(row=>({...row}));
    smSimplePopulateFilters();
    renderSmExpenses();
    $('smSimpleStatus').textContent='Source: Selling and Marketing Expenses.xlsx';
    $('smSimpleStatus').classList.remove('error');
  });

  if(resetFilters) resetFilters.addEventListener('click',()=>{
    smSimplePopulateFilters();
    renderSmExpenses();
  });

  smSimplePopulateFilters();
  renderSmExpenses();
}

initSmSimpleReport();


// Enable sorting for Selling & Marketing table
(function(){
let smSort={index:0,asc:true};

function smCellValue(tr,index){
  const td=tr.children[index];
  if(!td) return "";
  let txt=td.textContent.trim();
  const neg=/^\(.*\)$/.test(txt);
  txt=txt.replace(/[(),%,$]/g,"").replace(/,/g,"");
  const n=Number(txt);
  if(!Number.isNaN(n) && txt!=="") return neg?-n:n;
  return td.textContent.trim().toLowerCase();
}

function bindSmSort(){
  const table=document.getElementById("smSimpleTable");
  if(!table) return;
  const headers=table.tHead?.rows[0]?.cells;
  if(!headers) return;

  [...headers].forEach((th,i)=>{
    if(th.dataset.sortBound) return;
    th.dataset.sortBound="1";
    th.style.cursor="pointer";
    th.addEventListener("click",()=>{
      const tbody=table.tBodies[0];
      const rows=[...tbody.rows];
      const total=rows.find(r=>r.classList.contains("sm-total-row"));
      const data=rows.filter(r=>!r.classList.contains("sm-total-row") && !r.querySelector(".sm-no-data"));
      const asc=(smSort.index===i)?!smSort.asc:true;
      smSort={index:i,asc};

      data.sort((a,b)=>{
        const av=smCellValue(a,i), bv=smCellValue(b,i);
        if(typeof av==="number" && typeof bv==="number") return asc?av-bv:bv-av;
        return asc?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
      });

      tbody.innerHTML="";
      data.forEach(r=>tbody.appendChild(r));
      if(total) tbody.appendChild(total);
    });
  });
}

const oldRender=renderSmExpenses;
renderSmExpenses=function(){
  oldRender();
  bindSmSort();
};
})();
