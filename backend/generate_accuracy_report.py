"""
Road Guardian AI — Model Accuracy PDF Report Generator
Generates a professional multi-section PDF with all training metrics.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "Road_Guardian_AI_Model_Accuracy_Report.pdf")

# ── Palette ──────────────────────────────────────────────────────────────────
NAVY      = colors.HexColor("#0D1B2A")
BLUE      = colors.HexColor("#1565C0")
LIGHT_BLU = colors.HexColor("#E3F2FD")
TEAL      = colors.HexColor("#00838F")
GREEN     = colors.HexColor("#2E7D32")
AMBER     = colors.HexColor("#F57F17")
RED       = colors.HexColor("#C62828")
WHITE     = colors.white
GREY_BG   = colors.HexColor("#F5F5F5")
GREY_LINE = colors.HexColor("#BDBDBD")

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2.5*cm,
        title="Road Guardian AI — Model Accuracy Report"
    )

    styles = getSampleStyleSheet()
    story  = []

    # ── Custom paragraph styles ───────────────────────────────────────────────
    title_style = ParagraphStyle(
        "Title", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=22,
        textColor=WHITE, alignment=TA_CENTER,
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontName="Helvetica", fontSize=11,
        textColor=colors.HexColor("#B0BEC5"), alignment=TA_CENTER,
        spaceAfter=2
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=13,
        textColor=BLUE, spaceBefore=14, spaceAfter=6
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9.5,
        textColor=colors.HexColor("#212121"),
        leading=14, spaceAfter=4
    )
    caption_style = ParagraphStyle(
        "Caption", parent=styles["Normal"],
        fontName="Helvetica-Oblique", fontSize=8,
        textColor=colors.HexColor("#757575"),
        alignment=TA_CENTER, spaceBefore=2
    )

    # ══ HEADER BANNER ════════════════════════════════════════════════════════
    header_data = [[
        Paragraph("🛣  Road Guardian AI", title_style),
    ]]
    header_table = Table(header_data, colWidths=[16.5*cm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), NAVY),
        ("TOPPADDING",    (0,0), (-1,-1), 18),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 12),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(header_table)

    subtitle_data = [[
        Paragraph("YOLOv8n Pothole Detection Model — Accuracy & Performance Report", subtitle_style),
        Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}", subtitle_style),
    ]]
    sub_table = Table(subtitle_data, colWidths=[10*cm, 6.5*cm])
    sub_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), NAVY),
        ("BOTTOMPADDING", (0,0), (-1,-1), 18),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 12),
    ]))
    story.append(sub_table)
    story.append(Spacer(1, 0.5*cm))

    # ══ SECTION 1 — MODEL OVERVIEW ═══════════════════════════════════════════
    story.append(Paragraph("1.  Model Overview", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREY_LINE))
    story.append(Spacer(1, 0.2*cm))

    overview_data = [
        ["Property", "Value"],
        ["Architecture",         "YOLOv8 Nano (YOLOv8n)"],
        ["Base Pre-trained Weights", "yolov8n.pt  (COCO)"],
        ["Training Strategy",    "Transfer Learning  (pretrained=True)"],
        ["Training Epochs",      "30  (converged)"],
        ["Input Resolution",     "640 × 640 pixels"],
        ["Total Parameters",     "3,011,043"],
        ["Computational Cost",   "8.2 GFLOPs"],
        ["Layers",               "130"],
        ["Training Device",      "CPU"],
        ["Ultralytics Version",  "8.4.23"],
        ["Training Completed",   "18 March 2026"],
        ["Confidence Threshold", "≥ 60%  (live inference)"],
        ["IoU Threshold (NMS)",  "0.70"],
    ]

    col_w = [6.5*cm, 10*cm]
    t = Table(overview_data, colWidths=col_w)
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0),  BLUE),
        ("TEXTCOLOR",    (0,0), (-1,0),  WHITE),
        ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,0),  10),
        ("ALIGN",        (0,0), (-1,-1), "LEFT"),
        ("FONTNAME",     (0,1), (0,-1),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,1), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GREY_BG]),
        ("GRID",         (0,0), (-1,-1), 0.4, GREY_LINE),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(t)

    # ══ SECTION 2 — FINAL VALIDATION METRICS ═════════════════════════════════
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("2.  Final Validation Metrics  (Best Checkpoint — Epoch 29)", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREY_LINE))
    story.append(Spacer(1, 0.2*cm))

    story.append(Paragraph(
        "The table below shows the metrics recorded on the <b>held-out validation set</b> at the "
        "best checkpoint epoch. mAP50 is the primary accuracy metric used in the object-detection "
        "community and represents mean Average Precision at 50 % Intersection-over-Union (IoU) overlap.",
        body_style
    ))
    story.append(Spacer(1, 0.25*cm))

    val_data = [
        ["Metric", "Value", "Interpretation"],
        ["Precision",      "79.6 %", "Of every predicted pothole, 79.6 % were correct (true positives)"],
        ["Recall",         "67.3 %", "Of all real potholes, the model successfully detected 67.3 %"],
        ["mAP @ 50",       "77.2 %", "Primary accuracy: avg precision across all IoU ≥ 0.50 thresholds"],
        ["mAP @ 50–95",    "49.8 %", "Strict accuracy: avg across IoU 0.50 → 0.95 (industry standard)"],
        ["Val Box Loss",   "1.302",  "Bounding-box regression loss (lower = better localisation)"],
        ["Val Cls Loss",   "1.083",  "Classification loss (lower = fewer misclassifications)"],
        ["Val DFL Loss",   "1.301",  "Distribution Focal Loss for box coordinate refinement"],
        ["Fitness Score",  "0.498",  "Composite weighted score used to select the best checkpoint"],
    ]

    col_w2 = [3.5*cm, 2.5*cm, 10.5*cm]
    t2 = Table(val_data, colWidths=col_w2)
    t2.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0),  TEAL),
        ("TEXTCOLOR",    (0,0), (-1,0),  WHITE),
        ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,0),  10),
        ("ALIGN",        (0,0), (-1,-1), "LEFT"),
        ("FONTNAME",     (0,1), (0,-1),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,1), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GREY_BG]),
        ("GRID",         (0,0), (-1,-1), 0.4, GREY_LINE),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        # Highlight key accuracy rows
        ("BACKGROUND",   (0,3), (-1,3),  colors.HexColor("#E8F5E9")),
        ("TEXTCOLOR",    (1,3), (1,3),   GREEN),
        ("FONTNAME",     (1,3), (1,3),   "Helvetica-Bold"),
        ("BACKGROUND",   (0,4), (-1,4),  colors.HexColor("#E8F5E9")),
        ("TEXTCOLOR",    (1,4), (1,4),   GREEN),
        ("FONTNAME",     (1,4), (1,4),   "Helvetica-Bold"),
    ]))
    story.append(t2)

    # ══ SECTION 3 — TRAINING PROGRESSION ═════════════════════════════════════
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("3.  Training Progression  (Epoch-by-Epoch Key Milestones)", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREY_LINE))
    story.append(Spacer(1, 0.2*cm))

    prog_data = [
        ["Epoch", "mAP@50", "mAP@50-95", "Precision", "Recall", "Note"],
        ["1",  "25.2 %", "12.9 %", "48.6 %", "24.4 %", "Baseline — random init from pretrained"],
        ["5",  "14.8 %", " 5.8 %", "26.1 %", "22.7 %", "Warm-up instability"],
        ["10", "60.2 %", "32.7 %", "74.5 %", "49.6 %", "Rapid learning phase"],
        ["15", "73.8 %", "43.6 %", "77.1 %", "63.3 %", "Model stabilising"],
        ["20", "71.2 %", "43.4 %", "66.6 %", "69.1 %", "High recall, precision fluctuating"],
        ["24", "77.2 %", "46.8 %", "82.7 %", "64.2 %", "Near-peak performance"],
        ["25", "74.8 %", "47.1 %", "78.2 %", "65.3 %", "Slight dip — LR annealing"],
        ["29", "77.2 %", "49.8 %", "79.6 %", "67.3 %", "✅ BEST checkpoint saved"],
        ["30", "77.5 %", "49.8 %", "83.0 %", "66.1 %", "Final epoch — marginal gain"],
    ]

    col_w3 = [1.5*cm, 2*cm, 2.5*cm, 2.2*cm, 2*cm, 6.3*cm]
    t3 = Table(prog_data, colWidths=col_w3)
    t3.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0),  NAVY),
        ("TEXTCOLOR",    (0,0), (-1,0),  WHITE),
        ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,0),  9),
        ("ALIGN",        (0,0), (-1,-1), "CENTER"),
        ("ALIGN",        (5,1), (5,-1),  "LEFT"),
        ("FONTNAME",     (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",     (0,1), (-1,-1), 8.5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GREY_BG]),
        ("GRID",         (0,0), (-1,-1), 0.4, GREY_LINE),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 6),
        # Highlight best checkpoint row
        ("BACKGROUND",   (0,8), (-1,8),  colors.HexColor("#E8F5E9")),
        ("FONTNAME",     (0,8), (-1,8),  "Helvetica-Bold"),
        ("TEXTCOLOR",    (5,8), (5,8),   GREEN),
    ]))
    story.append(t3)
    story.append(Paragraph(
        "Table 3 — Key epoch milestones extracted from the training checkpoint. "
        "Full 30-epoch data available in the training run logs.",
        caption_style
    ))

    # ══ SECTION 4 — TRAINING CONFIGURATION ═══════════════════════════════════
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("4.  Training Hyperparameters", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREY_LINE))
    story.append(Spacer(1, 0.2*cm))

    hyp_data = [
        ["Parameter", "Value", "Parameter", "Value"],
        ["Batch size",       "16",       "Optimizer",         "Auto (AdamW)"],
        ["Learning rate (lr0)", "0.01",  "LR final (lrf)",    "0.01"],
        ["Momentum",         "0.937",    "Weight decay",      "0.0005"],
        ["Warmup epochs",    "3",        "Warmup momentum",   "0.8"],
        ["Mosaic augment",   "1.0  (on)","Flip LR",           "0.5"],
        ["Scale",            "0.5",      "Translate",         "0.1"],
        ["HSV Hue",          "0.015",    "HSV Saturation",    "0.7"],
        ["HSV Value",        "0.4",      "Erasing",           "0.4"],
        ["Box loss weight",  "7.5",      "Cls loss weight",   "0.5"],
        ["DFL loss weight",  "1.5",      "Close mosaic epoch","10"],
        ["AMP (mixed prec.)", "True",    "Seed",              "0"],
    ]

    col_w4 = [4*cm, 3*cm, 4*cm, 5.5*cm]
    t4 = Table(hyp_data, colWidths=col_w4)
    t4.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0),  colors.HexColor("#37474F")),
        ("TEXTCOLOR",    (0,0), (-1,0),  WHITE),
        ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,0),  9),
        ("ALIGN",        (0,0), (-1,-1), "LEFT"),
        ("FONTNAME",     (0,1), (0,-1),  "Helvetica-Bold"),
        ("FONTNAME",     (2,1), (2,-1),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,1), (-1,-1), 8.5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GREY_BG]),
        ("GRID",         (0,0), (-1,-1), 0.4, GREY_LINE),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(t4)

    # ══ SECTION 5 — INFERENCE SETTINGS ═══════════════════════════════════════
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("5.  Live Inference Configuration", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREY_LINE))
    story.append(Spacer(1, 0.2*cm))

    inf_data = [
        ["Setting", "Value", "Effect"],
        ["Model format",       "ONNX (OpenCV DNN)",    "Lightweight, no PyTorch needed at runtime"],
        ["Fallback model",     ".pt via Ultralytics",  "Used if ONNX loading fails"],
        ["Confidence threshold","≥ 60 %",              "Only high-confidence detections accepted"],
        ["IoU NMS threshold",  "0.70",                 "Non-max suppression aggressiveness"],
        ["Accepted classes",   "pothole, damage, crack","Other classes are filtered out"],
        ["Min bbox size",      "> 0 × 0 px",           "Degenerate boxes discarded"],
        ["Image validation",   "≥ 100 × 100 px",       "Blurry/tiny uploads rejected"],
        ["Deduplication",      "pHash + GPS proximity","Prevents duplicate hazard records"],
    ]

    col_w5 = [4*cm, 4*cm, 8.5*cm]
    t5 = Table(inf_data, colWidths=col_w5)
    t5.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0),  colors.HexColor("#4A148C")),
        ("TEXTCOLOR",    (0,0), (-1,0),  WHITE),
        ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,0),  9),
        ("ALIGN",        (0,0), (-1,-1), "LEFT"),
        ("FONTNAME",     (0,1), (0,-1),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,1), (-1,-1), 8.5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GREY_BG]),
        ("GRID",         (0,0), (-1,-1), 0.4, GREY_LINE),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(t5)

    # ══ SECTION 6 — IMPROVEMENT RECOMMENDATIONS ══════════════════════════════
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("6.  Recommendations for Accuracy Improvement", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREY_LINE))
    story.append(Spacer(1, 0.2*cm))

    recs = [
        ["#", "Recommendation", "Expected Gain"],
        ["1", "Train for 50–100 epochs (model still improving at epoch 30)", "+2–4 % mAP"],
        ["2", "Switch to YOLOv8s or YOLOv8m (larger backbone)", "+5–10 % mAP"],
        ["3", "Train on GPU with larger batch size (32–64)", "Faster + better augmentation"],
        ["4", "Add night/rain/wet-road images to dataset", "Better real-world robustness"],
        ["5", "Use CutMix / MixUp augmentation (currently off)", "+1–2 % mAP"],
        ["6", "Lower confidence threshold to 0.45 to increase recall", "+8 % recall"],
    ]
    col_w6 = [1*cm, 9.5*cm, 6*cm]
    t6 = Table(recs, colWidths=col_w6)
    t6.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0),  AMBER),
        ("TEXTCOLOR",    (0,0), (-1,0),  NAVY),
        ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,0),  9),
        ("ALIGN",        (0,0), (0,-1),  "CENTER"),
        ("ALIGN",        (1,0), (-1,-1), "LEFT"),
        ("FONTNAME",     (0,1), (0,-1),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,1), (-1,-1), 8.5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GREY_BG]),
        ("GRID",         (0,0), (-1,-1), 0.4, GREY_LINE),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(t6)

    # ══ FOOTER ═══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 0.6*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_LINE))
    story.append(Spacer(1, 0.15*cm))
    footer_style = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontName="Helvetica", fontSize=8,
        textColor=colors.HexColor("#9E9E9E"), alignment=TA_CENTER
    )
    story.append(Paragraph(
        f"Road Guardian AI  •  YOLOv8n Pothole Detection Model  •  Accuracy Report  •  "
        f"Generated {datetime.now().strftime('%d %B %Y')}  •  Confidential",
        footer_style
    ))

    doc.build(story)
    print(f"[OK] PDF saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
