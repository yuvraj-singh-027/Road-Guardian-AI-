"""
Road Guardian AI — Authenticity Engine: EXIF Metadata Checker
Extracts and validates camera make, model, software, and dimensions.
Distinguishes 'unavailable' from 'suspicious' and never marks an image fake
purely for missing metadata.
"""

from typing import Dict, Any, Optional
from PIL import Image, ExifTags


# Known editing / synthetic generation software strings
KNOWN_EDITING_SOFTWARE = [
    "photoshop", "gimp", "lightroom", "canva", "picsart", "snapseed",
    "affinity", "coreldraw", "paint.net", "midjourney", "stable diffusion",
    "dall-e", "comfyui", "automatic1111", "fooocus"
]


def check_exif_metadata(pil_img: Image.Image) -> Dict[str, Any]:
    """
    Extracts available EXIF information from the image:
    - Camera manufacturer
    - Camera model
    - Capture date/time raw
    - Image dimensions
    - Software/editing application information

    Returns structured status, confidence, and human-readable explanation.
    """
    has_exif = False
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    software: Optional[str] = None
    editing_detected = False
    suspicious_software = False
    raw_exif: Dict[str, Any] = {}

    width, height = pil_img.size

    try:
        exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if exif:
            has_exif = True
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                # Only keep serializable values in raw_exif
                if isinstance(value, (str, int, float, bool)):
                    raw_exif[tag_name] = value
                else:
                    raw_exif[tag_name] = str(value)

            # Camera make / model
            if "Make" in raw_exif and raw_exif["Make"]:
                camera_make = str(raw_exif["Make"]).strip() or None
            if "Model" in raw_exif and raw_exif["Model"]:
                camera_model = str(raw_exif["Model"]).strip() or None

            # Software detection
            if "Software" in raw_exif and raw_exif["Software"]:
                software = str(raw_exif["Software"]).strip()
                editing_detected = True
                s_lower = software.lower()
                for keyword in KNOWN_EDITING_SOFTWARE:
                    if keyword in s_lower:
                        suspicious_software = True
                        break
            elif "ProcessingSoftware" in raw_exif and raw_exif["ProcessingSoftware"]:
                software = str(raw_exif["ProcessingSoftware"]).strip()
                editing_detected = True
    except Exception:
        has_exif = False

    camera_detected = bool(camera_make or camera_model)

    # Determine status:
    # 'passed' if camera detected and no suspicious editing software
    # 'warning' if editing software detected or no camera metadata (unavailable)
    # 'suspicious' if known editing/AI software detected
    if suspicious_software:
        status = "suspicious"
        status_label = "Editing Software Detected"
        status_icon = "✕"
        explanation = f"Image metadata indicates manipulation using '{software}'."
    elif camera_detected:
        if editing_detected:
            status = "warning"
            status_label = "Camera Detected (With Software Tag)"
            status_icon = "⚠"
            explanation = f"Camera hardware recognized ({camera_make or ''} {camera_model or ''}), but software tag '{software}' is present."
        else:
            status = "passed"
            status_label = "Camera Detected"
            status_icon = "✓"
            explanation = f"Authentic camera hardware metadata detected: {camera_make or 'Device'} {camera_model or ''}."
    else:
        # Missing EXIF is normal for social media or screenshots
        status = "unavailable"
        status_label = "Camera Metadata Unavailable"
        status_icon = "—"
        explanation = "Camera EXIF metadata unavailable. This commonly occurs with web compression, screenshots, or privacy strippers and does not indicate manipulation."

    return {
        "status": status,
        "status_label": status_label,
        "status_icon": status_icon,
        "has_exif": has_exif,
        "camera_detected": camera_detected,
        "camera_make": camera_make,
        "camera_model": camera_model,
        "software": software,
        "editing_detected": editing_detected,
        "suspicious_software": suspicious_software,
        "dimensions": {"width": width, "height": height},
        "explanation": explanation,
        "summary": "Camera detected" if camera_detected else "No camera metadata",
        "software_summary": f"Editing software detected ({software})" if editing_detected else "Editing software not detected"
    }
