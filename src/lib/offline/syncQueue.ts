/**
 * Sync queue management: debouncing, coalescing, flushing, and read access.
 *
 * queueSync() is the public entry point called by the rest of the app whenever
 * a local write should be propagated to Supabase.
 */

import { db, SyncQueueItem } from './db';
import { validateSyncQueueItem } from './syncQueueValidator';
import { getLocalTable, ENTITY_DEPENDENCY_ORDER } from './entityConfig';
import { sanitizeDataForIndexedDB, type SyncRecord } from './syncTypes';
import { notifyQuotaExceeded, notifyQueueCorruption } from './syncEvents';

/**
 * Manages the local sync queue: debouncing, coalescing writes, flushing
 * pending updates, and reading queue state.
 */
export class SyncQueue {
  private queueDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly queueDebounceDelay = 1000; // ms
  private pendingQueueUpdates = new Map<string, SyncQueueItem>();

  // Corruption-tracking state
  private lastQueueClearTime = 0;
  private queueErrorCount = 0;
  private queueClearInProgress = false;

  /**
   * Callback invoked after the debounce fires so the dispatcher can start
   * processing. Wired by SyncManager after construction.
   */
  onFlush: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // queueSync
  // ---------------------------------------------------------------------------

  /**
   * Add item to sync queue with optimistic UI update.
   * Debounced and coalesced: rapid updates to the same entity are merged.
   */
  async queueSync(
    entityType: 'job' | 'quote' | 'invoice' | 'client' | 'quote_line_item' | 'invoice_line_item',
    entityId: string,
    action: 'create' | 'update' | 'delete',
    data: SyncRecord
  ): Promise<void> {
    const validation = validateSyncQueueItem({
      entity_type: entityType,
      entity_id: entityId,
      action,
      data,
    });

    if (!validation.valid) {
      console.warn('[SyncQueue] Invalid queue item, skipping:', validation.errors);
      return;
    }

    try {
      const sanitizedData = sanitizeDataForIndexedDB(data);
      const localTable = getLocalTable(entityType);

      if (!localTable) {
        console.error('[SyncQueue] Invalid entity type:', entityType);
        return;
      }

      const pendingKey = `${entityType}:${entityId}`;
      const existingPending = this.pendingQueueUpdates.get(pendingKey);

      // Coalesce: merge rapid same-action updates before they reach the DB
      if (existingPending && existingPending.action === action) {
        this.pendingQueueUpdates.set(pendingKey, {
          entity_type: entityType,
          entity_id: String(entityId),
          action,
          data: sanitizedData,
          created_at: existingPending.created_at,
          synced: false,
          retry_count: 0,
        });
        await this._applyOptimisticUpdate(localTable, action, entityId, sanitizedData);
        this.debouncedFlushQueue();
        return;
      }

      // First write for this entity -- persist to queue atomically
      await db.transaction('rw', [db.syncQueue, localTable as object], async () => {
        const queueItem: SyncQueueItem = {
          entity_type: entityType,
          entity_id: String(entityId),
          action,
          data: sanitizedData,
          created_at: new Date().toISOString(),
          synced: false,
          retry_count: 0,
        };
        await db.syncQueue.add(queueItem);
        await this._applyOptimisticUpdate(localTable, action, entityId, sanitizedData);
      });

      this.pendingQueueUpdates.set(pendingKey, {
        entity_type: entityType,
        entity_id: String(entityId),
        action,
        data: sanitizedData,
        created_at: new Date().toISOString(),
        synced: false,
        retry_count: 0,
      });

      this.debouncedFlushQueue();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('[SyncQueue] IndexedDB quota exceeded!');
        notifyQuotaExceeded();
        throw new Error('Storage quota exceeded. Please free up space or clear old data.');
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncQueue] Error adding to sync queue:', errorMessage);
    }
  }

  // ---------------------------------------------------------------------------
  // Debounce / flush
  // ---------------------------------------------------------------------------

  private debouncedFlushQueue(): void {
    if (this.queueDebounceTimer) clearTimeout(this.queueDebounceTimer);
    this.queueDebounceTimer = setTimeout(() => {
      if (navigator.onLine) {
        this.flushPendingUpdates();
        this.onFlush?.();
      }
    }, this.queueDebounceDelay);
  }

  async flushPendingUpdates(): Promise<void> {
    if (this.pendingQueueUpdates.size === 0) return;

    for (const [, item] of this.pendingQueueUpdates.entries()) {
      try {
        const existing = await db.syncQueue
          .where('entity_id')
          .equals(item.entity_id)
          .and(q => q.entity_type === item.entity_type && !q.synced)
          .first();

        if (existing) {
          await db.syncQueue.update(existing.id!, {
            data: item.data,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[SyncQueue] Error flushing pending update:', errorMessage);
      }
    }

    this.pendingQueueUpdates.clear();
  }

  // ---------------------------------------------------------------------------
  // Queue read helpers
  // ---------------------------------------------------------------------------

  /**
   * Return all unsynced items sorted by entity dependency order then creation time.
   * NOTE: 'synced' is intentionally NOT indexed in the Dexie schema (boolean
   * indexing causes IDBKeyRange errors). The queue is small enough for in-memory
   * filtering.
   */
  async getSyncQueueOrdered(): Promise<SyncQueueItem[]> {
    const allItems = await db.syncQueue.toArray();
    const items = allItems.filter(item => !item.synced);

    return items.sort((a, b) => {
      const aOrder = ENTITY_DEPENDENCY_ORDER.indexOf(a.entity_type);
      const bOrder = ENTITY_DEPENDENCY_ORDER.indexOf(b.entity_type);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  /**
   * Group a flat list of items into batches of 10, keyed by entity_type:action.
   */
  groupIntoBatches(items: SyncQueueItem[]): SyncQueueItem[][] {
    const batchSize = 10;
    const groups = new Map<string, SyncQueueItem[]>();

    for (const item of items) {
      const key = `${item.entity_type}:${item.action}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const batches: SyncQueueItem[][] = [];
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i += batchSize) {
        batches.push(group.slice(i, i + batchSize));
      }
    }
    return batches;
  }

  /** Clear the entire sync queue (e.g. on logout). */
  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
  }

  /** Count unsynced items, handling queue corruption gracefully. */
  async getPendingSyncCount(): Promise<number> {
    try {
      const allItems = await db.syncQueue.toArray();
      return allItems.filter(item => !item.synced).length;
    } catch (error: unknown) {
      return this._handleQueueReadError(error);
    }
  }

  /** Read unsynced items, handling queue corruption gracefully. */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const allItems = await db.syncQueue.toArray();
      return allItems.filter(item => !item.synced);
    } catch (error: unknown) {
      console.error('[SyncQueue] Error reading sync queue');
      notifyQueueCorruption(this.queueErrorCount);
      try {
        await db.syncQueue.clear();
      } catch (clearError: unknown) {
        const msg = clearError instanceof Error ? clearError.message : 'Unknown error';
        console.error('[SyncQueue] Failed to clear corrupt queue:', msg);
      }
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _applyOptimisticUpdate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    localTable: any,
    action: string,
    entityId: string,
    sanitizedData: ReturnType<typeof sanitizeDataForIndexedDB>
  ): Promise<void> {
    if (action === 'create' || action === 'update') {
      await localTable.put(sanitizedData);
    } else if (action === 'delete') {
      const existing = await localTable.get(entityId);
      if (existing) {
        await localTable.put({ ...existing, deleted_at: new Date().toISOString() });
      }
    }
  }

  private async _handleQueueReadError(error: unknown): Promise<number> {
    if (this.queueClearInProgress) return 0;

    this.queueClearInProgress = true;
    this.queueErrorCount++;
    const now = Date.now();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[SyncQueue] Sync queue corrupted (attempt ${this.queueErrorCount}):`,
      errorMessage
    );
    notifyQueueCorruption(this.queueErrorCount);

    if (now - this.lastQueueClearTime > 30000) {
      console.warn('[SyncQueue] Clearing corrupted queue after user notification');
      this.lastQueueClearTime = now;
      try {
        await db.syncQueue.clear();
        this.queueErrorCount = 0;
      } catch (clearError: unknown) {
        const msg = clearError instanceof Error ? clearError.message : 'Unknown error';
        console.error('[SyncQueue] Failed to clear corrupt queue:', msg);
      }
    }

    this.queueClearInProgress = false;
    return 0;
  }
}
