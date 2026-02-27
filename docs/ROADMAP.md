# Lecture Mind — Product Roadmap v3.1

> **Last Updated**: 2026-02-27
> **Current Version**: v0.3.0 (v0.4.0 in progress — Week 12)
> **Status**: ⏳ v0.4.0 IN PROGRESS — Week 12 Days 0-2 complete
> **Docs Site**: https://matte1782.github.io/lecture-mind/
> **Cloud Demo**: https://lecture-mind.onrender.com
> **Architecture**: FastAPI + Premium Vanilla JS (Cloud Demo + Local Full)

---

## Executive Summary

| Version | Theme | Hours | Calendar | Status |
|---------|-------|-------|----------|--------|
| v0.1.0 | Foundation | - | DONE | ✅ Released |
| Gate 0 | Technical Validation | 12h | Week 1 | ✅ Complete |
| v0.2.0 | Real Models + Audio | 80h | Weeks 2-5 | ✅ Released |
| v0.3.0 | Cloud Demo + Security | 60h | Weeks 6-9 | ✅ Released |
| **v0.4.0** | **🎓 Student Playground** | **120h** | **Weeks 10-15** | ⏳ In Progress (Week 12) |
| v1.0.0 | Production | 80h | Weeks 16-19 | Blocked by v0.4.0 |

**Assumptions:**
- Work velocity: 20 hours/week
- Single developer + AI agents for specialized tasks
- Part-time project

---

## v0.3.0 — Cloud Demo + Security Hardening ✅ RELEASED

**Theme**: Stable cloud demo + fix all security issues
**Effort**: 60 hours (completed)
**Prerequisites**: v0.2.0 complete ✅
**Status**: ✅ RELEASED (2026-01-09)

### Goals with Acceptance Criteria

| ID | Goal | PASS Criteria | FAIL Criteria | Status |
|----|------|---------------|---------------|--------|
| G1 | Web UI | Upload video, see events, execute query | Crashes, no output | ✅ Complete |
| G2 | Progress indication | Progress bar updates during processing | Freezes | ✅ Complete |
| G3 | Export functionality | Download as Markdown/JSON/SRT/StudyNotes | No export | ✅ Complete |
| G4 | Docker image | `docker run` works, <3GB | Build fails | ✅ Complete |
| G5 | Cloud demo | Render deployment works in demo mode | OOM crash | ✅ Complete |
| G6 | **Security C1-C4** | **All critical security issues fixed** | **Vulnerabilities remain** | ✅ Complete (12 issues fixed) |
| G7 | Test coverage 80%+ | pytest --cov ≥80% | Below 80% | ✅ 74% (accepted for v0.3.0) |

### Security Issues (Hostile Review Findings) — ALL FIXED

| ID | Issue | Severity | Status | Fix Location |
|----|-------|----------|--------|--------------|
| **C1** | CORS wildcard + credentials | CRITICAL | ✅ Fixed | main.py:216-222 |
| **C2** | No server-side file size limit | CRITICAL | ✅ Fixed | main.py:325-336 |
| **C3** | No rate limiting | CRITICAL | ✅ Fixed | main.py:96-132 |
| **C4** | innerHTML usage (XSS risk) | CRITICAL | ✅ Fixed | app.js (safe DOM methods) |
| **C5** | Path traversal attack | CRITICAL | ✅ Fixed | main.py:318-321 |
| **C6** | Rate limit bypass (no client IP) | CRITICAL | ✅ Fixed | main.py:286-293 |

See `docs/reviews/REVIEW_hostile_final.md` for full verification.

### Task Breakdown (Updated)

| Week | Task | Hours | Status |
|------|------|-------|--------|
| **Week 6** | **FastAPI + Frontend Foundation** | 20h | ✅ Complete |
| **Week 7** | **UI Features** | 20h | ✅ Complete |
| **Week 8** | **Security + Stability** | 20h | ✅ Complete |
| | ~~Dockerfile creation~~ | ~~4h~~ | ✅ Complete |
| | ~~Render deployment~~ | ~~4h~~ | ✅ Live (demo mode) |
| | ~~Demo mode for cloud~~ | ~~2h~~ | ✅ Complete |
| | ~~NaN% bug fix~~ | ~~1h~~ | ✅ Complete |
| | ~~404 polling fix~~ | ~~1h~~ | ✅ Complete |
| | ~~Security fixes C1-C6~~ | ~~4h~~ | ✅ Complete (12 issues) |
| | ~~Hostile review gate~~ | ~~2h~~ | ✅ APPROVED |
| | docker-compose polish | 2h | Deferred to v0.4.0 |
| **Week 9** | **Docs + Release** | 20h | ✅ Complete |
| | ~~Local setup guide~~ | ~~4h~~ | ✅ Complete |
| | ~~MkDocs framework~~ | ~~4h~~ | ✅ Complete |
| | ~~API documentation~~ | ~~4h~~ | ✅ Complete |
| | ~~Demo instructions~~ | ~~2h~~ | ✅ Complete |
| | ~~Release v0.3.0~~ | ~~4h~~ | ✅ Released |
| | ~~GitHub Pages deploy~~ | ~~2h~~ | ✅ Live |

### Quality Gates ✅ ALL PASSED

```
┌─────────────────────────────────────────────────────────────────┐
│                    v0.3.0 RELEASE GATE — PASSED                 │
├─────────────────────────────────────────────────────────────────┤
│  ✅ All security issues fixed (12 total, verified)              │
│  ✅ Hostile reviewer APPROVED (REVIEW_hostile_final.md)         │
│  ✅ Cloud demo stable (no OOM, demo mode working)               │
│  ✅ Local setup documented (docs/local-setup.md)                │
│  ✅ MkDocs site deployed (GitHub Pages live)                    │
│  ✅ API documentation complete                                  │
│  ✅ Test coverage 74% (369 passed, 0 failed)                    │
│  ✅ CI green                                                    │
│  ✅ v0.3.0 tag + GitHub release created                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## v0.4.0 — 🎓 Student Playground ← NEXT

**Theme**: Advanced local-first learning platform for students and educators
**Effort**: 120 hours (6 weeks @ 20h/week)
**Prerequisites**: v0.3.0 complete ✅, security hardened ✅
**Target Users**: Students, Teaching Assistants, Professors
**Status**: In Progress — Week 12 Days 0-2 complete (418 tests passing)

### Vision

> **"Not just a tool for viewing lectures, but a complete learning companion."**

The Student Playground transforms Lecture Mind from a simple video summarizer into a comprehensive study platform with:

- 🎨 **Premium Animations** - Fluid, delightful interactions that make studying enjoyable
- 🧠 **Active Learning Tools** - Flashcards, quizzes, spaced repetition
- 📚 **Multi-Lecture Management** - Track progress across an entire course
- 👨‍🏫 **Educator Dashboard** - Analytics for professors to understand student confusion points
- 🔌 **Offline-First** - Works without internet after initial setup

### Goals with Acceptance Criteria

| ID | Goal | PASS Criteria | FAIL Criteria |
|----|------|---------------|---------------|
| SP1 | Flashcard System | Auto-generate from transcript, spaced repetition | Manual creation only |
| SP2 | Multi-Lecture Library | Import, organize, search across lectures | Single video only |
| SP3 | Progress Tracking | Track watched segments, quiz scores, review schedule | No persistence |
| SP4 | Confusion Analytics | Aggregate anonymous confusion votes, show professors | No aggregation |
| SP5 | Premium Animations | 60fps, micro-interactions, delightful UX | Janky, slow |
| SP6 | Offline Mode | Full functionality without network | Requires constant connection |
| SP7 | Professor Dashboard | View class confusion hotspots, export reports | Student-only features |

### Feature Breakdown

#### 🃏 Flashcard System (SP1)
```
Features:
├── Auto-generation from transcript key concepts
├── Manual card creation with rich text
├── Spaced repetition algorithm (SM-2)
├── Progress tracking per card
├── Export to Anki format
└── Study sessions with statistics
```

#### 📚 Multi-Lecture Library (SP2)
```
Features:
├── Import multiple videos
├── Course/folder organization
├── Cross-lecture search
├── Lecture series playlist
├── Progress indicators per lecture
└── Favorites and bookmarks
```

#### 📊 Progress Tracking (SP3)
```
Features:
├── Watch progress per segment
├── Quiz score history
├── Flashcard mastery levels
├── Study time analytics
├── Weekly goals and streaks
└── Export study reports
```

#### 🔥 Confusion Analytics (SP4)
```
Features:
├── Student confusion voting (anonymous)
├── Aggregate heatmap per lecture
├── Professor dashboard view
├── Export confusion reports
├── Compare across lecture series
└── AI suggestions for unclear sections
```

#### ✨ Premium Animations (SP5)
```
Animations:
├── Page transitions (fade, slide, morph)
├── Card flip effects (3D transforms)
├── Progress celebrations (confetti, particles)
├── Micro-interactions (hover, focus, click)
├── Loading skeletons
├── Smooth scrolling with parallax
└── Gesture support (swipe, pinch)
```

#### 🌐 Offline Mode (SP6)
```
Features:
├── IndexedDB for local storage
├── Service Worker for caching
├── Background sync when online
├── Video caching (optional, large files)
├── Full functionality offline
└── Sync indicator UI
```

#### 👨‍🏫 Professor Dashboard (SP7)
```
Features:
├── Class-wide confusion heatmap
├── Most-replayed segments
├── Quiz performance analytics
├── Student engagement metrics
├── Export for course improvement
└── Anonymous (privacy-first)
```

### Task Breakdown

| Week | Focus | Hours | Status |
|------|-------|-------|--------|
| **Week 10** | **Foundation + Architecture** | 20h | ✅ Complete |
| | Design system enhancement (CSS variables, tokens) | 4h | ✅ |
| | IndexedDB storage layer (db.js, migrations.js) | 6h | ✅ |
| | Multi-lecture data model (models.js, repositories.js) | 4h | ✅ |
| | Animation framework (playground-components.css) | 4h | ✅ |
| | Hostile review: architecture | 2h | ✅ |
| **Week 11** | **Flashcard System** | 20h | ✅ Complete |
| | Card data model + repositories | 2h | ✅ |
| | Auto-generation from transcript | 6h | ✅ |
| | Spaced repetition (SM-2 algorithm) | 4h | ✅ |
| | Card UI with flip animation | 4h | ✅ |
| | Study session flow + router | 4h | ✅ |
| **Week 12** | **Multi-Lecture Library** | 20h | ⏳ Days 0-2 done |
| | Day 0: Prerequisite refactoring (dom-utils, router) | 4h | ✅ |
| | Day 1: Course organization + library shell | 4h | ✅ Reviewed (72→fixed) |
| | Day 2: Import pipeline + organization | 4h | ✅ |
| | Day 3: Cross-lecture search | 4h | Pending |
| | Days 4-6: Detail view, progress, dashboard | 4h | Pending |
| **Week 13** | **Progress & Analytics** | 20h | |
| | Watch progress tracking | 4h | architect |
| | Quiz score persistence | 4h | architect |
| | Study analytics UI | 6h | frontend-design |
| | Confusion aggregation | 6h | ml-engineer |
| **Week 14** | **Professor Dashboard** | 20h | |
| | Dashboard UI design | 6h | frontend-design |
| | Confusion heatmap visualization | 6h | frontend-design |
| | Export reports | 4h | architect |
| | Privacy controls | 4h | security-lead |
| **Week 15** | **Polish + Release** | 20h | |
| | Offline mode (Service Worker) | 6h | architect |
| | Animation polish | 4h | frontend-design |
| | Hostile review: final | 4h | hostile-reviewer |
| | Documentation | 4h | docs-writer |
| | Release v0.4.0 | 2h | - |

### Multi-Agent Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STUDENT PLAYGROUND AGENTS                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  architect   │    │ frontend-    │    │ ml-engineer  │          │
│  │              │    │ design       │    │              │          │
│  │ - Data model │    │ - Premium UI │    │ - Flashcard  │          │
│  │ - Storage    │    │ - Animations │    │   generation │          │
│  │ - Offline    │    │ - Components │    │ - Search     │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             │                                        │
│                    ┌────────▼────────┐                              │
│                    │ hostile-reviewer│                              │
│                    │                 │                              │
│                    │ Quality Gates   │                              │
│                    │ at each phase   │                              │
│                    └────────┬────────┘                              │
│                             │                                        │
│                    ┌────────▼────────┐                              │
│                    │ security-lead   │                              │
│                    │                 │                              │
│                    │ Privacy audit   │                              │
│                    │ for analytics   │                              │
│                    └─────────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Quality Gates (Per Week)

```
Week 10 Gate: Architecture approved by hostile-reviewer ✅ PASSED
Week 11 Gate: Flashcard system functional, animations smooth ✅ PASSED (91 tests)
Week 12 Gate: Library manages 10+ lectures without slowdown ⏳ IN PROGRESS
Week 13 Gate: Analytics accurate, privacy preserved
Week 14 Gate: Dashboard useful for real professors (user testing)
Week 15 Gate: FINAL - Full hostile review, all issues resolved
```

### Deliverables

```
v0.4.0/
├── src/vl_jepa/
│   ├── api/
│   │   └── static/
│   │       ├── app.js           # Enhanced with Playground features
│   │       ├── flashcards.js    # NEW: Flashcard system
│   │       ├── library.js       # NEW: Multi-lecture management
│   │       ├── analytics.js     # NEW: Progress tracking
│   │       ├── dashboard.js     # NEW: Professor dashboard
│   │       ├── offline.js       # NEW: Service Worker + IndexedDB
│   │       └── animations/      # NEW: Premium animation library
│   │           ├── transitions.js
│   │           ├── particles.js
│   │           └── gestures.js
│   └── storage/                 # NEW: Local storage layer
│       ├── __init__.py
│       ├── models.py            # Data models
│       └── sync.py              # Online/offline sync
├── docs/
│   ├── student-playground/
│   │   ├── quickstart.md        # 5-minute setup
│   │   ├── flashcards.md        # Flashcard guide
│   │   ├── library.md           # Multi-lecture guide
│   │   └── professor.md         # Educator guide
│   └── LOCAL_SETUP.md           # Full local installation
└── tests/
    └── integration/
        ├── test_flashcards.py
        ├── test_library.py
        └── test_offline.py
```

---

## v1.0.0 — Production Stable

**Theme**: Production-ready with real AI summaries
**Effort**: 80 hours (4 weeks @ 20h/week)
**Prerequisites**: v0.4.0 complete, Student Playground stable

### Goals

| ID | Goal | PASS Criteria |
|----|------|---------------|
| G1 | Real Y-decoder | Generate actual summaries (Phi-3 mini) |
| G2 | Performance | Query latency p99 <200ms |
| G3 | Security audit | bandit + safety pass |
| G4 | AWS deployment | Step-by-step guide |
| G5 | Test coverage 85%+ | pytest --cov ≥85% |

---

## Calendar View (Updated)

```
January 2026
├── Week 1 (Jan 1-7): Gate 0 ✅ COMPLETE
├── Weeks 2-5 (Jan 8 - Feb 4): v0.2.0 ✅ RELEASED

February 2026
├── Weeks 6-9 (Feb 5 - Mar 4): v0.3.0 ✅ RELEASED
│   ├── Week 6: FastAPI + Frontend ✅ COMPLETE
│   ├── Week 7: UI Features ✅ COMPLETE
│   ├── Week 8: Security + Stability ✅ COMPLETE
│   └── Week 9: Docs + Release ✅ COMPLETE
│       ├── ✅ Local Setup Guide
│       ├── ✅ MkDocs + GitHub Pages
│       ├── ✅ API Documentation
│       └── ✅ v0.3.0 Released

March 2026
├── Weeks 10-15 (Mar 5 - Apr 15): v0.4.0 - Student Playground ← IN PROGRESS
│   ├── Week 10: Architecture + Design System ✅ COMPLETE
│   ├── Week 11: Flashcard System ✅ COMPLETE
│   ├── Week 12: Multi-Lecture Library ⏳ Days 0-2 done, Days 3-6 next
│   ├── Week 13: Progress + Analytics
│   ├── Week 14: Professor Dashboard
│   └── Week 15: Polish + v0.4.0 release

April-May 2026
├── Weeks 16-19: v1.0.0 - Production
```

---

## Next Actions

### Completed (v0.3.0) ✅
1. ~~Fix security issues C1-C6 (12 issues total)~~ ✅
2. ~~Run hostile-reviewer to verify fixes~~ ✅
3. ~~Complete Week 9 documentation~~ ✅
4. ~~Release v0.3.0~~ ✅
5. ~~Deploy docs to GitHub Pages~~ ✅

### Completed (v0.4.0 Weeks 10-11) ✅
1. ~~Week 10: Storage layer + design system~~ ✅ (292 storage tests)
2. ~~Week 11: Flashcard system~~ ✅ (91 flashcard tests)

### Completed (v0.4.0 Week 12 Days 0-2) ✅
1. ~~Day 0: dom-utils extraction, router extensions, repo getAll~~ ✅
2. ~~Day 1: Course sidebar, toolbar, sorting, CRUD dialogs~~ ✅ (hostile review: 72→fixed)
3. ~~Day 2: Import pipeline, organization, context menu~~ ✅

### Now: Week 12 Days 3-6
1. **Day 3: Cross-lecture search** — Search across segments, flashcards, bookmarks
2. **Day 4: Lecture detail view** — Tabbed detail page with stats
3. **Day 5: Progress persistence** — Favorites, watch progress tracking
4. **Day 6: Dashboard** — Library stats overview

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-09 | Add v0.4.0 Student Playground | Transform from tool to learning platform |
| 2026-01-09 | Cloud demo + local full features | Free tier limits require placeholder mode |
| 2026-01-09 | Multi-agent workflow | Specialized agents for UI, ML, security |
| 2026-01-09 | Professor dashboard | Expand audience beyond students |
| 2026-01-09 | Offline-first architecture | Students need to study anywhere |
| 2026-02-27 | Extract dom-utils.js from flashcards.js | Shared utilities for library.js without circular deps (AD-1) |
| 2026-02-27 | Favorites via SettingsRepository | Avoids misusing BookmarkRepository (AD-2) |
| 2026-02-27 | Dedup imports via SettingsRepository | Lecture model has no metadata field (AD-2 pattern) |
| 2026-02-27 | setLibraryRenderer callback pattern | One-directional dependency: library.js → flashcards.js, never reverse |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v3.4 | 2026-02-27 | Week 12 Days 0-2: library.js, import pipeline, context menu (418 tests) |
| v3.3 | 2026-02-27 | Week 12 plan approved: Rev 2 scored 91/100 (Days 0-3) and 92/100 (Days 4-6) |
| v3.2 | 2026-02-27 | Week 11 complete: Flashcard system (91 tests), Week 10 complete: Storage layer (292 tests) |
| v3.1 | 2026-01-09 | **v0.3.0 RELEASED**: Docs complete, GitHub Pages live, all tests passing |
| v3.0 | 2026-01-09 | Added v0.4.0 Student Playground, multi-agent workflow, security gates |
| v2.6 | 2026-01-09 | Week 8: Demo mode, bug fixes (NaN%, 404 polling) |
| v2.5 | 2026-01-08 | Week 6-7 complete: FastAPI + Premium Vanilla JS |
| v2.4 | 2026-01-07 | v0.2.0 release ready |
| v2.0 | 2026-01-01 | Added Gate 0, realistic estimates |
| v1.0 | 2026-01-01 | Initial roadmap |

---

*"Build tools that make learning a joy, not a chore."*
