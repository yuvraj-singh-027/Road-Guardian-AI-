"""
Municipal Report Generator Module for Road Guardian AI
Generates downloadable, executive-ready PDF audit reports for municipal & government road authorities.
"""

from fpdf import FPDF
import datetime
from typing import Dict, List, Any

class MunicipalReportPDF(FPDF):
    def header(self):
        # Header banner
        self.set_fill_color(10, 15, 29) # Deep Navy
        self.rect(0, 0, 210, 32, 'F')
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(0, 230, 180) # Cyan
        self.cell(0, 10, "ROAD GUARDIAN AI - MUNICIPAL AUDIT REPORT", ln=True, align="L")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(200, 210, 225)
        self.cell(0, 5, "Real-Time Road Health Monitoring & Traffic Digital Twin System", ln=True, align="L")
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Official Municipal Audit Document | Page {self.page_no()}/{{nb}}", align="C")

def generate_pdf_report(
    detections_summary: Dict[str, Any],
    critical_segments: List[Dict[str, Any]],
    sim_data: Dict[str, Any] = None
) -> bytes:
    """
    Generates a PDF document as bytes for Streamlit st.download_button.
    """
    pdf = MunicipalReportPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Document Header Info Box
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ticket_id = f"AUDIT-RGAI-{datetime.datetime.now().strftime('%Y%m%d%H%M')}"
    
    pdf.cell(0, 7, f"Audit Ticket ID: {ticket_id}", ln=True)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.cell(0, 5, f"Date Generated: {now_str}  |  Authority: Municipal Works Department", ln=True)
    pdf.ln(4)

    # Section 1: Executive Summary
    pdf.set_fill_color(240, 244, 248)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "  1. Executive Road Health Summary", ln=True, fill=True)
    pdf.ln(3)

    pdf.set_font("Helvetica", "", 9.5)
    total_det = detections_summary.get("total", 0)
    high_sev = detections_summary.get("high_severity", 0)
    avg_risk = detections_summary.get("avg_risk", 0.0)
    crit_count = detections_summary.get("critical_count", 0)

    pdf.cell(95, 6, f"- Total Damage Detections: {total_det}", ln=False)
    pdf.cell(95, 6, f"- High Severity Hazards: {high_sev}", ln=True)
    pdf.cell(95, 6, f"- Average City Risk Score: {avg_risk:.1f} / 100", ln=False)
    pdf.cell(95, 6, f"- Critical Road Segments: {crit_count}", ln=True)
    pdf.ln(5)

    # Section 2: Priority Critical Road Segments
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "  2. Critical Priority Segments Flagged for Repair", ln=True, fill=True)
    pdf.ln(3)

    if critical_segments:
        # Table Header
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_fill_color(220, 230, 242)
        pdf.cell(45, 6, "Road Name", border=1, fill=True)
        pdf.cell(28, 6, "Status", border=1, fill=True)
        pdf.cell(25, 6, "Risk Score", border=1, fill=True)
        pdf.cell(27, 6, "Pothole Count", border=1, fill=True)
        pdf.cell(65, 6, "Recommended Action", border=1, fill=True, ln=True)

        pdf.set_font("Helvetica", "", 8)
        for seg in critical_segments[:5]:
            clean_name = str(seg.get("name", "N/A")).encode('ascii', 'ignore').decode('ascii')[:24]
            clean_status = str(seg.get("status", "N/A")).encode('ascii', 'ignore').decode('ascii')
            pdf.cell(45, 6, clean_name, border=1)
            pdf.cell(28, 6, clean_status, border=1)
            pdf.cell(25, 6, f"{seg.get('risk_score', 0)}/100", border=1)
            pdf.cell(27, 6, str(seg.get("potholes", 0)), border=1)
            pdf.cell(65, 6, "Emergency Repair & Detour Signage", border=1, ln=True)
    else:
        pdf.set_font("Helvetica", "", 9.5)
        pdf.cell(0, 6, "No critical segments currently flagged.", ln=True)
    pdf.ln(5)

    # Section 3: Traffic Intelligence & Repair Simulation
    if sim_data and "prediction_text" in sim_data:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_fill_color(240, 244, 248)
        pdf.cell(0, 7, "  3. Predictive Traffic Impact & Mitigation Plan", ln=True, fill=True)
        pdf.ln(3)

        pdf.set_font("Helvetica", "", 9)
        clean_pred = sim_data['prediction_text'].replace("**", "").encode('ascii', 'ignore').decode('ascii')
        pdf.multi_cell(0, 4.5, f"Simulation Analysis:\n{clean_pred}")
        pdf.ln(3)

        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Recommended Municipal Mitigation Actions:", ln=True)
        pdf.set_font("Helvetica", "", 8.5)
        for step in sim_data.get("mitigation_steps", []):
            clean_step = step.replace("🚦 ", "").replace("🚧 ", "").replace("🌙 ", "").encode('ascii', 'ignore').decode('ascii')
            pdf.cell(0, 5, f"  - {clean_step}", ln=True)

    # Signature block
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 8.5)
    pdf.cell(0, 4.5, "Report certified by Road Guardian AI Autonomous Surveillance Engine.", ln=True)
    pdf.cell(0, 4.5, "Official Copy - Submitted for Municipal Works & Urban Infrastructure Action.", ln=True)

    return bytes(pdf.output())
