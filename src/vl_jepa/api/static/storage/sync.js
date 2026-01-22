/**
 * @fileoverview Offline sync manager for Lecture Mind storage layer.
 * Handles sync queue, online/offline detection, conflict resolution, and retry logic.
 *
 * @module storage/sync
 * @version 1.0.0
 */

import { SyncQueueRepository } from './repositories.js';
import { SYNC_STATUS } from './models.js';

// ============================================================================
// Constants
// ============================================================================

/** Base backoff time in milliseconds (1 second) */
export const BASE_BACKOFF_MS = 1000;

/** Maximum backoff time in milliseconds (30 seconds) */
export const MAX_BACKOFF_MS = 30000;

/** Maximum number of retry attempts before marking as permanently failed */
export const MAX_RETRY_COUNT = 5;

// ============================================================================
// Exponential Backoff
// ============================================================================

/**
 * Calculate exponential backoff delay for a given retry attempt.
 * Includes jitter to prevent thundering herd problem.
 * @param {number} retryCount - Number of previous retry attempts
 * @param {boolean} [withJitter=true] - Whether to add randomized jitter
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoff(retryCount, withJitter = true) {
  const baseDelay = BASE_BACKOFF_MS * Math.pow(2, retryCount);
  const cappedDelay = Math.min(baseDelay, MAX_BACKOFF_MS);

  if (withJitter) {
    // Add jitter: delay * (0.5 + random(0, 0.5)) = delay * (0.5 to 1.0)
    return Math.floor(cappedDelay * (0.5 + Math.random() * 0.5));
  }

  return cappedDelay;
}

// ============================================================================
// Sync Manager
// ============================================================================

/**
 * Manages offline sync queue with automatic retry and conflict resolution.
 * @class
 */
export class SyncManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.syncEndpoint='/api/sync'] - Server sync endpoint
   * @param {boolean} [options.autoSync=false] - Auto-sync when online
   */
  constructor(options = {}) {
    this.syncEndpoint = options.syncEndpoint || '/api/sync';
    this.autoSync = options.autoSync || false;

    /** @type {boolean} Current online status */
    this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    /** @type {boolean} Whether a sync is currently in progress */
    this._isSyncing = false;

    /** @type {Function|null} Callback when going online */
    this.onOnline = null;

    /** @type {Function|null} Callback when going offline */
    this.onOffline = null;

    /** @type {Function|null} Callback when sync starts */
    this.onSyncStart = null;

    /** @type {Function|null} Callback when sync completes */
    this.onSyncComplete = null;

    /** @type {Function|null} Callback when sync error occurs */
    this.onSyncError = null;

    // Bind event handlers
    this._handleOnline = this.handleOnline.bind(this);
    this._handleOffline = this.handleOffline.bind(this);

    // Set up event listeners if in browser environment
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleOnline);
      window.addEventListener('offline', this._handleOffline);
    }
  }

  /**
   * Get current online status.
   * @returns {boolean}
   */
  get isOnline() {
    return this._isOnline;
  }

  /**
   * Get current syncing status.
   * @returns {boolean}
   */
  get isSyncing() {
    return this._isSyncing;
  }

  /**
   * Handle online event.
   * @returns {void}
   */
  handleOnline() {
    this._isOnline = true;
    this._safeCallback(this.onOnline);
    if (this.autoSync) {
      this.syncAll();
    }
  }

  /**
   * Handle offline event.
   * @returns {void}
   */
  handleOffline() {
    this._isOnline = false;
    this._safeCallback(this.onOffline);
  }

  /**
   * Safely invoke a callback, catching any exceptions.
   * @param {Function|null} callback - Callback to invoke
   * @param {...*} args - Arguments to pass to callback
   * @private
   */
  _safeCallback(callback, ...args) {
    if (callback) {
      try {
        callback(...args);
      } catch (error) {
        console.error('SyncManager callback error:', error);
      }
    }
  }

  /**
   * Recover items stuck in SYNCING state (from crashed sessions).
   * Resets them to PENDING so they can be retried.
   * @returns {Promise<number>} Number of items recovered
   */
  async recoverStuckItems() {
    const stuckItems = await SyncQueueRepository.getStuck();
    let recovered = 0;

    for (const item of stuckItems) {
      await SyncQueueRepository.resetToPending(item.id);
      recovered++;
    }

    return recovered;
  }

  /**
   * Enqueue a sync operation.
   * @param {Object} data
   * @param {string} data.operation - 'create', 'update', or 'delete'
   * @param {string} data.entityType - Entity type (lecture, flashcard, etc.)
   * @param {string} data.entityId - Entity ID
   * @param {Object} data.payload - Changed data
   * @returns {Promise<Object>} Created sync queue item
   */
  async enqueue(data) {
    return SyncQueueRepository.enqueue(data);
  }

  /**
   * Get count of pending sync items.
   * @returns {Promise<number>}
   */
  async getPendingCount() {
    const pending = await SyncQueueRepository.getPending();
    return pending.length;
  }

  /**
   * Get all pending sync items.
   * @returns {Promise<Array>}
   */
  async getPendingItems() {
    return SyncQueueRepository.getPending();
  }

  /**
   * Resolve conflict between local and remote versions using last-write-wins.
   * @param {Object} local - Local version
   * @param {Object} remote - Remote version
   * @returns {Object} Winning version
   */
  resolveConflict(local, remote) {
    const localTime = local.updatedAt || 0;
    const remoteTime = remote.updatedAt || 0;

    // Last-write-wins: return version with more recent timestamp
    // On tie, prefer local (optimistic concurrency)
    return localTime >= remoteTime ? local : remote;
  }

  /**
   * Get next retry time for an item.
   * @param {Object} item - Sync queue item
   * @returns {number} Delay in milliseconds
   */
  getNextRetryTime(item) {
    return calculateBackoff(item.retryCount);
  }

  /**
   * Sync a single item to the server.
   * Re-fetches item state to prevent race conditions.
   * @param {Object} item - Sync queue item (used for ID reference)
   * @returns {Promise<Object>} Sync result
   */
  async syncItem(item) {
    // Skip if offline
    if (!this._isOnline) {
      return { skipped: true, reason: 'offline' };
    }

    // C1/C4: Re-fetch item to get current state (prevents race conditions)
    const currentItem = await SyncQueueRepository.getById(item.id);

    // C4: Validate item exists
    if (!currentItem) {
      return { skipped: true, reason: 'item_not_found' };
    }

    // C4: Validate item is in sync-eligible state
    if (currentItem.status === SYNC_STATUS.COMPLETED) {
      return { skipped: true, reason: 'already_completed' };
    }

    if (currentItem.status === SYNC_STATUS.SYNCING) {
      return { skipped: true, reason: 'already_syncing' };
    }

    // Skip if already at max retries
    if (currentItem.retryCount >= MAX_RETRY_COUNT) {
      return { skipped: true, reason: 'max_retries_exceeded' };
    }

    try {
      // Mark as syncing
      await SyncQueueRepository.markSyncing(currentItem.id);

      // Attempt sync (server endpoint may not exist yet)
      const response = await fetch(this.syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: currentItem.operation,
          entityType: currentItem.entityType,
          entityId: currentItem.entityId,
          payload: currentItem.payload
        })
      });

      if (!response.ok) {
        // M3: Differentiate HTTP errors
        const status = response.status;
        const isPermanentError = status >= 400 && status < 500;

        if (isPermanentError) {
          // 4xx errors are permanent - mark as completed with error (don't retry)
          await SyncQueueRepository.markFailed(currentItem.id);
          const error = new Error(`Permanent error: ${status} ${response.statusText || ''}`);
          error.permanent = true;
          error.status = status;
          this._safeCallback(this.onSyncError, error, currentItem);
          return { success: false, error: error.message, permanent: true, item: currentItem };
        }

        // 5xx errors are transient - retry allowed
        throw new Error(`Server error: ${status} ${response.statusText || ''}`);
      }

      // Mark as completed
      await SyncQueueRepository.markCompleted(currentItem.id);

      return { success: true, item: currentItem };

    } catch (error) {
      // Mark as failed (increments retry count) for transient errors
      await SyncQueueRepository.markFailed(currentItem.id);
      this._safeCallback(this.onSyncError, error, currentItem);
      return { success: false, error: error.message, item: currentItem };
    }
  }

  /**
   * Sync all pending items.
   * @returns {Promise<Object>} Sync results
   */
  async syncAll() {
    // Prevent concurrent syncs
    if (this._isSyncing) {
      return { processed: 0, succeeded: 0, failed: 0, skipped: true };
    }

    // Skip if offline
    if (!this._isOnline) {
      return { processed: 0, succeeded: 0, failed: 0, skipped: true, reason: 'offline' };
    }

    this._isSyncing = true;
    this._safeCallback(this.onSyncStart);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0
    };

    try {
      const pending = await this.getPendingItems();

      for (const item of pending) {
        const result = await this.syncItem(item);
        results.processed++;

        if (result.success) {
          results.succeeded++;
        } else if (!result.skipped) {
          results.failed++;
        }
      }

    } finally {
      this._isSyncing = false;
      this._safeCallback(this.onSyncComplete, results);
    }

    return results;
  }

  /**
   * Clear completed sync items.
   * @returns {Promise<void>}
   */
  async clearCompleted() {
    return SyncQueueRepository.clearCompleted();
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._handleOnline);
      window.removeEventListener('offline', this._handleOffline);
    }
  }
}

export default SyncManager;
