import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SendNotificationButton } from '@/components/SendNotificationButton';
import { PDFPreviewModal } from '@/components/PDFPreviewModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Phone, Mail, MapPin, Calendar, DollarSign, FileText, Download, Share2, Loader2, Eye, Bell, RefreshCw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { RecurringInvoiceHistory } from '@/components/invoices/RecurringInvoiceHistory';
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
    <MobileLayout>
      <PageHeader 
        title={invoice.invoice_number}
        showBack
        action={{
          label: 'Edit',
          onClick: () => navigate(`/invoices/${id}/edit`)
        }}
      />

      <div className="p-4 space-y-4 animate-fade-in">
        {/* Status & Header */}
        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{invoice.title}</h2>
              {invoice.description && (
                <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>
              )}
            </div>
            <StatusBadge status={invoice.status || 'draft'} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium">{format(new Date(invoice.created_at), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Due Date</span>
              <p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : 'Not set'}
                {isOverdue && ' (Overdue)'}
              </p>
            </div>
          </div>
        </div>

        {/* Recurring Invoice Info */}
        {invoice.is_recurring && (
          <div className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-xl border border-primary/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Recurring Invoice</h3>
                <p className="text-xs text-muted-foreground">Auto-generated and sent on schedule</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Frequency</span>
                <p className="font-medium capitalize">{invoice.recurring_interval}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Next Invoice</span>
                <p className="font-medium">
                  {invoice.next_due_date ? format(new Date(invoice.next_due_date), 'dd MMM yyyy') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recurring Invoice History */}
        {invoice.is_recurring && invoice.id && (
          <RecurringInvoiceHistory parentInvoiceId={invoice.id} />
        )}

        {/* Client Info */}
        {client && (
          <div className="p-4 bg-card rounded-xl border">
            <h3 className="font-semibold mb-2">Client</h3>
            <p className="font-medium">{client.name}</p>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="w-4 h-4" /> {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 hover:text-primary">
                  <Mail className="w-4 h-4" /> {client.email}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Line Items */}
        <div className="p-4 bg-card rounded-xl border">
          <h3 className="font-semibold mb-3">Line Items</h3>
          <div className="space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-muted-foreground">
                    {item.quantity} × ${item.unit_price.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium">${item.total.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST (10%)</span>
              <span>${(invoice.gst || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${(invoice.total || 0).toFixed(2)}</span>
            </div>
            {(invoice.amount_paid || 0) > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid</span>
                  <span>-${(invoice.amount_paid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Balance Due</span>
                  <span className={balance > 0 ? 'text-destructive' : 'text-green-600'}>
                    ${balance.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment Recording */}
        {invoice.status !== 'paid' && balance > 0 && (
          <div className="p-4 bg-card rounded-xl border">
            <h3 className="font-semibold mb-3">Record Payment</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Amount (max $${balance.toFixed(2)})`}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <Button onClick={handleRecordPayment}>
                Record
              </Button>
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => {
                setPaymentAmount(balance.toString());
                setTimeout(handleRecordPayment, 100);
              }}
            >
              Mark as Paid in Full
            </Button>
          </div>
        )}

        {/* Primary Actions - Send to Client */}
        {client && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Send to Client</p>
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

        {/* PDF & Share Actions */}
        <div className="flex gap-2">
          <PDFPreviewModal 
            type="invoice" 
            id={id!} 
            documentNumber={invoice.invoice_number} 
          />
          <Button 
            variant="outline" 
            className="flex-1"
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
            {downloadingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            PDF
          </Button>
          
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => {
              const url = `${window.location.origin}/i/${id}`;
              navigator.clipboard.writeText(url);
              toast({ title: 'Link copied!', description: 'Share this link with your client.' });
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        {/* Payment Reminder - Only for overdue invoices */}
        {isOverdue && client?.phone && (
          <Button 
            variant="outline" 
            className="w-full text-warning border-warning/50 hover:bg-warning/10"
            disabled={sendingReminder}
            onClick={async () => {
              setSendingReminder(true);
              try {
                const { data, error } = await supabase.functions.invoke('payment-reminder', {
                  body: { invoice_id: id }
                });
                if (error) throw error;
                toast({ 
                  title: 'Reminder Sent!', 
                  description: `Payment reminder SMS sent to ${client.name}` 
                });
              } catch (err) {
                console.error('Reminder error:', err);
                toast({ 
                  title: 'Failed to send reminder', 
                  description: 'Please try again.', 
                  variant: 'destructive' 
                });
              } finally {
                setSendingReminder(false);
              }
            }}
          >
            {sendingReminder ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bell className="w-4 h-4 mr-2" />
            )}
            Send Payment Reminder
          </Button>
        )}

        {/* Status Actions - Secondary */}
        {invoice.status !== 'paid' && (
          <div className="space-y-2">
            {invoice.status === 'draft' && (
              <Button variant="outline" className="w-full" onClick={() => updateStatus('sent')}>
                Mark as Sent
              </Button>
            )}
            {invoice.status === 'sent' && (
              <Button variant="outline" className="w-full" onClick={() => updateStatus('viewed')}>
                Mark as Viewed
              </Button>
            )}
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="p-4 bg-card rounded-xl border">
            <h3 className="font-semibold mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              Delete Invoice
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}
