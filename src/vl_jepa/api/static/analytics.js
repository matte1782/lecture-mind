/**
 * Lecture Mind - Study Analytics
 *
 * Data layer + aggregation + SVG charts + dashboard UI for study analytics.
 * Tracks quiz results, study sessions, watch time. Stores data in
 * SettingsRepository (no schema migration needed — AD-8).
 *
 * Dependency position (AD-7): dom-utils <- flashcards <- analytics <- library
 * analytics.js imports from dom-utils, flashcards, storage — never imported by them.
 *
 * Safe DOM: createElement + textContent only, zero innerHTML.
 *
 * @module analytics
 * @version 1.0.0
 */

import { SettingsRepository } from './storage/index.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  STUDY_SESSIONS: 'analytics:studySessions',
  QUIZ_RESULTS: 'analytics:quizResults',
  WATCH_SESSIONS: 'analytics:watchSessions'
};

const MAX_ENTRIES = 1000;

// ============================================================================
// ID GENERATION
// ============================================================================

let _idCounter = 0;

/**
 * Generate a unique ID for analytics records.
 * @returns {string}
 */
function generateId() {
  _idCounter += 1;
  return `${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// RECORD FACTORIES
// ============================================================================

/**
 * Create a study session record.
 * @param {Object} params
 * @param {string} params.lectureId
 * @param {string} params.type - 'quiz' | 'review' | 'watch'
 * @param {number} params.duration - Duration in seconds
 * @param {number} [params.cardsReviewed=0]
 * @param {number} [params.correct=0]
 * @param {number} [params.accuracy=0]
 * @param {Array} [params.masteryChanges=[]]
 * @returns {Object}
 */
function createStudySessionRecord({ lectureId, type, duration, cardsReviewed = 0, correct = 0, accuracy = 0, masteryChanges = [] }) {
  const now = Date.now();
  return {
    id: generateId(),
    lectureId,
    type,
    duration,
    cardsReviewed,
    correct,
    accuracy,
    masteryChanges,
    startTime: now - duration * 1000,
    endTime: now
  };
}

/**
 * Create a quiz result record for an individual card review.
 * @param {Object} params
 * @param {string} params.lectureId
 * @param {string} params.flashcardId
 * @param {number} params.quality - SM-2 quality (0-5)
 * @param {string} params.oldStatus
 * @param {string} params.newStatus
 * @returns {Object}
 */
function createQuizResultRecord({ lectureId, flashcardId, quality, oldStatus, newStatus }) {
  return {
    id: generateId(),
    lectureId,
    flashcardId,
    quality,
    oldStatus,
    newStatus,
    timestamp: Date.now()
  };
}

/**
 * Create a watch session record.
 * @param {Object} params
 * @param {string} params.lectureId
 * @param {number} params.startPosition - Video position in seconds
 * @param {number} params.endPosition
 * @param {number} params.duration - Wall-clock duration in seconds
 * @returns {Object}
 */
function createWatchSessionRecord({ lectureId, startPosition, endPosition, duration }) {
  return {
    id: generateId(),
    lectureId,
    startPosition,
    endPosition,
    duration,
    timestamp: Date.now()
  };
}

// ============================================================================
// PERSISTENCE (SettingsRepository-backed — AD-8)
// ============================================================================

/**
 * Append a record to a SettingsRepository array.
 * @param {string} key - Storage key
 * @param {Object} record - Record to append
 * @returns {Promise<void>}
 */
async function _appendRecord(key, record) {
  const existing = await SettingsRepository.get(key, []);
  existing.push(record);
  await SettingsRepository.set(key, existing);
}

/**
 * Save a study session record.
 * @param {Object} record
 * @returns {Promise<void>}
 */
async function saveStudySession(record) {
  await _appendRecord(STORAGE_KEYS.STUDY_SESSIONS, record);
  await pruneOldRecords(STORAGE_KEYS.STUDY_SESSIONS, MAX_ENTRIES);
}

/**
 * Save a quiz result record.
 * @param {Object} record
 * @returns {Promise<void>}
 */
async function saveQuizResult(record) {
  await _appendRecord(STORAGE_KEYS.QUIZ_RESULTS, record);
  await pruneOldRecords(STORAGE_KEYS.QUIZ_RESULTS, MAX_ENTRIES);
}

/**
 * Save a watch session record.
 * @param {Object} record
 * @returns {Promise<void>}
 */
async function saveWatchSession(record) {
  await _appendRecord(STORAGE_KEYS.WATCH_SESSIONS, record);
  await pruneOldRecords(STORAGE_KEYS.WATCH_SESSIONS, MAX_ENTRIES);
}

/**
 * Get study sessions, optionally filtered by lectureId.
 * @param {string} [lectureId] - Filter by lecture
 * @returns {Promise<Array>}
 */
async function getStudySessions(lectureId) {
  const all = await SettingsRepository.get(STORAGE_KEYS.STUDY_SESSIONS, []);
  if (!lectureId) return all;
  return all.filter(s => s.lectureId === lectureId);
}

/**
 * Get quiz results, optionally filtered by lectureId.
 * @param {string} [lectureId] - Filter by lecture
 * @returns {Promise<Array>}
 */
async function getQuizResults(lectureId) {
  const all = await SettingsRepository.get(STORAGE_KEYS.QUIZ_RESULTS, []);
  if (!lectureId) return all;
  return all.filter(r => r.lectureId === lectureId);
}

/**
 * Get watch sessions, optionally filtered by lectureId.
 * @param {string} [lectureId] - Filter by lecture
 * @returns {Promise<Array>}
 */
async function getWatchSessions(lectureId) {
  const all = await SettingsRepository.get(STORAGE_KEYS.WATCH_SESSIONS, []);
  if (!lectureId) return all;
  return all.filter(w => w.lectureId === lectureId);
}

/**
 * Prune oldest records beyond maxEntries limit.
 * Keeps the last (most recent) maxEntries records.
 * @param {string} key - Storage key
 * @param {number} [maxEntries=1000] - Maximum entries to keep
 * @returns {Promise<void>}
 */
async function pruneOldRecords(key, maxEntries = MAX_ENTRIES) {
  const records = await SettingsRepository.get(key, []);
  if (records.length <= maxEntries) return;
  // Sort by timestamp (ascending) to ensure we keep the newest
  records.sort((a, b) => (a.startTime || a.timestamp || 0) - (b.startTime || b.timestamp || 0));
  const pruned = records.slice(records.length - maxEntries);
  await SettingsRepository.set(key, pruned);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Constants
  STORAGE_KEYS,
  MAX_ENTRIES,

  // Factories
  createStudySessionRecord,
  createQuizResultRecord,
  createWatchSessionRecord,

  // Persistence
  saveStudySession,
  saveQuizResult,
  saveWatchSession,
  getStudySessions,
  getQuizResults,
  getWatchSessions,
  pruneOldRecords
};
