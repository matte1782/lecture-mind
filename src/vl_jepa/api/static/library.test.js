/**
 * @fileoverview Tests for Library module (Week 12 Days 1-2).
 * Day 1: Course management, sidebar rendering, toolbar, sorting.
 * Day 2: Import pipeline, course assignment, context menu.
 * TDD: tests written before implementation.
 */

import { closeDatabase, deleteDatabase } from './storage/db.js';
import {
  CourseRepository,
  LectureRepository,
  SegmentRepository,
  EventRepository,
  SettingsRepository,
  createCourse,
  createLecture
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
  _resetState
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

  document.body.appendChild(app);
}

beforeEach(async () => {
  setupTestDOM();
  _resetState();
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
