/**
 * @fileoverview Repository pattern implementation for Lecture Mind storage layer.
 * Provides CRUD operations, specialized queries, SM-2 algorithm, and cascade delete.
 *
 * @module storage/repositories
 * @version 1.0.0
 */

import { get, put, remove, getAll, queryByIndex, count, clear, batch } from './db.js';
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
  FLASHCARD_STATUS,
  SYNC_STATUS
} from './models.js';

// ============================================================================
// SM-2 Algorithm
// ============================================================================

/**
 * Calculate SM-2 spaced repetition values based on review quality.
 * Implements the SuperMemo 2 algorithm exactly as specified.
 * @param {Object} card - Current card state
 * @param {number} card.interval - Current interval in days
 * @param {number} card.easeFactor - Current ease factor
 * @param {number} card.repetitions - Number of successful repetitions
 * @param {number} quality - Review quality (0-5): 0-2 = fail, 3 = hard, 4 = good, 5 = easy
 * @returns {Object} Updated SM-2 values { interval, easeFactor, repetitions, dueDate }
 * @throws {Error} If quality is not in range 0-5
 */
export function calculateSM2(card, quality) {
  // Validate quality parameter
  if (typeof quality !== 'number' || quality < 0 || quality > 5 || !Number.isInteger(quality)) {
    throw new Error('Quality must be an integer between 0 and 5');
  }

  let { interval, easeFactor, repetitions } = card;

  if (quality < 3) {
    // Failed review - reset repetitions and interval
    // Per SM-2 spec: "start repetitions for the item from the beginning WITHOUT CHANGING the E-Factor"
    repetitions = 0;
    interval = 1;
    // Note: easeFactor is NOT adjusted on failed reviews per SM-2 specification
  } else {
    // Successful review - adjust interval and ease factor
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;

    // Adjust ease factor ONLY on successful reviews (quality >= 3)
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Ensure minimum ease factor of 1.3
    easeFactor = Math.max(1.3, easeFactor);
  }

  // Calculate due date
  const dueDate = Date.now() + interval * 86400000;

  return { interval, easeFactor, repetitions, dueDate };
}

/**
 * Determine flashcard status based on repetitions.
 * @param {number} repetitions - Number of successful reviews
 * @returns {string} Flashcard status
 */
function determineFlashcardStatus(repetitions) {
  if (repetitions === 0) return FLASHCARD_STATUS.NEW;
  if (repetitions < 3) return FLASHCARD_STATUS.LEARNING;
  if (repetitions < 8) return FLASHCARD_STATUS.REVIEW;
  return FLASHCARD_STATUS.MASTERED;
}

// ============================================================================
// Base Repository
// ============================================================================

/**
 * Base repository class with CRUD operations.
 * @class
 */
export class BaseRepository {
  /**
   * @param {string} storeName - Name of the object store
   */
  constructor(storeName) {
    this.storeName = storeName;
  }

  /**
   * Create a new record.
   * @param {Object} record - Record to create
   * @returns {Promise<Object>} Created record
   */
  async create(record) {
    await put(this.storeName, record);
    return record;
  }

  /**
   * Get a record by ID.
   * @param {string} id - Record ID
   * @returns {Promise<Object|undefined>} Record or undefined if not found
   */
  async getById(id) {
    return get(this.storeName, id);
  }

  /**
   * Update a record.
   * @param {string} id - Record ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated record
   * @throws {Error} If record not found
   */
  async update(id, updates) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Record not found');
    }
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await put(this.storeName, updated);
    return updated;
  }

  /**
   * Delete a record.
   * @param {string} id - Record ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove(this.storeName, id);
  }

  /**
   * Get all records.
   * @param {number} [limit] - Optional limit
   * @returns {Promise<Array>} All records
   */
  async getAll(limit) {
    return getAll(this.storeName, limit);
  }

  /**
   * Count all records.
   * @returns {Promise<number>} Total count
   */
  async count() {
    return count(this.storeName);
  }

  /**
   * Clear all records.
   * @returns {Promise<void>}
   */
  async clear() {
    return clear(this.storeName);
  }

  /**
   * Find records by index.
   * @param {string} indexName - Index name
   * @param {*} value - Index value
   * @returns {Promise<Array>} Matching records
   */
  async findByIndex(indexName, value) {
    return queryByIndex(this.storeName, indexName, value);
  }
}

// ============================================================================
// Settings Repository
// ============================================================================

/**
 * Repository for settings (key-value store).
 */
export const SettingsRepository = {
  /**
   * Get a setting value.
   * @param {string} key - Setting key
   * @param {*} [defaultValue] - Default value if not found
   * @returns {Promise<*>} Setting value or default
   */
  async get(key, defaultValue) {
    const record = await get('settings', key);
    return record ? record.value : defaultValue;
  },

  /**
   * Set a setting value.
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    await put('settings', { key, value });
  },

  /**
   * Remove a setting.
   * @param {string} key - Setting key
   * @returns {Promise<void>}
   */
  async remove(key) {
    return remove('settings', key);
  },

  /**
   * Get all settings as an object.
   * @returns {Promise<Object>} Settings object
   */
  async getAll() {
    const records = await getAll('settings');
    return records.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
  }
};

// ============================================================================
// Course Repository
// ============================================================================

/**
 * Repository for courses.
 */
export const CourseRepository = {
  /**
   * Create a new course.
   * @param {Object} data - Course data
   * @returns {Promise<Object>} Created course
   */
  async create(data) {
    const course = createCourse(data);
    await put('courses', course);
    return course;
  },

  /**
   * Get a course by ID.
   * @param {string} id - Course ID
   * @returns {Promise<Object|undefined>} Course or undefined
   */
  async getById(id) {
    return get('courses', id);
  },

  /**
   * Update a course.
   * @param {string} id - Course ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated course
   */
  async update(id, updates) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Course not found');
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await put('courses', updated);
    return updated;
  },

  /**
   * Delete a course.
   * @param {string} id - Course ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove('courses', id);
  },

  /**
   * Get all courses.
   * @returns {Promise<Array>} All courses
   */
  async getAll() {
    return getAll('courses');
  },

  /**
   * Delete a course and all related lectures (cascade).
   * @param {string} id - Course ID
   * @returns {Promise<void>}
   */
  async deleteWithCascade(id) {
    // Get all lectures for this course
    const lectures = await LectureRepository.getByCourse(id);

    // Delete each lecture with cascade
    for (const lecture of lectures) {
      await LectureRepository.deleteWithCascade(lecture.id);
    }

    // Delete the course itself
    await this.delete(id);
  }
};

// ============================================================================
// Lecture Repository
// ============================================================================

/**
 * Repository for lectures.
 */
export const LectureRepository = {
  /**
   * Create a new lecture.
   * @param {Object} data - Lecture data
   * @returns {Promise<Object>} Created lecture
   */
  async create(data) {
    const lecture = createLecture(data);
    await put('lectures', lecture);
    return lecture;
  },

  /**
   * Get a lecture by ID.
   * @param {string} id - Lecture ID
   * @returns {Promise<Object|undefined>} Lecture or undefined
   */
  async getById(id) {
    return get('lectures', id);
  },

  /**
   * Update a lecture.
   * @param {string} id - Lecture ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated lecture
   */
  async update(id, updates) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Lecture not found');
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await put('lectures', updated);
    return updated;
  },

  /**
   * Delete a lecture.
   * @param {string} id - Lecture ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove('lectures', id);
  },

  /**
   * Get all lectures.
   * @returns {Promise<Array>} All lectures
   */
  async getAll() {
    return getAll('lectures');
  },

  /**
   * Get lectures by course ID.
   * @param {string} courseId - Course ID
   * @returns {Promise<Array>} Lectures in the course
   */
  async getByCourse(courseId) {
    return queryByIndex('lectures', 'courseId', courseId);
  },

  /**
   * Get lectures by status.
   * @param {string} status - Lecture status
   * @returns {Promise<Array>} Lectures with the status
   */
  async getByStatus(status) {
    return queryByIndex('lectures', 'status', status);
  },

  /**
   * Update watch progress.
   * @param {string} id - Lecture ID
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Promise<Object>} Updated lecture
   */
  async updateProgress(id, progress) {
    return this.update(id, { watchProgress: progress });
  },

  /**
   * Update lecture status.
   * @param {string} id - Lecture ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated lecture
   */
  async updateStatus(id, status) {
    return this.update(id, { status });
  },

  /**
   * Delete a lecture and all related entities (cascade).
   * Note: IndexedDB does not support multi-store transactions, so deletions
   * are performed sequentially. Entities are collected first to ensure
   * consistent state even if some deletions fail.
   * @param {string} id - Lecture ID
   * @returns {Promise<void>}
   */
  async deleteWithCascade(id) {
    // Collect all related entities first
    const segments = await SegmentRepository.getByLecture(id);
    const events = await EventRepository.getByLecture(id);
    const flashcards = await FlashcardRepository.getByLecture(id);
    const bookmarks = await BookmarkRepository.getByLecture(id);
    const progressRecords = await queryByIndex('progress', 'lectureId', id);
    const confusionVotes = await ConfusionVoteRepository.getByLecture(id);

    // Use batch operations where possible for atomic store-level deletes
    // Delete confusion votes
    if (confusionVotes.length > 0) {
      await batch('confusionVotes', confusionVotes.map(v => ({ type: 'delete', key: v.id })));
    }

    // Delete segments
    if (segments.length > 0) {
      await batch('segments', segments.map(s => ({ type: 'delete', key: s.id })));
    }

    // Delete events
    if (events.length > 0) {
      await batch('events', events.map(e => ({ type: 'delete', key: e.id })));
    }

    // Delete flashcards
    if (flashcards.length > 0) {
      await batch('flashcards', flashcards.map(f => ({ type: 'delete', key: f.id })));
    }

    // Delete bookmarks
    if (bookmarks.length > 0) {
      await batch('bookmarks', bookmarks.map(b => ({ type: 'delete', key: b.id })));
    }

    // Delete progress records
    if (progressRecords.length > 0) {
      await batch('progress', progressRecords.map(p => ({ type: 'delete', key: p.id })));
    }

    // Delete the lecture itself
    await this.delete(id);
  }
};

// ============================================================================
// Segment Repository
// ============================================================================

/**
 * Repository for segments.
 */
export const SegmentRepository = {
  /**
   * Create a new segment.
   * @param {Object} data - Segment data
   * @returns {Promise<Object>} Created segment
   */
  async create(data) {
    const segment = createSegment(data);
    await put('segments', segment);
    return segment;
  },

  /**
   * Get a segment by ID.
   * @param {string} id - Segment ID
   * @returns {Promise<Object|undefined>} Segment or undefined
   */
  async getById(id) {
    return get('segments', id);
  },

  /**
   * Update a segment.
   * @param {string} id - Segment ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated segment
   */
  async update(id, updates) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Segment not found');
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await put('segments', updated);
    return updated;
  },

  /**
   * Delete a segment.
   * @param {string} id - Segment ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove('segments', id);
  },

  /**
   * Get segments by lecture, sorted by startTime.
   * @param {string} lectureId - Lecture ID
   * @returns {Promise<Array>} Segments sorted by startTime
   */
  async getByLecture(lectureId) {
    const segments = await queryByIndex('segments', 'lectureId', lectureId);
    return segments.sort((a, b) => a.startTime - b.startTime);
  }
};

// ============================================================================
// Event Repository
// ============================================================================

/**
 * Repository for events.
 */
export const EventRepository = {
  /**
   * Create a new event.
   * @param {Object} data - Event data
   * @returns {Promise<Object>} Created event
   */
  async create(data) {
    const event = createEvent(data);
    await put('events', event);
    return event;
  },

  /**
   * Get an event by ID.
   * @param {string} id - Event ID
   * @returns {Promise<Object|undefined>} Event or undefined
   */
  async getById(id) {
    return get('events', id);
  },

  /**
   * Delete an event.
   * @param {string} id - Event ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove('events', id);
  },

  /**
   * Get events by lecture.
   * @param {string} lectureId - Lecture ID
   * @returns {Promise<Array>} Events for the lecture
   */
  async getByLecture(lectureId) {
    return queryByIndex('events', 'lectureId', lectureId);
  },

  /**
   * Get events by type for a lecture.
   * @param {string} lectureId - Lecture ID
   * @param {string} type - Event type
   * @returns {Promise<Array>} Matching events
   */
  async getByType(lectureId, type) {
    const events = await this.getByLecture(lectureId);
    return events.filter(e => e.type === type);
  }
};

// ============================================================================
// Progress Repository
// ============================================================================

/**
 * Repository for progress tracking.
 */
export const ProgressRepository = {
  /**
   * Get or create progress for a lecture.
   * @param {string} lectureId - Lecture ID
   * @param {string} [userId] - Optional user ID
   * @returns {Promise<Object>} Progress record
   */
  async getOrCreate(lectureId, userId = null) {
    const existing = await queryByIndex('progress', 'lectureId', lectureId);
    const match = existing.find(p => p.userId === userId);

    if (match) return match;

    const progress = createProgress({ lectureId, userId });
    await put('progress', progress);
    return progress;
  },

  /**
   * Get progress by ID.
   * @param {string} id - Progress ID
   * @returns {Promise<Object|undefined>} Progress or undefined
   */
  async getById(id) {
    return get('progress', id);
  },

  /**
   * Update last position.
   * @param {string} lectureId - Lecture ID
   * @param {number} position - Position in seconds
   * @param {string} [userId] - Optional user ID
   * @returns {Promise<Object>} Updated progress
   */
  async updatePosition(lectureId, position, userId = null) {
    const progress = await this.getOrCreate(lectureId, userId);
    const updated = { ...progress, lastPosition: position, updatedAt: Date.now() };
    await put('progress', updated);
    return updated;
  },

  /**
   * Mark a segment as completed.
   * @param {string} lectureId - Lecture ID
   * @param {string} segmentId - Segment ID
   * @param {string} [userId] - Optional user ID
   * @returns {Promise<Object>} Updated progress
   */
  async markSegmentCompleted(lectureId, segmentId, userId = null) {
    const progress = await this.getOrCreate(lectureId, userId);
    const completedSegments = progress.completedSegments.includes(segmentId)
      ? progress.completedSegments
      : [...progress.completedSegments, segmentId];
    const updated = { ...progress, completedSegments, updatedAt: Date.now() };
    await put('progress', updated);
    return updated;
  }
};

// ============================================================================
// Flashcard Repository
// ============================================================================

/**
 * Repository for flashcards with SM-2 algorithm support.
 */
export const FlashcardRepository = {
  /**
   * Create a new flashcard.
   * @param {Object} data - Flashcard data
   * @returns {Promise<Object>} Created flashcard
   */
  async create(data) {
    const flashcard = createFlashcard(data);
    await put('flashcards', flashcard);
    return flashcard;
  },

  /**
   * Get a flashcard by ID.
   * @param {string} id - Flashcard ID
   * @returns {Promise<Object|undefined>} Flashcard or undefined
   */
  async getById(id) {
    return get('flashcards', id);
  },

  /**
   * Update a flashcard.
   * @param {string} id - Flashcard ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated flashcard
   */
  async update(id, updates) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Flashcard not found');
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await put('flashcards', updated);
    return updated;
  },

  /**
   * Delete a flashcard.
   * @param {string} id - Flashcard ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove('flashcards', id);
  },

  /**
   * Get flashcards by lecture.
   * @param {string} lectureId - Lecture ID
   * @returns {Promise<Array>} Flashcards for the lecture
   */
  async getByLecture(lectureId) {
    return queryByIndex('flashcards', 'lectureId', lectureId);
  },

  /**
   * Get flashcards that are due for review.
   * @param {number} [limit=20] - Maximum number to return
   * @returns {Promise<Array>} Due flashcards sorted by due date
   */
  async getDue(limit = 20) {
    const now = Date.now();
    const all = await getAll('flashcards');
    const due = all
      .filter(card => card.dueDate <= now)
      .sort((a, b) => a.dueDate - b.dueDate);
    return due.slice(0, limit);
  },

  /**
   * Get flashcards by status.
   * @param {string} status - Flashcard status
   * @returns {Promise<Array>} Flashcards with the status
   */
  async getByStatus(status) {
    return queryByIndex('flashcards', 'status', status);
  },

  /**
   * Review a flashcard using SM-2 algorithm.
   * @param {string} id - Flashcard ID
   * @param {number} quality - Review quality (0-5)
   * @returns {Promise<Object>} Updated flashcard
   */
  async reviewCard(id, quality) {
    const card = await this.getById(id);
    if (!card) throw new Error('Flashcard not found');

    const sm2Result = calculateSM2(card, quality);
    const status = determineFlashcardStatus(sm2Result.repetitions);

    return this.update(id, {
      interval: sm2Result.interval,
      easeFactor: sm2Result.easeFactor,
      repetitions: sm2Result.repetitions,
      dueDate: sm2Result.dueDate,
      status
    });
  }
};

// ============================================================================
// Bookmark Repository
// ============================================================================

/**
 * Repository for bookmarks.
 */
export const BookmarkRepository = {
  /**
   * Create a new bookmark.
   * @param {Object} data - Bookmark data
   * @returns {Promise<Object>} Created bookmark
   */
  async create(data) {
    const bookmark = createBookmark(data);
    await put('bookmarks', bookmark);
    return bookmark;
  },

  /**
   * Get a bookmark by ID.
   * @param {string} id - Bookmark ID
   * @returns {Promise<Object|undefined>} Bookmark or undefined
   */
  async getById(id) {
    return get('bookmarks', id);
  },

  /**
   * Delete a bookmark.
   * @param {string} id - Bookmark ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove('bookmarks', id);
  },

  /**
   * Get bookmarks by lecture, sorted by timestamp.
   * @param {string} lectureId - Lecture ID
   * @returns {Promise<Array>} Bookmarks sorted by timestamp
   */
  async getByLecture(lectureId) {
    const bookmarks = await queryByIndex('bookmarks', 'lectureId', lectureId);
    return bookmarks.sort((a, b) => a.timestamp - b.timestamp);
  }
};

// ============================================================================
// Confusion Vote Repository
// ============================================================================

/**
 * Repository for confusion votes.
 */
export const ConfusionVoteRepository = {
  /**
   * Create a new confusion vote.
   * @param {Object} data - Vote data
   * @returns {Promise<Object>} Created vote
   */
  async create(data) {
    const vote = createConfusionVote(data);
    await put('confusionVotes', vote);
    return vote;
  },

  /**
   * Get a vote by ID.
   * @param {string} id - Vote ID
   * @returns {Promise<Object|undefined>} Vote or undefined
   */
  async getById(id) {
    return get('confusionVotes', id);
  },

  /**
   * Delete a vote.
   * @param {string} id - Vote ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return remove('confusionVotes', id);
  },

  /**
   * Get votes by lecture.
   * @param {string} lectureId - Lecture ID
   * @returns {Promise<Array>} Votes for the lecture
   */
  async getByLecture(lectureId) {
    return queryByIndex('confusionVotes', 'lectureId', lectureId);
  },

  /**
   * Get votes by segment.
   * @param {string} segmentId - Segment ID
   * @returns {Promise<Array>} Votes for the segment
   */
  async getBySegment(segmentId) {
    return queryByIndex('confusionVotes', 'segmentId', segmentId);
  },

  /**
   * Count votes for a segment.
   * @param {string} segmentId - Segment ID
   * @returns {Promise<number>} Vote count
   */
  async countBySegment(segmentId) {
    const votes = await this.getBySegment(segmentId);
    return votes.length;
  }
};

// ============================================================================
// Sync Queue Repository
// ============================================================================

/**
 * Repository for sync queue.
 */
export const SyncQueueRepository = {
  /**
   * Enqueue a sync operation.
   * @param {Object} data - Sync item data
   * @returns {Promise<Object>} Created sync item
   */
  async enqueue(data) {
    const item = createSyncQueueItem(data);
    await put('syncQueue', item);
    return item;
  },

  /**
   * Get a sync item by ID.
   * @param {string} id - Item ID
   * @returns {Promise<Object|undefined>} Sync item or undefined
   */
  async getById(id) {
    return get('syncQueue', id);
  },

  /**
   * Get all sync items.
   * @returns {Promise<Array>} All sync items
   */
  async getAll() {
    return getAll('syncQueue');
  },

  /**
   * Get pending sync items.
   * @returns {Promise<Array>} Pending items
   */
  async getPending() {
    return queryByIndex('syncQueue', 'status', SYNC_STATUS.PENDING);
  },

  /**
   * Mark item as syncing.
   * @param {string} id - Item ID
   * @returns {Promise<Object>} Updated item
   */
  async markSyncing(id) {
    const item = await this.getById(id);
    if (!item) throw new Error('Sync item not found');
    const updated = { ...item, status: SYNC_STATUS.SYNCING };
    await put('syncQueue', updated);
    return updated;
  },

  /**
   * Mark item as completed.
   * @param {string} id - Item ID
   * @returns {Promise<Object>} Updated item
   */
  async markCompleted(id) {
    const item = await this.getById(id);
    if (!item) throw new Error('Sync item not found');
    const updated = { ...item, status: SYNC_STATUS.COMPLETED };
    await put('syncQueue', updated);
    return updated;
  },

  /**
   * Mark item as failed and increment retry count.
   * @param {string} id - Item ID
   * @returns {Promise<Object>} Updated item
   */
  async markFailed(id) {
    const item = await this.getById(id);
    if (!item) throw new Error('Sync item not found');
    const updated = {
      ...item,
      status: SYNC_STATUS.FAILED,
      retryCount: item.retryCount + 1
    };
    await put('syncQueue', updated);
    return updated;
  },

  /**
   * Get items stuck in SYNCING state (from crashed sessions).
   * @returns {Promise<Array>} Items in SYNCING state
   */
  async getStuck() {
    return queryByIndex('syncQueue', 'status', SYNC_STATUS.SYNCING);
  },

  /**
   * Reset an item back to PENDING state for retry.
   * @param {string} id - Item ID
   * @returns {Promise<Object>} Updated item
   */
  async resetToPending(id) {
    const item = await this.getById(id);
    if (!item) throw new Error('Sync item not found');
    const updated = { ...item, status: SYNC_STATUS.PENDING };
    await put('syncQueue', updated);
    return updated;
  },

  /**
   * Clear completed items.
   * @returns {Promise<void>}
   */
  async clearCompleted() {
    const completed = await queryByIndex('syncQueue', 'status', SYNC_STATUS.COMPLETED);
    for (const item of completed) {
      await remove('syncQueue', item.id);
    }
  }
};

export default {
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
  SyncQueueRepository
};
