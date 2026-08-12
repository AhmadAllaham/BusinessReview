(() => {
  'use strict';

  if (window.__BR_MARKETS_AP_VERSION__) return;
  window.__BR_MARKETS_AP_VERSION__ = 1;

  const USD_TO_JOD = 0.709;
  const monthNumbers = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12
  };
  const state = {currency:'USD',loading:false,data:null,request:0};
  const byId = id => document.getElementById(id);

  function text(value) {
    return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ');
  }

  function key(value) {
    const normalized=text(value).toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g,'');
    if (['uae','unitedarabemirates'].includes(normalized)) return 'uae';
    if (['ksa','saudi','saudiarabia','kingdomofsaudiarabia'].includes(normalized)) return 'ksa';
    return normalized;
  }

  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const source=text(value);
    const negative=/^\(.*\)$/.test(source);
    const parsed=Number(source.replace(/[(),]/g,'').replace(/[^0-9.-]/g,''));
    if (!Number.isFinite(parsed)) return 0;
    return negative ? -Math.abs(parsed) : parsed;
  }

  function field(row,aliases) {
    const wanted=new Set(aliases.map(key));
    const match=Object.keys(row || {}).find(name => wanted.has(key(name)));
    return match === undefined ? '' : row[match];
  }

  function yearNumber(value) {
    const match=text(value).match(/(?:19|20|21)\d{2}/);
    return match ? Number(match[0]) : 0;
  }

  function monthNumber(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getMonth()+1;
    if (typeof value === 'number' && value >= 1 && value <= 12) return Math.trunc(value);
    const source=text(value).toLocaleLowerCase('en-US');
    if (/^(?:0?[1-9]|1[0-2])$/.test(source)) return Number(source);
    const compact=source.replace(/[^a-z0-9]+/g,'');
    if (monthNumbers[compact]) return monthNumbers[compact];
    const dateMatch=source.match(/(?:19|20|21)\d{2}[-/.](0?[1-9]|1[0-2])/);
    return dateMatch ? Number(dateMatch[1]) : 0;
  }

  function rowDate(row) {
    const value=field(row,['Date','Reporting Date','Period Date']);
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number') return new Date(Date.UTC(1899,11,30)+value*86400000);
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function salesPeriod(row) {
    return {
      year:yearNumber(field(row,['Year','Fiscal Year','Reporting Year'])),
      month:monthNumber(field(row,['Month','Reporting Month','Period Month']))
    };
  }

  function smPeriod(value) {
    const normalized=key(value).replace(/and/g,'');
    if (normalized === 'ly' || normalized === 'py' || normalized.includes('lastyear') || normalized.includes('previousyear')) return 'ly';
    if (normalized.includes('budget') || normalized === 'bud' || normalized === 'bdg') return 'budget';
    if (normalized.includes('actual') || normalized === 'act') return 'actual';
    return normalized;
  }

  function isPrivateIms(row) {
    return key(field(row,['Type','Sales Type','Channel'])).includes('ims') &&
      key(field(row,['Sector','Sales Sector'])).includes('private');
  }

  function isApExpense(row) {
    const classificationFields = [
      'Expense','Expense Group','Expense Category','Category','Group',
      'Commitment Item','Commitment Item Name','GL Account Name','Account Name'
    ];
    return classificationFields.some(name => {
      const value=key(field(row,[name]));
      if (!value) return false;
      return value === 'ap' ||
        value === 'apexpenses' ||
        value.includes('advertisingandpromotion') ||
        value.includes('advertisingpromotion') ||
        value.startsWith('advertising') ||
        value.startsWith('advertisement') ||
        value.startsWith('promotion') ||
        value.startsWith('promotional');
    });
  }

  function sameMarket(row,market) {
    return key(field(row,['Country','Market','Country Name'])) === key(market);
  }

  function aggregateSales(rows,selected) {
    const targetYear=Number(selected.year);
    const targetMonth=monthNumber(selected.month);
    const scoped=(rows || []).filter(row =>
      sameMarket(row,selected.market) && isPrivateIms(row)
    );
    const current=scoped.filter(row => {
      const period=salesPeriod(row);
      return period.year === targetYear && (!targetMonth || period.month === targetMonth);
    });
    const prior=scoped.filter(row => {
      const period=salesPeriod(row);
      return period.year === targetYear-1 && (!targetMonth || period.month === targetMonth);
    });
    const actual=current.reduce((sum,row) => sum+number(field(row,['Actual Value','Actual Sales','Actual','Actual YTD'])),0);
    const budget=current.reduce((sum,row) => sum+number(field(row,['Budget Value','Budget Sales','Budget','Budget YTD'])),0);
    const explicitLy=current.reduce((sum,row) => sum+number(field(row,['LY','LY Value','Last Year','Previous Year Actual'])),0);
    const priorActual=prior.reduce((sum,row) => sum+number(field(row,['Actual Value','Actual Sales','Actual','Actual YTD','LY'])),0);
    return {actual,budget,ly:Math.abs(priorActual)>1e-9 ? priorActual : explicitLy,count:current.length};
  }

  function aggregateAp(rows,selected) {
    const targetYear=Number(selected.year);
    const targetMonth=monthNumber(selected.month);
    let matched=0;
    const totals={actual:0,budget:0,ly:0};
    let explicitLy=0;
    let priorActual=0;

    (rows || []).forEach(row => {
      if (!sameMarket(row,selected.market) || !isApExpense(row)) return;
      const date=rowDate(row);
      if (!date) return;
      const rowYear=date.getUTCFullYear();
      const rowMonth=date.getUTCMonth()+1;
      if (targetMonth && rowMonth !== targetMonth) return;
      const period=smPeriod(field(row,['Period','Scenario']));
      const amount=Math.abs(number(field(row,['Amount','Value','Actual Value','Budget Value'])));
      if (rowYear === targetYear && period === 'actual') { totals.actual+=amount; matched+=1; }
      if (rowYear === targetYear && period === 'budget') { totals.budget+=amount; matched+=1; }
      if ((rowYear === targetYear || rowYear === targetYear-1) && period === 'ly') explicitLy+=amount;
      if (rowYear === targetYear-1 && period === 'actual') priorActual+=amount;
    });
    totals.ly=Math.abs(explicitLy)>1e-9 ? explicitLy : priorActual;
    totals.count=matched;
    return totals;
  }

  function formatAmount(value,sourceCurrency) {
    let amount=Number(value)||0;
    if (sourceCurrency === 'USD' && state.currency === 'JOD') amount*=USD_TO_JOD;
    if (sourceCurrency === 'JOD' && state.currency === 'USD') amount/=USD_TO_JOD;
    amount/=1000;
    const rounded=Math.round(amount*10)/10;
    const absolute=Math.abs(rounded).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:1});
    return rounded < 0 ? `(${absolute})` : absolute;
  }

  function formatPercent(numerator,denominator,sourceCurrency) {
    let comparableNumerator=numerator;
    if (sourceCurrency === 'JOD') comparableNumerator/=USD_TO_JOD;
    if (!denominator) return '—';
    return `${(comparableNumerator/denominator*100).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  }

  function fillSelect(select,values,selected) {
    if (!select) return;
    select.innerHTML=(values || []).map(value =>
      `<option value="${String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`
    ).join('');
    if (selected) select.value=selected;
  }

  function render() {
    if (!state.data) return;
    const {sales,ap,selected}=state.data;
    const rows=[
      ['IMS Sales Private',sales,'USD','amount'],
      ['A&P Expenses',ap,'JOD','amount'],
      ['A&P %',{
        actual:[ap.actual,sales.actual],
        budget:[ap.budget,sales.budget],
        ly:[ap.ly,sales.ly]
      },'JOD','percent']
    ];
    const tbody=byId('marketsApTable')?.tBodies?.[0];
    if (!tbody) return;
    tbody.innerHTML=rows.map(([label,values,sourceCurrency,type]) => {
      const cells=['actual','budget','ly'].map(period => {
        const value=type === 'percent'
          ? formatPercent(values[period][0],values[period][1],sourceCurrency)
          : formatAmount(values[period],sourceCurrency);
        return `<td${type === 'percent' ? ' class="markets-ap-percent"' : ''}>${value}</td>`;
      }).join('');
      return `<tr><th scope="row">${label}</th>${cells}</tr>`;
    }).join('');

    const status=byId('marketsApStatus');
    if (status) {
      status.textContent=`${selected.market} · ${selected.month} ${selected.year} · ${state.currency} '000`;
      status.className='markets-ap-status ready';
    }
    const note=byId('marketsApMappingNote');
    if (note) {
      note.hidden=ap.count>0;
      note.textContent=ap.count>0 ? '' : 'No A&P rows were matched in S&M for this market and period. Confirm the A&P expense mapping before relying on the percentage.';
    }
  }

  async function load(requested={}) {
    if (state.loading || typeof window.BREnsureMarketsAPData !== 'function') return;
    state.loading=true;
    const request=++state.request;
    const status=byId('marketsApStatus');
    if (status) {
      status.textContent='Loading the selected market…';
      status.className='markets-ap-status loading';
    }
    try {
      const result=await window.BREnsureMarketsAPData(requested);
      if (request !== state.request) return;
      fillSelect(byId('marketsApMarketFilter'),result.options.markets,result.selected.market);
      fillSelect(byId('marketsApYearFilter'),result.options.years,result.selected.year);
      fillSelect(byId('marketsApMonthFilter'),result.options.months,result.selected.month);
      state.data={
        selected:result.selected,
        sales:aggregateSales(result.sales,result.selected),
        ap:aggregateAp(result.sm,result.selected)
      };
      render();
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent=error?.message || 'Unable to load Markets A&P.';
        status.className='markets-ap-status error';
      }
    } finally {
      state.loading=false;
    }
  }

  window.mountMarketsAPReport = () => load({
    market:byId('marketsApMarketFilter')?.value,
    year:byId('marketsApYearFilter')?.value,
    month:byId('marketsApMonthFilter')?.value
  });

  document.querySelectorAll('[data-markets-ap-currency]').forEach(button => {
    button.addEventListener('click',() => {
      state.currency=button.dataset.marketsApCurrency === 'JOD' ? 'JOD' : 'USD';
      document.querySelectorAll('[data-markets-ap-currency]').forEach(option => {
        const active=option.dataset.marketsApCurrency === state.currency;
        option.classList.toggle('active',active);
        option.setAttribute('aria-pressed',String(active));
      });
      render();
    });
  });

  ['marketsApMarketFilter','marketsApYearFilter','marketsApMonthFilter'].forEach(id => {
    byId(id)?.addEventListener('change',() => load({
      market:byId('marketsApMarketFilter')?.value,
      year:byId('marketsApYearFilter')?.value,
      month:byId('marketsApMonthFilter')?.value
    }));
  });

  document.querySelector('[data-mda-report="markets-ap"]')?.addEventListener('click',() => {
    window.mountMarketsAPReport();
  });
})();
