"""
Road Guardian AI — Authenticity Check Engine
=============================================
Autonomous Photo Verification & Tamper-Detection Pipeline

Backward-compatibility proxy re-exporting from the modular authenticity_engine package.
"""

from authenticity_engine import (
    analyze_photo_authenticity,
    check_exif_metadata,
    validate_gps_coordinates,
    check_capture_timestamp,
    compute_dct_phash,
    check_phash_duplicates,
    hamming_distance,
    detect_screen_photo,
    analyze_error_level,
    detect_ai_generation,
    calculate_authenticity_score,
    generate_authenticity_report,
    decimal_to_dms
)

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
