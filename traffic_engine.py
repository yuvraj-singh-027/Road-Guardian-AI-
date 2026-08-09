"""
Layer 3 — Digital Twin City Road Network
Layer 4 — Traffic Intelligence & Re-routing Simulator

Provides a virtual spatial map of the city road network, assigns segment risk scores
(Healthy, Degraded, High Risk, Critical), and predicts dynamic traffic volume shifts
when a road segment is closed for maintenance.
"""

import math
from typing import Dict, List, Any
from risk_engine import calculate_road_risk

def get_default_city_network(center_lat: float = 28.6139, center_lon: float = 77.2090) -> List[Dict[str, Any]]:
    """
    Constructs a Digital Twin spatial road network around the given GPS coordinates.
    Includes interconnected major arterial, collector, and bypass roads.
    """
    # Offset coordinates slightly to form a connected city grid network
    offset_scale = 0.012

    raw_segments = [
        {
            "id": "Road_A",
            "name": "Road A (Northern Arterial)",
            "start": [center_lon - 2.0 * offset_scale, center_lat + offset_scale],
            "end": [center_lon + 1.0 * offset_scale, center_lat + offset_scale],
            "length_km": 3.2,
            "base_capacity": 2200,
            "base_traffic": 1750,
            "speed_kmh": 65.0,
            "potholes": 8,
            "severity": "Critical",
            "confidence": 0.92,
            "road_type": "Arterial Road",
            "weather": "Rainy",
            "traffic_density": "High",
            "proximity_school_hospital": True,
            "connected_to": ["Road_B", "Road_C", "Road_E"]
        },
        {
            "id": "Road_B",
            "name": "Road B (Central Bypass)",
            "start": [center_lon - 2.0 * offset_scale, center_lat],
            "end": [center_lon + 1.0 * offset_scale, center_lat],
            "length_km": 2.8,
            "base_capacity": 1800,
            "base_traffic": 1100,
            "speed_kmh": 50.0,
            "potholes": 3,
            "severity": "Medium",
            "confidence": 0.78,
            "road_type": "Arterial Road",
            "weather": "Clear",
            "traffic_density": "Moderate",
            "proximity_school_hospital": False,
            "connected_to": ["Road_A", "Road_C", "Road_D"]
        },
        {
            "id": "Road_C",
            "name": "Road C (Cross Connector)",
            "start": [center_lon + 1.0 * offset_scale, center_lat + offset_scale],
            "end": [center_lon + 1.0 * offset_scale, center_lat - offset_scale],
            "length_km": 2.1,
            "base_capacity": 1500,
            "base_traffic": 950,
            "speed_kmh": 45.0,
            "potholes": 5,
            "severity": "High",
            "confidence": 0.85,
            "road_type": "Collector Street",
            "weather": "Rainy",
            "traffic_density": "Moderate",
            "proximity_school_hospital": True,
            "connected_to": ["Road_A", "Road_B", "Road_D"]
        },
        {
            "id": "Road_D",
            "name": "Road D (Southern Expressway)",
            "start": [center_lon - 2.0 * offset_scale, center_lat - offset_scale],
            "end": [center_lon + 2.0 * offset_scale, center_lat - offset_scale],
            "length_km": 4.5,
            "base_capacity": 3000,
            "base_traffic": 2100,
            "speed_kmh": 85.0,
            "potholes": 1,
            "severity": "Low",
            "confidence": 0.65,
            "road_type": "Expressway",
            "weather": "Clear",
            "traffic_density": "Moderate",
            "proximity_school_hospital": False,
            "connected_to": ["Road_B", "Road_C", "Road_E"]
        },
        {
            "id": "Road_E",
            "name": "Road E (Western Collector)",
            "start": [center_lon - 2.0 * offset_scale, center_lat + offset_scale],
            "end": [center_lon - 2.0 * offset_scale, center_lat - offset_scale],
            "length_km": 2.4,
            "base_capacity": 1400,
            "base_traffic": 680,
            "speed_kmh": 40.0,
            "potholes": 0,
            "severity": "Low",
            "confidence": 0.50,
            "road_type": "Local Road",
            "weather": "Clear",
            "traffic_density": "Low",
            "proximity_school_hospital": False,
            "connected_to": ["Road_A", "Road_D"]
        }
    ]

    processed_network = []
    for s in raw_segments:
        risk_info = calculate_road_risk(
            severity=s["severity"],
            confidence=s["confidence"],
            damage_count=s["potholes"],
            speed_kmh=s["speed_kmh"],
            traffic_density=s["traffic_density"],
            road_type=s["road_type"],
            weather=s["weather"],
            proximity_school_hospital=s["proximity_school_hospital"]
        )

        # PyDeck path layer expects RGBA color array
        if risk_info["status"] == "Healthy":
            rgba = [76, 175, 80, 220]      # Green
        elif risk_info["status"] == "Degraded":
            rgba = [255, 193, 7, 230]     # Yellow
        elif risk_info["status"] == "High Risk":
            rgba = [255, 152, 0, 240]    # Orange
        else:
            rgba = [244, 67, 54, 255]     # Red (Critical)

        seg_dict = dict(s)
        seg_dict["risk_score"] = risk_info["score"]
        seg_dict["status"] = risk_info["status"]
        seg_dict["icon"] = risk_info["icon"]
        seg_dict["badge"] = risk_info["badge"]
        seg_dict["color_hex"] = risk_info["color_hex"]
        seg_dict["rgba"] = rgba
        seg_dict["risk_breakdown"] = risk_info["breakdown"]
        
        # Path for PyDeck PathLayer format: [[start_lon, start_lat], [end_lon, end_lat]]
        seg_dict["path"] = [s["start"], s["end"]]

        processed_network.append(seg_dict)

    return processed_network


def simulate_traffic_rerouting(closed_road_id: str, network: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Layer 4 — Traffic Intelligence Simulator
    Simulates closing a specified road segment for repair and predicts traffic flow shifts
    (% volume changes) across connected alternate routes.
    """
    if network is None:
        network = get_default_city_network()

    closed_seg = next((s for s in network if s["id"] == closed_road_id), None)
    if not closed_seg:
        return {"error": f"Road segment {closed_road_id} not found."}

    diverted_traffic = closed_seg["base_traffic"]

    # Calculate alternate route capacity weights
    alt_routes = [s for s in network if s["id"] != closed_road_id]
    
    # Direct connected routes get higher share of diverted traffic
    connected_ids = closed_seg.get("connected_to", [])
    
    weights = {}
    for r in alt_routes:
        # Distance/capacity suitability factor
        unused_cap = max(100, r["base_capacity"] - r["base_traffic"])
        is_connected = r["id"] in connected_ids
        conn_bonus = 2.2 if is_connected else 1.0
        weights[r["id"]] = unused_cap * conn_bonus

    total_weight = sum(weights.values()) if weights else 1.0

    simulation_results = []
    headline_insights = []

    for r in alt_routes:
        w = weights[r["id"]]
        assigned_diverted = round((w / total_weight) * diverted_traffic)
        
        new_traffic = r["base_traffic"] + assigned_diverted
        pct_increase = round(((assigned_diverted) / r["base_traffic"]) * 100, 1)
        
        old_vc = round(r["base_traffic"] / r["base_capacity"], 2)
        new_vc = round(new_traffic / r["base_capacity"], 2)
        
        congestion_level = "Low"
        if new_vc > 0.95:
            congestion_level = "Severe Congestion / Bottleneck"
        elif new_vc > 0.80:
            congestion_level = "High Traffic"
        elif new_vc > 0.60:
            congestion_level = "Moderate"

        res = {
            "id": r["id"],
            "name": r["name"],
            "base_traffic": r["base_traffic"],
            "diverted_traffic": assigned_diverted,
            "new_traffic": new_traffic,
            "capacity": r["base_capacity"],
            "pct_increase": pct_increase,
            "old_vc_ratio": old_vc,
            "new_vc_ratio": new_vc,
            "congestion_level": congestion_level,
            "is_direct_alternate": r["id"] in connected_ids
        }
        simulation_results.append(res)

    # Sort results by percentage increase descending
    simulation_results.sort(key=lambda x: x["pct_increase"], reverse=True)

    # Build exact narrative prediction requested in Layer 4 spec
    top_affected = simulation_results[:2]
    if len(top_affected) >= 2:
        prediction_text = (
            f"Closing **{closed_seg['name']}** for repair is predicted to increase traffic on "
            f"**{top_affected[0]['name']}** by **+{top_affected[0]['pct_increase']}%** "
            f"and **{top_affected[1]['name']}** by **+{top_affected[1]['pct_increase']}%**."
        )
    elif len(top_affected) == 1:
        prediction_text = (
            f"Closing **{closed_seg['name']}** for repair is predicted to increase traffic on "
            f"**{top_affected[0]['name']}** by **+{top_affected[0]['pct_increase']}%**."
        )
    else:
        prediction_text = f"Closing **{closed_seg['name']}** will redistribute {diverted_traffic} vehicles/hr across alternate routes."

    # Mitigation recommendations
    mitigation_steps = [
        f"🚦 Extend Green Light Phase by +15s on key intersections along {top_affected[0]['name']}.",
        f"🚧 Deploy Smart Dynamic Variable Message Signs (VMS) 1.5 km before {closed_seg['id']} to direct vehicles to Expressway bypass.",
        f"🌙 Recommended Maintenance Window: 01:00 AM – 05:00 AM (reduces traffic impact by ~78%)."
    ]

    return {
        "closed_road": closed_seg,
        "diverted_volume": diverted_traffic,
        "prediction_text": prediction_text,
        "rerouting_data": simulation_results,
        "mitigation_steps": mitigation_steps
    }
