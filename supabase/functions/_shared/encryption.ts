/**
 * Token Encryption Utilities for Supabase Edge Functions
 * Uses Web Crypto API (available in Deno runtime)
 *
 * IMPORTANT: Set ENCRYPTION_KEY in Supabase Edge Function Secrets:
 * supabase secrets set ENCRYPTION_KEY=your-32-character-random-key
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Generates a crypto key from the encryption key string
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ENCRYPTION_KEY');

  if (!keyString || keyString.length < 32) {
    throw new Error('ENCRYPTION_KEY must be set and at least 32 characters long');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString.substring(0, 32)); // Use first 32 chars

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ENCRYPTION_ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a token string
 * @param token - The plaintext token to encrypt
 * @returns Base64-encoded encrypted token (includes IV)
 */
export async function encryptToken(token: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Get encryption key
    const key = await getEncryptionKey();

    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      key,
      data
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(IV_LENGTH + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), IV_LENGTH);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypts a token string
 * @param encryptedToken - Base64-encoded encrypted token (includes IV)
 * @returns Decrypted plaintext token
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    // Get encryption key
    const key = await getEncryptionKey();

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      key,
      encrypted
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Checks if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  const key = Deno.env.get('ENCRYPTION_KEY');
  return !!(key && key.length >= 32);
}

/**
 * Bank Account Details Interface
 */
export interface BankAccountDetails {
  bank_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_account_name?: string;
}

/**
 * Encrypted Bank Account Details Interface
 */
export interface EncryptedBankAccountDetails {
  bank_name_encrypted?: string;
  bank_bsb_encrypted?: string;
  bank_account_number_encrypted?: string;
  bank_account_name_encrypted?: string;
}

/**
 * Encrypts bank account details
 * @param details - Plaintext bank account details
 * @returns Encrypted bank account details
 */
export async function encryptBankDetails(
  details: BankAccountDetails
): Promise<EncryptedBankAccountDetails> {
  const encrypted: EncryptedBankAccountDetails = {};

  if (details.bank_name) {
    encrypted.bank_name_encrypted = await encryptToken(details.bank_name);
  }
  if (details.bank_bsb) {
    encrypted.bank_bsb_encrypted = await encryptToken(details.bank_bsb);
  }
  if (details.bank_account_number) {
    encrypted.bank_account_number_encrypted = await encryptToken(details.bank_account_number);
  }
  if (details.bank_account_name) {
    encrypted.bank_account_name_encrypted = await encryptToken(details.bank_account_name);
  }

  return encrypted;
}

/**
 * Decrypts bank account details
 * @param encrypted - Encrypted bank account details
 * @returns Decrypted bank account details
 */
export async function decryptBankDetails(
  encrypted: EncryptedBankAccountDetails
): Promise<BankAccountDetails> {
  const decrypted: BankAccountDetails = {};

  if (encrypted.bank_name_encrypted) {
    decrypted.bank_name = await decryptToken(encrypted.bank_name_encrypted);
  }
  if (encrypted.bank_bsb_encrypted) {
    decrypted.bank_bsb = await decryptToken(encrypted.bank_bsb_encrypted);
  }
  if (encrypted.bank_account_number_encrypted) {
    decrypted.bank_account_number = await decryptToken(encrypted.bank_account_number_encrypted);
  }
  if (encrypted.bank_account_name_encrypted) {
    decrypted.bank_account_name = await decryptToken(encrypted.bank_account_name_encrypted);
  }

  return decrypted;
}
