from pathlib import Path
import re

script_path = Path('script.js')
text = script_path.read_text(encoding='utf-8')

text = re.sub(
    r"\nconst PNL_KSA_FOC_COMPENSATION_USD = 174;\n\nfunction pnlIsSaudiOnlyScope\(\)\{.*?\n\}\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)

text = text.replace(
    "  const showKsaFocCompensation=pnlIsSaudiOnlyScope();\n",
    "",
    1,
)

text = text.replace(
    "  if (count) count.textContent = `${visibleLines.length+(showKsaFocCompensation?1:0)} P&L lines`;",
    "  if (count) count.textContent = `${visibleLines.length} P&L lines`;",
    1,
)

text, removed = re.subn(
    r"\n  if\(showKsaFocCompensation\)\{.*?\n  \}\n\n  const ratioRows = \[",
    "\n\n  const ratioRows = [",
    text,
    count=1,
    flags=re.S,
)

if removed != 1:
    raise SystemExit('KSA FOC compensation display block not found')

script_path.write_text(text, encoding='utf-8')

index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
html = re.sub(
    r'script\.js(?:\?v=[^"\']+)?',
    'script.js?v=20260806-28',
    html,
    count=1,
)
index_path.write_text(html, encoding='utf-8')
