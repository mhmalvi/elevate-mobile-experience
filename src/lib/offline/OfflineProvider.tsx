import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { syncManager } from './syncManager';
import { db } from './db';
import { useToast } from '@/hooks/use-toast';
import { WifiOff, RefreshCw } from 'lucide-react';
import { migrateToEncryptedStorage } from './migrateEncryption';

interface OfflineContextValue {
  isOnline: boolean;
  pendingSyncCount: number;
  syncing: boolean;
  syncProgress: {
    percentage: number;
    current: number;
    total: number;
    currentEntity: string;
  } | null;
  prefetchData: () => Promise<void>;
  processQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [prefetched, setPrefetched] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    percentage: number;
    current: number;
    total: number;
    currentEntity: string;
  } | null>(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back online',
        description: 'Syncing your changes...',
        duration: 2000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'You\'re offline',
        description: 'Changes will sync when you\'re back online',
        duration: 3000,
      });
    };

    // ✅ FIX #2: Handle quota exceeded errors
    const handleQuotaExceeded = (event: Event) => {
      const customEvent = event as CustomEvent;
      toast({
        title: 'Storage Full',
        description: 'Your device storage is full. Please free up space or clear old data.',
        variant: 'destructive',
        duration: 10000,
      });
    };

    // ✅ FIX #3: Handle auth errors during sync
    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent;
      toast({
        title: 'Authentication Error',
        description: 'Your session expired. Please log in again to sync your data.',
        variant: 'destructive',
        duration: 10000,
      });
    };

    // ✅ FIX #5: Handle queue corruption notifications
    const handleQueueCorrupted = (event: Event) => {
      const customEvent = event as CustomEvent;
      toast({
        title: 'Sync Data Corrupted',
        description: customEvent.detail?.message || 'Some pending changes may be lost. Please contact support if this persists.',
        variant: 'destructive',
        duration: 15000,
      });
    };

    // ✅ MEDIUM PRIORITY FIX #1: Handle conflict notifications
    const handleConflictDetected = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { entityType, entityId, conflictingFields } = customEvent.detail;

      const fieldsList = conflictingFields
        .map((f: any) => f.field)
        .join(', ');

      toast({
        title: '⚠️ Data Conflict Detected',
        description: `This ${entityType} was modified on another device. Conflicting fields: ${fieldsList}. Using newest version.`,
        variant: 'default',
        duration: 8000,
      });
    };

    // ✅ MEDIUM PRIORITY FIX #2: Handle sync progress updates
    const handleSyncProgress = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { percentage, completed, total, currentEntity, phase } = customEvent.detail;

      if (phase === 'syncing' && total > 0) {
        setSyncProgress({
          percentage,
          current: completed,
          total,
          currentEntity,
        });
      } else {
        setSyncProgress(null);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('indexeddb-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('sync-auth-error', handleAuthError);
    window.addEventListener('sync-queue-corrupted', handleQueueCorrupted);
    window.addEventListener('sync-conflict-detected', handleConflictDetected);
    window.addEventListener('sync-progress', handleSyncProgress);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('indexeddb-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('sync-auth-error', handleAuthError);
      window.removeEventListener('sync-queue-corrupted', handleQueueCorrupted);
      window.removeEventListener('sync-conflict-detected', handleConflictDetected);
      window.removeEventListener('sync-progress', handleSyncProgress);
    };
  }, [toast]);

  // SECURITY: Migrate to encrypted storage on first load
  useEffect(() => {
    const runMigration = async () => {
      try {
        await migrateToEncryptedStorage();
      } catch (error) {
        console.error('[OfflineProvider] Encryption migration failed:', error);
        // Continue anyway - encryption is best-effort
      }
    };
    runMigration();
  }, []); // Run once on mount

  // Prefetch data when user logs in
  useEffect(() => {
    if (user && isOnline && !prefetched) {
      prefetchData();
    }
  }, [user, isOnline, prefetched]);

  // Update pending sync count
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await syncManager.getPendingSyncCount();
      setPendingSyncCount(count);
    };

    updatePendingCount();

    // Update every 5 seconds
    const interval = setInterval(updatePendingCount, 5000);

    // Subscribe to sync events
    const unsubscribe = syncManager.onSyncComplete(() => {
      updatePendingCount();
      setSyncing(false);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const prefetchData = async () => {
    if (!user || !isOnline) return;

    setSyncing(true);
    try {
      console.log('[OfflineProvider] Prefetching data for offline use');
      await syncManager.fetchAndStore(user.id);
      setPrefetched(true);
      console.log('[OfflineProvider] Data prefetch complete');

      // Show stats
      const stats = await db.getStats();
      console.log('[OfflineProvider] Offline data:', stats);
    } catch (error) {
      console.error('[OfflineProvider] Error prefetching data:', error);
      toast({
        title: 'Sync error',
        description: 'Failed to download data for offline use',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const processQueue = async () => {
    if (!isOnline) {
      toast({
        title: 'Offline',
        description: 'Cannot sync while offline',
        variant: 'destructive',
      });
      return;
    }

    setSyncing(true);
    try {
      const result = await syncManager.processQueue();

      if (result.success > 0) {
        toast({
          title: 'Sync complete',
          description: `Synced ${result.success} change${result.success !== 1 ? 's' : ''}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        });
      }

      // Refresh data after sync
      if (user) {
        await syncManager.fetchAndStore(user.id);
      }
    } catch (error) {
      console.error('[OfflineProvider] Error processing queue:', error);
      toast({
        title: 'Sync error',
        description: 'Failed to sync changes',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Clear offline data on logout
  useEffect(() => {
    if (!user) {
      db.clearAll();
      setPrefetched(false);
    }
  }, [user]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingSyncCount,
        syncing,
        syncProgress,
        prefetchData,
        processQueue,
      }}
    >
      {/* Offline indicator banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm font-medium">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>You're offline. Changes will sync when you're back online.</span>
          </div>
        </div>
      )}

      {/* Syncing indicator with progress */}
      {syncing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white px-4 py-2 text-center text-sm font-medium">
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>
                {syncProgress
                  ? `Syncing ${syncProgress.currentEntity || 'data'}... ${syncProgress.percentage}%`
                  : 'Syncing your data...'}
              </span>
            </div>
            {syncProgress && syncProgress.total > 0 && (
              <div className="w-full max-w-md bg-blue-600 rounded-full h-1.5">
                <div
                  className="bg-white rounded-full h-1.5 transition-all duration-300"
                  style={{ width: `${syncProgress.percentage}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending sync indicator */}
      {isOnline && pendingSyncCount > 0 && !syncing && (
        <div className="fixed bottom-20 right-4 z-50 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          <div className="flex items-center gap-2">
            <span>{pendingSyncCount} change{pendingSyncCount !== 1 ? 's' : ''} pending</span>
            <button
              onClick={processQueue}
              className="underline hover:no-underline"
            >
              Sync now
            </button>
          </div>
        </div>
      )}

      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineContext must be used within OfflineProvider');
  }
  return context;
}
