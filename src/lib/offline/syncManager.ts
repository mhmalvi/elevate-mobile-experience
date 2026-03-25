/**
 * SyncManager — thin facade that composes the sync subsystem modules.
 *
 * Public API (unchanged for consumers):
 *   queueSync()          — queue a local change for outbound sync
 *   processQueue()       — push all queued changes to Supabase
 *   fetchAndStore()      — pull latest data from Supabase into IndexedDB
 *   clearQueue()         — wipe the sync queue (e.g. on logout)
 *   getPendingSyncCount() — count of items awaiting sync
 *   getSyncQueue()       — read the raw queue
 *   onSyncComplete()     — subscribe to sync-complete notifications
 *   isSyncing()          — check whether a sync pass is in progress
 *
 * Internal responsibilities delegated to:
 *   entityConfig.ts     — table-name / local-table mappings
 *   syncTypes.ts        — shared types and sanitizeDataForIndexedDB
 *   syncEvents.ts       — window CustomEvent helpers + SyncListenerSet
 *   syncLock.ts         — cross-tab BroadcastChannel lock
 *   syncQueue.ts        — debounce / coalesce / queue CRUD
 *   syncDispatcher.ts   — Supabase writes, conflict resolution, rollback
 *   dataFetcher.ts      — paginated Supabase reads into IndexedDB
 */

import { type SyncQueueItem } from './db';
import { db } from './db';
import { type SyncRecord, type SyncProgress } from './syncTypes';
import { SyncLock } from './syncLock';
import { SyncQueue } from './syncQueue';
import { SyncDispatcher } from './syncDispatcher';
import { DataFetcher } from './dataFetcher';
import { SyncListenerSet, emitSyncProgress, notifyAuthError } from './syncEvents';

// ---------------------------------------------------------------------------
// Schema migration
// ---------------------------------------------------------------------------

/** Schema version for the sync subsystem's own metadata. */
const SCHEMA_VERSION = 2;

async function checkAndMigrateSchema(): Promise<void> {
  try {
    const currentVersion = await db.getMeta('schema_version');

    if (currentVersion === null) {
      await db.setMeta('schema_version', SCHEMA_VERSION);
      return;
    }

    if (currentVersion < SCHEMA_VERSION) {
      console.warn(
        `[SyncManager] Schema migration needed: v${currentVersion} → v${SCHEMA_VERSION}`
      );
      // Run each migration sequentially
      for (let v = currentVersion; v < SCHEMA_VERSION; v++) {
        if (v === 1) {
          // Migration to v2: ensure every sync-queue item has updated_at
          await db.transaction('rw', db.syncQueue, async () => {
            const items = await db.syncQueue.toArray();
            const updates = items
              .filter(item => !item.updated_at)
              .map(item => db.syncQueue.update(item.id!, { updated_at: item.created_at }));
            await Promise.all(updates);
          });
        }
      }
      await db.setMeta('schema_version', SCHEMA_VERSION);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SyncManager] Schema migration failed:', msg);
  }
}

// ---------------------------------------------------------------------------
// SyncManager
// ---------------------------------------------------------------------------

export class SyncManager {
  private syncInProgress = false;

  // Sub-modules
  private readonly lock: SyncLock;
  private readonly queue: SyncQueue;
  private readonly dispatcher: SyncDispatcher;
  private readonly fetcher: DataFetcher;
  private readonly listeners: SyncListenerSet;

  // Progress tracking
  private syncProgress: SyncProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    currentEntity: '',
    phase: 'idle',
  };

  // Schema migration promise
  private readonly schemaReady: Promise<void>;

  constructor() {
    this.listeners = new SyncListenerSet();

    this.lock = new SyncLock({
      onLockStolen: () => {
        this.syncInProgress = false;
      },
      onRemoteSyncComplete: () => {
        this.listeners.notify();
      },
    });

    this.queue = new SyncQueue();
    this.queue.onFlush = () => {
      if (navigator.onLine) {
        this.processQueue();
      }
    };

    this.dispatcher = new SyncDispatcher();
    this.fetcher = new DataFetcher();

    // Initialize schema migration and wire the promise into the data fetcher
    this.schemaReady = checkAndMigrateSchema();
    this.fetcher.schemaReady = this.schemaReady;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

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
    return this.queue.queueSync(entityType, entityId, action, data);
  }

  /**
   * Process sync queue: push all pending changes to Supabase.
   * Acquires a cross-tab lock first to prevent concurrent syncs.
   */
  async processQueue(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    await this.schemaReady;

    this.dispatcher.resetFailedParents();

    const hasLock = await this.lock.acquire();
    if (!hasLock) {
      this.syncInProgress = false;
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failCount = 0;

    try {
      await this.dispatcher.ensureValidToken();

      const allItems = await this.queue.getSyncQueueOrdered();

      // Exponential backoff: skip items whose backoff period hasn't elapsed
      const items = allItems.filter(item => {
        if (item.retry_count && item.retry_count > 0 && item.updated_at) {
          const backoffMs = Math.min(1000 * Math.pow(2, item.retry_count), 300_000);
          if (Date.now() - new Date(item.updated_at).getTime() < backoffMs) {
            return false;
          }
        }
        return true;
      });

      // Initialize progress
      this.syncProgress = {
        total: items.length,
        completed: 0,
        failed: 0,
        currentEntity: '',
        phase: 'syncing',
      };
      emitSyncProgress(this.syncProgress);

      // Process in batches
      const batches = this.queue.groupIntoBatches(items);

      for (const batch of batches) {
        this.syncProgress.currentEntity = `${batch[0].entity_type}s`;
        emitSyncProgress(this.syncProgress);

        const result = await this.dispatcher.processBatch(batch);
        successCount += result.success;
        failCount += result.failed;

        this.syncProgress.completed += result.success;
        this.syncProgress.failed += result.failed;
        emitSyncProgress(this.syncProgress);

        if (result.failedParents) {
          this.dispatcher.recordFailedParents(result.failedParents);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('token')) {
        console.error('[SyncManager] Auth token error during sync:', error.message);
        notifyAuthError();
      }
      throw error;
    } finally {
      this.syncInProgress = false;
      this.lock.release();
      this.syncProgress.phase = 'idle';
      emitSyncProgress(this.syncProgress);
      this.listeners.notify();
    }

    return { success: successCount, failed: failCount };
  }

  /**
   * Fetch data from Supabase and store in IndexedDB.
   * Used for initial data prefetch and periodic syncs.
   */
  async fetchAndStore(
    userId: string,
    options?: { pageSize?: number; onProgress?: (progress: number) => void }
  ): Promise<void> {
    return this.fetcher.fetchAndStore(userId, options);
  }

  /** Clear the sync queue (e.g. on logout). */
  async clearQueue(): Promise<void> {
    return this.queue.clearQueue();
  }

  /** Count of items awaiting sync. */
  async getPendingSyncCount(): Promise<number> {
    return this.queue.getPendingSyncCount();
  }

  /** Read the raw sync queue (unsynced items). */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.queue.getSyncQueue();
  }

  /** Subscribe to sync-complete notifications. Returns unsubscribe function. */
  onSyncComplete(callback: () => void): () => void {
    return this.listeners.add(callback);
  }

  /** Check if sync is in progress. */
  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

// ---------------------------------------------------------------------------
// Singleton + auto-reconnect
// ---------------------------------------------------------------------------

export const syncManager = new SyncManager();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncManager.processQueue();
  });
}
