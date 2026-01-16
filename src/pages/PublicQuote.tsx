import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Check, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { safeNumber } from '@/lib/utils';

export default function PublicQuote() {
  const { id } = useParams();
  const { toast } = useToast();
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);

  useEffect(() => {
    if (id) fetchQuote();
  }, [id]);

  const fetchQuote = async () => {
    try {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, clients(*)')
        .eq('id', id)
        .single();

      if (quoteError || !quoteData) {
        setError('Quote not found');
        setLoading(false);
        return;
      }

      setQuote(quoteData);

      // Mark as viewed via Edge Function to bypass RLS
      if (!quoteData.viewed_at && quoteData.status !== 'accepted' && quoteData.status !== 'declined') {
        try {
          await supabase.functions.invoke('accept-quote', {
            body: {
              quote_id: id,
              action: 'view'
            }
          });
        } catch {
          // Ignore failures
        }
      }

      // Fetch line items
      const { data: items } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', id)
        .order('sort_order');
      setLineItems(items || []);

      // Fetch profile for business details
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', quoteData.user_id)
        .single();
      setProfile(profileData);

      // Fetch branding settings
      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('*')
        .eq('user_id', quoteData.user_id)
        .maybeSingle();
      setBranding(brandingData);

      setLoading(false);
    } catch (err) {
      setError('Failed to load quote');
      setLoading(false);
    }
  };

  const handleAccept = async (signatureData?: string) => {
    if (!quote) return;
    setAccepting(true);

    const { error } = await supabase.functions.invoke('accept-quote', {
      body: {
        quote_id: id,
        signature_data: signatureData,
        status: 'accepted'
      }
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to accept quote', variant: 'destructive' });
    } else {
      toast({ title: 'Quote accepted! 🎉', description: 'Thanks for your business!' });
      setShowSignature(false);
      fetchQuote();
    }
    setAccepting(false);
  };

  const handleSignatureComplete = (signatureData: string) => {
    handleAccept(signatureData);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <FileText className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Quote Not Found</h1>
        <p className="text-muted-foreground text-center">
          This quote may have been removed or the link is invalid.
        </p>
      </div>
    );
  }

  const isAccepted = quote.status === 'accepted';
  const isDeclined = quote.status === 'declined';
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();

  // Extract branding values with fallbacks
  const primaryColor = branding?.primary_color || '#3b82f6';
  const logoUrl = branding?.logo_url || profile?.logo_url;
  const showLogo = branding?.show_logo_on_documents ?? true;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b border-border/50 p-6" style={{ background: `linear-gradient(to bottom right, ${primaryColor}15, ${primaryColor}08)` }}>
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
                  {profile?.business_name || 'Quote'}
                </h1>
                {profile?.phone && (
                  <p className="text-sm text-muted-foreground">{profile.phone}</p>
                )}
              </div>
            </div>
            <StatusBadge status={isExpired && !isAccepted ? 'expired' : quote.status} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p><strong>Quote:</strong> {quote.quote_number}</p>
            <p><strong>Date:</strong> {format(new Date(quote.created_at), 'd MMMM yyyy')}</p>
            {quote.valid_until && (
              <p><strong>Valid until:</strong> {format(new Date(quote.valid_until), 'd MMMM yyyy')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Quote Title */}
        <div>
          <h2 className="text-xl font-semibold text-foreground">{quote.title}</h2>
          {quote.description && (
            <p className="text-muted-foreground mt-1">{quote.description}</p>
          )}
        </div>

        {/* Client */}
        {quote.clients && (
          <div className="p-4 bg-card/50 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">Prepared for</p>
            <p className="font-semibold text-foreground">{quote.clients.name}</p>
            {quote.clients.email && (
              <p className="text-sm text-muted-foreground">{quote.clients.email}</p>
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
                    {item.quantity} × ${safeNumber(item.unit_price).toFixed(2)} / {item.unit}
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
            <span className="text-foreground">${safeNumber(quote.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (10%)</span>
            <span className="text-foreground">${safeNumber(quote.gst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-2 border-t border-border">
            <span className="text-foreground">Total</span>
            <span style={{ color: primaryColor }}>${safeNumber(quote.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground">{quote.notes}</p>
          </div>
        )}

        {/* Signature Pad or Accept Button */}
        {!isAccepted && !isDeclined && !isExpired && (
          <>
            {showSignature ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-center text-foreground">Sign to Accept</h3>
                <p className="text-sm text-muted-foreground text-center">
                  By signing below, you accept this quote and agree to the terms.
                </p>
                <SignaturePad onSave={handleSignatureComplete} />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowSignature(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowSignature(true)}
                  className="w-full h-14 text-lg shadow-premium"
                  disabled={accepting}
                >
                  {accepting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5 mr-2" />
                  )}
                  Accept Quote with Signature
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAccept()}
                  className="w-full"
                  disabled={accepting}
                >
                  Accept Without Signature
                </Button>
              </div>
            )}
          </>
        )}

        {isAccepted && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl text-center">
            <Check className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="font-semibold text-success">Quote Accepted</p>
            <p className="text-sm text-muted-foreground">
              Accepted on {format(new Date(quote.accepted_at), 'd MMMM yyyy')}
            </p>
            {quote.signature_data && (
              <div className="mt-4 pt-4 border-t border-success/30">
                <p className="text-xs text-muted-foreground mb-2">Signature</p>
                <img
                  src={quote.signature_data}
                  alt="Customer signature"
                  className="max-w-[200px] h-auto mx-auto bg-background rounded border p-2"
                />
              </div>
            )}
          </div>
        )}

        {isExpired && !isAccepted && (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl text-center">
            <p className="font-semibold text-warning">Quote Expired</p>
            <p className="text-sm text-muted-foreground">
              Please contact {profile?.business_name || 'us'} for an updated quote.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 text-sm text-muted-foreground">
          {profile?.abn && <p>ABN: {profile.abn}</p>}
          {branding?.document_footer_text && (
            <p className="mt-2">{branding.document_footer_text}</p>
          )}
          <p className="mt-2 text-xs">Powered by TradieMate</p>
        </div>
      </div>
    </div>
  );
}