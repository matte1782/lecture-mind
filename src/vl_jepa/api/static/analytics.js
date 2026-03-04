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
import { setOnQuizResult, setOnSessionComplete } from './flashcards.js';
import { createSVGElement } from './dom-utils.js';

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
// WATCH TIME TRACKER (AD-10)
// ============================================================================

const TIMEUPDATE_THROTTLE_MS = 10000; // 10 seconds

/**
 * Tracks video watch time for a lecture. Attaches to a video element,
 * records play/pause durations, persists on detach.
 */
class WatchTimeTracker {
  /**
   * @param {string} lectureId
   */
  constructor(lectureId) {
    this.lectureId = lectureId;
    this._videoEl = null;
    this._playing = false;
    this._playStart = null;
    this._totalDuration = 0;
    this._startPosition = 0;
    this._lastPosition = 0;
    this._lastTimeupdateAt = 0;

    // Bound handlers for cleanup
    this._onPlay = this._handlePlay.bind(this);
    this._onPause = this._handlePause.bind(this);
    this._onTimeUpdate = this._handleTimeUpdate.bind(this);
  }

  /**
   * Attach to a video element and start tracking.
   * @param {HTMLVideoElement} videoEl
   */
  attach(videoEl) {
    this._videoEl = videoEl;
    this._startPosition = videoEl.currentTime || 0;
    this._lastPosition = this._startPosition;
    videoEl.addEventListener('play', this._onPlay);
    videoEl.addEventListener('pause', this._onPause);
    videoEl.addEventListener('timeupdate', this._onTimeUpdate);
  }

  /**
   * Detach from video element, persist watch session, clean up.
   * @returns {Promise<Object|null>} The saved watch record, or null if no time tracked
   */
  async detach() {
    if (this._videoEl) {
      this._videoEl.removeEventListener('play', this._onPlay);
      this._videoEl.removeEventListener('pause', this._onPause);
      this._videoEl.removeEventListener('timeupdate', this._onTimeUpdate);
    }

    // Finalize if still playing
    if (this._playing && this._playStart !== null) {
      this._totalDuration += (Date.now() - this._playStart) / 1000;
      this._playing = false;
      this._playStart = null;
    }

    if (this._totalDuration <= 0) {
      this._videoEl = null;
      return null;
    }

    const record = createWatchSessionRecord({
      lectureId: this.lectureId,
      startPosition: this._startPosition,
      endPosition: this._lastPosition,
      duration: Math.round(this._totalDuration)
    });

    await saveWatchSession(record);
    this._videoEl = null;
    this._totalDuration = 0;
    return record;
  }

  _handlePlay() {
    this._playing = true;
    this._playStart = Date.now();
  }

  _handlePause() {
    if (this._playing && this._playStart !== null) {
      this._totalDuration += (Date.now() - this._playStart) / 1000;
    }
    this._playing = false;
    this._playStart = null;
  }

  _handleTimeUpdate() {
    const now = Date.now();
    if (now - this._lastTimeupdateAt < TIMEUPDATE_THROTTLE_MS) return;
    this._lastTimeupdateAt = now;
    if (this._videoEl) {
      this._lastPosition = this._videoEl.currentTime;
    }
  }
}

// ============================================================================
// ANALYTICS HOOKS REGISTRATION (AD-9)
// ============================================================================

/**
 * Register analytics callbacks with flashcards.js.
 * Called once at app init to capture quiz results and session completions.
 */
function registerAnalyticsHooks() {
  setOnQuizResult(async (data) => {
    const record = createQuizResultRecord(data);
    await saveQuizResult(record);
  });

  setOnSessionComplete(async (data) => {
    const record = createStudySessionRecord(data);
    await saveStudySession(record);
  });
}

// ============================================================================
// SVG CHART RENDERERS
// ============================================================================

let _chartIdCounter = 0;

/**
 * Generate a unique ID for chart ARIA elements.
 * @returns {string}
 */
function _chartId(prefix) {
  _chartIdCounter += 1;
  return `${prefix}-${_chartIdCounter}`;
}

/**
 * Render a bar chart as an SVG element inside the given container.
 *
 * @param {HTMLElement} container - DOM element to append the SVG into
 * @param {Array<Object>} data - Array of data items with label and value keys
 * @param {Object} [options={}]
 * @param {number} [options.width=300] - SVG width
 * @param {number} [options.height=200] - SVG height
 * @param {string} [options.barColor='#4a90d9'] - Fill color for bars
 * @param {string} [options.labelKey='label'] - Key for label in data items
 * @param {string} [options.valueKey='value'] - Key for value in data items
 */
function renderBarChart(container, data, options = {}) {
  const {
    width = 300,
    height = 200,
    barColor = '#4a90d9',
    labelKey = 'label',
    valueKey = 'value'
  } = options;

  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const titleId = _chartId('bar-title');
  const descId = _chartId('bar-desc');

  const svg = createSVGElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-labelledby': titleId
  });

  svg.appendChild(createSVGElement('title', { id: titleId, textContent: 'Bar Chart' }));
  svg.appendChild(createSVGElement('desc', { id: descId, textContent: 'A bar chart visualization of data values' }));

  if (!data || data.length === 0) {
    container.appendChild(svg);
    return;
  }

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const maxValue = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const barWidth = chartWidth / data.length;
  const gap = barWidth * 0.2;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const val = item[valueKey] || 0;
    const barH = (val / maxValue) * chartHeight;
    const x = padLeft + i * barWidth + gap / 2;
    const y = padTop + chartHeight - barH;

    svg.appendChild(createSVGElement('rect', {
      x: String(x),
      y: String(y),
      width: String(barWidth - gap),
      height: String(barH),
      fill: barColor
    }));

    // Label below bar
    const labelX = padLeft + i * barWidth + barWidth / 2;
    const labelY = height - padBottom + 15;
    svg.appendChild(createSVGElement('text', {
      x: String(labelX),
      y: String(labelY),
      'text-anchor': 'middle',
      'font-size': '10',
      fill: '#333',
      textContent: String(item[labelKey] || '')
    }));
  }

  container.appendChild(svg);
}

/**
 * Render a line chart as an SVG element inside the given container.
 *
 * @param {HTMLElement} container - DOM element to append the SVG into
 * @param {Array<Object>} data - Array of data items with value property
 * @param {Object} [options={}]
 * @param {number} [options.width=300] - SVG width
 * @param {number} [options.height=200] - SVG height
 * @param {string} [options.lineColor='#4a90d9'] - Stroke color for the line
 * @param {string} [options.fillColor='rgba(74,144,217,0.1)'] - Fill color for area under line
 */
function renderLineChart(container, data, options = {}) {
  const {
    width = 300,
    height = 200,
    lineColor = '#4a90d9',
    fillColor = 'rgba(74,144,217,0.1)'
  } = options;

  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const titleId = _chartId('line-title');
  const descId = _chartId('line-desc');

  const svg = createSVGElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-labelledby': titleId
  });

  svg.appendChild(createSVGElement('title', { id: titleId, textContent: 'Line Chart' }));
  svg.appendChild(createSVGElement('desc', { id: descId, textContent: 'A line chart visualization of data trends' }));

  if (!data || data.length === 0) {
    container.appendChild(svg);
    return;
  }

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const maxValue = Math.max(...data.map(d => d.value || 0), 1);

  // Calculate point coordinates
  const points = data.map((d, i) => {
    const x = data.length === 1
      ? padLeft + chartWidth / 2
      : padLeft + (i / (data.length - 1)) * chartWidth;
    const y = padTop + chartHeight - ((d.value || 0) / maxValue) * chartHeight;
    return { x, y };
  });

  const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

  // Area fill polygon (line points + bottom corners)
  const baselineY = padTop + chartHeight;
  const polygonStr = `${padLeft},${baselineY} ${pointsStr} ${points[points.length - 1].x},${baselineY}`;
  svg.appendChild(createSVGElement('polygon', {
    points: polygonStr,
    fill: fillColor,
    stroke: 'none'
  }));

  // Line
  svg.appendChild(createSVGElement('polyline', {
    points: pointsStr,
    fill: 'none',
    stroke: lineColor,
    'stroke-width': '2'
  }));

  // Data point circles
  for (const p of points) {
    svg.appendChild(createSVGElement('circle', {
      cx: String(p.x),
      cy: String(p.y),
      r: '3',
      fill: lineColor
    }));
  }

  container.appendChild(svg);
}

/**
 * Render a donut chart as an SVG element inside the given container.
 *
 * @param {HTMLElement} container - DOM element to append the SVG into
 * @param {Array<Object>} segments - Array of {value, color, label}
 * @param {Object} [options={}]
 * @param {number} [options.width=200] - SVG width
 * @param {number} [options.height=200] - SVG height
 */
function renderDonutChart(container, segments, options = {}) {
  const {
    width = 200,
    height = 200
  } = options;

  const titleId = _chartId('donut-title');
  const descId = _chartId('donut-desc');

  const svg = createSVGElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-labelledby': titleId
  });

  svg.appendChild(createSVGElement('title', { id: titleId, textContent: 'Donut Chart' }));
  svg.appendChild(createSVGElement('desc', { id: descId, textContent: 'A donut chart visualization of distribution' }));

  if (!segments || segments.length === 0) {
    container.appendChild(svg);
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const radius = 70;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;

  const total = segments.reduce((sum, seg) => sum + (seg.value || 0), 0);
  if (total <= 0) {
    container.appendChild(svg);
    return;
  }

  let cumulativeOffset = 0;

  for (const seg of segments) {
    const fraction = (seg.value || 0) / total;
    const segmentLength = fraction * circumference;

    // stroke-dashoffset rotates the segment; we use negative cumulative to go clockwise
    // Starting at 12 o'clock: offset by circumference/4
    const dashOffset = circumference / 4 - cumulativeOffset;

    svg.appendChild(createSVGElement('circle', {
      cx: String(cx),
      cy: String(cy),
      r: String(radius),
      fill: 'none',
      stroke: seg.color || '#999',
      'stroke-width': String(strokeWidth),
      'stroke-dasharray': `${segmentLength} ${circumference - segmentLength}`,
      'stroke-dashoffset': String(dashOffset)
    }));

    cumulativeOffset += segmentLength;
  }

  container.appendChild(svg);
}

// ============================================================================
// PURE AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Format a Date to ISO date string in local timezone.
 * @param {Date} date
 * @returns {string} e.g. "2026-03-04"
 */
function _toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Aggregate study time grouped by day for the last N days.
 * Pure function -- no side effects, no async, no DOM.
 *
 * @param {Array<Object>} sessions - Study session records with startTime, duration, type
 * @param {number} [days=7] - Number of days to include
 * @returns {Array<{date: string, totalMinutes: number, quizMinutes: number, watchMinutes: number}>}
 *   Sorted oldest-first, length = days. Missing days filled with zeros.
 */
function aggregateStudyTimeByDay(sessions, days = 7) {
  const dayMap = new Map();

  for (const session of sessions) {
    const dateStr = _toLocalDateString(new Date(session.startTime));
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, { quizMinutes: 0, watchMinutes: 0 });
    }
    const entry = dayMap.get(dateStr);
    const minutes = session.duration / 60;
    if (session.type === 'quiz' || session.type === 'review') {
      entry.quizMinutes += minutes;
    } else if (session.type === 'watch') {
      entry.watchMinutes += minutes;
    }
  }

  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = _toLocalDateString(d);
    const entry = dayMap.get(dateStr) || { quizMinutes: 0, watchMinutes: 0 };
    result.push({
      date: dateStr,
      totalMinutes: entry.quizMinutes + entry.watchMinutes,
      quizMinutes: entry.quizMinutes,
      watchMinutes: entry.watchMinutes
    });
  }

  return result;
}

/**
 * Aggregate accuracy trend from the most recent sessions that have an accuracy field.
 * Pure function -- no side effects, no async, no DOM.
 *
 * @param {Array<Object>} sessions - Sessions with accuracy and startTime fields
 * @param {number} [limit=20] - Maximum entries to return
 * @returns {Array<{index: number, accuracy: number, date: string}>}
 *   Sorted by startTime ascending, capped to the last `limit` entries.
 */
function aggregateAccuracyTrend(sessions, limit = 20) {
  const withAccuracy = sessions.filter(
    s => s.accuracy !== undefined && s.accuracy !== null
  );
  if (withAccuracy.length === 0) return [];

  withAccuracy.sort((a, b) => a.startTime - b.startTime);

  const recent = withAccuracy.slice(-limit);

  return recent.map((s, i) => ({
    index: i,
    accuracy: s.accuracy,
    date: _toLocalDateString(new Date(s.startTime))
  }));
}

/**
 * Aggregate mastery distribution from flashcards by status.
 * Pure function -- no side effects, no async, no DOM.
 *
 * @param {Array<Object>} flashcards - Flashcard objects with a status field
 * @returns {{new: number, learning: number, review: number, mastered: number}}
 */
function aggregateMasteryDistribution(flashcards) {
  const dist = { new: 0, learning: 0, review: 0, mastered: 0 };
  for (const card of flashcards) {
    if (card.status in dist) {
      dist[card.status] += 1;
    }
  }
  return dist;
}

/**
 * Calculate the number of consecutive days with activity counting back from today.
 * Pure function -- no side effects, no async, no DOM.
 *
 * @param {Array<Object>} sessions - Sessions with startTime field
 * @returns {number} Streak count (0 if no sessions)
 */
function calculateStreak(sessions) {
  if (sessions.length === 0) return 0;

  const dates = new Set();
  for (const s of sessions) {
    dates.add(_toLocalDateString(new Date(s.startTime)));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;

  for (let i = 0; i < 1000; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = _toLocalDateString(d);
    if (dates.has(dateStr)) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Aggregate overall statistics from study sessions, quiz results, and watch sessions.
 * Pure function -- no side effects, no async, no DOM.
 *
 * @param {Array<Object>} studySessions - Study session records
 * @param {Array<Object>} quizResults - Quiz result records
 * @param {Array<Object>} watchSessions - Watch session records
 * @returns {{totalStudyTime: number, totalCards: number, avgAccuracy: number, streak: number, totalWatchTime: number}}
 */
function aggregateOverallStats(studySessions, quizResults, watchSessions) {
  const totalStudyTime = studySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalCards = studySessions.reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);

  const accuracyValues = studySessions
    .filter(s => s.accuracy !== undefined && s.accuracy !== null)
    .map(s => s.accuracy);
  const avgAccuracy = accuracyValues.length > 0
    ? accuracyValues.reduce((sum, a) => sum + a, 0) / accuracyValues.length
    : 0;

  const totalWatchTime = watchSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const streak = calculateStreak(studySessions);

  return { totalStudyTime, totalCards, avgAccuracy, streak, totalWatchTime };
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
  pruneOldRecords,

  // Watch time tracking
  WatchTimeTracker,

  // Hooks
  registerAnalyticsHooks,

  // Aggregation
  aggregateStudyTimeByDay,
  aggregateAccuracyTrend,
  aggregateMasteryDistribution,
  aggregateOverallStats,
  calculateStreak,

  // SVG Chart Renderers
  renderBarChart,
  renderLineChart,
  renderDonutChart
};
