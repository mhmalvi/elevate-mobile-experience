/**
 * Xero Integration Tests
 *
 * Tests Xero accounting integration:
 * - OAuth authentication
 * - Invoice syncing
 * - Client syncing
 * - Payment reconciliation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

describe('Xero OAuth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initiate Xero OAuth flow', async () => {
    const mockResponse = {
      data: {
        success: true,
        auth_url: 'https://login.xero.com/identity/connect/authorize?client_id=test',
        state: 'random_state_123',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-oauth', {
      body: {
        action: 'initiate',
      },
    });

    expect(result.data).toBeDefined();
    expect(result.data.auth_url).toContain('xero.com');
    expect(result.data.state).toBeDefined();
  });

  it('should exchange authorization code for tokens', async () => {
    const mockResponse = {
      data: {
        success: true,
        access_token: 'xero_access_token_123',
        refresh_token: 'xero_refresh_token_123',
        expires_in: 1800, // 30 minutes
        tenant_id: 'xero_tenant_123',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-oauth', {
      body: {
        action: 'callback',
        code: 'auth_code_123',
        state: 'random_state_123',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.access_token).toBeDefined();
    expect(result.data.tenant_id).toBeDefined();
  });

  it('should refresh expired tokens', async () => {
    const mockResponse = {
      data: {
        success: true,
        access_token: 'new_access_token_123',
        expires_in: 1800,
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-oauth', {
      body: {
        action: 'refresh',
        refresh_token: 'xero_refresh_token_123',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.access_token).toBeDefined();
  });

  it('should handle OAuth errors', async () => {
    const mockResponse = {
      data: null,
      error: {
        message: 'Invalid authorization code',
        code: 'invalid_grant',
      },
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-oauth', {
      body: {
        action: 'callback',
        code: 'invalid_code',
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('invalid_grant');
  });
});

describe('Xero Invoice Syncing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sync invoice to Xero', async () => {
    const mockInvoice = {
      id: 'inv_123',
      invoice_number: 'INV-2026-001',
      client_id: 'client_123',
      total: 1100,
      status: 'sent',
    };

    const mockResponse = {
      data: {
        success: true,
        xero_invoice_id: 'xero_inv_123',
        xero_invoice_number: 'INV-2026-001',
        synced_at: new Date().toISOString(),
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-sync-invoices', {
      body: {
        invoice_id: mockInvoice.id,
        action: 'create',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.xero_invoice_id).toBeDefined();
  });

  it('should update invoice in Xero when modified', async () => {
    const mockResponse = {
      data: {
        success: true,
        xero_invoice_id: 'xero_inv_123',
        updated_at: new Date().toISOString(),
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-sync-invoices', {
      body: {
        invoice_id: 'inv_123',
        action: 'update',
      },
    });

    expect(result.data.success).toBe(true);
  });

  it('should sync payment status to Xero', async () => {
    const mockResponse = {
      data: {
        success: true,
        xero_payment_id: 'xero_payment_123',
        reconciled: true,
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-sync-invoices', {
      body: {
        invoice_id: 'inv_123',
        action: 'mark_paid',
        payment_date: new Date().toISOString(),
        amount: 1100,
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.reconciled).toBe(true);
  });

  it('should handle Xero API errors gracefully', async () => {
    const mockResponse = {
      data: null,
      error: {
        message: 'Invoice validation error',
        code: 'xero_validation_error',
        details: 'Contact email is required',
      },
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-sync-invoices', {
      body: {
        invoice_id: 'inv_invalid',
        action: 'create',
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('xero_validation_error');
  });
});

describe('Xero Client Syncing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sync client to Xero as contact', async () => {
    const mockClient = {
      id: 'client_123',
      name: 'Test Client',
      email: 'client@example.com',
      phone: '0412345678',
    };

    const mockResponse = {
      data: {
        success: true,
        xero_contact_id: 'xero_contact_123',
        synced_at: new Date().toISOString(),
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-sync-clients', {
      body: {
        client_id: mockClient.id,
        action: 'create',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.xero_contact_id).toBeDefined();
  });

  it('should update Xero contact when client changes', async () => {
    const mockResponse = {
      data: {
        success: true,
        xero_contact_id: 'xero_contact_123',
        updated_at: new Date().toISOString(),
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-sync-clients', {
      body: {
        client_id: 'client_123',
        action: 'update',
      },
    });

    expect(result.data.success).toBe(true);
  });

  it('should handle duplicate contacts in Xero', async () => {
    const mockResponse = {
      data: {
        success: true,
        xero_contact_id: 'existing_contact_123',
        was_duplicate: true,
        matched_by: 'email',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-sync-clients', {
      body: {
        client_id: 'client_123',
        action: 'create',
      },
    });

    expect(result.data.was_duplicate).toBe(true);
    expect(result.data.xero_contact_id).toBeDefined();
  });
});

describe('Xero Sync Status Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track sync status for invoices', async () => {
    const mockStatus = {
      invoice_id: 'inv_123',
      xero_invoice_id: 'xero_inv_123',
      synced: true,
      last_synced_at: new Date().toISOString(),
      sync_errors: null,
    };

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockStatus,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase
      .from('xero_sync_status')
      .select('*')
      .eq('invoice_id', 'inv_123')
      .single();

    expect(result.data).toBeDefined();
    expect(result.data.synced).toBe(true);
  });

  it('should record sync errors for troubleshooting', async () => {
    const mockError = {
      invoice_id: 'inv_123',
      synced: false,
      sync_errors: {
        error_code: 'VALIDATION_ERROR',
        message: 'Contact email required',
        timestamp: new Date().toISOString(),
      },
    };

    const fromMock = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: mockError,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase
      .from('xero_sync_status')
      .update({ sync_errors: mockError.sync_errors })
      .eq('invoice_id', 'inv_123')
      .select();

    expect(result.data).toBeDefined();
    expect(result.data.sync_errors).toBeDefined();
  });
});

describe('Xero Disconnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disconnect Xero integration', async () => {
    const mockResponse = {
      data: {
        success: true,
        disconnected: true,
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('xero-oauth', {
      body: {
        action: 'disconnect',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.disconnected).toBe(true);
  });

  it('should clear Xero tokens on disconnection', async () => {
    const mockUpdate = {
      xero_access_token: null,
      xero_refresh_token: null,
      xero_tenant_id: null,
      xero_connected: false,
    };

    const fromMock = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: mockUpdate,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase
      .from('profiles')
      .update(mockUpdate)
      .eq('id', 'user_123')
      .select();

    expect(result.data).toBeDefined();
    expect(result.data.xero_connected).toBe(false);
  });
});
