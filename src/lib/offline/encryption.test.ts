/**
 * Tests for field-level encryption utilities
 *
 * The WebCrypto AES-GCM API is available in jsdom via Node's built-in `crypto`
 * module. Tests cover the secure-context path and the non-secure fallback path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { OfflineClient, OfflineInvoice, OfflineQuote } from './db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the string looks like a base64-encoded blob. */
function looksLikeBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]+=*$/.test(value);
}

// ---------------------------------------------------------------------------
// Module re-import utility
// Encryption.ts caches the secure-context check in a module-level variable
// (_isSecureContextCached). To test the non-secure fallback we need to reload
// the module with crypto.subtle removed.
// ---------------------------------------------------------------------------

async function importEncryption() {
  // Fresh dynamic import so module-level cache is reset between describe blocks.
  return await import('./encryption');
}

// ---------------------------------------------------------------------------
// Mock @capacitor/preferences so tests run without a native host
// ---------------------------------------------------------------------------

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store.set(key, value); }),
      remove: vi.fn(async ({ key }: { key: string }) => { store.delete(key); }),
      keys: vi.fn(async () => ({ keys: [...store.keys()] })),
      clear: vi.fn(async () => { store.clear(); }),
    },
  };
});

// ---------------------------------------------------------------------------
// SECURE CONTEXT tests  (crypto.subtle is present — the happy path)
// ---------------------------------------------------------------------------

describe('encryption — secure context (crypto.subtle available)', () => {
  // Ensure a fresh module each describe block so the module-level cache is
  // cleared between the secure and non-secure describe blocks.
  let encryption: typeof import('./encryption');

  beforeEach(async () => {
    vi.resetModules();
    // Guarantee crypto.subtle is present (jsdom + Node provide it)
    expect(typeof crypto.subtle).toBe('object');
    encryption = await importEncryption();
  });

  // ---- encryptField / decryptField ----------------------------------------

  it('encryptField returns a non-null base64 string for normal input', async () => {
    const result = await encryption.encryptField('hello world');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(looksLikeBase64(result!)).toBe(true);
  });

  it('encryptField output differs from the plaintext input', async () => {
    const plaintext = 'sensitive data';
    const encrypted = await encryption.encryptField(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  it('encryptField / decryptField round-trip returns the original string', async () => {
    const original = 'John Smith, 42 Main St';
    const ciphertext = await encryption.encryptField(original);
    expect(ciphertext).not.toBeNull();
    const recovered = await encryption.decryptField(ciphertext!);
    expect(recovered).toBe(original);
  });

  it('round-trip works for strings containing unicode characters', async () => {
    const original = 'Ünïcödé tëxt 🔑';
    const ciphertext = await encryption.encryptField(original);
    const recovered = await encryption.decryptField(ciphertext!);
    expect(recovered).toBe(original);
  });

  it('round-trip works for numeric strings', async () => {
    const original = '1234.56';
    const ciphertext = await encryption.encryptField(original);
    const recovered = await encryption.decryptField(ciphertext!);
    expect(recovered).toBe(original);
  });

  it('produces different ciphertext on each call (random IV)', async () => {
    const plaintext = 'same plaintext';
    const ct1 = await encryption.encryptField(plaintext);
    const ct2 = await encryption.encryptField(plaintext);
    // Both must be valid
    expect(ct1).not.toBeNull();
    expect(ct2).not.toBeNull();
    // Ciphertexts must differ because of random IV
    expect(ct1).not.toBe(ct2);
  });

  // ---- null / empty passthrough -------------------------------------------

  it('encryptField returns null for null input', async () => {
    const result = await encryption.encryptField(null);
    expect(result).toBeNull();
  });

  it('encryptField returns null for undefined input', async () => {
    const result = await encryption.encryptField(undefined);
    expect(result).toBeNull();
  });

  it('encryptField returns null for empty string', async () => {
    const result = await encryption.encryptField('');
    expect(result).toBeNull();
  });

  it('encryptField returns null for whitespace-only string', async () => {
    const result = await encryption.encryptField('   ');
    expect(result).toBeNull();
  });

  it('decryptField returns null for null input', async () => {
    const result = await encryption.decryptField(null);
    expect(result).toBeNull();
  });

  it('decryptField returns null for empty string', async () => {
    const result = await encryption.decryptField('');
    expect(result).toBeNull();
  });

  // ---- encryptClientFields / decryptClientFields ---------------------------

  it('encryptClientFields encrypts PII fields and round-trips correctly', async () => {
    const client: OfflineClient = {
      id: 'c-1',
      user_id: 'u-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+61412345678',
      address: '10 Downing St',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const encryptedClient = await encryption.encryptClientFields(client);

    // PII fields should be encrypted (differ from original)
    expect(encryptedClient.name).not.toBe(client.name);
    expect(encryptedClient.email).not.toBe(client.email);
    expect(encryptedClient.phone).not.toBe(client.phone);
    expect(encryptedClient.address).not.toBe(client.address);

    // Non-PII fields should be unchanged
    expect(encryptedClient.id).toBe(client.id);
    expect(encryptedClient.user_id).toBe(client.user_id);

    // Decrypt and verify we recover originals
    const decryptedClient = await encryption.decryptClientFields(encryptedClient);
    expect(decryptedClient.name).toBe(client.name);
    expect(decryptedClient.email).toBe(client.email);
    expect(decryptedClient.phone).toBe(client.phone);
    expect(decryptedClient.address).toBe(client.address);
  });

  it('encryptClientFields leaves optional absent fields undefined', async () => {
    const client: OfflineClient = {
      id: 'c-2',
      user_id: 'u-2',
      name: 'No Contact',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const encrypted = await encryption.encryptClientFields(client);
    expect(encrypted.email).toBeUndefined();
    expect(encrypted.phone).toBeUndefined();
    expect(encrypted.address).toBeUndefined();
  });

  // ---- encryptInvoiceFields / decryptInvoiceFields -------------------------

  it('encryptInvoiceFields / decryptInvoiceFields round-trip preserves totals', async () => {
    const invoice: OfflineInvoice = {
      id: 'i-1',
      user_id: 'u-1',
      invoice_number: 'INV-001',
      title: 'Test Invoice',
      status: 'draft',
      total: 1100.50,
      amount_paid: 500.00,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const encrypted = await encryption.encryptInvoiceFields(invoice);

    // Encrypted total should be a string stored as unknown number
    expect(typeof encrypted.total).toBe('string');

    const decrypted = await encryption.decryptInvoiceFields(encrypted);
    expect(decrypted.total).toBe(1100.50);
    expect(decrypted.amount_paid).toBe(500.00);
  });

  it('decryptInvoiceFields handles a value that is already a plain number', async () => {
    const invoice: OfflineInvoice = {
      id: 'i-2',
      user_id: 'u-1',
      invoice_number: 'INV-002',
      title: 'Test Invoice 2',
      status: 'draft',
      total: 250,
      amount_paid: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Pass invoice without encrypting it first — as if loaded from a
    // pre-encryption session where values were stored as plain numbers.
    const decrypted = await encryption.decryptInvoiceFields(invoice);
    expect(decrypted.total).toBe(250);
    expect(decrypted.amount_paid).toBe(0);
  });

  // ---- encryptQuoteFields / decryptQuoteFields -----------------------------

  it('encryptQuoteFields / decryptQuoteFields round-trip preserves total', async () => {
    const quote: OfflineQuote = {
      id: 'q-1',
      user_id: 'u-1',
      quote_number: 'Q-001',
      title: 'Roof Repair',
      status: 'draft',
      total: 3300.00,
      line_items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const encrypted = await encryption.encryptQuoteFields(quote);
    expect(typeof encrypted.total).toBe('string');

    const decrypted = await encryption.decryptQuoteFields(encrypted);
    expect(decrypted.total).toBe(3300.00);
  });

  it('decryptQuoteFields handles a value that is already a plain number', async () => {
    const quote: OfflineQuote = {
      id: 'q-2',
      user_id: 'u-1',
      quote_number: 'Q-002',
      title: 'Plumbing',
      status: 'draft',
      total: 750,
      line_items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const decrypted = await encryption.decryptQuoteFields(quote);
    expect(decrypted.total).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// NON-SECURE CONTEXT  (crypto.subtle is undefined)
// ---------------------------------------------------------------------------

describe('encryption — non-secure context (crypto.subtle unavailable)', () => {
  let encryption: typeof import('./encryption');
  let originalSubtle: SubtleCrypto;

  beforeEach(async () => {
    vi.resetModules();

    // Remove crypto.subtle to simulate a non-secure context
    originalSubtle = crypto.subtle;
    Object.defineProperty(crypto, 'subtle', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    encryption = await importEncryption();
  });

  afterEach(() => {
    // Restore crypto.subtle
    Object.defineProperty(crypto, 'subtle', {
      value: originalSubtle,
      writable: true,
      configurable: true,
    });
  });

  it('encryptField returns UNENC:-prefixed base64 when crypto.subtle is unavailable', async () => {
    const plaintext = 'plain data';
    const result = await encryption.encryptField(plaintext);
    expect(result).toMatch(/^UNENC:/);
    // Should roundtrip through decrypt
    const decrypted = await encryption.decryptField(result);
    expect(decrypted).toBe(plaintext);
  });

  it('decryptField returns legacy plaintext as-is when not UNENC: prefixed', async () => {
    const value = 'not actually encrypted';
    const result = await encryption.decryptField(value);
    expect(result).toBe(value);
  });

  it('encryptField still returns null for null input in non-secure context', async () => {
    const result = await encryption.encryptField(null);
    expect(result).toBeNull();
  });

  it('encryptClientFields stores plaintext when in non-secure context', async () => {
    const client: OfflineClient = {
      id: 'c-3',
      user_id: 'u-3',
      name: 'Bob Builder',
      email: 'bob@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const encrypted = await encryption.encryptClientFields(client);
    // In non-secure context, fields are UNENC:-prefixed base64, not raw plaintext
    expect(encrypted.name).toMatch(/^UNENC:/);
    expect(encrypted.email).toMatch(/^UNENC:/);
  });
});
