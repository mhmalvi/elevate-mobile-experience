import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { syncManager } from './syncManager';
import { db } from './db';
import { useToast } from '@/hooks/use-toast';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineContextValue {
  isOnline: boolean;
  pendingSyncCount: number;
  syncing: boolean;
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

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

      {/* Syncing indicator */}
      {syncing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white px-4 py-2 text-center text-sm font-medium">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Syncing your data...</span>
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
