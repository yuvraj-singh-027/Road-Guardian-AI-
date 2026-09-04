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
try:
    from .risk_engine import calculate_road_risk
except ImportError:
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
    # Dynamic database-driven network generation
    try:
        try:
            from .db_manager import get_all_detections
        except ImportError:
            from db_manager import get_all_detections
        df = get_all_detections()
    except Exception:
        df = None


    if df is not None and not df.empty:
        # Group detections by reported landmark
        landmark_groups = {}
        for _, row in df.iterrows():
            lm = str(row.get("landmark_name") or row.get("Landmark") or row.get("description") or "Municipal Main Arterial").strip()
            if not lm or lm.lower() in ["none", "nan", "null", "unknown", ""]:
                lm = "Municipal Main Arterial"
            
            if lm not in landmark_groups:
                landmark_groups[lm] = {
                    "count": 0,
                    "max_severity": "Low",
                    "max_conf": 0.0,
                    "lat": float(row.get("lat_numeric") or row.get("Latitude") or center_lat),
                    "lon": float(row.get("lon_numeric") or row.get("Longitude") or center_lon),
                    "damage_type": str(row.get("damage_type") or "Pothole")
                }
            
            group = landmark_groups[lm]
            group["count"] += 1
            row_sev = str(row.get("Severity", "Low"))
            severity_ranks = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
            if severity_ranks.get(row_sev, 1) > severity_ranks.get(group["max_severity"], 1):
                group["max_severity"] = row_sev
            try:
                conf_val = float(row.get("Confidence", 0.85))
            except Exception:
                conf_val = 0.85
            group["max_conf"] = max(group["max_conf"], conf_val)

        # Build dynamic road corridors directly from database records
        dynamic_segments = []
        seg_idx = 1
        scale = 0.003

        for lm, g in landmark_groups.items():
            seg_id = f"DB_Road_{seg_idx}"
            seg_lat = g["lat"] if g["lat"] != 0 else center_lat
            seg_lon = g["lon"] if g["lon"] != 0 else center_lon

            cap = 1800 if g["max_severity"] in ["Critical", "High"] else 1500
            traffic_vol = int(cap * 0.75)

            dynamic_segments.append({
                "id": seg_id,
                "name": f"{lm} Corridor",
                "start": [seg_lon - scale, seg_lat + scale],
                "end": [seg_lon + scale, seg_lat + scale],
                "base_capacity": cap,
                "base_traffic": traffic_vol,
                "speed_kmh": 50.0,
                "potholes": g["count"],
                "severity": g["max_severity"],
                "confidence": round(g["max_conf"], 2),
                "road_type": "Arterial Road",
                "weather": "Clear",
                "traffic_density": "High" if g["max_severity"] in ["Critical", "High"] else "Moderate",
                "proximity_school_hospital": (g["max_severity"] == "Critical"),
                "connected_to": []
            })
            seg_idx += 1

        # Add 2-3 standard municipal bypass connectors for realistic rerouting
        bypass_connectors = [
            {
                "id": "Bypass_Ring_Corridor",
                "name": "Central Ring Bypass Route",
                "start": [center_lon - 2.0 * scale, center_lat],
                "end": [center_lon + 2.0 * scale, center_lat],
                "base_capacity": 2400,
                "base_traffic": 1400,
                "speed_kmh": 65.0,
                "potholes": 0,
                "severity": "Low",
                "confidence": 0.0,
                "road_type": "Expressway",
                "weather": "Clear",
                "traffic_density": "Moderate",
                "proximity_school_hospital": False,
                "connected_to": [s["id"] for s in dynamic_segments]
            },
            {
                "id": "Outer_Transit_Loop",
                "name": "Outer Transit Commercial Loop",
                "start": [center_lon - scale, center_lat - scale],
                "end": [center_lon + scale, center_lat - scale],
                "base_capacity": 1600,
                "base_traffic": 950,
                "speed_kmh": 45.0,
                "potholes": 0,
                "severity": "Low",
                "confidence": 0.0,
                "road_type": "Collector Street",
                "weather": "Clear",
                "traffic_density": "Low",
                "proximity_school_hospital": False,
                "connected_to": [s["id"] for s in dynamic_segments]
            }
        ]

        for s in dynamic_segments:
            s["connected_to"] = [b["id"] for b in bypass_connectors]

        raw_segments = dynamic_segments + bypass_connectors

    else:
        # DB IS EMPTY: Show clean baseline network with 0 potholes
        scale = 0.003
        raw_segments = [
            {
                "id": "Baseline_Arterial_North",
                "name": "North City Arterial Corridor",
                "start": [center_lon - scale, center_lat + scale],
                "end": [center_lon + scale, center_lat + scale],
                "base_capacity": 1800, "base_traffic": 1200, "speed_kmh": 50.0,
                "potholes": 0, "severity": "Low", "confidence": 0.0,
                "road_type": "Arterial Road", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Baseline_Ring_Central", "Baseline_Expressway_South"]
            },
            {
                "id": "Baseline_Ring_Central",
                "name": "Central Ring Road Avenue",
                "start": [center_lon - scale, center_lat],
                "end": [center_lon + scale, center_lat],
                "base_capacity": 2200, "base_traffic": 1500, "speed_kmh": 60.0,
                "potholes": 0, "severity": "Low", "confidence": 0.0,
                "road_type": "Arterial Road", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Baseline_Arterial_North", "Baseline_Expressway_South"]
            },
            {
                "id": "Baseline_Expressway_South",
                "name": "South City Expressway Link",
                "start": [center_lon - scale, center_lat - scale],
                "end": [center_lon + scale, center_lat - scale],
                "base_capacity": 2800, "base_traffic": 1800, "speed_kmh": 80.0,
                "potholes": 0, "severity": "Low", "confidence": 0.0,
                "road_type": "Expressway", "weather": "Clear", "traffic_density": "Moderate",
                "proximity_school_hospital": False, "connected_to": ["Baseline_Arterial_North", "Baseline_Ring_Central"]
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
            rgba = [71, 85, 105, 180]      # Neutral Slate Gray
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


def simulate_traffic_rerouting(
    network: Any = None, 
    closed_road_id: str = "Sec1_Blvd_N1",
    closure_type: str = "full",
    traffic_window: str = "peak",
    duration_hours: int = 4
) -> Dict[str, Any]:
    """
    Layer 4 — Traffic Intelligence & Dynamic Rerouting Simulator
    Simulates closing a specified road segment for repair and predicts traffic flow shifts
    (% volume changes) across connected alternate routes with multi-factor scenario levers.
    """
    if isinstance(network, str):
        network, closed_road_id = closed_road_id, network

    if not network or not isinstance(network, list):
        network = get_default_city_network()

    if not isinstance(closed_road_id, str):
        closed_road_id = "Sec1_Blvd_N1"

    # Scenario multipliers
    window_multipliers = {
        "peak": 1.35,
        "normal": 1.0,
        "off_peak": 0.60
    }
    traffic_mult = window_multipliers.get(traffic_window.lower(), 1.0)
    
    # Closure factor: full closure = 100% diversion, single lane = 50% diversion
    closure_factor = 1.0 if closure_type.lower() == "full" else 0.50

    # Resolve closed road by exact ID, name substring, alias, or index
    closed_seg = next((s for s in network if s["id"] == closed_road_id), None)
    if not closed_seg:
        closed_seg = next((s for s in network if closed_road_id.lower() in s["id"].lower() or closed_road_id.lower() in s["name"].lower()), None)
    if not closed_seg:
        alias_map = {"road_a": 0, "road_b": 1, "road_c": 2, "road_d": 3, "road_e": 4, "road_f": 5}
        idx = alias_map.get(closed_road_id.lower().replace(" ", "_"), 0)
        if idx < len(network):
            closed_seg = network[idx]
        else:
            closed_seg = network[0] if network else None

    if not closed_seg:
        return {"error": f"Road segment '{closed_road_id}' not found."}

    raw_base_traffic = closed_seg.get("base_traffic", 1500)
    effective_base_traffic = int(raw_base_traffic * traffic_mult)
    diverted_traffic = int(effective_base_traffic * closure_factor)

    # Calculate alternate route capacity weights
    alt_routes = [s for s in network if s["id"] != closed_seg["id"]]
    connected_ids = closed_seg.get("connected_to", [])
    
    weights = {}
    for r in alt_routes:
        r_current_traffic = int(r.get("base_traffic", 1000) * traffic_mult)
        unused_cap = max(80, r["base_capacity"] - r_current_traffic)
        is_connected = r["id"] in connected_ids
        conn_bonus = 2.4 if is_connected else 1.0
        # Expressway preference bonus
        speed_bonus = 1.3 if r.get("road_type") == "Expressway" else 1.0
        weights[r["id"]] = unused_cap * conn_bonus * speed_bonus

    total_weight = sum(weights.values()) if weights else 1.0

    simulation_results = []
    for r in alt_routes:
        w = weights[r["id"]]
        r_base_traffic = int(r.get("base_traffic", 1000) * traffic_mult)
        assigned_diverted = round((w / total_weight) * diverted_traffic)
        new_traffic = r_base_traffic + assigned_diverted
        pct_increase = round(((assigned_diverted) / max(r_base_traffic, 1)) * 100, 1)
        
        old_vc = round(r_base_traffic / r["base_capacity"], 2)
        new_vc = round(new_traffic / r["base_capacity"], 2)
        
        congestion_level = "Low"
        if new_vc > 0.95:
            congestion_level = "Severe Bottleneck"
        elif new_vc > 0.80:
            congestion_level = "High Traffic"
        elif new_vc > 0.60:
            congestion_level = "Moderate"

        res = {
            "id": r["id"],
            "name": r["name"],
            "base_traffic": r_base_traffic,
            "diverted_traffic": assigned_diverted,
            "new_traffic": new_traffic,
            "capacity": r["base_capacity"],
            "pct_increase": pct_increase,
            "old_vc_ratio": old_vc,
            "new_vc_ratio": new_vc,
            "congestion_level": congestion_level,
            "is_direct_alternate": r["id"] in connected_ids,
            "road_type": r.get("road_type", "Arterial Road")
        }
        simulation_results.append(res)

    simulation_results.sort(key=lambda x: x["diverted_traffic"], reverse=True)

    # Dynamic delay and environmental impact computations
    delay_hours = round(diverted_traffic * duration_hours * (0.32 if closure_type == "full" else 0.14), 1)
    co2_surge_kg = round(delay_hours * 1.85, 1)

    top_affected = simulation_results[:3]
    top_detours = []
    for idx, r in enumerate(top_affected):
        time_delay_min = round((r["pct_increase"] / 100.0) * 12.0 + (3.5 if r["new_vc_ratio"] > 0.85 else 1.5), 1)
        top_detours.append({
            "rank": idx + 1,
            "name": r["name"],
            "id": r["id"],
            "absorb_volume": r["diverted_traffic"],
            "load_pct": round(r["new_vc_ratio"] * 100, 1),
            "est_delay_min": time_delay_min,
            "is_direct": r["is_direct_alternate"],
            "status": r["congestion_level"]
        })

    closure_label = "Full Closure" if closure_type == "full" else "Single Lane Restricted"
    window_label = "Rush Hour Peak" if traffic_window == "peak" else "Normal Daytime" if traffic_window == "normal" else "Off-Peak Night"

    if len(top_affected) >= 2:
        prediction_text = (
            f"During {window_label} ({closure_label}), closing **{closed_seg['name']}** diverts **{diverted_traffic} veh/hr**, "
            f"increasing traffic on **{top_affected[0]['name']}** by **+{top_affected[0]['pct_increase']}%** "
            f"and **{top_affected[1]['name']}** by **+{top_affected[1]['pct_increase']}%**."
        )
    elif len(top_affected) == 1:
        prediction_text = (
            f"During {window_label} ({closure_label}), closing **{closed_seg['name']}** diverts **{diverted_traffic} veh/hr** "
            f"to **{top_affected[0]['name']}** (+{top_affected[0]['pct_increase']}%)."
        )
    else:
        prediction_text = f"Closing **{closed_seg['name']}** will redistribute {diverted_traffic} vehicles/hr across alternate routes."

    mitigation_steps = [
        f"🚦 Extend Green Signal by +{15 if traffic_window == 'peak' else 10}s along primary bypass ({top_affected[0]['name'] if top_affected else 'alternate routes'}).",
        f"🚧 Deploy Smart Dynamic Variable Message Signs (VMS) 350m ahead of {closed_seg['name']} to divert heavy vehicles.",
        f"⏱️ Scheduled Repair Duration: {duration_hours} Hours | Total Vehicle Hours Impact: {delay_hours:,.1f} hrs.",
        f"🌱 Environmental Impact: Estimated +{co2_surge_kg:,.1f} kg CO₂ emissions surge from idling/detour.",
        f"🌙 Optimal Maintenance Recommendation: Schedule repair in Off-Peak Night (01:00 AM – 05:00 AM) to reduce delay by up to 72%."
    ]

    return {
        "closed_road": closed_seg,
        "closure_type": closure_type,
        "traffic_window": traffic_window,
        "duration_hours": duration_hours,
        "diverted_volume": diverted_traffic,
        "delay_hours": delay_hours,
        "co2_surge_kg": co2_surge_kg,
        "prediction_text": prediction_text,
        "top_detours": top_detours,
        "rerouting_data": simulation_results,
        "mitigation_steps": mitigation_steps
    }

