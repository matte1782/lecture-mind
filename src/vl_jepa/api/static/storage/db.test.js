/**
 * @fileoverview Unit tests for IndexedDB storage layer (db.js)
 * Uses fake-indexeddb for deterministic testing
 */

import {
  DB_NAME,
  DB_VERSION,
  STORES,
  isIndexedDBAvailable,
  openDatabase,
  closeDatabase,
  deleteDatabase,
  get,
  put,
  remove,
  getAll,
  queryByIndex,
  count,
  clear,
  batch,
  LectureMindDB
} from './db.js';

// Helper to generate unique IDs
const generateId = () => `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

describe('Database Configuration', () => {
  test('DB_NAME is defined', () => {
    expect(DB_NAME).toBe('LectureMindDB');
  });

  test('DB_VERSION is defined', () => {
    expect(DB_VERSION).toBe(1);
  });

  test('STORES has correct number of object stores', () => {
    const expectedStoreCount = Object.keys(STORES).length;
    expect(Object.keys(STORES)).toHaveLength(expectedStoreCount);
    // Verify we have all required stores (this test ensures no stores are accidentally removed)
    expect(expectedStoreCount).toBe(10);
  });

  test('STORES contains all required stores', () => {
    const requiredStores = [
      'settings', 'courses', 'lectures', 'segments', 'events',
      'progress', 'flashcards', 'bookmarks', 'confusionVotes', 'syncQueue'
    ];
    for (const store of requiredStores) {
      expect(STORES).toHaveProperty(store);
    }
  });

  test('Each store has a keyPath', () => {
    for (const [name, config] of Object.entries(STORES)) {
      expect(config.keyPath).toBeDefined();
      expect(typeof config.keyPath).toBe('string');
    }
  });
});

describe('IndexedDB Availability', () => {
  test('isIndexedDBAvailable returns true with fake-indexeddb', () => {
    expect(isIndexedDBAvailable()).toBe(true);
  });
});

describe('Database Connection', () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  test('openDatabase returns a database instance', async () => {
    const db = await openDatabase();
    expect(db).toBeDefined();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
  });

  test('openDatabase creates all object stores', async () => {
    const db = await openDatabase();
    const storeNames = Array.from(db.objectStoreNames);

    expect(storeNames).toHaveLength(Object.keys(STORES).length);
    for (const storeName of Object.keys(STORES)) {
      expect(storeNames).toContain(storeName);
    }
  });

  test('openDatabase reuses existing connection (connection pooling)', async () => {
    const db1 = await openDatabase();
    const db2 = await openDatabase();
    expect(db1).toBe(db2);
  });

  test('closeDatabase closes the connection', async () => {
    await openDatabase();
    closeDatabase();
    // After closing, next open should create new connection
    const db = await openDatabase();
    expect(db).toBeDefined();
  });

  test('deleteDatabase removes the database', async () => {
    await openDatabase();
    closeDatabase();
    await deleteDatabase();
    // Database should be recreated on next open
    const db = await openDatabase();
    expect(db).toBeDefined();
    expect(db.version).toBe(DB_VERSION);
  });
});

describe('CRUD Operations', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  describe('put and get', () => {
    test('put stores a record and get retrieves it', async () => {
      const record = { key: 'test-setting', value: 'test-value' };
      await put('settings', record);

      const retrieved = await get('settings', 'test-setting');
      expect(retrieved).toEqual(record);
    });

    test('get returns undefined for non-existent key', async () => {
      const result = await get('settings', 'non-existent');
      expect(result).toBeUndefined();
    });

    test('put updates existing record', async () => {
      const record1 = { key: 'test-setting', value: 'initial' };
      const record2 = { key: 'test-setting', value: 'updated' };

      await put('settings', record1);
      await put('settings', record2);

      const retrieved = await get('settings', 'test-setting');
      expect(retrieved.value).toBe('updated');
    });
  });

  describe('remove', () => {
    test('remove deletes a record', async () => {
      const record = { key: 'to-delete', value: 'test' };
      await put('settings', record);

      await remove('settings', 'to-delete');

      const result = await get('settings', 'to-delete');
      expect(result).toBeUndefined();
    });

    test('remove does not throw for non-existent key', async () => {
      await expect(remove('settings', 'non-existent')).resolves.toBeUndefined();
    });
  });

  describe('getAll', () => {
    test('getAll returns all records', async () => {
      await put('settings', { key: 'key1', value: 'val1' });
      await put('settings', { key: 'key2', value: 'val2' });
      await put('settings', { key: 'key3', value: 'val3' });

      const all = await getAll('settings');
      expect(all).toHaveLength(3);
    });

    test('getAll returns empty array for empty store', async () => {
      const all = await getAll('settings');
      expect(all).toEqual([]);
    });

    test('getAll respects limit parameter', async () => {
      await put('settings', { key: 'key1', value: 'val1' });
      await put('settings', { key: 'key2', value: 'val2' });
      await put('settings', { key: 'key3', value: 'val3' });

      const limited = await getAll('settings', 2);
      expect(limited).toHaveLength(2);
    });
  });

  describe('clear', () => {
    test('clear removes all records from store', async () => {
      await put('settings', { key: 'key1', value: 'val1' });
      await put('settings', { key: 'key2', value: 'val2' });

      await clear('settings');

      const all = await getAll('settings');
      expect(all).toHaveLength(0);
    });
  });
});

describe('Index Queries', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  test('queryByIndex returns matching records', async () => {
    const lectureId = generateId();
    const flashcard1 = { id: generateId(), lectureId, front: 'Q1', back: 'A1', status: 'new', dueDate: Date.now() };
    const flashcard2 = { id: generateId(), lectureId, front: 'Q2', back: 'A2', status: 'new', dueDate: Date.now() };
    const flashcard3 = { id: generateId(), lectureId: 'other', front: 'Q3', back: 'A3', status: 'new', dueDate: Date.now() };

    await put('flashcards', flashcard1);
    await put('flashcards', flashcard2);
    await put('flashcards', flashcard3);

    const results = await queryByIndex('flashcards', 'lectureId', lectureId);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.lectureId === lectureId)).toBe(true);
  });

  test('queryByIndex returns empty array for no matches', async () => {
    const results = await queryByIndex('flashcards', 'lectureId', 'non-existent');
    expect(results).toEqual([]);
  });

  test('count returns total records', async () => {
    await put('settings', { key: 'key1', value: 'val1' });
    await put('settings', { key: 'key2', value: 'val2' });

    const total = await count('settings');
    expect(total).toBe(2);
  });

  test('count with index returns filtered count', async () => {
    const lectureId = generateId();
    await put('flashcards', { id: generateId(), lectureId, front: 'Q1', back: 'A1', status: 'new', dueDate: Date.now() });
    await put('flashcards', { id: generateId(), lectureId, front: 'Q2', back: 'A2', status: 'new', dueDate: Date.now() });
    await put('flashcards', { id: generateId(), lectureId: 'other', front: 'Q3', back: 'A3', status: 'new', dueDate: Date.now() });

    const filtered = await count('flashcards', 'lectureId', lectureId);
    expect(filtered).toBe(2);
  });
});

describe('Batch Operations', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  test('batch executes multiple put operations', async () => {
    const operations = [
      { type: 'put', value: { key: 'batch1', value: 'val1' } },
      { type: 'put', value: { key: 'batch2', value: 'val2' } },
      { type: 'put', value: { key: 'batch3', value: 'val3' } }
    ];

    await batch('settings', operations);

    const all = await getAll('settings');
    expect(all).toHaveLength(3);
  });

  test('batch executes mixed put and delete operations', async () => {
    await put('settings', { key: 'existing', value: 'to-delete' });

    const operations = [
      { type: 'put', value: { key: 'new1', value: 'val1' } },
      { type: 'delete', key: 'existing' },
      { type: 'put', value: { key: 'new2', value: 'val2' } }
    ];

    await batch('settings', operations);

    const all = await getAll('settings');
    expect(all).toHaveLength(2);
    expect(all.find(r => r.key === 'existing')).toBeUndefined();
  });
});

describe('LectureMindDB Class', () => {
  let db;

  beforeEach(async () => {
    db = new LectureMindDB();
    await db.init();
  });

  afterEach(async () => {
    db.close();
    await deleteDatabase();
  });

  test('init initializes the database', async () => {
    expect(db.isInitialized).toBe(true);
  });

  test('storeNames returns all store names', () => {
    const names = LectureMindDB.storeNames;
    expect(names).toHaveLength(Object.keys(STORES).length);
    expect(names).toContain('flashcards');
  });

  test('CRUD operations work through class instance', async () => {
    const record = { key: 'class-test', value: 'test-value' };

    await db.put('settings', record);
    const retrieved = await db.get('settings', 'class-test');
    expect(retrieved).toEqual(record);

    await db.delete('settings', 'class-test');
    const deleted = await db.get('settings', 'class-test');
    expect(deleted).toBeUndefined();
  });

  test('getAll works through class instance', async () => {
    await db.put('settings', { key: 'key1', value: 'val1' });
    await db.put('settings', { key: 'key2', value: 'val2' });

    const all = await db.getAll('settings');
    expect(all).toHaveLength(2);
  });

  test('queryByIndex works through class instance', async () => {
    const lectureId = generateId();
    await db.put('flashcards', { id: generateId(), lectureId, front: 'Q1', back: 'A1', status: 'new', dueDate: Date.now() });
    await db.put('flashcards', { id: generateId(), lectureId, front: 'Q2', back: 'A2', status: 'new', dueDate: Date.now() });

    const results = await db.queryByIndex('flashcards', 'lectureId', lectureId);
    expect(results).toHaveLength(2);
  });

  test('count works through class instance', async () => {
    await db.put('settings', { key: 'key1', value: 'val1' });
    await db.put('settings', { key: 'key2', value: 'val2' });

    const total = await db.count('settings');
    expect(total).toBe(2);
  });

  test('clear works through class instance', async () => {
    await db.put('settings', { key: 'key1', value: 'val1' });
    await db.clear('settings');

    const all = await db.getAll('settings');
    expect(all).toHaveLength(0);
  });

  test('batch works through class instance', async () => {
    const operations = [
      { type: 'put', value: { key: 'b1', value: 'v1' } },
      { type: 'put', value: { key: 'b2', value: 'v2' } }
    ];

    await db.batch('settings', operations);

    const all = await db.getAll('settings');
    expect(all).toHaveLength(2);
  });

  test('close marks database as not initialized', () => {
    db.close();
    expect(db.isInitialized).toBe(false);
  });
});

describe('Object Store Indexes', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  test('lectures store has courseId index', async () => {
    const courseId = generateId();
    await put('lectures', { id: generateId(), courseId, title: 'Lecture 1', status: 'pending', createdAt: Date.now() });
    await put('lectures', { id: generateId(), courseId, title: 'Lecture 2', status: 'pending', createdAt: Date.now() });
    await put('lectures', { id: generateId(), courseId: 'other', title: 'Lecture 3', status: 'pending', createdAt: Date.now() });

    const results = await queryByIndex('lectures', 'courseId', courseId);
    expect(results).toHaveLength(2);
  });

  test('flashcards store has status index', async () => {
    await put('flashcards', { id: generateId(), lectureId: 'L1', front: 'Q1', back: 'A1', status: 'new', dueDate: Date.now() });
    await put('flashcards', { id: generateId(), lectureId: 'L1', front: 'Q2', back: 'A2', status: 'review', dueDate: Date.now() });
    await put('flashcards', { id: generateId(), lectureId: 'L1', front: 'Q3', back: 'A3', status: 'new', dueDate: Date.now() });

    const newCards = await queryByIndex('flashcards', 'status', 'new');
    expect(newCards).toHaveLength(2);
  });

  test('events store has type index', async () => {
    await put('events', { id: generateId(), lectureId: 'L1', type: 'slide_change', timestamp: Date.now() });
    await put('events', { id: generateId(), lectureId: 'L1', type: 'scene_change', timestamp: Date.now() });
    await put('events', { id: generateId(), lectureId: 'L1', type: 'slide_change', timestamp: Date.now() });

    const slideChanges = await queryByIndex('events', 'type', 'slide_change');
    expect(slideChanges).toHaveLength(2);
  });

  test('syncQueue store has status index', async () => {
    await put('syncQueue', { id: generateId(), type: 'create', status: 'pending', createdAt: Date.now() });
    await put('syncQueue', { id: generateId(), type: 'update', status: 'completed', createdAt: Date.now() });
    await put('syncQueue', { id: generateId(), type: 'delete', status: 'pending', createdAt: Date.now() });

    const pending = await queryByIndex('syncQueue', 'status', 'pending');
    expect(pending).toHaveLength(2);
  });
});

describe('Error Handling', () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  test('operations on invalid store throw error', async () => {
    await openDatabase();
    await expect(get('nonExistentStore', 'key')).rejects.toThrow();
  });

  test('operations with invalid index throw error', async () => {
    await openDatabase();
    await expect(queryByIndex('settings', 'nonExistentIndex', 'value')).rejects.toThrow();
  });
});

describe('Connection Persistence', () => {
  test('data persists after close and reopen', async () => {
    await openDatabase();
    await put('settings', { key: 'persist-test', value: 'should-persist' });
    closeDatabase();

    await openDatabase();
    const result = await get('settings', 'persist-test');
    expect(result.value).toBe('should-persist');

    await deleteDatabase();
  });
});

describe('Concurrent Connection Handling', () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  test('concurrent openDatabase calls return same instance', async () => {
    // Start multiple concurrent connection attempts
    const connections = await Promise.all([
      openDatabase(),
      openDatabase(),
      openDatabase(),
      openDatabase(),
      openDatabase()
    ]);

    // All should be the same instance
    const firstDb = connections[0];
    for (const db of connections) {
      expect(db).toBe(firstDb);
    }

    // All should be functional
    for (let i = 0; i < connections.length; i++) {
      await put('settings', { key: `concurrent-${i}`, value: `value-${i}` });
    }

    const all = await getAll('settings');
    expect(all).toHaveLength(5);
  });

  test('rapid open/close cycles do not cause race conditions', async () => {
    // Rapidly open and close multiple times
    for (let i = 0; i < 5; i++) {
      const db = await openDatabase();
      expect(db).toBeDefined();
      closeDatabase();
    }

    // Final open should still work
    const db = await openDatabase();
    expect(db).toBeDefined();
    await put('settings', { key: 'after-cycles', value: 'works' });
    const result = await get('settings', 'after-cycles');
    expect(result.value).toBe('works');
  });
});

describe('Input Validation', () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  describe('Store name validation', () => {
    test('get throws error for invalid store name', async () => {
      await expect(get('invalidStore', 'key')).rejects.toThrow('Invalid store name');
    });

    test('put throws error for invalid store name', async () => {
      await expect(put('invalidStore', { key: 'test' })).rejects.toThrow('Invalid store name');
    });

    test('remove throws error for invalid store name', async () => {
      await expect(remove('invalidStore', 'key')).rejects.toThrow('Invalid store name');
    });

    test('getAll throws error for invalid store name', async () => {
      await expect(getAll('invalidStore')).rejects.toThrow('Invalid store name');
    });

    test('clear throws error for invalid store name', async () => {
      await expect(clear('invalidStore')).rejects.toThrow('Invalid store name');
    });

    test('batch throws error for invalid store name', async () => {
      await expect(batch('invalidStore', [])).rejects.toThrow('Invalid store name');
    });

    test('empty store name throws error', async () => {
      await expect(get('', 'key')).rejects.toThrow('Store name must be a non-empty string');
    });
  });

  describe('Key validation', () => {
    test('get throws error for null key', async () => {
      await expect(get('settings', null)).rejects.toThrow('Key cannot be null or undefined');
    });

    test('get throws error for undefined key', async () => {
      await expect(get('settings', undefined)).rejects.toThrow('Key cannot be null or undefined');
    });

    test('remove throws error for null key', async () => {
      await expect(remove('settings', null)).rejects.toThrow('Key cannot be null or undefined');
    });
  });

  describe('Value validation', () => {
    test('put throws error for null value', async () => {
      await expect(put('settings', null)).rejects.toThrow('Value cannot be null or undefined');
    });

    test('put throws error for undefined value', async () => {
      await expect(put('settings', undefined)).rejects.toThrow('Value cannot be null or undefined');
    });

    test('put throws error for non-object value', async () => {
      await expect(put('settings', 'string')).rejects.toThrow('Value must be a plain object');
    });

    test('put throws error for array value', async () => {
      await expect(put('settings', ['item'])).rejects.toThrow('Value must be a plain object');
    });

    test('put throws error for missing keyPath', async () => {
      await expect(put('settings', { value: 'no-key' })).rejects.toThrow('Value must contain keyPath field');
    });

    test('put throws error for prototype pollution attempt with __proto__', async () => {
      const malicious = { key: 'test' };
      Object.defineProperty(malicious, '__proto__', { value: {}, enumerable: true });
      await expect(put('settings', malicious)).rejects.toThrow('forbidden properties');
    });

    test('put throws error for prototype pollution attempt with constructor', async () => {
      const malicious = { key: 'test', constructor: {} };
      await expect(put('settings', malicious)).rejects.toThrow('forbidden properties');
    });
  });

  describe('Batch operation validation', () => {
    test('batch throws error for unknown operation type', async () => {
      await expect(batch('settings', [{ type: 'unknown' }])).rejects.toThrow('Unknown batch operation type');
    });

    test('batch validates put operations', async () => {
      await expect(batch('settings', [{ type: 'put', value: null }])).rejects.toThrow('Value cannot be null or undefined');
    });

    test('batch validates delete operations', async () => {
      await expect(batch('settings', [{ type: 'delete', key: null }])).rejects.toThrow('Key cannot be null or undefined');
    });
  });
});
