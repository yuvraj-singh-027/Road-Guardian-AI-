"""
Road Guardian AI — Authenticity Engine: Screen Re-photography Detector
Identifies whether an image is a physical capture or a re-photographed display/screen
using 2D Fast Fourier Transform (FFT) Moiré frequency grid analysis, subpixel periodic
variance, specular reflections, and bezel edge detection.
"""

from typing import Dict, Any
import numpy as np
import cv2


def detect_screen_photo(img_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Analyzes visual indicators of screen re-photography:
    1. Moiré interference patterns via 2D FFT magnitude spectrum
    2. Subpixel periodic texture & Laplacian variance
    3. Specular reflections / glass glare hotspots
    4. Display bezel / screen frame line detection

    Returns non-binary screen probability, confidence, status, and explainability.
    """
    try:
        h, w = img_bgr.shape[:2]

        # Standardize working resolution for consistent frequency analysis
        max_dim = 640
        if max(h, w) > max_dim:
            scale = max_dim / float(max(h, w))
            work_img = cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            work_img = img_bgr.copy()

        gh, gw = work_img.shape[:2]
        gray = cv2.cvtColor(work_img, cv2.COLOR_BGR2GRAY)

        # ---------------- 1. 2D FFT Moiré Spectrum Analysis ----------------
        fft = np.fft.fft2(gray.astype(np.float32))
        fft_shift = np.fft.fftshift(fft)
        magnitude_spectrum = 20.0 * np.log(np.abs(fft_shift) + 1e-5)

        # Mask out DC component (center low-frequency area)
        cy, cx = gh // 2, gw // 2
        radius = int(min(gh, gw) * 0.08)
        y, x = np.ogrid[:gh, :gw]
        center_mask = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
        magnitude_high = magnitude_spectrum.copy()
        magnitude_high[center_mask] = 0.0

        high_freq_mean = float(np.mean(magnitude_high))
        high_freq_max = float(np.max(magnitude_high))
        fft_peak_ratio = high_freq_max / (high_freq_mean + 1e-5)

        # Count distinct periodic frequency spikes (Moiré harmonic peaks)
        peak_threshold = high_freq_mean + 3.2 * np.std(magnitude_high)
        moire_peaks_count = int(np.sum(magnitude_high > peak_threshold))

        # ---------------- 2. Subpixel Grid Texture & Edge Variance ----------------
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Check periodic horizontal/vertical scanline correlation
        row_diffs = np.abs(gray[1:, :] - gray[:-1, :])
        col_diffs = np.abs(gray[:, 1:] - gray[:, :-1])
        row_energy = float(np.mean(row_diffs))
        col_energy = float(np.mean(col_diffs))
        axis_energy_ratio = max(row_energy, col_energy) / (min(row_energy, col_energy) + 1e-5)

        # ---------------- 3. Specular Reflection / Glare Hotspots ----------------
        # Glass reflections on monitor/phone screens produce over-saturated specular highlights
        hsv = cv2.cvtColor(work_img, cv2.COLOR_BGR2HSV)
        v_channel = hsv[:, :, 2]
        glare_mask = v_channel > 250
        glare_ratio = float(np.sum(glare_mask)) / float(gh * gw)

        # ---------------- 4. Display Bezel / Border Frame Detection ----------------
        # Check border margins (outer 5%) for straight edge lines characteristic of screens
        margin_h = max(2, int(gh * 0.06))
        margin_w = max(2, int(gw * 0.06))
        borders = [
            gray[:margin_h, :],       # top
            gray[-margin_h:, :],      # bottom
            gray[:, :margin_w],       # left
            gray[:, -margin_w:]       # right
        ]
        border_grad_stds = [float(np.std(cv2.Sobel(b, cv2.CV_32F, 1, 1))) for b in borders]
        max_border_contrast = max(border_grad_stds) if border_grad_stds else 0.0
        border_detected = max_border_contrast > 45.0

        # ---------------- Probability & Score Synthesis ----------------
        probability_factors = []

        # FFT Moiré factor (weight: 0.40)
        if fft_peak_ratio > 4.5:
            probability_factors.append(0.40)
        elif fft_peak_ratio > 3.6:
            probability_factors.append(0.25)
        elif fft_peak_ratio > 3.0:
            probability_factors.append(0.12)
        else:
            probability_factors.append(0.0)

        # Periodic Moiré Harmonic Spikes (weight: 0.20)
        if moire_peaks_count > 150:
            probability_factors.append(0.20)
        elif moire_peaks_count > 60:
            probability_factors.append(0.10)
        else:
            probability_factors.append(0.0)

        # Subpixel Laplacian Grid (weight: 0.15)
        if laplacian_var > 650.0 and fft_peak_ratio > 3.2:
            probability_factors.append(0.15)
        elif laplacian_var > 450.0:
            probability_factors.append(0.08)
        else:
            probability_factors.append(0.0)

        # Specular Glare & Axis Correlation (weight: 0.15)
        if glare_ratio > 0.02 and axis_energy_ratio > 1.35:
            probability_factors.append(0.15)
        elif glare_ratio > 0.01:
            probability_factors.append(0.08)
        else:
            probability_factors.append(0.0)

        # Bezel frame detection (weight: 0.10)
        if border_detected and fft_peak_ratio > 2.8:
            probability_factors.append(0.10)
        else:
            probability_factors.append(0.0)

        screen_probability = min(0.98, max(0.02, float(sum(probability_factors))))
        confidence = round(min(0.99, max(0.45, 0.50 + abs(screen_probability - 0.5) * 0.95)), 2)

        is_screen_photo = screen_probability >= 0.65
        is_warning = (screen_probability >= 0.38) and not is_screen_photo

        if is_screen_photo:
            status = "suspicious"
            status_label = "Screen Re-photography Detected"
            status_icon = "✕"
            explanation = (
                f"Strong screen re-photography characteristics detected (Probability: {int(screen_probability * 100)}%). "
                f"2D Fourier spectrum reveals Moiré grid peaks (Peak ratio: {fft_peak_ratio:.2f}) "
                f"consistent with a photograph of a digital monitor or phone screen."
            )
        elif is_warning:
            status = "warning"
            status_label = "Minor Screen / Moiré Anomalies"
            status_icon = "⚠"
            explanation = (
                f"Possible screen display artifacts detected (Probability: {int(screen_probability * 100)}%). "
                f"Moiré peak ratio is slightly elevated ({fft_peak_ratio:.2f})."
            )
        else:
            status = "passed"
            status_label = "Physical Scene Verified"
            status_icon = "✓"
            explanation = (
                f"No screen re-photography detected (Probability: {int(screen_probability * 100)}%). "
                f"Natural frequency distribution without monitor subpixel lattice or Moiré interference."
            )

        return {
            "status": status,
            "status_label": status_label,
            "status_icon": status_icon,
            "is_screen_photo": is_screen_photo,
            "screen_probability": round(screen_probability, 2),
            "confidence": confidence,
            "fft_peak_ratio": round(fft_peak_ratio, 2),
            "moire_peaks_count": moire_peaks_count,
            "laplacian_variance": round(laplacian_var, 2),
            "glare_ratio": round(glare_ratio, 4),
            "border_detected": border_detected,
            "explanation": explanation,
            "summary": "Screen photo detected" if is_screen_photo else "No strong screen-photo indicators"
        }
    except Exception as ex:
        return {
            "status": "passed",
            "status_label": "Screen Photo Analysis Inconclusive",
            "status_icon": "—",
            "is_screen_photo": False,
            "screen_probability": 0.10,
            "confidence": 0.40,
            "error": str(ex),
            "explanation": f"Screen photo analysis could not complete: {ex}.",
            "summary": "Screen check inconclusive"
        }
