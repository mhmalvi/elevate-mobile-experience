import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PaymentPollerConfig {
  /** URL search params to check for ?payment=success|cancelled */
  searchParams: URLSearchParams;
  /** Async function that returns the current invoice status string, or null on error */
  fetchStatus: () => Promise<string | null>;
  /** Called when status confirms payment (paid or partially_paid) */
  onConfirmed: () => void;
  /** Whether the poller is enabled (e.g. only when id is present) */
  enabled?: boolean;
}

interface PaymentPollerResult {
  paymentProcessing: boolean;
  paymentSuccess: boolean;
  resetPaymentSuccess: () => void;
}

const PAID_STATUSES = ['paid', 'partially_paid'] as const;

function isPaidStatus(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

/**
 * Shared hook that detects ?payment=success|cancelled URL params and polls
 * an invoice/document for a confirmed payment status update.
 *
 * Used by InvoiceDetail (authenticated, direct table query) and
 * PublicInvoice (anon, RPC-based query) via the `fetchStatus` callback.
 */
export function usePaymentPoller({
  searchParams,
  fetchStatus,
  onConfirmed,
  enabled = true,
}: PaymentPollerConfig): PaymentPollerResult {
  const { toast } = useToast();
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const paymentStatus = searchParams.get('payment');

    if (paymentStatus === 'cancelled') {
      toast({
        title: 'Payment Cancelled',
        description: 'Your payment was cancelled. You can try again anytime.',
        variant: 'destructive',
      });
      return;
    }

    if (paymentStatus === 'success') {
      setPaymentProcessing(true);
      toast({
        title: 'Payment Successful!',
        description: 'Thank you for your payment. Updating invoice status...',
      });

      let pollAttempts = 0;
      const maxPolls = 10;
      const pollInterval = 2000;

      const pollForUpdate = async () => {
        pollAttempts++;

        try {
          const status = await fetchStatus();

          if (status && isPaidStatus(status)) {
            setPaymentProcessing(false);
            setPaymentSuccess(true);
            onConfirmed();
            toast({
              title: 'Invoice Updated',
              description:
                status === 'paid'
                  ? 'Payment confirmed! Invoice is now marked as paid.'
                  : 'Partial payment received.',
              duration: 5000,
            });
            return;
          }

          if (pollAttempts < maxPolls) {
            pollTimeoutRef.current = setTimeout(pollForUpdate, pollInterval);
          } else {
            // Exhausted retries — optimistically mark success
            setPaymentProcessing(false);
            setPaymentSuccess(true);
            onConfirmed();
            toast({
              title: 'Status Update Pending',
              description:
                'Payment was received. If status does not update, please refresh the page.',
              variant: 'default',
              duration: 7000,
            });
          }
        } catch (err) {
          console.error('[usePaymentPoller] Error in polling:', err);
          if (pollAttempts < maxPolls) {
            pollTimeoutRef.current = setTimeout(pollForUpdate, pollInterval);
          }
        }
      };

      // Initial delay before first poll to let webhook process
      pollTimeoutRef.current = setTimeout(pollForUpdate, 1000);

      return () => {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
        }
      };
    }
  }, [searchParams, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPaymentSuccess = () => {
    setPaymentSuccess(false);
  };

  return { paymentProcessing, paymentSuccess, resetPaymentSuccess };
}
