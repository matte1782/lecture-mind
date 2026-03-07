/**
 * @fileoverview Schema migration and localStorage import for Lecture Mind storage layer.
 * Handles app-level versioning (separate from IndexedDB's onupgradeneeded),
 * idempotent migrations, and legacy localStorage import.
 *
 * @module storage/migrations
 * @version 1.0.0
 */

import { get, put, batch } from './db.js';

// ============================================================================
// Constants
// ============================================================================

/** Current schema version (app-level, not IndexedDB version) */
export const SCHEMA_VERSION = 1;

/** Key used to store schema version in settings store */
const VERSION_KEY = '__schemaVersion';

/** Key used to track localStorage migration status */
const LS_MIGRATED_KEY = '__localStorageMigrated';

// ============================================================================
// Version Management
// ============================================================================

/**
 * Get the current schema version from the database.
 * @returns {Promise<number|undefined>} Current version, or undefined if not set
 */
export async function getCurrentVersion() {
  const record = await get('settings', VERSION_KEY);
  return record ? record.value : undefined;
}

/**
 * Set the schema version in the database.
 * @param {number} version - Version number to set (non-negative integer)
 * @returns {Promise<void>}
 * @throws {Error} If version is not a non-negative integer
 */
export async function setVersion(version) {
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new Error('version must be a non-negative integer');
  }
  await put('settings', { key: VERSION_KEY, value: version });
}

/**
 * Check if a migration is needed.
 * Returns true if the stored version is undefined or less than SCHEMA_VERSION.
 * @returns {Promise<boolean>} True if migration is needed
 */
export async function needsMigration() {
  const current = await getCurrentVersion();
  return current === undefined || current < SCHEMA_VERSION;
}

// ============================================================================
// localStorage Migration
// ============================================================================

/**
 * Idempotently import legacy localStorage keys into IndexedDB settings store.
 * Checks the `__localStorageMigrated` flag to prevent duplicate imports.
 * Handles environments where localStorage is not available.
 *
 * @returns {Promise<number>} Number of keys imported (0 if already migrated or no localStorage)
 */
export async function migrateFromLocalStorage() {
  // Check if already migrated
  const migratedRecord = await get('settings', LS_MIGRATED_KEY);
  if (migratedRecord && migratedRecord.value === true) {
    return 0;
  }

  // Check if localStorage is available
  if (typeof localStorage === 'undefined') {
    // Mark as migrated even if localStorage doesn't exist (nothing to import)
    await put('settings', { key: LS_MIGRATED_KEY, value: true });
    return 0;
  }

  // Collect all localStorage entries first, then batch-write for atomicity
  const operations = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Guard against null (concurrent tab mutation)
    if (!key) continue;
    // Skip internal keys
    if (key.startsWith('__')) continue;

    const value = localStorage.getItem(key);
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }

    operations.push({ type: 'put', value: { key, value: parsed } });
  }

  // Add migration-complete flag to the same batch
  operations.push({ type: 'put', value: { key: LS_MIGRATED_KEY, value: true } });

  if (operations.length > 0) {
    await batch('settings', operations);
  }

  // Subtract 1 for the migration-complete flag entry
  return operations.length - 1;
}

// ============================================================================
// Startup Orchestrator
// ============================================================================

/**
 * Run all startup migrations. Should be called once on app initialization.
 * Orchestrates: version check -> migrations -> localStorage import -> version update.
 *
 * @returns {Promise<{migrated: boolean, localStorageKeys: number, fromVersion: number|undefined, toVersion: number}>}
 */
export async function runStartupMigration() {
  const fromVersion = await getCurrentVersion();
  const migrationNeeded = fromVersion === undefined || fromVersion < SCHEMA_VERSION;

  let localStorageKeys = 0;

  if (migrationNeeded) {
    // Run localStorage import (idempotent)
    localStorageKeys = await migrateFromLocalStorage();

    // Future: add version-specific migrations here
    // if (fromVersion < 2) { await migrateV1toV2(); }

    // Update version
    await setVersion(SCHEMA_VERSION);
  }

  return {
    migrated: migrationNeeded,
    localStorageKeys,
    fromVersion,
    toVersion: SCHEMA_VERSION
  };
}

