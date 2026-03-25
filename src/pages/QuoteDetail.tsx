import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SendNotificationButton } from '@/components/SendNotificationButton';
import { PDFPreviewModal } from '@/components/PDFPreviewModal';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { User, FileText, Send, Receipt, Download, Share2, Loader2, Briefcase, ArrowLeft, Edit, Camera, Trash2, Image } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { safeNumber } from '@/lib/utils';
import { compressImages } from '@/lib/utils/imageCompression';
import { Tables } from '@/integrations/supabase/types';

type Quote = Tables<'quotes'> & { clients?: { name: string; email: string | null; phone: string | null } | null };
type QuoteLineItem = Tables<'quote_line_items'>;

const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined'] as const;

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { team } = useTeam();
  const { toast } = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { printing: downloadingPDF, handlePrint } = usePrintDocument({
    documentType: 'quote',
    documentId: id || '',
  });

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase.storage
      .from('quote-photos')
      .list(`${id}`, { limit: 20 });

    if (data && data.length > 0) {
      const urls = data.map(file => {
        const { data: urlData } = supabase.storage
          .from('quote-photos')
          .getPublicUrl(`${id}/${file.name}`);
        return urlData.publicUrl;
      });
      setPhotos(urls);
    }
  }, [id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    setUploading(true);

    try {
      // Compress images before upload to save mobile data
      const compressedFiles = await compressImages(Array.from(files));

      for (const file of compressedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${id}/${fileName}`;

        const { error } = await supabase.storage
          .from('quote-photos')
          .upload(filePath, file);

        if (error) {
          toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        }
      }

      await fetchPhotos();
      toast({ title: 'Photos uploaded! 📸' });
    } catch (error) {
      toast({ title: 'Compression failed', description: 'Could not process images', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    const fileName = photoUrl.split('/').pop();
    if (!fileName || !id) return;

    const { error } = await supabase.storage
      .from('quote-photos')
      .remove([`${id}/${fileName}`]);

    if (!error) {
      setPhotos(photos.filter(p => p !== photoUrl));
      toast({ title: 'Photo removed' });
    }
  };

  const fetchQuote = useCallback(async () => {
    if (!user) return;
    const [quoteRes, itemsRes] = await Promise.all([
      supabase.from('quotes').select('*, clients(name, email, phone)').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('quote_line_items').select('*').eq('quote_id', id).is('deleted_at', null).order('sort_order'),
    ]);
    if (quoteRes.error || !quoteRes.data) {
      toast({ title: 'Quote not found', variant: 'destructive' });
      navigate('/quotes');
      return;
    }
    setQuote(quoteRes.data);
    setLineItems(itemsRes.data || []);
    setLoading(false);
  }, [id, user, toast, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchQuote();
      fetchPhotos();
    }
  }, [user, id, fetchQuote, fetchPhotos]);

  const updateStatus = async (status: string) => {
    const updates: Record<string, string> = { status };
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
      team_id: team?.id || null,
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

    const invoiceNumber = await (async () => {
      const { data, error } = await supabase.rpc('get_next_document_number', { p_document_type: 'invoice' });
      if (error || !data) {
        return `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
      }
      return data as string;
    })();

    const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
      user_id: user?.id,
      team_id: team?.id || null,
      client_id: quote.client_id,
      quote_id: quote.id,
      invoice_number: invoiceNumber,
      title: quote.title,
      description: quote.description,
      notes: quote.notes,
      subtotal: quote.subtotal,
      gst: quote.gst,
      total: quote.total,
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
    }).select().single();

    if (invoiceError) {
      toast({ title: 'Error', description: invoiceError.message, variant: 'destructive' });
      return;
    }

    // Copy line items — rollback orphaned invoice on failure
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

    const { error: lineItemsError } = await supabase.from('invoice_line_items').insert(invoiceItems);

    if (lineItemsError) {
      // Rollback: delete the orphaned invoice
      await supabase.from('invoices').delete().eq('id', invoice.id);
      toast({ title: 'Error', description: 'Failed to create line items. Invoice rolled back.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Invoice created from quote' });
    navigate(`/invoices/${invoice.id}`);
  };

  if (loading || !quote) {
    return (
      <MobileLayout showNav={false}>
        <div className="min-h-screen scrollbar-hide">
          {/* Hero Section */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative px-4 pt-8 pb-6">
              <button
                onClick={() => navigate('/quotes')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Quotes</span>
              </button>

              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Quote Details</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Loading...</h1>
            </div>
          </div>

          <div className="p-4 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </MobileLayout>
    );
  }

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
                onClick={() => navigate('/quotes')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Quotes</span>
              </button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/quotes/${id}/edit`)}
                className="rounded-full bg-card/50 backdrop-blur-md border-border/50 shadow-sm hover:bg-card/80 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Edit className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{quote.quote_number}</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">{quote.title}</h1>
            {quote.clients && (
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="text-sm">{quote.clients.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 space-y-6 animate-fade-in pb-48 safe-bottom">
          {/* Status Card */}
          <div className="flex items-center justify-between p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</span>
              <div className="mt-1">
                <StatusBadge status={quote.status} />
              </div>
            </div>
            <Select value={quote.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-[140px] h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Line Items Container */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="font-bold text-lg">Line Items</h3>
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
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="px-2 py-0.5 bg-muted/40 rounded-md">
                      {item.quantity} × ${safeNumber(item.unit_price).toFixed(2)} / {item.unit}
                    </span>
                    <span className="capitalize px-2 py-0.5 bg-primary/5 text-primary/70 rounded-md font-medium">
                      {item.item_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Premium Totals Card */}
          <div className="relative overflow-hidden p-6 bg-primary text-primary-foreground rounded-3xl shadow-glow transition-all duration-300 hover:shadow-glow-lg">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-black/10 rounded-full blur-2xl" />

            <div className="space-y-3 relative z-10">
              <div className="flex justify-between text-sm font-medium opacity-80">
                <span>Subtotal</span>
                <span>${safeNumber(quote.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium opacity-80">
                <span>GST (10%)</span>
                <span>${safeNumber(quote.gst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-white/20 mt-3">
                <span className="font-bold text-lg uppercase tracking-wider">Total Amount</span>
                <span className="text-4xl font-black">${safeNumber(quote.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            <PDFPreviewModal
              type="quote"
              id={id!}
              documentNumber={quote.quote_number}
            />
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-border/40 bg-card/40 backdrop-blur-sm"
              disabled={downloadingPDF}
              onClick={handlePrint}
            >
              {downloadingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2 text-primary" />}
              PDF
            </Button>

            <Button
              variant="outline"
              className="col-span-2 h-14 rounded-2xl border-border/40 bg-card/40 backdrop-blur-sm"
              onClick={async () => {
                const publicToken = quote?.public_token || id;
                const url = `${window.location.origin}/q/${publicToken}`;
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
            {quote.clients && (
              <div className="col-span-2">
                <SendNotificationButton
                  type="quote"
                  id={id!}
                  publicToken={quote?.public_token}
                  recipient={{
                    email: quote.clients.email,
                    phone: quote.clients.phone,
                    name: quote.clients.name,
                  }}
                  onSent={fetchQuote}
                />
              </div>
            )}

            {quote.status === 'accepted' && (
              <div className="col-span-2 grid grid-cols-2 gap-3 mt-4">
                <Button onClick={convertToJob} className="h-12 rounded-xl bg-gradient-to-r from-success to-success/80 border-none shadow-premium">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Job
                </Button>
                <Button onClick={convertToInvoice} variant="outline" className="h-12 rounded-xl border-success/30 text-success hover:bg-success/5">
                  <Receipt className="w-4 h-4 mr-2" />
                  Invoice
                </Button>
              </div>
            )}

            {quote.status === 'draft' && (
              <Button onClick={() => updateStatus('sent')} className="col-span-2 h-14 rounded-2xl gradient-primary shadow-glow mt-4">
                <Send className="w-5 h-5 mr-2" />
                Mark as Sent & Send to Client
              </Button>
            )}
          </div>

          {/* Photo Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                <h3 className="font-bold text-lg">Photos</h3>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button size="sm" variant="outline" asChild disabled={uploading} className="rounded-full shadow-sm hover:shadow-glow-sm">
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Camera className="w-4 h-4 mr-1 text-primary" />}
                    Upload
                  </span>
                </Button>
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-video group overflow-hidden rounded-2xl shadow-sm hover:shadow-premium-lg transition-all duration-300">
                    <img
                      src={photo}
                      alt={`Quote photo ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="w-10 h-10 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-card/80 backdrop-blur-sm rounded-2xl border border-dashed border-border/60">
                <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Image className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">No quote photos yet</p>
              </div>
            )}
          </div>

          {/* Notes Section */}
          {quote.notes && (
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Internal Notes</h3>
              <p className="text-sm text-foreground/80 leading-relaxed italic">"{quote.notes}"</p>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
