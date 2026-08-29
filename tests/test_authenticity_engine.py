import sys
import os
import io
import unittest
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import numpy as np
from PIL import Image

from authenticity_engine import analyze_photo_authenticity


class TestAuthenticityEngine(unittest.TestCase):
    def test_rejects_smooth_ai_like_photo(self):
        arr = np.zeros((512, 512, 3), dtype=np.uint8)
        for x in range(512):
            v = 100 + int(85 * np.sin(x / 18))
            arr[:, x, 0] = v
            arr[:, x, 1] = v + 8
            arr[:, x, 2] = v + 16

        img = Image.fromarray(arr, mode="RGB")
        bio = io.BytesIO()
        img.save(bio, format="PNG")

        result = analyze_photo_authenticity(bio.getvalue(), filename="synthetic_road.png")

        self.assertTrue(
            result["checks_summary"]["ai_synthetic"]["is_synthetic"],
            result,
        )
        self.assertLess(result["authenticity_score"], 70, result)


if __name__ == "__main__":
    unittest.main()
