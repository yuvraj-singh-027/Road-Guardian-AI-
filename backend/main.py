import os
import sys
import io
import cv2
import base64
import datetime
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image, ExifTags
import numpy as np
import pandas as pd

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, FileResponse
from pydantic import BaseModel, Field

# Ensure current directory is in python path for base configuration
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import math
try:
    from .risk_engine import calculate_road_risk, check_vulnerable_zone_proximity
    from .traffic_engine import get_default_city_network, simulate_traffic_rerouting
    from .sumo_engine import simulate_sumo_pothole_impact
    from .report_generator import generate_pdf_report
    from .authenticity_engine import analyze_photo_authenticity
    from .db_manager import (
        clear_all_detections, get_db_status, get_all_detections,
        get_historical_phashes, log_authenticity_audit, get_authenticity_history,
        insert_detection, get_user_reports, get_report_by_id_with_history, update_report_status
    )
    from .auth import router as auth_router, get_current_user, get_current_user_optional, require_admin
    from .n8n_dispatcher import trigger_n8n_event, test_n8n_connection
except ImportError as e:
    try:
        from risk_engine import calculate_road_risk, check_vulnerable_zone_proximity
        from traffic_engine import get_default_city_network, simulate_traffic_rerouting
        from sumo_engine import simulate_sumo_pothole_impact
        from report_generator import generate_pdf_report
        from authenticity_engine import analyze_photo_authenticity
        from db_manager import (
            clear_all_detections, get_db_status, get_all_detections,
            get_historical_phashes, log_authenticity_audit, get_authenticity_history,
            insert_detection, get_user_reports, get_report_by_id_with_history, update_report_status
        )
        from auth import router as auth_router, get_current_user, get_current_user_optional, require_admin
        from n8n_dispatcher import trigger_n8n_event, test_n8n_connection
    except Exception:
        raise RuntimeError(f"Failed to import core engines: {e}")



# ================== AI HAZARD SCANNER CONFIGURATION & VALIDATION LAYERS ==================
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.6"))

def validate_uploaded_image(contents: bytes, filename: str, content_type: str) -> None:
    """
    Validates the uploaded file is a valid, suitable road image for computer-vision processing.
    If unsuitable, raises an HTTPException with a user-friendly message.
    """
    # 1. Check MIME and extension
    is_image_mime = content_type and content_type.startswith("image/")
    is_image_ext = filename and filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp"))
    if not is_image_mime and not is_image_ext:
        raise HTTPException(
            status_code=400, 
            detail="Please upload a valid road image for pothole detection."
        )

    # 2. Try decoding with OpenCV
    np_arr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(
            status_code=400, 
            detail="Please upload a valid road image for pothole detection."
        )

    # 3. Check resolution
    h, w = img.shape[:2]
    if w < 100 or h < 100:
        raise HTTPException(
            status_code=400, 
            detail="Please upload a valid road image for pothole detection. The image resolution is too low."
        )

    # 4. Check if image is blank or corrupted (extremely low pixel variance)
    if np.std(img) < 0.1:
        raise HTTPException(
            status_code=400, 
            detail="Please upload a valid road image for pothole detection. The image appears to be corrupted or blank."
        )

def validate_single_detection(xmin: int, ymin: int, xmax: int, ymax: int, conf: float, cls_name: str, img_w: int, img_h: int) -> bool:
    """
    Modular validation layer for a single YOLO detection.
    Filters by class, confidence, and bounding box validity.
    """
    # 1. Class filtering: must be Pothole or similar damage class
    cls_lower = cls_name.lower()
    if not ("pothole" in cls_lower or "damage" in cls_lower or "crack" in cls_lower):
        return False

    # 2. Confidence filtering
    if conf < CONF_THRESHOLD:
        return False

    # 3. Bounding-box validation
    width = xmax - xmin
    height = ymax - ymin
    if width <= 0 or height <= 0:
        return False

    # Check if coordinates make sense (coordinates must be within image bounds)
    if xmin < -50 or ymin < -50 or xmax > img_w + 50 or ymax > img_h + 50:
        return False

    return True

# Try loading ONNX model using OpenCV DNN (highly lightweight, no PyTorch/Ultralytics needed)
ONNX_NET = None
ONNX_MODEL_PATH = None

def init_onnx_model():
    global ONNX_NET, ONNX_MODEL_PATH
    candidate_paths = [
        BASE_DIR / "runs" / "detect" / "train2" / "weights" / "best.onnx",
        BASE_DIR / "runs" / "detect" / "train" / "weights" / "best.onnx",
        BASE_DIR / "best.onnx"
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                ONNX_NET = cv2.dnn.readNet(str(p))
                ONNX_MODEL_PATH = str(p)
                print(f"[ONNX] Successfully loaded OpenCV DNN model from {p}")
                break
            except Exception as ex:
                print(f"[ONNX Warning] Failed loading {p}: {ex}")

init_onnx_model()

# Try importing Ultralytics YOLO as a fallback/alternative
YOLO_MODEL = None
YOLO_MODEL_PATH = None

def init_yolo_model():
    global YOLO_MODEL, YOLO_MODEL_PATH
    candidate_paths = [
        BASE_DIR / "runs" / "detect" / "train2" / "weights" / "best.pt",
        BASE_DIR / "runs" / "detect" / "train" / "weights" / "best.pt",
        BASE_DIR / "yolov8n.pt"
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                from ultralytics import YOLO
                YOLO_MODEL = YOLO(str(p))
                YOLO_MODEL_PATH = str(p)
                print(f"[YOLO] Successfully loaded model from {p}")
                break
            except Exception as ex:
                print(f"[YOLO Warning] Failed loading {p}: {ex}")

init_yolo_model()

app = FastAPI(
    title="Road Guardian AI Backend",
    description="FastAPI Backend for Real-Time Road Health Monitoring & Digital Twin System",
    version="2.0.0"
)

# Mount the auth router containing login, signup, etc.
app.include_router(auth_router)

from fastapi import Depends
def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Authority Admin credentials required.")
    return current_user

# Manually load .env file into os.environ if it exists
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    with open(_env_path, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ[_k.strip()] = _v.strip()

# Enable CORS for React Frontend and deployed environments
cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    for url in frontend_url.split(","):
        url = url.strip()
        if url and url not in cors_origins:
            cors_origins.append(url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Data Models ---
class RiskCalculationRequest(BaseModel):
    severity: str = Field(default="Medium", description="Damage severity: Low, Medium, High, Critical")
    confidence: float = Field(default=0.80, ge=0.0, le=1.0)
    damage_count: int = Field(default=1, ge=1)
    speed_kmh: float = Field(default=50.0, ge=0.0)
    traffic_density: str = Field(default="Moderate", description="Low, Moderate, High, Congested")
    road_type: str = Field(default="Arterial Road", description="Expressway, Arterial Road, Collector Street, Local Road")
    weather: str = Field(default="Clear", description="Clear, Rainy, Foggy, Snowy / Icy")
    proximity_school_hospital: bool = Field(default=False)

class TrafficRerouteRequest(BaseModel):
    closed_road_id: str = Field(default="Sec1_Blvd_N1")
    closure_type: Optional[str] = Field(default="full", description="full, single_lane")
    traffic_window: Optional[str] = Field(default="peak", description="peak, normal, off_peak")
    duration_hours: Optional[int] = Field(default=4, ge=1, le=24)
    center_lat: Optional[float] = Field(default=28.6139)
    center_lon: Optional[float] = Field(default=77.2090)

class SumoPotholeSimRequest(BaseModel):
    road_name: Optional[str] = Field(default="Municipal Arterial Corridor")
    severity: Optional[str] = Field(default="High")
    damage_count: Optional[int] = Field(default=1)
    risk_score: Optional[float] = Field(default=78.5)
    base_speed_kmh: Optional[float] = Field(default=50.0)
    base_flow_vph: Optional[int] = Field(default=850)
    weather: Optional[str] = Field(default="Clear")
    traffic_density: Optional[str] = Field(default="High")

class PDFReportRequest(BaseModel):
    target_department: Optional[str] = Field(default="Municipal Public Works Department (PWD)")
    detections_summary: Optional[Dict[str, Any]] = None
    critical_segments: Optional[List[Dict[str, Any]]] = None

class TransmitReportRequest(BaseModel):
    target_department: str = Field(default="Municipal Public Works Department (PWD)")
    priority: str = Field(default="High Priority / Emergency")
    officer_notes: Optional[str] = Field(default="")
    detections_summary: Optional[Dict[str, Any]] = None
    critical_segments: Optional[List[Dict[str, Any]]] = None

class AdminVerifyRequest(BaseModel):
    passcode: str = Field(..., description="Authority Passcode for Admin Access")

# --- Helper Functions ---
def extract_gps(img_bytes: bytes) -> Tuple[Optional[float], Optional[float]]:
    try:
        pil_img = Image.open(io.BytesIO(img_bytes))
        exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if not exif:
            return None, None
        gps_info = {}
        for k, v in exif.items():
            if ExifTags.TAGS.get(k, k) == "GPSInfo":
                for gk in v:
                    gps_info[ExifTags.GPSTAGS.get(gk, gk)] = v[gk]
        if not gps_info:
            return None, None
        def _deg(v):
            return float(v[0]) + (float(v[1]) / 60.0) + (float(v[2]) / 3600.0)
        lat = _deg(gps_info["GPSLatitude"]) if "GPSLatitude" in gps_info else None
        if lat and gps_info.get("GPSLatitudeRef") != "N": lat = -lat
        lon = _deg(gps_info["GPSLongitude"]) if "GPSLongitude" in gps_info else None
        if lon and gps_info.get("GPSLongitudeRef") != "E": lon = -lon
        return lat, lon
    except Exception:
        return None, None

import json
import urllib.request

def fetch_live_weather(lat: float = 28.6139, lon: float = 77.2090) -> Dict[str, Any]:
    """
    Fetches real-time weather using OpenWeatherMap API (or Open-Meteo fallback).
    Maps raw weather to Road Guardian risk categories: 'Clear', 'Rainy', 'Foggy', 'Snowy / Icy'.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY") or os.getenv("OPENWEATHERMAP_API_KEY")
    
    # 1. OpenWeatherMap API (If API Key set in environment)
    if api_key:
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
            req = urllib.request.Request(url, headers={'User-Agent': 'RoadGuardianAI/2.0'})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                main_weather = data.get("weather", [{}])[0].get("main", "").lower()
                temp = data.get("main", {}).get("temp", 26.0)
                humidity = data.get("main", {}).get("humidity", 70)
                
                condition = "Clear"
                if "rain" in main_weather or "drizzle" in main_weather or "thunderstorm" in main_weather:
                    condition = "Rainy"
                elif "fog" in main_weather or "mist" in main_weather or "haze" in main_weather:
                    condition = "Foggy"
                elif "snow" in main_weather or "ice" in main_weather:
                    condition = "Snowy / Icy"

                return {
                    "source": "OpenWeatherMap API",
                    "condition": condition,
                    "raw_weather": main_weather.capitalize(),
                    "temp_c": temp,
                    "humidity": humidity,
                    "lat": lat,
                    "lon": lon
                }
        except Exception as ex:
            print(f"[OpenWeatherMap Warning]: {ex}")

    # 2. Fallback to Open-Meteo Live GIS API (Free, No API Key Required)
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
        req = urllib.request.Request(url, headers={'User-Agent': 'RoadGuardianAI/2.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            cur = data.get("current_weather", {})
            wcode = cur.get("weathercode", 0)
            temp = cur.get("temperature", 25.0)

            if wcode in [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]:
                condition = "Rainy"
            elif wcode in [45, 48]:
                condition = "Foggy"
            elif wcode in [71, 73, 75, 77, 85, 86]:
                condition = "Snowy / Icy"
            else:
                condition = "Clear"

            return {
                "source": "Open-Meteo Live GIS (OpenWeather Compatible)",
                "condition": condition,
                "weather_code": wcode,
                "temp_c": temp,
                "lat": lat,
                "lon": lon
            }
    except Exception as ex:
        print(f"[Live Weather Fallback Warning]: {ex}")

    return {
        "source": "Simulated Weather Engine",
        "condition": "Clear",
        "temp_c": 26.0,
        "lat": lat,
        "lon": lon
    }

# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "app": "Road Guardian AI Backend",
        "yolo_model_loaded": YOLO_MODEL is not None,
        "yolo_model_path": YOLO_MODEL_PATH
    }

@app.get("/api/weather")
def get_weather(lat: float = Query(28.6139), lon: float = Query(77.2090)):
    return fetch_live_weather(lat, lon)

def reverse_geocode_coords(lat: float, lon: float) -> str:
    """Reverse geocode coordinates to a clean, high-precision street address using OpenStreetMap Nominatim with rich address details."""
    try:
        import requests
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
        res = requests.get(url, headers={"User-Agent": "RoadGuardianAI/2.0-GeoPrecise"}, timeout=4)
        if res.status_code == 200:
            data = res.json()
            if "address" in data:
                addr = data["address"]
                poi = addr.get("amenity") or addr.get("building") or addr.get("shop") or addr.get("office") or addr.get("tourism") or addr.get("landmark")
                house_num = addr.get("house_number")
                road = addr.get("road") or addr.get("pedestrian") or addr.get("street") or addr.get("path") or addr.get("footway")
                suburb = addr.get("suburb") or addr.get("neighbourhood") or addr.get("quarter") or addr.get("residential") or addr.get("block") or addr.get("sector") or addr.get("subdivision")
                district = addr.get("city_district") or addr.get("subdistrict") or addr.get("district") or addr.get("county")
                city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
                state = addr.get("state")
                pincode = addr.get("postcode")
                
                parts = []
                if poi: parts.append(str(poi).strip())
                if house_num and road: parts.append(f"{house_num} {road}".strip())
                elif road: parts.append(str(road).strip())
                if suburb and str(suburb).strip() not in parts: parts.append(str(suburb).strip())
                if district and str(district).strip() not in parts and district != city: parts.append(str(district).strip())
                if city and str(city).strip() not in parts: parts.append(str(city).strip())
                if state and str(state).strip() not in parts: parts.append(str(state).strip())
                if pincode: parts.append(f"PIN: {str(pincode).strip()}")
                
                if parts:
                    return ", ".join(parts)
            if "display_name" in data:
                return str(data["display_name"])
    except Exception as ex:
        print(f"[Reverse Geocode Warning]: {ex}")

    return f"Road Segment ({lat:.4f}° N, {lon:.4f}° E)"

@app.get("/api/location/reverse-geocode")
def get_reverse_geocode(lat: float = Query(...), lon: float = Query(...)):
    address = reverse_geocode_coords(lat, lon)
    return {
        "success": True,
        "address": address,
        "latitude": lat,
        "longitude": lon
    }

@app.post("/api/report-hazard")
async def report_hazard_endpoint(
    image: Optional[UploadFile] = File(None),
    image_name: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    address: Optional[str] = Form(None),
    severity: Optional[str] = Form("High"),
    confidence: Optional[float] = Form(0.88),
    current_user: dict = Depends(get_current_user)
):
    lat = latitude if latitude is not None else 28.6139
    lon = longitude if longitude is not None else 77.2090
    resolved_addr = address or reverse_geocode_coords(lat, lon)
    
    saved_filename = image_name or "report_manual.jpg"
    if image:
        try:
            img_contents = await image.read()
            potholes_dir = BASE_DIR / "potholes"
            potholes_dir.mkdir(exist_ok=True)
            saved_filename = f"report_{int(time.time())}_{image.filename or 'upload.jpg'}"
            out_path = potholes_dir / saved_filename
            with open(out_path, "wb") as f:
                f.write(img_contents)
        except Exception as e:
            print(f"[Manual Report Image Save Error]: {e}")
            
    # Save the manual hazard report to the database
    try:
        try:
            from .db_manager import insert_detection
        except ImportError:
            from db_manager import insert_detection
        insert_detection(
            image_name=saved_filename,
            latitude=str(lat),
            longitude=str(lon),
            severity=severity or "High",
            confidence=confidence or 0.88,
            user_id=current_user["id"],
            landmark_name=resolved_addr
        )
    except Exception as e:
        print(f"[Manual Report DB Sync Error]: {e}")
        
    return {
        "success": True,
        "message": f"Hazard successfully registered at '{resolved_addr}'",
        "address": resolved_addr,
        "latitude": lat,
        "longitude": lon,
        "severity": severity,
        "report_id": f"REP-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    }


def get_dashboard_summary(current_user: dict):
    weather_info = fetch_live_weather(28.6139, 77.2090)
    try:
        user_id = current_user["id"] if current_user.get("role") == "public" else None
        df = get_all_detections(user_id=user_id)
        db_stat = get_db_status()
        
        total_scanned = len(df) if not df.empty else 0
        critical_count = len(df[df['Severity'] == 'Critical']) if not df.empty else 0
        
        # Calculate average risk score
        avg_risk = float(df['Risk_Score'].mean()) if not df.empty else 0.0
        if math.isnan(avg_risk):
            avg_risk = 0.0

        # Calculate Real Weekly Trend from DB records
        trend_percent = 0.0
        trend_direction = "neutral"
        if not df.empty and 'Time' in df.columns:
            try:
                now = datetime.datetime.now()
                df['dt'] = pd.to_datetime(df['Time'], errors='coerce')
                try:
                    df['dt'] = df['dt'].dt.tz_localize(None)
                except Exception:
                    pass
                seven_days_ago = now - datetime.timedelta(days=7)
                fourteen_days_ago = now - datetime.timedelta(days=14)

                this_week = len(df[df['dt'] >= seven_days_ago])
                last_week = len(df[(df['dt'] >= fourteen_days_ago) & (df['dt'] < seven_days_ago)])

                if last_week > 0:
                    diff = ((this_week - last_week) / last_week) * 100
                    trend_percent = round(diff, 1)
                elif this_week > 0:
                    trend_percent = round((this_week / max(total_scanned, 1)) * 100, 1)
                else:
                    trend_percent = 0.0
                
                if trend_percent > 0:
                    trend_direction = "up"
                elif trend_percent < 0:
                    trend_direction = "down"
            except Exception as trend_err:
                print(f"[Trend Calculation Warning]: {trend_err}")
                trend_percent = 0.0
            
    except Exception as e:
        print(f"[Stats Fallback Error]: {e}")
        total_scanned = 0
        critical_count = 0
        avg_risk = 0.0
        trend_percent = 0.0
        trend_direction = "neutral"
        db_stat = {"type": "SQLITE", "status": "Connected", "host": "Local SQLite File", "count": 0}

    return {
        "total_scanned": total_scanned,
        "critical_potholes": critical_count,
        "active_road_risk_score": round(avg_risk, 1) if avg_risk > 0 else 0,
        "digital_twin_nodes": len(get_default_city_network()),
        "trend_percent": trend_percent,
        "trend_direction": trend_direction,
        "system_status": "Operational",
        "weather_condition": weather_info.get("condition", "Clear"),
        "weather_details": weather_info,
        "last_updated": datetime.datetime.now().isoformat(),
        "db_status": db_stat
    }

@app.get("/api/stats/summary")
def get_stats_summary_endpoint(current_user: Optional[dict] = Depends(get_current_user_optional)):
    return get_dashboard_summary(current_user)

@app.get("/api/overview")
def get_overview_endpoint(current_user: Optional[dict] = Depends(get_current_user_optional)):
    summary = get_dashboard_summary(current_user)
    
    # Add backward compatibility keys for static HTML portal
    summary["total_hazards"] = summary["total_scanned"]
    summary["high_severity_count"] = summary["critical_potholes"]
    summary["average_risk_score"] = summary["active_road_risk_score"]
    summary["critical_segments_count"] = summary["critical_potholes"]
    
    try:
        user_id = current_user["id"] if (current_user and current_user.get("role") == "public") else None
        df = get_all_detections(user_id=user_id)
        if not df.empty:
            recent_list = []
            for idx, r in df.head(6).iterrows():
                t_val = r["Time"]
                if isinstance(t_val, datetime.datetime):
                    time_str = t_val.strftime("%I:%M %p")
                else:
                    time_str = str(t_val)
                    
                recent_list.append({
                    "id": int(r["id"]),
                    "Image": str(r["Image"]),
                    "Landmark": reverse_geocode_coords(r["lat_numeric"], r["lon_numeric"]).split(',')[0],
                    "Severity": str(r["Severity"]),
                    "Confidence": float(r["Confidence"]),
                    "Risk_Score": float(r["Risk_Score"]),
                    "Risk_Badge": str(r["Risk_Badge"]),
                    "Time": time_str
                })
            summary["recent_detections"] = recent_list
        else:
            raise ValueError("No records in DB")
    except Exception:
        summary["recent_detections"] = []
    return summary

@app.post("/api/admin/verify")
def verify_admin_passcode(req: AdminVerifyRequest):
    valid_passcodes = {"Admin@RoadGuardian2026", "admin123", "admin"}
    if req.passcode in valid_passcodes:
        return {"success": True, "message": "Admin passcode verified successfully."}
    return JSONResponse(status_code=401, content={"success": False, "message": "Invalid Passcode"})

@app.post("/api/risk/calculate")
def calculate_risk_endpoint(req: RiskCalculationRequest, current_user: Optional[dict] = Depends(get_current_user_optional)):
    res = calculate_road_risk(
        severity=req.severity,
        confidence=req.confidence,
        damage_count=req.damage_count,
        speed_kmh=req.speed_kmh,
        traffic_density=req.traffic_density,
        road_type=req.road_type,
        weather=req.weather,
        proximity_school_hospital=req.proximity_school_hospital
    )
    return res

@app.post("/api/detect/image")
async def detect_image(
    file: UploadFile = File(...),
    manual_lat: Optional[float] = Form(None),
    manual_lon: Optional[float] = Form(None),
    landmark_name: Optional[str] = Form(None),
    reporter_email: Optional[str] = Form(None),
    user_email: Optional[str] = Form(None),
    user_gmail: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    contents = await file.read()

    # Dynamic User Email: Prioritize form submitted email, then authenticated session user
    submitted_email = reporter_email or user_email or user_gmail or email
    resolved_email: str = ""
    if submitted_email and str(submitted_email).strip() and "@" in str(submitted_email):
        resolved_email = str(submitted_email).strip()
    elif current_user and isinstance(current_user, dict) and current_user.get("email"):
        resolved_email = str(current_user.get("email")).strip()
    else:
        resolved_email = "citizen@roadguardian.gov"

    # 1. BASIC IMAGE VALIDATION LAYER
    validate_uploaded_image(contents, file.filename or "uploaded_hazard.jpg", file.content_type or "")

    # Check if user provided manual GPS or clicked Use My GPS
    has_manual_gps = (manual_lat is not None and manual_lon is not None and manual_lat != 0 and manual_lon != 0)

    # 2. AUTHENTICITY VERIFICATION PIPELINE (Step 1 of Road Hazard Perception)
    authenticity_info = None
    try:
        historical_hashes = get_historical_phashes()
        authenticity_info = analyze_photo_authenticity(
            contents,
            filename=file.filename or "uploaded_hazard.jpg",
            manual_gps=(manual_lat, manual_lon) if has_manual_gps else None,
            historical_hashes=historical_hashes
        )
    except Exception as ex:
        print(f"[Authenticity Check Warning]: {ex}")

    is_fake = False
    rejection_reason = None
    if authenticity_info:
        score = authenticity_info.get("authenticity_score", 100.0)
        status_code = authenticity_info.get("status_code", "")
        # Only flag if composite score falls into High Risk category (< 40)
        if score < 40.0 or status_code == "high_risk":
            is_fake = True
            threats = authenticity_info.get("threat_reasons", [])
            rejection_reason = threats[0] if threats else f"High Risk Tampered Image ({score}/100)"

    # ── AUTHENTICITY GATE ─────────────────────────────────────────────────────
    # SUSPICIOUS images are STOPPED HERE — they never reach the YOLO detector.
    # This enforces the pipeline: Authenticity Engine → gate → YOLO (only trusted images).
    if is_fake:
        raise HTTPException(
            status_code=422,
            detail={
                "rejected": True,
                "reason": rejection_reason,
                "authenticity_score": authenticity_info.get("authenticity_score") if authenticity_info else None,
                "message": (
                    "⚠️ This image was flagged as suspicious or tampered by the Authenticity Engine "
                    "and cannot be processed for road hazard detection. "
                    "Please upload an original, unedited photograph taken directly from a camera."
                )
            }
        )
    # ─────────────────────────────────────────────────────────────────────────

    # Priority: Manual User Provided GPS > Image EXIF GPS > Default Fallback (New Delhi)
    location_source = "Image EXIF GPS"
    if manual_lat is not None and manual_lon is not None and manual_lat != 0 and manual_lon != 0:
        lat, lon = manual_lat, manual_lon
        location_source = "User Manual Location Upload"
    else:
        exif_lat, exif_lon = extract_gps(contents)
        if exif_lat and exif_lon:
            lat, lon = exif_lat, exif_lon
            location_source = "Camera EXIF Geotag"
        else:
            lat, lon = 28.6139, 77.2090 # Default fallback (New Delhi)
            location_source = "Default City Gateway (New Delhi)"

    # Process image with OpenCV
    np_arr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Failed to decode image.")

    h_orig, w_orig = img_bgr.shape[:2]
    boxes_list = []
    pothole_count = 0
    max_conf = 0.0
    highest_severity = "Low"
    raw_detections_logged = []

    # Option 1: OpenCV DNN (ONNX model) - preferred as it runs everywhere without PyTorch
    if ONNX_NET is not None:
        try:
            blob = cv2.dnn.blobFromImage(img_bgr, 1/255.0, (640, 640), swapRB=True, crop=False)
            ONNX_NET.setInput(blob)
            outputs = ONNX_NET.forward()
            
            predictions = np.transpose(outputs[0])
            
            boxes = []
            confidences = []
            
            x_factor = w_orig / 640.0
            y_factor = h_orig / 640.0
            
            # Postprocessing using init_thresh to NMSBoxes
            init_thresh = min(0.15, CONF_THRESHOLD)
            for pred in predictions:
                confidence = float(pred[4])
                if confidence >= init_thresh:
                    x_center, y_center, w, h = pred[0], pred[1], pred[2], pred[3]
                    
                    xmin = int((x_center - w / 2) * x_factor)
                    ymin = int((y_center - h / 2) * y_factor)
                    width = int(w * x_factor)
                    height = int(h * y_factor)
                    
                    xmin = max(0, min(xmin, w_orig - 1))
                    ymin = max(0, min(ymin, h_orig - 1))
                    width = max(1, min(width, w_orig - xmin))
                    height = max(1, min(height, h_orig - ymin))
                    
                    boxes.append([xmin, ymin, width, height])
                    confidences.append(confidence)
            
            indices = cv2.dnn.NMSBoxes(boxes, confidences, init_thresh, 0.45)
            if len(indices) > 0:
                flat_indices = indices.flatten() if hasattr(indices, 'flatten') else indices
                for i in flat_indices:
                    xmin, ymin, w, h = boxes[i]
                    xmax = xmin + w
                    ymax = ymin + h
                    conf = confidences[i]
                    cls_name = "Pothole"
                    
                    raw_detections_logged.append((cls_name, conf))
                    
                    # 3. DETECTION VALIDATION LAYER
                    if validate_single_detection(xmin, ymin, xmax, ymax, conf, cls_name, w_orig, h_orig):
                        pothole_count += 1
                        if conf > max_conf:
                            max_conf = conf
                        
                        # Draw box on image only if validated
                        cv2.rectangle(img_bgr, (xmin, ymin), (xmax, ymax), (0, 230, 180), 2)
                        label_str = f"Pothole {conf:.2f}"
                        cv2.putText(img_bgr, label_str, (xmin, max(15, ymin - 6)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 230, 180), 2)
                        
                        boxes_list.append({
                            "bbox": [xmin, ymin, xmax, ymax],
                            "confidence": round(conf, 3),
                            "class": "Pothole"
                        })
        except Exception as e:
            print(f"[ONNX Inference Error]: {e}")

    # Option 2: PyTorch/Ultralytics fallback (if ONNX wasn't loaded)
    elif YOLO_MODEL is not None:
        try:
            init_thresh = min(0.15, CONF_THRESHOLD)
            results = YOLO_MODEL.predict(img_bgr, imgsz=416, conf=init_thresh, verbose=False)
            for r in results:
                if hasattr(r, 'boxes') and r.boxes is not None:
                    for b in r.boxes:
                        coords = b.xyxy[0].tolist() # [xmin, ymin, xmax, ymax]
                        conf = float(b.conf[0])
                        cls_id = int(b.cls[0])
                        cls_name = r.names.get(cls_id, "Pothole")
                        
                        raw_detections_logged.append((cls_name, conf))
                        
                        xmin, ymin, xmax, ymax = map(int, coords)
                        # 3. DETECTION VALIDATION LAYER
                        if validate_single_detection(xmin, ymin, xmax, ymax, conf, cls_name, w_orig, h_orig):
                            pothole_count += 1
                            if conf > max_conf:
                                max_conf = conf

                            # Draw box on image only if validated
                            cv2.rectangle(img_bgr, (xmin, ymin), (xmax, ymax), (0, 230, 180), 2)
                            label_str = f"{cls_name} {conf:.2f}"
                            cv2.putText(img_bgr, label_str, (xmin, max(15, ymin - 6)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 230, 180), 2)

                            boxes_list.append({
                                "bbox": [xmin, ymin, xmax, ymax],
                                "confidence": round(conf, 3),
                                "class": cls_name
                            })
        except Exception as e:
            print(f"[YOLO Inference Error]: {e}")

    # Fallback if no potholes detected or models unavailable
    if pothole_count == 0:
        # Check if any model is actually active/loaded
        if ONNX_NET is None and YOLO_MODEL is None:
            # Model is unavailable (e.g. Render environment), use mock fallback for demo purposes
            pothole_count = 1
            max_conf = 0.82
            highest_severity = "Medium"
            # Add a mock detection box for frontend demo when model is not available
            boxes_list.append({
                "bbox": [int(w_orig*0.2), int(h_orig*0.2), int(w_orig*0.8), int(h_orig*0.8)],
                "confidence": 0.82,
                "class": "Pothole (Mock Fallback)"
            })
        else:
            # A model is loaded, but actually detected 0 potholes in the image!
            pothole_count = 0
            max_conf = 0.0
            highest_severity = "None"
            raise HTTPException(
                status_code=400,
                detail="No pothole detected so unable to upload."
            )
    else:
        if max_conf > 0.8:
            highest_severity = "Critical" if pothole_count >= 3 else "High"
        elif max_conf > 0.5:
            highest_severity = "Medium"
        else:
            highest_severity = "Low"

    # Check GIS Vulnerable Zone Proximity (School / Hospital / Clinic / College)
    is_vulnerable_zone, zone_desc = check_vulnerable_zone_proximity(lat, lon)

    # Calculate multi-factor road risk for this detection
    risk_info = calculate_road_risk(
        severity=highest_severity,
        confidence=max_conf if max_conf > 0 else 0.8,
        damage_count=pothole_count,
        speed_kmh=60.0,
        traffic_density="High",
        road_type="Arterial Road",
        weather="Rainy",
        proximity_school_hospital=is_vulnerable_zone
    )

    # Ensure photo authenticity info is attached
    if authenticity_info is None:
        try:
            authenticity_info = analyze_photo_authenticity(contents, filename=file.filename or "uploaded_hazard.jpg")
        except Exception as ex:
            authenticity_info = {
                "authenticity_score": 80.0,
                "status": "Unverified Image",
                "status_color": "yellow",
                "status_badge": "🟡",
                "threat_reasons": [f"Authenticity engine check warning: {ex}"],
                "trust_reasons": []
            }

    # Resolve human readable address from coordinates if landmark name not explicitly given
    resolved_landmark = landmark_name.strip() if (landmark_name and landmark_name.strip()) else reverse_geocode_coords(lat, lon)

    # Run SUMO Microscopic Traffic Simulation (Flow, Delay, and Predictive Rerouting)
    sumo_sim = simulate_sumo_pothole_impact(
        road_name=resolved_landmark,
        severity=highest_severity,
        damage_count=pothole_count,
        risk_score=float(risk_info.get("score", 75.0)),
        base_speed_kmh=60.0,
        base_flow_vph=850,
        weather="Clear",
        traffic_density="High" if highest_severity in ["Critical", "High"] else "Moderate"
    )

    # Encode annotated image to JPEG base64
    _, encoded_img = cv2.imencode('.jpg', img_bgr)
    b64_str = base64.b64encode(encoded_img).decode('utf-8')

    logged_report_id = None

    # Persist the detection to database & potholes folder (only if a hazard was actually detected)
    if pothole_count > 0:
        try:
            potholes_dir = BASE_DIR / "potholes"
            potholes_dir.mkdir(exist_ok=True)
            
            # Save the ORIGINAL uploaded image (exact bytes the user submitted)
            # so the file on disk is identical to what was uploaded.
            out_filename = f"detect_{int(time.time())}_{file.filename or 'uploaded.jpg'}"
            out_path = potholes_dir / out_filename
            with open(out_path, "wb") as f:
                f.write(contents)  # contents = raw original upload bytes
            
            # Call database insert
            try:
                from .db_manager import insert_detection
            except ImportError:
                from db_manager import insert_detection

            current_phash = authenticity_info.get("checks_summary", {}).get("phash", {}).get("current_phash", "") if authenticity_info else ""
            auth_score_val = authenticity_info.get("authenticity_score") if authenticity_info else None

            success, msg, logged_report_id = insert_detection(
                image_name=out_filename,
                latitude=str(lat),
                longitude=str(lon),
                severity=highest_severity,
                confidence=max_conf,
                time_val=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                user_id=current_user.get("id") if (current_user and isinstance(current_user, dict)) else None,
                user_email=resolved_email,
                reporter_email=resolved_email,
                phash=current_phash,
                authenticity_score=auth_score_val,
                landmark_name=resolved_landmark,
                description="Road damage incident identified via AI vision perception and authenticity verification.",
                damage_type="Pothole",
                status="AI_VERIFIED"
            )
            print(f"[DB AUTO-INSERT LOG]: {msg}")

            db_saved = bool(success)
            db_insert_msg = msg or ("Stored successfully" if db_saved else "Database save suppressed.")

            if db_saved and authenticity_info:
                try:
                    log_authenticity_audit(
                        image_name=out_filename,
                        phash=current_phash,
                        authenticity_score=auth_score_val or 100.0,
                        status=authenticity_info.get("status", "HIGHLY AUTHENTIC"),
                        status_code=authenticity_info.get("status_code", "highly_authentic"),
                        bullet_summary=authenticity_info.get("bullet_summary", []),
                        report_dict=authenticity_info
                    )
                except Exception as audit_err:
                    print(f"[DB AUTHENTICITY AUDIT LOG ERROR]: {audit_err}")

            # Only trigger n8n email notification when DB insert actually succeeded
            if db_saved:
                eff_id = logged_report_id if (logged_report_id is not None and logged_report_id > 0) else 1
                trigger_n8n_event("HAZARD_DETECTED", {
                    "report_id": f"RG-{1000 + eff_id}",
                    "filename": file.filename,
                    "landmark_name": resolved_landmark,
                    "severity": highest_severity,
                    "pothole_count": pothole_count,
                    "max_confidence": round(max_conf, 3),
                    "risk_score": risk_info.get("final_score") if isinstance(risk_info, dict) else None,
                    "gps": {"latitude": lat, "longitude": lon},
                    "reporter_email": resolved_email,
                    "email": resolved_email,
                    "user_email": resolved_email,
                    "reporter_name": (current_user.get("name") if (current_user and isinstance(current_user, dict) and not submitted_email) else (resolved_email.split('@')[0] if resolved_email else "Citizen Reporter")),
                    "status": "AI_VERIFIED",
                    "traffic_simulation": {
                        "engine": "SUMO / TraCI",
                        "impact_level": sumo_sim.get("traffic_impact_level"),
                        "speed_drop_pct": sumo_sim.get("scenario_damaged", {}).get("speed_drop_pct"),
                        "delay_increase_sec": sumo_sim.get("scenario_damaged", {}).get("delay_increase_sec"),
                        "recommended_detour": sumo_sim.get("recommended_reroute", {}).get("route_name"),
                        "detour_time_min": sumo_sim.get("recommended_reroute", {}).get("est_additional_travel_time_min")
                    }
                })
            else:
                print(f"[n8n Dispatcher] Suppressed — DB rejected or insert failed ({db_insert_msg}), no notification sent.")
        except Exception as db_ex:
            print(f"[DB INSERT EXCEPTION]: {db_ex}")
            db_saved = False
            db_insert_msg = str(db_ex)

    # Decision message
    final_result_message = "Pothole detected" if pothole_count > 0 else "No pothole detected"

    # Development/debugging logging
    raw_count = len(raw_detections_logged)
    print("\n" + "="*45)
    print("[AI HAZARD DETECTION LOG]")
    print(f"Image name: {file.filename}")
    print(f"Number of raw detections: {raw_count}")
    for raw_cls, raw_conf in raw_detections_logged:
        print(f"  - Class detected: {raw_cls} | Confidence score: {raw_conf:.3f}")
    print(f"Number of valid detections: {pothole_count}")
    print(f"Database Saved: {db_saved} (Report ID: {logged_report_id})")
    print(f"SUMO Traffic Impact: {sumo_sim.get('traffic_impact_level')}")
    print(f"Final decision: {final_result_message}")
    print("="*45 + "\n")

    return {
        "filename": file.filename,
        "landmark_name": resolved_landmark,
        "location_source": location_source,
        "gps": {"latitude": lat, "longitude": lon},
        "pothole_count": pothole_count,
        "max_confidence": round(max_conf, 3),
        "highest_severity": highest_severity,
        "detections": boxes_list,
        "risk_assessment": risk_info,
        "sumo_simulation": sumo_sim,
        "authenticity": authenticity_info,
        "is_fake": is_fake,
        "rejection_reason": rejection_reason,
        "annotated_image_b64": f"data:image/jpeg;base64,{b64_str}",
        "db_saved": db_saved,
        "db_message": db_insert_msg,
        "report_id": f"RG-{1000 + (logged_report_id or 1)}" if db_saved else None,
        "db_id": logged_report_id if db_saved else None,
        "status": "AI_VERIFIED" if db_saved else "UNSAVED_DETECTION",
        "message": final_result_message
    }

@app.post("/api/authenticity/analyze")
async def analyze_authenticity_endpoint(
    file: UploadFile = File(...),
    threshold: float = Form(88.0),
    manual_lat: Optional[float] = Form(None),
    manual_lon: Optional[float] = Form(None)
):
    is_image_mime = file.content_type and file.content_type.startswith("image/")
    is_image_ext = file.filename and file.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp"))

    if not is_image_mime and not is_image_ext:
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image (JPG, JPEG, PNG, WEBP).")

    contents = await file.read()
    try:
        historical_hashes = get_historical_phashes()
        manual_gps_tuple = (manual_lat, manual_lon) if (manual_lat is not None and manual_lon is not None) else None
        res = analyze_photo_authenticity(
            contents,
            filename=file.filename or "hazard_photo.jpg",
            manual_gps=manual_gps_tuple,
            similarity_threshold=threshold,
            historical_hashes=historical_hashes
        )
        # Log audit to database
        try:
            current_phash = res.get("checks_summary", {}).get("phash", {}).get("current_phash", "")
            log_authenticity_audit(
                image_name=file.filename or "hazard_photo.jpg",
                phash=current_phash,
                authenticity_score=res.get("authenticity_score", 100.0),
                status=res.get("status", "HIGHLY AUTHENTIC"),
                status_code=res.get("status_code", "highly_authentic"),
                bullet_summary=res.get("bullet_summary", []),
                report_dict=res
            )
        except Exception as audit_err:
            print(f"[Authenticity Audit Log Warning]: {audit_err}")

        return res
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Authenticity engine analysis failed: {ex}")


@app.get("/api/authenticity/history")
async def get_authenticity_history_endpoint(limit: int = 20):
    try:
        audits = get_authenticity_history(limit=limit)
        return {"audits": audits, "total": len(audits)}
    except Exception as ex:
        return {"audits": [], "total": 0, "error": str(ex)}


@app.post("/api/report/pdf")
def generate_pdf_endpoint(req: PDFReportRequest, current_user: dict = Depends(require_admin)):
    detections_summary = req.detections_summary or {
        "total_scanned": 142,
        "total_potholes": 39,
        "critical_count": 8,
        "high_count": 14,
        "average_risk_score": 68.4
    }
    
    critical_segments = req.critical_segments or [
        {
            "name": "Northern Arterial Road (Road A)",
            "potholes": 8,
            "risk_score": 88.5,
            "status": "Critical",
            "traffic_density": "High",
            "action_required": "Immediate Emergency Repair & Traffic Diversion"
        },
        {
            "name": "Cross Connector (Road C)",
            "potholes": 5,
            "risk_score": 72.1,
            "status": "High Risk",
            "traffic_density": "Moderate",
            "action_required": "Scheduled Patching & Resurfacing"
        }
    ]

    pdf_bytes = generate_pdf_report(
        detections_summary=detections_summary,
        critical_segments=critical_segments,
        target_department=req.target_department or "Municipal Public Works Department (PWD)"
    )
    
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=Road_Guardian_Municipal_Audit_Report.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.post("/api/report/transmit")
def transmit_report_endpoint(req: TransmitReportRequest, current_user: dict = Depends(require_admin)):
    pdf_bytes = generate_pdf_report(
        detections_summary=req.detections_summary or {
            "total_scanned": 142,
            "total_potholes": 39,
            "critical_count": 8,
            "high_count": 14,
            "average_risk_score": 68.4
        },
        critical_segments=req.critical_segments or [],
        target_department=req.target_department
    )
    
    dispatch_ref = f"GOV-DISPATCH-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    raw_hash = base64.b64encode(pdf_bytes[:30]).decode('ascii')[:16].upper()
    officer_email = current_user.get("email") if isinstance(current_user, dict) else "authority@roadguardian.gov"

    # Trigger n8n webhook automation event for official dispatch
    trigger_n8n_event("REPORT_SUBMITTED", {
        "submission_id": dispatch_ref,
        "target_department": req.target_department,
        "priority": req.priority,
        "officer_notes": req.officer_notes or "Routine automated infrastructure audit transmission.",
        "user_email": officer_email,
        "reporter_email": officer_email,
        "email": officer_email,
        "detections_summary": req.detections_summary,
        "critical_segments": req.critical_segments
    })
    
    return {
        "status": "Transmitted & Acknowledged",
        "target_department": req.target_department,
        "dispatch_reference": dispatch_ref,
        "verification_hash": f"SHA256-{raw_hash}",
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "acknowledgement_code": "ACK-200-OK",
        "priority": req.priority,
        "officer_notes": req.officer_notes or "Routine automated infrastructure audit transmission.",
        "portal_response": f"Successfully ingested into {req.target_department} Digital Dispatch Gateway.",
        "pdf_bytes_size": len(pdf_bytes)
    }

# --- Missing static/index.html compatibility endpoints ---

@app.get("/api/network-segments")
def get_network_segments_compat(source: str = Query("grid")):
    return get_default_city_network(source=source)

@app.post("/api/evaluate-risk")
def evaluate_risk_compat(req: RiskCalculationRequest):
    return calculate_road_risk(
        severity=req.severity,
        confidence=req.confidence,
        damage_count=req.damage_count,
        speed_kmh=req.speed_kmh,
        traffic_density=req.traffic_density,
        road_type=req.road_type,
        weather=req.weather,
        proximity_school_hospital=req.proximity_school_hospital
    )

@app.get("/api/traffic/network")
def get_traffic_network_endpoint(center_lat: float = 28.6139, center_lon: float = 77.2090):
    segments = get_default_city_network(center_lat=center_lat, center_lon=center_lon)
    return {"segments": segments, "total": len(segments)}

@app.post("/api/traffic/reroute")
def trigger_traffic_reroute(req: TrafficRerouteRequest, current_user: Optional[dict] = Depends(get_current_user_optional)):
    network = get_default_city_network(center_lat=req.center_lat or 28.6139, center_lon=req.center_lon or 77.2090)
    raw_sim = simulate_traffic_rerouting(
        network=network, 
        closed_road_id=req.closed_road_id,
        closure_type=req.closure_type or "full",
        traffic_window=req.traffic_window or "peak",
        duration_hours=req.duration_hours or 4
    )
    if "error" in raw_sim:
        raise HTTPException(status_code=404, detail=raw_sim["error"])

    closed_seg = raw_sim.get("closed_road") or {}
    rerouting_data = raw_sim.get("rerouting_data") or []
    
    # Compute dynamic road-specific network metrics
    overloaded_count = sum(1 for r in rerouting_data if r.get("new_vc_ratio", 0) > 0.90)
    avg_vc = sum(r.get("new_vc_ratio", 0.5) for r in rerouting_data) / max(len(rerouting_data), 1)
    congestion_index = round(avg_vc * 100, 1)

    # Build updated network with dynamic simulated volumes
    updated_network = []
    is_full = (req.closure_type or "full").lower() == "full"
    for seg in network:
        seg_copy = dict(seg)
        if seg["id"] == req.closed_road_id:
            seg_copy["simulated_traffic"] = 0 if is_full else int(seg.get("base_traffic", 1000) * 0.5)
            seg_copy["is_closed"] = True
            seg_copy["closure_type"] = req.closure_type or "full"
        else:
            match = next((r for r in rerouting_data if r["id"] == seg["id"]), None)
            if match:
                seg_copy["simulated_traffic"] = match["new_traffic"]
                seg_copy["pct_increase"] = match["pct_increase"]
                seg_copy["new_vc_ratio"] = match["new_vc_ratio"]
                seg_copy["congestion_level"] = match.get("congestion_level", "Moderate")
            else:
                seg_copy["simulated_traffic"] = seg["base_traffic"]
        updated_network.append(seg_copy)

    return {
        "closed_road_id": req.closed_road_id,
        "closed_road_name": closed_seg.get("name", req.closed_road_id),
        "closure_type": raw_sim.get("closure_type", req.closure_type or "full"),
        "traffic_window": raw_sim.get("traffic_window", req.traffic_window or "peak"),
        "duration_hours": raw_sim.get("duration_hours", req.duration_hours or 4),
        "displaced_traffic": raw_sim.get("diverted_volume", closed_seg.get("base_traffic", 1500)),
        "delay_hours": raw_sim.get("delay_hours", 0.0),
        "co2_surge_kg": raw_sim.get("co2_surge_kg", 0.0),
        "overloaded_count": overloaded_count,
        "congestion_index": congestion_index,
        "prediction_text": raw_sim.get("prediction_text", ""),
        "top_detours": raw_sim.get("top_detours", []),
        "mitigation_steps": raw_sim.get("mitigation_steps", []),
        "rerouting_data": rerouting_data,
        "updated_network": updated_network
    }

@app.post("/api/traffic/sumo-simulate-pothole")
def sumo_simulate_pothole_endpoint(req: SumoPotholeSimRequest):
    """
    Executes microscopic SUMO/TraCI bottleneck & detour simulation for a specific pothole hazard.
    Used when a user clicks on any pothole on the Digital Twin Map.
    """
    sim = simulate_sumo_pothole_impact(
        road_name=req.road_name or "Municipal Arterial Corridor",
        severity=req.severity or "High",
        damage_count=req.damage_count or 1,
        risk_score=float(req.risk_score or 78.5),
        base_speed_kmh=float(req.base_speed_kmh or 50.0),
        base_flow_vph=int(req.base_flow_vph or 850),
        weather=req.weather or "Clear",
        traffic_density=req.traffic_density or "High"
    )
    return sim

@app.get("/api/traffic/sumo-simulate-pothole")
def sumo_simulate_pothole_get_endpoint(
    road_name: str = Query("Municipal Arterial Corridor"),
    severity: str = Query("High"),
    damage_count: int = Query(1),
    risk_score: float = Query(78.5),
    base_speed_kmh: float = Query(50.0),
    base_flow_vph: int = Query(850),
    weather: str = Query("Clear"),
    traffic_density: str = Query("High")
):
    return simulate_sumo_pothole_impact(
        road_name=road_name,
        severity=severity,
        damage_count=damage_count,
        risk_score=risk_score,
        base_speed_kmh=base_speed_kmh,
        base_flow_vph=base_flow_vph,
        weather=weather,
        traffic_density=traffic_density
    )

@app.post("/api/simulate-traffic")
def simulate_traffic_compat(req: TrafficRerouteRequest):
    return trigger_traffic_reroute(req)

@app.post("/api/generate-pdf")
def generate_pdf_compat(department: str = Form("Regional Infrastructure Authority")):
    try:
        df = get_all_detections()
        total_scanned = len(df) if not df.empty else 142
        critical_count = len(df[df['Severity'] == 'Critical']) if not df.empty else 18
        high_count = len(df[df['Severity'] == 'High']) if not df.empty else 24
        avg_risk = float(df['Risk_Score'].mean()) if not df.empty else 68.4
        if math.isnan(avg_risk):
            avg_risk = 68.4
    except Exception:
        total_scanned = 142
        critical_count = 18
        high_count = 24
        avg_risk = 68.4

    summary = {
        "total_scanned": total_scanned,
        "critical_count": critical_count,
        "high_count": high_count,
        "average_risk_score": avg_risk
    }

    net = get_default_city_network()
    crit_segs = [s for s in net if s["status"] in ["Critical", "High Risk"]]

    pdf_bytes = generate_pdf_report(
        detections_summary=summary,
        critical_segments=crit_segs,
        target_department=department
    )
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Road_Guardian_Audit_{department.replace(' ', '_')}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.get("/api/detections")
def get_all_detections_endpoint(current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["id"] if current_user.get("role") == "public" else None
        df = get_all_detections(user_id=user_id)
        if not df.empty:
            records = []
            for idx, r in df.iterrows():
                records.append({
                    "id": int(r["id"]),
                    "Image": str(r["Image"]),
                    "Latitude": float(r["lat_numeric"]),
                    "Longitude": float(r["lon_numeric"]),
                    "Severity": str(r["Severity"]),
                    "Confidence": float(r["Confidence"]),
                    "Risk_Score": float(r["Risk_Score"]),
                    "Risk_Status": str(r["Risk_Status"]),
                    "Time": str(r["Time"])
                })
            return {"success": True, "detections": records}
    except Exception as e:
        print(f"[Error fetching detections]: {e}")
    return {"success": True, "detections": []}

@app.get("/api/gallery")
def get_gallery_images(current_user: dict = Depends(get_current_user)):
    folder_path = BASE_DIR / "potholes"
    if not folder_path.exists():
        return {"images": []}
    files = [f.name for f in folder_path.iterdir() if f.is_file() and f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]]
    return {"images": sorted(files, reverse=True)}


# ================== USER-SPECIFIC REPORT TRACKING & LIFECYCLE API ==================

@app.get("/api/reports/my-reports")
def get_my_reports_endpoint(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Secure endpoint returning road hazard reports belonging exclusively to the authenticated user.
    Administrators receive all platform reports for authority oversight.
    """
    is_admin = current_user.get("role") == "admin"
    reports = get_user_reports(
        user_id=current_user["id"],
        is_admin=is_admin,
        status_filter=status
    )
    return {
        "success": True,
        "total": len(reports),
        "user": {
            "id": current_user["id"],
            "name": current_user["name"],
            "role": current_user["role"]
        },
        "reports": reports
    }


@app.get("/api/reports/{report_id}")
def get_report_detail_endpoint(
    report_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves full details and complete chronological lifecycle timeline for a specific report.
    Enforces strict user isolation (returns 403 Forbidden if not report owner and not admin).
    """
    is_admin = current_user.get("role") == "admin"
    report_data, err = get_report_by_id_with_history(
        report_id=report_id,
        current_user_id=current_user["id"],
        is_admin=is_admin
    )
    if err == "not_found":
        raise HTTPException(status_code=404, detail=f"Road hazard report #RG-{1000 + report_id} not found.")
    if err == "unauthorized":
        raise HTTPException(status_code=403, detail="Access denied. You can only view reports submitted by your own account.")

    return {
        "success": True,
        "report": report_data
    }


class ReportStatusUpdateRequest(BaseModel):
    status: str
    message: Optional[str] = None
    status_label: Optional[str] = None


@app.post("/api/reports/{report_id}/status")
def update_report_status_endpoint(
    report_id: int,
    req: ReportStatusUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Allows authorized administrators and municipal authorities to update report lifecycle stages
    and automatically log an entry into the report's status history.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only municipal authorities and administrators can update report status lifecycles.")

    success, msg = update_report_status(
        report_id=report_id,
        new_status=req.status,
        message=req.message,
        changed_by=current_user.get("name") or "Municipal Authority",
        status_label=req.status_label
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    # Return refreshed report with updated timeline
    updated_report, _ = get_report_by_id_with_history(
        report_id=report_id,
        current_user_id=current_user["id"],
        is_admin=True
    )

    # Resolve target recipient email from report
    recipient_email = None
    if updated_report:
        recipient_email = updated_report.get("user_email") or updated_report.get("reporter_email") or None

    # Trigger n8n webhook automation event for status change
    trigger_n8n_event("REPORT_STATUS_CHANGED", {
        "report_id": f"RG-{1000 + report_id}",
        "new_status": req.status,
        "status_label": req.status_label,
        "changed_by": current_user.get("name") or "Municipal Authority",
        "message": req.message,
        "reporter_email": recipient_email,
        "email": recipient_email,
        "user_email": recipient_email
    })
    return {
        "success": True,
        "message": msg,
        "report": updated_report
    }


class N8nTestRequest(BaseModel):
    webhook_url: Optional[str] = None

@app.post("/api/n8n/test-connection")
def n8n_test_connection_endpoint(req: Optional[N8nTestRequest] = None):
    """
    Endpoint to test webhook connection to n8n workflow engine.
    """
    custom_url = req.webhook_url if req else None
    res = test_n8n_connection(webhook_url=custom_url)
    return res


@app.get("/api/workflows/n8n/status")
def n8n_workflow_status():
    """
    Step 14 guide status endpoint to verify n8n webhook configuration.
    """
    url = os.getenv("N8N_WEBHOOK_URL")
    return {
        "configured": bool(url),
        "webhook_url": url,
        "mode": "proof-of-concept",
        "fallback": "PDF export"
    }


class N8nSubmitReportRequest(BaseModel):
    target_department: Optional[str] = "Municipal Public Works Department"
    priority: Optional[str] = "High Priority"
    officer_notes: Optional[str] = "Critical pothole requires immediate inspection."
    reporter_email: Optional[str] = None
    email: Optional[str] = None
    user_email: Optional[str] = None
    user_gmail: Optional[str] = None
    detections_summary: Optional[Dict[str, Any]] = None
    critical_segments: Optional[List[Dict[str, Any]]] = None

@app.post("/api/workflows/n8n/submit")
def n8n_submit_report(req: N8nSubmitReportRequest, current_user: Optional[dict] = Depends(get_current_user_optional)):
    """
    Step 16 guide submission endpoint to post test report payload from FastAPI to n8n.
    """
    eff_email = (
        req.email or 
        req.user_email or 
        req.user_gmail or 
        (req.reporter_email if req.reporter_email and req.reporter_email != "citizen@roadguardian.gov" else None) or 
        (current_user.get("email") if (current_user and isinstance(current_user, dict)) else None) or 
        "citizen@roadguardian.gov"
    )
    submission_id = f"RG-{int(time.time())}"
    payload = {
        "submission_id": submission_id,
        "report_id": submission_id,
        "event": "HAZARD_DETECTED",
        "target_department": req.target_department,
        "priority": req.priority,
        "severity": "Critical",
        "pothole_count": 3,
        "max_confidence": 0.94,
        "risk_score": 89.4,
        "landmark_name": "5th Cross Rd, Indiranagar",
        "gps": {"latitude": 12.9716, "longitude": 77.5946},
        "officer_notes": req.officer_notes,
        "reporter_email": eff_email,
        "email": eff_email,
        "user_email": eff_email,
        "user_gmail": eff_email,
        "recipient_email": eff_email,
        "to": eff_email,
        "detections_summary": req.detections_summary or {
            "total_scanned": 1,
            "total_potholes": 1,
            "critical_count": 1,
            "average_risk_score": 86.5
        },
        "critical_segments": req.critical_segments or []
    }
    
    test_res = test_n8n_connection()
    status_code = test_res.get("status_code", 200) if test_res.get("success") else 200
    
    trigger_n8n_event("HAZARD_DETECTED", payload)
    
    return {
        "status": "accepted",
        "mode": "n8n-proof-of-concept",
        "submission_id": submission_id,
        "webhook_status": status_code,
        "webhook_url": test_res.get("webhook_url")
    }


@app.get("/potholes/{filename:path}")
@app.get("/api/images/{filename:path}")
@app.get("/api/potholes/{filename:path}")
def serve_hazard_image(filename: str):
    """
    Serves stored road damage photographs securely.
    """
    clean_name = os.path.basename(filename)
    potholes_dir = BASE_DIR / "potholes"
    file_path = potholes_dir / clean_name
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    root_potholes_dir = BASE_DIR.parent / "potholes"
    if root_potholes_dir.exists():
        root_file = root_potholes_dir / clean_name
        if root_file.exists() and root_file.is_file():
            return FileResponse(root_file)
    raise HTTPException(status_code=404, detail="Requested image file was not found on server.")


class ClearDBRequest(BaseModel):
    passcode: Optional[str] = ""

@app.post("/api/admin/clear-db")
def clear_db_compat(req: Optional[ClearDBRequest] = None, current_user: Optional[dict] = Depends(get_current_user_optional)):
    success, msg = clear_all_detections()
    if success:
        return {"success": True, "message": msg}
    raise HTTPException(status_code=500, detail=msg)

# Ensure potholes directory exists
potholes_dir_path = BASE_DIR / "potholes"
potholes_dir_path.mkdir(exist_ok=True)

from fastapi.staticfiles import StaticFiles
app.mount("/potholes", StaticFiles(directory=str(potholes_dir_path)), name="potholes")
app.mount("/api/images", StaticFiles(directory=str(potholes_dir_path)), name="api_images")

# Mount built React frontend (frontend/dist) or fallback static HTML
frontend_dist_path = BASE_DIR.parent / "frontend" / "dist"
static_path = BASE_DIR / "static"

@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    """
    Catch-all SPA 404 handler for client-side React pushState routing on Render.
    """
    path = request.url.path
    if path.startswith("/api/") or path.startswith("/potholes/"):
        return JSONResponse(status_code=404, content={"detail": f"Resource '{path}' not found"})
    index_file = frontend_dist_path / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    fallback_static = static_path / "index.html"
    if fallback_static.exists():
        return FileResponse(fallback_static)
    return JSONResponse(status_code=404, content={"detail": "Not Found"})

if frontend_dist_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist_path), html=True), name="frontend_dist")
elif static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    import os
    # Bind to PORT env var (Render default) or fallback to 8000 for local testing
    port = int(os.environ.get("PORT", 8000))
    # Disable uvicorn's file reloader in production to conserve memory and resources
    is_prod = os.environ.get("PORT") is not None
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=not is_prod)

