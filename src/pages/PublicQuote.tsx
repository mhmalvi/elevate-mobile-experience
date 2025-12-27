import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Check, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function PublicQuote() {
  const { id } = useParams();
  const { toast } = useToast();
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Mark as viewed
      if (!quoteData.viewed_at) {
        await supabase
          .from('quotes')
          .update({ viewed_at: new Date().toISOString(), status: quoteData.status === 'sent' ? 'viewed' : quoteData.status })
          .eq('id', id);
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

      setLoading(false);
    } catch (err) {
      setError('Failed to load quote');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!quote) return;
    setAccepting(true);

    const { error } = await supabase
      .from('quotes')
      .update({ 
        status: 'accepted', 
        accepted_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to accept quote', variant: 'destructive' });
    } else {
      toast({ title: 'Quote accepted! 🎉', description: 'Thanks for your business!' });
      fetchQuote();
    }
    setAccepting(false);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b border-border/50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profile?.business_name || 'Quote'}
              </h1>
              {profile?.phone && (
                <p className="text-sm text-muted-foreground">{profile.phone}</p>
              )}
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
                    {item.quantity} × ${Number(item.unit_price).toFixed(2)} / {item.unit}
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
            <span className="text-foreground">${Number(quote.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (10%)</span>
            <span className="text-foreground">${Number(quote.gst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-2 border-t border-border">
            <span className="text-foreground">Total</span>
            <span className="text-primary">${Number(quote.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground">{quote.notes}</p>
          </div>
        )}

        {/* Accept Button */}
        {!isAccepted && !isDeclined && !isExpired && (
          <Button 
            onClick={handleAccept} 
            className="w-full h-14 text-lg shadow-premium"
            disabled={accepting}
          >
            {accepting ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Check className="w-5 h-5 mr-2" />
            )}
            Accept Quote
          </Button>
        )}

        {isAccepted && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl text-center">
            <Check className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="font-semibold text-success">Quote Accepted</p>
            <p className="text-sm text-muted-foreground">
              Accepted on {format(new Date(quote.accepted_at), 'd MMMM yyyy')}
            </p>
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
          <p className="mt-2">Powered by TradieMate</p>
        </div>
      </div>
    </div>
  );
}
