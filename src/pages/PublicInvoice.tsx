import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Check for payment status in URL
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast({ 
        title: 'Payment Successful!', 
        description: 'Thank you for your payment. The invoice has been updated.'
      });
    } else if (paymentStatus === 'cancelled') {
      toast({ 
        title: 'Payment Cancelled', 
        description: 'Your payment was cancelled. You can try again anytime.',
        variant: 'destructive'
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
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

      setLoading(false);
    } catch (err) {
      setError('Failed to load invoice');
      setLoading(false);
    }
  };

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

  const handlePayNow = async () => {
    setProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          invoice_id: id,
          success_url: window.location.href,
          cancel_url: window.location.href,
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
      <div className={`border-b border-border/50 p-6 ${isOverdue ? 'bg-warning/10' : 'bg-gradient-to-br from-primary/10 to-primary/5'}`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profile?.business_name || 'Tax Invoice'}
              </h1>
              {profile?.phone && (
                <p className="text-sm text-muted-foreground">{profile.phone}</p>
              )}
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
            <span className="text-foreground">${Number(invoice.total || 0).toFixed(2)}</span>
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
          <p className="mt-2">Thank you for your business!</p>
          <p className="mt-1 text-xs">Powered by TradieMate</p>
        </div>
      </div>
    </div>
  );
}
