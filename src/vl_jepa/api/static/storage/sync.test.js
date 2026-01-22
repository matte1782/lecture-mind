/**
 * @fileoverview Unit tests for offline sync manager (sync.js)
 * Tests sync queue, online/offline detection, conflict resolution, and retry logic
 */

import { jest } from '@jest/globals';

import {
  openDatabase,
  deleteDatabase,
  closeDatabase
} from './db.js';

import {
  SyncManager,
  calculateBackoff,
  MAX_RETRY_COUNT,
  MAX_BACKOFF_MS,
  BASE_BACKOFF_MS
} from './sync.js';

import { SyncQueueRepository } from './repositories.js';
import { SYNC_OPERATION, SYNC_STATUS } from './models.js';

// Helper to generate unique IDs for testing
const generateId = () => `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// Mock navigator.onLine
const mockNavigator = (online) => {
  Object.defineProperty(global, 'navigator', {
    value: { onLine: online },
    writable: true,
    configurable: true
  });
};

// Mock fetch for sync operations
const mockFetch = (responseOrError) => {
  global.fetch = jest.fn().mockImplementation(() => {
    if (responseOrError instanceof Error) {
      return Promise.reject(responseOrError);
    }
    return Promise.resolve({
      ok: responseOrError.ok !== false,
      status: responseOrError.status || 200,
      json: () => Promise.resolve(responseOrError.data || {})
    });
  });
};

describe('Exponential Backoff', () => {
  test('calculateBackoff returns BASE_BACKOFF_MS for retry 0 (without jitter)', () => {
    // Test without jitter for exact value
    expect(calculateBackoff(0, false)).toBe(BASE_BACKOFF_MS);
  });

  test('calculateBackoff doubles each retry (without jitter)', () => {
    // Test without jitter for exact values
    expect(calculateBackoff(0, false)).toBe(1000);  // 1s
    expect(calculateBackoff(1, false)).toBe(2000);  // 2s
    expect(calculateBackoff(2, false)).toBe(4000);  // 4s
    expect(calculateBackoff(3, false)).toBe(8000);  // 8s
    expect(calculateBackoff(4, false)).toBe(16000); // 16s
  });

  test('calculateBackoff caps at MAX_BACKOFF_MS (without jitter)', () => {
    expect(calculateBackoff(10, false)).toBe(MAX_BACKOFF_MS);
    expect(calculateBackoff(100, false)).toBe(MAX_BACKOFF_MS);
  });

  test('calculateBackoff with jitter returns value in expected range', () => {
    // With jitter: delay * (0.5 to 1.0)
    // For retry 0: base is 1000, so result should be 500-1000
    const result = calculateBackoff(0, true);
    expect(result).toBeGreaterThanOrEqual(500);
    expect(result).toBeLessThanOrEqual(1000);
  });

  test('MAX_BACKOFF_MS is 30 seconds', () => {
    expect(MAX_BACKOFF_MS).toBe(30000);
  });

  test('MAX_RETRY_COUNT is 5', () => {
    expect(MAX_RETRY_COUNT).toBe(5);
  });
});

describe('SyncManager Initialization', () => {
  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('SyncManager initializes with default state', () => {
    const manager = new SyncManager();
    expect(manager.isOnline).toBe(true);
    expect(manager.isSyncing).toBe(false);
  });

  test('SyncManager detects offline state', () => {
    mockNavigator(false);
    const manager = new SyncManager();
    expect(manager.isOnline).toBe(false);
  });
});

describe('SyncManager Queue Operations', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager();
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('enqueue adds item to sync queue', async () => {
    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: { front: 'Q', back: 'A' }
    });

    expect(item.id).toBeDefined();
    expect(item.status).toBe(SYNC_STATUS.PENDING);
    expect(item.retryCount).toBe(0);
  });

  test('enqueue works when offline', async () => {
    mockNavigator(false);
    manager = new SyncManager();

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: { title: 'Updated' }
    });

    expect(item.status).toBe(SYNC_STATUS.PENDING);
  });

  test('getPendingCount returns correct count', async () => {
    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'bookmark',
      entityId: generateId(),
      payload: {}
    });
    await manager.enqueue({
      operation: SYNC_OPERATION.DELETE,
      entityType: 'event',
      entityId: generateId(),
      payload: {}
    });

    const count = await manager.getPendingCount();
    expect(count).toBe(2);
  });

  test('getPendingItems returns pending items', async () => {
    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'progress',
      entityId: generateId(),
      payload: {}
    });

    const items = await manager.getPendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].entityType).toBe('progress');
  });
});

describe('Offline Queueing', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(false); // Start offline
    manager = new SyncManager();
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('changes queue when offline', async () => {
    expect(manager.isOnline).toBe(false);

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: { front: 'Q', back: 'A' }
    });

    const count = await manager.getPendingCount();
    expect(count).toBe(1);
  });

  test('multiple changes queue correctly when offline', async () => {
    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await manager.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await manager.enqueue({
      operation: SYNC_OPERATION.DELETE,
      entityType: 'bookmark',
      entityId: generateId(),
      payload: {}
    });

    const count = await manager.getPendingCount();
    expect(count).toBe(3);
  });
});

describe('Online/Offline Detection', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager();
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('onOnline callback is called when going online', () => {
    const onOnline = jest.fn();
    manager.onOnline = onOnline;

    // Simulate going offline then online
    mockNavigator(false);
    manager.handleOffline();
    expect(manager.isOnline).toBe(false);

    mockNavigator(true);
    manager.handleOnline();
    expect(manager.isOnline).toBe(true);
    expect(onOnline).toHaveBeenCalled();
  });

  test('onOffline callback is called when going offline', () => {
    const onOffline = jest.fn();
    manager.onOffline = onOffline;

    mockNavigator(false);
    manager.handleOffline();
    expect(onOffline).toHaveBeenCalled();
  });

  test('isOnline reflects navigator.onLine state', () => {
    mockNavigator(true);
    manager.handleOnline();
    expect(manager.isOnline).toBe(true);

    mockNavigator(false);
    manager.handleOffline();
    expect(manager.isOnline).toBe(false);
  });
});

describe('Conflict Resolution (Last-Write-Wins)', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager();
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('resolveConflict returns local version for newer timestamp', () => {
    const local = { id: '1', title: 'Local', updatedAt: 2000 };
    const remote = { id: '1', title: 'Remote', updatedAt: 1000 };

    const resolved = manager.resolveConflict(local, remote);
    expect(resolved.title).toBe('Local');
  });

  test('resolveConflict returns remote version for older local timestamp', () => {
    const local = { id: '1', title: 'Local', updatedAt: 1000 };
    const remote = { id: '1', title: 'Remote', updatedAt: 2000 };

    const resolved = manager.resolveConflict(local, remote);
    expect(resolved.title).toBe('Remote');
  });

  test('resolveConflict returns local on equal timestamps (tie-breaker)', () => {
    const local = { id: '1', title: 'Local', updatedAt: 1000 };
    const remote = { id: '1', title: 'Remote', updatedAt: 1000 };

    const resolved = manager.resolveConflict(local, remote);
    expect(resolved.title).toBe('Local');
  });

  test('resolveConflict handles missing timestamps', () => {
    const local = { id: '1', title: 'Local' };
    const remote = { id: '1', title: 'Remote', updatedAt: 1000 };

    // Local without timestamp loses to remote with timestamp
    const resolved = manager.resolveConflict(local, remote);
    expect(resolved.title).toBe('Remote');
  });
});

describe('Retry with Exponential Backoff', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('failed sync increments retry count', async () => {
    mockFetch(new Error('Network error'));

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    await manager.syncItem(item);

    const updated = await SyncQueueRepository.getById(item.id);
    expect(updated.retryCount).toBe(1);
    expect(updated.status).toBe(SYNC_STATUS.FAILED);
  });

  test('item marked as permanently failed after MAX_RETRY_COUNT', async () => {
    mockFetch(new Error('Network error'));

    // Create item with retryCount at max - 1
    const item = await SyncQueueRepository.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    // Manually set retry count to MAX - 1
    await SyncQueueRepository.markFailed(item.id);
    await SyncQueueRepository.markFailed(item.id);
    await SyncQueueRepository.markFailed(item.id);
    await SyncQueueRepository.markFailed(item.id);

    const beforeSync = await SyncQueueRepository.getById(item.id);
    expect(beforeSync.retryCount).toBe(4);

    // This should be the 5th failure
    await manager.syncItem(beforeSync);

    const afterSync = await SyncQueueRepository.getById(item.id);
    expect(afterSync.retryCount).toBe(5);
    expect(afterSync.status).toBe(SYNC_STATUS.FAILED);
  });

  test('getNextRetryTime calculates correct backoff with jitter', () => {
    const item0 = { retryCount: 0 };
    const item1 = { retryCount: 1 };
    const item2 = { retryCount: 2 };
    const item3 = { retryCount: 3 };

    // With jitter, values should be in range [base * 0.5, base]
    expect(manager.getNextRetryTime(item0)).toBeGreaterThanOrEqual(500);
    expect(manager.getNextRetryTime(item0)).toBeLessThanOrEqual(1000);

    expect(manager.getNextRetryTime(item1)).toBeGreaterThanOrEqual(1000);
    expect(manager.getNextRetryTime(item1)).toBeLessThanOrEqual(2000);

    expect(manager.getNextRetryTime(item2)).toBeGreaterThanOrEqual(2000);
    expect(manager.getNextRetryTime(item2)).toBeLessThanOrEqual(4000);

    expect(manager.getNextRetryTime(item3)).toBeGreaterThanOrEqual(4000);
    expect(manager.getNextRetryTime(item3)).toBeLessThanOrEqual(8000);
  });
});

describe('Sync Process', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('successful sync marks item as completed', async () => {
    mockFetch({ ok: true, data: { success: true } });

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'bookmark',
      entityId: generateId(),
      payload: { timestamp: 100 }
    });

    await manager.syncItem(item);

    const updated = await SyncQueueRepository.getById(item.id);
    expect(updated.status).toBe(SYNC_STATUS.COMPLETED);
  });

  test('sync skipped when offline', async () => {
    mockNavigator(false);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
    mockFetch({ ok: true });

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    const result = await manager.syncItem(item);
    expect(result.skipped).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('syncAll processes all pending items', async () => {
    mockFetch({ ok: true, data: { success: true } });

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await manager.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    const result = await manager.syncAll();
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });

  test('syncAll handles mixed success/failure', async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.reject(new Error('Network error'));
    });

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });
    await manager.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    const result = await manager.syncAll();
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('Sync Events', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('onSyncStart callback is called when sync begins', async () => {
    mockFetch({ ok: true });
    const onSyncStart = jest.fn();
    manager.onSyncStart = onSyncStart;

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'bookmark',
      entityId: generateId(),
      payload: {}
    });

    await manager.syncAll();
    expect(onSyncStart).toHaveBeenCalled();
  });

  test('onSyncComplete callback is called when sync finishes', async () => {
    mockFetch({ ok: true });
    const onSyncComplete = jest.fn();
    manager.onSyncComplete = onSyncComplete;

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'event',
      entityId: generateId(),
      payload: {}
    });

    await manager.syncAll();
    expect(onSyncComplete).toHaveBeenCalledWith(expect.objectContaining({
      processed: 1,
      succeeded: 1,
      failed: 0
    }));
  });

  test('onSyncError callback is called on sync failure', async () => {
    mockFetch(new Error('Network error'));
    const onSyncError = jest.fn();
    manager.onSyncError = onSyncError;

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.DELETE,
      entityType: 'progress',
      entityId: generateId(),
      payload: {}
    });

    await manager.syncItem(item);
    expect(onSyncError).toHaveBeenCalled();
  });
});

describe('Edge Cases', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('syncAll handles empty queue gracefully', async () => {
    const result = await manager.syncAll();
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
  });

  test('concurrent sync calls are prevented', async () => {
    mockFetch({ ok: true });

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    // Start two syncs concurrently
    const sync1 = manager.syncAll();
    const sync2 = manager.syncAll();

    const [result1, result2] = await Promise.all([sync1, sync2]);

    // One should process, one should be skipped
    const totalProcessed = result1.processed + result2.processed;
    expect(totalProcessed).toBe(1);
  });

  test('clearCompleted removes only completed items', async () => {
    mockFetch({ ok: true });

    const item1 = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    await manager.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    // Sync one item
    await manager.syncItem(item1);

    // Clear completed
    await manager.clearCompleted();

    const pending = await manager.getPendingItems();
    expect(pending).toHaveLength(1);
    expect(pending[0].entityType).toBe('flashcard');
  });
});

describe('SYNCING State Recovery (C3)', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('recoverStuckItems resets SYNCING items to PENDING', async () => {
    // Enqueue an item
    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    // Manually set to SYNCING (simulating crash during sync)
    await SyncQueueRepository.markSyncing(item.id);

    // Verify it's stuck
    const stuck = await SyncQueueRepository.getStuck();
    expect(stuck).toHaveLength(1);

    // Recover
    const recovered = await manager.recoverStuckItems();
    expect(recovered).toBe(1);

    // Verify it's back to PENDING
    const updated = await SyncQueueRepository.getById(item.id);
    expect(updated.status).toBe(SYNC_STATUS.PENDING);
  });

  test('recoverStuckItems handles empty stuck queue', async () => {
    const recovered = await manager.recoverStuckItems();
    expect(recovered).toBe(0);
  });
});

describe('Item State Validation (C4)', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('syncItem skips non-existent item', async () => {
    const fakeItem = { id: 'non-existent-id' };
    const result = await manager.syncItem(fakeItem);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('item_not_found');
  });

  test('syncItem skips already completed item', async () => {
    mockFetch({ ok: true });

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    // Mark as completed
    await SyncQueueRepository.markCompleted(item.id);

    // Try to sync again
    const result = await manager.syncItem(item);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_completed');
  });

  test('syncItem skips item currently syncing', async () => {
    const item = await manager.enqueue({
      operation: SYNC_OPERATION.UPDATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    // Mark as syncing (simulating another process)
    await SyncQueueRepository.markSyncing(item.id);

    // Try to sync
    const result = await manager.syncItem(item);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_syncing');
  });
});

describe('HTTP Error Differentiation (M3)', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('4xx error is treated as permanent (no retry)', async () => {
    // Mock 400 Bad Request
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request'
    });

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'flashcard',
      entityId: generateId(),
      payload: {}
    });

    const result = await manager.syncItem(item);
    expect(result.success).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toContain('Permanent error');
  });

  test('5xx error is treated as transient (allows retry)', async () => {
    // Mock 500 Internal Server Error
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const item = await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'lecture',
      entityId: generateId(),
      payload: {}
    });

    const result = await manager.syncItem(item);
    expect(result.success).toBe(false);
    expect(result.permanent).toBeUndefined();
    expect(result.error).toContain('Server error');

    // Verify item is still retriable
    const updated = await SyncQueueRepository.getById(item.id);
    expect(updated.status).toBe(SYNC_STATUS.FAILED);
    expect(updated.retryCount).toBe(1);
  });
});

describe('Safe Callback Error Handling (M5)', () => {
  let manager;

  beforeEach(async () => {
    await openDatabase();
    mockNavigator(true);
    manager = new SyncManager({ syncEndpoint: '/api/sync' });
  });

  afterEach(async () => {
    manager.destroy();
    closeDatabase();
    await deleteDatabase();
    jest.clearAllMocks();
  });

  test('callback exception does not break sync flow', async () => {
    mockFetch({ ok: true });

    // Set callbacks that throw
    manager.onSyncStart = () => { throw new Error('Callback error'); };
    manager.onSyncComplete = () => { throw new Error('Callback error'); };

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'bookmark',
      entityId: generateId(),
      payload: {}
    });

    // Should not throw, should complete sync
    const result = await manager.syncAll();
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
  });

  test('onOnline callback exception does not prevent autoSync', async () => {
    mockFetch({ ok: true });

    manager = new SyncManager({ syncEndpoint: '/api/sync', autoSync: true });
    manager.onOnline = () => { throw new Error('Callback error'); };

    await manager.enqueue({
      operation: SYNC_OPERATION.CREATE,
      entityType: 'event',
      entityId: generateId(),
      payload: {}
    });

    // Simulate going online
    mockNavigator(true);
    manager.handleOnline();

    // Give sync a moment to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Sync should still have happened
    const pending = await manager.getPendingCount();
    expect(pending).toBe(0);
  });
});
