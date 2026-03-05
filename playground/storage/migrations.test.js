/**
 * @fileoverview Unit tests for migrations module.
 * Tests schema versioning, localStorage import, and startup migration lifecycle.
 */

import { deleteDatabase, closeDatabase } from './db.js';
import {
  SCHEMA_VERSION,
  getCurrentVersion,
  setVersion,
  needsMigration,
  migrateFromLocalStorage,
  runStartupMigration
} from './migrations.js';

// Clean up before each test
beforeEach(async () => {
  closeDatabase();
  await deleteDatabase();
  localStorage.clear();
});

afterEach(async () => {
  closeDatabase();
  await deleteDatabase();
  localStorage.clear();
});

describe('Schema Version Constants', () => {
  test('SCHEMA_VERSION is 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe('getCurrentVersion / setVersion', () => {
  test('fresh DB returns undefined version', async () => {
    const version = await getCurrentVersion();
    expect(version).toBeUndefined();
  });

  test('setVersion stores and retrieves correctly', async () => {
    await setVersion(1);
    const version = await getCurrentVersion();
    expect(version).toBe(1);
  });

  test('setVersion overwrites previous version', async () => {
    await setVersion(1);
    await setVersion(2);
    const version = await getCurrentVersion();
    expect(version).toBe(2);
  });

  test('setVersion rejects non-integer values', async () => {
    await expect(setVersion('banana')).rejects.toThrow('non-negative integer');
    await expect(setVersion(-1)).rejects.toThrow('non-negative integer');
    await expect(setVersion(1.5)).rejects.toThrow('non-negative integer');
    await expect(setVersion(NaN)).rejects.toThrow('non-negative integer');
  });
});

describe('needsMigration', () => {
  test('returns true on fresh database', async () => {
    const result = await needsMigration();
    expect(result).toBe(true);
  });

  test('returns false after version is set to current', async () => {
    await setVersion(SCHEMA_VERSION);
    const result = await needsMigration();
    expect(result).toBe(false);
  });

  test('returns true when stored version is less than current', async () => {
    await setVersion(0);
    const result = await needsMigration();
    expect(result).toBe(true);
  });
});

describe('migrateFromLocalStorage', () => {
  test('imports localStorage keys into settings store and verifies data', async () => {
    localStorage.setItem('theme', '"dark"');
    localStorage.setItem('volume', '75');

    const imported = await migrateFromLocalStorage();
    expect(imported).toBe(2);

    // Verify data was actually stored correctly
    const { get } = await import('./db.js');
    const theme = await get('settings', 'theme');
    expect(theme.value).toBe('dark');
    const volume = await get('settings', 'volume');
    expect(volume.value).toBe(75);
  });

  test('is idempotent - second call imports 0', async () => {
    localStorage.setItem('theme', '"dark"');

    const first = await migrateFromLocalStorage();
    expect(first).toBe(1);

    const second = await migrateFromLocalStorage();
    expect(second).toBe(0);
  });

  test('handles empty localStorage', async () => {
    const imported = await migrateFromLocalStorage();
    expect(imported).toBe(0);
  });

  test('skips keys starting with __', async () => {
    localStorage.setItem('__internal', 'skip');
    localStorage.setItem('userPref', '"value"');

    const imported = await migrateFromLocalStorage();
    expect(imported).toBe(1);
  });

  test('parses JSON values correctly', async () => {
    localStorage.setItem('config', '{"key": "value"}');

    await migrateFromLocalStorage();

    // Verify via getCurrentVersion import path (uses same db.get)
    const { get } = await import('./db.js');
    const record = await get('settings', 'config');
    expect(record.value).toEqual({ key: 'value' });
  });

  test('stores non-JSON values as strings', async () => {
    localStorage.setItem('plainText', 'just a string');

    await migrateFromLocalStorage();

    const { get } = await import('./db.js');
    const record = await get('settings', 'plainText');
    expect(record.value).toBe('just a string');
  });
});

describe('runStartupMigration', () => {
  test('full lifecycle on fresh database', async () => {
    localStorage.setItem('theme', '"dark"');

    const result = await runStartupMigration();

    expect(result.migrated).toBe(true);
    expect(result.localStorageKeys).toBe(1);
    expect(result.fromVersion).toBeUndefined();
    expect(result.toVersion).toBe(SCHEMA_VERSION);

    // Verify version was set
    const version = await getCurrentVersion();
    expect(version).toBe(SCHEMA_VERSION);
  });

  test('no-op when already at current version', async () => {
    // First run
    await runStartupMigration();

    // Second run
    const result = await runStartupMigration();

    expect(result.migrated).toBe(false);
    expect(result.localStorageKeys).toBe(0);
    expect(result.fromVersion).toBe(SCHEMA_VERSION);
    expect(result.toVersion).toBe(SCHEMA_VERSION);
  });

  test('sets needsMigration to false after completion', async () => {
    expect(await needsMigration()).toBe(true);

    await runStartupMigration();

    expect(await needsMigration()).toBe(false);
  });
});
