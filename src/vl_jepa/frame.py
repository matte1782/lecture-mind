"""
SPEC: S003 - Frame Sampling and Normalization

Processes raw video frames into model-ready tensors.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

import cv2
import numpy as np


class ResizeMode(str, Enum):
    """Frame resize mode."""

    CENTER_CROP = "center_crop"
    RESIZE = "resize"
    PAD = "pad"


class FrameSampler:
    """Processes frames for V-JEPA encoder input.

    IMPLEMENTS: S003
    INVARIANTS: INV003, INV004

    Transforms raw video frames to normalized 224x224 tensors.

    Example:
        sampler = FrameSampler(mode="center_crop")
        processed = sampler.process(frame)
        # processed.shape == (224, 224, 3)
        # processed values in [-1.0, 1.0]
    """

    TARGET_SIZE: int = 224

    def __init__(
        self,
        mode: Literal["center_crop", "resize", "pad"] = "center_crop",
    ) -> None:
        """Initialize frame sampler.

        Args:
            mode: Resize mode
                - center_crop: Crop center square, then resize
                - resize: Direct resize (may distort aspect ratio)
                - pad: Pad to square, then resize
        """
        self._mode = ResizeMode(mode)

    def process(self, frame: np.ndarray) -> np.ndarray:
        """Process a single frame.

        INVARIANT: INV003 - Output shape is (224, 224, 3)
        INVARIANT: INV004 - Output values in [-1.0, 1.0]

        Args:
            frame: Input frame, shape (H, W, 3), uint8 [0, 255]

        Returns:
            Processed frame, shape (224, 224, 3), float32 [-1.0, 1.0]
        """
        # Apply resize mode
        if self._mode == ResizeMode.CENTER_CROP:
            frame = self._center_crop(frame)
        elif self._mode == ResizeMode.PAD:
            frame = self._pad_to_square(frame)

        # Resize to target
        resized = cv2.resize(
            frame,
            (self.TARGET_SIZE, self.TARGET_SIZE),
            interpolation=cv2.INTER_LINEAR,
        )

        # Normalize to [-1, 1]
        normalized = self._normalize(resized)

        return normalized

    def process_batch(self, frames: list[np.ndarray]) -> np.ndarray:
        """Process a batch of frames.

        Args:
            frames: List of input frames

        Returns:
            Batch tensor, shape (B, 3, 224, 224), float32
        """
        processed = [self.process(f) for f in frames]

        # Stack and transpose to (B, C, H, W)
        batch = np.stack(processed, axis=0)
        batch = np.transpose(batch, (0, 3, 1, 2))

        return batch

    def _center_crop(self, frame: np.ndarray) -> np.ndarray:
        """Crop center square from frame.

        EDGE_CASE: EC011 - Non-square frames
        """
        h, w = frame.shape[:2]
        size = min(h, w)

        y_start = (h - size) // 2
        x_start = (w - size) // 2

        return frame[y_start : y_start + size, x_start : x_start + size]

    def _pad_to_square(self, frame: np.ndarray) -> np.ndarray:
        """Pad frame to square with black borders."""
        h, w = frame.shape[:2]
        size = max(h, w)

        padded = np.zeros((size, size, 3), dtype=frame.dtype)

        y_start = (size - h) // 2
        x_start = (size - w) // 2

        padded[y_start : y_start + h, x_start : x_start + w] = frame

        return padded

    def _normalize(self, frame: np.ndarray) -> np.ndarray:
        """Normalize pixel values to [-1, 1].

        INVARIANT: INV004
        """
        # Convert to float32 and normalize
        normalized = frame.astype(np.float32) / 127.5 - 1.0

        # Clamp to ensure bounds (safety)
        result: np.ndarray = np.clip(normalized, -1.0, 1.0)
        return result
