# v0.5.0 "Live Capture" — Implementation Roadmap

**Version:** 3.0.0
**Author:** PLANNER
**Status:** APPROVED (expanded scope — Auto-Notes added)
**Duration:** 4 weeks + 1 week contingency
**Budget:** 68h core + 16h contingency = 84h max

---

## Executive Summary

- **Goal:** Add live audio recording, timestamped photo capture, personal confusion markers, and an Auto-Notes framework to transform Lecture Mind from a review-only tool into a full capture-study-review tool.
- **Critical Path:** DB migration v1-v2 -> Audio capture -> Photo capture -> Confusion voting -> Confusion heatmap -> Privacy + quota UI -> Auto-Notes (extractive + LLM API) -> Release
- **Major Risks:** (1) MediaRecorder API mocking complexity in tests, (2) iOS Safari kills MediaRecorder when taking a photo, (3) IndexedDB storage limits on mobile browsers

---

## 1. Priority Stack

### P0 — Must Ship (cuts here mean no release)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Live Audio Capture** | Record audio via MediaRecorder, live transcript via Web Speech API (Android Chrome), store chunks in IndexedDB, create lecture entry with stub transcript | 16h |
| **Photo Capture** | Timestamped photos during/after recording, canvas resize to 1920px + 80% JPEG, correlated with recording timeline | 11h |
| **DB Migration v1-v2** | 3 new IDB stores: recordingSessions, audioData, photoCaptures | 4h |
| **Privacy info-toast + Web Speech toggle** | Non-blocking info-toast at first recording, Web Speech API toggle (default OFF) | 2h |
| **Storage quota UI** | Usage indicator in settings/record view, warning at 80% capacity | 3h |

### P1 — Should Ship (release is weaker without these)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **SP4-lite: Confusion markers** | Binary "I'm confused" vote button on segments + personal confusion heatmap on lecture detail | 8h |
| **Auto-Notes Framework** | Extractive summarization (TextRank/TF-IDF) for free offline notes + optional LLM API integration (user-provided Claude/GPT key) for high-quality generative notes. Notes tab in lecture detail view. | 12h |

### P2 — Nice to Have (cut first if behind schedule)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Tech debt cleanup** | getCSSVar tests, renderConfetti removal/testing, LICENSE file, dead code removal | 3h |
| **Dependabot PRs** | Merge 8 open PRs (pip, npm, GH Actions) | 2h |
| **Tests + Polish** | Additional edge case tests, accessibility audit, documentation | 5h |

---

## 2. Feature MVPs (Smallest Useful Version)

### Live Audio Capture MVP

What it IS:
- Press "Record" button on mobile or desktop browser
- Audio captured via MediaRecorder API, chunked to IndexedDB every 5 seconds
- Codec negotiation: `isTypeSupported()` -> opus/webm > aac/mp4 > wav
- Audio size: Opus 32kbps = ~20MB for a 90-minute lecture
- Web Speech API provides live transcript text on supported browsers (Android Chrome)
- Web Speech API is opt-in (toggle, default OFF) with auto-restart on `onend`
- Works offline (chunks stored locally in IndexedDB)
- Press "Stop" -> transcript stub creates mock segments from audio duration
- Lecture entry + segments created in library automatically

What it is NOT:
- No real Whisper transcription (stub service with mock data — real in v1.0.0)
- No waveform visualization
- No cloud upload of audio
- No video capture (audio only)

### Photo Capture MVP

What it IS:
- "Take Photo" button available during and after recording
- Uses `<input type="file" accept="image/*">` (triggers native camera on mobile)
- Photos resized via canvas to max 1920px width, compressed to 80% JPEG (~0.5MB each)
- Each photo timestamped and correlated with current recording position
- Photos stored in `photoCaptures` IDB store
- Photos visible in lecture detail view, linked to timeline position

What it is NOT:
- No OCR / Tesseract.js (deferred to v0.5.1+ pending demand validation)
- No photo gallery/editor
- No automatic slide detection
- No photo-to-notes conversion

### Confusion Voting MVP (SP4-lite)

What it IS:
- Binary "I'm confused" button on each segment card in lecture detail view
- Click toggles personal confusion marker, persists to IndexedDB
- Personal only (no multi-user aggregation)
- Confusion heatmap on lecture detail view showing which segments were marked
- Color-coded bar: green (not confused) / red (confused)

What it is NOT:
- No intensity scale (binary confused / not confused only)
- No multi-user aggregation (personal markers only)
- No teacher notification
- No time-weighted decay

### Auto-Notes Framework MVP

What it IS:
- "Notes" tab in lecture detail view alongside segments/flashcards/bookmarks/confusion
- **Mode 1 — Free/Offline (extractive):** TextRank or TF-IDF extracts key sentences from transcript, displayed as bullet-point auto-notes. Zero dependencies beyond a small JS library (~5KB). Works on any browser, no API key needed.
- **Mode 2 — LLM-Powered (user API key):** User provides their own Claude or GPT API key in Settings. Transcript chunks are sent to the API to generate structured, high-quality HTML notes with headings, bullet points, key concepts highlighted. API key stored in localStorage (never leaves device, never sent to our servers).
- Auto-notes generated after transcription completes (triggered automatically or manually)
- Notes editable by student (contentEditable or textarea)
- Export as Markdown or HTML

What it is NOT:
- No auto-summarization during recording (post-processing only)
- No built-in API key (user provides their own — zero cost to us)
- No speaker diarization
- No PDF export (Markdown/HTML only)
- No real-time collaborative editing

---

## 3. Architecture Decisions

### AD-9: Recorder Module Position

```
dom-utils.js <- flashcards.js <- analytics.js <- library.js
                    ^
                    |
              recorder.js (L2, parallel to analytics.js)
```

`recorder.js` is a leaf module at L2. It imports from `flashcards.js` (for router registration via `setRecordRenderer`) and `dom-utils.js`. Nothing imports from `recorder.js`. This preserves AD-1.

### AD-10: Confusion Data Storage

Confusion votes stored as properties within the existing segment data model or a lightweight extension. Votes are personal and anonymous: no user ID, just segmentId + timestamp + boolean confused flag.

### AD-11: Recording Storage (4 New IDB Stores)

`confusionVotes` already exists in v1 (`storage/db.js:74`). Only 4 stores are genuinely new:

| Store | Purpose | Key Fields |
|-------|---------|------------|
| `recordingSessions` | Recording metadata | id, lectureId, status, startedAt, stoppedAt, duration, codec |
| `audioData` | Audio blobs | id (= session id), blob, size |
| `photoCaptures` | Timestamped photos | id, recordingSessionId, timestampMs, blob, size, caption |
| `autoNotes` | Generated lecture notes | id, lectureId, content, source ('extractive'\|'llm'), generatedAt, editedAt |

DB_VERSION upgrades from 1 to 2. Migration creates these 4 stores. `confusionVotes` is skipped
(already present). Existing data is untouched.

Also: `ConfusionVoteRepository.toggle(segmentId, lectureId)` is new work — add to existing repo
with a per-key mutex (CLAUDE.md anti-pattern requirement).

### AD-12: Stub Transcription

`recorder.js` includes a `transcribeStub(audioDurationMs)` function returning `Promise<{text, segments[]}>`. v0.5.0 ships with a stub that generates mock segments from audio duration. v1.0.0 replaces stub with real Whisper API call behind the same interface.

### AD-13: Router Registration

`recorder.js` calls `setRecordRenderer(fn)` to register its view renderer with the `flashcards.js` router. This follows the same pattern as `setLibraryRenderer(fn)` used by `library.js`.

- New route: `#/record` -> `record-view` section in `index.html`
- New HTML: `<section id="record-view" class="view" hidden>` in `index.html`

### AD-14: Privacy Model

- First recording triggers a non-blocking info-toast explaining what is captured and stored
- Web Speech API toggle in record view (default OFF) — user must explicitly enable
- All data stays in local IndexedDB (no server upload in v0.5.0)
- GDPR household exemption applies (personal study use)

### AD-15: Audio Codec Negotiation

```javascript
const CODECS = [
  { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
  { mimeType: 'audio/mp4;codecs=aac',   ext: 'mp4'  },
  { mimeType: 'audio/webm',             ext: 'webm' },
];
// Pick first supported, fallback to default MediaRecorder
```

---

## 4. Week-by-Week Breakdown

### Week 15 (March 9-15): Foundation + Live Audio Capture

**Focus:** Tech debt, iOS spike, DB migration, audio recording pipeline
**Hours:** 25h
**Gate:** Can record audio with live transcript (Android), see lecture in library.

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Day 0 | Tech debt: Dependabot (8 PRs), LICENSE, getCSSVar tests, dead code | 3h | Clean codebase |
| Day 0.5 | iOS spike: photo capture during MediaRecorder on real iPhone | 2h | Spike result documented |
| Days 1-2 | DB migration v1→v2 (5 stores) + recorder.js + MediaRecorder + Web Speech API | 8h | recorder.js, migration, record-view |
| Days 3-4 | Photo capture + transcript stub + post-recording flow | 8h | Photos timestamped, stub transcription, lecture creation |
| Day 5 | SP4-lite confusion voting: vote button on segment cards | 4h | Binary vote, IDB persistence, ARIA |

**New tests:** ~35 (target 592+). **New files:** recorder.js, recorder.test.js, recorder.css

### Week 16 (March 16-22): Confusion Heatmap + Privacy + Storage Quota

**Focus:** Confusion visualization, privacy controls, storage management
**Hours:** 15h (release tasks moved to Week 19)
**Gate:** Heatmap visible, privacy toasts work, storage quota shown.

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Days 1-2 | Confusion heatmap: aggregation, SVG component, "Confusion" tab | 8h | Heatmap on lecture detail, stats |
| Days 3-4 | Privacy info-toast + Web Speech toggle + storage quota UI | 5h | Info-toast, toggle, quota indicator |
| Day 5 | Accessibility audit of all new v0.5.0 components | 2h | ARIA, keyboard, focus, touch targets |

**New tests:** ~20 (target 612+)

### Week 17 (March 23-29): CONTINGENCY

**Activation:** Only if Weeks 15-16 overflow or hostile review returns BLOCK.
**Hours:** Up to 14h
**Alternative use:** If on schedule, begin Auto-Notes research spike.

| ID | Task | Hours | Trigger |
|----|------|-------|---------|
| W17.1 | Hostile review fixes | 4h | Review score < 85 |
| W17.2 | Live capture edge cases (pause/resume, error recovery) | 4h | iOS spike issues |
| W17.3 | Photo gallery polish | 2h | Photo UX needs work |
| W17.4 | Additional test coverage | 2h | Coverage below 90% |
| W17.5 | Spike: evaluate TextRank/TF-IDF libraries for Auto-Notes | 2h | On schedule |

### Week 18 (March 30 - April 5): Auto-Notes Framework

**Focus:** Extractive summarization + LLM API integration + Notes UI
**Hours:** 12h
**Gate:** Notes tab shows auto-generated notes, LLM enhancement works with Claude API key.

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Days 1-2 | notes-engine.js: TextRank extractive pipeline + AutoNote model/repo | 5h | Free offline notes from transcripts |
| Days 3-4 | llm-client.js: Claude API integration + Notes tab UI + export | 7h | LLM notes with user key, editable, exportable |

**New tests:** ~15 (target 627+). **New files:** notes-engine.js, llm-client.js, notes-engine.test.js

### Week 19 (April 6-12): Polish + Release

**Focus:** Integration testing, hostile review, release
**Hours:** 10-17h (flexible — absorbs overflow from earlier weeks)
**Gate:** All tests pass, hostile review >= 85, v0.5.0 tagged.

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Days 1-2 | Integration testing, edge cases, cross-browser smoke test | 6h | Full user journey verified |
| Day 3 | Accessibility + performance audit | 4h | Zero WCAG AA violations, within perf budget |
| Day 4 | Hostile review + fix critical/major issues | 4h | Review file written, score >= 85 |
| Day 5 | CHANGELOG, docs, tag v0.5.0, deploy | 3h | Release live on GitHub + GH Pages |

**New tests:** ~8 (target 640+ total)

---

## 5. Cut Line

If behind schedule, cut in this order (bottom first):

| Priority | Feature | Cut Impact |
|----------|---------|------------|
| CUT LAST | Live Audio Capture (P0) | No release without this |
| CUT 5th | Photo Capture (P0) | Can ship audio-only, photos in v0.5.1 |
| CUT 4th | Auto-Notes Framework (P1) | Can ship without notes, add in v0.5.1 |
| CUT 3rd | SP4-lite Heatmap visualization (P1) | Voting data still captured, just no visualization |
| CUT 2nd | Tech debt cleanup (P2) | Deferred to next cycle |
| CUT 1st | Dependabot PRs (P2) | No user impact, merge anytime |

**Minimum viable release:** Live Audio Capture + DB migration + Privacy toast + Storage quota. This ships without photos, notes, and confusion markers but still delivers the core capture workflow.

---

## 6. Decision Points

| When | Decision | Options |
|------|----------|---------|
| End of Day 0.5 | iOS spike result: does photo kill audio? | YES: disable photo during recording on iOS. NO: enable everywhere |
| End of Week 15 Day 2 | Is MediaRecorder mocking working in tests? | YES: continue. NO: simplify to file-upload-only mode |
| End of Week 15 | Gate: Live capture + voting done? | YES: proceed to W16. NO: extend, cut heatmap |
| End of Week 16 | Gate: Heatmap + privacy + quota done? | YES: proceed to W18. NO: use W17 contingency |
| End of Week 18 Day 2 | CORS test: Claude API from browser works? | YES: build LLM integration. NO: extractive-only for v0.5.0, defer LLM to v0.6.0 |
| End of Week 19 Day 4 | Hostile review score | >= 85: release. < 85: fix and re-review. < 70: re-scope |

---

## 7. Test Strategy

| Module | Estimated New Tests | Approach |
|--------|-------------------|----------|
| DB migration v1-v2 | 6 | Migration with fixture data, verify 5 new stores created |
| RecordingSession CRUD | 8 | Standard repo CRUD pattern from storage/ |
| AudioData CRUD | 5 | Blob storage, session linking |
| PhotoCapture CRUD | 6 | Blob storage, timestamp correlation, session filtering |
| ConfusionVote CRUD | 6 | Vote toggle, getByLecture, getBySegment |
| AutoNote CRUD | 5 | put/get/getByLecture |
| recorder.js (MediaRecorder) | 10 | Mock MediaRecorder, test state machine |
| recorder.js (Web Speech API) | 5 | Mock SpeechRecognition, auto-restart, toggle |
| recorder.js (Photo capture) | 5 | Mock file input, canvas resize, timestamp |
| Confusion voting UI | 6 | DOM rendering, click toggle, ARIA |
| Confusion heatmap | 7 | SVG structure, color mapping, empty/edge states |
| notes-engine.js (extractive) | 8 | TextRank pipeline, empty/short/long input |
| llm-client.js (LLM API) | 6 | Mock API responses, error cases, Claude provider |
| **Total new** | **~83** | **Target: 640+ total** |

---

## 8. Dependency Map

```
Week 15:
  W15.0 (tech debt) ---------> no dependencies
  W15.0.5 (iOS spike) -------> no dependencies (parallel with W15.0)
  W15.1 (DB migration) ------> W15.0 (clean codebase)
  W15.2 (audio capture) -----> W15.1 (IDB stores exist)
  W15.3 (photo capture) -----> W15.2 (recorder.js exists) + W15.0.5 (iOS result)
  W15.4 (transcript stub) ---> W15.2 (audio data exists)
  W15.5 (confusion voting) --> W15.1 (confusionVotes store exists)

Week 16:
  W16.1 (confusion heatmap) -> W15.5 (confusion data exists)
  W16.2 (privacy toast) -----> W15.2 (record view exists)
  W16.3 (storage quota) -----> W15.1 (IDB stores exist)
  W16.4 (a11y audit) --------> W16.1, W16.2, W16.3

Week 17: CONTINGENCY (skip if on schedule)

Week 18:
  W18.1 (extractive engine) -> W15.4 (transcript data exists) + W15.1 (autoNotes store)
  W18.2 (LLM client) --------> W18.1 (notes pipeline exists)
  W18.3 (Notes tab UI) ------> W18.1 (notes data exists)

Week 19:
  W19.1 (integration test) --> W18 (all features complete)
  W19.2 (hostile review) ----> W19.1
  W19.3 (release) -----------> W19.2 (review passes)
```

---

## 9. Tech Debt Resolution

| Item | When | Action |
|------|------|--------|
| `getCSSVar` zero test coverage | Week 15 Day 0 | Add 3+ tests in analytics.test.js |
| `renderConfetti` exported with zero tests | Week 15 Day 0 | Add tests or remove export |
| Legacy `renderLibraryView` fallback | Week 15 Day 0 | Remove dead code path in flashcards.js |
| Missing LICENSE file | Week 15 Day 0 | Add MIT LICENSE to project root |
| Dependabot alerts (8 open PRs) | Week 15 Day 0 | Triage and merge: pip (av, fsspec, huggingface-hub, regex, transformers), npm (minimatch, multi), GH Actions (upload-artifact) |

---

## 10. Calendar View

```
March 2026
  Week 14 (Mar 2-8):   v0.4.0 RELEASED (557 tests)
  Week 15 (Mar 9-15):  v0.5.0 — Tech Debt + iOS Spike + DB Migration + Live Audio Capture
  Week 16 (Mar 16-22): v0.5.0 — Confusion Heatmap + Privacy + Storage Quota UI + A11y Audit
  Week 17 (Mar 23-29): CONTINGENCY (overflow from W15-16, or early prep spikes)
  Week 18 (Mar 30-Apr 5): v0.5.0 — Auto-Notes Framework (extractive + LLM API)
  Week 19 (Apr 6-12):  v0.5.0 — Polish + Hostile Review + Release (CONTINGENCY buffer)

April-May 2026
  Weeks 20-22: v0.6.0 "Vision" — Tesseract.js OCR, Claude Vision, Auto-Notes v2, notes import
  Weeks 23-25: v0.7.0 "Community" — Professor Dashboard, aggregate confusion, rebranding
  Weeks 26+:   v1.0.0 "Production" — Real Whisper backend, Y-decoder, multi-user
```

---

## 11. What is CUT from v0.5.0 (Deferred)

| Feature | Deferred To | Reason |
|---------|-------------|--------|
| Professor Dashboard | v0.6.0 | Needs multi-user backend; single-user version is just analytics tab with extra steps |
| Tesseract.js OCR | v0.5.1+ | Ship photos first, validate demand before adding 1MB+ dependency |
| Aggregate confusion analytics | v0.6.0 | Needs multi-user backend for meaningful aggregation |
| Real Whisper transcription | v1.0.0 | Requires server-side GPU; stub interface in v0.5.0 preserves upgrade path |
| Broader audience rebranding | v0.6.0 | Naming and marketing only, not engineering |

---

## 12. Future Roadmap (Beyond v0.5.0)

| Version | Codename | Key Features | Estimated Duration |
|---------|----------|-------------|-------------------|
| v0.6.0 | "Vision" | Tesseract.js OCR on photos, Claude Vision for handwriting/diagrams, Auto-Notes v2 (multi-source), photo-segment correlation, manual notes import | 3-4 weeks |
| v0.7.0 | "Community" | Professor Dashboard (multi-user), aggregate confusion analytics, broader audience rebranding | 3 weeks |
| v1.0.0 | "Production" | Real Whisper backend, Y-decoder (Phi-3 mini), multi-user auth, security audit | 4 weeks |

---

## PLANNER: Plan Complete

Artifacts:
- `docs/planning/ROADMAP_V050.md` (this file)
- `docs/planning/WEEK15_PLAN.md`
- `docs/planning/WEEK16_PLAN.md`
- `docs/planning/WEEK17_PLAN.md`
- `docs/planning/WEEK18_PLAN.md`
- `docs/planning/WEEK19_PLAN.md`

Status: APPROVED (expanded scope — Auto-Notes added, 4-5 week timeline)

Next: Begin Week 15 Day 0 — Tech Debt + Dependabot cleanup.
