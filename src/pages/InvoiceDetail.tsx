import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SendNotificationButton } from '@/components/SendNotificationButton';
import { PDFPreviewModal } from '@/components/PDFPreviewModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { cn } from '@/lib/utils';
import { Phone, Mail, MapPin, Calendar, DollarSign, FileText, Download, Share2, Loader2, Bell, RefreshCw, User, Clock } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Invoice = Tables<'invoices'>;
type Client = Tables<'clients'>;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
}

const statusFlow: Invoice['status'][] = ['draft', 'sent', 'viewed', 'paid'];

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  // Check for payment status in URL and poll for webhook updates
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
        console.log(`[InvoiceDetail] Polling for invoice update, attempt ${pollAttempts}/${maxPolls}`);

        try {
          // Refetch the invoice
          const { data: invoiceData, error } = await supabase
            .from('invoices')
            .select('status, amount_paid, total')
            .eq('id', id)
            .single();

          if (error) {
            console.error('[InvoiceDetail] Error polling invoice:', error);
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
          console.error('[InvoiceDetail] Error in polling:', err);
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

  const fetchInvoice = async () => {
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

    // Fetch client
    if (invoiceData.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', invoiceData.client_id)
        .single();
      setClient(clientData);
    }

    // Fetch line items
    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order');

    setLineItems(items || []);
    setLoading(false);
  };

  const updateStatus = async (status: Invoice['status']) => {
    if (!invoice) return;

    const updates: Partial<Invoice> = { status };
    if (status === 'sent' && !invoice.sent_at) {
      updates.sent_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoice.id);

    if (error) {
      toast({ title: 'Error updating status', variant: 'destructive' });
    } else {
      toast({ title: `Invoice marked as ${status}` });
      fetchInvoice();
    }
  };

  const handleRecordPayment = async () => {
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
      paid_at: isPaidInFull ? new Date().toISOString() : invoice.paid_at
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
        description: isPaidInFull ? 'Invoice marked as paid in full.' : `$${amount.toFixed(2)} recorded.`
      });
      setPaymentAmount('');
      fetchInvoice();
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoice.id);

    if (error) {
      toast({ title: 'Error deleting invoice', variant: 'destructive' });
    } else {
      toast({ title: 'Invoice deleted' });
      navigate('/invoices');
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <PageHeader title="Invoice" showBack />
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!invoice) return null;

  const balance = (invoice.total || 0) - (invoice.amount_paid || 0);
  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';

  return (
    <MobileLayout showNav={false}>
      <PageHeader
        title={invoice.invoice_number}
        showBack
        backPath="/invoices"
        action={{
          label: 'Edit',
          onClick: () => navigate(`/invoices/${id}/edit`)
        }}
      />

      <div className="p-4 space-y-6 animate-fade-in pb-48 safe-bottom">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{invoice.title}</h2>
            {client && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-2 py-1 rounded-md w-fit">
                <User className="w-3.5 h-3.5" />
                {client.name}
              </div>
            )}
          </div>
          <StatusBadge status={invoice.status || 'draft'} className="mt-1" />
        </div>

        {/* Date Matrix Card */}
        <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4 shadow-sm grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Issued</span>
            <div className="flex items-center gap-2 text-sm font-bold">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              {format(new Date(invoice.created_at), 'dd MMM yyyy')}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due Date</span>
            <div className={cn("flex items-center gap-2 text-sm font-bold", isOverdue ? "text-destructive" : "text-foreground")}>
              <Clock className="w-3.5 h-3.5" />
              {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : 'Immediate'}
            </div>
          </div>
        </div>

        {/* Recurring Status Alert */}
        {invoice.is_recurring && (
          <div className="relative overflow-hidden p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-4 group">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 bg-primary/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <RefreshCw className="w-6 h-6 text-primary animate-spin-slow" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground">Recurring: {invoice.recurring_interval}</h3>
              <p className="text-xs text-muted-foreground truncate">Next invoice: {invoice.next_due_date ? format(new Date(invoice.next_due_date), 'dd MMM yyyy') : 'Check schedule'}</p>
            </div>
          </div>
        )}

        {/* Client Contacts Card */}
        {client && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="font-bold text-lg">Recipient</h3>
            </div>
            <div className="p-4 bg-card/60 backdrop-blur-md rounded-2xl border border-border/40 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <a href={`mailto:${client.email}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">
                  {client.email || 'No email provided'}
                </a>
              </div>
              {client.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <a href={`tel:${client.phone}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                    {client.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line Items Container */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="font-bold text-lg">Services & Items</h3>
          </div>
          <div className="space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="p-4 bg-card/60 backdrop-blur-md rounded-2xl border border-border/40 shadow-sm animate-scale-in">
                <div className="flex justify-between items-start gap-3">
                  <span className="font-semibold text-foreground flex-1">{item.description}</span>
                  <span className="font-bold text-lg text-gradient">${Number(item.total).toFixed(2)}</span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground font-medium">
                  <span className="px-2 py-0.5 bg-muted/40 rounded-md">
                    {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Financial Summary Card */}
        <div className="relative overflow-hidden p-6 bg-foreground text-background dark:bg-card dark:text-foreground rounded-3xl shadow-glow transition-all duration-300 hover:shadow-glow-lg border border-border/40">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />

          <div className="space-y-3 relative z-10 font-medium">
            <div className="flex justify-between text-sm opacity-80">
              <span>Subtotal</span>
              <span>${Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm opacity-80">
              <span>GST (10%)</span>
              <span>${Number(invoice.gst).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-end pt-3 border-t border-muted/20 mt-3">
              <span className="font-bold text-lg uppercase tracking-wider">Total Amount</span>
              <span className="text-4xl font-black">${Number(invoice.total).toFixed(2)}</span>
            </div>

            {invoice.amount_paid > 0 && (
              <div className="pt-4 mt-2 space-y-2 border-t border-muted/20">
                <div className="flex justify-between text-sm text-success font-bold">
                  <span>Amount Paid</span>
                  <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Balance Due</span>
                    <div className={cn("text-2xl font-black", balance > 0 ? 'text-destructive' : 'text-success')}>
                      ${balance.toFixed(2)}
                    </div>
                  </div>
                  {balance <= 0 && (
                    <div className="px-3 py-1 rounded-full bg-success/20 text-success text-[10px] font-black uppercase tracking-widest ring-1 ring-success/30">
                      Paid in Full
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <PDFPreviewModal
            type="invoice"
            id={id!}
            documentNumber={invoice.invoice_number}
          />
          <Button
            variant="outline"
            className="h-14 rounded-2xl border-border/40 bg-card/40 backdrop-blur-sm"
            disabled={downloadingPDF}
            onClick={async () => {
              setDownloadingPDF(true);
              try {
                const response = await supabase.functions.invoke('generate-pdf', {
                  body: { type: 'invoice', id }
                });
                if (response.error) throw response.error;
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(response.data.html);
                  printWindow.document.close();
                  printWindow.print();
                }
              } catch (error) {
                console.error('PDF generation error:', error);
                toast({ title: 'Error generating PDF', description: 'Please try again.', variant: 'destructive' });
              } finally {
                setDownloadingPDF(false);
              }
            }}
          >
            {downloadingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2 text-primary" />}
            PDF
          </Button>

          <Button
            variant="outline"
            className="col-span-2 h-14 rounded-2xl border-border/40 bg-card/40 backdrop-blur-sm"
            onClick={async () => {
              const url = `${window.location.origin}/i/${id}`;
              const success = await copyToClipboard(url);
              if (success) {
                toast({ title: 'Link copied!', description: 'Share this link with your client.' });
              }
            }}
          >
            <Share2 className="w-5 h-5 mr-2 text-primary" />
            Copy Share Link
          </Button>

          {/* Send to Client */}
          {client && (
            <div className="col-span-2">
              <SendNotificationButton
                type="invoice"
                id={id!}
                recipient={{
                  email: client.email,
                  phone: client.phone,
                  name: client.name,
                }}
                onSent={fetchInvoice}
              />
            </div>
          )}

          {isOverdue && client?.phone && (
            <Button
              variant="outline"
              className="col-span-2 h-14 rounded-2xl text-warning border-warning/30 bg-warning/5 hover:bg-warning/10"
              disabled={sendingReminder}
              onClick={async () => {
                setSendingReminder(true);
                try {
                  const { error } = await supabase.functions.invoke('payment-reminder', {
                    body: { invoice_id: id }
                  });
                  if (error) throw error;
                  toast({ title: 'Reminder Sent!', description: `SMS reminder sent to ${client.name}` });
                } catch (err) {
                  toast({ title: 'Failed to send reminder', variant: 'destructive' });
                } finally {
                  setSendingReminder(false);
                }
              }}
            >
              <Bell className={cn("w-5 h-5 mr-2", sendingReminder && "animate-bounce")} />
              Send Overdue Reminder
            </Button>
          )}
        </div>

        {/* Payment Recording Card */}
        {invoice.status !== 'paid' && balance > 0 && (
          <div className="p-5 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Record Payment</h3>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                placeholder={`Amount (max $${balance.toFixed(2)})`}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="h-12 bg-background/50 border-border/40"
              />
              <Button onClick={handleRecordPayment} className="h-12 px-6">
                Record
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full h-12 text-xs font-bold uppercase tracking-widest border-border/40 bg-background/30 hover:bg-background/50"
              onClick={() => {
                setPaymentAmount(balance.toString());
                setTimeout(handleRecordPayment, 100);
              }}
            >
              Paid in Full
            </Button>
          </div>
        )}

        {/* Notes & Refresh */}
        <div className="grid grid-cols-1 gap-4">
          {invoice.notes && (
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Internal Notes</h3>
              <p className="text-sm text-foreground/80 leading-relaxed italic">"{invoice.notes}"</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground h-10 rounded-xl"
            onClick={() => {
              fetchInvoice();
              toast({ title: 'Refreshed' });
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Sync Data
          </Button>
        </div>

        {/* Danger Zone */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-destructive/40 hover:text-destructive hover:bg-destructive/5 h-10 text-xs uppercase tracking-widest font-bold">
              Delete Invoice
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone and will remove the financial record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete Record</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}
