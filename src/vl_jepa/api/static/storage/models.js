/**
 * @fileoverview Data models for Lecture Mind storage layer.
 * Defines entity types, factory functions, and validation for all 10 stores.
 *
 * @module storage/models
 * @version 1.0.0
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid lecture statuses
 * @enum {string}
 */
export const LECTURE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ARCHIVED: 'archived'
};

/**
 * Valid flashcard statuses (SM-2 states)
 * @enum {string}
 */
export const FLASHCARD_STATUS = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  MASTERED: 'mastered'
};

/**
 * Valid event types
 * @type {string[]}
 */
export const EVENT_TYPES = [
  'slide_change',
  'scene_change',
  'pause',
  'play',
  'seek',
  'speed_change',
  'fullscreen',
  'volume_change'
];

/**
 * Valid sync operations
 * @enum {string}
 */
export const SYNC_OPERATION = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
};

/**
 * Valid sync statuses
 * @enum {string}
 */
export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  FAILED: 'failed',
  COMPLETED: 'completed'
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a UUID v4
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/**
 * Get current timestamp
 * @returns {number}
 */
function now() {
  return Date.now();
}

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * @typedef {Object} Setting
 * @property {string} key - Unique setting key
 * @property {*} value - Setting value (any type)
 */

/**
 * @typedef {Object} Course
 * @property {string} id - UUID
 * @property {string} name - Course name
 * @property {string} description - Course description
 * @property {string} color - Display color (hex)
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Lecture
 * @property {string} id - UUID
 * @property {string|null} courseId - Parent course ID (optional)
 * @property {string} title - Lecture title
 * @property {number} duration - Duration in seconds
 * @property {'pending'|'processing'|'completed'|'failed'|'archived'} status
 * @property {number} watchProgress - Progress percentage (0-100)
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Segment
 * @property {string} id - UUID
 * @property {string} lectureId - Parent lecture ID
 * @property {number} startTime - Start time in seconds
 * @property {number} endTime - End time in seconds
 * @property {string} type - Segment type (slide, scene, etc.)
 * @property {Object} metadata - Additional segment data
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} Event
 * @property {string} id - UUID
 * @property {string} lectureId - Parent lecture ID
 * @property {string} type - Event type
 * @property {number} timestamp - Video timestamp when event occurred
 * @property {Object} metadata - Additional event data
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} Progress
 * @property {string} id - UUID
 * @property {string} lectureId - Parent lecture ID
 * @property {string|null} userId - User ID (optional, for multi-user support)
 * @property {number} lastPosition - Last watched position in seconds
 * @property {string[]} completedSegments - IDs of completed segments
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Flashcard
 * @property {string} id - UUID
 * @property {string} lectureId - Parent lecture ID
 * @property {string} front - Question/prompt
 * @property {string} back - Answer
 * @property {number} interval - SM-2 interval in days
 * @property {number} easeFactor - SM-2 ease factor (default 2.5, min 1.3)
 * @property {number} repetitions - Number of successful reviews
 * @property {number} dueDate - Next review timestamp
 * @property {'new'|'learning'|'review'|'mastered'} status
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Bookmark
 * @property {string} id - UUID
 * @property {string} lectureId - Parent lecture ID
 * @property {number} timestamp - Video timestamp
 * @property {string} label - Optional label/note
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} ConfusionVote
 * @property {string} id - UUID
 * @property {string} lectureId - Parent lecture ID
 * @property {string} segmentId - Segment ID being marked
 * @property {string} comment - Optional explanation
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} SyncQueueItem
 * @property {string} id - UUID
 * @property {'create'|'update'|'delete'} operation - Sync operation type
 * @property {string} entityType - Entity type (lecture, flashcard, etc.)
 * @property {string} entityId - ID of affected entity
 * @property {Object} payload - Changed data
 * @property {'pending'|'syncing'|'failed'|'completed'} status
 * @property {number} retryCount - Number of retry attempts
 * @property {number} createdAt - Creation timestamp
 */

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a setting record
 * @param {Object} data
 * @param {string} data.key - Setting key (required)
 * @param {*} data.value - Setting value
 * @returns {Setting}
 * @throws {Error} If key is missing
 */
export function createSetting({ key, value }) {
  if (!key) {
    throw new Error('key is required');
  }
  return { key, value };
}

/**
 * Create a course record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID (auto-generated if omitted)
 * @param {string} data.name - Course name (required)
 * @param {string} [data.description=''] - Course description
 * @param {string} [data.color] - Display color (auto-generated if omitted)
 * @returns {Course}
 * @throws {Error} If name is missing
 */
export function createCourse({ id, name, description = '', color }) {
  if (!name) {
    throw new Error('name is required');
  }
  const timestamp = now();
  return {
    id: id || generateUUID(),
    name,
    description,
    color: color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * Create a lecture record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {string} [data.courseId=null] - Parent course ID
 * @param {string} data.title - Lecture title (required)
 * @param {number} [data.duration=0] - Duration in seconds
 * @param {string} [data.status='pending'] - Initial status
 * @param {number} [data.watchProgress=0] - Initial progress
 * @returns {Lecture}
 * @throws {Error} If title is missing
 */
export function createLecture({ id, courseId = null, title, duration = 0, status = LECTURE_STATUS.PENDING, watchProgress = 0 }) {
  if (!title) {
    throw new Error('title is required');
  }
  const timestamp = now();
  return {
    id: id || generateUUID(),
    courseId,
    title,
    duration,
    status,
    watchProgress,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * Create a segment record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {string} data.lectureId - Parent lecture ID (required)
 * @param {number} data.startTime - Start time in seconds (required)
 * @param {number} data.endTime - End time in seconds
 * @param {string} [data.type='unknown'] - Segment type
 * @param {Object} [data.metadata={}] - Additional data
 * @returns {Segment}
 * @throws {Error} If required fields are missing
 */
export function createSegment({ id, lectureId, startTime, endTime, type = 'unknown', metadata = {} }) {
  if (!lectureId) {
    throw new Error('lectureId is required');
  }
  if (startTime === undefined || startTime === null) {
    throw new Error('startTime is required');
  }
  return {
    id: id || generateUUID(),
    lectureId,
    startTime,
    endTime: endTime !== undefined ? endTime : startTime,
    type,
    metadata,
    createdAt: now()
  };
}

/**
 * Create an event record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {string} data.lectureId - Parent lecture ID (required)
 * @param {string} data.type - Event type (required)
 * @param {number} data.timestamp - Video timestamp (required)
 * @param {Object} [data.metadata={}] - Additional data
 * @returns {Event}
 * @throws {Error} If required fields are missing
 */
export function createEvent({ id, lectureId, type, timestamp, metadata = {} }) {
  if (!lectureId) {
    throw new Error('lectureId is required');
  }
  if (!type) {
    throw new Error('type is required');
  }
  if (timestamp === undefined || timestamp === null) {
    throw new Error('timestamp is required');
  }
  return {
    id: id || generateUUID(),
    lectureId,
    type,
    timestamp,
    metadata,
    createdAt: now()
  };
}

/**
 * Create a progress record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {string} data.lectureId - Parent lecture ID (required)
 * @param {string} [data.userId=null] - User ID
 * @param {number} [data.lastPosition=0] - Last position in seconds
 * @param {string[]} [data.completedSegments=[]] - Completed segment IDs
 * @returns {Progress}
 * @throws {Error} If lectureId is missing
 */
export function createProgress({ id, lectureId, userId = null, lastPosition = 0, completedSegments = [] }) {
  if (!lectureId) {
    throw new Error('lectureId is required');
  }
  return {
    id: id || generateUUID(),
    lectureId,
    userId,
    lastPosition,
    completedSegments,
    updatedAt: now()
  };
}

/**
 * Create a flashcard record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {string} data.lectureId - Parent lecture ID (required)
 * @param {string} data.front - Question/prompt (required)
 * @param {string} data.back - Answer (required)
 * @param {number} [data.interval=0] - SM-2 interval in days
 * @param {number} [data.easeFactor=2.5] - SM-2 ease factor
 * @param {number} [data.repetitions=0] - Number of reviews
 * @param {number} [data.dueDate] - Next review timestamp
 * @param {string} [data.status='new'] - Flashcard status
 * @returns {Flashcard}
 * @throws {Error} If required fields are missing
 */
export function createFlashcard({
  id,
  lectureId,
  front,
  back,
  interval = 0,
  easeFactor = 2.5,
  repetitions = 0,
  dueDate,
  status = FLASHCARD_STATUS.NEW
}) {
  if (!lectureId) {
    throw new Error('lectureId is required');
  }
  if (!front) {
    throw new Error('front is required');
  }
  if (!back) {
    throw new Error('back is required');
  }
  const timestamp = now();
  return {
    id: id || generateUUID(),
    lectureId,
    front,
    back,
    interval,
    easeFactor,
    repetitions,
    dueDate: dueDate !== undefined ? dueDate : timestamp,
    status,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * Create a bookmark record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {string} data.lectureId - Parent lecture ID (required)
 * @param {number} data.timestamp - Video timestamp (required)
 * @param {string} [data.label=''] - Optional label
 * @returns {Bookmark}
 * @throws {Error} If required fields are missing
 */
export function createBookmark({ id, lectureId, timestamp, label = '' }) {
  if (!lectureId) {
    throw new Error('lectureId is required');
  }
  if (timestamp === undefined || timestamp === null) {
    throw new Error('timestamp is required');
  }
  return {
    id: id || generateUUID(),
    lectureId,
    timestamp,
    label,
    createdAt: now()
  };
}

/**
 * Create a confusion vote record
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {string} data.lectureId - Parent lecture ID (required)
 * @param {string} data.segmentId - Segment ID (required)
 * @param {string} [data.comment=''] - Optional explanation
 * @returns {ConfusionVote}
 * @throws {Error} If required fields are missing
 */
export function createConfusionVote({ id, lectureId, segmentId, comment = '' }) {
  if (!lectureId) {
    throw new Error('lectureId is required');
  }
  if (!segmentId) {
    throw new Error('segmentId is required');
  }
  return {
    id: id || generateUUID(),
    lectureId,
    segmentId,
    comment,
    createdAt: now()
  };
}

/**
 * Create a sync queue item
 * @param {Object} data
 * @param {string} [data.id] - Custom ID
 * @param {'create'|'update'|'delete'} data.operation - Operation type (required)
 * @param {string} data.entityType - Entity type (required)
 * @param {string} data.entityId - Entity ID (required)
 * @param {Object} [data.payload={}] - Changed data
 * @param {string} [data.status='pending'] - Initial status
 * @param {number} [data.retryCount=0] - Retry attempts
 * @returns {SyncQueueItem}
 * @throws {Error} If required fields are missing
 */
export function createSyncQueueItem({
  id,
  operation,
  entityType,
  entityId,
  payload = {},
  status = SYNC_STATUS.PENDING,
  retryCount = 0
}) {
  if (!operation) {
    throw new Error('operation is required');
  }
  if (!entityType) {
    throw new Error('entityType is required');
  }
  if (!entityId) {
    throw new Error('entityId is required');
  }
  return {
    id: id || generateUUID(),
    operation,
    entityType,
    entityId,
    payload,
    status,
    retryCount,
    createdAt: now()
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a setting
 * @param {Setting} setting
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSetting(setting) {
  const errors = [];
  if (setting.key === undefined || setting.key === null) {
    errors.push('key is required');
  } else if (typeof setting.key !== 'string' || setting.key.length === 0) {
    errors.push('key must be a non-empty string');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a course
 * @param {Course} course
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCourse(course) {
  const errors = [];
  if (!course.id) errors.push('id is required');
  if (!course.name) errors.push('name is required');
  if (course.createdAt !== undefined && typeof course.createdAt !== 'number') {
    errors.push('createdAt must be a number');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a lecture
 * @param {Lecture} lecture
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLecture(lecture) {
  const errors = [];
  if (!lecture.id) errors.push('id is required');
  if (!lecture.title) errors.push('title is required');
  if (lecture.status && !Object.values(LECTURE_STATUS).includes(lecture.status)) {
    errors.push(`status must be one of: ${Object.values(LECTURE_STATUS).join(', ')}`);
  }
  if (lecture.duration !== undefined && lecture.duration < 0) {
    errors.push('duration must be non-negative');
  }
  if (lecture.watchProgress !== undefined && (lecture.watchProgress < 0 || lecture.watchProgress > 100)) {
    errors.push('watchProgress must be between 0 and 100');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a segment
 * @param {Segment} segment
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSegment(segment) {
  const errors = [];
  if (!segment.id) errors.push('id is required');
  if (!segment.lectureId) errors.push('lectureId is required');
  if (segment.startTime === undefined) errors.push('startTime is required');
  if (segment.endTime !== undefined && segment.endTime <= segment.startTime) {
    errors.push('endTime must be greater than startTime');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate an event
 * @param {Event} event
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEvent(event) {
  const errors = [];
  if (!event.id) errors.push('id is required');
  if (!event.lectureId) errors.push('lectureId is required');
  if (!event.type) {
    errors.push('type is required');
  } else if (!EVENT_TYPES.includes(event.type)) {
    errors.push(`type must be one of: ${EVENT_TYPES.join(', ')}`);
  }
  if (event.timestamp === undefined) {
    errors.push('timestamp is required');
  } else if (event.timestamp < 0) {
    errors.push('timestamp must be non-negative');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a progress record
 * @param {Progress} progress
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProgress(progress) {
  const errors = [];
  if (!progress.id) errors.push('id is required');
  if (!progress.lectureId) errors.push('lectureId is required');
  if (progress.lastPosition !== undefined && progress.lastPosition < 0) {
    errors.push('lastPosition must be non-negative');
  }
  if (progress.completedSegments !== undefined && !Array.isArray(progress.completedSegments)) {
    errors.push('completedSegments must be an array');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a flashcard
 * @param {Flashcard} flashcard
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFlashcard(flashcard) {
  const errors = [];
  if (!flashcard.id) errors.push('id is required');
  if (!flashcard.lectureId) errors.push('lectureId is required');
  if (!flashcard.front) errors.push('front is required');
  if (!flashcard.back) errors.push('back is required');
  if (flashcard.status && !Object.values(FLASHCARD_STATUS).includes(flashcard.status)) {
    errors.push(`status must be one of: ${Object.values(FLASHCARD_STATUS).join(', ')}`);
  }
  if (flashcard.easeFactor !== undefined && flashcard.easeFactor < 1.3) {
    errors.push('easeFactor must be >= 1.3');
  }
  if (flashcard.interval !== undefined && flashcard.interval < 0) {
    errors.push('interval must be non-negative');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a bookmark
 * @param {Bookmark} bookmark
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBookmark(bookmark) {
  const errors = [];
  if (!bookmark.id) errors.push('id is required');
  if (!bookmark.lectureId) errors.push('lectureId is required');
  if (bookmark.timestamp === undefined) {
    errors.push('timestamp is required');
  } else if (bookmark.timestamp < 0) {
    errors.push('timestamp must be non-negative');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a confusion vote
 * @param {ConfusionVote} vote
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfusionVote(vote) {
  const errors = [];
  if (!vote.id) errors.push('id is required');
  if (!vote.lectureId) errors.push('lectureId is required');
  if (!vote.segmentId) errors.push('segmentId is required');
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a sync queue item
 * @param {SyncQueueItem} item
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSyncQueueItem(item) {
  const errors = [];
  if (!item.id) errors.push('id is required');
  if (!item.operation) {
    errors.push('operation is required');
  } else if (!Object.values(SYNC_OPERATION).includes(item.operation)) {
    errors.push(`operation must be one of: ${Object.values(SYNC_OPERATION).join(', ')}`);
  }
  if (!item.entityType) errors.push('entityType is required');
  if (!item.entityId) errors.push('entityId is required');
  if (item.status && !Object.values(SYNC_STATUS).includes(item.status)) {
    errors.push(`status must be one of: ${Object.values(SYNC_STATUS).join(', ')}`);
  }
  if (item.retryCount !== undefined && item.retryCount < 0) {
    errors.push('retryCount must be non-negative');
  }
  return { valid: errors.length === 0, errors };
}

export default {
  // Constants
  LECTURE_STATUS,
  FLASHCARD_STATUS,
  EVENT_TYPES,
  SYNC_OPERATION,
  SYNC_STATUS,
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
  validateSyncQueueItem
};
