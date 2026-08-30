"""
Road Guardian AI — Authenticity Check Engine
=============================================
Autonomous Photo Verification & Tamper-Detection Pipeline

Features:
1. EXIF Camera Metadata Verification ("Camera?")
2. GPS Geotag Verification ("Where?")
3. Timestamp Coherence Check ("When?")
4. Perceptual Hash (pHash) Duplicate Detection ("Duplicate hai?")
5. Moiré Pattern & Screen Re-photography Detection via 2D FFT ("Screen photo?")
6. Error Level Analysis (ELA) JPEG Splicing/Editing Check ("Editing signs?")
7. Frequency Noise Spectrum AI Image Detector ("Synthetic signs?")
"""

import io
import time
import math
import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import cv2
from PIL import Image, ExifTags, ImageChops, ImageEnhance

# In-memory pHash cache for duplicate detection (hash -> filename/timestamp)
PHASH_STORE: Dict[str, Dict[str, Any]] = {}


def calculate_dhash(pil_img: Image.Image, hash_size: int = 8) -> str:
    """Calculates Difference Hash (dHash) for perceptual image comparison."""
    try:
        resized = pil_img.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
        pixels = list(resized.getdata())
        difference = []
        for row in range(hash_size):
            for col in range(hash_size):
                pixel_left = pixels[row * (hash_size + 1) + col]
                pixel_right = pixels[row * (hash_size + 1) + col + 1]
                difference.append(pixel_left > pixel_right)
        decimal_value = 0
        hex_string = []
        for i, value in enumerate(difference):
            if value:
                decimal_value += 2 ** (i % 8)
            if (i % 8) == 7:
                hex_string.append(hex(decimal_value)[2:].zfill(2))
                decimal_value = 0
        return "".join(hex_string)
    except Exception:
        return "0" * 16


def hamming_distance(hash1: str, hash2: str) -> int:
    """Computes bitwise Hamming Distance between two hex pHash strings."""
    try:
        val1 = int(hash1, 16)
        val2 = int(hash2, 16)
        return bin(val1 ^ val2).count('1')
    except Exception:
        return 64


def analyze_exif_gps_timestamp(pil_img: Image.Image) -> Dict[str, Any]:
    """
    Inspects EXIF metadata for Camera Make/Model, GPS Geotags, and Timestamp.
    """
    has_exif = False
    camera_make = None
    camera_model = None
    software = None
    gps_lat = None
    gps_lon = None
    timestamp_str = None

    try:
        exif = pil_img._getexif() if hasattr(pil_img, "_getexif") else None
        if exif:
            has_exif = True
            exif_data = {}
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                exif_data[tag_name] = value

            camera_make = str(exif_data.get("Make", "")).strip() or None
            camera_model = str(exif_data.get("Model", "")).strip() or None
            software = str(exif_data.get("Software", "")).strip() or None

            # Timestamp
            dt_raw = exif_data.get("DateTimeOriginal") or exif_data.get("DateTimeDigitized") or exif_data.get("DateTime")
            if dt_raw:
                timestamp_str = str(dt_raw).strip()

            # GPS Info
            gps_info_raw = exif_data.get("GPSInfo")
            if gps_info_raw:
                gps_info = {}
                for gk, gv in gps_info_raw.items():
                    sub_tag = ExifTags.GPSTAGS.get(gk, str(gk))
                    gps_info[sub_tag] = gv

                def _convert_deg(v):
                    return float(v[0]) + (float(v[1]) / 60.0) + (float(v[2]) / 3600.0)

                if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                    lat = _convert_deg(gps_info["GPSLatitude"])
                    if gps_info.get("GPSLatitudeRef") != "N":
                        lat = -lat
                    lon = _convert_deg(gps_info["GPSLongitude"])
                    if gps_info.get("GPSLongitudeRef") != "E":
                        lon = -lon
                    gps_lat, gps_lon = round(lat, 6), round(lon, 6)
    except Exception as e:
        has_exif = False

    # Score component calculations
    exif_valid = has_exif and (camera_make is not None or camera_model is not None)
    gps_valid = (gps_lat is not None and gps_lon is not None)
    timestamp_valid = (timestamp_str is not None)

    return {
        "has_exif": has_exif,
        "camera_make": camera_make,
        "camera_model": camera_model,
        "software": software,
        "gps_latitude": gps_lat,
        "gps_longitude": gps_lon,
        "gps_valid": gps_valid,
        "timestamp_str": timestamp_str,
        "timestamp_valid": timestamp_valid,
        "exif_valid": exif_valid
    }


def analyze_phash_duplicate(phash_val: str, filename: str = "current_upload.jpg") -> Dict[str, Any]:
    """
    Checks perceptual hash against previously logged images to detect duplicates.
    """
    is_duplicate = False
    matched_file = None
    min_dist = 64

    for existing_hash, info in PHASH_STORE.items():
        dist = hamming_distance(phash_val, existing_hash)
        if dist < min_dist:
            min_dist = dist
            matched_file = info.get("filename")

    if min_dist <= 6:
        is_duplicate = True

    # Register hash in store
    PHASH_STORE[phash_val] = {
        "filename": filename,
        "timestamp": datetime.datetime.now().isoformat()
    }

    return {
        "phash": phash_val,
        "is_duplicate": is_duplicate,
        "matched_filename": matched_file if is_duplicate else None,
        "hamming_distance": min_dist
    }


def analyze_screen_moire(img_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Detects screen re-photography (photos taken off monitor/phone screens)
    using 2D Fast Fourier Transform (FFT) Moiré frequency grid spectrum analysis.
    """
    try:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # Downsample for computational speed
        if max(h, w) > 512:
            scale = 512.0 / max(h, w)
            gray = cv2.resize(gray, (int(w * scale), int(h * scale)))

        gh, gw = gray.shape

        # Compute 2D FFT
        fft = np.fft.fft2(gray.astype(np.float32))
        fft_shift = np.fft.fftshift(fft)
        magnitude_spectrum = 20 * np.log(np.abs(fft_shift) + 1e-5)

        # Mask out DC component (center low frequencies)
        cy, cx = gh // 2, gw // 2
        radius = int(min(gh, gw) * 0.08)
        y, x = np.ogrid[:gh, :gw]
        center_mask = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
        magnitude_spectrum_high = magnitude_spectrum.copy()
        magnitude_spectrum_high[center_mask] = 0

        # Moiré patterns produce high spatial frequency peaks
        high_freq_mean = float(np.mean(magnitude_spectrum_high))
        high_freq_max = float(np.max(magnitude_spectrum_high))
        ratio = high_freq_max / (high_freq_mean + 1e-5)

        # Texture periodicity & grid variance (screen subpixel grid)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        is_screen_photo = False
        confidence = 0.0

        if ratio > 3.8 and laplacian_var > 450.0:
            is_screen_photo = True
            confidence = min(0.95, (ratio - 3.8) * 0.15 + 0.60)
        elif ratio > 4.5:
            is_screen_photo = True
            confidence = min(0.90, (ratio - 4.5) * 0.12 + 0.50)

        return {
            "is_screen_photo": is_screen_photo,
            "confidence": round(confidence, 2),
            "fft_peak_ratio": round(ratio, 2),
            "laplacian_variance": round(laplacian_var, 2)
        }
    except Exception as ex:
        return {
            "is_screen_photo": False,
            "confidence": 0.0,
            "error": str(ex)
        }


def analyze_ela_editing(pil_img: Image.Image, quality: int = 95) -> Dict[str, Any]:
    """
    Error Level Analysis (ELA) to detect image manipulation, digital splicing,
    or compression artifacts.
    """
    try:
        # Convert to RGB
        orig = pil_img.convert("RGB")

        # Save to memory at specified quality
        buf = io.BytesIO()
        orig.save(buf, format="JPEG", quality=quality)
        buf.seek(0)
        recompressed = Image.open(buf)

        # Compute difference
        ela_img = ImageChops.difference(orig, recompressed)

        # Calculate max error and mean error intensity
        extrema = ela_img.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        
        # Convert difference to numpy array for regional variance analysis
        ela_np = np.array(ela_img, dtype=np.float32)
        mean_diff = float(np.mean(ela_np))
        std_diff = float(np.std(ela_np))

        # High variance across grid cells indicates regional splicing / editing
        h, w, _ = ela_np.shape
        grid_stds = []
        gh_step, gw_step = max(1, h // 4), max(1, w // 4)
        for i in range(4):
            for j in range(4):
                cell = ela_np[i * gh_step:(i + 1) * gh_step, j * gw_step:(j + 1) * gw_step]
                if cell.size > 0:
                    grid_stds.append(float(np.std(cell)))

        grid_max_var = max(grid_stds) if grid_stds else std_diff
        var_ratio = grid_max_var / (std_diff + 1e-5)

        is_edited = False
        if std_diff > 12.5 and var_ratio > 2.2:
            is_edited = True
        elif std_diff > 18.0:
            is_edited = True

        return {
            "is_edited": is_edited,
            "max_error": int(max_diff),
            "mean_error": round(mean_diff, 2),
            "std_error": round(std_diff, 2),
            "variance_ratio": round(var_ratio, 2)
        }
    except Exception as ex:
        return {
            "is_edited": False,
            "error": str(ex)
        }


def analyze_ai_synthetic(img_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Detect overly smooth / synthetic imagery by checking texture complexity,
    channel correlation, and residual noise. AI-generated road photos often
    look unusually clean, highly correlated, and low-texture.
    """
    try:
        h, w, _ = img_bgr.shape
        if max(h, w) > 512:
            scale = 512.0 / max(h, w)
            img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)))
            h, w, _ = img_bgr.shape

        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        
        # 1. Residual Noise Standard Deviation (Spatial Domain)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        noise_residual = cv2.absdiff(gray, blurred)
        residual_std = float(np.std(noise_residual))

        # 2. High-Frequency Noise Energy Ratio (Frequency Domain via FFT)
        # Real cameras capture physical high-frequency sensor/optical noise.
        # AI generators decay this high-frequency band due to upsampling filters.
        f_coef = np.fft.fft2(noise_residual)
        f_shift = np.fft.fftshift(f_coef)
        magnitude_spectrum = np.abs(f_shift)
        
        ny, nx = magnitude_spectrum.shape
        cy, cx = ny // 2, nx // 2
        y_idx, x_idx = np.ogrid[:ny, :nx]
        r_map = np.hypot(y_idx - cy, x_idx - cx)
        
        max_r = np.max(r_map)
        high_freq_mask = r_map > (max_r * 0.70)
        high_freq_energy = float(np.mean(magnitude_spectrum[high_freq_mask])) if np.any(high_freq_mask) else 0.0
        total_energy = float(np.mean(magnitude_spectrum)) + 1e-8
        hf_ratio = high_freq_energy / total_energy

        # 3. Local Chromatic Correlation (Color Domain)
        # AI generators produce highly co-linear R-G-B channels.
        # We divide the image into 4x4 blocks and compute RGB correlation locally.
        b, g, r = cv2.split(img_bgr.astype(np.float32))
        local_corrs = []
        bh, bw = h // 4, w // 4
        for i in range(4):
            for j in range(4):
                block_b = b[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw].flatten()
                block_g = g[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw].flatten()
                block_r = r[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw].flatten()
                if block_b.size > 10:
                    corr_bg = np.corrcoef(block_b, block_g)[0, 1]
                    corr_gr = np.corrcoef(block_g, block_r)[0, 1]
                    if not np.isnan(corr_bg) and not np.isnan(corr_gr):
                        local_corrs.append((corr_bg + corr_gr) / 2.0)
        
        avg_local_corr = float(np.mean(local_corrs)) if local_corrs else 1.0
        
        # 4. Color Channel Covariance Eigenvalue Ratio (Color Dimension)
        pixels = img_bgr.reshape(-1, 3).astype(np.float64)
        cov = np.cov(pixels, rowvar=False)
        eigenvalues, _ = np.linalg.eigh(cov)
        # Smallest eigenvalue over largest eigenvalue. Near 0 = highly linear (synthetic).
        eigen_ratio = float(eigenvalues[0] / (eigenvalues[2] + 1e-8))

        # 5. Spatial Texture Metrics
        grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        grad_mag = np.hypot(grad_x, grad_y)
        edge_density = float(np.mean(grad_mag > 12.0))
        texture_mean = float(np.mean(grad_mag))

        hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
        hist = hist / (hist.sum() + 1e-8)
        hist = hist[hist > 0]
        entropy = float(-np.sum(hist * np.log2(hist + 1e-8)))

        # Compile AI Likelihood Score
        score_components = []
        
        # Frequency Noise decay (0.25 weight)
        if hf_ratio < 0.08:
            score_components.append(0.25)
        elif hf_ratio < 0.12:
            score_components.append(0.12)
        else:
            score_components.append(0.0)
            
        # Local Chromatic Correlation (0.25 weight)
        if avg_local_corr > 0.98:
            score_components.append(0.25)
        elif avg_local_corr > 0.95:
            score_components.append(0.15)
        else:
            score_components.append(0.0)

        # Spatial Noise Standard Deviation (0.20 weight)
        if residual_std < 2.0:
            score_components.append(0.20)
        elif residual_std < 3.0:
            score_components.append(0.10)
        else:
            score_components.append(0.0)

        # Color Eigenvalue Ratio (0.15 weight)
        if eigen_ratio < 0.012:
            score_components.append(0.15)
        elif eigen_ratio < 0.025:
            score_components.append(0.08)
        else:
            score_components.append(0.0)

        # Texture Smoothness & Entropy (0.15 weight)
        if texture_mean < 25.0 and entropy < 6.8:
            score_components.append(0.15)
        elif texture_mean < 35.0:
            score_components.append(0.07)
        else:
            score_components.append(0.0)

        synthetic_score = float(sum(score_components))
        is_synthetic = synthetic_score >= 0.70
        synthetic_confidence = round(min(0.99, max(0.20, synthetic_score)), 2)

        return {
            "is_synthetic": is_synthetic,
            "synthetic_confidence": synthetic_confidence,
            "residual_noise_std": round(residual_std, 2),
            "high_freq_noise_ratio": round(hf_ratio, 4),
            "local_rgb_correlation": round(avg_local_corr, 4),
            "color_eigen_ratio": round(eigen_ratio, 5),
            "edge_density": round(edge_density, 3),
            "entropy": round(entropy, 3),
            "texture_mean": round(texture_mean, 3)
        }
    except Exception as ex:
        return {
            "is_synthetic": False,
            "synthetic_confidence": 0.0,
            "error": str(ex)
        }


def analyze_photo_authenticity(
    img_bytes: bytes,
    filename: str = "hazard_photo.jpg",
    has_manual_gps: bool = False
) -> Dict[str, Any]:
    """
    Master Authenticity Check Engine running all 7 verification sub-systems:
    EXIF, GPS, Timestamp, pHash, Screen Detection, ELA, AI Detector.
    Returns composite 0-100 Authenticity Score and detailed breakdown.
    """
    start_time = time.time()

    # Load PIL and OpenCV representations
    try:
        pil_img = Image.open(io.BytesIO(img_bytes))
    except Exception as e:
        raise ValueError(f"Invalid image format: {e}")

    np_arr = np.frombuffer(img_bytes, np.uint8)
    img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError("Failed to decode image buffer.")

    # 1. EXIF, GPS & Timestamp Check
    exif_res = analyze_exif_gps_timestamp(pil_img)

    # 2. pHash Duplicate Check
    phash_val = calculate_dhash(pil_img)
    phash_res = analyze_phash_duplicate(phash_val, filename=filename)

    # 3. Screen Re-photography Moiré Check
    screen_res = analyze_screen_moire(img_bgr)

    # 4. Error Level Analysis (ELA) Editing Check
    ela_res = analyze_ela_editing(pil_img)

    # 5. AI / Synthetic Image Detector
    ai_res = analyze_ai_synthetic(img_bgr)

    # ================= COMPOSITE SCORE CALCULATOR (0-100) =================
    score = 100.0
    threat_reasons = []
    trust_reasons = []

    # Check 1: EXIF Metadata (+10 pts or -10 pts)
    if exif_res["exif_valid"]:
        trust_reasons.append(f"Valid Camera Metadata ({exif_res['camera_make'] or 'Device'} {exif_res['camera_model'] or ''})")
    else:
        score -= 10.0
        threat_reasons.append("Missing Camera EXIF Metadata")

    # Check 2: GPS Geotag (+10 pts or -10 pts)
    if exif_res["gps_valid"]:
        trust_reasons.append(f"Verified Camera Geotag ({exif_res['gps_latitude']}, {exif_res['gps_longitude']})")
    elif has_manual_gps:
        trust_reasons.append("User Provided Device GPS Location")
    else:
        score -= 10.0
        threat_reasons.append("No Embedded GPS Geotag")

    # Check 3: Timestamp (+5 pts or -5 pts)
    if exif_res["timestamp_valid"]:
        trust_reasons.append(f"Temporal Timestamp Verified ({exif_res['timestamp_str']})")
    else:
        score -= 5.0
        threat_reasons.append("Missing Capture Timestamp")

    # Check 4: pHash Duplicate (-30 pts penalty if duplicate)
    if phash_res["is_duplicate"]:
        score -= 30.0
        threat_reasons.append(f"Duplicate Image Detected (Matches {phash_res['matched_filename']})")
    else:
        trust_reasons.append("Unique Image Hash (No Duplicate Found)")

    # Check 5: Screen Re-photography (-35 pts penalty if screen detected)
    if screen_res.get("is_screen_photo"):
        score -= 35.0
        threat_reasons.append(f"Screen / Monitor Photo Detected (Moiré FFT Peak Ratio: {screen_res['fft_peak_ratio']})")
    else:
        trust_reasons.append("Physical Scene Verified (No Screen Moiré Grid)")

    # Check 6: ELA Editing Check (-25 pts penalty if edited)
    if ela_res.get("is_edited"):
        score -= 25.0
        threat_reasons.append(f"Digital Editing / Compression Splicing Detected (Error Std: {ela_res['std_error']})")
    else:
        trust_reasons.append("Coherent JPEG Error Level (No Splicing Signs)")

    # Check 7: AI Synthetic Check (-30 pts penalty if AI generated)
    if ai_res.get("is_synthetic"):
        score -= 30.0
        threat_reasons.append(f"Synthetic / AI Image Characteristics Detected (Noise Std: {ai_res['residual_noise_std']})")
    else:
        trust_reasons.append("Natural Noise Spectrum (Authentic Physical Sensor)")

    # Bound score between 0.0 and 100.0
    final_score = max(0.0, min(100.0, round(score, 1)))

    # Status classification
    if final_score >= 85.0:
        status_label = "Verified Authentic"
        status_color = "green"
        status_badge = "🟢"
    elif final_score >= 65.0:
        status_label = "Moderate Authenticity"
        status_color = "yellow"
        status_badge = "🟡"
    elif final_score >= 40.0:
        status_label = "Suspect Image"
        status_color = "orange"
        status_badge = "🟠"
    else:
        status_label = "Fraudulent / Tampered"
        status_color = "red"
        status_badge = "🔴"

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "authenticity_score": final_score,
        "status": status_label,
        "status_color": status_color,
        "status_badge": status_badge,
        "processing_time_ms": elapsed_ms,
        "checks_summary": {
            "exif": exif_res,
            "phash": phash_res,
            "screen_detection": screen_res,
            "ela_editing": ela_res,
            "ai_synthetic": ai_res
        },
        "threat_reasons": threat_reasons,
        "trust_reasons": trust_reasons
    }
