# Lecture Mind — Product Roadmap v5.0

> **Last Updated**: 2026-03-10
> **Current Version**: v0.4.0 (RELEASED 2026-03-05), v0.5.0 IN PROGRESS (W16 Day 2)
> **Status**: v0.5.0 W16 Day 2 complete — 693 tests, 11 suites
> **Docs Site**: https://matte1782.github.io/lecture-mind/
> **Cloud Demo**: https://lecture-mind.onrender.com
> **Architecture**: FastAPI + Premium Vanilla JS (Cloud Demo + Local Full + Desktop via Electron)

---

## Executive Summary

| Version | Theme | Hours | Calendar | Status |
|---------|-------|-------|----------|--------|
| v0.1.0 | Foundation | - | DONE | Released |
| Gate 0 | Technical Validation | 12h | Week 1 | Complete |
| v0.2.0 | Real Models + Audio | 80h | Weeks 2-5 | Released |
| v0.3.0 | Cloud Demo + Security | 60h | Weeks 6-9 | Released |
| v0.4.0 | Student Playground | 100h | Weeks 10-14 | **RELEASED** (2026-03-05) |
| **v0.5.0** | **Live Capture** | **68h** | **Weeks 15-19** | **IN PROGRESS** (W16 Day 2) |
| v0.6.0 | Vision + Electron Shell | 62h | Weeks 20-23 | Planned |
| v0.7.0 | Community | 56h | Weeks 24-29 | Planned |
| v0.8.0 | Desktop Full | 54h | Weeks 30-34 | Planned |
| v1.0.0 | Production | 80h | Weeks 35-38 | Planned |

**Assumptions:**
- Work velocity: ~20 hours/week (5h/session, ~4 sessions/week)
- Single developer + AI agents for specialized tasks
- Part-time project

---

## v0.3.0 — Cloud Demo + Security Hardening RELEASED

**Theme**: Stable cloud demo + fix all security issues
**Effort**: 60 hours (completed)
**Status**: RELEASED (2026-01-09)

### Goals with Acceptance Criteria

| ID | Goal | PASS Criteria | FAIL Criteria | Status |
|----|------|---------------|---------------|--------|
| G1 | Web UI | Upload video, see events, execute query | Crashes, no output | Complete |
| G2 | Progress indication | Progress bar updates during processing | Freezes | Complete |
| G3 | Export functionality | Download as Markdown/JSON/SRT/StudyNotes | No export | Complete |
| G4 | Docker image | `docker run` works, <3GB | Build fails | Complete |
| G5 | Cloud demo | Render deployment works in demo mode | OOM crash | Complete |
| G6 | Security C1-C4 | All critical security issues fixed | Vulnerabilities remain | Complete (12 issues fixed) |
| G7 | Test coverage 80%+ | pytest --cov >=80% | Below 80% | 74% (accepted for v0.3.0) |

### Security Issues (Hostile Review Findings) — ALL FIXED

| ID | Issue | Severity | Status | Fix Location |
|----|-------|----------|--------|--------------|
| C1 | CORS wildcard + credentials | CRITICAL | Fixed | main.py:216-222 |
| C2 | No server-side file size limit | CRITICAL | Fixed | main.py:325-336 |
| C3 | No rate limiting | CRITICAL | Fixed | main.py:96-132 |
| C4 | innerHTML usage (XSS risk) | CRITICAL | Fixed | app.js (safe DOM methods) |
| C5 | Path traversal attack | CRITICAL | Fixed | main.py:318-321 |
| C6 | Rate limit bypass (no client IP) | CRITICAL | Fixed | main.py:286-293 |

See `docs/reviews/REVIEW_hostile_final.md` for full verification.

### Quality Gates ALL PASSED

```
v0.3.0 RELEASE GATE — PASSED
  All security issues fixed (12 total, verified)
  Hostile reviewer APPROVED
  Cloud demo stable (no OOM, demo mode working)
  Local setup documented
  MkDocs site deployed (GitHub Pages live)
  API documentation complete
  Test coverage 74% (369 passed, 0 failed)
  CI green
  v0.3.0 tag + GitHub release created
```

---

## v0.4.0 — Student Playground (RELEASED 2026-03-04)

**Theme**: Local-first learning platform for students
**Effort**: 100 hours (5 weeks @ 20h/week)
**Prerequisites**: v0.3.0 complete, security hardened
**Target Users**: Students, Teaching Assistants
**Status**: RELEASED (2026-03-05) — 557 tests, 10 suites, hostile review 91/100

### Vision

> **"Not just a tool for viewing lectures, but a complete learning companion."**

The Student Playground transforms Lecture Mind from a simple video summarizer into a comprehensive study platform.

### Goals with Acceptance Criteria

| ID | Goal | PASS Criteria | FAIL Criteria | Status |
|----|------|---------------|---------------|--------|
| SP1 | Flashcard System | Auto-generate from transcript, spaced repetition | Manual creation only | DONE (Week 11) |
| SP2 | Multi-Lecture Library | Import, organize, search across lectures | Single video only | DONE (Week 12) |
| SP3 | Progress Tracking | Track watched segments, study time, quiz scores | No persistence | Partial (basic in library.js) |
| SP5 | Smooth UI | 60fps transitions, loading states, keyboard nav | Janky, slow | Partial (CSS transitions, keyboard shortcuts) |
| SP6 | Offline Storage | Full functionality with IndexedDB, basic caching | Requires constant connection | Partial (IndexedDB done, no SW) |

**Deferred to v0.5.0:** SP4 (Confusion Analytics), SP7 (Professor Dashboard) — require backend ML + classroom data

### What's Built (Weeks 10-12)

#### Week 10: Foundation + Architecture (COMPLETE)
```
Built:
  IndexedDB storage layer (db.js, migrations.js, models.js, repositories.js, sync.js)
  Design system (CSS variables, tokens, playground-components.css)
  Multi-lecture data model with full CRUD
  292 storage tests
```

#### Week 11: Flashcard System — SP1 (COMPLETE)
```
Built:
  Auto-generation from transcript key concepts
  Manual card creation
  Spaced repetition (SM-2 algorithm)
  Card UI with 3D flip animation
  Study session flow + router
  91 flashcard tests
```

#### Week 12: Multi-Lecture Library — SP2 (COMPLETE)
```
Built:
  Course CRUD + sidebar navigation
  Library toolbar with sorting (date, title, duration)
  Import pipeline from processing results
  Batch organization (assign to course, batch delete)
  Context menus
  Cross-lecture search with scoring + highlighting
  Lecture detail view with tabs (segments, flashcards, bookmarks, info)
  Progress tracking per lecture (updateLectureProgress, getLectureStats)
  Favorites (toggle, filter, persist via SettingsRepository)
  Playlist navigation + minimap
  Pagination + keyboard shortcuts + empty states
  98 library tests (483 total across 8 suites)
```

### Weeks 13-14: Analytics + Polish + Release (COMPLETE)

#### Week 13: Study Analytics + Progress — SP3 (COMPLETE)
```
Built:
  analytics.js (1240 lines) — Study analytics module
  Study dashboard with streak tracking, weekly charts, top lectures
  Per-lecture analytics (accuracy trends, mastery distribution)
  getCSSVar helper for CSS custom property integration
  registerAnalyticsHooks() auto-registration on module load
  18 analytics tests (557 total across 10 suites)
```

#### Week 14: Polish + Offline + Release — SP5, SP6 (COMPLETE)
```
Built:
  sw.js + sw-utils.js — Service Worker (cache-first static assets, origin check)
  Loading skeletons in dom-utils.js
  Animation polish (transitions, micro-interactions, prefers-reduced-motion)
  focus-visible on all interactive elements
  registerViewCleanup pattern for cross-module cleanup
  P0 bug fixes: sidebar filter cascade, flashcard edit/delete wiring, bookmark delete
  Hostile review: 91/100 SHIP (docs/reviews/REVIEW_v040_final_gate.md)
  README rewrite with 4 screenshots
  Tagged v0.4.0, pushed, GitHub release created
```

**Quality Gate:** FINAL — hostile review 91/100 APPROVED, 557 tests passing, docs updated, GH Pages deployed

### Final Deliverables

```
v0.4.0/
  src/vl_jepa/api/static/
    app.js              (~3500 lines) — Main app, processing UI, video player
    dom-utils.js        (~280 lines)  — Shared DOM utilities + skeletons
    flashcards.js       (~1530 lines) — Flashcard system + router + view cleanup
    library.js          (~2260 lines) — Multi-lecture library
    analytics.js        (~1240 lines) — Study analytics + dashboard
    sw.js               (~100 lines)  — Service Worker (cache-first)
    sw-utils.js         (~80 lines)   — Testable SW registration helpers
    playground-components.css          — Design system
    app-components.css                 — Additional component styles
    library.test.js     — 112 library tests
    flashcards.test.js  — 135 flashcard tests
    analytics.test.js   — 18 analytics tests
    sw-utils.test.js    — 10 SW tests
    storage/
      db.js, models.js, repositories.js, migrations.js, sync.js, index.js
      + test files (292 storage tests)
```

**Total: 10 test suites, 557 tests, 0 failures**

### Quality Gates (Per Week)

```
Week 10 Gate: Architecture approved by hostile-reviewer      PASSED
Week 11 Gate: Flashcard system functional, animations smooth PASSED (91 tests)
Week 12 Gate: Library manages 10+ lectures without slowdown  PASSED (483 tests, 6 hostile reviews)
Week 13 Gate: Analytics accurate, data persists             PASSED (545 tests)
Week 14 Gate: FINAL — hostile review 91/100 SHIP            PASSED (557 tests)
```

---

## v0.5.0 — Live Capture (IN PROGRESS)

**Theme**: Transform from review-only to full capture-study-review tool
**Effort**: 68 hours (5 weeks @ ~14h/week)
**Prerequisites**: v0.4.0 complete
**Target Users**: Students (mobile + desktop)
**Status**: W16 Day 2 complete — 693 tests

### Goals

| ID | Goal | PASS Criteria | Status |
|----|------|---------------|--------|
| LC1 | Live Audio Capture | MediaRecorder + Web Speech API, store in IDB | DONE (W15) |
| LC2 | Photo Capture | Timestamped photos, canvas resize, IDB storage | DONE (W15) |
| LC3 | Confusion Markers | Personal confusion voting + heatmap per lecture | DONE (W15-16) |
| LC4 | DB Migration v1-v2 | 4 new IDB stores, storage quota UI | DONE (W15-16) |
| LC5 | Privacy + Controls | Privacy banner, speech toggle, photo disclaimer | DONE (W16) |
| LC6 | Auto-Notes Framework | Extractive (TextRank/TF-IDF) + Claude API LLM | W18 |
| LC7 | Polish + Release | Accessibility audit, W19 deferred fixes, hostile review | W16/W19 |

### Week-by-Week Progress

| Week | Focus | Tests | Status |
|------|-------|-------|--------|
| W15 Day 0 | Tech debt + dependabot + DB migration v1-v2 | 607 | DONE |
| W15 Days 1-4 | Audio capture + photo capture + post-recording flow | 640 | DONE |
| W15 Day 5 | SP4-lite confusion voting on segment cards | 648 | DONE |
| W15 Day 6 | File size fix + gamification design + W16 plan | 652 | DONE |
| W16 Day 0 | 6 UX bug fixes + dark mode + backend guard | 658 | DONE |
| W16 Day 1 | Confusion heatmap + tab integration + summary stats | 684 | DONE |
| W16 Day 2 | Privacy banner + speech toggle + storage quota + photo disclaimer | 693 | DONE |
| W16 Day 5 | Accessibility audit | ~695 | Next |
| W17 | iOS spike + buffer | — | Planned |
| W18 | Auto-Notes framework (extractive + LLM) | ~715 | Planned |
| W19 | Polish + deferred fixes + hostile review + release | ~720 | Planned |

### Remaining (~29h)

| Block | Hours |
|-------|-------|
| W16 Day 5: Accessibility audit | 2h |
| W17: iOS spike + buffer | 5h |
| W18: Auto-Notes (extractive + LLM API) | 12h |
| W19: Polish + deferred fixes + release | 10h |

---

## v0.6.0 — Vision + Electron Shell (PLANNED)

**Theme**: OCR on captured photos + thin Electron desktop wrapper
**Effort**: ~62 hours (4 weeks)
**Prerequisites**: v0.5.0 released
**Target Users**: Students (desktop + mobile)

### Goals

| ID | Goal | PASS Criteria |
|----|------|---------------|
| V1 | Tesseract.js OCR | Zero-tap OCR on every captured photo, Web Worker, <5s mobile |
| V2 | OCR Search | Photos searchable by slide text content |
| V3 | Auto-Notes v2 | Multi-source: transcript + slide texts combined |
| V4 | Claude Vision | "Enhance with AI" for handwriting/diagrams |
| V5 | Manual Notes Import | Photo -> OCR -> Notes tab |
| V6 | Electron Shell | Thin wrapper: exe/dmg/AppImage, loads existing web app |

### Week-by-Week Plan

| Week | Focus | Hours |
|------|-------|-------|
| W20 | Tesseract.js OCR + pipeline + search integration | 16h |
| W21 | Auto-Notes v2 + Claude Vision + photo-segment correlation | 14h |
| W22 | Manual notes import + batch OCR + Electron shell (thin wrapper) | 14h |
| W23 | Hostile review + fixes + release v0.6.0 | 10h + 8h contingency |

### Electron Shell (v0.6.0 — thin wrapper)

The thin Electron wrapper ships alongside v0.6.0 as the first downloadable desktop app:

| Component | Scope |
|-----------|-------|
| **Main process** | `electron/main.js` — loads `index.html`, window management |
| **Packaging** | electron-builder: Windows `.exe`, macOS `.dmg`, Linux `.AppImage` |
| **Storage** | Same IndexedDB (via Chromium in Electron) — no migration needed |
| **Auto-update** | electron-updater connected to GitHub Releases |
| **Native features** | System tray icon, native notifications, file drag-drop |
| **NOT included** | SQLite migration, local Whisper — deferred to v0.8.0 |

Cross-platform packaging:
```
electron-builder config:
  win: nsis (.exe installer)
  mac: dmg
  linux: AppImage (universal, no install needed)
```

---

## v0.7.0 — Community (PLANNED)

**Theme**: Multi-user backend, professor dashboard, aggregate analytics
**Effort**: ~56 hours (5-6 weeks)
**Prerequisites**: v0.6.0 released
**Target Users**: Professors, Teaching Assistants, Student groups

### Goals

| ID | Goal | PASS Criteria |
|----|------|---------------|
| C1 | Multi-user Backend | Auth (JWT), user accounts, API server |
| C2 | Professor Dashboard | Class-wide confusion heatmap, most-replayed segments |
| C3 | Aggregate Confusion | Anonymous confusion voting across students |
| C4 | OpenAI API Support | Server-side proxy for OpenAI (no browser CORS issue) |
| C5 | Export Reports | PDF/CSV confusion reports for educators |

### Week-by-Week Plan

| Week | Focus | Hours |
|------|-------|-------|
| W24-25 | Multi-user backend: auth, user model, API | 20h |
| W26 | Professor Dashboard UI | 12h |
| W27 | Aggregate confusion analytics | 8h |
| W28 | OpenAI API server-side proxy + export reports | 6h |
| W29 | Polish + hostile review + release | 10h |

---

## v0.8.0 — Desktop Full (PLANNED)

**Theme**: Full-featured native desktop app with local AI
**Effort**: ~54 hours (4-5 weeks)
**Prerequisites**: v0.7.0 released, Electron shell from v0.6.0
**Target Users**: Power users, offline-first users, privacy-conscious users

### Goals

| ID | Goal | PASS Criteria |
|----|------|---------------|
| D1 | SQLite Migration | Replace IndexedDB with better-sqlite3 for desktop |
| D2 | Native File Storage | Recordings saved to disk (no IDB blob limits) |
| D3 | Local Whisper | whisper.cpp integration — real transcription, no API |
| D4 | Code Signing | Signed installers for Windows + macOS |
| D5 | Auto-Updater | Seamless updates via GitHub Releases |
| D6 | Cross-Platform Polish | Windows, macOS, Linux testing + fixes |

### Week-by-Week Plan

| Week | Focus | Hours |
|------|-------|-------|
| W30 | SQLite migration (better-sqlite3) + native file storage | 16h |
| W31 | Local Whisper integration (whisper.cpp binding) | 16h |
| W32 | Auto-updater + code signing + installer polish | 10h |
| W33 | Cross-platform testing + fixes | 8h |
| W34 | Hostile review + release v0.8.0 | 4h |

### Architecture

```
Electron App (v0.8.0)
├── main.js (Node.js main process)
│   ├── better-sqlite3 (replaces IndexedDB)
│   ├── whisper.cpp (local transcription via node-whisper)
│   ├── Native file system (recordings on disk)
│   └── electron-updater (auto-updates)
├── renderer (existing web app, unchanged)
│   ├── index.html
│   ├── flashcards.js, library.js, analytics.js, recorder.js
│   └── storage/ (abstraction layer: IDB in browser, SQLite in Electron)
└── Packaging
    ├── Windows: .exe (NSIS installer)
    ├── macOS: .dmg (notarized)
    └── Linux: .AppImage (universal)
```

---

## v1.0.0 — Production Stable (PLANNED)

**Theme**: Production-ready with real AI summaries
**Effort**: ~80 hours (4 weeks)
**Prerequisites**: v0.8.0 complete

### Goals

| ID | Goal | PASS Criteria |
|----|------|---------------|
| G1 | Real Y-decoder | Generate actual summaries (Phi-3 mini) |
| G2 | Performance | Query latency p99 <200ms |
| G3 | Security audit | bandit + safety pass |
| G4 | Deployment guide | AWS/self-hosted step-by-step |
| G5 | Test coverage 85%+ | pytest --cov >=85% |

---

## Calendar View

```
January 2026
  Week 1: Gate 0 COMPLETE
  Weeks 2-5: v0.2.0 RELEASED

February 2026
  Weeks 6-9: v0.3.0 RELEASED

March 2026
  Weeks 10-14: v0.4.0 Student Playground — RELEASED (557 tests)
  Weeks 15-16: v0.5.0 Live Capture — IN PROGRESS (693 tests at W16 Day 2)

April 2026
  Weeks 17-19: v0.5.0 Live Capture — Auto-Notes + polish + RELEASE

May 2026
  Weeks 20-23: v0.6.0 Vision + Electron Shell — OCR + thin desktop app + RELEASE

June-July 2026
  Weeks 24-29: v0.7.0 Community — Multi-user backend + professor dashboard + RELEASE

August-September 2026
  Weeks 30-34: v0.8.0 Desktop Full — SQLite + local Whisper + RELEASE

September-October 2026
  Weeks 35-38: v1.0.0 Production
```

---

## Next Actions

### Completed (v0.4.0)
1. ~~Weeks 10-14: Student Playground~~ (557 tests, hostile review 91/100)
2. ~~v0.4.0 tagged + pushed + GitHub release created~~

### Completed (v0.5.0 so far)
1. ~~W15 Days 0-6: Audio/photo capture, confusion voting, DB migration~~ (652 tests)
2. ~~W16 Day 0: UX fixes + dark mode + backend guard~~ (658 tests)
3. ~~W16 Day 1: Confusion heatmap + tab + stats~~ (684 tests)
4. ~~W16 Day 2: Privacy banner + speech toggle + storage quota + photo disclaimer~~ (693 tests)

### Now: v0.5.0 remaining
1. W16 Day 5: Accessibility audit (~2h)
2. W17: iOS spike + buffer (~5h)
3. W18: Auto-Notes framework (extractive + LLM API) (~12h)
4. W19: Polish + W19 deferred fixes + hostile review + release (~10h)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-09 | Add v0.4.0 Student Playground | Transform from tool to learning platform |
| 2026-01-09 | Cloud demo + local full features | Free tier limits require placeholder mode |
| 2026-01-09 | Multi-agent workflow | Specialized agents for UI, ML, security |
| 2026-01-09 | Offline-first architecture | Students need to study anywhere |
| 2026-02-27 | Extract dom-utils.js from flashcards.js | Shared utilities for library.js without circular deps (AD-1) |
| 2026-02-27 | setLibraryRenderer callback pattern | One-directional dependency: library.js -> flashcards.js, never reverse |
| 2026-03-04 | Defer SP4+SP7 to v0.5.0 scope | Confusion analytics needs per-user capture first |
| 2026-03-04 | v0.5.0 = "Live Capture" not "Professor Edition" | Professor features need multi-user backend; live capture is student-facing |
| 2026-03-10 | v0.6.0 = combined OCR + Gamification + thin Electron | Ship OCR + downloadable desktop app in same release |
| 2026-03-10 | v0.7.0 = "Community" (multi-user backend) | Professor Dashboard + aggregate analytics need shared backend |
| 2026-03-10 | v0.8.0 = "Desktop Full" (SQLite + local Whisper) | Full native features deferred; thin Electron shell ships with v0.6.0 |
| 2026-03-10 | Option C for Electron: thin wrapper first, full later | Quick tangible deliverable without blocking community features |
| 2026-03-10 | Linux via AppImage | Universal Linux packaging, no install needed |
| 2026-03-10 | Run hostile-reviewer + code-reviewer in parallel | Different agents catch different issues — broader coverage |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v5.0 | 2026-03-10 | Major roadmap revision: v0.5.0="Live Capture", add v0.6.0 Vision+Electron, v0.7.0 Community, v0.8.0 Desktop Full. Electron Option C (thin wrapper first). Linux AppImage support. |
| v4.1 | 2026-03-05 | v0.4.0 RELEASED: 557 tests, hostile review 91/100 |
| v4.0 | 2026-03-04 | Roadmap optimization: defer SP4+SP7, accurate deliverables |
| v3.0 | 2026-01-09 | Added v0.4.0 Student Playground |
| v2.0 | 2026-01-01 | Added Gate 0, realistic estimates |
| v1.0 | 2026-01-01 | Initial roadmap |

---

*"Build tools that make learning a joy, not a chore."*
