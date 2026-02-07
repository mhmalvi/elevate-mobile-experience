import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
      toast({ title: 'Quote accepted!', description: 'Thanks for your business!' });
      setShowSignature(false);
      fetchQuote();
    }
    setAccepting(false);
  };

  const handleSignatureComplete = (signatureData: string) => {
    handleAccept(signatureData);
  };

  // --- Branding ---
  const primaryColor = branding?.primary_color || '#2563eb';
  const secondaryColor = branding?.secondary_color || '#1e40af';
  const accentColor = branding?.accent_color || '#10b981';
  const logoUrl = branding?.logo_url || profile?.logo_url;
  const showLogo = branding?.show_logo_on_documents ?? true;
  const footerText = branding?.document_footer_text || 'Thank you for your business!';

  const formatCurrency = (amount: number) => `$${safeNumber(amount).toFixed(2)}`;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return format(new Date(dateStr), 'dd MMM yyyy');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <FileText className="w-16 h-16 text-gray-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Quote Not Found</h1>
        <p className="text-gray-500 text-center">
          This quote may have been removed or the link is invalid.
        </p>
      </div>
    );
  }

  const isAccepted = quote.status === 'accepted';
  const isDeclined = quote.status === 'declined';
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const client = quote.clients;

  // ====================================================================
  // PROFESSIONAL QUOTE DESIGN — matches generate-pdf/improved-template
  // ====================================================================
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Expired Banner */}
      {isExpired && !isAccepted && (
        <div style={{ backgroundColor: '#fef3c7', borderBottom: '1px solid #fcd34d', padding: '10px 16px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
            This quote has expired. Please contact {profile?.business_name || 'us'} for an updated quote.
          </span>
        </div>
      )}

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ background: '#ffffff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

          {/* ========== HEADER ========== */}
          <div style={{ padding: '28px 32px 20px', borderBottom: `2px solid ${primaryColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              {/* Business Info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                {showLogo && logoUrl && (
                  <div style={{ marginBottom: 10 }}>
                    <img src={logoUrl} alt="Logo" style={{ maxWidth: 140, maxHeight: 56, objectFit: 'contain', display: 'block' }} />
                  </div>
                )}
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: -0.5, margin: 0, lineHeight: 1.3 }}>
                  {profile?.business_name || 'Quote'}
                </h1>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7, marginTop: 4 }}>
                  {profile?.address && <p style={{ margin: 0 }}>{profile.address}</p>}
                  {profile?.phone && <p style={{ margin: 0 }}>{profile.phone}</p>}
                  {profile?.email && <p style={{ margin: 0 }}>{profile.email}</p>}
                </div>
              </div>

              {/* Document Badge & Meta */}
              <div style={{ textAlign: 'right', minWidth: 180 }}>
                <div style={{
                  display: 'inline-block',
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  color: '#ffffff',
                  padding: '7px 18px',
                  borderRadius: 6,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}>
                  QUOTE
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                  #{quote.quote_number}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                  <p style={{ margin: 0 }}><strong style={{ color: '#374151', fontWeight: 600 }}>Date:</strong> {formatDate(quote.created_at)}</p>
                  {quote.valid_until && (
                    <p style={{ margin: 0, color: isExpired && !isAccepted ? '#dc2626' : '#6b7280', fontWeight: isExpired && !isAccepted ? 600 : 400 }}>
                      <strong style={{ color: isExpired && !isAccepted ? '#dc2626' : '#374151', fontWeight: 600 }}>Valid Until:</strong> {formatDate(quote.valid_until)}
                      {isExpired && !isAccepted && ' (EXPIRED)'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========== BODY ========== */}
          <div style={{ padding: '24px 32px 32px' }}>

            {/* Title & Description */}
            {quote.title && (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0, lineHeight: 1.3 }}>{quote.title}</h2>
                {quote.description && (
                  <div style={{ marginTop: 8, padding: 12, background: '#fef3c7', borderLeft: `3px solid #f59e0b`, borderRadius: 3, fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
                    {quote.description}
                  </div>
                )}
              </div>
            )}

            {/* Client & Document Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              {/* Quote For */}
              {client && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: primaryColor, marginBottom: 10 }}>
                    Quote For
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                    {client.address && <p style={{ margin: 0 }}>{client.address}</p>}
                    {(client.suburb || client.state || client.postcode) && (
                      <p style={{ margin: 0 }}>{[client.suburb, client.state, client.postcode].filter(Boolean).join(', ')}</p>
                    )}
                    {client.phone && <p style={{ margin: 0 }}>{client.phone}</p>}
                    {client.email && <p style={{ margin: 0 }}>{client.email}</p>}
                  </div>
                </div>
              )}

              {/* Document Details */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: primaryColor, marginBottom: 10 }}>
                  Document Details
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>
                  <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Number:</strong> {quote.quote_number}</p>
                  <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Date:</strong> {formatDate(quote.created_at)}</p>
                  {quote.valid_until && (
                    <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Valid Until:</strong> {formatDate(quote.valid_until)}</p>
                  )}
                  {profile?.abn && (
                    <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>ABN:</strong> {profile.abn}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ========== LINE ITEMS TABLE ========== */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(to bottom, #f9fafb, #f3f4f6)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                      Description
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6b7280', borderBottom: '1px solid #e5e7eb', width: '15%' }}>
                      Qty
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6b7280', borderBottom: '1px solid #e5e7eb', width: '18%' }}>
                      Unit Price
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6b7280', borderBottom: '1px solid #e5e7eb', width: '18%' }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: idx < lineItems.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 2 }}>{item.description}</div>
                        {item.item_type && (
                          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' }}>{item.item_type}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                        {item.quantity || 1} {item.unit || 'ea'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px 14px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                        No items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ========== TOTALS ========== */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <div style={{ minWidth: 280, maxWidth: 340, width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#6b7280' }}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 10px', fontSize: 13, color: '#6b7280', borderBottom: '1px solid #e5e7eb', marginBottom: 6 }}>
                  <span>GST (10%)</span>
                  <span>{formatCurrency(quote.gst)}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  color: '#ffffff', fontSize: 18, fontWeight: 700,
                  padding: '12px 16px', margin: '0 -16px -16px', borderRadius: '0 0 8px 8px',
                }}>
                  <span>Total AUD</span>
                  <span>{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>

            {/* ========== ACCEPT / SIGNATURE ========== */}
            {!isAccepted && !isDeclined && !isExpired && (
              <div style={{ marginBottom: 20 }}>
                {showSignature ? (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', textAlign: 'center', marginBottom: 4 }}>Sign to Accept</h3>
                    <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
                      By signing below, you accept this quote and agree to the terms.
                    </p>
                    <SignaturePad onSave={handleSignatureComplete} />
                    <div style={{ marginTop: 12 }}>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowSignature(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => setShowSignature(true)}
                      disabled={accepting}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '14px 24px', fontSize: 16, fontWeight: 700, color: '#ffffff', border: 'none', cursor: 'pointer',
                        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                        borderRadius: 8, boxShadow: `0 4px 14px ${primaryColor}40`,
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        opacity: accepting ? 0.7 : 1,
                      }}
                      onMouseEnter={e => { if (!accepting) { (e.target as any).style.transform = 'translateY(-1px)'; (e.target as any).style.boxShadow = `0 6px 20px ${primaryColor}50`; } }}
                      onMouseLeave={e => { (e.target as any).style.transform = 'translateY(0)'; (e.target as any).style.boxShadow = `0 4px 14px ${primaryColor}40`; }}
                    >
                      <Check style={{ width: 20, height: 20 }} />
                      Accept Quote with Signature
                    </button>
                    <button
                      onClick={() => handleAccept()}
                      disabled={accepting}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '12px 24px', fontSize: 14, fontWeight: 600,
                        color: '#374151', backgroundColor: '#ffffff',
                        border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        opacity: accepting ? 0.7 : 1,
                      }}
                      onMouseEnter={e => { (e.target as any).style.backgroundColor = '#f9fafb'; }}
                      onMouseLeave={e => { (e.target as any).style.backgroundColor = '#ffffff'; }}
                    >
                      {accepting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                      ) : (
                        'Accept Without Signature'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ========== ACCEPTED STATUS ========== */}
            {isAccepted && (
              <div style={{
                background: `${accentColor}10`, border: `1px solid ${accentColor}30`,
                borderRadius: 8, padding: '20px 24px', textAlign: 'center', marginBottom: 20,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: `${accentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Check style={{ width: 28, height: 28, color: accentColor }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: accentColor, marginBottom: 4 }}>Quote Accepted</div>
                {quote.accepted_at && (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Accepted on {formatDate(quote.accepted_at)}
                  </div>
                )}
                {quote.signature_data && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${accentColor}30` }}>
                    <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Customer Signature</p>
                    <img
                      src={quote.signature_data}
                      alt="Customer signature"
                      style={{ maxWidth: 220, height: 'auto', margin: '0 auto', display: 'block', background: '#ffffff', borderRadius: 6, border: '1px solid #e5e7eb', padding: 8 }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ========== DECLINED STATUS ========== */}
            {isDeclined && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '16px 20px', textAlign: 'center', marginBottom: 20,
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Quote Declined</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Please contact {profile?.business_name || 'us'} if you'd like to discuss further.
                </div>
              </div>
            )}

            {/* ========== NOTES ========== */}
            {quote.notes && (
              <div style={{
                background: '#fef9f5', border: '1px solid #fed7aa', borderRadius: 8,
                padding: 14, marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13, color: '#7c2d12', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{quote.notes}</div>
              </div>
            )}

            {/* ========== TERMS ========== */}
            {(quote.terms || branding?.default_quote_terms) && (
              <div style={{ background: '#ffffff', border: '1px solid #f3f4f6', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Terms & Conditions</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {quote.terms || branding?.default_quote_terms}
                </div>
              </div>
            )}

            {/* ========== FOOTER ========== */}
            <div style={{ textAlign: 'center', paddingTop: 24, borderTop: '2px solid #f3f4f6' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 10 }}>
                {footerText}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>
                {profile?.abn && <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>ABN:</strong> {profile.abn}</p>}
                {(profile as any)?.license_number && <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>License:</strong> {(profile as any).license_number}</p>}
                {profile?.phone && <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Phone:</strong> {profile.phone}</p>}
                {profile?.email && <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Email:</strong> {profile.email}</p>}
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6', fontSize: 11, color: '#9ca3af' }}>
                Generated with <a href="https://tradiemate.com.au" target="_blank" rel="noopener noreferrer" style={{ color: primaryColor, textDecoration: 'none', fontWeight: 500 }}>TradieMate</a> &bull; Professional Quote Management
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
