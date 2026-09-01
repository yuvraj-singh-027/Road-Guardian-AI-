"""
Road Guardian AI — Authenticity Engine: Scoring Synthesizer
Combines independent forensic signals into a transparent, explainable 0–100 Authenticity Score.
Ensures missing metadata never tanks an authentic image into the fake category.
"""

from typing import Dict, Any, List, Tuple


def calculate_authenticity_score(
    exif_res: Dict[str, Any],
    gps_res: Dict[str, Any],
    timestamp_res: Dict[str, Any],
    phash_res: Dict[str, Any],
    screen_res: Dict[str, Any],
    ela_res: Dict[str, Any],
    ai_res: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Synthesizes independent verification signals into a composite score (0-100).
    Categories:
      90–100: HIGHLY AUTHENTIC
      70–89:  LIKELY AUTHENTIC
      40–69:  SUSPICIOUS
      0–39:   HIGH RISK / LIKELY INAUTHENTIC
    """
    score = 100.0
    threat_reasons: List[str] = []
    trust_reasons: List[str] = []
    neutral_notes: List[str] = []
    penalties_breakdown: Dict[str, float] = {}

    # 1. pHash Duplicate Check (Max penalty: 35.0)
    if phash_res.get("is_duplicate"):
        sim = float(phash_res.get("duplicate_similarity", 90.0))
        p = round(min(35.0, max(20.0, (sim - 75.0) * 1.4)), 1)
        score -= p
        penalties_breakdown["duplicate_phash"] = p
        matched = phash_res.get("matched_filename") or f"Record #{phash_res.get('matched_record_id')}"
        threat_reasons.append(f"Potential duplicate submission ({sim}% similarity with {matched})")
    elif phash_res.get("status") == "warning":
        score -= 10.0
        penalties_breakdown["duplicate_phash"] = 10.0
        threat_reasons.append(f"Moderate visual similarity ({phash_res.get('duplicate_similarity')}%) with previous record")
    else:
        trust_reasons.append("Unique perceptual image hash (no prior database match)")

    # 2. Screen Re-photography Check (Max penalty: 35.0)
    if screen_res.get("is_screen_photo"):
        prob = float(screen_res.get("screen_probability", 0.75))
        p = round(min(35.0, max(22.0, prob * 35.0)), 1)
        score -= p
        penalties_breakdown["screen_photo"] = p
        threat_reasons.append(f"Screen re-photography detected (Probability: {int(prob * 100)}%, Moiré peak ratio: {screen_res.get('fft_peak_ratio')})")
    elif screen_res.get("status") == "warning":
        score -= 12.0
        penalties_breakdown["screen_photo"] = 12.0
        threat_reasons.append(f"Possible screen display / Moiré pattern artifacts ({int(screen_res.get('screen_probability', 0.4) * 100)}%)")
    else:
        trust_reasons.append("Physical scene verified (natural frequency distribution, no screen lattice)")

    # 3. AI Synthetic Image Detector (Max penalty: 35.0)
    if ai_res.get("is_ai_generated"):
        prob = float(ai_res.get("ai_probability", 0.75))
        p = round(min(35.0, max(22.0, prob * 35.0)), 1)
        score -= p
        penalties_breakdown["ai_synthetic"] = p
        threat_reasons.append(f"AI-generated / synthetic characteristics detected ({int(prob * 100)}% probability)")
    elif ai_res.get("status") == "warning":
        score -= 12.0
        penalties_breakdown["ai_synthetic"] = 12.0
        threat_reasons.append(f"Partial synthetic texture / high-frequency noise decay ({int(ai_res.get('ai_probability', 0.4) * 100)}%)")
    else:
        trust_reasons.append("Natural optical sensor noise spectrum (authentic CMOS physical sensor)")

    # 4. Error Level Analysis (ELA) Splicing Check (Max penalty: 18.0)
    if ela_res.get("is_edited"):
        score -= 18.0
        penalties_breakdown["ela_editing"] = 18.0
        threat_reasons.append(f"JPEG compression inconsistencies / splicing detected (Variance ratio: {ela_res.get('variance_ratio')})")
    elif ela_res.get("status") == "warning":
        score -= 6.0
        penalties_breakdown["ela_editing"] = 6.0
        neutral_notes.append(f"Minor ELA compression variance ({ela_res.get('variance_ratio')})")
    else:
        trust_reasons.append("Coherent JPEG error level analysis across quadrants")

    # 5. EXIF Camera Metadata Check (Max penalty: 15.0 for suspicious software)
    if exif_res.get("suspicious_software"):
        score -= 15.0
        penalties_breakdown["editing_software"] = 15.0
        threat_reasons.append(f"Digital editing / AI software tag in metadata ('{exif_res.get('software')}')")
    elif exif_res.get("camera_detected"):
        make = exif_res.get("camera_make") or "Device"
        model = exif_res.get("camera_model") or ""
        trust_reasons.append(f"Camera hardware recognized ({make} {model}".strip() + ")")
    else:
        neutral_notes.append("Camera metadata unavailable (common on compressed/shared web photos)")

    # 6. GPS Geotag Check
    if gps_res.get("is_suspicious"):
        score -= 10.0
        penalties_breakdown["gps_suspicious"] = 10.0
        threat_reasons.append(gps_res.get("explanation", "Suspicious GPS coordinates"))
    elif gps_res.get("gps_valid"):
        coord_display = gps_res.get("dms") or f"{gps_res.get('latitude')}, {gps_res.get('longitude')}"
        trust_reasons.append(f"Verified coordinates ({coord_display})")
    else:
        neutral_notes.append("GPS metadata unavailable (no penalty applied)")

    # 7. Timestamp Coherence Check
    if timestamp_res.get("status") == "suspicious":
        score -= 12.0
        penalties_breakdown["timestamp_future"] = 12.0
        threat_reasons.append(timestamp_res.get("explanation", "Future capture timestamp"))
    elif timestamp_res.get("status") == "warning":
        score -= 4.0
        penalties_breakdown["timestamp_archived"] = 4.0
        neutral_notes.append(timestamp_res.get("explanation", "Archived timestamp"))
    elif timestamp_res.get("timestamp_valid"):
        trust_reasons.append(f"Temporal timestamp verified ({timestamp_res.get('formatted_timestamp')})")
    else:
        neutral_notes.append("Capture timestamp unavailable (no penalty applied)")

    # Clamp score to [0.0, 100.0]
    final_score = max(0.0, min(100.0, round(score, 1)))

    # Classification into standard transparent tiers
    if final_score >= 90.0:
        status = "HIGHLY AUTHENTIC"
        status_code = "highly_authentic"
        status_color = "green"
        status_badge = "🟢"
    elif final_score >= 70.0:
        status = "LIKELY AUTHENTIC"
        status_code = "likely_authentic"
        status_color = "yellow"
        status_badge = "🟡"
    elif final_score >= 40.0:
        status = "SUSPICIOUS"
        status_code = "suspicious"
        status_color = "orange"
        status_badge = "🟠"
    else:
        status = "HIGH RISK / LIKELY INAUTHENTIC"
        status_code = "high_risk"
        status_color = "red"
        status_badge = "🔴"

    return {
        "final_score": final_score,
        "status": status,
        "status_code": status_code,
        "status_color": status_color,
        "status_badge": status_badge,
        "threat_reasons": threat_reasons,
        "trust_reasons": trust_reasons,
        "neutral_notes": neutral_notes,
        "penalties_breakdown": penalties_breakdown
    }
