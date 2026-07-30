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
function constrainChildrenToParent(data,selections,parentId,childIds){
  const parentValues=selections[parentId]||[];
  if(!parentValues.length)return;
  const parentColumn=$(parentId).dataset.column;
  const parentRows=data.filter(row=>
    parentValues.includes(String(row[parentColumn]??''))
  );
  childIds.forEach(childId=>{
    const childColumn=$(childId).dataset.column;
    const available=new Set(uniqueValues(parentRows,childColumn));
    selections[childId]=(selections[childId]||[])
      .filter(value=>available.has(String(value)));
  });
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
function buildAllSalesFilters(reset=false,changedId=''){
  const years=uniqueValues(rawData,'Year').map(Number).filter(Number.isFinite);
  const latestYear=years.length?String(Math.max(...years)):'';
  const selections=reset
    ?Object.fromEntries(salesFilterIds.map(id=>[id,id==='yearFilter'&&latestYear?[latestYear]:[]]))
    :captureSelections(salesFilterIds);
  if(changedId==='countryFilter'){
    constrainChildrenToParent(rawData,selections,'countryFilter',[
      'sectorFilter','agentFilter','groupFilter','productFilter'
    ]);
  }
  rebuildDependentFilters(rawData,salesFilterIds,selections,nextChangedId=>{
    buildAllSalesFilters(false,nextChangedId);
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
  const isStock=tabId==='stockSection';
  document.body.classList.toggle('pnl-clean-view',isPnl);
  document.body.classList.toggle('sm-expense-view',isSmExpense);
  document.body.classList.toggle('stock-level-view',isStock);

  const headerSubtitle=$('headerSubtitle');
  if(headerSubtitle){
    headerSubtitle.textContent=isPnl
      ? 'Profit & Loss · Actual vs Budget vs Last Year'
      : isSmExpense
        ? 'Selling & Marketing Expenses · Actual vs Budget vs Last Year'
        : isStock
          ? 'Stock Level · Historical and Forecast Monthly Coverage'
          : 'Sales Actual vs Budget vs LY · TMS & IMS · FOC for IMS only';
  }

  if(isPnl && typeof renderPnlVertical==='function'){
    renderPnlVertical();
  }
  if(isSmExpense && typeof renderSmExpenses==='function'){
    renderSmExpenses();
  }
  if(isStock && typeof renderStockLevel==='function'){
    renderStockLevel();
  }
}

document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
  setBusinessReportTab(btn.dataset.tab);
}));

function setWorkspace(workspaceId){
  document.querySelectorAll('.workspace-btn').forEach(button=>{
    const active=button.dataset.workspace===workspaceId;
    button.classList.toggle('active',active);
    button.setAttribute('aria-expanded',String(active));
    const chevron=button.querySelector('.nav-chevron');
    if(chevron) chevron.textContent=active?'⌄':'›';
    const submenu=button.nextElementSibling;
    if(submenu?.classList.contains('side-submenu')){
      submenu.classList.toggle('open',active);
    }
  });
  document.querySelectorAll('.workspace-pane').forEach(pane=>{
    pane.classList.toggle('active',pane.id===workspaceId);
  });

  const isMda=workspaceId==='mdaWorkspace';
  document.body.classList.toggle('mda-view',isMda);
  if(isMda){
    document.body.classList.remove('pnl-clean-view','sm-expense-view','stock-level-view');
    const subtitle=$('headerSubtitle');
    if(subtitle) subtitle.textContent='Management Discussion & Analysis';
  }else{
    setBusinessReportTab(
      document.querySelector('#businessSubmenu .tab-btn.active')?.dataset.tab || 'salesSection'
    );
  }
}

document.querySelectorAll('.workspace-btn').forEach(button=>{
  button.addEventListener('click',()=>setWorkspace(button.dataset.workspace));
});

// Keep the initial Sales view consistent.
setWorkspace('businessWorkspace');
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

function renderAll(){if(!rawData.length)return;const rows=filtered();renderSalesTable(rows);renderFocTable(rows);}

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
function tableHtml(headers,rows,total=false,foc=false){
  let h='<thead><tr>'+headers.map(x=>`<th>${esc(x)}</th>`).join('')+'</tr></thead><tbody>';
  rows.forEach(row=>h+='<tr>'+row.map((v,i)=>cell(v,i,foc)).join('')+'</tr>');
  if(total&&rows.length){const t=headers.map((_,i)=>i===0?'Total':rows.reduce((a,r)=>a+(typeof r[i]==='number'?r[i]:0),0));if(foc){t[2]='';t[6]=pct(t[5],t[4]);}else{t[4]=pct(t[3],t[2]);t[7]=pct(t[6],t[5]);}h+='<tr class="total-row">'+t.map((v,i)=>cell(v,i,foc)).join('')+'</tr>';}
  return h+'</tbody>';
}
function cell(v,i,foc){
  if(i===0)return `<td>${esc(v)}</td>`;
  if(foc&&i===2)return `<td>${Math.round(Number(v||0)*100)}%</td>`;
  const isPct=typeof v==='string'&&v.includes('%');
  let n=typeof v==='number'?v:null;
  if(isPct){
    const parsed=Number(v.replace(/[^\d.-]/g,''));
    n=Number.isFinite(parsed)
      ? (v.trim().startsWith('<')?-Math.abs(parsed):parsed)
      : null;
  }
  const variance=(!foc&&[3,4,6,7].includes(i))||(foc&&i===5);
  const cls=variance&&n!==null?(n>0?'positive':n<0?'negative':''):'';
  const hi=(!foc&&[3,4,6,7].includes(i))||(foc&&[3,4,5,6].includes(i));
  return `<td class="${cls}${hi?' highlight':''}">${isPct?v:fmt(v)}</td>`;
}

const countryFlagCodes={
  jordan:'JO',
  ksa:'SA',
  saudiarabia:'SA',
  saudi:'SA',
  algeria:'DZ',
  iraq:'IQ',
  oman:'OM',
  uae:'AE',
  unitedarabemirates:'AE',
  emirates:'AE',
  qatar:'QA',
  bahrain:'BH',
  kuwait:'KW',
  yemen:'YE',
  egypt:'EG',
  libya:'LY',
  sudan:'SD',
  somalia:'SO',
  morocco:'MA',
  tunisia:'TN',
  palestine:'PS',
  lebanon:'LB',
  syria:'SY',
  turkey:'TR',
  iran:'IR'
};

function countryFlagCode(country){
  const key=String(country || '').toLowerCase().replace(/[^a-z]/g,'');
  return countryFlagCodes[key]?.toLowerCase() || '';
}

const countryFlagSvgs={
  jo:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#000" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#087a3e" d="M0 26.67h60V40H0z"/><path fill="#ce1126" d="M0 0l25 20L0 40z"/><text x="8.5" y="23.7" fill="#fff" font-size="11">★</text></svg>`,
  sa:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#006c35" d="M0 0h60v40H0z"/><path stroke="#fff" stroke-width="2" d="M16 29h29"/><path fill="#fff" d="M43 27l5 2-5 2z"/><text x="30" y="20" text-anchor="middle" fill="#fff" font-size="8" font-family="Arial">الله</text></svg>`,
  dz:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#087a3e" d="M0 0h30v40H0z"/><path fill="#fff" d="M30 0h30v40H30z"/><circle cx="31" cy="20" r="10" fill="#d21034"/><circle cx="34" cy="18" r="8" fill="#fff"/><text x="35" y="24" fill="#d21034" font-size="12">★</text></svg>`,
  iq:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#ce1126" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#000" d="M0 26.67h60V40H0z"/><text x="30" y="24" text-anchor="middle" fill="#078930" font-size="8" font-family="Arial">الله أكبر</text></svg>`,
  om:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#fff" d="M0 0h60v13.33H0z"/><path fill="#d72828" d="M0 13.33h60v13.34H0z"/><path fill="#009a44" d="M0 26.67h60V40H0z"/><path fill="#d72828" d="M0 0h15v40H0z"/><circle cx="7.5" cy="8" r="3" fill="#fff"/></svg>`,
  ae:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#009a49" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#000" d="M0 26.67h60V40H0z"/><path fill="#ce1126" d="M0 0h15v40H0z"/></svg>`,
  qa:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#8a1538" d="M0 0h60v40H0z"/><path fill="#fff" d="M0 0h20l8 2.2-8 2.2 8 2.2-8 2.2 8 2.2-8 2.2 8 2.2-8 2.2 8 2.2-8 2.2 8 2.2-8 2.2 8 2.2-8 2.2 8 2.2-8 2.2 8 2.2-8 2.2H0z"/></svg>`,
  bh:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#ce1126" d="M0 0h60v40H0z"/><path fill="#fff" d="M0 0h22l8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4H0z"/></svg>`,
  kw:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#007a3d" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#ce1126" d="M0 26.67h60V40H0z"/><path d="M0 0l15 13.33v13.34L0 40z"/></svg>`,
  ye:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#ce1126" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#000" d="M0 26.67h60V40H0z"/></svg>`,
  eg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#ce1126" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#000" d="M0 26.67h60V40H0z"/><circle cx="30" cy="20" r="3" fill="#c09300"/></svg>`,
  ly:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#e70013" d="M0 0h60v10H0z"/><path fill="#000" d="M0 10h60v20H0z"/><path fill="#239e46" d="M0 30h60v10H0z"/><circle cx="29" cy="20" r="6" fill="#fff"/><circle cx="31" cy="19" r="5" fill="#000"/><text x="35" y="23" fill="#fff" font-size="8">★</text></svg>`,
  sd:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#d21034" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#000" d="M0 26.67h60V40H0z"/><path fill="#007229" d="M0 0l23 20L0 40z"/></svg>`,
  so:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#4189dd" d="M0 0h60v40H0z"/><text x="30" y="29" text-anchor="middle" fill="#fff" font-size="26">★</text></svg>`,
  ma:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#c1272d" d="M0 0h60v40H0z"/><text x="30" y="28" text-anchor="middle" fill="none" stroke="#006233" stroke-width="2" font-size="24">☆</text></svg>`,
  tn:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#e70013" d="M0 0h60v40H0z"/><circle cx="30" cy="20" r="11" fill="#fff"/><circle cx="28" cy="20" r="7" fill="#e70013"/><circle cx="31" cy="18" r="6" fill="#fff"/><text x="33" y="23" fill="#e70013" font-size="9">★</text></svg>`,
  ps:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#009736" d="M0 26.67h60V40H0z"/><path fill="#ce1126" d="M0 0l24 20L0 40z"/></svg>`,
  lb:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#ed1c24" d="M0 0h60v10H0zM0 30h60v10H0z"/><path fill="#fff" d="M0 10h60v20H0z"/><path fill="#00a651" d="M30 12l-9 15h18z"/><path fill="#00a651" d="M28 24h4v6h-4z"/></svg>`,
  sy:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#ce1126" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path d="M0 26.67h60V40H0z"/><text x="23" y="24" fill="#007a3d" font-size="10">★</text><text x="34" y="24" fill="#007a3d" font-size="10">★</text></svg>`,
  tr:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#e30a17" d="M0 0h60v40H0z"/><circle cx="25" cy="20" r="10" fill="#fff"/><circle cx="28" cy="18" r="8" fill="#e30a17"/><text x="35" y="24" fill="#fff" font-size="10">★</text></svg>`,
  ir:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="#239f40" d="M0 0h60v13.33H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/><path fill="#da0000" d="M0 26.67h60V40H0z"/><circle cx="30" cy="20" r="3" fill="#da0000"/></svg>`
};

function countryFlagDataUri(code){
  const svg=countryFlagSvgs[code];
  return svg?`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`:'';
}

function setCountryModalTitle(title){
  $('countryModalTitle').textContent=title;
  const flag=$('countryModalFlag');
  if(flag){
    const code=countryFlagCode(activeCountry);
    flag.hidden=!code;
    flag.src=countryFlagDataUri(code);
    flag.alt=code?`${activeCountry} flag`:'';
    flag.title=activeCountry;
    flag.onerror=()=>{ flag.hidden=true; };
  }
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
  setCountryModalTitle(activeCountry);
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
  setCountryModalTitle(`${activeCountry} · ${brand}`);
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
  setCountryModalTitle(`${activeCountry} · IMS FOC`);
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
  setCountryModalTitle(`${activeCountry} · ${group}`);
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

let pnlRawData = [];
let pnlViewMode = 'full';
let pnlCurrency = 'USD';
const PNL_USD_TO_JOD = 0.709;

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
  { key: 'netIncome', label: 'Net Income', subtotal: true }
];

function pnlVisibleLines(){
  if(pnlViewMode==='netSales'){
    const start=pnlLineConfig.findIndex(line=>line.key==='netSales');
    return pnlLineConfig.slice(start);
  }
  if(pnlViewMode==='summary'){
    const summaryKeys=new Set([
      'grossSales','netSales','cogs','grossProfit','sm','netIncome'
    ]);
    return pnlLineConfig.filter(line=>summaryKeys.has(line.key));
  }
  return pnlLineConfig;
}

document.querySelectorAll('[data-pnl-view]').forEach(button=>{
  button.addEventListener('click',()=>{
    pnlViewMode=button.dataset.pnlView||'full';
    document.querySelectorAll('[data-pnl-view]').forEach(option=>{
      const active=option===button;
      option.classList.toggle('active',active);
      option.setAttribute('aria-pressed',String(active));
    });
    renderPnlVertical();
  });
});

document.querySelectorAll('[data-pnl-currency]').forEach(button=>{
  button.addEventListener('click',()=>{
    pnlCurrency=button.dataset.pnlCurrency==='JOD'?'JOD':'USD';
    document.querySelectorAll('[data-pnl-currency]').forEach(option=>{
      const active=option===button;
      option.classList.toggle('active',active);
      option.setAttribute('aria-pressed',String(active));
    });
    renderPnlVertical();
  });
});

function updatePnlSpotlightCountry(){
  const header=$('pnlSpotlightCountryHeader');
  const flag=$('pnlSpotlightCountryFlag');
  const name=$('pnlSpotlightCountryName');
  if(!header || !flag || !name) return;

  const selected=getSelected('pnlMarketFilter');
  const available=[...new Set(
    pnlFilterData().map(row=>row.Market).filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b));
  const markets=selected.length?selected:available;
  const singleMarket=markets.length===1?markets[0]:'';
  const code=singleMarket?countryFlagCode(singleMarket):'';

  name.textContent=singleMarket || (
    markets.length ? markets.join(' · ') : 'All Markets'
  );
  flag.hidden=!code;
  flag.src=code?countryFlagDataUri(code):'';
  flag.alt=code?`${singleMarket} flag`:'';
  flag.title=singleMarket;
  flag.onerror=()=>{ flag.hidden=true; };
}

function setPnlTableSpotlight(active){
  const spotlightButton=$('pnlSpotlightBtn');
  const exitButton=$('pnlSpotlightExitBtn');
  const countryHeader=$('pnlSpotlightCountryHeader');
  if(active) updatePnlSpotlightCountry();
  document.body.classList.toggle('pnl-table-spotlight',active);
  spotlightButton?.setAttribute('aria-pressed',String(active));
  if(exitButton) exitButton.hidden=!active;
  if(countryHeader) countryHeader.hidden=!active;
  if(active){
    exitButton?.focus();
  }else{
    spotlightButton?.focus();
  }
}

$('pnlSpotlightBtn')?.addEventListener('click',()=>setPnlTableSpotlight(true));
$('pnlSpotlightExitBtn')?.addEventListener('click',()=>setPnlTableSpotlight(false));

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

}

function rebuildPnlFilters(reset=false,changedId='') {
  const ids = ['pnlMarketFilter','pnlAgentFilter','pnlSalesTypeFilter'];
  const data = pnlFilterData();
  const selections = reset
    ? Object.fromEntries(ids.map(id => [id, []]))
    : captureSelections(ids);

  if(changedId==='pnlMarketFilter'){
    constrainChildrenToParent(data,selections,'pnlMarketFilter',[
      'pnlAgentFilter'
    ]);
  }
  rebuildDependentFilters(data,ids,selections,nextChangedId=>{
    rebuildPnlFilters(false,nextChangedId);
    renderPnlVertical();
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

function pnlConvertCurrency(totals) {
  const rate=pnlCurrency==='JOD'?PNL_USD_TO_JOD:1;
  return Object.fromEntries(
    Object.entries(totals).map(([key,value])=>[key,pnlNumber(value)*rate])
  );
}

function pnlVarianceClass(value) {
  return value > 0 ? 'pnl-positive' : value < 0 ? 'pnl-negative' : '';
}

function pnlAmountClass(value) {
  return value < 0 ? 'pnl-amount-negative' : '';
}

function pnlRatio(value, netSales) {
  return netSales ? value / netSales : 0;
}

function renderPnlVertical() {
  const rows = pnlFilteredRows();
  const actual = pnlConvertCurrency(pnlScenarioTotals(rows, 'Actual'));
  const budget = pnlConvertCurrency(pnlScenarioTotals(rows, 'Budget'));
  const ly = pnlConvertCurrency(pnlScenarioTotals(rows, 'LY'));

  const table = $('pnlTable');
  if (!table) return;
  const visibleLines = pnlVisibleLines();
  const count = $('pnlCount');
  if (count) count.textContent = `${visibleLines.length} P&L lines`;

  let html = `
    <thead>
      <tr class="pnl-group-head">
        <th rowspan="2">Consolidated P&amp;L</th>
        <th rowspan="2">Actual (${pnlCurrency})</th>
        <th rowspan="2">Budget (${pnlCurrency})</th>
        <th rowspan="2">LY (${pnlCurrency})</th>
        <th colspan="2">Vs Budget</th>
        <th colspan="2">Vs Last Year</th>
      </tr>
      <tr class="pnl-sub-head">
        <th>Value</th>
        <th>%</th>
        <th>Value</th>
        <th>%</th>
      </tr>
    </thead>
    <tbody>`;

  visibleLines.forEach(line => {
    const a = actual[line.key];
    const b = budget[line.key];
    const l = ly[line.key];
    const vb = a - b;
    const vl = a - l;
    const rowClasses = [
      `pnl-line-${line.key}`,
      line.subtotal ? 'pnl-subtotal pnl-statement-total' : '',
      line.key==='cogs' ? 'pnl-cost-row' : ''
    ].filter(Boolean).join(' ');

    html += `
      <tr class="${rowClasses}">
        <td>${line.label}</td>
        <td class="${pnlAmountClass(a)}">${pnlFormat(a)}</td>
        <td class="${pnlAmountClass(b)}">${pnlFormat(b)}</td>
        <td class="${pnlAmountClass(l)}">${pnlFormat(l)}</td>
        <td class="${pnlVarianceClass(vb)} ${pnlAmountClass(vb)}">${pnlFormat(vb)}</td>
        <td class="pnl-percent ${pnlVarianceClass(vb)} ${pnlAmountClass(vb)}">${pnlPercent(vb,b)}</td>
        <td class="${pnlVarianceClass(vl)} ${pnlAmountClass(vl)}">${pnlFormat(vl)}</td>
        <td class="pnl-percent ${pnlVarianceClass(vl)} ${pnlAmountClass(vl)}">${pnlPercent(vl,l)}</td>
      </tr>`;
  });

  const ratioRows = [
    { label:'COGS', numerator:'cogs', absolute:true },
    { label:'Gross Profit', numerator:'grossProfit' },
    { label:'S&M', numerator:'sm', absolute:true },
    { label:'Net Income', numerator:'netIncome' }
  ];
  html += '<tr class="pnl-ratio-spacer"><td colspan="8"></td></tr>';
  ratioRows.forEach(row=>{
    const ratioValue=(value,netSales)=>{
      const ratio=pnlRatio(value,netSales);
      return row.absolute?Math.abs(ratio):ratio;
    };
    const formatRatio=value=>`${(value*100).toFixed(1)}%`;
    const actualRatio=ratioValue(actual[row.numerator],actual.netSales);
    const budgetRatio=ratioValue(budget[row.numerator],budget.netSales);
    const lyRatio=ratioValue(ly[row.numerator],ly.netSales);
    html += `
      <tr class="pnl-statement-ratio">
        <td>${row.label}</td>
        <td class="${pnlAmountClass(actualRatio)}">${formatRatio(actualRatio)}</td>
        <td class="${pnlAmountClass(budgetRatio)}">${formatRatio(budgetRatio)}</td>
        <td class="${pnlAmountClass(lyRatio)}">${formatRatio(lyRatio)}</td>
        <td colspan="4"></td>
      </tr>`;
  });

  html += '</tbody>';
  table.innerHTML = html;

  const netSalesVar = actual.netSales - budget.netSales;
  const gpVar = actual.grossProfit - budget.grossProfit;
  const niVar = actual.netIncome - budget.netIncome;
  const actualGpMargin = actual.netSales ? actual.grossProfit / actual.netSales : 0;
  const budgetGpMargin = budget.netSales ? budget.grossProfit / budget.netSales : 0;

  const netSalesKpi = $('pnlNetSalesKpi');
  const grossProfitKpi = $('pnlGrossProfitKpi');
  const netIncomeKpi = $('pnlNetIncomeKpi');
  netSalesKpi.textContent = pnlFormat(actual.netSales);
  grossProfitKpi.textContent = pnlFormat(actual.grossProfit);
  netIncomeKpi.textContent = pnlFormat(actual.netIncome);
  [
    [netSalesKpi, actual.netSales],
    [grossProfitKpi, actual.grossProfit],
    [netIncomeKpi, actual.netIncome]
  ].forEach(([element,value])=>{
    element.classList.toggle('pnl-kpi-negative',value<0);
  });
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
      '#salesTable thead th, #focTable thead th, #stockTable thead th, #countryDetailTable thead th, #pnlTable thead th'
    );

    if (!header) return;

    const table = header.closest('table');
    if (!table) return;

    sortTable(table, header.cellIndex);
  });

  document.addEventListener('keydown', event => {
    const header = event.target.closest(
      '#salesTable thead th, #focTable thead th, #stockTable thead th, #countryDetailTable thead th, #pnlTable thead th'
    );

    if (!header || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();

    const table = header.closest('table');
    if (table) sortTable(table, header.cellIndex);
  });

  function makeHeadersAccessible() {
    document
      .querySelectorAll(
        '#salesTable thead th, #focTable thead th, #stockTable thead th, #countryDetailTable thead th, #pnlTable thead th'
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
let smSimpleRows = [];

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

function smSimplePeriod(value){
  const normalized=String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'');
  if(
    normalized==='ly' ||
    normalized==='py' ||
    normalized.startsWith('ly') ||
    normalized.includes('lastyear') ||
    normalized.includes('previousyear') ||
    normalized.includes('prioryear')
  ) return 'ly';
  if(normalized.includes('budget') || normalized==='bud' || normalized==='bdg') return 'budget';
  if(normalized.includes('actual') || normalized==='act') return 'actual';
  return normalized;
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
    .filter(r=>smSimplePeriod(r.Period)==='actual')
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
    .filter(r=>smSimplePeriod(r.Period)==='actual')
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
    if(!map.has(expense)) map.set(expense,{
      expense,
      actual:0,
      budget:0,
      ly:0,
      explicitLy:new Map(),
      priorActual:new Map()
    });
    return map.get(expense);
  };

  smSimpleRows.forEach(row=>{
    if(!selectedCountrySet.has(row.Country)) return;

    const d = smSimpleDate(row.Date);
    if(!d) return;

    const rowYear = d.getUTCFullYear();
    const rowMonth = d.getUTCMonth()+1;
    const period = smSimplePeriod(row.Period);
    const item = getItem(row.Expense || 'Unassigned');

    selectedPeriods.forEach(({year,month})=>{
      if(rowMonth !== month) return;
      const periodKey=`${year}-${String(month).padStart(2,'0')}`;
      if(rowYear === year && period === 'actual') item.actual += Math.abs(row.Amount);
      if(rowYear === year && period === 'budget') item.budget += Math.abs(row.Amount);
      if(rowYear === year-1 && period === 'actual'){
        item.priorActual.set(
          periodKey,
          (item.priorActual.get(periodKey) || 0) + Math.abs(row.Amount)
        );
      }
      if((rowYear === year || rowYear === year-1) && period === 'ly'){
        item.explicitLy.set(
          periodKey,
          (item.explicitLy.get(periodKey) || 0) + Math.abs(row.Amount)
        );
      }
    });
  });

  return [...map.values()].map(item=>{
    item.ly=selectedPeriods.reduce((total,{year,month})=>{
      const periodKey=`${year}-${String(month).padStart(2,'0')}`;
      return total + (
        item.explicitLy.has(periodKey)
          ? item.explicitLy.get(periodKey)
          : (item.priorActual.get(periodKey) || 0)
      );
    },0);
    delete item.explicitLy;
    delete item.priorActual;
    return item;
  })
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
  const count=$('smSimpleCount');
  if(count) count.textContent=`${rows.length.toLocaleString('en-US')} rows`;

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
      <td>${smSimpleFormat(row.ly)}</td>
      <td class="${smSimpleCellClass(vsBudget,true)}">${smSimpleFormat(vsBudget)}</td>
      <td class="${smSimpleCellClass(vsBudgetPct,false)}">${smSimplePercent(vsBudgetPct)}</td>
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
    <td>${smSimpleFormat(totals.ly)}</td>
    <td class="${smSimpleCellClass(totalVsBudget,true)}">${smSimpleFormat(totalVsBudget)}</td>
    <td class="${smSimpleCellClass(totalVsBudgetPct,false)}">${smSimplePercent(totalVsBudgetPct)}</td>
    <td class="${smSimpleCellClass(totalVsLy,true)}">${smSimpleFormat(totalVsLy)}</td>
    <td class="${smSimpleCellClass(totalVsLyPct,false)}">${smSimplePercent(totalVsLyPct)}</td>
  </tr>`);
}

function initSmSimpleReport(){
  const resetFilters=$('smSimpleFilterResetBtn');

  if(resetFilters) resetFilters.addEventListener('click',()=>{
    smSimplePopulateFilters();
    renderSmExpenses();
  });

  smSimplePopulateFilters();
  renderSmExpenses();
}

initSmSimpleReport();

function updateSmSpotlightCountry(){
  const header=$('smSpotlightCountryHeader');
  const flag=$('smSpotlightCountryFlag');
  const name=$('smSpotlightCountryName');
  if(!header || !flag || !name) return;

  const selected=getSelected('smSimpleCountryFilter');
  const available=[...new Set(smSimpleRows.map(row=>row.Country).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
  const countries=selected.length?selected:available;
  const singleCountry=countries.length===1?countries[0]:'';
  const code=singleCountry?countryFlagCode(singleCountry):'';

  name.textContent=singleCountry || (
    countries.length ? countries.join(' · ') : 'All Countries'
  );
  flag.hidden=!code;
  flag.src=code?countryFlagDataUri(code):'';
  flag.alt=code?`${singleCountry} flag`:'';
  flag.title=singleCountry;
  flag.onerror=()=>{ flag.hidden=true; };
}

function setSmTableSpotlight(active){
  const spotlightButton=$('smSpotlightBtn');
  const exitButton=$('smSpotlightExitBtn');
  const countryHeader=$('smSpotlightCountryHeader');
  if(active) updateSmSpotlightCountry();
  document.body.classList.toggle('sm-table-spotlight',active);
  spotlightButton?.setAttribute('aria-pressed',String(active));
  if(exitButton) exitButton.hidden=!active;
  if(countryHeader) countryHeader.hidden=!active;
  if(active){
    exitButton?.focus();
  }else{
    spotlightButton?.focus();
  }
}

$('smSpotlightBtn')?.addEventListener('click',()=>setSmTableSpotlight(true));
$('smSpotlightExitBtn')?.addEventListener('click',()=>setSmTableSpotlight(false));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && document.body.classList.contains('sm-table-spotlight')){
    setSmTableSpotlight(false);
  }
  if(event.key==='Escape' && document.body.classList.contains('pnl-table-spotlight')){
    setPnlTableSpotlight(false);
  }
});

// ============================================================
// Stock Level — uploaded workbook columns:
// Brand | Product Group | Month | Country | Agent
// Stock $ | Historical Sales $ | Forecast Sales $
// ============================================================
let stockRows = [];
const stockFilterIds = [
  'stockProductGroupFilter',
  'stockMonthFilter',
  'stockCountryFilter',
  'stockAgentFilter'
];

function stockKey(value){
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
}

function stockField(row,aliases){
  const key=Object.keys(row || {}).find(item=>aliases.includes(stockKey(item)));
  return key===undefined?'':row[key];
}

function stockNumber(value){
  if(value===null||value===undefined||value==='') return 0;
  if(typeof value==='number') return Number.isFinite(value)?value:0;
  return Number(
    String(value)
      .replace(/,/g,'')
      .replace(/\((.*)\)/,'-$1')
      .replace(/[^0-9.-]/g,'')
  )||0;
}

function stockNormalize(row){
  return {
    ...row,
    Brand:String(stockField(row,['brand','product','productname']) || 'Unassigned').trim(),
    'Product Group':String(stockField(row,['productgroup','group']) || 'Unassigned').trim(),
    Month:String(stockField(row,['month','reportingmonth','period']) || '').trim(),
    Country:String(stockField(row,['country','countryname','market']) || '').trim(),
    Agent:String(stockField(row,['agent','customer']) || '').trim(),
    __stock:stockNumber(stockField(row,['stock','stockvalue','stockusd'])),
    __historical:stockNumber(stockField(row,['historical','historicalsales','historicalsalesusd'])),
    __forecast:stockNumber(stockField(row,[
      'forecast','forcast','forecastsales','forcastsales','forecastsalesusd','forcastsalesusd'
    ]))
  };
}

function buildStockFilters(reset=false,changedId=''){
  const selections=reset
    ?Object.fromEntries(stockFilterIds.map(id=>[id,[]]))
    :captureSelections(stockFilterIds);
  if(changedId==='stockCountryFilter'){
    constrainChildrenToParent(stockRows,selections,'stockCountryFilter',[
      'stockAgentFilter','stockProductGroupFilter'
    ]);
  }
  rebuildDependentFilters(stockRows,stockFilterIds,selections,nextChangedId=>{
    buildStockFilters(false,nextChangedId);
    renderStockLevel();
  });
}

function filteredStockRows(){
  return stockRows.filter(row=>stockFilterIds.every(id=>{
    const selected=getSelected(id);
    const column=$(id).dataset.column;
    return !selected.length||selected.includes(String(row[column]??''));
  }));
}

function stockCoverage(stock,sales){
  return sales?stock/sales:0;
}

function stockCoverageFormat(value){
  return Number(value || 0).toLocaleString('en-US',{
    minimumFractionDigits:1,
    maximumFractionDigits:1
  });
}

function renderStockLevel(){
  const tbody=$('stockTable')?.tBodies?.[0];
  if(!tbody) return;
  const rows=filteredStockRows();
  const grouped=new Map();
  rows.forEach(row=>{
    const brand=row.Brand || 'Unassigned';
    if(!grouped.has(brand)) grouped.set(brand,{brand,stock:0,historical:0,forecast:0});
    const item=grouped.get(brand);
    item.stock+=row.__stock;
    item.historical+=row.__historical;
    item.forecast+=row.__forecast;
  });
  const brands=[...grouped.values()].sort((a,b)=>b.stock-a.stock);
  const totals=brands.reduce((total,row)=>({
    stock:total.stock+row.stock,
    historical:total.historical+row.historical,
    forecast:total.forecast+row.forecast
  }),{stock:0,historical:0,forecast:0});

  $('stockCount').textContent=`${brands.length.toLocaleString('en-US')} brands`;
  if(!brands.length){
    tbody.innerHTML='<tr><td colspan="6" class="stock-empty">No stock data matches the selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML=brands.map(row=>`<tr>
    <td>${esc(row.brand)}</td>
    <td>${fmt(row.stock)}</td>
    <td>${fmt(row.historical)}</td>
    <td>${fmt(row.forecast)}</td>
    <td>${stockCoverageFormat(stockCoverage(row.stock,row.historical))}</td>
    <td>${stockCoverageFormat(stockCoverage(row.stock,row.forecast))}</td>
  </tr>`).join('')+`<tr class="total-row">
    <td>Total</td>
    <td>${fmt(totals.stock)}</td>
    <td>${fmt(totals.historical)}</td>
    <td>${fmt(totals.forecast)}</td>
    <td>${stockCoverageFormat(stockCoverage(totals.stock,totals.historical))}</td>
    <td>${stockCoverageFormat(stockCoverage(totals.stock,totals.forecast))}</td>
  </tr>`;
}

$('stockResetBtn')?.addEventListener('click',()=>{
  buildStockFilters(true);
  renderStockLevel();
});
buildStockFilters(true);
renderStockLevel();

// Database loaders. The authenticated Firestore layer calls these after it has
// already enforced the user's country access.
window.loadSalesRowsFromDatabase = function(rows){
  rawData = (rows || []).map(normalize);
  buildAllSalesFilters(true);
  renderAll();
};

window.loadPnlRowsFromDatabase = function(rows){
  const normalizeKey = value => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'');

  // Older uploads could use a title row as the Firestore object keys. If the
  // actual P&L header was stored as a data row, rebuild the objects from it so
  // the already-uploaded dataset can still be read without another Firestore write.
  const rebuildFromEmbeddedHeader = sourceRows => {
    const scenarioNames = new Set(['scenario','period','version']);
    const marketNames = new Set(['market','country','countryname']);
    const metricNames = new Set([
      'grosssales','netsales','salesreturns','discounts','commissions',
      'cogs','costofgoodssold','grossprofit','sellingandmarketing',
      'sm','netincome','netprofit'
    ]);
    const headerIndex = sourceRows.findIndex(row => {
      const headers = Object.values(row || {}).map(normalizeKey);
      return headers.some(header => scenarioNames.has(header)) &&
        headers.some(header => marketNames.has(header)) &&
        headers.some(header => metricNames.has(header));
    });
    if (headerIndex < 0) return sourceRows;

    const headerRow = sourceRows[headerIndex] || {};
    const sourceKeys = Object.keys(headerRow);
    return sourceRows.slice(headerIndex + 1).map(row =>
      Object.fromEntries(sourceKeys.map(key => [
        String(headerRow[key] || key).trim(),
        row?.[key] ?? ''
      ]))
    );
  };

  const sourceRows = rebuildFromEmbeddedHeader(rows || []);
  const value = (row,names) => {
    const normalizedNames = names.map(normalizeKey);
    const key = Object.keys(row || {}).find(item =>
      normalizedNames.includes(normalizeKey(item))
    );
    return key === undefined ? '' : row[key];
  };
  const numeric = names => row => pnlReadNumber(value(row,names));
  const scenarioName = value => {
    const normalized = normalizeKey(value);
    if (normalized.includes('actual')) return 'Actual';
    if (normalized.includes('budget') || normalized === 'bud') return 'Budget';
    if (normalized === 'ly' || normalized.includes('lastyear') || normalized.includes('previousyear')) return 'LY';
    return '';
  };

  const grossSales = numeric(['gross sales','grosssales','sales']);
  const salesReturns = numeric(['sales returns','salesreturns','sales return']);
  const discounts = numeric(['discounts','discount']);
  const commissions = numeric(['commissions','commission']);
  const restoun = numeric(['restoun']);
  const netSales = numeric(['net sales','netsales']);
  const cogs = numeric(['cogs','cost of goods sold']);
  const grossProfit = numeric(['gross profit','grossprofit','gross margin']);
  const sm = numeric(['s&m','sm','selling & marketing','selling and marketing','selling & marketing expenses']);
  const netIncome = numeric(['net income','netincome','net profit','netprofit']);

  pnlRawData = sourceRows.map(row => ({
    salesType:String(value(row,['sales type','salestype','type']) || '').trim(),
    market:String(value(row,['market','country']) || '').trim(),
    agent:String(value(row,['agent','distributor','customer']) || '').trim(),
    scenario:scenarioName(value(row,['scenario','period','version'])),
    grossSales:grossSales(row),
    salesReturns:salesReturns(row),
    discounts:discounts(row),
    commissions:commissions(row),
    restoun:restoun(row),
    netSales:netSales(row),
    cogs:cogs(row),
    grossProfit:grossProfit(row),
    sm:sm(row),
    netIncome:netIncome(row)
  })).filter(row => row.scenario);

  initPnlFilters();
  rebuildPnlFilters(true);
  renderPnlVertical();
};

window.loadSmRowsFromDatabase = function(rows){
  smSimpleRows = (rows || []).map(smSimpleNormalize)
    .filter(row => row.Expense && row.Country && row.Period && row.Date);
  smSimplePopulateFilters();
  renderSmExpenses();
};

window.loadStockRowsFromDatabase = function(rows){
  stockRows=(rows || []).map(stockNormalize);
  buildStockFilters(true);
  renderStockLevel();
};

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
  const headers=table.tHead?.querySelectorAll("[data-sm-sort-index]");
  if(!headers?.length) return;

  [...headers].forEach(th=>{
    const i=Number(th.dataset.smSortIndex);
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

// Export the currently displayed, permission-filtered report tables to Excel.
(function(){
  const exports = {
    sales:{
      file:"Sales_Analysis",
      sheets:[{tableId:"salesTable",name:"Sales Analysis"}]
    },
    foc:{
      file:"IMS_FOC_Analysis",
      sheets:[{tableId:"focTable",name:"IMS FOC"}]
    },
    stock:{
      file:"Stock_Level",
      sheets:[{tableId:"stockTable",name:"Stock Level"}]
    },
    sm:{
      file:"Selling_Marketing_Expenses",
      sheets:[{tableId:"smSimpleTable",name:"S&M Expenses"}]
    },
    pnl:{
      file:"Profit_and_Loss",
      sheets:[{tableId:"pnlTable",name:"P&L"}]
    }
  };

  function makeNumericCellsUsable(worksheet){
    if (!worksheet?.["!ref"]) return;
    const range=XLSX.utils.decode_range(worksheet["!ref"]);
    for (let row=range.s.r + 1; row<=range.e.r; row+=1) {
      for (let column=range.s.c; column<=range.e.c; column+=1) {
        const address=XLSX.utils.encode_cell({r:row,c:column});
        const cell=worksheet[address];
        if (!cell || typeof cell.v !== "string") continue;
        const source=cell.v.trim();
        if (!source || source === "—" || !/[0-9]/.test(source)) continue;
        const percentage=/%$/.test(source);
        const accounting=/^\(.*\)$/.test(source);
        const cleaned=source
          .replace(/[(),%$]/g,"")
          .replace(/,/g,"")
          .trim();
        if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) continue;
        let number=Number(cleaned);
        if (!Number.isFinite(number)) continue;
        if (accounting) number=-Math.abs(number);
        if (percentage) number/=100;
        cell.v=number;
        cell.t="n";
        cell.z=percentage
          ? "0.0%"
          : "#,##0;[Red](#,##0)";
      }
    }
  }

  function setUsefulColumnWidths(worksheet,table){
    const rows=[...table.rows];
    const columnCount=Math.max(0,...rows.map(row=>row.cells.length));
    worksheet["!cols"]=Array.from({length:columnCount},(_,column)=>{
      const width=Math.max(10,...rows.map(row=>
        String(row.cells[column]?.textContent || "").trim().length
      ));
      return {wch:Math.min(width + 2,38)};
    });
  }

  function exportReport(reportKey,button){
    const config=exports[reportKey];
    if (!config) return;
    if (typeof XLSX === "undefined") {
      window.alert("Excel export is unavailable. Refresh the page and try again.");
      return;
    }

    button.disabled=true;
    try {
      const workbook=XLSX.utils.book_new();
      config.sheets.forEach(sheetConfig=>{
        const table=document.getElementById(sheetConfig.tableId);
        if (!table || !table.rows.length) return;
        const worksheet=XLSX.utils.table_to_sheet(table,{raw:false});
        makeNumericCellsUsable(worksheet);
        setUsefulColumnWidths(worksheet,table);
        worksheet["!autofilter"]={ref:worksheet["!ref"]};
        XLSX.utils.book_append_sheet(workbook,worksheet,sheetConfig.name);
      });

      if (!workbook.SheetNames.length) {
        window.alert("There is no displayed data to export.");
        return;
      }

      const date=new Date().toISOString().slice(0,10);
      XLSX.writeFile(workbook,`${config.file}_${date}.xlsx`,{compression:true});
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Could not export the report to Excel.");
    } finally {
      button.disabled=false;
    }
  }

  document.querySelectorAll("[data-export-report]").forEach(button=>{
    button.addEventListener("click",()=>exportReport(button.dataset.exportReport,button));
  });
})();
