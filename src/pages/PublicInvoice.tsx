import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Receipt, Loader2, CreditCard, CheckCircle } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function PublicInvoice() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

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

      // Mark as viewed
      if (!invoiceData.viewed_at) {
        await supabase
          .from('invoices')
          .update({ viewed_at: new Date().toISOString(), status: invoiceData.status === 'sent' ? 'viewed' : invoiceData.status })
          .eq('id', id);
      }

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

  // Check for payment status in URL and poll for updates
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');

    if (paymentStatus === 'cancelled') {
      toast({
        title: 'Payment Cancelled',
        description: 'Your payment was cancelled. You can try again anytime.',
        variant: 'destructive'
      });
      return;
    }

    if (paymentStatus === 'success') {
      toast({
        title: 'Payment Successful!',
        description: 'Thank you for your payment. Updating invoice status...'
      });

      // Poll for invoice status updates
      // Webhooks can take 1-10 seconds, so we poll every 2 seconds for up to 20 seconds
      let pollAttempts = 0;
      const maxPolls = 10;
      const pollInterval = 2000; // 2 seconds
      let pollTimeoutId: NodeJS.Timeout;

      const pollForUpdate = async () => {
        pollAttempts++;
        console.log(`Polling for invoice update, attempt ${pollAttempts}/${maxPolls}`);

        try {
          // Refetch the invoice
          const { data: invoiceData, error } = await supabase
            .from('invoices')
            .select('status, amount_paid, total')
            .eq('id', id)
            .single();

          if (error) {
            console.error('Error polling invoice:', error);
          }

          if (invoiceData) {
            const isPaid = invoiceData.status === 'paid';
            const isPartiallyPaid = invoiceData.status === 'partially_paid';

            if (isPaid || isPartiallyPaid) {
              // Payment status updated! Refetch full invoice data
              fetchInvoice();
              toast({
                title: 'Invoice Updated',
                description: isPaid ? 'Payment confirmed! Invoice is now marked as paid.' : 'Partial payment received.',
                duration: 5000
              });
              return; // Stop polling
            }
          }

          if (pollAttempts < maxPolls) {
            // Continue polling
            pollTimeoutId = setTimeout(() => pollForUpdate(), pollInterval);
          } else {
            // Max attempts reached, do final refetch
            fetchInvoice();
            toast({
              title: 'Status Update Pending',
              description: 'Payment was received. If status does not update, please refresh the page.',
              variant: 'default',
              duration: 7000
            });
          }
        } catch (err) {
          console.error('Error in polling:', err);
        }
      };

      // Start polling after 1 second (give webhook initial time)
      pollTimeoutId = setTimeout(() => pollForUpdate(), 1000);

      // Cleanup function
      return () => {
        if (pollTimeoutId) {
          clearTimeout(pollTimeoutId);
        }
      };
    }
  }, [searchParams, id]); // Removed toast and fetchInvoice from dependencies to avoid infinite loop

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id, fetchInvoice]);

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
                    {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold text-foreground">${Number(item.total).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="p-4 bg-card rounded-xl border border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${Number(invoice.subtotal || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (10%)</span>
            <span className="text-foreground">${Number(invoice.gst || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-2 border-t border-border">
            <span className="text-foreground">Total</span>
            <span style={{ color: primaryColor }}>${Number(invoice.total || 0).toFixed(2)}</span>
          </div>
          {(invoice.amount_paid || 0) > 0 && (
            <>
              <div className="flex justify-between text-sm text-success">
                <span>Amount Paid</span>
                <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
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
