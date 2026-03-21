import streamlit as st
import pandas as pd
import os
from PIL import Image

st.set_page_config(page_title="Pothole Detection Dashboard", layout="wide")

st.title("🕳️ Pothole Detection Dashboard")

# Load CSV
csv_file = "pothole_data.csv"

if os.path.exists(csv_file):
    df = pd.read_csv(csv_file)
    st.subheader("📊 Detection Data")
    st.dataframe(df, use_container_width=True)
else:
    st.warning("No data found!")

# Show images
folder = "potholes"

if os.path.exists(folder):
    st.subheader("📸 Detected Potholes")

    images = os.listdir(folder)
    images.sort()

    cols = st.columns(3)

    for i, img_name in enumerate(images):
        img_path = os.path.join(folder, img_name)
        img = Image.open(img_path)

        with cols[i % 3]:
            st.image(img, caption=img_name, use_column_width=True)
else:
    st.warning("No images found!")