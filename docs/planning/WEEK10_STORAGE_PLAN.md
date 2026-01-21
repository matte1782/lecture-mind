# Week 10 Plan: IndexedDB Storage Layer + Multi-Lecture Data Model

> **⚠️ SUPERSEDED**: This document has been superseded by `WEEK10_UNIFIED_PLAN.md`.
> Do NOT use this document for implementation. Refer to the unified plan only.
> — Marked 2026-01-21 per hostile-reviewer condition N1

**Duration**: 5 days @ 4 hours/day = 20 hours total
**Goal**: Design and implement browser-based storage infrastructure for Student Playground
**Status**: ~~READY FOR EXECUTION~~ **SUPERSEDED**
**Author**: ARCHITECT
**Version**: 1.0.0

---

## Executive Summary

Week 10 establishes the storage foundation for v0.4.0 Student Playground. This includes:

1. **IndexedDB wrapper** for reliable browser-side persistence
2. **Multi-lecture data model** supporting courses, lectures, segments, and progress
3. **Offline sync strategy** with conflict resolution
4. **Schema versioning** for future migrations

All deliverables must pass hostile review before Week 11 begins.

---

## Prerequisites (Complete Before Day 1)

### P1: Verify Browser Support
```javascript
// Test in browser console
const dbSupport = 'indexedDB' in window;
console.assert(dbSupport, 'IndexedDB not supported');
```

### P2: Review Existing Frontend Architecture
- Read `src/vl_jepa/api/static/app.js` (current state management)
- Understand localStorage usage for bookmarks/confusion votes

### P3: Decide on Library vs. Vanilla
**Decision**: Use vanilla IndexedDB with typed wrapper (no external library)
- Rationale: Avoid dependency bloat, maintain full control
- Alternative considered: Dexie.js (rejected: 50KB+ bundle size)

---

## Data Model Overview

```
                    ┌─────────────────────────────────────────────────┐
                    │              LECTURE MIND STORAGE               │
                    ├─────────────────────────────────────────────────┤
                    │                                                 │
                    │  ┌─────────────┐      ┌─────────────┐          │
                    │  │   Course    │──1:N─│   Lecture   │          │
                    │  │             │      │             │          │
                    │  │ - id        │      │ - id        │          │
                    │  │ - name      │      │ - courseId  │          │
                    │  │ - color     │      │ - title     │          │
                    │  │ - createdAt │      │ - videoBlob │          │
                    │  └─────────────┘      └──────┬──────┘          │
                    │                              │                  │
                    │                              │1:N               │
                    │                              ▼                  │
                    │  ┌─────────────┐      ┌─────────────┐          │
                    │  │   Segment   │◄─────│   Event     │          │
                    │  │             │      │             │          │
                    │  │ - id        │      │ - id        │          │
                    │  │ - lectureId │      │ - lectureId │          │
                    │  │ - startTime │      │ - timestamp │          │
                    │  │ - text      │      │ - confidence│          │
                    │  └─────────────┘      └─────────────┘          │
                    │                                                 │
                    │  ┌─────────────┐      ┌─────────────┐          │
                    │  │  Progress   │      │  Flashcard  │          │
                    │  │             │      │             │          │
                    │  │ - lectureId │      │ - id        │          │
                    │  │ - segmentId │      │ - lectureId │          │
                    │  │ - watched   │      │ - front     │          │
                    │  │ - lastPos   │      │ - back      │          │
                    │  └─────────────┘      │ - dueDate   │          │
                    │                       │ - interval  │          │
                    │                       └─────────────┘          │
                    │                                                 │
                    │  ┌─────────────┐      ┌─────────────┐          │
                    │  │  Bookmark   │      │  Confusion  │          │
                    │  │             │      │  Vote       │          │
                    │  │ - id        │      │ - segmentId │          │
                    │  │ - lectureId │      │ - timestamp │          │
                    │  │ - timestamp │      │ - synced    │          │
                    │  │ - type      │      └─────────────┘          │
                    │  │ - note      │                                │
                    │  └─────────────┘                                │
                    │                                                 │
                    │  ┌─────────────────────────────────────────┐   │
                    │  │              SyncQueue                   │   │
                    │  │ - pending uploads, confusion votes       │   │
                    │  └─────────────────────────────────────────┘   │
                    │                                                 │
                    └─────────────────────────────────────────────────┘
```

---

## Day 1: IndexedDB Wrapper Foundation (4h)

### Objectives
Build a type-safe, promise-based wrapper around IndexedDB with error handling and connection management.

### Deliverables

**File: `src/vl_jepa/api/static/storage/db.js`**

```javascript
/**
 * Lecture Mind - IndexedDB Storage Layer
 *
 * Provides type-safe, promise-based access to browser storage.
 * Handles connection lifecycle, versioning, and error recovery.
 *
 * @module storage/db
 */

// Database configuration
const DB_NAME = 'lectureMind';
const DB_VERSION = 1;

// Store names (constants for type safety)
const STORES = Object.freeze({
  COURSES: 'courses',
  LECTURES: 'lectures',
  SEGMENTS: 'segments',
  EVENTS: 'events',
  PROGRESS: 'progress',
  FLASHCARDS: 'flashcards',
  BOOKMARKS: 'bookmarks',
  CONFUSION_VOTES: 'confusionVotes',
  SYNC_QUEUE: 'syncQueue',
  SETTINGS: 'settings',
});
```

### TypeScript-like Interfaces (for documentation)

```typescript
// Core database wrapper interface
interface LectureMindDB {
  // Connection management
  open(): Promise<IDBDatabase>;
  close(): void;
  isOpen(): boolean;

  // Generic CRUD operations
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined>;
  getAll<T>(store: StoreName, query?: IDBKeyRange): Promise<T[]>;
  put<T>(store: StoreName, value: T): Promise<IDBValidKey>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  clear(store: StoreName): Promise<void>;

  // Transactions
  transaction(stores: StoreName[], mode: IDBTransactionMode): IDBTransaction;

  // Index queries
  getByIndex<T>(store: StoreName, indexName: string, value: IDBValidKey): Promise<T[]>;

  // Batch operations
  putMany<T>(store: StoreName, values: T[]): Promise<void>;
}

// Store name type union
type StoreName =
  | 'courses'
  | 'lectures'
  | 'segments'
  | 'events'
  | 'progress'
  | 'flashcards'
  | 'bookmarks'
  | 'confusionVotes'
  | 'syncQueue'
  | 'settings';

// Error types
interface StorageError {
  code: 'QUOTA_EXCEEDED' | 'NOT_FOUND' | 'VERSION_MISMATCH' | 'CORRUPTION' | 'UNKNOWN';
  message: string;
  originalError?: Error;
}
```

### Implementation Details

```javascript
/**
 * Creates and manages IndexedDB connection.
 *
 * Usage:
 *   const db = await LectureMindDB.open();
 *   const lecture = await db.get('lectures', lectureId);
 */
class LectureMindDB {
  constructor() {
    this._db = null;
    this._openPromise = null;
  }

  /**
   * Opens database connection with automatic schema creation.
   * Safe to call multiple times (returns cached connection).
   *
   * @returns {Promise<IDBDatabase>}
   * @throws {StorageError} On quota exceeded or browser restrictions
   */
  async open() {
    if (this._db) return this._db;
    if (this._openPromise) return this._openPromise;

    this._openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = this._mapError(request.error);
        this._openPromise = null;
        reject(error);
      };

      request.onsuccess = () => {
        this._db = request.result;
        this._db.onversionchange = () => this._handleVersionChange();
        this._openPromise = null;
        resolve(this._db);
      };

      request.onupgradeneeded = (event) => {
        this._runMigrations(event.target.result, event.oldVersion, event.newVersion);
      };
    });

    return this._openPromise;
  }

  /**
   * Runs schema migrations based on version difference.
   * Each migration is idempotent and atomic.
   */
  _runMigrations(db, oldVersion, newVersion) {
    const migrations = [
      this._migration_v1,  // Initial schema
      // Future: this._migration_v2, etc.
    ];

    for (let v = oldVersion; v < newVersion; v++) {
      if (migrations[v]) {
        migrations[v].call(this, db);
      }
    }
  }

  /**
   * Initial schema creation (v0 -> v1)
   */
  _migration_v1(db) {
    // Courses store
    if (!db.objectStoreNames.contains(STORES.COURSES)) {
      const courseStore = db.createObjectStore(STORES.COURSES, { keyPath: 'id' });
      courseStore.createIndex('name', 'name', { unique: false });
      courseStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Lectures store
    if (!db.objectStoreNames.contains(STORES.LECTURES)) {
      const lectureStore = db.createObjectStore(STORES.LECTURES, { keyPath: 'id' });
      lectureStore.createIndex('courseId', 'courseId', { unique: false });
      lectureStore.createIndex('createdAt', 'createdAt', { unique: false });
      lectureStore.createIndex('title', 'title', { unique: false });
    }

    // Segments store
    if (!db.objectStoreNames.contains(STORES.SEGMENTS)) {
      const segmentStore = db.createObjectStore(STORES.SEGMENTS, { keyPath: 'id' });
      segmentStore.createIndex('lectureId', 'lectureId', { unique: false });
      segmentStore.createIndex('startTime', 'startTime', { unique: false });
    }

    // Events store
    if (!db.objectStoreNames.contains(STORES.EVENTS)) {
      const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
      eventStore.createIndex('lectureId', 'lectureId', { unique: false });
      eventStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Progress store (composite key: lectureId + segmentId)
    if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
      const progressStore = db.createObjectStore(STORES.PROGRESS, { keyPath: ['lectureId', 'segmentId'] });
      progressStore.createIndex('lectureId', 'lectureId', { unique: false });
      progressStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    }

    // Flashcards store
    if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
      const flashcardStore = db.createObjectStore(STORES.FLASHCARDS, { keyPath: 'id' });
      flashcardStore.createIndex('lectureId', 'lectureId', { unique: false });
      flashcardStore.createIndex('dueDate', 'dueDate', { unique: false });
      flashcardStore.createIndex('status', 'status', { unique: false });
    }

    // Bookmarks store
    if (!db.objectStoreNames.contains(STORES.BOOKMARKS)) {
      const bookmarkStore = db.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' });
      bookmarkStore.createIndex('lectureId', 'lectureId', { unique: false });
      bookmarkStore.createIndex('type', 'type', { unique: false });
      bookmarkStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Confusion votes store
    if (!db.objectStoreNames.contains(STORES.CONFUSION_VOTES)) {
      const confusionStore = db.createObjectStore(STORES.CONFUSION_VOTES, { keyPath: 'id' });
      confusionStore.createIndex('lectureId', 'lectureId', { unique: false });
      confusionStore.createIndex('segmentId', 'segmentId', { unique: false });
      confusionStore.createIndex('synced', 'synced', { unique: false });
    }

    // Sync queue store
    if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
      const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
      syncStore.createIndex('type', 'type', { unique: false });
      syncStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Settings store (key-value)
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
    }
  }
}
```

### Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC1.1 | Database opens without error in Chrome, Firefox, Safari | Manual test in each browser |
| AC1.2 | All 10 object stores created with correct indexes | Inspect via DevTools > Application > IndexedDB |
| AC1.3 | `get()`, `put()`, `delete()` work for all stores | Unit tests with mock data |
| AC1.4 | Error handling maps IndexedDB errors to StorageError | Test with quota simulation |
| AC1.5 | Connection survives page refresh | Open, refresh, verify data persists |

### Test Requirements

**File: `tests/js/storage/db.test.js`** (using Jest or similar)

```javascript
describe('LectureMindDB', () => {
  let db;

  beforeEach(async () => {
    db = new LectureMindDB();
    await db.open();
  });

  afterEach(async () => {
    await db.clear(STORES.COURSES);
    db.close();
  });

  test('opens database and creates stores', async () => {
    const storeNames = Array.from(db._db.objectStoreNames);
    expect(storeNames).toContain('courses');
    expect(storeNames).toContain('lectures');
    expect(storeNames.length).toBe(10);
  });

  test('put and get round-trip', async () => {
    const course = { id: 'course-1', name: 'CS101', createdAt: Date.now() };
    await db.put(STORES.COURSES, course);
    const retrieved = await db.get(STORES.COURSES, 'course-1');
    expect(retrieved).toEqual(course);
  });

  test('getAll returns all items', async () => {
    await db.put(STORES.COURSES, { id: '1', name: 'A' });
    await db.put(STORES.COURSES, { id: '2', name: 'B' });
    const all = await db.getAll(STORES.COURSES);
    expect(all.length).toBe(2);
  });

  test('delete removes item', async () => {
    await db.put(STORES.COURSES, { id: '1', name: 'Test' });
    await db.delete(STORES.COURSES, '1');
    const result = await db.get(STORES.COURSES, '1');
    expect(result).toBeUndefined();
  });

  test('getByIndex queries by index', async () => {
    await db.put(STORES.LECTURES, { id: 'l1', courseId: 'c1', title: 'Lecture 1' });
    await db.put(STORES.LECTURES, { id: 'l2', courseId: 'c1', title: 'Lecture 2' });
    await db.put(STORES.LECTURES, { id: 'l3', courseId: 'c2', title: 'Lecture 3' });

    const c1Lectures = await db.getByIndex(STORES.LECTURES, 'courseId', 'c1');
    expect(c1Lectures.length).toBe(2);
  });
});
```

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/vl_jepa/api/static/storage/db.js` | CREATE | IndexedDB wrapper |
| `src/vl_jepa/api/static/storage/constants.js` | CREATE | Store names, DB version |
| `tests/js/storage/db.test.js` | CREATE | Unit tests |

---

## Day 2: Multi-Lecture Data Model (4h)

### Objectives
Define complete TypeScript-like interfaces for all entities with validation, relationships, and factory functions.

### Deliverables

**File: `src/vl_jepa/api/static/storage/models.js`**

### Entity Interfaces

```typescript
// ===================================================
// CORE ENTITIES
// ===================================================

/**
 * Course - container for related lectures
 */
interface Course {
  id: string;              // UUID v4
  name: string;            // e.g., "CS 101: Intro to Programming"
  description?: string;    // Optional course description
  color: string;           // Hex color for UI (e.g., "#4A90D9")
  createdAt: number;       // Unix timestamp (ms)
  updatedAt: number;       // Unix timestamp (ms)
  lectureCount: number;    // Denormalized count for performance
  totalDuration: number;   // Total seconds of all lectures
}

/**
 * Lecture - single video with associated data
 */
interface Lecture {
  id: string;              // UUID v4
  courseId: string | null; // FK to Course (null = uncategorized)
  title: string;           // User-provided or extracted title
  description?: string;

  // Video metadata
  videoBlob?: Blob;        // Stored only if offline caching enabled
  videoBlobUrl?: string;   // URL if video hosted externally
  duration: number;        // Seconds
  width: number;           // Pixels
  height: number;          // Pixels
  fps: number;             // Frames per second

  // Processing state
  status: LectureStatus;
  processingProgress: number; // 0.0 - 1.0
  processedAt?: number;    // When processing completed

  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;  // For LRU cleanup

  // Statistics (denormalized)
  segmentCount: number;
  eventCount: number;
  watchProgress: number;   // 0.0 - 1.0 (percentage watched)
}

type LectureStatus =
  | 'pending'      // Uploaded, not processed
  | 'processing'   // Currently being analyzed
  | 'completed'    // Ready to view
  | 'failed'       // Processing error
  | 'archived';    // Hidden from main view

/**
 * Segment - a portion of transcript
 */
interface Segment {
  id: string;              // UUID v4
  lectureId: string;       // FK to Lecture

  // Timing
  startTime: number;       // Seconds from video start
  endTime: number;         // Seconds from video start

  // Content
  text: string;            // Transcript text
  speaker?: string;        // Speaker identification (future)

  // Computed
  duration: number;        // endTime - startTime
  wordCount: number;       // For reading time estimates
}

/**
 * Event - detected topic change or significant moment
 */
interface Event {
  id: string;              // UUID v4
  lectureId: string;       // FK to Lecture
  segmentId?: string;      // FK to Segment (optional link)

  timestamp: number;       // Seconds from video start
  confidence: number;      // 0.0 - 1.0
  eventType: EventType;

  // Optional metadata
  description?: string;    // Auto-generated or user-provided
}

type EventType =
  | 'topic_change'   // Semantic shift detected
  | 'slide_change'   // Visual slide transition
  | 'speaker_change' // Different speaker
  | 'user_marked';   // Manual user marker

// ===================================================
// USER INTERACTION ENTITIES
// ===================================================

/**
 * Progress - tracks viewing progress per segment
 */
interface Progress {
  lectureId: string;       // FK to Lecture (composite key part 1)
  segmentId: string;       // FK to Segment (composite key part 2)

  watched: boolean;        // Has segment been watched?
  watchCount: number;      // Times segment was viewed
  lastPosition: number;    // Last playback position within segment
  lastAccessed: number;    // Timestamp of last access

  // Optional engagement metrics
  rewatchCount: number;    // Times segment was re-watched
  confusionMarked: boolean; // Did user mark as confusing?
}

/**
 * Flashcard - for spaced repetition study
 */
interface Flashcard {
  id: string;              // UUID v4
  lectureId: string;       // FK to Lecture
  segmentId?: string;      // FK to Segment (if auto-generated)

  // Content
  front: string;           // Question or prompt
  back: string;            // Answer
  source: FlashcardSource;

  // Spaced repetition (SM-2 algorithm)
  status: FlashcardStatus;
  interval: number;        // Days until next review
  easeFactor: number;      // SM-2 ease factor (default 2.5)
  repetitions: number;     // Successful reviews count
  dueDate: number;         // Next review timestamp (ms)
  lastReviewedAt?: number;

  // Metadata
  createdAt: number;
  tags: string[];          // User-defined tags
}

type FlashcardSource = 'auto' | 'manual' | 'imported';
type FlashcardStatus = 'new' | 'learning' | 'review' | 'suspended';

/**
 * Bookmark - user-marked moment in lecture
 */
interface Bookmark {
  id: string;              // UUID v4
  lectureId: string;       // FK to Lecture

  timestamp: number;       // Seconds from video start
  type: BookmarkType;
  note?: string;           // User note (optional)

  createdAt: number;
  color?: string;          // Custom color override
}

type BookmarkType = 'important' | 'question' | 'insight' | 'todo' | 'custom';

/**
 * ConfusionVote - anonymous confusion marker for analytics
 */
interface ConfusionVote {
  id: string;              // UUID v4
  lectureId: string;       // FK to Lecture
  segmentId: string;       // FK to Segment

  timestamp: number;       // When vote was cast
  synced: boolean;         // Has been sent to server?

  // Anonymous - no user ID stored
}

// ===================================================
// SYNC ENTITIES
// ===================================================

/**
 * SyncQueueItem - pending operation for offline sync
 */
interface SyncQueueItem {
  id?: number;             // Auto-increment key
  type: SyncOperationType;
  store: StoreName;
  data: unknown;           // Payload to sync

  createdAt: number;
  attempts: number;        // Retry count
  lastAttemptAt?: number;
  error?: string;          // Last error message
}

type SyncOperationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'confusion_vote';

/**
 * Settings - key-value user preferences
 */
interface Setting {
  key: string;             // Primary key
  value: unknown;          // JSON-serializable value
  updatedAt: number;
}

// Known setting keys
type SettingKey =
  | 'theme'                // 'light' | 'dark' | 'system'
  | 'offlineCaching'       // boolean
  | 'flashcardDailyGoal'   // number
  | 'lastSyncAt'           // number (timestamp)
  | 'userId'               // string (anonymous ID for analytics)
  | 'studyStreak';         // number (consecutive days)
```

### Factory Functions

```javascript
// File: src/vl_jepa/api/static/storage/models.js

/**
 * Generates a UUID v4.
 * @returns {string}
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Creates a new Course with defaults.
 * @param {Partial<Course>} data
 * @returns {Course}
 */
function createCourse(data) {
  const now = Date.now();
  return {
    id: data.id || generateId(),
    name: data.name || 'Untitled Course',
    description: data.description || '',
    color: data.color || generateRandomColor(),
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    lectureCount: data.lectureCount || 0,
    totalDuration: data.totalDuration || 0,
  };
}

/**
 * Creates a new Lecture with defaults.
 * @param {Partial<Lecture>} data
 * @returns {Lecture}
 */
function createLecture(data) {
  const now = Date.now();
  return {
    id: data.id || generateId(),
    courseId: data.courseId || null,
    title: data.title || 'Untitled Lecture',
    description: data.description || '',
    videoBlob: data.videoBlob,
    videoBlobUrl: data.videoBlobUrl,
    duration: data.duration || 0,
    width: data.width || 0,
    height: data.height || 0,
    fps: data.fps || 0,
    status: data.status || 'pending',
    processingProgress: data.processingProgress || 0,
    processedAt: data.processedAt,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    lastAccessedAt: data.lastAccessedAt || now,
    segmentCount: data.segmentCount || 0,
    eventCount: data.eventCount || 0,
    watchProgress: data.watchProgress || 0,
  };
}

/**
 * Creates a new Flashcard with SM-2 defaults.
 * @param {Partial<Flashcard>} data
 * @returns {Flashcard}
 */
function createFlashcard(data) {
  const now = Date.now();
  return {
    id: data.id || generateId(),
    lectureId: data.lectureId,
    segmentId: data.segmentId,
    front: data.front || '',
    back: data.back || '',
    source: data.source || 'manual',
    status: data.status || 'new',
    interval: data.interval || 0,
    easeFactor: data.easeFactor || 2.5,
    repetitions: data.repetitions || 0,
    dueDate: data.dueDate || now,
    lastReviewedAt: data.lastReviewedAt,
    createdAt: data.createdAt || now,
    tags: data.tags || [],
  };
}

/**
 * Creates Progress with defaults.
 * @param {string} lectureId
 * @param {string} segmentId
 * @returns {Progress}
 */
function createProgress(lectureId, segmentId) {
  return {
    lectureId,
    segmentId,
    watched: false,
    watchCount: 0,
    lastPosition: 0,
    lastAccessed: Date.now(),
    rewatchCount: 0,
    confusionMarked: false,
  };
}

// Export all
export {
  generateId,
  createCourse,
  createLecture,
  createFlashcard,
  createProgress,
  // ... other factories
};
```

### Validation Functions

```javascript
/**
 * Validates a Course object.
 * @param {Course} course
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCourse(course) {
  const errors = [];

  if (!course.id || typeof course.id !== 'string') {
    errors.push('id must be a non-empty string');
  }
  if (!course.name || course.name.length === 0) {
    errors.push('name is required');
  }
  if (course.name && course.name.length > 200) {
    errors.push('name must be 200 characters or less');
  }
  if (!isValidHexColor(course.color)) {
    errors.push('color must be a valid hex color');
  }
  if (typeof course.createdAt !== 'number' || course.createdAt <= 0) {
    errors.push('createdAt must be a positive timestamp');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Lecture object.
 * @param {Lecture} lecture
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLecture(lecture) {
  const errors = [];

  if (!lecture.id || typeof lecture.id !== 'string') {
    errors.push('id must be a non-empty string');
  }
  if (!lecture.title || lecture.title.length === 0) {
    errors.push('title is required');
  }
  if (lecture.title && lecture.title.length > 500) {
    errors.push('title must be 500 characters or less');
  }
  if (typeof lecture.duration !== 'number' || lecture.duration < 0) {
    errors.push('duration must be a non-negative number');
  }
  if (!['pending', 'processing', 'completed', 'failed', 'archived'].includes(lecture.status)) {
    errors.push('status must be a valid LectureStatus');
  }
  if (typeof lecture.processingProgress !== 'number' ||
      lecture.processingProgress < 0 ||
      lecture.processingProgress > 1) {
    errors.push('processingProgress must be between 0 and 1');
  }

  return { valid: errors.length === 0, errors };
}

// Helper
function isValidHexColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
```

### Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC2.1 | All 10 entity types have complete interface definitions | Code review |
| AC2.2 | Factory functions produce valid default objects | Unit tests |
| AC2.3 | Validation functions catch all invalid states | Unit tests with edge cases |
| AC2.4 | Relationships (FK) are documented and enforced | Integration tests |
| AC2.5 | JSDoc comments on all exports | ESLint JSDoc rule |

### Test Requirements

```javascript
describe('Model factories', () => {
  test('createCourse generates valid course', () => {
    const course = createCourse({ name: 'Test Course' });
    expect(course.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(course.name).toBe('Test Course');
    expect(course.color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(validateCourse(course).valid).toBe(true);
  });

  test('createLecture with minimal data', () => {
    const lecture = createLecture({ title: 'Lecture 1' });
    expect(lecture.status).toBe('pending');
    expect(lecture.processingProgress).toBe(0);
    expect(validateLecture(lecture).valid).toBe(true);
  });

  test('createFlashcard has SM-2 defaults', () => {
    const card = createFlashcard({
      lectureId: 'lec-1',
      front: 'Q',
      back: 'A'
    });
    expect(card.easeFactor).toBe(2.5);
    expect(card.interval).toBe(0);
    expect(card.status).toBe('new');
  });
});

describe('Model validation', () => {
  test('rejects course with empty name', () => {
    const course = createCourse({ name: '' });
    const result = validateCourse(course);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name is required');
  });

  test('rejects lecture with invalid status', () => {
    const lecture = createLecture({ title: 'Test' });
    lecture.status = 'invalid';
    const result = validateLecture(lecture);
    expect(result.valid).toBe(false);
  });

  test('rejects invalid hex color', () => {
    const course = createCourse({ name: 'Test', color: 'red' });
    const result = validateCourse(course);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('color must be a valid hex color');
  });
});
```

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/vl_jepa/api/static/storage/models.js` | CREATE | Entity definitions, factories, validators |
| `tests/js/storage/models.test.js` | CREATE | Unit tests for models |

---

## Day 3: Repository Pattern + Query API (4h)

### Objectives
Build high-level repository classes that provide semantic operations on the data model (not just CRUD).

### Deliverables

**File: `src/vl_jepa/api/static/storage/repositories.js`**

### Repository Interfaces

```typescript
/**
 * CourseRepository - manages course lifecycle
 */
interface CourseRepository {
  // CRUD
  create(data: Partial<Course>): Promise<Course>;
  getById(id: string): Promise<Course | null>;
  getAll(): Promise<Course[]>;
  update(id: string, changes: Partial<Course>): Promise<Course>;
  delete(id: string): Promise<void>;

  // Queries
  getWithLectures(id: string): Promise<CourseWithLectures>;
  getByName(name: string): Promise<Course[]>;
  getRecent(limit: number): Promise<Course[]>;

  // Statistics
  getStatistics(id: string): Promise<CourseStats>;
}

interface CourseWithLectures extends Course {
  lectures: Lecture[];
}

interface CourseStats {
  totalLectures: number;
  completedLectures: number;
  totalDuration: number;
  totalWatchTime: number;
  overallProgress: number; // 0.0 - 1.0
}

/**
 * LectureRepository - manages lecture lifecycle
 */
interface LectureRepository {
  // CRUD
  create(data: Partial<Lecture>): Promise<Lecture>;
  getById(id: string): Promise<Lecture | null>;
  getByCourseId(courseId: string): Promise<Lecture[]>;
  update(id: string, changes: Partial<Lecture>): Promise<Lecture>;
  delete(id: string): Promise<void>;

  // Queries
  getWithDetails(id: string): Promise<LectureWithDetails>;
  getRecent(limit: number): Promise<Lecture[]>;
  getInProgress(): Promise<Lecture[]>;
  search(query: string): Promise<Lecture[]>;

  // Video management
  saveVideoBlob(id: string, blob: Blob): Promise<void>;
  getVideoBlob(id: string): Promise<Blob | null>;
  deleteVideoBlob(id: string): Promise<void>;

  // Progress
  updateWatchProgress(id: string, progress: number): Promise<void>;
  markAsAccessed(id: string): Promise<void>;
}

interface LectureWithDetails extends Lecture {
  segments: Segment[];
  events: Event[];
  bookmarks: Bookmark[];
}

/**
 * FlashcardRepository - manages flashcards and spaced repetition
 */
interface FlashcardRepository {
  // CRUD
  create(data: Partial<Flashcard>): Promise<Flashcard>;
  getById(id: string): Promise<Flashcard | null>;
  getByLectureId(lectureId: string): Promise<Flashcard[]>;
  update(id: string, changes: Partial<Flashcard>): Promise<Flashcard>;
  delete(id: string): Promise<void>;

  // Study session
  getDue(limit?: number): Promise<Flashcard[]>;
  getDueByLecture(lectureId: string): Promise<Flashcard[]>;
  getDueCount(): Promise<number>;

  // SM-2 updates
  recordReview(id: string, quality: 0 | 1 | 2 | 3 | 4 | 5): Promise<Flashcard>;
  suspend(id: string): Promise<void>;
  unsuspend(id: string): Promise<void>;

  // Batch operations
  createMany(cards: Partial<Flashcard>[]): Promise<Flashcard[]>;
}

/**
 * ProgressRepository - tracks viewing progress
 */
interface ProgressRepository {
  // Get/Set
  getProgress(lectureId: string, segmentId: string): Promise<Progress | null>;
  setProgress(progress: Progress): Promise<void>;

  // Lecture-level
  getLectureProgress(lectureId: string): Promise<Progress[]>;
  getLectureWatchPercentage(lectureId: string): Promise<number>;

  // Bulk operations
  markSegmentWatched(lectureId: string, segmentId: string): Promise<void>;
  markAllWatched(lectureId: string): Promise<void>;
  clearProgress(lectureId: string): Promise<void>;
}
```

### Implementation

```javascript
// File: src/vl_jepa/api/static/storage/repositories.js

import { LectureMindDB, STORES } from './db.js';
import {
  createCourse,
  createLecture,
  createFlashcard,
  validateCourse,
  validateLecture
} from './models.js';

/**
 * CourseRepository implementation
 */
class CourseRepository {
  constructor(db) {
    this.db = db;
  }

  async create(data) {
    const course = createCourse(data);
    const validation = validateCourse(course);
    if (!validation.valid) {
      throw new Error(`Invalid course: ${validation.errors.join(', ')}`);
    }
    await this.db.put(STORES.COURSES, course);
    return course;
  }

  async getById(id) {
    return this.db.get(STORES.COURSES, id) || null;
  }

  async getAll() {
    return this.db.getAll(STORES.COURSES);
  }

  async update(id, changes) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Course not found: ${id}`);
    }
    const updated = {
      ...existing,
      ...changes,
      id, // Prevent ID change
      updatedAt: Date.now()
    };
    const validation = validateCourse(updated);
    if (!validation.valid) {
      throw new Error(`Invalid course: ${validation.errors.join(', ')}`);
    }
    await this.db.put(STORES.COURSES, updated);
    return updated;
  }

  async delete(id) {
    // Also delete associated lectures
    const lectures = await this.db.getByIndex(STORES.LECTURES, 'courseId', id);
    const tx = this.db.transaction(
      [STORES.COURSES, STORES.LECTURES, STORES.SEGMENTS, STORES.EVENTS],
      'readwrite'
    );

    for (const lecture of lectures) {
      // Delete lecture segments and events
      await this._deleteLectureData(tx, lecture.id);
    }

    tx.objectStore(STORES.COURSES).delete(id);
    await tx.complete;
  }

  async getWithLectures(id) {
    const course = await this.getById(id);
    if (!course) return null;

    const lectures = await this.db.getByIndex(STORES.LECTURES, 'courseId', id);
    return { ...course, lectures };
  }

  async getRecent(limit = 10) {
    const all = await this.getAll();
    return all
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  async getStatistics(id) {
    const course = await this.getWithLectures(id);
    if (!course) return null;

    const totalLectures = course.lectures.length;
    const completedLectures = course.lectures.filter(l => l.watchProgress >= 0.9).length;
    const totalDuration = course.lectures.reduce((sum, l) => sum + l.duration, 0);
    const totalWatchTime = course.lectures.reduce(
      (sum, l) => sum + (l.duration * l.watchProgress),
      0
    );
    const overallProgress = totalDuration > 0
      ? totalWatchTime / totalDuration
      : 0;

    return {
      totalLectures,
      completedLectures,
      totalDuration,
      totalWatchTime,
      overallProgress,
    };
  }
}

/**
 * FlashcardRepository with SM-2 algorithm
 */
class FlashcardRepository {
  constructor(db) {
    this.db = db;
  }

  async getDue(limit = 20) {
    const now = Date.now();
    const all = await this.db.getAll(STORES.FLASHCARDS);

    return all
      .filter(card => card.status !== 'suspended' && card.dueDate <= now)
      .sort((a, b) => a.dueDate - b.dueDate)
      .slice(0, limit);
  }

  async getDueCount() {
    const due = await this.getDue(Infinity);
    return due.length;
  }

  /**
   * Records a review using SM-2 algorithm.
   * @param {string} id - Flashcard ID
   * @param {0|1|2|3|4|5} quality - Review quality (0=blackout, 5=perfect)
   */
  async recordReview(id, quality) {
    const card = await this.db.get(STORES.FLASHCARDS, id);
    if (!card) throw new Error(`Flashcard not found: ${id}`);

    const now = Date.now();
    let { interval, easeFactor, repetitions, status } = card;

    if (quality < 3) {
      // Failed: reset repetitions
      repetitions = 0;
      interval = 0;
      status = 'learning';
    } else {
      // Passed: apply SM-2
      if (repetitions === 0) {
        interval = 1; // 1 day
      } else if (repetitions === 1) {
        interval = 6; // 6 days
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
      status = 'review';
    }

    // Update ease factor (minimum 1.3)
    easeFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    // Calculate next due date
    const dueDate = now + interval * 24 * 60 * 60 * 1000;

    const updated = {
      ...card,
      interval,
      easeFactor,
      repetitions,
      status,
      dueDate,
      lastReviewedAt: now,
    };

    await this.db.put(STORES.FLASHCARDS, updated);
    return updated;
  }
}
```

### Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC3.1 | CourseRepository CRUD operations work correctly | Integration tests |
| AC3.2 | LectureRepository handles video blob storage | Test with sample blob |
| AC3.3 | FlashcardRepository SM-2 calculations are correct | Unit tests with known values |
| AC3.4 | Cascade delete removes child entities | Integration test |
| AC3.5 | All repositories validate before write | Unit tests |

### Test Requirements

```javascript
describe('CourseRepository', () => {
  let db, repo;

  beforeEach(async () => {
    db = new LectureMindDB();
    await db.open();
    repo = new CourseRepository(db);
  });

  test('create and retrieve course', async () => {
    const course = await repo.create({ name: 'Test Course' });
    const retrieved = await repo.getById(course.id);
    expect(retrieved.name).toBe('Test Course');
  });

  test('getWithLectures includes lectures', async () => {
    const course = await repo.create({ name: 'Course with Lectures' });
    const lectureRepo = new LectureRepository(db);
    await lectureRepo.create({ title: 'Lecture 1', courseId: course.id });
    await lectureRepo.create({ title: 'Lecture 2', courseId: course.id });

    const result = await repo.getWithLectures(course.id);
    expect(result.lectures.length).toBe(2);
  });

  test('delete cascades to lectures', async () => {
    const course = await repo.create({ name: 'To Delete' });
    const lectureRepo = new LectureRepository(db);
    const lecture = await lectureRepo.create({ title: 'L1', courseId: course.id });

    await repo.delete(course.id);

    const deletedLecture = await lectureRepo.getById(lecture.id);
    expect(deletedLecture).toBeNull();
  });
});

describe('FlashcardRepository SM-2', () => {
  test('quality 0 resets progress', async () => {
    const card = await repo.create({
      lectureId: 'l1',
      front: 'Q',
      back: 'A',
      repetitions: 5,
      interval: 30,
    });

    const updated = await repo.recordReview(card.id, 0);
    expect(updated.repetitions).toBe(0);
    expect(updated.interval).toBe(0);
    expect(updated.status).toBe('learning');
  });

  test('quality 5 increases interval', async () => {
    const card = await repo.create({
      lectureId: 'l1',
      front: 'Q',
      back: 'A',
      repetitions: 2,
      interval: 6,
      easeFactor: 2.5,
    });

    const updated = await repo.recordReview(card.id, 5);
    expect(updated.interval).toBe(15); // 6 * 2.5 = 15
    expect(updated.repetitions).toBe(3);
    expect(updated.easeFactor).toBeGreaterThan(2.5);
  });
});
```

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/vl_jepa/api/static/storage/repositories.js` | CREATE | Repository implementations |
| `tests/js/storage/repositories.test.js` | CREATE | Integration tests |

---

## Day 4: Offline Sync Strategy (4h)

### Objectives
Design and implement offline-first sync with conflict resolution.

### Deliverables

**File: `src/vl_jepa/api/static/storage/sync.js`**

### Sync Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │              OFFLINE SYNC FLOW               │
                    ├──────────────────────────────────────────────┤
                    │                                              │
                    │   [User Action]                              │
                    │        │                                     │
                    │        ▼                                     │
                    │   ┌─────────────┐                            │
                    │   │ IndexedDB   │◄──── Immediate write       │
                    │   │   (local)   │                            │
                    │   └──────┬──────┘                            │
                    │          │                                   │
                    │          ▼                                   │
                    │   ┌─────────────┐                            │
                    │   │ Sync Queue  │◄──── Add pending op        │
                    │   │             │                            │
                    │   └──────┬──────┘                            │
                    │          │                                   │
                    │          ▼                                   │
                    │   [Online Check] ─── Offline? Wait           │
                    │          │                                   │
                    │          ▼ (online)                          │
                    │   ┌─────────────┐                            │
                    │   │   Server    │                            │
                    │   │   Sync      │                            │
                    │   └──────┬──────┘                            │
                    │          │                                   │
                    │          ▼                                   │
                    │   [Conflict?] ─── Yes ─► Resolve             │
                    │          │                                   │
                    │          ▼ No                                │
                    │   ┌─────────────┐                            │
                    │   │   Confirm   │                            │
                    │   │   & Remove  │                            │
                    │   │  from Queue │                            │
                    │   └─────────────┘                            │
                    │                                              │
                    └──────────────────────────────────────────────┘
```

### Sync Manager Interface

```typescript
interface SyncManager {
  // Queue management
  enqueue(operation: SyncOperation): Promise<void>;
  getQueueLength(): Promise<number>;
  getPendingOperations(): Promise<SyncQueueItem[]>;

  // Sync execution
  sync(): Promise<SyncResult>;
  syncOne(id: number): Promise<boolean>;

  // Status
  isOnline(): boolean;
  getLastSyncTime(): Promise<number | null>;

  // Events
  onStatusChange(callback: (online: boolean) => void): void;
  onSyncComplete(callback: (result: SyncResult) => void): void;

  // Conflict resolution
  setConflictResolver(resolver: ConflictResolver): void;
}

interface SyncOperation {
  type: 'create' | 'update' | 'delete' | 'confusion_vote';
  store: StoreName;
  data: unknown;
  localId?: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: ConflictRecord[];
  errors: string[];
}

interface ConflictRecord {
  operation: SyncQueueItem;
  serverData: unknown;
  resolution: 'local_wins' | 'server_wins' | 'merged' | 'manual';
}

// Conflict resolution strategies
interface ConflictResolver {
  resolve(local: unknown, server: unknown, store: StoreName): Promise<ConflictResolution>;
}

type ConflictResolution =
  | { strategy: 'local_wins'; data: unknown }
  | { strategy: 'server_wins'; data: unknown }
  | { strategy: 'merged'; data: unknown }
  | { strategy: 'manual'; prompt: string };
```

### Implementation

```javascript
// File: src/vl_jepa/api/static/storage/sync.js

import { LectureMindDB, STORES } from './db.js';

/**
 * SyncManager handles offline-first synchronization.
 *
 * Strategy:
 * 1. All writes go to IndexedDB immediately (optimistic)
 * 2. Writes are queued for server sync
 * 3. Background sync attempts when online
 * 4. Conflict resolution via last-write-wins or merge
 */
class SyncManager {
  constructor(db) {
    this.db = db;
    this._online = navigator.onLine;
    this._statusListeners = [];
    this._syncListeners = [];
    this._conflictResolver = new DefaultConflictResolver();
    this._syncInProgress = false;

    // Listen for online/offline events
    window.addEventListener('online', () => this._handleOnlineChange(true));
    window.addEventListener('offline', () => this._handleOnlineChange(false));

    // Attempt sync when coming back online
    window.addEventListener('online', () => this._autoSync());
  }

  /**
   * Adds operation to sync queue.
   * @param {SyncOperation} operation
   */
  async enqueue(operation) {
    const item = {
      type: operation.type,
      store: operation.store,
      data: operation.data,
      localId: operation.localId,
      createdAt: Date.now(),
      attempts: 0,
    };

    await this.db.put(STORES.SYNC_QUEUE, item);

    // Attempt immediate sync if online
    if (this.isOnline()) {
      this._autoSync();
    }
  }

  /**
   * Gets number of pending operations.
   */
  async getQueueLength() {
    const items = await this.db.getAll(STORES.SYNC_QUEUE);
    return items.length;
  }

  /**
   * Syncs all pending operations.
   * @returns {Promise<SyncResult>}
   */
  async sync() {
    if (this._syncInProgress) {
      return { success: false, synced: 0, failed: 0, conflicts: [], errors: ['Sync already in progress'] };
    }

    if (!this.isOnline()) {
      return { success: false, synced: 0, failed: 0, conflicts: [], errors: ['Offline'] };
    }

    this._syncInProgress = true;
    const result = { success: true, synced: 0, failed: 0, conflicts: [], errors: [] };

    try {
      const queue = await this.db.getAll(STORES.SYNC_QUEUE);

      for (const item of queue) {
        try {
          const syncResult = await this._syncItem(item);

          if (syncResult.success) {
            await this.db.delete(STORES.SYNC_QUEUE, item.id);
            result.synced++;
          } else if (syncResult.conflict) {
            result.conflicts.push(syncResult.conflict);
          } else {
            // Increment attempt count
            item.attempts++;
            item.lastAttemptAt = Date.now();
            item.error = syncResult.error;
            await this.db.put(STORES.SYNC_QUEUE, item);
            result.failed++;
            result.errors.push(syncResult.error);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(error.message);
        }
      }

      // Update last sync time
      await this.db.put(STORES.SETTINGS, {
        key: 'lastSyncAt',
        value: Date.now(),
        updatedAt: Date.now()
      });

      result.success = result.failed === 0;

    } finally {
      this._syncInProgress = false;
      this._notifySyncComplete(result);
    }

    return result;
  }

  /**
   * Syncs a single queue item to server.
   * @private
   */
  async _syncItem(item) {
    const endpoint = this._getEndpoint(item.store, item.type);
    const method = this._getMethod(item.type);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      if (response.status === 409) {
        // Conflict detected
        const serverData = await response.json();
        const resolution = await this._conflictResolver.resolve(
          item.data,
          serverData,
          item.store
        );
        return {
          success: resolution.strategy !== 'manual',
          conflict: { operation: item, serverData, resolution: resolution.strategy },
        };
      }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _getEndpoint(store, type) {
    const base = '/api';
    const endpoints = {
      confusionVotes: `${base}/confusion`,
      lectures: `${base}/lectures`,
      courses: `${base}/courses`,
    };
    return endpoints[store] || `${base}/${store}`;
  }

  _getMethod(type) {
    const methods = {
      create: 'POST',
      update: 'PUT',
      delete: 'DELETE',
      confusion_vote: 'POST',
    };
    return methods[type] || 'POST';
  }

  isOnline() {
    return this._online && navigator.onLine;
  }

  onStatusChange(callback) {
    this._statusListeners.push(callback);
    return () => {
      this._statusListeners = this._statusListeners.filter(cb => cb !== callback);
    };
  }

  _handleOnlineChange(online) {
    this._online = online;
    this._statusListeners.forEach(cb => cb(online));
  }

  async _autoSync() {
    // Debounce auto-sync
    if (this._autoSyncTimeout) clearTimeout(this._autoSyncTimeout);
    this._autoSyncTimeout = setTimeout(() => this.sync(), 1000);
  }
}

/**
 * Default conflict resolver - last write wins
 */
class DefaultConflictResolver {
  async resolve(local, server, store) {
    // Compare timestamps
    if (local.updatedAt > server.updatedAt) {
      return { strategy: 'local_wins', data: local };
    }
    return { strategy: 'server_wins', data: server };
  }
}

export { SyncManager, DefaultConflictResolver };
```

### Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC4.1 | Operations enqueue successfully when offline | Toggle offline in DevTools |
| AC4.2 | Auto-sync triggers when coming online | Network toggle test |
| AC4.3 | Failed syncs are retried with backoff | Mock server errors |
| AC4.4 | Conflict resolution uses timestamp comparison | Unit test with conflicting data |
| AC4.5 | Sync status UI updates correctly | Visual verification |

### Test Requirements

```javascript
describe('SyncManager', () => {
  test('enqueues operation when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    await syncManager.enqueue({
      type: 'create',
      store: 'lectures',
      data: { id: 'l1', title: 'Test' },
    });

    const length = await syncManager.getQueueLength();
    expect(length).toBe(1);
  });

  test('syncs when coming online', async () => {
    await syncManager.enqueue({ type: 'create', store: 'lectures', data: {} });

    // Simulate coming online
    Object.defineProperty(navigator, 'onLine', { value: true });
    window.dispatchEvent(new Event('online'));

    // Wait for auto-sync
    await new Promise(r => setTimeout(r, 1500));

    const length = await syncManager.getQueueLength();
    expect(length).toBe(0);
  });

  test('handles server conflict', async () => {
    // Mock fetch to return 409
    global.fetch = jest.fn(() =>
      Promise.resolve({
        status: 409,
        ok: false,
        json: () => Promise.resolve({ id: 'l1', title: 'Server Version' }),
      })
    );

    await syncManager.enqueue({
      type: 'update',
      store: 'lectures',
      data: { id: 'l1', title: 'Local Version', updatedAt: Date.now() },
    });

    const result = await syncManager.sync();
    expect(result.conflicts.length).toBe(1);
  });
});
```

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/vl_jepa/api/static/storage/sync.js` | CREATE | Sync manager |
| `tests/js/storage/sync.test.js` | CREATE | Sync tests |

---

## Day 5: Migration System + Integration (4h + 2h Hostile Review)

### Objectives
1. Build schema migration system for future upgrades
2. Integrate all storage components into a unified API
3. Prepare for hostile review

### Deliverables

**File: `src/vl_jepa/api/static/storage/migrations.js`**

### Migration System

```typescript
interface MigrationDefinition {
  version: number;
  description: string;
  up: (db: IDBDatabase, transaction: IDBTransaction) => void;
  down?: (db: IDBDatabase, transaction: IDBTransaction) => void;
}

interface MigrationRunner {
  register(migration: MigrationDefinition): void;
  run(fromVersion: number, toVersion: number): void;
  getAppliedMigrations(): Promise<number[]>;
}
```

### Implementation

```javascript
// File: src/vl_jepa/api/static/storage/migrations.js

/**
 * Schema migrations for Lecture Mind storage.
 *
 * Migration guidelines:
 * 1. Migrations are numbered starting at 1
 * 2. Each migration must be idempotent
 * 3. Never modify existing migrations after deployment
 * 4. Test migrations with real data before release
 */

const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema - courses, lectures, segments, events, progress, flashcards, bookmarks, confusion, sync queue, settings',
    up: (db) => {
      // See Day 1 implementation for full schema
      // This is the initial schema creation
    },
  },

  // Future migrations go here:
  // {
  //   version: 2,
  //   description: 'Add tags to lectures',
  //   up: (db, tx) => {
  //     // Add index for lecture tags
  //     const lectureStore = tx.objectStore('lectures');
  //     lectureStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
  //   },
  //   down: (db, tx) => {
  //     const lectureStore = tx.objectStore('lectures');
  //     lectureStore.deleteIndex('tags');
  //   },
  // },
];

/**
 * Runs migrations during database upgrade.
 */
function runMigrations(db, oldVersion, newVersion, transaction) {
  console.log(`Running migrations from v${oldVersion} to v${newVersion}`);

  for (const migration of MIGRATIONS) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      console.log(`Applying migration ${migration.version}: ${migration.description}`);
      try {
        migration.up(db, transaction);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        throw error;
      }
    }
  }
}

/**
 * Gets current schema version from settings.
 */
async function getSchemaVersion(db) {
  try {
    const setting = await db.get(STORES.SETTINGS, 'schemaVersion');
    return setting?.value || 0;
  } catch {
    return 0;
  }
}

export { MIGRATIONS, runMigrations, getSchemaVersion };
```

### Unified Storage API

**File: `src/vl_jepa/api/static/storage/index.js`**

```javascript
/**
 * Lecture Mind Storage API
 *
 * Unified entry point for all storage operations.
 *
 * Usage:
 *   import { storage } from './storage/index.js';
 *
 *   // Initialize (call once at app start)
 *   await storage.init();
 *
 *   // Use repositories
 *   const courses = await storage.courses.getAll();
 *   const lecture = await storage.lectures.getById('l1');
 *
 *   // Check sync status
 *   const pending = await storage.sync.getQueueLength();
 */

import { LectureMindDB, STORES } from './db.js';
import { CourseRepository, LectureRepository, FlashcardRepository, ProgressRepository, BookmarkRepository, ConfusionRepository } from './repositories.js';
import { SyncManager } from './sync.js';

class Storage {
  constructor() {
    this._initialized = false;
    this._db = null;
  }

  async init() {
    if (this._initialized) return;

    this._db = new LectureMindDB();
    await this._db.open();

    // Initialize repositories
    this.courses = new CourseRepository(this._db);
    this.lectures = new LectureRepository(this._db);
    this.flashcards = new FlashcardRepository(this._db);
    this.progress = new ProgressRepository(this._db);
    this.bookmarks = new BookmarkRepository(this._db);
    this.confusion = new ConfusionRepository(this._db);

    // Initialize sync manager
    this.sync = new SyncManager(this._db);

    this._initialized = true;
    console.log('Storage initialized');
  }

  isInitialized() {
    return this._initialized;
  }

  /**
   * Gets storage usage statistics.
   */
  async getStorageStats() {
    const estimate = await navigator.storage.estimate();
    const courses = await this.courses.getAll();
    const lectures = await this.lectures.getAll();
    const flashcards = await this.flashcards.getAll();

    return {
      quota: estimate.quota,
      usage: estimate.usage,
      usagePercent: (estimate.usage / estimate.quota * 100).toFixed(2),
      counts: {
        courses: courses.length,
        lectures: lectures.length,
        flashcards: flashcards.length,
      },
    };
  }

  /**
   * Exports all data for backup.
   */
  async exportAll() {
    return {
      version: DB_VERSION,
      exportedAt: Date.now(),
      data: {
        courses: await this.courses.getAll(),
        lectures: await this.lectures.getAll(),
        flashcards: await this.flashcards.getAll(),
        bookmarks: await this.bookmarks.getAll(),
        progress: await this.progress.getAll(),
      },
    };
  }

  /**
   * Imports data from backup.
   */
  async importData(backup) {
    if (backup.version > DB_VERSION) {
      throw new Error(`Backup version ${backup.version} is newer than current ${DB_VERSION}`);
    }

    // Import in dependency order
    for (const course of backup.data.courses || []) {
      await this._db.put(STORES.COURSES, course);
    }
    for (const lecture of backup.data.lectures || []) {
      await this._db.put(STORES.LECTURES, lecture);
    }
    for (const flashcard of backup.data.flashcards || []) {
      await this._db.put(STORES.FLASHCARDS, flashcard);
    }
    // ... etc
  }

  /**
   * Clears all data (destructive!).
   */
  async clearAll() {
    const stores = Object.values(STORES);
    for (const store of stores) {
      await this._db.clear(store);
    }
  }
}

// Singleton instance
const storage = new Storage();

export { storage, STORES };
```

### Migration to New Storage (from localStorage)

```javascript
/**
 * Migrates existing localStorage data to IndexedDB.
 * Run once during app initialization.
 */
async function migrateFromLocalStorage(storage) {
  const migrationKey = 'lectureMind_migrated_v1';

  if (localStorage.getItem(migrationKey)) {
    console.log('Migration already completed');
    return;
  }

  console.log('Migrating from localStorage to IndexedDB...');

  // Migrate confusion votes
  const confusionData = localStorage.getItem('lectureMind_confusionVotes');
  if (confusionData) {
    try {
      const votes = JSON.parse(confusionData);
      for (const [segmentId, count] of Object.entries(votes)) {
        for (let i = 0; i < count; i++) {
          await storage.confusion.create({
            segmentId,
            lectureId: 'legacy', // Will need manual association
            timestamp: Date.now(),
            synced: false,
          });
        }
      }
      console.log(`Migrated ${Object.keys(votes).length} confusion segments`);
    } catch (e) {
      console.error('Failed to migrate confusion votes:', e);
    }
  }

  // Migrate bookmarks
  const bookmarkData = localStorage.getItem('lectureMind_bookmarks');
  if (bookmarkData) {
    try {
      const bookmarks = JSON.parse(bookmarkData);
      for (const bookmark of bookmarks) {
        await storage.bookmarks.create({
          lectureId: 'legacy',
          timestamp: bookmark.timestamp,
          type: bookmark.type,
          note: bookmark.note,
          createdAt: Date.now(),
        });
      }
      console.log(`Migrated ${bookmarks.length} bookmarks`);
    } catch (e) {
      console.error('Failed to migrate bookmarks:', e);
    }
  }

  // Mark migration complete
  localStorage.setItem(migrationKey, Date.now().toString());
  console.log('Migration complete');
}

export { migrateFromLocalStorage };
```

### Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC5.1 | Migration system runs on DB upgrade | Increment version, verify schema changes |
| AC5.2 | Unified storage API exposes all repositories | Integration test |
| AC5.3 | localStorage migration preserves data | Compare before/after |
| AC5.4 | Export/import round-trip works | Export, clear, import, verify |
| AC5.5 | Storage stats are accurate | Compare to DevTools |

### Test Requirements

```javascript
describe('Storage API', () => {
  test('init creates all repositories', async () => {
    await storage.init();
    expect(storage.courses).toBeDefined();
    expect(storage.lectures).toBeDefined();
    expect(storage.flashcards).toBeDefined();
    expect(storage.sync).toBeDefined();
  });

  test('export and import round-trip', async () => {
    await storage.courses.create({ name: 'Test Course' });
    await storage.lectures.create({ title: 'Test Lecture' });

    const backup = await storage.exportAll();
    await storage.clearAll();

    expect(await storage.courses.getAll()).toHaveLength(0);

    await storage.importData(backup);

    const courses = await storage.courses.getAll();
    expect(courses).toHaveLength(1);
    expect(courses[0].name).toBe('Test Course');
  });
});

describe('localStorage migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('migrates confusion votes', async () => {
    localStorage.setItem('lectureMind_confusionVotes', JSON.stringify({
      'seg-1': 3,
      'seg-2': 1,
    }));

    await migrateFromLocalStorage(storage);

    const votes = await storage.confusion.getAll();
    expect(votes.length).toBe(4); // 3 + 1
  });
});
```

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/vl_jepa/api/static/storage/migrations.js` | CREATE | Migration definitions |
| `src/vl_jepa/api/static/storage/index.js` | CREATE | Unified API |
| `src/vl_jepa/api/static/storage/migrate-localstorage.js` | CREATE | Legacy migration |
| `tests/js/storage/integration.test.js` | CREATE | Integration tests |

---

## Week 10 Summary

### Total Files

| New Files | Purpose |
|-----------|---------|
| `src/vl_jepa/api/static/storage/db.js` | IndexedDB wrapper |
| `src/vl_jepa/api/static/storage/constants.js` | Store names, versions |
| `src/vl_jepa/api/static/storage/models.js` | Entity definitions |
| `src/vl_jepa/api/static/storage/repositories.js` | Repository pattern |
| `src/vl_jepa/api/static/storage/sync.js` | Offline sync |
| `src/vl_jepa/api/static/storage/migrations.js` | Schema versioning |
| `src/vl_jepa/api/static/storage/index.js` | Unified API |
| `src/vl_jepa/api/static/storage/migrate-localstorage.js` | Legacy data migration |
| `tests/js/storage/*.test.js` | Test files (4) |

### Architecture Decision Records

Create `docs/ADR/ADR-0001-indexeddb-storage.md`:

```markdown
# ADR-0001: IndexedDB for Client-Side Storage

**Date:** 2026-01-XX
**Status:** Proposed
**Deciders:** ARCHITECT

## Context

v0.4.0 Student Playground requires persistent browser storage for:
- Multi-lecture library
- Progress tracking
- Flashcard spaced repetition
- Offline functionality

Options considered:
1. localStorage (current for bookmarks/confusion)
2. IndexedDB
3. External library (Dexie.js, localForage)
4. Server-only storage

## Decision

Use vanilla IndexedDB with custom wrapper.

## Consequences

### Positive
- No additional dependencies
- Full control over schema and migrations
- Supports large binary data (video blobs)
- Works offline

### Negative
- More implementation effort than library
- IndexedDB API is complex
- Browser compatibility edge cases

### Risks
- Safari IndexedDB bugs (mitigated: test on Safari)
- Quota limits (mitigated: storage stats UI)
```

---

## Quality Gate: Week 10

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEEK 10 GATE — PENDING                       │
├─────────────────────────────────────────────────────────────────┤
│  [ ] All 10 object stores created and indexed                   │
│  [ ] CRUD operations work for all entities                      │
│  [ ] SM-2 flashcard algorithm correct (known test values)       │
│  [ ] Offline sync queues and replays operations                 │
│  [ ] Migration system handles version upgrades                  │
│  [ ] localStorage data migrates to IndexedDB                    │
│  [ ] All unit tests pass                                        │
│  [ ] Hostile review: docs/reviews/REVIEW_week10.md              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Handoff to Hostile Reviewer

```markdown
## ARCHITECT: Week 10 Design Complete

Artifacts:
- docs/planning/WEEK10_STORAGE_PLAN.md (this document)
- docs/ADR/ADR-0001-indexeddb-storage.md (decision record)

Status: PENDING_HOSTILE_REVIEW

Review Focus:
1. Data model completeness (all v0.4.0 features covered?)
2. Offline sync conflict resolution (edge cases?)
3. Migration system robustness
4. Performance with large datasets (100+ lectures)
5. Browser compatibility (Safari IndexedDB quirks)

Next: /review:hostile docs/planning/WEEK10_STORAGE_PLAN.md
```

---

*Plan created: 2026-01-09*
*Status: READY FOR HOSTILE REVIEW*
*Author: ARCHITECT*
