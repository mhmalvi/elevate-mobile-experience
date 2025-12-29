import { db, SyncQueueItem } from './db';
import { supabase } from '@/integrations/supabase/client';

/**
 * SyncManager handles synchronization between IndexedDB and Supabase
 * Manages the sync queue and processes pending changes when online
 */
export class SyncManager {
  private syncInProgress = false;
  private syncListeners: Set<() => void> = new Set();

  /**
   * Add item to sync queue
   * Called when user makes changes offline
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

    console.log(`[SyncManager] Queuing ${action} for ${entityType} ${entityId}`);

    try {
      await db.syncQueue.add({
        entity_type: entityType,
        entity_id: entityId,
        action,
        data,
        created_at: new Date().toISOString(),
        synced: false,
        retry_count: 0,
      });

      // Try to sync immediately if online
      if (navigator.onLine) {
        this.processQueue();
      }
    } catch (error) {
      console.error('[SyncManager] Error adding to sync queue:', error);
      // Don't throw - we don't want to break the app if queue fails
    }
  }

  /**
   * Process sync queue when back online
   * Syncs all pending changes to Supabase
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

    this.syncInProgress = true;
    let successCount = 0;
    let failCount = 0;

    try {
      console.log('[SyncManager] Starting sync queue processing');

      // Get all unsynced items, ordered by creation time
      const items = await db.syncQueue
        .where('synced')
        .equals(false)
        .sortBy('created_at');

      console.log(`[SyncManager] Found ${items.length} items to sync`);

      for (const item of items) {
        try {
          await this.syncItem(item);

          // Mark as synced
          await db.syncQueue.update(item.id!, {
            synced: true,
            sync_error: undefined,
          });

          successCount++;
          console.log(`[SyncManager] Synced ${item.entity_type} ${item.entity_id}`);
        } catch (error: any) {
          // Log error but continue processing
          const errorMessage = error.message || 'Unknown error';
          console.error(`[SyncManager] Error syncing ${item.entity_type} ${item.entity_id}:`, errorMessage);

          // Update retry count and error
          await db.syncQueue.update(item.id!, {
            sync_error: errorMessage,
            retry_count: (item.retry_count || 0) + 1,
          });

          failCount++;

          // If retry count exceeds limit, mark as failed
          if ((item.retry_count || 0) >= 3) {
            console.error(`[SyncManager] Max retries exceeded for ${item.entity_type} ${item.entity_id}`);
            await db.syncQueue.update(item.id!, {
              synced: true, // Mark as synced to avoid infinite retries
              sync_error: `Failed after 3 retries: ${errorMessage}`,
            });
          }
        }
      }

      console.log(`[SyncManager] Sync complete: ${successCount} success, ${failCount} failed`);
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }

    return { success: successCount, failed: failCount };
  }

  /**
   * Sync individual item to Supabase
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
        const { error: updateError } = await supabase
          .from(table)
          .update(item.data)
          .eq('id', item.entity_id);

        if (updateError) throw updateError;
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
    return entityType + 's'; // jobs, quotes, invoices, clients
  }

  /**
   * Fetch data from Supabase and store in IndexedDB
   * Used for initial data prefetch and periodic syncs
   */
  async fetchAndStore(userId: string) {
    if (!navigator.onLine) {
      console.log('[SyncManager] Offline, skipping fetch');
      return;
    }

    console.log('[SyncManager] Fetching data from Supabase');

    try {
      // Fetch all user data in parallel
      // Note: RLS policies handle both user-owned and team-shared data
      const [jobsResult, quotesResult, invoicesResult, clientsResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),

        supabase
          .from('quotes')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),

        supabase
          .from('invoices')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),

        supabase
          .from('clients')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
      ]);

      // Log any errors
      if (jobsResult.error) console.error('[SyncManager] Jobs fetch error:', jobsResult.error);
      if (quotesResult.error) console.error('[SyncManager] Quotes fetch error:', quotesResult.error);
      if (invoicesResult.error) console.error('[SyncManager] Invoices fetch error:', invoicesResult.error);
      if (clientsResult.error) console.error('[SyncManager] Clients fetch error:', clientsResult.error);

      // Store in IndexedDB
      if (jobsResult.data) {
        await db.jobs.bulkPut(jobsResult.data);
        await db.setLastSyncTime('jobs');
        console.log(`[SyncManager] Stored ${jobsResult.data.length} jobs`);
      }

      if (quotesResult.data) {
        await db.quotes.bulkPut(quotesResult.data);
        await db.setLastSyncTime('quotes');
        console.log(`[SyncManager] Stored ${quotesResult.data.length} quotes`);
      }

      if (invoicesResult.data) {
        await db.invoices.bulkPut(invoicesResult.data);
        await db.setLastSyncTime('invoices');
        console.log(`[SyncManager] Stored ${invoicesResult.data.length} invoices`);
      }

      if (clientsResult.data) {
        await db.clients.bulkPut(clientsResult.data);
        await db.setLastSyncTime('clients');
        console.log(`[SyncManager] Stored ${clientsResult.data.length} clients`);
      }

      console.log('[SyncManager] Data fetch and store complete');
    } catch (error) {
      console.error('[SyncManager] Error fetching data:', error);
      throw error;
    }
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

  /**
   * Get pending sync count
   */
  async getPendingSyncCount(): Promise<number> {
    try {
      return await db.syncQueue.where('synced').equals(false).count();
    } catch (error) {
      this.queueErrorCount++;

      // Only log and clear if we haven't done so recently (within 30 seconds)
      const now = Date.now();
      if (now - this.lastQueueClearTime > 30000) {
        console.error('[SyncManager] Queue corrupted, clearing (error count: ' + this.queueErrorCount + '):', error);
        this.lastQueueClearTime = now;

        try {
          await db.syncQueue.clear();
          this.queueErrorCount = 0;
          console.log('[SyncManager] Queue cleared successfully');
        } catch (clearError) {
          console.error('[SyncManager] Failed to clear queue:', clearError);
        }
      }

      return 0;
    }
  }

  /**
   * Get sync queue items
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      return await db.syncQueue.where('synced').equals(false).toArray();
    } catch (error) {
      console.error('[SyncManager] Error getting sync queue:', error);
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
