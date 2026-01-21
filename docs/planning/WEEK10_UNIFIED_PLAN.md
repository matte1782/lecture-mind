# Week 10 Unified Plan: Foundation + Architecture

**Version:** 1.1 (Unified)
**Created:** 2026-01-09
**Updated:** 2026-01-21
**Status:** ✅ APPROVED — Hostile review conditions addressed (N1, N6)

---

## Critical Issue Resolution

| Issue | Problem | Resolution |
|-------|---------|------------|
| C1 | 40h work in 20h budget | Split into Week 10A (Storage) + Week 10B (Design) |
| C2 | File structure mismatch | Use flat structure with `-v2` suffix |
| C3 | Schema mismatch | Use Storage Plan's 10 stores as canonical |
| C4 | No JS test infra | Add Day 0 prerequisite |
| C5 | Impossible budget | 2-week timeline (40h total) |
| C6 | No integration plan | Add integration tasks in Week 10B |

---

## Revised Timeline

```
Week 10A: Storage Foundation (20h)
├── Day 1: Test Infrastructure + IndexedDB Core
├── Day 2: Data Models + Validation
├── Day 3: Repository Pattern
├── Day 4: Offline Sync Strategy
└── Day 5: Migration + Integration Test

Week 10B: Design System (20h)
├── Day 1: Design Tokens Extension
├── Day 2: Typography + Spacing
├── Day 3: Animation Library
├── Day 4: Dark Mode + Accessibility
└── Day 5: Component Patterns + Integration
```

---

## Week 10A: Storage Foundation

**Theme:** IndexedDB storage layer with offline-first architecture
**Hours:** 20h
**Agent:** architect

### Day 1: Test Infrastructure + IndexedDB Core (4h)

**Prerequisites Setup (1h)**
- [ ] Install fake-indexeddb for testing
- [ ] Configure Jest for browser-like environment
- [ ] Add test script to package.json

**IndexedDB Wrapper (3h)**
- [ ] Create `src/vl_jepa/api/static/storage/db.js`
- [ ] Implement `LectureMindDB` class with connection management
- [ ] Create all 10 object stores with indexes

**Files to Create:**
```
src/vl_jepa/api/static/storage/
├── db.js           # IndexedDB wrapper
└── db.test.js      # Unit tests
```

**Object Stores (10 total):**
```javascript
const STORES = {
  settings: { keyPath: 'key' },
  courses: { keyPath: 'id', indexes: ['name', 'createdAt'] },
  lectures: { keyPath: 'id', indexes: ['courseId', 'status', 'createdAt'] },
  segments: { keyPath: 'id', indexes: ['lectureId', 'startTime'] },
  events: { keyPath: 'id', indexes: ['lectureId', 'timestamp', 'type'] },
  progress: { keyPath: 'id', indexes: ['lectureId', 'userId'] },
  flashcards: { keyPath: 'id', indexes: ['lectureId', 'dueDate', 'status'] },
  bookmarks: { keyPath: 'id', indexes: ['lectureId', 'timestamp'] },
  confusionVotes: { keyPath: 'id', indexes: ['lectureId', 'segmentId'] },
  syncQueue: { keyPath: 'id', indexes: ['type', 'createdAt', 'status'] }
};
```

**Acceptance Criteria:**
- [ ] `npm test storage/db.test.js` passes
- [ ] Database opens without errors
- [ ] All 10 stores created with correct indexes
- [ ] Connection pooling works (max 1 connection)

---

### Day 2: Data Models + Validation (4h)

**Data Models (3h)**
- [ ] Create `src/vl_jepa/api/static/storage/models.js`
- [ ] Define all entity interfaces with JSDoc types
- [ ] Implement factory functions with defaults
- [ ] Add validation functions

**Files to Create:**
```
src/vl_jepa/api/static/storage/
├── models.js       # Data models + factories
└── models.test.js  # Validation tests
```

**Core Models:**
```javascript
/**
 * @typedef {Object} Lecture
 * @property {string} id - UUID
 * @property {string|null} courseId - Parent course
 * @property {string} title
 * @property {number} duration - Seconds
 * @property {'pending'|'processing'|'completed'|'failed'|'archived'} status
 * @property {number} watchProgress - 0-100
 * @property {number} createdAt - Timestamp
 * @property {number} updatedAt - Timestamp
 */

/**
 * @typedef {Object} Flashcard
 * @property {string} id - UUID
 * @property {string} lectureId
 * @property {string} front - Question/prompt
 * @property {string} back - Answer
 * @property {number} interval - SM-2 days
 * @property {number} easeFactor - SM-2 ease (default 2.5)
 * @property {number} dueDate - Next review timestamp
 * @property {'new'|'learning'|'review'|'mastered'} status
 */
```

**Acceptance Criteria:**
- [ ] All 10 entity types defined with JSDoc
- [ ] Factory functions create valid defaults
- [ ] Validation rejects invalid data
- [ ] 100% test coverage on models

---

### Day 3: Repository Pattern (4h)

**Repositories (4h)**
- [ ] Create `src/vl_jepa/api/static/storage/repositories.js`
- [ ] Implement CRUD for all entities
- [ ] Add query methods (getByLecture, getDueFlashcards, etc.)
- [ ] Implement cascade delete

**Files to Create:**
```
src/vl_jepa/api/static/storage/
├── repositories.js      # Repository implementations
└── repositories.test.js # Integration tests
```

**Repository API:**
```javascript
// Example: FlashcardRepository
const FlashcardRepository = {
  async create(flashcard) { },
  async getById(id) { },
  async getByLecture(lectureId) { },
  async getDue(limit = 20) { },
  async update(id, updates) { },
  async delete(id) { },
  async reviewCard(id, quality) { } // SM-2 algorithm
};
```

**SM-2 Algorithm (canonical implementation):**
```javascript
function calculateSM2(card, quality) {
  // quality: 0-5 (0-2 = fail, 3 = hard, 4 = good, 5 = easy)
  let { interval, easeFactor, repetitions } = card;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);

    repetitions += 1;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return { interval, easeFactor, repetitions, dueDate: Date.now() + interval * 86400000 };
}
```

**Acceptance Criteria:**
- [ ] CRUD operations work for all 10 entities
- [ ] SM-2 algorithm matches spec
- [ ] Cascade delete removes related records
- [ ] Query performance < 50ms for 1000 records

---

### Day 4: Offline Sync Strategy (4h)

**Sync Manager (4h)**
- [ ] Create `src/vl_jepa/api/static/storage/sync.js`
- [ ] Implement sync queue for offline changes
- [ ] Add online/offline detection
- [ ] Implement conflict resolution (last-write-wins)

**Files to Create:**
```
src/vl_jepa/api/static/storage/
├── sync.js       # Sync manager
└── sync.test.js  # Sync tests
```

**Sync Queue Schema:**
```javascript
/**
 * @typedef {Object} SyncQueueItem
 * @property {string} id
 * @property {'create'|'update'|'delete'} operation
 * @property {string} entityType - 'lecture', 'flashcard', etc.
 * @property {string} entityId
 * @property {Object} payload - Changed data
 * @property {number} createdAt
 * @property {'pending'|'syncing'|'failed'|'completed'} status
 * @property {number} retryCount
 */
```

**Note:** Server endpoints (/api/sync) are NOT implemented yet. Sync manager will queue changes locally and sync when endpoints exist.

**Acceptance Criteria:**
- [ ] Changes queue when offline
- [ ] Auto-sync triggers when online
- [ ] Conflict resolution handles concurrent edits
- [ ] Failed syncs retry with exponential backoff

---

### Day 5: Migration + Integration Test (4h)

**Migration System (2h)**
- [ ] Create `src/vl_jepa/api/static/storage/migrations.js`
- [ ] Implement schema versioning
- [ ] Add localStorage migration for existing users

**Integration Test (2h)**
- [ ] Create `src/vl_jepa/api/static/storage/index.js` (unified entry point)
- [ ] Write end-to-end storage test
- [ ] Document API in JSDoc

**Files to Create:**
```
src/vl_jepa/api/static/storage/
├── migrations.js  # Schema migrations
├── index.js       # Unified API export
└── e2e.test.js    # End-to-end test
```

**Acceptance Criteria:**
- [ ] Migration from v1 to v2 works
- [ ] localStorage data imported correctly
- [ ] Unified API documented
- [ ] All tests pass

---

## Week 10B: Design System

**Theme:** Extended design tokens + animation framework
**Hours:** 20h
**Agent:** frontend-design

### Day 1: Design Tokens Extension (4h)

**Extended Tokens (4h)**
- [ ] Create `src/vl_jepa/api/static/tokens-v2.css`
- [ ] Add learning-specific colors (mastery levels, confusion)
- [ ] Add 3D shadow tokens for flashcard flip
- [ ] Extend spacing scale

**Files to Create:**
```
src/vl_jepa/api/static/
├── tokens-v2.css  # Extended design tokens
```

**New Token Categories:**
```css
/* Mastery Levels */
--color-mastery-new: var(--slate-400);
--color-mastery-learning: var(--orange-500);
--color-mastery-review: var(--yellow-500);
--color-mastery-known: var(--green-500);
--color-mastery-mastered: var(--cyan-500);

/* Confusion Heatmap */
--color-confusion-low: var(--green-500);
--color-confusion-medium: var(--yellow-500);
--color-confusion-high: var(--orange-500);
--color-confusion-critical: var(--red-500);

/* 3D Effects */
--shadow-3d-front: 0 4px 6px -1px rgba(0,0,0,0.1);
--shadow-3d-back: 0 -4px 6px -1px rgba(0,0,0,0.1);
--perspective-card: 1000px;
```

**Acceptance Criteria:**
- [ ] All tokens follow naming convention
- [ ] Dark mode variants defined
- [ ] Contrast ratios pass WCAG AA

---

### Day 2: Typography + Spacing (4h)

**Typography System (2h)**
- [ ] Extend font scale for learning UI
- [ ] Add fluid typography (clamp)

**Spacing Utilities (2h)**
- [ ] Create `src/vl_jepa/api/static/utilities.css`
- [ ] Add atomic utility classes

**Acceptance Criteria:**
- [ ] Typography scale documented
- [ ] Utilities follow BEM naming
- [ ] File size < 10KB

---

### Day 3: Animation Library (4h)

**Core Animations (4h)**
- [ ] Create `src/vl_jepa/api/static/animations-v2.css`
- [ ] Flashcard flip (3D transform)
- [ ] Progress celebrations
- [ ] Micro-interactions

**Key Animations:**
```css
@keyframes flip-to-back {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(180deg); }
}

@keyframes celebration-confetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
}

@keyframes pulse-success {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

**Acceptance Criteria:**
- [ ] All animations 60fps
- [ ] Reduced motion variants
- [ ] GPU-accelerated (transform/opacity only)

---

### Day 4: Dark Mode + Accessibility (4h)

**Dark Mode (2h)**
- [ ] Extend dark mode tokens
- [ ] Test all new components in dark mode

**Accessibility (2h)**
- [ ] Create `src/vl_jepa/api/static/accessibility.css`
- [ ] Focus indicators
- [ ] High contrast mode support

**Acceptance Criteria:**
- [ ] WCAG AA compliance
- [ ] Keyboard navigation works
- [ ] Screen reader tested

---

### Day 5: Component Patterns + Integration (4h)

**Component Patterns (2h)**
- [ ] Create `src/vl_jepa/api/static/playground-components.css`
- [ ] Flashcard component styles
- [ ] Progress ring styles
- [ ] Library card styles

**Storage Integration (2h)**
- [ ] Document how CSS classes map to storage states
- [ ] Create example: flashcard with mastery level styling

**Integration Example:**
```javascript
// How storage state connects to CSS classes
function getFlashcardClass(flashcard) {
  const masteryClass = `sp-card--${flashcard.status}`; // sp-card--new, sp-card--mastered
  return `sp-flashcard ${masteryClass}`;
}
```

**Acceptance Criteria:**
- [ ] All component patterns documented
- [ ] Storage-to-CSS mapping clear
- [ ] Lighthouse Accessibility >= 95

---

## Quality Gate Checklist

### Week 10A Exit Criteria
- [ ] All storage tests pass
- [ ] IndexedDB works in Chrome, Firefox, Edge **(Safari deferred to Week 11 — see N6)**
- [ ] SM-2 algorithm verified against spec
- [ ] Migration system tested
- [ ] API documented in JSDoc

### Week 10B Exit Criteria
- [ ] All CSS validates
- [ ] Animations 60fps
- [ ] Dark mode complete
- [ ] WCAG AA compliance
- [ ] Storage integration documented

### Final Gate (End of Week 10B)
- [ ] Hostile review approval
- [ ] No critical issues
- [ ] Ready for Week 11 (Flashcard System)

---

## Dependencies

```
Week 10A Day 1 (test infra) → All other Week 10A tasks
Week 10A Day 2 (models) → Day 3 (repositories)
Week 10A Day 3 (repositories) → Day 4 (sync)
Week 10A complete → Week 10B Day 5 (integration)
```

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| IndexedDB browser bugs | Medium | High | Use feature detection, fallback to localStorage |
| Animation jank | Medium | Medium | Test on low-end devices, use CSS only |
| Safari compatibility | Low | Medium | **DEFERRED to Week 11** — Windows dev environment cannot test Safari; will use BrowserStack in Week 11 |
| Scope creep | High | High | Strict task boundaries, defer extras |

---

## File Structure (Canonical)

```
src/vl_jepa/api/static/
├── storage/
│   ├── db.js           # IndexedDB wrapper
│   ├── models.js       # Data models
│   ├── repositories.js # CRUD operations
│   ├── sync.js         # Offline sync
│   ├── migrations.js   # Schema versioning
│   └── index.js        # Unified API
├── tokens-v2.css       # Extended design tokens
├── utilities.css       # Atomic utilities
├── animations-v2.css   # Animation library
├── accessibility.css   # A11y styles
└── playground-components.css  # Component patterns
```

---

*Unified plan addressing all hostile review critical issues*
*Ready for re-review*
