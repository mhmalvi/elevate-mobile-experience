import { Receipt, Loader2, CheckCircle, PartyPopper, ArrowLeft } from 'lucide-react';
import { safeNumber } from '@/lib/utils';
import { usePublicInvoice } from '@/hooks/usePublicInvoice';
import { PublicInvoiceDocument } from '@/components/invoice/PublicInvoiceDocument';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (amount: number): string =>
  `$${safeNumber(amount).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function PublicInvoice() {
  const {
    invoice,
    lineItems,
    profile,
    branding,
    loading,
    error,
    processingPayment,
    paymentProcessing,
    paymentSuccess,
    resetPaymentSuccess,
    clearPaymentParams,
    handlePayNow,
    derived,
  } = usePublicInvoice();

  const { primaryColor, accentColor } = derived;

  // -------------------------------------------------------------------------
  // Payment Processing Screen
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Payment Success Screen
  // -------------------------------------------------------------------------
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
            onClick={() => { resetPaymentSuccess(); clearPaymentParams(); }}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            View Invoice Details
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error / Not Found
  // -------------------------------------------------------------------------
  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Receipt className="w-16 h-16 text-gray-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
        <p className="text-gray-500 text-center">This invoice may have been removed or the link is invalid.</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Invoice Document
  // -------------------------------------------------------------------------
  return (
    <PublicInvoiceDocument
      invoice={invoice}
      lineItems={lineItems}
      profile={profile}
      branding={branding}
      derived={derived}
      processingPayment={processingPayment}
      onPayNow={handlePayNow}
    />
  );
}
