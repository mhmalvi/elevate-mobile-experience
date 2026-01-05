/**
 * Field-Level Encryption for Offline Storage
 *
 * SECURITY: Encrypts sensitive PII in IndexedDB to protect against device compromise
 * Uses Web Crypto API with AES-GCM encryption
 */

import { Preferences } from '@capacitor/preferences';

const ENCRYPTION_KEY_NAME = 'offline_encryption_key';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Get or generate encryption key
 * Stored securely in Capacitor Preferences (encrypted storage on mobile)
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  try {
    // Try to get existing key from secure storage
    const { value: keyData } = await Preferences.get({ key: ENCRYPTION_KEY_NAME });

    if (keyData) {
      // Import existing key
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

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  // Store for future use
  try {
    const keyBuffer = await crypto.subtle.exportKey('raw', key);
    const keyData = arrayBufferToBase64(keyBuffer);
    await Preferences.set({ key: ENCRYPTION_KEY_NAME, value: keyData });
  } catch (error) {
    console.error('[Encryption] Failed to store encryption key:', error);
  }

  return key;
}

/**
 * Encrypt a string value
 */
export async function encryptField(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext || plaintext.trim() === '') {
    return null;
  }

  try {
    const key = await getOrCreateEncryptionKey();

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
    // SECURITY: Don't store unencrypted on failure
    return null;
  }
}

/**
 * Decrypt a string value
 */
export async function decryptField(ciphertext: string | null | undefined): Promise<string | null> {
  if (!ciphertext || ciphertext.trim() === '') {
    return null;
  }

  try {
    const key = await getOrCreateEncryptionKey();

    // Decode from base64
    const combined = base64ToArrayBuffer(ciphertext);

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: new Uint8Array(iv) },
      key,
      data
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt field:', error);
    // Return null if decryption fails (corrupted data)
    return null;
  }
}

/**
 * Encrypt sensitive fields in a client object
 */
export async function encryptClientFields(client: any): Promise<any> {
  if (!client) return client;

  const encrypted = { ...client };

  // Encrypt PII fields
  if (client.name) encrypted.name = await encryptField(client.name);
  if (client.email) encrypted.email = await encryptField(client.email);
  if (client.phone) encrypted.phone = await encryptField(client.phone);
  if (client.address) encrypted.address = await encryptField(client.address);

  return encrypted;
}

/**
 * Decrypt sensitive fields in a client object
 */
export async function decryptClientFields(client: any): Promise<any> {
  if (!client) return client;

  const decrypted = { ...client };

  // Decrypt PII fields
  if (client.name) decrypted.name = await decryptField(client.name);
  if (client.email) decrypted.email = await decryptField(client.email);
  if (client.phone) decrypted.phone = await decryptField(client.phone);
  if (client.address) decrypted.address = await decryptField(client.address);

  return decrypted;
}

/**
 * Encrypt sensitive fields in an invoice object
 */
export async function encryptInvoiceFields(invoice: any): Promise<any> {
  if (!invoice) return invoice;

  const encrypted = { ...invoice };

  // Encrypt financial amounts (convert to string first)
  if (invoice.total !== undefined) {
    encrypted.total = await encryptField(invoice.total.toString());
  }
  if (invoice.amount_paid !== undefined) {
    encrypted.amount_paid = await encryptField(invoice.amount_paid.toString());
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in an invoice object
 */
export async function decryptInvoiceFields(invoice: any): Promise<any> {
  if (!invoice) return invoice;

  const decrypted = { ...invoice };

  // Decrypt financial amounts (convert back to number)
  if (invoice.total) {
    const decryptedTotal = await decryptField(invoice.total);
    decrypted.total = decryptedTotal ? parseFloat(decryptedTotal) : 0;
  }
  if (invoice.amount_paid) {
    const decryptedPaid = await decryptField(invoice.amount_paid);
    decrypted.amount_paid = decryptedPaid ? parseFloat(decryptedPaid) : 0;
  }

  return decrypted;
}

/**
 * Encrypt sensitive fields in a quote object
 */
export async function encryptQuoteFields(quote: any): Promise<any> {
  if (!quote) return quote;

  const encrypted = { ...quote };

  // Encrypt financial amounts
  if (quote.total !== undefined) {
    encrypted.total = await encryptField(quote.total.toString());
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in a quote object
 */
export async function decryptQuoteFields(quote: any): Promise<any> {
  if (!quote) return quote;

  const decrypted = { ...quote };

  // Decrypt financial amounts
  if (quote.total) {
    const decryptedTotal = await decryptField(quote.total);
    decrypted.total = decryptedTotal ? parseFloat(decryptedTotal) : 0;
  }

  return decrypted;
}

/**
 * Clear encryption key (useful for logout)
 */
export async function clearEncryptionKey(): Promise<void> {
  try {
    await Preferences.remove({ key: ENCRYPTION_KEY_NAME });
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
