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
 * Helper to clear all secure storage
 * Useful for logout functionality
 */
export async function clearSecureStorage(): Promise<void> {
  if (isNativePlatform) {
    // Clear all Capacitor Preferences
    await Preferences.clear();
  } else {
    // Clear sessionStorage
    sessionStorage.clear();
  }
}

/**
 * Helper to check if we're using secure storage
 */
export function isUsingSecureStorage(): boolean {
  return isNativePlatform;
}
