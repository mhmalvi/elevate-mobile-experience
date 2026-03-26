/**
 * Xero Integration Client-Side Logic Tests
 *
 * Tests the client-side helpers for the Xero OAuth flow: state parameter
 * generation, URL construction, token expiry detection, data mapping from
 * TradieMate entities to Xero API payloads, error categorisation, and sync
 * status bookkeeping.
 *
 * All functions are pure — no network calls or Supabase mocks needed.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

/** Generate a cryptographically random state string (simplified for testing) */
function generateOAuthState(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Build the Xero OAuth authorisation URL */
function buildXeroAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[]
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

/** Extract the authorisation code and state from an OAuth callback URL */
function parseOAuthCallback(callbackUrl: string): { code: string | null; state: string | null; error: string | null } {
  try {
    const url = new URL(callbackUrl);
    return {
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state'),
      error: url.searchParams.get('error'),
    };
  } catch {
    return { code: null, state: null, error: 'invalid_callback_url' };
  }
}

/** Validate that the returned OAuth state matches the one we sent */
function validateOAuthState(received: string, expected: string): boolean {
  return received.length > 0 && received === expected;
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

interface XeroTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in ms
}

/** Returns true when an access token has expired */
function isTokenExpired(tokens: XeroTokens, nowMs: number = Date.now()): boolean {
  return nowMs >= tokens.expires_at;
}

/** Returns the number of seconds until a token expires (negative = already expired) */
function secondsUntilExpiry(tokens: XeroTokens, nowMs: number = Date.now()): number {
  return Math.floor((tokens.expires_at - nowMs) / 1000);
}

/** Clear token fields from a profile object on disconnection */
function buildClearTokensPayload(): Record<string, null | boolean> {
  return {
    xero_access_token: null,
    xero_refresh_token: null,
    xero_tenant_id: null,
    xero_connected: false,
  };
}

// ---------------------------------------------------------------------------
// Data mapping: TradieMate → Xero API payloads
// ---------------------------------------------------------------------------

interface TradieClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  abn: string | null;
}

interface XeroContact {
  Name: string;
  EmailAddress: string | undefined;
  Phones: Array<{ PhoneType: string; PhoneNumber: string }> | undefined;
  TaxNumber: string | undefined;
}

function mapClientToXeroContact(client: TradieClient): XeroContact {
  return {
    Name: client.name,
    EmailAddress: client.email ?? undefined,
    Phones: client.phone
      ? [{ PhoneType: 'MOBILE', PhoneNumber: client.phone }]
      : undefined,
    TaxNumber: client.abn ?? undefined,
  };
}

interface TradieInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  subtotal: number;
  gst: number;
  total: number;
  due_date: string;
}

interface XeroInvoiceLineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  TaxType: string;
}

interface XeroInvoicePayload {
  Type: 'ACCREC';
  Contact: { Name: string; EmailAddress: string | undefined };
  LineItems: XeroInvoiceLineItem[];
  DueDate: string;
  InvoiceNumber: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED';
}

function mapInvoiceToXeroPayload(invoice: TradieInvoice): XeroInvoicePayload {
  return {
    Type: 'ACCREC',
    Contact: {
      Name: invoice.client_name,
      EmailAddress: invoice.client_email ?? undefined,
    },
    LineItems: invoice.line_items.map((li) => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unit_price,
      TaxType: 'OUTPUT2', // Australian 10% GST
    })),
    DueDate: invoice.due_date.split('T')[0], // ISO date only (YYYY-MM-DD)
    InvoiceNumber: invoice.invoice_number,
    Status: 'AUTHORISED',
  };
}

// ---------------------------------------------------------------------------
// Error categorisation
// ---------------------------------------------------------------------------

type XeroErrorCategory = 'validation' | 'auth' | 'rate_limit' | 'not_found' | 'unknown';

function categoriseXeroError(statusCode: number, message: string): XeroErrorCategory {
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode === 404) return 'not_found';
  if (statusCode === 429) return 'rate_limit';
  if (statusCode === 400) return 'validation';
  if (message.toLowerCase().includes('validation')) return 'validation';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Sync status bookkeeping
// ---------------------------------------------------------------------------

interface SyncRecord {
  entity_id: string;
  xero_id: string | null;
  synced: boolean;
  last_synced_at: string | null;
  sync_errors: Record<string, string> | null;
}

function buildSuccessSyncRecord(entityId: string, xeroId: string, now: string): SyncRecord {
  return {
    entity_id: entityId,
    xero_id: xeroId,
    synced: true,
    last_synced_at: now,
    sync_errors: null,
  };
}

function buildFailureSyncRecord(
  entityId: string,
  errorCode: string,
  message: string,
  now: string
): SyncRecord {
  return {
    entity_id: entityId,
    xero_id: null,
    synced: false,
    last_synced_at: now,
    sync_errors: { error_code: errorCode, message },
  };
}

function hasSyncErrors(record: SyncRecord): boolean {
  return record.sync_errors !== null && Object.keys(record.sync_errors).length > 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OAuth state parameter', () => {
  it('generates a state string of the requested length', () => {
    expect(generateOAuthState(32).length).toBe(32);
    expect(generateOAuthState(16).length).toBe(16);
  });

  it('generates alphanumeric-only state strings', () => {
    const state = generateOAuthState(64);
    expect(/^[A-Za-z0-9]+$/.test(state)).toBe(true);
  });

  it('generates different state strings on subsequent calls (collision resistance)', () => {
    const s1 = generateOAuthState();
    const s2 = generateOAuthState();
    expect(s1).not.toBe(s2);
  });

  it('validates correctly when received state matches sent state', () => {
    const state = 'abc123XYZ';
    expect(validateOAuthState(state, state)).toBe(true);
  });

  it('fails validation when received state does not match', () => {
    expect(validateOAuthState('wrongstate', 'correctstate')).toBe(false);
  });

  it('fails validation for an empty received state', () => {
    expect(validateOAuthState('', 'correctstate')).toBe(false);
  });
});

describe('Xero OAuth URL construction', () => {
  const CLIENT_ID = 'test_client_id';
  const REDIRECT = 'https://app.tradiemate.com/xero/callback';
  const STATE = 'random_state_abc';
  const SCOPES = ['openid', 'accounting.transactions', 'accounting.contacts'];

  it('produces a URL pointing to login.xero.com', () => {
    const url = buildXeroAuthUrl(CLIENT_ID, REDIRECT, STATE, SCOPES);
    expect(url).toContain('login.xero.com');
  });

  it('includes the client_id in the URL', () => {
    const url = buildXeroAuthUrl(CLIENT_ID, REDIRECT, STATE, SCOPES);
    expect(url).toContain(`client_id=${CLIENT_ID}`);
  });

  it('includes the state in the URL', () => {
    const url = buildXeroAuthUrl(CLIENT_ID, REDIRECT, STATE, SCOPES);
    expect(url).toContain(`state=${STATE}`);
  });

  it('includes the response_type=code param', () => {
    const url = buildXeroAuthUrl(CLIENT_ID, REDIRECT, STATE, SCOPES);
    expect(url).toContain('response_type=code');
  });

  it('joins multiple scopes with a space (URL-encoded as +)', () => {
    const url = buildXeroAuthUrl(CLIENT_ID, REDIRECT, STATE, SCOPES);
    // URLSearchParams encodes spaces as '+'
    expect(url).toContain('accounting.transactions');
    expect(url).toContain('accounting.contacts');
  });
});

describe('OAuth callback URL parsing', () => {
  it('extracts code and state from a successful callback', () => {
    const callbackUrl = 'https://app.tradiemate.com/xero/callback?code=auth_abc&state=state_xyz';
    const { code, state, error } = parseOAuthCallback(callbackUrl);
    expect(code).toBe('auth_abc');
    expect(state).toBe('state_xyz');
    expect(error).toBeNull();
  });

  it('extracts error from a denied-access callback', () => {
    const callbackUrl = 'https://app.tradiemate.com/xero/callback?error=access_denied&state=state_xyz';
    const { code, error } = parseOAuthCallback(callbackUrl);
    expect(code).toBeNull();
    expect(error).toBe('access_denied');
  });

  it('returns nulls for a malformed callback URL', () => {
    const { code, state, error } = parseOAuthCallback('not a url');
    expect(code).toBeNull();
    expect(state).toBeNull();
    expect(error).toBe('invalid_callback_url');
  });
});

describe('Xero token expiry detection', () => {
  const now = Date.now();

  it('identifies a token that expires in the future as valid', () => {
    const tokens: XeroTokens = {
      access_token: 'tok_1',
      refresh_token: 'ref_1',
      expires_at: now + 900_000, // 15 min from now
    };
    expect(isTokenExpired(tokens, now)).toBe(false);
  });

  it('identifies a token whose expiry is in the past as expired', () => {
    const tokens: XeroTokens = {
      access_token: 'tok_1',
      refresh_token: 'ref_1',
      expires_at: now - 1000, // 1 second ago
    };
    expect(isTokenExpired(tokens, now)).toBe(true);
  });

  it('calculates positive seconds until a future expiry', () => {
    const tokens: XeroTokens = {
      access_token: 'tok_1',
      refresh_token: 'ref_1',
      expires_at: now + 60_000, // 60 seconds from now
    };
    expect(secondsUntilExpiry(tokens, now)).toBe(60);
  });

  it('calculates negative seconds for an already-expired token', () => {
    const tokens: XeroTokens = {
      access_token: 'tok_1',
      refresh_token: 'ref_1',
      expires_at: now - 120_000, // 2 minutes ago
    };
    expect(secondsUntilExpiry(tokens, now)).toBe(-120);
  });
});

describe('Disconnection — clear tokens payload', () => {
  it('sets all token fields to null and xero_connected to false', () => {
    const payload = buildClearTokensPayload();
    expect(payload.xero_access_token).toBeNull();
    expect(payload.xero_refresh_token).toBeNull();
    expect(payload.xero_tenant_id).toBeNull();
    expect(payload.xero_connected).toBe(false);
  });
});

describe('Client-to-Xero-contact mapping', () => {
  it('maps name and email correctly', () => {
    const client: TradieClient = { id: 'c1', name: 'John Smith', email: 'john@example.com', phone: null, abn: null };
    const contact = mapClientToXeroContact(client);
    expect(contact.Name).toBe('John Smith');
    expect(contact.EmailAddress).toBe('john@example.com');
  });

  it('maps mobile phone to MOBILE phone type', () => {
    const client: TradieClient = { id: 'c1', name: 'Jane', email: null, phone: '0412345678', abn: null };
    const contact = mapClientToXeroContact(client);
    expect(contact.Phones).toHaveLength(1);
    expect(contact.Phones![0].PhoneType).toBe('MOBILE');
    expect(contact.Phones![0].PhoneNumber).toBe('0412345678');
  });

  it('omits Phones when phone is null', () => {
    const client: TradieClient = { id: 'c1', name: 'Bob', email: null, phone: null, abn: null };
    expect(mapClientToXeroContact(client).Phones).toBeUndefined();
  });

  it('maps ABN to TaxNumber', () => {
    const client: TradieClient = { id: 'c1', name: 'Co', email: null, phone: null, abn: '51 824 753 556' };
    expect(mapClientToXeroContact(client).TaxNumber).toBe('51 824 753 556');
  });

  it('omits TaxNumber when ABN is null', () => {
    const client: TradieClient = { id: 'c1', name: 'Co', email: null, phone: null, abn: null };
    expect(mapClientToXeroContact(client).TaxNumber).toBeUndefined();
  });
});

describe('Invoice-to-Xero-payload mapping', () => {
  const sampleInvoice: TradieInvoice = {
    id: 'inv_1',
    invoice_number: 'INV-2026-001',
    client_name: 'ABC Corp',
    client_email: 'billing@abc.com',
    line_items: [
      { description: 'Labour', quantity: 4, unit_price: 100, total: 400 },
      { description: 'Materials', quantity: 1, unit_price: 250, total: 250 },
    ],
    subtotal: 650,
    gst: 65,
    total: 715,
    due_date: '2026-01-22T00:00:00.000Z',
  };

  it('sets Type to ACCREC (accounts receivable)', () => {
    expect(mapInvoiceToXeroPayload(sampleInvoice).Type).toBe('ACCREC');
  });

  it('maps invoice number correctly', () => {
    expect(mapInvoiceToXeroPayload(sampleInvoice).InvoiceNumber).toBe('INV-2026-001');
  });

  it('maps contact name and email', () => {
    const payload = mapInvoiceToXeroPayload(sampleInvoice);
    expect(payload.Contact.Name).toBe('ABC Corp');
    expect(payload.Contact.EmailAddress).toBe('billing@abc.com');
  });

  it('maps all line items to Xero line items with OUTPUT2 tax', () => {
    const payload = mapInvoiceToXeroPayload(sampleInvoice);
    expect(payload.LineItems).toHaveLength(2);
    payload.LineItems.forEach((li) => {
      expect(li.TaxType).toBe('OUTPUT2');
    });
  });

  it('formats DueDate as YYYY-MM-DD (no time component)', () => {
    const payload = mapInvoiceToXeroPayload(sampleInvoice);
    expect(payload.DueDate).toBe('2026-01-22');
    expect(payload.DueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sets Status to AUTHORISED for submission', () => {
    expect(mapInvoiceToXeroPayload(sampleInvoice).Status).toBe('AUTHORISED');
  });

  it('omits EmailAddress when client_email is null', () => {
    const invoice = { ...sampleInvoice, client_email: null };
    expect(mapInvoiceToXeroPayload(invoice).Contact.EmailAddress).toBeUndefined();
  });
});

describe('Xero error categorisation', () => {
  it('categorises 401 as auth error', () => {
    expect(categoriseXeroError(401, 'Unauthorized')).toBe('auth');
  });

  it('categorises 403 as auth error', () => {
    expect(categoriseXeroError(403, 'Forbidden')).toBe('auth');
  });

  it('categorises 404 as not_found', () => {
    expect(categoriseXeroError(404, 'Invoice not found')).toBe('not_found');
  });

  it('categorises 429 as rate_limit', () => {
    expect(categoriseXeroError(429, 'Too many requests')).toBe('rate_limit');
  });

  it('categorises 400 as validation error', () => {
    expect(categoriseXeroError(400, 'Bad request')).toBe('validation');
  });

  it('categorises unknown status codes as unknown', () => {
    expect(categoriseXeroError(500, 'Internal server error')).toBe('unknown');
  });

  it('categorises by message keyword when status is ambiguous', () => {
    expect(categoriseXeroError(422, 'Validation failed: email required')).toBe('validation');
  });
});

describe('Sync record construction', () => {
  const NOW = '2026-03-05T10:00:00.000Z';

  it('builds a successful sync record with correct fields', () => {
    const record = buildSuccessSyncRecord('inv_001', 'xero_inv_abc', NOW);
    expect(record.entity_id).toBe('inv_001');
    expect(record.xero_id).toBe('xero_inv_abc');
    expect(record.synced).toBe(true);
    expect(record.last_synced_at).toBe(NOW);
    expect(record.sync_errors).toBeNull();
  });

  it('builds a failure sync record with error details', () => {
    const record = buildFailureSyncRecord('inv_002', 'VALIDATION_ERROR', 'Contact email required', NOW);
    expect(record.entity_id).toBe('inv_002');
    expect(record.xero_id).toBeNull();
    expect(record.synced).toBe(false);
    expect(record.sync_errors!.error_code).toBe('VALIDATION_ERROR');
    expect(record.sync_errors!.message).toBe('Contact email required');
  });

  it('hasSyncErrors returns false for a successful record', () => {
    const record = buildSuccessSyncRecord('inv_001', 'xero_inv_abc', NOW);
    expect(hasSyncErrors(record)).toBe(false);
  });

  it('hasSyncErrors returns true for a failed record', () => {
    const record = buildFailureSyncRecord('inv_002', 'ERR', 'Failed', NOW);
    expect(hasSyncErrors(record)).toBe(true);
  });
});
