/**
 * Multi-Lecture Library module for Lecture Mind.
 *
 * Provides course organization, sidebar filtering, toolbar controls,
 * and sorting for the lecture library view.
 *
 * Dependencies: dom-utils.js (shared utilities), flashcards.js (router hooks),
 * storage/ (CourseRepository, LectureRepository, SettingsRepository).
 *
 * Safe DOM: createElement + textContent only, zero innerHTML.
 *
 * @module library
 * @version 1.0.0
 */

import {
  createElement,
  clearElement
} from './dom-utils.js';

import {
  CourseRepository,
  LectureRepository,
  SegmentRepository,
  EventRepository,
  SettingsRepository,
  FlashcardRepository,
  BookmarkRepository,
  ProgressRepository,
  FLASHCARD_STATUS,
  createCourse,
  createLecture,
  createSegment,
  createEvent
} from './storage/index.js';

import {
  setLibraryRenderer,
  setLectureDetailRenderer,
  navigateTo,
  showToast,
  VIEWS
} from './flashcards.js';

import { renderLectureAnalyticsTab } from './analytics.js';

// ============================================================================
// STATE
// ============================================================================

const libraryState = {
  selectedCourseId: null,   // null = "All Lectures", 'favorites', 'uncategorized', or courseId
  sortBy: 'recent',         // 'recent' | 'title' | 'progress'
  viewMode: 'grid',         // 'grid' | 'list'
  courses: [],              // cached course list
  courseLectureCount: {},   // Map<courseId, count> — avoids N+1
  uncategorizedCount: 0,
  favoritesCount: 0,
  totalLectures: 0
};

/** Reset state for testing. */
function _resetState() {
  libraryState.selectedCourseId = null;
  libraryState.sortBy = 'recent';
  libraryState.viewMode = 'grid';
  libraryState.courses = [];
  libraryState.courseLectureCount = {};
  libraryState.uncategorizedCount = 0;
  libraryState.favoritesCount = 0;
  libraryState.totalLectures = 0;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PRESET_COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb923c'
];

// ============================================================================
// COURSE MANAGEMENT
// ============================================================================

/**
 * Load all courses with lecture counts in a single pass (no N+1).
 * Caches results in libraryState.
 * @returns {Promise<Array<{course: Object, lectureCount: number}>>}
 */
async function loadCourses() {
  const [courses, lectures, favorites] = await Promise.all([
    CourseRepository.getAll(),
    LectureRepository.getAll(),
    SettingsRepository.get('favorite_lectures', [])
  ]);

  // Single-pass count via reduce
  const countMap = lectures.reduce((acc, lecture) => {
    const key = lecture.courseId || '__uncategorized__';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  libraryState.courses = courses;
  libraryState.courseLectureCount = countMap;
  libraryState.uncategorizedCount = countMap['__uncategorized__'] || 0;
  libraryState.favoritesCount = Array.isArray(favorites) ? favorites.length : 0;
  libraryState.totalLectures = lectures.length;

  return courses.map(course => ({
    course,
    lectureCount: countMap[course.id] || 0
  }));
}

/**
 * Create a course creation dialog element.
 * Returns the dialog DOM element synchronously.
 * @returns {HTMLElement} Dialog element
 */
function createCourseDialog() {
  const overlay = createElement('div', 'sp-dialog-overlay');
  const dialog = createElement('div', 'sp-dialog', { role: 'dialog', 'aria-label': 'Create Course' });

  const title = createElement('h3', 'sp-dialog-title', { textContent: 'Create New Course' });
  dialog.appendChild(title);

  // Name field
  const nameLabel = createElement('label', 'sp-dialog-label', { textContent: 'Course Name *' });
  const nameInput = createElement('input', 'sp-dialog-input', {
    type: 'text',
    'data-field': 'name',
    'aria-required': 'true'
  });
  nameInput.setAttribute('maxlength', '100');
  nameInput.setAttribute('placeholder', 'e.g., Math 101');
  dialog.appendChild(nameLabel);
  dialog.appendChild(nameInput);

  // Description field
  const descLabel = createElement('label', 'sp-dialog-label', { textContent: 'Description' });
  const descInput = createElement('textarea', 'sp-dialog-input', { 'data-field': 'description' });
  descInput.setAttribute('maxlength', '300');
  descInput.setAttribute('placeholder', 'Optional course description');
  dialog.appendChild(descLabel);
  dialog.appendChild(descInput);

  // Color picker
  const colorLabel = createElement('label', 'sp-dialog-label', { textContent: 'Color' });
  dialog.appendChild(colorLabel);
  const colorRow = createElement('div', 'sp-dialog-color-row');
  let selectedColor = PRESET_COLORS[0];

  for (const color of PRESET_COLORS) {
    const swatch = createElement('button', 'sp-dialog-color-swatch', {
      type: 'button',
      'aria-label': `Select color ${color}`
    });
    swatch.style.backgroundColor = color;
    if (color === selectedColor) swatch.classList.add('sp-dialog-color-swatch--active');
    swatch.addEventListener('click', () => {
      selectedColor = color;
      for (const s of colorRow.querySelectorAll('.sp-dialog-color-swatch')) {
        s.classList.remove('sp-dialog-color-swatch--active');
      }
      swatch.classList.add('sp-dialog-color-swatch--active');
    });
    colorRow.appendChild(swatch);
  }
  dialog.appendChild(colorRow);

  // Error display
  const errorEl = createElement('div', 'sp-dialog-error', { 'aria-live': 'polite' });
  dialog.appendChild(errorEl);

  // Buttons
  const btnRow = createElement('div', 'sp-dialog-buttons');
  const cancelBtn = createElement('button', 'sp-dialog-btn', {
    textContent: 'Cancel',
    type: 'button',
    'data-action': 'cancel'
  });
  const saveBtn = createElement('button', 'sp-dialog-btn sp-dialog-btn--primary', {
    textContent: 'Create',
    type: 'button',
    'data-action': 'save'
  });
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  dialog.appendChild(btnRow);

  overlay.appendChild(dialog);

  // Event handlers
  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      errorEl.textContent = 'Course name is required';
      nameInput.focus();
      return;
    }

    try {
      const course = await CourseRepository.create(createCourse({
        name,
        description: descInput.value.trim(),
        color: selectedColor
      }));
      overlay.dispatchEvent(new CustomEvent('course-saved', { detail: course }));
      close();
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to create course';
    }
  });

  // Focus trap: focus name input on attach
  requestAnimationFrame(() => nameInput.focus());

  return overlay;
}

/**
 * Create a course edit dialog element.
 * Async-loads course data to pre-fill fields.
 * @param {string} courseId - Course ID to edit
 * @returns {HTMLElement} Dialog element
 */
function editCourseDialog(courseId) {
  const overlay = createElement('div', 'sp-dialog-overlay');
  const dialog = createElement('div', 'sp-dialog', { role: 'dialog', 'aria-label': 'Edit Course' });

  const title = createElement('h3', 'sp-dialog-title', { textContent: 'Edit Course' });
  dialog.appendChild(title);

  const nameLabel = createElement('label', 'sp-dialog-label', { textContent: 'Course Name *' });
  const nameInput = createElement('input', 'sp-dialog-input', {
    type: 'text',
    'data-field': 'name',
    'aria-required': 'true'
  });
  nameInput.setAttribute('maxlength', '100');
  dialog.appendChild(nameLabel);
  dialog.appendChild(nameInput);

  const descLabel = createElement('label', 'sp-dialog-label', { textContent: 'Description' });
  const descInput = createElement('textarea', 'sp-dialog-input', { 'data-field': 'description' });
  descInput.setAttribute('maxlength', '300');
  dialog.appendChild(descLabel);
  dialog.appendChild(descInput);

  const colorLabel = createElement('label', 'sp-dialog-label', { textContent: 'Color' });
  dialog.appendChild(colorLabel);
  const colorRow = createElement('div', 'sp-dialog-color-row');
  let selectedColor = PRESET_COLORS[0];

  for (const color of PRESET_COLORS) {
    const swatch = createElement('button', 'sp-dialog-color-swatch', {
      type: 'button',
      'aria-label': `Select color ${color}`
    });
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', () => {
      selectedColor = color;
      for (const s of colorRow.querySelectorAll('.sp-dialog-color-swatch')) {
        s.classList.remove('sp-dialog-color-swatch--active');
      }
      swatch.classList.add('sp-dialog-color-swatch--active');
    });
    colorRow.appendChild(swatch);
  }
  dialog.appendChild(colorRow);

  const errorEl = createElement('div', 'sp-dialog-error', { 'aria-live': 'polite' });
  dialog.appendChild(errorEl);

  const btnRow = createElement('div', 'sp-dialog-buttons');
  const cancelBtn = createElement('button', 'sp-dialog-btn', {
    textContent: 'Cancel',
    type: 'button',
    'data-action': 'cancel'
  });
  const saveBtn = createElement('button', 'sp-dialog-btn sp-dialog-btn--primary', {
    textContent: 'Save',
    type: 'button',
    'data-action': 'save'
  });
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  dialog.appendChild(btnRow);

  overlay.appendChild(dialog);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Async pre-fill
  CourseRepository.getById(courseId).then(course => {
    if (!course) {
      errorEl.textContent = 'Course not found';
      return;
    }
    nameInput.value = course.name;
    descInput.value = course.description || '';
    selectedColor = course.color || PRESET_COLORS[0];

    // Mark active color swatch
    for (const s of colorRow.querySelectorAll('.sp-dialog-color-swatch')) {
      const swatchColor = s.style.backgroundColor;
      // Compare hex
      s.classList.remove('sp-dialog-color-swatch--active');
    }
    // Find matching swatch by color
    const swatches = colorRow.querySelectorAll('.sp-dialog-color-swatch');
    for (let i = 0; i < PRESET_COLORS.length; i++) {
      if (PRESET_COLORS[i] === selectedColor) {
        swatches[i].classList.add('sp-dialog-color-swatch--active');
        break;
      }
    }
  });

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      errorEl.textContent = 'Course name is required';
      nameInput.focus();
      return;
    }

    try {
      const updated = await CourseRepository.update(courseId, {
        name,
        description: descInput.value.trim(),
        color: selectedColor
      });
      overlay.dispatchEvent(new CustomEvent('course-saved', { detail: updated }));
      close();
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to update course';
    }
  });

  requestAnimationFrame(() => nameInput.focus());

  return overlay;
}

/**
 * Delete a course with confirmation dialog.
 * If mode is provided directly (for testing), skip the dialog.
 * Otherwise shows confirmation with two options.
 * @param {string} courseId - Course ID to delete
 * @param {'orphan'|'cascade'} [mode] - Optional: skip dialog and use this mode directly
 * @returns {Promise<void>}
 */
async function deleteCourseWithConfirmation(courseId, mode) {
  let chosenMode = mode;

  if (!chosenMode) {
    // Show confirmation dialog
    const confirmed = window.confirm(
      'Delete this course?\n\n' +
      'OK = Delete course AND all its lectures\n' +
      'Cancel = Keep lectures (remove from course only)'
    );
    if (confirmed) {
      chosenMode = 'cascade';
    } else {
      // User cancelled the confirm but we still want to delete the course
      // Use a second confirm to distinguish "cancel delete entirely" from "orphan"
      const keepLectures = window.confirm('Remove course but keep lectures?');
      if (!keepLectures) return; // User cancelled entirely
      chosenMode = 'orphan';
    }
  }

  if (chosenMode === 'cascade') {
    await CourseRepository.deleteWithCascade(courseId);
    showToast('success', 'Deleted', 'Course and all lectures deleted');
  } else {
    // Orphan: set lectures' courseId to null (parallel, avoids N+1)
    const lectures = await LectureRepository.getByCourse(courseId);
    await Promise.all(lectures.map(lecture =>
      LectureRepository.update(lecture.id, { courseId: null })
    ));
    await CourseRepository.delete(courseId);
    showToast('success', 'Deleted', 'Course deleted, lectures kept');
  }
}

// ============================================================================
// SIDEBAR
// ============================================================================

/**
 * Render the course sidebar into #library-sidebar.
 * @param {Array<{course: Object, lectureCount: number}>} courses
 * @param {string|null} selectedCourseId - Currently selected filter
 * @param {Object} meta - { totalLectures, uncategorizedCount, favoritesCount }
 */
function renderCourseSidebar(courses, selectedCourseId, meta) {
  const sidebar = document.getElementById('library-sidebar');
  if (!sidebar) return;

  clearElement(sidebar);

  const { totalLectures = 0, uncategorizedCount = 0, favoritesCount = 0 } = meta || {};

  // Helper to create a sidebar button
  function createSidebarItem(label, countValue, filterId, colorHex) {
    const btn = createElement('button', 'sp-library-sidebar__item', { type: 'button' });
    const isActive = selectedCourseId === filterId;
    if (isActive) {
      btn.classList.add('sp-library-sidebar__item--active');
      btn.setAttribute('aria-current', 'true');
    }

    if (colorHex) {
      const dot = createElement('span', 'sp-library-sidebar__color-dot');
      dot.style.backgroundColor = colorHex;
      btn.appendChild(dot);
    }

    const labelEl = createElement('span', 'sp-library-sidebar__label', { textContent: label });
    btn.appendChild(labelEl);

    const countEl = createElement('span', 'sp-library-sidebar__count', {
      textContent: String(countValue)
    });
    btn.appendChild(countEl);

    btn.addEventListener('click', () => {
      libraryState.selectedCourseId = filterId;
      // Re-render sidebar to update active state
      renderCourseSidebar(courses, filterId, meta);
    });

    return btn;
  }

  // Fixed items
  sidebar.appendChild(createSidebarItem('All Lectures', totalLectures, null));
  sidebar.appendChild(createSidebarItem('Favorites', favoritesCount, 'favorites'));
  if (uncategorizedCount > 0) {
    sidebar.appendChild(createSidebarItem('Uncategorized', uncategorizedCount, 'uncategorized'));
  }

  // Course items
  for (const { course, lectureCount } of courses) {
    sidebar.appendChild(createSidebarItem(course.name, lectureCount, course.id, course.color));
  }

  // New Course button
  const addBtn = createElement('button', 'sp-library-sidebar__item sp-library-sidebar__add', {
    type: 'button',
    textContent: '+ New Course'
  });
  addBtn.addEventListener('click', () => {
    const dialog = createCourseDialog();
    document.body.appendChild(dialog);
  });
  sidebar.appendChild(addBtn);
}

// ============================================================================
// TOOLBAR
// ============================================================================

/**
 * Render the library toolbar into #library-toolbar.
 * @param {string} sortBy - Current sort mode
 * @param {string} viewMode - Current view mode ('grid' | 'list')
 */
function renderLibraryToolbar(sortBy, viewMode) {
  const toolbar = document.getElementById('library-toolbar');
  if (!toolbar) return;

  clearElement(toolbar);

  // Sort select
  const sortSelect = createElement('select', 'sp-library-toolbar__sort', {
    'aria-label': 'Sort lectures'
  });
  const sortOptions = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'title', label: 'Title A-Z' },
    { value: 'progress', label: 'Watch Progress' }
  ];
  for (const opt of sortOptions) {
    const option = createElement('option', '', { textContent: opt.label });
    option.value = opt.value;
    if (opt.value === sortBy) option.selected = true;
    sortSelect.appendChild(option);
  }
  sortSelect.addEventListener('change', () => {
    libraryState.sortBy = sortSelect.value;
  });
  toolbar.appendChild(sortSelect);

  // View toggle
  const toggleContainer = createElement('div', 'sp-library-toolbar__view-toggle');

  const gridBtn = createElement('button', 'sp-library-toolbar__btn', {
    type: 'button',
    'aria-label': 'Grid view',
    textContent: '▦'
  });
  if (viewMode === 'grid') gridBtn.setAttribute('aria-pressed', 'true');
  gridBtn.addEventListener('click', () => {
    libraryState.viewMode = 'grid';
    renderLibraryToolbar(libraryState.sortBy, 'grid');
  });

  const listBtn = createElement('button', 'sp-library-toolbar__btn', {
    type: 'button',
    'aria-label': 'List view',
    textContent: '☰'
  });
  if (viewMode === 'list') listBtn.setAttribute('aria-pressed', 'true');
  listBtn.addEventListener('click', () => {
    libraryState.viewMode = 'list';
    renderLibraryToolbar(libraryState.sortBy, 'list');
  });

  toggleContainer.appendChild(gridBtn);
  toggleContainer.appendChild(listBtn);
  toolbar.appendChild(toggleContainer);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort lectures array. Returns a new sorted array (does not mutate input).
 * @param {Array<Object>} lectures
 * @param {string} sortBy - 'recent' | 'title' | 'progress'
 * @returns {Array<Object>}
 */
function sortLectures(lectures, sortBy) {
  const sorted = [...lectures];
  switch (sortBy) {
    case 'recent':
      sorted.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      break;
    case 'title':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'progress':
      sorted.sort((a, b) => (b.watchProgress || 0) - (a.watchProgress || 0));
      break;
  }
  return sorted;
}

// ============================================================================
// IMPORT PIPELINE (Day 2)
// ============================================================================

/**
 * Import a processing result into the library as a lecture with segments and events.
 * Idempotent: re-importing the same jobId returns the existing lecture.
 * Uses SettingsRepository for dedup (AD-2 pattern — Lecture model has no metadata field).
 * @param {Object} result - Processing result { metadata, transcript, events }
 * @param {string} jobId - Unique job identifier for dedup
 * @returns {Promise<Object>} Created or existing lecture
 */
async function importFromProcessingResult(result, jobId) {
  // Dedup check via SettingsRepository
  const importedJobs = await SettingsRepository.get('imported_jobs', {});
  if (importedJobs[jobId]) {
    const existing = await LectureRepository.getById(importedJobs[jobId]);
    if (existing) return existing;
  }

  const meta = result.metadata || {};
  const lecture = await LectureRepository.create(createLecture({
    title: meta.filename || 'Untitled',
    duration: meta.duration || 0,
    status: 'completed',
    courseId: null
  }));

  // Create segments from transcript (AD-3: text in metadata)
  const transcript = result.transcript || [];
  for (const seg of transcript) {
    await SegmentRepository.create(createSegment({
      lectureId: lecture.id,
      startTime: seg.startTime || 0,
      endTime: seg.endTime || 0,
      type: 'transcript',
      metadata: { text: seg.text || '' }
    }));
  }

  // Create events
  const events = result.events || [];
  for (const evt of events) {
    await EventRepository.create(createEvent({
      lectureId: lecture.id,
      type: evt.type || 'unknown',
      timestamp: evt.timestamp || 0,
      metadata: evt
    }));
  }

  // Record dedup mapping
  importedJobs[jobId] = lecture.id;
  await SettingsRepository.set('imported_jobs', importedJobs);

  return lecture;
}

// ============================================================================
// ORGANIZATION (Day 2)
// ============================================================================

/**
 * Assign a lecture to a course (or uncategorize with null).
 * @param {string} lectureId
 * @param {string|null} courseId
 * @returns {Promise<Object>} Updated lecture
 */
async function assignLectureToCourse(lectureId, courseId) {
  return LectureRepository.update(lectureId, { courseId });
}

/**
 * Batch assign lectures to a course. Collects failures.
 * @param {string[]} lectureIds
 * @param {string|null} courseId
 * @returns {Promise<{succeeded: string[], failed: string[]}>}
 */
async function batchAssignCourse(lectureIds, courseId) {
  const succeeded = [];
  const failed = [];

  for (const id of lectureIds) {
    try {
      await LectureRepository.update(id, { courseId });
      succeeded.push(id);
    } catch (_err) {
      failed.push(id);
    }
  }

  return { succeeded, failed };
}

/**
 * Batch delete lectures with cascade. Partial failure safe.
 * @param {string[]} lectureIds
 * @returns {Promise<{succeeded: string[], failed: string[]}>}
 */
async function batchDeleteLectures(lectureIds) {
  const succeeded = [];
  const failed = [];

  for (const id of lectureIds) {
    try {
      await LectureRepository.deleteWithCascade(id);
      succeeded.push(id);
    } catch (_err) {
      failed.push(id);
    }
  }

  // Clean stale IDs from favorites
  if (succeeded.length > 0) {
    const favIds = await getFavoriteIds();
    const cleaned = favIds.filter(id => !succeeded.includes(id));
    if (cleaned.length !== favIds.length) {
      await SettingsRepository.set('favorite_lectures', cleaned);
    }

    const msg = failed.length > 0
      ? `Deleted ${succeeded.length} lectures. ${failed.length} failed.`
      : `Deleted ${succeeded.length} lecture${succeeded.length !== 1 ? 's' : ''}`;
    showToast('success', 'Deleted', msg);
  }

  return { succeeded, failed };
}

/**
 * Render a context menu for a library card.
 * @param {Object} lecture - Lecture object
 * @param {Array} courses - Available courses
 * @param {{x: number, y: number}} position - Menu position
 * @param {Function} onAction - Callback: (action, data) => void
 * @returns {HTMLElement} Menu element
 */
function renderCardContextMenu(lecture, courses, position, onAction) {
  const menu = createElement('div', 'sp-context-menu', {
    role: 'menu',
    'aria-label': 'Lecture actions'
  });
  menu.style.position = 'absolute';
  menu.style.left = `${position.x}px`;
  menu.style.top = `${position.y}px`;

  const menuItems = [
    { label: 'Assign to Course', action: 'assign' },
    { label: 'Edit Title', action: 'edit-title' },
    { label: 'Generate Flashcards', action: 'generate-flashcards' },
    { label: 'Delete', action: 'delete' }
  ];

  const itemElements = [];

  for (const item of menuItems) {
    const btn = createElement('button', 'sp-context-menu__item', {
      role: 'menuitem',
      type: 'button',
      textContent: item.label
    });
    btn.addEventListener('click', () => {
      onAction(item.action, lecture);
      dismiss();
    });
    menu.appendChild(btn);
    itemElements.push(btn);
  }

  // Keyboard navigation
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
      return;
    }
    const current = document.activeElement;
    const idx = itemElements.indexOf(current);
    if (e.key === 'ArrowDown' && idx < itemElements.length - 1) {
      e.preventDefault();
      itemElements[idx + 1].focus();
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      itemElements[idx - 1].focus();
    }
  });

  // Dismiss on outside click
  function onOutsideClick(e) {
    if (!menu.contains(e.target)) {
      dismiss();
    }
  }

  function dismiss() {
    document.removeEventListener('mousedown', onOutsideClick);
    if (menu.parentNode) menu.parentNode.removeChild(menu);
  }

  // Defer listener to avoid capturing the opening click
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', onOutsideClick);
    if (itemElements.length > 0) itemElements[0].focus();
  });

  return menu;
}

// ============================================================================
// EVENT LISTENER (Day 2 — catches processing events)
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('lecturemind:processed', async (e) => {
    try {
      const lecture = await importFromProcessingResult(e.detail.result, e.detail.jobId);
      showToast('success', 'Import Complete', `Imported "${lecture.title}" to library`);
    } catch (_err) {
      showToast('error', 'Import Failed', 'Could not import lecture to library');
    }
  });
}

// ============================================================================
// CROSS-LECTURE SEARCH (Day 3)
// ============================================================================

const SEARCH_CONFIG = {
  MAX_RESULTS: 50,
  MIN_QUERY_LENGTH: 2,
  DEBOUNCE_MS: 300,
  HIGHLIGHT_CONTEXT_CHARS: 80
};

/** Search cache — built once on first search, invalidated via _resetSearchCache(). */
let searchCache = null;

/** Reset search cache (for testing and data changes). */
function _resetSearchCache() {
  searchCache = null;
}

/**
 * Build search cache from all stored entities.
 * @returns {Promise<Object>}
 */
async function buildSearchCache() {
  const [segments, flashcards, bookmarks, lectures] = await Promise.all([
    SegmentRepository.getAll(),
    FlashcardRepository.getAll(),
    BookmarkRepository.getAll(),
    LectureRepository.getAll()
  ]);

  const lectureMap = new Map(lectures.map(l => [l.id, l.title || 'Untitled']));

  searchCache = {
    segments: segments.map(seg => ({
      text: extractSearchableText(seg),
      ref: seg,
      lectureId: seg.lectureId
    })),
    flashcards: flashcards.map(card => ({
      text: (card.front || '') + ' ' + (card.back || ''),
      ref: card,
      lectureId: card.lectureId
    })),
    bookmarks: bookmarks
      .filter(bk => bk.label && bk.label.trim().length > 0)
      .map(bk => ({
        text: bk.label,
        ref: bk,
        lectureId: bk.lectureId
      })),
    lectures: lectureMap
  };

  return searchCache;
}

/**
 * Extract searchable text from a segment.
 * @param {Object} segment
 * @returns {string}
 */
function extractSearchableText(segment) {
  return (segment.metadata && segment.metadata.text) || '';
}

/**
 * Score a match for ranking.
 * @param {string} text - The full text being searched
 * @param {string[]} terms - Individual search terms
 * @param {string} fullQuery - The original full query
 * @returns {number} Score (higher = better match)
 */
function scoreMatch(text, terms, fullQuery) {
  const lowerText = text.toLowerCase();
  const lowerQuery = fullQuery.toLowerCase();

  // Exact phrase match
  if (lowerText.includes(lowerQuery)) {
    let score = 100;
    if (lowerText.indexOf(lowerQuery) < 100) score += 10;
    return score;
  }

  // Partial term matching
  let matched = 0;
  for (const term of terms) {
    if (lowerText.includes(term.toLowerCase())) matched++;
  }
  let score = 50 + (matched / terms.length) * 30;

  // Bonus for early match
  for (const term of terms) {
    const idx = lowerText.indexOf(term.toLowerCase());
    if (idx >= 0 && idx < 100) {
      score += 10;
      break;
    }
  }

  return score;
}

/**
 * Extract a snippet around the first matching term.
 * @param {string} text
 * @param {string[]} terms
 * @param {number} contextChars
 * @returns {{ before: string, match: string, after: string }}
 */
function extractSnippet(text, terms, contextChars = SEARCH_CONFIG.HIGHLIGHT_CONTEXT_CHARS) {
  const lowerText = text.toLowerCase();
  let firstIdx = -1;
  let matchedTerm = '';

  for (const term of terms) {
    const idx = lowerText.indexOf(term.toLowerCase());
    if (idx >= 0 && (firstIdx < 0 || idx < firstIdx)) {
      firstIdx = idx;
      matchedTerm = text.substring(idx, idx + term.length);
    }
  }

  if (firstIdx < 0) {
    return { before: text.substring(0, contextChars), match: '', after: '' };
  }

  const start = Math.max(0, firstIdx - contextChars);
  const end = Math.min(text.length, firstIdx + matchedTerm.length + contextChars);

  return {
    before: (start > 0 ? '...' : '') + text.substring(start, firstIdx),
    match: matchedTerm,
    after: text.substring(firstIdx + matchedTerm.length, end) + (end < text.length ? '...' : '')
  };
}

/**
 * Highlight terms in text using safe DOM (createElement + textContent, zero innerHTML).
 * @param {HTMLElement} container - Container to append highlighted nodes to
 * @param {string} text - Text to highlight
 * @param {string[]} terms - Terms to highlight
 */
function highlightTerms(container, text, terms) {
  if (!terms || terms.length === 0 || !text) {
    container.appendChild(document.createTextNode(text || ''));
    return;
  }

  // Escape regex special chars
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  for (const part of parts) {
    if (regex.test(part)) {
      const span = document.createElement('span');
      span.className = 'sp-search-highlight';
      span.textContent = part;
      container.appendChild(span);
    } else if (part.length > 0) {
      container.appendChild(document.createTextNode(part));
    }
    // Reset regex lastIndex after test
    regex.lastIndex = 0;
  }
}

/**
 * Search across all lectures: segments, flashcards, bookmarks.
 * @param {string} query - User's search query
 * @returns {Promise<{ segments: Array, flashcards: Array, bookmarks: Array, totalCount: number }>}
 */
async function crossLectureSearch(query) {
  const empty = { segments: [], flashcards: [], bookmarks: [], totalCount: 0 };

  const trimmed = (query || '').trim();
  if (trimmed.length < SEARCH_CONFIG.MIN_QUERY_LENGTH) return empty;

  const normalized = trimmed.toLowerCase();
  const terms = normalized.split(/\s+/).filter(t => t.length > 0);

  if (!searchCache) {
    await buildSearchCache();
  }

  // Segments: ALL terms must be present (raw terms for literal .includes())
  const matchedSegments = searchCache.segments
    .filter(item => {
      const lower = item.text.toLowerCase();
      return terms.every(t => lower.includes(t));
    })
    .map(item => ({
      text: item.text,
      lectureId: item.lectureId,
      type: 'segment',
      ref: item.ref,
      score: scoreMatch(item.text, terms, trimmed)
    }));

  // Flashcards: ALL terms must be present
  const matchedFlashcards = searchCache.flashcards
    .filter(item => {
      const lower = item.text.toLowerCase();
      return terms.every(t => lower.includes(t));
    })
    .map(item => ({
      text: item.text,
      lectureId: item.lectureId,
      type: 'flashcard',
      ref: item.ref,
      score: scoreMatch(item.text, terms, trimmed)
    }));

  // Bookmarks: ANY term present
  const matchedBookmarks = searchCache.bookmarks
    .filter(item => {
      const lower = item.text.toLowerCase();
      return terms.some(t => lower.includes(t));
    })
    .map(item => ({
      text: item.text,
      lectureId: item.lectureId,
      type: 'bookmark',
      ref: item.ref,
      score: scoreMatch(item.text, terms, trimmed)
    }));

  // Sort each by score desc
  matchedSegments.sort((a, b) => b.score - a.score);
  matchedFlashcards.sort((a, b) => b.score - a.score);
  matchedBookmarks.sort((a, b) => b.score - a.score);

  // Limit total results
  let total = matchedSegments.length + matchedFlashcards.length + matchedBookmarks.length;
  if (total > SEARCH_CONFIG.MAX_RESULTS) {
    // Proportional trimming
    const ratio = SEARCH_CONFIG.MAX_RESULTS / total;
    matchedSegments.length = Math.min(matchedSegments.length, Math.max(1, Math.floor(matchedSegments.length * ratio)));
    matchedFlashcards.length = Math.min(matchedFlashcards.length, Math.max(1, Math.floor(matchedFlashcards.length * ratio)));
    matchedBookmarks.length = Math.min(matchedBookmarks.length, Math.max(1, Math.floor(matchedBookmarks.length * ratio)));
    total = matchedSegments.length + matchedFlashcards.length + matchedBookmarks.length;
  }

  return {
    segments: matchedSegments,
    flashcards: matchedFlashcards,
    bookmarks: matchedBookmarks,
    totalCount: total
  };
}

// ============================================================================
// SEARCH UI RENDERERS (Day 3)
// ============================================================================

/**
 * Render search input with debounce and clear button.
 * @param {HTMLElement} container - Container to render into
 * @param {Function} onSearch - Callback: (query: string) => void
 */
function renderSearchInput(container, onSearch) {
  const wrapper = createElement('div', 'sp-search-input-wrapper');

  const input = createElement('input', '', {
    type: 'text',
    'aria-label': 'Search across all lectures'
  });
  input.setAttribute('placeholder', 'Search across all lectures...');
  wrapper.appendChild(input);

  const clearBtn = createElement('button', 'sp-search-input-wrapper__clear', {
    type: 'button',
    textContent: '\u00D7',
    'aria-label': 'Clear search'
  });
  wrapper.appendChild(clearBtn);

  let debounceTimer = null;

  input.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onSearch(input.value);
    }, SEARCH_CONFIG.DEBOUNCE_MS);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    if (debounceTimer) clearTimeout(debounceTimer);
    onSearch('');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      if (debounceTimer) clearTimeout(debounceTimer);
      onSearch('');
    }
  });

  container.appendChild(wrapper);
}

/**
 * Render search results into container.
 * @param {HTMLElement} container
 * @param {{ segments: Array, flashcards: Array, bookmarks: Array }} results
 * @param {string} query
 * @param {Map<string, string>} lectureMap - Map<lectureId, title>
 */
function renderSearchResults(container, results, query, lectureMap) {
  clearElement(container);
  const terms = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 0);

  const allResults = [
    ...results.segments,
    ...results.flashcards,
    ...results.bookmarks
  ].sort((a, b) => b.score - a.score);

  for (const result of allResults) {
    const card = createElement('div', 'sp-search-result', {
      role: 'link',
      tabindex: '0'
    });

    // Lecture title
    const lectureName = lectureMap.get(result.lectureId) || 'Unknown Lecture';
    const lectureLabel = createElement('div', 'sp-search-result__lecture', { textContent: lectureName });
    card.appendChild(lectureLabel);

    // Type badge
    const typeBadge = createElement('span', 'sp-search-result__type', {
      textContent: result.type.charAt(0).toUpperCase() + result.type.slice(1)
    });
    card.appendChild(typeBadge);

    // Highlighted snippet
    const snippet = createElement('div', 'sp-search-result__snippet');
    const snippetText = result.text.length > 200
      ? result.text.substring(0, 200) + '...'
      : result.text;
    highlightTerms(snippet, snippetText, terms);
    card.appendChild(snippet);

    // Click/keyboard to navigate
    const navigate = () => navigateTo(`#/lecture/${result.lectureId}`);
    card.addEventListener('click', navigate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate();
      }
    });

    container.appendChild(card);
  }
}

/**
 * Render tab bar for search results filtering.
 * @param {HTMLElement} container
 * @param {string} activeTab - 'all' | 'segments' | 'flashcards' | 'bookmarks'
 * @param {{ all: number, segments: number, flashcards: number, bookmarks: number }} counts
 * @param {Function} [onTabChange] - Callback: (tab: string) => void
 */
function renderSearchTabs(container, activeTab, counts, onTabChange) {
  const tablist = createElement('div', 'sp-search-tabs', { role: 'tablist', 'aria-label': 'Search result filters' });

  const tabDefs = [
    { id: 'all', label: `All (${counts.all || 0})` },
    { id: 'segments', label: `Segments (${counts.segments || 0})` },
    { id: 'flashcards', label: `Flashcards (${counts.flashcards || 0})` },
    { id: 'bookmarks', label: `Bookmarks (${counts.bookmarks || 0})` }
  ];

  const tabElements = [];

  for (const def of tabDefs) {
    const isActive = def.id === activeTab;
    const tab = createElement('button', 'sp-search-tabs__tab' + (isActive ? ' sp-search-tabs__tab--active' : ''), {
      role: 'tab',
      type: 'button',
      'aria-selected': isActive ? 'true' : 'false',
      tabindex: isActive ? '0' : '-1',
      textContent: def.label,
      'data-tab': def.id
    });

    tab.addEventListener('click', () => {
      if (onTabChange) onTabChange(def.id);
    });

    tablist.appendChild(tab);
    tabElements.push(tab);
  }

  // Keyboard navigation
  tablist.addEventListener('keydown', (e) => {
    const currentIdx = tabElements.findIndex(t => t === document.activeElement);
    if (currentIdx < 0) return;

    let nextIdx = -1;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % tabElements.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + tabElements.length) % tabElements.length;
    }

    if (nextIdx >= 0) {
      e.preventDefault();
      tabElements[nextIdx].focus();
      if (onTabChange) onTabChange(tabDefs[nextIdx].id);
    }
  });

  container.appendChild(tablist);
}

// ============================================================================
// ENHANCED LIBRARY RENDERER (registered via setLibraryRenderer)
// ============================================================================

/**
 * Render a lecture card for the library grid.
 * @param {Object} lecture
 * @param {Object|null} course
 * @returns {HTMLElement}
 */
function renderLibraryCard(lecture, course) {
  const card = createElement('div', 'sp-library-card');
  card.setAttribute('role', 'listitem');
  card.dataset.lectureId = lecture.id;

  const title = createElement('h3', 'sp-library-card__title', {
    textContent: lecture.title
  });
  card.appendChild(title);

  if (course) {
    const badge = createElement('span', 'sp-library-card__course', {
      textContent: course.name
    });
    card.appendChild(badge);
  }

  const progress = createElement('span', 'sp-library-card__progress', {
    textContent: `${lecture.watchProgress || 0}%`
  });
  card.appendChild(progress);

  card.setAttribute('tabindex', '0');
  card.addEventListener('click', () => navigateTo(`#/lecture/${lecture.id}`));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateTo(`#/lecture/${lecture.id}`);
    }
  });

  return card;
}

/**
 * Render lectures into a grid with pagination via IntersectionObserver.
 * @param {HTMLElement} container - The grid container
 * @param {Object[]} lectures - All lectures to render
 * @param {Map} courseMap - Map<courseId, course>
 * @param {number} [pageSize=12] - Items per page
 * @returns {IntersectionObserver|null} Observer for test access
 */
function renderLibraryViewPaginated(container, lectures, courseMap, pageSize = 12) {
  clearElement(container);

  let rendered = 0;
  let sentinel = null;
  let observer = null;

  function renderBatch() {
    const end = Math.min(rendered + pageSize, lectures.length);
    for (let i = rendered; i < end; i++) {
      const lecture = lectures[i];
      const course = courseMap.get(lecture.courseId) || null;
      container.appendChild(renderLibraryCard(lecture, course));
    }
    rendered = end;

    // Remove old sentinel
    if (sentinel && sentinel.parentNode) {
      sentinel.parentNode.removeChild(sentinel);
      sentinel = null;
    }

    // Add sentinel if more to load
    if (rendered < lectures.length) {
      sentinel = createElement('div', 'sp-sentinel');
      sentinel.dataset.sentinel = 'true';
      container.appendChild(sentinel);
      if (observer) observer.observe(sentinel);
    } else {
      // All rendered, disconnect observer
      if (observer) observer.disconnect();
    }
  }

  if (lectures.length > pageSize) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          renderBatch();
        }
      }
    });
  }

  renderBatch();
  return observer;
}

/**
 * Render empty state for a course with no lectures.
 * @param {HTMLElement} container
 * @param {string} courseName
 */
function renderCourseEmptyState(container, courseName) {
  clearElement(container);
  const msg = createElement('p', 'sp-empty-state', {
    textContent: `No lectures in ${courseName} yet`
  });
  container.appendChild(msg);
}

/**
 * Render empty state for search with no results.
 * @param {HTMLElement} container
 * @param {string} query
 */
function renderSearchEmptyState(container, query) {
  clearElement(container);
  const msg = createElement('p', 'sp-empty-state', {
    textContent: `No results for "${query}"`
  });
  container.appendChild(msg);
}

/**
 * Render empty state for favorites with no starred lectures.
 * @param {HTMLElement} container
 */
function renderFavoritesEmptyState(container) {
  clearElement(container);
  const msg = createElement('p', 'sp-empty-state', {
    textContent: 'No favorites yet. Star lectures to add them here.'
  });
  container.appendChild(msg);
}

/**
 * Initialize keyboard shortcuts for the library view.
 * "/" or Ctrl+K: focus search input
 * Returns cleanup function.
 * @returns {Function} Cleanup function to remove listener
 */
function initLibraryKeyboardShortcuts() {
  function handler(e) {
    const active = document.activeElement;
    const isInputFocused = active && (
      active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT'
    );

    if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !isInputFocused) {
      e.preventDefault();
      const searchInput = document.querySelector('.sp-search-input');
      if (searchInput) searchInput.focus();
    }

    if (e.key === 'Escape' && isInputFocused) {
      active.value = '';
      active.blur();
    }
  }

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

/**
 * Enhanced library view renderer that adds sidebar + toolbar to the playground view.
 * Registered via setLibraryRenderer() on module load.
 */
async function enhancedRenderLibraryView() {
  try {
    const coursesWithCounts = await loadCourses();

    // Favorites count for sidebar
    const favIds = await getFavoriteIds();
    libraryState.favoritesCount = favIds.length;

    renderCourseSidebar(coursesWithCounts, libraryState.selectedCourseId, {
      totalLectures: libraryState.totalLectures,
      uncategorizedCount: libraryState.uncategorizedCount,
      favoritesCount: libraryState.favoritesCount
    });
    renderLibraryToolbar(libraryState.sortBy, libraryState.viewMode);

    // Load all lectures
    let lectures = await LectureRepository.getAll();

    // Filter by selected course
    const selectedId = libraryState.selectedCourseId;
    if (selectedId === 'favorites') {
      const favSet = new Set(favIds);
      lectures = lectures.filter(l => favSet.has(l.id));
    } else if (selectedId === 'uncategorized') {
      lectures = lectures.filter(l => !l.courseId);
    } else if (selectedId) {
      lectures = lectures.filter(l => l.courseId === selectedId);
    }

    // Sort
    lectures = sortLectures(lectures, libraryState.sortBy);

    // Batch-load courses (single getAll, Map) — avoids N+1
    const allCourses = await CourseRepository.getAll();
    const courseMap = new Map(allCourses.map(c => [c.id, c]));

    // Render into grid
    const grid = document.getElementById('library-grid');
    const emptyState = document.getElementById('library-empty');

    if (grid) {
      if (lectures.length === 0) {
        clearElement(grid);
        // Show appropriate empty state
        if (emptyState) {
          emptyState.classList.remove('hidden');
          if (selectedId === 'favorites') {
            renderFavoritesEmptyState(emptyState);
          } else if (selectedId && selectedId !== 'uncategorized') {
            const course = courseMap.get(selectedId);
            renderCourseEmptyState(emptyState, course ? course.name : 'this course');
          } else {
            clearElement(emptyState);
            emptyState.appendChild(createElement('p', 'sp-empty-state', {
              textContent: 'No lectures yet'
            }));
          }
        }
      } else {
        if (emptyState) emptyState.classList.add('hidden');
        renderLibraryViewPaginated(grid, lectures, courseMap, 12);
      }
    }
  } catch (err) {
    showToast('error', 'Error', 'Failed to load library');
  }
}

// ============================================================================
// DAY 4: PROGRESS TRACKING
// ============================================================================

/**
 * Update lecture progress when a segment is completed.
 * @param {string} lectureId
 * @param {string} segmentId
 * @param {number} position - Current playback position in seconds
 */
async function updateLectureProgress(lectureId, segmentId, position) {
  await ProgressRepository.updatePosition(lectureId, position);
  await ProgressRepository.markSegmentCompleted(lectureId, segmentId);

  const segments = await SegmentRepository.getByLecture(lectureId);
  const totalSegments = segments.length;
  if (totalSegments === 0) {
    await LectureRepository.update(lectureId, { watchProgress: 0 });
    return;
  }

  const progress = await ProgressRepository.getOrCreate(lectureId);
  const percentage = Math.round((progress.completedSegments.length / totalSegments) * 100);
  await LectureRepository.update(lectureId, { watchProgress: percentage });
}

/**
 * Get aggregate stats for a lecture.
 * @param {string} lectureId
 * @returns {Promise<Object>} Stats object
 */
async function getLectureStats(lectureId) {
  const segments = await SegmentRepository.getByLecture(lectureId);
  const flashcards = await FlashcardRepository.getByLecture(lectureId);
  const bookmarks = await BookmarkRepository.getByLecture(lectureId);
  const progress = await ProgressRepository.getOrCreate(lectureId);

  const segmentCount = segments.length;
  const completedSegmentCount = progress.completedSegments.length;
  const progressPercent = segmentCount === 0 ? 0 :
    Math.round((completedSegmentCount / segmentCount) * 100);

  const flashcardsDue = flashcards.filter(f => f.dueDate <= Date.now()).length;
  const masteredCount = flashcards.filter(f => f.status === FLASHCARD_STATUS.MASTERED).length;

  return {
    segmentCount,
    completedSegmentCount,
    progressPercent,
    flashcardCount: flashcards.length,
    flashcardsDue,
    masteredCount,
    bookmarkCount: bookmarks.length,
    lastPosition: progress.lastPosition,
    lastStudied: progress.updatedAt
  };
}

// ============================================================================
// DAY 4: DETAIL VIEW RENDERING
// ============================================================================

/**
 * Format seconds to mm:ss string.
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Render the lecture detail header.
 * @param {HTMLElement} container
 * @param {Object} lecture
 * @param {Object|null} course
 */
function renderDetailHeader(container, lecture, course) {
  clearElement(container);

  const backBtn = createElement('button', 'sp-detail-back', {
    textContent: '\u2190 Library'
  });
  backBtn.addEventListener('click', () => navigateTo('#/playground'));
  container.appendChild(backBtn);

  const title = createElement('h2', 'sp-detail-title', {
    textContent: lecture.title
  });
  container.appendChild(title);

  if (course) {
    const badge = createElement('span', 'sp-course-badge', {
      textContent: course.name
    });
    badge.style.backgroundColor = course.color || 'var(--color-primary-500)';
    container.appendChild(badge);
  }
}

/**
 * Render stat cards for the lecture detail view.
 * @param {HTMLElement} container
 * @param {Object} stats
 */
function renderDetailStats(container, stats) {
  const statsBar = createElement('div', 'sp-detail-stats');

  // Progress card
  const progressCard = createElement('div', 'sp-detail-stat');
  const progressValue = createElement('div', 'sp-detail-stat__value', {
    textContent: `${stats.progressPercent}%`
  });
  const progressLabel = createElement('div', 'sp-detail-stat__label', {
    textContent: 'Progress'
  });
  progressCard.appendChild(progressValue);
  progressCard.appendChild(progressLabel);
  statsBar.appendChild(progressCard);

  // Flashcards card
  const fcCard = createElement('div', 'sp-detail-stat');
  const fcValue = createElement('div', 'sp-detail-stat__value', {
    textContent: `${stats.flashcardCount}`
  });
  const fcLabel = createElement('div', 'sp-detail-stat__label', {
    textContent: 'Flashcards'
  });
  fcCard.appendChild(fcValue);
  fcCard.appendChild(fcLabel);
  statsBar.appendChild(fcCard);

  // Bookmarks card
  const bmCard = createElement('div', 'sp-detail-stat');
  const bmValue = createElement('div', 'sp-detail-stat__value', {
    textContent: `${stats.bookmarkCount}`
  });
  const bmLabel = createElement('div', 'sp-detail-stat__label', {
    textContent: 'Bookmarks'
  });
  bmCard.appendChild(bmValue);
  bmCard.appendChild(bmLabel);
  statsBar.appendChild(bmCard);

  // Last studied card
  const lastCard = createElement('div', 'sp-detail-stat');
  const lastValue = createElement('div', 'sp-detail-stat__value', {
    textContent: stats.lastStudied ? new Date(stats.lastStudied).toLocaleDateString() : 'Never'
  });
  const lastLabel = createElement('div', 'sp-detail-stat__label', {
    textContent: 'Last Studied'
  });
  lastCard.appendChild(lastValue);
  lastCard.appendChild(lastLabel);
  statsBar.appendChild(lastCard);

  container.appendChild(statsBar);
}

/**
 * Render ARIA-compliant tab bar for lecture detail view.
 * @param {HTMLElement} container
 * @param {string} activeTab - 'segments'|'flashcards'|'bookmarks'|'info'
 * @param {Function} [onTabChange] - Callback when tab changes
 * @returns {HTMLElement} The tablist element
 */
function renderDetailTabs(container, activeTab, onTabChange) {
  const tabNames = ['Segments', 'Flashcards', 'Bookmarks', 'Info', 'Analytics'];
  const tabIds = ['segments', 'flashcards', 'bookmarks', 'info', 'analytics'];

  const tablist = createElement('div', 'sp-detail-tabs');
  tablist.setAttribute('role', 'tablist');

  tabIds.forEach((tabId, index) => {
    const isActive = tabId === activeTab;
    const tab = createElement('button', 'sp-detail-tabs__tab', {
      textContent: tabNames[index]
    });
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
    tab.setAttribute('aria-controls', `tabpanel-${tabId}`);
    tab.dataset.tab = tabId;

    tab.addEventListener('click', () => {
      // Update all tabs
      const allTabs = tablist.querySelectorAll('[role="tab"]');
      allTabs.forEach(t => {
        t.setAttribute('aria-selected', 'false');
        t.setAttribute('tabindex', '-1');
      });
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
      if (onTabChange) onTabChange(tabId);
    });

    tablist.appendChild(tab);
  });

  // Keyboard navigation
  tablist.addEventListener('keydown', (e) => {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Enter' || e.key === ' ') {
      tabs[currentIndex].click();
      e.preventDefault();
      return;
    }

    if (nextIndex >= 0) {
      e.preventDefault();
      tabs[nextIndex].focus();
    }
  });

  container.appendChild(tablist);
  return tablist;
}

// ============================================================================
// DAY 4: ENTITY LISTS
// ============================================================================

/**
 * Render segments list for a lecture.
 * @param {HTMLElement} container
 * @param {string} lectureId
 */
async function renderSegmentsList(container, lectureId) {
  const segments = await SegmentRepository.getByLecture(lectureId);
  const progress = await ProgressRepository.getOrCreate(lectureId);
  const completedSet = new Set(progress.completedSegments);

  clearElement(container);

  segments.forEach(segment => {
    const isCompleted = completedSet.has(segment.id);
    const item = createElement('div', `sp-segment-item${isCompleted ? ' sp-segment-item--completed' : ''}`);

    const checkbox = createElement('span', 'sp-segment-item__check', {
      textContent: isCompleted ? '\u2713' : '\u25CB'
    });
    item.appendChild(checkbox);

    const timeRange = createElement('span', 'sp-segment-item__time', {
      textContent: `${formatTime(segment.startTime)} \u2013 ${formatTime(segment.endTime)}`
    });
    item.appendChild(timeRange);

    const typeBadge = createElement('span', 'sp-segment-item__type', {
      textContent: segment.type
    });
    item.appendChild(typeBadge);

    if (segment.metadata && segment.metadata.text) {
      const text = createElement('span', 'sp-segment-item__text', {
        textContent: segment.metadata.text
      });
      item.appendChild(text);
    }

    container.appendChild(item);
  });

  if (segments.length === 0) {
    container.appendChild(createElement('p', 'sp-empty-state', { textContent: 'No segments yet' }));
  }
}

/**
 * Render flashcards list for a lecture.
 * @param {HTMLElement} container
 * @param {string} lectureId
 */
async function renderFlashcardsList(container, lectureId) {
  const flashcards = await FlashcardRepository.getByLecture(lectureId);

  clearElement(container);

  flashcards.forEach(card => {
    const item = createElement('div', 'sp-flashcard-item');

    const frontText = createElement('span', 'sp-flashcard-item__front', {
      textContent: card.front.length > 60 ? card.front.slice(0, 60) + '\u2026' : card.front
    });
    item.appendChild(frontText);

    const statusBadge = createElement('span', 'sp-flashcard-item__status', {
      textContent: card.status || 'new'
    });
    item.appendChild(statusBadge);

    const actions = createElement('div', 'sp-flashcard-item__actions');

    const editBtn = createElement('button', 'sp-flashcard-item__edit', {
      textContent: 'Edit'
    });
    editBtn.setAttribute('aria-label', `Edit flashcard: ${card.front.slice(0, 30)}`);
    actions.appendChild(editBtn);

    const deleteBtn = createElement('button', 'sp-flashcard-item__delete', {
      textContent: 'Delete'
    });
    deleteBtn.setAttribute('aria-label', `Delete flashcard: ${card.front.slice(0, 30)}`);
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    container.appendChild(item);
  });

  if (flashcards.length === 0) {
    container.appendChild(createElement('p', 'sp-empty-state', { textContent: 'No flashcards yet' }));
  }
}

/**
 * Render bookmarks list for a lecture.
 * @param {HTMLElement} container
 * @param {string} lectureId
 */
async function renderBookmarksList(container, lectureId) {
  const bookmarks = await BookmarkRepository.getByLecture(lectureId);

  clearElement(container);

  bookmarks.forEach(bookmark => {
    const item = createElement('div', 'sp-bookmark-item');

    const timestamp = createElement('span', 'sp-bookmark-item__time', {
      textContent: formatTime(bookmark.timestamp)
    });
    item.appendChild(timestamp);

    const label = createElement('span', 'sp-bookmark-item__label', {
      textContent: bookmark.label || 'Bookmark'
    });
    item.appendChild(label);

    const deleteBtn = createElement('button', 'sp-bookmark-item__delete', {
      textContent: 'Delete'
    });
    deleteBtn.setAttribute('aria-label', `Delete bookmark at ${formatTime(bookmark.timestamp)}`);
    item.appendChild(deleteBtn);

    container.appendChild(item);
  });

  if (bookmarks.length === 0) {
    container.appendChild(createElement('p', 'sp-empty-state', { textContent: 'No bookmarks yet' }));
  }
}

/**
 * Render lecture info panel.
 * @param {HTMLElement} container
 * @param {Object} lecture
 * @param {Object} stats
 */
function renderLectureInfo(container, lecture, stats) {
  clearElement(container);

  const info = createElement('div', 'sp-lecture-info');

  const created = createElement('p', 'sp-lecture-info__item', {
    textContent: `Created: ${new Date(lecture.createdAt).toLocaleDateString()}`
  });
  info.appendChild(created);

  if (lecture.duration) {
    const duration = createElement('p', 'sp-lecture-info__item', {
      textContent: `Duration: ${formatTime(lecture.duration)}`
    });
    info.appendChild(duration);
  }

  const status = createElement('p', 'sp-lecture-info__item', {
    textContent: `Status: ${lecture.status || 'draft'}`
  });
  info.appendChild(status);

  const progress = createElement('p', 'sp-lecture-info__item', {
    textContent: `Progress: ${stats.progressPercent}%`
  });
  info.appendChild(progress);

  const studyBtn = createElement('button', 'sp-btn sp-btn--primary', {
    textContent: 'Study Flashcards'
  });
  studyBtn.addEventListener('click', () => navigateTo(`#/study/${lecture.id}`));
  info.appendChild(studyBtn);

  container.appendChild(info);
}

/**
 * Full lecture detail view renderer.
 * @param {string} lectureId
 */
async function renderLectureDetailView(lectureId) {
  const header = document.getElementById('lecture-detail-header');
  const content = document.getElementById('lecture-detail-content');
  if (!header || !content) return;

  clearElement(header);
  clearElement(content);

  const loadingTitle = createElement('h2', 'sp-detail-title', { textContent: 'Loading...' });
  header.appendChild(loadingTitle);

  try {
    const lecture = await LectureRepository.getById(lectureId);
    if (!lecture) {
      loadingTitle.textContent = 'Lecture not found';
      return;
    }

    // Get course info
    let course = null;
    if (lecture.courseId) {
      course = await CourseRepository.getById(lecture.courseId);
    }

    // Render header (replaces loadingTitle)
    renderDetailHeader(header, lecture, course);

    // Favorite button in header
    const favContainer = createElement('span', '');
    const isFav = await isFavorite(lectureId);
    renderFavoriteButton(favContainer, lectureId, isFav);
    header.appendChild(favContainer);

    // Render stats
    const stats = await getLectureStats(lectureId);
    const statsContainer = createElement('div', '');
    renderDetailStats(statsContainer, stats);
    content.appendChild(statsContainer);

    // Tab content area
    const tabPanel = createElement('div', 'sp-detail-tabpanel');
    tabPanel.setAttribute('role', 'tabpanel');
    tabPanel.id = 'tabpanel-segments';

    // Render tabs with switching
    const activeTab = 'segments';
    renderDetailTabs(content, activeTab, async (tabId) => {
      tabPanel.id = `tabpanel-${tabId}`;
      clearElement(tabPanel);
      if (tabId === 'segments') await renderSegmentsList(tabPanel, lectureId);
      else if (tabId === 'flashcards') await renderFlashcardsList(tabPanel, lectureId);
      else if (tabId === 'bookmarks') await renderBookmarksList(tabPanel, lectureId);
      else if (tabId === 'info') renderLectureInfo(tabPanel, lecture, stats);
      else if (tabId === 'analytics') await renderLectureAnalyticsTab(tabPanel, lectureId);
    });

    content.appendChild(tabPanel);

    // Default: show segments
    await renderSegmentsList(tabPanel, lectureId);

    // Playlist navigation
    const playlist = await getPlaylistForLecture(lectureId);
    renderPlaylistNav(content, playlist);

  } catch (_err) {
    clearElement(header);
    clearElement(content);
    header.appendChild(createElement('h2', 'sp-detail-title', {
      textContent: 'Error loading lecture'
    }));
  }
}

// ============================================================================
// DAY 5: FAVORITES (AD-2 — via SettingsRepository)
// ============================================================================

/**
 * Get favorite lecture IDs from settings.
 * @returns {Promise<string[]>}
 */
async function getFavoriteIds() {
  const favorites = await SettingsRepository.get('favorite_lectures');
  return Array.isArray(favorites) ? favorites : [];
}

/**
 * Toggle favorite status for a lecture.
 * @param {string} lectureId
 * @returns {Promise<boolean>} New isFavorite state
 */
async function toggleFavorite(lectureId) {
  const ids = await getFavoriteIds();
  const index = ids.indexOf(lectureId);
  if (index >= 0) {
    ids.splice(index, 1);
    await SettingsRepository.set('favorite_lectures', ids);
    return false;
  } else {
    ids.push(lectureId);
    await SettingsRepository.set('favorite_lectures', ids);
    return true;
  }
}

/**
 * Check if a lecture is favorited.
 * @param {string} lectureId
 * @returns {Promise<boolean>}
 */
async function isFavorite(lectureId) {
  const ids = await getFavoriteIds();
  return ids.includes(lectureId);
}

/**
 * Get lecture objects for all favorite IDs, filtering out deleted lectures.
 * @returns {Promise<Object[]>}
 */
async function getFavoriteLectures() {
  const ids = await getFavoriteIds();
  const results = await Promise.all(ids.map(id => LectureRepository.getById(id)));
  return results.filter(lecture => lecture != null);
}

// ============================================================================
// DAY 5: PLAYLIST NAVIGATION
// ============================================================================

/**
 * Get playlist context for a lecture (prev/current/next within course).
 * @param {string} lectureId
 * @returns {Promise<Object>} { previous, current, next, total, currentIndex }
 */
async function getPlaylistForLecture(lectureId) {
  const lecture = await LectureRepository.getById(lectureId);
  if (!lecture) return { previous: null, current: null, next: null, total: 0, currentIndex: -1 };

  let lectures;
  if (lecture.courseId) {
    lectures = await LectureRepository.getByCourse(lecture.courseId);
  } else {
    const all = await LectureRepository.getAll();
    lectures = all.filter(l => !l.courseId);
  }

  // Sort by createdAt ascending (chronological), tiebreak by id for stability
  lectures.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  const currentIndex = lectures.findIndex(l => l.id === lectureId);
  return {
    previous: currentIndex > 0 ? lectures[currentIndex - 1] : null,
    current: lectures[currentIndex] || lecture,
    next: currentIndex < lectures.length - 1 ? lectures[currentIndex + 1] : null,
    total: lectures.length,
    currentIndex
  };
}

// Module-level reference for playlist keyboard handler cleanup
let _playlistKeyHandler = null;

/**
 * Render playlist navigation bar.
 * @param {HTMLElement} container
 * @param {Object} playlist - From getPlaylistForLecture
 */
function renderPlaylistNav(container, playlist) {
  const nav = createElement('nav', 'sp-playlist-nav');
  nav.setAttribute('aria-label', 'Lecture playlist');

  // Previous button
  const prevBtn = createElement('button', 'sp-playlist-nav__btn sp-playlist-nav__btn--prev', {
    textContent: playlist.previous ? `\u2190 ${playlist.previous.title}` : '\u2190 Previous'
  });
  prevBtn.setAttribute('aria-label', playlist.previous ? `Previous: ${playlist.previous.title}` : 'Previous lecture');
  if (!playlist.previous) {
    prevBtn.disabled = true;
    prevBtn.setAttribute('aria-disabled', 'true');
  } else {
    prevBtn.addEventListener('click', () => navigateTo(`#/lecture/${playlist.previous.id}`));
  }
  nav.appendChild(prevBtn);

  // Position indicator
  const position = createElement('span', 'sp-playlist-nav__position', {
    textContent: `Lecture ${playlist.currentIndex + 1} of ${playlist.total}`
  });
  nav.appendChild(position);

  // Next button
  const nextBtn = createElement('button', 'sp-playlist-nav__btn sp-playlist-nav__btn--next', {
    textContent: playlist.next ? `${playlist.next.title} \u2192` : 'Next \u2192'
  });
  nextBtn.setAttribute('aria-label', playlist.next ? `Next: ${playlist.next.title}` : 'Next lecture');
  if (!playlist.next) {
    nextBtn.disabled = true;
    nextBtn.setAttribute('aria-disabled', 'true');
  } else {
    nextBtn.addEventListener('click', () => navigateTo(`#/lecture/${playlist.next.id}`));
  }
  nav.appendChild(nextBtn);

  // Keyboard navigation: ArrowLeft = previous, ArrowRight = next
  // Cleanup previous listener to prevent leaks on re-render
  if (_playlistKeyHandler) {
    document.removeEventListener('keydown', _playlistKeyHandler);
  }
  _playlistKeyHandler = (e) => {
    // Guard: skip if activeElement is input/textarea/select
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return;
    }
    if (e.key === 'ArrowLeft' && playlist.previous) {
      e.preventDefault();
      navigateTo(`#/lecture/${playlist.previous.id}`);
    } else if (e.key === 'ArrowRight' && playlist.next) {
      e.preventDefault();
      navigateTo(`#/lecture/${playlist.next.id}`);
    }
  };
  document.addEventListener('keydown', _playlistKeyHandler);

  container.appendChild(nav);
}

/**
 * Render playlist minimap (dot navigation).
 * @param {HTMLElement} container
 * @param {Object} playlist
 * @param {Object[]} allLectures - All lectures in the course with watchProgress
 */
function renderPlaylistMinimap(container, playlist, allLectures) {
  const minimap = createElement('div', 'sp-playlist-minimap');
  minimap.setAttribute('role', 'group');
  minimap.setAttribute('aria-label', 'Lecture progress overview');

  const currentId = playlist.current ? playlist.current.id : null;

  allLectures.forEach((lecture, index) => {
    let dotClass = 'sp-playlist-minimap__dot';
    if (lecture.id === currentId) {
      dotClass += ' sp-playlist-minimap__dot--current';
    } else if ((lecture.watchProgress || 0) > 80) {
      dotClass += ' sp-playlist-minimap__dot--completed';
    }

    const dot = createElement('button', dotClass);
    dot.setAttribute('aria-label', `${lecture.title} (${index + 1} of ${playlist.total})`);
    dot.addEventListener('click', () => navigateTo(`#/lecture/${lecture.id}`));
    minimap.appendChild(dot);
  });

  container.appendChild(minimap);
}

/**
 * Render favorite toggle button.
 * @param {HTMLElement} container
 * @param {string} lectureId
 * @param {boolean} isFav - Current favorite state
 */
function renderFavoriteButton(container, lectureId, isFav) {
  clearElement(container);

  let debouncing = false;
  const btn = createElement('button', `sp-favorite-btn${isFav ? ' sp-favorite-btn--active' : ''}`, {
    textContent: isFav ? '\u2605' : '\u2606' // ★ or ☆
  });
  btn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
  btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');

  btn.addEventListener('click', async () => {
    if (debouncing) return;
    debouncing = true;

    try {
      const newState = await toggleFavorite(lectureId);
      btn.textContent = newState ? '\u2605' : '\u2606';
      btn.classList.toggle('sp-favorite-btn--active', newState);
      btn.setAttribute('aria-label', newState ? 'Remove from favorites' : 'Add to favorites');
      btn.setAttribute('aria-pressed', newState ? 'true' : 'false');
    } finally {
      // 200ms cooldown after async completes
      setTimeout(() => { debouncing = false; }, 200);
    }
  });

  container.appendChild(btn);
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

// Register renderers with flashcards.js router (AD-1 pattern)
setLibraryRenderer(enhancedRenderLibraryView);
setLectureDetailRenderer(renderLectureDetailView);

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // State (exposed for testing)
  libraryState,
  _resetState,

  // Course management
  loadCourses,
  createCourseDialog,
  editCourseDialog,
  deleteCourseWithConfirmation,

  // Sidebar
  renderCourseSidebar,

  // Toolbar
  renderLibraryToolbar,

  // Sorting
  sortLectures,

  // Import pipeline (Day 2)
  importFromProcessingResult,

  // Organization (Day 2)
  assignLectureToCourse,
  batchAssignCourse,
  batchDeleteLectures,

  // Context menu (Day 2)
  renderCardContextMenu,

  // Cross-lecture search (Day 3)
  SEARCH_CONFIG,
  crossLectureSearch,
  _resetSearchCache,
  scoreMatch,
  highlightTerms,
  renderSearchInput,
  renderSearchResults,
  renderSearchTabs,

  // Renderers
  enhancedRenderLibraryView,
  renderLectureDetailView,

  // Day 4: Progress tracking
  updateLectureProgress,
  getLectureStats,

  // Day 4: Detail view
  renderDetailHeader,
  renderDetailStats,
  renderDetailTabs,
  renderSegmentsList,
  renderFlashcardsList,
  renderBookmarksList,
  renderLectureInfo,

  // Day 5: Favorites
  getFavoriteIds,
  toggleFavorite,
  isFavorite,
  getFavoriteLectures,

  // Day 5: Playlist
  getPlaylistForLecture,
  renderPlaylistNav,
  renderPlaylistMinimap,
  renderFavoriteButton,

  // Day 6: Integration + Performance + Polish
  renderLibraryViewPaginated,
  initLibraryKeyboardShortcuts,
  renderCourseEmptyState,
  renderSearchEmptyState,
  renderFavoritesEmptyState
};
