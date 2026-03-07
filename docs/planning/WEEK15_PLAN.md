# Week 15 Task Plan

**Date Range:** 2026-03-09 to 2026-03-15
**Goal:** Live Lecture Mode (audio capture + transcript storage) and Confusion Voting infrastructure
**Status:** DRAFT

---

## Prerequisites

- [x] v0.4.0 released (557 tests, 10 suites)
- [x] Architecture approved (AD-1 dependency chain stable)
- [ ] Dependabot alerts triaged (Day 0 task)
- [ ] Tech debt items from v0.4.0 hostile review resolved (Day 0 task)

---

## Day 0: Housekeeping (2h)

| ID | Task | Hours | Acceptance |
|----|------|-------|------------|
| W15.0.1 | Triage and merge Dependabot PRs (3 high, 1 low) | 0.5 | `gh pr list` shows 0 open Dependabot PRs |
| W15.0.2 | Add LICENSE file (MIT) to project root | 0.25 | `cat LICENSE` shows valid MIT license |
| W15.0.3 | Add tests for `getCSSVar` in analytics.test.js | 0.5 | 3+ tests covering normal, empty, and error cases |
| W15.0.4 | Remove or test `renderConfetti` export | 0.25 | Either tests exist or export removed |
| W15.0.5 | Remove legacy `renderLibraryView` fallback in flashcards.js | 0.5 | Dead code removed, all 557+ tests still pass |

---

## Days 1-2: Live Lecture Mode — Audio Capture (8h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W15.1.1 | Data model: `RecordingSession` in models.js | 2 | Fields: id, lectureId, status, startedAt, chunks[], duration | `RecordingRepository` CRUD tests pass (8+ tests) |
| W15.1.2 | `RecordingRepository` in repositories.js | 2 | put/get/getAll/delete + migration v3 | All repo tests pass, migration upgrades cleanly |
| W15.1.3 | `live-capture.js` — MediaRecorder wrapper | 2 | start/stop/pause, chunked storage to IndexedDB, error handling | 10+ unit tests with mocked MediaRecorder |
| W15.1.4 | Live capture UI — record button + status | 2 | Mobile-first record button, timer, chunk indicator, ARIA labels | UI renders, button states toggle, keyboard accessible |

---

## Days 3-4: Live Lecture Mode — Transcript Integration (8h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W15.2.1 | Transcript stub service (`transcript-service.js`) | 2 | Interface: `transcribe(audioBlob) -> Promise<{text, segments[]}>`, local stub returns mock | Tests pass with mock, real Whisper integration deferred |
| W15.2.2 | Post-recording flow: audio -> transcript -> lecture | 3 | Chain: stop recording -> call transcribe -> create Lecture + Segments in IndexedDB | Integration test: record -> stop -> lecture appears in library |
| W15.2.3 | Auto-generate flashcards from transcript | 1 | Reuse existing auto-generation from flashcards.js | Flashcards created for new lecture, count > 0 |
| W15.2.4 | Route `#/record` + record-view section | 2 | New route in flashcards.js router, new `<section id="record-view">` in index.html | Navigation works, view renders, back button returns to library |

---

## Day 5: Confusion Voting Infrastructure (4h)

| ID | Task | Hours | Spec | Acceptance |
|----|------|-------|------|------------|
| W15.3.1 | Data model: `ConfusionVote` in models.js | 1 | Fields: id, segmentId, lectureId, timestamp, anonymous | Model validation tests pass |
| W15.3.2 | `ConfusionRepository` in repositories.js | 1.5 | put/getByLecture/getBySegment/getAggregates + migration | Repo CRUD tests pass (6+ tests) |
| W15.3.3 | Confusion vote button on segment cards | 1.5 | Thumbs-down icon on each segment, toggles vote, persists | Click toggles, refresh preserves state, ARIA label present |

---

## Estimated Total: 22h (with 2x buffer on new features)

---

## Blocked Tasks

| ID | Task | Blocked By | Unblock Condition |
|----|------|------------|-------------------|
| W15.B1 | Real Whisper transcription | Backend API endpoint | Deferred: stub is sufficient for v0.5.0 |

---

## Not In Scope

| Task | Why Deferred |
|------|--------------|
| Real Whisper backend integration | v1.0.0 — requires server-side GPU |
| Multi-user aggregation | v1.0.0 — requires user auth |
| Professor dashboard UI | Week 16 |
| Confusion heatmap visualization | Week 16 |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | MediaRecorder API not available in jsdom tests | MEDIUM | HIGH | Mock MediaRecorder entirely in tests |
| R2 | IndexedDB migration v3 breaks existing data | HIGH | LOW | Write migration test with v2 fixture data |
| R3 | Audio chunk storage bloats IndexedDB | MEDIUM | MEDIUM | Limit chunk size to 5s, compress before store |
| R4 | Live capture scope creep (waveform viz, etc.) | LOW | HIGH | MVP: record button + timer only |

---

## Completion Criteria

- [ ] All Day 0 tech debt items resolved
- [ ] Live capture: can record audio, stop, see lecture in library
- [ ] Confusion voting: can vote on segments, votes persist
- [ ] 30+ new tests added (target: 590+ total)
- [ ] All existing 557 tests still pass
- [ ] `ruff check` and `ruff format` clean (if Python touched)
- [ ] HOSTILE_REVIEWER approves Week 15 gate
