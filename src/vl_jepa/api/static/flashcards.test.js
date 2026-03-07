/**
 * @fileoverview Tests for Lecture Mind Flashcard System.
 * Covers router, library view, flashcard component, study session,
 * auto-generation, manual CRUD, and integration scenarios.
 */

import { jest } from '@jest/globals';
import { closeDatabase, deleteDatabase } from './storage/db.js';
import {
  FlashcardRepository,
  LectureRepository,
  SegmentRepository,
  FLASHCARD_STATUS
} from './storage/index.js';

import {
  state,
  parseHash,
  handleRouteChange,
  initRouter,
  VIEWS,
  SCROLL_ANCHORS,
  createElement,
  clearElement,
  showElement,
  hideElement,
  sanitizeId,
  renderLibraryView,
  renderLibraryCard,
  getDominantStatus,
  createMasteryBadge,
  renderFlashcard,
  StudySession,
  startStudyView,
  renderSessionComplete,
  createProgressRing,
  renderConfetti,
  autoGenerateFlashcards,
  generateQuestion,
  openCreateCardModal,
  registerListener,
  cleanupListeners,
  showToast,
  navigateTo
} from './flashcards.js';

// ============================================================================
// TEST SETUP
// ============================================================================

/**
 * Build the test DOM using safe DOM methods (no innerHTML).
 * Mirrors the structure in index.html that flashcards.js expects.
 */
function setupTestDOM() {
  // Clear body
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }

  const app = document.createElement('div');
  app.id = 'app';
  app.className = 'app-container';

  // Header with nav
  const header = document.createElement('header');
  header.className = 'header header-landing';
  const headerContent = document.createElement('div');
  headerContent.className = 'header-content';
  const nav = document.createElement('nav');
  nav.className = 'header-nav';

  const links = [
    { href: '#features', text: 'Features' },
    { href: '#how-it-works', text: 'How it Works' },
    { href: '#tech-stack', text: 'Tech Stack' },
    { href: '#/playground', text: 'Playground', id: 'nav-playground' }
  ];
  for (const l of links) {
    const a = document.createElement('a');
    a.href = l.href;
    a.className = 'nav-link';
    a.textContent = l.text;
    if (l.id) a.id = l.id;
    nav.appendChild(a);
  }
  headerContent.appendChild(nav);
  header.appendChild(headerContent);
  app.appendChild(header);

  // Landing sections
  for (const id of ['hero', 'features', 'how-it-works', 'tech-stack']) {
    const s = document.createElement('section');
    s.id = id;
    app.appendChild(s);
  }

  // App section
  const appSection = document.createElement('section');
  appSection.className = 'app-section';
  appSection.id = 'app-section';
  app.appendChild(appSection);

  // Playground view
  const playgroundView = document.createElement('section');
  playgroundView.id = 'playground-view';
  playgroundView.className = 'app-section hidden';
  playgroundView.setAttribute('inert', '');
  playgroundView.setAttribute('aria-label', 'Student Playground');

  const playgroundContainer = document.createElement('div');
  playgroundContainer.className = 'section-container';

  const playgroundSearch = document.createElement('div');
  playgroundSearch.id = 'playground-search';
  playgroundContainer.appendChild(playgroundSearch);

  const libraryGrid = document.createElement('div');
  libraryGrid.id = 'library-grid';
  libraryGrid.className = 'sp-card-grid';
  libraryGrid.setAttribute('role', 'list');
  libraryGrid.setAttribute('aria-label', 'Lecture library');
  playgroundContainer.appendChild(libraryGrid);

  const libraryEmpty = document.createElement('div');
  libraryEmpty.id = 'library-empty';
  libraryEmpty.className = 'empty-state hidden';
  playgroundContainer.appendChild(libraryEmpty);

  playgroundView.appendChild(playgroundContainer);
  app.appendChild(playgroundView);

  // Study view
  const studyView = document.createElement('section');
  studyView.id = 'study-view';
  studyView.className = 'app-section hidden';
  studyView.setAttribute('inert', '');
  studyView.setAttribute('aria-label', 'Study Session');

  const studyContainer = document.createElement('div');
  studyContainer.className = 'section-container';

  const studyHeader = document.createElement('div');
  studyHeader.id = 'study-header';
  studyContainer.appendChild(studyHeader);

  const studyCardArea = document.createElement('div');
  studyCardArea.id = 'study-card-area';
  studyContainer.appendChild(studyCardArea);

  const studyControls = document.createElement('div');
  studyControls.id = 'study-controls';
  studyContainer.appendChild(studyControls);

  const studyComplete = document.createElement('div');
  studyComplete.id = 'study-complete';
  studyComplete.className = 'study-complete-area hidden';
  studyContainer.appendChild(studyComplete);

  studyView.appendChild(studyContainer);
  app.appendChild(studyView);

  // Footer
  const footer = document.createElement('footer');
  footer.className = 'footer-landing';
  app.appendChild(footer);

  document.body.appendChild(app);

  // Toast container
  const toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('role', 'alert');
  toastContainer.setAttribute('aria-live', 'assertive');
  document.body.appendChild(toastContainer);
}

beforeEach(async () => {
  closeDatabase();
  await deleteDatabase();
  if (typeof localStorage !== 'undefined') localStorage.clear();
  setupTestDOM();
  window.location.hash = '';
  state.currentView = null;
  state.currentLectureId = null;
  state.studySession = null;
  state.searchQuery = '';
});

afterEach(async () => {
  cleanupListeners();
  closeDatabase();
  await deleteDatabase();
  if (typeof localStorage !== 'undefined') localStorage.clear();
  window.location.hash = '';
});

// ============================================================================
// DAY 1: ROUTER + VIEW SHELL (15 tests)
// ============================================================================

describe('Router: parseHash', () => {
  test('empty hash returns landing view', () => {
    expect(parseHash('')).toEqual({ view: VIEWS.LANDING, params: {} });
  });

  test('hash "/" returns landing view', () => {
    expect(parseHash('#/')).toEqual({ view: VIEWS.LANDING, params: {} });
  });

  test('hash "#/playground" returns playground view', () => {
    expect(parseHash('#/playground')).toEqual({ view: VIEWS.PLAYGROUND, params: {} });
  });

  test('hash "#/study/abc123" returns study view with lectureId', () => {
    const result = parseHash('#/study/abc123');
    expect(result.view).toBe(VIEWS.STUDY);
    expect(result.params.lectureId).toBe('abc123');
  });

  test('scroll anchors (#features, #how-it-works, etc.) return null view', () => {
    for (const anchor of SCROLL_ANCHORS) {
      const result = parseHash(`#${anchor}`);
      expect(result.view).toBeNull();
    }
  });

  test('unknown hash returns landing view', () => {
    expect(parseHash('#/unknown-route')).toEqual({ view: VIEWS.LANDING, params: {} });
  });
});

describe('Router: sanitizeId', () => {
  test('strips unsafe characters from lectureId', () => {
    expect(sanitizeId('abc-123_def')).toBe('abc-123_def');
    expect(sanitizeId('abc<script>alert(1)</script>')).toBe('abcscriptalert1script');
    expect(sanitizeId('')).toBe('');
  });

  test('returns empty string for non-string input', () => {
    expect(sanitizeId(null)).toBe('');
    expect(sanitizeId(undefined)).toBe('');
    expect(sanitizeId(42)).toBe('');
  });
});

describe('Router: view mounting', () => {
  test('#/playground shows playground-view and hides others', () => {
    window.location.hash = '#/playground';
    handleRouteChange();

    const playground = document.getElementById('playground-view');
    const appSection = document.getElementById('app-section');
    const studyView = document.getElementById('study-view');

    expect(playground.classList.contains('hidden')).toBe(false);
    expect(appSection.classList.contains('hidden')).toBe(true);
    expect(studyView.classList.contains('hidden')).toBe(true);
  });

  test('#/ returns to landing view', () => {
    window.location.hash = '#/playground';
    handleRouteChange();

    window.location.hash = '#/';
    handleRouteChange();

    const appSection = document.getElementById('app-section');
    const playground = document.getElementById('playground-view');

    expect(appSection.classList.contains('hidden')).toBe(false);
    expect(playground.classList.contains('hidden')).toBe(true);
  });

  test('state.currentView updates correctly', () => {
    window.location.hash = '#/playground';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.PLAYGROUND);

    window.location.hash = '#/';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.LANDING);
  });

  test('study route parses lectureId into state', () => {
    window.location.hash = '#/study/test-lecture-id';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.STUDY);
    expect(state.currentLectureId).toBe('test-lecture-id');
  });

  test('nav link gets active class on playground route', () => {
    window.location.hash = '#/playground';
    handleRouteChange();

    const navLink = document.getElementById('nav-playground');
    expect(navLink.classList.contains('nav-link--active')).toBe(true);
  });

  test('nav link loses active class when navigating away', () => {
    window.location.hash = '#/playground';
    handleRouteChange();
    window.location.hash = '#/';
    handleRouteChange();

    const navLink = document.getElementById('nav-playground');
    expect(navLink.classList.contains('nav-link--active')).toBe(false);
  });
});

// ============================================================================
// DAY 1: DOM UTILITIES
// ============================================================================

describe('DOM Utilities', () => {
  test('createElement creates element with class and attributes', () => {
    const el = createElement('div', 'my-class', { textContent: 'Hello', 'data-id': '42' });
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('my-class');
    expect(el.textContent).toBe('Hello');
    expect(el.getAttribute('data-id')).toBe('42');
  });

  test('clearElement removes all children', () => {
    const parent = createElement('div', '');
    parent.appendChild(createElement('span', ''));
    parent.appendChild(createElement('span', ''));
    expect(parent.childNodes.length).toBe(2);

    clearElement(parent);
    expect(parent.childNodes.length).toBe(0);
  });

  test('showElement removes hidden class and inert', () => {
    const el = createElement('div', 'hidden');
    el.setAttribute('inert', '');
    showElement(el);
    expect(el.classList.contains('hidden')).toBe(false);
    expect(el.hasAttribute('inert')).toBe(false);
  });

  test('hideElement adds hidden class and inert', () => {
    const el = createElement('div', '');
    hideElement(el);
    expect(el.classList.contains('hidden')).toBe(true);
    expect(el.hasAttribute('inert')).toBe(true);
  });
});

// ============================================================================
// DAY 2: LIBRARY GRID VIEW (12 tests)
// ============================================================================

describe('Library View', () => {
  test('renders correct number of library cards', async () => {
    await LectureRepository.create({ title: 'Lecture 1' });
    await LectureRepository.create({ title: 'Lecture 2' });

    // Call renderLibraryView directly to avoid skeleton race
    await renderLibraryView();
    await new Promise(r => setTimeout(r, 100));

    const grid = document.getElementById('library-grid');
    const cards = grid.querySelectorAll('.sp-library-card');
    expect(cards.length).toBe(2);
  });

  test('empty state shows when no lectures exist', async () => {
    window.location.hash = '#/playground';
    handleRouteChange();

    await new Promise(r => setTimeout(r, 50));

    const emptyState = document.getElementById('library-empty');
    expect(emptyState.classList.contains('hidden')).toBe(false);
  });

  test('library card shows lecture title', async () => {
    await LectureRepository.create({ title: 'My Test Lecture' });
    window.location.hash = '#/playground';
    handleRouteChange();

    await new Promise(r => setTimeout(r, 50));

    const grid = document.getElementById('library-grid');
    const titleEl = grid.querySelector('.sp-library-card__title');
    expect(titleEl.textContent).toBe('My Test Lecture');
  });

  test('library card shows flashcard count', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q1', back: 'A1' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q2', back: 'A2' });

    window.location.hash = '#/playground';
    handleRouteChange();

    await new Promise(r => setTimeout(r, 50));

    const grid = document.getElementById('library-grid');
    const text = grid.textContent;
    expect(text).toContain('2 cards');
  });

  test('library card click navigates to study route', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    window.location.hash = '#/playground';
    handleRouteChange();

    await new Promise(r => setTimeout(r, 50));

    const grid = document.getElementById('library-grid');
    const card = grid.querySelector('.sp-library-card');
    card.click();

    expect(window.location.hash).toContain('#/study/');
  });

  test('search filters cards by title', async () => {
    await LectureRepository.create({ title: 'Algorithms 101' });
    await LectureRepository.create({ title: 'Biology Intro' });

    state.searchQuery = 'algorithm';
    await renderLibraryView();

    await new Promise(r => setTimeout(r, 50));

    const grid = document.getElementById('library-grid');
    const cards = grid.querySelectorAll('.sp-library-card');
    expect(cards.length).toBe(1);
    expect(grid.textContent).toContain('Algorithms 101');

    state.searchQuery = '';
  });

  test('mastery badge reflects dominant status', () => {
    const cards = [
      { status: FLASHCARD_STATUS.NEW },
      { status: FLASHCARD_STATUS.LEARNING },
      { status: FLASHCARD_STATUS.LEARNING }
    ];
    expect(getDominantStatus(cards)).toBe(FLASHCARD_STATUS.LEARNING);
  });

  test('createMasteryBadge creates correct BEM element', () => {
    const badge = createMasteryBadge(FLASHCARD_STATUS.MASTERED);
    expect(badge.classList.contains('sp-mastery-badge')).toBe(true);
    expect(badge.classList.contains('sp-mastery-badge--mastered')).toBe(true);
    expect(badge.textContent).toBe('Mastered');
  });

  test('cards sorted by most recent first', async () => {
    await LectureRepository.create({ title: 'Older' });
    await new Promise(r => setTimeout(r, 10));
    await LectureRepository.create({ title: 'Newer' });

    await renderLibraryView();
    await new Promise(r => setTimeout(r, 50));

    const grid = document.getElementById('library-grid');
    const titles = grid.querySelectorAll('.sp-library-card__title');
    expect(titles[0].textContent).toBe('Newer');
    expect(titles[1].textContent).toBe('Older');
  });

  test('library card has correct ARIA attributes', async () => {
    await LectureRepository.create({ title: 'Accessible Lecture' });
    await renderLibraryView();
    await new Promise(r => setTimeout(r, 50));

    const grid = document.getElementById('library-grid');
    const card = grid.querySelector('.sp-library-card');
    expect(card.getAttribute('role')).toBe('listitem');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('aria-label')).toContain('Accessible Lecture');
  });

  test('library card keyboard Enter navigates to study', async () => {
    await LectureRepository.create({ title: 'Test' });
    await renderLibraryView();
    await new Promise(r => setTimeout(r, 50));

    const grid = document.getElementById('library-grid');
    const card = grid.querySelector('.sp-library-card');

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card.dispatchEvent(event);

    expect(window.location.hash).toContain('#/study/');
  });

  test('renderLibraryCard shows progress bar', async () => {
    const lecture = await LectureRepository.create({ title: 'Test', watchProgress: 75 });
    const card = await renderLibraryCard(lecture, 0);

    const fill = card.querySelector('.sp-library-card__progress-fill');
    expect(fill.style.width).toBe('75%');
  });
});

// ============================================================================
// DAY 3: FLASHCARD COMPONENT (10 tests)
// ============================================================================

describe('Flashcard Component', () => {
  const mockCard = {
    id: 'card-1',
    lectureId: 'lec-1',
    front: 'What is recursion?',
    back: 'A function that calls itself',
    status: FLASHCARD_STATUS.NEW,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: Date.now()
  };

  test('renders front and back content correctly', () => {
    const el = renderFlashcard(mockCard, 0, 5);
    const front = el.querySelector('.sp-flashcard__front');
    const back = el.querySelector('.sp-flashcard__back');

    expect(front.textContent).toContain('What is recursion?');
    expect(back.textContent).toContain('A function that calls itself');
  });

  test('click toggles flipped state', () => {
    const el = renderFlashcard(mockCard, 0, 5);
    document.body.appendChild(el);

    expect(el.classList.contains('sp-flashcard--flipped')).toBe(false);
    el.click();
    expect(el.classList.contains('sp-flashcard--flipped')).toBe(true);
    el.click();
    expect(el.classList.contains('sp-flashcard--flipped')).toBe(false);

    el.remove();
  });

  test('status class matches card status', () => {
    const newCard = { ...mockCard, status: FLASHCARD_STATUS.NEW };
    const el = renderFlashcard(newCard, 0, 1);
    expect(el.classList.contains('sp-flashcard--new')).toBe(true);

    const learnCard = { ...mockCard, status: FLASHCARD_STATUS.LEARNING };
    const el2 = renderFlashcard(learnCard, 0, 1);
    expect(el2.classList.contains('sp-flashcard--learning')).toBe(true);
  });

  test('card shows position number', () => {
    const el = renderFlashcard(mockCard, 2, 10);
    expect(el.textContent).toContain('3 of 10');
  });

  test('Space key flips card', () => {
    const el = renderFlashcard(mockCard, 0, 1);
    document.body.appendChild(el);

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    el.dispatchEvent(event);
    expect(el.classList.contains('sp-flashcard--flipped')).toBe(true);

    el.remove();
  });

  test('Enter key flips card', () => {
    const el = renderFlashcard(mockCard, 0, 1);
    document.body.appendChild(el);

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    el.dispatchEvent(event);
    expect(el.classList.contains('sp-flashcard--flipped')).toBe(true);

    el.remove();
  });

  test('has correct ARIA attributes', () => {
    const el = renderFlashcard(mockCard, 0, 5);
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toContain('1 of 5');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  test('mastery badge appears on front face', () => {
    const el = renderFlashcard(mockCard, 0, 1);
    const front = el.querySelector('.sp-flashcard__front');
    const badge = front.querySelector('.sp-mastery-badge');
    expect(badge).not.toBeNull();
    expect(badge.classList.contains('sp-mastery-badge--new')).toBe(true);
  });

  test('backface-visibility via CSS class structure', () => {
    const el = renderFlashcard(mockCard, 0, 1);
    const inner = el.querySelector('.sp-flashcard__inner');
    const front = el.querySelector('.sp-flashcard__front');
    const back = el.querySelector('.sp-flashcard__back');
    expect(inner).not.toBeNull();
    expect(front).not.toBeNull();
    expect(back).not.toBeNull();
  });

  test('all flashcard statuses produce valid class names', () => {
    for (const status of Object.values(FLASHCARD_STATUS)) {
      const card = { ...mockCard, status };
      const el = renderFlashcard(card, 0, 1);
      expect(el.classList.contains(`sp-flashcard--${status}`)).toBe(true);
    }
  });
});

// ============================================================================
// DAY 4: STUDY SESSION (15 tests)
// ============================================================================

describe('StudySession class', () => {
  let cards;

  beforeEach(() => {
    cards = [
      { id: 'c1', lectureId: 'l1', front: 'Q1', back: 'A1', status: FLASHCARD_STATUS.NEW, interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: Date.now() },
      { id: 'c2', lectureId: 'l1', front: 'Q2', back: 'A2', status: FLASHCARD_STATUS.NEW, interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: Date.now() },
      { id: 'c3', lectureId: 'l1', front: 'Q3', back: 'A3', status: FLASHCARD_STATUS.LEARNING, interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: Date.now() }
    ];
  });

  test('starts with correct card count', () => {
    const session = new StudySession(cards, 'l1');
    expect(session.getProgress().total).toBe(3);
    expect(session.getProgress().completed).toBe(0);
  });

  test('currentCard returns card at current index', () => {
    const session = new StudySession(cards, 'l1');
    expect(session.currentCard().id).toBe('c1');
  });

  test('submitReview advances to next card', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card1 = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q1', back: 'A1' });
    const card2 = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q2', back: 'A2' });

    const session = new StudySession([card1, card2], lecture.id);
    await session.submitReview(4);

    expect(session.currentIndex).toBe(1);
    expect(session.reviewed).toBe(1);
    expect(session.currentCard().id).toBe(card2.id);
  });

  test('progress updates after each review', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card1 = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q1', back: 'A1' });
    const card2 = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q2', back: 'A2' });

    const session = new StudySession([card1, card2], lecture.id);
    expect(session.getProgress().completed).toBe(0);

    await session.submitReview(4);
    expect(session.getProgress().completed).toBe(1);
    expect(session.getProgress().current).toBe(2);
  });

  test('session completes when all cards reviewed', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    const session = new StudySession([card], lecture.id);
    await session.submitReview(4);

    expect(session.isComplete()).toBe(true);
  });

  test('accuracy tracks correct vs total reviews', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const c1 = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q1', back: 'A1' });
    const c2 = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q2', back: 'A2' });

    const session = new StudySession([c1, c2], lecture.id);
    await session.submitReview(4); // correct
    await session.submitReview(1); // fail

    expect(session.getAccuracy()).toBe(50);
  });

  test('mastery changes tracked when status changes', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });
    expect(card.status).toBe(FLASHCARD_STATUS.NEW);

    const session = new StudySession([card], lecture.id);
    await session.submitReview(4);

    expect(session.masteryChanges.length).toBe(1);
    expect(session.masteryChanges[0].from).toBe(FLASHCARD_STATUS.NEW);
    expect(session.masteryChanges[0].to).toBe(FLASHCARD_STATUS.LEARNING);
  });

  test('getElapsedSeconds returns positive number', () => {
    const session = new StudySession(cards, 'l1');
    expect(session.getElapsedSeconds()).toBeGreaterThanOrEqual(0);
  });
});

describe('Study View UI', () => {
  test('"All caught up" shows when no cards due', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });
    await FlashcardRepository.reviewCard(card.id, 5);

    await startStudyView(lecture.id);
    await new Promise(r => setTimeout(r, 50));

    const cardArea = document.getElementById('study-card-area');
    expect(cardArea.textContent).toContain('All caught up');
  });

  test('progress ring renders with correct structure', () => {
    const session = new StudySession(
      [{ id: 'c1', status: 'new', dueDate: Date.now() }],
      'l1'
    );
    const ring = createProgressRing(session);

    expect(ring.classList.contains('sp-progress-ring')).toBe(true);
    const svg = ring.querySelector('svg');
    expect(svg).not.toBeNull();
    const bgCircle = svg.querySelector('.sp-progress-ring__bg');
    expect(bgCircle).not.toBeNull();
    const fgCircle = svg.querySelector('.sp-progress-ring__circle');
    expect(fgCircle).not.toBeNull();
    const value = ring.querySelector('.sp-progress-ring__value');
    expect(value.textContent).toBe('0/1');
  });

  test('session complete screen shows stats', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    const session = new StudySession([card], lecture.id);
    await session.submitReview(4);

    renderSessionComplete(session);

    const completeArea = document.getElementById('study-complete');
    expect(completeArea.textContent).toContain('Session Complete');
    expect(completeArea.textContent).toContain('1'); // cards reviewed
    expect(completeArea.textContent).toContain('100%'); // accuracy
  });

  test('quality buttons are rendered for study session', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    await startStudyView(lecture.id);
    await new Promise(r => setTimeout(r, 50));

    const controls = document.getElementById('study-controls');
    const buttons = controls.querySelectorAll('.sp-study-controls__quality-btn');
    expect(buttons.length).toBe(4);
  });

  test('quality button click advances to next card', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q1', back: 'A1' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q2', back: 'A2' });

    await startStudyView(lecture.id);
    await new Promise(r => setTimeout(r, 50));

    const controls = document.getElementById('study-controls');
    const goodBtn = controls.querySelector('.sp-study-controls__quality-btn--good');
    goodBtn.click();

    // Wait for async submitReview + 300ms transition delay + re-render
    // Use polling instead of fixed timeout for deterministic behavior
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      await new Promise(r => setTimeout(r, 200));
      const cardArea = document.getElementById('study-card-area');
      if (cardArea && cardArea.textContent.includes('Q2')) {
        found = true;
      }
    }

    const cardArea = document.getElementById('study-card-area');
    expect(cardArea.textContent).toContain('Q2');
  });

  test('study view shows correct flashcard content', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'What is AI?', back: 'Artificial Intelligence' });

    await startStudyView(lecture.id);
    await new Promise(r => setTimeout(r, 50));

    const cardArea = document.getElementById('study-card-area');
    expect(cardArea.textContent).toContain('What is AI?');
  });

  test('back button navigates to playground', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    await startStudyView(lecture.id);
    await new Promise(r => setTimeout(r, 50));

    const header = document.getElementById('study-header');
    const backBtn = header.querySelector('button');
    backBtn.click();

    expect(window.location.hash).toBe('#/playground');
  });
});

// ============================================================================
// DAY 5: AUTO-GENERATION + MANUAL CREATION (15 tests)
// ============================================================================

describe('Auto-generate flashcards', () => {
  test('creates flashcards from segments', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await SegmentRepository.create({
      lectureId: lecture.id,
      startTime: 0,
      endTime: 60,
      type: 'slide_change',
      metadata: { text: 'Recursion is a technique where a function calls itself to solve smaller subproblems.' }
    });
    await SegmentRepository.create({
      lectureId: lecture.id,
      startTime: 60,
      endTime: 120,
      type: 'scene_change',
      metadata: { text: 'Dynamic programming optimizes recursive solutions by storing intermediate results in a table.' }
    });

    const count = await autoGenerateFlashcards(lecture.id);
    expect(count).toBe(2);

    const cards = await FlashcardRepository.getByLecture(lecture.id);
    expect(cards.length).toBe(2);
  });

  test('is idempotent (no duplicates on re-run)', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await SegmentRepository.create({
      lectureId: lecture.id,
      startTime: 0,
      endTime: 60,
      metadata: { text: 'Machine learning is a subset of artificial intelligence that learns from data.' }
    });

    await autoGenerateFlashcards(lecture.id);
    const firstCount = (await FlashcardRepository.getByLecture(lecture.id)).length;

    await autoGenerateFlashcards(lecture.id);
    const secondCount = (await FlashcardRepository.getByLecture(lecture.id)).length;

    expect(secondCount).toBe(firstCount);
  });

  test('returns 0 for lecture with no segments', async () => {
    const lecture = await LectureRepository.create({ title: 'Empty' });
    const count = await autoGenerateFlashcards(lecture.id);
    expect(count).toBe(0);
  });

  test('skips segments with very short text', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await SegmentRepository.create({
      lectureId: lecture.id,
      startTime: 0,
      endTime: 10,
      metadata: { text: 'Short' }
    });

    const count = await autoGenerateFlashcards(lecture.id);
    expect(count).toBe(0);
  });
});

describe('generateQuestion', () => {
  test('generates "What" question for statements with "is"', () => {
    const q = generateQuestion('Recursion is a fundamental concept', 'scene_change');
    expect(q.toLowerCase()).toContain('what');
  });

  test('generates "Define" for definition-like sentences', () => {
    const q = generateQuestion('Algorithm means a step-by-step procedure', 'scene_change');
    expect(q).toContain('Define');
  });

  test('generates "Explain" as default fallback', () => {
    const q = generateQuestion('The professor demonstrated the technique on the board', 'scene_change');
    expect(q).toContain('Explain');
  });

  test('uses slide prefix for slide_change segments', () => {
    const q = generateQuestion('The professor demonstrated the technique on the board', 'slide_change');
    expect(q).toContain('What is shown');
  });
});

describe('Manual card creation', () => {
  test('modal creates card with valid input', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    openCreateCardModal(lecture.id, null);

    const frontInput = document.getElementById('modal-front');
    const backInput = document.getElementById('modal-back');

    expect(frontInput).not.toBeNull();
    expect(backInput).not.toBeNull();

    frontInput.value = 'Test Question';
    backInput.value = 'Test Answer';

    const saveBtn = document.querySelector('.modal-content .btn[data-variant="primary"]');
    saveBtn.click();

    await new Promise(r => setTimeout(r, 100));

    const cards = await FlashcardRepository.getByLecture(lecture.id);
    expect(cards.length).toBe(1);
    expect(cards[0].front).toBe('Test Question');
    expect(cards[0].back).toBe('Test Answer');
  });

  test('modal shows error when fields are empty', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    openCreateCardModal(lecture.id, null);

    const saveBtn = document.querySelector('.modal-content .btn[data-variant="primary"]');
    saveBtn.click();

    await new Promise(r => setTimeout(r, 50));

    const errorEl = document.querySelector('.modal-content [aria-live="polite"]');
    expect(errorEl.textContent).toContain('required');
  });

  test('modal closes on Cancel click', () => {
    openCreateCardModal('test-id', null);
    const cancelBtn = document.querySelector('.modal-content .btn[data-variant="ghost"]');
    cancelBtn.click();

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).toBeNull();
  });

  test('modal closes on Escape key', () => {
    openCreateCardModal('test-id', null);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).toBeNull();
  });

  test('modal closes on overlay click', () => {
    openCreateCardModal('test-id', null);
    const overlay = document.querySelector('.modal-overlay');
    overlay.click();

    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('modal has focus trap attributes', () => {
    openCreateCardModal('test-id', null);
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');

    overlay.click();
  });

  test('character count updates on input', () => {
    openCreateCardModal('test-id', null);
    const frontInput = document.getElementById('modal-front');

    frontInput.value = 'Hello';
    frontInput.dispatchEvent(new Event('input', { bubbles: true }));

    const allDivs = document.querySelectorAll('.modal-content div');
    const countText = Array.from(allDivs).find(el => el.textContent.includes('/500'));
    expect(countText).not.toBeNull();

    document.querySelector('.modal-overlay').click();
  });
});

// ============================================================================
// DAY 5: CARD MANAGEMENT
// ============================================================================

describe('Card Management', () => {
  test('delete removes card from IndexedDB', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    const originalConfirm = window.confirm;
    window.confirm = () => true;

    const mod = await import('./flashcards.js');
    let completed = false;
    await mod.deleteCardWithConfirmation(card.id, () => { completed = true; });

    const remaining = await FlashcardRepository.getByLecture(lecture.id);
    expect(remaining.length).toBe(0);
    expect(completed).toBe(true);

    window.confirm = originalConfirm;
  });
});

// ============================================================================
// DAY 6: INTEGRATION TESTS (20 tests)
// ============================================================================

describe('Integration: Full Lifecycle', () => {
  test('create lecture -> generate cards -> study -> verify mastery', async () => {
    const lecture = await LectureRepository.create({ title: 'AI Fundamentals' });

    await SegmentRepository.create({
      lectureId: lecture.id,
      startTime: 0,
      endTime: 60,
      metadata: { text: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.' }
    });

    const generated = await autoGenerateFlashcards(lecture.id);
    expect(generated).toBeGreaterThan(0);

    const cards = await FlashcardRepository.getByLecture(lecture.id);
    expect(cards.length).toBeGreaterThan(0);

    const session = new StudySession(cards, lecture.id);
    expect(session.isComplete()).toBe(false);

    while (!session.isComplete()) {
      await session.submitReview(4);
    }

    expect(session.isComplete()).toBe(true);
    expect(session.getAccuracy()).toBe(100);

    const updatedCards = await FlashcardRepository.getByLecture(lecture.id);
    for (const card of updatedCards) {
      expect(card.status).not.toBe(FLASHCARD_STATUS.NEW);
      expect(card.repetitions).toBeGreaterThan(0);
    }
  });

  test('navigation: landing -> playground -> study -> back -> playground', async () => {
    const lecture = await LectureRepository.create({ title: 'Nav Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    window.location.hash = '#/';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.LANDING);

    window.location.hash = '#/playground';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.PLAYGROUND);
    await new Promise(r => setTimeout(r, 50));

    window.location.hash = '#/study/' + lecture.id;
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.STUDY);
    await new Promise(r => setTimeout(r, 50));

    window.location.hash = '#/playground';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.PLAYGROUND);
  });

  test('empty lecture shows "All caught up"', async () => {
    const lecture = await LectureRepository.create({ title: 'Empty' });

    await startStudyView(lecture.id);
    await new Promise(r => setTimeout(r, 50));

    const cardArea = document.getElementById('study-card-area');
    expect(cardArea.textContent).toContain('All caught up');
  });

  test('single card study session', async () => {
    const lecture = await LectureRepository.create({ title: 'Single' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Solo Q', back: 'Solo A' });

    const session = new StudySession([card], lecture.id);
    expect(session.getProgress().total).toBe(1);

    await session.submitReview(5);
    expect(session.isComplete()).toBe(true);
    expect(session.getAccuracy()).toBe(100);
  });
});

describe('Integration: Edge Cases', () => {
  test('browser refresh mid-session does not crash', async () => {
    const lecture = await LectureRepository.create({ title: 'Refresh Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    window.location.hash = '#/study/' + lecture.id;
    handleRouteChange();
    await new Promise(r => setTimeout(r, 50));

    handleRouteChange();
    await new Promise(r => setTimeout(r, 50));

    const cardArea = document.getElementById('study-card-area');
    expect(cardArea.children.length).toBeGreaterThan(0);
  });

  test('invalid study route lectureId is sanitized', () => {
    // Test sanitizeId directly since browser URL-encodes special chars
    const sanitized = sanitizeId('abc<script>alert(1)</script>');
    expect(sanitized).toBe('abcscriptalert1script');
    // Also verify that sanitized IDs get into state
    window.location.hash = '#/study/valid-id_123';
    handleRouteChange();
    expect(state.currentLectureId).toBe('valid-id_123');
  });

  test('rapid view switching does not crash', () => {
    const routes = ['#/', '#/playground', '#/study/abc', '#/playground', '#/'];
    for (const route of routes) {
      window.location.hash = route;
      handleRouteChange();
    }
    expect(state.currentView).toBe(VIEWS.LANDING);
  });

  test('scroll anchor hashes do not change view', () => {
    window.location.hash = '#/playground';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.PLAYGROUND);

    window.location.hash = '#features';
    handleRouteChange();
    expect(state.currentView).toBe(VIEWS.PLAYGROUND);
  });
});

describe('Integration: Accessibility', () => {
  test('playground view has correct ARIA landmark', () => {
    const section = document.getElementById('playground-view');
    expect(section.getAttribute('aria-label')).toBe('Student Playground');
  });

  test('study view has correct ARIA landmark', () => {
    const section = document.getElementById('study-view');
    expect(section.getAttribute('aria-label')).toBe('Study Session');
  });

  test('library grid has list role', () => {
    const grid = document.getElementById('library-grid');
    expect(grid.getAttribute('role')).toBe('list');
  });

  test('hidden views have inert attribute', () => {
    const playground = document.getElementById('playground-view');
    expect(playground.hasAttribute('inert')).toBe(true);

    window.location.hash = '#/playground';
    handleRouteChange();
    expect(playground.hasAttribute('inert')).toBe(false);

    window.location.hash = '#/';
    handleRouteChange();
    expect(playground.hasAttribute('inert')).toBe(true);
  });

  test('flashcard quality buttons have min 44px touch target', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    await startStudyView(lecture.id);
    await new Promise(r => setTimeout(r, 50));

    const controls = document.getElementById('study-controls');
    const buttons = controls.querySelectorAll('.sp-study-controls__quality-btn');
    for (const btn of buttons) {
      expect(btn.style.minHeight).toBe('44px');
    }
  });
});

describe('Integration: Storage Consistency', () => {
  test('SM-2 review updates card in IndexedDB', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Q', back: 'A' });

    await FlashcardRepository.reviewCard(card.id, 4);
    const updated = await FlashcardRepository.getById(card.id);

    expect(updated.repetitions).toBe(1);
    expect(updated.interval).toBe(1);
    expect(updated.status).toBe(FLASHCARD_STATUS.LEARNING);
    expect(updated.dueDate).toBeGreaterThan(Date.now() - 1000);
  });

  test('manual card creation persists to IndexedDB', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });

    await FlashcardRepository.create({
      lectureId: lecture.id,
      front: 'Persisted Q',
      back: 'Persisted A'
    });

    const cards = await FlashcardRepository.getByLecture(lecture.id);
    expect(cards.length).toBe(1);
    expect(cards[0].front).toBe('Persisted Q');
    expect(cards[0].back).toBe('Persisted A');
    expect(cards[0].status).toBe(FLASHCARD_STATUS.NEW);
  });

  test('auto-generated cards have correct structure', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    await SegmentRepository.create({
      lectureId: lecture.id,
      startTime: 0,
      endTime: 60,
      metadata: { text: 'Neural networks are computational models inspired by the human brain structure and function.' }
    });

    await autoGenerateFlashcards(lecture.id);
    const cards = await FlashcardRepository.getByLecture(lecture.id);

    expect(cards.length).toBe(1);
    expect(cards[0].front).toBeTruthy();
    expect(cards[0].back).toBeTruthy();
    expect(cards[0].lectureId).toBe(lecture.id);
    expect(cards[0].status).toBe(FLASHCARD_STATUS.NEW);
    expect(cards[0].easeFactor).toBe(2.5);
    expect(cards[0].repetitions).toBe(0);
  });

  test('edit only updates front/back, preserves SM-2 state', async () => {
    const lecture = await LectureRepository.create({ title: 'Test' });
    const card = await FlashcardRepository.create({ lectureId: lecture.id, front: 'Old Q', back: 'Old A' });

    await FlashcardRepository.reviewCard(card.id, 4);
    const reviewed = await FlashcardRepository.getById(card.id);

    await FlashcardRepository.update(card.id, { front: 'New Q', back: 'New A' });
    const edited = await FlashcardRepository.getById(card.id);

    expect(edited.front).toBe('New Q');
    expect(edited.back).toBe('New A');
    expect(edited.repetitions).toBe(reviewed.repetitions);
    expect(edited.easeFactor).toBe(reviewed.easeFactor);
    expect(edited.interval).toBe(reviewed.interval);
  });
});

describe('Integration: Performance', () => {
  test('render 100 library cards without error', async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(LectureRepository.create({ title: 'Lecture ' + i }));
    }
    await Promise.all(promises);

    await renderLibraryView();
    await new Promise(r => setTimeout(r, 200));

    const grid = document.getElementById('library-grid');
    const cards = grid.querySelectorAll('.sp-library-card');
    expect(cards.length).toBe(100);
  });
});

describe('Integration: Toast Notifications', () => {
  test('showToast adds toast to container', () => {
    showToast('success', 'Test', 'Test message');

    const container = document.getElementById('toast-container');
    const toasts = container.querySelectorAll('.toast');
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toContain('Test');
  });
});

describe('Integration: Listener Cleanup', () => {
  test('cleanupListeners clears registry', () => {
    const el = createElement('button', '');
    registerListener(el, 'click', () => {});
    registerListener(el, 'click', () => {});

    cleanupListeners();
    // No error thrown = success
  });
});

// ============================================================================
// renderConfetti — Day 0 Tech Debt
// ============================================================================

describe('renderConfetti', () => {
  afterEach(() => {
    // Clean up any confetti containers left in the DOM
    document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
      if (el.style.pointerEvents === 'none') el.remove();
    });
  });

  test('creates confetti container with particles', () => {
    renderConfetti();
    const containers = document.querySelectorAll('[aria-hidden="true"]');
    const confettiContainer = Array.from(containers).find(
      el => el.style.pointerEvents === 'none'
    );
    expect(confettiContainer).toBeTruthy();
    expect(confettiContainer.children.length).toBe(30);
  });

  test('auto-removes confetti container after timeout', () => {
    jest.useFakeTimers();
    renderConfetti();
    const containers = document.querySelectorAll('[aria-hidden="true"]');
    const confettiContainer = Array.from(containers).find(
      el => el.style.pointerEvents === 'none'
    );
    expect(confettiContainer.parentNode).toBe(document.body);

    jest.advanceTimersByTime(4000);
    expect(confettiContainer.parentNode).toBeNull();
    jest.useRealTimers();
  });
});
