/**
 * @fileoverview Tests for Service Worker utilities (Week 14 Day 0).
 * TDD: tests written before implementation.
 */

import { jest } from '@jest/globals';

import {
  registerServiceWorker,
  getCacheVersion,
  getStaticAssetList,
  isStaticAsset
} from './sw-utils.js';

// ============================================================================
// SERVICE WORKER UTILS TESTS
// ============================================================================

describe('SW Utils — Day 0: Service Worker', () => {

  // --------------------------------------------------------------------------
  // getCacheVersion
  // --------------------------------------------------------------------------

  describe('getCacheVersion', () => {
    test('returns lm-v0.4.0', () => {
      expect(getCacheVersion()).toBe('lm-v0.4.0');
    });
  });

  // --------------------------------------------------------------------------
  // getStaticAssetList
  // --------------------------------------------------------------------------

  describe('getStaticAssetList', () => {
    test('returns all CSS/JS paths', () => {
      const assets = getStaticAssetList();
      expect(Array.isArray(assets)).toBe(true);
      expect(assets.length).toBeGreaterThan(10);
      // Every asset should be a string starting with /static/
      for (const a of assets) {
        expect(typeof a).toBe('string');
        expect(a.startsWith('/static/')).toBe(true);
      }
    });

    test('includes analytics.css and analytics.js', () => {
      const assets = getStaticAssetList();
      expect(assets).toContain('/static/analytics.css');
      expect(assets).toContain('/static/analytics.js');
    });
  });

  // --------------------------------------------------------------------------
  // isStaticAsset
  // --------------------------------------------------------------------------

  describe('isStaticAsset', () => {
    test('true for .css/.js files', () => {
      expect(isStaticAsset('/static/app.js')).toBe(true);
      expect(isStaticAsset('/static/tokens.css')).toBe(true);
      expect(isStaticAsset('/static/index.html')).toBe(true);
    });

    test('false for /api/ routes', () => {
      expect(isStaticAsset('/api/lectures')).toBe(false);
      expect(isStaticAsset('/api/v1/search')).toBe(false);
    });

    test('false for video files', () => {
      expect(isStaticAsset('/videos/lecture.mp4')).toBe(false);
      expect(isStaticAsset('/media/clip.webm')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // registerServiceWorker
  // --------------------------------------------------------------------------

  describe('registerServiceWorker', () => {
    const originalSW = navigator.serviceWorker;

    afterEach(() => {
      // Restore original
      Object.defineProperty(navigator, 'serviceWorker', {
        value: originalSW,
        writable: true,
        configurable: true
      });
    });

    test('calls navigator.serviceWorker.register when available', async () => {
      const mockRegistration = { scope: '/' };
      const mockRegister = jest.fn().mockResolvedValue(mockRegistration);
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { register: mockRegister },
        writable: true,
        configurable: true
      });

      const result = await registerServiceWorker();
      expect(mockRegister).toHaveBeenCalledWith('/static/sw.js');
      expect(result).toBe(mockRegistration);
    });

    test('returns null when SW not supported', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const result = await registerServiceWorker();
      expect(result).toBeNull();
    });

    test('catches registration errors', async () => {
      const mockRegister = jest.fn().mockRejectedValue(new Error('SW failed'));
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { register: mockRegister },
        writable: true,
        configurable: true
      });

      const result = await registerServiceWorker();
      expect(result).toBeNull();
    });

    test('returns a Promise', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const result = registerServiceWorker();
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
