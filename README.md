# 🏙️ Digital Twin & Urban Utilization: Real-Time Road Health & Traffic System

> **An Autonomous AI-Powered Infrastructure Surveillance & Predictive Traffic Intelligence System**

---

## 📌 Executive Overview

**Digital Twin & Urban Utilization** transforms urban road management from reactive manual inspection into proactive predictive intelligence. The system combines **AI Vision Perception (YOLOv8)** with a **Multi-Factor Risk Engine (0-100 Score)**, a **3D Digital Twin City Network Map**, and a **Predictive Traffic Rerouting Simulator** to detect hazards, evaluate real-world risk, and prevent citywide traffic gridlock during road repairs.

---

## 🏗️ 4-Pillar System Architecture

1. **Perception Engine (`backend/main.py`, `ROAD.py`)**: Real-time YOLO object detection for potholes, cracks, and surface damage with automatic EXIF GPS logging.
2. **Context Engine (`risk_engine.py`)**: Multi-factor **0–100 Road Risk Score** evaluating Perception Damage (35%), Vehicle Speed (20%), Traffic Volume (15%), Road Category (10%), Weather Hazards (10%), and School/Hospital Proximity (10%).
3. **Digital Twin Map (`traffic_engine.py`)**: WebGL 3D spatial map categorizing road segments into 🟢 Healthy (0-25), 🟡 Degraded (26-50), 🟠 High Risk (51-75), and 🔴 Critical (76-100).
4. **Traffic Intelligence Simulator (`traffic_engine.py`)**: Predicts traffic flow shifts across alternate routes when a road segment is closed for maintenance (e.g., *"Closing Road A increases traffic on Road B by +46.8%"*).

---

## 📁 Clean Refined Directory Structure

```
c:\Users\keshawa kumar\TEMP\Road-Guardian-AI-\
├── backend/                                 # FastAPI Backend API Server
├── frontend/                                # React + Vite Frontend Web Application
├── risk_engine.py                           # Layer 2 Risk Score Engine
├── traffic_engine.py                        # Layer 3 & 4 Digital Twin & Traffic Simulator
├── report_generator.py                      # Municipal PDF Report Generator
├── ROAD.py                                  # Live Camera YOLO Detection Script
├── train.py                                 # Dynamic YOLO Model Trainer
├── pothole_data.csv                         # Structured Detection Log CSV
├── logo.png                                 # Application Branding Logo
└── runs/                                    # Trained Model Weights & Metrics
```

---

## 🚀 Quickstart Guide

### 1. Install Backend Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Backend Server (FastAPI)
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 3. Run Frontend Server (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### 4. Run Live Camera Stream Script
```bash
python ROAD.py
```
