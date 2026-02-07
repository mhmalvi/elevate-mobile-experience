import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Receipt, Loader2, CreditCard, CheckCircle, PartyPopper, ArrowLeft } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { safeNumber } from '@/lib/utils';

export default function PublicInvoice() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const realtimeChannelRef = useRef<any>(null);

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

      const { data: items } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order');
      setLineItems(items || []);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .single();
      setProfile(profileData);

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

  // Set up realtime subscription for invoice updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`invoice-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices',
          filter: `id=eq.${id}`
        },
        (payload) => {
          const newData = payload.new as any;
          setInvoice((prev: any) => ({ ...prev, ...newData }));
          if (newData.status === 'paid' || newData.status === 'partially_paid') {
            setPaymentProcessing(false);
            setPaymentSuccess(true);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('Realtime subscription not available, using polling fallback');
        }
        if (err) {
          console.log('Realtime error (using polling fallback):', err.message);
        }
      });

    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [id]);

  // Check for payment status in URL
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'cancelled') {
      toast({ title: 'Payment Cancelled', description: 'Your payment was cancelled. You can try again anytime.', variant: 'destructive' });
      setSearchParams({});
      return;
    }
    if (paymentStatus === 'success') {
      setPaymentProcessing(true);
      const checkPaymentStatus = async () => {
        const { data: invoiceData } = await supabase
          .from('invoices').select('status, amount_paid, total').eq('id', id).single();
        if (invoiceData) {
          const isPaidOrPartial = invoiceData.status === 'paid' || invoiceData.status === 'partially_paid';
          if (isPaidOrPartial) {
            setPaymentProcessing(false);
            setPaymentSuccess(true);
            fetchInvoice();
          } else {
            setTimeout(() => {
              supabase.from('invoices').select('status, amount_paid, total').eq('id', id).single()
                .then(({ data }) => {
                  if (data && (data.status === 'paid' || data.status === 'partially_paid')) {
                    setPaymentProcessing(false);
                    setPaymentSuccess(true);
                    fetchInvoice();
                  } else {
                    setPaymentProcessing(false);
                    setPaymentSuccess(true);
                    toast({ title: 'Payment Received', description: 'Your payment was successful. The invoice status will update shortly.', duration: 5000 });
                  }
                });
            }, 15000);
          }
        }
      };
      checkPaymentStatus();
    }
  }, [searchParams, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id, fetchInvoice]);

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

  // Payment Processing Screen
  if (paymentProcessing) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}12` }}>
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: primaryColor }} />
            </div>
            <div className="absolute -inset-4 rounded-full border-4 animate-pulse" style={{ borderColor: `${primaryColor}30` }} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Processing Payment</h1>
            <p className="text-gray-500">Please wait while we confirm your payment...</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Payment Success Screen
  if (paymentSuccess && invoice) {
    const amountPaid = invoice.amount_paid || invoice.total || 0;
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
              <CheckCircle className="w-14 h-14" style={{ color: accentColor }} />
            </div>
            <div className="absolute -top-2 -right-2">
              <PartyPopper className="w-8 h-8 text-amber-500 animate-bounce" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="text-gray-500">Thank you for your payment</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Invoice</span>
              <span className="font-semibold text-gray-900">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Amount Paid</span>
              <span className="text-2xl font-bold" style={{ color: primaryColor }}>{formatCurrency(amountPaid)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">Status</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                {invoice.status === 'paid' ? 'Paid' : 'Partially Paid'}
              </span>
            </div>
          </div>
          {profile && (
            <div className="text-sm text-gray-500">
              <p>Payment received by</p>
              <p className="font-semibold text-gray-900">{profile.business_name}</p>
            </div>
          )}
          <button
            onClick={() => { setPaymentSuccess(false); setSearchParams({}); }}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            View Invoice Details
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Receipt className="w-16 h-16 text-gray-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
        <p className="text-gray-500 text-center">This invoice may have been removed or the link is invalid.</p>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.due_date && isPast(parseISO(invoice.due_date)) && !isPaid;
  const balance = safeNumber(invoice.total) - safeNumber(invoice.amount_paid);
  const client = invoice.clients;

  const handlePayNow = async () => {
    setProcessingPayment(true);
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { invoice_id: id, success_url: `${baseUrl}?payment=success`, cancel_url: `${baseUrl}?payment=cancelled` }
      });
      if (error) throw error;
      if (data?.url) { window.location.href = data.url; } else { throw new Error('No payment URL received'); }
    } catch (err) {
      console.error('Payment error:', err);
      toast({ title: 'Payment Error', description: 'Unable to start payment. Please try again or contact the business.', variant: 'destructive' });
      setProcessingPayment(false);
    }
  };

  // ====================================================================
  // PROFESSIONAL INVOICE DESIGN — matches generate-pdf/improved-template
  // ====================================================================
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Overdue Banner */}
      {isOverdue && (
        <div style={{ backgroundColor: '#fef3c7', borderBottom: '1px solid #fcd34d', padding: '10px 16px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
            This invoice is overdue. Please arrange payment at your earliest convenience.
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
                  {profile?.business_name || 'Tax Invoice'}
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
                  INVOICE
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                  #{invoice.invoice_number}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                  <p style={{ margin: 0 }}><strong style={{ color: '#374151', fontWeight: 600 }}>Date:</strong> {formatDate(invoice.created_at)}</p>
                  {invoice.due_date && (
                    <p style={{ margin: 0, color: isOverdue ? '#dc2626' : '#6b7280', fontWeight: isOverdue ? 600 : 400 }}>
                      <strong style={{ color: isOverdue ? '#dc2626' : '#374151', fontWeight: 600 }}>Due:</strong> {formatDate(invoice.due_date)}
                      {isOverdue && ' (OVERDUE)'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========== BODY ========== */}
          <div style={{ padding: '24px 32px 32px' }}>

            {/* Title */}
            {invoice.title && (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0, lineHeight: 1.3 }}>{invoice.title}</h2>
                {invoice.description && (
                  <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>{invoice.description}</p>
                )}
              </div>
            )}

            {/* Client & Document Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              {/* Bill To */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: primaryColor, marginBottom: 10 }}>
                  Bill To
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                  {client?.name || 'Client'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                  {client?.address && <p style={{ margin: 0 }}>{client.address}</p>}
                  {(client?.suburb || client?.state || client?.postcode) && (
                    <p style={{ margin: 0 }}>{[client.suburb, client.state, client.postcode].filter(Boolean).join(', ')}</p>
                  )}
                  {client?.phone && <p style={{ margin: 0 }}>{client.phone}</p>}
                  {client?.email && <p style={{ margin: 0 }}>{client.email}</p>}
                </div>
              </div>

              {/* Document Details */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: primaryColor, marginBottom: 10 }}>
                  Document Details
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>
                  <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Number:</strong> {invoice.invoice_number}</p>
                  <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Date:</strong> {formatDate(invoice.created_at)}</p>
                  {invoice.due_date && (
                    <p style={{ margin: 0 }}><strong style={{ color: '#374151' }}>Due Date:</strong> {formatDate(invoice.due_date)}</p>
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
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 10px', fontSize: 13, color: '#6b7280', borderBottom: '1px solid #e5e7eb', marginBottom: 6 }}>
                  <span>GST (10%)</span>
                  <span>{formatCurrency(invoice.gst)}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  color: '#ffffff', fontSize: 18, fontWeight: 700,
                  padding: '12px 16px', margin: '0 -16px -16px', borderRadius: '0 0 8px 8px',
                }}>
                  <span>Total AUD</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>

                {safeNumber(invoice.amount_paid) > 0 && (
                  <div style={{ margin: '0 -16px', padding: '0 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', fontSize: 13, color: accentColor, fontWeight: 600, borderTop: `1px dashed #e5e7eb`, marginTop: 0 }}>
                      <span>Amount Paid</span>
                      <span>-{formatCurrency(invoice.amount_paid)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 15, color: primaryColor, fontWeight: 700 }}>
                      <span>Balance Due</span>
                      <span>{formatCurrency(balance)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ========== PAYMENT DETAILS ========== */}
            {(profile?.bank_name || profile?.bank_bsb) && !isPaid && (
              <div style={{
                background: 'linear-gradient(to right, #eff6ff, #dbeafe)',
                border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 20,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: primaryColor, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15 }}>Payment Information</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
                  {profile.bank_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Bank</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>{profile.bank_name}</span>
                    </div>
                  )}
                  {profile.bank_account_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Account Name</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>{profile.bank_account_name}</span>
                    </div>
                  )}
                  {profile.bank_bsb && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>BSB</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>{profile.bank_bsb}</span>
                    </div>
                  )}
                  {profile.bank_account_number && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Account Number</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>{profile.bank_account_number}</span>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #bfdbfe', fontSize: 11, color: '#1e40af', fontStyle: 'italic' }}>
                  Please use invoice number {invoice.invoice_number} as your payment reference
                </div>
              </div>
            )}

            {/* ========== PAY NOW BUTTON ========== */}
            {!isPaid && balance > 0 && (
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={handlePayNow}
                  disabled={processingPayment}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px 24px', fontSize: 16, fontWeight: 700, color: '#ffffff', border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    borderRadius: 8, boxShadow: `0 4px 14px ${primaryColor}40`,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    opacity: processingPayment ? 0.7 : 1,
                  }}
                  onMouseEnter={e => { if (!processingPayment) { (e.target as any).style.transform = 'translateY(-1px)'; (e.target as any).style.boxShadow = `0 6px 20px ${primaryColor}50`; } }}
                  onMouseLeave={e => { (e.target as any).style.transform = 'translateY(0)'; (e.target as any).style.boxShadow = `0 4px 14px ${primaryColor}40`; }}
                >
                  {processingPayment ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : (
                    <><CreditCard className="w-5 h-5" /> Pay Now &mdash; {formatCurrency(balance)}</>
                  )}
                </button>
              </div>
            )}

            {/* ========== PAID STATUS ========== */}
            {isPaid && (
              <div style={{
                background: `${accentColor}10`, border: `1px solid ${accentColor}30`,
                borderRadius: 8, padding: '16px 20px', textAlign: 'center', marginBottom: 20,
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: accentColor, marginBottom: 4 }}>PAID</div>
                {invoice.paid_at && (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Payment received {formatDate(invoice.paid_at)}
                  </div>
                )}
              </div>
            )}

            {/* ========== NOTES ========== */}
            {invoice.notes && (
              <div style={{
                background: '#fef9f5', border: '1px solid #fed7aa', borderRadius: 8,
                padding: 14, marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 13, color: '#7c2d12', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{invoice.notes}</div>
              </div>
            )}

            {/* ========== TERMS ========== */}
            {(invoice.terms || branding?.default_invoice_terms) && (
              <div style={{ background: '#ffffff', border: '1px solid #f3f4f6', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Terms & Conditions</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {invoice.terms || branding?.default_invoice_terms}
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
                Professional Invoice Management
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
