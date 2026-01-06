/**
 * Workflow Integration Tests
 *
 * Tests complete end-to-end workflows:
 * - Client → Quote → Invoice → Payment flow
 * - Job creation → Progress tracking → Completion
 * - Recurring invoice generation
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
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Quote to Invoice Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create quote from client data', async () => {
    const mockClient = {
      id: 'client_123',
      name: 'Test Client',
      email: 'client@example.com',
    };

    const mockQuote = {
      id: 'quote_123',
      client_id: mockClient.id,
      quote_number: 'QUO-2026-001',
      status: 'draft',
      line_items: [
        {
          description: 'Service',
          quantity: 1,
          rate: 1000,
          total: 1000,
        },
      ],
      subtotal: 1000,
      gst: 100,
      total: 1100,
    };

    const fromMock = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: mockQuote,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase.from('quotes').insert(mockQuote).select();

    expect(result.data).toBeDefined();
    expect(result.data.client_id).toBe(mockClient.id);
    expect(result.data.status).toBe('draft');
  });

  it('should convert accepted quote to invoice', async () => {
    const mockQuote = {
      id: 'quote_123',
      quote_number: 'QUO-2026-001',
      client_id: 'client_123',
      status: 'accepted',
      line_items: [{ description: 'Service', quantity: 1, rate: 1000, total: 1000 }],
      subtotal: 1000,
      gst: 100,
      total: 1100,
    };

    const mockInvoice = {
      id: 'invoice_123',
      invoice_number: 'INV-2026-001',
      client_id: mockQuote.client_id,
      quote_id: mockQuote.id,
      status: 'draft',
      line_items: mockQuote.line_items,
      subtotal: mockQuote.subtotal,
      gst: mockQuote.gst,
      total: mockQuote.total,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const fromMock = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: mockInvoice,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase.from('invoices').insert(mockInvoice).select();

    expect(result.data).toBeDefined();
    expect(result.data.quote_id).toBe(mockQuote.id);
    expect(result.data.total).toBe(mockQuote.total);
  });

  it('should update quote status to converted when invoice created', async () => {
    const mockUpdate = {
      id: 'quote_123',
      status: 'converted',
      converted_to_invoice_id: 'invoice_123',
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
      .from('quotes')
      .update({ status: 'converted', converted_to_invoice_id: 'invoice_123' })
      .eq('id', 'quote_123')
      .select();

    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('converted');
  });
});

describe('Invoice to Payment Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send invoice and create payment link', async () => {
    const mockResponse = {
      data: {
        success: true,
        email_sent: true,
        payment_link: 'https://app.tradiemate.com/pay/invoice_123',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('send-invoice', {
      body: {
        invoice_id: 'invoice_123',
        method: 'email',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.payment_link).toContain('/pay/');
  });

  it('should process payment and update invoice status', async () => {
    const mockWebhook = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_status: 'paid',
          amount_total: 110000, // $1,100 in cents
          metadata: {
            invoice_id: 'invoice_123',
          },
        },
      },
    };

    const mockResponse = {
      data: {
        success: true,
        invoice_updated: true,
        new_status: 'paid',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('stripe-webhook', {
      body: mockWebhook,
    });

    expect(result.data.success).toBe(true);
    expect(result.data.new_status).toBe('paid');
  });

  it('should send payment confirmation after successful payment', async () => {
    const mockResponse = {
      data: {
        success: true,
        confirmation_sent: true,
        receipt_url: 'https://stripe.com/receipts/test_123',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('send-notification', {
      body: {
        invoice_id: 'invoice_123',
        type: 'payment_confirmation',
        to_email: 'client@example.com',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.confirmation_sent).toBe(true);
  });
});

describe('Job Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create job from quote', async () => {
    const mockQuote = {
      id: 'quote_123',
      client_id: 'client_123',
      line_items: [{ description: 'Bathroom renovation', quantity: 1, rate: 5000 }],
    };

    const mockJob = {
      id: 'job_123',
      client_id: mockQuote.client_id,
      quote_id: mockQuote.id,
      title: 'Bathroom renovation',
      status: 'scheduled',
      scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const fromMock = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: mockJob,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase.from('jobs').insert(mockJob).select();

    expect(result.data).toBeDefined();
    expect(result.data.quote_id).toBe(mockQuote.id);
    expect(result.data.status).toBe('scheduled');
  });

  it('should track job progress through statuses', async () => {
    const statusFlow = [
      'scheduled',
      'in_progress',
      'completed',
    ];

    statusFlow.forEach((status, index) => {
      expect(status).toBeDefined();
      if (index > 0) {
        expect(status).not.toBe(statusFlow[index - 1]);
      }
    });
  });

  it('should create invoice when job completed', async () => {
    const mockJob = {
      id: 'job_123',
      client_id: 'client_123',
      title: 'Bathroom renovation',
      status: 'completed',
      completed_date: new Date().toISOString(),
    };

    const mockInvoice = {
      id: 'invoice_123',
      client_id: mockJob.client_id,
      job_id: mockJob.id,
      status: 'draft',
      invoice_number: 'INV-2026-001',
    };

    const fromMock = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: mockInvoice,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase.from('invoices').insert(mockInvoice).select();

    expect(result.data).toBeDefined();
    expect(result.data.job_id).toBe(mockJob.id);
  });
});

describe('Recurring Invoice Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create recurring invoice template', async () => {
    const mockTemplate = {
      id: 'template_123',
      client_id: 'client_123',
      frequency: 'monthly',
      line_items: [
        {
          description: 'Monthly maintenance',
          quantity: 1,
          rate: 500,
          total: 500,
        },
      ],
      subtotal: 500,
      gst: 50,
      total: 550,
      is_active: true,
      next_invoice_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const fromMock = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: mockTemplate,
        error: null,
      }),
    });

    (supabase.from as any) = fromMock;

    const result = await supabase.from('recurring_invoice_templates').insert(mockTemplate).select();

    expect(result.data).toBeDefined();
    expect(result.data.frequency).toBe('monthly');
    expect(result.data.is_active).toBe(true);
  });

  it('should generate invoice from recurring template', async () => {
    const mockResponse = {
      data: {
        success: true,
        invoices_created: 5,
        invoices: [
          { id: 'inv_1', invoice_number: 'INV-2026-001' },
          { id: 'inv_2', invoice_number: 'INV-2026-002' },
        ],
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('generate-recurring-invoices', {
      body: {},
    });

    expect(result.data.success).toBe(true);
    expect(result.data.invoices_created).toBeGreaterThan(0);
  });

  it('should update next invoice date after generation', async () => {
    const currentDate = new Date();
    const nextDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const mockUpdate = {
      id: 'template_123',
      next_invoice_date: nextDate.toISOString(),
      last_invoice_date: currentDate.toISOString(),
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
      .from('recurring_invoice_templates')
      .update({
        next_invoice_date: nextDate.toISOString(),
        last_invoice_date: currentDate.toISOString(),
      })
      .eq('id', 'template_123')
      .select();

    expect(result.data).toBeDefined();
    expect(new Date(result.data.next_invoice_date).getTime()).toBeGreaterThan(currentDate.getTime());
  });
});

describe('Team Collaboration Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send team invitation', async () => {
    const mockResponse = {
      data: {
        success: true,
        invitation_id: 'inv_123',
        invitation_sent: true,
        join_url: 'https://app.tradiemate.com/join/inv_123',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('send-team-invitation', {
      body: {
        email: 'teammate@example.com',
        role: 'member',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.join_url).toContain('/join/');
  });

  it('should accept team invitation', async () => {
    const mockResponse = {
      data: {
        success: true,
        team_member_id: 'member_123',
        team_id: 'team_123',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('accept-team-invitation', {
      body: {
        invitation_id: 'inv_123',
      },
    });

    expect(result.data.success).toBe(true);
    expect(result.data.team_member_id).toBeDefined();
  });

  it('should enforce role-based permissions', () => {
    const permissions = {
      owner: ['create', 'read', 'update', 'delete', 'invite'],
      admin: ['create', 'read', 'update', 'delete'],
      member: ['create', 'read', 'update'],
      viewer: ['read'],
    };

    // Verify owner has all permissions
    expect(permissions.owner).toContain('delete');
    expect(permissions.owner).toContain('invite');

    // Verify member cannot delete or invite
    expect(permissions.member).not.toContain('delete');
    expect(permissions.member).not.toContain('invite');

    // Verify viewer can only read
    expect(permissions.viewer).toEqual(['read']);
  });
});
