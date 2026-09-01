"""
Road Guardian AI — Authenticity Engine: GPS / Location Validator
Extracts, decodes, and validates embedded EXIF GPS geotags.
Converts coordinates to decimal and DMS representations.
Gracefully distinguishes missing GPS from tampered GPS.
"""

from typing import Dict, Any, Optional, Tuple
from PIL import Image, ExifTags


def decimal_to_dms(deg: float, is_lat: bool) -> str:
    """Formats decimal degrees to standard DMS string."""
    try:
        absolute = abs(deg)
        d = int(absolute)
        m_float = (absolute - d) * 60.0
        m = int(m_float)
        s = round((m_float - m) * 60.0, 2)
        direction = ("N" if deg >= 0 else "S") if is_lat else ("E" if deg >= 0 else "W")
        return f"{d}°{m}'{s}\" {direction}"
    except Exception:
        return f"{deg:.4f}"


def _convert_gps_rational(rational_val) -> float:
    """Converts PIL IFDRational or tuple to float degrees."""
    try:
        if isinstance(rational_val, (int, float)):
            return float(rational_val)
        if hasattr(rational_val, "numerator") and hasattr(rational_val, "denominator"):
            return float(rational_val.numerator) / float(rational_val.denominator)
        if isinstance(rational_val, (tuple, list)) and len(rational_val) == 2:
            return float(rational_val[0]) / float(rational_val[1])
        return float(rational_val)
    except Exception:
        return 0.0


def validate_gps_coordinates(pil_img: Image.Image, manual_gps: Optional[Tuple[float, float]] = None) -> Dict[str, Any]:
    """
    Extracts and validates embedded GPS coordinates from the PIL Image.
    If manual_gps is provided, validates that as well.

    Returns structured GPS info, validity, status, and human-readable explanation.
    """
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    gps_source = "None"
    has_gps = False

    try:
        exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if exif:
            gps_info_raw = None
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if tag_name == "GPSInfo":
                    gps_info_raw = value
                    break

            if gps_info_raw:
                gps_info = {}
                for gk, gv in gps_info_raw.items():
                    sub_tag = ExifTags.GPSTAGS.get(gk, str(gk))
                    gps_info[sub_tag] = gv

                if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                    raw_lat = gps_info["GPSLatitude"]
                    raw_lon = gps_info["GPSLongitude"]

                    deg_lat = _convert_gps_rational(raw_lat[0]) + (_convert_gps_rational(raw_lat[1]) / 60.0) + (_convert_gps_rational(raw_lat[2]) / 3600.0)
                    if gps_info.get("GPSLatitudeRef") == "S":
                        deg_lat = -deg_lat

                    deg_lon = _convert_gps_rational(raw_lon[0]) + (_convert_gps_rational(raw_lon[1]) / 60.0) + (_convert_gps_rational(raw_lon[2]) / 3600.0)
                    if gps_info.get("GPSLongitudeRef") == "W":
                        deg_lon = -deg_lon

                    gps_lat = round(deg_lat, 6)
                    gps_lon = round(deg_lon, 6)
                    gps_source = "Camera EXIF Geotag"
                    has_gps = True
    except Exception:
        has_gps = False

    # Check validity of coordinates
    is_valid_coords = False
    is_suspicious_coords = False

    if has_gps and gps_lat is not None and gps_lon is not None:
        # Check coordinate bounds
        if -90.0 <= gps_lat <= 90.0 and -180.0 <= gps_lon <= 180.0:
            if abs(gps_lat) < 0.0001 and abs(gps_lon) < 0.0001:
                # Null Island (0,0) is often a mock/spoofed coordinate
                is_suspicious_coords = True
                status = "suspicious"
                status_label = "Suspicious Coordinates (Null Island)"
                status_icon = "✕"
                explanation = "GPS coordinates resolve to (0.0, 0.0), which usually indicates uninitialized or simulated GPS hardware."
            else:
                is_valid_coords = True
                status = "passed"
                status_label = "GPS Coordinates Verified"
                status_icon = "✓"
                explanation = f"Authentic GPS coordinates verified at {decimal_to_dms(gps_lat, True)}, {decimal_to_dms(gps_lon, False)}."
        else:
            is_suspicious_coords = True
            status = "suspicious"
            status_label = "Out of Range Coordinates"
            status_icon = "✕"
            explanation = f"GPS values ({gps_lat}, {gps_lon}) exceed valid planetary latitude/longitude limits."
    elif manual_gps and manual_gps[0] is not None and manual_gps[1] is not None:
        # Manual fallback provided by client device browser
        m_lat, m_lon = manual_gps
        if -90.0 <= m_lat <= 90.0 and -180.0 <= m_lon <= 180.0 and (abs(m_lat) > 0.001 or abs(m_lon) > 0.001):
            gps_lat, gps_lon = round(m_lat, 6), round(m_lon, 6)
            gps_source = "User Device Geolocation"
            is_valid_coords = True
            status = "passed"
            status_label = "Device Geolocation Provided"
            status_icon = "✓"
            explanation = f"User provided real-time device GPS ({decimal_to_dms(gps_lat, True)}, {decimal_to_dms(gps_lon, False)})."
        else:
            status = "unavailable"
            status_label = "GPS Metadata Unavailable"
            status_icon = "—"
            explanation = "GPS metadata unavailable. This does not indicate manipulation."
    else:
        status = "unavailable"
        status_label = "GPS Metadata Unavailable"
        status_icon = "—"
        explanation = "GPS metadata unavailable. Most chat apps and web platforms strip EXIF GPS for user privacy. This does not indicate manipulation."

    dms_str = f"{decimal_to_dms(gps_lat, True)}, {decimal_to_dms(gps_lon, False)}" if (is_valid_coords and gps_lat and gps_lon) else None

    return {
        "status": status,
        "status_label": status_label,
        "status_icon": status_icon,
        "has_gps": has_gps,
        "gps_valid": is_valid_coords,
        "is_suspicious": is_suspicious_coords,
        "latitude": gps_lat,
        "longitude": gps_lon,
        "dms": dms_str,
        "source": gps_source,
        "explanation": explanation,
        "summary": "GPS coordinates available" if is_valid_coords else "GPS metadata unavailable"
    }
