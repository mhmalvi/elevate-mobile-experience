import Dexie, { Table } from 'dexie';
import type { Json } from '@/integrations/supabase/types';

// Entity types matching Supabase tables
export interface OfflineJob {
  id: string;
  user_id: string;
  team_id?: string;
  client_id?: string;
  quote_id?: string;
  title: string;
  description?: string;
  status: string;
  site_address?: string;
  scheduled_date?: string;
  notes?: string;
  material_cost?: number;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Legacy fields kept for backward compatibility with existing offline data
  /** @deprecated Not in Supabase schema */
  priority?: string;
  /** @deprecated Not in Supabase schema - use site_address instead */
  address?: string;
  /** @deprecated Not in Supabase schema */
  completed_date?: string;
}

export interface OfflineQuote {
  id: string;
  user_id: string;
  team_id?: string;
  client_id?: string;
  quote_number: string;
  title: string;
  description?: string;
  notes?: string;
  status: string;
  subtotal?: number;
  gst?: number;
  total: number;
  valid_until?: string;
  accepted_at?: string;
  public_token?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Legacy field kept for backward compatibility with existing offline data
  /** @deprecated Line items are now stored in the quote_line_items table */
  line_items?: Json[];
}

export interface OfflineInvoice {
  id: string;
  user_id: string;
  team_id?: string;
  client_id?: string;
  job_id?: string;
  quote_id?: string;
  invoice_number: string;
  title: string;
  description?: string;
  notes?: string;
  status: string;
  subtotal?: number;
  gst?: number;
  total: number;
  amount_paid: number;
  due_date?: string;
  paid_at?: string;
  sent_at?: string;
  // Recurring invoice fields
  is_recurring?: boolean;
  recurring_interval?: string;
  next_due_date?: string;
  parent_invoice_id?: string;
  // Stripe
  stripe_payment_link?: string;
  // Xero sync
  xero_invoice_id?: string;
  last_synced_to_xero?: string;
  xero_sync_error?: string;
  xero_sync_status?: string;
  // QuickBooks sync
  qb_invoice_id?: string;
  last_synced_to_qb?: string;
  qb_sync_error?: string;
  // Public access token
  public_token?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Legacy field kept for backward compatibility with existing offline data
  /** @deprecated Line items are now stored in the invoice_line_items table */
  line_items?: Json[];
}

export interface OfflineClient {
  id: string;
  user_id: string;
  team_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  notes?: string;
  // Xero sync
  xero_contact_id?: string;
  last_synced_to_xero?: string;
  xero_sync_error?: string;
  // QuickBooks sync
  qb_customer_id?: string;
  last_synced_to_qb?: string;
  qb_sync_error?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface OfflineQuoteLineItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
  item_type?: string;
  sort_order?: number;
  created_at: string;
  // Legacy fields kept for backward compatibility with existing offline data
  /** @deprecated Not in Supabase schema */
  updated_at?: string;
  /** @deprecated Not in Supabase schema */
  deleted_at?: string;
  /** @deprecated Not in Supabase schema */
  synced?: number;
}

export interface OfflineInvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
  item_type?: string;
  sort_order?: number;
  created_at: string;
  // Legacy fields kept for backward compatibility with existing offline data
  /** @deprecated Not in Supabase schema */
  updated_at?: string;
  /** @deprecated Not in Supabase schema */
  deleted_at?: string;
  /** @deprecated Not in Supabase schema */
  synced?: number;
}

export interface SyncQueueItem {
  id?: number;
  entity_type: 'job' | 'quote' | 'invoice' | 'client' | 'quote_line_item' | 'invoice_line_item';
  entity_id: string;
  action: 'create' | 'update' | 'delete';
  data: Json;
  created_at: string;
  updated_at?: string; // For tracking coalesced updates
  synced: boolean;
  sync_error?: string;
  retry_count: number;
}

export interface OfflineMetadata {
  key: string;
  value: Json;
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
  quote_line_items!: Table<OfflineQuoteLineItem, string>;
  invoice_line_items!: Table<OfflineInvoiceLineItem, string>;

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
      // ⚠️ Removed 'synced' from index - boolean indexing can cause IDBKeyRange errors
      syncQueue: '++id, entity_type, entity_id, created_at',

      // Metadata - keyed by string
      metadata: 'key, updated_at',
    });

    // Version 2: Clear sync queue to fix data corruption issues
    this.version(2).stores({
      // Keep same schema as v1 (without synced index)
      jobs: 'id, user_id, status, updated_at, client_id, scheduled_date',
      quotes: 'id, user_id, status, updated_at, client_id',
      invoices: 'id, user_id, status, updated_at, client_id, due_date',
      clients: 'id, user_id, name, updated_at',
      syncQueue: '++id, entity_type, entity_id, created_at',
      metadata: 'key, updated_at',
    }).upgrade(async (tx) => {
      try {
        console.debug('[DB] Upgrading to v2: Clearing sync queue to fix corruption');
        await tx.table('syncQueue').clear();
      } catch (error) {
        console.error('[DB] Error during upgrade:', error);
      }
    });

    // Version 3: Add stricter validation and clear corrupted queue
    this.version(3).stores({
      // Keep same schema but force migration (without synced index)
      jobs: 'id, user_id, status, updated_at, client_id, scheduled_date',
      quotes: 'id, user_id, status, updated_at, client_id',
      invoices: 'id, user_id, status, updated_at, client_id, due_date',
      clients: 'id, user_id, name, updated_at',
      syncQueue: '++id, entity_type, entity_id, created_at',
      metadata: 'key, updated_at',
    }).upgrade(async (tx) => {
      try {
        console.debug('[DB] Upgrading to v3: Clearing corrupted sync queue');
        const syncQueueTable = tx.table('syncQueue');
        if (syncQueueTable) {
          const count = await syncQueueTable.count();
          console.debug(`[DB] Found ${count} items in sync queue, clearing...`);
          await syncQueueTable.clear();
          console.debug('[DB] Sync queue cleared successfully');
        }
      } catch (error) {
        console.error('[DB] Error during v3 upgrade (non-fatal):', error);
      }
    });

    // Version 4: Complete cleanup - delete and recreate sync queue
    this.version(4).stores({
      // Keep same schema but force migration (without synced index)
      jobs: 'id, user_id, status, updated_at, client_id, scheduled_date',
      quotes: 'id, user_id, status, updated_at, client_id',
      invoices: 'id, user_id, status, updated_at, client_id, due_date',
      clients: 'id, user_id, name, updated_at',
      syncQueue: '++id, entity_type, entity_id, created_at',
      metadata: 'key, updated_at',
    }).upgrade(async (tx) => {
      try {
        console.debug('[DB] Upgrading to v4: Complete sync queue cleanup');
        const syncQueueTable = tx.table('syncQueue');
        if (syncQueueTable) {
          try {
            await syncQueueTable.clear();
            console.debug('[DB] Sync queue cleared in v4 upgrade');
          } catch (clearError) {
            console.error('[DB] Error clearing sync queue in v4:', clearError);
            try {
              const allItems = await syncQueueTable.toArray();
              console.debug(`[DB] Attempting to delete ${allItems.length} items individually`);
              for (const item of allItems) {
                if (item.id) {
                  await syncQueueTable.delete(item.id);
                }
              }
              console.debug('[DB] Individual deletion complete');
            } catch (deleteError) {
              console.error('[DB] Individual deletion also failed:', deleteError);
            }
          }
        }
      } catch (error) {
        console.error('[DB] Error during v4 upgrade (non-fatal):', error);
      }
    });

    // Version 5: Remove boolean index from syncQueue to fix IDBKeyRange errors
    this.version(5).stores({
      // ✅ CRITICAL FIX: Removed 'synced' from index to prevent IDBKeyRange errors
      jobs: 'id, user_id, status, updated_at, client_id, scheduled_date',
      quotes: 'id, user_id, status, updated_at, client_id',
      invoices: 'id, user_id, status, updated_at, client_id, due_date',
      clients: 'id, user_id, name, updated_at',
      syncQueue: '++id, entity_type, entity_id, created_at',
      metadata: 'key, updated_at',
    }).upgrade(async (tx) => {
      try {
        console.debug('[DB] Upgrading to v5: Removing boolean index from syncQueue');
        // Clear and rebuild sync queue with new schema (no synced index)
        await tx.table('syncQueue').clear();
        console.debug('[DB] v5 upgrade complete - sync queue rebuilt without boolean index');
      } catch (error) {
        console.error('[DB] Error during v5 upgrade (non-fatal):', error);
      }
    });

    // Version 6: Add quote_line_items and invoice_line_items tables for offline line item support
    this.version(6).stores({
      jobs: 'id, user_id, status, updated_at, client_id, scheduled_date',
      quotes: 'id, user_id, status, updated_at, client_id',
      invoices: 'id, user_id, status, updated_at, client_id, due_date',
      clients: 'id, user_id, name, updated_at',
      quote_line_items: '++id, quote_id, synced, created_at',
      invoice_line_items: '++id, invoice_id, synced, created_at',
      syncQueue: '++id, entity_type, entity_id, created_at',
      metadata: 'key, updated_at',
    });

    // Version 7: Fix line item tables - use string id (not auto-increment) and remove boolean 'synced' index
    this.version(7).stores({
      jobs: 'id, user_id, status, updated_at, client_id, scheduled_date',
      quotes: 'id, user_id, status, updated_at, client_id',
      invoices: 'id, user_id, status, updated_at, client_id, due_date',
      clients: 'id, user_id, name, updated_at',
      // ✅ CRITICAL FIX: Changed '++id' to 'id' since UUIDs are generated in code
      // ✅ CRITICAL FIX: Removed 'synced' from index to prevent IDBKeyRange errors
      quote_line_items: 'id, quote_id, created_at',
      invoice_line_items: 'id, invoice_id, created_at',
      syncQueue: '++id, entity_type, entity_id, created_at',
      metadata: 'key, updated_at',
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
    await this.quote_line_items.clear();
    await this.invoice_line_items.clear();
    await this.syncQueue.clear();
    await this.metadata.clear();
  }

  /**
   * Clear user-specific data, including related line items and sync queue entries
   */
  async clearUserData(userId: string) {
    // Get user's quote and invoice IDs so we can clear their line items
    const userQuoteIds = (await this.quotes.where('user_id').equals(userId).primaryKeys()) as string[];
    const userInvoiceIds = (await this.invoices.where('user_id').equals(userId).primaryKeys()) as string[];

    // Clear entity tables scoped to this user
    await this.jobs.where('user_id').equals(userId).delete();
    await this.quotes.where('user_id').equals(userId).delete();
    await this.invoices.where('user_id').equals(userId).delete();
    await this.clients.where('user_id').equals(userId).delete();

    // Clear line items belonging to the user's quotes/invoices
    if (userQuoteIds.length > 0) {
      await this.quote_line_items.where('quote_id').anyOf(userQuoteIds).delete();
    }
    if (userInvoiceIds.length > 0) {
      await this.invoice_line_items.where('invoice_id').anyOf(userInvoiceIds).delete();
    }

    // Clear sync queue and metadata for this user
    await this.syncQueue.clear();
    await this.metadata.clear();
  }

  /**
   * Get metadata value
   */
  async getMeta(key: string): Promise<Json | undefined> {
    const meta = await this.metadata.get(key);
    return meta?.value;
  }

  /**
   * Set metadata value
   */
  async setMeta(key: string, value: Json) {
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
      // ✅ FIX: Don't use .where('synced') index - filter in memory instead
      const allItems = await this.syncQueue.toArray();
      pendingSyncCount = allItems.filter(item => !item.synced).length;
    } catch (error) {
      console.error('[DB] Error counting sync queue, clearing:', error);
      try {
        await this.syncQueue.clear();
      } catch (clearError) {
        console.error('[DB] Failed to clear sync queue:', clearError);
      }
      pendingSyncCount = 0;
    }

    const [
      jobsCount,
      quotesCount,
      invoicesCount,
      clientsCount,
      quoteLineItemsCount,
      invoiceLineItemsCount,
    ] = await Promise.all([
      this.jobs.count(),
      this.quotes.count(),
      this.invoices.count(),
      this.clients.count(),
      this.quote_line_items.count(),
      this.invoice_line_items.count(),
    ]);

    return {
      jobs: jobsCount,
      quotes: quotesCount,
      invoices: invoicesCount,
      clients: clientsCount,
      quoteLineItems: quoteLineItemsCount,
      invoiceLineItems: invoiceLineItemsCount,
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
