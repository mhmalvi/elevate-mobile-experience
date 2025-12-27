import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, FileText, Send, Receipt, Download, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined'] as const;

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchQuote();
    }
  }, [user, id]);

  const fetchQuote = async () => {
    const [quoteRes, itemsRes] = await Promise.all([
      supabase.from('quotes').select('*, clients(name, email, phone)').eq('id', id).single(),
      supabase.from('quote_line_items').select('*').eq('quote_id', id).order('sort_order'),
    ]);
    setQuote(quoteRes.data);
    setLineItems(itemsRes.data || []);
    setLoading(false);
  };

  const updateStatus = async (status: string) => {
    const updates: any = { status };
    if (status === 'sent' && !quote.sent_at) updates.sent_at = new Date().toISOString();
    if (status === 'accepted') updates.accepted_at = new Date().toISOString();
    if (status === 'declined') updates.declined_at = new Date().toISOString();

    const { error } = await supabase.from('quotes').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status updated' });
      fetchQuote();
    }
  };

  const convertToJob = async () => {
    if (!quote) return;
    
    const { data: job, error } = await supabase.from('jobs').insert({
      user_id: user?.id,
      client_id: quote.client_id,
      quote_id: quote.id,
      title: quote.title,
      description: quote.description,
      status: 'approved',
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Job created from quote' });
      navigate(`/jobs/${job.id}`);
    }
  };

  const convertToInvoice = async () => {
    if (!quote) return;
    
    const invoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
      user_id: user?.id,
      client_id: quote.client_id,
      quote_id: quote.id,
      invoice_number: invoiceNumber,
      title: quote.title,
      description: quote.description,
      subtotal: quote.subtotal,
      gst: quote.gst,
      total: quote.total,
      status: 'draft',
    }).select().single();

    if (invoiceError) {
      toast({ title: 'Error', description: invoiceError.message, variant: 'destructive' });
      return;
    }

    // Copy line items
    const invoiceItems = lineItems.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total: item.total,
      item_type: item.item_type,
      sort_order: index,
    }));

    await supabase.from('invoice_line_items').insert(invoiceItems);
    
    toast({ title: 'Invoice created from quote' });
    navigate(`/invoices/${invoice.id}`);
  };

  if (loading || !quote) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title="Quote" showBack backPath="/quotes" />
        <div className="p-4 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <PageHeader title={quote.quote_number} showBack backPath="/quotes" />
      
      <div className="p-4 space-y-6 animate-fade-in pb-32">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{quote.title}</h2>
            <StatusBadge status={quote.status} />
          </div>
          {quote.clients && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              {quote.clients.name}
            </div>
          )}
        </div>

        {/* Status Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={quote.status} onValueChange={updateStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUOTE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Line Items */}
        <div className="space-y-2">
          <h3 className="font-semibold">Line Items</h3>
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="p-3 bg-card rounded-lg border">
                <div className="flex justify-between">
                  <span className="font-medium">{item.description}</span>
                  <span className="font-semibold">${Number(item.total).toFixed(2)}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × ${Number(item.unit_price).toFixed(2)} / {item.unit}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="p-4 bg-muted rounded-xl space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>${Number(quote.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>GST (10%)</span>
            <span>${Number(quote.gst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span>${Number(quote.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => {
              const url = `${window.location.origin}/q/${id}`;
              navigator.clipboard.writeText(url);
              toast({ title: 'Link copied!', description: 'Share this link with your client.' });
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Copy Share Link
          </Button>
          
          {quote.status === 'accepted' && (
            <>
              <Button onClick={convertToJob} className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                Convert to Job
              </Button>
              <Button onClick={convertToInvoice} variant="outline" className="w-full">
                <Receipt className="w-4 h-4 mr-2" />
                Convert to Invoice
              </Button>
            </>
          )}
          {quote.status === 'draft' && (
            <Button onClick={() => updateStatus('sent')} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Mark as Sent
            </Button>
          )}
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="space-y-2">
            <h3 className="font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">{quote.notes}</p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
