# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Marked WEEK10_PLAN.md, WEEK10_STORAGE_PLAN.md, WEEK10_DESIGN_PLAN.md as SUPERSEDED
- Updated WEEK10_UNIFIED_PLAN.md to v1.1 with Safari deferral statements (N6)
- All hostile-reviewer pre-execution conditions now addressed

## [0.3.0] - 2026-01-09

### Added
- Web UI with FastAPI backend for video processing
- Real-time processing progress indication
- Semantic search across video transcript
- Export functionality (Markdown, JSON, SRT formats)
- Docker support with multi-stage build
- Cloud demo deployment on Render
- MkDocs documentation site with Material theme
- Local setup guide for full installation
- API reference documentation with curl examples
- GitHub Actions workflow for documentation deployment

### Changed
- CLI program name from `vl-jepa` to `lecture-mind` for consistency
- Improved error handling throughout API endpoints
- Enhanced ROADMAP with v0.4.0 Student Playground planning

### Fixed
- Memory management for long video processing
- Rate limiting with sliding window algorithm
- File size validation with streaming uploads
- Path traversal vulnerability via filename sanitization
- CORS configuration for secure cross-origin requests

### Security
- C1: Fixed CORS wildcard with credentials issue
- C2: Added server-side file size limits (100MB default)
- C3: Implemented rate limiting (10 req/min per IP)
- C4: Replaced innerHTML with safe DOM manipulation methods
- C5: Fixed path traversal attack via os.path.basename()
- C6: Fixed rate limit bypass when client IP unavailable
- Plus 6 additional security improvements (see REVIEW_hostile_final.md)

## [0.2.0] - 2026-01-07

### Added
- Real DINOv2 visual encoder integration (ViT-L/16)
- Whisper audio transcription support
- Multimodal search with combined visual + text ranking
- FAISS similarity search with IVF optimization
- CLI interface for video processing
- Event detection for slide transitions and scene changes
- Text encoder using sentence-transformers (all-MiniLM-L6-v2)

### Changed
- Improved frame sampling with configurable FPS
- Enhanced query latency (<100ms for 100k vectors)

## [0.1.0] - 2026-01-01

### Added
- Initial project structure
- Placeholder encoders for development
- Basic video processing pipeline
- VideoInput and FrameSampler classes
- Event detection framework
- Test infrastructure with pytest

[Unreleased]: https://github.com/matte1782/lecture-mind/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/matte1782/lecture-mind/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/matte1782/lecture-mind/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/matte1782/lecture-mind/releases/tag/v0.1.0
