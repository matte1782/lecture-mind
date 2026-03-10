/**
 * @fileoverview Unit tests for data models (models.js)
 * Tests entity types, factory functions, and validation
 */

import {
  // Factory functions
  createSetting,
  createCourse,
  createLecture,
  createSegment,
  createEvent,
  createProgress,
  createFlashcard,
  createBookmark,
  createConfusionVote,
  createSyncQueueItem,
  // Validation functions
  validateSetting,
  validateCourse,
  validateLecture,
  validateSegment,
  validateEvent,
  validateProgress,
  validateFlashcard,
  validateBookmark,
  validateConfusionVote,
  validateSyncQueueItem,
  // Constants
  LECTURE_STATUS,
  FLASHCARD_STATUS,
  EVENT_TYPES,
  SYNC_OPERATION,
  SYNC_STATUS,
  RECORDING_STATUS,
  AUTO_NOTE_SOURCE,
  OCR_STATUS,
  // v0.5.0 Factory functions
  createRecordingSession,
  createAudioData,
  createPhotoCapture,
  createAutoNote,
  // v0.5.0 Validation functions
  validateRecordingSession,
  validateAudioData,
  validatePhotoCapture,
  validateAutoNote
} from './models.js';

// Helper to generate unique IDs for testing
const generateId = () => `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

describe('Constants', () => {
  describe('LECTURE_STATUS', () => {
    test('contains all valid lecture statuses', () => {
      expect(LECTURE_STATUS).toEqual({
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
        ARCHIVED: 'archived'
      });
    });
  });

  describe('FLASHCARD_STATUS', () => {
    test('contains all valid flashcard statuses', () => {
      expect(FLASHCARD_STATUS).toEqual({
        NEW: 'new',
        LEARNING: 'learning',
        REVIEW: 'review',
        MASTERED: 'mastered'
      });
    });
  });

  describe('EVENT_TYPES', () => {
    test('contains all valid event types', () => {
      expect(EVENT_TYPES).toContain('slide_change');
      expect(EVENT_TYPES).toContain('scene_change');
      expect(EVENT_TYPES).toContain('pause');
      expect(EVENT_TYPES).toContain('seek');
    });
  });

  describe('SYNC_OPERATION', () => {
    test('contains all valid sync operations', () => {
      expect(SYNC_OPERATION).toEqual({
        CREATE: 'create',
        UPDATE: 'update',
        DELETE: 'delete'
      });
    });
  });

  describe('SYNC_STATUS', () => {
    test('contains all valid sync statuses', () => {
      expect(SYNC_STATUS).toEqual({
        PENDING: 'pending',
        SYNCING: 'syncing',
        FAILED: 'failed',
        COMPLETED: 'completed'
      });
    });
  });
});

describe('Setting Entity', () => {
  describe('createSetting factory', () => {
    test('creates a setting with required fields', () => {
      const setting = createSetting({ key: 'theme', value: 'dark' });
      expect(setting.key).toBe('theme');
      expect(setting.value).toBe('dark');
    });

    test('throws error if key is missing', () => {
      expect(() => createSetting({ value: 'test' })).toThrow('key is required');
    });

    test('allows any value type', () => {
      const setting1 = createSetting({ key: 'string', value: 'test' });
      const setting2 = createSetting({ key: 'number', value: 42 });
      const setting3 = createSetting({ key: 'object', value: { nested: true } });
      const setting4 = createSetting({ key: 'array', value: [1, 2, 3] });
      const setting5 = createSetting({ key: 'boolean', value: true });

      expect(setting1.value).toBe('test');
      expect(setting2.value).toBe(42);
      expect(setting3.value).toEqual({ nested: true });
      expect(setting4.value).toEqual([1, 2, 3]);
      expect(setting5.value).toBe(true);
    });
  });

  describe('validateSetting', () => {
    test('returns true for valid setting', () => {
      const setting = createSetting({ key: 'theme', value: 'dark' });
      expect(validateSetting(setting)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for missing key', () => {
      const result = validateSetting({ value: 'test' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('key is required');
    });

    test('returns error for empty key', () => {
      const result = validateSetting({ key: '', value: 'test' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('key must be a non-empty string');
    });
  });
});

describe('Course Entity', () => {
  describe('createCourse factory', () => {
    test('creates a course with required fields', () => {
      const course = createCourse({ name: 'Machine Learning 101' });
      expect(course.id).toBeDefined();
      expect(course.name).toBe('Machine Learning 101');
      expect(course.createdAt).toBeDefined();
      expect(course.updatedAt).toBeDefined();
    });

    test('allows custom id', () => {
      const id = generateId();
      const course = createCourse({ id, name: 'Test Course' });
      expect(course.id).toBe(id);
    });

    test('sets optional fields with defaults', () => {
      const course = createCourse({ name: 'Test' });
      expect(course.description).toBe('');
      expect(course.color).toBeDefined();
    });

    test('throws error if name is missing', () => {
      expect(() => createCourse({})).toThrow('name is required');
    });
  });

  describe('validateCourse', () => {
    test('returns true for valid course', () => {
      const course = createCourse({ name: 'Valid Course' });
      expect(validateCourse(course)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for missing id', () => {
      const result = validateCourse({ name: 'Test' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('id is required');
    });

    test('returns error for missing name', () => {
      const result = validateCourse({ id: 'test-id' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required');
    });
  });
});

describe('Lecture Entity', () => {
  describe('createLecture factory', () => {
    test('creates a lecture with required fields', () => {
      const lecture = createLecture({ title: 'Introduction to AI' });
      expect(lecture.id).toBeDefined();
      expect(lecture.title).toBe('Introduction to AI');
      expect(lecture.status).toBe(LECTURE_STATUS.PENDING);
      expect(lecture.duration).toBe(0);
      expect(lecture.watchProgress).toBe(0);
    });

    test('allows setting courseId', () => {
      const courseId = generateId();
      const lecture = createLecture({ title: 'Test', courseId });
      expect(lecture.courseId).toBe(courseId);
    });

    test('throws error if title is missing', () => {
      expect(() => createLecture({})).toThrow('title is required');
    });
  });

  describe('validateLecture', () => {
    test('returns true for valid lecture', () => {
      const lecture = createLecture({ title: 'Valid Lecture' });
      expect(validateLecture(lecture)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for invalid status', () => {
      const lecture = createLecture({ title: 'Test' });
      lecture.status = 'invalid_status';
      const result = validateLecture(lecture);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('status must be one of');
    });

    test('returns error for negative duration', () => {
      const lecture = createLecture({ title: 'Test' });
      lecture.duration = -1;
      const result = validateLecture(lecture);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('duration must be non-negative');
    });

    test('returns error for invalid watchProgress', () => {
      const lecture = createLecture({ title: 'Test' });
      lecture.watchProgress = 101;
      const result = validateLecture(lecture);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('watchProgress must be between 0 and 100');
    });
  });
});

describe('Segment Entity', () => {
  describe('createSegment factory', () => {
    test('creates a segment with required fields', () => {
      const lectureId = generateId();
      const segment = createSegment({
        lectureId,
        startTime: 0,
        endTime: 60,
        type: 'slide'
      });
      expect(segment.id).toBeDefined();
      expect(segment.lectureId).toBe(lectureId);
      expect(segment.startTime).toBe(0);
      expect(segment.endTime).toBe(60);
    });

    test('throws error if lectureId is missing', () => {
      expect(() => createSegment({ startTime: 0, endTime: 60 })).toThrow('lectureId is required');
    });

    test('throws error if startTime is missing', () => {
      expect(() => createSegment({ lectureId: 'test', endTime: 60 })).toThrow('startTime is required');
    });
  });

  describe('validateSegment', () => {
    test('returns true for valid segment', () => {
      const segment = createSegment({
        lectureId: generateId(),
        startTime: 0,
        endTime: 60,
        type: 'slide'
      });
      expect(validateSegment(segment)).toEqual({ valid: true, errors: [] });
    });

    test('returns error if endTime <= startTime', () => {
      const segment = createSegment({
        lectureId: generateId(),
        startTime: 60,
        endTime: 30,
        type: 'slide'
      });
      const result = validateSegment(segment);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('endTime must be greater than startTime');
    });
  });
});

describe('Event Entity', () => {
  describe('createEvent factory', () => {
    test('creates an event with required fields', () => {
      const lectureId = generateId();
      const event = createEvent({
        lectureId,
        type: 'slide_change',
        timestamp: 1000
      });
      expect(event.id).toBeDefined();
      expect(event.lectureId).toBe(lectureId);
      expect(event.type).toBe('slide_change');
      expect(event.timestamp).toBe(1000);
    });

    test('allows metadata field', () => {
      const event = createEvent({
        lectureId: generateId(),
        type: 'seek',
        timestamp: 1000,
        metadata: { from: 10, to: 50 }
      });
      expect(event.metadata).toEqual({ from: 10, to: 50 });
    });

    test('throws error if lectureId is missing', () => {
      expect(() => createEvent({ type: 'pause', timestamp: 0 })).toThrow('lectureId is required');
    });
  });

  describe('validateEvent', () => {
    test('returns true for valid event', () => {
      const event = createEvent({
        lectureId: generateId(),
        type: 'slide_change',
        timestamp: 1000
      });
      expect(validateEvent(event)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for invalid event type', () => {
      const event = createEvent({
        lectureId: generateId(),
        type: 'slide_change',
        timestamp: 1000
      });
      event.type = 'invalid_type';
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('type must be one of');
    });

    test('returns error for negative timestamp', () => {
      const event = createEvent({
        lectureId: generateId(),
        type: 'pause',
        timestamp: 100
      });
      event.timestamp = -1;
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timestamp must be non-negative');
    });
  });
});

describe('Progress Entity', () => {
  describe('createProgress factory', () => {
    test('creates a progress record with required fields', () => {
      const lectureId = generateId();
      const progress = createProgress({ lectureId });
      expect(progress.id).toBeDefined();
      expect(progress.lectureId).toBe(lectureId);
      expect(progress.lastPosition).toBe(0);
      expect(progress.completedSegments).toEqual([]);
    });

    test('allows setting userId', () => {
      const progress = createProgress({
        lectureId: generateId(),
        userId: 'user-123'
      });
      expect(progress.userId).toBe('user-123');
    });

    test('throws error if lectureId is missing', () => {
      expect(() => createProgress({})).toThrow('lectureId is required');
    });
  });

  describe('validateProgress', () => {
    test('returns true for valid progress', () => {
      const progress = createProgress({ lectureId: generateId() });
      expect(validateProgress(progress)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for negative lastPosition', () => {
      const progress = createProgress({ lectureId: generateId() });
      progress.lastPosition = -1;
      const result = validateProgress(progress);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('lastPosition must be non-negative');
    });

    test('returns error if completedSegments is not an array', () => {
      const progress = createProgress({ lectureId: generateId() });
      progress.completedSegments = 'not-an-array';
      const result = validateProgress(progress);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('completedSegments must be an array');
    });
  });
});

describe('Flashcard Entity', () => {
  describe('createFlashcard factory', () => {
    test('creates a flashcard with required fields', () => {
      const lectureId = generateId();
      const flashcard = createFlashcard({
        lectureId,
        front: 'What is machine learning?',
        back: 'A subset of AI that learns from data'
      });
      expect(flashcard.id).toBeDefined();
      expect(flashcard.lectureId).toBe(lectureId);
      expect(flashcard.front).toBe('What is machine learning?');
      expect(flashcard.back).toBe('A subset of AI that learns from data');
    });

    test('sets SM-2 defaults', () => {
      const flashcard = createFlashcard({
        lectureId: generateId(),
        front: 'Q',
        back: 'A'
      });
      expect(flashcard.interval).toBe(0);
      expect(flashcard.easeFactor).toBe(2.5);
      expect(flashcard.repetitions).toBe(0);
      expect(flashcard.status).toBe(FLASHCARD_STATUS.NEW);
      expect(flashcard.dueDate).toBeDefined();
    });

    test('throws error if lectureId is missing', () => {
      expect(() => createFlashcard({ front: 'Q', back: 'A' })).toThrow('lectureId is required');
    });

    test('throws error if front is missing', () => {
      expect(() => createFlashcard({ lectureId: 'test', back: 'A' })).toThrow('front is required');
    });

    test('throws error if back is missing', () => {
      expect(() => createFlashcard({ lectureId: 'test', front: 'Q' })).toThrow('back is required');
    });
  });

  describe('validateFlashcard', () => {
    test('returns true for valid flashcard', () => {
      const flashcard = createFlashcard({
        lectureId: generateId(),
        front: 'Q',
        back: 'A'
      });
      expect(validateFlashcard(flashcard)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for invalid status', () => {
      const flashcard = createFlashcard({
        lectureId: generateId(),
        front: 'Q',
        back: 'A'
      });
      flashcard.status = 'invalid';
      const result = validateFlashcard(flashcard);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('status must be one of');
    });

    test('returns error for easeFactor below minimum', () => {
      const flashcard = createFlashcard({
        lectureId: generateId(),
        front: 'Q',
        back: 'A'
      });
      flashcard.easeFactor = 1.0;
      const result = validateFlashcard(flashcard);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('easeFactor must be >= 1.3');
    });

    test('returns error for negative interval', () => {
      const flashcard = createFlashcard({
        lectureId: generateId(),
        front: 'Q',
        back: 'A'
      });
      flashcard.interval = -1;
      const result = validateFlashcard(flashcard);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('interval must be non-negative');
    });
  });
});

describe('Bookmark Entity', () => {
  describe('createBookmark factory', () => {
    test('creates a bookmark with required fields', () => {
      const lectureId = generateId();
      const bookmark = createBookmark({
        lectureId,
        timestamp: 120
      });
      expect(bookmark.id).toBeDefined();
      expect(bookmark.lectureId).toBe(lectureId);
      expect(bookmark.timestamp).toBe(120);
      expect(bookmark.createdAt).toBeDefined();
    });

    test('allows optional label', () => {
      const bookmark = createBookmark({
        lectureId: generateId(),
        timestamp: 120,
        label: 'Important concept'
      });
      expect(bookmark.label).toBe('Important concept');
    });

    test('throws error if lectureId is missing', () => {
      expect(() => createBookmark({ timestamp: 100 })).toThrow('lectureId is required');
    });

    test('throws error if timestamp is missing', () => {
      expect(() => createBookmark({ lectureId: 'test' })).toThrow('timestamp is required');
    });
  });

  describe('validateBookmark', () => {
    test('returns true for valid bookmark', () => {
      const bookmark = createBookmark({
        lectureId: generateId(),
        timestamp: 120
      });
      expect(validateBookmark(bookmark)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for negative timestamp', () => {
      const bookmark = createBookmark({
        lectureId: generateId(),
        timestamp: 100
      });
      bookmark.timestamp = -1;
      const result = validateBookmark(bookmark);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timestamp must be non-negative');
    });
  });
});

describe('ConfusionVote Entity', () => {
  describe('createConfusionVote factory', () => {
    test('creates a confusion vote with required fields', () => {
      const lectureId = generateId();
      const segmentId = generateId();
      const vote = createConfusionVote({ lectureId, segmentId });
      expect(vote.id).toBeDefined();
      expect(vote.lectureId).toBe(lectureId);
      expect(vote.segmentId).toBe(segmentId);
      expect(vote.createdAt).toBeDefined();
    });

    test('allows optional comment', () => {
      const vote = createConfusionVote({
        lectureId: generateId(),
        segmentId: generateId(),
        comment: 'This part is unclear'
      });
      expect(vote.comment).toBe('This part is unclear');
    });

    test('throws error if lectureId is missing', () => {
      expect(() => createConfusionVote({ segmentId: 'test' })).toThrow('lectureId is required');
    });

    test('throws error if segmentId is missing', () => {
      expect(() => createConfusionVote({ lectureId: 'test' })).toThrow('segmentId is required');
    });
  });

  describe('validateConfusionVote', () => {
    test('returns true for valid confusion vote', () => {
      const vote = createConfusionVote({
        lectureId: generateId(),
        segmentId: generateId()
      });
      expect(validateConfusionVote(vote)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for missing lectureId', () => {
      const result = validateConfusionVote({
        id: 'test',
        segmentId: 'test',
        createdAt: Date.now()
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('lectureId is required');
    });
  });
});

describe('SyncQueueItem Entity', () => {
  describe('createSyncQueueItem factory', () => {
    test('creates a sync queue item with required fields', () => {
      const item = createSyncQueueItem({
        operation: SYNC_OPERATION.CREATE,
        entityType: 'flashcard',
        entityId: generateId(),
        payload: { front: 'Q', back: 'A' }
      });
      expect(item.id).toBeDefined();
      expect(item.operation).toBe(SYNC_OPERATION.CREATE);
      expect(item.entityType).toBe('flashcard');
      expect(item.status).toBe(SYNC_STATUS.PENDING);
      expect(item.retryCount).toBe(0);
    });

    test('throws error if operation is missing', () => {
      expect(() => createSyncQueueItem({
        entityType: 'lecture',
        entityId: 'test',
        payload: {}
      })).toThrow('operation is required');
    });

    test('throws error if entityType is missing', () => {
      expect(() => createSyncQueueItem({
        operation: SYNC_OPERATION.UPDATE,
        entityId: 'test',
        payload: {}
      })).toThrow('entityType is required');
    });
  });

  describe('validateSyncQueueItem', () => {
    test('returns true for valid sync queue item', () => {
      const item = createSyncQueueItem({
        operation: SYNC_OPERATION.UPDATE,
        entityType: 'lecture',
        entityId: generateId(),
        payload: { title: 'Updated' }
      });
      expect(validateSyncQueueItem(item)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for invalid operation', () => {
      const item = createSyncQueueItem({
        operation: SYNC_OPERATION.DELETE,
        entityType: 'lecture',
        entityId: generateId(),
        payload: {}
      });
      item.operation = 'invalid';
      const result = validateSyncQueueItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('operation must be one of');
    });

    test('returns error for invalid status', () => {
      const item = createSyncQueueItem({
        operation: SYNC_OPERATION.CREATE,
        entityType: 'bookmark',
        entityId: generateId(),
        payload: {}
      });
      item.status = 'invalid';
      const result = validateSyncQueueItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('status must be one of');
    });

    test('returns error for negative retryCount', () => {
      const item = createSyncQueueItem({
        operation: SYNC_OPERATION.UPDATE,
        entityType: 'flashcard',
        entityId: generateId(),
        payload: {}
      });
      item.retryCount = -1;
      const result = validateSyncQueueItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('retryCount must be non-negative');
    });
  });
});

describe('Factory Function ID Generation', () => {
  test('generates unique IDs for multiple entities', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const course = createCourse({ name: `Course ${i}` });
      ids.add(course.id);
    }
    expect(ids.size).toBe(100);
  });

  test('generated IDs follow UUID format', () => {
    const course = createCourse({ name: 'Test' });
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(course.id).toMatch(uuidRegex);
  });
});

describe('Timestamp Generation', () => {
  test('createdAt is set to current time', () => {
    const before = Date.now();
    const course = createCourse({ name: 'Test' });
    const after = Date.now();
    expect(course.createdAt).toBeGreaterThanOrEqual(before);
    expect(course.createdAt).toBeLessThanOrEqual(after);
  });

  test('updatedAt equals createdAt on creation', () => {
    const course = createCourse({ name: 'Test' });
    expect(course.updatedAt).toBe(course.createdAt);
  });
});

// ============================================================================
// v0.5.0 Models
// ============================================================================

describe('RECORDING_STATUS constant', () => {
  test('contains all valid recording statuses', () => {
    expect(RECORDING_STATUS).toEqual({
      RECORDING: 'recording',
      STOPPED: 'stopped',
      TRANSCRIBING: 'transcribing',
      COMPLETED: 'completed',
      FAILED: 'failed'
    });
  });
});

describe('AUTO_NOTE_SOURCE constant', () => {
  test('contains all valid auto note sources', () => {
    expect(AUTO_NOTE_SOURCE).toEqual({
      EXTRACTIVE: 'extractive',
      LLM: 'llm',
      IMPORTED: 'imported'
    });
  });
});

describe('OCR_STATUS constant', () => {
  test('contains all valid OCR statuses', () => {
    expect(OCR_STATUS).toEqual({
      PENDING: 'pending',
      COMPLETED: 'completed',
      FAILED: 'failed'
    });
  });
});

describe('RecordingSession Entity', () => {
  describe('createRecordingSession factory', () => {
    test('creates a recording session with defaults', () => {
      const session = createRecordingSession({});
      expect(session.id).toBeDefined();
      expect(session.status).toBe(RECORDING_STATUS.RECORDING);
      expect(session.lectureId).toBeNull();
      expect(session.title).toBeDefined();
      expect(session.duration).toBe(0);
      expect(session.sampleRate).toBe(44100);
      expect(session.mimeType).toBe('');
      expect(session.transcript).toBeNull();
      expect(session.error).toBeNull();
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    test('creates with custom fields', () => {
      const lectureId = generateId();
      const session = createRecordingSession({
        lectureId,
        title: 'My Recording',
        status: RECORDING_STATUS.STOPPED,
        duration: 1000,
        sampleRate: 48000,
        mimeType: 'audio/webm;codecs=opus'
      });
      expect(session.lectureId).toBe(lectureId);
      expect(session.title).toBe('My Recording');
      expect(session.status).toBe(RECORDING_STATUS.STOPPED);
      expect(session.duration).toBe(1000);
      expect(session.sampleRate).toBe(48000);
      expect(session.mimeType).toBe('audio/webm;codecs=opus');
    });

    test('auto-generates unique id', () => {
      const s1 = createRecordingSession({});
      const s2 = createRecordingSession({});
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('validateRecordingSession', () => {
    test('returns true for valid recording session', () => {
      const session = createRecordingSession({});
      expect(validateRecordingSession(session)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for missing id', () => {
      const result = validateRecordingSession({ status: 'recording', startedAt: Date.now() });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('id is required');
    });
  });
});

describe('AudioData Entity', () => {
  describe('createAudioData factory', () => {
    test('creates audio data with session id (key sharing)', () => {
      const sessionId = generateId();
      const audio = createAudioData({ id: sessionId });
      expect(audio.id).toBe(sessionId);
      expect(audio.blob).toBeNull();
      expect(audio.size).toBe(0);
    });

    test('throws error if id is missing', () => {
      expect(() => createAudioData({})).toThrow('id is required');
    });
  });

  describe('validateAudioData', () => {
    test('returns true for valid audio data', () => {
      const audio = createAudioData({ id: generateId() });
      expect(validateAudioData(audio)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for missing id', () => {
      const result = validateAudioData({ blob: null, size: 0 });
      expect(result.valid).toBe(false);
    });
  });
});

describe('PhotoCapture Entity', () => {
  describe('createPhotoCapture factory', () => {
    test('creates photo capture with defaults', () => {
      const recordingSessionId = generateId();
      const photo = createPhotoCapture({ recordingSessionId });
      expect(photo.id).toBeDefined();
      expect(photo.recordingSessionId).toBe(recordingSessionId);
      expect(photo.timestampMs).toBe(0);
      expect(photo.blob).toBeNull();
      expect(photo.size).toBe(0);
      expect(photo.caption).toBe('');
      expect(photo.ocrText).toBeNull();
      expect(photo.ocrStatus).toBeNull();
      expect(photo.createdAt).toBeDefined();
    });

    test('throws error if recordingSessionId is missing', () => {
      expect(() => createPhotoCapture({})).toThrow('recordingSessionId is required');
    });
  });

  describe('validatePhotoCapture', () => {
    test('returns true for valid photo capture', () => {
      const photo = createPhotoCapture({ recordingSessionId: generateId() });
      expect(validatePhotoCapture(photo)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for missing recordingSessionId', () => {
      const result = validatePhotoCapture({ id: 'test', timestampMs: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('recordingSessionId is required');
    });

    test('returns error for invalid ocrStatus', () => {
      const photo = createPhotoCapture({ recordingSessionId: generateId() });
      photo.ocrStatus = 'banana';
      const result = validatePhotoCapture(photo);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/ocrStatus must be null or one of/);
    });

    test('accepts valid ocrStatus values', () => {
      const photo = createPhotoCapture({ recordingSessionId: generateId(), ocrStatus: 'pending' });
      expect(validatePhotoCapture(photo)).toEqual({ valid: true, errors: [] });
    });

    test('accepts null ocrStatus', () => {
      const photo = createPhotoCapture({ recordingSessionId: generateId() });
      expect(photo.ocrStatus).toBeNull();
      expect(validatePhotoCapture(photo)).toEqual({ valid: true, errors: [] });
    });
  });
});

describe('AutoNote Entity', () => {
  describe('createAutoNote factory', () => {
    test('creates auto note with defaults', () => {
      const lectureId = generateId();
      const note = createAutoNote({ lectureId });
      expect(note.id).toBeDefined();
      expect(note.lectureId).toBe(lectureId);
      expect(note.content).toBe('');
      expect(note.source).toBe(AUTO_NOTE_SOURCE.EXTRACTIVE);
      expect(note.model).toBeNull();
      expect(note.generatedAt).toBeDefined();
      expect(note.editedAt).toBeNull();
    });

    test('throws error if lectureId is missing', () => {
      expect(() => createAutoNote({})).toThrow('lectureId is required');
    });
  });

  describe('validateAutoNote', () => {
    test('returns true for valid auto note', () => {
      const note = createAutoNote({ lectureId: generateId() });
      expect(validateAutoNote(note)).toEqual({ valid: true, errors: [] });
    });

    test('returns error for missing lectureId', () => {
      const result = validateAutoNote({ id: 'test', content: '', source: 'extractive' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('lectureId is required');
    });

    test('returns error for invalid source', () => {
      const note = createAutoNote({ lectureId: generateId() });
      note.source = 'invalid';
      const result = validateAutoNote(note);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('source must be one of');
    });
  });
});
