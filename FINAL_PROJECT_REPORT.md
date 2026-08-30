# Road Guardian AI

## 1. Introduction
Road Guardian AI is an intelligent road monitoring and maintenance system designed to detect potholes and road defects using computer vision and to assess risk levels for public infrastructure. The project integrates YOLO-based object detection, risk analysis, synthetic image rejection, and municipal reporting into a full web application.

The system helps municipalities, public works departments, and city administrators identify dangerous road segments, prioritize repair schedules, and reduce the impact of poor road conditions on road safety and traffic flow.

## 2. Problem Statement
Road conditions are often assessed manually, which is slow, inconsistent, and reactive. Damaged roads can lead to:
- vehicle accidents
- traffic congestion
- expensive repairs if delayed
- rising maintenance costs for cities

Traditional monitoring approaches are often insufficient for large urban areas. There is a need for a fast, scalable, and intelligent system that can identify road defects in real time and generate actionable reports.

## 3. Objectives
The major objectives of this project are:
1. Detect potholes and road damage from uploaded images or camera feed.
2. Assess the severity of each road defect.
3. Calculate a risk score for each detected road segment.
4. Reject fake, edited, duplicate, or AI-generated photos before processing.
5. Provide traffic rerouting suggestions for road maintenance planning.
6. Generate report-ready outputs for department use.
7. Present the system in a web dashboard for easy monitoring.

## 4. Scope of the Project
This project covers the following areas:
- image-based detection of potholes and road damage
- authenticity validation of uploaded evidence images
- risk scoring for maintenance prioritization
- digital twin-style road network visualization
- traffic rerouting simulation
- report generation for stakeholders

## 5. Functional Modules
### 5.1 Detection Module
This module loads a YOLOv8 model and identifies potholes or road damage in uploaded images. The system highlights detected defect regions with bounding boxes and calculates confidence scores.

### 5.2 Authenticity Validation Module
Before processing any uploaded image, the system analyzes whether the photo is:
- synthetic or AI-generated
- duplicated
- screen-captured or re-photographed
- digitally edited or tampered
- missing metadata or GPS information

This acts as a filter to ensure the system only processes legitimate road images.

### 5.3 Risk Calculation Module
The risk engine computes a road safety score by combining several factors such as:
- damage severity
- number of potholes
- traffic density
- road type
- weather conditions
- proximity to schools or hospitals
- vehicle speed impact

### 5.4 Traffic Simulation Module
This module models road networks and estimates traffic rerouting when a road segment is blocked or repaired. It helps city authorities plan alternative traffic movement and reduce congestion.

### 5.5 Reporting Module
The system can generate PDF summaries for departments, including:
- total scans
- pothole counts
- critical road segments
- repair priority levels
- risk analysis summary

## 6. System Architecture
The project is designed in layered form:

1. Frontend layer: React + Vite web interface
2. Backend layer: FastAPI server
3. AI detection layer: YOLOv8 model
4. Authenticity layer: metadata and image forensic checks
5. Risk engine: road score calculator
6. Traffic engine: rerouting and digital twin simulation
7. Reporting layer: PDF report generator

## 7. Technologies Used
### Frontend
- React
- Vite
- JavaScript
- Recharts
- Leaflet / map integration
- Lucide icons

### Backend
- Python
- FastAPI
- OpenCV
- NumPy
- Pillow
- Pandas
- ReportLab / FPDF

### AI / Computer Vision
- Ultralytics YOLOv8
- image processing with OpenCV
- perceptual hashing for duplicate detection
- FFT-based moiré analysis for screen-photo detection
- error-level analysis for tampering detection

## 8. Main Project Files
- backend/main.py — backend API server
- authenticity_engine.py — authenticity detection engine
- risk_engine.py — risk calculation engine
- traffic_engine.py — road network simulation
- report_generator.py — PDF generation
- ROAD.py — live camera detection script
- train.py — model training code
- README.md — quick start guide
- PROJECT_DOCUMENTATION.md — technical summary
- frontend/ — web dashboard UI

## 9. Workflow
1. The user uploads a road image or captures one from camera.
2. The image is checked for authenticity.
3. If it fails quality or authenticity checks, it is rejected.
4. If accepted, the YOLO model detects faults.
5. The risk engine calculates a road risk score.
6. The system shows the result on the dashboard.
7. Optional report generation creates a PDF for municipal use.

## 10. Authenticity Protection
One of the major features of this project is the photo authenticity filter. It blocks fake or manipulated images from entering the workflow.

It validates:
- EXIF metadata presence
- GPS geotag presence
- timestamp validity
- duplicate image detection
- screen-captured or moiré patterns
- image editing and splicing
- AI-generated synthetic image characteristics

This is important because fake road photos could mislead city systems, waste maintenance budgets, or trigger false repair orders.

## 11. Risk Scoring Logic
The system calculates a score between 0 and 100 based on multiple variables. Several factors contribute to the final risk rating:
- road damage severity
- confidence of detection
- count of potholes or defects
- vehicle speed impact
- traffic density
- road category
- weather conditions
- proximity to hospitals/schools

A higher score means greater urgency for repair and traffic intervention.

## 12. Traffic and Digital Twin Functionality
The project includes a digital-twin-style road network representation, letting the system understand how a road segment relates to other city streets. If a section is closed for repair, the traffic simulation predicts the rerouting effects across alternate routes.

This makes the system useful not only for defect detection but also for transport planning and maintenance scheduling.

## 13. Usage and Deployment
To run the application:

### Backend
```bash
cd Road-Guardian-AI-
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd Road-Guardian-AI-\frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Then open the frontend in the browser at:
- http://localhost:5173/

## 14. Testing and Validation
The project includes logic to verify the authenticity engine on synthetic images. The validation ensures that smooth, highly correlated AI-style images are rejected rather than processed.

This is a key safeguard for a civic system where the evidence image must be trustworthy.

## 15. Advantages
- reduces manual inspection burden
- provides early warnings for damaged roads
- supports public safety and maintenance planning
- improves traffic planning by simulating route changes
- reduces fraudulent or fake hazard submissions
- provides dashboard and PDF reporting for stakeholders

## 16. Limitations
- model performance depends on training quality and input image clarity
- AI-image detection is heuristic and may need further tuning
- external geocoding/weather APIs may not be available in all environments
- real-world deployment would benefit from city-specific datasets and validation

## 17. Conclusion
Road Guardian AI is a practical smart-city and public infrastructure monitoring solution. By combining computer vision, risk scoring, image authenticity validation, and traffic analytics, it offers a useful prototype for modern road maintenance and urban safety management.

It is especially valuable for cities that want to move from reactive maintenance to data-driven, predictive road management.

## 18. Final Remarks
This project demonstrates how artificial intelligence can be used in civil infrastructure management. It provides a complete pipeline from image capture to defect detection, risk assessment, rejection of fake evidence, and report generation for government departments.

The system is suitable for educational, prototype, and early deployment scenarios and can be extended into a larger municipal platform with real sensor data and a production-grade model pipeline.
