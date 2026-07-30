try:
    from ultralytics import YOLO
except ImportError as e:
    raise ImportError(
        "Ultralytics YOLO not found. Install it with:\n"
        "  pip install ultralytics\n"
        "or ensure your virtual environment is activated."
    ) from e
import cv2
import os
import csv
import time
from datetime import datetime
import geocoder

# Get the directory of the current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ================== LOAD MODEL ==================
model_path = os.path.join(BASE_DIR, "runs", "detect", "train2", "weights", "best.pt")
model = YOLO(model_path)

# ================== SETUP ==================
folder = os.path.join(BASE_DIR, "potholes")
os.makedirs(folder, exist_ok=True)

csv_file = os.path.join(BASE_DIR, "pothole_data.csv")

if not os.path.exists(csv_file):
    with open(csv_file, "w", newline="") as f:
        csv.writer(f).writerow(["Image", "Latitude", "Longitude", "Severity", "Confidence", "Time"])

cap = cv2.VideoCapture(0)

# SPEED OPTIMIZATION
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

count = 1
last_saved = 0
gps_cache = (None, None)
gps_time = 0

# ================== TRAE MODULE ==================

# 🔍 ANALYZE (A of TRAE)
def analyze(conf):
    if conf > 0.75:
        return "High"
    elif conf > 0.5:
        return "Medium"
    else:
        return "Low"

# TRAE ENGINE (CORE)
def TRAE_engine(frame):
    results = model.predict(frame, imgsz=416, conf=0.5, verbose=False)
    
    detections = []
    
    for box in results[0].boxes:
        conf = float(box.conf[0])
        detections.append(conf)
    
    return results, detections

# ================== MAIN LOOP ==================

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # 👉 TRAE PROCESSING
    results, detections = TRAE_engine(frame)

    detected = len(detections) > 0

    if detected:

        current_time = time.time()

        #  COOLDOWN (Decision of TRAE)
        if current_time - last_saved > 3:

            #  GPS UPDATE (Optimized)
            if current_time - gps_time > 30:
                try:
                    g = geocoder.ip('me')
                    gps_cache = g.latlng
                    gps_time = current_time
                except:
                    gps_cache = ("No Internet", "No Internet")

            lat, lon = gps_cache

            for conf in detections:

                #  ANALYSIS (TRAE)
                severity = analyze(conf)

                filename = f"{count}.jpg"
                filepath = os.path.join(folder, filename)

                #  OUTPUT (TRAE)
                frame_out = results[0].plot()
                cv2.imwrite(filepath, frame_out)

                with open(csv_file, "a", newline="") as f:
                    csv.writer(f).writerow([
                        filename,
                        lat,
                        lon,
                        severity,
                        round(conf, 2),
                        datetime.now()
                    ])

                print(f"✅ Saved {filename} | Severity: {severity}")

                count += 1

            last_saved = current_time

    # DISPLAY
    cv2.imshow("Pothole Detection", results[0].plot())

    key = cv2.waitKey(1) & 0xFF
    if key in (27, 13, 10):
        break

cap.release()
cv2.destroyAllWindows()
