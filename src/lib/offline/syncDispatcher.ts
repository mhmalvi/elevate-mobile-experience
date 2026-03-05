/**
 * Outbound sync processing: processes the queue and pushes changes to Supabase.
 *
 * Owns:
 * - processQueue() orchestration (called by SyncManager)
 * - processBatch() / syncItem() — the actual Supabase writes
 * - hasDependencyOnFailedParent() — soft dependency tracking
 * - handleSyncItemError() / rollbackOptimisticUpdate()
 * - ensureValidToken()
 * - failedParentEntities tracking (reset each processQueue run)
 */

import { db, SyncQueueItem } from './db';
import { supabase } from '@/integrations/supabase/client';
import { resolveConflict, hasConflict } from './conflictResolver';
import { getTableName, getLocalTable } from './entityConfig';
import { type SyncRecord, type ConflictField } from './syncTypes';
import { notifyAuthError, notifyConflict } from './syncEvents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchResult {
  success: number;
  failed: number;
  failedParents?: string[];
}

// ---------------------------------------------------------------------------
// SyncDispatcher
// ---------------------------------------------------------------------------

export class SyncDispatcher {
  /** Set of "entityType:entityId" strings whose sync failed this run. */
  private failedParentEntities = new Set<string>();

  // ---------------------------------------------------------------------------
  // Token validation
  // ---------------------------------------------------------------------------

  /**
   * Ensure a valid Supabase auth token exists before issuing any network
   * requests.  Proactively refreshes if the token expires within 5 minutes.
   */
  async ensureValidToken(): Promise<void> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw new Error(`Failed to get session: ${error.message}`);
      if (!session) throw new Error('No active session');

      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresInMs = expiresAt * 1000 - Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        if (expiresInMs < fiveMinutes) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw new Error(`Token refresh failed: ${refreshError.message}`);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncDispatcher] Auth token validation failed:', errorMessage);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Queue processing
  // ---------------------------------------------------------------------------

  /** Reset per-run state. Must be called at the start of each processQueue(). */
  resetFailedParents(): void {
    this.failedParentEntities.clear();
  }

  /**
   * Process one batch of same-type/action items.
   * Handles dependency deferral, batch Supabase operations, and per-item
   * fallback on batch failure.
   */
  async processBatch(batch: SyncQueueItem[]): Promise<BatchResult> {
    if (batch.length === 0) return { success: 0, failed: 0, failedParents: [] };

    const entityType = batch[0].entity_type;
    const action = batch[0].action;
    const table = getTableName(entityType);

    let successCount = 0;
    let failCount = 0;
    const failedParents: string[] = [];

    // Separate items with failed parent dependencies
    const validBatch: SyncQueueItem[] = [];
    const deferredBatch: SyncQueueItem[] = [];

    for (const item of batch) {
      if (this.hasDependencyOnFailedParent(item)) {
        console.warn(
          `[SyncDispatcher] Deferring ${item.entity_type} ${item.entity_id} - parent entity failed`
        );
        deferredBatch.push(item);
      } else {
        validBatch.push(item);
      }
    }

    // Mark deferred items without incrementing their retry count
    for (const item of deferredBatch) {
      await db.syncQueue.update(item.id!, {
        sync_error: 'Deferred: Parent entity sync failed. Will retry after parent succeeds.',
        retry_count: item.retry_count || 0,
      });
    }

    if (validBatch.length === 0) return { success: 0, failed: 0, failedParents };

    try {
      if (action === 'create') {
        const dataToInsert = validBatch.map(item => item.data);
        const { error } = await supabase.from(table).upsert(dataToInsert, { onConflict: 'id' });
        if (error) throw error;

        for (const item of validBatch) {
          await db.syncQueue.delete(item.id!);
          successCount++;
        }
      } else if (action === 'update') {
        for (const item of validBatch) {
          try {
            await this.syncItem(item);
            await db.syncQueue.delete(item.id!);
            successCount++;
          } catch (error: unknown) {
            await this.handleSyncItemError(item, error);
            failCount++;
            if (['client', 'quote', 'invoice'].includes(item.entity_type)) {
              failedParents.push(`${item.entity_type}:${item.entity_id}`);
            }
          }
        }
      } else if (action === 'delete') {
        const idsToDelete = validBatch.map(item => item.entity_id);
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .in('id', idsToDelete);
        if (error) throw error;

        for (const item of validBatch) {
          await db.syncQueue.delete(item.id!);
          successCount++;
        }
      }
    } catch (error: unknown) {
      // Batch operation failed — fall back to individual processing
      console.warn('[SyncDispatcher] Batch operation failed, processing individually:', error);

      for (const item of validBatch) {
        try {
          await this.syncItem(item);
          await db.syncQueue.delete(item.id!);
          successCount++;
        } catch (itemError: unknown) {
          await this.handleSyncItemError(item, itemError);
          failCount++;
          if (['client', 'quote', 'invoice'].includes(item.entity_type) && item.action === 'create') {
            failedParents.push(`${item.entity_type}:${item.entity_id}`);
          }
        }
      }
    }

    return { success: successCount, failed: failCount, failedParents };
  }

  // ---------------------------------------------------------------------------
  // Individual item sync
  // ---------------------------------------------------------------------------

  /**
   * Sync a single queue item to Supabase, performing conflict resolution for
   * update operations.
   */
  async syncItem(item: SyncQueueItem): Promise<void> {
    const table = getTableName(item.entity_type);

    switch (item.action) {
      case 'create': {
        const { error: createError } = await supabase.from(table).insert(item.data);
        if (createError) throw createError;
        break;
      }

      case 'update': {
        // Fetch current server data to check for conflicts
        const { data: serverData, error: fetchError } = await supabase
          .from(table)
          .select('*')
          .eq('id', item.entity_id)
          .single();

        // PGRST116 = not found (record deleted on server) — skip gracefully
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (serverData && hasConflict(item.data, serverData)) {
          console.warn(
            `[SyncDispatcher] Conflict detected for ${item.entity_type} ${item.entity_id}`
          );

          const conflictingFields = this._getConflictingFields(
            item.data as SyncRecord,
            serverData as SyncRecord
          );
          notifyConflict({
            entityType: item.entity_type,
            entityId: item.entity_id,
            conflictingFields,
            localData: item.data as SyncRecord,
            serverData: serverData as SyncRecord,
          });

          const { resolved } = resolveConflict(item.data, serverData, 'last-write-wins');

          const { error: updateError } = await supabase
            .from(table)
            .update(resolved)
            .eq('id', item.entity_id);
          if (updateError) throw updateError;

          // Persist resolved data locally
          const localTable = getLocalTable(item.entity_type);
          if (localTable) await (localTable as { put: (v: unknown) => Promise<unknown> }).put(resolved);
        } else {
          const { error: updateError } = await supabase
            .from(table)
            .update(item.data)
            .eq('id', item.entity_id);
          if (updateError) throw updateError;
        }
        break;
      }

      case 'delete': {
        const { error: deleteError } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', item.entity_id);
        if (deleteError) throw deleteError;
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  /** Update queue item with error details, roll back if max retries exceeded. */
  async handleSyncItemError(item: SyncQueueItem, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[SyncDispatcher] Error syncing ${item.entity_type} ${item.entity_id}:`,
      errorMessage
    );

    const newRetryCount = (item.retry_count || 0) + 1;
    await db.syncQueue.update(item.id!, {
      sync_error: errorMessage,
      retry_count: newRetryCount,
    });

    if (newRetryCount >= 3) {
      console.error(
        `[SyncDispatcher] Max retries exceeded for ${item.entity_type} ${item.entity_id}`
      );
      await this.rollbackOptimisticUpdate(item);
      await db.syncQueue.delete(item.id!);
    }
  }

  /**
   * Rollback an optimistic local write when sync has permanently failed.
   * Removes an optimistically-created item or restores a soft-deleted one.
   */
  async rollbackOptimisticUpdate(item: SyncQueueItem): Promise<void> {
    try {
      const localTable = getLocalTable(item.entity_type);
      if (!localTable) return;

      const tbl = localTable as {
        delete: (id: string) => Promise<void>;
        get: (id: string) => Promise<Record<string, unknown> | undefined>;
        put: (v: Record<string, unknown>) => Promise<unknown>;
      };

      if (item.action === 'create') {
        await tbl.delete(item.entity_id);
      } else if (item.action === 'delete') {
        const existing = await tbl.get(item.entity_id);
        if (existing && existing.deleted_at) {
          const { deleted_at: _removed, ...restored } = existing;
          await tbl.put(restored);
        }
      }
      // 'update' rollback would require storing original state — not implemented yet
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SyncDispatcher] Failed to rollback optimistic update:', errorMessage);
    }
  }

  // ---------------------------------------------------------------------------
  // Dependency helpers
  // ---------------------------------------------------------------------------

  /** Check whether an item's parent entity has already failed this run. */
  hasDependencyOnFailedParent(item: SyncQueueItem): boolean {
    if (item.entity_type === 'client') return false; // Clients have no parents

    const clientId = item.data?.client_id;
    if (clientId && this.failedParentEntities.has(`client:${clientId}`)) return true;

    if (item.entity_type === 'quote_line_item') {
      const quoteId = item.data?.quote_id;
      if (quoteId && this.failedParentEntities.has(`quote:${quoteId}`)) return true;
    }

    if (item.entity_type === 'invoice_line_item') {
      const invoiceId = item.data?.invoice_id;
      if (invoiceId && this.failedParentEntities.has(`invoice:${invoiceId}`)) return true;
    }

    return false;
  }

  /** Record a failed parent so its children are deferred. */
  recordFailedParents(ids: string[]): void {
    ids.forEach(id => this.failedParentEntities.add(id));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _getConflictingFields(localData: SyncRecord, serverData: SyncRecord): ConflictField[] {
    const conflicts: ConflictField[] = [];
    const ignoreFields = ['updated_at', 'deleted_at', 'created_at'];

    for (const key in localData) {
      if (ignoreFields.includes(key)) continue;
      if (JSON.stringify(localData[key]) !== JSON.stringify(serverData[key])) {
        conflicts.push({ field: key, localValue: localData[key], serverValue: serverData[key] });
      }
    }

    return conflicts;
  }

  // Expose notifyAuthError so processQueue (in SyncManager) can call it
  notifyAuthError = notifyAuthError;
}
