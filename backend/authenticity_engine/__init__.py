"""
Road Guardian AI — Authenticity Check Engine
=============================================
Modular, autonomous photo verification & tamper-detection pipeline.

7-Stage Forensic Verification:
1. EXIF Camera Metadata ("Camera?")
2. GPS Geotag Validation ("Where?")
3. Timestamp Coherence ("When?")
4. Perceptual Hash Duplicate Detection ("Duplicate hai?")
5. Screen Re-photography Moiré Detection ("Screen photo?")
6. Error Level Analysis Splicing Check ("Editing signs?")
7. Frequency Noise Spectrum AI Image Detector ("Synthetic signs?")
"""

import io
import time
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import cv2
from PIL import Image

from .exif_checker import check_exif_metadata
from .gps_validator import validate_gps_coordinates, decimal_to_dms
from .timestamp_checker import check_capture_timestamp
from .phash_detector import compute_dct_phash, check_phash_duplicates, hamming_distance
from .screen_detector import detect_screen_photo
from .ela_analyzer import analyze_error_level
from .ai_image_detector import detect_ai_generation
from .authenticity_scorer import calculate_authenticity_score
from .authenticity_report import generate_authenticity_report


def analyze_photo_authenticity(
    img_bytes: bytes,
    filename: str = "hazard_photo.jpg",
    manual_gps: Optional[Tuple[Optional[float], Optional[float]]] = None,
    has_manual_gps: bool = False,
    similarity_threshold: float = 88.0,
    historical_hashes: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Master Authenticity Check Engine running all 7 verification modules in sequence:
    1. EXIF Check
    2. GPS Geotag Check
    3. Timestamp Check
    4. pHash Duplicate Check
    5. Screen Re-photography Moiré Check
    6. Error Level Analysis (ELA) Check
    7. AI-Generated Image Detector
    Synthesizes composite 0-100 score and returns structured report.
    """
    start_time = time.time()

    # 0. Decode image with PIL and OpenCV
    try:
        pil_img = Image.open(io.BytesIO(img_bytes))
    except Exception as e:
        raise ValueError(f"Invalid image format: {e}")

    np_arr = np.frombuffer(img_bytes, np.uint8)
    img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError("Failed to decode image buffer with OpenCV.")

    w, h = pil_img.size
    dimensions = {"width": w, "height": h}

    # Prepare manual GPS tuple if provided
    gps_tuple = None
    if manual_gps and manual_gps[0] is not None and manual_gps[1] is not None:
        try:
            gps_tuple = (float(manual_gps[0]), float(manual_gps[1]))
        except (ValueError, TypeError):
            gps_tuple = None

    # Module 1: EXIF Metadata Check
    exif_res = check_exif_metadata(pil_img)

    # Module 2: GPS Geotag Validation
    gps_res = validate_gps_coordinates(pil_img, manual_gps=gps_tuple)

    # Module 3: Timestamp Coherence Check
    timestamp_res = check_capture_timestamp(pil_img)

    # Module 4: Perceptual Hash Duplicate Detection
    phash_res = check_phash_duplicates(
        pil_img,
        historical_hashes=historical_hashes,
        similarity_threshold=similarity_threshold,
        current_filename=filename
    )

    # Module 5: Screen Re-photography & Moiré Detection
    screen_res = detect_screen_photo(img_bgr)

    # Module 6: Error Level Analysis (ELA) Splicing Check
    ela_res = analyze_error_level(pil_img)

    # Module 7: AI-Generated Image Detector
    ai_res = detect_ai_generation(img_bgr, pil_img=pil_img)

    # Module 8: Authenticity Score Synthesis (0-100)
    scorer_res = calculate_authenticity_score(
        exif_res=exif_res,
        gps_res=gps_res,
        timestamp_res=timestamp_res,
        phash_res=phash_res,
        screen_res=screen_res,
        ela_res=ela_res,
        ai_res=ai_res
    )

    elapsed_ms = round((time.time() - start_time) * 1000.0, 2)

    # Module 9: Structured Forensic Report Assembly
    final_report = generate_authenticity_report(
        filename=filename,
        dimensions=dimensions,
        exif_res=exif_res,
        gps_res=gps_res,
        timestamp_res=timestamp_res,
        phash_res=phash_res,
        screen_res=screen_res,
        ela_res=ela_res,
        ai_res=ai_res,
        scorer_res=scorer_res,
        processing_time_ms=elapsed_ms
    )

    return final_report


__all__ = [
    "analyze_photo_authenticity",
    "check_exif_metadata",
    "validate_gps_coordinates",
    "check_capture_timestamp",
    "compute_dct_phash",
    "check_phash_duplicates",
    "hamming_distance",
    "detect_screen_photo",
    "analyze_error_level",
    "detect_ai_generation",
    "calculate_authenticity_score",
    "generate_authenticity_report",
    "decimal_to_dms"
]
