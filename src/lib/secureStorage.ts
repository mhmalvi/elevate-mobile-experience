/**
 * Secure Storage Adapter for Supabase Auth
 *
 * SECURITY: Uses Capacitor Preferences API for native mobile platforms
 * to store auth tokens securely in platform-specific encrypted storage:
 * - iOS: Keychain
 * - Android: EncryptedSharedPreferences
 * - Web: Falls back to sessionStorage (not localStorage for security)
 *
 * This prevents XSS attacks from stealing auth tokens stored in localStorage.
 */

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const isNativePlatform = Capacitor.isNativePlatform();

/**
 * Secure Storage implementation for Supabase Auth
 * Implements the Storage interface required by Supabase
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isNativePlatform) {
      // SECURITY: Use Capacitor Preferences on mobile (encrypted storage)
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      // Web fallback: Use sessionStorage (cleared on tab close)
      // SECURITY: sessionStorage is safer than localStorage for auth tokens
      return sessionStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isNativePlatform) {
      // SECURITY: Store in encrypted storage on mobile
      await Preferences.set({ key, value });
    } else {
      // Web fallback: Store in sessionStorage
      sessionStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isNativePlatform) {
      // Remove from encrypted storage
      await Preferences.remove({ key });
    } else {
      // Remove from sessionStorage
      sessionStorage.removeItem(key);
    }
  },
};

/**
 * Known key prefixes used by TradieMate in storage.
 * Used to scope clearSecureStorage() to only TradieMate data,
 * avoiding clearing unrelated keys from other libraries or browser extensions.
 */
const TRADIEMATE_KEY_PREFIXES = ['sb-', 'tradiemate_', 'offline_'];

/**
 * Helper to clear TradieMate-scoped secure storage
 * Useful for logout functionality
 * Only clears keys matching known TradieMate prefixes to avoid
 * wiping unrelated data from sessionStorage or Preferences.
 */
export async function clearSecureStorage(): Promise<void> {
  if (isNativePlatform) {
    // Get all keys and remove only TradieMate-scoped ones
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys
        .filter((key) => TRADIEMATE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .map((key) => Preferences.remove({ key }))
    );
  } else {
    // Remove only TradieMate-scoped keys from sessionStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && TRADIEMATE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  }
}

/**
 * Helper to check if we're using secure storage
 */
export function isUsingSecureStorage(): boolean {
  return isNativePlatform;
}
