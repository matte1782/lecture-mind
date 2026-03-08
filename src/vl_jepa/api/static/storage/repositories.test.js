/**
 * @fileoverview Integration tests for repository pattern (repositories.js)
 * Tests CRUD operations, SM-2 algorithm, cascade delete, and performance
 */

import {
  openDatabase,
  deleteDatabase,
  closeDatabase,
  put
} from './db.js';

import {
  createCourse,
  createLecture,
  createSegment,
  createEvent,
  createProgress,
  createFlashcard,
  createBookmark,
  createConfusionVote,
  createSyncQueueItem,
  createRecordingSession,
  createAudioData,
  createPhotoCapture,
  createAutoNote,
  LECTURE_STATUS,
  FLASHCARD_STATUS,
  SYNC_OPERATION,
  RECORDING_STATUS,
  AUTO_NOTE_SOURCE
} from './models.js';

import {
  // Base repository
  BaseRepository,
  // Specialized repositories
  SettingsRepository,
  CourseRepository,
  LectureRepository,
  SegmentRepository,
  EventRepository,
  ProgressRepository,
  FlashcardRepository,
  BookmarkRepository,
  ConfusionVoteRepository,
  SyncQueueRepository,
  RecordingSessionRepository,
  AudioDataRepository,
  PhotoCaptureRepository,
  AutoNoteRepository,
  // SM-2 algorithm
  calculateSM2
} from './repositories.js';

// Helper to generate unique IDs for testing
const generateId = () => `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

describe('BaseRepository', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create stores a record and returns it with id', async () => {
    const repo = new BaseRepository('settings');
    const record = await repo.create({ key: 'test-key', value: 'test-value' });
    expect(record.key).toBe('test-key');
    expect(record.value).toBe('test-value');
  });

  test('getById retrieves a record by id', async () => {
    const repo = new BaseRepository('courses');
    const course = createCourse({ name: 'Test Course' });
    await repo.create(course);

    const retrieved = await repo.getById(course.id);
    expect(retrieved.name).toBe('Test Course');
  });

  test('getById returns undefined for non-existent id', async () => {
    const repo = new BaseRepository('courses');
    const result = await repo.getById('non-existent-id');
    expect(result).toBeUndefined();
  });

  test('update modifies an existing record', async () => {
    const repo = new BaseRepository('courses');
    const course = createCourse({ name: 'Original Name' });
    await repo.create(course);

    const updated = await repo.update(course.id, { name: 'Updated Name' });
    expect(updated.name).toBe('Updated Name');
    expect(updated.id).toBe(course.id);
  });

  test('update throws error for non-existent record', async () => {
    const repo = new BaseRepository('courses');
    await expect(repo.update('non-existent', { name: 'Test' }))
      .rejects.toThrow('Record not found');
  });

  test('delete removes a record', async () => {
    const repo = new BaseRepository('courses');
    const course = createCourse({ name: 'To Delete' });
    await repo.create(course);

    await repo.delete(course.id);
    const result = await repo.getById(course.id);
    expect(result).toBeUndefined();
  });

  test('getAll returns all records', async () => {
    const repo = new BaseRepository('settings');
    await repo.create({ key: 'key1', value: 'val1' });
    await repo.create({ key: 'key2', value: 'val2' });
    await repo.create({ key: 'key3', value: 'val3' });

    const all = await repo.getAll();
    expect(all).toHaveLength(3);
  });

  test('getAll respects limit parameter', async () => {
    const repo = new BaseRepository('settings');
    await repo.create({ key: 'key1', value: 'val1' });
    await repo.create({ key: 'key2', value: 'val2' });
    await repo.create({ key: 'key3', value: 'val3' });

    const limited = await repo.getAll(2);
    expect(limited).toHaveLength(2);
  });

  test('count returns total number of records', async () => {
    const repo = new BaseRepository('settings');
    await repo.create({ key: 'key1', value: 'val1' });
    await repo.create({ key: 'key2', value: 'val2' });

    const total = await repo.count();
    expect(total).toBe(2);
  });

  test('clear removes all records', async () => {
    const repo = new BaseRepository('settings');
    await repo.create({ key: 'key1', value: 'val1' });
    await repo.create({ key: 'key2', value: 'val2' });

    await repo.clear();
    const count = await repo.count();
    expect(count).toBe(0);
  });

  test('findByIndex returns matching records', async () => {
    const repo = new BaseRepository('flashcards');
    const lectureId = generateId();
    await repo.create(createFlashcard({ lectureId, front: 'Q1', back: 'A1' }));
    await repo.create(createFlashcard({ lectureId, front: 'Q2', back: 'A2' }));
    await repo.create(createFlashcard({ lectureId: 'other', front: 'Q3', back: 'A3' }));

    const results = await repo.findByIndex('lectureId', lectureId);
    expect(results).toHaveLength(2);
  });
});

describe('SettingsRepository', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('get returns setting value by key', async () => {
    await SettingsRepository.set('theme', 'dark');
    const value = await SettingsRepository.get('theme');
    expect(value).toBe('dark');
  });

  test('get returns defaultValue for missing key', async () => {
    const value = await SettingsRepository.get('missing', 'default');
    expect(value).toBe('default');
  });

  test('set creates or updates a setting', async () => {
    await SettingsRepository.set('volume', 0.8);
    await SettingsRepository.set('volume', 0.5);
    const value = await SettingsRepository.get('volume');
    expect(value).toBe(0.5);
  });

  test('remove deletes a setting', async () => {
    await SettingsRepository.set('toRemove', 'value');
    await SettingsRepository.remove('toRemove');
    const value = await SettingsRepository.get('toRemove');
    expect(value).toBeUndefined();
  });

  test('getAll returns all settings as object', async () => {
    await SettingsRepository.set('key1', 'val1');
    await SettingsRepository.set('key2', 'val2');
    const all = await SettingsRepository.getAll();
    expect(all.key1).toBe('val1');
    expect(all.key2).toBe('val2');
  });
});

describe('CourseRepository', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create creates a new course', async () => {
    const course = await CourseRepository.create({ name: 'ML 101' });
    expect(course.id).toBeDefined();
    expect(course.name).toBe('ML 101');
  });

  test('getById retrieves a course', async () => {
    const created = await CourseRepository.create({ name: 'Test' });
    const retrieved = await CourseRepository.getById(created.id);
    expect(retrieved.name).toBe('Test');
  });

  test('update modifies a course', async () => {
    const course = await CourseRepository.create({ name: 'Original' });
    const updated = await CourseRepository.update(course.id, { name: 'Updated' });
    expect(updated.name).toBe('Updated');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(course.updatedAt);
  });

  test('delete removes a course', async () => {
    const course = await CourseRepository.create({ name: 'To Delete' });
    await CourseRepository.delete(course.id);
    const result = await CourseRepository.getById(course.id);
    expect(result).toBeUndefined();
  });

  test('getAll returns all courses', async () => {
    await CourseRepository.create({ name: 'Course 1' });
    await CourseRepository.create({ name: 'Course 2' });
    const courses = await CourseRepository.getAll();
    expect(courses).toHaveLength(2);
  });
});

describe('LectureRepository', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create creates a new lecture', async () => {
    const lecture = await LectureRepository.create({ title: 'Intro to AI' });
    expect(lecture.id).toBeDefined();
    expect(lecture.title).toBe('Intro to AI');
    expect(lecture.status).toBe(LECTURE_STATUS.PENDING);
  });

  test('getByCourse returns lectures for a course', async () => {
    const courseId = generateId();
    await LectureRepository.create({ title: 'Lecture 1', courseId });
    await LectureRepository.create({ title: 'Lecture 2', courseId });
    await LectureRepository.create({ title: 'Lecture 3', courseId: 'other' });

    const lectures = await LectureRepository.getByCourse(courseId);
    expect(lectures).toHaveLength(2);
  });

  test('getByStatus returns lectures with specific status', async () => {
    await LectureRepository.create({ title: 'Pending 1', status: LECTURE_STATUS.PENDING });
    await LectureRepository.create({ title: 'Pending 2', status: LECTURE_STATUS.PENDING });
    await LectureRepository.create({ title: 'Completed', status: LECTURE_STATUS.COMPLETED });

    const pending = await LectureRepository.getByStatus(LECTURE_STATUS.PENDING);
    expect(pending).toHaveLength(2);
  });

  test('updateProgress updates watch progress', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const updated = await LectureRepository.updateProgress(lecture.id, 50);
    expect(updated.watchProgress).toBe(50);
  });

  test('updateStatus changes lecture status', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const updated = await LectureRepository.updateStatus(lecture.id, LECTURE_STATUS.COMPLETED);
    expect(updated.status).toBe(LECTURE_STATUS.COMPLETED);
  });
});

describe('SegmentRepository', () => {
  let lectureId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create creates a new segment', async () => {
    const segment = await SegmentRepository.create({
      lectureId,
      startTime: 0,
      endTime: 60,
      type: 'slide'
    });
    expect(segment.id).toBeDefined();
    expect(segment.lectureId).toBe(lectureId);
  });

  test('getByLecture returns segments for a lecture', async () => {
    await SegmentRepository.create({ lectureId, startTime: 0, endTime: 60 });
    await SegmentRepository.create({ lectureId, startTime: 60, endTime: 120 });

    const segments = await SegmentRepository.getByLecture(lectureId);
    expect(segments).toHaveLength(2);
  });

  test('getByLecture returns segments sorted by startTime', async () => {
    await SegmentRepository.create({ lectureId, startTime: 120, endTime: 180 });
    await SegmentRepository.create({ lectureId, startTime: 0, endTime: 60 });
    await SegmentRepository.create({ lectureId, startTime: 60, endTime: 120 });

    const segments = await SegmentRepository.getByLecture(lectureId);
    expect(segments[0].startTime).toBe(0);
    expect(segments[1].startTime).toBe(60);
    expect(segments[2].startTime).toBe(120);
  });
});

describe('EventRepository', () => {
  let lectureId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create creates a new event', async () => {
    const event = await EventRepository.create({
      lectureId,
      type: 'slide_change',
      timestamp: 1000
    });
    expect(event.id).toBeDefined();
    expect(event.type).toBe('slide_change');
  });

  test('getByLecture returns events for a lecture', async () => {
    await EventRepository.create({ lectureId, type: 'pause', timestamp: 100 });
    await EventRepository.create({ lectureId, type: 'play', timestamp: 110 });

    const events = await EventRepository.getByLecture(lectureId);
    expect(events).toHaveLength(2);
  });

  test('getByType returns events of specific type', async () => {
    await EventRepository.create({ lectureId, type: 'pause', timestamp: 100 });
    await EventRepository.create({ lectureId, type: 'pause', timestamp: 200 });
    await EventRepository.create({ lectureId, type: 'play', timestamp: 150 });

    const pauses = await EventRepository.getByType(lectureId, 'pause');
    expect(pauses).toHaveLength(2);
  });
});

describe('ProgressRepository', () => {
  let lectureId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('getOrCreate returns existing progress', async () => {
    const progress1 = await ProgressRepository.getOrCreate(lectureId);
    const progress2 = await ProgressRepository.getOrCreate(lectureId);
    expect(progress1.id).toBe(progress2.id);
  });

  test('getOrCreate creates new progress if none exists', async () => {
    const progress = await ProgressRepository.getOrCreate(lectureId);
    expect(progress.lectureId).toBe(lectureId);
    expect(progress.lastPosition).toBe(0);
  });

  test('updatePosition updates last position', async () => {
    await ProgressRepository.getOrCreate(lectureId);
    const updated = await ProgressRepository.updatePosition(lectureId, 120);
    expect(updated.lastPosition).toBe(120);
  });

  test('markSegmentCompleted adds segment to completed list', async () => {
    await ProgressRepository.getOrCreate(lectureId);
    const segmentId = generateId();
    const updated = await ProgressRepository.markSegmentCompleted(lectureId, segmentId);
    expect(updated.completedSegments).toContain(segmentId);
  });

  test('markSegmentCompleted does not add duplicate segments', async () => {
    await ProgressRepository.getOrCreate(lectureId);
    const segmentId = generateId();
    await ProgressRepository.markSegmentCompleted(lectureId, segmentId);
    const updated = await ProgressRepository.markSegmentCompleted(lectureId, segmentId);
    expect(updated.completedSegments.filter(id => id === segmentId)).toHaveLength(1);
  });
});

describe('FlashcardRepository', () => {
  let lectureId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create creates a new flashcard', async () => {
    const flashcard = await FlashcardRepository.create({
      lectureId,
      front: 'What is AI?',
      back: 'Artificial Intelligence'
    });
    expect(flashcard.id).toBeDefined();
    expect(flashcard.status).toBe(FLASHCARD_STATUS.NEW);
    expect(flashcard.easeFactor).toBe(2.5);
  });

  test('getByLecture returns flashcards for a lecture', async () => {
    await FlashcardRepository.create({ lectureId, front: 'Q1', back: 'A1' });
    await FlashcardRepository.create({ lectureId, front: 'Q2', back: 'A2' });

    const flashcards = await FlashcardRepository.getByLecture(lectureId);
    expect(flashcards).toHaveLength(2);
  });

  test('getDue returns flashcards that are due for review', async () => {
    const pastDue = Date.now() - 86400000; // 1 day ago
    const futureDue = Date.now() + 86400000; // 1 day from now

    await FlashcardRepository.create({ lectureId, front: 'Q1', back: 'A1', dueDate: pastDue });
    await FlashcardRepository.create({ lectureId, front: 'Q2', back: 'A2', dueDate: pastDue });
    await FlashcardRepository.create({ lectureId, front: 'Q3', back: 'A3', dueDate: futureDue });

    const due = await FlashcardRepository.getDue();
    expect(due).toHaveLength(2);
  });

  test('getDue respects limit parameter', async () => {
    const pastDue = Date.now() - 86400000;
    await FlashcardRepository.create({ lectureId, front: 'Q1', back: 'A1', dueDate: pastDue });
    await FlashcardRepository.create({ lectureId, front: 'Q2', back: 'A2', dueDate: pastDue });
    await FlashcardRepository.create({ lectureId, front: 'Q3', back: 'A3', dueDate: pastDue });

    const due = await FlashcardRepository.getDue(2);
    expect(due).toHaveLength(2);
  });

  test('getByStatus returns flashcards with specific status', async () => {
    await FlashcardRepository.create({ lectureId, front: 'Q1', back: 'A1', status: FLASHCARD_STATUS.NEW });
    await FlashcardRepository.create({ lectureId, front: 'Q2', back: 'A2', status: FLASHCARD_STATUS.NEW });
    await FlashcardRepository.create({ lectureId, front: 'Q3', back: 'A3', status: FLASHCARD_STATUS.REVIEW });

    const newCards = await FlashcardRepository.getByStatus(FLASHCARD_STATUS.NEW);
    expect(newCards).toHaveLength(2);
  });

  test('reviewCard applies SM-2 algorithm and updates flashcard', async () => {
    const flashcard = await FlashcardRepository.create({
      lectureId,
      front: 'Q',
      back: 'A'
    });

    // Review with quality 4 (good)
    const reviewed = await FlashcardRepository.reviewCard(flashcard.id, 4);
    expect(reviewed.repetitions).toBe(1);
    expect(reviewed.interval).toBe(1);
    expect(reviewed.status).toBe(FLASHCARD_STATUS.LEARNING);
  });

  test('reviewCard handles failed review (quality < 3)', async () => {
    const flashcard = await FlashcardRepository.create({
      lectureId,
      front: 'Q',
      back: 'A',
      repetitions: 5,
      interval: 30
    });

    // Review with quality 2 (fail)
    const reviewed = await FlashcardRepository.reviewCard(flashcard.id, 2);
    expect(reviewed.repetitions).toBe(0);
    expect(reviewed.interval).toBe(1);
  });

  test('reviewCard handles quality=0 (complete failure)', async () => {
    const flashcard = await FlashcardRepository.create({
      lectureId,
      front: 'Q',
      back: 'A',
      easeFactor: 2.5,
      repetitions: 5,
      interval: 30
    });

    const reviewed = await FlashcardRepository.reviewCard(flashcard.id, 0);
    expect(reviewed.repetitions).toBe(0);
    expect(reviewed.interval).toBe(1);
    // Ease factor should NOT change on failed review
    expect(reviewed.easeFactor).toBe(2.5);
  });

  test('reviewCard throws error for invalid quality', async () => {
    const flashcard = await FlashcardRepository.create({
      lectureId,
      front: 'Q',
      back: 'A'
    });

    await expect(FlashcardRepository.reviewCard(flashcard.id, -1))
      .rejects.toThrow('Quality must be an integer between 0 and 5');
    await expect(FlashcardRepository.reviewCard(flashcard.id, 6))
      .rejects.toThrow('Quality must be an integer between 0 and 5');
  });
});

describe('SM-2 Algorithm', () => {
  test('calculateSM2 returns correct values for first successful review', () => {
    const card = { interval: 0, easeFactor: 2.5, repetitions: 0 };
    const result = calculateSM2(card, 4);

    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBeCloseTo(2.5, 1);
  });

  test('calculateSM2 returns correct values for second successful review', () => {
    const card = { interval: 1, easeFactor: 2.5, repetitions: 1 };
    const result = calculateSM2(card, 4);

    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  test('calculateSM2 returns correct values for third+ successful review', () => {
    const card = { interval: 6, easeFactor: 2.5, repetitions: 2 };
    const result = calculateSM2(card, 4);

    expect(result.repetitions).toBe(3);
    expect(result.interval).toBe(15); // 6 * 2.5 = 15
  });

  test('calculateSM2 resets on failed review (quality < 3)', () => {
    const card = { interval: 30, easeFactor: 2.5, repetitions: 5 };
    const result = calculateSM2(card, 2);

    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  test('calculateSM2 adjusts ease factor based on quality', () => {
    const card = { interval: 6, easeFactor: 2.5, repetitions: 2 };

    // Quality 5 (easy) should increase ease factor
    const easy = calculateSM2(card, 5);
    expect(easy.easeFactor).toBeGreaterThan(2.5);

    // Quality 3 (hard) should decrease ease factor
    const hard = calculateSM2(card, 3);
    expect(hard.easeFactor).toBeLessThan(2.5);
  });

  test('calculateSM2 never lets ease factor go below 1.3', () => {
    const card = { interval: 6, easeFactor: 1.3, repetitions: 2 };
    const result = calculateSM2(card, 3);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  test('calculateSM2 sets dueDate correctly', () => {
    const card = { interval: 6, easeFactor: 2.5, repetitions: 2 };
    const before = Date.now();
    const result = calculateSM2(card, 4);
    const after = Date.now();

    // Due date should be ~15 days from now (interval * 86400000 ms)
    const expectedMin = before + 15 * 86400000;
    const expectedMax = after + 15 * 86400000;
    expect(result.dueDate).toBeGreaterThanOrEqual(expectedMin);
    expect(result.dueDate).toBeLessThanOrEqual(expectedMax);
  });

  test('calculateSM2 handles quality=0 (complete blackout)', () => {
    const card = { interval: 30, easeFactor: 2.5, repetitions: 5 };
    const result = calculateSM2(card, 0);

    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    // Per SM-2 spec: ease factor should NOT change on failed review
    expect(result.easeFactor).toBe(2.5);
  });

  test('calculateSM2 handles quality=1 (incorrect but remembered)', () => {
    const card = { interval: 30, easeFactor: 2.5, repetitions: 5 };
    const result = calculateSM2(card, 1);

    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    // Per SM-2 spec: ease factor should NOT change on failed review
    expect(result.easeFactor).toBe(2.5);
  });

  test('calculateSM2 does NOT adjust ease factor on failed review (quality < 3)', () => {
    const card = { interval: 30, easeFactor: 2.0, repetitions: 5 };

    // Test quality 0, 1, 2 - all should preserve ease factor
    expect(calculateSM2(card, 0).easeFactor).toBe(2.0);
    expect(calculateSM2(card, 1).easeFactor).toBe(2.0);
    expect(calculateSM2(card, 2).easeFactor).toBe(2.0);
  });

  test('calculateSM2 throws error for invalid quality', () => {
    const card = { interval: 6, easeFactor: 2.5, repetitions: 2 };

    expect(() => calculateSM2(card, -1)).toThrow('Quality must be an integer between 0 and 5');
    expect(() => calculateSM2(card, 6)).toThrow('Quality must be an integer between 0 and 5');
    expect(() => calculateSM2(card, 3.5)).toThrow('Quality must be an integer between 0 and 5');
    expect(() => calculateSM2(card, 'good')).toThrow('Quality must be an integer between 0 and 5');
    expect(() => calculateSM2(card, null)).toThrow('Quality must be an integer between 0 and 5');
    expect(() => calculateSM2(card, undefined)).toThrow('Quality must be an integer between 0 and 5');
  });
});

describe('BookmarkRepository', () => {
  let lectureId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create creates a new bookmark', async () => {
    const bookmark = await BookmarkRepository.create({
      lectureId,
      timestamp: 120
    });
    expect(bookmark.id).toBeDefined();
    expect(bookmark.timestamp).toBe(120);
  });

  test('getByLecture returns bookmarks for a lecture sorted by timestamp', async () => {
    await BookmarkRepository.create({ lectureId, timestamp: 200 });
    await BookmarkRepository.create({ lectureId, timestamp: 100 });
    await BookmarkRepository.create({ lectureId, timestamp: 300 });

    const bookmarks = await BookmarkRepository.getByLecture(lectureId);
    expect(bookmarks).toHaveLength(3);
    expect(bookmarks[0].timestamp).toBe(100);
    expect(bookmarks[1].timestamp).toBe(200);
    expect(bookmarks[2].timestamp).toBe(300);
  });
});

describe('ConfusionVoteRepository', () => {
  let lectureId;
  let segmentId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
    segmentId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create creates a new confusion vote', async () => {
    const vote = await ConfusionVoteRepository.create({
      lectureId,
      segmentId
    });
    expect(vote.id).toBeDefined();
  });

  test('getByLecture returns votes for a lecture', async () => {
    await ConfusionVoteRepository.create({ lectureId, segmentId });
    await ConfusionVoteRepository.create({ lectureId, segmentId: generateId() });

    const votes = await ConfusionVoteRepository.getByLecture(lectureId);
    expect(votes).toHaveLength(2);
  });

  test('getBySegment returns votes for a specific segment', async () => {
    await ConfusionVoteRepository.create({ lectureId, segmentId });
    await ConfusionVoteRepository.create({ lectureId, segmentId });
    await ConfusionVoteRepository.create({ lectureId, segmentId: generateId() });

    const votes = await ConfusionVoteRepository.getBySegment(segmentId);
    expect(votes).toHaveLength(2);
  });

  test('countBySegment returns vote count for a segment', async () => {
    await ConfusionVoteRepository.create({ lectureId, segmentId });
    await ConfusionVoteRepository.create({ lectureId, segmentId });

    const count = await ConfusionVoteRepository.countBySegment(segmentId);
    expect(count).toBe(2);
  });
});

describe('SyncQueueRepository', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('enqueue adds item to sync queue', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: { front: 'Q', back: 'A' }
    });
    expect(item.id).toBeDefined();
    expect(item.status).toBe('pending');
  });

  test('getPending returns pending items', async () => {
    await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    const pending = await SyncQueueRepository.getPending();
    expect(pending).toHaveLength(2);
  });

  test('markSyncing updates item status to syncing', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'bookmark',
      entityId: generateId(),
      payload: {}
    });

    const updated = await SyncQueueRepository.markSyncing(item.id);
    expect(updated.status).toBe('syncing');
  });

  test('markCompleted updates item status to completed', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.DELETE,
      entityType: 'event',
      entityId: generateId(),
      payload: {}
    });

    const updated = await SyncQueueRepository.markCompleted(item.id);
    expect(updated.status).toBe('completed');
  });

  test('markFailed updates item status and increments retry count', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'progress',
      entityId: generateId(),
      payload: {}
    });

    const updated = await SyncQueueRepository.markFailed(item.id);
    expect(updated.status).toBe('failed');
    expect(updated.retryCount).toBe(1);
  });

  test('clearCompleted removes completed items', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await SyncQueueRepository.markCompleted(item.id);

    await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    await SyncQueueRepository.clearCompleted();
    const all = await SyncQueueRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('pending');
  });

  test('getStuck returns items in SYNCING state', async () => {
    const item1 = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await SyncQueueRepository.markSyncing(item1.id);

    // Create a pending item (should not be returned)
    await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    const stuck = await SyncQueueRepository.getStuck();
    expect(stuck).toHaveLength(1);
    expect(stuck[0].id).toBe(item1.id);
    expect(stuck[0].status).toBe('syncing');
  });

  test('getStuck with maxAgeMs filters by age', async () => {
    // Create an item and set its createdAt to be old (simulating stuck item)
    const oldItem = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });
    await SyncQueueRepository.markSyncing(oldItem.id);

    // Manually update createdAt to be 10 seconds ago
    const oldItemData = await SyncQueueRepository.getById(oldItem.id);
    oldItemData.createdAt = Date.now() - 10000; // 10 seconds ago
    await put('syncQueue', oldItemData);

    // Create a recent item in SYNCING state
    const recentItem = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'bookmark',
      entityId: generateId(),
      payload: {}
    });
    await SyncQueueRepository.markSyncing(recentItem.id);

    // Without filter - should return both
    const allStuck = await SyncQueueRepository.getStuck();
    expect(allStuck).toHaveLength(2);

    // With 5 second age filter - only old item should be returned
    const oldStuck = await SyncQueueRepository.getStuck(5000);
    expect(oldStuck).toHaveLength(1);
    expect(oldStuck[0].id).toBe(oldItem.id);

    // With 20 second age filter - neither should be returned (both are newer)
    const noneStuck = await SyncQueueRepository.getStuck(20000);
    expect(noneStuck).toHaveLength(0);
  });

  test('resetToPending resets item status to pending', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await SyncQueueRepository.markSyncing(item.id);

    const reset = await SyncQueueRepository.resetToPending(item.id);
    expect(reset.status).toBe('pending');
  });

  test('markPermanentlyFailed sets status to failed WITHOUT incrementing retryCount', async () => {
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });
    expect(item.retryCount).toBe(0);

    const failed = await SyncQueueRepository.markPermanentlyFailed(item.id);
    expect(failed.status).toBe('failed');
    expect(failed.retryCount).toBe(0); // NOT incremented

    // Verify it's persisted correctly
    const retrieved = await SyncQueueRepository.getById(item.id);
    expect(retrieved.status).toBe('failed');
    expect(retrieved.retryCount).toBe(0);
  });

  test('markPermanentlyFailed throws for non-existent item', async () => {
    await expect(
      SyncQueueRepository.markPermanentlyFailed('non-existent-id')
    ).rejects.toThrow('Sync item not found');
  });
});

describe('Cascade Delete', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('deleting a lecture removes all related entities', async () => {
    // Create a lecture
    const lecture = await LectureRepository.create({ title: 'To Delete' });
    const lectureId = lecture.id;

    // Create related entities
    await SegmentRepository.create({ lectureId, startTime: 0, endTime: 60 });
    await SegmentRepository.create({ lectureId, startTime: 60, endTime: 120 });
    await EventRepository.create({ lectureId, type: 'pause', timestamp: 50 });
    await FlashcardRepository.create({ lectureId, front: 'Q', back: 'A' });
    await BookmarkRepository.create({ lectureId, timestamp: 30 });
    await ProgressRepository.getOrCreate(lectureId);

    // Verify entities exist
    expect((await SegmentRepository.getByLecture(lectureId)).length).toBe(2);
    expect((await EventRepository.getByLecture(lectureId)).length).toBe(1);
    expect((await FlashcardRepository.getByLecture(lectureId)).length).toBe(1);
    expect((await BookmarkRepository.getByLecture(lectureId)).length).toBe(1);

    // Delete lecture with cascade
    await LectureRepository.deleteWithCascade(lectureId);

    // Verify all related entities are deleted
    expect(await LectureRepository.getById(lectureId)).toBeUndefined();
    expect((await SegmentRepository.getByLecture(lectureId)).length).toBe(0);
    expect((await EventRepository.getByLecture(lectureId)).length).toBe(0);
    expect((await FlashcardRepository.getByLecture(lectureId)).length).toBe(0);
    expect((await BookmarkRepository.getByLecture(lectureId)).length).toBe(0);
  });

  test('deleting a course removes all related lectures and their entities', async () => {
    // Create a course
    const course = await CourseRepository.create({ name: 'To Delete' });
    const courseId = course.id;

    // Create lectures in the course
    const lecture1 = await LectureRepository.create({ title: 'Lecture 1', courseId });
    const lecture2 = await LectureRepository.create({ title: 'Lecture 2', courseId });

    // Create related entities
    await FlashcardRepository.create({ lectureId: lecture1.id, front: 'Q1', back: 'A1' });
    await FlashcardRepository.create({ lectureId: lecture2.id, front: 'Q2', back: 'A2' });

    // Delete course with cascade
    await CourseRepository.deleteWithCascade(courseId);

    // Verify all related entities are deleted
    expect(await CourseRepository.getById(courseId)).toBeUndefined();
    expect(await LectureRepository.getById(lecture1.id)).toBeUndefined();
    expect(await LectureRepository.getById(lecture2.id)).toBeUndefined();
    expect((await FlashcardRepository.getByLecture(lecture1.id)).length).toBe(0);
    expect((await FlashcardRepository.getByLecture(lecture2.id)).length).toBe(0);
  });
});

describe('RecordingSessionRepository', () => {
  let lectureId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create stores a recording session and retrieves it', async () => {
    const session = await RecordingSessionRepository.create({
      lectureId,
      mimeType: 'audio/webm;codecs=opus'
    });
    expect(session.id).toBeDefined();
    expect(session.status).toBe(RECORDING_STATUS.RECORDING);

    const retrieved = await RecordingSessionRepository.getById(session.id);
    expect(retrieved.lectureId).toBe(lectureId);
    expect(retrieved.mimeType).toBe('audio/webm;codecs=opus');
  });

  test('getByStatus returns sessions with matching status', async () => {
    await RecordingSessionRepository.create({ lectureId, status: RECORDING_STATUS.RECORDING });
    await RecordingSessionRepository.create({ lectureId, status: RECORDING_STATUS.RECORDING });
    await RecordingSessionRepository.create({ lectureId, status: RECORDING_STATUS.STOPPED });

    const recording = await RecordingSessionRepository.getByStatus(RECORDING_STATUS.RECORDING);
    expect(recording).toHaveLength(2);

    const stopped = await RecordingSessionRepository.getByStatus(RECORDING_STATUS.STOPPED);
    expect(stopped).toHaveLength(1);
  });

  test('getByLecture returns sessions for a lecture', async () => {
    const otherLectureId = generateId();
    await RecordingSessionRepository.create({ lectureId });
    await RecordingSessionRepository.create({ lectureId });
    await RecordingSessionRepository.create({ lectureId: otherLectureId });

    const sessions = await RecordingSessionRepository.getByLecture(lectureId);
    expect(sessions).toHaveLength(2);
  });

  test('update modifies session fields and sets updatedAt', async () => {
    const session = await RecordingSessionRepository.create({ lectureId });
    const updated = await RecordingSessionRepository.update(session.id, {
      status: RECORDING_STATUS.STOPPED,
      duration: 60
    });
    expect(updated.status).toBe(RECORDING_STATUS.STOPPED);
    expect(updated.duration).toBe(60);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(session.updatedAt);
  });

  test('delete removes a session', async () => {
    const session = await RecordingSessionRepository.create({ lectureId });
    await RecordingSessionRepository.delete(session.id);
    const result = await RecordingSessionRepository.getById(session.id);
    expect(result).toBeUndefined();
  });
});

describe('AudioDataRepository', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create stores audio data with key-shared id and retrieves it', async () => {
    const sessionId = generateId();
    const audio = await AudioDataRepository.create({
      id: sessionId,
      size: 1024
    });
    expect(audio.id).toBe(sessionId);

    const retrieved = await AudioDataRepository.getById(sessionId);
    expect(retrieved.size).toBe(1024);
  });

  test('getById returns undefined for unknown id', async () => {
    const result = await AudioDataRepository.getById('nonexistent');
    expect(result).toBeUndefined();
  });

  test('delete removes audio data', async () => {
    const sessionId = generateId();
    await AudioDataRepository.create({ id: sessionId });
    await AudioDataRepository.delete(sessionId);
    const result = await AudioDataRepository.getById(sessionId);
    expect(result).toBeUndefined();
  });
});

describe('PhotoCaptureRepository', () => {
  let recordingSessionId;

  beforeEach(async () => {
    await openDatabase();
    recordingSessionId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create stores photo and retrieves it', async () => {
    const photo = await PhotoCaptureRepository.create({
      recordingSessionId,
      timestampMs: 5000,
      size: 512000,
      caption: 'Slide 3'
    });
    expect(photo.id).toBeDefined();
    expect(photo.recordingSessionId).toBe(recordingSessionId);

    const retrieved = await PhotoCaptureRepository.getById(photo.id);
    expect(retrieved.timestampMs).toBe(5000);
    expect(retrieved.caption).toBe('Slide 3');
  });

  test('getBySession returns photos for a session', async () => {
    const otherSessionId = generateId();
    await PhotoCaptureRepository.create({ recordingSessionId, timestampMs: 1000 });
    await PhotoCaptureRepository.create({ recordingSessionId, timestampMs: 2000 });
    await PhotoCaptureRepository.create({ recordingSessionId: otherSessionId, timestampMs: 3000 });

    const photos = await PhotoCaptureRepository.getBySession(recordingSessionId);
    expect(photos).toHaveLength(2);
  });

  test('getBySession returns empty array for unknown session', async () => {
    const photos = await PhotoCaptureRepository.getBySession('non-existent-session');
    expect(photos).toHaveLength(0);
  });

  test('delete removes a photo', async () => {
    const photo = await PhotoCaptureRepository.create({ recordingSessionId });
    await PhotoCaptureRepository.delete(photo.id);
    const result = await PhotoCaptureRepository.getById(photo.id);
    expect(result).toBeUndefined();
  });
});

describe('AutoNoteRepository', () => {
  let lectureId;

  beforeEach(async () => {
    await openDatabase();
    lectureId = generateId();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('create stores auto-note and retrieves it', async () => {
    const note = await AutoNoteRepository.create({
      lectureId,
      content: 'Key points from lecture...',
      source: AUTO_NOTE_SOURCE.EXTRACTIVE
    });
    expect(note.id).toBeDefined();
    expect(note.lectureId).toBe(lectureId);

    const retrieved = await AutoNoteRepository.getById(note.id);
    expect(retrieved.content).toBe('Key points from lecture...');
    expect(retrieved.source).toBe('extractive');
  });

  test('getByLecture returns note for a lecture', async () => {
    await AutoNoteRepository.create({
      lectureId,
      content: 'Summary text'
    });

    const note = await AutoNoteRepository.getByLecture(lectureId);
    expect(note).toBeDefined();
    expect(note.content).toBe('Summary text');
  });

  test('update overwrites existing note', async () => {
    const note = await AutoNoteRepository.create({
      lectureId,
      content: 'Original content',
      source: AUTO_NOTE_SOURCE.EXTRACTIVE
    });

    const updated = await AutoNoteRepository.update({
      ...note,
      content: 'Updated content',
      editedAt: Date.now()
    });

    const retrieved = await AutoNoteRepository.getById(note.id);
    expect(retrieved.content).toBe('Updated content');
    expect(retrieved.editedAt).toBeDefined();
  });

  test('delete removes a note', async () => {
    const note = await AutoNoteRepository.create({ lectureId, content: 'To delete' });
    await AutoNoteRepository.delete(note.id);
    const result = await AutoNoteRepository.getById(note.id);
    expect(result).toBeUndefined();
  });
});

describe('Performance Tests', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  test('query performance < 50ms for 1000 records', async () => {
    const lectureId = generateId();

    // Create 1000 flashcards
    const createPromises = [];
    for (let i = 0; i < 1000; i++) {
      createPromises.push(
        FlashcardRepository.create({
          lectureId,
          front: `Question ${i}`,
          back: `Answer ${i}`
        })
      );
    }
    await Promise.all(createPromises);

    // Measure query time
    const startTime = performance.now();
    const results = await FlashcardRepository.getByLecture(lectureId);
    const endTime = performance.now();
    const queryTime = endTime - startTime;

    expect(results).toHaveLength(1000);
    expect(queryTime).toBeLessThan(50);
  }, 30000); // 30 second timeout for this test

  test('batch insert performance', async () => {
    const lectureId = generateId();

    const startTime = performance.now();

    // Create 100 flashcards
    const createPromises = [];
    for (let i = 0; i < 100; i++) {
      createPromises.push(
        FlashcardRepository.create({
          lectureId,
          front: `Q${i}`,
          back: `A${i}`
        })
      );
    }
    await Promise.all(createPromises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should complete in reasonable time
    expect(totalTime).toBeLessThan(5000); // 5 seconds max
  });
});
