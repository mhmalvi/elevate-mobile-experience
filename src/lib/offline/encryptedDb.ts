/**
 * Encrypted Database Wrapper
 *
 * SECURITY: Wraps IndexedDB operations to automatically encrypt/decrypt sensitive fields
 * Provides the same interface as the regular db but with transparent encryption
 */

import { db } from './db';
import type { OfflineClient, OfflineInvoice, OfflineQuote, OfflineJob } from './db';
import {
  encryptClientFields,
  decryptClientFields,
  encryptInvoiceFields,
  decryptInvoiceFields,
  encryptQuoteFields,
  decryptQuoteFields,
} from './encryption';

/**
 * Encrypted Clients Table Wrapper
 */
export const encryptedClients = {
  /**
   * Add a client with encrypted sensitive fields
   */
  async add(client: OfflineClient): Promise<string> {
    const encrypted = await encryptClientFields(client);
    return await db.clients.add(encrypted);
  },

  /**
   * Put a client with encrypted sensitive fields
   */
  async put(client: OfflineClient): Promise<string> {
    const encrypted = await encryptClientFields(client);
    return await db.clients.put(encrypted);
  },

  /**
   * Bulk put clients with encrypted sensitive fields
   */
  async bulkPut(clients: OfflineClient[]): Promise<string> {
    const encrypted = await Promise.all(clients.map(c => encryptClientFields(c)));
    return await db.clients.bulkPut(encrypted);
  },

  /**
   * Get a client and decrypt sensitive fields
   */
  async get(id: string): Promise<OfflineClient | undefined> {
    const client = await db.clients.get(id);
    if (!client) return undefined;
    return await decryptClientFields(client);
  },

  /**
   * Get all clients and decrypt sensitive fields
   */
  async toArray(): Promise<OfflineClient[]> {
    const clients = await db.clients.toArray();
    return await Promise.all(clients.map(c => decryptClientFields(c)));
  },

  /**
   * Query clients by user_id and decrypt
   */
  where(field: string) {
    const query = db.clients.where(field);
    return {
      equals: (value: any) => ({
        toArray: async () => {
          const clients = await query.equals(value).toArray();
          return await Promise.all(clients.map(c => decryptClientFields(c)));
        },
        delete: () => query.equals(value).delete(),
        count: () => query.equals(value).count(),
      }),
    };
  },

  /**
   * Delete client (no encryption needed)
   */
  async delete(id: string): Promise<void> {
    return await db.clients.delete(id);
  },

  /**
   * Clear all clients (no encryption needed)
   */
  async clear(): Promise<void> {
    return await db.clients.clear();
  },

  /**
   * Count clients (no encryption needed)
   */
  async count(): Promise<number> {
    return await db.clients.count();
  },
};

/**
 * Encrypted Invoices Table Wrapper
 */
export const encryptedInvoices = {
  async add(invoice: OfflineInvoice): Promise<string> {
    const encrypted = await encryptInvoiceFields(invoice);
    return await db.invoices.add(encrypted);
  },

  async put(invoice: OfflineInvoice): Promise<string> {
    const encrypted = await encryptInvoiceFields(invoice);
    return await db.invoices.put(encrypted);
  },

  async bulkPut(invoices: OfflineInvoice[]): Promise<string> {
    const encrypted = await Promise.all(invoices.map(i => encryptInvoiceFields(i)));
    return await db.invoices.bulkPut(encrypted);
  },

  async get(id: string): Promise<OfflineInvoice | undefined> {
    const invoice = await db.invoices.get(id);
    if (!invoice) return undefined;
    return await decryptInvoiceFields(invoice);
  },

  async toArray(): Promise<OfflineInvoice[]> {
    const invoices = await db.invoices.toArray();
    return await Promise.all(invoices.map(i => decryptInvoiceFields(i)));
  },

  where(field: string) {
    const query = db.invoices.where(field);
    return {
      equals: (value: any) => ({
        toArray: async () => {
          const invoices = await query.equals(value).toArray();
          return await Promise.all(invoices.map(i => decryptInvoiceFields(i)));
        },
        delete: () => query.equals(value).delete(),
        count: () => query.equals(value).count(),
      }),
    };
  },

  async delete(id: string): Promise<void> {
    return await db.invoices.delete(id);
  },

  async clear(): Promise<void> {
    return await db.invoices.clear();
  },

  async count(): Promise<number> {
    return await db.invoices.count();
  },
};

/**
 * Encrypted Quotes Table Wrapper
 */
export const encryptedQuotes = {
  async add(quote: OfflineQuote): Promise<string> {
    const encrypted = await encryptQuoteFields(quote);
    return await db.quotes.add(encrypted);
  },

  async put(quote: OfflineQuote): Promise<string> {
    const encrypted = await encryptQuoteFields(quote);
    return await db.quotes.put(encrypted);
  },

  async bulkPut(quotes: OfflineQuote[]): Promise<string> {
    const encrypted = await Promise.all(quotes.map(q => encryptQuoteFields(q)));
    return await db.quotes.bulkPut(encrypted);
  },

  async get(id: string): Promise<OfflineQuote | undefined> {
    const quote = await db.quotes.get(id);
    if (!quote) return undefined;
    return await decryptQuoteFields(quote);
  },

  async toArray(): Promise<OfflineQuote[]> {
    const quotes = await db.quotes.toArray();
    return await Promise.all(quotes.map(q => decryptQuoteFields(q)));
  },

  where(field: string) {
    const query = db.quotes.where(field);
    return {
      equals: (value: any) => ({
        toArray: async () => {
          const quotes = await query.equals(value).toArray();
          return await Promise.all(quotes.map(q => decryptQuoteFields(q)));
        },
        delete: () => query.equals(value).delete(),
        count: () => query.equals(value).count(),
      }),
    };
  },

  async delete(id: string): Promise<void> {
    return await db.quotes.delete(id);
  },

  async clear(): Promise<void> {
    return await db.quotes.clear();
  },

  async count(): Promise<number> {
    return await db.quotes.count();
  },
};

/**
 * Jobs don't have sensitive fields requiring encryption
 * But we provide a passthrough for consistency
 */
export const encryptedJobs = {
  add: (job: OfflineJob) => db.jobs.add(job),
  put: (job: OfflineJob) => db.jobs.put(job),
  bulkPut: (jobs: OfflineJob[]) => db.jobs.bulkPut(jobs),
  get: (id: string) => db.jobs.get(id),
  toArray: () => db.jobs.toArray(),
  where: (field: string) => db.jobs.where(field),
  delete: (id: string) => db.jobs.delete(id),
  clear: () => db.jobs.clear(),
  count: () => db.jobs.count(),
};

/**
 * Export encrypted database interface
 * Use this instead of direct db access for automatic encryption
 */
export const encryptedDb = {
  clients: encryptedClients,
  invoices: encryptedInvoices,
  quotes: encryptedQuotes,
  jobs: encryptedJobs,
  // Non-encrypted tables (no sensitive data)
  syncQueue: db.syncQueue,
  metadata: db.metadata,
  // Utility methods
  clearAll: () => db.clearAll(),
  clearUserData: (userId: string) => db.clearUserData(userId),
  getMeta: (key: string) => db.getMeta(key),
  setMeta: (key: string, value: any) => db.setMeta(key, value),
  getLastSyncTime: (entityType: string) => db.getLastSyncTime(entityType),
  setLastSyncTime: (entityType: string) => db.setLastSyncTime(entityType),
  getStats: () => db.getStats(),
};
