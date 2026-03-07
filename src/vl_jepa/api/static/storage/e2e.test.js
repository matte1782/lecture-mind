/**
 * @fileoverview End-to-end integration tests for Lecture Mind storage layer.
 * Tests full lifecycle across repositories, cascade deletes, sync queue,
 * migrations, and verifies index.js export completeness.
 */

import { closeDatabase, deleteDatabase } from './db.js';
import {
  CourseRepository,
  LectureRepository,
  SegmentRepository,
  EventRepository,
  ProgressRepository,
  FlashcardRepository,
  BookmarkRepository,
  ConfusionVoteRepository,
  SyncQueueRepository,
  SettingsRepository
} from './repositories.js';
import { FLASHCARD_STATUS, LECTURE_STATUS, SYNC_STATUS } from './models.js';
import { runStartupMigration, getCurrentVersion, SCHEMA_VERSION, needsMigration } from './migrations.js';

// Clean state for each test
beforeEach(async () => {
  closeDatabase();
  await deleteDatabase();
  localStorage.clear();
});

afterEach(async () => {
  closeDatabase();
  await deleteDatabase();
  localStorage.clear();
});

describe('Full Lifecycle: Course -> Lecture -> Entities -> Cascade Delete', () => {
  test('creates course, lecture, and child entities', async () => {
    // Create course
    const course = await CourseRepository.create({ name: 'CS101' });
    expect(course.id).toBeDefined();
    expect(course.name).toBe('CS101');

    // Create lecture under course
    const lecture = await LectureRepository.create({
      courseId: course.id,
      title: 'Introduction to Algorithms'
    });
    expect(lecture.courseId).toBe(course.id);

    // Create child entities
    const segment = await SegmentRepository.create({
      lectureId: lecture.id,
      startTime: 0,
      endTime: 300
    });
    expect(segment.lectureId).toBe(lecture.id);

    const event = await EventRepository.create({
      lectureId: lecture.id,
      type: 'slide_change',
      timestamp: 60
    });
    expect(event.lectureId).toBe(lecture.id);

    const flashcard = await FlashcardRepository.create({
      lectureId: lecture.id,
      front: 'What is O(n)?',
      back: 'Linear time complexity'
    });
    expect(flashcard.status).toBe(FLASHCARD_STATUS.NEW);

    const bookmark = await BookmarkRepository.create({
      lectureId: lecture.id,
      timestamp: 120,
      label: 'Important'
    });
    expect(bookmark.label).toBe('Important');

    const vote = await ConfusionVoteRepository.create({
      lectureId: lecture.id,
      segmentId: segment.id,
      comment: 'Confused here'
    });
    expect(vote.segmentId).toBe(segment.id);

    // Verify reads
    const retrieved = await LectureRepository.getById(lecture.id);
    expect(retrieved.title).toBe('Introduction to Algorithms');
  });

  test('cascade delete removes lecture and all children', async () => {
    const course = await CourseRepository.create({ name: 'CS101' });
    const lecture = await LectureRepository.create({
      courseId: course.id,
      title: 'Lecture 1'
    });

    // Create entities under lecture
    await SegmentRepository.create({ lectureId: lecture.id, startTime: 0, endTime: 300 });
    await EventRepository.create({ lectureId: lecture.id, type: 'pause', timestamp: 10 });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });
    await BookmarkRepository.create({ lectureId: lecture.id, timestamp: 5 });
    const segment = await SegmentRepository.create({ lectureId: lecture.id, startTime: 100, endTime: 400 });
    await ConfusionVoteRepository.create({ lectureId: lecture.id, segmentId: segment.id });
    await ProgressRepository.getOrCreate(lecture.id);

    // Cascade delete lecture
    await LectureRepository.deleteWithCascade(lecture.id);

    // Verify all children removed
    const segments = await SegmentRepository.getByLecture(lecture.id);
    expect(segments).toHaveLength(0);

    const events = await EventRepository.getByLecture(lecture.id);
    expect(events).toHaveLength(0);

    const flashcards = await FlashcardRepository.getByLecture(lecture.id);
    expect(flashcards).toHaveLength(0);

    const bookmarks = await BookmarkRepository.getByLecture(lecture.id);
    expect(bookmarks).toHaveLength(0);

    const votes = await ConfusionVoteRepository.getByLecture(lecture.id);
    expect(votes).toHaveLength(0);

    // Lecture itself deleted
    const gone = await LectureRepository.getById(lecture.id);
    expect(gone).toBeUndefined();
  });

  test('cascade delete course removes course and all lectures', async () => {
    const course = await CourseRepository.create({ name: 'Physics' });
    const lec1 = await LectureRepository.create({ courseId: course.id, title: 'Mechanics' });
    const lec2 = await LectureRepository.create({ courseId: course.id, title: 'Optics' });
    await FlashcardRepository.create({ lectureId: lec1.id, front: 'F=?', back: 'ma' });
    await FlashcardRepository.create({ lectureId: lec2.id, front: 'c=?', back: '3e8 m/s' });

    await CourseRepository.deleteWithCascade(course.id);

    expect(await CourseRepository.getById(course.id)).toBeUndefined();
    expect(await LectureRepository.getById(lec1.id)).toBeUndefined();
    expect(await LectureRepository.getById(lec2.id)).toBeUndefined();
    expect(await FlashcardRepository.getByLecture(lec1.id)).toHaveLength(0);
    expect(await FlashcardRepository.getByLecture(lec2.id)).toHaveLength(0);
  });
});

describe('Flashcard Review Lifecycle (SM-2)', () => {
  test('review cycle: new -> learning -> review -> mastered', async () => {
    const lecture = await LectureRepository.create({ title: 'Test Lecture' });
    const card = await FlashcardRepository.create({
      lectureId: lecture.id,
      front: 'What is TDD?',
      back: 'Test-Driven Development'
    });

    expect(card.status).toBe(FLASHCARD_STATUS.NEW);
    expect(card.repetitions).toBe(0);

    // Review 1: good (quality 4)
    const r1 = await FlashcardRepository.reviewCard(card.id, 4);
    expect(r1.repetitions).toBe(1);
    expect(r1.status).toBe(FLASHCARD_STATUS.LEARNING);

    // Review 2: good
    const r2 = await FlashcardRepository.reviewCard(card.id, 4);
    expect(r2.repetitions).toBe(2);
    expect(r2.status).toBe(FLASHCARD_STATUS.LEARNING);

    // Review 3: good -> enters REVIEW
    const r3 = await FlashcardRepository.reviewCard(card.id, 4);
    expect(r3.repetitions).toBe(3);
    expect(r3.status).toBe(FLASHCARD_STATUS.REVIEW);

    // Reviews 4-7: keep reviewing
    let latest = r3;
    for (let i = 4; i <= 7; i++) {
      latest = await FlashcardRepository.reviewCard(card.id, 5);
    }
    expect(latest.repetitions).toBe(7);
    expect(latest.status).toBe(FLASHCARD_STATUS.REVIEW);

    // Review 8: mastered threshold
    const mastered = await FlashcardRepository.reviewCard(card.id, 5);
    expect(mastered.repetitions).toBe(8);
    expect(mastered.status).toBe(FLASHCARD_STATUS.MASTERED);
  });

  test('failed review resets repetitions but keeps ease factor', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({
      lectureId: lecture.id,
      front: 'Q',
      back: 'A'
    });

    // Get to repetitions = 3
    await FlashcardRepository.reviewCard(card.id, 4);
    await FlashcardRepository.reviewCard(card.id, 4);
    const before = await FlashcardRepository.reviewCard(card.id, 4);
    expect(before.repetitions).toBe(3);
    const easeBefore = before.easeFactor;

    // Fail
    const failed = await FlashcardRepository.reviewCard(card.id, 1);
    expect(failed.repetitions).toBe(0);
    expect(failed.easeFactor).toBe(easeBefore); // unchanged
    expect(failed.status).toBe(FLASHCARD_STATUS.NEW);
  });
});

describe('Progress Tracking Lifecycle', () => {
  test('tracks position and completed segments', async () => {
    const lecture = await LectureRepository.create({ title: 'Lecture' });
    const seg1 = await SegmentRepository.create({ lectureId: lecture.id, startTime: 0, endTime: 60 });
    const seg2 = await SegmentRepository.create({ lectureId: lecture.id, startTime: 60, endTime: 120 });

    // Get or create progress
    const progress = await ProgressRepository.getOrCreate(lecture.id);
    expect(progress.lastPosition).toBe(0);
    expect(progress.completedSegments).toEqual([]);

    // Update position
    const updated = await ProgressRepository.updatePosition(lecture.id, 45);
    expect(updated.lastPosition).toBe(45);

    // Complete segment 1
    const withSeg1 = await ProgressRepository.markSegmentCompleted(lecture.id, seg1.id);
    expect(withSeg1.completedSegments).toContain(seg1.id);

    // Complete segment 2
    const withSeg2 = await ProgressRepository.markSegmentCompleted(lecture.id, seg2.id);
    expect(withSeg2.completedSegments).toContain(seg1.id);
    expect(withSeg2.completedSegments).toContain(seg2.id);

    // Idempotent: marking same segment again doesn't duplicate
    const again = await ProgressRepository.markSegmentCompleted(lecture.id, seg1.id);
    expect(again.completedSegments.filter(id => id === seg1.id)).toHaveLength(1);
  });
});

describe('Sync Queue Lifecycle', () => {
  test('enqueue -> mark syncing -> mark completed -> clear', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: 'create',
      entityType: 'flashcard',
      entityId: 'fc-1',
      payload: { front: 'Q', back: 'A' }
    });

    expect(item.status).toBe(SYNC_STATUS.PENDING);

    // Pending items
    const pending = await SyncQueueRepository.getPending();
    expect(pending).toHaveLength(1);

    // Mark syncing
    const syncing = await SyncQueueRepository.markSyncing(item.id);
    expect(syncing.status).toBe(SYNC_STATUS.SYNCING);

    // Mark completed
    const completed = await SyncQueueRepository.markCompleted(item.id);
    expect(completed.status).toBe(SYNC_STATUS.COMPLETED);

    // Clear completed
    await SyncQueueRepository.clearCompleted();
    const all = await SyncQueueRepository.getAll();
    expect(all).toHaveLength(0);
  });

  test('failed items increment retry count', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: 'update',
      entityType: 'lecture',
      entityId: 'lec-1'
    });

    const failed1 = await SyncQueueRepository.markFailed(item.id);
    expect(failed1.retryCount).toBe(1);
    expect(failed1.status).toBe(SYNC_STATUS.FAILED);

    // Reset to pending for retry
    const reset = await SyncQueueRepository.resetToPending(item.id);
    expect(reset.status).toBe(SYNC_STATUS.PENDING);

    // Fail again
    const failed2 = await SyncQueueRepository.markFailed(item.id);
    expect(failed2.retryCount).toBe(2);
  });
});

describe('Migration Startup Lifecycle', () => {
  test('runStartupMigration on fresh DB sets version and imports localStorage', async () => {
    localStorage.setItem('userTheme', '"dark"');

    const result = await runStartupMigration();
    expect(result.migrated).toBe(true);
    expect(result.localStorageKeys).toBe(1);
    expect(result.toVersion).toBe(SCHEMA_VERSION);

    // Version is set
    const version = await getCurrentVersion();
    expect(version).toBe(SCHEMA_VERSION);

    // needsMigration returns false
    expect(await needsMigration()).toBe(false);

    // localStorage value imported
    const theme = await SettingsRepository.get('userTheme');
    expect(theme).toBe('dark');
  });

  test('subsequent startup is a no-op', async () => {
    await runStartupMigration();
    const result = await runStartupMigration();
    expect(result.migrated).toBe(false);
    expect(result.localStorageKeys).toBe(0);
  });
});

describe('Cross-Repository Queries', () => {
  test('lectures filterable by status', async () => {
    await LectureRepository.create({ title: 'L1', status: LECTURE_STATUS.COMPLETED });
    await LectureRepository.create({ title: 'L2', status: LECTURE_STATUS.PENDING });
    await LectureRepository.create({ title: 'L3', status: LECTURE_STATUS.COMPLETED });

    const completed = await LectureRepository.getByStatus(LECTURE_STATUS.COMPLETED);
    expect(completed).toHaveLength(2);

    const pending = await LectureRepository.getByStatus(LECTURE_STATUS.PENDING);
    expect(pending).toHaveLength(1);
  });

  test('flashcards filterable by status', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });

    const card = await FlashcardRepository.create({
      lectureId: lecture.id,
      front: 'Q',
      back: 'A'
    });
    expect(card.status).toBe(FLASHCARD_STATUS.NEW);

    const newCards = await FlashcardRepository.getByStatus(FLASHCARD_STATUS.NEW);
    expect(newCards.length).toBeGreaterThanOrEqual(1);
  });

  test('confusion votes countable per segment', async () => {
    const lecture = await LectureRepository.create({ title: 'Lecture' });
    const seg = await SegmentRepository.create({ lectureId: lecture.id, startTime: 0 });

    await ConfusionVoteRepository.create({ lectureId: lecture.id, segmentId: seg.id });
    await ConfusionVoteRepository.create({ lectureId: lecture.id, segmentId: seg.id });

    const voteCount = await ConfusionVoteRepository.countBySegment(seg.id);
    expect(voteCount).toBe(2);
  });
});

describe('Settings Repository', () => {
  test('CRUD lifecycle', async () => {
    await SettingsRepository.set('theme', 'dark');
    expect(await SettingsRepository.get('theme')).toBe('dark');

    await SettingsRepository.set('theme', 'light');
    expect(await SettingsRepository.get('theme')).toBe('light');

    await SettingsRepository.remove('theme');
    expect(await SettingsRepository.get('theme', 'default')).toBe('default');
  });
});

describe('Index.js Export Completeness', () => {
  test('all public APIs are exported from index.js', async () => {
    const index = await import('./index.js');
    const exportNames = Object.keys(index).filter(k => k !== 'default');

    // db.js exports
    const dbExports = [
      'DB_NAME', 'DB_VERSION', 'STORES', 'isIndexedDBAvailable',
      'openDatabase', 'closeDatabase', 'deleteDatabase',
      'get', 'put', 'remove', 'getAll', 'queryByIndex',
      'count', 'clear', 'batch', 'LectureMindDB'
    ];
    for (const name of dbExports) {
      expect(exportNames).toContain(name);
    }

    // models.js exports
    const modelExports = [
      'LECTURE_STATUS', 'FLASHCARD_STATUS', 'EVENT_TYPES',
      'SYNC_OPERATION', 'SYNC_STATUS',
      'createSetting', 'createCourse', 'createLecture', 'createSegment',
      'createEvent', 'createProgress', 'createFlashcard', 'createBookmark',
      'createConfusionVote', 'createSyncQueueItem',
      'validateSetting', 'validateCourse', 'validateLecture', 'validateSegment',
      'validateEvent', 'validateProgress', 'validateFlashcard', 'validateBookmark',
      'validateConfusionVote', 'validateSyncQueueItem'
    ];
    for (const name of modelExports) {
      expect(exportNames).toContain(name);
    }

    // repositories.js exports
    const repoExports = [
      'calculateSM2', 'BaseRepository',
      'SettingsRepository', 'CourseRepository', 'LectureRepository',
      'SegmentRepository', 'EventRepository', 'ProgressRepository',
      'FlashcardRepository', 'BookmarkRepository', 'ConfusionVoteRepository',
      'SyncQueueRepository'
    ];
    for (const name of repoExports) {
      expect(exportNames).toContain(name);
    }

    // sync.js exports
    const syncExports = [
      'BASE_BACKOFF_MS', 'MAX_BACKOFF_MS', 'MAX_RETRY_COUNT',
      'calculateBackoff', 'SyncManager'
    ];
    for (const name of syncExports) {
      expect(exportNames).toContain(name);
    }

    // migrations.js exports
    const migrationExports = [
      'SCHEMA_VERSION', 'getCurrentVersion', 'setVersion',
      'needsMigration', 'migrateFromLocalStorage', 'runStartupMigration'
    ];
    for (const name of migrationExports) {
      expect(exportNames).toContain(name);
    }
  });

  test('every export is defined (not undefined)', async () => {
    const index = await import('./index.js');
    for (const [name, value] of Object.entries(index)) {
      if (name === 'default') continue;
      expect(value).toBeDefined();
    }
  });
});
