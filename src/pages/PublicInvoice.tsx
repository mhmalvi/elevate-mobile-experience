import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Receipt, Loader2, CreditCard, CheckCircle, PartyPopper, ArrowLeft } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { safeNumber } from '@/lib/utils';

export default function PublicInvoice() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const realtimeChannelRef = useRef<any>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, clients(*)')
        .eq('id', id)
        .single();

      if (invoiceError || !invoiceData) {
        setError('Invoice not found');
        setLoading(false);
        return;
      }

      setInvoice(invoiceData);

      // Note: We don't try to update viewed_at for anonymous users since they don't have
      // permission to update invoices. The viewed_at is tracked by the owner when they
      // send the invoice via the app.

      // Fetch line items
      const { data: items } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order');
      setLineItems(items || []);

      // Fetch profile for business details
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .single();
      setProfile(profileData);

      // Fetch branding settings
      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .maybeSingle();
      setBranding(brandingData);

      setLoading(false);
    } catch (err) {
      setError('Failed to load invoice');
      setLoading(false);
    }
  }, [id]);

  // Set up realtime subscription for invoice updates
  useEffect(() => {
    if (!id) return;

    // Subscribe to realtime updates for this invoice
    // Note: Realtime may not be available for public/anonymous users
    // We have fallback polling in the payment success handler
    const channel = supabase
      .channel(`invoice-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Invoice updated via realtime:', payload.new);
          const newData = payload.new as any;

          // Update invoice state with new data
          setInvoice((prev: any) => ({
            ...prev,
            ...newData
          }));

          // If payment was just confirmed, show success state
          if (newData.status === 'paid' || newData.status === 'partially_paid') {
            setPaymentProcessing(false);
            setPaymentSuccess(true);
          }
        }
      )
      .subscribe((status, err) => {
        // Gracefully handle subscription errors (common for anonymous users)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('Realtime subscription not available, using polling fallback');
        }
        if (err) {
          // Suppress WebSocket errors for public pages - we have polling fallback
          console.log('Realtime error (using polling fallback):', err.message);
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [id]);

  // Check for payment status in URL
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');

    if (paymentStatus === 'cancelled') {
      toast({
        title: 'Payment Cancelled',
        description: 'Your payment was cancelled. You can try again anytime.',
        variant: 'destructive'
      });
      // Clear the payment param from URL
      setSearchParams({});
      return;
    }

    if (paymentStatus === 'success') {
      setPaymentProcessing(true);

      // Check if invoice is already marked as paid (webhook might have processed already)
      const checkPaymentStatus = async () => {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('status, amount_paid, total')
          .eq('id', id)
          .single();

        if (invoiceData) {
          const isPaidOrPartial = invoiceData.status === 'paid' || invoiceData.status === 'partially_paid';

          if (isPaidOrPartial) {
            // Payment already processed
            setPaymentProcessing(false);
            setPaymentSuccess(true);
            fetchInvoice();
          } else {
            // Wait for realtime update (with fallback timeout)
            setTimeout(() => {
              // After 15 seconds, check one more time
              supabase
                .from('invoices')
                .select('status, amount_paid, total')
                .eq('id', id)
                .single()
                .then(({ data }) => {
                  if (data && (data.status === 'paid' || data.status === 'partially_paid')) {
                    setPaymentProcessing(false);
                    setPaymentSuccess(true);
                    fetchInvoice();
                  } else {
                    // Still not updated, but payment went through
                    setPaymentProcessing(false);
                    setPaymentSuccess(true);
                    toast({
                      title: 'Payment Received',
                      description: 'Your payment was successful. The invoice status will update shortly.',
                      duration: 5000
                    });
                  }
                });
            }, 15000);
          }
        }
      };

      checkPaymentStatus();
    }
  }, [searchParams, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id, fetchInvoice]);

  // Payment Processing Screen
  if (paymentProcessing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
            <div className="absolute -inset-4 rounded-full border-4 border-primary/20 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Processing Payment</h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment...
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>

          <p className="text-xs text-muted-foreground/70">
            This usually takes just a few seconds
          </p>
        </div>
      </div>
    );
  }

  // Payment Success Screen
  if (paymentSuccess && invoice) {
    const amountPaid = invoice.amount_paid || invoice.total || 0;
    const primaryColorValue = branding?.primary_color || '#3b82f6';

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Success Animation */}
          <div className="relative">
            <div
              className="w-24 h-24 mx-auto rounded-full flex items-center justify-center animate-in zoom-in-50 duration-500"
              style={{ backgroundColor: `${primaryColorValue}15` }}
            >
              <CheckCircle className="w-14 h-14 text-success" />
            </div>
            <div className="absolute -top-2 -right-2">
              <PartyPopper className="w-8 h-8 text-warning animate-bounce" />
            </div>
          </div>

          <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-200">
            <h1 className="text-2xl font-bold text-foreground">Payment Successful!</h1>
            <p className="text-muted-foreground">
              Thank you for your payment
            </p>
          </div>

          {/* Payment Details Card */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-300">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Invoice</span>
              <span className="font-medium text-foreground">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Amount Paid</span>
              <span className="text-2xl font-bold" style={{ color: primaryColorValue }}>
                ${safeNumber(amountPaid).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          {/* Business Info */}
          {profile && (
            <div className="text-sm text-muted-foreground animate-in fade-in-0 duration-500 delay-400">
              <p>Payment received by</p>
              <p className="font-medium text-foreground">{profile.business_name}</p>
            </div>
          )}

          {/* Action Button */}
          <Button
            variant="outline"
            className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-500"
            onClick={() => {
              setPaymentSuccess(false);
              setSearchParams({});
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            View Invoice Details
          </Button>

          <p className="text-xs text-muted-foreground/70 pt-4">
            A confirmation email has been sent to the business owner
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Receipt className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Invoice Not Found</h1>
        <p className="text-muted-foreground text-center">
          This invoice may have been removed or the link is invalid.
        </p>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.due_date && isPast(parseISO(invoice.due_date)) && !isPaid;
  const balance = (invoice.total || 0) - (invoice.amount_paid || 0);

  // Extract branding values with fallbacks
  const primaryColor = branding?.primary_color || '#3b82f6';
  const logoUrl = branding?.logo_url || profile?.logo_url;
  const showLogo = branding?.show_logo_on_documents ?? true;

  const handlePayNow = async () => {
    setProcessingPayment(true);
    try {
      // Construct base URL without query parameters
      const baseUrl = window.location.origin + window.location.pathname;

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          invoice_id: id,
          success_url: `${baseUrl}?payment=success`,
          cancel_url: `${baseUrl}?payment=cancelled`,
        }
      });

      if (error) throw error;

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
        variant: 'destructive'
      });
      setProcessingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div
        className="border-b border-border/50 p-6"
        style={{ background: isOverdue ? 'rgba(251, 191, 36, 0.1)' : `linear-gradient(to bottom right, ${primaryColor}15, ${primaryColor}08)` }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {showLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt="Business logo"
                  className="max-w-[120px] max-h-[60px] object-contain"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {profile?.business_name || 'Tax Invoice'}
                </h1>
                {profile?.phone && (
                  <p className="text-sm text-muted-foreground">{profile.phone}</p>
                )}
              </div>
            </div>
            <StatusBadge status={isOverdue ? 'overdue' : invoice.status} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p><strong>Invoice:</strong> {invoice.invoice_number}</p>
            <p><strong>Date:</strong> {format(new Date(invoice.created_at), 'd MMMM yyyy')}</p>
            {invoice.due_date && (
              <p className={isOverdue ? 'text-warning font-medium' : ''}>
                <strong>Due:</strong> {format(new Date(invoice.due_date), 'd MMMM yyyy')}
                {isOverdue && ' (OVERDUE)'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Invoice Title */}
        <div>
          <h2 className="text-xl font-semibold text-foreground">{invoice.title}</h2>
          {invoice.description && (
            <p className="text-muted-foreground mt-1">{invoice.description}</p>
          )}
        </div>

        {/* Client */}
        {invoice.clients && (
          <div className="p-4 bg-card/50 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Bill To</p>
            <p className="font-semibold text-foreground">{invoice.clients.name}</p>
            {invoice.clients.address && (
              <p className="text-sm text-muted-foreground">{invoice.clients.address}</p>
            )}
            {invoice.clients.email && (
              <p className="text-sm text-muted-foreground">{invoice.clients.email}</p>
            )}
          </div>
        )}

        {/* Line Items */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Items</h3>
          {lineItems.map((item) => (
            <div key={item.id} className="p-4 bg-card/50 rounded-xl border border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × ${safeNumber(item.unit_price).toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold text-foreground">${safeNumber(item.total).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="p-4 bg-card rounded-xl border border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${safeNumber(invoice.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (10%)</span>
            <span className="text-foreground">${safeNumber(invoice.gst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-2 border-t border-border">
            <span className="text-foreground">Total</span>
            <span style={{ color: primaryColor }}>${safeNumber(invoice.total).toFixed(2)}</span>
          </div>
          {(invoice.amount_paid || 0) > 0 && (
            <>
              <div className="flex justify-between text-sm text-success">
                <span>Amount Paid</span>
                <span>-${safeNumber(invoice.amount_paid).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-2 border-t border-border">
                <span className="text-foreground">Balance Due</span>
                <span className={balance > 0 ? 'text-primary' : 'text-success'}>
                  ${balance.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Bank Details */}
        {(profile?.bank_name || profile?.bank_bsb) && !isPaid && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <h3 className="font-semibold text-foreground mb-3">Payment Details</h3>
            <div className="space-y-2 text-sm">
              {profile.bank_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium text-foreground">{profile.bank_name}</span>
                </div>
              )}
              {profile.bank_account_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Name</span>
                  <span className="font-medium text-foreground">{profile.bank_account_name}</span>
                </div>
              )}
              {profile.bank_bsb && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BSB</span>
                  <span className="font-medium text-foreground">{profile.bank_bsb}</span>
                </div>
              )}
              {profile.bank_account_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-medium text-foreground">{profile.bank_account_number}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Please use invoice number as payment reference
            </p>
          </div>
        )}

        {/* Paid Status */}
        {isPaid && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl text-center">
            <p className="font-semibold text-success text-lg">PAID</p>
            {invoice.paid_at && (
              <p className="text-sm text-muted-foreground">
                Payment received {format(new Date(invoice.paid_at), 'd MMMM yyyy')}
              </p>
            )}
          </div>
        )}

        {/* Pay Now Button */}
        {!isPaid && balance > 0 && (
          <Button 
            onClick={handlePayNow} 
            disabled={processingPayment}
            className="w-full h-14 text-lg shadow-premium"
            size="lg"
          >
            {processingPayment ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay Now - ${balance.toFixed(2)}
              </>
            )}
          </Button>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 text-sm text-muted-foreground">
          {profile?.abn && <p>ABN: {profile.abn}</p>}
          {(profile as any)?.license_number && <p>License: {(profile as any).license_number}</p>}
          {branding?.document_footer_text && (
            <p className="mt-2">{branding.document_footer_text}</p>
          )}
          <p className="mt-2 text-xs">Powered by TradieMate</p>
        </div>
      </div>
    </div>
  );
}
