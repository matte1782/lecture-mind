/**
 * @fileoverview Tests for Library module (Week 12 Days 1-2).
 * Day 1: Course management, sidebar rendering, toolbar, sorting.
 * Day 2: Import pipeline, course assignment, context menu.
 * TDD: tests written before implementation.
 */

import { jest } from '@jest/globals';
import { closeDatabase, deleteDatabase } from './storage/db.js';
import {
  CourseRepository,
  LectureRepository,
  SegmentRepository,
  EventRepository,
  SettingsRepository,
  FlashcardRepository,
  BookmarkRepository,
  ProgressRepository,
  createCourse,
  createLecture,
  createSegment,
  createFlashcard,
  createBookmark,
  FLASHCARD_STATUS
} from './storage/index.js';

import {
  loadCourses,
  createCourseDialog,
  editCourseDialog,
  deleteCourseWithConfirmation,
  renderCourseSidebar,
  renderLibraryToolbar,
  sortLectures,
  importFromProcessingResult,
  assignLectureToCourse,
  batchAssignCourse,
  batchDeleteLectures,
  renderCardContextMenu,
  libraryState,
  _resetState,
  crossLectureSearch,
  _resetSearchCache,
  scoreMatch,
  highlightTerms,
  renderSearchInput,
  renderSearchResults,
  renderSearchTabs,
  SEARCH_CONFIG,
  // Day 4: Progress + Detail View
  updateLectureProgress,
  getLectureStats,
  renderLectureDetailView,
  renderDetailHeader,
  renderDetailStats,
  renderDetailTabs,
  renderSegmentsList,
  renderFlashcardsList,
  renderBookmarksList,
  renderLectureInfo,
  // Day 5: Favorites + Playlist
  getFavoriteIds,
  toggleFavorite,
  isFavorite,
  getFavoriteLectures,
  getPlaylistForLecture,
  renderPlaylistNav,
  renderFavoriteButton,
  // Day 6: Integration + Performance
  renderLibraryViewPaginated,
  initLibraryKeyboardShortcuts,
  renderCourseEmptyState,
  renderSearchEmptyState,
  renderFavoritesEmptyState,
  enhancedRenderLibraryView
} from './library.js';

// ============================================================================
// TEST SETUP
// ============================================================================

function setupTestDOM() {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }

  const app = document.createElement('div');
  app.id = 'app';

  // Toast container
  const toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  app.appendChild(toastContainer);

  // Playground view structure
  const playgroundView = document.createElement('section');
  playgroundView.id = 'playground-view';
  const sectionContainer = document.createElement('div');
  sectionContainer.className = 'section-container';

  const toolbar = document.createElement('div');
  toolbar.id = 'library-toolbar';
  toolbar.className = 'sp-library-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  sectionContainer.appendChild(toolbar);

  const layout = document.createElement('div');
  layout.className = 'sp-library-layout';

  const sidebar = document.createElement('aside');
  sidebar.id = 'library-sidebar';
  sidebar.className = 'sp-library-sidebar';
  sidebar.setAttribute('role', 'navigation');
  layout.appendChild(sidebar);

  const main = document.createElement('div');
  main.id = 'library-main';
  main.className = 'sp-library-main';

  const grid = document.createElement('div');
  grid.id = 'library-grid';
  grid.className = 'sp-card-grid';
  grid.setAttribute('role', 'list');
  main.appendChild(grid);

  const emptyState = document.createElement('div');
  emptyState.id = 'library-empty';
  emptyState.className = 'empty-state hidden';
  main.appendChild(emptyState);

  layout.appendChild(main);
  sectionContainer.appendChild(layout);
  playgroundView.appendChild(sectionContainer);
  app.appendChild(playgroundView);

  // Lecture detail view structure (Day 4)
  const detailView = document.createElement('section');
  detailView.id = 'lecture-detail-view';
  const detailContainer = document.createElement('div');
  detailContainer.className = 'section-container';
  const detailHeader = document.createElement('div');
  detailHeader.id = 'lecture-detail-header';
  detailContainer.appendChild(detailHeader);
  const detailContent = document.createElement('div');
  detailContent.id = 'lecture-detail-content';
  detailContainer.appendChild(detailContent);
  detailView.appendChild(detailContainer);
  app.appendChild(detailView);

  document.body.appendChild(app);
}

beforeEach(async () => {
  setupTestDOM();
  _resetState();
  _resetSearchCache();
});

afterEach(async () => {
  await closeDatabase();
  await deleteDatabase();
});

// ============================================================================
// COURSE MANAGEMENT
// ============================================================================

describe('Course Management', () => {
  test('loadCourses returns courses with lecture counts — single pass, no N+1', async () => {
    const course1 = await CourseRepository.create(createCourse({ name: 'Math 101' }));
    const course2 = await CourseRepository.create(createCourse({ name: 'Physics 201' }));
    await LectureRepository.create(createLecture({ title: 'Lecture 1', courseId: course1.id }));
    await LectureRepository.create(createLecture({ title: 'Lecture 2', courseId: course1.id }));
    await LectureRepository.create(createLecture({ title: 'Lecture 3', courseId: course2.id }));

    const result = await loadCourses();

    expect(result).toHaveLength(2);
    const math = result.find(r => r.course.name === 'Math 101');
    const physics = result.find(r => r.course.name === 'Physics 201');
    expect(math.lectureCount).toBe(2);
    expect(physics.lectureCount).toBe(1);
  });

  test('loadCourses handles empty database', async () => {
    const result = await loadCourses();
    expect(result).toEqual([]);
  });

  test('loadCourses counts uncategorized lectures (courseId === null)', async () => {
    await LectureRepository.create(createLecture({ title: 'Orphan Lecture' }));
    await LectureRepository.create(createLecture({ title: 'Orphan Lecture 2' }));
    const course = await CourseRepository.create(createCourse({ name: 'CS 101' }));
    await LectureRepository.create(createLecture({ title: 'Assigned', courseId: course.id }));

    const result = await loadCourses();

    // loadCourses caches uncategorized count in libraryState
    expect(libraryState.uncategorizedCount).toBe(2);
    expect(result).toHaveLength(1);
    expect(result[0].lectureCount).toBe(1);
  });

  test('createCourseDialog validates name required', async () => {
    const dialog = createCourseDialog();
    const container = document.createElement('div');
    container.appendChild(dialog);
    document.body.appendChild(container);

    // Find the save button and name input
    const saveBtn = dialog.querySelector('[data-action="save"]');
    const nameInput = dialog.querySelector('[data-field="name"]');

    expect(nameInput).not.toBeNull();
    expect(saveBtn).not.toBeNull();

    // Leave name empty, click save
    nameInput.value = '';
    saveBtn.click();

    // Should show validation error
    const errorEl = dialog.querySelector('.sp-dialog-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toMatch(/name/i);
  });

  test('createCourseDialog creates course via CourseRepository.create', async () => {
    const dialog = createCourseDialog();
    document.body.appendChild(dialog);

    const nameInput = dialog.querySelector('[data-field="name"]');
    const descInput = dialog.querySelector('[data-field="description"]');
    const saveBtn = dialog.querySelector('[data-action="save"]');

    nameInput.value = 'New Course';
    descInput.value = 'A test course';

    // Simulate save - returns a promise
    const savePromise = new Promise(resolve => {
      dialog.addEventListener('course-saved', resolve, { once: true });
    });
    saveBtn.click();

    await savePromise;

    const courses = await CourseRepository.getAll();
    expect(courses).toHaveLength(1);
    expect(courses[0].name).toBe('New Course');
    expect(courses[0].description).toBe('A test course');
  });

  test('editCourseDialog pre-fills form fields', async () => {
    const course = await CourseRepository.create(createCourse({
      name: 'Existing Course',
      description: 'Some description',
      color: '#ff0000'
    }));

    const dialog = editCourseDialog(course.id);
    document.body.appendChild(dialog);

    // Wait for async population
    await new Promise(resolve => setTimeout(resolve, 50));

    const nameInput = dialog.querySelector('[data-field="name"]');
    const descInput = dialog.querySelector('[data-field="description"]');

    expect(nameInput.value).toBe('Existing Course');
    expect(descInput.value).toBe('Some description');
  });

  test('deleteCourseWithConfirmation — "delete only" orphans lectures', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'To Delete' }));
    const lec1 = await LectureRepository.create(createLecture({ title: 'L1', courseId: course.id }));
    const lec2 = await LectureRepository.create(createLecture({ title: 'L2', courseId: course.id }));

    // Mock confirm to return "delete only" (first option)
    await deleteCourseWithConfirmation(course.id, 'orphan');

    // Course should be deleted
    const courses = await CourseRepository.getAll();
    expect(courses).toHaveLength(0);

    // Lectures should still exist but with courseId = null
    const lectures = await LectureRepository.getAll();
    expect(lectures).toHaveLength(2);
    expect(lectures.every(l => l.courseId === null)).toBe(true);
  });

  test('deleteCourseWithConfirmation — "delete all" cascades', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'To Delete' }));
    await LectureRepository.create(createLecture({ title: 'L1', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'L2', courseId: course.id }));

    await deleteCourseWithConfirmation(course.id, 'cascade');

    const courses = await CourseRepository.getAll();
    expect(courses).toHaveLength(0);

    const lectures = await LectureRepository.getAll();
    expect(lectures).toHaveLength(0);
  });
});

// ============================================================================
// COURSE SIDEBAR
// ============================================================================

describe('Course Sidebar', () => {
  test('renderCourseSidebar shows "All Lectures" first', async () => {
    const sidebar = document.getElementById('library-sidebar');
    const courses = [
      { course: createCourse({ name: 'Course A' }), lectureCount: 3 }
    ];

    renderCourseSidebar(courses, null, { totalLectures: 5, uncategorizedCount: 2, favoritesCount: 1 });

    const items = sidebar.querySelectorAll('button');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].textContent).toMatch(/all lectures/i);
  });

  test('renderCourseSidebar shows "Favorites" item', async () => {
    const sidebar = document.getElementById('library-sidebar');
    renderCourseSidebar([], null, { totalLectures: 3, uncategorizedCount: 0, favoritesCount: 2 });

    const buttons = Array.from(sidebar.querySelectorAll('button'));
    const favBtn = buttons.find(b => b.textContent.match(/favorites/i));
    expect(favBtn).toBeTruthy();
    expect(favBtn.textContent).toMatch(/2/);
  });

  test('renderCourseSidebar shows "Uncategorized" with count', async () => {
    const sidebar = document.getElementById('library-sidebar');
    renderCourseSidebar([], null, { totalLectures: 5, uncategorizedCount: 3, favoritesCount: 0 });

    const buttons = Array.from(sidebar.querySelectorAll('button'));
    const uncatBtn = buttons.find(b => b.textContent.match(/uncategorized/i));
    expect(uncatBtn).toBeTruthy();
    expect(uncatBtn.textContent).toMatch(/3/);
  });

  test('renderCourseSidebar marks active item with aria-current', async () => {
    const sidebar = document.getElementById('library-sidebar');
    const course1 = createCourse({ name: 'Active Course' });
    const courses = [{ course: course1, lectureCount: 2 }];

    renderCourseSidebar(courses, course1.id, { totalLectures: 2, uncategorizedCount: 0, favoritesCount: 0 });

    const activeItem = sidebar.querySelector('[aria-current="true"]');
    expect(activeItem).not.toBeNull();
    expect(activeItem.textContent).toMatch(/Active Course/);
  });

  test('clicking sidebar item updates libraryState.selectedCourseId', async () => {
    const sidebar = document.getElementById('library-sidebar');
    const course1 = createCourse({ name: 'Clickable Course' });
    const courses = [{ course: course1, lectureCount: 1 }];

    renderCourseSidebar(courses, null, { totalLectures: 1, uncategorizedCount: 0, favoritesCount: 0 });

    // Find the course button and click it
    const buttons = Array.from(sidebar.querySelectorAll('button'));
    const courseBtn = buttons.find(b => b.textContent.match(/Clickable Course/));
    expect(courseBtn).toBeTruthy();

    courseBtn.click();
    expect(libraryState.selectedCourseId).toBe(course1.id);
  });
});

// ============================================================================
// LIBRARY TOOLBAR
// ============================================================================

describe('Library Toolbar', () => {
  test('renderLibraryToolbar renders sort <select>', () => {
    const toolbar = document.getElementById('library-toolbar');
    renderLibraryToolbar('recent', 'grid');

    const select = toolbar.querySelector('select');
    expect(select).not.toBeNull();
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('recent');
    expect(options).toContain('title');
    expect(options).toContain('progress');
  });

  test('renderLibraryToolbar renders view toggle', () => {
    const toolbar = document.getElementById('library-toolbar');
    renderLibraryToolbar('recent', 'grid');

    const toggleContainer = toolbar.querySelector('.sp-library-toolbar__view-toggle');
    expect(toggleContainer).not.toBeNull();
    const buttons = toggleContainer.querySelectorAll('button');
    expect(buttons.length).toBe(2); // grid and list
  });

  test('sort change triggers re-render', () => {
    const toolbar = document.getElementById('library-toolbar');
    renderLibraryToolbar('recent', 'grid');

    const select = toolbar.querySelector('select');
    select.value = 'title';
    select.dispatchEvent(new Event('change'));

    expect(libraryState.sortBy).toBe('title');
  });
});

// ============================================================================
// SORTING
// ============================================================================

describe('Sorting', () => {
  test('sortLectures by recent uses updatedAt desc', () => {
    const lectures = [
      { title: 'Old', updatedAt: 1000, createdAt: 500 },
      { title: 'New', updatedAt: 3000, createdAt: 2000 },
      { title: 'Mid', updatedAt: 2000, createdAt: 1500 }
    ];

    const sorted = sortLectures(lectures, 'recent');
    expect(sorted[0].title).toBe('New');
    expect(sorted[1].title).toBe('Mid');
    expect(sorted[2].title).toBe('Old');
  });

  test('sortLectures by progress uses watchProgress desc', () => {
    const lectures = [
      { title: 'Low', watchProgress: 10, updatedAt: 1000 },
      { title: 'High', watchProgress: 90, updatedAt: 2000 },
      { title: 'Mid', watchProgress: 50, updatedAt: 1500 }
    ];

    const sorted = sortLectures(lectures, 'progress');
    expect(sorted[0].title).toBe('High');
    expect(sorted[1].title).toBe('Mid');
    expect(sorted[2].title).toBe('Low');
  });

  test('sortLectures by title uses localeCompare', () => {
    const lectures = [
      { title: 'Zebra Lecture', updatedAt: 1000 },
      { title: 'Apple Lecture', updatedAt: 2000 },
      { title: 'Mango Lecture', updatedAt: 1500 }
    ];

    const sorted = sortLectures(lectures, 'title');
    expect(sorted[0].title).toBe('Apple Lecture');
    expect(sorted[1].title).toBe('Mango Lecture');
    expect(sorted[2].title).toBe('Zebra Lecture');
  });
});

// ============================================================================
// DAY 2: IMPORT PIPELINE
// ============================================================================

describe('Import Pipeline', () => {
  const makeProcessingResult = (overrides = {}) => ({
    metadata: { filename: 'lecture_01.mp4', duration: 3600, ...overrides.metadata },
    transcript: overrides.transcript || [
      { text: 'Hello class', startTime: 0, endTime: 10 },
      { text: 'Today we discuss AI', startTime: 10, endTime: 25 }
    ],
    events: overrides.events || [
      { type: 'slide_change', timestamp: 5 },
      { type: 'speaker_change', timestamp: 15 }
    ]
  });

  test('importFromProcessingResult creates lecture', async () => {
    const result = makeProcessingResult();
    const lecture = await importFromProcessingResult(result, 'job-001');

    expect(lecture).toBeDefined();
    expect(lecture.title).toBe('lecture_01.mp4');
    expect(lecture.duration).toBe(3600);
    expect(lecture.status).toBe('completed');
  });

  test('importFromProcessingResult creates segments with metadata.text', async () => {
    const result = makeProcessingResult();
    const lecture = await importFromProcessingResult(result, 'job-002');

    const segments = await SegmentRepository.getByLecture(lecture.id);
    expect(segments).toHaveLength(2);
    expect(segments[0].metadata.text).toBe('Hello class');
    expect(segments[1].metadata.text).toBe('Today we discuss AI');
  });

  test('importFromProcessingResult creates events', async () => {
    const result = makeProcessingResult();
    const lecture = await importFromProcessingResult(result, 'job-003');

    const events = await EventRepository.getByLecture(lecture.id);
    expect(events).toHaveLength(2);
    const types = events.map(e => e.type).sort();
    expect(types).toEqual(['slide_change', 'speaker_change']);
  });

  test('importFromProcessingResult is idempotent (dedup by jobId)', async () => {
    const result = makeProcessingResult();
    const lecture1 = await importFromProcessingResult(result, 'job-004');
    const lecture2 = await importFromProcessingResult(result, 'job-004');

    expect(lecture2.id).toBe(lecture1.id);

    // Should not create duplicate lectures
    const allLectures = await LectureRepository.getAll();
    const matching = allLectures.filter(l => l.title === 'lecture_01.mp4');
    expect(matching).toHaveLength(1);
  });

  test('importFromProcessingResult handles missing metadata gracefully', async () => {
    const result = { transcript: [], events: [] };
    const lecture = await importFromProcessingResult(result, 'job-005');

    expect(lecture.title).toBe('Untitled');
    expect(lecture.duration).toBe(0);
  });

  test('importFromProcessingResult sets status to completed', async () => {
    const result = makeProcessingResult();
    const lecture = await importFromProcessingResult(result, 'job-006');

    expect(lecture.status).toBe('completed');
  });
});

// ============================================================================
// DAY 2: COURSE ASSIGNMENT
// ============================================================================

describe('Course Assignment', () => {
  test('assignLectureToCourse updates courseId', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'CS 101' }));
    const lecture = await LectureRepository.create(createLecture({ title: 'Lec 1' }));

    await assignLectureToCourse(lecture.id, course.id);

    const updated = await LectureRepository.getById(lecture.id);
    expect(updated.courseId).toBe(course.id);
  });

  test('assignLectureToCourse with null uncategorizes', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'CS 101' }));
    const lecture = await LectureRepository.create(createLecture({ title: 'Lec 1', courseId: course.id }));

    await assignLectureToCourse(lecture.id, null);

    const updated = await LectureRepository.getById(lecture.id);
    expect(updated.courseId).toBeNull();
  });

  test('batchAssignCourse updates all lectures', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'Batch Course' }));
    const lec1 = await LectureRepository.create(createLecture({ title: 'L1' }));
    const lec2 = await LectureRepository.create(createLecture({ title: 'L2' }));

    const result = await batchAssignCourse([lec1.id, lec2.id], course.id);

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(0);

    const updated1 = await LectureRepository.getById(lec1.id);
    const updated2 = await LectureRepository.getById(lec2.id);
    expect(updated1.courseId).toBe(course.id);
    expect(updated2.courseId).toBe(course.id);
  });

  test('batchAssignCourse reports partial failures', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'C' }));
    const lec1 = await LectureRepository.create(createLecture({ title: 'L1' }));

    const result = await batchAssignCourse([lec1.id, 'nonexistent-id'], course.id);

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toBe('nonexistent-id');
  });

  test('batchDeleteLectures cascades correctly', async () => {
    const lec1 = await LectureRepository.create(createLecture({ title: 'L1' }));
    const lec2 = await LectureRepository.create(createLecture({ title: 'L2' }));

    const result = await batchDeleteLectures([lec1.id, lec2.id]);

    expect(result.succeeded).toHaveLength(2);
    const remaining = await LectureRepository.getAll();
    expect(remaining).toHaveLength(0);
  });

  test('batchDeleteLectures handles partial failure', async () => {
    const lec1 = await LectureRepository.create(createLecture({ title: 'L1' }));

    const result = await batchDeleteLectures([lec1.id, 'nonexistent-id']);

    // The existing lecture should be deleted, nonexistent should fail
    expect(result.succeeded.length + result.failed.length).toBe(2);
  });
});

// ============================================================================
// DAY 2: CONTEXT MENU
// ============================================================================

describe('Context Menu', () => {
  test('renderCardContextMenu has role="menu"', () => {
    const lecture = { id: 'lec-1', title: 'Test' };
    const menu = renderCardContextMenu(lecture, [], { x: 100, y: 200 }, () => {});

    expect(menu.getAttribute('role')).toBe('menu');
  });

  test('renderCardContextMenu items have role="menuitem"', () => {
    const lecture = { id: 'lec-1', title: 'Test' };
    const menu = renderCardContextMenu(lecture, [], { x: 100, y: 200 }, () => {});

    const items = menu.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  test('Escape dismisses context menu', () => {
    const lecture = { id: 'lec-1', title: 'Test' };
    const menu = renderCardContextMenu(lecture, [], { x: 100, y: 200 }, () => {});
    document.body.appendChild(menu);

    expect(document.body.contains(menu)).toBe(true);

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.body.contains(menu)).toBe(false);
  });

  test('outside click dismisses context menu', async () => {
    const lecture = { id: 'lec-1', title: 'Test' };
    const menu = renderCardContextMenu(lecture, [], { x: 100, y: 200 }, () => {});
    document.body.appendChild(menu);

    expect(document.body.contains(menu)).toBe(true);

    // Wait for requestAnimationFrame to register the outside click listener
    await new Promise(r => setTimeout(r, 50));

    // Click outside
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(document.body.contains(menu)).toBe(false);
  });
});

// ============================================================================
// DAY 3: SEARCH ENGINE
// ============================================================================

/**
 * Seed helper: creates 2 lectures, 2 segments, 2 flashcards, 2 bookmarks.
 * Returns { lectures, segments, flashcards, bookmarks }.
 */
async function seedSearchData() {
  const lec1 = await LectureRepository.create(createLecture({ title: 'Machine Learning Basics' }));
  const lec2 = await LectureRepository.create(createLecture({ title: 'Deep Neural Networks' }));

  const seg1 = await SegmentRepository.create(createSegment({
    lectureId: lec1.id, startTime: 0, endTime: 10, type: 'transcript',
    metadata: { text: 'Introduction to supervised learning algorithms' }
  }));
  const seg2 = await SegmentRepository.create(createSegment({
    lectureId: lec2.id, startTime: 0, endTime: 15, type: 'transcript',
    metadata: { text: 'Backpropagation and gradient descent optimization' }
  }));

  const fc1 = await FlashcardRepository.create(createFlashcard({
    lectureId: lec1.id, front: 'What is supervised learning?',
    back: 'Learning from labeled training data'
  }));
  const fc2 = await FlashcardRepository.create(createFlashcard({
    lectureId: lec2.id, front: 'Define backpropagation',
    back: 'Algorithm for computing gradients in neural networks'
  }));

  const bk1 = await BookmarkRepository.create(createBookmark({
    lectureId: lec1.id, timestamp: 5, label: 'Key concept: supervised learning'
  }));
  const bk2 = await BookmarkRepository.create(createBookmark({
    lectureId: lec2.id, timestamp: 10, label: ''
  }));

  return {
    lectures: [lec1, lec2],
    segments: [seg1, seg2],
    flashcards: [fc1, fc2],
    bookmarks: [bk1, bk2]
  };
}

describe('Search Engine', () => {
  test('returns empty for query < MIN_QUERY_LENGTH', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('a');
    expect(results.segments).toEqual([]);
    expect(results.flashcards).toEqual([]);
    expect(results.bookmarks).toEqual([]);
    expect(results.totalCount).toBe(0);
  });

  test('finds segments by metadata.text', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('supervised learning');
    expect(results.segments.length).toBeGreaterThanOrEqual(1);
    const texts = results.segments.map(r => r.text);
    expect(texts.some(t => t.includes('supervised learning'))).toBe(true);
  });

  test('finds flashcards by front text', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('supervised learning');
    expect(results.flashcards.length).toBeGreaterThanOrEqual(1);
  });

  test('finds flashcards by back text', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('labeled training');
    expect(results.flashcards.length).toBeGreaterThanOrEqual(1);
  });

  test('finds bookmarks by label (non-empty only)', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('supervised');
    expect(results.bookmarks.length).toBeGreaterThanOrEqual(1);
    expect(results.bookmarks[0].text).toMatch(/supervised/i);
  });

  test('skips bookmarks with empty label', async () => {
    await seedSearchData();
    // lec2's bookmark has empty label — searching for anything about lec2
    // should not return a bookmark result for the empty-label one
    const results = await crossLectureSearch('backpropagation');
    const bkLabels = results.bookmarks.map(r => r.text);
    expect(bkLabels.every(l => l.length > 0)).toBe(true);
  });

  test('returns results grouped by type with totalCount', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('supervised learning');
    expect(results).toHaveProperty('segments');
    expect(results).toHaveProperty('flashcards');
    expect(results).toHaveProperty('bookmarks');
    expect(results).toHaveProperty('totalCount');
    expect(results.totalCount).toBe(
      results.segments.length + results.flashcards.length + results.bookmarks.length
    );
  });

  test('limits results to MAX_RESULTS', async () => {
    // Create more than MAX_RESULTS segments
    const lec = await LectureRepository.create(createLecture({ title: 'Big Lecture' }));
    for (let i = 0; i < SEARCH_CONFIG.MAX_RESULTS + 10; i++) {
      await SegmentRepository.create(createSegment({
        lectureId: lec.id, startTime: i, endTime: i + 1, type: 'transcript',
        metadata: { text: `unique searchterm segment number ${i}` }
      }));
    }
    _resetSearchCache();
    const results = await crossLectureSearch('unique searchterm');
    expect(results.totalCount).toBeLessThanOrEqual(SEARCH_CONFIG.MAX_RESULTS);
  });

  test('multi-term requires ALL terms present in text', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('supervised gradient');
    // No single item has BOTH "supervised" AND "gradient"
    expect(results.segments).toHaveLength(0);
    expect(results.flashcards).toHaveLength(0);
  });

  test('regex special chars in query do not crash', async () => {
    await seedSearchData();
    const results = await crossLectureSearch('test.*+?^${}()|[]\\');
    expect(results.totalCount).toBe(0);
    // No error thrown
  });

  test('finds text containing regex metacharacters literally', async () => {
    const lec = await LectureRepository.create(createLecture({ title: 'JS Course' }));
    await SegmentRepository.create(createSegment({
      lectureId: lec.id, startTime: 0, endTime: 5, type: 'transcript',
      metadata: { text: 'Introduction to test.js framework' }
    }));
    _resetSearchCache();
    const results = await crossLectureSearch('test.js');
    expect(results.segments.length).toBeGreaterThanOrEqual(1);
    expect(results.segments[0].text).toContain('test.js');
  });
});

// ============================================================================
// DAY 3: SCORING + HIGHLIGHTING
// ============================================================================

describe('Scoring + Highlighting', () => {
  test('exact phrase scores highest', () => {
    const exact = scoreMatch('Introduction to supervised learning algorithms', ['supervised', 'learning'], 'supervised learning');
    const partial = scoreMatch('supervised techniques and deep learning', ['supervised', 'learning'], 'supervised learning');
    expect(exact).toBeGreaterThan(partial);
  });

  test('highlightTerms creates safe DOM spans — no innerHTML', () => {
    const container = document.createElement('div');
    highlightTerms(container, 'hello world hello', ['hello']);

    // Should have children (text nodes + spans), no innerHTML usage
    expect(container.childNodes.length).toBeGreaterThan(0);

    const spans = container.querySelectorAll('.sp-search-highlight');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('hello');
    expect(spans[1].textContent).toBe('hello');

    // Verify no innerHTML was used — container should not have raw HTML
    expect(container.innerHTML).not.toContain('<script');
  });

  test('highlightTerms handles multiple occurrences', () => {
    const container = document.createElement('div');
    highlightTerms(container, 'the cat sat on the mat', ['the']);

    const spans = container.querySelectorAll('.sp-search-highlight');
    expect(spans.length).toBe(2);
  });
});

// ============================================================================
// DAY 3: SEARCH UI
// ============================================================================

describe('Search UI', () => {
  test('renderSearchTabs has role="tablist" with aria-selected', () => {
    const container = document.createElement('div');
    renderSearchTabs(container, 'all', { all: 10, segments: 5, flashcards: 3, bookmarks: 2 });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();

    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(4);

    const activeTab = tablist.querySelector('[aria-selected="true"]');
    expect(activeTab).not.toBeNull();
    expect(activeTab.textContent).toMatch(/all/i);
  });

  test('renderSearchTabs keyboard: ArrowRight switches tab', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let lastTab = null;
    renderSearchTabs(container, 'all', { all: 10, segments: 5, flashcards: 3, bookmarks: 2 }, (tab) => { lastTab = tab; });

    const tablist = container.querySelector('[role="tablist"]');
    const tabs = tablist.querySelectorAll('[role="tab"]');

    // Focus first tab (must be in document for jsdom focus)
    tabs[0].focus();
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(lastTab).toBe('segments');
  });

  test('renderSearchInput debounces input', async () => {
    jest.useFakeTimers();
    const container = document.createElement('div');
    let searchCalled = 0;
    renderSearchInput(container, (query) => { searchCalled++; });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    // Type multiple times quickly
    input.value = 'a';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'ab';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Before debounce fires
    expect(searchCalled).toBe(0);

    // Advance past debounce
    jest.advanceTimersByTime(SEARCH_CONFIG.DEBOUNCE_MS + 50);

    expect(searchCalled).toBe(1);
    jest.useRealTimers();
  });

  test('renderSearchInput clear button resets', () => {
    const container = document.createElement('div');
    let lastQuery = 'not-cleared';
    renderSearchInput(container, (query) => { lastQuery = query; });

    const input = container.querySelector('input');
    input.value = 'test query';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const clearBtn = container.querySelector('.sp-search-input-wrapper__clear');
    expect(clearBtn).not.toBeNull();

    clearBtn.click();
    expect(input.value).toBe('');
    expect(lastQuery).toBe('');
  });

  test('search results show parent lecture title', async () => {
    const { lectures } = await seedSearchData();
    const lectureMap = new Map(lectures.map(l => [l.id, l.title]));

    const results = await crossLectureSearch('supervised learning');
    const container = document.createElement('div');
    renderSearchResults(container, results, 'supervised learning', lectureMap);

    const lectureLabels = container.querySelectorAll('.sp-search-result__lecture');
    expect(lectureLabels.length).toBeGreaterThan(0);
    expect(lectureLabels[0].textContent).toMatch(/Machine Learning Basics/);
  });
});

// ============================================================================
// DAY 4: PROGRESS TRACKING
// ============================================================================

describe('Progress Tracking', () => {
  test('updateLectureProgress calls updatePosition + markSegmentCompleted', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Progress Test' }));
    const seg1 = await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 0, endTime: 60, type: 'topic'
    }));
    const seg2 = await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 60, endTime: 120, type: 'topic'
    }));

    await updateLectureProgress(lecture.id, seg1.id, 30);

    const progress = await ProgressRepository.getOrCreate(lecture.id);
    expect(progress.lastPosition).toBe(30);
    expect(progress.completedSegments).toContain(seg1.id);
    expect(progress.completedSegments).not.toContain(seg2.id);
  });

  test('updateLectureProgress calculates percentage correctly', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Percent Test' }));
    const seg1 = await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 0, endTime: 60, type: 'topic'
    }));
    const seg2 = await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 60, endTime: 120, type: 'topic'
    }));

    await updateLectureProgress(lecture.id, seg1.id, 55);
    let updated = await LectureRepository.getById(lecture.id);
    expect(updated.watchProgress).toBe(50); // 1/2 segments = 50%

    await updateLectureProgress(lecture.id, seg2.id, 115);
    updated = await LectureRepository.getById(lecture.id);
    expect(updated.watchProgress).toBe(100); // 2/2 segments = 100%
  });

  test('updateLectureProgress handles 0 segments (no division by zero)', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Empty Segments' }));
    // No segments created — should not throw and should set 0%
    await updateLectureProgress(lecture.id, 'nonexistent-seg', 10);

    const updated = await LectureRepository.getById(lecture.id);
    expect(updated.watchProgress).toBe(0);
  });

  test('getLectureStats returns complete aggregate', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Stats Lecture' }));
    await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 0, endTime: 60, type: 'topic'
    }));
    await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 60, endTime: 120, type: 'topic'
    }));
    await FlashcardRepository.create(createFlashcard({
      lectureId: lecture.id, front: 'Q1', back: 'A1'
    }));
    await FlashcardRepository.create(createFlashcard({
      lectureId: lecture.id, front: 'Q2', back: 'A2',
      status: FLASHCARD_STATUS.MASTERED
    }));
    await BookmarkRepository.create(createBookmark({
      lectureId: lecture.id, timestamp: 30, label: 'Important'
    }));

    const stats = await getLectureStats(lecture.id);
    expect(stats.segmentCount).toBe(2);
    expect(stats.completedSegmentCount).toBe(0);
    expect(stats.progressPercent).toBe(0);
    expect(stats.flashcardCount).toBe(2);
    expect(stats.masteredCount).toBe(1);
    expect(stats.bookmarkCount).toBe(1);
    expect(stats.lastPosition).toBe(0);
    expect(stats.lastStudied).toBeDefined();
  });

  test('getLectureStats uses getOrCreate (not getByLecture) for progress', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Fresh Lecture' }));
    // No progress record exists yet — getOrCreate should create one
    const stats = await getLectureStats(lecture.id);

    expect(stats.progressPercent).toBe(0);
    expect(stats.lastPosition).toBe(0);
    // Verify progress record was created
    const progress = await ProgressRepository.getOrCreate(lecture.id);
    expect(progress).toBeDefined();
    expect(progress.lectureId).toBe(lecture.id);
  });
});

// ============================================================================
// DAY 4: DETAIL VIEW
// ============================================================================

describe('Detail View', () => {
  test('renderLectureDetailView shows lecture title', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Detail Title Test' }));
    await renderLectureDetailView(lecture.id);

    const header = document.getElementById('lecture-detail-header');
    expect(header.textContent).toContain('Detail Title Test');
  });

  test('renderLectureDetailView shows back button', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Back Button Test' }));
    await renderLectureDetailView(lecture.id);

    const detailView = document.getElementById('lecture-detail-view');
    const backBtn = detailView.querySelector('[class*="back"]') ||
                    detailView.querySelector('button');
    expect(backBtn).not.toBeNull();
    expect(backBtn.textContent).toMatch(/library|back/i);
  });

  test('renderDetailStats shows 4 stat cards', () => {
    const stats = {
      segmentCount: 10, completedSegmentCount: 5, progressPercent: 50,
      flashcardCount: 8, flashcardsDue: 3, masteredCount: 2,
      bookmarkCount: 4, lastPosition: 120, lastStudied: Date.now()
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderDetailStats(container, stats);

    const cards = container.querySelectorAll('.sp-detail-stat');
    expect(cards.length).toBe(4);
  });

  test('renderDetailStats shows 0% for empty lecture', () => {
    const stats = {
      segmentCount: 0, completedSegmentCount: 0, progressPercent: 0,
      flashcardCount: 0, flashcardsDue: 0, masteredCount: 0,
      bookmarkCount: 0, lastPosition: 0, lastStudied: null
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderDetailStats(container, stats);

    const values = container.querySelectorAll('.sp-detail-stat__value');
    const progressValue = Array.from(values).find(v => v.textContent.includes('%'));
    expect(progressValue).toBeDefined();
    expect(progressValue.textContent).toContain('0%');
  });

  test('tab switching renders correct content', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    let activeTab = 'segments';
    const tabs = renderDetailTabs(container, activeTab);
    const tabElements = container.querySelectorAll('[role="tab"]');

    // Find flashcards tab and click it
    const flashcardsTab = Array.from(tabElements).find(t =>
      t.textContent.toLowerCase().includes('flashcard')
    );
    expect(flashcardsTab).toBeDefined();

    // Clicking should invoke a callback or update active state
    flashcardsTab.click();
    const selectedTab = container.querySelector('[aria-selected="true"]');
    expect(selectedTab.textContent.toLowerCase()).toContain('flashcard');
  });

  test('tab bar has ARIA tablist/tab roles', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderDetailTabs(container, 'segments');

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(4);

    // Active tab has tabindex 0, others -1
    const activeTab = container.querySelector('[aria-selected="true"]');
    expect(activeTab).not.toBeNull();
    expect(activeTab.getAttribute('tabindex')).toBe('0');

    const inactiveTabs = Array.from(tabs).filter(t => t.getAttribute('aria-selected') !== 'true');
    inactiveTabs.forEach(tab => {
      expect(tab.getAttribute('tabindex')).toBe('-1');
    });
  });
});

// ============================================================================
// DAY 4: ENTITY LISTS
// ============================================================================

describe('Entity Lists', () => {
  test('renderSegmentsList shows all segments with time ranges', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Segments Lecture' }));
    await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 0, endTime: 60, type: 'intro',
      metadata: { text: 'Introduction segment' }
    }));
    await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 60, endTime: 180, type: 'topic',
      metadata: { text: 'Main topic' }
    }));

    const container = document.createElement('div');
    document.body.appendChild(container);
    await renderSegmentsList(container, lecture.id);

    const items = container.querySelectorAll('.sp-segment-item');
    expect(items.length).toBe(2);

    // Check time range text is present (e.g. "0:00" or "1:00")
    expect(container.textContent).toMatch(/0:00/);
    expect(container.textContent).toMatch(/1:00/);
  });

  test('renderSegmentsList marks completed with checkmark', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Completed Seg' }));
    const seg1 = await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 0, endTime: 60, type: 'topic'
    }));
    await SegmentRepository.create(createSegment({
      lectureId: lecture.id, startTime: 60, endTime: 120, type: 'topic'
    }));

    // Mark first segment as completed
    await ProgressRepository.markSegmentCompleted(lecture.id, seg1.id);

    const container = document.createElement('div');
    document.body.appendChild(container);
    await renderSegmentsList(container, lecture.id);

    const completedItems = container.querySelectorAll('.sp-segment-item--completed');
    expect(completedItems.length).toBe(1);
  });

  test('renderFlashcardsList shows edit/delete per card', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'FC List Lecture' }));
    await FlashcardRepository.create(createFlashcard({
      lectureId: lecture.id, front: 'What is ML?', back: 'Machine Learning'
    }));
    await FlashcardRepository.create(createFlashcard({
      lectureId: lecture.id, front: 'What is DL?', back: 'Deep Learning'
    }));

    const container = document.createElement('div');
    document.body.appendChild(container);
    await renderFlashcardsList(container, lecture.id);

    // Each flashcard should have edit and delete buttons
    const items = container.children;
    expect(items.length).toBeGreaterThanOrEqual(2);

    const editBtns = container.querySelectorAll('[class*="edit"], [aria-label*="Edit"], [aria-label*="edit"]');
    const deleteBtns = container.querySelectorAll('[class*="delete"], [aria-label*="Delete"], [aria-label*="delete"]');
    expect(editBtns.length).toBeGreaterThanOrEqual(2);
    expect(deleteBtns.length).toBeGreaterThanOrEqual(2);
  });

  test('renderBookmarksList shows timestamps and labels', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'BM List Lecture' }));
    await BookmarkRepository.create(createBookmark({
      lectureId: lecture.id, timestamp: 90, label: 'Key concept'
    }));
    await BookmarkRepository.create(createBookmark({
      lectureId: lecture.id, timestamp: 300, label: 'Summary'
    }));

    const container = document.createElement('div');
    document.body.appendChild(container);
    await renderBookmarksList(container, lecture.id);

    // Should show timestamps and labels
    expect(container.textContent).toMatch(/1:30/); // 90 seconds
    expect(container.textContent).toMatch(/5:00/); // 300 seconds
    expect(container.textContent).toContain('Key concept');
    expect(container.textContent).toContain('Summary');
  });

  test('renderLectureInfo has "Study Flashcards" button', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Info Lecture' }));
    const stats = {
      segmentCount: 2, completedSegmentCount: 1, progressPercent: 50,
      flashcardCount: 5, flashcardsDue: 2, masteredCount: 1,
      bookmarkCount: 3, lastPosition: 60, lastStudied: Date.now()
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    renderLectureInfo(container, lecture, stats);

    const studyBtn = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent.toLowerCase().includes('study')
    );
    expect(studyBtn).toBeDefined();
    expect(studyBtn.textContent.toLowerCase()).toContain('flashcard');
  });
});

// ============================================================================
// DAY 5: FAVORITES (SettingsRepository)
// ============================================================================

describe('Favorites (SettingsRepository)', () => {
  test('toggleFavorite adds lectureId on first call', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Fav Test' }));
    const result = await toggleFavorite(lecture.id);

    expect(result).toBe(true);
    const ids = await getFavoriteIds();
    expect(ids).toContain(lecture.id);
  });

  test('toggleFavorite removes lectureId on second call', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Unfav Test' }));
    await toggleFavorite(lecture.id); // add
    const result = await toggleFavorite(lecture.id); // remove

    expect(result).toBe(false);
    const ids = await getFavoriteIds();
    expect(ids).not.toContain(lecture.id);
  });

  test('isFavorite returns true when favorited', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'IsFav True' }));
    await toggleFavorite(lecture.id);

    expect(await isFavorite(lecture.id)).toBe(true);
  });

  test('isFavorite returns false when not', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'IsFav False' }));
    expect(await isFavorite(lecture.id)).toBe(false);
  });

  test('getFavoriteLectures returns only existing lectures', async () => {
    const lec1 = await LectureRepository.create(createLecture({ title: 'Fav Lecture 1' }));
    const lec2 = await LectureRepository.create(createLecture({ title: 'Fav Lecture 2' }));
    await toggleFavorite(lec1.id);
    await toggleFavorite(lec2.id);

    const favorites = await getFavoriteLectures();
    expect(favorites.length).toBe(2);
    const titles = favorites.map(l => l.title);
    expect(titles).toContain('Fav Lecture 1');
    expect(titles).toContain('Fav Lecture 2');
  });

  test('batchDeleteLectures cleans stale favorite IDs', async () => {
    const lec1 = await LectureRepository.create(createLecture({ title: 'Keep' }));
    const lec2 = await LectureRepository.create(createLecture({ title: 'Delete' }));
    await toggleFavorite(lec1.id);
    await toggleFavorite(lec2.id);

    await batchDeleteLectures([lec2.id]);

    // lec2 should be removed from favorites
    const ids = await getFavoriteIds();
    expect(ids).toContain(lec1.id);
    expect(ids).not.toContain(lec2.id);
  });

  test('getFavoriteLectures handles deleted lectures gracefully', async () => {
    const lec1 = await LectureRepository.create(createLecture({ title: 'Existing' }));
    const lec2 = await LectureRepository.create(createLecture({ title: 'To Delete' }));
    await toggleFavorite(lec1.id);
    await toggleFavorite(lec2.id);

    // Delete lec2
    await LectureRepository.deleteWithCascade(lec2.id);

    const favorites = await getFavoriteLectures();
    expect(favorites.length).toBe(1);
    expect(favorites[0].title).toBe('Existing');
  });
});

// ============================================================================
// DAY 5: PLAYLIST
// ============================================================================

describe('Playlist', () => {
  test('getPlaylistForLecture returns previous/current/next', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'Playlist Course' }));
    await LectureRepository.create(createLecture({ title: 'L1', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'L2', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'L3', courseId: course.id }));

    // Get all lectures in course to find the middle one
    const allInCourse = await LectureRepository.getByCourse(course.id);
    expect(allInCourse.length).toBe(3);

    // Pick any lecture that is NOT first or last in sorted order
    // Sort by createdAt + id tiebreak (same as implementation)
    allInCourse.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    const middleLec = allInCourse[1];

    const playlist = await getPlaylistForLecture(middleLec.id);
    expect(playlist.current.id).toBe(middleLec.id);
    expect(playlist.previous).not.toBeNull();
    expect(playlist.next).not.toBeNull();
    expect(playlist.total).toBe(3);
  });

  test('getPlaylistForLecture returns null previous for first', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'First Course' }));
    await LectureRepository.create(createLecture({ title: 'First', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'Second', courseId: course.id }));

    // Find the first lecture in sorted order
    const allInCourse = await LectureRepository.getByCourse(course.id);
    allInCourse.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    const firstLec = allInCourse[0];

    const playlist = await getPlaylistForLecture(firstLec.id);
    expect(playlist.previous).toBeNull();
    expect(playlist.next).not.toBeNull();
    expect(playlist.currentIndex).toBe(0);
  });

  test('getPlaylistForLecture returns null next for last', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'Last Course' }));
    await LectureRepository.create(createLecture({ title: 'First', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'Last', courseId: course.id }));

    // Find the last lecture in sorted order
    const allInCourse = await LectureRepository.getByCourse(course.id);
    allInCourse.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    const lastLec = allInCourse[allInCourse.length - 1];

    const playlist = await getPlaylistForLecture(lastLec.id);
    expect(playlist.previous).not.toBeNull();
    expect(playlist.next).toBeNull();
    expect(playlist.currentIndex).toBe(1);
  });

  test('getPlaylistForLecture sorts by createdAt ascending', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'Sort Course' }));
    // Create 3 lectures — all get same createdAt, but sorted by id tiebreak
    await LectureRepository.create(createLecture({ title: 'Alpha', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'Beta', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'Gamma', courseId: course.id }));

    const allInCourse = await LectureRepository.getByCourse(course.id);
    allInCourse.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

    // The first in sorted order should have previous=null
    const firstPlaylist = await getPlaylistForLecture(allInCourse[0].id);
    expect(firstPlaylist.currentIndex).toBe(0);
    expect(firstPlaylist.previous).toBeNull();
    expect(firstPlaylist.next).not.toBeNull();
    // Next should match second in sorted order
    expect(firstPlaylist.next.id).toBe(allInCourse[1].id);
  });

  test('getPlaylistForLecture returns empty result for non-existent lecture', async () => {
    const playlist = await getPlaylistForLecture('non-existent-id');
    expect(playlist.current).toBeNull();
    expect(playlist.previous).toBeNull();
    expect(playlist.next).toBeNull();
    expect(playlist.total).toBe(0);
    expect(playlist.currentIndex).toBe(-1);
  });

  test('renderPlaylistNav disables previous button for first', () => {
    const playlist = {
      previous: null,
      current: { id: 'lec1', title: 'First' },
      next: { id: 'lec2', title: 'Second' },
      total: 2,
      currentIndex: 0
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    renderPlaylistNav(container, playlist);

    const prevBtn = container.querySelector('.sp-playlist-nav__btn--prev') ||
                    container.querySelector('[aria-label*="Previous"], [aria-label*="previous"]');
    expect(prevBtn).not.toBeNull();
    expect(prevBtn.disabled).toBe(true);
  });

  test('renderPlaylistNav disables next button for last', () => {
    const playlist = {
      previous: { id: 'lec1', title: 'First' },
      current: { id: 'lec2', title: 'Last' },
      next: null,
      total: 2,
      currentIndex: 1
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    renderPlaylistNav(container, playlist);

    const nextBtn = container.querySelector('.sp-playlist-nav__btn--next') ||
                    container.querySelector('[aria-label*="Next"], [aria-label*="next"]');
    expect(nextBtn).not.toBeNull();
    expect(nextBtn.disabled).toBe(true);
  });
});

// ============================================================================
// DAY 5: FAVORITE BUTTON
// ============================================================================

describe('Favorite Button', () => {
  test('renderFavoriteButton shows filled star when favorite', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderFavoriteButton(container, 'lec-123', true);

    const btn = container.querySelector('.sp-favorite-btn');
    expect(btn).not.toBeNull();
    expect(btn.classList.contains('sp-favorite-btn--active')).toBe(true);
    expect(btn.textContent).toContain('\u2605'); // filled star ★
  });

  test('renderFavoriteButton has correct aria-label', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderFavoriteButton(container, 'lec-fav', true);
    let btn = container.querySelector('.sp-favorite-btn');
    expect(btn.getAttribute('aria-label')).toMatch(/remove.*favorite/i);

    // Re-render as non-favorite
    renderFavoriteButton(container, 'lec-nonfav', false);
    btn = container.querySelector('.sp-favorite-btn');
    expect(btn.getAttribute('aria-label')).toMatch(/add.*favorite/i);
  });
});

// ============================================================================
// DAY 6: ENHANCED LIBRARY VIEW
// ============================================================================

describe('Enhanced Library View', () => {
  test('enhancedRenderLibraryView renders sidebar, toolbar, and grid', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'Test Course' }));
    await LectureRepository.create(createLecture({ title: 'Lecture A', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'Lecture B', courseId: course.id }));

    await enhancedRenderLibraryView();

    const sidebar = document.getElementById('library-sidebar');
    expect(sidebar.children.length).toBeGreaterThan(0);

    const toolbar = document.getElementById('library-toolbar');
    expect(toolbar.children.length).toBeGreaterThan(0);

    const grid = document.getElementById('library-grid');
    expect(grid.children.length).toBeGreaterThanOrEqual(2);
  });

  test('course filter + sort work together', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'Filtered Course' }));
    await LectureRepository.create(createLecture({ title: 'Z Lecture', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'A Lecture', courseId: course.id }));
    await LectureRepository.create(createLecture({ title: 'Unrelated' })); // no course

    libraryState.selectedCourseId = course.id;
    libraryState.sortBy = 'title';
    await enhancedRenderLibraryView();

    const grid = document.getElementById('library-grid');
    const cards = grid.querySelectorAll('[role="listitem"]');
    expect(cards.length).toBe(2); // only course lectures
    // First card should be A Lecture (sorted by title)
    expect(cards[0].textContent).toContain('A Lecture');
  });

  test('favorites filter shows only favorited lectures', async () => {
    const lec1 = await LectureRepository.create(createLecture({ title: 'Fav Lecture' }));
    await LectureRepository.create(createLecture({ title: 'Not Fav' }));
    await toggleFavorite(lec1.id);

    libraryState.selectedCourseId = 'favorites';
    await enhancedRenderLibraryView();

    const grid = document.getElementById('library-grid');
    const cards = grid.querySelectorAll('[role="listitem"]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Fav Lecture');
  });

  test('empty course shows course empty state', async () => {
    const course = await CourseRepository.create(createCourse({ name: 'Empty Course' }));
    libraryState.selectedCourseId = course.id;
    await enhancedRenderLibraryView();

    const grid = document.getElementById('library-grid');
    const emptyEl = document.getElementById('library-empty');
    expect(grid.children.length).toBe(0);
    expect(emptyEl.classList.contains('hidden')).toBe(false);
    expect(emptyEl.textContent.toLowerCase()).toMatch(/no lecture/i);
  });

  test('empty search shows search empty state', async () => {
    await LectureRepository.create(createLecture({ title: 'Some Lecture' }));

    // Simulate search with no results by using a non-matching query
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderSearchEmptyState(container, 'xyznonexistent');
    expect(container.textContent.toLowerCase()).toContain('no result');
    expect(container.textContent).toContain('xyznonexistent');
  });

  test('empty favorites shows favorites empty state', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderFavoritesEmptyState(container);
    expect(container.textContent.toLowerCase()).toMatch(/no favorite/i);
  });
});

// ============================================================================
// DAY 6: PERFORMANCE
// ============================================================================

describe('Performance', () => {
  test('renders 20 lectures without error', async () => {
    for (let i = 0; i < 20; i++) {
      await LectureRepository.create(createLecture({ title: `Perf Lecture ${i}` }));
    }

    await enhancedRenderLibraryView();

    const grid = document.getElementById('library-grid');
    expect(grid.children.length).toBeGreaterThanOrEqual(12); // at least first page
  });

  test('search 100 segments completes in under 500ms', async () => {
    const lecture = await LectureRepository.create(createLecture({ title: 'Perf Search' }));
    for (let i = 0; i < 100; i++) {
      await SegmentRepository.create(createSegment({
        lectureId: lecture.id,
        startTime: i * 60,
        endTime: (i + 1) * 60,
        type: 'topic',
        metadata: { text: `Topic number ${i} about machine learning algorithms` }
      }));
    }

    _resetSearchCache();
    const start = Date.now();
    const results = await crossLectureSearch('machine learning');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(results.totalCount).toBeGreaterThan(0);
  });

  test('paginated rendering loads first 12, sentinel present for more', () => {
    // Create mock lectures
    const lectures = Array.from({ length: 20 }, (_, i) => ({
      id: `lec-${i}`, title: `Lecture ${i}`, status: 'completed',
      watchProgress: 0, createdAt: Date.now(), courseId: null
    }));

    const container = document.createElement('div');
    container.setAttribute('role', 'list');
    document.body.appendChild(container);

    renderLibraryViewPaginated(container, lectures, new Map(), 12);

    const cards = container.querySelectorAll('[role="listitem"]');
    expect(cards.length).toBe(12);

    // Sentinel should be present
    const sentinel = container.querySelector('[data-sentinel]');
    expect(sentinel).not.toBeNull();
  });

  test('IntersectionObserver sentinel triggers next batch via mock._trigger()', () => {
    const lectures = Array.from({ length: 20 }, (_, i) => ({
      id: `lec-${i}`, title: `Lecture ${i}`, status: 'completed',
      watchProgress: 0, createdAt: Date.now(), courseId: null
    }));

    const container = document.createElement('div');
    container.setAttribute('role', 'list');
    document.body.appendChild(container);

    const observer = renderLibraryViewPaginated(container, lectures, new Map(), 12);

    // Trigger the observer to load next batch
    if (observer && observer._trigger) {
      observer._trigger([{ isIntersecting: true }]);
    }

    const cards = container.querySelectorAll('[role="listitem"]');
    expect(cards.length).toBe(20); // All loaded now

    // Sentinel should be removed since all items rendered
    const sentinel = container.querySelector('[data-sentinel]');
    expect(sentinel).toBeNull();
  });
});

// ============================================================================
// DAY 6: KEYBOARD SHORTCUTS
// ============================================================================

describe('Keyboard Shortcuts', () => {
  test('"/" focuses search input when no input focused', () => {
    // Create a search input in the toolbar
    const toolbar = document.getElementById('library-toolbar');
    const searchInput = document.createElement('input');
    searchInput.className = 'sp-search-input';
    searchInput.type = 'text';
    toolbar.appendChild(searchInput);

    const cleanup = initLibraryKeyboardShortcuts();

    // Focus body first (no input focused)
    document.body.focus();

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(searchInput);

    if (cleanup) cleanup();
  });

  test('"/" does NOT focus search when input already focused', () => {
    const toolbar = document.getElementById('library-toolbar');
    const searchInput = document.createElement('input');
    searchInput.className = 'sp-search-input';
    searchInput.type = 'text';
    toolbar.appendChild(searchInput);

    // Create another input that is focused
    const otherInput = document.createElement('input');
    otherInput.type = 'text';
    document.body.appendChild(otherInput);
    otherInput.focus();

    const cleanup = initLibraryKeyboardShortcuts();

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true });
    document.dispatchEvent(event);

    // Should still be on otherInput, not search
    expect(document.activeElement).toBe(otherInput);

    if (cleanup) cleanup();
  });

  test('Escape clears and blurs focused input', () => {
    const toolbar = document.getElementById('library-toolbar');
    const searchInput = document.createElement('input');
    searchInput.className = 'sp-search-input';
    searchInput.type = 'text';
    toolbar.appendChild(searchInput);

    const cleanup = initLibraryKeyboardShortcuts();

    // Focus the search input and type something
    searchInput.focus();
    searchInput.value = 'some query';

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);

    expect(searchInput.value).toBe('');
    expect(document.activeElement).not.toBe(searchInput);

    if (cleanup) cleanup();
  });

  test('library card has tabindex and responds to Enter key', () => {
    const container = document.createElement('div');
    container.setAttribute('role', 'list');
    document.body.appendChild(container);

    const lectures = [{ id: 'kb-lec-1', title: 'KB Test', status: 'completed', watchProgress: 50, createdAt: Date.now(), courseId: null }];
    renderLibraryViewPaginated(container, lectures, new Map(), 12);

    const card = container.querySelector('[role="listitem"]');
    expect(card.getAttribute('tabindex')).toBe('0');

    // Simulate Enter key
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card.dispatchEvent(event);
    // Navigation triggered — hash should change
    expect(window.location.hash).toContain('kb-lec-1');
  });
});
