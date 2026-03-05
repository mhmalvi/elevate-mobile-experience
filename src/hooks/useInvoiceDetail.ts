import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePaymentPoller } from '@/hooks/usePaymentPoller';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

// ---------- Types ----------

type Invoice = Tables<'invoices'>;
type Client = Tables<'clients'>;

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
}

export interface UseInvoiceDetailReturn {
  // Params
  id: string | undefined;

  // State
  invoice: Invoice | null;
  client: Client | null;
  lineItems: InvoiceLineItem[];
  loading: boolean;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  sendingReminder: boolean;
  downloadingPDF: boolean;
  balance: number;
  isOverdue: boolean;

  // Handlers
  fetchInvoice: () => Promise<void>;
  handleRecordPayment: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handlePrint: () => Promise<void>;
  handleSendReminder: () => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}

export function useInvoiceDetail(): UseInvoiceDetailReturn {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);

  // ---------- Data fetching ----------

  const fetchInvoice = useCallback(async () => {
    if (!id) return;

    const { data: invoiceData, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !invoiceData) {
      toast({ title: 'Invoice not found', variant: 'destructive' });
      navigate('/invoices');
      return;
    }

    setInvoice(invoiceData);

    if (invoiceData.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', invoiceData.client_id)
        .single();
      setClient(clientData);
    }

    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order');

    setLineItems(items || []);
    setLoading(false);
  }, [id, toast, navigate]);

  // ---------- Payment polling ----------

  const fetchPaymentStatus = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', id)
      .single();
    if (error) {
      console.error('[InvoiceDetail] Error polling invoice:', error);
      return null;
    }
    return data?.status ?? null;
  }, [id]);

  usePaymentPoller({
    searchParams,
    fetchStatus: fetchPaymentStatus,
    onConfirmed: () => fetchInvoice(),
    enabled: !!id,
  });

  // ---------- Print / PDF ----------

  const { printing: downloadingPDF, handlePrint } = usePrintDocument({
    documentType: 'invoice',
    documentId: id || '',
  });

  // ---------- Initial load ----------

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id, fetchInvoice]);

  // ---------- Derived state ----------

  const balance = (invoice?.total || 0) - (invoice?.amount_paid || 0);
  const isOverdue = !!(invoice?.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid');

  // ---------- Handlers ----------

  const handleRecordPayment = useCallback(async () => {
    if (!invoice) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    const newAmountPaid = (invoice.amount_paid || 0) + amount;
    const isPaidInFull = newAmountPaid >= (invoice.total || 0);

    const updates: Partial<Invoice> = {
      amount_paid: newAmountPaid,
      status: isPaidInFull ? 'paid' : invoice.status,
      paid_at: isPaidInFull ? new Date().toISOString() : invoice.paid_at,
    };

    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoice.id);

    if (error) {
      toast({ title: 'Error recording payment', variant: 'destructive' });
    } else {
      toast({
        title: 'Payment recorded',
        description: isPaidInFull ? 'Invoice marked as paid in full.' : `$${amount.toFixed(2)} recorded.`,
      });
      setPaymentAmount('');
      fetchInvoice();
    }
  }, [invoice, paymentAmount, toast, fetchInvoice]);

  const handleDelete = useCallback(async () => {
    if (!invoice) return;

    const { error } = await supabase
      .from('invoices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', invoice.id);

    if (error) {
      toast({ title: 'Error deleting invoice', variant: 'destructive' });
    } else {
      toast({ title: 'Invoice deleted' });
      navigate('/invoices');
    }
  }, [invoice, toast, navigate]);

  const handleSendReminder = useCallback(async () => {
    setSendingReminder(true);
    try {
      const { error } = await supabase.functions.invoke('payment-reminder', {
        body: { invoice_id: id },
      });
      if (error) throw error;
      toast({ title: 'Reminder Sent!', description: `SMS reminder sent to ${client?.name}` });
    } catch {
      toast({ title: 'Failed to send reminder', variant: 'destructive' });
    } finally {
      setSendingReminder(false);
    }
  }, [id, client?.name, toast]);

  return {
    id,
    invoice,
    client,
    lineItems,
    loading,
    paymentAmount,
    setPaymentAmount,
    sendingReminder,
    downloadingPDF,
    balance,
    isOverdue,
    fetchInvoice,
    handleRecordPayment,
    handleDelete,
    handlePrint,
    handleSendReminder,
    navigate,
  };
}
