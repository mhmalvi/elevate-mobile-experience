import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, OfflineJob, OfflineQuote, OfflineInvoice, OfflineClient, OfflineQuoteLineItem, OfflineInvoiceLineItem } from './db';
import { syncManager } from './syncManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateUUID } from '@/lib/utils/uuid';
import { decryptClientFields, decryptInvoiceFields, decryptQuoteFields } from './encryption';

// Extended types with client data joined
export interface OfflineJobWithClient extends OfflineJob {
  clients?: { name: string; email?: string; phone?: string } | null;
}

export interface OfflineQuoteWithClient extends OfflineQuote {
  clients?: { name: string; email?: string; phone?: string } | null;
}

export interface OfflineInvoiceWithClient extends OfflineInvoice {
  clients?: { name: string; email?: string; phone?: string } | null;
}

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
  const rawJobs = useLiveQuery(
    () => db.jobs.where('user_id').equals(userId).and(job => !job.deleted_at).reverse().sortBy('updated_at'),
    [userId]
  );

  // Fetch clients for joining (with decryption)
  const clients = useLiveQuery(
    async () => {
      const rawClients = await db.clients.where('user_id').equals(userId).toArray();
      return Promise.all(rawClients.map(c => decryptClientFields(c)));
    },
    [userId]
  );

  // Join jobs with client data
  const jobs = useMemo<OfflineJobWithClient[]>(() => {
    if (!rawJobs) return [];
    const clientMap = new Map(clients?.map(c => [c.id, c]) || []);
    return rawJobs.map(job => {
      const client = job.client_id ? clientMap.get(job.client_id) : null;
      return {
        ...job,
        clients: client ? { name: client.name, email: client.email, phone: client.phone } : null,
      };
    });
  }, [rawJobs, clients]);

  // Fetch fresh data from Supabase when online
  // Note: Using syncManager.fetchAndStore instead to protect local unsynced changes
  useEffect(() => {
    if (userId && isOnline) {
      const fetchJobs = async () => {
        await syncManager.fetchAndStore(userId);
      };
      fetchJobs();
    }
  }, [userId, isOnline]);

  const createJob = useCallback(async (jobData: Partial<OfflineJob>) => {
    const newJob: OfflineJob = {
      id: generateUUID(),
      user_id: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...jobData,
    } as OfflineJob;

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic soft delete automatically)
    await syncManager.queueSync('job', jobId, 'delete', deletedJob);
  }, []);

  return {
    jobs,
    loading: rawJobs === undefined,
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

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

  const rawQuotes = useLiveQuery(
    async () => {
      const quotes = await db.quotes.where('user_id').equals(userId).and(q => !q.deleted_at).reverse().sortBy('updated_at');
      return Promise.all(quotes.map(q => decryptQuoteFields(q)));
    },
    [userId]
  );

  // Fetch clients for joining (with decryption)
  const clients = useLiveQuery(
    async () => {
      const rawClients = await db.clients.where('user_id').equals(userId).toArray();
      return Promise.all(rawClients.map(c => decryptClientFields(c)));
    },
    [userId]
  );

  // Join quotes with client data
  const quotes = useMemo<OfflineQuoteWithClient[]>(() => {
    if (!rawQuotes) return [];
    const clientMap = new Map(clients?.map(c => [c.id, c]) || []);
    return rawQuotes.map(quote => {
      const client = quote.client_id ? clientMap.get(quote.client_id) : null;
      return {
        ...quote,
        clients: client ? { name: client.name, email: client.email, phone: client.phone } : null,
      };
    });
  }, [rawQuotes, clients]);

  // Fetch fresh data from Supabase when online
  // Note: Using syncManager.fetchAndStore instead to protect local unsynced changes
  useEffect(() => {
    if (userId && isOnline) {
      const fetchQuotes = async () => {
        await syncManager.fetchAndStore(userId);
      };
      fetchQuotes();
    }
  }, [userId, isOnline]);

  const createQuote = useCallback(async (quoteData: Partial<OfflineQuote>) => {
    const newQuote: OfflineQuote = {
      id: generateUUID(),
      user_id: userId,
      quote_number: `Q-${Date.now()}`,
      title: '',
      status: 'draft',
      total: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...quoteData,
    };

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic soft delete automatically)
    await syncManager.queueSync('quote', quoteId, 'delete', deletedQuote);
  }, []);

  return {
    quotes,
    loading: rawQuotes === undefined,
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

  const rawInvoices = useLiveQuery(
    async () => {
      const invoices = await db.invoices.where('user_id').equals(userId).and(i => !i.deleted_at).reverse().sortBy('updated_at');
      return Promise.all(invoices.map(i => decryptInvoiceFields(i)));
    },
    [userId]
  );

  // Fetch clients for joining (with decryption)
  const clients = useLiveQuery(
    async () => {
      const rawClients = await db.clients.where('user_id').equals(userId).toArray();
      return Promise.all(rawClients.map(c => decryptClientFields(c)));
    },
    [userId]
  );

  // Join invoices with client data
  const invoices = useMemo<OfflineInvoiceWithClient[]>(() => {
    if (!rawInvoices) return [];
    const clientMap = new Map(clients?.map(c => [c.id, c]) || []);
    return rawInvoices.map(invoice => {
      const client = invoice.client_id ? clientMap.get(invoice.client_id) : null;
      return {
        ...invoice,
        clients: client ? { name: client.name, email: client.email, phone: client.phone } : null,
      };
    });
  }, [rawInvoices, clients]);

  // Fetch fresh data from Supabase when online
  // Note: Using syncManager.fetchAndStore instead to protect local unsynced changes
  useEffect(() => {
    if (userId && isOnline) {
      const fetchInvoices = async () => {
        await syncManager.fetchAndStore(userId);
      };
      fetchInvoices();
    }
  }, [userId, isOnline]);

  const createInvoice = useCallback(async (invoiceData: Partial<OfflineInvoice>) => {
    const newInvoice: OfflineInvoice = {
      id: generateUUID(),
      user_id: userId,
      invoice_number: `INV-${Date.now()}`,
      title: '',
      status: 'draft',
      total: 0,
      amount_paid: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...invoiceData,
    };

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic soft delete automatically)
    await syncManager.queueSync('invoice', invoiceId, 'delete', deletedInvoice);
  }, []);

  return {
    invoices,
    loading: rawInvoices === undefined,
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
    async () => {
      const rawClients = await db.clients.where('user_id').equals(userId).and(c => !c.deleted_at).sortBy('name');
      return Promise.all(rawClients.map(c => decryptClientFields(c)));
    },
    [userId]
  );

  // Fetch fresh data from Supabase when online
  // Note: Using syncManager.fetchAndStore instead to protect local unsynced changes
  useEffect(() => {
    if (userId && isOnline) {
      const fetchClients = async () => {
        await syncManager.fetchAndStore(userId);
      };
      fetchClients();
    }
  }, [userId, isOnline]);

  const createClient = useCallback(async (clientData: Partial<OfflineClient>) => {
    const newClient: OfflineClient = {
      id: generateUUID(),
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...clientData,
    } as OfflineClient;

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic UI update automatically)
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

    // Queue for sync (queueSync now handles optimistic soft delete automatically)
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
 * Hook to work with offline quote line items
 */
export function useOfflineQuoteLineItems(quoteId: string) {
  const isOnline = useOnlineStatus();

  // Use Dexie's live query for reactive updates filtered by quote_id
  const lineItems = useLiveQuery(
    async () => {
      const items = await db.quote_line_items.where('quote_id').equals(quoteId).toArray();
      return items.filter(item => !item.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    [quoteId]
  );

  // Fetch fresh data from Supabase when online
  useEffect(() => {
    if (quoteId && isOnline) {
      const fetchLineItems = async () => {
        try {
          const { data, error } = await supabase
            .from('quote_line_items')
            .select('*')
            .eq('quote_id', quoteId);

          if (error) {
            console.error('[useOfflineQuoteLineItems] Fetch error:', error);
            return;
          }

          if (data && data.length > 0) {
            // Check for pending syncs before overwriting
            const allQueueItems = await db.syncQueue.toArray();
            const pendingIds = new Set(
              allQueueItems
                .filter(item => !item.synced && item.entity_type === 'quote_line_item')
                .map(item => item.entity_id)
            );

            const safeRecords = data.filter(record => !pendingIds.has(record.id));
            if (safeRecords.length > 0) {
              await db.quote_line_items.bulkPut(safeRecords);
            }
          }
        } catch (error) {
          console.error('[useOfflineQuoteLineItems] Error:', error);
        }
      };
      fetchLineItems();
    }
  }, [quoteId, isOnline]);

  const createLineItem = useCallback(async (itemData: Partial<OfflineQuoteLineItem>) => {
    const newItem: OfflineQuoteLineItem = {
      id: generateUUID(),
      quote_id: quoteId,
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...itemData,
    };

    await syncManager.queueSync('quote_line_item', newItem.id, 'create', newItem);
    return newItem;
  }, [quoteId]);

  const updateLineItem = useCallback(async (itemId: string, updates: Partial<OfflineQuoteLineItem>) => {
    const existing = await db.quote_line_items.get(itemId);
    if (!existing) throw new Error('Quote line item not found');

    const updatedItem = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await syncManager.queueSync('quote_line_item', itemId, 'update', updatedItem);
    return updatedItem;
  }, []);

  const deleteLineItem = useCallback(async (itemId: string) => {
    const item = await db.quote_line_items.get(itemId);
    if (!item) throw new Error('Quote line item not found');

    const deletedItem = {
      ...item,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await syncManager.queueSync('quote_line_item', itemId, 'delete', deletedItem);
  }, []);

  return {
    lineItems: lineItems || [],
    loading: lineItems === undefined,
    isOnline,
    createLineItem,
    updateLineItem,
    deleteLineItem,
  };
}

/**
 * Hook to work with offline invoice line items
 */
export function useOfflineInvoiceLineItems(invoiceId: string) {
  const isOnline = useOnlineStatus();

  // Use Dexie's live query for reactive updates filtered by invoice_id
  const lineItems = useLiveQuery(
    async () => {
      const items = await db.invoice_line_items.where('invoice_id').equals(invoiceId).toArray();
      return items.filter(item => !item.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    [invoiceId]
  );

  // Fetch fresh data from Supabase when online
  useEffect(() => {
    if (invoiceId && isOnline) {
      const fetchLineItems = async () => {
        try {
          const { data, error } = await supabase
            .from('invoice_line_items')
            .select('*')
            .eq('invoice_id', invoiceId);

          if (error) {
            console.error('[useOfflineInvoiceLineItems] Fetch error:', error);
            return;
          }

          if (data && data.length > 0) {
            // Check for pending syncs before overwriting
            const allQueueItems = await db.syncQueue.toArray();
            const pendingIds = new Set(
              allQueueItems
                .filter(item => !item.synced && item.entity_type === 'invoice_line_item')
                .map(item => item.entity_id)
            );

            const safeRecords = data.filter(record => !pendingIds.has(record.id));
            if (safeRecords.length > 0) {
              await db.invoice_line_items.bulkPut(safeRecords);
            }
          }
        } catch (error) {
          console.error('[useOfflineInvoiceLineItems] Error:', error);
        }
      };
      fetchLineItems();
    }
  }, [invoiceId, isOnline]);

  const createLineItem = useCallback(async (itemData: Partial<OfflineInvoiceLineItem>) => {
    const newItem: OfflineInvoiceLineItem = {
      id: generateUUID(),
      invoice_id: invoiceId,
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...itemData,
    };

    await syncManager.queueSync('invoice_line_item', newItem.id, 'create', newItem);
    return newItem;
  }, [invoiceId]);

  const updateLineItem = useCallback(async (itemId: string, updates: Partial<OfflineInvoiceLineItem>) => {
    const existing = await db.invoice_line_items.get(itemId);
    if (!existing) throw new Error('Invoice line item not found');

    const updatedItem = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await syncManager.queueSync('invoice_line_item', itemId, 'update', updatedItem);
    return updatedItem;
  }, []);

  const deleteLineItem = useCallback(async (itemId: string) => {
    const item = await db.invoice_line_items.get(itemId);
    if (!item) throw new Error('Invoice line item not found');

    const deletedItem = {
      ...item,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await syncManager.queueSync('invoice_line_item', itemId, 'delete', deletedItem);
  }, []);

  return {
    lineItems: lineItems || [],
    loading: lineItems === undefined,
    isOnline,
    createLineItem,
    updateLineItem,
    deleteLineItem,
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
