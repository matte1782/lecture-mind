/**
 * @fileoverview Tests for Analytics module (Week 13 Day 0: Foundation).
 * Covers data layer: record factories, persistence via SettingsRepository,
 * filtering, and pruning of old records.
 * TDD: tests written before implementation.
 */

import { jest } from '@jest/globals';
import { closeDatabase, deleteDatabase } from './storage/db.js';
import { SettingsRepository } from './storage/index.js';

import {
  createStudySessionRecord,
  createQuizResultRecord,
  createWatchSessionRecord,
  saveStudySession,
  saveQuizResult,
  saveWatchSession,
  getStudySessions,
  getQuizResults,
  getWatchSessions,
  pruneOldRecords,
  STORAGE_KEYS
} from './analytics.js';

import { createSVGElement } from './dom-utils.js';

// ============================================================================
// TEST SETUP
// ============================================================================

afterEach(async () => {
  await closeDatabase();
  await deleteDatabase();
});

// ============================================================================
// ANALYTICS — DAY 0: FOUNDATION
// ============================================================================

describe('Analytics — Day 0: Foundation', () => {

  // --------------------------------------------------------------------------
  // Record factories
  // --------------------------------------------------------------------------

  it('createStudySessionRecord creates valid record with id + timestamp', () => {
    const before = Date.now();

    const record = createStudySessionRecord({
      lectureId: 'lec-1',
      type: 'flashcards',
      duration: 300,
      cardsReviewed: 10,
      correct: 8,
      accuracy: 0.8,
      masteryChanges: [{ flashcardId: 'fc-1', oldStatus: 'new', newStatus: 'learning' }]
    });

    const after = Date.now();

    expect(typeof record.id).toBe('string');
    expect(record.id.length).toBeGreaterThan(0);
    expect(record.lectureId).toBe('lec-1');
    expect(record.type).toBe('flashcards');
    expect(record.duration).toBe(300);
    expect(record.cardsReviewed).toBe(10);
    expect(record.correct).toBe(8);
    expect(record.accuracy).toBe(0.8);
    expect(record.masteryChanges).toHaveLength(1);
    expect(typeof record.startTime).toBe('number');
    expect(typeof record.endTime).toBe('number');
    // startTime = endTime - duration*1000, so startTime < endTime
    expect(record.endTime - record.startTime).toBe(300 * 1000);
    expect(record.endTime).toBeGreaterThanOrEqual(before);
    expect(record.endTime).toBeLessThanOrEqual(after + 1);
  });

  it('createStudySessionRecord applies default values for optional fields', () => {
    const record = createStudySessionRecord({
      lectureId: 'lec-2',
      type: 'watch',
      duration: 120
    });

    expect(record.cardsReviewed).toBe(0);
    expect(record.correct).toBe(0);
    expect(record.accuracy).toBe(0);
    expect(Array.isArray(record.masteryChanges)).toBe(true);
    expect(record.masteryChanges).toHaveLength(0);
  });

  it('createQuizResultRecord creates valid record', () => {
    const before = Date.now();

    const record = createQuizResultRecord({
      lectureId: 'lec-1',
      flashcardId: 'fc-42',
      quality: 4,
      oldStatus: 'learning',
      newStatus: 'review'
    });

    const after = Date.now();

    expect(typeof record.id).toBe('string');
    expect(record.id.length).toBeGreaterThan(0);
    expect(record.lectureId).toBe('lec-1');
    expect(record.flashcardId).toBe('fc-42');
    expect(record.quality).toBe(4);
    expect(record.oldStatus).toBe('learning');
    expect(record.newStatus).toBe('review');
    expect(typeof record.timestamp).toBe('number');
    expect(record.timestamp).toBeGreaterThanOrEqual(before);
    expect(record.timestamp).toBeLessThanOrEqual(after + 1);
  });

  it('createWatchSessionRecord creates valid record', () => {
    const before = Date.now();

    const record = createWatchSessionRecord({
      lectureId: 'lec-3',
      startPosition: 30,
      endPosition: 150,
      duration: 120
    });

    const after = Date.now();

    expect(typeof record.id).toBe('string');
    expect(record.id.length).toBeGreaterThan(0);
    expect(record.lectureId).toBe('lec-3');
    expect(record.startPosition).toBe(30);
    expect(record.endPosition).toBe(150);
    expect(record.duration).toBe(120);
    expect(typeof record.timestamp).toBe('number');
    expect(record.timestamp).toBeGreaterThanOrEqual(before);
    expect(record.timestamp).toBeLessThanOrEqual(after + 1);
  });

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  it('saveStudySession appends to settings store', async () => {
    const record = createStudySessionRecord({
      lectureId: 'lec-1',
      type: 'flashcards',
      duration: 60
    });

    await saveStudySession(record);

    const stored = await SettingsRepository.get(STORAGE_KEYS.STUDY_SESSIONS, []);
    expect(Array.isArray(stored)).toBe(true);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(record.id);
    expect(stored[0].lectureId).toBe('lec-1');
  });

  it('saveStudySession does not overwrite existing sessions', async () => {
    const record1 = createStudySessionRecord({
      lectureId: 'lec-1',
      type: 'flashcards',
      duration: 60
    });
    const record2 = createStudySessionRecord({
      lectureId: 'lec-2',
      type: 'watch',
      duration: 180
    });

    await saveStudySession(record1);
    await saveStudySession(record2);

    const stored = await SettingsRepository.get(STORAGE_KEYS.STUDY_SESSIONS, []);
    expect(stored).toHaveLength(2);

    const ids = stored.map((r) => r.id);
    expect(ids).toContain(record1.id);
    expect(ids).toContain(record2.id);
  });

  it('saveQuizResult persists and getQuizResults retrieves', async () => {
    const record = createQuizResultRecord({
      lectureId: 'lec-1',
      flashcardId: 'fc-1',
      quality: 4,
      oldStatus: 'new',
      newStatus: 'learning'
    });

    await saveQuizResult(record);

    const stored = await getQuizResults();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(record.id);
    expect(stored[0].flashcardId).toBe('fc-1');
  });

  it('getQuizResults filters by lectureId', async () => {
    await saveQuizResult(createQuizResultRecord({ lectureId: 'lec-A', flashcardId: 'fc-1', quality: 3, oldStatus: 'new', newStatus: 'learning' }));
    await saveQuizResult(createQuizResultRecord({ lectureId: 'lec-B', flashcardId: 'fc-2', quality: 5, oldStatus: 'learning', newStatus: 'review' }));

    const lecA = await getQuizResults('lec-A');
    expect(lecA).toHaveLength(1);
    expect(lecA[0].lectureId).toBe('lec-A');
  });

  it('saveWatchSession persists and getWatchSessions retrieves', async () => {
    const record = createWatchSessionRecord({
      lectureId: 'lec-1',
      startPosition: 0,
      endPosition: 120,
      duration: 125
    });

    await saveWatchSession(record);

    const stored = await getWatchSessions();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(record.id);
    expect(stored[0].startPosition).toBe(0);
  });

  it('getWatchSessions filters by lectureId', async () => {
    await saveWatchSession(createWatchSessionRecord({ lectureId: 'lec-A', startPosition: 0, endPosition: 60, duration: 60 }));
    await saveWatchSession(createWatchSessionRecord({ lectureId: 'lec-B', startPosition: 0, endPosition: 30, duration: 30 }));

    const lecA = await getWatchSessions('lec-A');
    expect(lecA).toHaveLength(1);
    expect(lecA[0].lectureId).toBe('lec-A');
  });

  // --------------------------------------------------------------------------
  // Retrieval + filtering
  // --------------------------------------------------------------------------

  it('getStudySessions returns all sessions when no lectureId provided', async () => {
    const r1 = createStudySessionRecord({ lectureId: 'lec-A', type: 'watch', duration: 60 });
    const r2 = createStudySessionRecord({ lectureId: 'lec-B', type: 'flashcards', duration: 90 });
    const r3 = createStudySessionRecord({ lectureId: 'lec-A', type: 'flashcards', duration: 30 });

    await saveStudySession(r1);
    await saveStudySession(r2);
    await saveStudySession(r3);

    const all = await getStudySessions();
    expect(all).toHaveLength(3);
  });

  it('getStudySessions filters sessions by lectureId', async () => {
    const r1 = createStudySessionRecord({ lectureId: 'lec-A', type: 'watch', duration: 60 });
    const r2 = createStudySessionRecord({ lectureId: 'lec-B', type: 'flashcards', duration: 90 });
    const r3 = createStudySessionRecord({ lectureId: 'lec-A', type: 'flashcards', duration: 30 });

    await saveStudySession(r1);
    await saveStudySession(r2);
    await saveStudySession(r3);

    const lecA = await getStudySessions('lec-A');
    expect(lecA).toHaveLength(2);
    lecA.forEach((r) => expect(r.lectureId).toBe('lec-A'));

    const lecB = await getStudySessions('lec-B');
    expect(lecB).toHaveLength(1);
    expect(lecB[0].lectureId).toBe('lec-B');
  });

  // --------------------------------------------------------------------------
  // Pruning
  // --------------------------------------------------------------------------

  it('pruneOldRecords removes oldest records beyond the limit', async () => {
    const key = STORAGE_KEYS.STUDY_SESSIONS;

    // Manually insert 5 records with distinct startTimes so order is deterministic
    const records = [1, 2, 3, 4, 5].map((n) =>
      createStudySessionRecord({
        lectureId: `lec-${n}`,
        type: 'watch',
        duration: n * 10
      })
    );

    // Assign explicit startTimes so oldest = records[0], newest = records[4]
    records.forEach((r, i) => {
      r.startTime = 1000000 + i * 1000;
      r.endTime = r.startTime + r.duration * 1000;
    });

    await SettingsRepository.set(key, records);

    await pruneOldRecords(key, 3);

    const remaining = await SettingsRepository.get(key, []);
    expect(remaining).toHaveLength(3);

    // The 3 newest (indices 2, 3, 4) must be kept
    const remainingIds = remaining.map((r) => r.id);
    expect(remainingIds).toContain(records[2].id);
    expect(remainingIds).toContain(records[3].id);
    expect(remainingIds).toContain(records[4].id);

    // The 2 oldest (indices 0, 1) must be removed
    expect(remainingIds).not.toContain(records[0].id);
    expect(remainingIds).not.toContain(records[1].id);
  });

  // --------------------------------------------------------------------------
  // DOM utility: createSVGElement
  // --------------------------------------------------------------------------

  it('createSVGElement creates SVG element with attributes and textContent', () => {
    const svgNS = 'http://www.w3.org/2000/svg';

    const el = createSVGElement('circle', { cx: '50', cy: '50', r: '40' });

    expect(el).toBeDefined();
    expect(el.tagName.toLowerCase()).toBe('circle');
    expect(el.namespaceURI).toBe(svgNS);
    expect(el.getAttribute('cx')).toBe('50');
    expect(el.getAttribute('cy')).toBe('50');
    expect(el.getAttribute('r')).toBe('40');

    const text = createSVGElement('text', { x: '10', y: '20', textContent: 'hello' });
    expect(text.textContent).toBe('hello');
    // textContent should NOT be set as an attribute
    expect(text.getAttribute('textContent')).toBeNull();
  });

});
