from ultralytics import YOLO

model = YOLO("yolov8n.pt")

model.train(
    data=r"C:\Users\Ansh Dhiman\Desktop\Pothole.v1-raw.yolov8/data.yaml",  # your dataset path
    epochs=30,
    imgsz=640
)