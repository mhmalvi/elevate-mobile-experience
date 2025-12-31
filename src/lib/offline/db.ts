import Dexie, { Table } from 'dexie';

// Entity types matching Supabase tables
export interface OfflineJob {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  scheduled_date?: string;
  completed_date?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface OfflineQuote {
  id: string;
  user_id: string;
  client_id: string;
  quote_number: string;
  title: string;
  description?: string;
  status: string;
  total: number;
  valid_until?: string;
  line_items: any[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface OfflineInvoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  title?: string;
  status: string;
  total: number;
  amount_paid: number;
  due_date?: string;
  paid_at?: string;
  line_items: any[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface OfflineClient {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SyncQueueItem {
  id?: number;
  entity_type: 'job' | 'quote' | 'invoice' | 'client';
  entity_id: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  created_at: string;
  synced: boolean;
  sync_error?: string;
  retry_count: number;
}

export interface OfflineMetadata {
  key: string;
  value: any;
  updated_at: string;
}

/**
 * TradieMate Offline Database
 * Uses IndexedDB via Dexie.js for offline-first data storage
 */
class TradieMateDB extends Dexie {
  // Entity tables
  jobs!: Table<OfflineJob, string>;
  quotes!: Table<OfflineQuote, string>;
  invoices!: Table<OfflineInvoice, string>;
  clients!: Table<OfflineClient, string>;

  // Sync queue
  syncQueue!: Table<SyncQueueItem, number>;

  // Metadata (for tracking sync state, last fetch times, etc.)
  metadata!: Table<OfflineMetadata, string>;

  constructor() {
    super('TradieMateDB');

    // Define schema version 1
    this.version(1).stores({
      // Entity tables - indexed by id and user_id for filtering
      jobs: 'id, user_id, status, updated_at, client_id, scheduled_date',
      quotes: 'id, user_id, status, updated_at, client_id',
      invoices: 'id, user_id, status, updated_at, client_id, due_date',
      clients: 'id, user_id, name, updated_at',

      // Sync queue - auto-incrementing id
      syncQueue: '++id, entity_type, entity_id, synced, created_at',

      // Metadata - keyed by string
      metadata: 'key, updated_at',
    });

    // Version 2: Clear sync queue to fix data corruption issues
    this.version(2).stores({}).upgrade(async (tx) => {
      try {
        console.log('[DB] Upgrading to v2: Clearing sync queue to fix corruption');
        await tx.table('syncQueue').clear();
      } catch (error) {
        console.error('[DB] Error during upgrade:', error);
      }
    });
  }

  /**
   * Clear all data from the database
   * Useful for logout or fresh sync
   */
  async clearAll() {
    await this.jobs.clear();
    await this.quotes.clear();
    await this.invoices.clear();
    await this.clients.clear();
    await this.syncQueue.clear();
    await this.metadata.clear();
  }

  /**
   * Clear user-specific data
   */
  async clearUserData(userId: string) {
    await this.jobs.where('user_id').equals(userId).delete();
    await this.quotes.where('user_id').equals(userId).delete();
    await this.invoices.where('user_id').equals(userId).delete();
    await this.clients.where('user_id').equals(userId).delete();
  }

  /**
   * Get metadata value
   */
  async getMeta(key: string): Promise<any> {
    const meta = await this.metadata.get(key);
    return meta?.value;
  }

  /**
   * Set metadata value
   */
  async setMeta(key: string, value: any) {
    await this.metadata.put({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Get last sync timestamp for an entity type
   */
  async getLastSyncTime(entityType: string): Promise<Date | null> {
    const timestamp = await this.getMeta(`last_sync_${entityType}`);
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Set last sync timestamp for an entity type
   */
  async setLastSyncTime(entityType: string) {
    await this.setMeta(`last_sync_${entityType}`, new Date().toISOString());
  }

  /**
   * Get statistics about offline data
   */
  async getStats() {
    let pendingSyncCount = 0;

    try {
      pendingSyncCount = await this.syncQueue.where('synced').equals(false).count();
    } catch (error) {
      console.error('[DB] Error counting sync queue, clearing:', error);
      await this.syncQueue.clear();
      pendingSyncCount = 0;
    }

    const [
      jobsCount,
      quotesCount,
      invoicesCount,
      clientsCount,
    ] = await Promise.all([
      this.jobs.count(),
      this.quotes.count(),
      this.invoices.count(),
      this.clients.count(),
    ]);

    return {
      jobs: jobsCount,
      quotes: quotesCount,
      invoices: invoicesCount,
      clients: clientsCount,
      pendingSync: pendingSyncCount,
    };
  }
}

// Create and export database instance
export const db = new TradieMateDB();

// Export types
export type { Table };

// Helper to check if IndexedDB is available
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

// Initialize database on first import
if (isIndexedDBAvailable()) {
  db.open().catch((err) => {
    console.error('Failed to open IndexedDB:', err);
  });
}
