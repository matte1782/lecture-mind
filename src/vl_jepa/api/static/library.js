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
  createCourse,
  createLecture,
  createSegment,
  createEvent
} from './storage/index.js';

import {
  setLibraryRenderer,
  setLectureDetailRenderer,
  navigateTo,
  createMasteryBadge,
  showToast,
  VIEWS
} from './flashcards.js';

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

  if (succeeded.length > 0) {
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
// ENHANCED LIBRARY RENDERER (registered via setLibraryRenderer)
// ============================================================================

/**
 * Enhanced library view renderer that adds sidebar + toolbar to the playground view.
 * Registered via setLibraryRenderer() on module load.
 */
async function enhancedRenderLibraryView() {
  try {
    const coursesWithCounts = await loadCourses();
    renderCourseSidebar(coursesWithCounts, libraryState.selectedCourseId, {
      totalLectures: libraryState.totalLectures,
      uncategorizedCount: libraryState.uncategorizedCount,
      favoritesCount: libraryState.favoritesCount
    });
    renderLibraryToolbar(libraryState.sortBy, libraryState.viewMode);
  } catch (err) {
    showToast('error', 'Error', 'Failed to load library');
  }
}

/**
 * Lecture detail view renderer placeholder.
 * @param {string} lectureId
 */
async function renderLectureDetailView(lectureId) {
  const header = document.getElementById('lecture-detail-header');
  if (!header) return;

  clearElement(header);
  const title = createElement('h2', 'sp-detail-title', { textContent: 'Loading...' });
  header.appendChild(title);

  try {
    const lecture = await LectureRepository.getById(lectureId);
    if (lecture) {
      title.textContent = lecture.title;
    } else {
      title.textContent = 'Lecture not found';
    }
  } catch (_err) {
    title.textContent = 'Error loading lecture';
  }
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

  // Renderers
  enhancedRenderLibraryView,
  renderLectureDetailView
};
