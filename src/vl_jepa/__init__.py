"""
VL-JEPA Lecture Summarizer

An event-aware lecture summarizer using V-JEPA visual encoder
for real-time, context-aware summaries and retrieval.
"""

__version__ = "0.3.0"

from vl_jepa.decoder import YDecoder
from vl_jepa.detector import EventDetector
from vl_jepa.frame import FrameSampler
from vl_jepa.index import EmbeddingIndex
from vl_jepa.multimodal_index import (
    Modality,
    MultimodalIndex,
    MultimodalSearchResult,
    RankingConfig,
)
from vl_jepa.storage import Storage
from vl_jepa.text import TextEncoder
from vl_jepa.video import Frame, VideoDecodeError, VideoInput, VideoMetadata

__all__ = [
    "VideoInput",
    "VideoDecodeError",
    "VideoMetadata",
    "Frame",
    "FrameSampler",
    "EventDetector",
    "Storage",
    "TextEncoder",
    "YDecoder",
    "EmbeddingIndex",
    "MultimodalIndex",
    "MultimodalSearchResult",
    "Modality",
    "RankingConfig",
]
