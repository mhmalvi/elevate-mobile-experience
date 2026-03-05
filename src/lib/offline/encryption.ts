/**
 * Field-Level Encryption for Offline Storage
 *
 * SECURITY: Encrypts sensitive PII in IndexedDB to protect against device compromise
 * Uses Web Crypto API with AES-GCM encryption
 *
 * NOTE: crypto.subtle is only available in secure contexts (HTTPS or localhost).
 * In non-secure contexts (HTTP), encryption is unavailable. Data is base64-encoded
 * and prefixed with UNENC: so unencrypted records can be identified and remediated.
 *
 * SECURITY (SEC-M8): The encryption key is stored via secureStorage, which uses
 * platform-specific encrypted storage:
 * - iOS: Keychain
 * - Android: EncryptedSharedPreferences
 * - Web: sessionStorage (key is lost on tab close; a new key is generated each session,
 *   meaning previously encrypted IndexedDB data will be unreadable after session end.
 *   On web, the UNENC: fallback path is the practical storage path for offline data.)
 *
 * LIMITATION: On web there is no persistent secure key store, so true cross-session
 * encryption of IndexedDB PII is not achievable without a server-side key escrow.
 * This is a known architectural limitation documented here.
 */

import { secureStorage } from '@/lib/secureStorage';
import { safeNumber } from '@/lib/utils';
import type { OfflineClient, OfflineInvoice, OfflineQuote } from './db';

const ENCRYPTION_KEY_NAME = 'offline_encryption_key';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Prefix applied to base64-encoded plaintext when crypto.subtle is unavailable.
 * This lets us distinguish unencrypted records from encrypted ones so they can
 * be identified, reported, and remediated.
 */
const UNENC_PREFIX = 'UNENC:';

/**
 * Check if the Web Crypto API is available in this context.
 * crypto.subtle is only present in secure contexts (HTTPS or localhost).
 */
function isSecureContext(): boolean {
  return typeof crypto !== 'undefined' &&
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.subtle.generateKey === 'function';
}

// Cache the secure context check so the warning fires exactly once.
let _isSecureContextCached: boolean | null = null;
function getIsSecureContext(): boolean {
  if (_isSecureContextCached === null) {
    _isSecureContextCached = isSecureContext();
    if (!_isSecureContextCached) {
      // SEC-M7: Explicit warning — do NOT silently store plaintext PII.
      console.warn(
        '[Encryption] SECURITY WARNING: crypto.subtle is not available in this context ' +
        '(page served over HTTP or in an insecure environment). ' +
        'Sensitive fields will be base64-encoded and marked with the UNENC: prefix ' +
        'rather than encrypted. This data is NOT protected against device compromise. ' +
        'Ensure the app is served over HTTPS in production.'
      );
    }
  }
  return _isSecureContextCached;
}

/**
 * Returns true when AES-GCM encryption is available.
 * Components can call this to show a warning UI or restrict offline usage
 * when running in a non-secure context.
 */
export function isEncryptionAvailable(): boolean {
  return getIsSecureContext();
}

/**
 * Get or generate encryption key.
 *
 * SEC-M8: Key is stored via secureStorage (not Preferences directly) so that
 * the correct platform-specific backend is used:
 * - iOS: Keychain
 * - Android: EncryptedSharedPreferences
 * - Web: sessionStorage (ephemeral; a new key is generated each browser session)
 *
 * On web, the ephemeral key means IndexedDB data encrypted in one session cannot
 * be decrypted in a later session. This is a known limitation — see module header.
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey | null> {
  if (!getIsSecureContext()) {
    return null;
  }

  try {
    // Try to load an existing key from secure storage.
    const keyData = await secureStorage.getItem(ENCRYPTION_KEY_NAME);

    if (keyData) {
      const keyBuffer = base64ToArrayBuffer(keyData);
      return await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: ALGORITHM, length: KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
      );
    }
  } catch (error) {
    console.warn('[Encryption] Could not retrieve existing key:', error);
  }

  // Generate a new key and persist it.
  try {
    const key = await crypto.subtle.generateKey(
      { name: ALGORITHM, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );

    try {
      const keyBuffer = await crypto.subtle.exportKey('raw', key);
      const keyData = arrayBufferToBase64(keyBuffer);
      await secureStorage.setItem(ENCRYPTION_KEY_NAME, keyData);
    } catch (error) {
      console.error('[Encryption] Failed to store encryption key:', error);
    }

    return key;
  } catch (error) {
    console.error('[Encryption] Failed to generate encryption key:', error);
    return null;
  }
}

/**
 * Encode a value as UNENC: prefixed base64 when true encryption is unavailable.
 * The data is not protected but is not trivially readable, and is clearly marked
 * so that unencrypted records can be identified and remediated later.
 */
function encodeUnencrypted(plaintext: string): string {
  return UNENC_PREFIX + btoa(unescape(encodeURIComponent(plaintext)));
}

/**
 * Encrypt a string value using AES-GCM.
 *
 * When crypto.subtle is unavailable (non-secure context) or key creation fails,
 * the value is base64-encoded and prefixed with UNENC: instead of being stored
 * as raw plaintext. This makes unencrypted records identifiable and ensures PII
 * is never silently stored in a trivially readable form. (SEC-M7)
 */
export async function encryptField(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext || plaintext.trim() === '') {
    return null;
  }

  if (!getIsSecureContext()) {
    // SEC-M7: Do NOT fall back to raw plaintext — use marked base64 encoding.
    return encodeUnencrypted(plaintext);
  }

  try {
    const key = await getOrCreateEncryptionKey();
    if (!key) {
      // SEC-M7: Key creation failed — use marked base64 encoding, not raw plaintext.
      console.warn('[Encryption] Key unavailable, storing field as UNENC: encoded value.');
      return encodeUnencrypted(plaintext);
    }

    // Generate random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    // Combine IV + encrypted data and encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('[Encryption] Failed to encrypt field:', error);
    // SEC-M7: On error, use marked base64 encoding rather than raw plaintext.
    return encodeUnencrypted(plaintext);
  }
}

/**
 * Decrypt a string value.
 *
 * Handles three storage formats transparently:
 * 1. AES-GCM encrypted base64 (normal case — produced by encryptField in secure context)
 * 2. UNENC: prefixed base64 (produced by encryptField when crypto.subtle was unavailable)
 * 3. Raw plaintext (legacy records written before this fix was applied)
 */
export async function decryptField(ciphertext: string | null | undefined): Promise<string | null> {
  if (!ciphertext || ciphertext.trim() === '') {
    return null;
  }

  // SEC-M7: Handle UNENC: prefixed records written when encryption was unavailable.
  if (ciphertext.startsWith(UNENC_PREFIX)) {
    try {
      const encoded = ciphertext.slice(UNENC_PREFIX.length);
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      // Malformed UNENC: value — return the raw string rather than losing the data.
      console.warn('[Encryption] Failed to decode UNENC: prefixed value, returning raw.');
      return ciphertext;
    }
  }

  if (!getIsSecureContext()) {
    // No crypto.subtle — treat the value as raw plaintext (legacy pre-fix records).
    return ciphertext;
  }

  try {
    const key = await getOrCreateEncryptionKey();
    if (!key) {
      // Cannot decrypt without a key — return as-is (may be a legacy plaintext record).
      return ciphertext;
    }

    // Decode from base64
    const combined = base64ToArrayBuffer(ciphertext);

    // Extract IV (first 12 bytes) and ciphertext body
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: new Uint8Array(iv) },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    // Decryption failed — the record may be a legacy plaintext value written before
    // encryption was enabled. Return as-is rather than losing the data, but warn.
    console.warn('[Encryption] Decryption failed — record may be a legacy plaintext value:', error);
    return ciphertext;
  }
}

/**
 * Encrypt sensitive fields in a client object
 */
export async function encryptClientFields(client: OfflineClient): Promise<OfflineClient> {
  if (!client) return client;

  const encrypted = { ...client };

  // Encrypt PII fields (encrypted values are always non-null when input is truthy)
  if (client.name) encrypted.name = (await encryptField(client.name))!;
  if (client.email) encrypted.email = (await encryptField(client.email)) ?? undefined;
  if (client.phone) encrypted.phone = (await encryptField(client.phone)) ?? undefined;
  if (client.address) encrypted.address = (await encryptField(client.address)) ?? undefined;

  return encrypted;
}

/**
 * Decrypt sensitive fields in a client object
 */
export async function decryptClientFields(client: OfflineClient): Promise<OfflineClient> {
  if (!client) return client;

  const decrypted = { ...client };

  // Decrypt PII fields (decrypted values are always non-null when input is truthy)
  if (client.name) decrypted.name = (await decryptField(client.name))!;
  if (client.email) decrypted.email = (await decryptField(client.email)) ?? undefined;
  if (client.phone) decrypted.phone = (await decryptField(client.phone)) ?? undefined;
  if (client.address) decrypted.address = (await decryptField(client.address)) ?? undefined;

  return decrypted;
}

/**
 * Encrypt sensitive fields in an invoice object
 */
export async function encryptInvoiceFields(invoice: OfflineInvoice): Promise<OfflineInvoice> {
  if (!invoice) return invoice;

  const encrypted = { ...invoice };

  // Encrypt financial amounts (convert to string first, handle null/undefined)
  // Note: encrypted values are stored as strings in IndexedDB, cast to satisfy the type
  if (invoice.total !== undefined && invoice.total !== null) {
    encrypted.total = (await encryptField(String(invoice.total))) as unknown as number;
  }
  if (invoice.amount_paid !== undefined && invoice.amount_paid !== null) {
    encrypted.amount_paid = (await encryptField(String(invoice.amount_paid))) as unknown as number;
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in an invoice object
 */
export async function decryptInvoiceFields(invoice: OfflineInvoice): Promise<OfflineInvoice> {
  if (!invoice) return invoice;

  const decrypted = { ...invoice };

  // Decrypt financial amounts - use safeNumber to handle NaN/null/undefined
  // Also handle case where value is already a number (not encrypted)
  if (invoice.total !== undefined && invoice.total !== null) {
    if (typeof invoice.total === 'number') {
      decrypted.total = safeNumber(invoice.total);
    } else {
      const decryptedTotal = await decryptField(invoice.total);
      decrypted.total = safeNumber(decryptedTotal);
    }
  }
  if (invoice.amount_paid !== undefined && invoice.amount_paid !== null) {
    if (typeof invoice.amount_paid === 'number') {
      decrypted.amount_paid = safeNumber(invoice.amount_paid);
    } else {
      const decryptedPaid = await decryptField(invoice.amount_paid);
      decrypted.amount_paid = safeNumber(decryptedPaid);
    }
  }

  return decrypted;
}

/**
 * Encrypt sensitive fields in a quote object
 */
export async function encryptQuoteFields(quote: OfflineQuote): Promise<OfflineQuote> {
  if (!quote) return quote;

  const encrypted = { ...quote };

  // Encrypt financial amounts (handle null/undefined)
  // Note: encrypted values are stored as strings in IndexedDB, cast to satisfy the type
  if (quote.total !== undefined && quote.total !== null) {
    encrypted.total = (await encryptField(String(quote.total))) as unknown as number;
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in a quote object
 */
export async function decryptQuoteFields(quote: OfflineQuote): Promise<OfflineQuote> {
  if (!quote) return quote;

  const decrypted = { ...quote };

  // Decrypt financial amounts - use safeNumber to handle NaN/null/undefined
  // Also handle case where value is already a number (not encrypted)
  if (quote.total !== undefined && quote.total !== null) {
    if (typeof quote.total === 'number') {
      decrypted.total = safeNumber(quote.total);
    } else {
      const decryptedTotal = await decryptField(quote.total);
      decrypted.total = safeNumber(decryptedTotal);
    }
  }

  return decrypted;
}

/**
 * Clear encryption key (useful for logout).
 * Uses secureStorage so the correct platform backend is targeted (SEC-M8).
 */
export async function clearEncryptionKey(): Promise<void> {
  try {
    await secureStorage.removeItem(ENCRYPTION_KEY_NAME);
    // Reset the cached secure-context result so it is re-evaluated if the
    // environment changes (e.g. in tests or if the page reloads).
    _isSecureContextCached = null;
  } catch (error) {
    console.error('[Encryption] Failed to clear encryption key:', error);
  }
}

// Helper functions for base64 encoding/decoding
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
