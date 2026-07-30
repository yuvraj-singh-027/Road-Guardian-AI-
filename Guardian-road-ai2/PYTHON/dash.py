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

# --- CONFIG ---
st.set_page_config(
    page_title="Guardian Road AI Dashboard",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- STYLE ---
st.markdown("""
    <style>
    html, body, [data-testid="stAppViewContainer"] {
        background: radial-gradient(1200px 700px at 15% 10%, rgba(52, 80, 132, 0.25), transparent 60%),
                    radial-gradient(1000px 600px at 85% 20%, rgba(76, 175, 80, 0.14), transparent 55%),
                    #0e1117;
        color: white;
    }
    .main {
        background-color: #0e1117;
        color: white;
    }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #0e1117 0%, #0b0d12 100%);
        border-right: 1px solid rgba(78, 93, 108, 0.6);
    }
    .stMetric {
        background-color: #1e2130;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #4e5d6c;
    }
    .gr-card {
        background: linear-gradient(180deg, rgba(30, 33, 48, 0.88) 0%, rgba(20, 22, 32, 0.88) 100%);
        border: 1px solid rgba(78, 93, 108, 0.8);
        border-radius: 14px;
        padding: 18px 18px 8px 18px;
    }
    </style>
    """, unsafe_allow_html=True)

# --- PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "pothole_data.csv")
POTHOLES_FOLDER = os.path.join(BASE_DIR, "potholes")
RUNS_DIR = os.path.join(BASE_DIR, "runs", "detect", "train2")
MODEL_PATH = os.path.join(RUNS_DIR, "weights", "best.pt")

# --- LOAD DATA ---
@st.cache_data
def load_data():
    if not os.path.exists(CSV_FILE):
        return pd.DataFrame()
    
    try:
        df = pd.read_csv(CSV_FILE)
        # Check if the CSV was empty or had no header
        if df.empty:
            return df
            
        # If 'Time' is missing, it might be because the first row was treated as header
        if 'Time' not in df.columns:
            # Re-read without header and assign 
            df = pd.read_csv(CSV_FILE, header=None)
            df.columns = ["Image", "Latitude", "Longitude", "Severity", "Confidence", "Time"]
            
        # Basic cleaning
        df['Time'] = pd.to_datetime(df['Time'], errors='coerce')
        
        # Handle GPS - convert "No Internet" to NaN for mapping
        df['lat_numeric'] = pd.to_numeric(df['Latitude'], errors='coerce')
        df['lon_numeric'] = pd.to_numeric(df['Longitude'], errors='coerce')
        
        return df
    except Exception as e:
        st.error(f"Error loading CSV: {e}")
        return pd.DataFrame()

df = load_data()

# --- SIDEBAR ---
with st.sidebar:
    st.image("https://img.icons8.com/clouds/200/road.png", width=150)
    st.title("Guardian Road AI")
    st.markdown("---")
    page = st.radio("Navigation", ["Detection Analysis", "Upload / Add Photo", "Model Performance", "Data Explorer"])
    
    st.markdown("---")
    st.info("AI-powered Road Maintenance Analysis")

# --- PAGE: DETECTION ANALYSIS ---
if page == "Detection Analysis":
    st.title(" Road Pothole Analysis")
    
    if df.empty:
        st.warning("No detection data available yet. Please run ROAD.py to collect data.")
    else:
        # --- METRICS ---
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Total Potholes", len(df))
        
        with col2:
            high_sev = len(df[df['Severity'] == 'High'])
            st.metric("High Severity", high_sev, delta=f"{high_sev/len(df)*100:.1f}%", delta_color="inverse")
            
        with col3:
            avg_conf = df['Confidence'].mean()
            st.metric("Avg Confidence", f"{avg_conf:.2f}")
            
        with col4:
            latest = df['Time'].max().strftime('%H:%M:%S') if not df['Time'].isnull().all() else "N/A"
            st.metric("Latest Detection", latest)

        st.markdown("---")

        # --- VISUALS ---
        col_map, col_chart = st.columns([2, 1])

        with col_map:
            st.subheader(" Detection Map")
            map_data = df.dropna(subset=['lat_numeric', 'lon_numeric'])
            if not map_data.empty:
                map_mode = st.radio("Map Mode", ["Advanced (Precise)", "Simple"], horizontal=True)

                if map_mode == "Simple" or pdk is None:
                    map_df = map_data[['lat_numeric', 'lon_numeric']].rename(columns={'lat_numeric': 'lat', 'lon_numeric': 'lon'})
                    st.map(map_df)
                else:
                    view_lat = float(map_data['lat_numeric'].mean())
                    view_lon = float(map_data['lon_numeric'].mean())

                    zoom = st.slider("Zoom", min_value=3, max_value=18, value=13)

                    token = None
                    try:
                        token = st.secrets["MAPBOX_TOKEN"]
                    except Exception:
                        token = os.getenv("MAPBOX_TOKEN")

                    style_choice = st.selectbox("Map Style", ["Road", "Satellite"], index=0)
                    if style_choice == "Satellite" and not token:
                        st.warning("To enable Satellite view, set MAPBOX_TOKEN in environment or Streamlit secrets.")

                    map_style = "mapbox://styles/mapbox/streets-v11"
                    if style_choice == "Satellite" and token:
                        map_style = "mapbox://styles/mapbox/satellite-streets-v12"

                    color_map = {
                        "Low": [76, 175, 80, 180],
                        "Medium": [255, 193, 7, 190],
                        "High": [244, 67, 54, 200],
                        "Critical": [156, 39, 176, 210],
                    }

                    plot_df = map_data.copy()
                    plot_df["color"] = plot_df["Severity"].map(color_map).fillna([120, 144, 156, 160])
                    plot_df["tooltip"] = plot_df.apply(
                        lambda r: f"{r.get('Image','')} | {r.get('Severity','')} | Conf: {r.get('Confidence','')}",
                        axis=1,
                    )

                    layer = pdk.Layer(
                        "ScatterplotLayer",
                        data=plot_df,
                        get_position='[lon_numeric, lat_numeric]',
                        get_color="color",
                        get_radius=12,
                        radius_units="pixels",
                        pickable=True,
                    )

                    deck = pdk.Deck(
                        map_style=map_style,
                        initial_view_state=pdk.ViewState(
                            latitude=view_lat,
                            longitude=view_lon,
                            zoom=zoom,
                            pitch=35,
                        ),
                        layers=[layer],
                        tooltip={"text": "{tooltip}"},
                    )

                    if token:
                        st.pydeck_chart(deck, use_container_width=True, api_keys={"mapbox": token})
                    else:
                        st.pydeck_chart(deck, use_container_width=True)
            else:
                st.info("No GPS data available for mapping.")

        with col_chart:
            st.subheader(" Severity Distribution")
            sev_counts = df['Severity'].value_counts()
            st.bar_chart(sev_counts)

        st.markdown("---")

        # --- TIME SERIES ---
        st.subheader(" Detection Timeline")
        if not df['Time'].isnull().all():
            timeline_df = df.copy()
            timeline_df['Date'] = timeline_df['Time'].dt.date
            timeline_counts = timeline_df.groupby('Date').size()
            st.line_chart(timeline_counts)
        else:
            st.info("No timestamp data available for timeline.")

        st.markdown("---")

        # --- IMAGE GALLERY ---
        st.subheader(" Detection Gallery")
        
        if os.path.exists(POTHOLES_FOLDER):
            images = [f for f in os.listdir(POTHOLES_FOLDER) if f.endswith(('.jpg', '.jpeg', '.png'))]
            images.sort(reverse=True) # Show latest first
            
            if images:
                num_cols = 4
                rows = (len(images) + num_cols - 1) // num_cols
                
                for r in range(rows):
                    cols = st.columns(num_cols)
                    for c in range(num_cols):
                        idx = r * num_cols + c
                        if idx < len(images):
                            img_name = images[idx]
                            img_path = os.path.join(POTHOLES_FOLDER, img_name)
                            
                            # Find metadata for this image
                            meta = df[df['Image'] == img_name].iloc[0] if img_name in df['Image'].values else None
                            
                            with cols[c]:
                                img = Image.open(img_path)
                                caption = f"{img_name}"
                                if meta is not None:
                                    caption += f" | {meta['Severity']} ({meta['Confidence']})"
                                
                                st.image(img, caption=caption, use_container_width=True)
            else:
                st.info("No images found in potholes folder.")
        else:
            st.error("Potholes folder not found.")

# --- PAGE: UPLOAD / ADD PHOTO ---
elif page == "Upload / Add Photo":
    st.markdown('<div class="gr-card">', unsafe_allow_html=True)
    st.title(" Upload / Add Photo")
    st.caption("Add pothole photos manually. Optionally run the YOLO model and save the annotated image into the dataset.")
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
        ts = datetime.datetime.now().isoformat(sep=" ", timespec="seconds")
        header_needed = not os.path.exists(CSV_FILE) or os.path.getsize(CSV_FILE) == 0
        row = [filename, latitude, longitude, severity, round(float(confidence), 2), ts]
        import csv
        with open(CSV_FILE, "a", newline="") as f:
            w = csv.writer(f)
            if header_needed:
                w.writerow(["Image", "Latitude", "Longitude", "Severity", "Confidence", "Time"])
            w.writerow(row)

    model = get_model()
    if model is None:
        st.warning("Model not available inside the dashboard. Upload will still work, but detection will be skipped.")

    tab1, tab2 = st.tabs(["Upload Photo", "Use Camera"])

    with tab1:
        uploaded = st.file_uploader("Choose an image", type=["jpg", "jpeg", "png"])
        run_det = st.checkbox("Run model on this photo", value=model is not None, disabled=model is None)
        col_g1, col_g2 = st.columns(2)
        with col_g1:
            latitude = st.text_input("Latitude (optional)", placeholder="e.g. 28.6139")
        with col_g2:
            longitude = st.text_input("Longitude (optional)", placeholder="e.g. 77.2090")

        if uploaded is not None:
            pil_img = Image.open(uploaded).convert("RGB")
            st.image(pil_img, caption="Preview", use_container_width=True)

            if st.button("Save to Dataset", type="primary", use_container_width=True):
                Path(POTHOLES_FOLDER).mkdir(parents=True, exist_ok=True)
                ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"manual_{ts}.jpg"
                out_path = os.path.join(POTHOLES_FOLDER, filename)

                severity = "Low"
                confidence = 0.0
                saved_img = pil_img

                if run_det and model is not None:
                    try:
                        results = model.predict(pil_img, imgsz=416, conf=0.5, verbose=False)
                        confs = [float(b.conf[0]) for b in results[0].boxes] if results and results[0].boxes is not None else []
                        if confs:
                            confidence = max(confs)
                            severity = severity_from_conf(confidence)
                            plotted = results[0].plot()
                            saved_img = Image.fromarray(plotted[..., ::-1])
                        else:
                            severity = "Low"
                            confidence = 0.0
                    except Exception as e:
                        st.error(f"Detection failed: {e}")

                saved_img.save(out_path, format="JPEG", quality=92)
                save_detection_row(filename, severity, confidence, latitude, longitude)
                load_data.clear()
                st.success(f"Saved {filename} | Severity: {severity} | Confidence: {confidence:.2f}")

    with tab2:
        if "show_camera" not in st.session_state:
            st.session_state.show_camera = True

        col_a, col_b = st.columns([2, 1])
        with col_b:
            if st.button("Turn Camera Off", use_container_width=True):
                st.session_state.show_camera = False
            if st.button("Turn Camera On", use_container_width=True):
                st.session_state.show_camera = True

        with col_a:
            st.text_input("Press Enter here to turn camera off", key="camera_off_key", on_change=lambda: st.session_state.update(show_camera=False))
            cam = st.camera_input("Take a photo", disabled=not st.session_state.show_camera)
            col_c1, col_c2 = st.columns(2)
            with col_c1:
                cam_latitude = st.text_input("Latitude (optional)", placeholder="e.g. 28.6139", key="cam_latitude")
            with col_c2:
                cam_longitude = st.text_input("Longitude (optional)", placeholder="e.g. 77.2090", key="cam_longitude")

        if cam is not None:
            pil_img = Image.open(cam).convert("RGB")
            st.image(pil_img, caption="Captured", use_container_width=True)

            run_det = st.checkbox("Run model on captured photo", value=model is not None, disabled=model is None, key="cam_run_det")
            if st.button("Save Capture to Dataset", type="primary", use_container_width=True):
                Path(POTHOLES_FOLDER).mkdir(parents=True, exist_ok=True)
                ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"camera_{ts}.jpg"
                out_path = os.path.join(POTHOLES_FOLDER, filename)

                severity = "Low"
                confidence = 0.0
                saved_img = pil_img

                if run_det and model is not None:
                    try:
                        results = model.predict(pil_img, imgsz=416, conf=0.5, verbose=False)
                        confs = [float(b.conf[0]) for b in results[0].boxes] if results and results[0].boxes is not None else []
                        if confs:
                            confidence = max(confs)
                            severity = severity_from_conf(confidence)
                            plotted = results[0].plot()
                            saved_img = Image.fromarray(plotted[..., ::-1])
                    except Exception as e:
                        st.error(f"Detection failed: {e}")

                saved_img.save(out_path, format="JPEG", quality=92)
                save_detection_row(filename, severity, confidence, cam_latitude, cam_longitude)
                load_data.clear()
                st.session_state.show_camera = False
                st.success(f"Saved {filename} | Severity: {severity} | Confidence: {confidence:.2f}")

# --- PAGE: MODEL PERFORMANCE ---
elif page == "Model Performance":
    st.title(" YOLOv8 Model Analysis")
    
    results_csv = os.path.join(RUNS_DIR, "results.csv")
    
    if os.path.exists(results_csv):
        st.subheader(" Training Metrics")
        res_df = pd.read_csv(results_csv)
        
        # Clean column names (strip spaces)
        res_df.columns = [c.strip() for c in res_df.columns]
        
        # Plot Precision, Recall, mAP
        metrics_df = res_df[['metrics/precision(B)', 'metrics/recall(B)', 'metrics/mAP50(B)']]
        st.line_chart(metrics_df)
        
        # Plot Loss
        loss_df = res_df[['train/box_loss', 'val/box_loss']]
        st.line_chart(loss_df)
    else:
        st.warning("Training results (results.csv) not found.")

    st.markdown("---")
    
    st.subheader(" Validation Visuals")
    
    # List of common YOLO result images
    result_images = [
        "confusion_matrix.png",
        "results.png",
        "F1_curve.png",
        "PR_curve.png",
        "P_curve.png",
        "R_curve.png"
    ]
    
    # Try to find images (some might have Box prefix)
    available_imgs = []
    for img_name in result_images:
        path = os.path.join(RUNS_DIR, img_name)
        if os.path.exists(path):
            available_imgs.append((img_name, path))
        else:
            # Check for "Box" prefix version
            box_path = os.path.join(RUNS_DIR, f"Box{img_name}")
            if os.path.exists(box_path):
                available_imgs.append((f"Box{img_name}", box_path))

    if available_imgs:
        cols = st.columns(2)
        for i, (name, path) in enumerate(available_imgs):
            with cols[i % 2]:
                st.image(path, caption=name, use_container_width=True)
    else:
        st.info("No visualization images found in training folder.")

    st.markdown("---")
    st.subheader("Training Batches")
    
    # Show train_batch*.jpg images
    batch_imgs = [f for f in os.listdir(RUNS_DIR) if f.startswith('train_batch') and f.endswith('.jpg')]
    batch_imgs.sort()
    
    if batch_imgs:
        cols = st.columns(3)
        for i, name in enumerate(batch_imgs):
            path = os.path.join(RUNS_DIR, name)
            with cols[i % 3]:
                st.image(path, caption=name, use_container_width=True)
    else:
        st.info("No training batch images found.")

# --- PAGE: DATA EXPLORER ---
elif page == "Data Explorer":
    st.title(" Raw Detection Data")
    
    if not df.empty:
        st.dataframe(df, use_container_width=True)
        
        # Download button
        csv = df.to_csv(index=False).encode('utf-8')
        st.download_button(
            label=" Download Data as CSV",
            data=csv,
            file_name='pothole_detections.csv',
            mime='text/csv',
        )
    else:
        st.warning("No data available.")

# --- FOOTER ---
st.markdown("Developed by Team - THE DEBUGGERS")
