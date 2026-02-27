/**
 * Jest setup file - polyfills for test environment
 */

// Polyfill structuredClone for jsdom environment
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    if (obj === undefined) return undefined;
    return JSON.parse(JSON.stringify(obj));
  };
}

// Mock IntersectionObserver for jsdom (not natively available)
if (typeof IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback) { this._callback = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
    /** Test helper: manually trigger with entries */
    _trigger(entries) { this._callback(entries, this); }
  };
}
