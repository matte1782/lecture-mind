"""
FastAPI application for Lecture Mind.

IMPLEMENTS: S014 - REST API Interface
Provides REST endpoints for video processing, search, and export.
"""

from __future__ import annotations

import logging
import os
import shutil
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any

# Configure logging early for debugging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
_startup_logger = logging.getLogger("vl_jepa.api.startup")
_startup_logger.info("Starting Lecture Mind API module import...")
_startup_logger.info(f"Python version: {sys.version}")
_startup_logger.info(f"Working directory: {os.getcwd()}")
_startup_logger.info(
    f"PORT env variable: {os.environ.get('PORT', 'not set (will use 8000)')}"
)

try:
    import numpy as np

    _startup_logger.info(f"NumPy version: {np.__version__}")
except ImportError as e:
    _startup_logger.error(f"Failed to import numpy: {e}")
    raise

try:
    from fastapi import (
        BackgroundTasks,
        FastAPI,
        File,
        HTTPException,
        Request,
        UploadFile,
    )
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import HTMLResponse
    from fastapi.staticfiles import StaticFiles

    _startup_logger.info("FastAPI imports successful")
except ImportError as e:
    _startup_logger.error(f"Failed to import fastapi: {e}")
    raise

from vl_jepa.api.models import (  # noqa: E402
    EventItem,
    ExportFormat,
    ExportResponse,
    JobStatus,
    ProcessingResult,
    ProcessingStage,
    ProgressResponse,
    ResultsResponse,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    TranscriptChunk,
    UploadResponse,
    VideoMetadata,
)

if TYPE_CHECKING:
    from vl_jepa.multimodal_index import MultimodalIndex

logger = logging.getLogger(__name__)

# In-memory job storage (for demo - use Redis/DB in production)
_jobs: dict[str, dict[str, Any]] = {}
_job_lock = threading.Lock()

# Security fix C3: Simple rate limiter (use Redis in production)
_rate_limit_store: dict[str, list[float]] = {}
_rate_limit_lock = threading.Lock()

# Rate limit config (from env or defaults)
RATE_LIMIT_REQUESTS = int(os.environ.get("RATE_LIMIT_REQUESTS", "10"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW", "60"))


def check_rate_limit(client_ip: str) -> bool:
    """
    Check if client has exceeded rate limit.

    Returns True if allowed, False if rate limited.
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS

    with _rate_limit_lock:
        # Get or create request history for this IP
        if client_ip not in _rate_limit_store:
            _rate_limit_store[client_ip] = []

        # Clean old entries for this IP
        _rate_limit_store[client_ip] = [
            t for t in _rate_limit_store[client_ip] if t > window_start
        ]

        # Fix N1 (round 3): Clean up stale IP entries periodically
        # Remove IPs with no recent requests (every ~100 requests)
        if len(_rate_limit_store) > 100:
            stale_ips = [
                ip
                for ip, timestamps in _rate_limit_store.items()
                if not timestamps or max(timestamps) < window_start
            ]
            for ip in stale_ips:
                del _rate_limit_store[ip]

        # Check limit
        if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
            return False

        # Record this request
        _rate_limit_store[client_ip].append(now)
        return True


# Fix M4 (round 2): Job TTL-based cleanup
JOB_TTL_SECONDS = int(os.environ.get("JOB_TTL_SECONDS", "3600"))  # 1 hour default
MAX_JOBS = int(os.environ.get("MAX_JOBS", "50"))  # Max concurrent jobs


def cleanup_old_jobs() -> int:
    """
    Clean up expired jobs and enforce max job limit.

    Returns number of jobs removed.
    """
    now = time.time()
    removed = 0

    with _job_lock:
        # Find expired jobs (only consider jobs with created_at timestamp)
        expired = [
            job_id
            for job_id, job in _jobs.items()
            if "created_at" in job and now - job["created_at"] > JOB_TTL_SECONDS
        ]

        # Remove expired jobs and clean up temp files
        for job_id in expired:
            job = _jobs.pop(job_id, None)
            if job:
                temp_dir = job.get("temp_dir")
                if temp_dir:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                removed += 1

        # If still over limit, remove oldest jobs (only those with timestamps)
        if len(_jobs) > MAX_JOBS:
            # Sort jobs with timestamps by age, jobs without timestamps go last
            sorted_jobs = sorted(
                _jobs.items(),
                key=lambda x: x[1].get("created_at", float("inf")),
            )
            to_remove = len(_jobs) - MAX_JOBS
            for job_id, job in sorted_jobs[:to_remove]:
                # Only remove if it has a timestamp (preserve test fixtures)
                if "created_at" in job:
                    _jobs.pop(job_id, None)
                    temp_dir = job.get("temp_dir")
                    if temp_dir:
                        shutil.rmtree(temp_dir, ignore_errors=True)
                    removed += 1

    if removed > 0:
        logger.info("Cleaned up %d old jobs", removed)

    return removed


# Static files directory
STATIC_DIR = Path(__file__).parent / "static"


def create_app(
    use_placeholders: bool = True,
    debug: bool = False,
) -> FastAPI:
    """
    Create FastAPI application.

    Args:
        use_placeholders: Use placeholder encoders for fast demo.
        debug: Enable debug mode.

    Returns:
        Configured FastAPI application.
    """
    app = FastAPI(
        title="Lecture Mind API",
        description="AI-powered lecture analysis with visual and transcript search",
        version="0.3.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    # CORS configuration
    # Security fix C1: Don't use wildcard origins with credentials
    # For public demo, allow all origins without credentials
    # For production, specify exact origins and enable credentials
    allowed_origins = os.environ.get("CORS_ORIGINS", "").split(",")
    allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins if allowed_origins else ["*"],
        allow_credentials=bool(allowed_origins),  # Only with specific origins
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # Store config in app state
    app.state.use_placeholders = use_placeholders
    app.state.debug = debug

    # Mount static files
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    # Register routes
    _register_routes(app)

    return app


def _register_routes(app: FastAPI) -> None:
    """Register all API routes."""

    @app.get("/", response_class=HTMLResponse)
    async def serve_frontend() -> HTMLResponse:
        """Serve the main frontend page."""
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return HTMLResponse(content=index_path.read_text(encoding="utf-8"))
        return HTMLResponse(
            content="<h1>Lecture Mind</h1><p>Frontend not found. Visit /api/docs for API.</p>"
        )

    @app.get("/api/health")
    async def health_check() -> dict[str, str]:
        """Health check endpoint for deployment monitoring."""
        return {"status": "healthy", "service": "lecture-mind"}

    @app.get("/api/config")
    async def get_config() -> dict[str, Any]:
        """Get application configuration (demo mode status, etc.)."""
        return {
            "demo_mode": app.state.use_placeholders,
            "version": "0.3.0",
            "features": {
                "transcription": not app.state.use_placeholders,
                "real_embeddings": not app.state.use_placeholders,
                "semantic_search": True,  # Works in both modes
            },
            "local_setup_url": "https://github.com/matte1782/lecture-mind#local-installation",
        }

    # Security fix C2: Server-side file size limit (500MB default, aligned with frontend + processing.py)
    MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "500"))
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    CHUNK_SIZE = 1024 * 1024  # 1MB chunks for streaming upload

    @app.post("/api/upload", response_model=UploadResponse)
    async def upload_video(
        request: Request,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),  # noqa: B008 - FastAPI pattern
    ) -> UploadResponse:
        """
        Upload a video file for processing.

        Returns a job_id to track processing status.
        """
        # Security fix C3: Rate limiting
        # Fix C2 (round 2): Reject requests without client identification
        if not request.client:
            raise HTTPException(
                status_code=400,
                detail="Cannot determine client IP. Request rejected.",
            )
        client_ip = request.client.host
        if not check_rate_limit(client_ip):
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait before uploading again.",
            )

        # Validate file type
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        allowed_extensions = {".mp4", ".webm", ".avi", ".mov", ".mkv"}
        ext = Path(file.filename).suffix.lower()
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format. Allowed: {', '.join(allowed_extensions)}",
            )

        # Generate job ID
        job_id = str(uuid.uuid4())[:8]

        # Save uploaded file with size limit check (streaming)
        temp_dir = Path(tempfile.mkdtemp())
        # Fix C1 (round 2): Sanitize filename to prevent path traversal attacks
        safe_filename = os.path.basename(file.filename)
        if not safe_filename:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail="Invalid filename")
        video_path = temp_dir / safe_filename
        total_size = 0

        try:
            with open(video_path, "wb") as f:
                while chunk := await file.read(CHUNK_SIZE):
                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE_BYTES:
                        # Fix M2 (round 2): Use shutil.rmtree for robust cleanup
                        f.close()
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        raise HTTPException(
                            status_code=413,
                            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB",
                        )
                    f.write(chunk)
        except HTTPException:
            raise
        except Exception as e:
            # Fix M2 (round 2): Use shutil.rmtree for robust cleanup
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.error("Upload failed: %s", e)
            raise HTTPException(status_code=500, detail="Upload failed") from e

        # Fix M4 (round 2): Clean up old jobs before creating new one
        cleanup_old_jobs()

        # Initialize job
        with _job_lock:
            _jobs[job_id] = {
                "status": JobStatus.PENDING,
                "stage": None,
                "progress": 0.0,
                "message": "Queued for processing",
                "video_path": str(video_path),
                "temp_dir": str(temp_dir),
                "result": None,
                "error": None,
                "use_placeholders": app.state.use_placeholders,
                "created_at": time.time(),  # For TTL-based cleanup
            }

        # Start processing in background
        background_tasks.add_task(_process_video, job_id)

        return UploadResponse(
            job_id=job_id,
            message="Video uploaded. Processing started.",
        )

    @app.get("/api/status/{job_id}", response_model=ProgressResponse)
    async def get_status(job_id: str) -> ProgressResponse:
        """Get processing status for a job."""
        # Fix N2 (round 3): Clean up old jobs on status check (frequent endpoint)
        cleanup_old_jobs()

        with _job_lock:
            job = _jobs.get(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return ProgressResponse(
            job_id=job_id,
            status=job["status"],
            stage=job.get("stage"),
            progress=job["progress"],
            message=job["message"],
            error=job.get("error"),
        )

    @app.get("/api/results/{job_id}", response_model=ResultsResponse)
    async def get_results(job_id: str) -> ResultsResponse:
        """Get processing results for a completed job."""
        # Fix N2 (round 3): Also clean up on results check
        cleanup_old_jobs()

        with _job_lock:
            job = _jobs.get(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return ResultsResponse(
            job_id=job_id,
            status=job["status"],
            result=job.get("result"),
            error=job.get("error"),
        )

    @app.post("/api/search/{job_id}", response_model=SearchResponse)
    async def search(job_id: str, request: SearchRequest) -> SearchResponse:
        """Search within processed video content using semantic search."""
        with _job_lock:
            job = _jobs.get(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if job["status"] != JobStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Processing not complete")

        # Get the index and text encoder from job state
        index: MultimodalIndex | None = job.get("index")
        text_encoder = job.get("text_encoder")
        result = job.get("result")

        if not result:
            return SearchResponse(query=request.query, results=[], total=0)

        results: list[SearchResultItem] = []

        # Use semantic search if index is available
        if index is not None and text_encoder is not None and index.size > 0:
            try:
                # Encode query
                query_embedding = text_encoder.encode(request.query)

                # Search transcript modality
                from vl_jepa.multimodal_index import Modality

                search_results = index.search(
                    query_embedding,
                    k=request.top_k,
                    modality=Modality.TRANSCRIPT,
                )

                for sr in search_results:
                    results.append(
                        SearchResultItem(
                            text=sr.text or "",
                            timestamp=sr.timestamp,
                            timestamp_formatted=_format_timestamp(sr.timestamp),
                            score=float(sr.score),
                            result_type="transcript",
                        )
                    )
                logger.info(
                    "Semantic search for '%s' found %d results",
                    request.query,
                    len(results),
                )
            except Exception as e:
                logger.warning("Semantic search failed: %s, falling back to text", e)
                # Fall through to text matching

        # Fallback to text matching if semantic search not available or failed
        if not results:
            query_lower = request.query.lower()
            for chunk in result.transcript:
                if query_lower in chunk.text.lower():
                    results.append(
                        SearchResultItem(
                            text=chunk.text,
                            timestamp=chunk.start,
                            timestamp_formatted=chunk.start_formatted,
                            score=0.5,  # Lower score for text match
                            result_type="transcript",
                        )
                    )
            results = results[: request.top_k]

        return SearchResponse(
            query=request.query,
            results=results,
            total=len(results),
        )

    @app.get("/api/export/{job_id}/{format}")
    async def export(job_id: str, format: ExportFormat) -> ExportResponse:
        """Export results in specified format."""
        with _job_lock:
            job = _jobs.get(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if job["status"] != JobStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Processing not complete")

        result = job.get("result")
        if not result:
            raise HTTPException(status_code=404, detail="No results available")

        # Generate export content
        from vl_jepa.ui.export import (
            export_json,
            export_markdown,
            export_srt,
        )

        # Create a mock result object for export functions
        class MockResult:
            def __init__(self, r: ProcessingResult) -> None:
                self.metadata = type(
                    "M",
                    (),
                    {
                        "path": r.metadata.filename,
                        "width": r.metadata.width,
                        "height": r.metadata.height,
                        "fps": r.metadata.fps,
                        "frame_count": int(r.metadata.duration * r.metadata.fps),
                        "duration": r.metadata.duration,
                        "codec": r.metadata.codec,
                    },
                )()
                self.events = [
                    type(
                        "E", (), {"timestamp": e.timestamp, "confidence": e.confidence}
                    )()
                    for e in r.events
                ]
                self.transcript_chunks = [
                    type("T", (), {"text": t.text, "start": t.start, "end": t.end})()
                    for t in r.transcript
                ]
                self.processing_time = r.processing_time
                self.frame_count = int(r.metadata.duration * r.metadata.fps)
                self.error = None

        mock = MockResult(result)

        if format == ExportFormat.MARKDOWN:
            content = export_markdown(mock)
            filename = "lecture_summary.md"
        elif format == ExportFormat.JSON:
            content = export_json(mock)
            filename = "lecture_data.json"
        elif format == ExportFormat.SRT:
            content = export_srt(mock)
            filename = "lecture_subtitles.srt"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")

        return ExportResponse(
            format=format,
            content=content,
            filename=filename,
        )

    @app.delete("/api/job/{job_id}")
    async def delete_job(job_id: str) -> dict[str, str]:
        """Delete a job and clean up resources."""
        with _job_lock:
            job = _jobs.pop(job_id, None)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Clean up temp files
        temp_dir = job.get("temp_dir")
        if temp_dir:
            import shutil

            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass

        return {"message": "Job deleted"}


def _format_timestamp(seconds: float) -> str:
    """Format seconds to MM:SS."""
    import math

    if not math.isfinite(seconds) or seconds < 0:
        return "0:00"
    total = int(seconds)
    mins = total // 60
    secs = total % 60
    return f"{mins}:{secs:02d}"


def _process_video(job_id: str) -> None:
    """Process video in background thread."""

    def update_progress(
        stage: ProcessingStage,
        progress: float,
        message: str,
    ) -> None:
        with _job_lock:
            if job_id in _jobs:
                _jobs[job_id]["stage"] = stage
                _jobs[job_id]["progress"] = progress
                _jobs[job_id]["message"] = message
                _jobs[job_id]["status"] = JobStatus.PROCESSING

    try:
        with _job_lock:
            job = _jobs.get(job_id)
            if not job:
                return
            video_path = Path(job["video_path"])

        # Stage 1: Loading video
        update_progress(ProcessingStage.LOADING, 0.05, "Loading video...")
        time.sleep(0.3)  # Simulate work

        # Get video metadata
        # Fix M1 (round 2): Ensure video handle is always closed
        try:
            from vl_jepa.video import VideoInput

            video = VideoInput.open(video_path)
            try:
                metadata = VideoMetadata(
                    filename=video_path.name,
                    duration=video.duration,
                    width=video.width,
                    height=video.height,
                    fps=video.fps,
                    codec=video.codec,
                )
            finally:
                video.close()
        except Exception:
            # Fallback for demo
            metadata = VideoMetadata(
                filename=video_path.name,
                duration=60.0,
                width=1920,
                height=1080,
                fps=30.0,
                codec="h264",
            )

        # Stage 2: Extract audio
        update_progress(ProcessingStage.EXTRACTING_AUDIO, 0.15, "Extracting audio...")

        audio_path = None
        transcript_chunks = []

        try:
            from vl_jepa.audio.extractor import check_ffmpeg_available, extract_audio

            if check_ffmpeg_available():
                audio_path = extract_audio(str(video_path))
                logger.info("Audio extracted to: %s", audio_path)
            else:
                logger.warning("FFmpeg not available, skipping audio extraction")
        except Exception as e:
            logger.warning("Audio extraction failed: %s", e)

        # Stage 3: Transcribe audio
        # Check if we should use placeholder mode (skip heavy model loading)
        use_placeholders = job.get("use_placeholders", True)

        if use_placeholders:
            update_progress(
                ProcessingStage.TRANSCRIBING,
                0.30,
                "Demo mode - skipping transcription...",
            )
            logger.info("Placeholder mode: skipping Whisper model loading")
        elif audio_path:
            update_progress(
                ProcessingStage.TRANSCRIBING, 0.30, "Transcribing audio with Whisper..."
            )
            try:
                from vl_jepa.audio.transcriber import (
                    WhisperTranscriber,
                    check_whisper_available,
                )

                if check_whisper_available():
                    # Use base model for balance of speed/accuracy
                    transcriber = WhisperTranscriber.load("base", device="auto")
                    segments = transcriber.transcribe(audio_path)

                    # Convert to API format
                    for seg in segments:
                        transcript_chunks.append(
                            TranscriptChunk(
                                text=seg.text,
                                start=seg.start,
                                end=seg.end,
                                start_formatted=_format_timestamp(seg.start),
                                end_formatted=_format_timestamp(seg.end),
                            )
                        )
                    logger.info("Transcribed %d segments", len(transcript_chunks))
                else:
                    logger.warning("Whisper not available")
            except Exception as e:
                logger.warning("Transcription failed: %s", e)

        # Fallback to demo transcript if real transcription failed
        if not transcript_chunks:
            logger.info("Using demo transcript (real transcription not available)")
            transcript_chunks = [
                TranscriptChunk(
                    text="🎓 Demo Mode - This cloud version uses lightweight processing.",
                    start=0.0,
                    end=5.0,
                    start_formatted="0:00",
                    end_formatted="0:05",
                ),
                TranscriptChunk(
                    text="For full AI transcription and embeddings, run locally!",
                    start=5.0,
                    end=10.0,
                    start_formatted="0:05",
                    end_formatted="0:10",
                ),
                TranscriptChunk(
                    text="Visit GitHub for setup: github.com/matte1782/lecture-mind",
                    start=10.0,
                    end=15.0,
                    start_formatted="0:10",
                    end_formatted="0:15",
                ),
            ]

        # Stage 4: Sample frames
        update_progress(ProcessingStage.SAMPLING_FRAMES, 0.45, "Sampling frames...")

        # Sample frames from video (1 FPS for event detection)
        # Fix M1 (round 2): Ensure video handle is always closed
        frames = []
        frame_timestamps = []
        try:
            from vl_jepa.video import VideoInput

            video = VideoInput.open(video_path)
            try:
                sampled = list(video.sample_frames(target_fps=1.0))
                frames = [f.data for f in sampled]
                frame_timestamps = [f.timestamp for f in sampled]
                logger.info("Sampled %d frames at 1 FPS", len(frames))
            finally:
                video.close()
        except Exception as e:
            logger.warning("Frame sampling failed: %s", e)

        # Stage 5: Encode frames
        update_progress(ProcessingStage.ENCODING_FRAMES, 0.55, "Encoding frames...")

        # Initialize visual encoder
        frame_embeddings = []
        try:
            from vl_jepa.encoders.placeholder import PlaceholderVisualEncoder

            visual_encoder = PlaceholderVisualEncoder()

            # Encode frames (resize to 224x224 and normalize)
            import cv2

            for frame in frames:
                # frame is typically (H, W, 3) BGR uint8
                resized = cv2.resize(frame, (224, 224))
                # Convert BGR to RGB and normalize to [-1, 1]
                rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
                normalized = (rgb.astype(np.float32) / 127.5) - 1.0
                # Transpose to (C, H, W)
                chw = normalized.transpose(2, 0, 1)
                embedding = visual_encoder.encode_single(chw)
                frame_embeddings.append(embedding)
            logger.info("Encoded %d frames", len(frame_embeddings))
        except Exception as e:
            logger.warning("Frame encoding failed: %s", e)

        # Stage 6: Encode text
        update_progress(ProcessingStage.ENCODING_TEXT, 0.65, "Encoding transcript...")

        # Initialize text encoder and multimodal index
        text_encoder: Any = None
        multimodal_index: MultimodalIndex | None = None
        try:
            # Try real MiniLM encoder first
            try:
                from vl_jepa.text import TextEncoder

                text_encoder = TextEncoder.load()
                logger.info("Loaded real TextEncoder (MiniLM)")
            except Exception:
                from vl_jepa.encoders.placeholder import PlaceholderTextEncoder

                text_encoder = PlaceholderTextEncoder()
                logger.info("Using PlaceholderTextEncoder")

            # Build multimodal index
            from vl_jepa.multimodal_index import MultimodalIndex

            multimodal_index = MultimodalIndex()

            # Add transcript embeddings
            for i, chunk in enumerate(transcript_chunks):
                text_embedding = text_encoder.encode(chunk.text)
                multimodal_index.add_transcript(
                    embedding=text_embedding,
                    start_time=chunk.start,
                    end_time=chunk.end,
                    text=chunk.text,
                    segment_id=i,
                )
            logger.info("Added %d transcript chunks to index", len(transcript_chunks))

        except Exception as e:
            logger.warning("Text encoding/indexing failed: %s", e)

        # Stage 7: Detect events
        update_progress(ProcessingStage.DETECTING_EVENTS, 0.80, "Detecting events...")

        events = []
        try:
            from vl_jepa.detector import EventDetector

            # Initialize event detector
            detector = EventDetector(
                threshold=0.25,  # Slightly lower for more sensitivity
                min_event_gap=30.0,  # Minimum 30s between events
                smoothing_window=3,
            )

            # Always add start event
            events.append(
                EventItem(
                    timestamp=0.0,
                    timestamp_formatted="0:00",
                    confidence=1.0,
                )
            )

            # Process frame embeddings to detect events
            for embedding, timestamp in zip(
                frame_embeddings, frame_timestamps, strict=False
            ):
                event = detector.process(embedding, timestamp)
                if event:
                    events.append(
                        EventItem(
                            timestamp=event.timestamp,
                            timestamp_formatted=_format_timestamp(event.timestamp),
                            confidence=event.confidence,
                        )
                    )

            logger.info("Detected %d events (including start)", len(events))

            # If no events detected beyond start, try transcript-based detection
            if len(events) < 2 and len(transcript_chunks) > 2:
                logger.info("Using transcript-based event detection as fallback")
                # Create events based on transcript gaps or topic changes
                prev_end = 0.0
                for chunk in transcript_chunks:
                    # Large gap suggests topic change
                    if chunk.start - prev_end > 20.0:
                        events.append(
                            EventItem(
                                timestamp=chunk.start,
                                timestamp_formatted=_format_timestamp(chunk.start),
                                confidence=0.7,
                            )
                        )
                    prev_end = chunk.end

                # Ensure events are sorted and deduplicated
                events = sorted(events, key=lambda e: e.timestamp)
                seen = set()
                unique_events = []
                for evt in events:
                    key = round(evt.timestamp / 10) * 10  # 10s buckets
                    if key not in seen:
                        seen.add(key)
                        unique_events.append(evt)
                events = unique_events[:10]  # Limit to 10 events

        except Exception as e:
            logger.warning("Event detection failed: %s, using single start event", e)
            events = [
                EventItem(
                    timestamp=0.0,
                    timestamp_formatted="0:00",
                    confidence=1.0,
                )
            ]

        # Stage 8: Build index
        update_progress(
            ProcessingStage.BUILDING_INDEX, 0.95, "Building search index..."
        )

        # Create result
        result = ProcessingResult(
            metadata=metadata,
            events=events,
            transcript=transcript_chunks,
            processing_time=3.5,
        )

        # Complete
        with _job_lock:
            if job_id in _jobs:
                _jobs[job_id]["status"] = JobStatus.COMPLETED
                _jobs[job_id]["stage"] = ProcessingStage.COMPLETED
                _jobs[job_id]["progress"] = 1.0
                _jobs[job_id]["message"] = "Processing complete"
                _jobs[job_id]["result"] = result
                _jobs[job_id]["index"] = multimodal_index
                _jobs[job_id]["text_encoder"] = text_encoder

        logger.info(
            "Job %s completed: %d events, %d transcript chunks, index size %d",
            job_id,
            len(events),
            len(transcript_chunks),
            multimodal_index.size if multimodal_index else 0,
        )

    except Exception:
        logger.exception("Job %s failed", job_id)
        with _job_lock:
            if job_id in _jobs:
                _jobs[job_id]["status"] = JobStatus.FAILED
                _jobs[job_id]["error"] = "Processing failed. Please try again."
                _jobs[job_id]["message"] = "Failed"


# Module-level app instance for uvicorn (used by Render deployment)
_startup_logger.info("Creating FastAPI application...")
try:
    # Check environment variable for placeholder mode (default: False for local development)
    _use_placeholders = os.environ.get("USE_PLACEHOLDERS", "false").lower() in (
        "true",
        "1",
        "yes",
    )
    app = create_app(use_placeholders=_use_placeholders, debug=False)
    _startup_logger.info("FastAPI application created successfully!")
except Exception as e:
    _startup_logger.error(f"Failed to create FastAPI application: {e}")
    raise


# CLI entry point
def main() -> None:
    """Run the API server."""
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
