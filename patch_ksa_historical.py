from pathlib import Path
import re

script_path = Path('script.js')
text = script_path.read_text(encoding='utf-8')

old = """function renderStockLevel(){
  const table=$('stockTable');
  if(!table) return;
  const rows=filteredStockRows();
  const {data:countries,totals}=stockAggregateRows(rows,'Country','Unassigned Market');

  $('stockCount').textContent=`${countries.length.toLocaleString('en-US')} markets`;
"""

new = """function renderStockLevel(){
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
"""

if old not in text:
    raise SystemExit('renderStockLevel target block not found')

script_path.write_text(text.replace(old,new,1),encoding='utf-8')

index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
html = re.sub(r'script\.js(?:\?v=[^"\']+)?','script.js?v=20260806-26',html,count=1)
html = re.sub(r'ksa-historical-stock-restore\.js(?:\?v=[^"\']+)?','ksa-historical-stock-restore.js?v=20260806-3',html,count=1)
html = re.sub(r'firebase-client\.js(?:\?v=[^"\']+)?','firebase-client.js?v=20260806-16',html,count=1)
index_path.write_text(html,encoding='utf-8')
