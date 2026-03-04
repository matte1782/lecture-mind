# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-03-04

### Added
- **Student Playground** — full client-side learning environment
- Multi-lecture library with course organization, sorting, and filtering
- Cross-lecture full-text search with relevance scoring
- Auto-generated flashcards with SM-2 spaced repetition algorithm
- Study session tracking with quiz results and watch time
- Per-lecture analytics tab (accuracy trends, mastery distribution, watch stats)
- Aggregate study dashboard (streaks, weekly charts, global mastery)
- Favorites and playlist navigation
- Bookmarks with segment-level annotation
- Import pipeline for processing results (JSON drag-and-drop)
- Batch operations (assign course, delete lectures)
- Service Worker for offline caching (cache-first static, network-first API)
- Loading skeletons with staggered card entrance animations
- IndexedDB storage layer with repositories for lectures, segments, flashcards, bookmarks, progress, courses, events, and settings
- Offline sync queue with exponential backoff retry
- Keyboard shortcuts for library navigation and flashcard study
- Student Playground user guide in documentation

### Changed
- Design system expanded with tokens-v2, animations-v2, and playground-components CSS
- Documentation site updated with Student Playground guide
- GitHub Pages workflow now deploys playground alongside docs

### Security
- Safe DOM throughout — createElement + textContent only, zero innerHTML
- All user input sanitized before DOM insertion
- Service Worker validates cache integrity on activate
- ARIA roles, keyboard handlers, and tabindex on all interactive elements
- Reduced-motion support via prefers-reduced-motion media query

### Technical
- 557 tests across 10 test suites (100% pass rate)
- IndexedDB with fake-indexeddb for test isolation
- ES modules with Jest --experimental-vm-modules
- One-directional dependency chain: dom-utils <- flashcards <- library
- Paginated rendering with IntersectionObserver for large libraries

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

[Unreleased]: https://github.com/matte1782/lecture-mind/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/matte1782/lecture-mind/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/matte1782/lecture-mind/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/matte1782/lecture-mind/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/matte1782/lecture-mind/releases/tag/v0.1.0
