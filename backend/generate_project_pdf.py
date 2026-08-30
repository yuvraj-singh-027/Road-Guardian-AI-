import os
import datetime
from fpdf import FPDF

class ProjectPortfolioPDF(FPDF):
    def header(self):
        # Header banner
        self.set_fill_color(10, 15, 29) # Deep Navy
        self.rect(0, 0, 210, 35, 'F')
        
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(0, 230, 180) # Cyan accent
        self.cell(0, 10, "ROAD GUARDIAN AI - SYSTEM PORTFOLIO", ln=True, align="L")
        
        self.set_font("Helvetica", "", 9)
        self.set_text_color(200, 210, 225)
        self.cell(0, 5, "Urban Digital Twin, AI Perception, & Traffic Rerouting Platform", ln=True, align="L")
        self.ln(15)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Road Guardian AI Portfolio Document | Page {self.page_no()}/{{nb}}", align="C")

def build_portfolio_pdf(dest_path: str):
    pdf = ProjectPortfolioPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Info Box
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.set_text_color(15, 23, 42) # Slate 900
    now_str = datetime.datetime.now().strftime("%Y-%m-%d")
    pdf.cell(0, 6, "Platform Version: 2.0.0 (Production Core)", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, f"Date Compiled: {now_str}  |  Target: Municipal & Hackathon Review", ln=True)
    pdf.ln(5)

    # 1. Executive Summary
    pdf.set_fill_color(240, 244, 248)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "  1. Executive Summary", ln=True, fill=True)
    pdf.ln(3)

    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(40, 40, 40)
    summary_text = (
        "Road Guardian AI is an end-to-end smart city infrastructure monitoring platform designed to "
        "detect road hazards (potholes), evaluate local traffic conditions, analyze image report "
        "authenticity, and simulate regional detours using WebGL spatial maps. The platform serves "
        "both citizens (via hazard reporting) and municipal PWD/NHAI authorities (via analytics & "
        "detour planning tools) to accelerate city repairs and ensure road safety."
    )
    pdf.multi_cell(0, 5.5, summary_text)
    pdf.ln(5)

    # 2. Core Modules
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "  2. Core Sub-Systems & Architectural Layers", ln=True, fill=True)
    pdf.ln(3)

    modules = [
        ("AI Perception Scanner", "Powered by a custom-trained PyTorch YOLOv8 model targeting real-time pothole identification with bounding-box annotations."),
        ("MapTiler Digital Twin", "WebGL-powered vector map visualizing dynamic database records, reported pothole coordinate pins, and color-coded road risk segment corridors."),
        ("Authenticity Check Engine", "A 7-stage computer vision verification pipeline (checking EXIF data, GPS geotags, pHash duplicate matches, screen photo Fourier moire patterns, JPEG ELA splicing, and noise spectrum AI details) to reject fake citizen uploads."),
        ("Traffic Simulation Engine", "Allows municipal admins to trigger segment closures and simulate citywide capacity/volume redistribution on alternate routes."),
        ("Risk Calculator Engine", "Calculates a 0-100 multi-factor risk score by checking hazard severity, vehicle speeds, weather condition, traffic, and hospital/school proximity.")
    ]

    for title, desc in modules:
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 6, f"- {title}:", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(70, 70, 70)
        pdf.multi_cell(0, 5, desc)
        pdf.ln(2.5)
    pdf.ln(2.5)

    # 3. Tech Stack
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "  3. Technology Stack & Dependencies", ln=True, fill=True)
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(220, 230, 242)
    pdf.cell(50, 6, "Layer / Dependency", border=1, fill=True)
    pdf.cell(50, 6, "Technology Choice", border=1, fill=True)
    pdf.cell(90, 6, "Role in Platform", border=1, fill=True, ln=True)

    techs = [
        ("Backend Framework", "FastAPI (Python)", "High-performance async APIs & static routers"),
        ("Computer Vision Models", "YOLOv8 & OpenCV", "Pothole scanning & image manipulation checks"),
        ("Database Engine", "SQLite / MySQL", "Unified storage for report logs and telemetry"),
        ("Mapping SDK", "MapTiler GL JS", "Dynamic WebGL maps with vector styling layers"),
        ("Frontend UI Framework", "React 18 & Tailwind", "Dashboard panels & admin control portal"),
        ("Report Generation", "FPDF (Python)", "Executive municipal PDF audits compilation")
    ]

    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(40, 40, 40)
    for l, t, r in techs:
        pdf.cell(50, 6, l, border=1)
        pdf.cell(50, 6, t, border=1)
        pdf.cell(90, 6, r, border=1, ln=True)
    pdf.ln(6)

    # 4. Security & Maintenance Features
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "  4. Security, Deduplication & Maintenance", ln=True, fill=True)
    pdf.ln(3)

    pdf.set_font("Helvetica", "", 9.5)
    sec_text = (
        "1. Spatial-Temporal Deduplication: Rejects identical hazard logs submitted within 10 meters and "
        "2 hours of an active report to prevent spam.\n"
        "2. Admin Purge Controller: A passcode-protected municipal maintenance panel to securely wipe all database "
        "records and clean stored files.\n"
        "3. Live Sensor Geolocation: Browser checks query high-precision GPS sensors directly and output Degrees, "
        "Minutes, and Seconds (DMS) coordinates down to the decimal second."
    )
    pdf.multi_cell(0, 5.5, sec_text)
    pdf.ln(4)

    pdf.output(dest_path)
    print(f"[PDF Build]: Saved project portfolio to {dest_path}")

if __name__ == "__main__":
    import sys
    dest = sys.argv[1] if len(sys.argv) > 1 else "Road_Guardian_AI_Project_Portfolio.pdf"
    build_portfolio_pdf(dest)
