"""
Road Guardian AI — Authenticity Engine: Report Formatter
Assembles the complete structured forensic report, individual check results with
standard status badges (✓ Passed, ⚠ Warning, ✕ Suspicious, — Unavailable),
confidence values, explainability, location, and visual representations.
"""

from typing import Dict, Any, List


def generate_authenticity_report(
    filename: str,
    dimensions: Dict[str, int],
    exif_res: Dict[str, Any],
    gps_res: Dict[str, Any],
    timestamp_res: Dict[str, Any],
    phash_res: Dict[str, Any],
    screen_res: Dict[str, Any],
    ela_res: Dict[str, Any],
    ai_res: Dict[str, Any],
    scorer_res: Dict[str, Any],
    processing_time_ms: float
) -> Dict[str, Any]:
    """
    Builds a comprehensive, transparent forensic authenticity report.
    """
    # 7-stage verification matrix with clear standardized statuses
    verification_checklist = [
        {
            "id": "camera_exif",
            "name": "Camera Hardware Metadata",
            "question": "Camera?",
            "status": exif_res.get("status", "unavailable"),
            "status_label": exif_res.get("status_label"),
            "status_icon": exif_res.get("status_icon", "—"),
            "summary": exif_res.get("summary"),
            "explanation": exif_res.get("explanation"),
            "details": {
                "make": exif_res.get("camera_make"),
                "model": exif_res.get("camera_model"),
                "software": exif_res.get("software"),
                "editing_detected": exif_res.get("editing_detected")
            }
        },
        {
            "id": "gps_geotag",
            "name": "GPS Geotag Verification",
            "question": "Where?",
            "status": gps_res.get("status", "unavailable"),
            "status_label": gps_res.get("status_label"),
            "status_icon": gps_res.get("status_icon", "—"),
            "summary": gps_res.get("summary"),
            "explanation": gps_res.get("explanation"),
            "details": {
                "latitude": gps_res.get("latitude"),
                "longitude": gps_res.get("longitude"),
                "dms": gps_res.get("dms"),
                "source": gps_res.get("source"),
                "valid": gps_res.get("gps_valid")
            }
        },
        {
            "id": "timestamp_coherence",
            "name": "Temporal Timestamp Coherence",
            "question": "When?",
            "status": timestamp_res.get("status", "unavailable"),
            "status_label": timestamp_res.get("status_label"),
            "status_icon": timestamp_res.get("status_icon", "—"),
            "summary": timestamp_res.get("summary"),
            "explanation": timestamp_res.get("explanation"),
            "details": {
                "timestamp": timestamp_res.get("formatted_timestamp") or timestamp_res.get("raw_timestamp"),
                "valid": timestamp_res.get("timestamp_valid")
            }
        },
        {
            "id": "phash_duplicate",
            "name": "Perceptual Hash Duplicate Check",
            "question": "Duplicate hai?",
            "status": phash_res.get("status", "passed"),
            "status_label": phash_res.get("status_label"),
            "status_icon": phash_res.get("status_icon", "✓"),
            "summary": phash_res.get("summary"),
            "explanation": phash_res.get("explanation"),
            "details": {
                "phash": phash_res.get("current_phash"),
                "is_duplicate": phash_res.get("is_duplicate"),
                "similarity": phash_res.get("duplicate_similarity"),
                "matched_filename": phash_res.get("matched_filename"),
                "matched_id": phash_res.get("matched_record_id"),
                "threshold": phash_res.get("similarity_threshold")
            }
        },
        {
            "id": "screen_detection",
            "name": "Screen Re-photography & Moiré Analysis",
            "question": "Screen photo?",
            "status": screen_res.get("status", "passed"),
            "status_label": screen_res.get("status_label"),
            "status_icon": screen_res.get("status_icon", "✓"),
            "summary": screen_res.get("summary"),
            "explanation": screen_res.get("explanation"),
            "details": {
                "is_screen_photo": screen_res.get("is_screen_photo"),
                "screen_probability": screen_res.get("screen_probability"),
                "confidence": screen_res.get("confidence"),
                "fft_peak_ratio": screen_res.get("fft_peak_ratio"),
                "laplacian_variance": screen_res.get("laplacian_variance")
            }
        },
        {
            "id": "ela_editing",
            "name": "Error Level Analysis (ELA) Splicing Check",
            "question": "Editing signs?",
            "status": ela_res.get("status", "passed"),
            "status_label": ela_res.get("status_label"),
            "status_icon": ela_res.get("status_icon", "✓"),
            "summary": ela_res.get("summary"),
            "explanation": ela_res.get("explanation"),
            "details": {
                "is_edited": ela_res.get("is_edited"),
                "confidence": ela_res.get("confidence"),
                "variance_ratio": ela_res.get("variance_ratio"),
                "mean_error": ela_res.get("mean_error"),
                "std_error": ela_res.get("std_error"),
                "has_visualization": bool(ela_res.get("ela_visualization_b64"))
            }
        },
        {
            "id": "ai_detector",
            "name": "Synthetic / AI-Generated Image Detector",
            "question": "Synthetic signs?",
            "status": ai_res.get("status", "passed"),
            "status_label": ai_res.get("status_label"),
            "status_icon": ai_res.get("status_icon", "✓"),
            "summary": ai_res.get("summary"),
            "explanation": ai_res.get("explanation"),
            "details": {
                "is_ai_generated": ai_res.get("is_ai_generated"),
                "ai_probability": ai_res.get("ai_probability"),
                "confidence": ai_res.get("confidence"),
                "signals": ai_res.get("signals_detected"),
                "high_freq_noise_ratio": ai_res.get("high_freq_noise_ratio"),
                "local_rgb_correlation": ai_res.get("local_rgb_correlation")
            }
        }
    ]

    # Human-readable formatted summary lines (Requirement 10 format)
    bullet_summary = [f"{item['status_icon']} {item['summary']}" for item in verification_checklist]

    # Clean text report representation
    text_report = f"""==================================================
IMAGE AUTHENTICITY REPORT
==================================================
File: {filename}
Resolution: {dimensions.get('width', 0)} x {dimensions.get('height', 0)} px
Processing Time: {processing_time_ms} ms

FINAL AUTHENTICITY SCORE: {scorer_res['final_score']} / 100
STATUS: {scorer_res['status']} {scorer_res['status_badge']}

VERIFICATION MATRIX:
"""
    for item in verification_checklist:
        text_report += f"{item['status_icon']} [{item['question']}] {item['name']}: {item['summary']}\n"

    if scorer_res.get("threat_reasons"):
        text_report += "\nFLAGGED EVIDENCE:\n"
        for t in scorer_res["threat_reasons"]:
            text_report += f"  - {t}\n"

    if scorer_res.get("trust_reasons"):
        text_report += "\nAUTHENTICITY EVIDENCE:\n"
        for tr in scorer_res["trust_reasons"]:
            text_report += f"  - {tr}\n"

    text_report += "\n=================================================="

    return {
        "filename": filename,
        "dimensions": dimensions,
        "processing_time_ms": processing_time_ms,
        "authenticity_score": scorer_res["final_score"],
        "status": scorer_res["status"],
        "status_code": scorer_res["status_code"],
        "status_color": scorer_res["status_color"],
        "status_badge": scorer_res["status_badge"],
        "bullet_summary": bullet_summary,
        "checklist": verification_checklist,
        "threat_reasons": scorer_res.get("threat_reasons", []),
        "trust_reasons": scorer_res.get("trust_reasons", []),
        "neutral_notes": scorer_res.get("neutral_notes", []),
        "penalties_breakdown": scorer_res.get("penalties_breakdown", {}),
        "ela_visualization_b64": ela_res.get("ela_visualization_b64"),
        "text_report": text_report,
        "checks_summary": {
            "exif": exif_res,
            "gps": gps_res,
            "timestamp": timestamp_res,
            "phash": phash_res,
            "screen_detection": screen_res,
            "ela_editing": ela_res,
            "ai_synthetic": ai_res
        }
    }
