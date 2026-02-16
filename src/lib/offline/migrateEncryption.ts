/**
 * Encryption Migration Utility
 *
 * SECURITY: One-time migration to encrypt existing unencrypted data in IndexedDB
 * This should be run once when the app starts to ensure all sensitive data is encrypted
 */

import { db } from './db';
import {
  encryptClientFields,
  encryptInvoiceFields,
  encryptQuoteFields,
} from './encryption';

const MIGRATION_KEY = 'encryption_migration_completed';

/**
 * Check if encryption migration has been completed
 */
export async function isEncryptionMigrationComplete(): Promise<boolean> {
  try {
    const completed = await db.getMeta(MIGRATION_KEY);
    return completed === true;
  } catch (error) {
    console.error('[Migration] Error checking migration status:', error);
    return false;
  }
}

/**
 * Migrate existing unencrypted data to encrypted format
 * This is a one-time operation that should be run on app startup
 */
export async function migrateToEncryptedStorage(): Promise<void> {
  try {
    // Check if migration already completed
    const isComplete = await isEncryptionMigrationComplete();
    if (isComplete) {
      console.debug('[Migration] Encryption migration already completed');
      return;
    }

    console.debug('[Migration] Starting encryption migration...');

    // Migrate clients
    const clients = await db.clients.toArray();
    console.debug(`[Migration] Migrating ${clients.length} clients...`);
    for (const client of clients) {
      // Check if already encrypted (encrypted data will be base64 and won't contain spaces typically)
      const isAlreadyEncrypted = client.name && /^[A-Za-z0-9+/=]+$/.test(client.name);
      if (!isAlreadyEncrypted) {
        const encrypted = await encryptClientFields(client);
        await db.clients.put(encrypted);
      }
    }

    // Migrate invoices
    const invoices = await db.invoices.toArray();
    console.debug(`[Migration] Migrating ${invoices.length} invoices...`);
    for (const invoice of invoices) {
      // Check if amounts are numbers (unencrypted) or strings (encrypted)
      const isAlreadyEncrypted = typeof invoice.total === 'string';
      if (!isAlreadyEncrypted) {
        const encrypted = await encryptInvoiceFields(invoice);
        await db.invoices.put(encrypted);
      }
    }

    // Migrate quotes
    const quotes = await db.quotes.toArray();
    console.debug(`[Migration] Migrating ${quotes.length} quotes...`);
    for (const quote of quotes) {
      // Check if amounts are numbers (unencrypted) or strings (encrypted)
      const isAlreadyEncrypted = typeof quote.total === 'string';
      if (!isAlreadyEncrypted) {
        const encrypted = await encryptQuoteFields(quote);
        await db.quotes.put(encrypted);
      }
    }

    // Mark migration as complete
    await db.setMeta(MIGRATION_KEY, true);
    console.debug('[Migration] Encryption migration completed successfully');
  } catch (error) {
    console.error('[Migration] Encryption migration failed:', error);
    // Don't mark as complete if migration failed
    throw error;
  }
}

/**
 * Reset migration status (useful for testing or re-encryption)
 * WARNING: Only use for development/testing
 */
export async function resetMigrationStatus(): Promise<void> {
  await db.setMeta(MIGRATION_KEY, false);
  console.debug('[Migration] Migration status reset');
}
