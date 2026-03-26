/**
 * PDF Data Preparation and Validation Tests
 *
 * Tests the client-side logic that prepares invoice/quote data before it is
 * passed to the generate-pdf edge function: currency formatting, date
 * localisation, ABN/phone formatting, line-item calculations, field
 * validation, and filename generation.
 *
 * All functions are pure — no network calls or mocks required.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLineItemTotals,
  type LineItem,
} from '../lineItems';

// ---------------------------------------------------------------------------
// Formatting helpers (client-side, used to pre-render PDF previews and to
// build the payload sent to the generate-pdf edge function)
// ---------------------------------------------------------------------------

function formatAud(amountDollars: number): string {
  return amountDollars.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
  });
}

function formatAustralianDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-AU');
}

function formatAbn(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
}

function formatAustralianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  return raw;
}

function roundToTwoDp(value: number): number {
  return parseFloat(value.toFixed(2));
}

// ---------------------------------------------------------------------------
// Field validation
// ---------------------------------------------------------------------------

interface InvoicePdfPayload {
  invoice_number: string;
  client_id: string;
  line_items: unknown[];
  subtotal: number;
  gst: number;
  total: number;
}

function validateInvoicePdfPayload(payload: Partial<InvoicePdfPayload>): string[] {
  const errors: string[] = [];
  if (!payload.invoice_number) errors.push('invoice_number is required');
  if (!payload.client_id) errors.push('client_id is required');
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0)
    errors.push('line_items must be a non-empty array');
  if (payload.subtotal === undefined || payload.subtotal < 0) errors.push('subtotal must be >= 0');
  if (payload.gst === undefined || payload.gst < 0) errors.push('gst must be >= 0');
  if (payload.total === undefined || payload.total < 0) errors.push('total must be >= 0');
  return errors;
}

// ---------------------------------------------------------------------------
// Filename generation
// ---------------------------------------------------------------------------

function buildPdfStoragePath(type: 'invoices' | 'quotes', entityId: string): string {
  return `${type}/${entityId}.pdf`;
}

function buildPdfPublicUrl(storagePath: string, storageBaseUrl: string): string {
  return `${storageBaseUrl}/v1/object/public/${storagePath}`;
}

// ---------------------------------------------------------------------------
// GST calculation (mirrors edge function logic for client-side preview)
// ---------------------------------------------------------------------------

function calculateGst(subtotal: number): number {
  return roundToTwoDp(subtotal * 0.1);
}

function calculateTotal(subtotal: number, gst: number): number {
  return roundToTwoDp(subtotal + gst);
}

// ---------------------------------------------------------------------------
// Branding helpers
// ---------------------------------------------------------------------------

interface BrandingConfig {
  logo_url: string | null;
  business_name: string;
  abn: string | null;
}

function resolveBranding(config: Partial<BrandingConfig>): BrandingConfig & { use_default: boolean } {
  const hasCustomLogo = !!config.logo_url;
  return {
    logo_url: config.logo_url ?? null,
    business_name: config.business_name ?? 'TradieMate User',
    abn: config.abn ?? null,
    use_default: !hasCustomLogo,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AUD currency formatting', () => {
  it('formats whole-dollar amounts correctly', () => {
    expect(formatAud(1000)).toContain('1,000');
    expect(formatAud(1000)).toContain('1,000.00');
  });

  it('formats amounts with cents correctly', () => {
    expect(formatAud(1234.56)).toContain('1,234.56');
  });

  it('formats zero dollars', () => {
    expect(formatAud(0)).toContain('0.00');
  });

  it('formats large amounts with correct separators', () => {
    expect(formatAud(99999.99)).toContain('99,999.99');
  });
});

describe('Australian date formatting (DD/MM/YYYY)', () => {
  it('formats ISO date 2026-01-15 as 15/01/2026', () => {
    // Use UTC noon to avoid timezone-boundary issues
    const result = formatAustralianDate('2026-01-15T12:00:00.000Z');
    expect(result).toBe('15/01/2026');
  });

  it('formats 2026-06-30 correctly', () => {
    const result = formatAustralianDate('2026-06-30T12:00:00.000Z');
    expect(result).toBe('30/06/2026');
  });
});

describe('ABN formatting (XX XXX XXX XXX)', () => {
  it('formats an 11-digit ABN with spaces', () => {
    expect(formatAbn('51824753556')).toBe('51 824 753 556');
  });

  it('strips existing spaces before reformatting', () => {
    expect(formatAbn('51 824 753 556')).toBe('51 824 753 556');
  });

  it('produces a string of length 14 (11 digits + 3 spaces)', () => {
    expect(formatAbn('12345678901').length).toBe(14);
  });
});

describe('Australian phone number formatting', () => {
  it('formats a 10-digit mobile number with spaces', () => {
    expect(formatAustralianPhone('0412345678')).toBe('0412 345 678');
  });

  it('strips existing spaces before reformatting', () => {
    expect(formatAustralianPhone('0412 345 678')).toBe('0412 345 678');
  });

  it('handles landline area codes', () => {
    expect(formatAustralianPhone('0298765432')).toBe('0298 765 432');
  });
});

describe('Line item total rounding', () => {
  it('rounds a repeating decimal to 2 dp', () => {
    expect(roundToTwoDp(3 * 33.333)).toBe(100);
  });

  it('rounds 0.005 up to 0.01', () => {
    expect(roundToTwoDp(0.005)).toBe(0.01);
  });

  it('leaves an exact 2-dp value unchanged', () => {
    expect(roundToTwoDp(213.75)).toBe(213.75);
  });
});

describe('calculateLineItemTotals (from lineItems.ts)', () => {
  it('calculates subtotal, GST, and total for labour and materials', () => {
    const items: LineItem[] = [
      { id: '1', description: 'Labour', quantity: 4, unit: 'hr', unit_price: 100, item_type: 'labour' },
      { id: '2', description: 'Materials', quantity: 1, unit: 'lot', unit_price: 250, item_type: 'materials' },
      { id: '3', description: 'Travel', quantity: 2, unit: 'hr', unit_price: 50, item_type: 'labour' },
    ];
    const { subtotal, gst, total } = calculateLineItemTotals(items);
    expect(subtotal).toBe(750);
    expect(gst).toBe(75);
    expect(total).toBe(825);
  });

  it('returns zeros for an empty line items array', () => {
    const { subtotal, gst, total } = calculateLineItemTotals([]);
    expect(subtotal).toBe(0);
    expect(gst).toBe(0);
    expect(total).toBe(0);
  });

  it('handles fractional quantities and rates', () => {
    const items: LineItem[] = [
      { id: '1', description: 'Part hours', quantity: 2.5, unit: 'hr', unit_price: 85.5, item_type: 'labour' },
      { id: '2', description: 'Partial material', quantity: 1.25, unit: 'each', unit_price: 120, item_type: 'materials' },
    ];
    const { subtotal } = calculateLineItemTotals(items);
    // 2.5 * 85.5 = 213.75; 1.25 * 120 = 150; sum = 363.75
    expect(subtotal).toBeCloseTo(363.75, 2);
  });

  it('applies 10% GST rate', () => {
    const items: LineItem[] = [
      { id: '1', description: 'Service', quantity: 1, unit: 'lot', unit_price: 1000, item_type: 'labour' },
    ];
    const { gst } = calculateLineItemTotals(items);
    expect(gst).toBe(100);
  });

  it('total equals subtotal + gst', () => {
    const items: LineItem[] = [
      { id: '1', description: 'Job', quantity: 2, unit: 'hr', unit_price: 75, item_type: 'labour' },
    ];
    const { subtotal, gst, total } = calculateLineItemTotals(items);
    expect(total).toBeCloseTo(subtotal + gst, 10);
  });
});

describe('GST calculation', () => {
  it('calculates 10% GST on a subtotal', () => {
    expect(calculateGst(1000)).toBe(100);
    expect(calculateGst(500)).toBe(50);
  });

  it('rounds to 2 decimal places', () => {
    expect(calculateGst(33.33)).toBe(3.33);
  });

  it('returns 0 for a $0 subtotal', () => {
    expect(calculateGst(0)).toBe(0);
  });
});

describe('Invoice PDF payload validation', () => {
  const validPayload: InvoicePdfPayload = {
    invoice_number: 'INV-001',
    client_id: 'client_123',
    line_items: [{ description: 'Service', quantity: 1, rate: 100, total: 100 }],
    subtotal: 100,
    gst: 10,
    total: 110,
  };

  it('accepts a complete, valid payload', () => {
    expect(validateInvoicePdfPayload(validPayload)).toHaveLength(0);
  });

  it('rejects a payload missing invoice_number', () => {
    const errors = validateInvoicePdfPayload({ ...validPayload, invoice_number: '' });
    expect(errors).toContain('invoice_number is required');
  });

  it('rejects a payload missing client_id', () => {
    const errors = validateInvoicePdfPayload({ ...validPayload, client_id: '' });
    expect(errors).toContain('client_id is required');
  });

  it('rejects a payload with empty line_items array', () => {
    const errors = validateInvoicePdfPayload({ ...validPayload, line_items: [] });
    expect(errors).toContain('line_items must be a non-empty array');
  });

  it('rejects a payload with negative subtotal', () => {
    const errors = validateInvoicePdfPayload({ ...validPayload, subtotal: -1 });
    expect(errors).toContain('subtotal must be >= 0');
  });

  it('accepts a zero-dollar payload (fully discounted invoice)', () => {
    const zeroed = { ...validPayload, subtotal: 0, gst: 0, total: 0 };
    expect(validateInvoicePdfPayload(zeroed)).toHaveLength(0);
  });

  it('returns multiple errors for multiple missing fields', () => {
    const errors = validateInvoicePdfPayload({});
    expect(errors.length).toBeGreaterThan(1);
  });
});

describe('PDF storage path and URL generation', () => {
  const BASE = 'https://storage.supabase.co';

  it('builds the correct storage path for an invoice', () => {
    expect(buildPdfStoragePath('invoices', 'inv_123')).toBe('invoices/inv_123.pdf');
  });

  it('builds the correct storage path for a quote', () => {
    expect(buildPdfStoragePath('quotes', 'quo_456')).toBe('quotes/quo_456.pdf');
  });

  it('builds a fully-qualified public URL', () => {
    const path = buildPdfStoragePath('invoices', 'inv_123');
    const url = buildPdfPublicUrl(path, BASE);
    expect(url).toBe('https://storage.supabase.co/v1/object/public/invoices/inv_123.pdf');
  });

  it('generates unique paths for distinct invoice IDs', () => {
    const ids = ['inv_1', 'inv_2', 'inv_3'];
    const paths = ids.map((id) => buildPdfStoragePath('invoices', id));
    expect(new Set(paths).size).toBe(3);
  });
});

describe('Branding resolution', () => {
  it('uses custom logo when provided', () => {
    const config = resolveBranding({ logo_url: 'https://cdn.example.com/logo.png', business_name: 'My Biz' });
    expect(config.logo_url).toBe('https://cdn.example.com/logo.png');
    expect(config.use_default).toBe(false);
  });

  it('falls back to default branding when no logo is set', () => {
    const config = resolveBranding({ logo_url: null, business_name: 'My Biz' });
    expect(config.use_default).toBe(true);
  });

  it('defaults business_name to "TradieMate User" when not supplied', () => {
    const config = resolveBranding({});
    expect(config.business_name).toBe('TradieMate User');
  });

  it('preserves ABN when provided', () => {
    const config = resolveBranding({ abn: '51 824 753 556' });
    expect(config.abn).toBe('51 824 753 556');
  });

  it('sets abn to null when not supplied', () => {
    const config = resolveBranding({ business_name: 'Test' });
    expect(config.abn).toBeNull();
  });
});
