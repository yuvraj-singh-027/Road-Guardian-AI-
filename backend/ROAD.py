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
ROOT_DIR = BASE_DIR

# ================== LOAD MODEL ==================
model_path = os.path.join(ROOT_DIR, "runs", "detect", "train2", "weights", "best.pt")
model = YOLO(model_path)

# ================== SETUP ==================
folder = os.path.join(ROOT_DIR, "potholes")
os.makedirs(folder, exist_ok=True)

csv_file = os.path.join(ROOT_DIR, "pothole_data.csv")

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

# Configurable confidence threshold
CONF_THRESHOLD = 0.6

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
    # Predict with a lower confidence (0.15) and filter inside this function
    results = model.predict(frame, imgsz=416, conf=0.15, verbose=False)
    
    detections = []
    raw_detections_logged = []
    valid_indices = []
    
    h_orig, w_orig = frame.shape[:2]
    
    if len(results) > 0 and results[0].boxes is not None:
        for idx, box in enumerate(results[0].boxes):
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = results[0].names.get(cls_id, "Pothole")
            
            raw_detections_logged.append((cls_name, conf))
            
            # Validation layer:
            # 1. Class filtering (must contain pothole, damage, or crack)
            cls_lower = cls_name.lower()
            is_pothole = "pothole" in cls_lower or "damage" in cls_lower or "crack" in cls_lower
            
            # 2. Confidence filtering
            if is_pothole and conf >= CONF_THRESHOLD:
                # 3. Bounding box validation
                coords = box.xyxy[0].tolist()
                if len(coords) == 4:
                    xmin, ymin, xmax, ymax = coords
                    width = xmax - xmin
                    height = ymax - ymin
                    if width > 0 and height > 0 and xmin >= -50 and ymin >= -50 and xmax <= w_orig + 50 and ymax <= h_orig + 50:
                        detections.append(conf)
                        valid_indices.append(idx)
                        
        # Slices boxes array to keep only valid detections for plotting
        results[0].boxes = results[0].boxes[valid_indices]
        
    # Logging
    raw_count = len(raw_detections_logged)
    valid_count = len(detections)
    final_result_message = "Pothole detected" if valid_count > 0 else "No pothole detected"
    
    print(f"[ROAD Webcam Log] Raw detections: {raw_count} | Valid pothole detections: {valid_count} | Final result: {final_result_message}")
    
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
