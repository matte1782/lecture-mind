/**
 * @fileoverview Barrel re-export for Lecture Mind storage layer.
 * Provides a single entry point for all storage APIs.
 *
 * @module storage
 * @version 1.0.0
 *
 * @example
 * import { openDatabase, createCourse, CourseRepository, SyncManager, runStartupMigration } from './storage/index.js';
 */

// ============================================================================
// Database (db.js)
// ============================================================================

export {
  DB_NAME,
  DB_VERSION,
  STORES,
  isIndexedDBAvailable,
  openDatabase,
  closeDatabase,
  deleteDatabase,
  get,
  put,
  remove,
  getAll,
  queryByIndex,
  count,
  clear,
  batch,
  LectureMindDB
} from './db.js';

// ============================================================================
// Models (models.js)
// ============================================================================

export {
  LECTURE_STATUS,
  FLASHCARD_STATUS,
  EVENT_TYPES,
  SYNC_OPERATION,
  SYNC_STATUS,
  RECORDING_STATUS,
  AUTO_NOTE_SOURCE,
  OCR_STATUS,
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
  createRecordingSession,
  createAudioData,
  createPhotoCapture,
  createAutoNote,
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
  validateRecordingSession,
  validateAudioData,
  validatePhotoCapture,
  validateAutoNote
} from './models.js';

// ============================================================================
// Repositories (repositories.js)
// ============================================================================

export {
  calculateSM2,
  BaseRepository,
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
  AutoNoteRepository
} from './repositories.js';

// ============================================================================
// Sync (sync.js)
// ============================================================================

export {
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  MAX_RETRY_COUNT,
  calculateBackoff,
  SyncManager
} from './sync.js';

// ============================================================================
// Migrations (migrations.js)
// ============================================================================

export {
  SCHEMA_VERSION,
  getCurrentVersion,
  setVersion,
  needsMigration,
  migrateFromLocalStorage,
  runStartupMigration
} from './migrations.js';
