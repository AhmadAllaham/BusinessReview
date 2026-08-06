from pathlib import Path
import re

script_path = Path('script.js')
text = script_path.read_text(encoding='utf-8')

old_helper = """function pnlLineValue(totals,line){
  if(line.key==='return'){
    return pnlNumber(totals.actualReturn)+pnlNumber(totals.expectedReturn);
  }
  return line.key==='cogs'
    ?pnlNumber(totals.actualCogs)+pnlNumber(totals.focCogs)
    :pnlNumber(totals[line.key]);
}

function renderPnlVertical() {
"""

new_helper = """function pnlLineValue(totals,line){
  if(line.key==='return'){
    return pnlNumber(totals.actualReturn)+pnlNumber(totals.expectedReturn);
  }
  return line.key==='cogs'
    ?pnlNumber(totals.actualCogs)+pnlNumber(totals.focCogs)
    :pnlNumber(totals[line.key]);
}

const PNL_KSA_FOC_COMPENSATION_USD = 174;

function pnlIsSaudiOnlyScope(){
  const selected=getSelected('pnlMarketFilter');
  if(selected.length!==1) return false;
  const identity=textIdentity(selected[0]).replace(/[^a-z0-9]+/g,'');
  return identity==='ksa'||identity==='saudi'||identity.includes('saudiarabia');
}

function renderPnlVertical() {
"""

if old_helper not in text:
    raise SystemExit('P&L helper target not found')
text = text.replace(old_helper,new_helper,1)

old_count = """  const visibleLines = pnlVisibleLines();
  const count = $('pnlCount');
  if (count) count.textContent = `${visibleLines.length} P&L lines`;
"""
new_count = """  const visibleLines = pnlVisibleLines();
  const showKsaFocCompensation=pnlIsSaudiOnlyScope();
  const count = $('pnlCount');
  if (count) count.textContent = `${visibleLines.length+(showKsaFocCompensation?1:0)} P&L lines`;
"""
if old_count not in text:
    raise SystemExit('P&L count target not found')
text = text.replace(old_count,new_count,1)

old_insert = """  });

  const ratioRows = [
"""
new_insert = """  });

  if(showKsaFocCompensation){
    const noteValue=PNL_KSA_FOC_COMPENSATION_USD*(pnlCurrency==='JOD'?PNL_USD_TO_JOD:1);
    html += pnlComparisonMode==='fyBudget' ? `
      <tr class="pnl-foc-compensation-note pnl-note-row">
        <td>FOC ( COMPASATION)</td>
        <td>${pnlFormat(noteValue)}</td>
        <td></td>
        <td></td>
      </tr>` : `
      <tr class="pnl-foc-compensation-note pnl-note-row">
        <td>FOC ( COMPASATION)</td>
        <td>${pnlFormat(noteValue)}</td>
        <td></td>
        <td colspan="2"></td>
        <td></td>
        <td colspan="2"></td>
      </tr>`;
  }

  const ratioRows = [
"""
if old_insert not in text:
    raise SystemExit('P&L note insertion target not found')
text = text.replace(old_insert,new_insert,1)

script_path.write_text(text,encoding='utf-8')

index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
html = re.sub(r'script\.js(?:\?v=[^"\']+)?','script.js?v=20260806-27',html,count=1)
html = re.sub(r'firebase-client\.js(?:\?v=[^"\']+)?','firebase-client.js?v=20260806-17',html,count=1)
index_path.write_text(html,encoding='utf-8')
