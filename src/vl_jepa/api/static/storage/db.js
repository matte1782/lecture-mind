/**
 * @fileoverview IndexedDB wrapper for Lecture Mind storage layer.
 * Provides connection management, schema definition, and basic CRUD operations.
 *
 * @module storage/db
 * @version 1.0.0
 */

/** Database configuration */
export const DB_NAME = 'LectureMindDB';
export const DB_VERSION = 2;

/**
 * Object store definitions with keyPath and indexes.
 * @type {Object.<string, {keyPath: string, indexes?: Array<{name: string, keyPath: string, options?: IDBIndexParameters}>}>}
 */
export const STORES = {
  settings: {
    keyPath: 'key',
    indexes: []
  },
  courses: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keyPath: 'name', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } }
    ]
  },
  lectures: {
    keyPath: 'id',
    indexes: [
      { name: 'courseId', keyPath: 'courseId', options: { unique: false } },
      { name: 'status', keyPath: 'status', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } }
    ]
  },
  segments: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: false } },
      { name: 'startTime', keyPath: 'startTime', options: { unique: false } }
    ]
  },
  events: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: false } },
      { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
      { name: 'type', keyPath: 'type', options: { unique: false } }
    ]
  },
  progress: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: false } },
      { name: 'userId', keyPath: 'userId', options: { unique: false } }
    ]
  },
  flashcards: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: false } },
      { name: 'dueDate', keyPath: 'dueDate', options: { unique: false } },
      { name: 'status', keyPath: 'status', options: { unique: false } }
    ]
  },
  bookmarks: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: false } },
      { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
    ]
  },
  confusionVotes: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: false } },
      { name: 'segmentId', keyPath: 'segmentId', options: { unique: false } }
    ]
  },
  recordingSessions: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: false } },
      { name: 'status', keyPath: 'status', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } }
    ]
  },
  audioData: {
    keyPath: 'id',
    indexes: []
  },
  photoCaptures: {
    keyPath: 'id',
    indexes: [
      { name: 'recordingSessionId', keyPath: 'recordingSessionId', options: { unique: false } },
      { name: 'timestampMs', keyPath: 'timestampMs', options: { unique: false } }
    ]
  },
  autoNotes: {
    keyPath: 'id',
    indexes: [
      { name: 'lectureId', keyPath: 'lectureId', options: { unique: true } },
      { name: 'generatedAt', keyPath: 'generatedAt', options: { unique: false } }
    ]
  },
  syncQueue: {
    keyPath: 'id',
    indexes: [
      { name: 'type', keyPath: 'type', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
      { name: 'status', keyPath: 'status', options: { unique: false } }
    ]
  }
};

/** @type {IDBDatabase|null} Singleton database connection */
let dbInstance = null;

/** @type {Promise<IDBDatabase>|null} Connection promise for pooling */
let connectionPromise = null;

/** @type {string[]} Valid store names for validation */
const VALID_STORE_NAMES = Object.keys(STORES);

/**
 * Validate that a store name is valid.
 * @param {string} storeName - The store name to validate
 * @throws {Error} If store name is invalid
 */
function validateStoreName(storeName) {
  if (typeof storeName !== 'string' || storeName.length === 0) {
    throw new Error('Store name must be a non-empty string');
  }
  if (!VALID_STORE_NAMES.includes(storeName)) {
    throw new Error(`Invalid store name: "${storeName}". Valid stores are: ${VALID_STORE_NAMES.join(', ')}`);
  }
}

/**
 * Validate that a value is a valid object for storage.
 * @param {any} value - The value to validate
 * @param {string} storeName - The store name (for keyPath validation)
 * @throws {Error} If value is invalid
 */
function validateValue(value, storeName) {
  if (value === null || value === undefined) {
    throw new Error('Value cannot be null or undefined');
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Value must be a plain object');
  }
  // Check for prototype pollution attempts
  if (Object.prototype.hasOwnProperty.call(value, '__proto__') ||
      Object.prototype.hasOwnProperty.call(value, 'constructor') ||
      Object.prototype.hasOwnProperty.call(value, 'prototype')) {
    throw new Error('Value contains forbidden properties (__proto__, constructor, prototype)');
  }
  // Validate keyPath exists
  const keyPath = STORES[storeName].keyPath;
  if (!Object.prototype.hasOwnProperty.call(value, keyPath)) {
    throw new Error(`Value must contain keyPath field: "${keyPath}"`);
  }
}

/**
 * Validate a key for retrieval/deletion.
 * @param {any} key - The key to validate
 * @throws {Error} If key is invalid
 */
function validateKey(key) {
  if (key === null || key === undefined) {
    throw new Error('Key cannot be null or undefined');
  }
}

/**
 * Check if IndexedDB is available in the current environment.
 * @returns {boolean} True if IndexedDB is available
 */
export function isIndexedDBAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch (e) {
    return false;
  }
}

/**
 * Open the database connection. Uses connection pooling (max 1 connection).
 * Creates object stores and indexes on first open or version upgrade.
 *
 * @returns {Promise<IDBDatabase>} The database instance
 * @throws {Error} If IndexedDB is not available or connection fails
 */
export async function openDatabase() {
  // Return existing connection if available
  if (dbInstance) {
    return dbInstance;
  }

  // Return pending connection promise to avoid race conditions
  if (connectionPromise) {
    return connectionPromise;
  }

  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available in this environment');
  }

  connectionPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      connectionPromise = null;
      reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      connectionPromise = null;

      // Handle unexpected close
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      // Handle version change (another tab upgraded)
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      createStores(db);
    };
  });

  return connectionPromise;
}

/**
 * Create all object stores and indexes.
 * Called during database upgrade.
 *
 * @param {IDBDatabase} db - The database instance
 */
function createStores(db) {
  for (const [storeName, config] of Object.entries(STORES)) {
    // Skip if store already exists
    if (db.objectStoreNames.contains(storeName)) {
      continue;
    }

    const store = db.createObjectStore(storeName, { keyPath: config.keyPath });

    // Create indexes
    for (const index of config.indexes || []) {
      store.createIndex(index.name, index.keyPath, index.options || {});
    }
  }
}

/**
 * Close the database connection.
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  connectionPromise = null;
}

/**
 * Delete the entire database. Use with caution.
 *
 * @returns {Promise<void>}
 */
export async function deleteDatabase() {
  closeDatabase();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onerror = () => {
      reject(new Error(`Failed to delete database: ${request.error?.message || 'Unknown error'}`));
    };

    request.onsuccess = () => {
      resolve();
    };

    request.onblocked = () => {
      reject(new Error('Database deletion blocked - close all connections first'));
    };
  });
}

/**
 * Get a record by key from a store.
 *
 * @param {string} storeName - The object store name
 * @param {string} key - The record key
 * @returns {Promise<any|undefined>} The record, or undefined if not found
 * @throws {Error} If storeName is invalid or key is null/undefined
 */
export async function get(storeName, key) {
  validateStoreName(storeName);
  validateKey(key);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => {
        reject(new Error(`Failed to get record: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    } catch (error) {
      reject(new Error(`Transaction error: ${error.message}`));
    }
  });
}

/**
 * Put (create or update) a record in a store.
 *
 * @param {string} storeName - The object store name
 * @param {Object} value - The record to store (must include keyPath field)
 * @returns {Promise<string>} The key of the stored record
 * @throws {Error} If storeName is invalid or value fails validation
 */
export async function put(storeName, value) {
  validateStoreName(storeName);
  validateValue(value, storeName);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onerror = () => {
        reject(new Error(`Failed to put record: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    } catch (error) {
      reject(new Error(`Transaction error: ${error.message}`));
    }
  });
}

/**
 * Delete a record from a store.
 *
 * @param {string} storeName - The object store name
 * @param {string} key - The record key to delete
 * @returns {Promise<void>}
 * @throws {Error} If storeName is invalid or key is null/undefined
 */
export async function remove(storeName, key) {
  validateStoreName(storeName);
  validateKey(key);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => {
        reject(new Error(`Failed to delete record: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    } catch (error) {
      reject(new Error(`Transaction error: ${error.message}`));
    }
  });
}

/**
 * Get all records from a store.
 *
 * @param {string} storeName - The object store name
 * @param {number} [limit] - Optional limit on number of records
 * @returns {Promise<Array>} Array of all records
 * @throws {Error} If storeName is invalid
 */
export async function getAll(storeName, limit) {
  validateStoreName(storeName);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = limit ? store.getAll(null, limit) : store.getAll();

      request.onerror = () => {
        reject(new Error(`Failed to get all records: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve(request.result || []);
      };
    } catch (error) {
      reject(new Error(`Transaction error: ${error.message}`));
    }
  });
}

/**
 * Query records using an index.
 *
 * @param {string} storeName - The object store name
 * @param {string} indexName - The index to query
 * @param {IDBKeyRange|any} query - The query (key or key range)
 * @returns {Promise<Array>} Matching records
 * @throws {Error} If storeName is invalid
 */
export async function queryByIndex(storeName, indexName, query) {
  validateStoreName(storeName);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(query);

      request.onerror = () => {
        reject(new Error(`Failed to query index: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve(request.result || []);
      };
    } catch (error) {
      reject(new Error(`Transaction error: ${error.message}`));
    }
  });
}

/**
 * Count records in a store, optionally filtered by index.
 *
 * @param {string} storeName - The object store name
 * @param {string} [indexName] - Optional index to count by
 * @param {IDBKeyRange|any} [query] - Optional query for index
 * @returns {Promise<number>} The count
 * @throws {Error} If storeName is invalid
 */
export async function count(storeName, indexName, query) {
  validateStoreName(storeName);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const target = indexName ? store.index(indexName) : store;
      const request = query ? target.count(query) : target.count();

      request.onerror = () => {
        reject(new Error(`Failed to count records: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    } catch (error) {
      reject(new Error(`Transaction error: ${error.message}`));
    }
  });
}

/**
 * Clear all records from a store.
 *
 * @param {string} storeName - The object store name
 * @returns {Promise<void>}
 * @throws {Error} If storeName is invalid
 */
export async function clear(storeName) {
  validateStoreName(storeName);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`Failed to clear store: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    } catch (error) {
      reject(new Error(`Transaction error: ${error.message}`));
    }
  });
}

/**
 * Execute a batch of operations in a single transaction.
 *
 * @param {string} storeName - The object store name
 * @param {Array<{type: 'put'|'delete', value?: Object, key?: string}>} operations - Operations to execute
 * @returns {Promise<void>}
 * @throws {Error} If storeName is invalid or operation type is unknown
 */
export async function batch(storeName, operations) {
  validateStoreName(storeName);

  // Validate all operations before starting transaction
  for (const op of operations) {
    if (op.type === 'put') {
      validateValue(op.value, storeName);
    } else if (op.type === 'delete') {
      validateKey(op.key);
    } else {
      throw new Error(`Unknown batch operation type: "${op.type}". Valid types are: put, delete`);
    }
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      transaction.onerror = () => {
        reject(new Error(`Batch transaction failed: ${transaction.error?.message || 'Unknown error'}`));
      };

      transaction.oncomplete = () => {
        resolve();
      };

      for (const op of operations) {
        if (op.type === 'put') {
          store.put(op.value);
        } else if (op.type === 'delete') {
          store.delete(op.key);
        }
      }
    } catch (error) {
      reject(new Error(`Batch error: ${error.message}`));
    }
  });
}

/**
 * LectureMindDB class - Object-oriented wrapper for database operations.
 * Provides a cleaner API for common operations.
 */
export class LectureMindDB {
  /** @type {boolean} */
  #initialized = false;

  /**
   * Initialize the database connection.
   * @returns {Promise<LectureMindDB>}
   */
  async init() {
    await openDatabase();
    this.#initialized = true;
    return this;
  }

  /**
   * Check if the database is initialized.
   * @returns {boolean}
   */
  get isInitialized() {
    return this.#initialized;
  }

  /**
   * Close the database connection.
   */
  close() {
    closeDatabase();
    this.#initialized = false;
  }

  /**
   * Get a record by key.
   * @param {string} storeName
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(storeName, key) {
    return get(storeName, key);
  }

  /**
   * Put a record.
   * @param {string} storeName
   * @param {Object} value
   * @returns {Promise<string>}
   */
  async put(storeName, value) {
    return put(storeName, value);
  }

  /**
   * Delete a record.
   * @param {string} storeName
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(storeName, key) {
    return remove(storeName, key);
  }

  /**
   * Get all records.
   * @param {string} storeName
   * @param {number} [limit]
   * @returns {Promise<Array>}
   */
  async getAll(storeName, limit) {
    return getAll(storeName, limit);
  }

  /**
   * Query by index.
   * @param {string} storeName
   * @param {string} indexName
   * @param {any} query
   * @returns {Promise<Array>}
   */
  async queryByIndex(storeName, indexName, query) {
    return queryByIndex(storeName, indexName, query);
  }

  /**
   * Count records.
   * @param {string} storeName
   * @param {string} [indexName]
   * @param {any} [query]
   * @returns {Promise<number>}
   */
  async count(storeName, indexName, query) {
    return count(storeName, indexName, query);
  }

  /**
   * Clear a store.
   * @param {string} storeName
   * @returns {Promise<void>}
   */
  async clear(storeName) {
    return clear(storeName);
  }

  /**
   * Execute batch operations.
   * @param {string} storeName
   * @param {Array} operations
   * @returns {Promise<void>}
   */
  async batch(storeName, operations) {
    return batch(storeName, operations);
  }

  /**
   * Get store names.
   * @returns {string[]}
   */
  static get storeNames() {
    return Object.keys(STORES);
  }
}

export default LectureMindDB;
