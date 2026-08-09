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
    page_title="Road Guardian AI — Digital Twin",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- ATTRACTIVE CYBER-GLASS DARK THEME ---
st.markdown("""
    <style>
    /* Midnight Glass Theme */
    html, body, [data-testid="stAppViewContainer"] {
        background-color: #0b0f19;
        color: #f9fafb;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .main {
        background-color: #0b0f19;
    }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #111827 0%, #070a12 100%);
        border-right: 1px solid rgba(0, 230, 180, 0.2);
    }
    /* Metric Cards */
    .stMetric {
        background: rgba(17, 24, 39, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 18px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    /* Feature & Section Cards */
    .gr-card {
        background: linear-gradient(135deg, rgba(17, 24, 39, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
        border: 1px solid rgba(0, 230, 180, 0.25);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .gr-title {
        font-size: 1.8rem;
        font-weight: 800;
        color: #00e6b4;
        margin-bottom: 6px;
    }
    .gr-subtitle {
        font-size: 1.0rem;
        color: #9ca3af;
        margin-bottom: 12px;
    }
    /* Feature Grid Tile */
    .feature-tile {
        background: rgba(31, 41, 55, 0.6);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 12px;
        padding: 18px;
        height: 100%;
    }
    .feature-tile h4 {
        color: #6366f1;
        margin-top: 0;
        margin-bottom: 8px;
    }
    /* Prediction Banner */
    .prediction-box {
        background: linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%);
        border: 1px solid #ef4444;
        border-left: 6px solid #ef4444;
        border-radius: 14px;
        padding: 22px;
        font-size: 1.2rem;
        line-height: 1.6;
        color: #f9fafb;
        margin: 20px 0;
    }
    /* Camera Control Box */
    .cam-box {
        background: rgba(17, 24, 39, 0.9);
        border: 2px dashed rgba(0, 230, 180, 0.4);
        border-radius: 16px;
        padding: 30px;
        text-align: center;
        margin: 20px 0;
    }
    </style>
    """, unsafe_allow_html=True)

# --- FILE PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "pothole_data.csv")
POTHOLES_FOLDER = os.path.join(BASE_DIR, "potholes")
RUNS_DIR = os.path.join(BASE_DIR, "runs", "detect", "train2")
MODEL_PATH = os.path.join(RUNS_DIR, "weights", "best.pt")
LOGO_PATH = os.path.join(BASE_DIR, "logo.png")

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

# --- SIDEBAR NAVIGATION WITH ICONS ---
with st.sidebar:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, use_container_width=True)
    else:
        st.markdown("<h2 style='color:#00e6b4;'>🛡️ Road Guardian AI</h2>", unsafe_allow_html=True)
    
    st.markdown("<p style='color:#9ca3af; font-size:0.85rem;'>Real-Time Road Health & Traffic Digital Twin</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    page = st.radio(
        "Navigation Menu",
        [
            "🏠 Home Page",
            "⚡ Road Risk Evaluator",
            "🌐 Digital Twin Map",
            "🚦 Traffic Simulator",
            "📹 Live AI Camera Stream",
            "🏛️ Government Audit & PDF",
            "⚙️ Data & Settings"
        ]
    )
    
    st.markdown("---")
    st.caption("AI Surveillance Engine: Online")

# ==========================================
# PAGE 1: HOME PAGE (CLEAN, UNCLUTTERED, NO AUTO CAMERA)
# ==========================================
if page == "🏠 Home Page":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">Road Guardian AI</div>
            <div class="gr-subtitle">
                Autonomous Road Infrastructure Surveillance & Predictive Traffic Digital Twin
            </div>
            <p style="color:#e5e7eb; font-size:1.05rem; line-height:1.6; margin-bottom:0;">
                Welcome to Road Guardian AI. This platform converts computer vision road detections into contextual hazard scores, visualizes road health across a 3D city Digital Twin map, and predicts how closing damaged roads for repair will impact surrounding traffic flow.
            </p>
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
    st.subheader("💡 Key System Capabilities")
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
                <p style="font-size:0.9rem; color:#9ca3af;">Maps citywide road network health using WebGL 3D paths: Green, Yellow, Orange, Red.</p>
            </div>
        """, unsafe_allow_html=True)
    with t4:
        st.markdown("""
            <div class="feature-tile">
                <h4>4. Traffic Simulator</h4>
                <p style="font-size:0.9rem; color:#9ca3af;">Simulates road repairs and predicts exact % traffic volume shifts on surrounding detour routes.</p>
            </div>
        """, unsafe_allow_html=True)

    st.markdown("---")

    # Clean Map & Detections Chart
    if not df.empty:
        col_map, col_chart = st.columns([2, 1])
        with col_map:
            st.subheader("🗺️ City Hazard Detection Map")
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
            st.subheader("📊 Hazard Severity Counts")
            st.bar_chart(df['Severity'].value_counts())

# ==========================================
# PAGE 2: ROAD RISK EVALUATOR
# ==========================================
elif page == "⚡ Road Risk Evaluator":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">⚡ Contextual Road Risk Score Evaluator</div>
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
                <div style="font-size: 0.9rem; color: #9ca3af;">CALCULATED ROAD RISK SCORE</div>
                <div style="font-size: 3.4rem; font-weight: 800; color: {risk_result['color_hex']}; margin: 10px 0;">
                    {risk_result['score']} <span style="font-size: 1.2rem; color: #9ca3af;">/ 100</span>
                </div>
                <div style="font-size: 1.2rem; font-weight: 700;">
                    {risk_result['badge']}
                </div>
            </div>
        """, unsafe_allow_html=True)

    with b_col2:
        st.subheader("📋 Factor Weight Contribution Breakdown")
        for factor_name, score in risk_result["breakdown"].items():
            col_f1, col_f2 = st.columns([2, 3])
            with col_f1:
                st.write(f"**{factor_name}**")
            with col_f2:
                st.progress(min(1.0, score / 35.0))

# ==========================================
# PAGE 3: DIGITAL TWIN MAP
# ==========================================
elif page == "🌐 Digital Twin Map":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">🌐 City Digital Twin — Road Network Map</div>
            <div class="gr-subtitle">
                3D virtual graph network of city road segments categorized in real time:
                🟢 Healthy (0–25) | 🟡 Degraded (26–50) | 🟠 High Risk (51–75) | 🔴 Critical (76–100)
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
    st.subheader("🔍 Segment Health Inspector")

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
elif page == "🚦 Traffic Simulator":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">🚦 Predictive Traffic Rerouting Simulator</div>
            <div class="gr-subtitle">
                Predicts traffic volume shifts across alternate routes when a road segment is closed for repairs.
            </div>
        </div>
    """, unsafe_allow_html=True)

    def_lat, def_lon = get_default_gps()
    network = get_default_city_network(def_lat, def_lon)

    road_choices = {f"{s['name']}  [{s['badge']}]": s['id'] for s in network}
    selected_label = st.selectbox("Select Damaged Road Segment to Close for Repair", list(road_choices.keys()))
    selected_road_id = road_choices[selected_label]

    sim_res = simulate_traffic_rerouting(selected_road_id, network)

    st.markdown(f"""
        <div class="prediction-box">
            <b>🔮 Predictive Traffic Impact Statement:</b><br><br>
            {sim_res['prediction_text']}
        </div>
    """, unsafe_allow_html=True)

    st.markdown("---")

    c_left, c_right = st.columns([3, 2])
    with c_left:
        st.subheader("📊 Traffic Volume Before vs After Repair Closure")
        res_df = pd.DataFrame(sim_res["rerouting_data"])
        chart_df = res_df.set_index("name")[["base_traffic", "new_traffic"]]
        chart_df.columns = ["Before Closure", "After Rerouting"]
        st.bar_chart(chart_df)

    with c_right:
        st.subheader("💡 Recommended Detour Actions")
        for step in sim_res["mitigation_steps"]:
            st.success(step)

    st.markdown("---")
    st.subheader("📋 Alternate Routes Impact Breakdown")
    clean_table = res_df[["name", "base_traffic", "new_traffic", "pct_increase", "congestion_level"]].copy()
    clean_table.columns = ["Alternate Road Name", "Normal Traffic (v/h)", "New Traffic (v/h)", "Traffic Increase (%)", "Congestion Alert"]
    clean_table["Traffic Increase (%)"] = clean_table["Traffic Increase (%)"].apply(lambda v: f"+{v}%")
    st.dataframe(clean_table, use_container_width=True)

# ==========================================
# PAGE 5: LIVE AI CAMERA STREAM (CAMERA CONTROL FIX: OFF BY DEFAULT!)
# ==========================================
elif page == "📹 Live AI Camera Stream":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">📹 Live AI Camera Stream & Photo Capture</div>
            <div class="gr-subtitle">
                Run live webcam feed with real-time YOLO AI pothole detection overlay or capture photos on demand.
            </div>
        </div>
    """, unsafe_allow_html=True)

    # Initialize Session State for Camera Toggle
    if "camera_active" not in st.session_state:
        st.session_state.camera_active = False

    cam_tab1, cam_tab2 = st.tabs(["🔴 Live Webcam Stream (Manual Control)", "📸 Snapshot Upload/Capture"])

    with cam_tab1:
        st.markdown('<div class="cam-box">', unsafe_allow_html=True)
        st.write("### Camera Status Control")
        
        # Explicit ON/OFF Buttons
        col_c_btn1, col_c_btn2 = st.columns(2)
        with col_c_btn1:
            if st.button("▶️ Turn On Camera", type="primary", use_container_width=True):
                st.session_state.camera_active = True
        with col_c_btn2:
            if st.button("⏹️ Turn Off Camera", use_container_width=True):
                st.session_state.camera_active = False

        if st.session_state.camera_active:
            st.success("🟢 Camera Feed Active: Running YOLO detection...")
        else:
            st.info("⏸️ Camera Feed is OFF. Click '▶️ Turn On Camera' above to start detection.")
        
        st.markdown('</div>', unsafe_allow_html=True)

        if st.session_state.camera_active:
            frame_window = st.image([])
            cap = cv2.VideoCapture(0)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

            # Stream frames while active
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
        st.subheader("📸 Capture Snapshot from Camera")
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
# PAGE 6: GOVERNMENT AUDIT & PDF
# ==========================================
elif page == "🏛️ Government Audit & PDF":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">🏛️ Municipal Audit & Government Data Portal</div>
            <div class="gr-subtitle">
                Export official inspection PDF reports and submit work orders to municipal authorities.
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
        st.subheader("📄 Generate Municipal PDF Report")
        st.caption("Creates an executive-ready 1-page PDF document with summary metrics and risk list.")
        
        pdf_bytes = generate_pdf_report(det_summary, crit_segs, sim_data)
        st.download_button(
            label="📥 Download Official Municipal PDF Report",
            data=pdf_bytes,
            file_name=f"Municipal_Road_Audit_{datetime.datetime.now().strftime('%Y%m%d')}.pdf",
            mime="application/pdf",
            type="primary",
            use_container_width=True
        )

        st.markdown("<div style='margin-top:15px;'></div>", unsafe_allow_html=True)
        idea_pdf_path = os.path.join(BASE_DIR, "Road_Guardian_AI_Idea_Submission.pdf")
        if os.path.exists(idea_pdf_path):
            with open(idea_pdf_path, "rb") as f:
                idea_bytes = f.read()
            st.download_button(
                label="💡 Download Complete Idea Submission Proposal (PDF)",
                data=idea_bytes,
                file_name="Road_Guardian_AI_Idea_Submission.pdf",
                mime="application/pdf",
                use_container_width=True
            )

    with c_audit2:
        st.subheader("🌐 Submit Work Order to Government Portal")
        st.caption("Simulates transmitting API payload ticket to the Department of Municipal Infrastructure.")
        
        target_dept = st.selectbox("Target Authority", ["Municipal Public Works Department", "Department of Urban Transportation", "Highway Safety Authority"])
        if st.button("Transmit Work Order API Payload", use_container_width=True):
            ticket_ref = f"TICKET-MUNI-{datetime.datetime.now().strftime('%Y%m%d%H%M')}"
            st.success(f"Work Order {ticket_ref} transmitted to {target_dept}! Priority: Critical")
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
elif page == "⚙️ Data & Settings":
    st.markdown("""
        <div class="gr-card">
            <div class="gr-title">⚙️ Data & System Settings</div>
            <div class="gr-subtitle">Manage detection datasets, download CSV logs, or reset data store.</div>
        </div>
    """, unsafe_allow_html=True)

    if not df.empty:
        st.subheader("📁 Detection Dataset")
        exp_df = df.drop(columns=['lat_numeric', 'lon_numeric'], errors='ignore')
        st.dataframe(exp_df, use_container_width=True)
        csv_data = exp_df.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Download Detection Log CSV", data=csv_data, file_name='pothole_data.csv', mime='text/csv')

    st.markdown("---")
    st.subheader("🧹 Clear / Reset Data Option")
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
            st.success("All dataset records and image files have been reset cleanly!")
        except Exception as e:
            st.error(f"Error resetting data: {e}")

# --- SINGLE CLEAN FOOTER ---
st.markdown("---")
st.markdown("<div style='text-align:center; color:#6b7280; font-size:0.85rem; padding:10px 0;'>Road Guardian AI — Real-Time Road Health & Traffic Digital Twin</div>", unsafe_allow_html=True)
