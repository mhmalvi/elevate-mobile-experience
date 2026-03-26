/**
 * Tests for secureStorage adapter.
 *
 * The module reads `Capacitor.isNativePlatform()` at import time and stores the
 * result in the module-level `isNativePlatform` constant. To control which code
 * path runs we mock `@capacitor/core` BEFORE importing the module under test and
 * reset modules between describe blocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared Capacitor Preferences mock store (used in the native path tests)
// ---------------------------------------------------------------------------

const prefsStore = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefsStore.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefsStore.set(key, value); }),
    remove: vi.fn(async ({ key }: { key: string }) => { prefsStore.delete(key); }),
    keys: vi.fn(async () => ({ keys: [...prefsStore.keys()] })),
  },
}));

// ---------------------------------------------------------------------------
// WEB (non-native) path
// ---------------------------------------------------------------------------

describe('secureStorage — web platform (sessionStorage)', () => {
  let storage: typeof import('./secureStorage');

  beforeEach(async () => {
    vi.resetModules();
    prefsStore.clear();
    sessionStorage.clear();

    // isNativePlatform() returns false → web path
    vi.mock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: vi.fn(() => false) },
    }));

    storage = await import('./secureStorage');
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('setItem stores a value in sessionStorage', async () => {
    await storage.secureStorage.setItem('test-key', 'test-value');
    expect(sessionStorage.getItem('test-key')).toBe('test-value');
  });

  it('getItem retrieves a previously stored value', async () => {
    sessionStorage.setItem('my-key', 'my-value');
    const result = await storage.secureStorage.getItem('my-key');
    expect(result).toBe('my-value');
  });

  it('getItem returns null for a non-existent key', async () => {
    const result = await storage.secureStorage.getItem('does-not-exist');
    expect(result).toBeNull();
  });

  it('removeItem deletes the key from sessionStorage', async () => {
    sessionStorage.setItem('to-remove', 'value');
    await storage.secureStorage.removeItem('to-remove');
    expect(sessionStorage.getItem('to-remove')).toBeNull();
  });

  it('removeItem is a no-op when the key does not exist', async () => {
    await expect(storage.secureStorage.removeItem('ghost-key')).resolves.toBeUndefined();
  });

  it('isUsingSecureStorage returns false on web', async () => {
    expect(storage.isUsingSecureStorage()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearSecureStorage — web path
// ---------------------------------------------------------------------------

describe('clearSecureStorage — web platform', () => {
  let storage: typeof import('./secureStorage');

  beforeEach(async () => {
    vi.resetModules();
    prefsStore.clear();
    sessionStorage.clear();

    vi.mock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: vi.fn(() => false) },
    }));

    storage = await import('./secureStorage');
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('removes keys with the "sb-" prefix', async () => {
    sessionStorage.setItem('sb-auth-token', 'token-value');
    sessionStorage.setItem('unrelated-key', 'keep-me');

    await storage.clearSecureStorage();

    expect(sessionStorage.getItem('sb-auth-token')).toBeNull();
    expect(sessionStorage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('removes keys with the "tradiemate_" prefix', async () => {
    sessionStorage.setItem('tradiemate_setting', 'value');
    sessionStorage.setItem('other-lib-data', 'keep-me');

    await storage.clearSecureStorage();

    expect(sessionStorage.getItem('tradiemate_setting')).toBeNull();
    expect(sessionStorage.getItem('other-lib-data')).toBe('keep-me');
  });

  it('removes keys with the "offline_" prefix', async () => {
    sessionStorage.setItem('offline_cache', 'data');
    sessionStorage.setItem('third-party-key', 'keep-me');

    await storage.clearSecureStorage();

    expect(sessionStorage.getItem('offline_cache')).toBeNull();
    expect(sessionStorage.getItem('third-party-key')).toBe('keep-me');
  });

  it('does not remove unrelated keys that lack a TradieMate prefix', async () => {
    const unrelated = ['redux-state', 'analytics_id', 'feature_flag', '__cfduid'];
    unrelated.forEach(k => sessionStorage.setItem(k, 'keep'));

    // Add one prefixed key to confirm the function ran
    sessionStorage.setItem('sb-session', 'remove-me');

    await storage.clearSecureStorage();

    unrelated.forEach(k => {
      expect(sessionStorage.getItem(k)).toBe('keep');
    });
    expect(sessionStorage.getItem('sb-session')).toBeNull();
  });

  it('handles an empty sessionStorage gracefully', async () => {
    await expect(storage.clearSecureStorage()).resolves.toBeUndefined();
  });

  it('removes all three prefix families in a single call', async () => {
    sessionStorage.setItem('sb-refresh-token', '1');
    sessionStorage.setItem('tradiemate_profile', '2');
    sessionStorage.setItem('offline_encryption_key', '3');
    sessionStorage.setItem('keep-me', '4');

    await storage.clearSecureStorage();

    expect(sessionStorage.getItem('sb-refresh-token')).toBeNull();
    expect(sessionStorage.getItem('tradiemate_profile')).toBeNull();
    expect(sessionStorage.getItem('offline_encryption_key')).toBeNull();
    expect(sessionStorage.getItem('keep-me')).toBe('4');
  });
});
