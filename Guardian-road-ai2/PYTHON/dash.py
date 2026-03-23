import streamlit as st
import pandas as pd
import os
from PIL import Image
import datetime

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
    .main {
        background-color: #0e1117;
        color: white;
    }
    .stMetric {
        background-color: #1e2130;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #4e5d6c;
    }
    </style>
    """, unsafe_allow_html=True)

# --- PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "pothole_data.csv")
POTHOLES_FOLDER = os.path.join(BASE_DIR, "potholes")
RUNS_DIR = os.path.join(BASE_DIR, "runs", "detect", "train2")

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
    page = st.radio("Navigation", [" Detection Analysis", " Model Performance", " Data Explorer"])
    
    st.markdown("---")
    st.info("AI-powered Road Maintenance Analysis")

# --- PAGE: DETECTION ANALYSIS ---
if page == " Detection Analysis":
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
                map_df = map_data[['lat_numeric', 'lon_numeric']].rename(columns={'lat_numeric': 'lat', 'lon_numeric': 'lon'})
                st.map(map_df)
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
                                
                                st.image(img, caption=caption, width="stretch")
            else:
                st.info("No images found in potholes folder.")
        else:
            st.error("Potholes folder not found.")

# --- PAGE: MODEL PERFORMANCE ---
elif page == " Model Performance":
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
                st.image(path, caption=name, width="stretch")
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
                st.image(path, caption=name, width="stretch")
    else:
        st.info("No training batch images found.")

# --- PAGE: DATA EXPLORER ---
elif page == " Data Explorer":
    st.title(" Raw Detection Data")
    
    if not df.empty:
        st.dataframe(df, width="stretch")
        
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
