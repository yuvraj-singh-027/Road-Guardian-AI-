"""
Road Guardian AI — Authenticity Engine: Timestamp Coherence Checker
Extracts capture timestamps from EXIF tags and validates temporal coherence
against the current submission time.
"""

from typing import Dict, Any, Optional
from datetime import datetime
from PIL import Image, ExifTags


def check_capture_timestamp(pil_img: Image.Image) -> Dict[str, Any]:
    """
    Extracts DateTimeOriginal / DateTimeDigitized / DateTime from EXIF.
    Compares against current system time to verify:
    1. Is the timestamp in the future? (Definite anomaly / manipulation)
    2. Is the timestamp extremely old (> 5 years) for a fresh road incident report? (Warning)
    3. Is it within normal historical capture range? (Passed)
    4. Is it unavailable? (Unavailable, non-penalizing)
    """
    raw_timestamp_str: Optional[str] = None
    parsed_dt: Optional[datetime] = None
    has_timestamp = False

    try:
        exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if exif:
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if tag_name in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
                    val_str = str(value).strip()
                    if val_str and val_str != "0000:00:00 00:00:00":
                        raw_timestamp_str = val_str
                        break

            if raw_timestamp_str:
                # Common EXIF date formats: 'YYYY:MM:DD HH:MM:SS' or ISO format
                for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y:%m:%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        parsed_dt = datetime.strptime(raw_timestamp_str, fmt)
                        has_timestamp = True
                        break
                    except ValueError:
                        continue
    except Exception:
        has_timestamp = False

    now = datetime.now()

    if has_timestamp and parsed_dt:
        # Check temporal coherence
        time_diff_days = (now - parsed_dt).total_seconds() / 86400.0

        if time_diff_days < -1.0: # Future timestamp by more than 24 hours
            status = "suspicious"
            status_label = "Inconsistent Future Timestamp"
            status_icon = "✕"
            explanation = f"Capture timestamp ({raw_timestamp_str}) is in the future relative to current time ({now.strftime('%Y-%m-%d')})."
            temporal_valid = False
        elif time_diff_days > 365 * 5: # Older than 5 years
            status = "warning"
            status_label = "Archived Timestamp (> 5 years)"
            status_icon = "⚠"
            explanation = f"Capture timestamp ({raw_timestamp_str}) is over 5 years old. This may be an archived photograph rather than a recent road incident."
            temporal_valid = True
        else:
            status = "passed"
            status_label = "Capture Timestamp Verified"
            status_icon = "✓"
            explanation = f"Capture timestamp verified: {parsed_dt.strftime('%B %d, %Y at %I:%M %p')}."
            temporal_valid = True
    else:
        status = "unavailable"
        status_label = "Capture Timestamp Unavailable"
        status_icon = "—"
        explanation = "Capture timestamp metadata unavailable. Common when images are shared via web platforms or stripped of EXIF. This does not indicate manipulation."
        temporal_valid = False

    return {
        "status": status,
        "status_label": status_label,
        "status_icon": status_icon,
        "has_timestamp": has_timestamp,
        "timestamp_valid": temporal_valid,
        "raw_timestamp": raw_timestamp_str,
        "formatted_timestamp": parsed_dt.strftime("%Y-%m-%d %H:%M:%S") if parsed_dt else None,
        "explanation": explanation,
        "summary": "Capture time available" if has_timestamp else "Capture time unavailable"
    }
