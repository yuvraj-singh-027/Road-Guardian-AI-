"""
Layer 2 — Context Engine & Road Risk Scoring
Calculates multi-factor Road Risk Score (0-100) combining Perception (YOLO Detections)
with contextual parameters (GPS Speed, Traffic Density, Road Type, Weather, Vulnerable Proximity).
"""

from typing import Dict, Any, Tuple

def calculate_road_risk(
    severity: str = "Medium",
    confidence: float = 0.80,
    damage_count: int = 1,
    speed_kmh: float = 50.0,
    traffic_density: str = "Moderate",
    road_type: str = "Arterial Road",
    weather: str = "Clear",
    proximity_school_hospital: bool = False
) -> Dict[str, Any]:
    """
    Computes a weighted 0-100 Road Risk Score.
    
    Weights Breakdown:
    - Perception Risk (Damage Severity & Count): 35%
    - Vehicle Speed Factor: 20%
    - Traffic Density Factor: 15%
    - Road Category Factor: 10%
    - Weather Risk Factor: 10%
    - Vulnerable Zone Proximity (School/Hospital): 10%
    """
    
    # 1. Perception Score (35 max)
    sev_map = {"Low": 20, "Medium": 50, "High": 80, "Critical": 100}
    base_sev = sev_map.get(severity, 50)
    conf_adj = base_sev * max(0.5, min(1.0, confidence))
    count_mult = 1.0 + (min(damage_count - 1, 5) * 0.1) # Up to +50% for multiple damages
    perception_score = min(100.0, conf_adj * count_mult)
    w_perception = (perception_score / 100.0) * 35.0

    # 2. Speed Factor (20 max)
    if speed_kmh > 80:
        speed_score = 100.0
    elif speed_kmh > 50:
        speed_score = 75.0
    elif speed_kmh > 30:
        speed_score = 45.0
    else:
        speed_score = 20.0
    w_speed = (speed_score / 100.0) * 20.0

    # 3. Traffic Density (15 max)
    density_map = {"Low": 25.0, "Moderate": 55.0, "High": 85.0, "Congested": 100.0}
    t_score = density_map.get(traffic_density, 55.0)
    w_traffic = (t_score / 100.0) * 15.0

    # 4. Road Category (10 max)
    road_map = {"Expressway": 100.0, "Arterial Road": 75.0, "Collector Street": 50.0, "Local Road": 25.0}
    r_score = road_map.get(road_type, 75.0)
    w_road = (r_score / 100.0) * 10.0

    # 5. Weather Factor (10 max)
    weather_map = {"Clear": 20.0, "Rainy": 80.0, "Foggy": 60.0, "Snowy / Icy": 100.0}
    w_score = weather_map.get(weather, 20.0)
    w_weather = (w_score / 100.0) * 10.0

    # 6. Proximity Score (10 max)
    prox_score = 100.0 if proximity_school_hospital else 15.0
    w_proximity = (prox_score / 100.0) * 10.0

    # Total Score (0 - 100)
    total_score = round(min(100.0, max(0.0, w_perception + w_speed + w_traffic + w_road + w_weather + w_proximity)), 1)

    # Classification Tiers
    if total_score < 26.0:
        status = "Healthy"
        icon = "🟢"
        color_hex = "#4CAF50"
        css_class = "risk-healthy"
    elif total_score < 51.0:
        status = "Degraded"
        icon = "🟡"
        color_hex = "#FFC107"
        css_class = "risk-degraded"
    elif total_score < 76.0:
        status = "High Risk"
        icon = "🟠"
        color_hex = "#FF9800"
        css_class = "risk-high"
    else:
        status = "Critical"
        icon = "🔴"
        color_hex = "#F44336"
        css_class = "risk-critical"

    return {
        "score": total_score,
        "status": status,
        "icon": icon,
        "badge": f"{icon} {status}",
        "color_hex": color_hex,
        "css_class": css_class,
        "breakdown": {
            "Perception Damage": round(w_perception, 1),
            "Speed Danger": round(w_speed, 1),
            "Traffic Density": round(w_traffic, 1),
            "Road Category": round(w_road, 1),
            "Weather Hazard": round(w_weather, 1),
            "School/Hospital Proximity": round(w_proximity, 1)
        }
    }
