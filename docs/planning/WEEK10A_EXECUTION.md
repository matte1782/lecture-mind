# Week 10A Execution Plan: Storage Foundation

**Version:** 1.0.0
**Duration:** 5 days @ 4h/day = 20h
**Status:** READY FOR EXECUTION
**Canonical Source:** WEEK10_UNIFIED_PLAN.md v1.1
**Agent:** architect

---

## Executive Summary

Build the IndexedDB storage layer with offline-first architecture. This week establishes the data persistence foundation that all future features (flashcards, progress tracking, sync) will depend on.

**Critical Path:** Day 1 (test infra) -> Day 2 (models) -> Day 3 (repositories) -> Day 4 (sync) -> Day 5 (integration)

---

## Day 1: Test Infrastructure + IndexedDB Core

**Hours:** 4h
**Focus:** Set up JS test infrastructure and create the core IndexedDB wrapper

### Tasks

- [ ] T1.1: Install fake-indexeddb and configure Jest (1h)
- [ ] T1.2: Create LectureMindDB class with connection management (2h)
- [ ] T1.3: Create all 10 object stores with indexes (1h)

### Deliverables

- `src/vl_jepa/api/static/storage/db.js` - IndexedDB wrapper with LectureMindDB class
- `src/vl_jepa/api/static/storage/db.test.js` - Unit tests for database operations

### Object Stores to Create

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

### Acceptance Criteria

- [ ] `npm test storage/db.test.js` passes
- [ ] Database opens without errors
- [ ] All 10 stores created with correct indexes
- [ ] Connection pooling works (max 1 connection)
- [ ] Test infrastructure verified working

### Test Commands

```bash
# Install test dependencies
npm install --save-dev fake-indexeddb jest

# Run Day 1 tests
npm test -- storage/db.test.js
```

### Prerequisites

- [ ] Node.js and npm installed
- [ ] Project has package.json

---

## Day 2: Data Models + Validation

**Hours:** 4h
**Focus:** Define all entity interfaces with JSDoc types and validation

### Tasks

- [ ] T2.1: Define all 10 entity types with JSDoc (2h)
- [ ] T2.2: Implement factory functions with defaults (1h)
- [ ] T2.3: Add validation functions for all entities (1h)

### Deliverables

- `src/vl_jepa/api/static/storage/models.js` - Data models and factory functions
- `src/vl_jepa/api/static/storage/models.test.js` - Validation tests

### Core Models to Define

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

### Acceptance Criteria

- [ ] All 10 entity types defined with JSDoc
- [ ] Factory functions create valid defaults
- [ ] Validation rejects invalid data (missing required fields, wrong types)
- [ ] 100% test coverage on models

### Test Commands

```bash
# Run Day 2 tests
npm test -- storage/models.test.js

# Check coverage
npm test -- --coverage storage/models.test.js
```

### Dependencies

- Day 1 complete (test infrastructure working)

---

## Day 3: Repository Pattern

**Hours:** 4h
**Focus:** Implement CRUD operations and queries for all entities

### Tasks

- [ ] T3.1: Implement base repository with CRUD operations (1.5h)
- [ ] T3.2: Add specialized repositories for each entity (1.5h)
- [ ] T3.3: Implement SM-2 algorithm for flashcard reviews (0.5h)
- [ ] T3.4: Implement cascade delete for related records (0.5h)

### Deliverables

- `src/vl_jepa/api/static/storage/repositories.js` - Repository implementations
- `src/vl_jepa/api/static/storage/repositories.test.js` - Integration tests

### Repository API to Implement

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

### SM-2 Algorithm (canonical implementation)

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

### Acceptance Criteria

- [ ] CRUD operations work for all 10 entities
- [ ] SM-2 algorithm matches spec exactly
- [ ] Cascade delete removes related records (e.g., deleting lecture removes its flashcards)
- [ ] Query performance < 50ms for 1000 records

### Test Commands

```bash
# Run Day 3 tests
npm test -- storage/repositories.test.js

# Run performance test
npm test -- storage/repositories.test.js --testNamePattern="performance"
```

### Dependencies

- Day 2 complete (models defined)

---

## Day 4: Offline Sync Strategy

**Hours:** 4h
**Focus:** Implement sync queue for offline changes with conflict resolution

### Tasks

- [ ] T4.1: Create sync queue manager (1.5h)
- [ ] T4.2: Add online/offline detection (1h)
- [ ] T4.3: Implement conflict resolution (last-write-wins) (1h)
- [ ] T4.4: Add retry with exponential backoff (0.5h)

### Deliverables

- `src/vl_jepa/api/static/storage/sync.js` - Sync manager
- `src/vl_jepa/api/static/storage/sync.test.js` - Sync tests

### Sync Queue Schema

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

### Implementation Notes

- Server endpoints (/api/sync) are NOT implemented yet
- Sync manager will queue changes locally
- Actual sync will trigger when endpoints exist in future weeks

### Acceptance Criteria

- [ ] Changes queue when offline
- [ ] Auto-sync triggers when online (navigator.onLine)
- [ ] Conflict resolution handles concurrent edits
- [ ] Failed syncs retry with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- [ ] Max retry count = 5 before marking as failed

### Test Commands

```bash
# Run Day 4 tests
npm test -- storage/sync.test.js

# Test offline behavior
npm test -- storage/sync.test.js --testNamePattern="offline"
```

### Dependencies

- Day 3 complete (repositories working)

---

## Day 5: Migration + Integration Test

**Hours:** 4h
**Focus:** Schema versioning, localStorage migration, and unified API

### Tasks

- [ ] T5.1: Implement schema versioning system (1h)
- [ ] T5.2: Add localStorage migration for existing users (1h)
- [ ] T5.3: Create unified API entry point (1h)
- [ ] T5.4: Write end-to-end storage test (1h)

### Deliverables

- `src/vl_jepa/api/static/storage/migrations.js` - Schema migrations
- `src/vl_jepa/api/static/storage/index.js` - Unified API export
- `src/vl_jepa/api/static/storage/e2e.test.js` - End-to-end test

### Migration System Design

```javascript
// migrations.js
const CURRENT_VERSION = 2;

const migrations = {
  1: async (db) => {
    // Initial schema - 10 stores
  },
  2: async (db) => {
    // Future migrations go here
  }
};

async function migrate(db, fromVersion, toVersion) {
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    await migrations[v](db);
  }
}
```

### Unified API Design

```javascript
// index.js - Unified entry point
export { LectureMindDB } from './db.js';
export * from './models.js';
export * from './repositories.js';
export { SyncManager } from './sync.js';
export { migrate, CURRENT_VERSION } from './migrations.js';
```

### Acceptance Criteria

- [ ] Migration from v1 to v2 works
- [ ] localStorage data imported correctly
- [ ] Unified API documented with JSDoc
- [ ] All tests pass (100% of storage tests)
- [ ] E2E test covers: create lecture -> add flashcard -> review -> delete

### Test Commands

```bash
# Run all storage tests
npm test -- storage/

# Run E2E test specifically
npm test -- storage/e2e.test.js

# Run with coverage
npm test -- --coverage storage/
```

### Dependencies

- Days 1-4 complete

---

## Week 10A Exit Criteria

Before proceeding to Week 10B, verify:

- [ ] All storage tests pass (`npm test -- storage/`)
- [ ] IndexedDB works in Chrome, Firefox, Edge (Safari deferred to Week 11)
- [ ] SM-2 algorithm verified against spec (test_sm2 passes)
- [ ] Migration system tested (v1 -> v2 migration works)
- [ ] API documented in JSDoc (all public functions documented)
- [ ] No console errors in browser dev tools

---

## Final File Structure

```
src/vl_jepa/api/static/storage/
├── db.js             # IndexedDB wrapper (Day 1)
├── db.test.js        # Unit tests (Day 1)
├── models.js         # Data models (Day 2)
├── models.test.js    # Validation tests (Day 2)
├── repositories.js   # CRUD operations (Day 3)
├── repositories.test.js  # Integration tests (Day 3)
├── sync.js           # Offline sync (Day 4)
├── sync.test.js      # Sync tests (Day 4)
├── migrations.js     # Schema versioning (Day 5)
├── index.js          # Unified API (Day 5)
└── e2e.test.js       # End-to-end test (Day 5)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| IndexedDB browser bugs | Use feature detection, fallback to localStorage |
| Test flakiness | Use fake-indexeddb for deterministic tests |
| Scope creep | Strict task boundaries, defer extras to Week 11 |
| Safari compatibility | DEFERRED to Week 11 (BrowserStack testing) |

---

## Handoff

After completing Week 10A:

1. Run full test suite: `npm test -- storage/`
2. Update WEEK10_UNIFIED_PLAN.md exit criteria checkboxes
3. Request hostile review: `/review:hostile docs/planning/WEEK10A_EXECUTION.md`
4. Proceed to Week 10B: Design System

---

*PLANNER v1.0.0 - A good plan is the best debugging tool.*
