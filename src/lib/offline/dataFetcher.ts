/**
 * Inbound data fetching: pulls data from Supabase and stores it in IndexedDB.
 *
 * Handles:
 * - fetchAndStore() public entry point with in-flight deduplication
 * - fetchAndStoreEntity() paginated fetch for user-owned entities
 * - fetchAndStoreLineItems() paginated fetch keyed by parent FK
 * - getPendingSyncIds() — prevents overwriting locally-queued changes
 */

import { db } from './db';
import { encryptedDb } from './encryptedDb';
import { supabase } from '@/integrations/supabase/client';
import type { Table } from 'dexie';

// ---------------------------------------------------------------------------
// DataFetcher
// ---------------------------------------------------------------------------

export class DataFetcher {
  /** Deduplication: reuse in-flight promises for the same userId. */
  private fetchInFlight: Map<string, Promise<void>> = new Map();

  /** Promise that must resolve before any fetch is allowed. Injected by SyncManager. */
  schemaReady: Promise<void> = Promise.resolve();

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Fetch all entities from Supabase and store them in IndexedDB.
   * Concurrent calls for the same userId are coalesced into a single request.
   */
  async fetchAndStore(
    userId: string,
    options?: { pageSize?: number; onProgress?: (progress: number) => void }
  ): Promise<void> {
    if (!navigator.onLine) return;

    const existing = this.fetchInFlight.get(userId);
    if (existing) return existing;

    const fetchPromise = this._fetchAndStoreImpl(userId, options).finally(() => {
      this.fetchInFlight.delete(userId);
    });
    this.fetchInFlight.set(userId, fetchPromise);
    return fetchPromise;
  }

  // ---------------------------------------------------------------------------
  // Implementation
  // ---------------------------------------------------------------------------

  private async _fetchAndStoreImpl(
    userId: string,
    options?: { pageSize?: number; onProgress?: (progress: number) => void }
  ): Promise<void> {
    await this.schemaReady;

    const pageSize = options?.pageSize ?? 100;
    try {
      const pendingIds = await this.getPendingSyncIds();
      const totalExpected = 6; // 4 main entity types + 2 line item tables
      let totalFetched = 0;

      // Jobs
      await this._fetchAndStoreEntity('jobs', userId, pendingIds.job, pageSize, db.jobs);
      options?.onProgress?.(++totalFetched / totalExpected);

      // Quotes
      await this._fetchAndStoreEntity('quotes', userId, pendingIds.quote, pageSize, encryptedDb.quotes as unknown as Table);
      options?.onProgress?.(++totalFetched / totalExpected);

      // Quote line items (via parent quote IDs already in IndexedDB)
      await this._fetchAndStoreLineItems(
        'quote_line_items', 'quote_id', db.quotes, pendingIds.quote_line_item, pageSize, db.quote_line_items
      );
      options?.onProgress?.(++totalFetched / totalExpected);

      // Invoices
      await this._fetchAndStoreEntity('invoices', userId, pendingIds.invoice, pageSize, encryptedDb.invoices as unknown as Table);
      options?.onProgress?.(++totalFetched / totalExpected);

      // Invoice line items (via parent invoice IDs already in IndexedDB)
      await this._fetchAndStoreLineItems(
        'invoice_line_items', 'invoice_id', db.invoices, pendingIds.invoice_line_item, pageSize, db.invoice_line_items
      );
      options?.onProgress?.(++totalFetched / totalExpected);

      // Clients
      await this._fetchAndStoreEntity('clients', userId, pendingIds.client, pageSize, encryptedDb.clients as unknown as Table);
      options?.onProgress?.(++totalFetched / totalExpected);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DataFetcher] Error fetching data:', errorMessage);
      throw error;
    }
  }

  /**
   * Fetch one entity type with pagination, skipping records with pending local
   * changes so we do not overwrite optimistic writes.
   */
  private async _fetchAndStoreEntity(
    tableName: string,
    userId: string,
    pendingIds: Set<string>,
    pageSize: number,
    localTable: Table
  ): Promise<number> {
    let totalStored = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      if (!Number.isFinite(offset) || offset < 0) {
        console.error('[DataFetcher] Invalid offset, aborting fetch:', offset);
        break;
      }
      if (!Number.isFinite(pageSize) || pageSize <= 0) {
        console.error('[DataFetcher] Invalid pageSize, aborting fetch:', pageSize);
        break;
      }

      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(`[DataFetcher] ${tableName} fetch error:`, error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      const validRecords = data.filter(
        (record: { id?: unknown }) =>
          record.id && typeof record.id === 'string' && !pendingIds.has(record.id)
      );

      const skipped = data.length - validRecords.length;
      if (skipped > 0) {
        console.warn(`[DataFetcher] Skipped ${skipped} ${tableName} (invalid IDs or pending sync)`);
      }

      if (validRecords.length > 0) {
        await localTable.bulkPut(validRecords);
        totalStored += validRecords.length;
      }

      offset += pageSize;
      if ((count !== null && offset >= count) || data.length < pageSize) {
        hasMore = false;
      }

      // Yield to event loop to prevent blocking UI
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    await db.setLastSyncTime(tableName);
    return totalStored;
  }

  /**
   * Fetch line items by parent FK instead of user_id.
   * Line item tables do not have a user_id column; they are owned through their
   * parent (quote or invoice).
   */
  private async _fetchAndStoreLineItems(
    tableName: string,
    parentFkField: string,
    parentLocalTable: Table,
    pendingIds: Set<string>,
    pageSize: number,
    localTable: Table
  ): Promise<number> {
    let totalStored = 0;

    try {
      const parentRecords = await parentLocalTable.toArray();
      const parentIds: string[] = parentRecords
        .map((r: { id?: unknown }) => r.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

      if (parentIds.length === 0) return 0;

      const parentIdBatchSize = 50;
      for (let i = 0; i < parentIds.length; i += parentIdBatchSize) {
        const parentIdBatch = parentIds.slice(i, i + parentIdBatchSize);
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          if (!Number.isFinite(offset) || offset < 0) break;

          const { data, error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact' })
            .in(parentFkField, parentIdBatch)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (error) {
            console.error(`[DataFetcher] ${tableName} fetch error:`, error);
            break;
          }

          if (!data || data.length === 0) {
            hasMore = false;
            break;
          }

          const validRecords = data.filter(
            (record: { id?: unknown }) =>
              record.id && typeof record.id === 'string' && !pendingIds.has(record.id)
          );

          if (validRecords.length > 0) {
            await localTable.bulkPut(validRecords);
            totalStored += validRecords.length;
          }

          offset += pageSize;
          if ((count !== null && offset >= count) || data.length < pageSize) {
            hasMore = false;
          }

          // Yield to event loop to prevent blocking UI
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
      }

      await db.setLastSyncTime(tableName);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DataFetcher] Error fetching ${tableName}:`, errorMessage);
    }

    return totalStored;
  }

  // ---------------------------------------------------------------------------
  // Pending sync ID resolution
  // ---------------------------------------------------------------------------

  /**
   * Return the set of entity IDs that have pending (unsynced) queue entries, so
   * fetchAndStore can skip overwriting them with stale server data.
   */
  async getPendingSyncIds(): Promise<{
    job: Set<string>;
    quote: Set<string>;
    invoice: Set<string>;
    client: Set<string>;
    quote_line_item: Set<string>;
    invoice_line_item: Set<string>;
  }> {
    const result: Record<string, Set<string>> = {
      job: new Set(),
      quote: new Set(),
      invoice: new Set(),
      client: new Set(),
      quote_line_item: new Set(),
      invoice_line_item: new Set(),
    };

    try {
      const allItems = await db.syncQueue.toArray();
      const pending = allItems.filter(item => !item.synced);

      for (const item of pending) {
        if (item.entity_id && typeof item.entity_id === 'string' && item.entity_type in result) {
          result[item.entity_type].add(item.entity_id);
        } else {
          console.warn('[DataFetcher] Skipping invalid sync queue item:', item);
        }
      }
    } catch (error) {
      console.error('[DataFetcher] Error getting pending sync IDs (returning empty):', error);
    }

    return result as {
      job: Set<string>;
      quote: Set<string>;
      invoice: Set<string>;
      client: Set<string>;
      quote_line_item: Set<string>;
      invoice_line_item: Set<string>;
    };
  }
}
