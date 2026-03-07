# Evidence Map: Live Lecture Mode Transcription Approach

**Date:** 2026-03-06
**Decision:** Which transcription approach for Live Lecture Mode in v0.5.0+

---

## Options

### Option A: Local In-Browser (Whisper via WASM / transformers.js)
**Evidence Quality:** MEDIUM

| Claim | Source | Confidence |
|-------|--------|------------|
| Whisper.cpp has working WASM build | whisper.cpp GitHub, ggml.ai demo | CONFIRMED |
| Whisper tiny = 75MB model, 39M params | OpenAI docs, whisper model sizes | CONFIRMED |
| WASM SIMD required (not all mobile browsers) | whisper.cpp docs | CONFIRMED |
| "Use tiny or base models; need fast desktop, not mobile phone" for real-time | whisper.cpp stream docs | CONFIRMED |
| transformers.js can run Whisper tiny in browser | HuggingFace docs, whisper-web repo | CONFIRMED |
| Chunked 30s processing with 5s overlap is standard approach | AssemblyAI blog, transformers.js docs | CONFIRMED |
| Browser becomes unresponsive during processing unless WebWorker used | transformers.js docs | CONFIRMED |
| WebGPU acceleration on mobile: iOS 26+ only (late 2025), Android Chrome yes | Apple WWDC 2025, Chromium status | CONFIRMED |
| Phone WASM latency for Whisper tiny: estimated 10-30x real-time (30s audio = 5-15min) | INFERENCE from benchmarks | INFERENCE |

### Option B: Local on Laptop (Phone sends audio via WebSocket)
**Evidence Quality:** HIGH

| Claim | Source | Confidence |
|-------|--------|------------|
| Project already has Whisper integration in Python backend | project_brief.md, CLAUDE.md | CONFIRMED |
| FastAPI backend exists with WebSocket capability | src/vl_jepa/api/main.py | CONFIRMED |
| Whisper tiny on laptop CPU: ~1-3x real-time | whisper.cpp benchmarks | CONFIRMED |
| Whisper base on laptop GPU: ~10-30x real-time | whisper.cpp benchmarks | CONFIRMED |
| Phone and laptop must be on same network | Standard networking | CONFIRMED |
| MediaRecorder can produce audio chunks via ondataavailable | MDN docs | CONFIRMED |

### Option C: Free Cloud APIs
**Evidence Quality:** HIGH

| Claim | Source | Confidence |
|-------|--------|------------|
| Web Speech API: free, no API key, works in Chrome + Android Chrome | MDN, caniuse.com | CONFIRMED |
| Web Speech API: requires internet (server-side processing in Chrome) | MDN docs | CONFIRMED |
| Web Speech API: NOT supported on iOS Safari (partial/broken) | caniuse.com, Apple forums | CONFIRMED |
| Web Speech API: continuous mode unreliable, auto-stops | Developer reports, GitHub issues | CONFIRMED |
| Web Speech API: no duration limit documented, but server-imposed limits exist | Developer reports | INFERENCE |
| Google Cloud STT free tier: 60 min/month | Google Cloud pricing | CONFIRMED |
| Azure free tier: 5 hours/month audio | Azure docs | CONFIRMED |
| Both require API keys (violates "no paid API keys" requirement) | Pricing pages | CONFIRMED |

### Option D: Hybrid (Record on phone, process later on laptop)
**Evidence Quality:** HIGH

| Claim | Source | Confidence |
|-------|--------|------------|
| MediaRecorder can record 90+ minutes of audio | MDN docs, developer reports | CONFIRMED |
| Audio-only recording battery drain: ~15% for 90 min (similar to music) | Developer benchmarks | CONFIRMED |
| Resulting file size: ~5-10MB for 90min Opus, ~50-80MB for WAV | Codec specs | CONFIRMED |
| Can export via download link or send to localhost backend | Standard web APIs | CONFIRMED |
| Whisper processing of 90min audio on laptop: 3-15min depending on model/hardware | whisper.cpp benchmarks | CONFIRMED |
| Already have Whisper pipeline in project | CLAUDE.md tech stack | CONFIRMED |

### Option E: Web Speech API as Primary + MediaRecorder Backup
**Evidence Quality:** MEDIUM

| Claim | Source | Confidence |
|-------|--------|------------|
| Web Speech API gives free real-time text on Android Chrome | Chrome developer blog | CONFIRMED |
| Simultaneously record audio via MediaRecorder as backup | MDN docs | CONFIRMED |
| If Web Speech fails/unavailable, fall back to Option D | Architecture decision | INFERENCE |
| iOS Safari: Web Speech broken, but MediaRecorder works for recording | caniuse.com, Apple forums | CONFIRMED |
| No API key needed for either API | Web standards | CONFIRMED |

---

## Recommendation

**Recommend:** Option E (Web Speech API primary + MediaRecorder backup), with Option D as fallback

**Rationale:**
1. Web Speech API is truly free, no API keys, works on Android Chrome (largest mobile segment)
2. MediaRecorder simultaneously captures audio as insurance policy
3. If real-time transcription fails (iOS, Firefox, offline), student still gets recording for later processing via Option D
4. Option D (process on laptop later) is the reliable fallback that always works
5. Aligns with existing Whisper backend in the project
6. Provides value even in degraded mode (just recording is useful)

**Evidence Quality:** HIGH for the combined approach; each component is independently confirmed.

**Risks:**
1. Web Speech API may auto-stop during long lectures -- Mitigation: auto-restart listener on `onend` event
2. iOS Safari has no real-time transcription path -- Mitigation: record-only mode with post-processing
3. Web Speech API requires internet -- Mitigation: MediaRecorder still captures audio offline
4. Transcription quality varies by environment (noisy lecture halls) -- Mitigation: documented limitation

---

## MVP Definition

The smallest useful version:
1. One-tap "Record Lecture" button on mobile
2. MediaRecorder captures audio (works everywhere)
3. Web Speech API provides live captions where available (Android Chrome)
4. "Stop & Save" exports audio blob to IndexedDB
5. "Process Later" button sends to laptop backend for Whisper transcription
6. Display transcript with timestamps, integrate into existing library

This provides value even without real-time transcription (recording alone saves students from missing content).
