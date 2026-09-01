"""
Road Guardian AI — Authenticity Engine: Perceptual Hash (pHash) Duplicate Detector
Generates 64-bit DCT perceptual hashes and compares against historical submissions
to identify duplicates, resubmissions, or cropped variants with configurable similarity thresholds.
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import cv2
from PIL import Image


def compute_dct_phash(pil_img: Image.Image) -> str:
    """
    Computes a 64-bit Discrete Cosine Transform (DCT) Perceptual Hash (pHash).
    1. Grayscale & resize to 32x32
    2. Compute 2D DCT
    3. Extract 8x8 low-frequency AC grid
    4. Compute median of 64 coefficients
    5. Construct 64-bit binary vector -> 16-hex char string
    """
    try:
        # Convert PIL to grayscale numpy array
        gray = np.array(pil_img.convert("L"), dtype=np.float32)
        resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)

        # 2D DCT
        dct = cv2.dct(resized)

        # Extract top 8x8 coefficients (low frequencies)
        dct_low = dct[:8, :8]

        # Exclude DC coefficient at (0, 0) for median calculation
        med = np.median(dct_low.flatten()[1:])

        # Generate 64-bit hash
        diff = dct_low > med
        bit_string = "".join(["1" if b else "0" for b in diff.flatten()])

        # Convert to 16 hex characters
        hex_str = f"{int(bit_string, 2):016x}"
        return hex_str
    except Exception:
        # Fallback to dHash if cv2.dct fails
        try:
            resized = pil_img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
            pixels = list(resized.getdata())
            diff = []
            for row in range(8):
                for col in range(8):
                    diff.append(pixels[row * 9 + col] > pixels[row * 9 + col + 1])
            bit_string = "".join(["1" if b else "0" for b in diff])
            return f"{int(bit_string, 2):016x}"
        except Exception:
            return "0" * 16


def hamming_distance(hash1: str, hash2: str) -> int:
    """Computes bitwise Hamming distance between two 16-character hex hashes."""
    try:
        val1 = int(hash1, 16)
        val2 = int(hash2, 16)
        return bin(val1 ^ val2).count("1")
    except Exception:
        return 64


def calculate_similarity_percentage(dist: int, max_bits: int = 64) -> float:
    """Converts bitwise Hamming distance to similarity percentage (0.0 to 100.0)."""
    return max(0.0, min(100.0, round((1.0 - (dist / float(max_bits))) * 100.0, 1)))


def check_phash_duplicates(
    pil_img: Image.Image,
    historical_hashes: Optional[List[Dict[str, Any]]] = None,
    similarity_threshold: float = 88.0,
    current_filename: str = "uploaded_photo.jpg"
) -> Dict[str, Any]:
    """
    Computes perceptual hash for current image and compares with historical entries.
    similarity_threshold: percentage (e.g. 88.0% = distance <= 7).
    """
    current_hash = compute_dct_phash(pil_img)

    if not historical_hashes:
        historical_hashes = []

    best_match_id = None
    best_match_filename = None
    min_dist = 64
    max_sim = 0.0

    for item in historical_hashes:
        h = item.get("phash") or item.get("hash")
        if not h:
            continue
        dist = hamming_distance(current_hash, str(h))
        sim = calculate_similarity_percentage(dist)
        if sim > max_sim:
            max_sim = sim
            min_dist = dist
            best_match_id = item.get("id")
            best_match_filename = item.get("filename") or item.get("image_name")

    is_duplicate = max_sim >= similarity_threshold
    is_warning = max_sim >= 75.0 and not is_duplicate

    if is_duplicate:
        status = "suspicious"
        status_label = "Potential Duplicate Detected"
        status_icon = "✕"
        explanation = (
            f"Potential duplicate detected because the uploaded image has {max_sim}% "
            f"perceptual similarity with a previously submitted image "
            f"('{best_match_filename or f'Record #{best_match_id}'}')."
        )
    elif is_warning:
        status = "warning"
        status_label = "Moderate Visual Similarity"
        status_icon = "⚠"
        explanation = (
            f"Image exhibits {max_sim}% perceptual similarity with past submission "
            f"('{best_match_filename or f'Record #{best_match_id}'}'). Review recommended."
        )
    else:
        status = "passed"
        status_label = "Unique Image Hash"
        status_icon = "✓"
        explanation = (
            f"No strong duplicate match found in database. Highest historical similarity "
            f"is {max_sim}% (below threshold {similarity_threshold}%)."
        )

    return {
        "status": status,
        "status_label": status_label,
        "status_icon": status_icon,
        "current_phash": current_hash,
        "is_duplicate": is_duplicate,
        "duplicate_similarity": max_sim,
        "hamming_distance": min_dist,
        "matched_record_id": best_match_id,
        "matched_filename": best_match_filename,
        "similarity_threshold": similarity_threshold,
        "explanation": explanation,
        "summary": f"Duplicate similarity: {max_sim}%" if is_duplicate else "No strong duplicate match"
    }
