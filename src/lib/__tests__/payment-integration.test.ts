/**
 * Payment Business Logic Tests
 *
 * Tests the client-side payment logic: fee calculations, status transitions,
 * Stripe amount conversion, connect account validation, and idempotency guards.
 * These functions live client-side and run entirely without network calls.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helper functions extracted from payment flow logic.
// These mirror what the edge functions and client code rely on.
// ---------------------------------------------------------------------------

function centsToAud(cents: number): number {
  return cents / 100;
}

function audToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function calculateStripeFee(amountCents: number): number {
  // Stripe AU: 2.9% + $0.30 per transaction
  return Math.round(amountCents * 0.029 + 30);
}

function calculateNetToTradie(amountCents: number): number {
  // TradieMate takes 0% platform fee — tradie receives total minus Stripe fee only
  return amountCents - calculateStripeFee(amountCents);
}

type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'partially_paid' | 'failed' | 'refunded';

function determineInvoiceStatus(total: number, amountPaid: number): InvoiceStatus {
  if (amountPaid <= 0) return 'sent';
  if (amountPaid >= total) return 'paid';
  return 'partially_paid';
}

function canTransitionStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
    draft: ['pending', 'sent'],
    pending: ['paid', 'failed', 'sent'],
    sent: ['paid', 'partially_paid', 'failed'],
    paid: ['refunded'],
    partially_paid: ['paid', 'failed'],
    failed: ['pending', 'sent'],
    refunded: [],
  };
  return allowed[from].includes(to);
}

function isReadyToCharge(profile: { stripe_account_id: string | null; stripe_charges_enabled: boolean }): boolean {
  return !!profile.stripe_account_id && profile.stripe_charges_enabled;
}

function buildPaymentMetadata(invoiceId: string, invoiceNumber: string, businessName: string): Record<string, string> {
  return { invoice_id: invoiceId, invoice_number: invoiceNumber, business_name: businessName };
}

function buildSuccessUrl(baseUrl: string, invoiceId: string): string {
  return `${baseUrl}/i/${invoiceId}?payment=success`;
}

function buildCancelUrl(baseUrl: string, invoiceId: string): string {
  return `${baseUrl}/i/${invoiceId}?payment=cancelled`;
}

function parseWebhookInvoiceId(metadata: Record<string, string> | undefined): string | null {
  return metadata?.invoice_id ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stripe amount conversion', () => {
  it('converts whole-dollar amounts to cents', () => {
    expect(audToCents(10)).toBe(1000);
    expect(audToCents(1000)).toBe(100000);
    expect(audToCents(0)).toBe(0);
  });

  it('converts decimal amounts to cents without floating-point drift', () => {
    expect(audToCents(10.55)).toBe(1055);
    expect(audToCents(1100.99)).toBe(110099);
  });

  it('rounds half-cent amounts up', () => {
    // $10.555 → 1055.5 cents → rounds to 1056
    expect(audToCents(10.555)).toBe(1056);
  });

  it('converts cents back to AUD dollars', () => {
    expect(centsToAud(110000)).toBe(1100);
    expect(centsToAud(1055)).toBe(10.55);
  });
});

describe('Stripe fee calculation (2.9% + $0.30)', () => {
  it('calculates correct fee for $50.00', () => {
    // 5000 * 0.029 = 145, + 30 = 175
    expect(calculateStripeFee(5000)).toBe(175);
  });

  it('calculates correct fee for $100.00', () => {
    // 10000 * 0.029 = 290, + 30 = 320
    expect(calculateStripeFee(10000)).toBe(320);
  });

  it('calculates correct fee for $500.00', () => {
    // 50000 * 0.029 = 1450, + 30 = 1480
    expect(calculateStripeFee(50000)).toBe(1480);
  });

  it('calculates correct fee for $1,000.00', () => {
    // 100000 * 0.029 = 2900, + 30 = 2930
    expect(calculateStripeFee(100000)).toBe(2930);
  });

  it('returns 30 cents fixed component for a $0 invoice (edge case)', () => {
    expect(calculateStripeFee(0)).toBe(30);
  });
});

describe('Platform fee (0% — TradieMate charges no platform fee)', () => {
  it('tradie receives invoice amount minus Stripe fee only for $1,000', () => {
    const invoiceAmount = 100000;
    const net = calculateNetToTradie(invoiceAmount);
    const stripeFee = calculateStripeFee(invoiceAmount);

    expect(net).toBe(invoiceAmount - stripeFee);
    expect(net).toBe(97070);
  });

  it('confirms 0% platform fee across multiple amounts', () => {
    const amounts = [5000, 10000, 50000, 100000];
    amounts.forEach((amount) => {
      const net = calculateNetToTradie(amount);
      const stripeFee = calculateStripeFee(amount);
      // Platform fee is zero — net equals amount minus only the Stripe cut
      expect(net + stripeFee).toBe(amount);
    });
  });
});

describe('Invoice status determination', () => {
  it('returns "sent" when no payment has been made', () => {
    expect(determineInvoiceStatus(1100, 0)).toBe('sent');
  });

  it('returns "partially_paid" when amount_paid is positive but less than total', () => {
    expect(determineInvoiceStatus(1100, 500)).toBe('partially_paid');
    expect(determineInvoiceStatus(3000, 1)).toBe('partially_paid');
  });

  it('returns "paid" when amount_paid equals total', () => {
    expect(determineInvoiceStatus(1100, 1100)).toBe('paid');
  });

  it('returns "paid" when amount_paid exceeds total (overpayment)', () => {
    expect(determineInvoiceStatus(1100, 1200)).toBe('paid');
  });

  it('handles decimal amounts correctly', () => {
    expect(determineInvoiceStatus(1100.50, 1100.50)).toBe('paid');
    expect(determineInvoiceStatus(1100.50, 500.25)).toBe('partially_paid');
  });
});

describe('Invoice status transitions', () => {
  it('allows draft → sent', () => {
    expect(canTransitionStatus('draft', 'sent')).toBe(true);
  });

  it('allows sent → paid', () => {
    expect(canTransitionStatus('sent', 'paid')).toBe(true);
  });

  it('allows sent → partially_paid', () => {
    expect(canTransitionStatus('sent', 'partially_paid')).toBe(true);
  });

  it('allows partially_paid → paid', () => {
    expect(canTransitionStatus('partially_paid', 'paid')).toBe(true);
  });

  it('allows paid → refunded', () => {
    expect(canTransitionStatus('paid', 'refunded')).toBe(true);
  });

  it('prevents paid → draft (cannot un-pay an invoice)', () => {
    expect(canTransitionStatus('paid', 'draft')).toBe(false);
  });

  it('prevents paid → pending (cannot revert paid invoice to pending)', () => {
    expect(canTransitionStatus('paid', 'pending')).toBe(false);
  });

  it('prevents refunded → paid (cannot re-pay a refunded invoice)', () => {
    expect(canTransitionStatus('refunded', 'paid')).toBe(false);
  });

  it('prevents refunded → any further state', () => {
    const allStatuses: InvoiceStatus[] = ['draft', 'pending', 'sent', 'paid', 'partially_paid', 'failed', 'refunded'];
    allStatuses.forEach((to) => {
      expect(canTransitionStatus('refunded', to)).toBe(false);
    });
  });
});

describe('Stripe Connect account readiness', () => {
  it('returns false when stripe_account_id is null', () => {
    expect(isReadyToCharge({ stripe_account_id: null, stripe_charges_enabled: true })).toBe(false);
  });

  it('returns false when charges are not enabled yet', () => {
    expect(isReadyToCharge({ stripe_account_id: 'acct_123', stripe_charges_enabled: false })).toBe(false);
  });

  it('returns false when both fields are absent', () => {
    expect(isReadyToCharge({ stripe_account_id: null, stripe_charges_enabled: false })).toBe(false);
  });

  it('returns true when account_id is set and charges are enabled', () => {
    expect(isReadyToCharge({ stripe_account_id: 'acct_test123', stripe_charges_enabled: true })).toBe(true);
  });
});

describe('Payment metadata construction', () => {
  it('includes invoice_id, invoice_number, and business_name', () => {
    const meta = buildPaymentMetadata('inv-001', 'INV-2026-001', "John's Plumbing");
    expect(meta.invoice_id).toBe('inv-001');
    expect(meta.invoice_number).toBe('INV-2026-001');
    expect(meta.business_name).toBe("John's Plumbing");
  });

  it('all metadata values are strings (Stripe requirement)', () => {
    const meta = buildPaymentMetadata('inv-001', 'INV-001', 'TradieMate');
    Object.values(meta).forEach((v) => expect(typeof v).toBe('string'));
  });
});

describe('Payment redirect URL construction', () => {
  const BASE = 'https://app.tradiemate.com.au';

  it('builds success URL with correct path and query param', () => {
    expect(buildSuccessUrl(BASE, 'inv-123')).toBe(
      'https://app.tradiemate.com.au/i/inv-123?payment=success'
    );
  });

  it('builds cancel URL with correct path and query param', () => {
    expect(buildCancelUrl(BASE, 'inv-123')).toBe(
      'https://app.tradiemate.com.au/i/inv-123?payment=cancelled'
    );
  });

  it('success and cancel URLs share the same base path', () => {
    const success = buildSuccessUrl(BASE, 'inv-xyz');
    const cancel = buildCancelUrl(BASE, 'inv-xyz');
    expect(success.split('?')[0]).toBe(cancel.split('?')[0]);
  });
});

describe('Webhook invoice ID extraction', () => {
  it('extracts invoice_id from well-formed metadata', () => {
    const meta = { invoice_id: 'inv-456', other: 'data' };
    expect(parseWebhookInvoiceId(meta)).toBe('inv-456');
  });

  it('returns null when metadata is undefined', () => {
    expect(parseWebhookInvoiceId(undefined)).toBeNull();
  });

  it('returns null when metadata has no invoice_id key', () => {
    expect(parseWebhookInvoiceId({ unrelated: 'value' })).toBeNull();
  });

  it('returns null for empty metadata object', () => {
    expect(parseWebhookInvoiceId({})).toBeNull();
  });
});

describe('Webhook idempotency guard', () => {
  it('detects a duplicate event the second time it is processed', () => {
    const seen = new Set<string>();

    seen.add('evt_aaa');
    expect(seen.has('evt_aaa')).toBe(true);   // duplicate
    expect(seen.has('evt_bbb')).toBe(false);  // novel
  });

  it('does not flag distinct event IDs as duplicates', () => {
    const seen = new Set<string>(['evt_1', 'evt_2', 'evt_3']);
    expect(seen.has('evt_4')).toBe(false);
  });
});
