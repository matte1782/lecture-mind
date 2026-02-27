/**
 * Shared DOM utilities for Lecture Mind modules.
 *
 * Extracted from flashcards.js to allow sharing between flashcards.js
 * and library.js without circular dependencies.
 *
 * Safe DOM: createElement + textContent only, zero innerHTML.
 *
 * @module dom-utils
 * @version 1.0.0
 */

// ============================================================================
// LISTENER REGISTRY (memory leak prevention)
// ============================================================================

const _listeners = new Map();

/**
 * Register an event listener and track it for cleanup.
 * @param {EventTarget} target - DOM element or window
 * @param {string} eventType - Event name (click, keydown, etc.)
 * @param {Function} handler - Event handler
 * @param {Object} [options={}] - addEventListener options
 */
function registerListener(target, eventType, handler, options = {}) {
  target.addEventListener(eventType, handler, options);
  if (!_listeners.has(eventType)) {
    _listeners.set(eventType, new Set());
  }
  _listeners.get(eventType).add({ target, handler, options });
}

/**
 * Remove all registered listeners.
 */
function cleanupListeners() {
  _listeners.forEach((listeners, eventType) => {
    listeners.forEach(({ target, handler, options }) => {
      target.removeEventListener(eventType, handler, options);
    });
  });
  _listeners.clear();
}

/**
 * Remove all registered listeners for a specific target.
 * @param {EventTarget} target - DOM element to clean up
 */
function removeListenersForTarget(target) {
  _listeners.forEach((listeners, eventType) => {
    const toRemove = [];
    for (const entry of listeners) {
      if (entry.target === target) {
        target.removeEventListener(eventType, entry.handler, entry.options);
        toRemove.push(entry);
      }
    }
    for (const entry of toRemove) {
      listeners.delete(entry);
    }
  });
}

// ============================================================================
// DOM UTILITIES (safe, XSS-free)
// ============================================================================

/**
 * Create a DOM element with className and attributes. Safe: uses textContent, not innerHTML.
 * @param {string} tag - HTML tag name
 * @param {string} [className] - CSS class(es)
 * @param {Object} [attrs={}] - Attributes to set (textContent, disabled handled specially)
 * @returns {HTMLElement}
 */
function createElement(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'textContent') {
      el.textContent = value;
    } else if (key === 'disabled') {
      el.disabled = value;
    } else {
      el.setAttribute(key, String(value));
    }
  }
  return el;
}

/**
 * Remove all child nodes from an element.
 * @param {HTMLElement} el
 */
function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Show an element by removing hidden class and inert attribute.
 * @param {HTMLElement} el
 */
function showElement(el) {
  el.classList.remove('hidden');
  el.removeAttribute('inert');
}

/**
 * Hide an element by adding hidden class and inert attribute.
 * @param {HTMLElement} el
 */
function hideElement(el) {
  el.classList.add('hidden');
  el.setAttribute('inert', '');
}

/**
 * Sanitize a string for safe use as an ID lookup (alphanumeric + hyphens only).
 * @param {string} raw
 * @returns {string}
 */
function sanitizeId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^a-zA-Z0-9\-_]/g, '');
}

// ============================================================================
// FORMATTING UTILITIES (NEW — not extracted from flashcards.js)
// ============================================================================

/**
 * Format seconds into human-readable duration string.
 * @param {number} seconds - Duration in seconds
 * @returns {string} "HH:MM:SS" or "MM:SS" if under 1 hour
 */
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

/**
 * Format a date as a human-readable relative time string.
 * @param {Date|string|number} date - Date to format
 * @returns {string} e.g. "just now", "5 minutes ago", "3 days ago"
 */
function timeAgo(date) {
  const now = Date.now();
  const past = new Date(date).getTime();
  if (isNaN(past)) return 'unknown';
  const diffMs = now - past;
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Listener registry
  registerListener,
  cleanupListeners,
  removeListenersForTarget,

  // DOM utilities
  createElement,
  clearElement,
  showElement,
  hideElement,
  sanitizeId,

  // Formatting
  formatDuration,
  timeAgo
};
