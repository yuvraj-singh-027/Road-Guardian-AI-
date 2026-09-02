
import os
from ultralytics import YOLO

# Resolve dynamic paths based on the current system user & workspace
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = BASE_DIR
USER_HOME = os.path.expanduser("~")

# Automatically locate data.yaml across common dataset paths
possible_paths = [
    os.path.join(ROOT_DIR, "dataset", "data.yaml"),
    os.path.join(ROOT_DIR, "data.yaml"),
    os.path.join(USER_HOME, "Desktop", "Pothole.v1-raw.yolov8", "data.yaml"),
    os.path.join(USER_HOME, "Downloads", "Pothole.v1-raw.yolov8", "data.yaml"),
]

data_yaml_path = None 
for p in possible_paths:
    if os.path.exists(p):
        data_yaml_path = p
        break

if not data_yaml_path:
    data_yaml_path = os.path.join(USER_HOME, "Desktop", "Pothole.v1-raw.yolov8", "data.yaml")

print(f"📁 Training dataset path resolved to: {data_yaml_path}")

model = YOLO("yolov8n.pt")

model.train(
    data=data_yaml_path,
    epochs=30,
    imgsz=640
)