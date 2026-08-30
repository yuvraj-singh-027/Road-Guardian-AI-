# Road Guardian AI Project Documentation

## 1. Project Overview
Road Guardian AI is an AI-powered road maintenance and traffic monitoring system designed to detect potholes and road hazards, assess risk, reject fake or AI-generated images, and support municipal reporting.

The system combines:
- Computer vision for pothole detection
- Risk scoring for road condition evaluation
- Traffic rerouting and digital twin mapping
- Photo authenticity checks to reject synthetic or fraudulent uploads
- PDF report generation for administrators and departments

## 2. Objective
The main goal is to help city authorities and maintenance teams identify damaged roads quickly, prioritize repair work, and reduce traffic disruption caused by bad road conditions.

It addresses three major needs:
- automated road defect detection
- risk-based prioritization
- evidence-backed reporting with authenticity validation

## 3. System Architecture
The project has four core layers:

### 3.1 Perception Layer
This is the AI vision layer that identifies potholes and road damage from uploaded or live camera images.

Main files:
- [backend/main.py](backend/main.py)
- [ROAD.py](ROAD.py)
- [train.py](train.py)

### 3.2 Risk Engine
This layer calculates a road risk score based on detected damage, weather, traffic, speed, and road type.

Main file:
- [risk_engine.py](risk_engine.py)

### 3.3 Digital Twin / Traffic Engine
This layer models transport segments and simulates rerouting when roads are blocked or under repair.

Main file:
- [traffic_engine.py](traffic_engine.py)

### 3.4 Authenticity Check Engine
This layer validates whether the uploaded photo is real or synthetic, edited, duplicated, or a screen capture.

Main file:
- [authenticity_engine.py](authenticity_engine.py)

## 4. Features
- Pothole and road damage detection using YOLOv8
- Real-time or uploaded image analysis
- Risk scoring from 0 to 100
- GPS and EXIF metadata validation
- Duplicate image detection using perceptual hash
- Screen re-photography detection using image analysis
- ELA-based tampering detection
- AI-generated image rejection
- Traffic rerouting simulation
- PDF report generation for civic departments
- Web dashboard for monitoring and reporting

## 5. Technology Stack
### Frontend
- React
- Vite
- JavaScript / JSX
- lucide-react
- Recharts
- Leaflet / React-Leaflet

### Backend
- FastAPI
- Python
- OpenCV
- Ultralytics YOLO
- Pillow
- NumPy
- Pandas
- ReportLab / FPDF

### Data / AI
- YOLOv8 detection model
- custom risk calculation logic
- image authenticity checks

## 6. Project Structure
```text
Road-Guardian-AI-/
├── backend/
│   └── main.py                # FastAPI backend API server
├── frontend/
│   ├── package.json           # Frontend dependencies and scripts
│   ├── vite.config.js         # Vite config
│   └── src/
│       ├── App.jsx            # App entry
│       ├── main.jsx           # React bootstrap
│       ├── index.css          # Global styling
│       └── components/        # Dashboard widgets and views
├── authenticity_engine.py     # AI-photo authenticity checks
├── risk_engine.py              # Risk scoring
├── traffic_engine.py           # Road network and rerouting simulation
├── report_generator.py         # PDF report generation
├── ROAD.py                    # Camera or live detection script
├── train.py                   # Model training script
├── requirements.txt           # Python dependencies
├── pothole_data.csv           # Detection data log
├── data/
│   └── locations.csv          # City location dataset
├── runs/
│   └── detect/
├── README.md                  # Quick start guide
├── PROJECT_DOCUMENTATION.md    # Full project documentation
└── static/
    └── index.html
```

## 7. Main API Endpoints
The backend exposes several routes to support the dashboard and data processing.

### Health APIs
- GET /api/health
  - checks whether the server is running and whether the model is loaded

### Weather APIs
- GET /api/weather
  - fetches weather info for a location

### Detection APIs
- POST /api/detect/image
  - uploads an image and performs pothole detection, risk scoring, and authenticity verification

### Authenticity APIs
- POST /api/authenticity/analyze
  - analyzes a single uploaded image for fake or synthetic content

### Traffic APIs
- GET /api/traffic/network
  - retrieves the default city traffic network
- POST /api/traffic/reroute
  - simulates route changes after road closure

### Report APIs
- POST /api/report/pdf
  - generates a PDF report for departments

## 8. Authenticity Rejection Logic
The project includes a strong image verification flow to reject suspicious images before they are processed.

It checks for:
- missing EXIF camera metadata
- missing GPS geotag
- duplicate images via perceptual hash
- screen re-photography using FFT / moiré analysis
- edited images using ELA
- AI-generated or synthetic images by texture/noise analysis

If any of these conditions are severe, the backend returns an authenticity rejection error and blocks the detection workflow.

## 9. Typical Workflow
1. User uploads a road photo or captures from camera.
2. Backend validates the image authenticity.
3. If the image is rejected as fake or edited, processing stops.
4. Otherwise, YOLO model detects potholes.
5. Risk score is calculated based on severity and context.
6. The result is displayed in the frontend dashboard.
7. Traffic and road network layers can be updated.
8. A PDF report can be generated for public works departments.

## 10. Run Instructions
### Backend
```bash
cd "Road-Guardian-AI-"
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd "Road-Guardian-AI-\frontend"
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## 11. Expected Output
The system should provide:
- pothole bounding boxes on the image
- risk assessment scores
- location information
- traffic impact analysis
- authenticity warnings or rejections when needed
- municipal-ready reports

## 12. Limitations
- Detection accuracy depends heavily on the trained model and image quality.
- Synthetic-image detection is heuristic-based and may need tuning for real-world use.
- Some live weather or geocoding calls depend on external APIs.
- The app is best suited for prototype or pilot deployment, not full-scale citywide production without further model/data validation.

## 13. Summary
Road Guardian AI is a practical smart-city prototype that combines AI road inspection, risk scoring, authenticity validation, and traffic intelligence in one system. It is useful for municipalities, public works departments, and researchers building automated road maintenance systems.

## 14. References
- [README.md](README.md)
- [backend/main.py](backend/main.py)
- [authenticity_engine.py](authenticity_engine.py)
- [risk_engine.py](risk_engine.py)
- [traffic_engine.py](traffic_engine.py)
- [report_generator.py](report_generator.py)
- [frontend/src/components/AIDetectionView.jsx](frontend/src/components/AIDetectionView.jsx)
