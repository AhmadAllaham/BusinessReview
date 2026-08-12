let rawData = [];
let pnlData = [];
let activeCountry = '';
let activeBrand = '';
let activeFocGroup = '';
let detailMode = 'sales';

const $ = id => document.getElementById(id);
const salesFilterIds = ['yearFilter','monthFilter','typeFilter','countryFilter','sectorFilter','agentFilter','groupFilter','productFilter'];
const globalCountryFilterIds = [
  'countryFilter',
  'stockCountryFilter',
  'nearExpiryCountryFilter',
  'smSimpleCountryFilter',
  'pnlMarketFilter'
];
let globalCountrySelection = [];
let globalCountrySyncing = false;
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
function textIdentity(value){
  return String(value??'')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g,' ')
    .toLocaleLowerCase('en-US');
}
function sameText(left,right){return textIdentity(left)===textIdentity(right);}

let profitabilityRows=[];
let profitabilityVisible=false;

function profitabilityBucket(ratio){
  if(!Number.isFinite(ratio)) return '';
  if(ratio>=0.5) return 'H';
  if(ratio>=0.3) return 'M';
  if(ratio>=0.2) return 'LH';
  if(ratio>=0.1) return 'LM';
  if(ratio>=0) return 'LL';
  return 'LS';
}

function profitabilityScopeRows(scope={type:'sales'}){
  const selectedFilters=scope.type==='stock'
    ?[
      ['stockCountryFilter','country'],
      ['stockAgentFilter','agent'],
      ['stockProductGroupFilter','brand']
    ]
    :[
      ['countryFilter','country'],
      ['agentFilter','agent'],
      ['groupFilter','brand'],
      ['productFilter','product']
    ];

  return profitabilityRows.filter(row=>{
    const matchesSelections=selectedFilters.every(([id,key])=>{
      const selected=getSelected(id);
      return !selected.length||selected.some(value=>sameText(value,row[key]));
    });
    if(!matchesSelections) return false;
    return (!scope.country||sameText(scope.country,row.country))&&
      (!scope.agent||sameText(scope.agent,row.agent))&&
      (!scope.brand||sameText(scope.brand,row.brand))&&
      (!scope.product||sameText(scope.product,row.product));
  });
}

function profitabilityClass(dimension,name,scope={type:'sales'}){
  const key={
    Country:'country',Market:'country',Agent:'agent',
    Brand:'brand','Product Group':'brand',
    Product:'product','Product Name':'product',SKU:'product'
  }[dimension];
  const rows=profitabilityScopeRows(scope).filter(row=>
    !key||sameText(row[key],name)
  );
  const netSales=sum(rows,'netSales');
  if(!rows.length||Math.abs(netSales)<1e-9) return '';
  return profitabilityBucket(sum(rows,'grossProfit')/netSales);
}

function profitabilityCell(category){
  const value=category||'—';
  const css=category?` gp-${category.toLowerCase()}`:' gp-empty';
  return `<td class="gp-class-cell${css}">${esc(value)}</td>`;
}

function updateProfitabilityButtons(){
  document.querySelectorAll('[data-profitability-toggle]').forEach(button=>{
    button.disabled=!profitabilityRows.length;
    button.classList.toggle('active',profitabilityVisible);
    button.setAttribute('aria-pressed',String(profitabilityVisible));
    button.textContent=profitabilityVisible?'Hide GP%':'Show GP%';
    button.title=profitabilityRows.length
      ?'Show or hide the Budget 2026 profitability classification'
      :'Upload the Budget 2026 profitability workbook in Data Admin first';
  });
}
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

function isGlobalCountryFilter(id){
  return globalCountryFilterIds.includes(String(id||''));
}

function mapCountrySelection(values,selection){
  return selection.map(selected=>
    values.find(value=>sameText(value,selected)) || String(selected)
  );
}

function refreshGlobalCountryTarget(id){
  if(id==='countryFilter'){
    buildAllSalesFilters(false,'countryFilter');
    renderAll();
  }else if(id==='stockCountryFilter'){
    buildStockFilters(false,'stockCountryFilter');
    renderStockLevel();
  }else if(id==='nearExpiryCountryFilter'){
    buildNearExpiryFilters(false,'nearExpiryCountryFilter');
    renderNearlyExpired();
  }else if(id==='smSimpleCountryFilter'){
    renderSmExpenses();
  }else if(id==='pnlMarketFilter'){
    rebuildPnlFilters(false,'pnlMarketFilter');
    renderPnlVertical();
  }
}

function syncGlobalCountryFilters(sourceId,selectedValues=[]){
  if(globalCountrySyncing) return;
  globalCountrySyncing=true;
  globalCountrySelection=[...new Set(
    selectedValues.map(value=>String(value).trim()).filter(Boolean)
  )];

  try{
    globalCountryFilterIds.forEach(id=>{
      if(id===sourceId || !$(id)) return;
      const target=$(id);
      const available=[...(target.querySelectorAll('.multi-options input')||[])]
        .map(input=>String(input.value));
      target._setSelected?.(
        globalCountrySelection.length
          ?mapCountrySelection(available,globalCountrySelection)
          :[]
      );
      refreshGlobalCountryTarget(id);
    });
    updateActiveFilterChips();
  }finally{
    globalCountrySyncing=false;
  }
}

function createMultiFilter(el,data,col,onChange,defaultValues=[]){
  el.dataset.filterLabel=col;
  const values=uniqueValues(data,col);
  const smartScopeValues = {
    countryFilter:window.BRSalesAvailableCountries,
    yearFilter:window.BRSalesAvailableYears,
    monthFilter:window.BRSalesAvailableMonths
  }[el.id];
  if(Array.isArray(smartScopeValues)){
    smartScopeValues.map(String).filter(Boolean).forEach(value=>{
      if(!values.some(option=>sameText(option,value))) values.push(value);
    });
    values.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  }
  let requestedDefaults=defaultValues.map(String);
  if(isGlobalCountryFilter(el.id) && globalCountrySelection.length){
    requestedDefaults=mapCountrySelection(values,globalCountrySelection);
    requestedDefaults.forEach(value=>{
      if(!values.some(option=>sameText(option,value))) values.push(value);
    });
    values.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  }
  const defaults=new Set(requestedDefaults);

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

  const applySelection=(keepOpen=false)=>{
    updateLabel();

    const searchValue=search.value;
    const optionsScrollTop=menu.querySelector('.multi-options')?.scrollTop||0;
    const selectedNow=boxes
      .filter(box=>box.checked)
      .map(box=>String(box.value));

    // Freeze the current values before dependent filters rebuild this control.
    el._getSelected=()=>[...selectedNow];

    btn.classList.add('filter-applied');
    setTimeout(()=>el.querySelector('.multi-filter-btn')?.classList.remove('filter-applied'),450);
    if(isGlobalCountryFilter(el.id) && !globalCountrySyncing){
      globalCountrySelection=[...new Set(selectedNow)];
    }
    onChange();
    if(['countryFilter','yearFilter','monthFilter'].includes(el.id)){
      document.dispatchEvent(new CustomEvent('br:sales-scope-change',{
        detail:{filterId:el.id,values:[...selectedNow]}
      }));
    }
    if(isGlobalCountryFilter(el.id) && !globalCountrySyncing){
      syncGlobalCountryFilters(el.id,selectedNow);
    }
    updateActiveFilterChips();

    if(keepOpen){
      // Rebuilding dependent filters replaces the menu. Restore it so users can
      // continue selecting multiple values without reopening the filter.
      const nextBtn=el.querySelector('.multi-filter-btn');
      const nextMenu=el.querySelector('.multi-filter-menu');
      const nextSearch=nextMenu?.querySelector('.multi-filter-search input');
      const nextOptions=nextMenu?.querySelector('.multi-options');
      if(nextBtn&&nextMenu){
        nextMenu.hidden=false;
        nextBtn.setAttribute('aria-expanded','true');
      }
      if(nextSearch){
        nextSearch.value=searchValue;
        nextSearch.dispatchEvent(new Event('input'));
        nextSearch.focus({preventScroll:true});
      }
      if(nextOptions) nextOptions.scrollTop=optionsScrollTop;
    }else{
      const nextBtn=el.querySelector('.multi-filter-btn');
      const nextMenu=el.querySelector('.multi-filter-menu');
      if(nextMenu) nextMenu.hidden=true;
      nextBtn?.setAttribute('aria-expanded','false');
    }
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
        applySelection(false);
      }
    }
  });

  all.addEventListener('change',()=>{
    if(all.checked){
      boxes.forEach(box=>box.checked=false);
      all.indeterminate=false;
    }
    updateLabel();
    applySelection(true);
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
    applySelection(true);
  }));

  selectVisibleBtn.addEventListener('click',()=>{
    visibleBoxes().forEach(box=>box.checked=true);
    all.checked=false;
    all.indeterminate=false;
    updateLabel();
    applySelection(true);
  });

  clearBtn.addEventListener('click',()=>{
    boxes.forEach(box=>box.checked=false);
    all.checked=true;
    all.indeterminate=false;
    updateLabel();
    applySelection(true);
  });

  closeBtn.addEventListener('click',()=>{
    menu.hidden=true;
    btn.setAttribute('aria-expanded','false');
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
  el._applySelection=()=>applySelection(false);

  updateLabel();
  updateActiveFilterChips();
}
function closeOtherMenus(except){document.querySelectorAll('.multi-filter').forEach(el=>{if(el!==except){const m=el.querySelector('.multi-filter-menu');const b=el.querySelector('.multi-filter-btn');if(m){m.hidden=true;b?.setAttribute('aria-expanded','false');}}});}
document.addEventListener('click',()=>closeOtherMenus(null));

function getSelected(id){return $(id)?._getSelected?.()||[];}

function captureSelections(ids){
  return Object.fromEntries(ids.map(id=>{
    if(isGlobalCountryFilter(id) && globalCountrySelection.length){
      const values=[...($(id)?.querySelectorAll('.multi-options input')||[])]
        .map(input=>String(input.value));
      return [id,mapCountrySelection(values,globalCountrySelection)];
    }
    return [id,getSelected(id)];
  }));
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
      const smartScopeValues={
        countryFilter:window.BRSalesAvailableCountries,
        yearFilter:window.BRSalesAvailableYears,
        monthFilter:window.BRSalesAvailableMonths
      }[id];
      if(Array.isArray(smartScopeValues)) smartScopeValues.map(String).forEach(value=>available.add(value));
      const kept=(stable[id]||[]).filter(v=>
        [...available].some(option=>sameText(option,String(v)))
      );
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
  const initialScope=window.BRSalesInitialScope||{};
  const selections=reset
    ?Object.fromEntries(salesFilterIds.map(id=>{
        if(id==='yearFilter') return [id,(initialScope.years||[]).length?initialScope.years:latestYear?[latestYear]:[]];
        if(id==='monthFilter') return [id,initialScope.months||[]];
        if(id==='countryFilter') return [id,initialScope.countries||[]];
        return [id,[]];
      }))
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

  // Recalculate multi-row sticky headers after the selected section becomes
  // visible, so subheaders such as USD and % stay attached to their group row.
  window.requestAnimationFrame(()=>{
    section?.querySelectorAll('.resizable-report-table')
      .forEach(refreshStickyHeaderOffsets);
  });
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
  const isAlgeria=workspaceId==='algeriaWorkspace';
  document.body.classList.toggle('mda-view',isMda);
  document.body.classList.toggle('algeria-view',isAlgeria);
  if(isMda){
    document.body.classList.remove('pnl-clean-view','sm-expense-view','stock-level-view');
    const subtitle=$('headerSubtitle');
    if(subtitle) subtitle.textContent='Management Discussion & Analysis';
  }else if(isAlgeria){
    document.body.classList.remove('pnl-clean-view','sm-expense-view','stock-level-view');
    const subtitle=$('headerSubtitle');
    if(subtitle) subtitle.textContent="DAD Algeria · P&L, S&M, G&A, Stock Level and Nearly Expiry";
    if(typeof window.renderAlgeriaReports==='function') window.renderAlgeriaReports();
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

/* Auto-hide the page header while reading reports; reveal it near the top edge. */
(function initAutoHideHeader(){
  const header=document.querySelector('.app-header');
  if(!header) return;

  let lastScrollY=window.scrollY;
  let hoverReveal=false;
  let hideTimer=0;
  const scrollThreshold=80;
  const movementThreshold=5;

  const clearHideTimer=()=>{
    if(hideTimer){
      window.clearTimeout(hideTimer);
      hideTimer=0;
    }
  };

  const showHeader=(fromPointer=false)=>{
    clearHideTimer();
    hoverReveal=fromPointer;
    header.classList.remove('header-auto-hidden');
    header.classList.toggle('header-hover-reveal',fromPointer);
  };

  const hideHeader=()=>{
    if(window.scrollY<=scrollThreshold || header.matches(':hover') || header.contains(document.activeElement)) return;
    hoverReveal=false;
    header.classList.remove('header-hover-reveal');
    header.classList.add('header-auto-hidden');
  };

  const scheduleHide=()=>{
    clearHideTimer();
    hideTimer=window.setTimeout(hideHeader,500);
  };

  window.addEventListener('scroll',()=>{
    const currentScrollY=Math.max(0,window.scrollY);
    const delta=currentScrollY-lastScrollY;

    if(currentScrollY<=scrollThreshold){
      showHeader(false);
    }else if(delta>movementThreshold){
      hideHeader();
    }else if(delta<-movementThreshold){
      showHeader(false);
    }

    lastScrollY=currentScrollY;
  },{passive:true});

  document.addEventListener('pointermove',event=>{
    if(window.scrollY<=scrollThreshold) return;
    if(event.clientY<=18){
      showHeader(true);
    }else if(hoverReveal && !header.matches(':hover') && event.clientY>header.offsetHeight+12){
      scheduleHide();
    }
  },{passive:true});

  header.addEventListener('pointerenter',()=>{
    if(window.scrollY>scrollThreshold) showHeader(true);
  });
  header.addEventListener('pointerleave',scheduleHide);
  header.addEventListener('focusin',()=>showHeader(true));
  header.addEventListener('focusout',scheduleHide);
})();

/* Management presentation mode — summary, top rows and single-row focus. */
(function initManagementView(){
  const overlay=$('managementView');
  const content=$('managementContent');
  if(!overlay||!content) return;

  const reports={
    sales:{tableId:'salesTable',title:'Sales Performance',scopeFilter:'countryFilter',scopeAll:'All Markets',kpis:[1,2,4,6]},
    foc:{tableId:'focTable',title:'IMS FOC Utilization',scopeFilter:'countryFilter',scopeAll:'All Markets',kpis:[1,2,4,6]},
    stock:{tableId:'stockTable',title:'Stock Level',scopeFilter:'stockCountryFilter',scopeAll:'All Markets',kpis:[1,2,3,5]},
    sm:{tableId:'smSimpleTable',title:'Selling & Marketing Expenses',scopeFilter:'smSimpleCountryFilter',scopeAll:'All Countries',kpis:[1,2,4,6]},
    pnl:{tableId:'pnlTable',title:'Consolidated P&L',scopeFilter:'pnlMarketFilter',scopeAll:'All Markets',kpis:[]}
  };

  let activeReport='sales';
  let managementMode='summary';
  let managementShowAll=false;
  let managementFocusIndex=0;
  let managementDrill={level:'root',country:'',item:''};

  const currentConfig=()=>reports[activeReport];
  const currentTable=()=>$(currentConfig()?.tableId);
  const isOpen=()=>!overlay.hidden;

  function managementColumnCount(table){
    return Math.max(0,...[...table.rows].map(row=>[...row.cells]
      .reduce((count,cell)=>count+(Number(cell.colSpan)||1),0)));
  }

  function managementColumnLabels(table){
    const count=managementColumnCount(table);
    const labels=Array.from({length:count},()=>[]);
    const occupied=[];

    [...(table.tHead?.rows||[])].forEach((row,rowIndex)=>{
      let columnIndex=0;
      [...row.cells].forEach(cell=>{
        while(occupied[rowIndex]?.[columnIndex]) columnIndex++;
        const colspan=Number(cell.colSpan)||1;
        const rowspan=Number(cell.rowSpan)||1;
        for(let r=rowIndex;r<rowIndex+rowspan;r++){
          occupied[r]??=[];
          for(let c=columnIndex;c<columnIndex+colspan;c++) occupied[r][c]=true;
        }

        const label=cell.getAttribute('aria-hidden')==='true'
          ?''
          :String(cell.textContent||'').replace(/\s+/g,' ').trim();
        if(label){
          for(let c=columnIndex;c<columnIndex+colspan;c++){
            if(!labels[c].includes(label)) labels[c].push(label);
          }
        }
        columnIndex+=colspan;
      });
    });

    return labels.map((parts,index)=>parts.join(' · ')||`Column ${index+1}`);
  }

  function managementDataRows(table){
    return [...(table.tBodies?.[0]?.rows||[])].filter(row=>
      !row.classList.contains('total-row')&&
      !row.classList.contains('sm-total-row')&&
      !row.classList.contains('pnl-ratio-spacer')&&
      !row.classList.contains('pnl-statement-ratio')&&
      !row.querySelector('.sm-no-data,.stock-empty')
    );
  }

  function managementValueClass(cell){
    const value=String(cell?.textContent||'').trim();
    if(
      cell?.classList.contains('negative')||
      cell?.classList.contains('sm-bad')||
      cell?.classList.contains('pnl-negative')||
      cell?.classList.contains('pnl-kpi-negative')||
      cell?.classList.contains('pnl-amount-negative')||
      /^\(.*\)$/.test(value)
    ) return 'negative';
    if(
      cell?.classList.contains('positive')||
      cell?.classList.contains('sm-good')||
      cell?.classList.contains('pnl-positive')
    ) return 'positive';
    return '';
  }

  function managementScope(){
    const config=currentConfig();
    const selected=getSelected(config.scopeFilter);
    return selected.length?selected.join(' · '):config.scopeAll;
  }

  function managementRootCanDrill(){
    if(activeReport==='sales') return $('salesView')?.value==='Country';
    if(activeReport==='foc') return $('focView')?.value==='Country';
    return activeReport==='stock';
  }

  function managementFocRows(rows){
    return aggregate(rows,'Product Name',[]).sort((a,b)=>b.actual-a.actual).map(item=>{
      const actualRate=item.actual?item.actualFoc/item.actual:0;
      const budgetRate=item.actual?item.budgetFoc/item.actual:0;
      return {
        name:item.name,
        actual:item.actual,
        actualFoc:item.actualFoc,
        budgetFoc:item.budgetFoc,
        varianceRate:actualRate-budgetRate
      };
    });
  }

  function managementSourceTable(){
    if(managementDrill.level==='root') return currentTable();

    const table=document.createElement('table');
    const country=managementDrill.country;

    if(activeReport==='sales'){
      const rows=filtered().filter(row=>String(row.Country||'')===country);
      const lyRows=filteredLY().filter(row=>String(row.Country||'')===country);
      if(managementDrill.level==='country'){
        const data=aggregate(rows,'Brand',lyRows).sort((a,b)=>b.actual-a.actual);
        table.className='sales-statement-detail';
        table.innerHTML=salesStatementTableHtml(data,'Brand');
      }else{
        const itemRows=rows.filter(row=>row.__brand===managementDrill.item);
        const itemLyRows=lyRows.filter(row=>row.__brand===managementDrill.item);
        const data=aggregate(itemRows,'Product Name',itemLyRows).sort((a,b)=>b.actual-a.actual);
        table.className='sales-statement-detail';
        table.innerHTML=salesStatementTableHtml(data,'Product');
      }
      return table;
    }

    if(activeReport==='foc'){
      let rows=filtered().filter(row=>
        String(row.Country||'')===country&&String(row.Type||'').toUpperCase()==='IMS'
      );
      let dimension='Product Group';
      if(managementDrill.level==='country'){
        const grouped=aggregate(rows,'Product Group',[]).sort((a,b)=>b.actual-a.actual);
        rows=grouped.map(item=>{
          const actualRate=item.actual?item.actualFoc/item.actual:0;
          const budgetRate=item.actual?item.budgetFoc/item.actual:0;
          return {...item,varianceRate:actualRate-budgetRate};
        });
      }else{
        rows=rows.filter(row=>
          String(row['Product Group']||row.__group||'').trim()===managementDrill.item
        );
        rows=managementFocRows(rows);
        dimension='Product';
      }
      table.className='foc-statement-detail';
      table.innerHTML=focDetailTableHtml(rows,'Total',dimension);
      return table;
    }

    if(activeReport==='stock'){
      let rows=filteredStockRows().filter(row=>String(row.Country||'')===country);
      let dimension='Brand';
      if(managementDrill.level==='detail'){
        rows=rows.filter(row=>String(row.Brand||'')===managementDrill.item);
        dimension='SKU';
      }
      const {data,totals}=stockAggregateRows(
        rows,
        dimension,
        dimension==='Brand'?'Unassigned Brand':'Unassigned SKU'
      );
      table.className='stock-statement-table';
      table.innerHTML=stockStatementTableHtml(data,totals,dimension);
      return table;
    }

    return currentTable();
  }

  function updateManagementHeading(){
    const config=currentConfig();
    const scope=managementDrill.level==='root'
      ?managementScope()
      :[managementDrill.country,managementDrill.item].filter(Boolean).join(' · ');
    const singleCountry=scope&&!scope.startsWith('All ')&&!scope.includes(' · ')?scope:'';
    const flagCountry=managementDrill.country||singleCountry;
    const code=flagCountry?countryFlagCode(flagCountry):'';
    const flag=$('managementFlag');
    const backButton=$('managementBackBtn');

    $('managementTitle').textContent=config.title;
    $('managementScope').textContent=scope;
    backButton.hidden=managementDrill.level==='root';
    backButton.textContent=managementDrill.level==='detail'
      ?`← Back to ${activeReport==='foc'?'Product Groups':'Brands'}`
      :'← Back to Markets';
    flag.hidden=!code;
    flag.src=code?countryFlagDataUri(code):'';
    flag.alt=code?`${flagCountry} flag`:'';
    flag.onerror=()=>{flag.hidden=true;};
  }

  function pnlManagementKpis(){
    return [
      ['Net Sales',$('pnlNetSalesKpi')?.textContent,$('pnlNetSalesKpi')],
      ['Gross Profit',$('pnlGrossProfitKpi')?.textContent,$('pnlGrossProfitKpi')],
      ['Net Income',$('pnlNetIncomeKpi')?.textContent,$('pnlNetIncomeKpi')],
      ['GP Margin',$('pnlGpMarginKpi')?.textContent,$('pnlGpMarginKpi')]
    ].map(([label,value,source])=>({label,value:value||'—',className:managementValueClass(source)}));
  }

  function managementKpis(table,labels){
    if(activeReport==='pnl') return pnlManagementKpis();
    const total=table.querySelector('tbody .total-row,tbody .sm-total-row');
    if(!total) return [];
    return currentConfig().kpis
      .filter(index=>total.cells[index])
      .map(index=>({
        label:labels[index],
        value:String(total.cells[index].textContent||'').trim()||'—',
        className:managementValueClass(total.cells[index])
      }));
  }

  function managementTableClone(table,limit=10){
    const sourceRows=[...(table.tBodies?.[0]?.rows||[])];
    const focusRows=managementDataRows(table);
    const focusIndex=new Map(focusRows.map((row,index)=>[row,index]));
    const clone=table.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('management-report-table',`management-report-${activeReport}`);
    clone.querySelector('colgroup')?.remove();
    clone.querySelectorAll('.column-resize-handle').forEach(handle=>handle.remove());
    clone.querySelectorAll('thead th').forEach(header=>{
      header.removeAttribute('tabindex');
      header.removeAttribute('title');
      header.style.removeProperty('--table-sticky-top');
      header.style.removeProperty('--table-sticky-z');
    });

    [...(clone.tBodies?.[0]?.rows||[])].forEach((row,index)=>{
      const sourceRow=sourceRows[index];
      const dataIndex=focusIndex.get(sourceRow);
      const keepAlways=sourceRow?.classList.contains('total-row')||sourceRow?.classList.contains('sm-total-row');
      const keepData=Number.isInteger(dataIndex)&&(managementShowAll||dataIndex<limit);
      const keepSupporting=managementShowAll&&sourceRow&&!Number.isInteger(dataIndex);
      if(!(keepAlways||keepData||keepSupporting)){
        row.remove();
        return;
      }
      if(Number.isInteger(dataIndex)){
        row.dataset.managementRowIndex=String(dataIndex);
        if(dataIndex===managementFocusIndex) row.classList.add('management-row-selected');
      }
    });
    return clone;
  }

  function bindManagementTableRows(){
    content.querySelectorAll('[data-management-row-index]').forEach(row=>{
      row.tabIndex=0;
      const openFocus=()=>{
        managementFocusIndex=Number(row.dataset.managementRowIndex)||0;
        const rowName=String(row.cells[0]?.textContent||'').replace(/\s+/g,' ').trim();
        if(managementDrill.level==='root'&&managementRootCanDrill()&&rowName){
          managementDrill={level:'country',country:rowName,item:''};
          managementMode='table';
          managementShowAll=false;
          managementFocusIndex=0;
          renderManagementView();
          return;
        }
        if(
          managementDrill.level==='country'&&
          ['sales','foc','stock'].includes(activeReport)&&
          rowName
        ){
          managementDrill={...managementDrill,level:'detail',item:rowName};
          managementMode='table';
          managementShowAll=false;
          managementFocusIndex=0;
          renderManagementView();
          return;
        }
        managementMode='focus';
        renderManagementView();
      };
      row.addEventListener('click',openFocus);
      row.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){
          event.preventDefault();
          openFocus();
        }
      });
    });
  }

  function renderManagementTable(table,limit=10,title='Management Table'){
    const rows=managementDataRows(table);
    content.innerHTML=`<section class="management-panel">
      <div class="management-panel-head"><strong>${esc(title)}</strong><span>${managementShowAll?rows.length:Math.min(limit,rows.length)} of ${rows.length} rows</span></div>
      <div class="management-table-stage"></div>
    </section>`;
    content.querySelector('.management-table-stage').appendChild(managementTableClone(table,limit));
    bindManagementTableRows();
  }

  function renderManagementSummary(table,labels){
    const kpis=managementKpis(table,labels);
    const rows=managementDataRows(table);
    content.innerHTML=`<section class="management-summary">
      <div class="management-kpis">${kpis.map(item=>`<article class="management-kpi ${item.className}"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></article>`).join('')}</div>
      <section class="management-panel">
        <div class="management-panel-head"><strong>Key lines</strong><span>${Math.min(5,rows.length)} of ${rows.length} rows · click to focus</span></div>
        <div class="management-table-stage"></div>
      </section>
    </section>`;
    const previousShowAll=managementShowAll;
    managementShowAll=false;
    content.querySelector('.management-table-stage').appendChild(managementTableClone(table,5));
    managementShowAll=previousShowAll;
    bindManagementTableRows();
  }

  function renderManagementFocus(table,labels){
    const rows=managementDataRows(table);
    if(!rows.length){
      content.innerHTML='<div class="management-empty">No displayed rows are available for Focus view.</div>';
      return;
    }
    managementFocusIndex=Math.max(0,Math.min(managementFocusIndex,rows.length-1));
    const row=rows[managementFocusIndex];
    const name=String(row.cells[0]?.textContent||`Row ${managementFocusIndex+1}`).trim();
    const cards=[...row.cells].slice(1).map((cell,index)=>({
      label:labels[index+1]||`Value ${index+1}`,
      value:String(cell.textContent||'').trim()||'—',
      className:managementValueClass(cell)
    }));

    content.innerHTML=`<section class="management-focus">
      <div class="management-focus-title"><span>Focused line</span><h3>${esc(name)}</h3></div>
      <div class="management-focus-grid">${cards.map(item=>`<article class="management-focus-card ${item.className}"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></article>`).join('')}</div>
      <div class="management-focus-nav">
        <button type="button" data-management-step="-1" ${managementFocusIndex===0?'disabled':''}>← Previous</button>
        <span>${managementFocusIndex+1} / ${rows.length}</span>
        <button type="button" data-management-step="1" ${managementFocusIndex===rows.length-1?'disabled':''}>Next →</button>
      </div>
    </section>`;

    content.querySelectorAll('[data-management-step]').forEach(button=>{
      button.addEventListener('click',()=>{
        managementFocusIndex+=Number(button.dataset.managementStep)||0;
        renderManagementView();
      });
    });
  }

  function renderManagementView(){
    const table=managementSourceTable();
    updateManagementHeading();
    document.querySelectorAll('[data-management-mode]').forEach(button=>{
      const active=button.dataset.managementMode===managementMode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('managementRowsToggle').hidden=managementMode!=='table';
    $('managementRowsToggle').textContent=managementShowAll?'Top 10':'Show All';

    if(!table?.tHead||!table.tBodies?.[0]){
      content.innerHTML='<div class="management-empty">No report data is currently displayed.</div>';
      return;
    }

    const labels=managementColumnLabels(table);
    if(managementMode==='table') renderManagementTable(table,10,'Management Table');
    else if(managementMode==='focus') renderManagementFocus(table,labels);
    else renderManagementSummary(table,labels);
  }

  function openManagementView(report){
    if(!reports[report]) return;
    activeReport=report;
    managementMode='summary';
    managementShowAll=false;
    managementFocusIndex=0;
    managementDrill={level:'root',country:'',item:''};
    overlay.hidden=false;
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('management-view-open');
    renderManagementView();
    $('managementExitBtn').focus();
  }

  async function closeManagementView(){
    if(document.fullscreenElement===overlay){
      try{await document.exitFullscreen();}catch(error){ /* Browser already exited. */ }
    }
    overlay.hidden=true;
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('management-view-open');
  }

  document.querySelectorAll('[data-management-report]').forEach(button=>{
    button.addEventListener('click',()=>openManagementView(button.dataset.managementReport));
  });
  document.querySelectorAll('[data-management-mode]').forEach(button=>{
    button.addEventListener('click',()=>{
      managementMode=button.dataset.managementMode;
      renderManagementView();
    });
  });
  $('managementRowsToggle').addEventListener('click',()=>{
    managementShowAll=!managementShowAll;
    renderManagementView();
  });
  $('managementBackBtn').addEventListener('click',()=>{
    if(managementDrill.level==='detail'){
      managementDrill={...managementDrill,level:'country',item:''};
    }else{
      managementDrill={level:'root',country:'',item:''};
    }
    managementMode='table';
    managementShowAll=false;
    managementFocusIndex=0;
    renderManagementView();
  });
  $('managementExitBtn').addEventListener('click',closeManagementView);
  $('managementFullscreenBtn').addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement===overlay) await document.exitFullscreen();
      else await overlay.requestFullscreen();
    }catch(error){
      console.warn('Fullscreen is unavailable.',error);
    }
  });
  document.addEventListener('fullscreenchange',()=>{
    $('managementFullscreenBtn').textContent=document.fullscreenElement===overlay?'Exit Fullscreen':'Fullscreen';
  });
  document.addEventListener('keydown',event=>{
    if(!isOpen()) return;
    if(event.key==='Escape'){
      closeManagementView();
      return;
    }
    if(managementMode==='focus'&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
      const rows=managementDataRows(managementSourceTable());
      const delta=event.key==='ArrowRight'?1:-1;
      const next=Math.max(0,Math.min(rows.length-1,managementFocusIndex+delta));
      if(next!==managementFocusIndex){
        event.preventDefault();
        managementFocusIndex=next;
        renderManagementView();
      }
    }
  });
})();

function sum(rows,key){return rows.reduce((a,r)=>a+(typeof key==='function'?key(r):Number(r[key])||0),0);}
function dimKey(r,dim){
  return dim==='Brand'?r.__brand:dim==='Product Name'?r.__product:dim==='Product Group'?r.__group:String(r[dim]||'Unassigned');
}
function aggregate(rows,dim,lySource=filteredLY()){
  const m=new Map();
  for(const r of rows){
    const displayName=dimKey(r,dim);
    const k=textIdentity(displayName);
    if(!m.has(k))m.set(k,{name:displayName,actual:0,budget:0,ly:0,actualFoc:0,budgetFoc:0,products:new Set()});
    const x=m.get(k);x.actual+=r.__actual;x.budget+=r.__budget;x.products.add(textIdentity(r.__product));
    if(String(r.Type).toUpperCase()==='IMS'){x.actualFoc+=r.__actualBonus;x.budgetFoc+=r.__budgetBonus;}
  }
  for(const r of lySource){
    const displayName=dimKey(r,dim);
    const k=textIdentity(displayName);
    if(!m.has(k))m.set(k,{name:displayName,actual:0,budget:0,ly:0,actualFoc:0,budgetFoc:0,products:new Set()});
    const x=m.get(k);x.ly+=r.__actual;x.products.add(textIdentity(r.__product));
  }
  return [...m.values()];
}

let performanceCurrency='USD';
const PERFORMANCE_USD_TO_JOD=0.709;

function renderAll(){if(!rawData.length)return;const rows=filtered();renderSalesTable(rows);renderFocTable(rows);}

function renderSalesTable(rows){
  const dim=$('salesView').value; const data=aggregate(rows,dim).sort((a,b)=>b.actual-a.actual);
  $('salesCount').textContent=`${data.length.toLocaleString('en-US')} rows`;
  $('salesTable').innerHTML=salesStatementTableHtml(data,dim,{type:'sales'});
  if(dim==='Country') [...$('salesTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')].forEach(td=>{td.classList.add('drill-link');td.addEventListener('click',()=>openCountry(td.textContent));});
  setupResizableColumns($('salesTable'));
}

function performanceStatementValue(value,divisor=1){
  const rate=performanceCurrency==='JOD'?PERFORMANCE_USD_TO_JOD:1;
  const rounded=Math.round(((Number(value)||0)*rate)/divisor);
  return rounded<0
    ? `(${Math.abs(rounded).toLocaleString('en-US')})`
    : rounded.toLocaleString('en-US');
}
function salesStatementValue(value){return performanceStatementValue(value,1000);}
function focStatementValue(value){return performanceStatementValue(value,1000);}

function salesStatementPercent(value,base){
  if(!base) return '—';
  const percentage=Math.round((Number(value)||0)/Math.abs(Number(base))*100);
  return percentage<0?`(${Math.abs(percentage)}%)`:`${percentage}%`;
}

function salesStatementTableHtml(rows,dimension,profitabilityScope={type:'sales'}){
  const dimensionLabel=dimension==='Country'?'Market':dimension;
  const totals=rows.reduce((total,row)=>({
    actual:total.actual+row.actual,
    budget:total.budget+row.budget,
    ly:total.ly+row.ly
  }),{actual:0,budget:0,ly:0});

  const makeRow=(row,total=false)=>{
    const vsBudget=row.actual-row.budget;
    const vsLy=row.actual-row.ly;
    const values=[
      row.name,
      salesStatementValue(row.actual),
      salesStatementValue(row.budget),
      salesStatementValue(vsBudget),
      salesStatementPercent(vsBudget,row.budget),
      salesStatementValue(row.ly),
      salesStatementValue(vsLy),
      salesStatementPercent(vsLy,row.ly)
    ];
    const rawValues=[
      row.name,row.actual,row.budget,
      vsBudget,row.budget?vsBudget/Math.abs(row.budget):0,
      row.ly,
      vsLy,row.ly?vsLy/Math.abs(row.ly):0
    ];
    const gpClass=profitabilityVisible
      ?profitabilityClass(total?'':dimension,total?'':row.name,profitabilityScope)
      :'';
    return `<tr${total?' class="total-row"':''}>${values.map((value,index)=>{
      const negative=index>0 && rawValues[index]<0?' sales-statement-negative':'';
      return `<td class="${negative.trim()}">${index===0?esc(value):value}</td>`;
    }).join('')}${profitabilityVisible?profitabilityCell(gpClass):''}</tr>`;
  };

  let html=`<thead>
    <tr class="sales-statement-group-head">
      <th rowspan="2" data-sort-index="0">${esc(dimensionLabel)}</th>
      <th rowspan="2" data-sort-index="1">Actual (${performanceCurrency})</th>
      <th rowspan="2" data-sort-index="2">Budget (${performanceCurrency})</th>
      <th colspan="2" data-no-sort="true">Vs. Budget</th>
      <th rowspan="2" data-sort-index="5">LY (${performanceCurrency})</th>
      <th colspan="2" data-no-sort="true">Vs. Last Year</th>
      ${profitabilityVisible?'<th rowspan="2" data-no-sort="true">GP%</th>':''}
    </tr>
    <tr class="sales-statement-sub-head">
      <th data-sort-index="3">${performanceCurrency}</th>
      <th data-sort-index="4">%</th>
      <th data-sort-index="6">${performanceCurrency}</th>
      <th data-sort-index="7">%</th>
    </tr>
  </thead><tbody>`;

  rows.forEach(row=>{ html+=makeRow(row); });
  if(rows.length) html+=makeRow({name:'Total',...totals},true);
  return `${html}</tbody>`;
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

  $('focTable').innerHTML=focTableHtml(tableRows,totals,dim,{type:'sales'});

  if(dim==='Country'){
    [...$('focTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')]
      .forEach(td=>{
        td.classList.add('drill-link');
        td.title='Click to view products';
        td.addEventListener('click',()=>openFocCountry(td.textContent));
      });
  }
  setupResizableColumns($('focTable'));
}
function focTableHtml(rows,totals,dimension='Name',profitabilityScope={type:'sales'}){
  const dimensionLabel=dimension==='Country'?'Market':dimension;
  let h=`<thead>
    <tr class="foc-statement-group-head">
      <th rowspan="2" data-sort-index="0">${esc(dimensionLabel)}</th>
      <th rowspan="2" data-sort-index="1">Actual (${performanceCurrency})</th>
      <th colspan="2" data-no-sort="true">Actual FG</th>
      <th colspan="2" data-no-sort="true">Budget FG</th>
      <th rowspan="2" data-sort-index="6">FG Variance %</th>
      ${profitabilityVisible?'<th rowspan="2" data-no-sort="true">GP%</th>':''}
    </tr>
    <tr class="foc-statement-sub-head">
      <th data-sort-index="2">${performanceCurrency}</th>
      <th data-sort-index="3">%</th>
      <th data-sort-index="4">${performanceCurrency}</th>
      <th data-sort-index="5">%</th>
    </tr>
  </thead><tbody>`;
  const makeRow=(r,total=false)=>{
    const cls=r.varianceRate<=0?'positive':'negative';
    const variance=Math.round(r.varianceRate*100);
    const varianceText=variance<0?`(${Math.abs(variance)}%)`:`${variance}%`;
    const gpClass=profitabilityVisible
      ?profitabilityClass(total?'':dimension,total?'':r.name,profitabilityScope)
      :'';
    return `<tr${total?' class="total-row"':''}>
      <td>${esc(r.name)}</td>
      <td>${focStatementValue(r.actual)}</td>
      <td>${focStatementValue(r.actualFoc)}</td>
      <td>${salesStatementPercent(r.actualFoc,r.actual)}</td>
      <td>${focStatementValue(r.budgetFoc)}</td>
      <td>${salesStatementPercent(r.budgetFoc,r.actual)}</td>
      <td class="highlight ${cls}">${varianceText}</td>
      ${profitabilityVisible?profitabilityCell(gpClass):''}
    </tr>`;
  };
  rows.forEach(r=>h+=makeRow(r));
  if(rows.length){
    const actualRate=totals.actual?totals.actualFoc/totals.actual:0;
    const budgetRate=totals.actual?totals.budgetFoc/totals.actual:0;
    h+=makeRow({name:'Total',...totals,actualRate,budgetRate,varianceRate:actualRate-budgetRate},true);
  }
  return h+'</tbody>';
}

function rerenderOpenCountryModal(){
  if(!$('countryModal')?.classList.contains('open')) return;
  if(detailMode==='foc-product'){
    renderFocGroupProducts(activeFocGroup);
  }else if(detailMode==='foc'){
    renderFocCountryGroups();
  }else if(activeBrand){
    renderBrandProducts(activeBrand);
  }else{
    renderCountryBrands();
  }
}

document.querySelectorAll('[data-performance-currency]').forEach(button=>{
  button.addEventListener('click',()=>{
    performanceCurrency=button.dataset.performanceCurrency==='JOD'?'JOD':'USD';
    document.querySelectorAll('[data-performance-currency]').forEach(option=>{
      const active=option.dataset.performanceCurrency===performanceCurrency;
      option.classList.toggle('active',active);
      option.setAttribute('aria-pressed',String(active));
    });
    renderAll();
    rerenderOpenCountryModal();
  });
});

let performanceSpotlightState=null;

function renderSpotlightFlags(flag,countries){
  const header=flag?.parentElement;
  if(!flag || !header) return;
  header.querySelectorAll('.spotlight-extra-flag').forEach(image=>image.remove());

  const seenCodes=new Set();
  const entries=(countries || []).map(country=>({
    country:String(country || '').trim(),
    code:countryFlagCode(country)
  })).filter(entry=>{
    if(!entry.code || seenCodes.has(entry.code)) return false;
    seenCodes.add(entry.code);
    return true;
  });

  const setImage=(image,entry)=>{
    image.src=countryFlagDataUri(entry.code);
    image.alt=`${entry.country} flag`;
    image.title=entry.country;
    image.hidden=false;
    image.onerror=()=>{ image.hidden=true; };
  };

  if(!entries.length){
    flag.hidden=true;
    flag.removeAttribute('src');
    flag.alt='';
    flag.title='';
    return;
  }

  setImage(flag,entries[0]);
  const textBlock=[...header.children].find(element=>element.tagName==='DIV') || null;
  entries.slice(1).forEach((entry,index)=>{
    const image=document.createElement('img');
    image.className='spotlight-extra-flag';
    image.style.zIndex=String(entries.length-index);
    setImage(image,entry);
    header.insertBefore(image,textBlock);
  });
}

function updatePerformanceSpotlightHeader(type){
  const header=$(`${type}SpotlightCountryHeader`);
  const flag=$(`${type}SpotlightCountryFlag`);
  const name=$(`${type}SpotlightCountryName`);
  if(!header || !flag || !name) return;

  const isStock=type==='stock';
  const isNearlyExpired=type==='nearExpiry';
  const selected=getSelected(
    isNearlyExpired?'nearExpiryCountryFilter':isStock?'stockCountryFilter':'countryFilter'
  );
  const available=[...new Set(
    (isNearlyExpired?filteredNearExpiryRows():isStock?filteredStockRows():filtered())
      .map(row=>String(row.Country||'').trim()).filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b));
  const countries=selected.length?selected:available;
  const singleCountry=countries.length===1?countries[0]:'';

  name.textContent=singleCountry || (
    selected.length>1 ? selected.join(' · ') : 'All Markets'
  );
  renderSpotlightFlags(flag,selected.length?countries:(countries.length===1?countries:[]));
}

function setPerformanceTableSpotlight(type,active){
  const button=$(`${type}SpotlightBtn`);
  const exitButton=$(`${type}SpotlightExitBtn`);
  const header=$(`${type}SpotlightCountryHeader`);

  if(active){
    if(performanceSpotlightState){
      setPerformanceTableSpotlight(performanceSpotlightState.type,false);
    }
    const section=type==='nearExpiry'?$('stockSection'):$(`${type}Section`);
    const tableWrap=section?.querySelector(
      type==='nearExpiry'
        ?'.near-expiry-table-scroll'
        :type==='stock'?'.stock-table-scroll':'.sales-foc-table-scroll'
    );
    if(!tableWrap) return;

    performanceSpotlightState={
      type,
      tableWrap,
      parent:tableWrap.parentNode,
      nextSibling:tableWrap.nextSibling
    };
    updatePerformanceSpotlightHeader(type);
    tableWrap.classList.add('performance-spotlight-stage');
    tableWrap.dataset.spotlightType=type;
    document.body.appendChild(tableWrap);
    tableWrap.scrollTop=0;
    tableWrap.scrollLeft=0;
    document.body.classList.add('performance-table-spotlight');
  }else if(performanceSpotlightState?.type===type){
    const state=performanceSpotlightState;
    state.tableWrap.classList.remove('performance-spotlight-stage');
    delete state.tableWrap.dataset.spotlightType;
    if(state.parent){
      if(state.nextSibling && state.nextSibling.parentNode===state.parent){
        state.parent.insertBefore(state.tableWrap,state.nextSibling);
      }else{
        state.parent.appendChild(state.tableWrap);
      }
    }
    performanceSpotlightState=null;
    document.body.classList.remove('performance-table-spotlight');
  }

  button?.setAttribute('aria-pressed',String(active));
  if(exitButton) exitButton.hidden=!active;
  if(header) header.hidden=!active;
  if(active) exitButton?.focus();
  else button?.focus();
}

$('salesSpotlightBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('sales',true));
$('salesSpotlightExitBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('sales',false));
$('focSpotlightBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('foc',true));
$('focSpotlightExitBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('foc',false));
$('stockSpotlightBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('stock',true));
$('stockSpotlightExitBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('stock',false));
$('nearExpirySpotlightBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('nearExpiry',true));
$('nearExpirySpotlightExitBtn')?.addEventListener('click',()=>setPerformanceTableSpotlight('nearExpiry',false));
document.addEventListener('keydown',event=>{
  const drilldownOpen=Boolean(document.querySelector('.modal.open'));
  if(event.key==='Escape' && performanceSpotlightState && !drilldownOpen){
    setPerformanceTableSpotlight(performanceSpotlightState.type,false);
  }
});

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
  return filtered().filter(r=>sameText(r.Country,activeCountry));
}

function detailLyRows(){
  return filteredLY().filter(r=>sameText(r.Country,activeCountry));
}

function focDetailRows(){
  return detailBaseRows().filter(r=>String(r.Type||'').toUpperCase()==='IMS');
}

function focDetailTableHtml(rows,totalLabel='Total',dimension='Name',profitabilityScope={type:'sales'}){
  const totals=rows.reduce(
    (t,r)=>({
      actual:t.actual+r.actual,
      actualFoc:t.actualFoc+r.actualFoc,
      budgetFoc:t.budgetFoc+r.budgetFoc
    }),
    {actual:0,actualFoc:0,budgetFoc:0}
  );

  let html=focTableHtml(rows,totals,dimension,profitabilityScope);
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
  $('countryDetailTable').className='sales-statement-detail';
  $('countryDetailTable').innerHTML=salesStatementTableHtml(
    data,'Brand',{type:'sales',country:activeCountry}
  );

  [...$('countryDetailTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')]
    .forEach(td=>{
      td.classList.add('drill-link');
      td.addEventListener('click',()=>renderBrandProducts(td.textContent));
    });
  setupResizableColumns($('countryDetailTable'));
}

function renderBrandProducts(brand){
  detailMode='sales';
  activeBrand=brand;
  $('backToBrands').hidden=false;
  $('backToBrands').textContent='← Back to Brands';
  setCountryModalTitle(`${activeCountry} · ${brand}`);
  $('countryModalSubtitle').textContent='Product detail';
  $('countryDetailHint').textContent='Product level';

  const rows=detailBaseRows().filter(r=>sameText(r.__brand,brand));
  const lyRows=detailLyRows().filter(r=>sameText(r.__brand,brand));
  const data=aggregate(rows,'Product Name',lyRows).sort((a,b)=>b.actual-a.actual);

  $('countryDetailCount').textContent=`${data.length} products`;
  $('countryDetailTable').className='sales-statement-detail';
  $('countryDetailTable').innerHTML=salesStatementTableHtml(
    data,'Product',{type:'sales',country:activeCountry,brand:activeBrand}
  );
  setupResizableColumns($('countryDetailTable'));
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
  $('countryDetailTable').className='foc-statement-detail';
  $('countryDetailTable').innerHTML=focDetailTableHtml(
    tableRows,
    'Total',
    'Product Group',
    {type:'sales',country:activeCountry}
  );

  [...$('countryDetailTable').querySelectorAll('tbody tr:not(.total-row) td:first-child')]
    .forEach(td=>{
      td.classList.add('drill-link');
      td.title='Click to view products';
      td.addEventListener('click',()=>renderFocGroupProducts(td.textContent));
    });
  setupResizableColumns($('countryDetailTable'));
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
    sameText(r['Product Group']||r.__group,group)
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
  $('countryDetailTable').className='foc-statement-detail';
  $('countryDetailTable').innerHTML=focDetailTableHtml(
    tableRows,
    'Total',
    'Product',
    {type:'sales',country:activeCountry,brand:activeFocGroup}
  );
  setupResizableColumns($('countryDetailTable'));
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
let pnlComparisonMode = 'standard';
let pnlCurrency = 'USD';
let pnlCogsExpanded = false;
let pnlReturnExpanded = false;
const PNL_USD_TO_JOD = 0.709;

const pnlLineConfig = [
  { key: 'grossSales', label: 'Gross Sales' },
  { key: 'actualReturn', label: 'Actual Return' },
  { key: 'expectedReturn', label: 'Expected Return' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'commissions', label: 'Commissions' },
  { key: 'restoun', label: 'Restoun' },
  { key: 'netSales', label: 'Net Sales', subtotal: true },
  { key: 'actualCogs', label: 'Goods COGS' },
  { key: 'focCogs', label: 'FOC COGS' },
  { key: 'grossProfit', label: 'Gross Profit', subtotal: true },
  { key: 'sm', label: 'S&M' },
  { key: 'netIncome', label: 'Net Income', subtotal: true }
];

function pnlPresentationLines(){
  const lines=[];
  pnlLineConfig.forEach(line=>{
    if(line.key==='actualReturn'){
      lines.push({key:'return',label:'Return',returnToggle:true});
      if(pnlReturnExpanded){
        lines.push({...line,returnDetail:true});
      }
      return;
    }
    if(line.key==='expectedReturn'){
      if(pnlReturnExpanded) lines.push({...line,returnDetail:true});
      return;
    }
    if(line.key==='actualCogs'){
      lines.push({key:'cogs',label:'COGS',cogsToggle:true});
      if(pnlCogsExpanded){
        lines.push({...line,cogsDetail:true});
      }
      return;
    }
    if(line.key==='focCogs'){
      if(pnlCogsExpanded) lines.push({...line,cogsDetail:true});
      return;
    }
    lines.push(line);
  });
  return lines;
}

function pnlVisibleLines(){
  const presentationLines=pnlPresentationLines();
  if(pnlViewMode==='netSales'){
    const start=presentationLines.findIndex(line=>line.key==='netSales');
    return presentationLines.slice(start);
  }
  if(pnlViewMode==='summary'){
    const summaryKeys=new Set([
      'grossSales','netSales','cogs','actualCogs','focCogs','grossProfit','sm','netIncome'
    ]);
    return presentationLines.filter(line=>summaryKeys.has(line.key));
  }
  return presentationLines;
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

document.querySelectorAll('[data-pnl-comparison]').forEach(button=>{
  button.addEventListener('click',()=>{
    pnlComparisonMode=button.dataset.pnlComparison==='fyBudget'?'fyBudget':'standard';
    document.querySelectorAll('[data-pnl-comparison]').forEach(option=>{
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

  name.textContent=singleMarket || (
    markets.length ? markets.join(' · ') : 'All Markets'
  );
  renderSpotlightFlags(flag,selected.length?markets:(markets.length===1?markets:[]));
}

let pnlSpotlightOriginalParent=null;
let pnlSpotlightOriginalNextSibling=null;

function setPnlTableSpotlight(active){
  const spotlightButton=$('pnlSpotlightBtn');
  const exitButton=$('pnlSpotlightExitBtn');
  const countryHeader=$('pnlSpotlightCountryHeader');
  const tableWrap=document.querySelector('#pnlSection .pnl-table-wrap, .pnl-table-wrap.pnl-spotlight-stage');
  if(active) updatePnlSpotlightCountry();

  if(active && tableWrap && !tableWrap.classList.contains('pnl-spotlight-stage')){
    pnlSpotlightOriginalParent=tableWrap.parentNode;
    pnlSpotlightOriginalNextSibling=tableWrap.nextSibling;
    tableWrap.classList.add('pnl-spotlight-stage');
    document.body.appendChild(tableWrap);
    tableWrap.scrollTop=0;
    tableWrap.scrollLeft=0;
  }

  document.body.classList.toggle('pnl-table-spotlight',active);
  spotlightButton?.setAttribute('aria-pressed',String(active));
  if(exitButton) exitButton.hidden=!active;
  if(countryHeader) countryHeader.hidden=!active;

  if(!active && tableWrap?.classList.contains('pnl-spotlight-stage')){
    tableWrap.classList.remove('pnl-spotlight-stage');
    if(pnlSpotlightOriginalParent){
      if(
        pnlSpotlightOriginalNextSibling &&
        pnlSpotlightOriginalNextSibling.parentNode===pnlSpotlightOriginalParent
      ){
        pnlSpotlightOriginalParent.insertBefore(tableWrap,pnlSpotlightOriginalNextSibling);
      }else{
        pnlSpotlightOriginalParent.appendChild(tableWrap);
      }
    }
    pnlSpotlightOriginalParent=null;
    pnlSpotlightOriginalNextSibling=null;
  }

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

function pnlLineValue(totals,line){
  if(line.key==='return'){
    return pnlNumber(totals.actualReturn)+pnlNumber(totals.expectedReturn);
  }
  return line.key==='cogs'
    ?pnlNumber(totals.actualCogs)+pnlNumber(totals.focCogs)
    :pnlNumber(totals[line.key]);
}


function renderPnlVertical() {
  const rows = pnlFilteredRows();
  const actual = pnlConvertCurrency(pnlScenarioTotals(rows, 'Actual'));
  const budget = pnlConvertCurrency(pnlScenarioTotals(rows, 'Budget'));
  const ly = pnlConvertCurrency(pnlScenarioTotals(rows, 'LY'));
  const fyBudget = pnlConvertCurrency(pnlScenarioTotals(rows, 'FY Budget'));

  const table = $('pnlTable');
  if (!table) return;
  const visibleLines = pnlVisibleLines();
  const count = $('pnlCount');
  if (count) count.textContent = `${visibleLines.length} P&L lines`;

  let html = pnlComparisonMode==='fyBudget' ? `
    <thead>
      <tr class="pnl-group-head pnl-fy-budget-head">
        <th>Consolidated P&amp;L</th>
        <th>Actual (${pnlCurrency})</th>
        <th>FY Budget (${pnlCurrency})</th>
        <th>Remaining (${pnlCurrency})</th>
      </tr>
    </thead>
    <tbody>` : `
    <thead>
      <tr class="pnl-group-head">
        <th rowspan="2">Consolidated P&amp;L</th>
        <th rowspan="2">Actual (${pnlCurrency})</th>
        <th rowspan="2">Budget (${pnlCurrency})</th>
        <th colspan="2">Vs Budget</th>
        <th rowspan="2">LY (${pnlCurrency})</th>
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
    const a = pnlLineValue(actual,line);
    const b = pnlLineValue(budget,line);
    const l = pnlLineValue(ly,line);
    const f = pnlLineValue(fyBudget,line);
    const vb = a - b;
    const vl = a - l;
    const remaining = f - a;
    const rowClasses = [
      `pnl-line-${line.key}`,
      line.subtotal ? 'pnl-subtotal pnl-statement-total' : '',
      ['cogs','actualCogs','focCogs'].includes(line.key) ? 'pnl-cost-row' : '',
      line.cogsDetail ? 'pnl-cogs-detail-row' : '',
      line.returnDetail ? 'pnl-return-detail-row' : ''
    ].filter(Boolean).join(' ');
    const lineLabel=line.cogsToggle
      ?`<button class="pnl-cogs-toggle" type="button" data-pnl-cogs-toggle aria-expanded="${pnlCogsExpanded}"><span aria-hidden="true">${pnlCogsExpanded?'⌄':'›'}</span> COGS</button>`
      :line.returnToggle
        ?`<button class="pnl-return-toggle" type="button" data-pnl-return-toggle aria-expanded="${pnlReturnExpanded}"><span aria-hidden="true">${pnlReturnExpanded?'⌄':'›'}</span> Return</button>`
        :line.label;

    html += pnlComparisonMode==='fyBudget' ? `
      <tr class="${rowClasses}">
        <td>${lineLabel}</td>
        <td class="${pnlAmountClass(a)}">${pnlFormat(a)}</td>
        <td class="${pnlAmountClass(f)}">${pnlFormat(f)}</td>
        <td class="${pnlVarianceClass(remaining)} ${pnlAmountClass(remaining)}">${pnlFormat(remaining)}</td>
      </tr>` : `
      <tr class="${rowClasses}">
        <td>${lineLabel}</td>
        <td class="${pnlAmountClass(a)}">${pnlFormat(a)}</td>
        <td class="${pnlAmountClass(b)}">${pnlFormat(b)}</td>
        <td class="${pnlVarianceClass(vb)} ${pnlAmountClass(vb)}">${pnlFormat(vb)}</td>
        <td class="pnl-percent ${pnlVarianceClass(vb)} ${pnlAmountClass(vb)}">${pnlPercent(vb,b)}</td>
        <td class="${pnlAmountClass(l)}">${pnlFormat(l)}</td>
        <td class="${pnlVarianceClass(vl)} ${pnlAmountClass(vl)}">${pnlFormat(vl)}</td>
        <td class="pnl-percent ${pnlVarianceClass(vl)} ${pnlAmountClass(vl)}">${pnlPercent(vl,l)}</td>
      </tr>`;
  });


  const ratioRows = [
    { label:'COGS / Gross Sales', numerator:'cogs', denominator:'grossSales', absolute:true, cogsToggle:true },
    ...(pnlCogsExpanded?[
      { label:'Goods COGS / Gross Sales', numerator:'actualCogs', denominator:'grossSales', absolute:true, cogsDetail:true },
      { label:'FOC COGS / Net Sales', numerator:'focCogs', denominator:'netSales', absolute:true, cogsDetail:true }
    ]:[]),
    { label:'Gross Profit', numerator:'grossProfit' },
    { label:'S&M', numerator:'sm', absolute:true },
    { label:'Net Income', numerator:'netIncome' }
  ];
  html += `<tr class="pnl-ratio-spacer"><td colspan="${pnlComparisonMode==='fyBudget'?4:8}"></td></tr>`;
  ratioRows.forEach(row=>{
    const ratioValue=(value,netSales)=>{
      const ratio=pnlRatio(value,netSales);
      return row.absolute?Math.abs(ratio):ratio;
    };
    const formatRatio=value=>`${(value*100).toFixed(1)}%`;
    const ratioNumerator=totals=>row.numerator==='cogs'
      ?pnlNumber(totals.actualCogs)+pnlNumber(totals.focCogs)
      :pnlNumber(totals[row.numerator]);
    const ratioDenominator=totals=>pnlNumber(totals[row.denominator||'netSales']);
    const actualRatio=ratioValue(ratioNumerator(actual),ratioDenominator(actual));
    const budgetRatio=ratioValue(ratioNumerator(budget),ratioDenominator(budget));
    const lyRatio=ratioValue(ratioNumerator(ly),ratioDenominator(ly));
    const fyBudgetRatio=ratioValue(ratioNumerator(fyBudget),ratioDenominator(fyBudget));
    const remainingRatio=fyBudgetRatio-actualRatio;
    const ratioLabel=row.cogsToggle
      ?`<button class="pnl-cogs-toggle" type="button" data-pnl-cogs-toggle aria-expanded="${pnlCogsExpanded}"><span aria-hidden="true">${pnlCogsExpanded?'⌄':'›'}</span> ${row.label}</button>`
      :row.label;
    const ratioRowClasses=['pnl-statement-ratio',row.cogsDetail?'pnl-cogs-detail-row':'']
      .filter(Boolean).join(' ');
    html += pnlComparisonMode==='fyBudget' ? `
      <tr class="${ratioRowClasses}">
        <td>${ratioLabel}</td>
        <td class="${pnlAmountClass(actualRatio)}">${formatRatio(actualRatio)}</td>
        <td class="${pnlAmountClass(fyBudgetRatio)}">${formatRatio(fyBudgetRatio)}</td>
        <td class="${pnlVarianceClass(remainingRatio)} ${pnlAmountClass(remainingRatio)}">${(remainingRatio*100).toFixed(1)} pp</td>
      </tr>` : `
      <tr class="${ratioRowClasses}">
        <td>${ratioLabel}</td>
        <td class="${pnlAmountClass(actualRatio)}">${formatRatio(actualRatio)}</td>
        <td class="${pnlAmountClass(budgetRatio)}">${formatRatio(budgetRatio)}</td>
        <td colspan="2"></td>
        <td class="${pnlAmountClass(lyRatio)}">${formatRatio(lyRatio)}</td>
        <td colspan="2"></td>
      </tr>`;
  });

  html += '</tbody>';
  table.innerHTML = html;
  table.querySelectorAll('[data-pnl-cogs-toggle]').forEach(button=>{
    button.addEventListener('click',()=>{
      pnlCogsExpanded=!pnlCogsExpanded;
      renderPnlVertical();
    });
  });
  table.querySelector('[data-pnl-return-toggle]')?.addEventListener('click',()=>{
    pnlReturnExpanded=!pnlReturnExpanded;
    renderPnlVertical();
  });
  setupResizableColumns(table);

  const comparisonTarget=pnlComparisonMode==='fyBudget'?fyBudget:budget;
  const comparisonLabel=pnlComparisonMode==='fyBudget'?'Remaining':'Vs Budget';
  const netSalesVar = pnlComparisonMode==='fyBudget'
    ?comparisonTarget.netSales-actual.netSales
    :actual.netSales-comparisonTarget.netSales;
  const gpVar = pnlComparisonMode==='fyBudget'
    ?comparisonTarget.grossProfit-actual.grossProfit
    :actual.grossProfit-comparisonTarget.grossProfit;
  const niVar = pnlComparisonMode==='fyBudget'
    ?comparisonTarget.netIncome-actual.netIncome
    :actual.netIncome-comparisonTarget.netIncome;
  const actualGpMargin = actual.netSales ? actual.grossProfit / actual.netSales : 0;
  const comparisonGpMargin = comparisonTarget.netSales
    ?comparisonTarget.grossProfit/comparisonTarget.netSales
    :0;

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

  netEl.textContent = `${comparisonLabel} ${pnlFormat(netSalesVar)}`;
  gpEl.textContent = `${comparisonLabel} ${pnlFormat(gpVar)}`;
  niEl.textContent = `${comparisonLabel} ${pnlFormat(niVar)}`;
  gmEl.textContent = `${pnlComparisonMode==='fyBudget'?'FY Budget':'Budget'} ${(comparisonGpMargin*100).toFixed(1)}%`;

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
  const colAny = names => {
    for (const name of names) {
      const index = col(name);
      if (index >= 0) return index;
    }
    return -1;
  };

  const required = ['Sales Type', 'Market', 'Agent', 'Scenario'];
  const missing = required.filter(name => col(name) < 0);
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  const numericColumns = {
    grossSales: 'Gross Sales',
    discounts: 'Discounts',
    commissions: 'Commissions',
    restoun: 'Restoun',
    netSales: 'Net Sales',
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

      const actualCogsIndex = colAny([
        'Actual COGS','Goods COGS','COGS','Cost of Goods Sold'
      ]);
      const focCogsIndex = colAny(['FOC COGS','Free of Charge COGS']);
      record.actualCogs = actualCogsIndex >= 0
        ? pnlReadNumber(row[actualCogsIndex])
        : 0;
      record.focCogs = focCogsIndex >= 0
        ? pnlReadNumber(row[focCogsIndex])
        : 0;

      const actualReturnIndex = colAny([
        'Actual Return','Actual Returns','Actual Sales Return','Actual Sales Returns'
      ]);
      const expectedReturnIndex = colAny([
        'Expected Return','Expected Returns','Expected Sales Return','Expected Sales Returns'
      ]);
      const legacyReturnIndex = colAny(['Return','Sales Returns','Sales Return']);
      const hasSplitReturns = actualReturnIndex >= 0 || expectedReturnIndex >= 0;
      const isBudgetScenario = pnlNormalizeHeader(record.scenario).includes('budget');
      const legacyReturn = legacyReturnIndex >= 0
        ? pnlReadNumber(row[legacyReturnIndex])
        : 0;
      record.actualReturn = actualReturnIndex >= 0
        ? pnlReadNumber(row[actualReturnIndex])
        : hasSplitReturns || isBudgetScenario ? 0 : legacyReturn;
      record.expectedReturn = expectedReturnIndex >= 0
        ? pnlReadNumber(row[expectedReturnIndex])
        : hasSplitReturns || !isBudgetScenario ? 0 : legacyReturn;

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

  if(typeof filterEl._applySelection==='function'){
    filterEl._applySelection();
  }else{
    updateActiveFilterChips();
  }
}

function clearDashboardFilter(filterEl){
  filterEl._setSelected([]);
  filterEl._applySelection?.();
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

    // Trigger the dashboard refresh once after clearing every active filter.
    if(typeof filters[0]?._applySelection==='function'){
      filters[0]._applySelection();
    }else{
      updateActiveFilterChips();
    }
  }
});

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(updateActiveFilterChips,0);
});

const globalCountryResetSources={
  resetBtn:'countryFilter',
  stockResetBtn:'stockCountryFilter',
  nearExpiryResetBtn:'nearExpiryCountryFilter',
  smSimpleFilterResetBtn:'smSimpleCountryFilter',
  pnlResetBtn:'pnlMarketFilter'
};

document.addEventListener('click',event=>{
  const resetButton=event.target.closest(
    '#resetBtn,#stockResetBtn,#nearExpiryResetBtn,#smSimpleFilterResetBtn,#pnlResetBtn'
  );
  if(!resetButton) return;
  setTimeout(()=>syncGlobalCountryFilters(
    globalCountryResetSources[resetButton.id]||'',
    []
  ),0);
});

/* Universal sortable tables */
(function () {
  const sortState = new WeakMap();
  const sortableHeaderSelector = [
    '#salesTable thead th',
    '#focTable thead th',
    '#stockSection table thead th',
    '#stockDetailModal table thead th',
    '#nearExpiryDetailModal table thead th',
    '#countryDetailTable thead th',
    '#pnlTable thead th'
  ].join(', ');

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
    const header =
      table.querySelector(`thead th[data-sort-index="${columnIndex}"]`) ||
      table.tHead?.rows?.[0]?.cells?.[columnIndex];
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
    const header = event.target.closest(sortableHeaderSelector);

    if (!header || header.dataset.noSort === 'true') return;

    const table = header.closest('table');
    if (!table) return;

    const sortIndex=Number(header.dataset.sortIndex ?? header.cellIndex);
    sortTable(table, sortIndex);
  });

  document.addEventListener('keydown', event => {
    const header = event.target instanceof Element
      ? event.target.closest(sortableHeaderSelector)
      : null;

    if (
      !header ||
      header.dataset.noSort === 'true' ||
      !['Enter', ' '].includes(event.key)
    ) return;
    event.preventDefault();

    const table = header.closest('table');
    const sortIndex=Number(header.dataset.sortIndex ?? header.cellIndex);
    if (table) sortTable(table, sortIndex);
  });

  function makeHeadersAccessible() {
    document
      .querySelectorAll(sortableHeaderSelector)
      .forEach(th => {
        if (th.dataset.noSort === 'true') {
          th.removeAttribute('tabindex');
          th.removeAttribute('title');
          return;
        }
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
let smSimpleCurrency = 'JOD';
const SM_JOD_PER_USD = 0.709;

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
  const amount=Number(value)||0;
  const converted=smSimpleCurrency==='USD'?amount/SM_JOD_PER_USD:amount;
  const rounded = Math.round(converted);
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
    []
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
  document.querySelectorAll('[data-sm-currency-label]').forEach(label=>{
    label.textContent=smSimpleCurrency;
  });

  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="8" class="sm-no-data">No matching data for the selected month and country.</td></tr>';
    setupResizableColumns($('smSimpleTable'));
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
  setupResizableColumns($('smSimpleTable'));
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

document.querySelectorAll('[data-sm-currency]').forEach(button=>{
  button.addEventListener('click',()=>{
    smSimpleCurrency=button.dataset.smCurrency==='USD'?'USD':'JOD';
    document.querySelectorAll('[data-sm-currency]').forEach(option=>{
      const active=option.dataset.smCurrency===smSimpleCurrency;
      option.classList.toggle('active',active);
      option.setAttribute('aria-pressed',String(active));
    });
    renderSmExpenses();
  });
});

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

  name.textContent=singleCountry || (
    countries.length ? countries.join(' · ') : 'All Countries'
  );
  renderSpotlightFlags(flag,selected.length?countries:(countries.length===1?countries:[]));
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
let stockCurrency = 'USD';
let stockViewMode = 'table';
let stockReportMode = 'stock';
const STOCK_USD_TO_JOD = 0.709;
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
  const brand=String(stockField(row,['brand','product','productname']) || 'Unassigned').trim();
  return {
    ...row,
    Brand:brand,
    SKU:String(stockField(row,['sku','product','productname']) || '').trim(),
    'Product Group':String(stockField(row,['productgroup','group']) || brand).trim(),
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

function stockHistoricalAverage(stock,historicalSales){
  return stockCoverage(stock,historicalSales)*12;
}

function stockForecastAverage(stock,forecastSales){
  return stockCoverage(stock,forecastSales)*6;
}

function stockCoverageFormat(value){
  return Number(value || 0).toLocaleString('en-US',{
    minimumFractionDigits:1,
    maximumFractionDigits:1
  });
}

function stockCurrencyValue(value){
  const amount=Number(value)||0;
  const converted=stockCurrency==='JOD'?amount*STOCK_USD_TO_JOD:amount;
  return converted/1000;
}

function stockDashboardAmount(value){
  return `${fmt(stockCurrencyValue(value))} ${stockCurrency}`;
}

function stockDashboardBarRows(items,maxValue,clickable=false){
  return items.map(item=>{
    const width=maxValue?Math.max(2,item.stock/maxValue*100):0;
    const content=`<span class="stock-dashboard-bar-label">${esc(item.name)}</span>
      <span class="stock-dashboard-bar-track"><i style="width:${width.toFixed(2)}%"></i></span>
      <strong>${stockDashboardAmount(item.stock)}</strong>`;
    return clickable
      ?`<button class="stock-dashboard-bar-row" type="button" data-stock-dashboard-country="${esc(item.name)}">${content}</button>`
      :`<div class="stock-dashboard-bar-row">${content}</div>`;
  }).join('');
}

function renderStockDashboard(){
  const target=$('stockDashboard');
  if(!target) return;
  const rows=filteredStockRows();
  if(!rows.length){
    target.innerHTML='<div class="stock-dashboard-empty">No stock data matches the selected filters.</div>';
    return;
  }

  const totals=rows.reduce((total,row)=>({
    stock:total.stock+row.__stock,
    historical:total.historical+row.__historical,
    forecast:total.forecast+row.__forecast
  }),{stock:0,historical:0,forecast:0});
  const {data:countries}=stockAggregateRows(rows,'Country','Unassigned Market');
  const {data:brands}=stockAggregateRows(rows,'Brand','Unassigned Brand');
  const topCountries=countries.slice(0,8);
  const topBrands=brands.slice(0,8);
  const maxCountryStock=topCountries[0]?.stock||0;
  const maxBrandStock=topBrands[0]?.stock||0;
  const marketBrandMap=new Map();
  rows.forEach(row=>{
    const country=String(row.Country||'Unassigned Market').trim()||'Unassigned Market';
    const brand=String(row.Brand||'Unassigned Brand').trim()||'Unassigned Brand';
    const key=`${country}\u0001${brand}`;
    if(!marketBrandMap.has(key)) marketBrandMap.set(key,{country,brand,stock:0,forecast:0});
    const item=marketBrandMap.get(key);
    item.stock+=row.__stock;
    item.forecast+=row.__forecast;
  });
  const priorityRows=[...marketBrandMap.values()].map(item=>{
    const gap=item.stock-item.forecast;
    const coverage=stockCoverage(item.stock,item.forecast);
    const status=item.forecast<=0
      ?'No forecast'
      :gap>0
        ?'Above 1× forecast'
        :gap<0
          ?'Below 1× forecast'
          :'Aligned';
    const statusClass=item.forecast<=0?'no-forecast':gap>0?'above':'below';
    return {...item,gap,coverage,status,statusClass};
  }).sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(0,10);

  target.innerHTML=`
    <div class="stock-dashboard-kpis">
      <article class="stock-dashboard-kpi"><span>Total Stock</span><strong>${stockDashboardAmount(totals.stock)}</strong><small>Filtered portfolio value</small></article>
      <article class="stock-dashboard-kpi"><span>Forecast Sales</span><strong>${stockDashboardAmount(totals.forecast)}</strong><small>Forecasted sales base</small></article>
      <article class="stock-dashboard-kpi"><span>Forecast Coverage</span><strong>${stockCoverageFormat(stockCoverage(totals.stock,totals.forecast))}×</strong><small>Stock ÷ Forecast Sales</small></article>
      <article class="stock-dashboard-kpi"><span>Historical Coverage</span><strong>${stockCoverageFormat(stockCoverage(totals.stock,totals.historical))}×</strong><small>Stock ÷ Historical Sales</small></article>
    </div>
    <div class="stock-dashboard-grid">
      <article class="stock-dashboard-card">
        <div class="stock-dashboard-card-head"><div><span>MARKET VIEW</span><h3>Stock value by market</h3></div><small>Click a market for details</small></div>
        <div class="stock-dashboard-bars">${stockDashboardBarRows(topCountries,maxCountryStock,true)}</div>
      </article>
      <article class="stock-dashboard-card">
        <div class="stock-dashboard-card-head"><div><span>PORTFOLIO VIEW</span><h3>Top brands by stock</h3></div><small>Top ${topBrands.length}</small></div>
        <div class="stock-dashboard-bars">${stockDashboardBarRows(topBrands,maxBrandStock)}</div>
      </article>
      <article class="stock-dashboard-card stock-priority-card">
        <div class="stock-dashboard-card-head"><div><span>ACTION PRIORITIES</span><h3>Largest stock gaps vs 1× monthly forecast</h3></div><small>Click a row for SKU details</small></div>
        <div class="stock-priority-table"><table><thead><tr><th>Market</th><th>Brand</th><th>Stock</th><th>Forecast</th><th>Coverage</th><th>Gap vs 1×</th><th>Status</th></tr></thead><tbody>
          ${priorityRows.map(item=>`<tr data-stock-priority-country="${esc(item.country)}" data-stock-priority-brand="${esc(item.brand)}" tabindex="0">
            <td>${esc(item.country)}</td><td>${esc(item.brand)}</td><td>${stockDashboardAmount(item.stock)}</td><td>${stockDashboardAmount(item.forecast)}</td>
            <td>${item.forecast>0?`${stockCoverageFormat(item.coverage)}×`:'—'}</td>
            <td class="${item.gap>=0?'stock-gap-positive':'stock-gap-negative'}">${stockDashboardAmount(item.gap)}</td>
            <td><span class="stock-priority-status ${item.statusClass}">${item.status}</span></td>
          </tr>`).join('')}
        </tbody></table></div>
      </article>
      <article class="stock-dashboard-card stock-market-summary-card">
        <div class="stock-dashboard-card-head"><div><span>MARKET COVERAGE</span><h3>Forecast coverage by market</h3></div><small>Active filters</small></div>
        <div class="stock-market-summary"><table><thead><tr><th>Market</th><th>Stock</th><th>Forecast</th><th>Coverage</th></tr></thead><tbody>
          ${countries.map(country=>`<tr data-stock-dashboard-country="${esc(country.name)}" tabindex="0">
            <td>${esc(country.name)}</td><td>${stockDashboardAmount(country.stock)}</td><td>${stockDashboardAmount(country.forecast)}</td><td>${stockCoverageFormat(stockCoverage(country.stock,country.forecast))}×</td>
          </tr>`).join('')}
        </tbody></table></div>
      </article>
    </div>`;

  target.querySelectorAll('[data-stock-dashboard-country]').forEach(element=>{
    const open=()=>openStockCountryDetails(element.dataset.stockDashboardCountry);
    element.addEventListener('click',open);
    element.addEventListener('keydown',event=>{
      if(['Enter',' '].includes(event.key)){
        event.preventDefault();
        open();
      }
    });
  });
  target.querySelectorAll('[data-stock-priority-country]').forEach(element=>{
    const open=()=>{
      openStockCountryDetails(element.dataset.stockPriorityCountry);
      openStockBrandDetails(element.dataset.stockPriorityBrand);
    };
    element.addEventListener('click',open);
    element.addEventListener('keydown',event=>{
      if(['Enter',' '].includes(event.key)){
        event.preventDefault();
        open();
      }
    });
  });
}

function setStockViewMode(mode){
  stockViewMode=mode==='dashboard'?'dashboard':'table';
  const dashboard=$('stockDashboard');
  const tableWrap=$('stockSection')?.querySelector('.stock-table-scroll');
  if(dashboard) dashboard.hidden=stockReportMode!=='stock'||stockViewMode!=='dashboard';
  if(tableWrap) tableWrap.hidden=stockReportMode!=='stock'||stockViewMode!=='table';
  if($('stockSpotlightBtn')) $('stockSpotlightBtn').hidden=stockReportMode!=='stock'||stockViewMode!=='table';
  document.querySelectorAll('[data-stock-view]').forEach(button=>{
    const active=button.dataset.stockView===stockViewMode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  if(stockViewMode==='dashboard') renderStockDashboard();
}

function stockStatementTableHtml(rows,totals,dimension='Brand',clickable=false,profitabilityScope={type:'stock'}){
  const makeRow=(row,total=false)=>{
    const gpClass=profitabilityVisible
      ?profitabilityClass(total?'':dimension,total?'':row.name,profitabilityScope)
      :'';
    return `<tr${total?' class="total-row"':''}>
    <td>${clickable&&!total
      ?`<button class="stock-drill-button" type="button" data-stock-drill-value="${esc(row.name)}">${esc(row.name)}</button>`
      :esc(row.name)}</td>
    <td>${fmt(stockCurrencyValue(row.stock))}</td>
    <td>${fmt(stockCurrencyValue(row.historical))}</td>
    <td>${fmt(stockCurrencyValue(row.forecast))}</td>
    <td>${stockCoverageFormat(stockHistoricalAverage(row.stock,row.historical))}</td>
    <td>${stockCoverageFormat(stockForecastAverage(row.stock,row.forecast))}</td>
    ${profitabilityVisible?profitabilityCell(gpClass):''}
  </tr>`;
  };

  return `<colgroup>
    <col style="width:250px"><col style="width:145px"><col style="width:180px">
    <col style="width:180px"><col style="width:180px"><col style="width:180px">
    ${profitabilityVisible?'<col style="width:95px">':''}
  </colgroup>
  <thead>
    <tr class="stock-statement-group-head">
      <th rowspan="2" data-sort-index="0" data-resize-column="0">${esc(dimension)}</th>
      <th rowspan="2" data-sort-index="1" data-resize-column="1">Stock (${stockCurrency})</th>
      <th rowspan="2" data-sort-index="2" data-resize-column="2">Historical Sales (${stockCurrency})</th>
      <th rowspan="2" data-sort-index="3" data-resize-column="3">Forecast Sales (${stockCurrency})</th>
      <th colspan="2" data-no-sort="true">Monthly Coverage</th>
      ${profitabilityVisible?'<th rowspan="2" data-no-sort="true">GP%</th>':''}
    </tr>
    <tr class="stock-statement-sub-head">
      <th data-sort-index="4" data-resize-column="4">Historical average</th>
      <th data-sort-index="5" data-resize-column="5">Forecasted average</th>
    </tr>
  </thead>
  <tbody>${rows.map(row=>makeRow(row)).join('')}${rows.length
    ?makeRow({name:'Total',...totals},true)
    :`<tr><td colspan="${profitabilityVisible?7:6}" class="stock-empty">No stock data matches the selected filters.</td></tr>`}
  </tbody>`;
}

function refreshStickyHeaderOffsets(table){
  if(!table?.tHead) return;
  let stickyTop=0;
  [...table.tHead.rows].forEach((row,rowIndex)=>{
    [...row.cells].forEach(header=>{
      header.style.setProperty('--table-sticky-top',`${stickyTop}px`);
      header.style.setProperty('--table-sticky-z',String(14-rowIndex));
    });
    stickyTop+=row.getBoundingClientRect().height;
  });
}

function setupResizableColumns(table){
  if(!table) return;

  const rowColumnCount=row=>[...row.cells]
    .reduce((count,cell)=>count+(Number(cell.colSpan)||1),0);
  const columnCount=Math.max(
    0,
    ...[...table.rows].map(rowColumnCount)
  );
  if(!columnCount) return;

  let colgroup=table.querySelector(':scope > colgroup');
  if(!colgroup){
    const measurementRow=[...table.tBodies]
      .flatMap(body=>[...body.rows])
      .find(row=>row.cells.length===columnCount&&[...row.cells].every(cell=>cell.colSpan===1));
    const tableIsVisible=table.getBoundingClientRect().width>0;
    const measuredWidths=measurementRow&&tableIsVisible
      ?[...measurementRow.cells].map(cell=>Math.max(80,Math.round(cell.getBoundingClientRect().width)))
      :Array.from({length:columnCount},(_,index)=>index===0?230:125);

    colgroup=document.createElement('colgroup');
    measuredWidths.forEach(width=>{
      const column=document.createElement('col');
      column.style.width=`${width}px`;
      colgroup.appendChild(column);
    });
    table.insertBefore(colgroup,table.firstChild);
  }

  const columns=[...colgroup.querySelectorAll('col')];
  while(columns.length<columnCount){
    const column=document.createElement('col');
    column.style.width='125px';
    colgroup.appendChild(column);
    columns.push(column);
  }

  table.classList.add('resizable-report-table');
  const storageKey=`br-column-widths:${table.id}:${columnCount}`;
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');
    saved.forEach((width,index)=>{
      if(columns[index]&&Number(width)>=80) columns[index].style.width=`${Number(width)}px`;
    });
  }catch(error){ /* Ignore unavailable or invalid local preferences. */ }

  const syncTableWidth=()=>{
    const width=columns.reduce((sum,column)=>sum+(parseFloat(column.style.width)||column.getBoundingClientRect().width||120),0);
    table.style.width=`${Math.max(width,640)}px`;
    table.style.minWidth='100%';
  };

  const headerByColumn=new Map();
  const occupied=[];
  [...(table.tHead?.rows||[])].forEach((row,rowIndex)=>{
    let columnIndex=0;
    [...row.cells].forEach(header=>{
      while(occupied[rowIndex]?.[columnIndex]) columnIndex++;
      const colspan=Number(header.colSpan)||1;
      const rowspan=Number(header.rowSpan)||1;
      for(let r=rowIndex;r<rowIndex+rowspan;r++){
        occupied[r]??=[];
        for(let c=columnIndex;c<columnIndex+colspan;c++) occupied[r][c]=true;
      }
      if(colspan===1) headerByColumn.set(columnIndex,header);
      columnIndex+=colspan;
    });
  });

  refreshStickyHeaderOffsets(table);

  headerByColumn.forEach((header,index)=>{
    header.dataset.resizeColumn=String(index);
    header.querySelector('.column-resize-handle')?.remove();
    const handle=document.createElement('span');
    handle.className='column-resize-handle';
    handle.title='Drag to resize column';
    handle.setAttribute('aria-hidden','true');
    header.appendChild(handle);
    handle.addEventListener('click',event=>event.stopPropagation());
    handle.addEventListener('pointerdown',event=>{
      event.preventDefault();
      event.stopPropagation();
      const index=Number(header.dataset.resizeColumn);
      const column=columns[index];
      if(!column) return;
      const startX=event.clientX;
      const startWidth=column.getBoundingClientRect().width;
      document.body.classList.add('resizing-table-column');
      handle.setPointerCapture?.(event.pointerId);

      const move=moveEvent=>{
        const width=Math.max(80,Math.round(startWidth+moveEvent.clientX-startX));
        column.style.width=`${width}px`;
        syncTableWidth();
      };
      const stop=()=>{
        document.body.classList.remove('resizing-table-column');
        handle.removeEventListener('pointermove',move);
        handle.removeEventListener('pointerup',stop);
        handle.removeEventListener('pointercancel',stop);
        try{
          localStorage.setItem(storageKey,JSON.stringify(columns.map(column=>
            Math.round(column.getBoundingClientRect().width)
          )));
        }catch(error){ /* Keep resizing even when storage is unavailable. */ }
        setupResizableColumns(table);
      };
      handle.addEventListener('pointermove',move);
      handle.addEventListener('pointerup',stop);
      handle.addEventListener('pointercancel',stop);
    });
  });
  syncTableWidth();
}

let stickyHeaderResizeFrame=0;
window.addEventListener('resize',()=>{
  window.cancelAnimationFrame(stickyHeaderResizeFrame);
  stickyHeaderResizeFrame=window.requestAnimationFrame(()=>{
    document.querySelectorAll('.resizable-report-table')
      .forEach(refreshStickyHeaderOffsets);
  });
},{passive:true});

let activeStockCountry='';
let activeStockBrand='';

function stockAggregateRows(rows,key,fallback){
  const grouped=new Map();
  rows.forEach(row=>{
    const name=String(row[key]||fallback).trim()||fallback;
    if(!grouped.has(name)) grouped.set(name,{name,stock:0,historical:0,forecast:0});
    const item=grouped.get(name);
    item.stock+=row.__stock;
    item.historical+=row.__historical;
    item.forecast+=row.__forecast;
  });
  const data=[...grouped.values()].sort((a,b)=>b.stock-a.stock);
  const totals=data.reduce((total,row)=>({
    stock:total.stock+row.stock,
    historical:total.historical+row.historical,
    forecast:total.forecast+row.forecast
  }),{stock:0,historical:0,forecast:0});
  return {data,totals};
}

function updateStockDetailFlag(){
  const flag=$('stockDetailCountryFlag');
  if(!flag) return;
  const code=countryFlagCode(activeStockCountry);
  flag.hidden=!code;
  flag.src=code?countryFlagDataUri(code):'';
  flag.alt=code?`${activeStockCountry} flag`:'';
  flag.title=activeStockCountry;
  flag.onerror=()=>{ flag.hidden=true; };
}

function renderStockCountryBrands(){
  activeStockBrand='';
  const rows=filteredStockRows().filter(row=>row.Country===activeStockCountry);
  const {data:brands,totals}=stockAggregateRows(rows,'Brand','Unassigned Brand');

  updateStockDetailFlag();
  $('stockDetailModalTitle').textContent=activeStockCountry;
  $('stockDetailModalSubtitle').textContent='Brand totals — click a brand to view its related SKUs.';
  $('stockDetailCount').textContent=`${brands.length.toLocaleString('en-US')} brands`;
  $('stockDetailBackButton').hidden=true;
  $('stockDetailTable').innerHTML=stockStatementTableHtml(
    brands,totals,'Brand',true,{type:'stock',country:activeStockCountry}
  );
  $('stockDetailTable').querySelectorAll('.stock-drill-button').forEach(button=>{
    button.addEventListener('click',()=>openStockBrandDetails(button.dataset.stockDrillValue));
  });
  setupResizableColumns($('stockDetailTable'));
}

function openStockCountryDetails(country){
  activeStockCountry=country;
  renderStockCountryBrands();
  $('stockDetailModal').classList.add('open');
  $('stockDetailModal').setAttribute('aria-hidden','false');
  window.requestAnimationFrame(()=>refreshStickyHeaderOffsets($('stockDetailTable')));
  $('closeStockDetailModal').focus();
}

function openStockBrandDetails(brand){
  activeStockBrand=brand;
  const rows=filteredStockRows().filter(row=>
    row.Country===activeStockCountry&&row.Brand===activeStockBrand
  );
  const {data:products,totals}=stockAggregateRows(rows,'SKU','Unassigned SKU');

  updateStockDetailFlag();
  $('stockDetailModalTitle').textContent=`${activeStockCountry} · ${activeStockBrand}`;
  $('stockDetailModalSubtitle').textContent='Related SKU detail within the currently selected Stock Level filters.';
  $('stockDetailCount').textContent=`${products.length.toLocaleString('en-US')} products`;
  $('stockDetailBackButton').hidden=false;
  $('stockDetailTable').innerHTML=stockStatementTableHtml(
    products,totals,'SKU',false,
    {type:'stock',country:activeStockCountry,brand:activeStockBrand}
  );
  setupResizableColumns($('stockDetailTable'));
}

function closeStockDetailModal(){
  $('stockDetailModal')?.classList.remove('open');
  $('stockDetailModal')?.setAttribute('aria-hidden','true');
}

function rerenderOpenStockDetail(){
  if(!$('stockDetailModal')?.classList.contains('open')) return;
  if(activeStockBrand) openStockBrandDetails(activeStockBrand);
  else renderStockCountryBrands();
}

function renderStockLevel(){
  const table=$('stockTable');
  if(!table) return;
  const rows=filteredStockRows();
  const {data:countries,totals}=stockAggregateRows(rows,'Country','Unassigned Market');

  const ksaRow=countries.find(row=>{
    const identity=textIdentity(row?.name).replace(/[^a-z0-9]+/g,'');
    return identity==='ksa'||identity.includes('saudi');
  });
  if(ksaRow){
    const previousHistorical=Number(ksaRow.historical)||0;
    const restoredHistorical=typeof window.BRGetKsaHistoricalStockSales==='function'
      ?Number(window.BRGetKsaHistoricalStockSales())
      :38954560.27027098;
    const replacementHistorical=Number.isFinite(restoredHistorical)&&restoredHistorical>0
      ?restoredHistorical
      :38954560.27027098;
    ksaRow.historical=replacementHistorical;
    totals.historical=(Number(totals.historical)||0)-previousHistorical+replacementHistorical;
  }

  $('stockCount').textContent=`${countries.length.toLocaleString('en-US')} markets`;
  table.innerHTML=stockStatementTableHtml(countries,totals,'Market',true,{type:'stock'});
  table.querySelectorAll('.stock-drill-button').forEach(button=>{
    button.addEventListener('click',()=>openStockCountryDetails(button.dataset.stockDrillValue));
  });
  setupResizableColumns(table);
  renderStockDashboard();
}

$('stockResetBtn')?.addEventListener('click',()=>{
  buildStockFilters(true);
  renderStockLevel();
});
$('closeStockDetailModal')?.addEventListener('click',closeStockDetailModal);
$('stockDetailBackButton')?.addEventListener('click',renderStockCountryBrands);
document.querySelectorAll('[data-stock-currency]').forEach(button=>{
  button.addEventListener('click',()=>{
    stockCurrency=button.dataset.stockCurrency==='JOD'?'JOD':'USD';
    document.querySelectorAll('[data-stock-currency]').forEach(option=>{
      const active=option.dataset.stockCurrency===stockCurrency;
      option.classList.toggle('active',active);
      option.setAttribute('aria-pressed',String(active));
    });
    renderStockLevel();
    rerenderOpenStockDetail();
  });
});
document.querySelector('[data-close-stock-modal]')?.addEventListener('click',closeStockDetailModal);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('stockDetailModal')?.classList.contains('open')){
    closeStockDetailModal();
  }
});
buildStockFilters(true);
renderStockLevel();
setStockViewMode(stockViewMode);

// ============================================================
// Nearly Expired — uploaded workbook columns:
// Country | Party Name | Item Description | Unit Price | Agent Stock
// Nearly Expired Goods 6 Month | Nearly Expired 6M+
// Values are always recalculated as Quantity × Unit Price.
// ============================================================
let nearExpiryRows=[];
let nearExpiryCurrency='USD';
let activeNearExpiryCountry='';
let activeNearExpiryAgent='';
const nearExpiryFilterIds=[
  'nearExpiryCountryFilter','nearExpiryAgentFilter','nearExpiryItemFilter'
];

function nearExpiryNormalize(row){
  const unitPrice=stockNumber(stockField(row,['unitprice','price']));
  const withinSixQty=stockNumber(stockField(row,[
    'nearlyexpiredwithin6mqty','nearlyexpiredgoods6month','nearlyexpiredgoods6months'
  ]));
  const sixPlusQty=stockNumber(stockField(row,[
    'nearlyexpired6mqty','nearlyexpired6monthsqty','nearlyexpired6m'
  ]));
  return {
    ...row,
    Country:String(stockField(row,['country','countryname','market']) || '').trim(),
    Agent:String(stockField(row,['agent','partyname','customer','distributor']) || '').trim(),
    Item:String(stockField(row,['item','itemdescription','product','productname','sku']) || '').trim(),
    __unitPrice:unitPrice,
    __agentStockQty:stockNumber(stockField(row,[
      'agentstockqty','juneagentstock','agentstock','stockquantity'
    ])),
    __withinSixQty:withinSixQty,
    __sixPlusQty:sixPlusQty,
    __withinSixValue:withinSixQty*unitPrice,
    __sixPlusValue:sixPlusQty*unitPrice
  };
}

function nearExpiryHasExposure(row){
  return Boolean(row&&(
    Number(row.__withinSixQty)||Number(row.__sixPlusQty)
  ));
}

function buildNearExpiryFilters(reset=false,changedId=''){
  const exposedRows=nearExpiryRows.filter(nearExpiryHasExposure);
  const selections=reset
    ?Object.fromEntries(nearExpiryFilterIds.map(id=>[id,[]]))
    :captureSelections(nearExpiryFilterIds);
  if(changedId==='nearExpiryCountryFilter'){
    constrainChildrenToParent(exposedRows,selections,'nearExpiryCountryFilter',[
      'nearExpiryAgentFilter','nearExpiryItemFilter'
    ]);
  }
  rebuildDependentFilters(exposedRows,nearExpiryFilterIds,selections,nextChangedId=>{
    buildNearExpiryFilters(false,nextChangedId);
    renderNearlyExpired();
  });
}

function filteredNearExpiryRows(){
  return nearExpiryRows.filter(row=>nearExpiryFilterIds.every(id=>{
    const selected=getSelected(id);
    const column=$(id)?.dataset.column;
    return !selected.length||selected.includes(String(row[column]??''));
  }));
}

function nearExpiryCurrencyValue(value){
  const amount=Number(value)||0;
  return nearExpiryCurrency==='JOD'?amount*STOCK_USD_TO_JOD:amount;
}

function nearExpiryMoney(value,decimals=0){
  return nearExpiryCurrencyValue(value).toLocaleString('en-US',{
    minimumFractionDigits:decimals,
    maximumFractionDigits:decimals
  });
}

function nearExpiryQty(value){
  const number=Number(value)||0;
  return number?Math.round(number).toLocaleString('en-US'):'—';
}

function nearExpiryAggregateRows(rows,key,fallback){
  const grouped=new Map();
  rows.forEach(row=>{
    const name=String(row[key]||fallback).trim()||fallback;
    if(!grouped.has(name)) grouped.set(name,{
      name,agentStockQty:0,withinSixQty:0,sixPlusQty:0,
      withinSixValue:0,sixPlusValue:0
    });
    const item=grouped.get(name);
    item.agentStockQty+=row.__agentStockQty;
    item.withinSixQty+=row.__withinSixQty;
    item.sixPlusQty+=row.__sixPlusQty;
    item.withinSixValue+=row.__withinSixValue;
    item.sixPlusValue+=row.__sixPlusValue;
  });
  const enrich=item=>{
    const totalQty=item.withinSixQty+item.sixPlusQty;
    const totalValue=item.withinSixValue+item.sixPlusValue;
    return {
      ...item,totalQty,totalValue,
      unitPrice:totalQty?totalValue/totalQty:0,
      exposure:item.agentStockQty?totalQty/item.agentStockQty:null
    };
  };
  const data=[...grouped.values()]
    .map(enrich)
    .filter(item=>item.totalQty!==0)
    .sort((a,b)=>b.totalValue-a.totalValue);
  const totals=enrich(data.reduce((total,row)=>({
    name:'Total',
    agentStockQty:total.agentStockQty+row.agentStockQty,
    withinSixQty:total.withinSixQty+row.withinSixQty,
    sixPlusQty:total.sixPlusQty+row.sixPlusQty,
    withinSixValue:total.withinSixValue+row.withinSixValue,
    sixPlusValue:total.sixPlusValue+row.sixPlusValue
  }),{agentStockQty:0,withinSixQty:0,sixPlusQty:0,withinSixValue:0,sixPlusValue:0}));
  return {data,totals};
}

function nearExpiryExposureClass(value){
  if(value===null) return '';
  if(value>=.5) return 'high';
  if(value>=.2) return 'medium';
  return 'low';
}

function nearExpiryTableHtml(rows,totals,dimension='Market',clickable=false,showUnitPrice=false){
  const indexOffset=showUnitPrice?1:0;
  const makeRow=(row,total=false)=>{
    const exposureText=row.exposure===null?'—':`${Math.round(row.exposure*100)}%`;
    return `<tr${total?' class="total-row"':''}>
      <td>${clickable&&!total
        ?`<button class="stock-drill-button" type="button" data-near-expiry-drill="${esc(row.name)}">${esc(row.name)}</button>`
        :esc(row.name)}</td>
      ${showUnitPrice?`<td>${total?'—':nearExpiryMoney(row.unitPrice,2)}</td>`:''}
      <td>${nearExpiryQty(row.agentStockQty)}</td>
      <td class="near-expiry-within">${nearExpiryQty(row.withinSixQty)}</td>
      <td class="near-expiry-within">${nearExpiryMoney(row.withinSixValue)}</td>
      <td class="near-expiry-plus">${nearExpiryQty(row.sixPlusQty)}</td>
      <td class="near-expiry-plus">${nearExpiryMoney(row.sixPlusValue)}</td>
      <td>${nearExpiryQty(row.totalQty)}</td>
      <td class="near-expiry-total-value">${nearExpiryMoney(row.totalValue)}</td>
      <td><span class="near-expiry-exposure ${nearExpiryExposureClass(row.exposure)}">${exposureText}</span></td>
    </tr>`;
  };
  const columns=showUnitPrice?10:9;
  return `<colgroup>
    <col style="width:${showUnitPrice?'300':'220'}px">
    ${showUnitPrice?'<col style="width:115px">':''}
    <col style="width:145px"><col style="width:120px"><col style="width:145px">
    <col style="width:120px"><col style="width:145px"><col style="width:130px">
    <col style="width:155px"><col style="width:115px">
  </colgroup>
  <thead>
    <tr class="near-expiry-group-head">
      <th rowspan="2" data-sort-index="0">${esc(dimension)}</th>
      ${showUnitPrice?`<th rowspan="2" data-sort-index="1">Unit Price (${nearExpiryCurrency})</th>`:''}
      <th rowspan="2" data-sort-index="${1+indexOffset}">Agent Stock Qty</th>
      <th colspan="2" data-no-sort="true" class="near-expiry-within-head">Nearly Expired Goods · Within 6M</th>
      <th colspan="2" data-no-sort="true" class="near-expiry-plus-head">Nearly Expired · 6M+</th>
      <th colspan="3" data-no-sort="true">Total Exposure</th>
    </tr>
    <tr class="near-expiry-sub-head">
      <th data-sort-index="${2+indexOffset}">Quantity</th><th data-sort-index="${3+indexOffset}">Value (${nearExpiryCurrency})</th>
      <th data-sort-index="${4+indexOffset}">Quantity</th><th data-sort-index="${5+indexOffset}">Value (${nearExpiryCurrency})</th>
      <th data-sort-index="${6+indexOffset}">Total Qty</th><th data-sort-index="${7+indexOffset}">Total Value (${nearExpiryCurrency})</th><th data-sort-index="${8+indexOffset}">Exposure %</th>
    </tr>
  </thead>
  <tbody>${rows.map(row=>makeRow(row)).join('')}${rows.length
    ?makeRow(totals,true)
    :`<tr><td colspan="${columns}" class="stock-empty">No Nearly Expired items match the selected filters.</td></tr>`}
  </tbody>`;
}

function renderNearExpiryKpis(rows){
  const target=$('nearExpiryKpis');
  if(!target) return;
  const {totals}=nearExpiryAggregateRows(rows,'Country','Unassigned Market');
  const markets=new Set(
    rows.filter(nearExpiryHasExposure).map(row=>row.Country).filter(Boolean)
  ).size;
  target.innerHTML=`
    <article><span>Markets with Exposure</span><strong>${markets.toLocaleString('en-US')}</strong><small>Filtered markets</small></article>
    <article class="urgent"><span>Within 6M Quantity</span><strong>${nearExpiryQty(totals.withinSixQty)}</strong><small>Units requiring priority</small></article>
    <article class="urgent"><span>Within 6M Value</span><strong>${nearExpiryMoney(totals.withinSixValue)}</strong><small>${nearExpiryCurrency} · Qty × Unit Price</small></article>
    <article class="watch"><span>6M+ Value</span><strong>${nearExpiryMoney(totals.sixPlusValue)}</strong><small>${nearExpiryCurrency} · monitoring exposure</small></article>
    <article><span>Total Exposure Value</span><strong>${nearExpiryMoney(totals.totalValue)}</strong><small>${nearExpiryCurrency} · both buckets</small></article>`;
}

function updateNearExpiryDetailFlag(){
  const flag=$('nearExpiryDetailCountryFlag');
  if(!flag) return;
  const code=countryFlagCode(activeNearExpiryCountry);
  flag.hidden=!code;
  flag.src=code?countryFlagDataUri(code):'';
  flag.alt=code?`${activeNearExpiryCountry} flag`:'';
  flag.title=activeNearExpiryCountry;
  flag.onerror=()=>{flag.hidden=true;};
}

function renderNearExpiryCountryParties(){
  activeNearExpiryAgent='';
  const rows=filteredNearExpiryRows().filter(row=>row.Country===activeNearExpiryCountry);
  const {data,totals}=nearExpiryAggregateRows(rows,'Agent','Unassigned Party');
  updateNearExpiryDetailFlag();
  $('nearExpiryDetailModalTitle').textContent=activeNearExpiryCountry;
  $('nearExpiryDetailModalSubtitle').textContent='Party exposure — click a party to view its related items.';
  $('nearExpiryDetailCount').textContent=`${data.length.toLocaleString('en-US')} parties`;
  $('nearExpiryDetailBackButton').hidden=true;
  $('nearExpiryDetailTable').innerHTML=nearExpiryTableHtml(data,totals,'Party / Agent',true);
  $('nearExpiryDetailTable').querySelectorAll('[data-near-expiry-drill]').forEach(button=>{
    button.addEventListener('click',()=>renderNearExpiryAgentItems(button.dataset.nearExpiryDrill));
  });
  setupResizableColumns($('nearExpiryDetailTable'));
}

function openNearExpiryCountry(country){
  activeNearExpiryCountry=country;
  renderNearExpiryCountryParties();
  $('nearExpiryDetailModal').classList.add('open');
  $('nearExpiryDetailModal').setAttribute('aria-hidden','false');
  window.requestAnimationFrame(()=>refreshStickyHeaderOffsets($('nearExpiryDetailTable')));
  $('closeNearExpiryDetailModal').focus();
}

function renderNearExpiryAgentItems(agent){
  activeNearExpiryAgent=agent;
  const rows=filteredNearExpiryRows().filter(row=>
    row.Country===activeNearExpiryCountry&&row.Agent===activeNearExpiryAgent
  );
  const {data,totals}=nearExpiryAggregateRows(rows,'Item','Unassigned Item');
  updateNearExpiryDetailFlag();
  $('nearExpiryDetailModalTitle').textContent=`${activeNearExpiryCountry} · ${agent}`;
  $('nearExpiryDetailModalSubtitle').textContent='Item-level quantity, unit price and calculated Nearly Expired value.';
  $('nearExpiryDetailCount').textContent=`${data.length.toLocaleString('en-US')} items`;
  $('nearExpiryDetailBackButton').hidden=false;
  $('nearExpiryDetailTable').innerHTML=nearExpiryTableHtml(data,totals,'Item Description',false,true);
  setupResizableColumns($('nearExpiryDetailTable'));
}

function closeNearExpiryDetailModal(){
  $('nearExpiryDetailModal')?.classList.remove('open');
  $('nearExpiryDetailModal')?.setAttribute('aria-hidden','true');
}

function renderNearlyExpired(){
  const table=$('nearExpiryTable');
  if(!table) return;
  const rows=filteredNearExpiryRows();
  const exposedRows=rows.filter(nearExpiryHasExposure);
  const {data,totals}=nearExpiryAggregateRows(rows,'Country','Unassigned Market');
  $('nearExpiryCount').textContent=`${data.length.toLocaleString('en-US')} markets · ${exposedRows.length.toLocaleString('en-US')} exposed items`;
  table.innerHTML=nearExpiryTableHtml(data,totals,'Market',true);
  table.querySelectorAll('[data-near-expiry-drill]').forEach(button=>{
    button.addEventListener('click',()=>openNearExpiryCountry(button.dataset.nearExpiryDrill));
  });
  setupResizableColumns(table);
  renderNearExpiryKpis(rows);
}

function setStockDisplayMode(mode){
  const displayMode=['stock','nearlyExpired','dashboard'].includes(mode)?mode:'stock';
  stockReportMode=displayMode==='nearlyExpired'?'nearlyExpired':'stock';
  stockViewMode=displayMode==='dashboard'?'dashboard':'table';
  if(performanceSpotlightState){
    setPerformanceTableSpotlight(performanceSpotlightState.type,false);
  }
  const stockActive=stockReportMode==='stock';
  $('stockLevelFilterCard').hidden=!stockActive;
  $('stockLevelToolbar').hidden=!stockActive;
  $('nearExpiryFilterCard').hidden=stockActive;
  $('nearExpiryToolbar').hidden=stockActive;
  $('nearExpiryKpis').hidden=stockActive;
  $('stockSection')?.querySelector('.near-expiry-table-scroll')?.toggleAttribute('hidden',stockActive);
  document.querySelectorAll('[data-stock-display]').forEach(button=>{
    const active=button.dataset.stockDisplay===displayMode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  setStockViewMode(stockViewMode);
  if(!stockActive) renderNearlyExpired();
}

$('nearExpiryResetBtn')?.addEventListener('click',()=>{
  buildNearExpiryFilters(true);
  renderNearlyExpired();
});
document.querySelectorAll('[data-stock-display]').forEach(button=>{
  button.addEventListener('click',()=>setStockDisplayMode(button.dataset.stockDisplay));
});
document.querySelectorAll('[data-near-expiry-currency]').forEach(button=>{
  button.addEventListener('click',()=>{
    nearExpiryCurrency=button.dataset.nearExpiryCurrency==='JOD'?'JOD':'USD';
    document.querySelectorAll('[data-near-expiry-currency]').forEach(option=>{
      const active=option.dataset.nearExpiryCurrency===nearExpiryCurrency;
      option.classList.toggle('active',active);
      option.setAttribute('aria-pressed',String(active));
    });
    renderNearlyExpired();
    if($('nearExpiryDetailModal')?.classList.contains('open')){
      if(activeNearExpiryAgent) renderNearExpiryAgentItems(activeNearExpiryAgent);
      else renderNearExpiryCountryParties();
    }
  });
});
$('nearExpiryDetailBackButton')?.addEventListener('click',renderNearExpiryCountryParties);
$('closeNearExpiryDetailModal')?.addEventListener('click',closeNearExpiryDetailModal);
document.querySelector('[data-close-near-expiry-modal]')?.addEventListener('click',closeNearExpiryDetailModal);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('nearExpiryDetailModal')?.classList.contains('open')){
    closeNearExpiryDetailModal();
  }
});
buildNearExpiryFilters(true);
renderNearlyExpired();
setStockDisplayMode('stock');

document.querySelectorAll('[data-profitability-toggle]').forEach(button=>{
  button.addEventListener('click',()=>{
    if(!profitabilityRows.length) return;
    profitabilityVisible=!profitabilityVisible;
    updateProfitabilityButtons();
    renderAll();
    renderStockLevel();
    rerenderOpenCountryModal();
    rerenderOpenStockDetail();
  });
});
updateProfitabilityButtons();

// Database loaders. The authenticated Firestore layer calls these after it has
// already enforced the user's country access.
window.renderSalesReportFromDatabase = function(reportKey='all'){
  if(!rawData.length) return;
  const rows=filtered();
  if(reportKey==='salesAnalysis'){
    renderSalesTable(rows);
    return;
  }
  if(reportKey==='focAnalysis'){
    renderFocTable(rows);
    return;
  }
  renderSalesTable(rows);
  renderFocTable(rows);
};

window.loadSalesRowsFromDatabase = function(rows,reportKey='all',options={}){
  rawData = (rows || []).map(normalize);
  buildAllSalesFilters(options.preserveFilters ? false : true);
  window.renderSalesReportFromDatabase(reportKey);
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
      'grosssales','netsales','return','salesreturns','actualreturn','actualreturns',
      'expectedreturn','expectedreturns','discounts','commissions',
      'cogs','actualcogs','goodscogs','foccogs','costofgoodssold',
      'grossprofit','sellingandmarketing',
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
  const hasField = (row,names) => {
    const normalizedNames = names.map(normalizeKey);
    return Object.keys(row || {}).some(item =>
      normalizedNames.includes(normalizeKey(item))
    );
  };
  const scenarioName = value => {
    const normalized = normalizeKey(value);
    if (normalized.includes('actual')) return 'Actual';
    if (normalized.includes('fybudget') || normalized.includes('fullyearbudget') || normalized.includes('budgetfy')) return 'FY Budget';
    if (normalized.includes('budget') || normalized === 'bud') return 'Budget';
    if (normalized === 'ly' || normalized.includes('lastyear') || normalized.includes('previousyear')) return 'LY';
    return '';
  };

  const grossSales = numeric(['gross sales','grosssales','sales']);
  const actualReturnAliases = [
    'actual return','actual returns','actual sales return','actual sales returns'
  ];
  const expectedReturnAliases = [
    'expected return','expected returns','expected sales return','expected sales returns'
  ];
  const legacySalesReturns = numeric(['return','sales returns','salesreturns','sales return']);
  const actualReturn = numeric(actualReturnAliases);
  const expectedReturn = numeric(expectedReturnAliases);
  const discounts = numeric(['discounts','discount']);
  const commissions = numeric(['commissions','commission']);
  const restoun = numeric(['restoun']);
  const netSales = numeric(['net sales','netsales']);
  const actualCogs = numeric(['actual cogs','goods cogs','cogs','cost of goods sold']);
  const focCogs = numeric(['foc cogs','free of charge cogs']);
  const grossProfit = numeric(['gross profit','grossprofit','gross margin']);
  const sm = numeric(['s&m','sm','selling & marketing','selling and marketing','selling & marketing expenses']);
  const netIncome = numeric(['net income','netincome','net profit','netprofit']);

  pnlRawData = sourceRows.map(row => {
    const hasSplitReturns = hasField(row,actualReturnAliases) ||
      hasField(row,expectedReturnAliases);
    const scenario = scenarioName(value(row,['scenario','period','version']));
    const isBudgetScenario = scenario === 'Budget' || scenario === 'FY Budget';
    const legacyReturn = legacySalesReturns(row);
    return {
      salesType:String(value(row,['sales type','salestype','type']) || '').trim(),
      market:String(value(row,['market','country']) || '').trim(),
      agent:String(value(row,['agent','distributor','customer']) || '').trim(),
      scenario,
      grossSales:grossSales(row),
      actualReturn:hasSplitReturns ? actualReturn(row) : isBudgetScenario ? 0 : legacyReturn,
      expectedReturn:hasSplitReturns ? expectedReturn(row) : isBudgetScenario ? legacyReturn : 0,
      discounts:discounts(row),
      commissions:commissions(row),
      restoun:restoun(row),
      netSales:netSales(row),
      actualCogs:actualCogs(row),
      focCogs:focCogs(row),
      grossProfit:grossProfit(row),
      sm:sm(row),
      netIncome:netIncome(row)
    };
  }).filter(row => row.scenario);

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

window.loadNearlyExpiredRowsFromDatabase = function(rows){
  nearExpiryRows=(rows || []).map(nearExpiryNormalize)
    .filter(row=>row.Country&&row.Item);
  buildNearExpiryFilters(true);
  renderNearlyExpired();
};

window.loadProfitabilityRowsFromDatabase = function(rows){
  profitabilityRows=(rows||[]).map(row=>({
    country:String(stockField(row,['country','countryname','market'])||'').trim(),
    agent:String(stockField(row,['agent','submarket','customer','distributor'])||'').trim(),
    brand:String(stockField(row,['brand','productgroup'])||'Unassigned').trim(),
    product:String(stockField(row,['product','sku','productname'])||'').trim(),
    netSales:stockNumber(stockField(row,['netsalesusd','netsales'])),
    grossProfit:stockNumber(stockField(row,['grossprofitusd','grossprofit']))
  })).filter(row=>row.country&&row.product&&(row.netSales||row.grossProfit));
  if(!profitabilityRows.length) profitabilityVisible=false;
  updateProfitabilityButtons();
  renderAll();
  renderStockLevel();
  rerenderOpenCountryModal();
  rerenderOpenStockDetail();
};

// Enable sorting for Selling & Marketing table
(function(){
  let xlsxPromise=null;
  function ensureXlsx(){
    if (typeof XLSX !== "undefined") return Promise.resolve();
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.dataset.xlsxRuntime="true";
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error("Excel export library could not be loaded."));
      document.head.appendChild(script);
    }).catch(error=>{
      xlsxPromise=null;
      throw error;
    });
    return xlsxPromise;
  }

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
    nearlyExpired:{
      file:"Nearly_Expired",
      sheets:[{tableId:"nearExpiryTable",name:"Nearly Expired"}]
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

  async function exportReport(reportKey,button){
    const config=exports[reportKey];
    if (!config) return;
    button.disabled=true;
    try {
      await ensureXlsx();
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
