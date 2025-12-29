import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, OfflineJob, OfflineQuote, OfflineInvoice, OfflineClient } from './db';
import { syncManager } from './syncManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook to detect online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to work with offline jobs
 */
export function useOfflineJobs(userId: string) {
  const isOnline = useOnlineStatus();

  // Use Dexie's live query for reactive updates
  const jobs = useLiveQuery(
    () => db.jobs.where('user_id').equals(userId).and(job => !job.deleted_at).reverse().sortBy('updated_at'),
    [userId]
  );

  const createJob = useCallback(async (jobData: Partial<OfflineJob>) => {
    const newJob: OfflineJob = {
      id: crypto.randomUUID(),
      user_id: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...jobData,
    } as OfflineJob;

    // Save to IndexedDB immediately
    await db.jobs.put(newJob);

    // Queue for sync
    await syncManager.queueSync('job', newJob.id, 'create', newJob);

    return newJob;
  }, [userId]);

  const updateJob = useCallback(async (jobId: string, updates: Partial<OfflineJob>) => {
    const existingJob = await db.jobs.get(jobId);
    if (!existingJob) throw new Error('Job not found');

    const updatedJob = {
      ...existingJob,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Save to IndexedDB
    await db.jobs.put(updatedJob);

    // Queue for sync
    await syncManager.queueSync('job', jobId, 'update', updatedJob);

    return updatedJob;
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    const job = await db.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    // Soft delete
    const deletedJob = {
      ...job,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.jobs.put(deletedJob);
    await syncManager.queueSync('job', jobId, 'delete', deletedJob);
  }, []);

  return {
    jobs: jobs || [],
    loading: jobs === undefined,
    isOnline,
    createJob,
    updateJob,
    deleteJob,
  };
}

/**
 * Hook to work with a single offline job
 */
export function useOfflineJob(jobId: string) {
  const isOnline = useOnlineStatus();

  const job = useLiveQuery(
    () => db.jobs.get(jobId),
    [jobId]
  );

  const updateJob = useCallback(async (updates: Partial<OfflineJob>) => {
    if (!job) throw new Error('Job not found');

    const updatedJob = {
      ...job,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.jobs.put(updatedJob);
    await syncManager.queueSync('job', jobId, 'update', updatedJob);

    return updatedJob;
  }, [job, jobId]);

  return {
    job,
    loading: job === undefined,
    isOnline,
    updateJob,
  };
}

/**
 * Hook to work with offline quotes
 */
export function useOfflineQuotes(userId: string) {
  const isOnline = useOnlineStatus();

  const quotes = useLiveQuery(
    () => db.quotes.where('user_id').equals(userId).and(q => !q.deleted_at).reverse().sortBy('updated_at'),
    [userId]
  );

  const createQuote = useCallback(async (quoteData: Partial<OfflineQuote>) => {
    const newQuote: OfflineQuote = {
      id: crypto.randomUUID(),
      user_id: userId,
      quote_number: `Q-${Date.now()}`,
      status: 'draft',
      total: 0,
      line_items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...quoteData,
    } as OfflineQuote;

    await db.quotes.put(newQuote);
    await syncManager.queueSync('quote', newQuote.id, 'create', newQuote);

    return newQuote;
  }, [userId]);

  const updateQuote = useCallback(async (quoteId: string, updates: Partial<OfflineQuote>) => {
    const existingQuote = await db.quotes.get(quoteId);
    if (!existingQuote) throw new Error('Quote not found');

    const updatedQuote = {
      ...existingQuote,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.quotes.put(updatedQuote);
    await syncManager.queueSync('quote', quoteId, 'update', updatedQuote);

    return updatedQuote;
  }, []);

  const deleteQuote = useCallback(async (quoteId: string) => {
    const quote = await db.quotes.get(quoteId);
    if (!quote) throw new Error('Quote not found');

    const deletedQuote = {
      ...quote,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.quotes.put(deletedQuote);
    await syncManager.queueSync('quote', quoteId, 'delete', deletedQuote);
  }, []);

  return {
    quotes: quotes || [],
    loading: quotes === undefined,
    isOnline,
    createQuote,
    updateQuote,
    deleteQuote,
  };
}

/**
 * Hook to work with offline invoices
 */
export function useOfflineInvoices(userId: string) {
  const isOnline = useOnlineStatus();

  const invoices = useLiveQuery(
    () => db.invoices.where('user_id').equals(userId).and(i => !i.deleted_at).reverse().sortBy('updated_at'),
    [userId]
  );

  const createInvoice = useCallback(async (invoiceData: Partial<OfflineInvoice>) => {
    const newInvoice: OfflineInvoice = {
      id: crypto.randomUUID(),
      user_id: userId,
      invoice_number: `INV-${Date.now()}`,
      status: 'draft',
      total: 0,
      amount_paid: 0,
      line_items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...invoiceData,
    } as OfflineInvoice;

    await db.invoices.put(newInvoice);
    await syncManager.queueSync('invoice', newInvoice.id, 'create', newInvoice);

    return newInvoice;
  }, [userId]);

  const updateInvoice = useCallback(async (invoiceId: string, updates: Partial<OfflineInvoice>) => {
    const existingInvoice = await db.invoices.get(invoiceId);
    if (!existingInvoice) throw new Error('Invoice not found');

    const updatedInvoice = {
      ...existingInvoice,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.invoices.put(updatedInvoice);
    await syncManager.queueSync('invoice', invoiceId, 'update', updatedInvoice);

    return updatedInvoice;
  }, []);

  const deleteInvoice = useCallback(async (invoiceId: string) => {
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const deletedInvoice = {
      ...invoice,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.invoices.put(deletedInvoice);
    await syncManager.queueSync('invoice', invoiceId, 'delete', deletedInvoice);
  }, []);

  return {
    invoices: invoices || [],
    loading: invoices === undefined,
    isOnline,
    createInvoice,
    updateInvoice,
    deleteInvoice,
  };
}

/**
 * Hook to work with offline clients
 */
export function useOfflineClients(userId: string) {
  const isOnline = useOnlineStatus();

  const clients = useLiveQuery(
    () => db.clients.where('user_id').equals(userId).and(c => !c.deleted_at).sortBy('name'),
    [userId]
  );

  const createClient = useCallback(async (clientData: Partial<OfflineClient>) => {
    const newClient: OfflineClient = {
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...clientData,
    } as OfflineClient;

    await db.clients.put(newClient);
    await syncManager.queueSync('client', newClient.id, 'create', newClient);

    return newClient;
  }, [userId]);

  const updateClient = useCallback(async (clientId: string, updates: Partial<OfflineClient>) => {
    const existingClient = await db.clients.get(clientId);
    if (!existingClient) throw new Error('Client not found');

    const updatedClient = {
      ...existingClient,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.clients.put(updatedClient);
    await syncManager.queueSync('client', clientId, 'update', updatedClient);

    return updatedClient;
  }, []);

  const deleteClient = useCallback(async (clientId: string) => {
    const client = await db.clients.get(clientId);
    if (!client) throw new Error('Client not found');

    const deletedClient = {
      ...client,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.clients.put(deletedClient);
    await syncManager.queueSync('client', clientId, 'delete', deletedClient);
  }, []);

  return {
    clients: clients || [],
    loading: clients === undefined,
    isOnline,
    createClient,
    updateClient,
    deleteClient,
  };
}

/**
 * Hook to monitor sync status
 */
export function useSyncStatus() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await syncManager.getPendingSyncCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPendingCount();

    // Subscribe to sync events
    const unsubscribe = syncManager.onSyncComplete(() => {
      refreshPendingCount();
      setSyncing(false);
    });

    // Refresh periodically
    const interval = setInterval(refreshPendingCount, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  const manualSync = useCallback(async () => {
    setSyncing(true);
    try {
      if (user) {
        await syncManager.fetchAndStore(user.id);
        await syncManager.processQueue();
      }
    } finally {
      setSyncing(false);
      refreshPendingCount();
    }
  }, [user, refreshPendingCount]);

  return {
    pendingCount,
    syncing: syncing || syncManager.isSyncing(),
    manualSync,
  };
}
