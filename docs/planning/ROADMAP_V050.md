# v0.5.0 Professor Edition — Implementation Plan

**Version:** 1.0.0
**Author:** PLANNER
**Status:** DRAFT
**Duration:** 2 weeks (+ 1 contingency)
**Budget:** 44h core + 16h contingency = 60h max

---

## Executive Summary

- **Goal:** Add Live Lecture Mode (audio capture), confusion analytics, and a professor dashboard to transform Lecture Mind from a student-only tool into a two-sided learning platform.
- **Critical Path:** Live Capture storage layer -> Audio capture UI -> Confusion voting -> Confusion heatmap -> Professor dashboard -> Export -> Release
- **Major Risks:** (1) MediaRecorder API mocking complexity in tests, (2) IndexedDB migration v3 data safety, (3) Scope creep on professor dashboard

---

## 1. Priority Stack

### P0 — Must Ship (cuts here mean no release)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Live Lecture Mode** | Record audio in browser, store chunks in IndexedDB, create lecture entry with mock transcript, auto-generate flashcards | 16h |
| **Confusion Voting** | Per-segment vote button, votes persist in IndexedDB | 4h |

### P1 — Should Ship (release is weaker without these)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Confusion Heatmap** | SVG color-coded bar chart on lecture detail "Confusion" tab | 8h |
| **Professor Dashboard** | Route with lecture selector, 3 metric cards, heatmap, most-replayed list | 8h |

### P2 — Nice to Have (cut first if behind schedule)

| Feature | MVP Definition | Hours |
|---------|---------------|-------|
| **Export Reports** | JSON/CSV download from professor dashboard | 2h |
| **Quiz Aggregate View** | Accuracy + mastery charts on professor dashboard | 2h |
| **Tech Debt Cleanup** | getCSSVar tests, renderConfetti, LICENSE, dead code | 2h |
| **Dependabot PRs** | Merge 4 pending security updates | 0.5h |

---

## 2. Feature MVPs (Smallest Useful Version)

### Live Lecture Mode MVP

What it IS:
- Press "Record" button on mobile browser
- Audio captured via MediaRecorder API, chunked to IndexedDB every 5 seconds
- Works offline (chunks stored locally)
- Press "Stop" -> transcript stub creates a mock transcript
- Lecture entry + segments created in library automatically
- Flashcards auto-generated from transcript segments

What it is NOT:
- No real Whisper transcription (stub service with mock data)
- No streaming transcription during recording
- No waveform visualization
- No cloud upload of audio
- No video capture (audio only)

### Confusion Voting MVP

What it IS:
- "I'm confused" button on each segment card in lecture detail view
- Click toggles vote, persists to IndexedDB
- Anonymous (no user identity)
- Vote count visible on segment

What it is NOT:
- No real-time aggregation across users
- No time-weighted confusion decay
- No teacher notification

### Professor Dashboard MVP

What it IS:
- Route `#/professor` accessible from navigation
- Lecture dropdown selector
- 3 metric cards: total confusion votes, hotspot count, average quiz accuracy
- Confusion heatmap (reused SVG component)
- Most-replayed segments list (top 5)
- JSON/CSV export button

What it is NOT:
- No multi-user data (simulated from local IndexedDB)
- No login/auth
- No real-time updates
- No PDF reports
- No course-level aggregation (lecture-level only)

---

## 3. Architecture Decisions

### AD-9: Live Capture Module Position

```
dom-utils.js <- flashcards.js <- analytics.js <- library.js
                    ^
                    |
              live-capture.js (new, imports from flashcards for router)
              confusion.js (new, imports from flashcards + dom-utils)
              professor.js (new, imports from analytics + confusion + dom-utils)
```

`live-capture.js`, `confusion.js`, and `professor.js` are leaf modules. They import from the existing chain but nothing imports from them (except `index.html` script tags). This preserves AD-1.

### AD-10: Confusion Data Model

Confusion votes stored via `ConfusionRepository` (new) backed by a new `confusion-votes` object store in IndexedDB. Migration v3 adds this store. Votes are anonymous: no user ID, just segmentId + timestamp.

### AD-11: Recording Storage

Audio chunks stored as Blobs in a new `recording-chunks` object store. Recordings are ephemeral: once transcribed, chunks can be deleted. Separate from lecture data to avoid bloating lecture queries.

### AD-12: Stub Transcription

`transcript-service.js` exports `transcribe(audioBlob)` returning `Promise<TranscriptResult>`. v0.5.0 ships with a stub that generates mock segments from audio duration. v1.0.0 replaces stub with real Whisper API call. Interface stays the same.

---

## 4. Week-by-Week Breakdown

### Week 15 (March 9-15): Live Capture + Confusion Voting

**Focus:** Build the recording pipeline and confusion voting data layer
**Hours:** 22h
**Gate:** Can record audio, stop, see lecture in library. Can vote on segments.

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Day 0 | Housekeeping: Dependabot, LICENSE, tech debt | 2 | 4 PRs merged, LICENSE added, getCSSVar tested |
| Days 1-2 | Live capture: data model, repository, MediaRecorder wrapper, UI | 8 | live-capture.js, RecordingRepository, record-view |
| Days 3-4 | Transcript integration: stub service, post-recording flow, route | 8 | transcript-service.js, lecture creation flow, #/record route |
| Day 5 | Confusion voting: data model, repository, vote button | 4 | ConfusionRepository, vote UI on segment cards |

**New tests:** 30+ (target 590+ total)
**New files:** live-capture.js, live-capture.test.js, transcript-service.js, confusion.js, confusion.test.js

See `docs/planning/WEEK15_PLAN.md` for full task breakdown.

### Week 16 (March 16-22): Heatmap + Dashboard + Release

**Focus:** Visualization, professor dashboard, release
**Hours:** 22h
**Gate:** Professor can view confusion hotspots. v0.5.0 tagged and released.

| Day | Focus | Hours | Deliverables |
|-----|-------|-------|-------------|
| Days 1-2 | Confusion heatmap: aggregation, SVG component, lecture detail tab | 8 | Heatmap in lecture detail, confusion stats |
| Days 3-4 | Professor dashboard: route, layout, metrics, lists | 8 | professor.js, #/professor route, dashboard UI |
| Day 5 | Export, accessibility audit, release prep | 6 | JSON/CSV export, CHANGELOG, tag v0.5.0 |

**New tests:** 25+ (target 615+ total)
**New files:** professor.js, professor.test.js

See `docs/planning/WEEK16_PLAN.md` for full task breakdown.

### Week 17 (March 23-29): CONTINGENCY

**Activation:** Only if Weeks 15-16 overflow or hostile review returns BLOCK.
**Hours:** Up to 16h
**Alternative use:** Early v1.0.0 spikes (Whisper integration design, Y-decoder architecture)

See `docs/planning/WEEK17_PLAN.md` for details.

---

## 5. Cut Line

If behind schedule, cut in this order (bottom first):

| Priority | Feature | Cut Impact |
|----------|---------|------------|
| CUT LAST | Live Lecture Mode (P0) | No release without this |
| CUT LAST | Confusion Voting (P0) | No release without this |
| CUT 4th | Confusion Heatmap (P1) | Dashboard has no visualization — still releasable |
| CUT 3rd | Professor Dashboard (P1) | Confusion data exists but no professor view — defer to v0.5.1 |
| CUT 2nd | Export Reports (P2) | Professors can't export — minor, data visible in UI |
| CUT 1st | Quiz Aggregate (P2) | Dashboard slightly less useful — acceptable |

**Minimum viable release:** Live Lecture Mode + Confusion Voting + Heatmap on lecture detail. This ships without a dedicated professor dashboard but still delivers value.

---

## 6. Decision Points

| When | Decision | Options |
|------|----------|---------|
| End of Week 15 Day 2 | Is MediaRecorder mocking working? | YES: continue. NO: simplify to file-upload-only mode |
| End of Week 15 | Gate check: Live capture + voting done? | YES: proceed to Week 16. NO: extend live capture into Week 16 Day 1, cut export |
| End of Week 16 Day 2 | Is heatmap SVG working? | YES: build dashboard. NO: use simple table instead of SVG |
| End of Week 16 Day 4 | Quality gate: all features working? | YES: release. NO: activate Week 17 |
| End of Week 16 | Hostile review score | >= 85: release. < 85: fix in Week 17. < 70: re-scope |

---

## 7. Updated Calendar View

```
March 2026
  Week 14 (Mar 2-8):   v0.4.0 RELEASED (557 tests)
  Week 15 (Mar 9-15):  v0.5.0 - Live Capture + Confusion Voting
  Week 16 (Mar 16-22): v0.5.0 - Heatmap + Professor Dashboard + Release
  Week 17 (Mar 23-29): CONTINGENCY (overflow or v1.0.0 prep)

April 2026
  Weeks 18-21: v1.0.0 - Production (real Whisper, Y-decoder, security audit)
```

---

## 8. Dependency Map

```
Week 15:
  W15.0 (tech debt) -----> no dependencies
  W15.1 (live capture) --> W15.0 (clean codebase)
  W15.2 (transcript) ----> W15.1 (audio chunks exist)
  W15.3 (confusion) -----> W15.0 (clean codebase, parallel with W15.1)

Week 16:
  W16.1 (heatmap) -------> W15.3 (confusion data exists)
  W16.2 (dashboard) ------> W16.1 (heatmap component reusable)
  W16.3 (export+release) -> W16.2 (dashboard has data to export)
```

---

## 9. Test Strategy

| Module | Estimated New Tests | Approach |
|--------|-------------------|----------|
| RecordingRepository | 8 | Standard repo CRUD pattern from storage/ |
| live-capture.js | 12 | Mock MediaRecorder, test state machine |
| transcript-service.js | 4 | Test stub returns correct shape |
| ConfusionRepository | 6 | Standard repo CRUD pattern |
| confusion.js (vote UI) | 6 | DOM rendering + click handler tests |
| Heatmap component | 8 | SVG structure assertions |
| professor.js | 10 | Dashboard rendering + data flow |
| Export | 4 | File content assertions |
| **Total new** | **~58** | Target: 615+ total |

---

## 10. Tech Debt Resolution

| Item | When | Action |
|------|------|--------|
| `getCSSVar` zero test coverage | Week 15 Day 0 | Add 3 tests in analytics.test.js |
| `renderConfetti` exported with zero tests | Week 15 Day 0 | Add tests or remove export |
| Legacy `renderLibraryView` fallback | Week 15 Day 0 | Remove dead code path |
| Missing LICENSE file | Week 15 Day 0 | Add MIT LICENSE to project root |
| Dependabot alerts (3 high, 1 low) | Week 15 Day 0 | Triage and merge PRs |

---

## PLANNER: Plan Complete

Artifacts:
- docs/planning/ROADMAP_V050.md (this file)
- docs/planning/WEEK15_PLAN.md
- docs/planning/WEEK16_PLAN.md
- docs/planning/WEEK17_PLAN.md

Status: PENDING_HOSTILE_REVIEW

Next: Review this plan, approve or request changes, then begin Week 15 Day 0.
