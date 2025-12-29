/**
 * UUID generation utility with polyfill for crypto.randomUUID
 * Provides cross-browser support for UUID generation
 */

/**
 * Generate a v4 UUID
 * Uses crypto.randomUUID if available, otherwise falls back to a polyfill
 */
export function generateUUID(): string {
  // Use native crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback polyfill for browsers without crypto.randomUUID
  return polyfillUUID();
}

/**
 * Polyfill for generating a v4 UUID
 * Based on RFC 4122
 */
function polyfillUUID(): string {
  // Use crypto.getRandomValues if available
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Fallback to Math.random (less secure, but works everywhere)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
