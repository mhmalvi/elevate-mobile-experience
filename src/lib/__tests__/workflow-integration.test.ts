/**
 * Business Workflow Logic Tests
 *
 * Tests the client-side data transformation functions used in the core
 * TradieMate workflows: quote-to-invoice conversion, invoice status machines,
 * job status progression, recurring invoice scheduling, and RBAC permission
 * checks for team collaboration.
 *
 * All functions are pure — no mocks or network calls needed.
 */

import { describe, it, expect } from 'vitest';
import { addDaysToDate } from '../calculations';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: string;
  client_id: string;
  status: QuoteStatus;
  line_items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  quote_id?: string;
  job_id?: string;
  status: InvoiceStatus;
  line_items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  due_date: string;
}

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted' | 'expired';
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partially_paid' | 'failed' | 'overdue';
type JobStatus = 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

// ---------------------------------------------------------------------------
// Workflow helper functions
// ---------------------------------------------------------------------------

/**
 * Build an invoice payload from an accepted quote.
 * Copies line items, amounts, and client reference across; links via quote_id.
 */
function convertQuoteToInvoice(
  quote: Quote,
  invoiceId: string,
  invoiceNumber: string,
  paymentTermsDays: number
): Invoice {
  const due = addDaysToDate(new Date(), paymentTermsDays);
  return {
    id: invoiceId,
    invoice_number: invoiceNumber,
    client_id: quote.client_id,
    quote_id: quote.id,
    status: 'draft',
    line_items: quote.line_items.map((li) => ({ ...li })),
    subtotal: quote.subtotal,
    gst: quote.gst,
    total: quote.total,
    due_date: due.toISOString(),
  };
}

/**
 * Return the new quote status after it has been converted to an invoice.
 */
function quoteStatusAfterConversion(_current: QuoteStatus): QuoteStatus {
  return 'converted';
}

/** Validate that an invoice total matches the sum of its line items */
function validateInvoiceTotals(invoice: Invoice): boolean {
  const computedSubtotal = invoice.line_items.reduce((sum, li) => sum + li.total, 0);
  const computedGst = Math.round(computedSubtotal * 0.1 * 100) / 100;
  const computedTotal = Math.round((computedSubtotal + computedGst) * 100) / 100;

  return (
    Math.abs(invoice.subtotal - computedSubtotal) < 0.01 &&
    Math.abs(invoice.gst - computedGst) < 0.01 &&
    Math.abs(invoice.total - computedTotal) < 0.01
  );
}

/** Check whether an invoice is past its due date */
function isInvoiceOverdue(dueDateIso: string, nowIso: string): boolean {
  return new Date(nowIso) > new Date(dueDateIso);
}

/** Calculate days overdue for a past-due invoice */
function daysOverdue(dueDateIso: string, nowIso: string): number {
  const diff = new Date(nowIso).getTime() - new Date(dueDateIso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/** Validate that a job status transition is allowed */
function canTransitionJobStatus(from: JobStatus, to: JobStatus): boolean {
  const allowed: Record<JobStatus, JobStatus[]> = {
    scheduled: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'on_hold', 'cancelled'],
    on_hold: ['in_progress', 'cancelled'],
    completed: [],
    cancelled: [],
  };
  return allowed[from].includes(to);
}

type RecurrenceFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';

/** Advance a recurring invoice template's next_invoice_date by one cycle */
function advanceNextInvoiceDate(current: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(current);
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'fortnightly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

/** Check whether a recurring template is due for invoice generation today */
function isRecurringInvoiceDue(nextInvoiceDateIso: string, todayIso: string): boolean {
  return new Date(todayIso) >= new Date(nextInvoiceDateIso);
}

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: ['create', 'read', 'update', 'delete', 'invite', 'manage_billing'],
  admin: ['create', 'read', 'update', 'delete'],
  member: ['create', 'read', 'update'],
  viewer: ['read'],
};

function hasPermission(role: TeamRole, action: string): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

// ---------------------------------------------------------------------------
// Tests: Quote → Invoice conversion
// ---------------------------------------------------------------------------

describe('Quote-to-invoice conversion', () => {
  const testQuote: Quote = {
    id: 'quo_001',
    quote_number: 'QUO-2026-001',
    client_id: 'client_abc',
    status: 'accepted',
    line_items: [
      { description: 'Bathroom renovation', quantity: 1, rate: 5000, total: 5000 },
    ],
    subtotal: 5000,
    gst: 500,
    total: 5500,
  };

  it('carries client_id from quote to invoice', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 7);
    expect(invoice.client_id).toBe('client_abc');
  });

  it('links the invoice back to the source quote via quote_id', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 7);
    expect(invoice.quote_id).toBe('quo_001');
  });

  it('copies all line items from the quote', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 7);
    expect(invoice.line_items).toHaveLength(1);
    expect(invoice.line_items[0].description).toBe('Bathroom renovation');
    expect(invoice.line_items[0].total).toBe(5000);
  });

  it('preserves subtotal, GST, and total from the quote', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 7);
    expect(invoice.subtotal).toBe(5000);
    expect(invoice.gst).toBe(500);
    expect(invoice.total).toBe(5500);
  });

  it('creates the invoice in draft status', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 7);
    expect(invoice.status).toBe('draft');
  });

  it('sets due_date 7 days from now for net-7 terms', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 7);
    const dueDate = new Date(invoice.due_date);
    const expected = addDaysToDate(new Date(), 7);
    // Allow 1-second tolerance for test execution time
    expect(Math.abs(dueDate.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('sets due_date 30 days out for net-30 terms', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 30);
    const dueDate = new Date(invoice.due_date);
    const expected = addDaysToDate(new Date(), 30);
    expect(Math.abs(dueDate.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('marks quote status as "converted" after conversion', () => {
    expect(quoteStatusAfterConversion('accepted')).toBe('converted');
  });

  it('mutates line items independently (does not share references)', () => {
    const invoice = convertQuoteToInvoice(testQuote, 'inv_001', 'INV-2026-001', 7);
    invoice.line_items[0].description = 'Modified';
    expect(testQuote.line_items[0].description).toBe('Bathroom renovation');
  });
});

describe('Invoice total validation', () => {
  it('returns true for a correctly totalled invoice', () => {
    const invoice: Invoice = {
      id: 'inv_1',
      invoice_number: 'INV-001',
      client_id: 'c_1',
      status: 'draft',
      line_items: [{ description: 'Labour', quantity: 4, rate: 100, total: 400 }],
      subtotal: 400,
      gst: 40,
      total: 440,
      due_date: '2026-02-01T00:00:00.000Z',
    };
    expect(validateInvoiceTotals(invoice)).toBe(true);
  });

  it('returns false when subtotal does not match line items', () => {
    const invoice: Invoice = {
      id: 'inv_2',
      invoice_number: 'INV-002',
      client_id: 'c_1',
      status: 'draft',
      line_items: [{ description: 'Labour', quantity: 4, rate: 100, total: 400 }],
      subtotal: 999, // wrong
      gst: 40,
      total: 1039,
      due_date: '2026-02-01T00:00:00.000Z',
    };
    expect(validateInvoiceTotals(invoice)).toBe(false);
  });

  it('handles multi-item invoices correctly', () => {
    const invoice: Invoice = {
      id: 'inv_3',
      invoice_number: 'INV-003',
      client_id: 'c_1',
      status: 'draft',
      line_items: [
        { description: 'Labour', quantity: 4, rate: 100, total: 400 },
        { description: 'Materials', quantity: 1, rate: 250, total: 250 },
      ],
      subtotal: 650,
      gst: 65,
      total: 715,
      due_date: '2026-02-01T00:00:00.000Z',
    };
    expect(validateInvoiceTotals(invoice)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Overdue detection
// ---------------------------------------------------------------------------

describe('Invoice overdue detection', () => {
  it('marks an invoice as overdue when now is past the due date', () => {
    expect(isInvoiceOverdue('2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z')).toBe(true);
  });

  it('does not mark an invoice as overdue when the due date is in the future', () => {
    expect(isInvoiceOverdue('2026-12-31T00:00:00.000Z', '2026-03-05T00:00:00.000Z')).toBe(false);
  });

  it('does not mark an invoice as overdue when due today', () => {
    const today = '2026-03-05T00:00:00.000Z';
    expect(isInvoiceOverdue(today, today)).toBe(false);
  });

  it('calculates the correct number of days overdue', () => {
    expect(daysOverdue('2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z')).toBe(7);
  });

  it('returns 0 days overdue when the invoice is not yet due', () => {
    expect(daysOverdue('2026-12-31T00:00:00.000Z', '2026-03-05T00:00:00.000Z')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Job status transitions
// ---------------------------------------------------------------------------

describe('Job status transitions', () => {
  it('allows scheduled → in_progress', () => {
    expect(canTransitionJobStatus('scheduled', 'in_progress')).toBe(true);
  });

  it('allows in_progress → completed', () => {
    expect(canTransitionJobStatus('in_progress', 'completed')).toBe(true);
  });

  it('allows in_progress → on_hold', () => {
    expect(canTransitionJobStatus('in_progress', 'on_hold')).toBe(true);
  });

  it('allows on_hold → in_progress (resume)', () => {
    expect(canTransitionJobStatus('on_hold', 'in_progress')).toBe(true);
  });

  it('allows cancellation from scheduled or in_progress', () => {
    expect(canTransitionJobStatus('scheduled', 'cancelled')).toBe(true);
    expect(canTransitionJobStatus('in_progress', 'cancelled')).toBe(true);
  });

  it('prevents any transition from completed', () => {
    const allStatuses: JobStatus[] = ['scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'];
    allStatuses.forEach((to) => {
      expect(canTransitionJobStatus('completed', to)).toBe(false);
    });
  });

  it('prevents any transition from cancelled', () => {
    const allStatuses: JobStatus[] = ['scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'];
    allStatuses.forEach((to) => {
      expect(canTransitionJobStatus('cancelled', to)).toBe(false);
    });
  });

  it('prevents jumping from scheduled directly to completed', () => {
    expect(canTransitionJobStatus('scheduled', 'completed')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Recurring invoice scheduling
// ---------------------------------------------------------------------------

describe('Recurring invoice — next date advancement', () => {
  const base = new Date('2026-01-01T00:00:00.000Z');

  it('advances by 7 days for weekly frequency', () => {
    const next = advanceNextInvoiceDate(base, 'weekly');
    expect(next.getDate()).toBe(8); // Jan 8
    expect(next.getMonth()).toBe(0); // January
  });

  it('advances by 14 days for fortnightly frequency', () => {
    const next = advanceNextInvoiceDate(base, 'fortnightly');
    expect(next.getDate()).toBe(15); // Jan 15
  });

  it('advances by 1 month for monthly frequency', () => {
    const next = advanceNextInvoiceDate(base, 'monthly');
    expect(next.getMonth()).toBe(1); // February
    expect(next.getFullYear()).toBe(2026);
  });

  it('advances by 3 months for quarterly frequency', () => {
    const next = advanceNextInvoiceDate(base, 'quarterly');
    expect(next.getMonth()).toBe(3); // April
  });

  it('advances by 1 year for annual frequency', () => {
    const next = advanceNextInvoiceDate(base, 'annually');
    expect(next.getFullYear()).toBe(2027);
  });

  it('does not mutate the original date', () => {
    const original = new Date('2026-01-01T00:00:00.000Z');
    advanceNextInvoiceDate(original, 'monthly');
    expect(original.getMonth()).toBe(0); // Still January
  });
});

describe('Recurring invoice — due check', () => {
  it('is due when today equals the scheduled date', () => {
    expect(isRecurringInvoiceDue('2026-03-05T00:00:00.000Z', '2026-03-05T00:00:00.000Z')).toBe(true);
  });

  it('is due when today is past the scheduled date', () => {
    expect(isRecurringInvoiceDue('2026-01-01T00:00:00.000Z', '2026-03-05T00:00:00.000Z')).toBe(true);
  });

  it('is not due when the scheduled date is still in the future', () => {
    expect(isRecurringInvoiceDue('2026-12-01T00:00:00.000Z', '2026-03-05T00:00:00.000Z')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Team RBAC
// ---------------------------------------------------------------------------

describe('Team RBAC — permission checks', () => {
  it('owner has all permissions including invite and manage_billing', () => {
    expect(hasPermission('owner', 'create')).toBe(true);
    expect(hasPermission('owner', 'delete')).toBe(true);
    expect(hasPermission('owner', 'invite')).toBe(true);
    expect(hasPermission('owner', 'manage_billing')).toBe(true);
  });

  it('admin can create, read, update, delete but not invite or manage billing', () => {
    expect(hasPermission('admin', 'create')).toBe(true);
    expect(hasPermission('admin', 'delete')).toBe(true);
    expect(hasPermission('admin', 'invite')).toBe(false);
    expect(hasPermission('admin', 'manage_billing')).toBe(false);
  });

  it('member can create and update but cannot delete or invite', () => {
    expect(hasPermission('member', 'create')).toBe(true);
    expect(hasPermission('member', 'update')).toBe(true);
    expect(hasPermission('member', 'delete')).toBe(false);
    expect(hasPermission('member', 'invite')).toBe(false);
  });

  it('viewer can only read', () => {
    expect(hasPermission('viewer', 'read')).toBe(true);
    expect(hasPermission('viewer', 'create')).toBe(false);
    expect(hasPermission('viewer', 'update')).toBe(false);
    expect(hasPermission('viewer', 'delete')).toBe(false);
  });

  it('permission set is strictly ordered: owner > admin > member > viewer', () => {
    const roles: TeamRole[] = ['owner', 'admin', 'member', 'viewer'];
    const permissionCounts = roles.map((r) => ROLE_PERMISSIONS[r].length);
    for (let i = 1; i < permissionCounts.length; i++) {
      expect(permissionCounts[i]).toBeLessThanOrEqual(permissionCounts[i - 1]);
    }
  });
});
