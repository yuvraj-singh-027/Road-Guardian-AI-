import streamlit as st
import pandas as pd
import os
import cv2
import time
from PIL import Image
import datetime
from pathlib import Path

try:
    import pydeck as pdk
except Exception:
    pdk = None

# --- IMPORT BACKEND MODULES ---
try:
    from risk_engine import calculate_road_risk
    from traffic_engine import get_default_city_network, simulate_traffic_rerouting
    from report_generator import generate_pdf_report
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from risk_engine import calculate_road_risk
    from traffic_engine import get_default_city_network, simulate_traffic_rerouting
    from report_generator import generate_pdf_report

# --- APP CONFIG ---
st.set_page_config(
    page_title="Road Guardian AI — Real-Time Road Health & Traffic Digital Twin",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- SESSION STATE INITIALIZATION ---
if "layout_mode" not in st.session_state:
    st.session_state.layout_mode = "Classic Sidebar"

if "bg_theme" not in st.session_state:
    st.session_state.bg_theme = "Midnight Cyber Glass"

if "team_symbol_type" not in st.session_state:
    st.session_state.team_symbol_type = "AI Shield Emblem"

# --- DYNAMIC BACKGROUND THEME CSS MAP ---
bg_css_map = {
    "Midnight Cyber Glass": """
        html, body, [data-testid="stAppViewContainer"] {
            background: linear-gradient(135deg, #0b1120 0%, #050811 50%, #0f172a 100%) !important;
            color: #f3f4f6;
        }
        .main { background-color: transparent !important; }
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #0f172a 0%, #070a12 100%) !important;
            border-right: 1px solid rgba(0, 230, 180, 0.25) !important;
        }
    """,
    "Titanium Dark Studio": """
        html, body, [data-testid="stAppViewContainer"] {
            background: linear-gradient(135deg, #131824 0%, #0a0d14 100%) !important;
            color: #f3f4f6;
        }
        .main { background-color: transparent !important; }
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #182030 0%, #0d121d 100%) !important;
            border-right: 1px solid rgba(129, 140, 248, 0.25) !important;
        }
    """,
    "Deep Slate Navy": """
        html, body, [data-testid="stAppViewContainer"] {
            background: linear-gradient(135deg, #0f172a 0%, #020617 100%) !important;
            color: #f8fafc;
        }
        .main { background-color: transparent !important; }
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
            border-right: 1px solid rgba(56, 189, 248, 0.25) !important;
        }
    """,
    "Cyber Emerald Sentinel": """
        html, body, [data-testid="stAppViewContainer"] {
            background: linear-gradient(135deg, #042419 0%, #020f0a 100%) !important;
            color: #ecfdf5;
        }
        .main { background-color: transparent !important; }
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #064e3b 0%, #022c22 100%) !important;
            border-right: 1px solid rgba(16, 185, 129, 0.3) !important;
        }
    """
}

current_bg_css = bg_css_map.get(st.session_state.bg_theme, bg_css_map["Midnight Cyber Glass"])

sidebar_visibility_css = """
[data-testid="stSidebar"], section[data-testid="stSidebar"] {
    display: none !important;
}
""" if st.session_state.layout_mode == "Top Navigation" else ""

# --- APPLY GLOBAL CUSTOM STYLING ---
st.markdown(f"""
    <style>
    {sidebar_visibility_css}
    {current_bg_css}

    /* Global Typography & Layout */
    html, body, [data-testid="stAppViewContainer"] {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    }}
    .block-container {{
        max-width: 95% !important;
        padding-top: 1.6rem !important;
        padding-bottom: 2.5rem !important;
    }}

    /* Sidebar Alignment & Premium Styling */
    [data-testid="stSidebar"] {{
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5) !important;
    }}
    [data-testid="stSidebarUserContent"] {{
        padding: 1.2rem 1.0rem !important;
    }}

    /* Sidebar Radio Navigation Alignment */
    [data-testid="stSidebar"] div[data-testid="stRadio"] > div[role="radiogroup"],
    [data-testid="stSidebar"] div[data-testid="stRadio"] > div {{
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        box-shadow: none !important;
        margin-bottom: 16px !important;
    }}

    [data-testid="stSidebar"] div[data-testid="stRadio"] label {{
        background: rgba(31, 41, 55, 0.4) !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
        border-radius: 10px !important;
        padding: 10px 16px !important;
        color: #9ca3af !important;
        font-weight: 600 !important;
        font-size: 0.9rem !important;
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
        transition: all 0.2s ease-in-out !important;
        margin-right: 0px !important;
    }}

    [data-testid="stSidebar"] div[data-testid="stRadio"] label:hover {{
        color: #ffffff !important;
        background: rgba(0, 230, 180, 0.12) !important;
        border-color: rgba(0, 230, 180, 0.3) !important;
    }}

    [data-testid="stSidebar"] div[data-testid="stRadio"] label[data-checked="true"],
    [data-testid="stSidebar"] div[data-testid="stRadio"] label:has(input:checked) {{
        background: linear-gradient(135deg, rgba(0, 230, 180, 0.25) 0%, rgba(56, 189, 248, 0.18) 100%) !important;
        border: 1px solid #00e6b4 !important;
        color: #00e6b4 !important;
        box-shadow: 0 0 12px rgba(0, 230, 180, 0.2) !important;
    }}

    [data-testid="stSidebar"] div[data-testid="stRadio"] input[type="radio"] {{
        display: none;
    }}

    /* Top Horizontal Radio Navigation Menu */
    div[data-testid="stRadio"] > div[role="radiogroup"],
    div[data-testid="stRadio"] > div {{
        background: rgba(17, 24, 39, 0.85);
        border: 1px solid rgba(0, 230, 180, 0.2);
        border-radius: 14px;
        padding: 8px 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-start;
        align-items: center;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
        margin-bottom: 24px;
    }}

    div[data-testid="stRadio"] label {{
        background: rgba(31, 41, 55, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 8px 18px !important;
        color: #9ca3af !important;
        font-weight: 600 !important;
        font-size: 0.88rem !important;
        cursor: pointer;
        transition: all 0.25s ease;
        margin-right: 0px !important;
    }}

    div[data-testid="stRadio"] label:hover {{
        color: #ffffff !important;
        background: rgba(0, 230, 180, 0.12);
        border-color: rgba(0, 230, 180, 0.3);
    }}

    div[data-testid="stRadio"] label[data-checked="true"],
    div[data-testid="stRadio"] label:has(input:checked) {{
        background: linear-gradient(135deg, rgba(0, 230, 180, 0.25) 0%, rgba(56, 189, 248, 0.18) 100%) !important;
        border: 1px solid #00e6b4 !important;
        color: #00e6b4 !important;
        box-shadow: 0 0 15px rgba(0, 230, 180, 0.25);
    }}

    div[data-testid="stRadio"] input[type="radio"] {{
        display: none;
    }}

    /* Metric Cards */
    [data-testid="stMetric"] {{
        background: rgba(17, 24, 39, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 18px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }}
    [data-testid="stMetricLabel"] {{
        font-size: 0.85rem !important;
        color: #9ca3af !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}
    [data-testid="stMetricValue"] {{
        color: #00e6b4 !important;
        font-weight: 800 !important;
    }}

    /* Feature & Section Cards */
    .gr-card {{
        background: linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
        border: 1px solid rgba(0, 230, 180, 0.2);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }}

    .gr-title {{
        font-size: 1.7rem;
        font-weight: 800;
        color: #00e6b4;
        margin-bottom: 4px;
        letter-spacing: -0.3px;
    }}

    .gr-subtitle {{
        font-size: 0.98rem;
        color: #38bdf8;
        font-weight: 600;
        margin-bottom: 14px;
    }}

    /* Feature Grid Tile */
    .feature-tile {{
        background: rgba(17, 24, 39, 0.7);
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 12px;
        padding: 20px;
        height: 100%;
    }}
    .feature-tile h4 {{
        color: #818cf8;
        margin-top: 0;
        margin-bottom: 8px;
        font-size: 1.05rem;
        font-weight: 700;
    }}

    /* Prediction Banner */
    .prediction-box {{
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-left: 5px solid #ef4444;
        border-radius: 14px;
        padding: 22px;
        font-size: 1.1rem;
        line-height: 1.6;
        color: #f9fafb;
        margin: 20px 0;
    }}

    /* Camera Control Box */
    .cam-box {{
        background: rgba(17, 24, 39, 0.9);
        border: 1px solid rgba(0, 230, 180, 0.3);
        border-radius: 16px;
        padding: 26px;
        text-align: center;
        margin: 20px 0;
    }}
    </style>
    """, unsafe_allow_html=True)

# --- FILE PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "pothole_data.csv")
POTHOLES_FOLDER = os.path.join(BASE_DIR, "potholes")
RUNS_DIR = os.path.join(BASE_DIR, "runs", "detect", "train2")
MODEL_PATH = os.path.join(RUNS_DIR, "weights", "best.pt")
LOGO_PATH = os.path.join(BASE_DIR, "logo.png")

# --- BRANDING LOGO EMBLEM RENDERER (NO TEAM NAME) ---
def render_team_symbol(symbol_type="AI Shield Emblem", size=48):
    if symbol_type == "Neural Network Emblem":
        return f"""
        <div style="display: flex; align-items: center; gap: 14px; padding: 4px 0;">
            <svg width="{size}" height="{size}" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="42" fill="url(#neural_grad)" stroke="#38bdf8" stroke-width="4"/>
                <circle cx="50" cy="30" r="8" fill="#00e6b4"/>
                <circle cx="30" cy="65" r="8" fill="#00e6b4"/>
                <circle cx="70" cy="65" r="8" fill="#00e6b4"/>
                <line x1="50" y1="30" x2="30" y2="65" stroke="#00e6b4" stroke-width="3"/>
                <line x1="50" y1="30" x2="70" y2="65" stroke="#00e6b4" stroke-width="3"/>
                <line x1="30" y1="65" x2="70" y2="65" stroke="#00e6b4" stroke-width="3"/>
                <defs>
                    <linearGradient id="neural_grad" x1="0" y1="0" x2="100" y2="100">
                        <stop stop-color="#0f172a"/><stop offset="1" stop-color="#1e1b4b"/>
                    </linearGradient>
                </defs>
            </svg>
            <div>
                <div style="font-size: 1.35rem; font-weight: 900; color: #f9fafb; letter-spacing: -0.5px; line-height: 1.1;">Road Guardian AI</div>
                <div style="font-size: 0.75rem; color: #38bdf8; font-weight: 700; letter-spacing: 0.5px;">Real-Time Road Health & Traffic Digital Twin</div>
            </div>
        </div>
        """
    elif symbol_type == "Corporate Emblem":
        return f"""
        <div style="display: flex; align-items: center; gap: 14px; padding: 4px 0;">
            <svg width="{size}" height="{size}" viewBox="0 0 100 100" fill="none">
                <rect x="15" y="15" width="70" height="70" rx="16" fill="url(#corp_grad)" stroke="#818cf8" stroke-width="4"/>
                <path d="M35 70L50 30L65 70" stroke="#00e6b4" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="40" y1="55" x2="60" y2="55" stroke="#00e6b4" stroke-width="4"/>
                <defs>
                    <linearGradient id="corp_grad" x1="0" y1="0" x2="100" y2="100">
                        <stop stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/>
                    </linearGradient>
                </defs>
            </svg>
            <div>
                <div style="font-size: 1.35rem; font-weight: 900; color: #f9fafb; letter-spacing: -0.5px; line-height: 1.1;">Road Guardian AI</div>
                <div style="font-size: 0.75rem; color: #818cf8; font-weight: 700; letter-spacing: 0.5px;">Real-Time Road Health & Traffic Digital Twin</div>
            </div>
        </div>
        """
    else: # AI Shield Emblem (Default)
        return f"""
        <div style="display: flex; align-items: center; gap: 14px; padding: 4px 0;">
            <svg width="{size}" height="{size}" viewBox="0 0 100 100" fill="none">
                <path d="M50 5L90 20V45C90 70 50 95 50 95C50 95 10 70 10 45V20L50 5Z" fill="url(#shield_grad)" stroke="#00e6b4" stroke-width="4"/>
                <path d="M50 25L65 38H58V65H42V38H35L50 25Z" fill="#00e6b4"/>
                <circle cx="50" cy="74" r="6" fill="#38bdf8"/>
                <defs>
                    <linearGradient id="shield_grad" x1="50" y1="5" x2="50" y2="95">
                        <stop stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/>
                    </linearGradient>
                </defs>
            </svg>
            <div>
                <div style="font-size: 1.35rem; font-weight: 900; color: #f9fafb; letter-spacing: -0.5px; line-height: 1.1;">Road Guardian AI</div>
                <div style="font-size: 0.75rem; color: #00e6b4; font-weight: 700; letter-spacing: 0.5px;">Real-Time Road Health & Traffic Digital Twin</div>
            </div>
        </div>
        """

# --- GPS HELPERS ---
def extract_gps_from_exif(uploaded_file_or_img):
    try:
        pil_img = uploaded_file_or_img if isinstance(uploaded_file_or_img, Image.Image) else Image.open(uploaded_file_or_img)
        exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if not exif:
            return None, None
        from PIL import ExifTags
        gps_info = {}
        for k, v in exif.items():
            if ExifTags.TAGS.get(k, k) == "GPSInfo":
                for gk in v:
                    gps_info[ExifTags.GPSTAGS.get(gk, gk)] = v[gk]
        if not gps_info:
            return None, None
        def _deg(v):
            return float(v[0]) + (float(v[1]) / 60.0) + (float(v[2]) / 3600.0)
        lat = _deg(gps_info["GPSLatitude"]) if "GPSLatitude" in gps_info else None
        if lat and gps_info.get("GPSLatitudeRef") != "N": lat = -lat
        lon = _deg(gps_info["GPSLongitude"]) if "GPSLongitude" in gps_info else None
        if lon and gps_info.get("GPSLongitudeRef") != "E": lon = -lon
        return lat, lon
    except Exception:
        return None, None

@st.cache_data(ttl=1800)
def get_default_gps():
    try:
        import geocoder
        g = geocoder.ip('me')
        if g.latlng and len(g.latlng) == 2:
            return float(g.latlng[0]), float(g.latlng[1])
    except Exception:
        pass
    return 28.6139, 77.2090

# --- DATA LOAD ---
@st.cache_data
def load_data():
    if not os.path.exists(CSV_FILE):
        return pd.DataFrame()
    try:
        df = pd.read_csv(CSV_FILE)
        if df.empty:
            return df
        if 'Time' not in df.columns:
            df = pd.read_csv(CSV_FILE, header=None)
            df.columns = ["Image", "Latitude", "Longitude", "Severity", "Confidence", "Time"]
        if 'Severity' in df.columns:
            df = df[df['Severity'] != 'Severity']
        df['Time'] = pd.to_datetime(df['Time'], errors='coerce')
        df['Confidence'] = pd.to_numeric(df['Confidence'], errors='coerce')
        df['lat_numeric'] = pd.to_numeric(df['Latitude'], errors='coerce')
        df['lon_numeric'] = pd.to_numeric(df['Longitude'], errors='coerce')
        def_lat, def_lon = get_default_gps()
        df['lat_numeric'] = df['lat_numeric'].fillna(def_lat)
        df['lon_numeric'] = df['lon_numeric'].fillna(def_lon)

        r_scores, r_statuses, r_badges = [], [], []
        for _, row in df.iterrows():
            sev = str(row.get('Severity', 'Medium'))
            conf = float(row.get('Confidence', 0.8)) if pd.notnull(row.get('Confidence')) else 0.8
            r = calculate_road_risk(severity=sev, confidence=conf)
            r_scores.append(r["score"])
            r_statuses.append(r["status"])
            r_badges.append(r["badge"])
        df['Risk_Score'] = r_scores
        df['Risk_Status'] = r_statuses
        df['Risk_Badge'] = r_badges
        return df
    except Exception as e:
        st.error(f"Data loading error: {e}")
        return pd.DataFrame()

df = load_data()

# --- MODEL CACHE ---
@st.cache_resource
def load_yolo_model():
    if os.path.exists(MODEL_PATH):
        try:
            from ultralytics import YOLO
            return YOLO(MODEL_PATH)
        except Exception:
            pass
    return None

yolo_model = load_yolo_model()

# --- NAVIGATION PAGES LIST ---
pages_list = [
    "Overview",
    "Road Risk Evaluator",
    "Digital Twin Map",
    "Traffic Simulator",
    "Live AI Perception",
    "Municipal Audit & PDF",
    "Data & Settings"
]

# --- NAVIGATION & LAYOUT CONTROLLER ---
if st.session_state.layout_mode == "Classic Sidebar":
    with st.sidebar:
        st.markdown(render_team_symbol(st.session_state.team_symbol_type, size=44), unsafe_allow_html=True)
        st.markdown("<div style='margin-bottom: 12px;'></div>", unsafe_allow_html=True)
        
        page = st.radio("Navigation Menu", pages_list)
        
        st.markdown("---")
        st.markdown("<div style='font-size:0.85rem; font-weight:700; color:#9ca3af; margin-bottom:8px; text-transform:uppercase;'>Sidebar Settings</div>", unsafe_allow_html=True)
        
        st.session_state.bg_theme = st.selectbox(
            "Background Color Theme",
            ["Midnight Cyber Glass", "Titanium Dark Studio", "Deep Slate Navy", "Cyber Emerald Sentinel"],
            index=["Midnight Cyber Glass", "Titanium Dark Studio", "Deep Slate Navy", "Cyber Emerald Sentinel"].index(st.session_state.bg_theme),
            key="sb_bg_select"
        )
        
        st.session_state.layout_mode = st.selectbox(
            "Navigation Layout Mode",
            ["Classic Sidebar", "Top Navigation"],
            index=0,
            key="sb_layout_select"
        )
        
        st.session_state.team_symbol_type = st.selectbox(
            "Brand Logo Emblem",
            ["AI Shield Emblem", "Neural Network Emblem", "Corporate Emblem"],
            index=["AI Shield Emblem", "Neural Network Emblem", "Corporate Emblem"].index(st.session_state.team_symbol_type if st.session_state.team_symbol_type in ["AI Shield Emblem", "Neural Network Emblem", "Corporate Emblem"] else "AI Shield Emblem"),
            key="sb_symbol_select"
        )
        
        st.markdown("---")
        st.markdown("<div style='font-size:0.8rem; color:#6b7280; text-align:center;'>AI Surveillance Engine: <b>Online</b></div>", unsafe_allow_html=True)
else: # Top Navigation Mode
    top_col1, top_col2, top_col3 = st.columns([3, 1, 1])
    with top_col1:
        st.markdown(render_team_symbol(st.session_state.team_symbol_type, size=48), unsafe_allow_html=True)
    with top_col2:
        st.session_state.bg_theme = st.selectbox(
            "Background Theme",
            ["Midnight Cyber Glass", "Titanium Dark Studio", "Deep Slate Navy", "Cyber Emerald Sentinel"],
            index=["Midnight Cyber Glass", "Titanium Dark Studio", "Deep Slate Navy", "Cyber Emerald Sentinel"].index(st.session_state.bg_theme),
            key="top_bg_select"
        )
    with top_col3:
        st.session_state.layout_mode = st.selectbox(
            "Layout Mode",
            ["Top Navigation", "Classic Sidebar"],
            index=0,
            key="top_layout_select"
        )
        
    st.markdown("<div style='margin-bottom: 12px;'></div>", unsafe_allow_html=True)
    page = st.radio(
        "Navigation Menu",
        pages_list,
        horizontal=True,
        label_visibility="collapsed"
    )

# ==========================================
# PAGE 1: OVERVIEW (FIRST VIEW WITH BRIEF EXECUTIVE EXPLANATION)
# ==========================================
if page == "Overview":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">Road Guardian AI</div>
            <div class="gr-subtitle">Real-Time Road Health & Traffic Digital Twin</div>
            <p style="color:#e5e7eb; font-size:1.05rem; line-height:1.65; margin-bottom:14px;">
                <b>Road Guardian AI</b> is an autonomous infrastructure surveillance and predictive traffic intelligence system. It transforms municipal road management from reactive repairs into proactive predictive maintenance by combining real-time computer vision with contextual risk analytics and a 3D city Digital Twin.
            </p>
            <div style="background: rgba(0, 230, 180, 0.06); border: 1px solid rgba(0, 230, 180, 0.2); border-radius: 12px; padding: 16px 20px; margin-top: 10px;">
                <div style="font-size: 0.95rem; font-weight: 700; color: #00e6b4; margin-bottom: 8px;">How Road Guardian AI Works:</div>
                <ul style="color: #9ca3af; font-size: 0.92rem; margin: 0; padding-left: 20px; line-height: 1.65;">
                    <li><b>Detects Surface Hazards:</b> Leverages custom YOLOv8 computer vision to identify potholes and road defects from live camera feeds or photo uploads with EXIF GPS geotagging.</li>
                    <li><b>Computes Contextual Risk (0–100):</b> Evaluates dynamic hazard scores by weighting defect severity against vehicle speed, traffic density, weather hazards, and school/hospital proximity.</li>
                    <li><b>Maps 3D Digital Twin:</b> Visualizes live citywide road health across WebGL 3D paths categorized into Healthy (0–25), Degraded (26–50), High Risk (51–75), and Critical (76–100) segments.</li>
                    <li><b>Simulates Traffic Rerouting:</b> Predicts road closure impacts during maintenance and forecasts exact percentage traffic volume shifts on surrounding detour routes.</li>
                </ul>
            </div>
        </div>
    """, unsafe_allow_html=True)

    # 4 Key Metric Summary Cards
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.metric("Total Detections", len(df) if not df.empty else 0)
    with m2:
        high_sev = len(df[df['Severity'] == 'High']) if not df.empty else 0
        st.metric("High Severity Hazards", high_sev)
    with m3:
        avg_risk = df['Risk_Score'].mean() if not df.empty and 'Risk_Score' in df.columns else 0.0
        st.metric("City Avg Risk Score", f"{avg_risk:.1f} / 100")
    with m4:
        critical_cnt = len(df[df['Risk_Status'] == 'Critical']) if not df.empty and 'Risk_Status' in df.columns else 0
        st.metric("Critical Priority Roads", critical_cnt)

    st.markdown("---")

    # 4 Feature Guide Tiles
    st.subheader("Key System Capabilities")
    t1, t2, t3, t4 = st.columns(4)
    with t1:
        st.markdown("""
            <div class="feature-tile">
                <h4>1. AI Vision Perception</h4>
                <p style="font-size:0.9rem; color:#9ca3af;">Detects potholes and surface damage in real time using YOLO computer vision with EXIF GPS geotagging.</p>
            </div>
        """, unsafe_allow_html=True)
    with t2:
        st.markdown("""
            <div class="feature-tile">
                <h4>2. Context Risk Score</h4>
                <p style="font-size:0.9rem; color:#9ca3af;">Evaluates a 0–100 Road Risk Score by combining defect severity with speed, weather, traffic, and proximity.</p>
            </div>
        """, unsafe_allow_html=True)
    with t3:
        st.markdown("""
            <div class="feature-tile">
                <h4>3. 3D Digital Twin Map</h4>
                <p style="font-size:0.9rem; color:#9ca3af;">Maps citywide road network health using WebGL 3D paths with color-coded risk levels.</p>
            </div>
        """, unsafe_allow_html=True)
    with t4:
        st.markdown("""
            <div class="feature-tile">
                <h4>4. Traffic Simulator</h4>
                <p style="font-size:0.9rem; color:#9ca3af;">Simulates road repairs and predicts exact percentage traffic volume shifts on surrounding detour routes.</p>
            </div>
        """, unsafe_allow_html=True)

    st.markdown("---")

    # Clean Map & Detections Chart
    if not df.empty:
        col_map, col_chart = st.columns([2, 1])
        with col_map:
            st.subheader("City Hazard Detection Map")
            map_data = df.dropna(subset=['lat_numeric', 'lon_numeric'])
            if not map_data.empty:
                v_lat = float(map_data['lat_numeric'].mean())
                v_lon = float(map_data['lon_numeric'].mean())

                c_map = {
                    "Healthy": [34, 197, 94, 210],
                    "Degraded": [234, 179, 8, 220],
                    "High Risk": [249, 115, 22, 230],
                    "Critical": [239, 68, 68, 245],
                }

                plot_df = map_data.copy()
                plot_df["color"] = plot_df["Risk_Status"].apply(lambda s: c_map.get(s, [148, 163, 184, 180]))
                plot_df["tooltip"] = plot_df.apply(
                    lambda r: f"{r.get('Image','')} | Severity: {r.get('Severity','')} | Risk: {r.get('Risk_Score','')}/100",
                    axis=1,
                )

                layer = pdk.Layer(
                    "ScatterplotLayer",
                    data=plot_df,
                    get_position='[lon_numeric, lat_numeric]',
                    get_color="color",
                    get_radius=16,
                    radius_units="'pixels'",
                    pickable=True,
                )

                deck = pdk.Deck(
                    map_style="road",
                    initial_view_state=pdk.ViewState(latitude=v_lat, longitude=v_lon, zoom=13),
                    layers=[layer],
                    tooltip={"text": "{tooltip}"},
                )

                st.pydeck_chart(deck, use_container_width=True)

        with col_chart:
            st.subheader("Hazard Severity Counts")
            st.bar_chart(df['Severity'].value_counts())

# ==========================================
# PAGE 2: ROAD RISK EVALUATOR
# ==========================================
elif page == "Road Risk Evaluator":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">Contextual Road Risk Score Evaluator</div>
            <div class="gr-subtitle">
                Computes a weighted 0–100 Road Risk Score combining damage severity with vehicle speed, traffic density, weather hazards, and school/hospital proximity.
            </div>
        </div>
    """, unsafe_allow_html=True)

    c1, c2, c3 = st.columns(3)
    with c1:
        sim_sev = st.selectbox("Pothole Severity Rating", ["Low", "Medium", "High", "Critical"], index=2)
        sim_speed = st.slider("Vehicle Speed (km/h)", 20, 120, 60, 5)
    with c2:
        sim_traffic = st.selectbox("Traffic Volume", ["Low", "Moderate", "High", "Congested"], index=1)
        sim_road = st.selectbox("Road Category", ["Expressway", "Arterial Road", "Collector Street", "Local Road"], index=1)
    with c3:
        sim_weather = st.selectbox("Weather Condition", ["Clear", "Rainy", "Foggy", "Snowy / Icy"], index=1)
        sim_prox = st.checkbox("Near School or Hospital Zone (<300m)", value=True)
        sim_count = st.slider("Defects Count in Segment", 1, 8, 2)

    risk_result = calculate_road_risk(
        severity=sim_sev,
        confidence=0.88,
        damage_count=sim_count,
        speed_kmh=sim_speed,
        traffic_density=sim_traffic,
        road_type=sim_road,
        weather=sim_weather,
        proximity_school_hospital=sim_prox
    )

    st.markdown("---")

    b_col1, b_col2 = st.columns([1, 2])
    with b_col1:
        st.markdown(f"""
            <div class="gr-card" style="text-align: center; border-color: {risk_result['color_hex']};">
                <div style="font-size: 0.85rem; color: #9ca3af; font-weight: 600; text-transform: uppercase;">CALCULATED ROAD RISK SCORE</div>
                <div style="font-size: 3.4rem; font-weight: 800; color: {risk_result['color_hex']}; margin: 10px 0;">
                    {risk_result['score']} <span style="font-size: 1.2rem; color: #9ca3af;">/ 100</span>
                </div>
                <div style="font-size: 1.1rem; font-weight: 700; color: {risk_result['color_hex']};">
                    {risk_result['status']} ({risk_result['badge']})
                </div>
            </div>
        """, unsafe_allow_html=True)

    with b_col2:
        st.subheader("Factor Weight Contribution Breakdown")
        for factor_name, score in risk_result["breakdown"].items():
            col_f1, col_f2 = st.columns([2, 3])
            with col_f1:
                st.write(f"**{factor_name}**")
            with col_f2:
                st.progress(min(1.0, score / 35.0))

# ==========================================
# PAGE 3: DIGITAL TWIN MAP
# ==========================================
elif page == "Digital Twin Map":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">City Digital Twin — Road Network Map</div>
            <div class="gr-subtitle">
                3D virtual graph network of city road segments categorized in real time:
                Healthy (0–25) | Degraded (26–50) | High Risk (51–75) | Critical (76–100)
            </div>
        </div>
    """, unsafe_allow_html=True)

    def_lat, def_lon = get_default_gps()
    network = get_default_city_network(def_lat, def_lon)
    net_df = pd.DataFrame(network)

    if pdk is not None:
        v_state = pdk.ViewState(latitude=def_lat, longitude=def_lon, zoom=13, pitch=40)
        p_layer = pdk.Layer(
            "PathLayer",
            data=net_df,
            get_path="path",
            get_color="rgba",
            width_scale=18,
            width_min_pixels=6,
            get_width=10,
            pickable=True,
            auto_highlight=True
        )
        deck = pdk.Deck(
            map_style="road",
            initial_view_state=v_state,
            layers=[p_layer],
            tooltip={"text": "{name}\nStatus: {badge}\nRisk Score: {risk_score}/100"}
        )
        st.pydeck_chart(deck, use_container_width=True)

    st.markdown("---")
    st.subheader("Segment Health Inspector")

    road_names = {f"{s['name']} ({s['badge']})": s['id'] for s in network}
    sel_name = st.selectbox("Select Road Segment to Inspect", list(road_names.keys()))
    sel_id = road_names[sel_name]
    s_data = next(s for s in network if s["id"] == sel_id)

    col_s1, col_s2, col_s3, col_s4 = st.columns(4)
    with col_s1:
        st.metric("Risk Score", f"{s_data['risk_score']} / 100")
    with col_s2:
        st.metric("Road Status", s_data['status'])
    with col_s3:
        st.metric("Potholes Count", s_data['potholes'])
    with col_s4:
        st.metric("Baseline Traffic", f"{s_data['base_traffic']} v/h")

# ==========================================
# PAGE 4: TRAFFIC SIMULATOR
# ==========================================
elif page == "Traffic Simulator":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">Predictive Traffic Rerouting Simulator</div>
            <div class="gr-subtitle">
                Predicts traffic volume shifts across alternate routes when a road segment is closed for repairs.
            </div>
        </div>
    """, unsafe_allow_html=True)

    def_lat, def_lon = get_default_gps()
    network = get_default_city_network(def_lat, def_lon)

    road_choices = {f"{s['name']} [{s['badge']}]": s['id'] for s in network}
    selected_label = st.selectbox("Select Damaged Road Segment to Close for Repair", list(road_choices.keys()))
    selected_road_id = road_choices[selected_label]

    sim_res = simulate_traffic_rerouting(selected_road_id, network)

    clean_pred_text = sim_res['prediction_text'].replace("🚨 ", "").replace("⚡ ", "")

    st.markdown(f"""
        <div class="prediction-box">
            <b>Predictive Traffic Impact Statement:</b><br><br>
            {clean_pred_text}
        </div>
    """, unsafe_allow_html=True)

    st.markdown("---")

    c_left, c_right = st.columns([3, 2])
    with c_left:
        st.subheader("Traffic Volume Before vs After Repair Closure")
        res_df = pd.DataFrame(sim_res["rerouting_data"])
        chart_df = res_df.set_index("name")[["base_traffic", "new_traffic"]]
        chart_df.columns = ["Before Closure", "After Rerouting"]
        st.bar_chart(chart_df)

    with c_right:
        st.subheader("Recommended Detour Actions")
        for step in sim_res["mitigation_steps"]:
            clean_step = step.replace("🚦 ", "").replace("🚧 ", "").replace("🌙 ", "")
            st.success(clean_step)

    st.markdown("---")
    st.subheader("Alternate Routes Impact Breakdown")
    clean_table = res_df[["name", "base_traffic", "new_traffic", "pct_increase", "congestion_level"]].copy()
    clean_table.columns = ["Alternate Road Name", "Normal Traffic (v/h)", "New Traffic (v/h)", "Traffic Increase (%)", "Congestion Alert"]
    clean_table["Traffic Increase (%)"] = clean_table["Traffic Increase (%)"].apply(lambda v: f"+{v}%")
    st.dataframe(clean_table, use_container_width=True)

# ==========================================
# PAGE 5: LIVE AI PERCEPTION
# ==========================================
elif page == "Live AI Perception":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">Live AI Camera Stream & Photo Capture</div>
            <div class="gr-subtitle">
                Run live webcam feed with real-time YOLO AI pothole detection overlay or capture photos on demand.
            </div>
        </div>
    """, unsafe_allow_html=True)

    if "camera_active" not in st.session_state:
        st.session_state.camera_active = False

    cam_tab1, cam_tab2 = st.tabs(["Live Webcam Stream", "Snapshot Upload / Capture"])

    with cam_tab1:
        st.markdown('<div class="cam-box">', unsafe_allow_html=True)
        st.write("### Camera Status Control")
        
        col_c_btn1, col_c_btn2 = st.columns(2)
        with col_c_btn1:
            if st.button("Start Camera Stream", type="primary", use_container_width=True):
                st.session_state.camera_active = True
        with col_c_btn2:
            if st.button("Stop Camera Stream", use_container_width=True):
                st.session_state.camera_active = False

        if st.session_state.camera_active:
            st.success("Camera Feed Active: Running YOLO detection...")
        else:
            st.info("Camera Feed is Inactive. Click 'Start Camera Stream' above to initiate detection.")
        
        st.markdown('</div>', unsafe_allow_html=True)

        if st.session_state.camera_active:
            frame_window = st.image([])
            cap = cv2.VideoCapture(0)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

            while cap.isOpened() and st.session_state.camera_active:
                ret, frame = cap.read()
                if not ret:
                    st.error("Unable to read from camera device.")
                    st.session_state.camera_active = False
                    break

                if yolo_model is not None:
                    results = yolo_model.predict(frame, imgsz=416, conf=0.5, verbose=False)
                    annotated_frame = results[0].plot()
                    annotated_frame = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
                    frame_window.image(annotated_frame, use_container_width=True)
                else:
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frame_window.image(frame_rgb, use_container_width=True)

                time.sleep(0.03)

            cap.release()

    with cam_tab2:
        st.subheader("Capture Snapshot from Camera")
        cam_photo = st.camera_input("Take a photo of the road")
        if cam_photo is not None:
            pil_img = Image.open(cam_photo).convert("RGB")
            st.image(pil_img, caption="Captured Frame", use_container_width=True)

            if st.button("Analyze & Log Captured Photo", type="primary"):
                Path(POTHOLES_FOLDER).mkdir(parents=True, exist_ok=True)
                ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                fname = f"camera_{ts}.jpg"
                out_p = os.path.join(POTHOLES_FOLDER, fname)

                sev = "Medium"
                conf = 0.80
                saved_img = pil_img

                if yolo_model is not None:
                    try:
                        results = yolo_model.predict(pil_img, imgsz=416, conf=0.5, verbose=False)
                        if results and len(results[0].boxes) > 0:
                            confs = [float(b.conf[0]) for b in results[0].boxes]
                            conf = max(confs)
                            sev = "High" if conf > 0.75 else ("Medium" if conf > 0.5 else "Low")
                            saved_img = Image.fromarray(results[0].plot()[..., ::-1])
                    except Exception as e:
                        st.error(f"YOLO error: {e}")

                saved_img.save(out_p, format="JPEG", quality=92)
                def_lat, def_lon = get_default_gps()

                import csv
                header_needed = not os.path.exists(CSV_FILE) or os.path.getsize(CSV_FILE) == 0
                with open(CSV_FILE, "a", newline="") as f:
                    w = csv.writer(f)
                    if header_needed:
                        w.writerow(["Image", "Latitude", "Longitude", "Severity", "Confidence", "Time"])
                    w.writerow([fname, str(def_lat), str(def_lon), sev, round(conf, 2), datetime.datetime.now().isoformat()])

                load_data.clear()
                r_info = calculate_road_risk(severity=sev, confidence=conf)
                st.success(f"Logged {fname} | Severity: {sev} | Road Risk Score: {r_info['score']}/100 ({r_info['badge']})")

# ==========================================
# PAGE 6: MUNICIPAL AUDIT & PDF
# ==========================================
elif page == "Municipal Audit & PDF":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">Municipal Audit & Government Data Portal</div>
            <div class="gr-subtitle">
                Export official inspection PDF audit reports and submit work orders to municipal authorities.
            </div>
        </div>
    """, unsafe_allow_html=True)

    def_lat, def_lon = get_default_gps()
    network = get_default_city_network(def_lat, def_lon)

    crit_segs = [s for s in network if s["status"] in ["Critical", "High Risk"]]
    det_summary = {
        "total": len(df) if not df.empty else 0,
        "high_severity": len(df[df['Severity'] == 'High']) if not df.empty else 0,
        "avg_risk": float(df['Risk_Score'].mean()) if not df.empty and 'Risk_Score' in df.columns else 0.0,
        "critical_count": len(crit_segs)
    }

    sim_data = simulate_traffic_rerouting(network[0]["id"], network)

    c_audit1, c_audit2 = st.columns(2)

    with c_audit1:
        st.subheader("Generate Municipal PDF Report")
        st.caption("Creates an executive-ready PDF audit document with summary metrics and risk assessment.")
        
        pdf_bytes = generate_pdf_report(det_summary, crit_segs, sim_data)
        st.download_button(
            label="Download Official Municipal PDF Report",
            data=pdf_bytes,
            file_name=f"Municipal_Road_Audit_{datetime.datetime.now().strftime('%Y%m%d')}.pdf",
            mime="application/pdf",
            type="primary",
            use_container_width=True
        )

    with c_audit2:
        st.subheader("Submit Work Order to Government Portal")
        st.caption("Simulates transmitting API payload ticket to the Department of Municipal Infrastructure.")
        
        target_dept = st.selectbox("Target Authority", ["Municipal Public Works Department", "Department of Urban Transportation", "Highway Safety Authority"])
        if st.button("Transmit Work Order API Payload", use_container_width=True):
            ticket_ref = f"TICKET-MUNI-{datetime.datetime.now().strftime('%Y%m%d%H%M')}"
            st.success(f"Work Order {ticket_ref} transmitted to {target_dept}! Priority Level: High")
            st.json({
                "ticket_id": ticket_ref,
                "department": target_dept,
                "status": "Transmitted",
                "flagged_segments": len(crit_segs),
                "timestamp": datetime.datetime.now().isoformat()
            })

# ==========================================
# PAGE 7: DATA & SETTINGS
# ==========================================
elif page == "Data & Settings":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">Data & System Settings</div>
            <div class="gr-subtitle">Manage detection datasets, background themes, and visual branding settings.</div>
        </div>
    """, unsafe_allow_html=True)

    set_col1, set_col2 = st.columns(2)
    with set_col1:
        st.subheader("Visual Theme & Branding Settings")
        st.session_state.bg_theme = st.selectbox(
            "Background Color Theme",
            ["Midnight Cyber Glass", "Titanium Dark Studio", "Deep Slate Navy", "Cyber Emerald Sentinel"],
            index=["Midnight Cyber Glass", "Titanium Dark Studio", "Deep Slate Navy", "Cyber Emerald Sentinel"].index(st.session_state.bg_theme),
            key="sett_bg_select"
        )
        st.session_state.team_symbol_type = st.selectbox(
            "Brand Logo Emblem",
            ["AI Shield Emblem", "Neural Network Emblem", "Corporate Emblem"],
            index=["AI Shield Emblem", "Neural Network Emblem", "Corporate Emblem"].index(st.session_state.team_symbol_type if st.session_state.team_symbol_type in ["AI Shield Emblem", "Neural Network Emblem", "Corporate Emblem"] else "AI Shield Emblem"),
            key="sett_symbol_select"
        )
        st.session_state.layout_mode = st.selectbox(
            "Navigation Layout Mode",
            ["Classic Sidebar", "Top Navigation"],
            index=0 if st.session_state.layout_mode == "Classic Sidebar" else 1,
            key="sett_layout_select"
        )

    with set_col2:
        st.subheader("Brand Logo Preview")
        st.markdown(render_team_symbol(st.session_state.team_symbol_type, size=64), unsafe_allow_html=True)

    st.markdown("---")

    if not df.empty:
        st.subheader("Detection Dataset")
        exp_df = df.drop(columns=['lat_numeric', 'lon_numeric'], errors='ignore')
        st.dataframe(exp_df, use_container_width=True)
        csv_data = exp_df.to_csv(index=False).encode('utf-8')
        st.download_button("Download Detection Log CSV", data=csv_data, file_name='pothole_data.csv', mime='text/csv')

    st.markdown("---")
    st.subheader("Clear / Reset Data Option")
    st.caption("Warning: Clearing data will remove all entries in pothole_data.csv and clear captured pothole images.")

    confirm_clear = st.checkbox("I confirm I want to reset all dataset logs and stored images")
    if st.button("Clear All Data Logs", type="secondary", disabled=not confirm_clear):
        try:
            if os.path.exists(CSV_FILE):
                os.remove(CSV_FILE)
            if os.path.exists(POTHOLES_FOLDER):
                import shutil
                shutil.rmtree(POTHOLES_FOLDER)
                os.makedirs(POTHOLES_FOLDER, exist_ok=True)
            load_data.clear()
            st.success("All dataset records and image files have been reset cleanly.")
        except Exception as e:
            st.error(f"Error resetting data: {e}")

# --- SINGLE CLEAN FOOTER ---
st.markdown("---")
st.markdown("<div style='text-align:center; color:#6b7280; font-size:0.85rem; padding:10px 0;'>Road Guardian AI — Real-Time Road Health & Traffic Digital Twin</div>", unsafe_allow_html=True)
