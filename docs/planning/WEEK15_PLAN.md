# Week 15 Task Plan

**Date Range:** 2026-03-09 to 2026-03-15
**Goal:** Ship live audio capture, photo capture, and confusion voting for v0.5.0 "Live Capture"
**Status:** DRAFT

---

## Prerequisites

- [x] v0.4.0 released (557 tests, 10 suites)
- [x] Architecture approved (`docs/architecture/ARCHITECTURE_v050.md`)
- [x] v0.5.0 scope approved (Option B+photo-light + Auto-Notes, ~68h, 4-5 weeks)
- [ ] Dependabot alerts triaged (Day 0 task)
- [ ] Tech debt items from v0.4.0 hostile review resolved (Day 0 task)
- [ ] iOS spike completed (Day 0.5 task)

---

## Day 0: Tech Debt + Dependabot (3h)

| ID | Task | Hours | Acceptance |
|----|------|-------|------------|
| W15.0.1 | Merge 8 Dependabot PRs (pip: av, fsspec, huggingface-hub, regex, transformers; npm: minimatch, multi; GH Actions: upload-artifact) | 1 | `gh pr list` shows 0 open Dependabot PRs |
| W15.0.2 | Add MIT LICENSE file to project root | 0.25 | `cat LICENSE` shows valid MIT license with 2026 year |
| W15.0.3 | Add tests for `getCSSVar` in analytics.test.js | 0.5 | 3+ tests covering normal value, empty string, jsdom-no-computed-styles fallback |
| W15.0.4 | Remove or test `renderConfetti` export | 0.25 | Either tests exist or export removed; all 557+ tests pass |
| W15.0.5 | Remove legacy `renderLibraryView` fallback in flashcards.js | 0.5 | Dead code path removed, all 557+ tests still pass |
| W15.0.6 | Verify .gitignore hardening | 0.25 | .gitignore blocks `*.png`, `_tmp*`, secrets, `node_modules` |

**Subtotal: 2.75h (buffer to 3h)**

---

## Day 0.5: iOS Spike (2h)

| ID | Task | Hours | Acceptance |
|----|------|-------|------------|
| W15.0.7 | Test on real iPhone: does taking a photo via `<input type="file" accept="image/*">` during active MediaRecorder kill audio stream? | 2 | Result documented below. If YES: disable photo button during recording on iOS Safari. If NO: enable photo capture everywhere. |

**Spike Result:** _[To be filled after test]_

- Device tested: _________________
- iOS version: _________________
- Browser: _________________
- Outcome: AUDIO_SURVIVES / AUDIO_KILLED / NOT_TESTED
- Decision: _________________

---

## Days 1-2: Live Audio Capture (8h)

**Dependency:** W15.0 complete (clean codebase)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W15.1.1 | DB Migration v1 to v2: add `recordingSessions`, `audioData`, `photoCaptures` stores | 2 | `DB_VERSION=2`, 3 new object stores with proper indexes, migration tested with v1 fixture data | Migration tests pass, all existing v1 data preserved after upgrade |
| W15.1.2 | `RecordingSession` + `AudioData` model factories in models.js | 1 | `createRecordingSession(fields)` and `createAudioData(fields)` with validation. Fields per ARCHITECTURE_v050.md | Model validation tests pass (5+ tests) |
| W15.1.3 | `RecordingSessionRepository` + `AudioDataRepository` in repositories.js | 1.5 | `put/get/getAll/delete` + `getByStatus` for sessions | Repo CRUD tests pass (8+ tests) |
| W15.1.4 | recorder.js: MediaRecorder wrapper + Web Speech API integration | 2 | `start/stop/pause`, codec negotiation (`isTypeSupported()`: opus/webm > aac/mp4 > wav), Web Speech API with `continuous: true` and auto-restart on `onend`, chunked audio accumulation in memory | 10+ unit tests with fully mocked `MediaRecorder` and `SpeechRecognition` |
| W15.1.5 | recorder.js: Record button UI + timer + live transcript display | 1.5 | Mobile-first record button (56px+ touch target), elapsed timer with `aria-live="polite"`, live transcript textarea, ARIA labels on all controls | UI renders correctly, button states toggle between record/stop/pause, keyboard accessible |

**Subtotal: 8h**

---

## Days 3-4: Photo Capture + Transcript Stub (8h)

**Dependency:** W15.1.1 complete (DB v2 with photo store)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W15.2.1 | `PhotoCapture` model + `PhotoCaptureRepository` | 1.5 | `createPhotoCapture(fields)` factory. Fields: `id`, `recordingSessionId`, `timestampMs`, `blob`, `size`, `caption`, `createdAt`. Repo: `put/get/getBySession/delete` | Repo CRUD tests pass (6+ tests) |
| W15.2.2 | Photo capture in recorder.js: file input + canvas resize + IDB store | 2 | `<input type="file" accept="image/*" capture="environment">` button visible during recording, canvas resize to 1920px max edge, 80% JPEG quality, store with timestamp correlation to recording session | Photo stored in IDB, timestamp correct relative to recording start, output size < 1MB for typical phone photo |
| W15.2.3 | Photo gallery in lecture detail view (library.js) | 1.5 | Thumbnail grid in segments tab, photos positioned at their capture timestamps, lazy-loaded via `URL.createObjectURL()` | Photos display at correct timeline positions, thumbnails render |
| W15.2.4 | Transcript stub service | 1 | Export `transcribe(audioBlob)` returning `Promise<{text, segments[]}>`. Stub implementation generates mock segments based on audio duration (1 segment per 60s). Interface matches future Whisper integration | Tests pass with mock data, returned shape matches `{text: string, segments: [{start, end, text}]}` |
| W15.2.5 | Post-recording flow: stop then transcribe then create Lecture + Segments | 1.5 | Chain: stop recording, call stub `transcribe()`, create Lecture + Segments in IDB, link photos by `recordingSessionId`, navigate to new lecture detail | Integration test: record, stop, lecture appears in library with correct segment count |
| W15.2.6 | Route `#/record` + record-view section in index.html | 0.5 | New route registered in flashcards.js via `setRecordRenderer(fn)` pattern, `<section id="record-view">` added to index.html | Navigation to `#/record` works, view renders, back button returns to library |

**Subtotal: 8h**

---

## Day 5: SP4-lite Confusion Voting (4h)

**Dependency:** W15.1.1 complete (DB v2 with confusion store). Can run in parallel with Days 3-4 photo work.

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W15.3.1 | `ConfusionVote` model in models.js | 0.5 | `createConfusionVote(fields)` factory. Fields: `id`, `segmentId`, `lectureId`, `timestamp`. Binary voting (confused / not confused), no intensity scale | Model validation tests pass (3+ tests) |
| W15.3.2 | `ConfusionVoteRepository` in repositories.js | 1.5 | `put/delete/getByLecture/getBySegment/toggle`. New `confusionVotes` store added in v1 to v2 migration (W15.1.1) | Repo CRUD tests pass (6+ tests), toggle flips existing vote |
| W15.3.3 | Confusion vote button on segment cards in library.js | 2 | "I'm confused" button on each segment card in lecture detail segments tab. Click toggles vote, persists to IDB. Shows vote count per segment. `role="button"`, `tabindex="0"`, keyboard handler for Enter/Space | Click toggles visual state, refresh preserves vote, ARIA label present (`aria-pressed`), keyboard accessible |

**Subtotal: 4h**

---

## Estimated Total

| Block | Hours |
|-------|-------|
| Day 0: Tech Debt + Dependabot | 3 |
| Day 0.5: iOS Spike | 2 |
| Days 1-2: Live Audio Capture | 8 |
| Days 3-4: Photo Capture + Transcript Stub | 8 |
| Day 5: SP4-lite Confusion Voting | 4 |
| **Total** | **25h** |

All estimates include the 2x buffer per PLANNER estimation rules.

---

## Dependency Map

```
W15.0 (tech debt) ---------> no dependencies
W15.0.7 (iOS spike) -------> no dependencies (parallel with W15.0)

W15.1.1 (DB migration) ----> W15.0 (clean codebase)
W15.1.2 (models) ----------> W15.1.1 (stores exist)
W15.1.3 (repositories) ----> W15.1.2 (models exist)
W15.1.4 (MediaRecorder) ---> W15.1.3 (repos for storage)
W15.1.5 (record UI) -------> W15.1.4 (recorder logic exists)

W15.2.1 (photo model) -----> W15.1.1 (photo store in DB v2)
W15.2.2 (photo capture) ---> W15.2.1 + W15.1.4 (repo + recorder)
W15.2.3 (photo gallery) ---> W15.2.2 (photos stored)
W15.2.4 (transcript stub) -> no dependencies
W15.2.5 (post-recording) --> W15.1.4 + W15.2.4 (recorder + transcriber)
W15.2.6 (route) -----------> W15.1.5 (UI to render)

W15.3.1 (confusion model) -> W15.1.1 (confusion store in DB v2)
W15.3.2 (confusion repo) --> W15.3.1 (model exists)
W15.3.3 (confusion UI) ----> W15.3.2 (repo exists)
```

---

## Blocked Tasks

| ID | Task | Blocked By | Unblock Condition |
|----|------|------------|-------------------|
| W15.B1 | Real Whisper transcription | Backend API endpoint + GPU | Deferred to v1.0.0; stub service is sufficient for v0.5.0 |
| W15.B2 | Privacy info-toast + Web Speech toggle | Week 16 scope | Scheduled for Week 16 (not Week 15) |

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Real Whisper backend integration | v1.0.0 -- requires server-side GPU |
| Tesseract.js OCR on photos | v0.5.1+ -- ship photos first, validate demand |
| Professor dashboard | v0.6.0 -- needs multi-user backend |
| Aggregate confusion analytics | v0.6.0 -- needs multi-user data |
| Privacy info-toast + Web Speech toggle | Week 16 (privacy features) |
| Confusion heatmap visualization | Week 16 (visualization pass) |
| Storage quota UI | Week 16 |
| Waveform visualization during recording | Not planned -- MVP is timer + transcript only |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | MediaRecorder not available in jsdom | MEDIUM | HIGH | Fully mock `MediaRecorder` and `SpeechRecognition` in test setup |
| R2 | iOS spike shows photo capture kills audio | HIGH | MEDIUM | Disable photo button during recording on iOS; allow after stop or when not recording |
| R3 | IDB migration v1 to v2 breaks existing data | HIGH | LOW | Write migration test with v1 fixture data; verify all existing stores survive upgrade |
| R4 | Audio chunk storage bloats IDB | LOW | LOW | Opus 32kbps = ~20MB/90min lecture, well within browser IDB limits |
| R5 | Web Speech API auto-stops during long sessions | MEDIUM | HIGH | Auto-restart recognition on `onend` event; log timestamp gaps for debugging |
| R6 | Canvas resize quality issues on mobile | LOW | LOW | Test with real device photos during iOS spike; 1920px + 80% JPEG is conservative |

---

## New Files

| File | Role | Tests |
|------|------|-------|
| `recorder.js` | MediaRecorder + Web Speech API + photo capture + record UI | `recorder.test.js` |
| `recorder.test.js` | Tests for recorder.js | -- |

**Modified files:** `models.js`, `repositories.js`, `flashcards.js` (route), `library.js` (photo gallery + confusion button), `index.html` (record-view section), `analytics.test.js` (getCSSVar tests), DB migration code.

---

## Test Strategy

| Area | Estimated New Tests | Approach |
|------|-------------------|----------|
| DB migration v1 to v2 | 4 | Fixture v1 DB, verify upgrade preserves data + adds stores |
| RecordingSession + AudioData models | 5 | Factory validation, required fields, defaults |
| RecordingSession + AudioData repos | 8 | Standard CRUD pattern from existing storage tests |
| PhotoCapture model + repo | 6 | Factory validation + CRUD |
| recorder.js (MediaRecorder + Speech) | 10 | Fully mocked MediaRecorder and SpeechRecognition |
| recorder.js (UI + photo) | 4 | DOM rendering, button states, file input |
| Transcript stub service | 3 | Shape validation, duration-based segment count |
| ConfusionVote model + repo | 6 | Factory validation + CRUD + toggle |
| Confusion vote UI | 4 | Button toggle, persistence, ARIA |
| getCSSVar tests | 3 | Normal, empty, fallback |
| **Total new** | **~53** | **Target: 610+ total** |

---

## Decision Points

| When | Decision | Options |
|------|----------|---------|
| End of Day 0.5 | iOS photo + audio conflict? | NO conflict: enable everywhere. YES conflict: disable photo during recording on iOS, allow after stop |
| End of Day 2 | Is MediaRecorder mocking working in tests? | YES: continue. NO: simplify to file-upload-only audio mode |
| End of Day 4 | Is post-recording flow complete? | YES: proceed to Day 5. NO: cut confusion voting to Week 16 |
| End of Week 15 | Gate check: all completion criteria met? | YES: proceed to Week 16. NO: carry incomplete tasks into Week 16, adjust scope |

---

## Completion Criteria

- [ ] All Day 0 tech debt items resolved, 8 Dependabot PRs merged
- [ ] iOS spike documented with clear result and decision
- [ ] DB migration v1 to v2 working with 5 new stores (recordingSessions, audioData, photoCaptures, confusionVotes, autoNotes), existing data preserved
- [ ] Live capture: can record audio, see live transcript (Web Speech), stop, see lecture in library
- [ ] Photo capture: can take timestamped photos during recording, photos appear in lecture detail
- [ ] Confusion voting: can vote "confused" on segments, votes persist across refresh
- [ ] recorder.js follows AD-1 (L2, imports only from flashcards.js, never library/analytics)
- [ ] 35+ new tests added (target: 592+ total, stretch: 610+)
- [ ] All existing 557 tests still pass
- [ ] `ruff check` and `ruff format` clean (if Python files touched)
- [ ] HOSTILE_REVIEWER approves Week 15 gate
