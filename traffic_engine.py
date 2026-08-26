"""
Layer 3 — Digital Twin City Road Network
Layer 4 — Traffic Intelligence & Re-routing Simulator

Provides a virtual spatial map of the city road network, assigns segment risk scores
(Healthy, Degraded, High Risk, Critical), and predicts dynamic traffic volume shifts
when a road segment is closed for maintenance.
"""

import math
import requests
from typing import Dict, List, Any
from risk_engine import calculate_road_risk

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates real-world distance between two GPS coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(max(0.1, R * c), 2)


def fetch_osm_city_network(center_lat: float = 28.6139, center_lon: float = 77.2090, radius_m: int = 1000) -> List[Dict[str, Any]]:
    """
    Queries OpenStreetMap Overpass API to fetch real street network geometry surrounding (center_lat, center_lon).
    Falls back gracefully to default Digital Twin grid network if offline or API unavailable.
    """
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:10];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](around:{radius_m},{center_lat},{center_lon});
    );
    out body geom 30;
    """
    try:
        resp = requests.post(overpass_url, data={"data": query}, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            elements = data.get("elements", [])
            
            raw_segments = []
            way_index = 1
            for el in elements:
                if el.get("type") == "way" and "geometry" in el:
                    geom = el["geometry"]
                    tags = el.get("tags", {})
                    highway_type = tags.get("highway", "tertiary")
                    street_name = tags.get("name") or tags.get("name:en") or f"OSM {highway_type.capitalize()} Way #{el['id']}"
                    
                    # Deduce capacity and speed based on highway category
                    if highway_type in ["motorway", "trunk"]:
                        road_cat = "Expressway"
                        cap = 2800
                        speed = 80.0
                    elif highway_type in ["primary"]:
                        road_cat = "Arterial Road"
                        cap = 1900
                        speed = 60.0
                    elif highway_type in ["secondary"]:
                        road_cat = "Arterial Road"
                        cap = 1500
                        speed = 50.0
                    elif highway_type in ["tertiary"]:
                        road_cat = "Collector Street"
                        cap = 1200
                        speed = 40.0
                    else:
                        road_cat = "Local Road"
                        cap = 850
                        speed = 30.0
                        
                    # Split multi-point ways into sub-segments
                    for idx in range(len(geom) - 1):
                        p1 = geom[idx]
                        p2 = geom[idx + 1]
                        
                        start_pt = [p1["lon"], p1["lat"]]
                        end_pt = [p2["lon"], p2["lat"]]
                        
                        # Generate realistic hazard metrics
                        potholes_cnt = (el['id'] + idx) % 7
                        sev_options = ["Low", "Medium", "High", "Critical"]
                        sev = sev_options[(el['id'] + idx) % 4]
                        
                        seg_id = f"OSM_{el['id']}_{idx}"
                        
                        raw_segments.append({
                            "id": seg_id,
                            "name": f"{street_name} (Seg {idx+1})",
                            "start": start_pt,
                            "end": end_pt,
                            "base_capacity": cap,
                            "base_traffic": int(cap * 0.65),
                            "speed_kmh": speed,
                            "potholes": potholes_cnt,
                            "severity": sev,
                            "confidence": round(0.70 + ((el['id'] % 25) / 100.0), 2),
                            "road_type": road_cat,
                            "weather": "Clear",
                            "traffic_density": "Moderate",
                            "proximity_school_hospital": (el['id'] % 3 == 0),
                            "connected_to": []
                        })
                        way_index += 1
                        if len(raw_segments) >= 45: # Cap max segments for crisp rendering speed
                            break
                    if len(raw_segments) >= 45:
                        break
                        
            if raw_segments:
                # Link adjacent segment connections
                for i, s1 in enumerate(raw_segments):
                    conn = []
                    for j, s2 in enumerate(raw_segments):
                        if i != j:
                            if s1["end"] == s2["start"] or s1["start"] == s2["end"]:
                                conn.append(s2["id"])
                    s1["connected_to"] = conn[:3]
                return process_raw_network_segments(raw_segments)
    except Exception as e:
        print(f"OSM Overpass API Notice: {e} (Falling back to Precision Digital Twin Grid)")

    # Fallback to precision digital twin grid if request fails or offline
    return get_default_city_network(center_lat, center_lon, precision_mode="micro")


def process_raw_network_segments(raw_segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Helper to process raw network segments with multi-factor risk calculations."""
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

        vc_ratio = min(1.5, round(s["base_traffic"] / s["base_capacity"], 2))
        dist_km = haversine_distance_km(s["start"][1], s["start"][0], s["end"][1], s["end"][0])

        if risk_info["status"] == "Healthy":
            rgba = [76, 175, 80, 200]
        elif risk_info["status"] == "Degraded":
            rgba = [255, 193, 7, 220]
        elif risk_info["status"] == "High Risk":
            rgba = [255, 152, 0, 240]
        else:
            rgba = [244, 67, 54, 255]

        seg_dict = dict(s)
        seg_dict["risk_score"] = risk_info["score"]
        seg_dict["status"] = risk_info["status"]
        seg_dict["badge"] = risk_info["badge"]
        seg_dict["color_hex"] = risk_info["color_hex"]
        seg_dict["rgba"] = rgba
        seg_dict["risk_breakdown"] = risk_info["breakdown"]
        seg_dict["path"] = [s["start"], s["end"]]
        seg_dict["vc_ratio"] = vc_ratio
        seg_dict["distance_km"] = dist_km

        processed_network.append(seg_dict)
    return processed_network


def get_default_city_network(center_lat: float = 28.6139, center_lon: float = 77.2090, precision_mode: str = "micro", source: str = "grid") -> List[Dict[str, Any]]:
    """
    Constructs a High-Precision Digital Twin spatial road network around the given GPS coordinates.
    Supports source='osm' for Live OpenStreetMap GIS network integration.
    """
    if source.lower() == "osm":
        return fetch_osm_city_network(center_lat, center_lon)

    if precision_mode == "macro":
        offset_scale = 0.012
        raw_segments = [
            {
                "id": "Macro_Road_A",
                "name": "Northern Arterial Highway (Macro Corridor)",
                "start": [center_lon - 2.0 * offset_scale, center_lat + offset_scale],
                "end": [center_lon + 1.0 * offset_scale, center_lat + offset_scale],
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
                "connected_to": ["Macro_Road_B", "Macro_Road_C"]
            },
            {
                "id": "Macro_Road_B",
                "name": "Central Bypass Ring (Macro Corridor)",
                "start": [center_lon - 2.0 * offset_scale, center_lat],
                "end": [center_lon + 1.0 * offset_scale, center_lat],
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
                "connected_to": ["Macro_Road_A", "Macro_Road_C", "Macro_Road_D"]
            },
            {
                "id": "Macro_Road_C",
                "name": "Cross Connector Avenue (Macro Corridor)",
                "start": [center_lon + 1.0 * offset_scale, center_lat + offset_scale],
                "end": [center_lon + 1.0 * offset_scale, center_lat - offset_scale],
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
                "connected_to": ["Macro_Road_A", "Macro_Road_B", "Macro_Road_D"]
            },
            {
                "id": "Macro_Road_D",
                "name": "Southern Expressway (Macro Corridor)",
                "start": [center_lon - 2.0 * offset_scale, center_lat - offset_scale],
                "end": [center_lon + 2.0 * offset_scale, center_lat - offset_scale],
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
                "connected_to": ["Macro_Road_B", "Macro_Road_C"]
            }
        ]
    else:
        # Micro-street block level (~250m precision)
        scale = 0.0028
        raw_segments = [
            {
                "id": "Sec1_Blvd_N1",
                "name": "Sector 1 Main Blvd (North Block 1)",
                "start": [center_lon - 2.0 * scale, center_lat + 2.0 * scale],
                "end": [center_lon - 1.0 * scale, center_lat + 2.0 * scale],
                "base_capacity": 1600, "base_traffic": 1420, "speed_kmh": 45.0,
                "potholes": 6, "severity": "Critical", "confidence": 0.94,
                "road_type": "Arterial Road", "weather": "Rainy", "traffic_density": "High",
                "proximity_school_hospital": False, "connected_to": ["Sec1_Blvd_N2", "Sec2_Ring_W1", "School_Zone_Ave1"]
            },
            {
                "id": "Sec1_Blvd_N2",
                "name": "Sector 1 Main Blvd (North Block 2)",
                "start": [center_lon - 1.0 * scale, center_lat + 2.0 * scale],
                "end": [center_lon, center_lat + 2.0 * scale],
                "base_capacity": 1600, "base_traffic": 1280, "speed_kmh": 40.0,
                "potholes": 4, "severity": "High", "confidence": 0.88,
                "road_type": "Arterial Road", "weather": "Clear", "traffic_density": "High",
                "proximity_school_hospital": True, "connected_to": ["Sec1_Blvd_N1", "Sec1_Blvd_N3", "Hosp_Approach_1"]
            },
            {
                "id": "Sec1_Blvd_N3",
                "name": "Sector 1 Main Blvd (North Block 3)",
                "start": [center_lon, center_lat + 2.0 * scale],
                "end": [center_lon + 1.5 * scale, center_lat + 2.0 * scale],
                "base_capacity": 1500, "base_traffic": 980, "speed_kmh": 50.0,
                "potholes": 2, "severity": "Medium", "confidence": 0.76,
                "road_type": "Arterial Road", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Sec1_Blvd_N2", "Civic_Center_Dr"]
            },
            {
                "id": "School_Zone_Ave1",
                "name": "Central School Zone Avenue",
                "start": [center_lon - 1.0 * scale, center_lat + 2.0 * scale],
                "end": [center_lon - 1.0 * scale, center_lat + 1.0 * scale],
                "base_capacity": 1100, "base_traffic": 920, "speed_kmh": 30.0,
                "potholes": 5, "severity": "High", "confidence": 0.90,
                "road_type": "Local Road", "weather": "Rainy", "traffic_density": "High",
                "proximity_school_hospital": True, "connected_to": ["Sec1_Blvd_N1", "Central_Cross_1"]
            },
            {
                "id": "Hosp_Approach_1",
                "name": "Hospital Emergency Approach Way",
                "start": [center_lon, center_lat + 2.0 * scale],
                "end": [center_lon, center_lat + 1.0 * scale],
                "base_capacity": 1300, "base_traffic": 1150, "speed_kmh": 35.0,
                "potholes": 7, "severity": "Critical", "confidence": 0.95,
                "road_type": "Collector Street", "weather": "Clear", "traffic_density": "High",
                "proximity_school_hospital": True, "connected_to": ["Sec1_Blvd_N2", "Civic_Center_Dr", "Central_Cross_1"]
            },
            {
                "id": "Sec2_Ring_W1",
                "name": "Sector 2 Outer Ring (West Block 1)",
                "start": [center_lon - 2.0 * scale, center_lat + 2.0 * scale],
                "end": [center_lon - 2.0 * scale, center_lat + 1.0 * scale],
                "base_capacity": 1400, "base_traffic": 780, "speed_kmh": 50.0,
                "potholes": 1, "severity": "Low", "confidence": 0.60,
                "road_type": "Collector Street", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Sec1_Blvd_N1", "Sec2_Ring_W2"]
            },
            {
                "id": "Sec2_Ring_W2",
                "name": "Sector 2 Outer Ring (West Block 2)",
                "start": [center_lon - 2.0 * scale, center_lat + 1.0 * scale],
                "end": [center_lon - 2.0 * scale, center_lat],
                "base_capacity": 1400, "base_traffic": 810, "speed_kmh": 45.0,
                "potholes": 2, "severity": "Medium", "confidence": 0.72,
                "road_type": "Collector Street", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Sec2_Ring_W1", "Metro_Station_Way"]
            },
            {
                "id": "Central_Cross_1",
                "name": "Central Junction Cross Street",
                "start": [center_lon - 1.0 * scale, center_lat + 1.0 * scale],
                "end": [center_lon, center_lat + 1.0 * scale],
                "base_capacity": 1200, "base_traffic": 650, "speed_kmh": 35.0,
                "potholes": 0, "severity": "Low", "confidence": 0.50,
                "road_type": "Local Road", "weather": "Clear", "traffic_density": "Low",
                "proximity_school_hospital": False, "connected_to": ["School_Zone_Ave1", "Hosp_Approach_1", "TechPark_Access_1"]
            },
            {
                "id": "Civic_Center_Dr",
                "name": "Civic Center Outer Drive",
                "start": [center_lon, center_lat + 1.0 * scale],
                "end": [center_lon + 1.5 * scale, center_lat + 1.0 * scale],
                "base_capacity": 1500, "base_traffic": 1100, "speed_kmh": 40.0,
                "potholes": 3, "severity": "Medium", "confidence": 0.82,
                "road_type": "Collector Street", "weather": "Clear", "traffic_density": "High",
                "proximity_school_hospital": True, "connected_to": ["Hosp_Approach_1", "Commercial_Belt_1"]
            },
            {
                "id": "Metro_Station_Way",
                "name": "Metro Station Corridor Avenue",
                "start": [center_lon - 2.0 * scale, center_lat],
                "end": [center_lon - 1.0 * scale, center_lat],
                "base_capacity": 1800, "base_traffic": 1450, "speed_kmh": 50.0,
                "potholes": 5, "severity": "High", "confidence": 0.91,
                "road_type": "Arterial Road", "weather": "Rainy", "traffic_density": "High",
                "proximity_school_hospital": False, "connected_to": ["Sec2_Ring_W2", "TechPark_Access_1", "Flyover_Ramp_S1"]
            },
            {
                "id": "TechPark_Access_1",
                "name": "Tech Park Main Access Way",
                "start": [center_lon - 1.0 * scale, center_lat],
                "end": [center_lon, center_lat],
                "base_capacity": 1700, "base_traffic": 1320, "speed_kmh": 45.0,
                "potholes": 2, "severity": "Medium", "confidence": 0.75,
                "road_type": "Arterial Road", "weather": "Clear", "traffic_density": "High",
                "proximity_school_hospital": False, "connected_to": ["Metro_Station_Way", "Commercial_Belt_1", "Central_Cross_1"]
            },
            {
                "id": "Commercial_Belt_1",
                "name": "Commercial Market Beltway",
                "start": [center_lon, center_lat],
                "end": [center_lon + 1.5 * scale, center_lat],
                "base_capacity": 1600, "base_traffic": 1250, "speed_kmh": 35.0,
                "potholes": 4, "severity": "High", "confidence": 0.87,
                "road_type": "Collector Street", "weather": "Clear", "traffic_density": "High",
                "proximity_school_hospital": False, "connected_to": ["TechPark_Access_1", "Civic_Center_Dr", "Residential_Ln3"]
            },
            {
                "id": "Flyover_Ramp_S1",
                "name": "Southern Flyover Ramp Connector",
                "start": [center_lon - 1.0 * scale, center_lat],
                "end": [center_lon - 1.0 * scale, center_lat - 1.0 * scale],
                "base_capacity": 2000, "base_traffic": 1600, "speed_kmh": 60.0,
                "potholes": 1, "severity": "Low", "confidence": 0.65,
                "road_type": "Expressway", "weather": "Clear", "traffic_density": "High",
                "proximity_school_hospital": False, "connected_to": ["Metro_Station_Way", "South_Expressway_1"]
            },
            {
                "id": "Residential_Ln3",
                "name": "Residential Sector Street Lane 3",
                "start": [center_lon, center_lat],
                "end": [center_lon, center_lat - 1.0 * scale],
                "base_capacity": 900, "base_traffic": 420, "speed_kmh": 25.0,
                "potholes": 0, "severity": "Low", "confidence": 0.40,
                "road_type": "Local Road", "weather": "Clear", "traffic_density": "Low",
                "proximity_school_hospital": False, "connected_to": ["Commercial_Belt_1", "South_Expressway_1"]
            },
            {
                "id": "Industrial_Byp_1",
                "name": "Industrial Estate Bypass Road",
                "start": [center_lon - 2.0 * scale, center_lat - 1.0 * scale],
                "end": [center_lon - 1.0 * scale, center_lat - 1.0 * scale],
                "base_capacity": 2200, "base_traffic": 1500, "speed_kmh": 70.0,
                "potholes": 3, "severity": "Medium", "confidence": 0.80,
                "road_type": "Expressway", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Flyover_Ramp_S1", "South_Expressway_1"]
            },
            {
                "id": "South_Expressway_1",
                "name": "Southern Expressway Link",
                "start": [center_lon - 1.0 * scale, center_lat - 1.0 * scale],
                "end": [center_lon + 1.5 * scale, center_lat - 1.0 * scale],
                "base_capacity": 2800, "base_traffic": 1950, "speed_kmh": 80.0,
                "potholes": 2, "severity": "Low", "confidence": 0.70,
                "road_type": "Expressway", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Industrial_Byp_1", "Flyover_Ramp_S1", "Residential_Ln3"]
            }
        ]

    processed_network = []
    for s in raw_segments:
        # Calculate real-world exact distance in KM
        start_lon, start_lat = s["start"]
        end_lon, end_lat = s["end"]
        dist_km = haversine_distance_km(start_lat, start_lon, end_lat, end_lon)
        
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

        if risk_info["status"] == "Healthy":
            rgba = [76, 175, 80, 230]      # Green
        elif risk_info["status"] == "Degraded":
            rgba = [255, 193, 7, 235]     # Yellow
        elif risk_info["status"] == "High Risk":
            rgba = [255, 152, 0, 245]    # Orange
        else:
            rgba = [244, 67, 54, 255]     # Red (Critical)

        seg_dict = dict(s)
        seg_dict["length_km"] = dist_km
        seg_dict["risk_score"] = risk_info["score"]
        seg_dict["status"] = risk_info["status"]
        seg_dict["icon"] = risk_info["icon"]
        seg_dict["badge"] = risk_info["badge"]
        seg_dict["color_hex"] = risk_info["color_hex"]
        seg_dict["rgba"] = rgba
        seg_dict["risk_breakdown"] = risk_info["breakdown"]
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
    connected_ids = closed_seg.get("connected_to", [])
    
    weights = {}
    for r in alt_routes:
        unused_cap = max(100, r["base_capacity"] - r["base_traffic"])
        is_connected = r["id"] in connected_ids
        conn_bonus = 2.2 if is_connected else 1.0
        weights[r["id"]] = unused_cap * conn_bonus

    total_weight = sum(weights.values()) if weights else 1.0

    simulation_results = []
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

    simulation_results.sort(key=lambda x: x["pct_increase"], reverse=True)

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

    mitigation_steps = [
        f"🚦 Extend Green Light Phase by +15s on key intersections along {top_affected[0]['name'] if top_affected else 'alternate routes'}.",
        f"🚧 Deploy Smart Dynamic Variable Message Signs (VMS) 250m before {closed_seg['id']} to direct vehicles to alternate bypass lanes.",
        f"🌙 Recommended Maintenance Window: 01:00 AM – 05:00 AM (reduces traffic impact by ~78%)."
    ]

    return {
        "closed_road": closed_seg,
        "diverted_volume": diverted_traffic,
        "prediction_text": prediction_text,
        "rerouting_data": simulation_results,
        "mitigation_steps": mitigation_steps
    }
