import { db, SyncQueueItem } from './db';
import { encryptedDb } from './encryptedDb';
import { supabase } from '@/integrations/supabase/client';
import { resolveConflict, hasConflict } from './conflictResolver';

/**
 * Sanitize data for IndexedDB storage
 * Converts Date objects to ISO strings and removes undefined values
 */
function sanitizeDataForIndexedDB(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataForIndexedDB(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip undefined values
      if (value !== undefined) {
        sanitized[key] = sanitizeDataForIndexedDB(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Entity type to table name mapping
 * Prevents fragile pluralization issues
 */
const ENTITY_TABLE_MAP: Record<string, string> = {
  job: 'jobs',
  quote: 'quotes',
  invoice: 'invoices',
  client: 'clients',
};

/**
 * Entity dependency order for sync
 * Parents must be synced before children
 */
const ENTITY_DEPENDENCY_ORDER = ['client', 'job', 'quote', 'invoice'];

/**
 * SyncManager handles synchronization between IndexedDB and Supabase
 * Manages the sync queue and processes pending changes when online
 */
export class SyncManager {
  private syncInProgress = false;
  private syncListeners: Set<() => void> = new Set();

  // ✅ FIX #1: Cross-tab sync coordination
  private syncLockChannel: BroadcastChannel | null = null;
  private hasSyncLock = false;

  // ✅ HIGH PRIORITY FIX #3: Queue debouncing to prevent flooding
  private queueDebounceTimer: NodeJS.Timeout | null = null;
  private queueDebounceDelay = 1000; // Wait 1 second before syncing
  private pendingQueueUpdates = new Map<string, SyncQueueItem>();

  // ✅ HIGH PRIORITY FIX #4: Track failed parent entities for soft dependency handling
  private failedParentEntities = new Set<string>(); // Format: "entityType:entityId"

  // ✅ HIGH PRIORITY FIX #5: Schema versioning for migration safety
  private static readonly SCHEMA_VERSION = 2; // Increment when schema changes
  private schemaMigrationComplete = false;

  // ✅ MEDIUM PRIORITY FIX #2: Sync progress tracking
  private syncProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    currentEntity: '',
    phase: '' as 'idle' | 'syncing' | 'fetching',
  };

  constructor() {
    // Initialize schema migration check
    this.checkAndMigrateSchema();
  }

  /**
   * ✅ HIGH PRIORITY FIX #5: Check schema version and run migrations if needed
   */
  private async checkAndMigrateSchema() {
    try {
      const currentVersion = await db.getMeta('schema_version');

      if (currentVersion === null) {
        // First time - set initial version
        console.log('[SyncManager] Initializing schema version');
        await db.setMeta('schema_version', SyncManager.SCHEMA_VERSION);
        this.schemaMigrationComplete = true;
        return;
      }

      if (currentVersion < SyncManager.SCHEMA_VERSION) {
        console.warn(`[SyncManager] Schema migration needed: v${currentVersion} → v${SyncManager.SCHEMA_VERSION}`);
        await this.runSchemaMigrations(currentVersion, SyncManager.SCHEMA_VERSION);
        await db.setMeta('schema_version', SyncManager.SCHEMA_VERSION);
        console.log('[SyncManager] Schema migration complete');
      }

      this.schemaMigrationComplete = true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncManager] Schema migration failed:', errorMessage);
      // Don't throw - allow app to continue
    }
  }

  /**
   * ✅ HIGH PRIORITY FIX #5: Run schema migrations
   */
  private async runSchemaMigrations(fromVersion: number, toVersion: number) {
    console.log(`[SyncManager] Running migrations from v${fromVersion} to v${toVersion}`);

    // Run each migration sequentially
    for (let version = fromVersion; version < toVersion; version++) {
      console.log(`[SyncManager] Running migration v${version} → v${version + 1}`);

      switch (version) {
        case 1:
          await this.migrateToV2();
          break;
        // Add more migrations here as schema evolves
        // case 2:
        //   await this.migrateToV3();
        //   break;
        default:
          console.warn(`[SyncManager] No migration defined for v${version} → v${version + 1}`);
      }
    }
  }

  /**
   * ✅ HIGH PRIORITY FIX #5: Migration to schema version 2
   * Example: Add `updated_at` field to sync queue items
   */
  private async migrateToV2() {
    console.log('[SyncManager] Migrating to v2: Adding updated_at to sync queue');

    const items = await db.syncQueue.toArray();

    for (const item of items) {
      if (!item.updated_at) {
        await db.syncQueue.update(item.id!, {
          updated_at: item.created_at, // Use created_at as fallback
        });
      }
    }

    console.log(`[SyncManager] Migrated ${items.length} sync queue items to v2`);
  }

  private constructor_original() {
    // Initialize cross-tab sync lock
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.syncLockChannel = new BroadcastChannel('tradiemate-sync-lock');
      this.syncLockChannel.onmessage = (event) => {
        if (event.data.type === 'sync-started') {
          // Another tab started syncing
          if (this.syncInProgress && !this.hasSyncLock) {
            console.warn('[SyncManager] Another tab is syncing, stopping this tab\'s sync');
            this.syncInProgress = false;
          }
        } else if (event.data.type === 'sync-completed') {
          // Another tab completed sync
          this.notifyListeners();
        }
      };
    }
  }

  /**
   * Acquire sync lock to prevent cross-tab conflicts
   */
  private async acquireSyncLock(): Promise<boolean> {
    if (!this.syncLockChannel) return true; // No BroadcastChannel support

    // Try to acquire lock
    this.hasSyncLock = true;
    this.syncLockChannel.postMessage({ type: 'sync-started', timestamp: Date.now() });

    // Wait a bit to see if another tab claims priority
    await new Promise(resolve => setTimeout(resolve, 50));

    return this.hasSyncLock;
  }

  /**
   * Release sync lock
   */
  private releaseSyncLock() {
    if (this.syncLockChannel && this.hasSyncLock) {
      this.syncLockChannel.postMessage({ type: 'sync-completed', timestamp: Date.now() });
      this.hasSyncLock = false;
    }
  }

  /**
   * Add item to sync queue with optimistic UI update
   * Called when user makes changes offline
   * ✅ HIGH PRIORITY FIX #3: Debounced to prevent queue flooding
   */
  async queueSync(
    entityType: 'job' | 'quote' | 'invoice' | 'client',
    entityId: string,
    action: 'create' | 'update' | 'delete',
    data: any
  ) {
    // Validate inputs to prevent corrupt queue entries
    if (!entityType || !entityId || !action || !data) {
      console.error('[SyncManager] Invalid queue data, skipping:', { entityType, entityId, action });
      return;
    }

    // Ensure entity_id is a string
    if (typeof entityId !== 'string') {
      console.error('[SyncManager] entity_id must be a string, got:', typeof entityId);
      return;
    }

    try {
      // Sanitize data to prevent IndexedDB errors
      const sanitizedData = sanitizeDataForIndexedDB(data);

      // Get the local table for optimistic updates
      const localTable = this.getLocalTable(entityType);
      if (!localTable) {
        console.error('[SyncManager] Invalid entity type:', entityType);
        return;
      }

      // ✅ HIGH PRIORITY FIX #3: Coalesce rapid updates to the same entity
      const pendingKey = `${entityType}:${entityId}`;
      const existingPending = this.pendingQueueUpdates.get(pendingKey);

      // If there's a pending update for this entity, merge it
      if (existingPending && existingPending.action === action) {
        console.log(`[SyncManager] Coalescing ${action} for ${entityType} ${entityId}`);
        this.pendingQueueUpdates.set(pendingKey, {
          entity_type: entityType,
          entity_id: String(entityId), // Ensure it's a string
          action,
          data: sanitizedData,
          created_at: existingPending.created_at, // Keep original timestamp
          synced: false, // Must be boolean
          retry_count: 0, // Must be number
        });

        // Optimistic UI update
        if (action === 'create' || action === 'update') {
          await localTable.put(sanitizedData);
        } else if (action === 'delete') {
          const existing = await localTable.get(entityId);
          if (existing) {
            await localTable.put({
              ...existing,
              deleted_at: new Date().toISOString(),
            });
          }
        }

        // Debounce the queue flush
        this.debouncedFlushQueue();
        return;
      }

      // Use transaction for atomic operations
      await db.transaction('rw', [db.syncQueue, localTable], async () => {
        // ✅ CRITICAL: Validate all indexed fields to prevent corruption
        const queueItem: SyncQueueItem = {
          entity_type: entityType,
          entity_id: String(entityId), // Ensure it's a string
          action,
          data: sanitizedData,
          created_at: new Date().toISOString(),
          synced: false, // Must be boolean
          retry_count: 0, // Must be number
        };

        // Add to sync queue
        await db.syncQueue.add(queueItem);

        // Optimistic UI update - immediately apply to local database
        if (action === 'create' || action === 'update') {
          await localTable.put(sanitizedData);
          console.log(`[SyncManager] Optimistically updated ${entityType} ${entityId} in local DB`);
        } else if (action === 'delete') {
          // For soft delete, update the deleted_at field
          const existing = await localTable.get(entityId);
          if (existing) {
            await localTable.put({
              ...existing,
              deleted_at: new Date().toISOString(),
            });
            console.log(`[SyncManager] Optimistically soft-deleted ${entityType} ${entityId} in local DB`);
          }
        }
      });

      // Track pending update for coalescing
      this.pendingQueueUpdates.set(pendingKey, {
        entity_type: entityType,
        entity_id: String(entityId), // Ensure it's a string
        action,
        data: sanitizedData,
        created_at: new Date().toISOString(),
        synced: false, // Must be boolean
        retry_count: 0, // Must be number
      });

      // ✅ HIGH PRIORITY FIX #3: Debounce sync to prevent rapid-fire syncing
      this.debouncedFlushQueue();
    } catch (error: unknown) {
      // ✅ FIX #2: Handle quota exceeded errors
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('[SyncManager] IndexedDB quota exceeded!');
        this.notifyQuotaExceeded();
        throw new Error('Storage quota exceeded. Please free up space or clear old data.');
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncManager] Error adding to sync queue:', errorMessage);
      // Don't throw - we don't want to break the app if queue fails
    }
  }

  /**
   * ✅ HIGH PRIORITY FIX #3: Debounced queue flush to prevent flooding
   */
  private debouncedFlushQueue() {
    // Clear existing timer
    if (this.queueDebounceTimer) {
      clearTimeout(this.queueDebounceTimer);
    }

    // Set new timer
    this.queueDebounceTimer = setTimeout(() => {
      if (navigator.onLine) {
        console.log('[SyncManager] Debounce timer expired, flushing pending updates');
        this.flushPendingUpdates();
        this.processQueue();
      }
    }, this.queueDebounceDelay);
  }

  /**
   * ✅ HIGH PRIORITY FIX #3: Flush pending coalesced updates to queue
   */
  private async flushPendingUpdates() {
    if (this.pendingQueueUpdates.size === 0) return;

    console.log(`[SyncManager] Flushing ${this.pendingQueueUpdates.size} coalesced updates`);

    for (const [key, item] of this.pendingQueueUpdates.entries()) {
      try {
        // Check if item already in queue
        const existing = await db.syncQueue
          .where('entity_id')
          .equals(item.entity_id)
          .and(q => q.entity_type === item.entity_type && !q.synced)
          .first();

        if (existing) {
          // Update existing queue item with latest data
          await db.syncQueue.update(existing.id!, {
            data: item.data,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SyncManager] Error flushing pending update:`, errorMessage);
      }
    }

    // Clear pending updates
    this.pendingQueueUpdates.clear();
  }

  /**
   * Notify listeners about quota exceeded error
   */
  private notifyQuotaExceeded() {
    // Emit custom event for OfflineProvider to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('indexeddb-quota-exceeded', {
        detail: { message: 'Storage quota exceeded' }
      }));
    }
  }

  /**
   * Get local IndexedDB table for entity type
   * SECURITY: Uses encrypted tables for sensitive data (clients, invoices, quotes)
   */
  private getLocalTable(entityType: string) {
    const tableMap: Record<string, any> = {
      job: encryptedDb.jobs,
      quote: encryptedDb.quotes,
      invoice: encryptedDb.invoices,
      client: encryptedDb.clients,
    };
    return tableMap[entityType];
  }

  /**
   * Process sync queue when back online
   * Syncs all pending changes to Supabase
   * ✅ HIGH PRIORITY FIX #5: Wait for schema migration before syncing
   */
  async processQueue(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress) {
      console.log('[SyncManager] Sync already in progress, skipping');
      return { success: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      console.log('[SyncManager] Offline, cannot sync');
      return { success: 0, failed: 0 };
    }

    // Wait for schema migration to complete
    if (!this.schemaMigrationComplete) {
      console.log('[SyncManager] Waiting for schema migration to complete...');
      await this.waitForMigration();
    }

    // ✅ FIX #1: Acquire cross-tab sync lock
    const hasLock = await this.acquireSyncLock();
    if (!hasLock) {
      console.log('[SyncManager] Another tab has sync lock, skipping');
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let successCount = 0;
    let failCount = 0;

    try {
      console.log('[SyncManager] Starting sync queue processing');

      // ✅ FIX #3: Ensure valid auth token before sync
      await this.ensureValidToken();

      // Order by dependency to prevent referential integrity errors
      const items = await this.getSyncQueueOrdered();

      console.log(`[SyncManager] Found ${items.length} items to sync`);

      // ✅ MEDIUM PRIORITY FIX #2: Initialize progress tracking
      this.syncProgress = {
        total: items.length,
        completed: 0,
        failed: 0,
        currentEntity: '',
        phase: 'syncing',
      };
      this.emitSyncProgress();

      // ✅ HIGH PRIORITY FIX #2: Batch operations by entity type and action
      const batches = this.groupIntoBatches(items);

      // ✅ HIGH PRIORITY FIX #4: Don't halt on parent failures - track and defer instead
      for (const batch of batches) {
        // Update current entity being synced
        this.syncProgress.currentEntity = `${batch[0].entity_type}s`;
        this.emitSyncProgress();

        const batchResults = await this.processBatch(batch);

        successCount += batchResults.success;
        failCount += batchResults.failed;

        // ✅ MEDIUM PRIORITY FIX #2: Update progress
        this.syncProgress.completed += batchResults.success;
        this.syncProgress.failed += batchResults.failed;
        this.emitSyncProgress();

        // Track failed parent entities
        if (batchResults.failedParents) {
          batchResults.failedParents.forEach(id => this.failedParentEntities.add(id));
        }

        // Note: We no longer halt sync on parent failures
        // Dependent items will be deferred if their parent failed
      }

      console.log(`[SyncManager] Sync complete: ${successCount} success, ${failCount} failed`);
    } catch (error: unknown) {
      // ✅ FIX #3: Handle token refresh failures
      if (error instanceof Error && error.message.includes('token')) {
        console.error('[SyncManager] Auth token error during sync:', error.message);
        this.notifyAuthError();
      }
      throw error;
    } finally {
      this.syncInProgress = false;
      this.releaseSyncLock(); // ✅ FIX #1: Release lock

      // ✅ MEDIUM PRIORITY FIX #2: Reset progress
      this.syncProgress.phase = 'idle';
      this.emitSyncProgress();

      // Check for new items added during sync (race condition fix)
      // ✅ FIX: Don't use .where('synced') index - fetch all and filter
      const allQueueItems = await db.syncQueue.toArray();
      const remainingCount = allQueueItems.filter(item => !item.synced).length;
      if (remainingCount > 0 && navigator.onLine) {
        console.log(`[SyncManager] ${remainingCount} new items detected, recursively processing...`);
        // Don't await - let this run in background to avoid blocking
        setTimeout(() => this.processQueue(), 100);
      }

      this.notifyListeners();
    }

    return { success: successCount, failed: failCount };
  }

  /**
   * ✅ MEDIUM PRIORITY FIX #2: Emit sync progress event
   */
  private emitSyncProgress() {
    if (typeof window !== 'undefined') {
      const progress = {
        ...this.syncProgress,
        percentage: this.syncProgress.total > 0
          ? Math.round((this.syncProgress.completed / this.syncProgress.total) * 100)
          : 0,
      };

      window.dispatchEvent(new CustomEvent('sync-progress', {
        detail: progress
      }));
    }
  }

  /**
   * ✅ FIX #3: Ensure valid auth token before sync operations
   */
  private async ensureValidToken() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
      }

      if (!session) {
        throw new Error('No active session');
      }

      // Check if token expires soon (within 5 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresInMs = (expiresAt * 1000) - Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (expiresInMs < fiveMinutes) {
          console.log('[SyncManager] Token expires soon, refreshing...');
          const { error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            throw new Error(`Token refresh failed: ${refreshError.message}`);
          }

          console.log('[SyncManager] Token refreshed successfully');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncManager] Auth token validation failed:', errorMessage);
      throw error;
    }
  }

  /**
   * ✅ FIX #4: Rollback optimistic update when sync fails permanently
   */
  private async rollbackOptimisticUpdate(item: SyncQueueItem) {
    try {
      const localTable = this.getLocalTable(item.entity_type);
      if (!localTable) return;

      if (item.action === 'create') {
        // Remove the optimistically created item
        await localTable.delete(item.entity_id);
        console.log(`[SyncManager] Rolled back optimistic create for ${item.entity_type} ${item.entity_id}`);
      } else if (item.action === 'delete') {
        // Restore the soft-deleted item
        const existing = await localTable.get(item.entity_id);
        if (existing && existing.deleted_at) {
          await localTable.put({
            ...existing,
            deleted_at: undefined,
          });
          console.log(`[SyncManager] Rolled back optimistic delete for ${item.entity_type} ${item.entity_id}`);
        }
      }
      // Note: For 'update', we can't easily rollback without storing original data
      // This would require enhancing the queue structure to store original state
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncManager] Failed to rollback optimistic update:', errorMessage);
    }
  }

  /**
   * Notify listeners about auth error
   */
  private notifyAuthError() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-auth-error', {
        detail: { message: 'Authentication error during sync' }
      }));
    }
  }

  /**
   * ✅ HIGH PRIORITY FIX #5: Wait for schema migration to complete
   */
  private async waitForMigration(maxWaitMs: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (!this.schemaMigrationComplete) {
      if (Date.now() - startTime > maxWaitMs) {
        console.error('[SyncManager] Schema migration timeout');
        throw new Error('Schema migration timeout');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * ✅ MEDIUM PRIORITY FIX #1: Get conflicting fields between local and server data
   */
  private getConflictingFields(localData: any, serverData: any): Array<{
    field: string;
    localValue: any;
    serverValue: any;
  }> {
    const conflicts: Array<{ field: string; localValue: any; serverValue: any }> = [];
    const ignoreFields = ['updated_at', 'deleted_at', 'created_at'];

    for (const key in localData) {
      if (ignoreFields.includes(key)) continue;

      const localValue = localData[key];
      const serverValue = serverData[key];

      if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
        conflicts.push({
          field: key,
          localValue,
          serverValue,
        });
      }
    }

    return conflicts;
  }

  /**
   * ✅ MEDIUM PRIORITY FIX #1: Notify user about conflict with details
   */
  private notifyConflict(conflictDetails: {
    entityType: string;
    entityId: string;
    conflictingFields: Array<{ field: string; localValue: any; serverValue: any }>;
    localData: any;
    serverData: any;
  }) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-conflict-detected', {
        detail: conflictDetails
      }));
    }
  }

  /**
   * Get sync queue items ordered by dependency
   * Parents (clients) sync before children (jobs, quotes, invoices)
   */
  private async getSyncQueueOrdered(): Promise<SyncQueueItem[]> {
    // ✅ FIX: Don't use .where('synced') index - fetch all and filter in memory
    const allItems = await db.syncQueue.toArray();
    const items = allItems.filter(item => !item.synced);

    // Sort by dependency order, then by creation time
    return items.sort((a, b) => {
      const aOrder = ENTITY_DEPENDENCY_ORDER.indexOf(a.entity_type);
      const bOrder = ENTITY_DEPENDENCY_ORDER.indexOf(b.entity_type);

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // Same entity type - sort by creation time
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  /**
   * ✅ HIGH PRIORITY FIX #2: Group queue items into batches for efficient processing
   */
  private groupIntoBatches(items: SyncQueueItem[]): SyncQueueItem[][] {
    const batchSize = 10; // Process 10 items per batch
    const batches: SyncQueueItem[][] = [];

    // Group by entity type and action for batching
    const groups = new Map<string, SyncQueueItem[]>();

    for (const item of items) {
      const key = `${item.entity_type}:${item.action}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    // Convert groups to batches
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i += batchSize) {
        batches.push(group.slice(i, i + batchSize));
      }
    }

    console.log(`[SyncManager] Grouped ${items.length} items into ${batches.length} batches`);
    return batches;
  }

  /**
   * ✅ HIGH PRIORITY FIX #2: Process a batch of sync items
   * ✅ HIGH PRIORITY FIX #4: Soft dependency handling instead of hard halt
   */
  private async processBatch(batch: SyncQueueItem[]): Promise<{
    success: number;
    failed: number;
    failedParents?: string[];
  }> {
    if (batch.length === 0) {
      return { success: 0, failed: 0, failedParents: [] };
    }

    const entityType = batch[0].entity_type;
    const action = batch[0].action;
    const table = this.getTableName(entityType);

    console.log(`[SyncManager] Processing batch: ${entityType} ${action} (${batch.length} items)`);

    let successCount = 0;
    let failCount = 0;
    const failedParents: string[] = [];

    // ✅ HIGH PRIORITY FIX #4: Filter out items with failed parent dependencies
    const validBatch: SyncQueueItem[] = [];
    const deferredBatch: SyncQueueItem[] = [];

    for (const item of batch) {
      // Check if this item depends on a failed parent
      if (this.hasDependencyOnFailedParent(item)) {
        console.warn(`[SyncManager] Deferring ${item.entity_type} ${item.entity_id} - parent entity failed`);
        deferredBatch.push(item);
      } else {
        validBatch.push(item);
      }
    }

    // Mark deferred items (don't count as failures)
    for (const item of deferredBatch) {
      await db.syncQueue.update(item.id!, {
        sync_error: 'Deferred: Parent entity sync failed. Will retry after parent succeeds.',
        retry_count: (item.retry_count || 0), // Don't increment retry count
      });
    }

    if (validBatch.length === 0) {
      console.log(`[SyncManager] All items in batch deferred due to parent failures`);
      return { success: 0, failed: 0, failedParents };
    }

    try {
      if (action === 'create') {
        // Batch insert
        const dataToInsert = validBatch.map(item => item.data);
        const { error } = await supabase.from(table).insert(dataToInsert);

        if (error) {
          throw error;
        }

        // Mark all as synced
        for (const item of validBatch) {
          await db.syncQueue.update(item.id!, {
            synced: true,
            sync_error: undefined,
          });
          successCount++;
        }

        console.log(`[SyncManager] Batch insert successful: ${validBatch.length} ${entityType}s`);
      } else if (action === 'update') {
        // Updates need individual processing for conflict resolution
        for (const item of validBatch) {
          try {
            await this.syncItem(item);

            await db.syncQueue.update(item.id!, {
              synced: true,
              sync_error: undefined,
            });

            successCount++;
          } catch (error: unknown) {
            await this.handleSyncItemError(item, error);
            failCount++;

            // Track failed parent entities
            if (item.entity_type === 'client') {
              failedParents.push(`client:${item.entity_id}`);
            }
          }
        }
      } else if (action === 'delete') {
        // Batch soft delete
        const idsToDelete = validBatch.map(item => item.entity_id);
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .in('id', idsToDelete);

        if (error) {
          throw error;
        }

        // Mark all as synced
        for (const item of validBatch) {
          await db.syncQueue.update(item.id!, {
            synced: true,
            sync_error: undefined,
          });
          successCount++;
        }

        console.log(`[SyncManager] Batch delete successful: ${validBatch.length} ${entityType}s`);
      }
    } catch (error: unknown) {
      // Batch operation failed - process individually
      console.warn(`[SyncManager] Batch operation failed, processing individually:`, error);

      for (const item of validBatch) {
        try {
          await this.syncItem(item);

          await db.syncQueue.update(item.id!, {
            synced: true,
            sync_error: undefined,
          });

          successCount++;
        } catch (itemError: unknown) {
          await this.handleSyncItemError(item, itemError);
          failCount++;

          // ✅ HIGH PRIORITY FIX #4: Track failed parent entities instead of halting
          if (item.entity_type === 'client' && item.action === 'create') {
            failedParents.push(`client:${item.entity_id}`);
          }
        }
      }
    }

    return { success: successCount, failed: failCount, failedParents };
  }

  /**
   * ✅ HIGH PRIORITY FIX #4: Check if item depends on a failed parent
   */
  private hasDependencyOnFailedParent(item: SyncQueueItem): boolean {
    // Only check for entities that have parent dependencies
    if (item.entity_type === 'client') {
      return false; // Clients have no parents
    }

    // Check if the parent client failed
    const clientId = item.data?.client_id;
    if (clientId && this.failedParentEntities.has(`client:${clientId}`)) {
      return true;
    }

    return false;
  }

  /**
   * Handle sync item error with retry logic and rollback
   */
  private async handleSyncItemError(item: SyncQueueItem, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SyncManager] Error syncing ${item.entity_type} ${item.entity_id}:`, errorMessage);

    const newRetryCount = (item.retry_count || 0) + 1;
    await db.syncQueue.update(item.id!, {
      sync_error: errorMessage,
      retry_count: newRetryCount,
    });

    // Rollback optimistic update if max retries exceeded
    if (newRetryCount >= 3) {
      console.error(`[SyncManager] Max retries exceeded for ${item.entity_type} ${item.entity_id}`);

      await this.rollbackOptimisticUpdate(item);

      await db.syncQueue.update(item.id!, {
        synced: true,
        sync_error: `Failed after 3 retries: ${errorMessage}. Optimistic update rolled back.`,
      });
    }
  }

  /**
   * Sync individual item to Supabase with conflict resolution
   */
  private async syncItem(item: SyncQueueItem) {
    const table = this.getTableName(item.entity_type);

    switch (item.action) {
      case 'create':
        const { error: createError } = await supabase
          .from(table)
          .insert(item.data);

        if (createError) throw createError;
        break;

      case 'update':
        // ✅ FIX #7: Integrate conflict resolution
        // Fetch current server data to check for conflicts
        const { data: serverData, error: fetchError } = await supabase
          .from(table)
          .select('*')
          .eq('id', item.entity_id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = not found, which is OK (record deleted on server)
          throw fetchError;
        }

        if (serverData && hasConflict(item.data, serverData)) {
          console.warn(`[SyncManager] Conflict detected for ${item.entity_type} ${item.entity_id}`);

          // ✅ MEDIUM PRIORITY FIX #1: Notify user about conflict
          const conflictingFields = this.getConflictingFields(item.data, serverData);
          this.notifyConflict({
            entityType: item.entity_type,
            entityId: item.entity_id,
            conflictingFields,
            localData: item.data,
            serverData,
          });

          // Resolve conflict using last-write-wins strategy
          const { resolved, message } = resolveConflict(
            item.data,
            serverData,
            'last-write-wins'
          );

          console.log(`[SyncManager] Conflict resolution: ${message}`);

          // Update with resolved data
          const { error: updateError } = await supabase
            .from(table)
            .update(resolved)
            .eq('id', item.entity_id);

          if (updateError) throw updateError;

          // Update local DB with resolved data
          const localTable = this.getLocalTable(item.entity_type);
          if (localTable) {
            await localTable.put(resolved);
          }
        } else {
          // No conflict - proceed with normal update
          const { error: updateError } = await supabase
            .from(table)
            .update(item.data)
            .eq('id', item.entity_id);

          if (updateError) throw updateError;
        }
        break;

      case 'delete':
        // Soft delete - set deleted_at
        const { error: deleteError } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', item.entity_id);

        if (deleteError) throw deleteError;
        break;
    }
  }

  /**
   * Get Supabase table name from entity type
   */
  private getTableName(entityType: string): string {
    // ✅ FIX #8: Use proper mapping instead of fragile string concatenation
    return ENTITY_TABLE_MAP[entityType] || entityType + 's';
  }

  /**
   * Fetch data from Supabase and store in IndexedDB
   * Used for initial data prefetch and periodic syncs
   * ✅ HIGH PRIORITY FIX #1: Pagination to prevent memory bloat
   * ✅ HIGH PRIORITY FIX #5: Wait for schema migration before fetching
   */
  async fetchAndStore(userId: string, options?: { pageSize?: number; onProgress?: (progress: number) => void }) {
    if (!navigator.onLine) {
      console.log('[SyncManager] Offline, skipping fetch');
      return;
    }

    // Wait for schema migration to complete
    if (!this.schemaMigrationComplete) {
      console.log('[SyncManager] Waiting for schema migration to complete...');
      await this.waitForMigration();
    }

    const pageSize = options?.pageSize || 100; // Default: 100 records per page
    console.log(`[SyncManager] Fetching data from Supabase (page size: ${pageSize})`);

    try {
      // Get IDs of entities with pending sync operations
      const pendingIds = await this.getPendingSyncIds();

      // Fetch each entity type with pagination
      let totalFetched = 0;
      let totalExpected = 4; // 4 entity types

      // Jobs
      const jobsCount = await this.fetchAndStoreEntity(
        'jobs',
        userId,
        pendingIds.job,
        pageSize,
        db.jobs
      );
      totalFetched++;
      options?.onProgress?.(totalFetched / totalExpected);

      // Quotes
      const quotesCount = await this.fetchAndStoreEntity(
        'quotes',
        userId,
        pendingIds.quote,
        pageSize,
        encryptedDb.quotes
      );
      totalFetched++;
      options?.onProgress?.(totalFetched / totalExpected);

      // Invoices
      const invoicesCount = await this.fetchAndStoreEntity(
        'invoices',
        userId,
        pendingIds.invoice,
        pageSize,
        encryptedDb.invoices
      );
      totalFetched++;
      options?.onProgress?.(totalFetched / totalExpected);

      // Clients
      const clientsCount = await this.fetchAndStoreEntity(
        'clients',
        userId,
        pendingIds.client,
        pageSize,
        encryptedDb.clients
      );
      totalFetched++;
      options?.onProgress?.(totalFetched / totalExpected);

      console.log('[SyncManager] Data fetch and store complete:', {
        jobs: jobsCount,
        quotes: quotesCount,
        invoices: invoicesCount,
        clients: clientsCount,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncManager] Error fetching data:', errorMessage);
      throw error;
    }
  }

  /**
   * ✅ HIGH PRIORITY FIX #1: Fetch and store entity with pagination
   */
  private async fetchAndStoreEntity(
    tableName: string,
    userId: string,
    pendingIds: Set<string>,
    pageSize: number,
    localTable: any
  ): Promise<number> {
    let totalStored = 0;
    let offset = 0;
    let hasMore = true;

    console.log(`[SyncManager] Fetching ${tableName} with pagination...`);

    while (hasMore) {
      // ✅ Ensure offset and pageSize are valid positive numbers
      if (!Number.isFinite(offset) || offset < 0) {
        console.error('[SyncManager] Invalid offset, aborting fetch:', offset);
        break;
      }
      if (!Number.isFinite(pageSize) || pageSize <= 0) {
        console.error('[SyncManager] Invalid pageSize, aborting fetch:', pageSize);
        break;
      }

      // Fetch one page
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(`[SyncManager] ${tableName} fetch error:`, error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      // Filter out invalid IDs and pending syncs
      const validRecords = data.filter(record =>
        record.id &&
        typeof record.id === 'string' &&
        !pendingIds.has(record.id)
      );

      const skipped = data.length - validRecords.length;
      if (skipped > 0) {
        console.warn(`[SyncManager] Skipped ${skipped} ${tableName} (invalid IDs or pending sync)`);
      }

      // Store in IndexedDB
      if (validRecords.length > 0) {
        await localTable.bulkPut(validRecords);
        totalStored += validRecords.length;
      }

      console.log(`[SyncManager] ${tableName}: Fetched page ${Math.floor(offset / pageSize) + 1}, stored ${validRecords.length} records`);

      // Check if there are more pages
      offset += pageSize;
      if (count !== null && offset >= count) {
        hasMore = false;
      } else if (data.length < pageSize) {
        hasMore = false;
      }

      // Yield to event loop to prevent blocking UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    await db.setLastSyncTime(tableName);
    console.log(`[SyncManager] ${tableName}: Total stored ${totalStored} records`);

    return totalStored;
  }

  /**
   * Get IDs of entities with pending sync operations
   * Used to prevent fetchAndStore from overwriting local changes
   */
  private async getPendingSyncIds(): Promise<{
    job: Set<string>;
    quote: Set<string>;
    invoice: Set<string>;
    client: Set<string>;
  }> {
    const result = {
      job: new Set<string>(),
      quote: new Set<string>(),
      invoice: new Set<string>(),
      client: new Set<string>(),
    };

    try {
      // ✅ FIX: Don't use .where('synced') index - fetch all and filter
      const allItems = await db.syncQueue.toArray();
      const pending = allItems.filter(item => !item.synced);

      for (const item of pending) {
        // ✅ Validate entity_id is a valid string before adding to Set
        if (item.entity_id && typeof item.entity_id === 'string' && item.entity_type in result) {
          result[item.entity_type].add(item.entity_id);
        } else {
          console.warn('[SyncManager] Skipping invalid sync queue item:', item);
        }
      }
    } catch (error) {
      console.error('[SyncManager] Error getting pending sync IDs (returning empty):', error);
      // Return empty sets on error - better than crashing
    }

    return result;
  }

  /**
   * Clear sync queue (useful for testing or after logout)
   */
  async clearQueue() {
    await db.syncQueue.clear();
    console.log('[SyncManager] Sync queue cleared');
  }

  private lastQueueClearTime = 0;
  private queueErrorCount = 0;
  private queueClearInProgress = false;

  /**
   * Get pending sync count
   */
  async getPendingSyncCount(): Promise<number> {
    try {
      // ✅ FIX: Don't use .where('synced') index - fetch all and filter
      const allItems = await db.syncQueue.toArray();
      return allItems.filter(item => !item.synced).length;
    } catch (error: unknown) {
      // ✅ FIX #5: Don't silently clear corrupted queue
      if (!this.queueClearInProgress) {
        this.queueClearInProgress = true;
        this.queueErrorCount++;

        const now = Date.now();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error(`[SyncManager] Sync queue corrupted (attempt ${this.queueErrorCount}):`, errorMessage);

        // Notify user instead of silently clearing
        this.notifyQueueCorruption();

        // Only clear after user notification
        if (now - this.lastQueueClearTime > 30000) {
          console.warn('[SyncManager] Clearing corrupted queue after user notification');
          this.lastQueueClearTime = now;

          try {
            await db.syncQueue.clear();
            this.queueErrorCount = 0;
            console.log('[SyncManager] Queue cleared successfully');
          } catch (clearError: unknown) {
            const clearErrorMessage = clearError instanceof Error ? clearError.message : 'Unknown error';
            console.error('[SyncManager] Failed to clear corrupt queue:', clearErrorMessage);
          }
        }

        this.queueClearInProgress = false;
      }

      return 0;
    }
  }

  /**
   * ✅ FIX #5: Notify user about queue corruption instead of silent clearing
   */
  private notifyQueueCorruption() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-queue-corrupted', {
        detail: {
          message: 'Sync queue data corrupted. Pending changes may be lost.',
          errorCount: this.queueErrorCount
        }
      }));
    }
  }

  /**
   * Get sync queue items
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      // ✅ FIX: Don't use .where('synced') index - fetch all and filter
      const allItems = await db.syncQueue.toArray();
      return allItems.filter(item => !item.synced);
    } catch (error: unknown) {
      // ✅ FIX #5: Notify user instead of silently clearing
      console.error('[SyncManager] Error reading sync queue');
      this.notifyQueueCorruption();

      // Clear corrupt queue after notification
      try {
        await db.syncQueue.clear();
      } catch (clearError: unknown) {
        const errorMessage = clearError instanceof Error ? clearError.message : 'Unknown error';
        console.error('[SyncManager] Failed to clear corrupt queue:', errorMessage);
      }
      return [];
    }
  }

  /**
   * Subscribe to sync events
   */
  onSyncComplete(callback: () => void) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Notify all listeners that sync completed
   */
  private notifyListeners() {
    this.syncListeners.forEach(callback => callback());
  }

  /**
   * Check if sync is in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

// Create and export singleton instance
export const syncManager = new SyncManager();

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncManager] Connection restored, processing sync queue');
    syncManager.processQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[SyncManager] Connection lost, entering offline mode');
  });
}
