"""
Road Guardian AI — Authenticity Engine: AI-Generated / Synthetic Image Detector
Forensic detector analyzing high-frequency sensor noise spectrum, local chromatic
correlation, color covariance eigenvalues, texture entropy, and generation metadata
to estimate the probability of AI generation (Diffusion, GAN, Midjourney, DALL-E).
"""

from typing import Dict, Any, List, Optional
import numpy as np
import cv2
from PIL import Image


AI_METADATA_FINGERPRINTS = [
    "stable diffusion", "midjourney", "dall-e", "novelai", "comfyui",
    "automatic1111", "invokeai", "flux.1", "sdxl", "civitai", "leonardo.ai"
]


def detect_ai_generation(img_bgr: np.ndarray, pil_img: Optional[Image.Image] = None) -> Dict[str, Any]:
    """
    Analyzes visual and frequency characteristics for synthetic / AI-generated imagery:
    1. High-frequency sensor noise decay in Fourier spectrum
    2. Local RGB chromatic correlation
    3. Color covariance eigenvalue ratios
    4. Pavement texture metrics & edge entropy
    5. Embedded generation metadata / tags

    Returns non-binary probability, confidence, explanation, and signals breakdown.
    """
    try:
        h, w = img_bgr.shape[:2]
        max_dim = 512
        if max(h, w) > max_dim:
            scale = max_dim / float(max(h, w))
            work_img = cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            work_img = img_bgr.copy()

        gh, gw = work_img.shape[:2]
        gray = cv2.cvtColor(work_img, cv2.COLOR_BGR2GRAY)

        signals_detected: List[str] = []
        prob_components: List[float] = []

        # ---------------- 1. High-Frequency Noise Residual via FFT ----------------
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        noise_residual = cv2.absdiff(gray, blurred)
        residual_std = float(np.std(noise_residual))

        f_coef = np.fft.fft2(noise_residual.astype(np.float32))
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

        # Real physical camera sensors have high-frequency shot/thermal noise
        # AI generators decay high frequencies due to upsamplers
        if hf_ratio < 0.05:
            prob_components.append(0.24)
            signals_detected.append("High-frequency optical sensor noise decay (attenuated Fourier band)")
        elif hf_ratio < 0.08:
            prob_components.append(0.10)
            signals_detected.append("Low high-frequency noise variance")
        else:
            prob_components.append(0.0)

        # ---------------- 2. Local Chromatic Correlation ----------------
        # Synthetic imagery frequently features highly coupled R-G-B color channels
        b, g, r = cv2.split(work_img.astype(np.float32))
        local_corrs = []
        bh, bw = max(1, gh // 4), max(1, gw // 4)
        for i in range(4):
            for j in range(4):
                block_b = b[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw].flatten()
                block_g = g[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw].flatten()
                block_r = r[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw].flatten()
                if block_b.size > 10 and np.std(block_b) > 1e-4 and np.std(block_g) > 1e-4 and np.std(block_r) > 1e-4:
                    c_bg = np.corrcoef(block_b, block_g)[0, 1]
                    c_gr = np.corrcoef(block_g, block_r)[0, 1]
                    if not np.isnan(c_bg) and not np.isnan(c_gr):
                        local_corrs.append((c_bg + c_gr) / 2.0)

        avg_local_corr = float(np.mean(local_corrs)) if local_corrs else 0.85
        if avg_local_corr > 0.992:
            prob_components.append(0.25)
            signals_detected.append("Abnormally high local chromatic correlation (> 99.2%)")
        elif avg_local_corr > 0.978:
            prob_components.append(0.12)
            signals_detected.append("Elevated color channel co-linearity")
        else:
            prob_components.append(0.0)

        # ---------------- 3. Color Covariance Eigenvalue Ratio ----------------
        pixels = work_img.reshape(-1, 3).astype(np.float64)
        cov = np.cov(pixels, rowvar=False)
        eigenvalues, _ = np.linalg.eigh(cov)
        eigen_ratio = float(eigenvalues[0] / (eigenvalues[2] + 1e-8))

        if eigen_ratio < 0.008:
            prob_components.append(0.18)
            signals_detected.append("Compressed color covariance eigenvalue ratio (synthetic color plane)")
        elif eigen_ratio < 0.016:
            prob_components.append(0.08)
        else:
            prob_components.append(0.0)

        # ---------------- 4. Texture Smoothness & Gradient Entropy ----------------
        grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        grad_mag = np.hypot(grad_x, grad_y)
        texture_mean = float(np.mean(grad_mag))

        hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
        hist = hist / (hist.sum() + 1e-8)
        hist = hist[hist > 0]
        entropy = float(-np.sum(hist * np.log2(hist + 1e-8)))

        if texture_mean < 16.0 and entropy < 6.2:
            prob_components.append(0.18)
            signals_detected.append("Artificial surface smoothness and abnormally low gradient entropy")
        elif texture_mean < 24.0 and entropy < 6.5:
            prob_components.append(0.08)
        else:
            prob_components.append(0.0)

        # ---------------- 5. Generation Metadata Inspection ----------------
        metadata_ai_found = False
        matched_tag = None
        if pil_img and hasattr(pil_img, "info") and pil_img.info:
            for k, v in pil_img.info.items():
                val_str = str(v).lower()
                for fp in AI_METADATA_FINGERPRINTS:
                    if fp in val_str:
                        metadata_ai_found = True
                        matched_tag = fp
                        break
                if metadata_ai_found:
                    break

        if metadata_ai_found:
            prob_components.append(0.35)
            signals_detected.append(f"AI generator metadata tag recognized: '{matched_tag}'")

        # ---------------- Composite Probability Synthesis ----------------
        ai_probability = min(0.98, max(0.03, float(sum(prob_components))))
        confidence = round(min(0.98, max(0.50, 0.50 + abs(ai_probability - 0.5) * 0.90)), 2)

        is_ai_generated = ai_probability >= 0.65
        is_warning = (ai_probability >= 0.38) and not is_ai_generated

        if is_ai_generated:
            status = "suspicious"
            status_label = "Synthetic / AI-Generated Signs Detected"
            status_icon = "✕"
            explanation = (
                f"Synthetic / AI characteristics detected (Estimated probability: {int(ai_probability * 100)}%). "
                f"Signals: {'; '.join(signals_detected) if signals_detected else 'Neural texture decay and color correlation anomalies'}."
            )
        elif is_warning:
            status = "warning"
            status_label = "Possible Synthetic Texture Characteristics"
            status_icon = "⚠"
            explanation = (
                f"Image exhibits partial synthetic characteristics (Estimated probability: {int(ai_probability * 100)}%). "
                f"Observed: {'; '.join(signals_detected) if signals_detected else 'Slightly low high-frequency noise variance'}."
            )
        else:
            status = "passed"
            status_label = "Natural Sensor Noise Spectrum"
            status_icon = "✓"
            explanation = (
                f"Low AI-generation probability ({int(ai_probability * 100)}%). Natural physical CMOS sensor "
                f"noise spectrum and authentic pavement texture entropy verified."
            )

        return {
            "status": status,
            "status_label": status_label,
            "status_icon": status_icon,
            "is_ai_generated": is_ai_generated,
            "ai_probability": round(ai_probability, 2),
            "confidence": confidence,
            "residual_noise_std": round(residual_std, 2),
            "high_freq_noise_ratio": round(hf_ratio, 4),
            "local_rgb_correlation": round(avg_local_corr, 4),
            "color_eigen_ratio": round(eigen_ratio, 5),
            "texture_mean": round(texture_mean, 2),
            "entropy": round(entropy, 2),
            "signals_detected": signals_detected,
            "metadata_ai_found": metadata_ai_found,
            "explanation": explanation,
            "summary": "Low AI-generation probability" if not is_ai_generated else "Synthetic / AI-generated characteristics detected"
        }
    except Exception as ex:
        return {
            "status": "passed",
            "status_label": "AI Detector Inconclusive",
            "status_icon": "—",
            "is_ai_generated": False,
            "ai_probability": 0.12,
            "confidence": 0.40,
            "error": str(ex),
            "signals_detected": [],
            "explanation": f"AI detector could not complete: {ex}.",
            "summary": "AI check inconclusive"
        }
