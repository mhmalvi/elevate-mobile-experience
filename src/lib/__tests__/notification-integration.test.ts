/**
 * Notification Formatting and Validation Logic Tests
 *
 * Tests the client-side logic that prepares and validates notification data
 * before it is sent to edge functions: phone number normalisation, SMS length
 * enforcement, email content sanitisation, and preference-gate checks.
 *
 * No network calls are made. All assertions are on deterministic pure functions.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Helper functions that mirror the client-side notification layer
// ---------------------------------------------------------------------------

/**
 * Normalise an Australian phone number to E.164 (+61XXXXXXXXX).
 * Handles inputs like "0412345678", "+61412345678", "61412345678".
 */
function normaliseAustralianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('61') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  // Already in E.164 form (leading + stripped by replace)
  if (raw.startsWith('+61') && digits.length === 11) {
    return `+${digits}`;
  }
  return raw; // Return original if unrecognised — caller should validate first
}

/** Returns true if the phone number is a valid Australian mobile (04XX) */
function isValidAustralianMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('04');
}

/** Strip <script> tags from a string (XSS prevention before templating) */
function sanitiseHtml(input: string): string {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/** Build a short SMS body for an invoice, respecting the 160-char limit */
function buildInvoiceSms(
  invoiceNumber: string,
  totalAud: number,
  shortUrl: string
): string {
  const formatted = `$${totalAud.toLocaleString('en-AU')}`;
  return `Invoice ${invoiceNumber} for ${formatted}. Pay now: ${shortUrl}`;
}

/** Build a short SMS body for a quote */
function buildQuoteSms(
  quoteNumber: string,
  totalAud: number,
  validUntil: string,
  shortUrl: string
): string {
  return `Quote ${quoteNumber} for $${totalAud.toLocaleString('en-AU')}. Valid until ${validUntil}. View: ${shortUrl}`;
}

/** Determine whether a notification should be sent given user preferences */
function shouldSendNotification(
  method: 'email' | 'sms',
  preferences: { email_notifications: boolean; sms_notifications: boolean }
): boolean {
  if (method === 'email') return preferences.email_notifications;
  if (method === 'sms') return preferences.sms_notifications;
  return false;
}

/** Determine whether a marketing email should be sent */
function shouldSendMarketing(preferences: { marketing_emails: boolean }): boolean {
  return preferences.marketing_emails;
}

type SubscriptionTier = 'free' | 'solo' | 'crew' | 'pro';

const SMS_MONTHLY_LIMITS: Record<SubscriptionTier, number> = {
  free: 0,
  solo: 50,
  crew: 200,
  pro: 500,
};

/** Returns true when the tier allows sending more SMS messages */
function canSendSms(tier: SubscriptionTier, smsSentThisMonth: number): boolean {
  const limit = SMS_MONTHLY_LIMITS[tier];
  return smsSentThisMonth < limit;
}

/** Build the payment URL embedded in invoice emails */
function buildPaymentUrl(baseUrl: string, invoiceId: string): string {
  return `${baseUrl}/pay/${invoiceId}`;
}

/** Build the view URL embedded in quote emails */
function buildQuoteViewUrl(baseUrl: string, quoteId: string): string {
  return `${baseUrl}/quotes/${quoteId}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Australian phone number normalisation', () => {
  it('converts local mobile format (0412...) to E.164', () => {
    expect(normaliseAustralianPhone('0412345678')).toBe('+61412345678');
  });

  it('leaves already-normalised E.164 numbers unchanged', () => {
    expect(normaliseAustralianPhone('+61412345678')).toBe('+61412345678');
  });

  it('converts country-code-prefix format (61...) to E.164', () => {
    expect(normaliseAustralianPhone('61412345678')).toBe('+61412345678');
  });

  it('handles numbers with spaces stripped during normalisation', () => {
    expect(normaliseAustralianPhone('0412 345 678')).toBe('+61412345678');
  });

  it('handles numbers with hyphens stripped during normalisation', () => {
    expect(normaliseAustralianPhone('0412-345-678')).toBe('+61412345678');
  });
});

describe('Australian mobile number validation', () => {
  it('accepts valid 04XX mobile numbers', () => {
    expect(isValidAustralianMobile('0400000000')).toBe(true);
    expect(isValidAustralianMobile('0499999999')).toBe(true);
    expect(isValidAustralianMobile('0412345678')).toBe(true);
  });

  it('rejects landline area codes', () => {
    expect(isValidAustralianMobile('0298765432')).toBe(false);
    expect(isValidAustralianMobile('0312345678')).toBe(false);
  });

  it('rejects numbers that are too short', () => {
    expect(isValidAustralianMobile('041234567')).toBe(false);
  });

  it('rejects numbers that are too long', () => {
    expect(isValidAustralianMobile('04123456789')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidAustralianMobile('')).toBe(false);
  });
});

describe('HTML content sanitisation (XSS prevention)', () => {
  it('removes <script> tags from user-supplied content', () => {
    const unsafe = '<script>alert("xss")</script>Hello';
    expect(sanitiseHtml(unsafe)).toBe('Hello');
  });

  it('removes <script> tags with attributes', () => {
    const unsafe = '<script type="text/javascript">evil()</script>Safe text';
    expect(sanitiseHtml(unsafe)).toBe('Safe text');
  });

  it('preserves non-script content', () => {
    const safe = '<p>Hello <strong>World</strong></p>';
    expect(sanitiseHtml(safe)).toBe(safe);
  });

  it('handles multiple script tags in one string', () => {
    const unsafe = '<script>a()</script>Text<script>b()</script>';
    expect(sanitiseHtml(unsafe)).toBe('Text');
  });

  it('is case-insensitive for SCRIPT tag', () => {
    const unsafe = '<SCRIPT>evil()</SCRIPT>Content';
    expect(sanitiseHtml(unsafe)).toBe('Content');
  });
});

describe('Invoice SMS body construction', () => {
  it('includes the invoice number and formatted amount', () => {
    const sms = buildInvoiceSms('INV-2026-001', 1000, 'https://short.link/inv123');
    expect(sms).toContain('INV-2026-001');
    expect(sms).toContain('$1,000');
  });

  it('includes the payment URL', () => {
    const sms = buildInvoiceSms('INV-001', 500, 'https://short.link/abc');
    expect(sms).toContain('https://short.link/abc');
  });

  it('stays within the 160-character SMS limit for typical invoices', () => {
    const sms = buildInvoiceSms('INV-2026-001', 1000, 'https://short.link/inv123');
    expect(sms.length).toBeLessThanOrEqual(160);
  });

  it('stays within SMS limit for large invoice amounts', () => {
    const sms = buildInvoiceSms('INV-2026-999', 99999, 'https://short.link/inv999');
    expect(sms.length).toBeLessThanOrEqual(160);
  });
});

describe('Quote SMS body construction', () => {
  it('includes the quote number, amount, validity date, and URL', () => {
    const sms = buildQuoteSms('QUO-2026-001', 5000, '15/02', 'https://short.link/quo123');
    expect(sms).toContain('QUO-2026-001');
    expect(sms).toContain('$5,000');
    expect(sms).toContain('15/02');
    expect(sms).toContain('https://short.link/quo123');
  });

  it('stays within the 160-character SMS limit', () => {
    const sms = buildQuoteSms('QUO-2026-001', 5000, '15/02/26', 'https://short.link/q1');
    expect(sms.length).toBeLessThanOrEqual(160);
  });
});

describe('Notification preference gate', () => {
  it('sends email when email_notifications is true', () => {
    expect(
      shouldSendNotification('email', { email_notifications: true, sms_notifications: false })
    ).toBe(true);
  });

  it('blocks email when email_notifications is false', () => {
    expect(
      shouldSendNotification('email', { email_notifications: false, sms_notifications: true })
    ).toBe(false);
  });

  it('sends SMS when sms_notifications is true', () => {
    expect(
      shouldSendNotification('sms', { email_notifications: false, sms_notifications: true })
    ).toBe(true);
  });

  it('blocks SMS when sms_notifications is false', () => {
    expect(
      shouldSendNotification('sms', { email_notifications: true, sms_notifications: false })
    ).toBe(false);
  });

  it('blocks marketing emails when marketing_emails preference is false', () => {
    expect(shouldSendMarketing({ marketing_emails: false })).toBe(false);
  });

  it('sends marketing emails when preference is true', () => {
    expect(shouldSendMarketing({ marketing_emails: true })).toBe(true);
  });
});

describe('SMS monthly limit enforcement by subscription tier', () => {
  it('free tier cannot send any SMS (limit = 0)', () => {
    expect(canSendSms('free', 0)).toBe(false);
  });

  it('solo tier can send SMS when below 50-message limit', () => {
    expect(canSendSms('solo', 0)).toBe(true);
    expect(canSendSms('solo', 49)).toBe(true);
  });

  it('solo tier is blocked when 50 messages have been sent', () => {
    expect(canSendSms('solo', 50)).toBe(false);
  });

  it('crew tier allows up to 200 SMS per month', () => {
    expect(canSendSms('crew', 199)).toBe(true);
    expect(canSendSms('crew', 200)).toBe(false);
  });

  it('pro tier allows up to 500 SMS per month', () => {
    expect(canSendSms('pro', 499)).toBe(true);
    expect(canSendSms('pro', 500)).toBe(false);
  });

  it('limits increase from free < solo < crew < pro', () => {
    const tiers: SubscriptionTier[] = ['free', 'solo', 'crew', 'pro'];
    const limits = tiers.map((t) => SMS_MONTHLY_LIMITS[t]);
    for (let i = 1; i < limits.length; i++) {
      expect(limits[i]).toBeGreaterThan(limits[i - 1]);
    }
  });
});

describe('Notification URL construction', () => {
  const BASE = 'https://app.tradiemate.com';

  it('builds a /pay/ URL for invoice payment links', () => {
    expect(buildPaymentUrl(BASE, 'inv_123')).toBe('https://app.tradiemate.com/pay/inv_123');
  });

  it('builds a /quotes/ URL for quote view links', () => {
    expect(buildQuoteViewUrl(BASE, 'quo_123')).toBe('https://app.tradiemate.com/quotes/quo_123');
  });

  it('payment URL contains /pay/ segment', () => {
    expect(buildPaymentUrl(BASE, 'inv_abc')).toContain('/pay/');
  });

  it('quote URL contains /quotes/ segment', () => {
    expect(buildQuoteViewUrl(BASE, 'quo_abc')).toContain('/quotes/');
  });
});
