# VL-JEPA API Design Specification v1.0

**Date:** 2024-12-30
**Author:** META_ARCHITECT
**Status:** PROPOSED

---

## 1. Overview

This document specifies the public API for the VL-JEPA Lecture Summarizer. The API is designed for Python-first usage with optional Gradio web interface.

---

## 2. Core Classes

### 2.1 LectureSummarizer (Main Entry Point)

```python
class LectureSummarizer:
    """
    Main interface for processing and querying lecture videos.

    Example:
        summarizer = LectureSummarizer.from_config("config.json")
        summarizer.process_video("lecture.mp4")
        results = summarizer.query("What is gradient descent?")
    """

    @classmethod
    def from_config(
        cls,
        config_path: str | Path,
        device: str = "auto",
    ) -> "LectureSummarizer":
        """
        Create summarizer from configuration file.

        Args:
            config_path: Path to JSON configuration file.
            device: "auto", "cuda", "cpu", or specific device like "cuda:0".

        Returns:
            Configured LectureSummarizer instance.

        Raises:
            FileNotFoundError: If config file doesn't exist.
            ValueError: If configuration is invalid.
        """
        ...

    @classmethod
    def from_pretrained(
        cls,
        model_dir: str | Path,
        device: str = "auto",
    ) -> "LectureSummarizer":
        """
        Create summarizer from pretrained model directory.

        Args:
            model_dir: Directory containing model files.
            device: Device specification.

        Returns:
            Configured LectureSummarizer instance.
        """
        ...

    def process_video(
        self,
        source: str | Path,
        *,
        fps: float = 1.0,
        start_time: float | None = None,
        end_time: float | None = None,
        callback: Callable[[ProcessingProgress], None] | None = None,
    ) -> ProcessingResult:
        """
        Process a video file and build searchable index.

        Args:
            source: Path to video file.
            fps: Frames per second to sample (default: 1.0).
            start_time: Start time in seconds (None = beginning).
            end_time: End time in seconds (None = end).
            callback: Progress callback function.

        Returns:
            ProcessingResult with statistics and event count.

        Raises:
            FileNotFoundError: If video file doesn't exist.
            VideoDecodeError: If video cannot be decoded.
            OutOfMemoryError: If processing runs out of memory.
        """
        ...

    def process_stream(
        self,
        source: int | str,
        *,
        fps: float = 1.0,
        duration: float | None = None,
    ) -> Iterator[StreamEvent]:
        """
        Process live video stream.

        Args:
            source: Camera device ID or stream URL.
            fps: Frames per second to sample.
            duration: Maximum duration in seconds (None = indefinite).

        Yields:
            StreamEvent for each detected event.
        """
        ...

    def query(
        self,
        text: str,
        *,
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> QueryResult:
        """
        Search processed video for relevant segments.

        Args:
            text: Natural language query.
            top_k: Maximum number of results.
            threshold: Minimum similarity score (0.0-1.0).

        Returns:
            QueryResult with matched segments and timestamps.

        Raises:
            ValueError: If no video has been processed.
            ValueError: If query is empty or too long.
        """
        ...

    def get_events(
        self,
        *,
        min_confidence: float = 0.0,
    ) -> list[Event]:
        """
        Get all detected events from processed video.

        Args:
            min_confidence: Minimum confidence threshold.

        Returns:
            List of Event objects sorted by timestamp.
        """
        ...

    def get_summary(
        self,
        event_id: int,
    ) -> str:
        """
        Get or generate summary for a specific event.

        Args:
            event_id: Event identifier.

        Returns:
            Summary text.

        Raises:
            KeyError: If event_id not found.
        """
        ...

    def save(
        self,
        path: str | Path,
    ) -> None:
        """
        Save processed lecture data to disk.

        Args:
            path: Directory to save data.
        """
        ...

    def load(
        self,
        path: str | Path,
    ) -> None:
        """
        Load previously processed lecture data.

        Args:
            path: Directory containing saved data.

        Raises:
            FileNotFoundError: If path doesn't exist.
            CorruptedDataError: If data is corrupted.
        """
        ...
```

---

### 2.2 Data Classes

```python
@dataclass
class Config:
    """Configuration for LectureSummarizer."""

    # Model settings
    encoder_model: str = "vjepa-vit-l-16"
    text_encoder_model: str = "all-MiniLM-L6-v2"
    decoder_model: str = "google/gemma-2b-it"

    # Processing settings
    default_fps: float = 1.0
    batch_size: int = 8

    # Event detection
    event_threshold: float = 0.3
    min_event_gap: float = 10.0  # seconds
    smoothing_window: int = 3

    # Search settings
    index_type: Literal["flat", "ivf"] = "ivf"
    nlist: int = 100
    nprobe: int = 10

    # Resource limits
    max_memory_gb: float = 8.0
    device: str = "auto"

    @classmethod
    def from_json(cls, path: str | Path) -> "Config":
        """Load configuration from JSON file."""
        ...

    def to_json(self, path: str | Path) -> None:
        """Save configuration to JSON file."""
        ...


@dataclass
class ProcessingResult:
    """Result of video processing."""

    total_frames: int
    processed_frames: int
    skipped_frames: int
    events_detected: int
    processing_time_s: float
    embeddings_stored: int


@dataclass
class ProcessingProgress:
    """Progress update during processing."""

    current_frame: int
    total_frames: int
    current_time_s: float
    total_time_s: float
    events_so_far: int
    fps_actual: float


@dataclass
class Event:
    """Detected event in video."""

    id: int
    timestamp_s: float
    confidence: float
    event_type: str  # "boundary", "topic_change", etc.
    summary: str | None = None


@dataclass
class StreamEvent:
    """Event from live stream processing."""

    event: Event
    frame: np.ndarray | None  # Optional frame snapshot
    embedding: np.ndarray


@dataclass
class QueryResult:
    """Result of similarity search query."""

    matches: list[Match]
    query_time_ms: float
    total_indexed: int


@dataclass
class Match:
    """Single match from query."""

    frame_id: int
    timestamp_s: float
    score: float
    event: Event | None  # Associated event if any
    summary: str | None
```

---

### 2.3 Component APIs

#### 2.3.1 Visual Encoder

```python
class VisualEncoderProtocol(Protocol):
    """Protocol for visual encoders (from vl_jepa.encoders.base)."""

    @property
    def embed_dim(self) -> int:
        """Embedding dimension (768 for ViT-L)."""
        ...

    def encode(
        self,
        frames: torch.Tensor,  # (B, 3, 224, 224)
    ) -> torch.Tensor:  # (B, embed_dim)
        """
        Encode batch of frames to embeddings.

        Args:
            frames: Batch of normalized frames.

        Returns:
            L2-normalized embeddings.
        """
        ...


class DINOv2Encoder:
    """DINOv2 visual encoder implementation (from vl_jepa.encoders.dino)."""

    def __init__(
        self,
        checkpoint_path: str | Path,
        device: str = "cuda",
    ) -> None:
        """
        Initialize encoder from checkpoint.

        Args:
            checkpoint_path: Path to safetensors checkpoint.
            device: Target device.
        """
        ...

    @property
    def embed_dim(self) -> int:
        return 768

    def encode(
        self,
        frames: torch.Tensor,
    ) -> torch.Tensor:
        ...
```

#### 2.3.2 Text Encoder

```python
class TextEncoder(Protocol):
    """Protocol for text encoders."""

    @property
    def embed_dim(self) -> int:
        """Embedding dimension."""
        ...

    def encode(
        self,
        texts: list[str],
    ) -> torch.Tensor:  # (B, embed_dim)
        """Encode batch of texts to embeddings."""
        ...


class MiniLMEncoder:
    """MiniLM text encoder with projection."""

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        projection_dim: int = 768,
        device: str = "cuda",
    ) -> None:
        ...

    @property
    def embed_dim(self) -> int:
        return 768  # After projection

    def encode(
        self,
        texts: list[str],
    ) -> torch.Tensor:
        ...
```

#### 2.3.3 Event Detector

```python
class EventDetector:
    """Detects semantic boundaries in embedding sequences."""

    def __init__(
        self,
        threshold: float = 0.3,
        min_gap_s: float = 10.0,
        smoothing_window: int = 3,
    ) -> None:
        ...

    def update(
        self,
        embedding: np.ndarray,  # (768,)
        timestamp_s: float,
    ) -> Event | None:
        """
        Process new embedding and return event if detected.

        Args:
            embedding: New frame embedding.
            timestamp_s: Timestamp in seconds.

        Returns:
            Event if boundary detected, None otherwise.
        """
        ...

    def reset(self) -> None:
        """Reset detector state for new video."""
        ...
```

#### 2.3.4 Embedding Index

```python
class EmbeddingIndex(Protocol):
    """Protocol for embedding storage and search."""

    def add(
        self,
        embeddings: np.ndarray,  # (N, dim)
        ids: np.ndarray,  # (N,)
    ) -> None:
        """Add embeddings to index."""
        ...

    def search(
        self,
        query: np.ndarray,  # (dim,) or (Q, dim)
        k: int = 10,
    ) -> tuple[np.ndarray, np.ndarray]:  # (scores, ids)
        """Search for similar embeddings."""
        ...

    def save(self, path: str | Path) -> None:
        """Save index to disk."""
        ...

    def load(self, path: str | Path) -> None:
        """Load index from disk."""
        ...


class FAISSIndex:
    """FAISS-based embedding index."""

    def __init__(
        self,
        dim: int = 768,
        index_type: Literal["flat", "ivf"] = "ivf",
        nlist: int = 100,
        nprobe: int = 10,
    ) -> None:
        ...
```

#### 2.3.5 Summary Generator

```python
class SummaryGenerator(Protocol):
    """Protocol for summary generation."""

    def generate(
        self,
        embedding: np.ndarray,
        context: str | None = None,
        max_tokens: int = 150,
    ) -> str:
        """Generate summary from embedding."""
        ...


class GemmaSummaryGenerator:
    """Gemma-2B based summary generator."""

    def __init__(
        self,
        model_name: str = "google/gemma-2b-it",
        device: str = "cuda",
        quantization: Literal["none", "int8", "int4"] = "int8",
    ) -> None:
        ...
```

---

## 3. CLI Interface

```bash
# Process video file
vl-jepa process lecture.mp4 --output ./data/lecture1

# Process with options
vl-jepa process lecture.mp4 \
    --fps 2.0 \
    --start 60 \
    --end 3600 \
    --device cuda:0

# Interactive query mode
vl-jepa query ./data/lecture1
> What is backpropagation?
[Results displayed]
> When did the professor show the diagram?
[Results displayed]
> exit

# Single query
vl-jepa query ./data/lecture1 --text "gradient descent" --top-k 10

# Export summaries
vl-jepa export ./data/lecture1 --format markdown > summary.md

# Launch web UI
vl-jepa serve ./data/lecture1 --port 7860
```

---

## 4. Gradio Web Interface

```python
def create_gradio_app(summarizer: LectureSummarizer) -> gr.Blocks:
    """
    Create Gradio web interface.

    Components:
    - Video upload
    - Processing progress
    - Query input
    - Results display with video timestamps
    - Event timeline
    - Summary export
    """
    ...
```

### 4.1 Interface Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VL-JEPA Lecture Summarizer                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │                              │  │                                      │ │
│  │      VIDEO UPLOAD            │  │        PROCESSING STATUS             │ │
│  │      [Drop video here]       │  │        ████████████░░░░ 75%          │ │
│  │                              │  │        Events detected: 12           │ │
│  │      or select file...       │  │                                      │ │
│  │                              │  │                                      │ │
│  └──────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  QUERY: [What is the main topic of this lecture?            ] [Search]│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  RESULTS                                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  1. [12:34] Score: 0.89                                         │ │   │
│  │  │     Summary: Professor introduces gradient descent algorithm... │ │   │
│  │  │     [Jump to timestamp]                                         │ │   │
│  │  ├─────────────────────────────────────────────────────────────────┤ │   │
│  │  │  2. [45:12] Score: 0.76                                         │ │   │
│  │  │     Summary: Demonstration of gradient descent on 2D surface... │ │   │
│  │  │     [Jump to timestamp]                                         │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  EVENT TIMELINE                                                       │   │
│  │  ──●────●──────●───●──────────●────●───────●──────────────●──────    │   │
│  │  0:00  5:00   15:00                                            1:30:00 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Error Handling

### 5.1 Exception Hierarchy

```python
class VLJEPAError(Exception):
    """Base exception for all VL-JEPA errors."""
    pass


class ConfigurationError(VLJEPAError):
    """Invalid configuration."""
    pass


class ModelLoadError(VLJEPAError):
    """Failed to load model."""
    pass


class VideoDecodeError(VLJEPAError):
    """Failed to decode video."""
    pass


class OutOfMemoryError(VLJEPAError):
    """Insufficient memory for operation."""
    pass


class IndexOperationError(VLJEPAError):
    """Index operation failed (search, add, or rebuild)."""
    pass


class CorruptedDataError(VLJEPAError):
    """Saved data is corrupted."""
    pass
```

### 5.2 Error Recovery

| Error | Recovery Strategy |
|:------|:------------------|
| ModelLoadError | Provide download URL, check file integrity |
| VideoDecodeError | Try alternative codec, skip corrupted segments |
| OutOfMemoryError | Reduce batch size, enable streaming mode |
| IndexOperationError | Rebuild index from embeddings |
| CorruptedDataError | Restore from backup, reprocess if needed |

---

## 6. Type Annotations

All public APIs use strict typing:

```python
from typing import (
    TYPE_CHECKING,
    Callable,
    Iterator,
    Literal,
    Protocol,
)
from pathlib import Path
import numpy as np
import torch

if TYPE_CHECKING:
    import gradio as gr
```

---

## 7. Thread Safety

| Component | Thread Safe | Notes |
|:----------|:------------|:------|
| LectureSummarizer | No | Create per-thread instances |
| DINOv2Encoder / PlaceholderVisualEncoder | Yes | Stateless after init |
| TextEncoder | Yes | Stateless after init |
| EventDetector | No | Maintains state |
| EmbeddingIndex | Read: Yes, Write: No | Lock for concurrent writes |
| SummaryGenerator | Yes | Stateless inference |

---

## 8. Versioning

API version follows semantic versioning:
- **Major:** Breaking changes to public API
- **Minor:** New features, backward compatible
- **Patch:** Bug fixes

Current version: **1.0.0**

---

## 9. Open Questions

- [Q1] **Async API:** Should we provide async versions of processing methods?
  - Proposed: Add `async_process_video()` for non-blocking UI
  - Owner: ML_ENGINEER

- [Q2] **Batch queries:** Should `query()` accept multiple queries?
  - Proposed: Add `query_batch()` method
  - Owner: ML_ENGINEER

- [Q3] **Streaming output:** Should summaries stream token by token?
  - Proposed: Add `generate_stream()` for streaming summaries
  - Owner: ML_ENGINEER

---

## 10. Approval Status

| Reviewer | Verdict | Date | Notes |
|:---------|:--------|:-----|:------|
| HOSTILE_REVIEWER | ✅ GO | 2024-12-31 | Approved with ARCHITECTURE.md |

---

*API Design Version: 1.1*
*Author: META_ARCHITECT*
*Project: VL-JEPA Lecture Summarizer*
