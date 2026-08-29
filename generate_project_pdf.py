from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

src = Path('PROJECT_DOCUMENTATION.md')
doc_text = src.read_text(encoding='utf-8')
lines = doc_text.splitlines()

pdf_path = Path('Road_Guardian_AI_Project_Documentation.pdf')
page = canvas.Canvas(str(pdf_path), pagesize=A4)
width, height = A4
margin = 50
line_height = 16
y_pos = height - 50

for raw in lines:
    if not raw.strip():
        y_pos -= line_height
        continue

    if raw.startswith('# '):
        page.setFont('Helvetica-Bold', 18)
        text = raw[2:120]
    elif raw.startswith('## '):
        page.setFont('Helvetica-Bold', 14)
        text = raw[3:120]
    elif raw.startswith('### '):
        page.setFont('Helvetica-Bold', 12)
        text = raw[4:120]
    elif raw.startswith('- ') or raw.startswith('* '):
        page.setFont('Helvetica', 10)
        text = '  ' + raw[2:120]
    else:
        page.setFont('Helvetica', 10)
        text = raw[:120]

    page.drawString(margin, y_pos, text)
    y_pos -= line_height

    if y_pos < 60:
        page.showPage()
        y_pos = height - 50

page.save()
print(f'PDF created: {pdf_path.resolve()}')
