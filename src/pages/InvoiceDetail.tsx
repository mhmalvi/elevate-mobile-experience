import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SendNotificationButton } from '@/components/SendNotificationButton';
import { PDFPreviewModal } from '@/components/PDFPreviewModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { cn, safeNumber } from '@/lib/utils';
import { Phone, Mail, DollarSign, Download, Share2, Loader2, Bell, RefreshCw, User, Clock, ArrowLeft, Edit, Receipt } from 'lucide-react';
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

      let pollAttempts = 0;
      const maxPolls = 10;
      const pollInterval = 2000;
      let pollTimeoutId: NodeJS.Timeout;

      const pollForUpdate = async () => {
        pollAttempts++;

        try {
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
              fetchInvoice();
              toast({
                title: 'Invoice Updated',
                description: isPaid ? 'Payment confirmed! Invoice is now marked as paid.' : 'Partial payment received.',
                duration: 5000
              });
              return;
            }
          }

          if (pollAttempts < maxPolls) {
            pollTimeoutId = setTimeout(() => pollForUpdate(), pollInterval);
          } else {
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

      pollTimeoutId = setTimeout(() => pollForUpdate(), 1000);

      return () => {
        if (pollTimeoutId) {
          clearTimeout(pollTimeoutId);
        }
      };
    }
  }, [searchParams, id]);

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
        <div className="min-h-screen scrollbar-hide">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative px-4 pt-8 pb-6">
              <button
                onClick={() => navigate('/invoices')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Invoices</span>
              </button>

              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Invoice Details</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Loading...</h1>
            </div>
          </div>

          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!invoice) return null;

  const balance = (invoice.total || 0) - (invoice.amount_paid || 0);
  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';

  return (
    <MobileLayout showNav={false}>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigate('/invoices')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Invoices</span>
              </button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/invoices/${id}/edit`)}
                className="rounded-full bg-card/50 backdrop-blur-md border-border/50 shadow-sm hover:bg-card/80 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Edit className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{invoice.invoice_number}</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">{invoice.title}</h1>
            {client && (
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="text-sm">{client.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 space-y-6 animate-fade-in pb-48 safe-bottom">
          {/* Status & Date Card */}
          <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</span>
              <div>
                <StatusBadge status={invoice.status || 'draft'} />
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
              <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm space-y-3">
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
              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex justify-between items-start gap-3">
                    <span className="font-semibold text-foreground flex-1">{item.description}</span>
                    <span className="font-bold text-lg text-primary">${safeNumber(item.total).toFixed(2)}</span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground font-medium">
                    <span className="px-2 py-0.5 bg-muted/40 rounded-md">
                      {item.quantity} × ${safeNumber(item.unit_price).toFixed(2)}
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
                <span>${safeNumber(invoice.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>GST (10%)</span>
                <span>${safeNumber(invoice.gst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-muted/20 mt-3">
                <span className="font-bold text-lg uppercase tracking-wider">Total Amount</span>
                <span className="text-4xl font-black">${safeNumber(invoice.total).toFixed(2)}</span>
              </div>

              {invoice.amount_paid > 0 && (
                <div className="pt-4 mt-2 space-y-2 border-t border-muted/20">
                  <div className="flex justify-between text-sm text-success font-bold">
                    <span>Amount Paid</span>
                    <span>-${safeNumber(invoice.amount_paid).toFixed(2)}</span>
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
            <div className="p-5 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm space-y-4">
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
                  className="h-12 rounded-xl bg-background/50 border-border/40"
                />
                <Button onClick={handleRecordPayment} className="h-12 px-6 rounded-xl">
                  Record
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full h-12 text-xs font-bold uppercase tracking-widest rounded-xl border-border/40 bg-background/30 hover:bg-background/50"
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
              <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
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
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">Delete Record</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </MobileLayout>
  );
}
