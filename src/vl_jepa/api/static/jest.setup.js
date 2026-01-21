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
