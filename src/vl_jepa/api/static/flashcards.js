/**
 * Lecture Mind - Flashcard System
 *
 * Hash-based router, library grid, 3D flip cards, SM-2 study sessions,
 * auto-generation from segments, and manual CRUD.
 *
 * Safe DOM: createElement + textContent only, zero innerHTML.
 * All listeners registered for cleanup. Module-scoped state.
 *
 * @module flashcards
 * @version 1.0.0
 */

import {
  FlashcardRepository,
  LectureRepository,
  SegmentRepository,
  ProgressRepository,
  BookmarkRepository,
  FLASHCARD_STATUS,
  createFlashcard
} from './storage/index.js';

import {
  createElement,
  clearElement,
  showElement,
  hideElement,
  sanitizeId,
  registerListener,
  cleanupListeners,
  removeListenersForTarget
} from './dom-utils.js';

// ============================================================================
// STATE
// ============================================================================

const state = {
  currentView: null,
  currentLectureId: null,
  studySession: null,
  searchQuery: ''
};

// Listener registry, DOM utilities, and sanitizeId imported from dom-utils.js

// DOM utilities (createElement, clearElement, showElement, hideElement) imported from dom-utils.js

const prefersReducedMotion = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };

// ============================================================================
// TOAST NOTIFICATIONS (simple version)
// ============================================================================

function showToast(variant, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = createElement('div', 'toast', { 'data-variant': variant });
  const content = createElement('div', 'toast-content');
  const titleEl = createElement('p', 'toast-title', { textContent: title });
  const messageEl = createElement('p', 'toast-message', { textContent: message });
  content.appendChild(titleEl);
  content.appendChild(messageEl);
  toast.appendChild(content);

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 5000);
}

// sanitizeId imported from dom-utils.js

// ============================================================================
// HOOKABLE RENDERERS (callback registration for library.js)
// ============================================================================

let _libraryRenderer = null;
let _lectureDetailRenderer = null;
let _dashboardRenderer = null;
let _onQuizResult = null;
let _onSessionComplete = null;

function setLibraryRenderer(fn) { _libraryRenderer = fn; }
function setLectureDetailRenderer(fn) { _lectureDetailRenderer = fn; }
function setDashboardRenderer(fn) { _dashboardRenderer = fn; }
function setOnQuizResult(fn) { _onQuizResult = fn; }
function setOnSessionComplete(fn) { _onSessionComplete = fn; }

/** Per-view cleanup callbacks registered by downstream modules (e.g. library.js) */
const _viewCleanupCallbacks = new Map();

/**
 * Register a cleanup function for a specific view.
 * Called during unmountView to prevent memory leaks (e.g. stale keydown handlers).
 */
function registerViewCleanup(viewName, fn) {
  if (!_viewCleanupCallbacks.has(viewName)) {
    _viewCleanupCallbacks.set(viewName, []);
  }
  _viewCleanupCallbacks.get(viewName).push(fn);
}

// ============================================================================
// ROUTER
// ============================================================================

/** Anchor-only hashes that should scroll, not route */
const SCROLL_ANCHORS = new Set([
  'features', 'how-it-works', 'tech-stack', 'app-section'
]);

const VIEWS = {
  LANDING: 'landing',
  PLAYGROUND: 'playground',
  STUDY: 'study',
  LECTURE_DETAIL: 'lecture-detail',
  DASHBOARD: 'dashboard'
};

function parseHash(hash) {
  const raw = hash.replace(/^#\/?/, '');

  if (!raw || raw === '/') {
    return { view: VIEWS.LANDING, params: {} };
  }

  if (SCROLL_ANCHORS.has(raw)) {
    return { view: null, params: {} }; // not a route
  }

  if (raw === 'playground') {
    return { view: VIEWS.PLAYGROUND, params: {} };
  }

  const studyMatch = raw.match(/^study\/(.+)$/);
  if (studyMatch) {
    return { view: VIEWS.STUDY, params: { lectureId: sanitizeId(studyMatch[1]) } };
  }

  const lectureMatch = raw.match(/^lecture\/(.+)$/);
  if (lectureMatch) {
    return { view: VIEWS.LECTURE_DETAIL, params: { lectureId: sanitizeId(lectureMatch[1]) } };
  }

  if (raw === 'dashboard') {
    return { view: VIEWS.DASHBOARD, params: {} };
  }

  return { view: VIEWS.LANDING, params: {} };
}

function navigateTo(hash) {
  window.location.hash = hash;
}

function handleRouteChange() {
  const { view, params } = parseHash(window.location.hash);

  if (view === null) return; // scroll anchor, let browser handle

  // Unmount current view
  if (state.currentView && state.currentView !== view) {
    unmountView(state.currentView);
  }

  state.currentView = view;

  if ((view === VIEWS.STUDY || view === VIEWS.LECTURE_DETAIL) && params.lectureId) {
    state.currentLectureId = params.lectureId;
  }

  mountView(view, params);
  updateNavHighlight(view);
}

function updateNavHighlight(view) {
  const navLinks = document.querySelectorAll('.header-nav .nav-link');
  navLinks.forEach(link => {
    link.classList.remove('nav-link--active');
    const href = link.getAttribute('href');
    if ((view === VIEWS.PLAYGROUND || view === VIEWS.LECTURE_DETAIL) && href === '#/playground') {
      link.classList.add('nav-link--active');
    }
  });
}

// ============================================================================
// VIEW LIFECYCLE
// ============================================================================

function getViewSections() {
  return {
    landing: document.getElementById('app-section'),
    playground: document.getElementById('playground-view'),
    study: document.getElementById('study-view'),
    lectureDetail: document.getElementById('lecture-detail-view'),
    dashboard: document.getElementById('dashboard-view')
  };
}

// Also hide/show the landing page sections (hero, features, etc.)
function getLandingElements() {
  const ids = ['hero', 'features', 'how-it-works', 'tech-stack'];
  return ids.map(id => document.getElementById(id)).filter(Boolean);
}

function mountView(view, params = {}) {
  const sections = getViewSections();
  const landingEls = getLandingElements();
  const footer = document.querySelector('.footer-landing');

  // Hide all views first
  for (const el of Object.values(sections)) {
    if (el) hideElement(el);
  }
  for (const el of landingEls) {
    if (el) hideElement(el);
  }
  if (footer) hideElement(footer);

  switch (view) {
    case VIEWS.LANDING:
      if (sections.landing) showElement(sections.landing);
      for (const el of landingEls) {
        if (el) showElement(el);
      }
      if (footer) showElement(footer);
      break;

    case VIEWS.PLAYGROUND:
      if (sections.playground) {
        showElement(sections.playground);
        if (_libraryRenderer) _libraryRenderer();
        else renderLibraryView(); // fallback for tests without library.js
      }
      break;

    case VIEWS.LECTURE_DETAIL:
      if (sections.lectureDetail) {
        showElement(sections.lectureDetail);
        state.currentLectureId = params.lectureId;
        if (_lectureDetailRenderer) _lectureDetailRenderer(params.lectureId);
      }
      break;

    case VIEWS.STUDY:
      if (sections.study) {
        showElement(sections.study);
        startStudyView(params.lectureId);
      }
      break;

    case VIEWS.DASHBOARD:
      if (sections.dashboard) {
        showElement(sections.dashboard);
        const dashContainer = sections.dashboard.querySelector('.section-container') || sections.dashboard;
        clearElement(dashContainer);
        if (_dashboardRenderer) {
          try {
            const p = _dashboardRenderer(dashContainer);
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch (_e) { /* dashboard render must not crash router */ }
        }
      }
      break;
  }
}

function unmountView(view) {
  // Run registered cleanup callbacks for this view
  const callbacks = _viewCleanupCallbacks.get(view);
  if (callbacks) {
    for (const cb of callbacks) cb();
  }

  if (view === VIEWS.STUDY) {
    cleanupStudySession();
  }
  if (view === VIEWS.LECTURE_DETAIL) {
    const header = document.getElementById('lecture-detail-header');
    const content = document.getElementById('lecture-detail-content');
    if (header) clearElement(header);
    if (content) clearElement(content);
  }
}

function cleanupStudySession() {
  if (state.studySession) {
    if (state.studySession._timerInterval) {
      clearInterval(state.studySession._timerInterval);
    }
    state.studySession = null;
  }
}

// ============================================================================
// LIBRARY VIEW (Day 2)
// ============================================================================

async function renderLibraryView() {
  const grid = document.getElementById('library-grid');
  const emptyState = document.getElementById('library-empty');
  const searchContainer = document.getElementById('playground-search');
  if (!grid || !emptyState) return;

  clearElement(grid);

  // Render search bar
  if (searchContainer && !searchContainer.hasChildNodes()) {
    renderSearchBar(searchContainer);
  }

  // Show loading skeleton
  renderLibrarySkeleton(grid, 6);

  let lectures;
  try {
    lectures = await LectureRepository.getAll();
  } catch (_err) {
    clearElement(grid);
    showToast('error', 'Error', 'Failed to load lectures');
    return;
  }

  clearElement(grid);

  // Filter by search query
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    lectures = lectures.filter(l => l.title && l.title.toLowerCase().includes(q));
  }

  // Sort by most recent first
  lectures.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  if (lectures.length === 0) {
    hideElement(grid);
    showElement(emptyState);
    return;
  }

  hideElement(emptyState);
  showElement(grid);

  for (let i = 0; i < lectures.length; i++) {
    const lecture = lectures[i];
    const card = await renderLibraryCard(lecture, i);
    grid.appendChild(card);
  }
}

function renderSearchBar(container) {
  clearElement(container);
  const input = createElement('input', 'input', {
    type: 'text',
    placeholder: 'Search lectures...',
    'aria-label': 'Search lectures'
  });
  input.style.marginBottom = 'var(--space-4, 1rem)';
  input.style.width = '100%';
  input.style.maxWidth = '400px';

  let debounceTimer = null;
  registerListener(input, 'input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = input.value;
      renderLibraryView();
    }, 300);
  });

  container.appendChild(input);
}

async function renderLibraryCard(lecture, index) {
  const card = createElement('div', 'sp-library-card', {
    role: 'listitem',
    tabindex: '0',
    'aria-label': `Lecture: ${lecture.title || 'Untitled'}`
  });

  if (!prefersReducedMotion.matches) {
    card.classList.add('animate-card-entrance');
    card.style.setProperty('--stagger-index', String(index));
  }

  // Thumbnail placeholder
  const thumb = createElement('div', 'sp-library-card__thumbnail');
  const thumbIcon = createElement('div', '', {
    textContent: '🎬',
    'aria-hidden': 'true'
  });
  thumbIcon.style.cssText = 'font-size:2rem;display:flex;align-items:center;justify-content:center;height:100%';
  thumb.appendChild(thumbIcon);
  card.appendChild(thumb);

  // Meta section
  const meta = createElement('div', 'sp-library-card__meta');

  const title = createElement('h3', 'sp-library-card__title', {
    textContent: lecture.title || 'Untitled Lecture'
  });
  meta.appendChild(title);

  // Progress bar
  const progress = lecture.watchProgress || 0;
  const progressRow = createElement('div', 'sp-library-card__progress');
  const progressBar = createElement('div', 'sp-library-card__progress-bar');
  const progressFill = createElement('div', 'sp-library-card__progress-fill');
  progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  progressBar.appendChild(progressFill);
  progressRow.appendChild(progressBar);
  const progressLabel = createElement('span', '', { textContent: `${Math.round(progress)}%` });
  progressRow.appendChild(progressLabel);
  meta.appendChild(progressRow);

  // Flashcard count + mastery badge
  let flashcards = [];
  try {
    flashcards = await FlashcardRepository.getByLecture(lecture.id);
  } catch (_e) { /* ignore */ }

  const statsRow = createElement('div', 'sp-library-card__progress');
  const cardCount = createElement('span', '', {
    textContent: `${flashcards.length} card${flashcards.length !== 1 ? 's' : ''}`
  });
  statsRow.appendChild(cardCount);

  if (flashcards.length > 0) {
    const badge = createMasteryBadge(getDominantStatus(flashcards));
    statsRow.appendChild(badge);
  }

  meta.appendChild(statsRow);
  card.appendChild(meta);

  // Click to study
  const handleClick = () => navigateTo(`#/study/${lecture.id}`);
  registerListener(card, 'click', handleClick);
  registerListener(card, 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  });

  return card;
}

function renderLibrarySkeleton(container, count) {
  for (let i = 0; i < count; i++) {
    const skeleton = createElement('div', 'sp-library-card');
    const thumbSkel = createElement('div', 'sp-library-card__thumbnail sp-skeleton');
    skeleton.appendChild(thumbSkel);
    const metaSkel = createElement('div', 'sp-library-card__meta');
    const titleSkel = createElement('div', 'sp-skeleton');
    titleSkel.style.cssText = 'height:1.2rem;width:80%;border-radius:4px';
    metaSkel.appendChild(titleSkel);
    const barSkel = createElement('div', 'sp-skeleton');
    barSkel.style.cssText = 'height:4px;width:100%;border-radius:4px;margin-top:8px';
    metaSkel.appendChild(barSkel);
    skeleton.appendChild(metaSkel);
    container.appendChild(skeleton);
  }
}

function getDominantStatus(flashcards) {
  const counts = {};
  for (const card of flashcards) {
    counts[card.status] = (counts[card.status] || 0) + 1;
  }
  let dominant = FLASHCARD_STATUS.NEW;
  let max = 0;
  for (const [status, cnt] of Object.entries(counts)) {
    if (cnt > max) { max = cnt; dominant = status; }
  }
  return dominant;
}

function createMasteryBadge(status) {
  const labels = {
    [FLASHCARD_STATUS.NEW]: 'New',
    [FLASHCARD_STATUS.LEARNING]: 'Learning',
    [FLASHCARD_STATUS.REVIEW]: 'Review',
    [FLASHCARD_STATUS.MASTERED]: 'Mastered'
  };
  const badge = createElement('span', `sp-mastery-badge sp-mastery-badge--${status}`, {
    textContent: labels[status] || status
  });
  return badge;
}

// ============================================================================
// FLASHCARD COMPONENT (Day 3)
// ============================================================================

function renderFlashcard(card, cardIndex, totalCards) {
  const container = createElement('div', `sp-flashcard sp-flashcard--${card.status}`, {
    role: 'region',
    'aria-label': `Flashcard ${cardIndex + 1} of ${totalCards}`,
    tabindex: '0'
  });

  const inner = createElement('div', 'sp-flashcard__inner');

  // Front face
  const front = createElement('div', 'sp-flashcard__front');
  const frontContent = createElement('div', 'sp-flashcard__content');

  const cardNumber = createElement('div', 'sp-flashcard__number', {
    textContent: `${cardIndex + 1} of ${totalCards}`
  });
  cardNumber.style.cssText = 'position:absolute;top:12px;right:16px;font-size:0.75rem;color:var(--foreground-muted)';
  front.style.position = 'relative';
  front.appendChild(cardNumber);

  const frontBadge = createMasteryBadge(card.status);
  frontBadge.style.cssText = 'position:absolute;top:12px;left:16px';
  front.appendChild(frontBadge);

  const frontText = createElement('p', '', { textContent: card.front });
  frontText.style.cssText = 'font-size:1.125rem;line-height:1.6;max-height:100%;overflow-y:auto;padding:0 8px';
  frontContent.appendChild(frontText);
  front.appendChild(frontContent);

  const flipHint = createElement('div', '', { textContent: 'Click or press Space to flip' });
  flipHint.style.cssText = 'position:absolute;bottom:12px;font-size:0.7rem;color:var(--foreground-muted)';
  front.appendChild(flipHint);

  // Back face
  const back = createElement('div', 'sp-flashcard__back');
  const backContent = createElement('div', 'sp-flashcard__content');
  const backText = createElement('p', '', { textContent: card.back });
  backText.style.cssText = 'font-size:1.125rem;line-height:1.6;max-height:100%;overflow-y:auto;padding:0 8px';
  backContent.appendChild(backText);
  back.appendChild(backContent);

  inner.appendChild(front);
  inner.appendChild(back);
  container.appendChild(inner);

  // Flip on click
  const toggleFlip = () => {
    container.classList.toggle('sp-flashcard--flipped');
  };
  registerListener(container, 'click', toggleFlip);

  // Keyboard: Space/Enter to flip
  registerListener(container, 'keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleFlip();
    }
  });

  // will-change management
  registerListener(container, 'pointerdown', () => {
    inner.style.willChange = 'transform';
  });
  registerListener(inner, 'transitionend', () => {
    inner.style.willChange = '';
  });

  return container;
}

// ============================================================================
// STUDY SESSION (Day 4)
// ============================================================================

class StudySession {
  constructor(cards, lectureId) {
    this.cards = cards;
    this.lectureId = lectureId;
    this.currentIndex = 0;
    this.reviewed = 0;
    this.correct = 0; // quality >= 3
    this.masteryChanges = [];
    this.startTime = Date.now();
    this._timerInterval = null;
  }

  currentCard() {
    return this.cards[this.currentIndex] || null;
  }

  getProgress() {
    return {
      current: this.currentIndex + 1,
      total: this.cards.length,
      completed: this.reviewed,
      mastered: this.cards.filter(c => c.status === FLASHCARD_STATUS.MASTERED).length
    };
  }

  isComplete() {
    return this.currentIndex >= this.cards.length;
  }

  async submitReview(quality) {
    const card = this.currentCard();
    if (!card) return null;

    const oldStatus = card.status;
    const updated = await FlashcardRepository.reviewCard(card.id, quality);

    // Update the local card reference
    this.cards[this.currentIndex] = updated;

    this.reviewed++;
    if (quality >= 3) this.correct++;

    if (updated.status !== oldStatus) {
      this.masteryChanges.push({
        cardId: card.id,
        from: oldStatus,
        to: updated.status
      });
    }

    // Fire analytics callback (fire-and-forget, async-safe)
    if (_onQuizResult) {
      try {
        const p = _onQuizResult({ lectureId: this.lectureId, flashcardId: card.id, quality, oldStatus, newStatus: updated.status });
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_e) { /* analytics must not break study flow */ }
    }

    this.currentIndex++;
    return updated;
  }

  getAccuracy() {
    if (this.reviewed === 0) return 0;
    return Math.round((this.correct / this.reviewed) * 100);
  }

  getElapsedSeconds() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

async function startStudyView(lectureId) {
  const headerEl = document.getElementById('study-header');
  const cardArea = document.getElementById('study-card-area');
  const controlsArea = document.getElementById('study-controls');
  const completeArea = document.getElementById('study-complete');
  if (!headerEl || !cardArea || !controlsArea || !completeArea) return;

  clearElement(headerEl);
  clearElement(cardArea);
  clearElement(controlsArea);
  hideElement(completeArea);
  clearElement(completeArea);

  // Loading skeleton
  const skeleton = createElement('div', 'sp-skeleton');
  skeleton.style.cssText = 'width:100%;max-width:480px;aspect-ratio:3/2;margin:0 auto;border-radius:var(--radius-xl,12px)';
  cardArea.appendChild(skeleton);

  let cards;
  try {
    const allCards = await FlashcardRepository.getByLecture(lectureId);
    const now = Date.now();
    // Get cards that are due or new
    cards = allCards.filter(c => c.dueDate <= now || c.status === FLASHCARD_STATUS.NEW);
    // Sort: new cards first, then by due date
    cards.sort((a, b) => {
      if (a.status === FLASHCARD_STATUS.NEW && b.status !== FLASHCARD_STATUS.NEW) return -1;
      if (b.status === FLASHCARD_STATUS.NEW && a.status !== FLASHCARD_STATUS.NEW) return 1;
      return a.dueDate - b.dueDate;
    });
  } catch (_err) {
    clearElement(cardArea);
    showToast('error', 'Error', 'Failed to load flashcards');
    return;
  }

  clearElement(cardArea);

  if (cards.length === 0) {
    renderAllCaughtUp(cardArea, headerEl);
    return;
  }

  // Lecture title in header
  let lecture;
  try { lecture = await LectureRepository.getById(lectureId); } catch (_e) { /* ignore */ }

  const session = new StudySession(cards, lectureId);
  state.studySession = session;

  // Header: back button + title + progress ring
  renderStudyHeader(headerEl, lecture, session);

  // Timer
  session._timerInterval = setInterval(() => {
    updateTimerDisplay(session);
  }, 1000);

  renderCurrentCard(session);
}

function renderAllCaughtUp(cardArea, headerEl) {
  clearElement(headerEl);

  const backBtn = createElement('button', 'btn', {
    'data-variant': 'ghost',
    'data-size': 'sm',
    textContent: 'Back to Library'
  });
  registerListener(backBtn, 'click', () => navigateTo('#/playground'));
  headerEl.appendChild(backBtn);

  const msg = createElement('div', '');
  msg.style.cssText = 'text-align:center;padding:4rem 2rem';

  const icon = createElement('div', '', { textContent: '🎉' });
  icon.style.cssText = 'font-size:3rem;margin-bottom:1rem';
  const title = createElement('h3', '', { textContent: 'All caught up!' });
  title.style.cssText = 'font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;color:var(--foreground)';
  const sub = createElement('p', '', { textContent: 'No flashcards due for review. Check back later!' });
  sub.style.cssText = 'color:var(--foreground-muted)';

  msg.appendChild(icon);
  msg.appendChild(title);
  msg.appendChild(sub);
  cardArea.appendChild(msg);
}

function renderStudyHeader(headerEl, lecture, session) {
  clearElement(headerEl);
  headerEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem';

  // Left: back + title
  const left = createElement('div', '');
  left.style.cssText = 'display:flex;align-items:center;gap:0.75rem';

  const backBtn = createElement('button', 'btn', {
    'data-variant': 'ghost',
    'data-size': 'sm',
    textContent: '← Back'
  });
  registerListener(backBtn, 'click', () => navigateTo('#/playground'));
  left.appendChild(backBtn);

  const titleText = lecture ? lecture.title : 'Study Session';
  const title = createElement('h2', '', { textContent: titleText });
  title.style.cssText = 'font-size:1.25rem;font-weight:700;color:var(--foreground)';
  left.appendChild(title);

  // Add Card button
  const addBtn = createElement('button', 'btn', {
    'data-variant': 'ghost',
    'data-size': 'sm',
    textContent: '+ Add Card',
    'aria-label': 'Add new flashcard'
  });
  registerListener(addBtn, 'click', (e) => {
    e.stopPropagation();
    openCreateCardModal(session.lectureId, session);
  });
  left.appendChild(addBtn);

  headerEl.appendChild(left);

  // Right: progress ring + stats
  const right = createElement('div', '');
  right.style.cssText = 'display:flex;align-items:center;gap:1rem';

  const ring = createProgressRing(session);
  right.appendChild(ring);

  const stats = createElement('div', '', { id: 'study-stats' });
  stats.style.cssText = 'font-size:0.8rem;color:var(--foreground-muted)';
  updateStatsDisplay(stats, session);
  right.appendChild(stats);

  headerEl.appendChild(right);
}

function createProgressRing(session) {
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = session.getProgress();
  const fraction = progress.total > 0 ? progress.completed / progress.total : 0;
  const offset = circumference * (1 - fraction);

  const wrapper = createElement('div', 'sp-progress-ring', { id: 'progress-ring-wrapper' });
  wrapper.style.cssText = `width:${size}px;height:${size}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('class', 'sp-progress-ring__bg');
  bgCircle.setAttribute('cx', String(size / 2));
  bgCircle.setAttribute('cy', String(size / 2));
  bgCircle.setAttribute('r', String(radius));
  svg.appendChild(bgCircle);

  const fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fgCircle.setAttribute('class', 'sp-progress-ring__circle');
  fgCircle.setAttribute('id', 'progress-ring-circle');
  fgCircle.setAttribute('cx', String(size / 2));
  fgCircle.setAttribute('cy', String(size / 2));
  fgCircle.setAttribute('r', String(radius));
  fgCircle.style.strokeDasharray = String(circumference);
  fgCircle.style.strokeDashoffset = String(offset);
  svg.appendChild(fgCircle);

  wrapper.appendChild(svg);

  const valueEl = createElement('span', 'sp-progress-ring__value', {
    id: 'progress-ring-value',
    textContent: `${progress.completed}/${progress.total}`
  });
  wrapper.appendChild(valueEl);

  return wrapper;
}

function updateProgressRing(session) {
  const circle = document.getElementById('progress-ring-circle');
  const valueEl = document.getElementById('progress-ring-value');
  if (!circle || !valueEl) return;

  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = session.getProgress();
  const fraction = progress.total > 0 ? progress.completed / progress.total : 0;
  const offset = circumference * (1 - fraction);

  circle.style.strokeDashoffset = String(offset);
  valueEl.textContent = `${progress.completed}/${progress.total}`;
}

function updateStatsDisplay(statsEl, session) {
  if (!statsEl) statsEl = document.getElementById('study-stats');
  if (!statsEl) return;

  const progress = session.getProgress();
  const elapsed = session.getElapsedSeconds();
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  clearElement(statsEl);
  const remaining = createElement('div', '', {
    textContent: `${progress.total - progress.completed} remaining`
  });
  const timeEl = createElement('div', '', {
    id: 'study-timer',
    textContent: `${mins}:${String(secs).padStart(2, '0')}`
  });
  const accuracy = createElement('div', '', {
    textContent: `${session.getAccuracy()}% accuracy`
  });

  statsEl.appendChild(remaining);
  statsEl.appendChild(timeEl);
  statsEl.appendChild(accuracy);
}

function updateTimerDisplay(session) {
  const timerEl = document.getElementById('study-timer');
  if (!timerEl) return;
  const elapsed = session.getElapsedSeconds();
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  timerEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
}

function renderCurrentCard(session) {
  const cardArea = document.getElementById('study-card-area');
  const controlsArea = document.getElementById('study-controls');
  if (!cardArea || !controlsArea) return;

  if (session.isComplete()) {
    renderSessionComplete(session);
    return;
  }

  clearElement(cardArea);
  clearElement(controlsArea);

  const card = session.currentCard();
  if (!card) return;

  const flashcardEl = renderFlashcard(card, session.currentIndex, session.cards.length);
  flashcardEl.style.margin = '0 auto';
  cardArea.appendChild(flashcardEl);

  // Quality buttons (shown below card, user rates after flipping)
  const controls = createElement('div', 'sp-study-controls');
  controls.style.cssText = 'margin-top:1.5rem;justify-content:center';

  const qualities = [
    { quality: 1, label: 'Again', className: 'sp-study-controls__quality-btn--fail' },
    { quality: 3, label: 'Hard', className: 'sp-study-controls__quality-btn--hard' },
    { quality: 4, label: 'Good', className: 'sp-study-controls__quality-btn--good' },
    { quality: 5, label: 'Easy', className: 'sp-study-controls__quality-btn--easy' }
  ];

  let isSubmitting = false;

  for (const q of qualities) {
    const btn = createElement('button', `sp-study-controls__quality-btn ${q.className}`, {
      textContent: q.label,
      'aria-label': `Rate: ${q.label} (quality ${q.quality})`,
      'data-quality': String(q.quality)
    });
    btn.style.minWidth = '80px';
    btn.style.minHeight = '44px'; // Touch target

    registerListener(btn, 'click', async (e) => {
      e.stopPropagation(); // Don't flip card
      if (isSubmitting) return;
      isSubmitting = true;

      // Disable all buttons during submission
      controls.querySelectorAll('button').forEach(b => { b.disabled = true; });

      const oldStatus = card.status;
      const updated = await session.submitReview(q.quality);

      // Mastery pulse if status changed
      if (updated && updated.status !== oldStatus) {
        triggerMasteryPulse(flashcardEl);
      }

      updateProgressRing(session);
      updateStatsDisplay(null, session);

      // Delay before next card for visual feedback
      setTimeout(() => {
        isSubmitting = false;
        renderCurrentCard(session);
      }, prefersReducedMotion.matches ? 0 : 300);
    });

    controls.appendChild(btn);
  }

  controlsArea.appendChild(controls);

  // Keyboard navigation: ArrowLeft/Right for prev/next (informational only in study)
  // Focus the card for keyboard interaction
  flashcardEl.focus();
}

function triggerMasteryPulse(element) {
  if (prefersReducedMotion.matches) return;
  element.classList.add('animate-mastery-pulse');
  const cleanup = () => {
    element.classList.remove('animate-mastery-pulse');
    element.removeEventListener('animationend', cleanup);
  };
  element.addEventListener('animationend', cleanup);
}

function renderSessionComplete(session) {
  const cardArea = document.getElementById('study-card-area');
  const controlsArea = document.getElementById('study-controls');
  const completeArea = document.getElementById('study-complete');
  if (!cardArea || !controlsArea || !completeArea) return;

  clearElement(cardArea);
  clearElement(controlsArea);
  clearElement(completeArea);
  showElement(completeArea);

  if (session._timerInterval) {
    clearInterval(session._timerInterval);
    session._timerInterval = null;
  }

  const accuracy = session.getAccuracy();
  const elapsed = session.getElapsedSeconds();

  // Fire analytics callback (fire-and-forget, async-safe)
  if (_onSessionComplete) {
    try {
      const p = _onSessionComplete({
        lectureId: session.lectureId,
        type: 'quiz',
        duration: elapsed,
        cardsReviewed: session.reviewed,
        correct: session.correct,
        accuracy,
        masteryChanges: session.masteryChanges
      });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_e) { /* analytics must not break session complete */ }
  }
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  // Confetti on high accuracy
  if (accuracy >= 80 && !prefersReducedMotion.matches) {
    renderConfetti();
  }

  completeArea.style.cssText = 'text-align:center;padding:2rem';

  const icon = createElement('div', '', { textContent: accuracy >= 80 ? '🎉' : '📚' });
  icon.style.cssText = 'font-size:3rem;margin-bottom:1rem';
  completeArea.appendChild(icon);

  const title = createElement('h3', '', { textContent: 'Session Complete!' });
  title.style.cssText = 'font-size:1.5rem;font-weight:700;margin-bottom:1rem;color:var(--foreground)';
  completeArea.appendChild(title);

  // Stats grid
  const statsGrid = createElement('div', '');
  statsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;max-width:400px;margin-left:auto;margin-right:auto';

  const statItems = [
    { label: 'Cards Reviewed', value: String(session.reviewed) },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Time', value: `${mins}:${String(secs).padStart(2, '0')}` }
  ];

  for (const item of statItems) {
    const statEl = createElement('div', '');
    statEl.style.cssText = 'padding:1rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg,8px)';
    const val = createElement('div', '', { textContent: item.value });
    val.style.cssText = 'font-size:1.5rem;font-weight:700;color:var(--foreground)';
    const label = createElement('div', '', { textContent: item.label });
    label.style.cssText = 'font-size:0.75rem;color:var(--foreground-muted);margin-top:0.25rem';
    statEl.appendChild(val);
    statEl.appendChild(label);
    statsGrid.appendChild(statEl);
  }
  completeArea.appendChild(statsGrid);

  // Mastery changes
  if (session.masteryChanges.length > 0) {
    const changesTitle = createElement('p', '', {
      textContent: `${session.masteryChanges.length} card${session.masteryChanges.length !== 1 ? 's' : ''} changed mastery level`
    });
    changesTitle.style.cssText = 'color:var(--foreground-muted);margin-bottom:1rem;font-size:0.875rem';
    completeArea.appendChild(changesTitle);
  }

  // Action buttons
  const actions = createElement('div', '');
  actions.style.cssText = 'display:flex;gap:1rem;justify-content:center';

  const reviewAgainBtn = createElement('button', 'btn', {
    'data-variant': 'primary',
    'data-size': 'sm',
    textContent: 'Review Again'
  });
  registerListener(reviewAgainBtn, 'click', () => {
    navigateTo(`#/study/${session.lectureId}`);
  });

  const backBtn = createElement('button', 'btn', {
    'data-variant': 'ghost',
    'data-size': 'sm',
    textContent: 'Back to Library'
  });
  registerListener(backBtn, 'click', () => navigateTo('#/playground'));

  actions.appendChild(reviewAgainBtn);
  actions.appendChild(backBtn);
  completeArea.appendChild(actions);
}

function renderConfetti() {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  const colors = [
    'var(--color-confetti-1)', 'var(--color-confetti-2)',
    'var(--color-confetti-3)', 'var(--color-confetti-4)',
    'var(--color-confetti-5)'
  ];

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'animate-confetti';
    particle.style.cssText = `
      position:absolute;
      top:-10px;
      left:${Math.random() * 100}%;
      width:${6 + Math.random() * 6}px;
      height:${6 + Math.random() * 6}px;
      background:${colors[i % colors.length]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay:${Math.random() * 1}s;
      animation-duration:${1.5 + Math.random() * 1}s;
    `;
    container.appendChild(particle);
  }

  setTimeout(() => {
    if (container.parentNode) container.parentNode.removeChild(container);
  }, 4000);
}

// ============================================================================
// AUTO-GENERATION (Day 5)
// ============================================================================

async function autoGenerateFlashcards(lectureId) {
  let segments;
  try {
    segments = await SegmentRepository.getByLecture(lectureId);
  } catch (_e) {
    showToast('error', 'Error', 'Failed to load segments');
    return 0;
  }

  if (!segments || segments.length === 0) {
    showToast('info', 'No Segments', 'No segments found for this lecture');
    return 0;
  }

  // Get existing flashcards to avoid duplicates (idempotent)
  let existingCards;
  try {
    existingCards = await FlashcardRepository.getByLecture(lectureId);
  } catch (_e) {
    existingCards = [];
  }

  const existingFronts = new Set(existingCards.map(c => c.front));
  let created = 0;

  for (const segment of segments) {
    const meta = segment.metadata || {};
    const text = meta.text || meta.transcript || meta.summary || '';
    if (!text || text.trim().length < 20) continue;

    // Extract key sentence for Q&A
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
    if (sentences.length === 0) continue;

    // Pick the most substantial sentence
    const best = sentences.reduce((a, b) => a.length > b.length ? a : b);

    // Generate Q&A
    const front = generateQuestion(best, segment.type);
    const back = best;

    if (existingFronts.has(front)) continue;
    existingFronts.add(front);

    try {
      await FlashcardRepository.create(createFlashcard({
        lectureId,
        front,
        back
      }));
      created++;
    } catch (_e) { /* skip invalid cards */ }
  }

  if (created > 0) {
    showToast('success', 'Flashcards Generated', `Created ${created} new flashcard${created !== 1 ? 's' : ''}`);
  } else {
    showToast('info', 'No New Cards', 'All segments already have flashcards');
  }

  return created;
}

function generateQuestion(sentence, segmentType) {
  // Simple heuristic: convert a statement into a question
  const cleaned = sentence.replace(/^\s*[-•]\s*/, '').trim();

  // If it contains "is", "are", "was", "were" — turn into what/why question
  if (/\b(is|are|was|were)\b/i.test(cleaned)) {
    return `What ${cleaned.toLowerCase().replace(/\.$/, '')}?`;
  }

  // If it mentions a concept/definition
  if (/\b(means?|defined?|refers?)\b/i.test(cleaned)) {
    return `Define: ${cleaned.replace(/\.$/, '')}`;
  }

  // Default: "Explain" question
  const prefix = segmentType === 'slide_change' ? 'What is shown: ' : 'Explain: ';
  return `${prefix}${cleaned.replace(/\.$/, '')}`;
}

// ============================================================================
// MANUAL CARD CREATION MODAL (Day 5)
// ============================================================================

function openCreateCardModal(lectureId, session) {
  // Focus trap overlay
  const overlay = createElement('div', 'modal-overlay', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Create flashcard'
  });
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem';

  const modal = createElement('div', 'modal-content');
  modal.style.cssText = 'background:var(--surface,#fff);border-radius:var(--radius-xl,12px);padding:1.5rem;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid var(--border)';

  const title = createElement('h3', '', { textContent: 'Create Flashcard' });
  title.style.cssText = 'font-size:1.25rem;font-weight:700;margin-bottom:1rem;color:var(--foreground)';
  modal.appendChild(title);

  // Front textarea
  const frontLabel = createElement('label', '', { textContent: 'Question (Front)', for: 'modal-front' });
  frontLabel.style.cssText = 'display:block;font-size:0.875rem;font-weight:600;color:var(--foreground);margin-bottom:0.25rem';
  modal.appendChild(frontLabel);

  const frontInput = createElement('textarea', 'input', {
    id: 'modal-front',
    placeholder: 'Enter the question...',
    rows: '3',
    maxlength: '500',
    'aria-required': 'true'
  });
  frontInput.style.cssText = 'width:100%;resize:vertical;margin-bottom:0.75rem;font-family:inherit;padding:0.5rem;border:1px solid var(--border);border-radius:var(--radius-md,6px)';
  modal.appendChild(frontInput);

  const frontCount = createElement('div', '', { textContent: '0/500' });
  frontCount.style.cssText = 'text-align:right;font-size:0.7rem;color:var(--foreground-muted);margin-top:-0.5rem;margin-bottom:0.75rem';
  modal.appendChild(frontCount);

  // Back textarea
  const backLabel = createElement('label', '', { textContent: 'Answer (Back)', for: 'modal-back' });
  backLabel.style.cssText = 'display:block;font-size:0.875rem;font-weight:600;color:var(--foreground);margin-bottom:0.25rem';
  modal.appendChild(backLabel);

  const backInput = createElement('textarea', 'input', {
    id: 'modal-back',
    placeholder: 'Enter the answer...',
    rows: '3',
    maxlength: '500',
    'aria-required': 'true'
  });
  backInput.style.cssText = 'width:100%;resize:vertical;margin-bottom:0.75rem;font-family:inherit;padding:0.5rem;border:1px solid var(--border);border-radius:var(--radius-md,6px)';
  modal.appendChild(backInput);

  const backCount = createElement('div', '', { textContent: '0/500' });
  backCount.style.cssText = 'text-align:right;font-size:0.7rem;color:var(--foreground-muted);margin-top:-0.5rem;margin-bottom:0.75rem';
  modal.appendChild(backCount);

  // Error display
  const errorEl = createElement('div', '', { 'aria-live': 'polite' });
  errorEl.style.cssText = 'color:var(--color-error-500,red);font-size:0.8rem;margin-bottom:0.75rem;min-height:1.2em';
  modal.appendChild(errorEl);

  // Buttons
  const btnRow = createElement('div', '');
  btnRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end';

  const cancelBtn = createElement('button', 'btn', {
    'data-variant': 'ghost',
    'data-size': 'sm',
    textContent: 'Cancel'
  });
  const saveBtn = createElement('button', 'btn', {
    'data-variant': 'primary',
    'data-size': 'sm',
    textContent: 'Create Card'
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Character count updates
  registerListener(frontInput, 'input', () => {
    frontCount.textContent = `${frontInput.value.length}/500`;
  });
  registerListener(backInput, 'input', () => {
    backCount.textContent = `${backInput.value.length}/500`;
  });

  // Focus the first input
  frontInput.focus();

  // Escape handler (references closeModal via closure — safe because called async)
  let escHandler;

  // Close modal and clean up escape handler
  const closeModal = () => {
    document.removeEventListener('keydown', escHandler);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);

  registerListener(cancelBtn, 'click', closeModal);
  registerListener(overlay, 'click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Focus trap
  registerListener(modal, 'keydown', (e) => {
    if (e.key === 'Tab') {
      const focusable = modal.querySelectorAll('textarea, button, [tabindex]');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Save handler
  registerListener(saveBtn, 'click', async () => {
    const front = frontInput.value.trim();
    const back = backInput.value.trim();

    if (!front || !back) {
      errorEl.textContent = 'Both question and answer are required';
      return;
    }
    if (front.length > 500 || back.length > 500) {
      errorEl.textContent = 'Maximum 500 characters per field';
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Creating...';

      await FlashcardRepository.create(createFlashcard({
        lectureId,
        front,
        back
      }));

      showToast('success', 'Card Created', 'New flashcard added');
      closeModal();

      // Refresh study view if in a session
      if (session) {
        startStudyView(lectureId);
      }
    } catch (err) {
      errorEl.textContent = 'Failed to create flashcard';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Create Card';
    }
  });
}

// ============================================================================
// CARD MANAGEMENT: EDIT & DELETE (Day 5)
// ============================================================================

function openEditCardModal(card, onComplete) {
  const overlay = createElement('div', 'modal-overlay', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Edit flashcard'
  });
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem';

  const modal = createElement('div', 'modal-content');
  modal.style.cssText = 'background:var(--surface,#fff);border-radius:var(--radius-xl,12px);padding:1.5rem;max-width:480px;width:100%;border:1px solid var(--border)';

  const title = createElement('h3', '', { textContent: 'Edit Flashcard' });
  title.style.cssText = 'font-size:1.25rem;font-weight:700;margin-bottom:1rem;color:var(--foreground)';
  modal.appendChild(title);

  const frontInput = createElement('textarea', 'input', {
    placeholder: 'Question...',
    rows: '3',
    maxlength: '500'
  });
  frontInput.style.cssText = 'width:100%;resize:vertical;margin-bottom:0.75rem;font-family:inherit;padding:0.5rem;border:1px solid var(--border);border-radius:var(--radius-md,6px)';
  frontInput.value = card.front;
  modal.appendChild(frontInput);

  const backInput = createElement('textarea', 'input', {
    placeholder: 'Answer...',
    rows: '3',
    maxlength: '500'
  });
  backInput.style.cssText = 'width:100%;resize:vertical;margin-bottom:0.75rem;font-family:inherit;padding:0.5rem;border:1px solid var(--border);border-radius:var(--radius-md,6px)';
  backInput.value = card.back;
  modal.appendChild(backInput);

  const errorEl = createElement('div', '', { 'aria-live': 'polite' });
  errorEl.style.cssText = 'color:var(--color-error-500,red);font-size:0.8rem;margin-bottom:0.75rem;min-height:1.2em';
  modal.appendChild(errorEl);

  const btnRow = createElement('div', '');
  btnRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end';

  const cancelBtn = createElement('button', 'btn', { 'data-variant': 'ghost', 'data-size': 'sm', textContent: 'Cancel' });
  const saveBtn = createElement('button', 'btn', { 'data-variant': 'primary', 'data-size': 'sm', textContent: 'Save' });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  frontInput.focus();

  let escHandler;

  const closeModal = () => {
    document.removeEventListener('keydown', escHandler);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);

  registerListener(cancelBtn, 'click', closeModal);
  registerListener(overlay, 'click', (e) => { if (e.target === overlay) closeModal(); });

  registerListener(saveBtn, 'click', async () => {
    const front = frontInput.value.trim();
    const back = backInput.value.trim();

    if (!front || !back) {
      errorEl.textContent = 'Both fields are required';
      return;
    }

    try {
      saveBtn.disabled = true;
      // Only update front/back — preserve SM-2 state
      await FlashcardRepository.update(card.id, { front, back });
      showToast('success', 'Card Updated', 'Flashcard content updated');
      closeModal();
      if (onComplete) onComplete();
    } catch (_e) {
      errorEl.textContent = 'Failed to update flashcard';
      saveBtn.disabled = false;
    }
  });
}

async function deleteCardWithConfirmation(cardId, onComplete) {
  const confirmed = window.confirm('Delete this flashcard? This cannot be undone.');
  if (!confirmed) return;

  try {
    await FlashcardRepository.delete(cardId);
    showToast('success', 'Card Deleted', 'Flashcard removed');
    if (onComplete) onComplete();
  } catch (_e) {
    showToast('error', 'Error', 'Failed to delete flashcard');
  }
}

// ============================================================================
// ROUTER INITIALIZATION
// ============================================================================

function initRouter() {
  registerListener(window, 'hashchange', handleRouteChange);

  // NOTE: initial handleRouteChange() is deferred to library.js module init
  // to ensure all renderers (setLibraryRenderer, setLectureDetailRenderer,
  // setDashboardRenderer) are registered before the first route fires.
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouter);
  } else {
    initRouter();
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    cleanupStudySession();
    cleanupListeners();
  });
}

// ============================================================================
// EXPORTS (for testing)
// ============================================================================

export {
  // State
  state,

  // Router
  parseHash,
  navigateTo,
  handleRouteChange,
  initRouter,
  VIEWS,
  SCROLL_ANCHORS,

  // DOM utilities (re-exported from dom-utils.js for backward compatibility)
  createElement,
  clearElement,
  showElement,
  hideElement,
  sanitizeId,

  // Library
  renderLibraryView,
  renderLibraryCard,
  getDominantStatus,
  createMasteryBadge,

  // Flashcard component
  renderFlashcard,

  // Study session
  StudySession,
  startStudyView,
  renderCurrentCard,
  renderSessionComplete,
  createProgressRing,
  updateProgressRing,
  renderConfetti,

  // Auto-generation
  autoGenerateFlashcards,
  generateQuestion,

  // Manual CRUD
  openCreateCardModal,
  openEditCardModal,
  deleteCardWithConfirmation,

  // Listeners (re-exported from dom-utils.js for backward compatibility)
  registerListener,
  cleanupListeners,

  // Toast
  showToast,

  // Hookable renderers (for library.js registration)
  setLibraryRenderer,
  setLectureDetailRenderer,
  setDashboardRenderer,

  // Analytics hooks (for analytics.js registration — AD-9)
  setOnQuizResult,
  setOnSessionComplete,

  // View cleanup registry (for library.js to register cleanup callbacks)
  registerViewCleanup
};
