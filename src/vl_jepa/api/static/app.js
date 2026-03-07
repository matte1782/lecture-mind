/**
 * Lecture Mind - Frontend Application
 *
 * Premium UI interactions with:
 * - Safe DOM manipulation (XSS-free)
 * - Accessible animations (prefers-reduced-motion)
 * - Toast notifications
 * - Proper error handling with retry
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  POLL_INTERVAL: 500,
  SEARCH_DEBOUNCE: 300,
  FETCH_TIMEOUT: 30000,
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB - aligned with backend default
  TOAST_DURATION: 5000,
  VALID_TYPES: ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime', 'video/x-matroska'],
};

// ============================================
// STATE
// ============================================
let currentJobId = null;
let processingResult = null;
let pollInterval = null;
let abortController = null;
let videoUrl = null; // Blob URL for uploaded video

// ============================================
// CONFUSION VOTING STATE
// ============================================
const CONFUSION_STORAGE_KEY = 'lectureMind_confusionVotes';

// ============================================
// BOOKMARK STATE
// ============================================
const BOOKMARK_STORAGE_KEY = 'lectureMind_bookmarks';
const BOOKMARK_TYPES = {
  important: { icon: '\u2B50', label: 'Important', color: 'yellow', key: '1' },
  question: { icon: '\u2753', label: 'Question', color: 'blue', key: '2' },
  insight: { icon: '\uD83D\uDCA1', label: 'Insight', color: 'green', key: '3' },
  todo: { icon: '\uD83D\uDCDD', label: 'Todo', color: 'orange', key: '4' },
};

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ============================================
// LISTENER CLEANUP REGISTRY (P1 FIX: Memory leak prevention)
// ============================================
const listenerRegistry = new Map(); // eventType -> Set of {target, handler, options}

function registerListener(target, eventType, handler, options = {}) {
  target.addEventListener(eventType, handler, options);

  if (!listenerRegistry.has(eventType)) {
    listenerRegistry.set(eventType, new Set());
  }
  listenerRegistry.get(eventType).add({ target, handler, options });
}

function cleanupListeners() {
  listenerRegistry.forEach((listeners, eventType) => {
    listeners.forEach(({ target, handler, options }) => {
      target.removeEventListener(eventType, handler, options);
    });
  });
  listenerRegistry.clear();
}

// Clean up all listeners on page unload (prevents accumulation during hot-reload)
window.addEventListener('beforeunload', cleanupListeners);

// ============================================
// DOM ELEMENTS
// ============================================
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  uploadZone: $('#upload-zone'),
  fileInput: $('#file-input'),
  uploadSection: $('#upload-section'),
  videoPlayerSection: $('#video-player-section'),
  videoPlayer: $('#video-player'),
  progressSection: $('#progress-section'),
  progressStage: $('#progress-stage'),
  progressMessage: $('#progress-message'),
  progressPercent: $('#progress-percent'),
  progressBar: $('#progress-bar'),
  videoInfo: $('#video-info'),
  eventsSection: $('#events-section'),
  eventsList: $('#events-list'),
  searchInput: $('#search-input'),
  searchResults: $('#search-results'),
  transcriptContent: $('#transcript-content'),
  exportBtn: $('#export-btn'),
  copyBtn: $('#copy-btn'),
  themeToggle: $('#theme-toggle'),
  toastContainer: $('#toast-container'),
  confusionSection: $('#confusion-section'),
  confusionList: $('#confusion-list'),
  bookmarksSection: $('#bookmarks-section'),
  bookmarksList: $('#bookmarks-list'),
  bookmarksCount: $('#bookmarks-count'),
  addBookmarkBtn: $('#add-bookmark-btn'),
  markConfusionBtn: $('#mark-confusion-btn'),
  studyNotesPreview: $('#study-notes-preview'),
  studyNotesContent: $('#study-notes-content'),
};

// ============================================
// PROCESSING STATE (for beforeunload warning)
// ============================================
let isProcessing = false;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initHeaderScroll();
  initScrollAnimations();
  initAdvancedEffects();
  initUpload();
  initTabs();
  initSearch();
  initExport();
  initExportOptions();
  initBookmarks();
  initBeforeUnloadWarning();
  initFocusTrapManagement();
  checkDemoMode();
});

// ============================================
// DEMO MODE BANNER
// Shows when running in cloud demo mode (placeholder models)
// ============================================
async function checkDemoMode() {
  // Skip config fetch on static-only deployments (GitHub Pages, local file server)
  if (window.location.hash.startsWith('#/')) return;
  try {
    const response = await fetch('/api/config');
    if (!response.ok) return;
    const config = await response.json();

    if (config.demo_mode) {
      showDemoBanner(config.local_setup_url);
    }
  } catch (error) {
    // Silently ignore - banner is optional
    console.debug('Could not check demo mode:', error);
  }
}

function showDemoBanner(setupUrl) {
  // Don't show if already exists
  if ($('#demo-banner')) return;

  const banner = createElement('div', 'demo-banner', {
    id: 'demo-banner',
    role: 'alert',
  });

  // Build banner content safely (no innerHTML with dynamic content)
  const icon = createElement('span', 'demo-banner-icon', { textContent: '🎓' });

  const textSpan = createElement('span', 'demo-banner-text');
  const strong = createElement('strong', null, { textContent: 'Demo Mode' });
  const text = document.createTextNode(' — Running with lightweight processing. ');
  const link = createElement('a', null, {
    href: setupUrl,
    target: '_blank',
    rel: 'noopener',
    textContent: 'Run locally',
  });
  const text2 = document.createTextNode(' for full AI features!');
  textSpan.appendChild(strong);
  textSpan.appendChild(text);
  textSpan.appendChild(link);
  textSpan.appendChild(text2);

  const closeBtn = createElement('button', 'demo-banner-close', {
    'aria-label': 'Dismiss banner',
    textContent: '×',
  });

  banner.appendChild(icon);
  banner.appendChild(textSpan);
  banner.appendChild(closeBtn);

  // Insert at top of body
  document.body.insertBefore(banner, document.body.firstChild);

  // Animate in
  requestAnimationFrame(() => banner.classList.add('visible'));

  // Close button
  closeBtn.addEventListener('click', () => {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
  });
}

// ============================================
// P0 FIX: BEFOREUNLOAD WARNING
// Prevents data loss when user navigates away during upload/processing
// ============================================
function initBeforeUnloadWarning() {
  window.addEventListener('beforeunload', (e) => {
    if (isProcessing) {
      // Standard way to trigger the browser's "unsaved changes" dialog
      e.preventDefault();
      // For older browsers
      e.returnValue = 'Your video is still being processed. Are you sure you want to leave?';
      return e.returnValue;
    }
  });
}

// ============================================
// P0 FIX: FOCUS TRAP MANAGEMENT
// Ensures hidden panels don't trap focus
// ============================================
function initFocusTrapManagement() {
  // Apply inert to all hidden panels on init
  const hiddenPanels = document.querySelectorAll('.study-panel.hidden, .tabs-content[data-state="inactive"]');
  hiddenPanels.forEach(panel => {
    panel.setAttribute('inert', '');
  });
}

// ============================================
// ADVANCED UI EFFECTS
// ============================================
function initAdvancedEffects() {
  if (prefersReducedMotion.matches) return;

  initAnimatedCounters();
  initTypewriter();
  initCardTilt();
  initButtonRipple();
  initCursorGlow();
  initMagneticButtons();
  initSectionTransitions();
  initInteractiveParticles();
  initVisibilityHandler(); // Pause animations when tab is hidden
}

// 1. ANIMATED STATS COUNTER
function initAnimatedCounters() {
  const counters = document.querySelectorAll('.hero-stat-value');
  if (counters.length === 0) return;

  const observerOptions = { threshold: 0.5 };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true';
        animateCounter(entry.target);
        obs.unobserve(entry.target); // Unobserve after animation - memory optimization
      }
    });
  }, observerOptions);

  counters.forEach(counter => observer.observe(counter));

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => observer.disconnect());
}

function animateCounter(element) {
  const text = element.textContent.trim();
  const hasPrefix = text.startsWith('<') || text.startsWith('>');
  const hasSuffix = text.endsWith('+') || text.endsWith('ms') || text.endsWith('K+');

  let prefix = '';
  let suffix = '';
  let numStr = text;

  if (text.startsWith('<')) { prefix = '< '; numStr = text.slice(2); }
  if (text.startsWith('>')) { prefix = '> '; numStr = text.slice(2); }

  if (text.endsWith('K+')) { suffix = 'K+'; numStr = numStr.slice(0, -2); }
  else if (text.endsWith('ms')) { suffix = 'ms'; numStr = numStr.slice(0, -2); }
  else if (text.endsWith('+')) { suffix = '+'; numStr = numStr.slice(0, -1); }

  const target = parseInt(numStr, 10);
  if (isNaN(target)) return;

  const duration = 2000;
  const steps = 60;
  const stepDuration = duration / steps;
  let current = 0;

  const interval = setInterval(() => {
    current += target / steps;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    element.textContent = prefix + Math.round(current) + suffix;
  }, stepDuration);
}

// 2. TYPEWRITER EFFECT
function initTypewriter() {
  const element = document.querySelector('.hero-title-gradient');
  if (!element) return;

  const text = element.textContent;
  element.textContent = '';
  element.classList.add('typewriter');

  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';

  let i = 0;
  const speed = 80;

  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    } else {
      element.appendChild(cursor);
      setTimeout(() => cursor.remove(), 3000);
    }
  }

  // Start after a delay
  setTimeout(type, 500);
}

// 3. INTERACTIVE PARTICLES (RAF-throttled for performance)
function initInteractiveParticles() {
  const particles = document.querySelectorAll('.particle');
  const hero = document.querySelector('.hero');
  if (!hero || particles.length === 0) return;

  particles.forEach(p => p.classList.add('interactive'));

  let mouseX = 0, mouseY = 0;
  let ticking = false;
  let heroRect = hero.getBoundingClientRect();

  // Update rect on scroll/resize (registered for cleanup)
  const updateRect = () => { heroRect = hero.getBoundingClientRect(); };
  registerListener(window, 'scroll', updateRect, { passive: true });
  registerListener(window, 'resize', updateRect, { passive: true });

  function updateParticles() {
    particles.forEach(particle => {
      const pRect = particle.getBoundingClientRect();
      const pX = pRect.left - heroRect.left + pRect.width / 2;
      const pY = pRect.top - heroRect.top + pRect.height / 2;

      const dx = mouseX - pX;
      const dy = mouseY - pY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 150) {
        const force = (150 - distance) / 150;
        const moveX = -dx * force * 0.3;
        const moveY = -dy * force * 0.3;
        particle.style.transform = `translate(${moveX}px, ${moveY}px)`;
      } else {
        particle.style.transform = '';
      }
    });
    ticking = false;
  }

  hero.addEventListener('mousemove', (e) => {
    mouseX = e.clientX - heroRect.left;
    mouseY = e.clientY - heroRect.top;

    if (!ticking) {
      requestAnimationFrame(updateParticles);
      ticking = true;
    }
  }, { passive: true });

  hero.addEventListener('mouseleave', () => {
    particles.forEach(p => p.style.transform = '');
  });
}

// 4. 3D CARD TILT (RAF-throttled with will-change management)
function initCardTilt() {
  const cards = document.querySelectorAll('.feature-card, .tech-card');

  cards.forEach(card => {
    card.classList.add('tilt-card');
    let ticking = false;
    let mouseX = 0, mouseY = 0;

    function updateTilt() {
      const rect = card.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (mouseY - centerY) / centerY * -8;
      const rotateY = (mouseX - centerX) / centerX * 8;

      card.style.setProperty('--rotateX', `${rotateX}deg`);
      card.style.setProperty('--rotateY', `${rotateY}deg`);
      ticking = false;
    }

    card.addEventListener('mouseenter', () => {
      card.style.willChange = 'transform';
    });

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;

      if (!ticking) {
        requestAnimationFrame(updateTilt);
        ticking = true;
      }
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rotateX', '0deg');
      card.style.setProperty('--rotateY', '0deg');
      // Remove will-change after transition
      setTimeout(() => { card.style.willChange = 'auto'; }, 400);
    });
  });
}

// 5. BUTTON RIPPLE EFFECT
function initButtonRipple() {
  const buttons = document.querySelectorAll('.btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';

      btn.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// 6. CURSOR GLOW TRAIL (MEMORY LEAK FIX: RAF is now properly managed)
function initCursorGlow() {
  // Only on desktop
  if (window.innerWidth < 768) return;

  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);

  const hero = document.querySelector('.hero');
  if (!hero) return;

  let glowX = 0, glowY = 0;
  let currentX = 0, currentY = 0;
  let rafId = null;
  let isActive = false;

  function startAnimation() {
    if (rafId !== null) return; // Already running
    isActive = true;
    animateGlow();
  }

  function stopAnimation() {
    isActive = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function animateGlow() {
    if (!isActive) return;

    currentX += (glowX - currentX) * 0.1;
    currentY += (glowY - currentY) * 0.1;

    glow.style.left = currentX + 'px';
    glow.style.top = currentY + 'px';

    rafId = requestAnimationFrame(animateGlow);
  }

  // Start/stop animation based on mouse entering/leaving hero
  hero.addEventListener('mouseenter', () => {
    glow.classList.add('active');
    startAnimation();
  });

  hero.addEventListener('mouseleave', () => {
    glow.classList.remove('active');
    stopAnimation();
  });

  // Pause animation when tab is hidden (saves CPU/battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAnimation();
    } else if (glow.classList.contains('active')) {
      startAnimation();
    }
  });

  document.addEventListener('mousemove', (e) => {
    glowX = e.clientX;
    glowY = e.clientY;
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', stopAnimation);
}

// 7. MAGNETIC BUTTONS
function initMagneticButtons() {
  const buttons = document.querySelectorAll('.btn-hero, .btn[data-variant="primary"]');

  buttons.forEach(btn => {
    btn.classList.add('magnetic-btn');

    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

// 8. SECTION COLOR TRANSITIONS
function initSectionTransitions() {
  const sections = document.querySelectorAll('.features-section, .how-it-works-section, .tech-section');

  sections.forEach(section => {
    section.classList.add('section-gradient-bg');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      } else {
        entry.target.classList.remove('in-view');
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(section => observer.observe(section));

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => observer.disconnect());
}

// 9. PAUSE ANIMATIONS WHEN PAGE HIDDEN (Battery Optimization)
function initVisibilityHandler() {
  const animatedElements = document.querySelectorAll('.aurora-blob, .particle, .morph-bg, .light-beam');

  document.addEventListener('visibilitychange', () => {
    const state = document.hidden ? 'paused' : 'running';
    animatedElements.forEach(el => {
      el.style.animationPlayState = state;
    });
  });
}

// ============================================
// HEADER SCROLL STATE
// ============================================
function initHeaderScroll() {
  const header = document.querySelector('.header-landing');
  if (!header) return;

  const scrollThreshold = 50;
  let ticking = false;

  function updateHeader() {
    if (window.scrollY > scrollThreshold) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    ticking = false;
  }

  // Named handler for cleanup registry
  const scrollHandler = () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  };
  registerListener(window, 'scroll', scrollHandler, { passive: true });

  // Initial check
  updateHeader();
}

// ============================================
// SCROLL-TRIGGERED ANIMATIONS (AOS Replacement)
// ============================================
function initScrollAnimations() {
  // Skip if user prefers reduced motion
  if (prefersReducedMotion.matches) return;

  const animatedElements = document.querySelectorAll('[data-aos]');
  if (animatedElements.length === 0) return;

  // Create intersection observer
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const animation = el.getAttribute('data-aos') || 'fade-up';
        const delay = parseInt(el.getAttribute('data-aos-delay') || '0', 10);

        setTimeout(() => {
          el.classList.add('aos-animate');
          el.setAttribute('data-aos-animated', 'true');
        }, delay);

        // Unobserve after animation
        observer.unobserve(el);
      }
    });
  }, observerOptions);

  // Observe all elements with data-aos
  animatedElements.forEach(el => {
    el.classList.add('aos-init');
    observer.observe(el);
  });

  // Initialize parallax effect for hero
  initParallax();
}

// ============================================
// PARALLAX SCROLL EFFECT
// ============================================
function initParallax() {
  if (prefersReducedMotion.matches) return;

  const hero = document.querySelector('.hero');
  const morphBg = document.querySelector('.morph-bg');
  const auroraBlobs = document.querySelectorAll('.aurora-blob');
  const heroContent = document.querySelector('.hero-content');
  const heroVisual = document.querySelector('.hero-visual');

  if (!hero) return;

  let ticking = false;

  function updateParallax() {
    const scrollY = window.scrollY;
    const heroHeight = hero.offsetHeight;

    // Only apply parallax within hero section
    if (scrollY > heroHeight) {
      ticking = false;
      return;
    }

    const scrollPercent = scrollY / heroHeight;

    // Parallax for morph background (slow)
    if (morphBg) {
      morphBg.style.transform = `translateY(${scrollY * 0.3}px) rotate(${scrollPercent * 5}deg)`;
    }

    // Parallax for aurora blobs (medium)
    auroraBlobs.forEach((blob, i) => {
      const speed = 0.1 + (i * 0.05);
      blob.style.transform = `translateY(${scrollY * speed}px)`;
    });

    // Parallax for hero content (subtle fade out)
    if (heroContent) {
      const opacity = Math.max(0, 1 - scrollPercent * 1.5);
      const translateY = scrollY * 0.4;
      heroContent.style.opacity = opacity;
      heroContent.style.transform = `translateY(${translateY}px)`;
    }

    // Parallax for hero visual (moves slower)
    if (heroVisual) {
      const opacity = Math.max(0, 1 - scrollPercent * 1.2);
      const translateY = scrollY * 0.2;
      heroVisual.style.opacity = opacity;
      heroVisual.style.transform = `translateY(${translateY}px)`;
    }

    ticking = false;
  }

  // Named handler for cleanup registry
  const parallaxScrollHandler = () => {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  };
  registerListener(window, 'scroll', parallaxScrollHandler, { passive: true });
}

// ============================================
// THEME MANAGEMENT
// ============================================
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }

  elements.themeToggle.addEventListener('click', toggleTheme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  // Animate the toggle button
  if (!prefersReducedMotion.matches) {
    elements.themeToggle.animate([
      { transform: 'scale(0.9)' },
      { transform: 'scale(1)' }
    ], { duration: 200, easing: 'ease-out' });
  }
}

// ============================================
// FILE UPLOAD
// ============================================
function initUpload() {
  const { uploadZone, fileInput } = elements;

  // Click to upload
  uploadZone.addEventListener('click', () => fileInput.click());

  // Keyboard support
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // File selected
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', handleDragOver);
  uploadZone.addEventListener('dragleave', handleDragLeave);
  uploadZone.addEventListener('drop', handleDrop);
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadZone.setAttribute('data-dragover', 'true');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadZone.removeAttribute('data-dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.uploadZone.removeAttribute('data-dragover');

  if (e.dataTransfer.files.length > 0) {
    uploadFile(e.dataTransfer.files[0]);
  }
}

async function uploadFile(file) {
  // Validate file type
  const isValidType = CONFIG.VALID_TYPES.some(t =>
    file.type.includes(t.split('/')[1]) || file.name.toLowerCase().endsWith(t.split('/')[1])
  );

  if (!isValidType) {
    showToast('error', 'Invalid File', 'Please upload a valid video file (MP4, WebM, AVI, MOV, MKV)');
    return;
  }

  // Validate file size
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    showToast('error', 'File Too Large', 'Maximum file size is 100MB');
    return;
  }

  // Store video blob URL for playback
  if (videoUrl) {
    URL.revokeObjectURL(videoUrl);
  }
  videoUrl = URL.createObjectURL(file);
  elements.videoPlayer.src = videoUrl;

  // Set processing state (enables beforeunload warning)
  isProcessing = true;

  // Show video player and progress
  showElement(elements.videoPlayerSection);
  showElement(elements.progressSection);
  hideElement(elements.uploadSection);
  updateProgress('Uploading', 'Preparing upload...', 0);

  // MEMORY LEAK FIX: Stop any existing polling before starting new upload
  stopPolling();

  // Cancel any existing request
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithTimeout('/api/upload', {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    const data = await response.json();
    currentJobId = data.job_id;

    showToast('success', 'Upload Complete', 'Processing your video...');
    startPolling();

  } catch (error) {
    if (error.name === 'AbortError') {
      showToast('warning', 'Upload Cancelled', 'The upload was cancelled');
    } else {
      showToast('error', 'Upload Failed', error.message);
    }
    resetUpload();
  }
}

// ============================================
// POLLING & PROGRESS
// ============================================
function startPolling() {
  // RACE CONDITION FIX: Store the job ID we're polling for
  const pollingJobId = currentJobId;

  pollInterval = setInterval(async () => {
    // RACE CONDITION FIX: Stop if job ID changed (new upload started)
    if (currentJobId !== pollingJobId || !currentJobId) {
      stopPolling();
      return;
    }

    try {
      const response = await fetchWithTimeout(`/api/status/${currentJobId}`);

      // Handle 404 - job not found (server restart, job expired, etc.)
      if (response.status === 404) {
        stopPolling();
        showToast('error', 'Job Not Found', 'The processing job was lost. This can happen if the server restarted. Please upload again.');
        resetUpload();
        return;
      }

      // Handle other HTTP errors
      if (!response.ok) {
        console.error('Status check failed:', response.status);
        return; // Keep polling, might be temporary
      }

      const data = await response.json();

      // Double-check job ID hasn't changed during the fetch
      if (currentJobId !== pollingJobId) {
        stopPolling();
        return;
      }

      // Defensive: ensure progress is a valid number to prevent NaN%
      const progressPercent = typeof data.progress === 'number' ? data.progress * 100 : 0;
      updateProgress(
        formatStage(data.stage),
        data.message || 'Processing...',
        progressPercent
      );

      if (data.status === 'completed') {
        stopPolling();
        await loadResults();
      } else if (data.status === 'failed') {
        stopPolling();
        showToast('error', 'Processing Failed', data.error || 'An error occurred');
        resetUpload();
      }

    } catch (error) {
      // RACE CONDITION FIX: Ignore AbortError from cancelled requests
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Polling error:', error);
    }
  }, CONFIG.POLL_INTERVAL);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function updateProgress(stage, message, percent) {
  // Defensive: ensure percent is valid number, default to 0 if NaN/undefined
  const safePercent = Number.isFinite(percent) ? percent : 0;

  elements.progressStage.textContent = stage || 'Processing';
  elements.progressMessage.textContent = message || 'Please wait...';
  elements.progressPercent.textContent = Math.round(safePercent) + '%';
  elements.progressBar.style.width = safePercent + '%';

  // Update ARIA
  elements.progressSection.setAttribute('aria-valuenow', Math.round(safePercent));
}

function formatStage(stage) {
  const stageNames = {
    'loading': 'Loading Video',
    'extracting_audio': 'Extracting Audio',
    'transcribing': 'Transcribing',
    'sampling_frames': 'Sampling Frames',
    'encoding_frames': 'Encoding Frames',
    'encoding_text': 'Encoding Text',
    'detecting_events': 'Detecting Events',
    'building_index': 'Building Index',
    'completed': 'Complete'
  };
  return stageNames[stage] || 'Processing';
}

// ============================================
// RESULTS LOADING
// ============================================
async function loadResults() {
  try {
    const response = await fetchWithTimeout(`/api/results/${currentJobId}`);
    const data = await response.json();

    if (data.status !== 'completed' || !data.result) {
      throw new Error('Results not available');
    }

    processingResult = data.result;

    // Clear processing state (disables beforeunload warning)
    isProcessing = false;

    // Hide progress, show results with animation
    hideElement(elements.progressSection);
    showElement(elements.videoInfo);
    showElement(elements.eventsSection);

    // Populate video info
    const meta = data.result.metadata;
    $('#info-filename').textContent = meta.filename;
    $('#info-duration').textContent = formatDuration(meta.duration);
    $('#info-resolution').textContent = `${meta.width}x${meta.height}`;
    $('#info-fps').textContent = `${meta.fps.toFixed(1)} fps`;

    // Populate events and transcript
    renderEvents(data.result.events);
    renderTranscript(data.result.transcript);

    // Enable export
    elements.exportBtn.disabled = false;
    if (elements.copyBtn) {
      elements.copyBtn.disabled = false;
    }

    // Render bookmarks for this video
    renderBookmarksList();

    // Update export UI based on current selection
    const selectedFormat = $('input[name="export-format"]:checked')?.value;
    if (selectedFormat) {
      updateExportUI(selectedFormat);
    }

    // Update search placeholder
    updateSearchPlaceholder('Type to search transcript');

    showToast('success', 'Processing Complete', 'Your video is ready to explore');

    // Dispatch event for library.js to import lecture into Student Playground
    window.dispatchEvent(new CustomEvent('lecturemind:processed', {
      detail: { result: data.result, jobId: currentJobId }
    }));

  } catch (error) {
    showToast('error', 'Error', error.message);
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Seek video to a specific timestamp
 * @param {number} seconds - Time in seconds to seek to
 */
function seekVideo(seconds) {
  if (!elements.videoPlayer || !videoUrl) {
    showToast('warning', 'Video Not Available', 'No video loaded');
    return;
  }

  // Scroll video player into view
  elements.videoPlayerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Seek to the timestamp
  elements.videoPlayer.currentTime = seconds;

  // Play the video
  elements.videoPlayer.play().catch(() => {
    // Autoplay blocked, just seek
  });

  // Visual feedback
  if (!prefersReducedMotion.matches) {
    elements.videoPlayerSection.animate([
      { boxShadow: '0 0 0 3px var(--primary)' },
      { boxShadow: '0 0 0 0 transparent' }
    ], { duration: 600, easing: 'ease-out' });
  }
}

// ============================================
// RENDER FUNCTIONS (Safe DOM)
// ============================================
function createElement(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'textContent') {
      el.textContent = value;
    } else {
      el.setAttribute(key, value);
    }
  });
  return el;
}

function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function renderEvents(events) {
  clearElement(elements.eventsList);

  events.forEach((event, i) => {
    const card = createElement('div', 'event-card animate-fadeInUp', {
      role: 'listitem',
      tabindex: '0',
      'data-timestamp': event.timestamp,
      'aria-label': `Event at ${event.timestamp_formatted}, click to jump to this moment`,
    });
    card.style.animationDelay = `${i * 50}ms`;

    const indexBox = createElement('div', 'event-card-index', { textContent: String(i + 1) });

    const content = createElement('div', 'event-card-content');
    const timestamp = createElement('span', 'event-card-timestamp timestamp-link', {
      textContent: event.timestamp_formatted,
      title: 'Click to jump to this moment',
    });
    const confidence = createElement('p', 'event-card-confidence', {
      textContent: `Confidence: ${Math.round(event.confidence * 100)}%`
    });
    content.appendChild(timestamp);
    content.appendChild(confidence);

    const arrow = createSvgIcon('M9 5l7 7-7 7', 'event-card-arrow');

    // Add confusion button
    const confusionBtn = createConfusionVoteButton(event.timestamp, event.timestamp_formatted);

    card.appendChild(indexBox);
    card.appendChild(content);
    card.appendChild(arrow);
    card.appendChild(confusionBtn);

    // Click to seek video
    card.addEventListener('click', (e) => {
      // Don't seek if clicking the confusion button
      if (e.target.closest('.confusion-btn')) return;
      seekVideo(event.timestamp);
    });

    // Keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seekVideo(event.timestamp);
      }
    });

    elements.eventsList.appendChild(card);
  });

  // Update confusion UI after rendering
  updateConfusionMomentsUI();
}

function renderTranscript(transcript) {
  clearElement(elements.transcriptContent);

  if (!transcript || transcript.length === 0) {
    const empty = createEmptyState(
      'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
      'No transcript available',
      'Transcript will appear here after processing'
    );
    elements.transcriptContent.appendChild(empty);
    return;
  }

  transcript.forEach((chunk, i) => {
    const card = createElement('div', 'transcript-chunk animate-fadeInUp', {
      'data-timestamp': chunk.start,
      tabindex: '0',
      role: 'button',
      'aria-label': `Transcript at ${chunk.start_formatted}, click to jump`,
    });
    card.style.animationDelay = `${i * 30}ms`;

    const time = createElement('span', 'transcript-chunk-time timestamp-link', {
      textContent: `${chunk.start_formatted} - ${chunk.end_formatted}`,
      title: 'Click to jump to this moment',
    });
    const text = createElement('p', 'transcript-chunk-text', { textContent: chunk.text });

    // Add confusion button
    const confusionBtn = createConfusionVoteButton(chunk.start, chunk.start_formatted);

    card.appendChild(time);
    card.appendChild(text);
    card.appendChild(confusionBtn);

    // Click to seek video
    card.addEventListener('click', (e) => {
      // Don't seek if clicking the confusion button
      if (e.target.closest('.confusion-btn')) return;
      seekVideo(chunk.start);
    });

    // Keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seekVideo(chunk.start);
      }
    });

    elements.transcriptContent.appendChild(card);
  });

  // Update confusion UI after rendering
  updateConfusionMomentsUI();
}

function createSvgIcon(pathD, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('stroke-width', '2');

  // Set explicit size for empty-state-icon to prevent overflow
  if (className === 'empty-state-icon') {
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('d', pathD);

  svg.appendChild(path);
  return svg;
}

function createEmptyState(iconPath, title, description) {
  const container = createElement('div', 'empty-state');
  const icon = createSvgIcon(iconPath, 'empty-state-icon');
  const titleEl = createElement('p', 'empty-state-title', { textContent: title });
  const descEl = createElement('p', 'empty-state-description', { textContent: description });

  container.appendChild(icon);
  container.appendChild(titleEl);
  container.appendChild(descEl);

  return container;
}

// ============================================
// TABS
// ============================================
function initTabs() {
  const triggers = $$('.tabs-trigger');

  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const tabName = trigger.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Update triggers
  $$('.tabs-trigger').forEach(t => {
    const isActive = t.getAttribute('data-tab') === tabName;
    t.setAttribute('data-state', isActive ? 'active' : 'inactive');
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Update content panels with inert management for focus trap fix
  $$('.tabs-content').forEach(panel => {
    const isActive = panel.id === `tab-${tabName}`;
    panel.setAttribute('data-state', isActive ? 'active' : 'inactive');
    // P0 FIX: Prevent focus trap in inactive panels
    if (isActive) {
      panel.removeAttribute('inert');
    } else {
      panel.setAttribute('inert', '');
    }
  });
}

// ============================================
// SEARCH
// ============================================
function initSearch() {
  let searchTimeout = null;

  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value);
    }, CONFIG.SEARCH_DEBOUNCE);
  });
}

async function performSearch(query) {
  if (!query.trim() || !currentJobId) {
    updateSearchPlaceholder('Type to search transcript');
    return;
  }

  // Show loading state
  clearElement(elements.searchResults);
  const loading = createElement('div', 'search-loading');
  loading.appendChild(createElement('div', 'spinner'));
  loading.appendChild(createElement('p', 'text-muted', { textContent: 'Searching...' }));
  elements.searchResults.appendChild(loading);

  try {
    const response = await fetchWithTimeout(`/api/search/${currentJobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: 5 })
    });

    const data = await response.json();
    clearElement(elements.searchResults);

    if (data.results.length === 0) {
      const empty = createEmptyState(
        'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
        'No results found',
        'Try a different search term'
      );
      elements.searchResults.appendChild(empty);
      return;
    }

    data.results.forEach((result, i) => {
      const card = createElement('div', 'search-result animate-fadeInUp', {
        'data-timestamp': result.timestamp,
        tabindex: '0',
        role: 'button',
        'aria-label': `Search result at ${result.timestamp_formatted}, click to jump`,
      });
      card.style.animationDelay = `${i * 50}ms`;

      const header = createElement('div', 'search-result-header');
      const timeBadge = createElement('span', 'search-result-timestamp timestamp-link', {
        textContent: result.timestamp_formatted,
        title: 'Click to jump to this moment',
      });
      const typeBadge = createElement('span', 'search-result-type', {
        textContent: result.result_type
      });
      header.appendChild(timeBadge);
      header.appendChild(typeBadge);

      const text = createElement('p', 'search-result-text');
      renderHighlightedText(text, result.text, query);

      card.appendChild(header);
      card.appendChild(text);

      // Click to seek video
      card.addEventListener('click', () => {
        seekVideo(result.timestamp);
      });

      // Keyboard support
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          seekVideo(result.timestamp);
        }
      });

      elements.searchResults.appendChild(card);
    });

  } catch (error) {
    console.error('Search error:', error);
    updateSearchPlaceholder('Search failed. Please try again.');
  }
}

function renderHighlightedText(container, text, query) {
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const parts = text.split(regex);

  parts.forEach(part => {
    if (part.toLowerCase() === query.toLowerCase()) {
      const mark = createElement('mark', 'highlight', { textContent: part });
      container.appendChild(mark);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  });
}

function updateSearchPlaceholder(message) {
  clearElement(elements.searchResults);
  const empty = createEmptyState(
    'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
    'Ready to search',
    message
  );
  elements.searchResults.appendChild(empty);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// EXPORT
// ============================================
function initExport() {
  elements.exportBtn.addEventListener('click', handleExport);
  if (elements.copyBtn) {
    elements.copyBtn.addEventListener('click', handleCopyToClipboard);
  }
}

function initExportOptions() {
  const options = $$('.export-option');
  options.forEach(option => {
    const radio = option.querySelector('input[type="radio"]');
    radio.addEventListener('change', () => {
      options.forEach(o => o.removeAttribute('data-selected'));
      option.setAttribute('data-selected', 'true');

      // Show/hide copy button and preview for study notes
      const format = radio.value;
      updateExportUI(format);
    });
  });
}

function updateExportUI(format) {
  const copyBtn = elements.copyBtn;
  const studyNotesPreview = elements.studyNotesPreview;

  if (format === 'study-notes') {
    if (copyBtn) {
      copyBtn.style.display = 'flex';
      copyBtn.disabled = !processingResult;
    }
    if (studyNotesPreview && processingResult) {
      showElement(studyNotesPreview);
      renderStudyNotesPreview();
    }
  } else {
    if (copyBtn) {
      copyBtn.style.display = 'none';
    }
    if (studyNotesPreview) {
      hideElement(studyNotesPreview);
    }
  }
}

function generateStudyNotesMarkdown() {
  if (!processingResult) return '';

  const meta = processingResult.metadata;
  const events = processingResult.events || [];
  const transcript = processingResult.transcript || [];
  const bookmarks = getBookmarks();
  const confusionMarkers = getConfusionMarkers();

  // Generate timestamp link format (e.g., [00:12:34](#t=754))
  const formatTimestampLink = (seconds) => {
    const formatted = formatDurationFull(seconds);
    return `[${formatted}](#t=${Math.floor(seconds)})`;
  };

  let md = '';

  // Header
  md += `# Study Notes: ${meta.filename}\n\n`;
  md += `> Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}\n\n`;

  // Video Metadata
  md += `## Video Information\n\n`;
  md += `| Property | Value |\n`;
  md += `|----------|-------|\n`;
  md += `| **Filename** | ${meta.filename} |\n`;
  md += `| **Duration** | ${formatDurationFull(meta.duration)} |\n`;
  md += `| **Resolution** | ${meta.width}x${meta.height} |\n`;
  md += `| **Frame Rate** | ${meta.fps.toFixed(1)} fps |\n\n`;

  // Table of Contents (Events)
  if (events.length > 0) {
    md += `## Table of Contents\n\n`;
    md += `*Detected events and slide changes:*\n\n`;
    events.forEach((event, i) => {
      const confidence = Math.round(event.confidence * 100);
      md += `${i + 1}. ${formatTimestampLink(event.timestamp)} - Event (${confidence}% confidence)\n`;
    });
    md += `\n`;
  }

  // Bookmarks
  if (bookmarks.length > 0) {
    md += `## Your Bookmarks\n\n`;
    const sortedBookmarks = [...bookmarks].sort((a, b) => a.timestamp - b.timestamp);
    sortedBookmarks.forEach((bookmark) => {
      const typeInfo = BOOKMARK_TYPES[bookmark.type] || BOOKMARK_TYPES.important;
      md += `### ${typeInfo.icon} ${formatTimestampLink(bookmark.timestamp)} - ${typeInfo.label}\n\n`;
      if (bookmark.note) {
        md += `${bookmark.note}\n\n`;
      }
    });
  }

  // Confusion Markers
  if (confusionMarkers.length > 0) {
    md += `## Moments to Review\n\n`;
    md += `*These sections were marked as confusing:*\n\n`;
    const sortedConfusion = [...confusionMarkers].sort((a, b) => a.timestamp - b.timestamp);
    sortedConfusion.forEach((marker) => {
      md += `- ${formatTimestampLink(marker.timestamp)}`;
      if (marker.note) {
        md += ` - ${marker.note}`;
      }
      md += `\n`;
    });
    md += `\n`;
  }

  // Full Transcript
  if (transcript.length > 0) {
    md += `## Full Transcript\n\n`;
    transcript.forEach((chunk) => {
      md += `**${formatTimestampLink(chunk.start)}**\n\n`;
      md += `${chunk.text}\n\n`;
      md += `---\n\n`;
    });
  }

  // Footer
  md += `\n---\n\n`;
  md += `*Generated by [Lecture Mind](https://github.com/matte1782/vl-jepa) - AI-powered lecture analysis*\n`;

  return md;
}

function formatDurationFull(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function renderStudyNotesPreview() {
  if (!elements.studyNotesContent) return;

  const markdown = generateStudyNotesMarkdown();

  // Show a truncated preview
  const preview = markdown.substring(0, 1000) + (markdown.length > 1000 ? '\n\n...' : '');

  clearElement(elements.studyNotesContent);
  const pre = createElement('pre', 'study-notes-markdown');
  pre.textContent = preview;
  elements.studyNotesContent.appendChild(pre);
}

async function handleCopyToClipboard() {
  if (!processingResult) {
    showToast('warning', 'No Content', 'Process a video first to generate study notes');
    return;
  }

  const btn = elements.copyBtn;
  const originalText = btn.textContent;

  try {
    const markdown = generateStudyNotesMarkdown();
    await navigator.clipboard.writeText(markdown);

    btn.textContent = 'Copied!';
    showToast('success', 'Copied!', 'Study notes copied to clipboard');

  } catch (error) {
    showToast('error', 'Copy Failed', 'Could not copy to clipboard');
  } finally {
    setTimeout(() => {
      // Security fix C4: Use safe DOM methods instead of innerHTML
      btn.textContent = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('d', 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z');
      svg.appendChild(path);
      btn.appendChild(svg);
      btn.appendChild(document.createTextNode(' Copy to Clipboard'));
    }, 2000);
  }
}

async function handleExport() {
  if (!currentJobId) return;

  const format = $('input[name="export-format"]:checked').value;
  const btn = elements.exportBtn;

  try {
    btn.disabled = true;
    btn.textContent = 'Exporting...';

    let content, filename;

    if (format === 'study-notes') {
      // Generate study notes locally
      content = generateStudyNotesMarkdown();
      const meta = processingResult?.metadata || {};
      const baseName = (meta.filename || 'lecture').replace(/\.[^/.]+$/, '');
      filename = `${baseName}_study_notes.md`;
    } else {
      // Use server export for other formats
      const response = await fetchWithTimeout(`/api/export/${currentJobId}/${format}`);
      const data = await response.json();
      content = data.content;
      filename = data.filename;
    }

    // Create download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('success', 'Export Complete', `Downloaded ${filename}`);

  } catch (error) {
    showToast('error', 'Export Failed', error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download';
  }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(variant, title, message) {
  const toast = createElement('div', 'toast', { 'data-variant': variant });

  // Icon based on variant
  const iconPaths = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  };

  const icon = createSvgIcon(iconPaths[variant] || iconPaths.info, 'toast-icon');
  icon.style.color = `var(--${variant === 'success' ? 'success' : variant === 'error' ? 'error' : variant === 'warning' ? 'warning' : 'primary'})`;

  const content = createElement('div', 'toast-content');
  const titleEl = createElement('p', 'toast-title', { textContent: title });
  const messageEl = createElement('p', 'toast-message', { textContent: message });
  content.appendChild(titleEl);
  content.appendChild(messageEl);

  const closeBtn = createElement('button', 'toast-close', { 'aria-label': 'Dismiss' });
  closeBtn.appendChild(createSvgIcon('M6 18L18 6M6 6l12 12'));
  closeBtn.addEventListener('click', () => removeToast(toast));

  toast.appendChild(icon);
  toast.appendChild(content);
  toast.appendChild(closeBtn);

  elements.toastContainer.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => removeToast(toast), CONFIG.TOAST_DURATION);
}

function removeToast(toast) {
  if (!toast.parentNode) return;

  toast.style.animation = 'fadeOut 200ms ease-out forwards';
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 200);
}

// ============================================
// UTILITIES
// ============================================
function showElement(el) {
  el.classList.remove('hidden');
  // P0 FIX: Remove inert when showing element (enables focus)
  el.removeAttribute('inert');
  if (!prefersReducedMotion.matches) {
    el.style.opacity = '0';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 200ms ease-out';
      el.style.opacity = '1';
    });
  }
}

function hideElement(el) {
  // P0 FIX: Add inert when hiding element (prevents focus trap)
  el.setAttribute('inert', '');
  if (!prefersReducedMotion.matches) {
    el.style.transition = 'opacity 150ms ease-out';
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hidden'), 150);
  } else {
    el.classList.add('hidden');
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function resetUpload() {
  // Clear processing state (disables beforeunload warning)
  isProcessing = false;

  showElement(elements.uploadSection);
  hideElement(elements.progressSection);
  hideElement(elements.videoInfo);
  hideElement(elements.eventsSection);
  hideElement(elements.videoPlayerSection);

  // Clean up video
  if (videoUrl) {
    URL.revokeObjectURL(videoUrl);
    videoUrl = null;
  }
  elements.videoPlayer.src = '';
  elements.videoPlayer.load();

  elements.fileInput.value = '';
  currentJobId = null;
  processingResult = null;
  elements.exportBtn.disabled = true;
  if (elements.copyBtn) {
    elements.copyBtn.disabled = true;
  }

  // Reset bookmarks section
  if (elements.bookmarksSection) {
    hideElement(elements.bookmarksSection);
  }

  // Reset study notes preview
  if (elements.studyNotesPreview) {
    hideElement(elements.studyNotesPreview);
  }

  // Reset search and transcript
  updateSearchPlaceholder('Upload a video to search through transcript and visual content');

  clearElement(elements.transcriptContent);
  const emptyTranscript = createEmptyState(
    'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    'No transcript yet',
    'Upload a video to generate a transcript'
  );
  elements.transcriptContent.appendChild(emptyTranscript);
}

// ============================================
// BOOKMARKS & CONFUSION MARKERS
// ============================================
let userBookmarks = [];
let userConfusionMarkers = [];

function initBookmarks() {
  // Load from localStorage
  loadBookmarksFromStorage();
  loadConfusionFromStorage();

  // Set up event listeners for bookmark buttons
  if (elements.addBookmarkBtn) {
    elements.addBookmarkBtn.addEventListener('click', showBookmarkTypeSelector);
  }
  if (elements.markConfusionBtn) {
    elements.markConfusionBtn.addEventListener('click', handleMarkConfusion);
  }

  // Keyboard shortcuts (1-4) for quick bookmarks
  document.addEventListener('keydown', handleBookmarkKeyboardShortcut);
}

/**
 * Handle keyboard shortcuts for bookmarks (keys 1-4)
 */
function handleBookmarkKeyboardShortcut(e) {
  // Only trigger if video is loaded and not typing in an input
  if (!currentJobId || !videoUrl) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Map keys 1-4 to bookmark types
  const keyMap = { '1': 'important', '2': 'question', '3': 'insight', '4': 'todo' };
  const type = keyMap[e.key];

  if (type) {
    e.preventDefault();
    addBookmarkWithType(type);
  }
}

/**
 * Show bookmark type selector modal
 */
function showBookmarkTypeSelector() {
  if (!elements.videoPlayer || !currentJobId) {
    showToast('warning', 'No Video', 'Please upload and process a video first');
    return;
  }

  // Create overlay
  const overlay = createElement('div', 'bookmark-type-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Create selector
  const selector = createElement('div', 'bookmark-type-selector');
  const title = createElement('p', 'bookmark-type-title', {
    textContent: 'Select bookmark type:'
  });
  selector.appendChild(title);

  const options = createElement('div', 'bookmark-type-options');
  Object.entries(BOOKMARK_TYPES).forEach(([type, info]) => {
    const option = createElement('button', `bookmark-type-option bookmark-type-option--${info.color}`, {
      'data-bookmark-type': type
    });
    const icon = createElement('span', 'bookmark-type-option-icon', { textContent: info.icon });
    const label = createElement('span', 'bookmark-type-option-label', { textContent: info.label });
    const key = createElement('kbd', 'bookmark-type-option-key', { textContent: info.key });
    option.appendChild(icon);
    option.appendChild(label);
    option.appendChild(key);

    option.addEventListener('click', () => {
      overlay.remove();
      addBookmarkWithType(type);
    });

    options.appendChild(option);
  });

  selector.appendChild(options);

  // Keyboard hint
  const hint = createElement('p', 'bookmark-type-hint text-muted', {
    textContent: 'Tip: Press 1-4 while video plays to quickly bookmark'
  });
  selector.appendChild(hint);

  overlay.appendChild(selector);
  document.body.appendChild(overlay);

  // Close on escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Add a bookmark with a specific type
 */
function addBookmarkWithType(type) {
  if (!elements.videoPlayer || !currentJobId) {
    showToast('warning', 'No Video', 'Please upload and process a video first');
    return;
  }

  const timestamp = elements.videoPlayer.currentTime;
  showBookmarkNoteModal(type, timestamp);
}

/**
 * Show modal to add note to bookmark
 */
function showBookmarkNoteModal(type, timestamp) {
  const typeInfo = BOOKMARK_TYPES[type];

  // Create modal overlay
  const overlay = createElement('div', 'bookmark-modal-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Create modal
  const modal = createElement('div', 'bookmark-modal');

  // Header
  const header = createElement('div', 'bookmark-modal-header');
  const iconSpan = createElement('span', `bookmark-icon bookmark-icon--${typeInfo.color}`, {
    textContent: typeInfo.icon
  });
  const titleDiv = createElement('div', 'bookmark-modal-title-group');
  const title = createElement('h3', 'bookmark-modal-title', {
    textContent: `Add ${typeInfo.label} Bookmark`
  });
  const timestampText = createElement('span', 'bookmark-modal-timestamp', {
    textContent: `at ${formatDurationFull(timestamp)}`
  });
  titleDiv.appendChild(title);
  titleDiv.appendChild(timestampText);
  header.appendChild(iconSpan);
  header.appendChild(titleDiv);

  // Note input
  const noteGroup = createElement('div', 'bookmark-modal-note-group');
  const noteLabel = createElement('label', 'bookmark-modal-label', {
    textContent: 'Note (optional):'
  });
  const noteInput = createElement('textarea', 'bookmark-modal-textarea input', {
    placeholder: 'Add a note about this moment...',
    rows: '3'
  });
  noteGroup.appendChild(noteLabel);
  noteGroup.appendChild(noteInput);

  // Buttons
  const buttons = createElement('div', 'bookmark-modal-buttons');
  const cancelBtn = createElement('button', 'btn', { 'data-variant': 'secondary' });
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = createElement('button', 'btn', { 'data-variant': 'primary' });
  saveBtn.textContent = 'Save Bookmark';
  saveBtn.addEventListener('click', () => {
    saveBookmarkWithNote(type, timestamp, noteInput.value.trim());
    overlay.remove();
  });

  buttons.appendChild(cancelBtn);
  buttons.appendChild(saveBtn);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(noteGroup);
  modal.appendChild(buttons);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus on textarea
  noteInput.focus();

  // Submit on Enter (with Ctrl/Cmd)
  noteInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      saveBookmarkWithNote(type, timestamp, noteInput.value.trim());
      overlay.remove();
    }
  });

  // Close on escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Save bookmark with type and note
 */
function saveBookmarkWithNote(type, timestamp, note) {
  const typeInfo = BOOKMARK_TYPES[type];

  const bookmark = {
    id: Date.now().toString(),
    jobId: currentJobId,
    timestamp: timestamp,
    type: type,
    note: note || '',
    createdAt: new Date().toISOString(),
  };

  userBookmarks.push(bookmark);
  saveBookmarksToStorage();
  renderBookmarksList();

  showToast('success', 'Bookmark Added', `${typeInfo.icon} ${typeInfo.label} at ${formatDurationFull(timestamp)}`);
}

function loadBookmarksFromStorage() {
  try {
    const stored = localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (stored) {
      userBookmarks = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load bookmarks from storage:', e);
    userBookmarks = [];
  }
}

function saveBookmarksToStorage() {
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(userBookmarks));
  } catch (e) {
    console.warn('Failed to save bookmarks to storage:', e);
  }
}

function loadConfusionFromStorage() {
  try {
    const stored = localStorage.getItem(CONFUSION_STORAGE_KEY);
    if (stored) {
      userConfusionMarkers = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load confusion markers from storage:', e);
    userConfusionMarkers = [];
  }
}

function saveConfusionToStorage() {
  try {
    localStorage.setItem(CONFUSION_STORAGE_KEY, JSON.stringify(userConfusionMarkers));
  } catch (e) {
    console.warn('Failed to save confusion markers to storage:', e);
  }
}

function getBookmarks() {
  return userBookmarks.filter(b => b.jobId === currentJobId);
}

function getConfusionMarkers() {
  return userConfusionMarkers.filter(c => c.jobId === currentJobId);
}

function handleMarkConfusion() {
  if (!elements.videoPlayer || !currentJobId) {
    showToast('warning', 'No Video', 'Please upload and process a video first');
    return;
  }

  const timestamp = elements.videoPlayer.currentTime;
  const note = prompt('What was confusing? (optional):');

  // If user cancels the prompt, don't add marker
  if (note === null) return;

  const marker = {
    id: Date.now().toString(),
    jobId: currentJobId,
    timestamp: timestamp,
    note: note || '',
    createdAt: new Date().toISOString(),
  };

  userConfusionMarkers.push(marker);
  saveConfusionToStorage();

  showToast('info', 'Marked for Review', `Confusion marker at ${formatDurationFull(timestamp)}`);
}

function renderBookmarksList() {
  if (!elements.bookmarksList || !elements.bookmarksSection) return;

  const bookmarks = getBookmarks();

  if (bookmarks.length === 0) {
    hideElement(elements.bookmarksSection);
    return;
  }

  showElement(elements.bookmarksSection);
  clearElement(elements.bookmarksList);

  if (elements.bookmarksCount) {
    elements.bookmarksCount.textContent = bookmarks.length.toString();
  }

  const sortedBookmarks = [...bookmarks].sort((a, b) => a.timestamp - b.timestamp);

  sortedBookmarks.forEach((bookmark) => {
    const typeInfo = BOOKMARK_TYPES[bookmark.type] || BOOKMARK_TYPES.important;

    const item = createElement('div', `bookmark-item bookmark-item--${typeInfo.color}`, {
      'data-timestamp': bookmark.timestamp,
      tabindex: '0',
      role: 'button',
    });

    // Type icon
    const iconSpan = createElement('span', `bookmark-item-icon bookmark-icon--${typeInfo.color}`, {
      textContent: typeInfo.icon,
      title: typeInfo.label,
    });

    const timeSpan = createElement('span', 'bookmark-time timestamp-link', {
      textContent: formatDurationFull(bookmark.timestamp),
    });

    const noteSpan = createElement('span', 'bookmark-note', {
      textContent: bookmark.note || typeInfo.label,
    });

    const deleteBtn = createElement('button', 'bookmark-delete', {
      'aria-label': 'Delete bookmark',
      title: 'Delete',
      // Security fix C4: Use textContent with Unicode × instead of innerHTML
      textContent: '\u00D7',
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBookmark(bookmark.id);
    });

    item.appendChild(iconSpan);
    item.appendChild(timeSpan);
    item.appendChild(noteSpan);
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => {
      seekVideo(bookmark.timestamp);
    });

    // Keyboard support
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seekVideo(bookmark.timestamp);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteBookmark(bookmark.id);
      }
    });

    elements.bookmarksList.appendChild(item);
  });
}

function deleteBookmark(id) {
  userBookmarks = userBookmarks.filter(b => b.id !== id);
  saveBookmarksToStorage();
  renderBookmarksList();
  showToast('info', 'Bookmark Removed', 'The bookmark has been deleted');
}

// ============================================
// CONFUSION VOTING (1-CLICK ON TRANSCRIPT/EVENTS)
// ============================================

/**
 * Get confusion votes from localStorage (different from confusion markers)
 * This is for the 1-click voting feature on transcript chunks/events
 */
function getConfusionVotes() {
  try {
    const stored = localStorage.getItem('lectureMind_confusionVotes');
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Error reading confusion votes:', e);
    return {};
  }
}

/**
 * Save confusion votes to localStorage
 */
function saveConfusionVotes(votes) {
  try {
    localStorage.setItem('lectureMind_confusionVotes', JSON.stringify(votes));
  } catch (e) {
    console.error('Error saving confusion votes:', e);
  }
}

/**
 * Get votes for current job
 */
function getCurrentJobConfusionVotes() {
  if (!currentJobId) return {};
  const allVotes = getConfusionVotes();
  return allVotes[currentJobId] || {};
}

/**
 * Toggle a confusion vote for a timestamp
 */
function toggleConfusionVote(timestamp, timestampFormatted) {
  if (!currentJobId) return false;

  const allVotes = getConfusionVotes();
  if (!allVotes[currentJobId]) {
    allVotes[currentJobId] = {};
  }

  const key = String(timestamp);
  const isVoted = !!allVotes[currentJobId][key];

  if (isVoted) {
    // Remove vote
    delete allVotes[currentJobId][key];
    showToast('info', 'Vote Removed', `Confusion mark removed from ${timestampFormatted}`);
  } else {
    // Add vote
    allVotes[currentJobId][key] = {
      timestamp: timestamp,
      timestampFormatted: timestampFormatted,
      votedAt: Date.now()
    };
    showToast('info', 'Marked Confusing', `Moment at ${timestampFormatted} marked as confusing`);
  }

  saveConfusionVotes(allVotes);
  updateConfusionMomentsUI();

  return !isVoted;
}

/**
 * Check if a timestamp is marked as confusing
 */
function isTimestampConfusing(timestamp) {
  const votes = getCurrentJobConfusionVotes();
  return !!votes[String(timestamp)];
}

/**
 * Get top confusing moments sorted by most recent
 */
function getTopConfusingMoments(limit = 5) {
  const votes = getCurrentJobConfusionVotes();
  return Object.values(votes)
    .sort((a, b) => b.votedAt - a.votedAt)
    .slice(0, limit);
}

/**
 * Create a confusion vote button for transcript/event items
 */
function createConfusionVoteButton(timestamp, timestampFormatted) {
  const btn = createElement('button', 'confusion-btn', {
    'aria-label': 'Mark as confusing',
    title: 'Mark this moment as confusing',
    'data-timestamp': timestamp,
  });

  btn.textContent = '?';

  // Set initial state
  if (isTimestampConfusing(timestamp)) {
    btn.classList.add('voted');
    btn.setAttribute('aria-pressed', 'true');
  } else {
    btn.setAttribute('aria-pressed', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isNowVoted = toggleConfusionVote(timestamp, timestampFormatted);

    if (isNowVoted) {
      btn.classList.add('voted');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('voted');
      btn.setAttribute('aria-pressed', 'false');
    }

    // Animate button
    if (!prefersReducedMotion.matches) {
      btn.animate([
        { transform: 'scale(1.2)' },
        { transform: 'scale(1)' }
      ], { duration: 200, easing: 'ease-out' });
    }
  });

  return btn;
}

/**
 * Update the "Most Confusing Moments" section UI
 */
function updateConfusionMomentsUI() {
  if (!elements.confusionSection || !elements.confusionList) return;

  const topMoments = getTopConfusingMoments(5);

  if (topMoments.length === 0) {
    hideElement(elements.confusionSection);
    return;
  }

  showElement(elements.confusionSection);
  clearElement(elements.confusionList);

  topMoments.forEach((moment, i) => {
    const item = createElement('div', 'confusion-item animate-fadeInUp', {
      tabindex: '0',
      role: 'button',
      'aria-label': `Confusing moment at ${moment.timestampFormatted}, click to jump`,
    });
    item.style.animationDelay = `${i * 50}ms`;

    const badge = createElement('span', 'confusion-item-badge', {
      textContent: '?',
    });

    const time = createElement('span', 'confusion-item-time timestamp-link', {
      textContent: moment.timestampFormatted,
      title: 'Click to jump to this moment',
    });

    item.appendChild(badge);
    item.appendChild(time);

    // Click to seek video
    item.addEventListener('click', () => {
      seekVideo(moment.timestamp);
    });

    // Keyboard support
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seekVideo(moment.timestamp);
      }
    });

    elements.confusionList.appendChild(item);
  });

  // Sync all confusion buttons on the page
  $$('.confusion-btn').forEach(btn => {
    const timestamp = parseFloat(btn.getAttribute('data-timestamp'));
    if (isTimestampConfusing(timestamp)) {
      btn.classList.add('voted');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('voted');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

// CSS moved to app-components.css (M3 fix — no more runtime CSS injection)

// ============================================
// STUDY TOOLS MODULE
// ============================================
const NOTES_STORAGE_KEY = 'lectureMind_notes';
let studyToolsState = {
  quizQuestions: [],
  currentQuizIndex: 0,
  quizScore: 0,
  flashcards: [],
  currentFlashcardIndex: 0,
  userNotes: [],
  selectedTags: []
};

// Initialize study tools when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initStudyTools();
});

function initStudyTools() {
  // Load notes from storage
  loadNotesFromStorage();

  // Quiz buttons
  const generateQuizBtn = $('#generate-quiz-btn');
  const closeQuizBtn = $('#close-quiz-btn');
  const nextQuestionBtn = $('#next-question-btn');

  if (generateQuizBtn) {
    generateQuizBtn.addEventListener('click', handleGenerateQuiz);
  }
  if (closeQuizBtn) {
    closeQuizBtn.addEventListener('click', closeQuizPanel);
  }
  if (nextQuestionBtn) {
    nextQuestionBtn.addEventListener('click', handleNextQuestion);
  }

  // Flashcard buttons
  const createFlashcardsBtn = $('#create-flashcards-btn');
  const closeFlashcardsBtn = $('#close-flashcards-btn');
  const shuffleCardsBtn = $('#shuffle-cards-btn');
  const prevCardBtn = $('#prev-card-btn');
  const nextCardBtn = $('#next-card-btn');
  const flashcard = $('#current-flashcard');

  if (createFlashcardsBtn) {
    createFlashcardsBtn.addEventListener('click', handleCreateFlashcards);
  }
  if (closeFlashcardsBtn) {
    closeFlashcardsBtn.addEventListener('click', closeFlashcardsPanel);
  }
  if (shuffleCardsBtn) {
    shuffleCardsBtn.addEventListener('click', shuffleFlashcards);
  }
  if (prevCardBtn) {
    prevCardBtn.addEventListener('click', showPreviousCard);
  }
  if (nextCardBtn) {
    nextCardBtn.addEventListener('click', showNextCard);
  }
  if (flashcard) {
    flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));
  }

  // Share buttons
  const shareBtn = $('#share-btn');
  const closeShareBtn = $('#close-share-btn');
  const copyShareLinkBtn = $('#copy-share-link-btn');
  const createStudyGroupBtn = $('#create-study-group-btn');
  const emailSummaryBtn = $('#email-summary-btn');

  if (shareBtn) {
    shareBtn.addEventListener('click', openSharePanel);
  }
  if (closeShareBtn) {
    closeShareBtn.addEventListener('click', closeSharePanel);
  }
  if (copyShareLinkBtn) {
    copyShareLinkBtn.addEventListener('click', handleCopyShareLink);
  }
  if (createStudyGroupBtn) {
    createStudyGroupBtn.addEventListener('click', handleCreateStudyGroup);
  }
  if (emailSummaryBtn) {
    emailSummaryBtn.addEventListener('click', handleEmailSummary);
  }

  // Notes buttons
  const openNotesBtn = $('#open-notes-btn');
  const closeNotesBtn = $('#close-notes-btn');
  const useCurrentTimeBtn = $('#use-current-time-btn');
  const saveNoteBtn = $('#save-note-btn');
  const noteTags = $$('.notes-tag');

  if (openNotesBtn) {
    openNotesBtn.addEventListener('click', openNotesPanel);
  }
  if (closeNotesBtn) {
    closeNotesBtn.addEventListener('click', closeNotesPanel);
  }
  if (useCurrentTimeBtn) {
    useCurrentTimeBtn.addEventListener('click', useCurrentVideoTime);
  }
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener('click', handleSaveNote);
  }
  noteTags.forEach(tag => {
    tag.addEventListener('click', () => toggleNoteTag(tag));
  });
}

/**
 * Enable study tools buttons after video is processed
 */
function enableStudyTools() {
  const buttons = [
    '#generate-quiz-btn',
    '#create-flashcards-btn',
    '#share-btn',
    '#open-notes-btn'
  ];

  buttons.forEach(selector => {
    const btn = $(selector);
    if (btn) {
      btn.disabled = false;
    }
  });
}

// ============================================
// QUIZ GENERATION
// ============================================
function handleGenerateQuiz() {
  if (!processingResult || !processingResult.transcript) {
    showToast('warning', 'No Content', 'Process a video first to generate a quiz');
    return;
  }

  // Generate quiz questions from transcript
  studyToolsState.quizQuestions = generateQuizFromTranscript(processingResult.transcript);
  studyToolsState.currentQuizIndex = 0;
  studyToolsState.quizScore = 0;

  if (studyToolsState.quizQuestions.length === 0) {
    showToast('warning', 'Cannot Generate Quiz', 'Not enough content in transcript');
    return;
  }

  // Show quiz panel
  const studyToolsGrid = $('.study-tools-grid');
  const quizPanel = $('#quiz-panel');

  if (studyToolsGrid) hideElement(studyToolsGrid);
  if (quizPanel) {
    showElement(quizPanel);
    renderQuizQuestion();
  }

  showToast('success', 'Quiz Generated', `${studyToolsState.quizQuestions.length} questions created`);
}

function generateQuizFromTranscript(transcript) {
  const questions = [];

  // Extract key sentences from transcript chunks
  const sentences = transcript
    .map(chunk => chunk.text)
    .join(' ')
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 20)
    .slice(0, 10);

  // Generate fill-in-blank style questions
  sentences.forEach((sentence, i) => {
    const words = sentence.trim().split(/\s+/);
    if (words.length < 5) return;

    // Find a key word to blank out (noun-like words, 4+ chars)
    const keywordIndex = words.findIndex((w, idx) =>
      idx > 1 && idx < words.length - 1 && w.length >= 4 && /^[A-Z]?[a-z]+$/.test(w)
    );

    if (keywordIndex === -1) return;

    const keyword = words[keywordIndex];
    const blankedSentence = [...words];
    blankedSentence[keywordIndex] = '_____';

    // Generate wrong options
    const otherWords = words
      .filter((w, idx) => idx !== keywordIndex && w.length >= 3)
      .slice(0, 2);

    const options = [
      keyword,
      otherWords[0] || 'option',
      otherWords[1] || 'answer',
      'none of the above'
    ].sort(() => Math.random() - 0.5);

    questions.push({
      id: i,
      question: `Complete the sentence:\n"${blankedSentence.join(' ')}"`,
      options: options,
      correctIndex: options.indexOf(keyword),
      selectedIndex: null
    });
  });

  return questions.slice(0, 5); // Limit to 5 questions
}

function renderQuizQuestion() {
  const quizContent = $('#quiz-content');
  const quizProgress = $('#quiz-progress');
  const nextBtn = $('#next-question-btn');

  if (!quizContent) return;

  const question = studyToolsState.quizQuestions[studyToolsState.currentQuizIndex];
  if (!question) {
    renderQuizScore();
    return;
  }

  // Update progress
  if (quizProgress) {
    quizProgress.textContent = `Question ${studyToolsState.currentQuizIndex + 1} of ${studyToolsState.quizQuestions.length}`;
  }

  if (nextBtn) {
    nextBtn.textContent = studyToolsState.currentQuizIndex === studyToolsState.quizQuestions.length - 1
      ? 'See Results' : 'Next Question';
  }

  clearElement(quizContent);

  const questionDiv = createElement('div', 'quiz-question');
  const questionText = createElement('p', 'quiz-question-text', {
    textContent: question.question
  });

  const optionsDiv = createElement('div', 'quiz-options');
  const letters = ['A', 'B', 'C', 'D'];

  question.options.forEach((option, i) => {
    const optionBtn = createElement('div', 'quiz-option', {
      tabindex: '0',
      role: 'button',
      'data-index': i
    });

    const letter = createElement('span', 'quiz-option-letter', { textContent: letters[i] });
    const text = createElement('span', 'quiz-option-text', { textContent: option });

    optionBtn.appendChild(letter);
    optionBtn.appendChild(text);

    optionBtn.addEventListener('click', () => selectQuizOption(i));
    optionBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectQuizOption(i);
      }
    });

    optionsDiv.appendChild(optionBtn);
  });

  questionDiv.appendChild(questionText);
  questionDiv.appendChild(optionsDiv);
  quizContent.appendChild(questionDiv);
}

function selectQuizOption(index) {
  const question = studyToolsState.quizQuestions[studyToolsState.currentQuizIndex];
  if (!question || question.selectedIndex !== null) return;

  question.selectedIndex = index;

  // Update UI
  const options = $$('.quiz-option');
  options.forEach((opt, i) => {
    opt.setAttribute('data-selected', i === index ? 'true' : 'false');

    if (i === question.correctIndex) {
      opt.setAttribute('data-correct', 'true');
    } else if (i === index && i !== question.correctIndex) {
      opt.setAttribute('data-incorrect', 'true');
    }
  });

  if (index === question.correctIndex) {
    studyToolsState.quizScore++;
  }
}

function handleNextQuestion() {
  const question = studyToolsState.quizQuestions[studyToolsState.currentQuizIndex];
  if (question && question.selectedIndex === null) {
    showToast('warning', 'Select an Answer', 'Please select an option before continuing');
    return;
  }

  studyToolsState.currentQuizIndex++;
  renderQuizQuestion();
}

function renderQuizScore() {
  const quizContent = $('#quiz-content');
  const quizFooter = $('.quiz-footer');

  if (!quizContent) return;

  clearElement(quizContent);

  const scoreDiv = createElement('div', 'quiz-score');

  const scoreCircle = createElement('div', 'quiz-score-circle');
  const scoreValue = createElement('span', 'quiz-score-value', {
    textContent: `${studyToolsState.quizScore}/${studyToolsState.quizQuestions.length}`
  });
  const scoreLabel = createElement('span', 'quiz-score-label', { textContent: 'Correct' });
  scoreCircle.appendChild(scoreValue);
  scoreCircle.appendChild(scoreLabel);

  const percentage = Math.round((studyToolsState.quizScore / studyToolsState.quizQuestions.length) * 100);
  const message = percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good job!' : 'Keep studying!';

  const messageP = createElement('p', 'quiz-score-message', { textContent: message });

  const retryBtn = createElement('button', 'btn', { 'data-variant': 'primary' });
  retryBtn.textContent = 'Try Again';
  retryBtn.addEventListener('click', () => {
    studyToolsState.currentQuizIndex = 0;
    studyToolsState.quizScore = 0;
    studyToolsState.quizQuestions.forEach(q => q.selectedIndex = null);
    renderQuizQuestion();
  });

  scoreDiv.appendChild(scoreCircle);
  scoreDiv.appendChild(messageP);
  scoreDiv.appendChild(retryBtn);
  quizContent.appendChild(scoreDiv);

  if (quizFooter) {
    hideElement(quizFooter);
  }
}

function closeQuizPanel() {
  const studyToolsGrid = $('.study-tools-grid');
  const quizPanel = $('#quiz-panel');
  const quizFooter = $('.quiz-footer');

  if (quizPanel) hideElement(quizPanel);
  if (studyToolsGrid) showElement(studyToolsGrid);
  if (quizFooter) showElement(quizFooter);
}

// ============================================
// FLASHCARDS
// ============================================
function handleCreateFlashcards() {
  if (!processingResult || !processingResult.transcript) {
    showToast('warning', 'No Content', 'Process a video first to create flashcards');
    return;
  }

  // Generate flashcards from transcript
  studyToolsState.flashcards = generateFlashcardsFromTranscript(processingResult.transcript);
  studyToolsState.currentFlashcardIndex = 0;

  if (studyToolsState.flashcards.length === 0) {
    showToast('warning', 'Cannot Create Flashcards', 'Not enough content in transcript');
    return;
  }

  // Show flashcards panel
  const studyToolsGrid = $('.study-tools-grid');
  const flashcardsPanel = $('#flashcards-panel');

  if (studyToolsGrid) hideElement(studyToolsGrid);
  if (flashcardsPanel) {
    showElement(flashcardsPanel);
    renderCurrentFlashcard();
  }

  showToast('success', 'Flashcards Created', `${studyToolsState.flashcards.length} cards ready`);
}

function generateFlashcardsFromTranscript(transcript) {
  const flashcards = [];

  // Create flashcards from transcript chunks
  transcript.forEach((chunk, i) => {
    const text = chunk.text.trim();
    if (text.length < 30) return;

    // Split into question/answer format
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 2) return;

    // First sentence as question context, rest as answer
    const question = `What was discussed at ${chunk.start_formatted}?`;
    const answer = sentences.slice(0, 2).join('. ').trim();

    if (answer.length > 20) {
      flashcards.push({
        id: i,
        front: question,
        back: answer,
        timestamp: chunk.start
      });
    }
  });

  return flashcards.slice(0, 10); // Limit to 10 cards
}

function renderCurrentFlashcard() {
  const flashcard = studyToolsState.flashcards[studyToolsState.currentFlashcardIndex];
  const frontText = $('#flashcard-front-text');
  const backText = $('#flashcard-back-text');
  const progress = $('#flashcard-progress');
  const card = $('#current-flashcard');

  if (!flashcard) return;

  if (frontText) frontText.textContent = flashcard.front;
  if (backText) backText.textContent = flashcard.back;
  if (progress) {
    progress.textContent = `${studyToolsState.currentFlashcardIndex + 1} / ${studyToolsState.flashcards.length}`;
  }

  // Reset flip state
  if (card) card.classList.remove('flipped');
}

function showPreviousCard() {
  if (studyToolsState.currentFlashcardIndex > 0) {
    const card = $('#current-flashcard');
    if (card && !prefersReducedMotion.matches) {
      card.classList.add('swiping-right');
      setTimeout(() => {
        card.classList.remove('swiping-right');
        studyToolsState.currentFlashcardIndex--;
        renderCurrentFlashcard();
      }, 300);
    } else {
      studyToolsState.currentFlashcardIndex--;
      renderCurrentFlashcard();
    }
  }
}

function showNextCard() {
  if (studyToolsState.currentFlashcardIndex < studyToolsState.flashcards.length - 1) {
    const card = $('#current-flashcard');
    if (card && !prefersReducedMotion.matches) {
      card.classList.add('swiping-left');
      setTimeout(() => {
        card.classList.remove('swiping-left');
        studyToolsState.currentFlashcardIndex++;
        renderCurrentFlashcard();
      }, 300);
    } else {
      studyToolsState.currentFlashcardIndex++;
      renderCurrentFlashcard();
    }
  }
}

function shuffleFlashcards() {
  // Fisher-Yates shuffle
  for (let i = studyToolsState.flashcards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [studyToolsState.flashcards[i], studyToolsState.flashcards[j]] =
    [studyToolsState.flashcards[j], studyToolsState.flashcards[i]];
  }

  studyToolsState.currentFlashcardIndex = 0;
  renderCurrentFlashcard();
  showToast('info', 'Cards Shuffled', 'Flashcards have been randomized');
}

function closeFlashcardsPanel() {
  const studyToolsGrid = $('.study-tools-grid');
  const flashcardsPanel = $('#flashcards-panel');

  if (flashcardsPanel) hideElement(flashcardsPanel);
  if (studyToolsGrid) showElement(studyToolsGrid);
}

// ============================================
// SHARE & COLLABORATE
// ============================================
function openSharePanel() {
  if (!currentJobId) {
    showToast('warning', 'No Video', 'Process a video first to share');
    return;
  }

  const studyToolsGrid = $('.study-tools-grid');
  const sharePanel = $('#share-panel');

  if (studyToolsGrid) hideElement(studyToolsGrid);
  if (sharePanel) showElement(sharePanel);
}

function closeSharePanel() {
  const studyToolsGrid = $('.study-tools-grid');
  const sharePanel = $('#share-panel');

  if (sharePanel) hideElement(sharePanel);
  if (studyToolsGrid) showElement(studyToolsGrid);
}

async function handleCopyShareLink() {
  if (!currentJobId) return;

  const currentTime = elements.videoPlayer?.currentTime || 0;
  const shareData = {
    jobId: currentJobId,
    timestamp: currentTime,
    notes: studyToolsState.userNotes.filter(n => n.jobId === currentJobId)
  };

  // Encode share data
  const encodedData = btoa(JSON.stringify(shareData));
  const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encodedData}`;

  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('success', 'Link Copied!', 'Share this link with your classmates');
  } catch (e) {
    // Fallback: show in prompt
    prompt('Copy this share link:', shareUrl);
  }
}

function handleCreateStudyGroup() {
  // Generate a unique group ID
  const groupId = Math.random().toString(36).substring(2, 8).toUpperCase();

  showToast('info', 'Study Group Created', `Group ID: ${groupId} (Feature coming soon!)`);

  // In a real implementation, this would create a collaborative session
}

function handleEmailSummary() {
  if (!processingResult) {
    showToast('warning', 'No Content', 'Process a video first');
    return;
  }

  const meta = processingResult.metadata;
  const subject = encodeURIComponent(`Lecture Notes: ${meta.filename}`);
  const body = encodeURIComponent(generateStudyNotesMarkdown().substring(0, 2000) + '\n\n...');

  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  showToast('success', 'Email Draft Opened', 'Check your email client');
}

// ============================================
// NOTES & ANNOTATIONS
// ============================================
function openNotesPanel() {
  if (!currentJobId) {
    showToast('warning', 'No Video', 'Process a video first to add notes');
    return;
  }

  const studyToolsGrid = $('.study-tools-grid');
  const notesPanel = $('#notes-panel');

  if (studyToolsGrid) hideElement(studyToolsGrid);
  if (notesPanel) {
    showElement(notesPanel);
    renderNotesList();
  }

  // Set initial timestamp
  useCurrentVideoTime();
}

function closeNotesPanel() {
  const studyToolsGrid = $('.study-tools-grid');
  const notesPanel = $('#notes-panel');

  if (notesPanel) hideElement(notesPanel);
  if (studyToolsGrid) showElement(studyToolsGrid);

  // Reset form
  clearNoteForm();
}

function useCurrentVideoTime() {
  const timestampInput = $('#note-timestamp');
  if (timestampInput && elements.videoPlayer) {
    timestampInput.value = formatDurationFull(elements.videoPlayer.currentTime);
  }
}

function toggleNoteTag(tagBtn) {
  const tag = tagBtn.getAttribute('data-tag');
  const isSelected = tagBtn.classList.contains('selected');

  if (isSelected) {
    tagBtn.classList.remove('selected');
    studyToolsState.selectedTags = studyToolsState.selectedTags.filter(t => t !== tag);
  } else {
    tagBtn.classList.add('selected');
    studyToolsState.selectedTags.push(tag);
  }
}

function handleSaveNote() {
  const timestampInput = $('#note-timestamp');
  const contentTextarea = $('#note-content');

  if (!timestampInput || !contentTextarea) return;

  const content = contentTextarea.value.trim();
  if (!content) {
    showToast('warning', 'Empty Note', 'Please write something before saving');
    return;
  }

  // Parse timestamp to seconds
  const timestampParts = timestampInput.value.split(':').map(Number);
  let timestampSeconds = 0;
  if (timestampParts.length === 3) {
    timestampSeconds = timestampParts[0] * 3600 + timestampParts[1] * 60 + timestampParts[2];
  } else if (timestampParts.length === 2) {
    timestampSeconds = timestampParts[0] * 60 + timestampParts[1];
  }

  const note = {
    id: Date.now().toString(),
    jobId: currentJobId,
    timestamp: timestampSeconds,
    timestampFormatted: timestampInput.value,
    content: content,
    tags: [...studyToolsState.selectedTags],
    createdAt: new Date().toISOString()
  };

  studyToolsState.userNotes.push(note);
  saveNotesToStorage();
  renderNotesList();
  clearNoteForm();

  showToast('success', 'Note Saved', `Note added at ${timestampInput.value}`);
}

function clearNoteForm() {
  const contentTextarea = $('#note-content');
  if (contentTextarea) contentTextarea.value = '';

  studyToolsState.selectedTags = [];
  $$('.notes-tag').forEach(tag => tag.classList.remove('selected'));
}

function renderNotesList() {
  const notesList = $('#notes-list');
  if (!notesList) return;

  clearElement(notesList);

  const notes = studyToolsState.userNotes
    .filter(n => n.jobId === currentJobId)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (notes.length === 0) {
    const empty = createElement('p', 'text-muted', {
      textContent: 'No notes yet. Add your first note above!'
    });
    empty.style.textAlign = 'center';
    empty.style.padding = 'var(--space-4)';
    notesList.appendChild(empty);
    return;
  }

  notes.forEach((note, i) => {
    const item = createElement('div', 'note-item animate-fadeInUp', {
      'data-timestamp': note.timestamp,
      tabindex: '0'
    });
    item.style.animationDelay = `${i * 50}ms`;

    const header = createElement('div', 'note-item-header');
    const timestamp = createElement('span', 'note-item-timestamp', {
      textContent: note.timestampFormatted
    });

    const tagsDiv = createElement('div', 'note-item-tags');
    note.tags.forEach(tag => {
      const tagSpan = createElement('span', 'note-item-tag', { textContent: tag });
      tagsDiv.appendChild(tagSpan);
    });

    header.appendChild(timestamp);
    header.appendChild(tagsDiv);

    const content = createElement('p', 'note-item-content', {
      textContent: note.content.substring(0, 150) + (note.content.length > 150 ? '...' : '')
    });

    const deleteBtn = createElement('button', 'note-item-delete', { textContent: 'Delete' });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNote(note.id);
    });

    item.appendChild(header);
    item.appendChild(content);
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => seekVideo(note.timestamp));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seekVideo(note.timestamp);
      }
    });

    notesList.appendChild(item);
  });
}

function deleteNote(noteId) {
  studyToolsState.userNotes = studyToolsState.userNotes.filter(n => n.id !== noteId);
  saveNotesToStorage();
  renderNotesList();
  showToast('info', 'Note Deleted', 'Your note has been removed');
}

function loadNotesFromStorage() {
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    if (stored) {
      studyToolsState.userNotes = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load notes from storage:', e);
    studyToolsState.userNotes = [];
  }
}

function saveNotesToStorage() {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(studyToolsState.userNotes));
  } catch (e) {
    console.warn('Failed to save notes to storage:', e);
  }
}

// Hook into the results loading to enable study tools
const originalLoadResults = loadResults;
loadResults = async function() {
  await originalLoadResults();
  enableStudyTools();
};
