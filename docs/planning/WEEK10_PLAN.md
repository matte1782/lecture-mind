# Week 10 Plan: Foundation + Architecture

> **⚠️ SUPERSEDED**: This document has been superseded by `WEEK10_UNIFIED_PLAN.md`.
> Do NOT use this document for implementation. Refer to the unified plan only.
> — Marked 2026-01-21 per hostile-reviewer condition N1

**Version:** 1.0.0
**Duration:** 5 days @ 4 hours/day = 20 hours total
**Goal:** Establish the architectural foundation for Student Playground features
**Status:** ~~DRAFT - Pending hostile-reviewer approval~~ **SUPERSEDED**

---

## Carry-Over from Week 9

### Fix Demo GIF (Priority: HIGH)
The hostile review (REVIEW_demo_gif.md) flagged critical issues:
- **[C1]** Missing search functionality demo - GIF shows only static UI states
- **[C2]** No AI/ML demonstration - viewers never see actual processing/results
- **[M4]** Study Tools frame is truncated

**Action Required:**
- [ ] Record new GIF showing: upload → processing → search query → results
- [ ] Include actual search results (even if from local install)
- [ ] Update docs/assets/demo.gif
- [ ] Update README if needed

**Time estimate:** 1-2 hours

---

## Overview

- **Theme:** Storage architecture, data models, and design system enhancement
- **Hours:** 20h total
- **Agents:** architect, frontend-design, hostile-reviewer
- **Critical Path:** IndexedDB storage layer must complete before any feature work in Week 11+

```
Week 10 Architecture Flow:

  Day 1          Day 2          Day 3          Day 4          Day 5
  -----          -----          -----          -----          -----
  Design         IndexedDB      IndexedDB      Animation      Review
  System         Core           Models         Framework      Gate
    |              |              |              |              |
    v              v              v              v              v
  tokens.css    storage.js    models.js     transitions.js  APPROVED?
  enhanced      + tests       + tests       + tests           |
                                                              v
                                                         Week 11
```

---

## Daily Breakdown

### Day 1: Design System Enhancement
**Hours:** 4h
**Focus:** Extend existing token system for Student Playground components
**Agent:** frontend-design

#### Tasks
- [ ] T1.1 Audit existing tokens.css for gaps (agent: frontend-design, hours: 0.5h)
- [ ] T1.2 Add flashcard-specific tokens (colors, shadows, 3D transforms) (agent: frontend-design, hours: 1h)
- [ ] T1.3 Add library/grid layout tokens (agent: frontend-design, hours: 0.5h)
- [ ] T1.4 Add progress/analytics chart tokens (agent: frontend-design, hours: 0.5h)
- [ ] T1.5 Create component token documentation (agent: frontend-design, hours: 0.5h)
- [ ] T1.6 Add dark mode variants for new tokens (agent: frontend-design, hours: 0.5h)
- [ ] T1.7 Test token system with sample component (agent: frontend-design, hours: 0.5h)

#### Deliverables
- `src/vl_jepa/api/static/tokens.css` (enhanced)
- `docs/student-playground/design-tokens.md` (new)

#### Acceptance Criteria
- [ ] All new tokens follow existing naming convention (`--component-property-variant`)
- [ ] Dark mode variants exist for all color tokens
- [ ] `prefers-reduced-motion` respected for any motion tokens
- [ ] Sample flashcard component renders correctly with new tokens
- [ ] No CSS linting errors

---

### Day 2: IndexedDB Storage Layer - Core
**Hours:** 4h
**Focus:** Implement core IndexedDB wrapper with async/await API
**Agent:** architect

#### Tasks
- [ ] T2.1 Design storage API interface (agent: architect, hours: 1h)
- [ ] T2.2 Implement IndexedDB connection manager (agent: architect, hours: 1h)
- [ ] T2.3 Implement CRUD operations (get, put, delete, getAll) (agent: architect, hours: 1h)
- [ ] T2.4 Add error handling and retry logic (agent: architect, hours: 0.5h)
- [ ] T2.5 Write unit tests with fake-indexeddb (agent: architect, hours: 0.5h)

#### Deliverables
- `src/vl_jepa/api/static/storage/db.js` (new)
- `tests/js/test_db.js` (new)

#### Acceptance Criteria
- [ ] `StorageDB.open()` returns Promise that resolves to DB instance
- [ ] `db.put(store, key, value)` persists data
- [ ] `db.get(store, key)` retrieves data
- [ ] `db.delete(store, key)` removes data
- [ ] `db.getAll(store)` returns all records
- [ ] Connection survives page reload
- [ ] All operations handle errors gracefully (no unhandled rejections)
- [ ] Works in Chrome, Firefox, Safari (latest versions)

#### Storage Schema (Initial)
```javascript
// Database: LectureMindDB
// Version: 1

const stores = {
  lectures: {
    keyPath: 'id',
    indexes: ['courseId', 'createdAt', 'title']
  },
  flashcards: {
    keyPath: 'id',
    indexes: ['lectureId', 'dueDate', 'interval']
  },
  progress: {
    keyPath: 'id',
    indexes: ['lectureId', 'userId']
  },
  settings: {
    keyPath: 'key'
  }
};
```

---

### Day 3: IndexedDB Storage Layer - Data Models
**Hours:** 4h
**Focus:** Define data models and implement typed CRUD for each entity
**Agent:** architect

#### Tasks
- [ ] T3.1 Define Lecture model with validation (agent: architect, hours: 1h)
- [ ] T3.2 Define Flashcard model with SM-2 fields (agent: architect, hours: 1h)
- [ ] T3.3 Define Progress model for tracking (agent: architect, hours: 0.5h)
- [ ] T3.4 Define Settings model for preferences (agent: architect, hours: 0.5h)
- [ ] T3.5 Create model factory with validation (agent: architect, hours: 0.5h)
- [ ] T3.6 Write integration tests with real IndexedDB (agent: architect, hours: 0.5h)

#### Deliverables
- `src/vl_jepa/api/static/storage/models.js` (new)
- `tests/js/test_models.js` (new)

#### Acceptance Criteria
- [ ] Each model has TypeScript-style JSDoc annotations
- [ ] Validation rejects malformed data with clear error messages
- [ ] Models include `createdAt` and `updatedAt` timestamps
- [ ] Flashcard model includes all SM-2 algorithm fields:
  - `easeFactor` (default 2.5)
  - `interval` (days)
  - `repetitions` (count)
  - `dueDate` (ISO timestamp)
- [ ] Lecture model supports multi-course organization
- [ ] 100% test coverage on validation logic

#### Data Models (Specification)
```javascript
// Lecture Model
{
  id: 'uuid',
  title: 'string (required, max 200 chars)',
  courseId: 'uuid | null',
  videoPath: 'string (required)',
  duration: 'number (seconds)',
  thumbnailUrl: 'string | null',
  transcriptId: 'uuid | null',
  eventsId: 'uuid | null',
  watchProgress: 'number (0-100)',
  createdAt: 'ISO timestamp',
  updatedAt: 'ISO timestamp'
}

// Flashcard Model (SM-2 Algorithm)
{
  id: 'uuid',
  lectureId: 'uuid (required)',
  front: 'string (required, max 500 chars)',
  back: 'string (required, max 2000 chars)',
  easeFactor: 'number (default 2.5)',
  interval: 'number (days, default 1)',
  repetitions: 'number (default 0)',
  dueDate: 'ISO timestamp',
  createdAt: 'ISO timestamp',
  updatedAt: 'ISO timestamp',
  source: '"auto" | "manual"'
}

// Progress Model
{
  id: 'uuid',
  lectureId: 'uuid (required)',
  segmentId: 'string',
  watchedSeconds: 'number',
  confusionVotes: 'number[]',
  quizScore: 'number | null',
  lastAccessed: 'ISO timestamp'
}

// Settings Model
{
  key: 'string (unique)',
  value: 'any',
  updatedAt: 'ISO timestamp'
}
```

---

### Day 4: Animation Framework Enhancement
**Hours:** 4h
**Focus:** Build reusable animation utilities for Student Playground features
**Agent:** frontend-design

#### Tasks
- [ ] T4.1 Create page transition system (fade, slide, morph) (agent: frontend-design, hours: 1h)
- [ ] T4.2 Implement 3D card flip animation for flashcards (agent: frontend-design, hours: 1h)
- [ ] T4.3 Add progress celebration effects (confetti, success burst) (agent: frontend-design, hours: 1h)
- [ ] T4.4 Create loading skeleton components (agent: frontend-design, hours: 0.5h)
- [ ] T4.5 Write animation performance tests (60fps verification) (agent: frontend-design, hours: 0.5h)

#### Deliverables
- `src/vl_jepa/api/static/animations/transitions.js` (new)
- `src/vl_jepa/api/static/animations/flashcard.css` (new)
- `src/vl_jepa/api/static/animations/celebrations.js` (new)
- `src/vl_jepa/api/static/animations/skeletons.css` (new)

#### Acceptance Criteria
- [ ] Page transitions complete in <300ms
- [ ] Card flip animation maintains 60fps (verified via DevTools)
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Confetti particles are GPU-accelerated (transform/opacity only)
- [ ] Skeleton loaders match target component dimensions
- [ ] No layout shift (CLS) during animation
- [ ] Works on mobile (touch gestures for card flip)

#### Animation Specifications
```javascript
// Page Transitions API
Transitions.fade(fromElement, toElement, duration);
Transitions.slide(fromElement, toElement, direction);
Transitions.morph(fromElement, toElement); // FLIP animation

// Flashcard Flip
FlashcardAnimation.flip(card, 'front' | 'back');
FlashcardAnimation.shake(card); // wrong answer
FlashcardAnimation.success(card); // correct answer

// Celebrations
Celebrations.confetti(originElement);
Celebrations.streak(count); // streak counter popup
Celebrations.levelUp(newLevel);
```

---

### Day 5: Architecture Review + Quality Gate
**Hours:** 4h
**Focus:** Hostile review of all Week 10 deliverables
**Agent:** hostile-reviewer

#### Tasks
- [ ] T5.1 Review storage API design for security issues (agent: hostile-reviewer, hours: 1h)
- [ ] T5.2 Review data models for completeness (agent: hostile-reviewer, hours: 1h)
- [ ] T5.3 Review animation performance (agent: hostile-reviewer, hours: 0.5h)
- [ ] T5.4 Verify test coverage meets 80% target (agent: hostile-reviewer, hours: 0.5h)
- [ ] T5.5 Write REVIEW_week10.md with findings (agent: hostile-reviewer, hours: 0.5h)
- [ ] T5.6 Address critical issues (agent: architect + frontend-design, hours: 0.5h)

#### Deliverables
- `docs/reviews/REVIEW_week10.md` (new)

#### Acceptance Criteria
- [ ] All CRITICAL issues resolved before Week 11
- [ ] MAJOR issues documented with mitigation plan
- [ ] Test coverage >= 80% for new code
- [ ] No security vulnerabilities in storage layer
- [ ] Performance benchmarks documented

---

## Dependencies

```
                    WEEK 10 DEPENDENCY GRAPH

   Day 1                Day 2               Day 3
   [Design]            [DB Core] --------> [Models]
   [Tokens]
       |                   |                   |
       |                   |                   |
       v                   |                   |
   Day 4                   |                   |
   [Animation]             |                   |
   [Framework]             |                   |
       |                   |                   |
       +-------------------+-------------------+
                           |
                           v
                       Day 5
                   [HOSTILE REVIEW]
                           |
                           v
                   [Week 11 - Flashcards]

BLOCKING:
- Day 3 (Models) blocked by Day 2 (DB Core)
- Day 5 (Review) blocked by Days 1-4 completion
- Week 11 blocked by Day 5 approval

NON-BLOCKING:
- Day 1 (Design) can run parallel with Day 2 (DB)
- Day 4 (Animation) can run parallel with Day 3 (Models)
```

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | IndexedDB browser incompatibility | HIGH | LOW | Test early on Safari, fallback to localStorage for critical data |
| R2 | 60fps animation target missed | MEDIUM | MEDIUM | Use CSS-only animations, avoid JS-driven frame updates |
| R3 | Model schema changes later | MEDIUM | HIGH | Design for schema migrations from day 1 (version field) |
| R4 | Test coverage shortfall | MEDIUM | LOW | Prioritize storage layer tests, UI tests in Week 15 |
| R5 | Design token conflicts with existing | LOW | MEDIUM | Namespace new tokens with `--sp-` prefix (student playground) |

### Mitigation Details

**R1 - IndexedDB Compatibility:**
```javascript
// Feature detection with fallback
const hasIndexedDB = () => {
  try {
    return !!window.indexedDB;
  } catch (e) {
    return false;
  }
};

// Safari private browsing fallback
if (!hasIndexedDB()) {
  console.warn('IndexedDB unavailable, using in-memory storage');
  return new InMemoryStorage();
}
```

**R3 - Schema Migrations:**
```javascript
// Built-in migration support
const migrations = {
  1: (db) => { /* initial schema */ },
  2: (db) => { /* add courseId index */ },
  // ... future migrations
};
```

---

## Quality Gate

### Pre-Review Checklist (Complete Before Day 5)

**Storage Layer:**
- [ ] IndexedDB wrapper works in Chrome, Firefox, Safari
- [ ] All CRUD operations have unit tests
- [ ] Error handling tested (DB unavailable, quota exceeded)
- [ ] Schema version management implemented
- [ ] No data loss on browser refresh

**Data Models:**
- [ ] All models have JSDoc type annotations
- [ ] Validation rejects invalid data with helpful errors
- [ ] SM-2 algorithm fields verified against specification
- [ ] createdAt/updatedAt auto-populated
- [ ] UUID generation consistent

**Design System:**
- [ ] New tokens documented with examples
- [ ] Dark mode tested
- [ ] No breaking changes to existing tokens
- [ ] Sample component renders correctly

**Animation Framework:**
- [ ] 60fps verified in Chrome DevTools Performance tab
- [ ] prefers-reduced-motion honored
- [ ] No layout shifts (CLS = 0)
- [ ] Touch gesture support for mobile

**Code Quality:**
- [ ] No ESLint errors
- [ ] Test coverage >= 80%
- [ ] No console.error in normal operation
- [ ] All async operations use try/catch

### Hostile Review Focus Areas

```markdown
## HOSTILE_REVIEWER: Week 10 Review Focus

Priority 1 (Security):
- [ ] Storage API cannot be exploited for XSS
- [ ] No dangerous code execution patterns with user data
- [ ] No innerHTML with user-provided content
- [ ] Data validation prevents injection attacks

Priority 2 (Reliability):
- [ ] IndexedDB quota handling
- [ ] Graceful degradation without IndexedDB
- [ ] Data integrity on concurrent access

Priority 3 (Performance):
- [ ] Animations GPU-composited
- [ ] No memory leaks in animation loops
- [ ] Lazy loading of animation assets

Priority 4 (Maintainability):
- [ ] Clear separation of concerns
- [ ] Models independent of storage implementation
- [ ] Animation system is declarative, not imperative
```

---

## Week 11 Preview (Blocked by Week 10 Gate)

Once hostile-reviewer approves Week 10 deliverables:

| Task | Hours | Agent | Dependency |
|------|-------|-------|------------|
| Flashcard data model finalization | 2h | architect | Week 10 models |
| Auto-generation from transcript | 6h | ml-engineer | Flashcard model |
| SM-2 spaced repetition algorithm | 4h | ml-engineer | Flashcard model |
| Card UI with flip animation | 4h | frontend-design | Animation framework |
| Study session flow | 4h | frontend-design | All above |

---

## Notes

### Existing Assets (Leverage, Don't Rebuild)

The project already has:
- `tokens.css` - Comprehensive design token system (colors, typography, spacing, motion)
- `animations.css` - Premium animations (particles, aurora, tilt cards, celebrations)
- `components.css` - Base component styles

**Strategy:** Extend existing files rather than creating parallel systems.

### Technology Decisions

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| IndexedDB over localStorage | Supports large data, async API | localStorage has 5MB limit |
| CSS-only animations over GSAP | No dependencies, better performance | GSAP adds 30KB |
| JSDoc over TypeScript | Faster development, no build step | TypeScript requires tooling |

### File Structure After Week 10

```
src/vl_jepa/api/static/
|-- storage/                  # NEW
|   |-- db.js                # IndexedDB wrapper
|   |-- models.js            # Data model definitions
|   +-- migrations.js        # Schema version management
|-- animations/               # NEW
|   |-- transitions.js       # Page transitions
|   |-- flashcard.css        # 3D flip styles
|   |-- celebrations.js      # Confetti, success bursts
|   +-- skeletons.css        # Loading skeletons
|-- tokens.css               # ENHANCED
|-- animations.css           # EXISTING (keep as-is)
|-- components.css           # EXISTING
|-- layout.css               # EXISTING
+-- app.js                   # EXISTING
```

---

## Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| Planner | Claude (PLANNER agent) | DRAFTED | 2026-01-09 |
| Architect | (pending assignment) | PENDING | - |
| Frontend-Design | (pending assignment) | PENDING | - |
| Hostile-Reviewer | (pending assignment) | PENDING | - |

---

*Plan created: 2026-01-09*
*Status: READY FOR HOSTILE REVIEW*
*Next: `/review:hostile docs/planning/WEEK10_PLAN.md`*
