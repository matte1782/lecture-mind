# v0.5.0 Plan Feasibility Hostile Review

**Reviewer:** HOSTILE_REVIEWER
**Date:** 2026-03-07
**Score: 44/100 — REJECT**
**Critical: 3 | Major: 8 | Minor: 4**

---

## Summary

The plans contain fundamental false assumptions about the current codebase state. The confusion
vote infrastructure (IDB store, model, repository, and tests) already exists at v1. Plans treat
it as new v2 work. This invalidates multiple hour estimates, test counts, and migration specs
across all five documents. Additionally, test count targets are arithmetically inconsistent across
ROADMAP vs. per-week plans. Several estimates are infeasible at the planned velocity.

---

## Critical Issues (90%+ confidence)

### C1. `confusionVotes` IDB Store, Model, Repository, and Tests Already Exist at v1

**Location:** `WEEK15_PLAN.md:W15.3.1, W15.3.2` | `ROADMAP_V050.md:§3 AD-11, §7` | `ARCHITECTURE_v050.md:§5, §8.4`

**Evidence:**
- `storage/db.js:74` — `confusionVotes` is defined in the v1 `STORES` constant (`DB_VERSION = 1`). Already in every user's database before any v2 migration.
- `storage/models.js:454–468` — `createConfusionVote()` factory and `validateConfusionVote()` already exist.
- `storage/repositories.js:836–893` — `ConfusionVoteRepository` already exists with `create`, `getById`, `delete`, `getByLecture`, `getBySegment`, `countBySegment`.
- `storage/models.test.js:550` — `ConfusionVote Entity` describe block already has model tests.
- `storage/repositories.test.js:691` — `ConfusionVoteRepository` describe block already has 4 repo tests.
- `storage/index.js:82` — `ConfusionVoteRepository` is already re-exported.

**Plan claims violated:**
- `WEEK15_PLAN.md:W15.3.2` — "New `confusionVotes` store added in v1 to v2 migration" — FALSE. The `createStores()` function at `db.js:229` skips existing stores: `if (db.objectStoreNames.contains(storeName)) continue`. The store is already there.
- `ROADMAP_V050.md:§3 AD-11` — "5 New IDB Stores" — WRONG. Only 4 are genuinely new: `recordingSessions`, `audioData`, `photoCaptures`, `autoNotes`.
- `ARCHITECTURE_v050.md:§5` Modified files — lists "Add factories: `createConfusionVote`" — already exists.
- Test count — "6 new ConfusionVote tests" in plan are mostly pre-existing.

**Field name mismatch:** `ARCHITECTURE_v050.md:§8.4` specifies `timestamp` field, no `comment`.
Existing `storage/models.js:461–468` uses `createdAt` (not `timestamp`) and includes `comment`.
W15.3.1 also specifies `timestamp`. Implementing per spec silently breaks the 4 existing tests.

**Suggested Fix:** Update `ARCHITECTURE_v050.md:§8.4` to match existing code (`createdAt`, `comment`).
Correct "5 new stores" to "4 new stores" everywhere. Remove confusionVotes model/repo work from W15.3.1.
The only genuine new work for W15.3 is: add `toggle()` method to the existing repo + UI vote button.

---

### C2. Test Count Triple-Inconsistency — Arithmetic Does Not Close Across Any Document Set

**Location:** `ROADMAP_V050.md:§4 W15 row, §7` | `WEEK15_PLAN.md` footer | `WEEK16/18/19_PLAN.md` criteria

| Source | W15 new tests | Final total |
|--------|--------------|-------------|
| ROADMAP §4, Week 15 row | ~35 | 592+ |
| WEEK15_PLAN test strategy footer | ~53 | 610+ |
| ROADMAP §7 table (summed) | 83 total | 640 |

- If W15 adds 53: 557+53+20+15+8 = 653 ≠ 640
- If W15 adds 35: 557+35+20+15+8 = 635 ≠ 640
- ROADMAP §7 sums to 83 → 557+83 = 640 (only self-consistent result)

Further: 6 "new" ConfusionVote tests are pre-existing (C1). Plan double-counts them.

**Suggested Fix:** Adopt ROADMAP §7 (83 new, 640 total) as single source of truth. Update all
per-week running totals from that baseline. Subtract pre-existing ConfusionVote tests from count.

---

### C3. `autoNotes` Store Has No Assigned Implementation Task — Week 18 Will Crash at Runtime

**Location:** `WEEK15_PLAN.md:W15.1.1 task body` vs. `completion criteria line 220` | `WEEK18_PLAN.md:architecture note`

**Evidence:**
- W15.1.1 task body: "DB Migration v1 to v2: add `recordingSessions`, `audioData`, `photoCaptures` stores" — 3 stores only.
- Completion criteria: "5 new stores (recordingSessions, audioData, photoCaptures, confusionVotes, autoNotes)" — confusionVotes is pre-existing; autoNotes is genuinely new but absent from the task body.
- `WEEK18_PLAN.md` architecture note: "autoNotes IDB store is created in the v1→v2 migration (Week 15)."
- `storage/db.js:109` — `validateStoreName()` throws `Invalid store name: "autoNotes"` if `autoNotes` is not in `STORES`. No task explicitly adds it.

Week 18's `AutoNoteRepository` will throw a runtime error on first write because the store is
never created. The completion criteria cannot be met by executing the assigned tasks.

**Suggested Fix:** Update W15.1.1 task body to include `autoNotes` as the 4th new store (not 5th —
`confusionVotes` is pre-existing). Correct completion criteria to "4 genuinely new stores."

---

## Major Issues (75%+ confidence)

### M1. recorder.js 8h Estimate Is Not Feasible for TDD at This Complexity

**Location:** `WEEK15_PLAN.md:Days 1-2 (W15.1.2–W15.1.5)`

Architecture estimates recorder.js at ~700 lines + 300 test lines. W15.1.4 alone (2h) requires
MediaRecorder state machine, codec negotiation, Web Speech API with `continuous: true` and
auto-restart, plus 10 unit tests written first. `MediaRecorder` and `SpeechRecognition` are not
available in jsdom and must be mocked from scratch (zero existing mock infrastructure for these
APIs). ROADMAP Risk (1) lists "MediaRecorder API mocking complexity" but allocates no contingency.

**Suggested Fix:** Split into 12h minimum — models+repos = 3h; MediaRecorder+Speech = 5h; UI+ARIA
= 4h. Push photo work entirely to Days 3-5. Or acknowledge this as the most likely W17 overflow
trigger and size the contingency accordingly.

---

### M2. SVG Heatmap (W16.1.2) Is 3h for the First SVG Visualization in This Codebase

**Location:** `WEEK16_PLAN.md:W16.1.2`; Risk R1

No hand-written SVG exists in the codebase — analytics.js uses Chart.js. Risk R1 mitigation says
"Reuse analytics.js SVG patterns" — **there are no hand-written SVG patterns to reuse**. This
mitigation is false. WCAG 2.1 accessible SVG requires `role="img"`, `<title>`, `<desc>`,
per-segment `aria-label` attributes, and keyboard focus management — none of which has codebase
precedent. A responsive, accessible SVG heatmap from scratch is a 6-8h task.

**Suggested Fix:** Allocate 6h for W16.1.2, or explicitly adopt HTML/CSS bar chart fallback.
Correct Risk R1 mitigation: "fallback is HTML table, not SVG pattern reuse."

---

### M3. TextRank Library Evaluation Has No Fallback If No Viable Library Found

**Location:** `WEEK18_PLAN.md:W18.1.1` | `WEEK17_PLAN.md:W17.6`

`text-summarizer` on npm has negligible recent downloads and no maintained ESM build. `sum.js` is
not a recognized npm package for TextRank. If evaluation consumes 1.5h and no suitable library is
found, extractive pipeline must be hand-rolled TF-IDF (4-6h), blocking all of Days 1-2. W17.6
TextRank spike is "on schedule" contingency — any W15-16 overflow skips it, leaving Week 18 cold.

**Suggested Fix:** Make W17.6 mandatory, not contingency. Add a decision gate between W18.1.1 and
W18.1.2: "If no viable library in 1h → hand-rolled TF-IDF, add 4h." Verify candidates are real
installable ESM packages before Week 18 begins.

---

### M4. SW `STATIC_ASSETS` Missing `notes-engine.js` and `llm-client.js`; No Cache Name Bump Task

**Location:** `ARCHITECTURE_v050.md:§5 (sw.js row)` | `WEEK19_PLAN.md:W19.4.3`

`notes-engine.js` and `llm-client.js` not in sw.js change spec. Additionally, `sw.js:12`
`CACHE_NAME = 'lm-v0.4.0'` must be bumped to `lm-v0.5.0` — without this, the activate handler
does not delete the v0.4.0 cache and users receive stale assets indefinitely. No task mentions
the cache name bump. W19.4.3 allocates 0.25h for all SW updates (insufficient).

**Suggested Fix:** Update §5 to list all 4 new files. Add explicit acceptance criterion to
W19.4.3: "`CACHE_NAME` updated to `lm-v0.5.0`." Expand W19.4.3 to 1h.

---

### M5. Hostile Review Fix Budget (W19.3.2) Is 2h for Unknown Critical Issues

**Location:** `WEEK19_PLAN.md:W19.3.1, W19.3.2`

W19.3.2 allocates 2h to fix all critical/major issues found by the hostile review. A structural
flaw in `recorder.js` alone could require 4-8h. Risk R1 rates "hostile review returns BLOCK" as
LOW likelihood — overconfident given that 3 critical issues were found in the plan before any
code was written. v0.4.0 required multiple review rounds to reach 91/100.

**Suggested Fix:** Move review to Day 3, give Days 4-5 for fixes + re-review (6h total). Timebox
re-scope: "If score < 70 after Day 5 → cut Auto-Notes to v0.5.1, extend to Week 20."

---

### M6. Audio Storage Strategy Is Described Three Incompatible Ways Across Documents

**Location:** `ARCHITECTURE_v050.md:§8.2` | `WEEK15_PLAN.md:W15.1.4` | `ROADMAP_V050.md:§2`

- Architecture §8.2: "single Blob per session" (blob: Blob singular)
- WEEK15_PLAN W15.1.4 acceptance: "chunked audio accumulation in memory"
- ROADMAP §2: "chunked to IndexedDB every 5 seconds"

Memory accumulation = total audio loss on iOS tab kill. IDB chunks = recoverable (lose last 5s).
These have different failure modes for the #1 mobile risk. Both architecture and roadmap are
marked APPROVED. This survived the prior consistency review.

**Suggested Fix:** Commit to chunks-to-IDB every 5s (crash-resilient). Update ARCHITECTURE §8.2
`audioData` schema to include `chunkIndex` field, multiple records per session. Delete
contradicting statements in ROADMAP §2 and WEEK15 W15.1.4.

---

### M7. `ConfusionVoteRepository.toggle()` Required But Does Not Exist; No Mutex Spec

**Location:** `WEEK15_PLAN.md:W15.3.2` | `storage/repositories.js:836–893`

W15.3.2 requires `toggle()` method. Existing `ConfusionVoteRepository` has no `toggle`. Toggle
is a read-modify-write operation (check existence → create or delete). CLAUDE.md anti-patterns
explicitly require a per-key mutex for any IDB read-modify-write. W15.3.2 does not mention it.

**Suggested Fix:** Update W15.3.2 spec: "Add `toggle(segmentId, lectureId)` to existing
`ConfusionVoteRepository`. Method must use per-key mutex (see CLAUDE.md anti-patterns). 2 new
tests (toggle-create, toggle-delete)." Reduce planned new tests from 6 to 2 for this task.

---

### M8. ROADMAP §10 Calendar Describes Wrong Features for Weeks 16 and 17

**Location:** `ROADMAP_V050.md:§10`

- §10 Week 16: "Photo Capture + Confusion Voting + Transcript Stub" — these are all in WEEK15.
  Actual WEEK16 scope: Confusion Heatmap, Privacy Toast, Storage Quota UI, Accessibility Audit.
- §10 Week 17: "Confusion Heatmap + Privacy + Storage Quota UI" — these are in WEEK16.
  Actual WEEK17: CONTINGENCY only.

This survived the prior consistency review (85/100 final score).

**Suggested Fix:** Update ROADMAP §10 — Week 16: "Confusion Heatmap + Privacy + Storage Quota
UI + A11y Audit"; Week 17: "CONTINGENCY (overflow from W15-16 or early prep spikes)."

---

## Minor Issues (60%+ confidence)

### m1. `createConfusionVote` Field Mismatch: `timestamp` in spec vs. `createdAt` in code

**Location:** `ARCHITECTURE_v050.md:§8.4` | `storage/models.js:461–468`

Spec: `{ id, segmentId, lectureId, timestamp }`. Code: `{ id, lectureId, segmentId, comment, createdAt }`.
Implementing to spec breaks 4 existing repo tests. **Suggested Fix:** Update §8.4 to show
`createdAt` and optional `comment`, matching production code. Documentation-only fix.

---

### m2. `llm-client.js` Fetch Mock Strategy Not Specified for Tests

**Location:** `WEEK18_PLAN.md:W18.2.2`

6 tests planned with "mock API responses" but no spec for how `fetch` is mocked. jsdom's `fetch`
is limited; Jest has no built-in global `fetch` mock. **Suggested Fix:** Add "mock global `fetch`
via `jest.spyOn(global, 'fetch')`" to W18.2.2 test approach. Add to L0 classification in §3.

---

### m3. WEEK18 Prerequisites Require "617+ tests" — Traceable to No Document

**Location:** `WEEK18_PLAN.md:Prerequisites`

617+ traces to an intermediate draft number. No consistent arithmetic produces 617.
**Suggested Fix:** After resolving C2, recalculate all per-week prerequisite counts from the
corrected ROADMAP §7 baseline (640 total, 83 new).

---

### m4. W19.4.3 SW Update Allocates 0.25h — Insufficient With Cache Name Bump Required

**Location:** `WEEK19_PLAN.md:W19.4.3`

4 new JS/CSS files + cache name bump in 15 minutes. **Suggested Fix:** Expand to 1h. Add
explicit acceptance criterion: "`CACHE_NAME` updated to `lm-v0.5.0`."

---

## Verdict

| Severity | Count |
|----------|-------|
| Critical | 3 |
| Major | 8 |
| Minor | 4 |

**Minimum fixes before implementation begins:**
- [C1] Verify confusionVotes in codebase. Update spec field names to match code. Remove duplicate work. Fix store count to 4 new everywhere.
- [C2] Adopt ROADMAP §7 (640 total, 83 new) as single test count source. Recalculate all per-week targets.
- [C3] Add `autoNotes` to W15.1.1 task body explicitly.
- [M6] Pick ONE audio strategy. Recommend: IDB chunks every 5s. Update all three documents.
- [M8] Fix ROADMAP §10 calendar to match actual week plan contents.

---

*HOSTILE_REVIEWER — Trust nothing. Verify everything.*
