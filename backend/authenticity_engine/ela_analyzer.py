"""
Road Guardian AI — Authenticity Engine: Error Level Analysis (ELA)
Identifies digital manipulation, regional splicing, and resaved artifacts
by comparing JPEG compression error levels across spatial blocks.
Generates an enhanced Base64 visual map for forensic UI inspection.
"""

import io
import base64
from typing import Dict, Any
import numpy as np
import cv2
from PIL import Image, ImageChops, ImageEnhance


def analyze_error_level(pil_img: Image.Image, quality: int = 92) -> Dict[str, Any]:
    """
    Performs Error Level Analysis (ELA):
    1. Recompresses image to in-memory buffer at specified JPEG quality (default 92).
    2. Computes pixel difference: |Original - Recompressed|.
    3. Analyzes block-level variance to detect regional splicing / localized editing.
    4. Generates an enhanced visual map encoded in Base64 for client display.
    """
    try:
        orig = pil_img.convert("RGB")
        w, h = orig.size

        # Downsample extremely large images to speed up ELA calculation if needed
        max_dim = 900
        if max(w, h) > max_dim:
            scale = max_dim / float(max(w, h))
            orig_work = orig.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        else:
            orig_work = orig

        # Re-save to memory at target quality
        buf = io.BytesIO()
        orig_work.save(buf, format="JPEG", quality=quality)
        buf.seek(0)
        recompressed = Image.open(buf)

        # Compute difference
        diff_img = ImageChops.difference(orig_work, recompressed)

        # Determine scale factor for human visualization
        extrema = diff_img.getextrema()
        max_diff = max([ex[1] for ex in extrema]) if extrema else 1
        scale_factor = 255.0 / max(max_diff, 1)
        scale_factor = min(scale_factor, 22.0) # Cap enhancement to prevent overblown noise

        # Enhanced difference for preview
        enhancer = ImageEnhance.Brightness(diff_img)
        enhanced_diff = enhancer.enhance(scale_factor)

        # Convert to Base64 data URL for frontend UI display
        out_buf = io.BytesIO()
        enhanced_diff.save(out_buf, format="JPEG", quality=90)
        ela_b64 = f"data:image/jpeg;base64,{base64.b64encode(out_buf.getvalue()).decode('ascii')}"

        # ---------------- Quantitative Metric Analysis ----------------
        diff_np = np.array(diff_img, dtype=np.float32)
        mean_diff = float(np.mean(diff_np))
        std_diff = float(np.std(diff_np))
        max_error = int(max_diff)

        # Divide into 4x4 spatial grid cells to test for localized splicing anomalies
        grid_stds = []
        dh, dw, _ = diff_np.shape
        step_y = max(1, dh // 4)
        step_x = max(1, dw // 4)

        suspicious_blocks_count = 0
        for r in range(4):
            for c in range(4):
                cell = diff_np[r * step_y:(r + 1) * step_y, c * step_x:(c + 1) * step_x]
                if cell.size > 0:
                    c_std = float(np.std(cell))
                    grid_stds.append(c_std)
                    if c_std > (std_diff * 1.85) and c_std > 14.0:
                        suspicious_blocks_count += 1

        avg_grid_std = float(np.mean(grid_stds)) if grid_stds else std_diff
        max_grid_std = float(max(grid_stds)) if grid_stds else std_diff
        variance_ratio = max_grid_std / (avg_grid_std + 1e-5)

        # Confidence calculation
        is_edited = False
        is_warning = False

        if std_diff > 16.0 and variance_ratio > 2.3:
            is_edited = True
            confidence = min(0.92, 0.60 + (variance_ratio - 2.3) * 0.12)
        elif variance_ratio > 3.0 and suspicious_blocks_count >= 2:
            is_edited = True
            confidence = min(0.90, 0.65 + (suspicious_blocks_count * 0.08))
        elif variance_ratio > 2.0 or std_diff > 14.0 or suspicious_blocks_count >= 1:
            is_warning = True
            confidence = 0.55
        else:
            confidence = 0.85

        if is_edited:
            status = "suspicious"
            status_label = "Compression Inconsistencies Detected"
            status_icon = "✕"
            explanation = (
                f"Error Level Analysis detected significant compression variance (Variance ratio: {variance_ratio:.2f}, "
                f"Std: {std_diff:.1f}). Certain image regions exhibit distinct error rates, suggesting localized "
                f"digital splicing, content insertion, or multi-generational JPEG re-saving."
            )
        elif is_warning:
            status = "warning"
            status_label = "Minor ELA Anomalies Detected"
            status_icon = "⚠"
            explanation = (
                f"Minor compression inconsistencies detected across spatial regions (Variance ratio: {variance_ratio:.2f}). "
                f"May indicate light re-saving, text overlay, or varied texture detail. Further verification may be required."
            )
        else:
            status = "passed"
            status_label = "Coherent Error Level"
            status_icon = "✓"
            explanation = (
                f"Coherent JPEG compression error level across all image quadrants (Mean error: {mean_diff:.1f}, "
                f"Std: {std_diff:.1f}). No anomalous localized splicing detected."
            )

        return {
            "status": status,
            "status_label": status_label,
            "status_icon": status_icon,
            "is_edited": is_edited,
            "confidence": round(confidence, 2),
            "max_error": max_error,
            "mean_error": round(mean_diff, 2),
            "std_error": round(std_diff, 2),
            "variance_ratio": round(variance_ratio, 2),
            "suspicious_regions_detected": is_edited or is_warning,
            "suspicious_blocks_count": suspicious_blocks_count,
            "ela_visualization_b64": ela_b64,
            "explanation": explanation,
            "summary": "Suspicious ELA editing signs" if is_edited else ("Minor ELA anomalies detected" if is_warning else "Coherent JPEG error level")
        }
    except Exception as ex:
        return {
            "status": "passed",
            "status_label": "ELA Inconclusive",
            "status_icon": "—",
            "is_edited": False,
            "confidence": 0.30,
            "error": str(ex),
            "ela_visualization_b64": None,
            "explanation": f"ELA analysis could not complete: {ex}.",
            "summary": "ELA check inconclusive"
        }
