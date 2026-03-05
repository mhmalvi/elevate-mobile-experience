import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePaymentPoller } from '@/hooks/usePaymentPoller';
import { safeNumber } from '@/lib/utils';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isPast, parseISO } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Invoice data returned by the get_public_invoice RPC */
export interface PublicInvoiceData {
  id: string;
  invoice_number: string;
  title?: string;
  description?: string;
  status: string;
  subtotal: number;
  gst: number;
  total: number;
  amount_paid: number;
  due_date?: string;
  paid_at?: string;
  created_at: string;
  notes?: string;
  terms?: string;
  clients?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
  };
}

/** Invoice line item from the RPC payload */
export interface PublicInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
  item_type?: string;
}

/** Business profile data from the RPC payload */
export interface PublicBusinessProfile {
  business_name?: string;
  abn?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  bank_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  license_number?: string;
}

/** Branding settings from the RPC payload */
export interface PublicBranding {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  show_logo_on_documents?: boolean;
  document_footer_text?: string;
  default_invoice_terms?: string;
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export interface PublicInvoiceDerived {
  isPaid: boolean;
  isOverdue: boolean;
  balance: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | undefined;
  showLogo: boolean;
  footerText: string;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UsePublicInvoiceReturn {
  /** Raw invoice data, null until loaded */
  invoice: PublicInvoiceData | null;
  lineItems: PublicInvoiceLineItem[];
  profile: PublicBusinessProfile | null;
  branding: PublicBranding | null;
  loading: boolean;
  error: string | null;
  /** True while Stripe redirect payment is being created */
  processingPayment: boolean;
  /** Payment poller state: waiting for webhook confirmation */
  paymentProcessing: boolean;
  /** Payment poller state: confirmed */
  paymentSuccess: boolean;
  /** Reset the success screen so the user can view the invoice again */
  resetPaymentSuccess: () => void;
  /** Clear payment search params after viewing success screen */
  clearPaymentParams: () => void;
  /** Trigger the Stripe Checkout redirect */
  handlePayNow: () => Promise<void>;
  /** Pre-computed derived data (only valid when invoice is non-null) */
  derived: PublicInvoiceDerived;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePublicInvoice(): UsePublicInvoiceReturn {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [lineItems, setLineItems] = useState<PublicInvoiceLineItem[]>([]);
  const [profile, setProfile] = useState<PublicBusinessProfile | null>(null);
  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchInvoice = useCallback(async () => {
    try {
      const { data: payload, error: rpcError } = await supabase
        .rpc('get_public_invoice', { p_token: id });

      if (rpcError || !payload) {
        setError('Invoice not found');
        setLoading(false);
        return;
      }

      const invoiceData = payload.invoice as PublicInvoiceData | undefined;
      if (!invoiceData) {
        setError('Invoice not found');
        setLoading(false);
        return;
      }

      setInvoice(invoiceData);
      setLineItems(payload.line_items || []);
      setProfile(payload.profile || null);
      setBranding(payload.branding || null);
      setLoading(false);
    } catch {
      setError('Failed to load invoice');
      setLoading(false);
    }
  }, [id]);

  // -----------------------------------------------------------------------
  // Payment poller integration
  // -----------------------------------------------------------------------

  const fetchPaymentStatus = useCallback(async (): Promise<string | null> => {
    const { data: payload } = await supabase
      .rpc('get_public_invoice', { p_token: id });
    const invoiceData = payload?.invoice as PublicInvoiceData | undefined;
    return invoiceData?.status ?? null;
  }, [id]);

  const {
    paymentProcessing,
    paymentSuccess,
    resetPaymentSuccess,
  } = usePaymentPoller({
    searchParams,
    fetchStatus: fetchPaymentStatus,
    onConfirmed: () => fetchInvoice(),
    enabled: !!id,
  });

  // -----------------------------------------------------------------------
  // Realtime subscription
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!invoice?.id) return;
    const invoiceId = invoice.id;
    const channel = supabase
      .channel(`invoice-${invoiceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices',
          filter: `id=eq.${invoiceId}`,
        },
        (payload) => {
          const newData = payload.new as Partial<PublicInvoiceData>;
          setInvoice((prev) => (prev ? { ...prev, ...newData } : prev));
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [invoice?.id]);

  // -----------------------------------------------------------------------
  // Initial fetch
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id, fetchInvoice]);

  // -----------------------------------------------------------------------
  // Payment handler
  // -----------------------------------------------------------------------

  const handlePayNow = useCallback(async () => {
    if (!invoice) return;
    setProcessingPayment(true);
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const { data, error: fnError } = await supabase.functions.invoke('create-payment', {
        body: {
          invoice_id: invoice.id,
          success_url: `${baseUrl}?payment=success`,
          cancel_url: `${baseUrl}?payment=cancelled`,
        },
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No payment URL received');
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast({
        title: 'Payment Error',
        description: 'Unable to start payment. Please try again or contact the business.',
        variant: 'destructive',
      });
      setProcessingPayment(false);
    }
  }, [invoice, toast]);

  // -----------------------------------------------------------------------
  // Clear payment URL params
  // -----------------------------------------------------------------------

  const clearPaymentParams = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const primaryColor = branding?.primary_color || '#2563eb';
  const secondaryColor = branding?.secondary_color || '#1e40af';
  const accentColor = branding?.accent_color || '#10b981';
  const logoUrl = branding?.logo_url || profile?.logo_url;
  const showLogo = branding?.show_logo_on_documents ?? true;
  const footerText = branding?.document_footer_text || 'Thank you for your business!';

  const isPaid = invoice?.status === 'paid';
  const isOverdue = !!(invoice?.due_date && isPast(parseISO(invoice.due_date)) && !isPaid);
  const balance = safeNumber(invoice?.total) - safeNumber(invoice?.amount_paid);

  const derived: PublicInvoiceDerived = {
    isPaid,
    isOverdue,
    balance,
    primaryColor,
    secondaryColor,
    accentColor,
    logoUrl,
    showLogo,
    footerText,
  };

  return {
    invoice,
    lineItems,
    profile,
    branding,
    loading,
    error,
    processingPayment,
    paymentProcessing,
    paymentSuccess,
    resetPaymentSuccess,
    clearPaymentParams,
    handlePayNow,
    derived,
  };
}
