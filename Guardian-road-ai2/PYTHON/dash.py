import streamlit as st
import pandas as pd
import os
from PIL import Image
import datetime
from pathlib import Path

try:
    import pydeck as pdk
except Exception:
    pdk = None

# --- IMPORT LAYER 2 & LAYER 3/4 ENGINES ---
try:
    from risk_engine import calculate_road_risk
    from traffic_engine import get_default_city_network, simulate_traffic_rerouting
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from risk_engine import calculate_road_risk
    from traffic_engine import get_default_city_network, simulate_traffic_rerouting

# --- CONFIG ---
st.set_page_config(
    page_title="Guardian Road AI — Perception, Digital Twin & Traffic Intelligence",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- ADVANCED GLASSMORPHISM STYLING ---
st.markdown("""
    <style>
    html, body, [data-testid="stAppViewContainer"] {
        background: radial-gradient(1200px 700px at 15% 10%, rgba(30, 58, 110, 0.35), transparent 60%),
                    radial-gradient(1000px 600px at 85% 20%, rgba(0, 200, 150, 0.18), transparent 55%),
                    #0b0f19;
        color: #e2e8f0;
        font-family: 'Inter', sans-serif;
    }
    .main {
        background-color: transparent;
        color: #e2e8f0;
    }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #0e1424 0%, #070a12 100%);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
    }
    .stMetric {
        background: rgba(22, 30, 49, 0.7);
        backdrop-filter: blur(12px);
        padding: 16px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .gr-card {
        background: linear-gradient(135deg, rgba(26, 36, 62, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 22px;
        margin-bottom: 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .risk-healthy {
        background-color: rgba(76, 175, 80, 0.18);
        color: #4CAF50;
        border: 1px solid #4CAF50;
    }
    .risk-degraded {
        background-color: rgba(255, 193, 7, 0.18);
        color: #FFC107;
        border: 1px solid #FFC107;
    }
    .risk-high {
        background-color: rgba(255, 152, 0, 0.18);
        color: #FF9800;
        border: 1px solid #FF9800;
    }
    .risk-critical {
        background-color: rgba(244, 67, 54, 0.18);
        color: #F44336;
        border: 1px solid #F44336;
    }
    .prediction-box {
        background: linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%);
        border-left: 5px solid #ef4444;
        padding: 16px 20px;
        border-radius: 8px;
        font-size: 1.15rem;
        font-weight: 500;
        margin: 15px 0;
    }
    </style>
    """, unsafe_allow_html=True)

# --- PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "pothole_data.csv")
POTHOLES_FOLDER = os.path.join(BASE_DIR, "potholes")
RUNS_DIR = os.path.join(BASE_DIR, "runs", "detect", "train2")
MODEL_PATH = os.path.join(RUNS_DIR, "weights", "best.pt")
LOGO_PATH = os.path.join(BASE_DIR, "logo.png")

# --- GPS UTILS ---
def extract_gps_from_exif(uploaded_file_or_img):
    """Extract EXIF GPS coordinates from PIL Image or uploaded bytes."""
    try:
        if isinstance(uploaded_file_or_img, Image.Image):
            pil_img = uploaded_file_or_img
        else:
            pil_img = Image.open(uploaded_file_or_img)
            
        exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if not exif:
            return None, None
            
        from PIL import ExifTags
        gps_info = {}
        for key, value in exif.items():
            tag_name = ExifTags.TAGS.get(key, key)
            if tag_name == "GPSInfo":
                for gps_tag in value:
                    sub_tag = ExifTags.GPSTAGS.get(gps_tag, gps_tag)
                    gps_info[sub_tag] = value[gps_tag]
                    
        if not gps_info:
            return None, None
            
        def _convert_to_degrees(value):
            d = float(value[0])
            m = float(value[1])
            s = float(value[2])
            return d + (m / 60.0) + (s / 3600.0)

        lat = None
        lon = None
        if "GPSLatitude" in gps_info and "GPSLatitudeRef" in gps_info:
            lat = _convert_to_degrees(gps_info["GPSLatitude"])
            if gps_info["GPSLatitudeRef"] != "N":
                lat = -lat
        if "GPSLongitude" in gps_info and "GPSLongitudeRef" in gps_info:
            lon = _convert_to_degrees(gps_info["GPSLongitude"])
            if gps_info["GPSLongitudeRef"] != "E":
                lon = -lon

        return lat, lon
    except Exception:
        return None, None

@st.cache_data(ttl=1800)
def get_default_gps():
    """Fetch current device/network IP-based GPS coordinates."""
    try:
        import geocoder
        g = geocoder.ip('me')
        if g.latlng and len(g.latlng) == 2:
            return float(g.latlng[0]), float(g.latlng[1])
    except Exception:
        pass
    try:
        import urllib.request
        import json
        req = urllib.request.Request("http://ip-api.com/json/", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "success":
                return float(data["lat"]), float(data["lon"])
    except Exception:
        pass
    return 28.6139, 77.2090

# --- LOAD DATA ---
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
        
        # Calculate Layer 2 Road Risk Score for each row
        risk_scores = []
        status_list = []
        badges = []
        
        for idx, row in df.iterrows():
            sev = str(row.get('Severity', 'Medium'))
            conf = float(row.get('Confidence', 0.8)) if pd.notnull(row.get('Confidence')) else 0.8
            r = calculate_road_risk(severity=sev, confidence=conf)
            risk_scores.append(r["score"])
            status_list.append(r["status"])
            badges.append(r["badge"])
            
        df['Risk_Score'] = risk_scores
        df['Risk_Status'] = status_list
        df['Risk_Badge'] = badges
        
        return df
    except Exception as e:
        st.error(f"Error loading CSV: {e}")
        return pd.DataFrame()

df = load_data()

# --- SIDEBAR ---
with st.sidebar:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, use_container_width=True)
    else:
        st.image("https://img.icons8.com/clouds/200/road.png", width=140)

    st.title("Guardian Road AI")
    st.caption("AI Perception • Digital Twin • Traffic Intelligence")
    st.markdown("---")
    
    page = st.radio(
        "Architecture Layers",
        [
            "Layer 1 & 2: Perception & Risk Score",
            "Layer 3: City Digital Twin Map",
            "Layer 4: Traffic Intelligence Simulator",
            "Upload / Add Photo",
            "Model Performance",
            "Data Explorer"
        ]
    )
    
    st.markdown("---")
    st.markdown("### System Status")
    st.success("🟢 YOLO Perception Engine: Active")
    st.info("🌐 Context Engine: Online")
    st.info("🗺️ Digital Twin: Synchronized")

# ==========================================
# PAGE 1: LAYER 1 & 2 — PERCEPTION & RISK
# ==========================================
if page == "Layer 1 & 2: Perception & Risk Score":
    st.markdown("""
        <div class="gr-card">
            <h2 style="margin:0;">Layer 1 & Layer 2 — Perception & Contextual Risk Engine</h2>
            <p style="color:#94a3b8; margin-top:6px;">
                Combines <b>YOLO Computer Vision</b> detections with real-time contextual factors (Speed, Traffic Density, Road Category, Weather, and Proximity to Schools/Hospitals) to compute an explicit <b>0–100 Road Risk Score</b>.
            </p>
        </div>
    """, unsafe_allow_html=True)

    if df.empty:
        st.warning("No detection data available yet. Please run ROAD.py or upload photos.")
    else:
        # --- METRICS ---
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Total Detections", len(df))
        
        with col2:
            high_sev = len(df[df['Severity'] == 'High']) if 'Severity' in df.columns else 0
            pct = (high_sev / len(df) * 100) if len(df) > 0 else 0
            st.metric("High Severity Detections", high_sev, delta=f"{pct:.1f}%")
            
        with col3:
            avg_risk = df['Risk_Score'].mean() if 'Risk_Score' in df.columns else 0
            st.metric("Avg Road Risk Score", f"{avg_risk:.1f} / 100")
            
        with col4:
            critical_count = len(df[df['Risk_Status'] == 'Critical']) if 'Risk_Status' in df.columns else 0
            st.metric("Critical Hazards", critical_count, delta="Requires Immediate Action", delta_color="inverse")

        st.markdown("---")

        # --- LIVE CONTEXT SIMULATOR ---
        st.subheader("🧪 Live Risk Score Context Evaluator")
        st.caption("Adjust environmental and traffic context parameters to evaluate real-time Risk Score changes:")
        
        c_sim1, c_sim2, c_sim3, c_sim4 = st.columns(4)
        with c_sim1:
            sim_sev = st.selectbox("Damage Severity", ["Low", "Medium", "High", "Critical"], index=2)
            sim_conf = st.slider("YOLO Confidence", 0.50, 1.00, 0.88, 0.01)
        with c_sim2:
            sim_speed = st.slider("Vehicle Speed (km/h)", 10, 120, 60, 5)
            sim_traffic = st.selectbox("Traffic Density", ["Low", "Moderate", "High", "Congested"], index=1)
        with c_sim3:
            sim_road = st.selectbox("Road Category", ["Expressway", "Arterial Road", "Collector Street", "Local Road"], index=1)
            sim_weather = st.selectbox("Weather Condition", ["Clear", "Rainy", "Foggy", "Snowy / Icy"], index=1)
        with c_sim4:
            sim_prox = st.checkbox("Near School / Hospital Zone (<300m)", value=True)
            sim_count = st.number_input("Pothole Count in Segment", 1, 10, 3)

        live_res = calculate_road_risk(
            severity=sim_sev,
            confidence=sim_conf,
            damage_count=sim_count,
            speed_kmh=sim_speed,
            traffic_density=sim_traffic,
            road_type=sim_road,
            weather=sim_weather,
            proximity_school_hospital=sim_prox
        )

        st.markdown(f"""
            <div style="background: rgba(15, 23, 42, 0.8); border: 2px solid {live_res['color_hex']}; padding: 18px; border-radius: 12px; margin: 15px 0;">
                <h3 style="margin:0; color:{live_res['color_hex']};">
                    Calculated Risk Score: <b>{live_res['score']} / 100</b> — {live_res['badge']}
                </h3>
            </div>
        """, unsafe_allow_html=True)

        st.json(live_res["breakdown"])

        st.markdown("---")

        # --- MAP & CHARTS ---
        col_map, col_chart = st.columns([2, 1])

        with col_map:
            st.subheader("🗺️ Detection Risk Map")
            map_data = df.dropna(subset=['lat_numeric', 'lon_numeric'])
            if not map_data.empty:
                view_lat = float(map_data['lat_numeric'].mean())
                view_lon = float(map_data['lon_numeric'].mean())

                color_map = {
                    "Healthy": [76, 175, 80, 200],
                    "Degraded": [255, 193, 7, 210],
                    "High Risk": [255, 152, 0, 220],
                    "Critical": [244, 67, 54, 240],
                }

                plot_df = map_data.copy()
                plot_df["color"] = plot_df["Risk_Status"].apply(lambda s: color_map.get(s, [120, 144, 156, 160]))
                plot_df["tooltip"] = plot_df.apply(
                    lambda r: f"{r.get('Image','')} | Severity: {r.get('Severity','')} | Risk Score: {r.get('Risk_Score','')} ({r.get('Risk_Status','')})",
                    axis=1,
                )

                layer = pdk.Layer(
                    "ScatterplotLayer",
                    data=plot_df,
                    get_position='[lon_numeric, lat_numeric]',
                    get_color="color",
                    get_radius=15,
                    radius_units="'pixels'",
                    pickable=True,
                )

                deck = pdk.Deck(
                    map_style="road",
                    initial_view_state=pdk.ViewState(
                        latitude=view_lat,
                        longitude=view_lon,
                        zoom=13,
                        pitch=30,
                    ),
                    layers=[layer],
                    tooltip={"text": "{tooltip}"},
                )

                st.pydeck_chart(deck, use_container_width=True)

        with col_chart:
            st.subheader("📊 Risk Classification Distribution")
            risk_counts = df['Risk_Status'].value_counts()
            st.bar_chart(risk_counts)

        # --- IMAGE GALLERY ---
        st.subheader("🖼️ Perception Detections Gallery")
        if os.path.exists(POTHOLES_FOLDER):
            images = [f for f in os.listdir(POTHOLES_FOLDER) if f.endswith(('.jpg', '.jpeg', '.png'))]
            images.sort(reverse=True)
            if images:
                cols = st.columns(4)
                for i, img_name in enumerate(images[:8]):
                    img_path = os.path.join(POTHOLES_FOLDER, img_name)
                    meta = df[df['Image'] == img_name].iloc[0] if ('Image' in df.columns and img_name in df['Image'].values) else None
                    with cols[i % 4]:
                        img = Image.open(img_path)
                        cap = f"{img_name}"
                        if meta is not None:
                            cap += f" | {meta['Risk_Badge']} ({meta['Confidence']:.2f})"
                        st.image(img, caption=cap, use_container_width=True)

# ==========================================
# PAGE 2: LAYER 3 — CITY DIGITAL TWIN MAP
# ==========================================
elif page == "Layer 3: City Digital Twin Map":
    st.markdown("""
        <div class="gr-card">
            <h2 style="margin:0;">Layer 3 — Digital Twin City Road Network Map</h2>
            <p style="color:#94a3b8; margin-top:6px;">
                A virtual graph representation of the city's road network. Each road segment continuously receives real-time health classification:
                <br>🟢 <b>Healthy</b> (0–25) &nbsp;|&nbsp; 🟡 <b>Degraded</b> (26–50) &nbsp;|&nbsp; 🟠 <b>High Risk</b> (51–75) &nbsp;|&nbsp; 🔴 <b>Critical</b> (76–100)
            </p>
        </div>
    """, unsafe_allow_html=True)

    def_lat, def_lon = get_default_gps()
    network = get_default_city_network(def_lat, def_lon)

    # Convert network to DataFrame for pydeck path layer
    network_df = pd.DataFrame(network)

    st.subheader("🌐 Virtual City Road Network Map (PyDeck Spatial Graph)")

    if pdk is not None:
        view_state = pdk.ViewState(
            latitude=def_lat,
            longitude=def_lon,
            zoom=13,
            pitch=45,
            bearing=-15
        )

        path_layer = pdk.Layer(
            "PathLayer",
            data=network_df,
            get_path="path",
            get_color="rgba",
            width_scale=20,
            width_min_pixels=8,
            get_width=12,
            pickable=True,
            auto_highlight=True
        )

        deck = pdk.Deck(
            map_style="road",
            initial_view_state=view_state,
            layers=[path_layer],
            tooltip={"text": "{name}\nStatus: {badge}\nRisk Score: {risk_score}/100\nTraffic: {base_traffic} v/h"}
        )

        st.pydeck_chart(deck, use_container_width=True)

    st.markdown("---")
    st.subheader("🔍 Road Segment Health Breakdown")

    col_sel, col_detail = st.columns([1, 2])
    with col_sel:
        seg_options = [f"{s['id']} - {s['name']}" for s in network]
        selected_option = st.radio("Select Segment to Inspect", seg_options)
        selected_id = selected_option.split(" - ")[0]
        seg_data = next((s for s in network if s["id"] == selected_id), None)

    with col_detail:
        if seg_data:
            st.markdown(f"""
                <div class="gr-card">
                    <h3>{seg_data['name']}</h3>
                    <h4>Status: {seg_data['badge']} (Risk Score: {seg_data['risk_score']}/100)</h4>
                    <hr>
                    <p><b>Road Type:</b> {seg_data['road_type']}</p>
                    <p><b>Pothole Detections:</b> {seg_data['potholes']} (Max Severity: {seg_data['severity']})</p>
                    <p><b>Vehicle Speed:</b> {seg_data['speed_kmh']} km/h | <b>Weather:</b> {seg_data['weather']}</p>
                    <p><b>Traffic Volume:</b> {seg_data['base_traffic']} / {seg_data['base_capacity']} vehicles/hr</p>
                </div>
            """, unsafe_allow_html=True)
            
            st.write("**Risk Component Breakdown:**")
            st.json(seg_data["risk_breakdown"])

# ==========================================
# PAGE 3: LAYER 4 — TRAFFIC INTELLIGENCE
# ==========================================
elif page == "Layer 4: Traffic Intelligence Simulator":
    st.markdown("""
        <div class="gr-card">
            <h2 style="margin:0;">Layer 4 — Traffic Intelligence & Re-routing Simulator</h2>
            <p style="color:#94a3b8; margin-top:6px;">
                Predictive traffic flow analysis engine. Simulates road closures for maintenance or repairs and calculates dynamic traffic diversion (% volume changes) across adjacent city network routes.
            </p>
        </div>
    """, unsafe_allow_html=True)

    def_lat, def_lon = get_default_gps()
    network = get_default_city_network(def_lat, def_lon)

    col_control, col_results = st.columns([1, 2])

    with col_control:
        st.markdown('<div class="gr-card">', unsafe_allow_html=True)
        st.subheader("🛠️ Maintenance Simulation Controls")
        
        road_choices = {f"{s['name']} ({s['badge']})": s['id'] for s in network}
        selected_label = st.selectbox("Select Road Segment to Close for Repair", list(road_choices.keys()))
        selected_road_id = road_choices[selected_label]
        
        sim_btn = st.button("🚀 Run Predictive Traffic Simulation", type="primary", use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    sim_data = simulate_traffic_rerouting(selected_road_id, network)

    with col_results:
        st.subheader("🔮 Predictive Traffic Intelligence Report")
        
        # DISPLAY PREDICTIVE SUMMARY NARRATIVE (Target Layer 4 User Expectation)
        st.markdown(f"""
            <div class="prediction-box">
                {sim_data['prediction_text']}
            </div>
        """, unsafe_allow_html=True)

        st.markdown("---")
        st.subheader("📊 Dynamic Traffic Shift Analysis (Vehicles/hr)")
        
        res_df = pd.DataFrame(sim_data["rerouting_data"])
        
        chart_df = res_df.set_index("name")[["base_traffic", "new_traffic"]]
        chart_df.columns = ["Before Closure (Baseline)", "After Closure (Predicted)"]
        st.bar_chart(chart_df)

    st.markdown("---")
    st.subheader("📋 Alternate Routes Impact Breakdown")
    
    display_df = res_df[["name", "base_traffic", "diverted_traffic", "new_traffic", "pct_increase", "old_vc_ratio", "new_vc_ratio", "congestion_level"]]
    display_df.columns = ["Road Name", "Baseline Traffic", "Diverted Volume", "New Traffic", "% Volume Increase", "Old V/C Ratio", "New V/C Ratio", "Congestion Status"]
    st.dataframe(display_df, use_container_width=True)

    st.markdown("---")
    st.subheader("💡 Actionable Mitigation & Detour Recommendations")
    for step in sim_data["mitigation_steps"]:
        st.info(step)

# ==========================================
# PAGE 4: UPLOAD / ADD PHOTO
# ==========================================
elif page == "Upload / Add Photo":
    st.markdown('<div class="gr-card">', unsafe_allow_html=True)
    st.title("📷 Upload / Capture Pothole Image")
    st.caption("Add pothole photos manually or via camera. GPS & EXIF metadata are extracted automatically.")
    st.markdown("</div>", unsafe_allow_html=True)

    @st.cache_resource
    def get_model():
        if not os.path.exists(MODEL_PATH):
            return None
        try:
            from ultralytics import YOLO
        except Exception:
            return None
        return YOLO(MODEL_PATH)

    def severity_from_conf(conf: float) -> str:
        if conf > 0.75:
            return "High"
        if conf > 0.5:
            return "Medium"
        return "Low"

    def save_detection_row(filename: str, severity: str, confidence: float, latitude: str, longitude: str):
        lat_str = str(latitude).strip() if latitude is not None else ""
        lon_str = str(longitude).strip() if longitude is not None else ""
        
        if not lat_str or not lon_str:
            def_lat, def_lon = get_default_gps()
            if not lat_str:
                lat_str = f"{def_lat:.6f}"
            if not lon_str:
                lon_str = f"{def_lon:.6f}"

        ts = datetime.datetime.now().isoformat(sep=" ", timespec="seconds")
        header_needed = not os.path.exists(CSV_FILE) or os.path.getsize(CSV_FILE) == 0
        row = [filename, lat_str, lon_str, severity, round(float(confidence), 2), ts]
        import csv
        with open(CSV_FILE, "a", newline="") as f:
            w = csv.writer(f)
            if header_needed:
                w.writerow(["Image", "Latitude", "Longitude", "Severity", "Confidence", "Time"])
            w.writerow(row)
        return lat_str, lon_str

    model = get_model()

    uploaded = st.file_uploader("Choose an image", type=["jpg", "jpeg", "png"])
    if uploaded is not None:
        pil_img = Image.open(uploaded).convert("RGB")
        st.image(pil_img, caption="Preview", use_container_width=True)

        if st.button("Analyze & Save to Dataset", type="primary", use_container_width=True):
            Path(POTHOLES_FOLDER).mkdir(parents=True, exist_ok=True)
            ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"manual_{ts}.jpg"
            out_path = os.path.join(POTHOLES_FOLDER, filename)

            severity = "Low"
            confidence = 0.0
            saved_img = pil_img

            if model is not None:
                try:
                    results = model.predict(pil_img, imgsz=416, conf=0.5, verbose=False)
                    confs = [float(b.conf[0]) for b in results[0].boxes] if results and results[0].boxes is not None else []
                    if confs:
                        confidence = max(confs)
                        severity = severity_from_conf(confidence)
                        plotted = results[0].plot()
                        saved_img = Image.fromarray(plotted[..., ::-1])
                except Exception as e:
                    st.error(f"Detection error: {e}")

            saved_img.save(out_path, format="JPEG", quality=92)
            def_lat, def_lon = get_default_gps()
            save_detection_row(filename, severity, confidence, str(def_lat), str(def_lon))
            load_data.clear()
            
            # Calculate Layer 2 Risk Score
            r_info = calculate_road_risk(severity=severity, confidence=confidence)
            st.success(f"Saved {filename} | Severity: {severity} | Road Risk Score: {r_info['score']} ({r_info['badge']})")

# ==========================================
# PAGE 5: MODEL PERFORMANCE
# ==========================================
elif page == "Model Performance":
    st.title("🎯 YOLOv8 Model Performance & Metrics")
    results_csv = os.path.join(RUNS_DIR, "results.csv")
    
    if os.path.exists(results_csv):
        res_df = pd.read_csv(results_csv)
        res_df.columns = [c.strip() for c in res_df.columns]
        metrics_cols = [c for c in ['metrics/precision(B)', 'metrics/recall(B)', 'metrics/mAP50(B)'] if c in res_df.columns]
        if metrics_cols:
            st.line_chart(res_df[metrics_cols])
    else:
        st.warning("Training results (results.csv) not found.")

# ==========================================
# PAGE 6: DATA EXPLORER
# ==========================================
elif page == "Data Explorer":
    st.title("📁 Raw Detections & Risk Data Explorer")
    if not df.empty:
        export_df = df.drop(columns=['lat_numeric', 'lon_numeric'], errors='ignore')
        st.dataframe(export_df, use_container_width=True)
        csv = export_df.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Download Dataset as CSV", data=csv, file_name='road_guardian_data.csv', mime='text/csv')

# --- FOOTER ---
st.markdown("---")
st.markdown("<p style='text-align: center; color: #64748b;'>Developed by Team - <b>THE DEBUGGERS</b> | Guardian Road AI 4-Layer Architecture</p>", unsafe_allow_html=True)
