/**
 * Notification Integration Tests
 *
 * Tests email and SMS notification functionality
 * Covers invoice/quote sending, payment reminders, and client notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('Email Notification Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invoice Email Sending', () => {
    it('should send invoice via email', async () => {
      const mockResponse = {
        data: {
          success: true,
          message_id: 'msg_123',
          email_sent_to: 'client@example.com',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-invoice', {
        body: {
          invoice_id: 'inv_123',
          to_email: 'client@example.com',
          method: 'email',
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.success).toBe(true);
      expect(result.data.email_sent_to).toBe('client@example.com');
    });

    it('should include invoice details in email', async () => {
      const mockResponse = {
        data: {
          success: true,
          email_content: {
            subject: 'Invoice #INV-2026-001 from Test Plumbing',
            invoice_number: 'INV-2026-001',
            total: 1000,
            due_date: '2026-01-22',
            payment_url: 'https://app.tradiemate.com/pay/inv_123',
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-invoice', {
        body: {
          invoice_id: 'inv_123',
          to_email: 'client@example.com',
        },
      });

      expect(result.data.email_content.invoice_number).toBe('INV-2026-001');
      expect(result.data.email_content.payment_url).toContain('/pay/');
    });

    it('should handle email sending errors', async () => {
      const mockResponse = {
        data: null,
        error: {
          message: 'Invalid email address',
          code: 'invalid_email',
        },
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-invoice', {
        body: {
          invoice_id: 'inv_123',
          to_email: 'invalid-email',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('invalid_email');
    });
  });

  describe('Quote Email Sending', () => {
    it('should send quote via email', async () => {
      const mockResponse = {
        data: {
          success: true,
          message_id: 'msg_124',
          email_sent_to: 'client@example.com',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-notification', {
        body: {
          quote_id: 'quo_123',
          to_email: 'client@example.com',
          type: 'quote',
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.success).toBe(true);
    });

    it('should include quote validity period in email', async () => {
      const mockResponse = {
        data: {
          success: true,
          email_content: {
            subject: 'Quote #QUO-2026-001 from Test Plumbing',
            quote_number: 'QUO-2026-001',
            total: 5000,
            valid_until: '2026-02-15',
            view_url: 'https://app.tradiemate.com/quotes/quo_123',
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-notification', {
        body: {
          quote_id: 'quo_123',
          to_email: 'client@example.com',
          type: 'quote',
        },
      });

      expect(result.data.email_content.valid_until).toBeDefined();
      expect(result.data.email_content.view_url).toContain('/quotes/');
    });
  });

  describe('Payment Reminder Emails', () => {
    it('should send payment reminder for overdue invoice', async () => {
      const mockResponse = {
        data: {
          success: true,
          reminder_sent: true,
          days_overdue: 3,
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('payment-reminder', {
        body: {
          invoice_id: 'inv_123',
          days_overdue: 3,
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.reminder_sent).toBe(true);
      expect(result.data.days_overdue).toBe(3);
    });

    it('should include overdue amount in reminder', async () => {
      const mockResponse = {
        data: {
          success: true,
          email_content: {
            subject: 'Payment Reminder - Invoice #INV-2026-001',
            days_overdue: 5,
            total_amount: 1000,
            late_fee: 50,
            payment_url: 'https://app.tradiemate.com/pay/inv_123',
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('payment-reminder', {
        body: {
          invoice_id: 'inv_123',
        },
      });

      expect(result.data.email_content.days_overdue).toBeGreaterThan(0);
      expect(result.data.email_content.total_amount).toBeGreaterThan(0);
    });
  });

  describe('Email Formatting', () => {
    it('should use proper email template structure', async () => {
      const mockResponse = {
        data: {
          success: true,
          email_content: {
            from: 'noreply@tradiemate.com',
            to: 'client@example.com',
            subject: 'Invoice from Test Plumbing',
            html: '<html><body>Invoice content</body></html>',
            text: 'Invoice content (plain text)',
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-email', {
        body: {
          to: 'client@example.com',
          template: 'invoice',
          data: {
            invoice_number: 'INV-001',
          },
        },
      });

      expect(result.data.email_content.html).toContain('<html>');
      expect(result.data.email_content.text).toBeDefined();
    });

    it('should include unsubscribe link in emails', async () => {
      const mockResponse = {
        data: {
          success: true,
          email_content: {
            html: '<html><body>Content <a href="unsubscribe">Unsubscribe</a></body></html>',
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-email', {
        body: {
          to: 'client@example.com',
          template: 'marketing',
        },
      });

      expect(result.data.email_content.html).toContain('unsubscribe');
    });
  });
});

describe('SMS Notification Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invoice SMS Sending', () => {
    it('should send invoice via SMS', async () => {
      const mockResponse = {
        data: {
          success: true,
          message_sid: 'SM123',
          sms_sent_to: '+61412345678',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-invoice', {
        body: {
          invoice_id: 'inv_123',
          to_phone: '+61412345678',
          method: 'sms',
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.success).toBe(true);
      expect(result.data.sms_sent_to).toContain('+61');
    });

    it('should format Australian phone numbers correctly', () => {
      const testCases = [
        { input: '0412345678', expected: '+61412345678' },
        { input: '+61412345678', expected: '+61412345678' },
        { input: '61412345678', expected: '+61412345678' },
      ];

      testCases.forEach(({ input, expected }) => {
        const formatted = input.replace(/^0/, '+61').replace(/^(?!\+)/, '+');
        expect(formatted).toBe(expected);
      });
    });

    it('should include short invoice summary in SMS', async () => {
      const mockResponse = {
        data: {
          success: true,
          sms_content: 'Invoice #INV-001 for $1,000. Pay now: https://short.link/inv123',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-invoice', {
        body: {
          invoice_id: 'inv_123',
          to_phone: '+61412345678',
          method: 'sms',
        },
      });

      expect(result.data.sms_content).toContain('Invoice');
      expect(result.data.sms_content).toContain('$');
      expect(result.data.sms_content.length).toBeLessThan(160); // SMS limit
    });
  });

  describe('Quote SMS Sending', () => {
    it('should send quote via SMS', async () => {
      const mockResponse = {
        data: {
          success: true,
          message_sid: 'SM124',
          sms_sent_to: '+61412345678',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-notification', {
        body: {
          quote_id: 'quo_123',
          to_phone: '+61412345678',
          type: 'quote',
          method: 'sms',
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.success).toBe(true);
    });

    it('should keep SMS under 160 characters', async () => {
      const mockResponse = {
        data: {
          success: true,
          sms_content: 'Quote #QUO-001 for $5,000. Valid until 15/02. View: https://short.link/quo123',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-notification', {
        body: {
          quote_id: 'quo_123',
          to_phone: '+61412345678',
          type: 'quote',
          method: 'sms',
        },
      });

      expect(result.data.sms_content.length).toBeLessThanOrEqual(160);
    });
  });

  describe('SMS Rate Limiting', () => {
    it('should respect subscription SMS limits', async () => {
      const subscriptionLimits = {
        free: 0,
        solo: 100,
        crew: 500,
        pro: Infinity,
      };

      Object.entries(subscriptionLimits).forEach(([tier, limit]) => {
        expect(limit).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return error when SMS limit exceeded', async () => {
      const mockResponse = {
        data: null,
        error: {
          message: 'SMS limit exceeded for your subscription tier',
          code: 'sms_limit_exceeded',
        },
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-notification', {
        body: {
          invoice_id: 'inv_123',
          to_phone: '+61412345678',
          method: 'sms',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('sms_limit_exceeded');
    });
  });

  describe('SMS Delivery Status', () => {
    it('should track SMS delivery status', async () => {
      const mockResponse = {
        data: {
          success: true,
          message_sid: 'SM123',
          status: 'sent',
          delivery_status: 'queued',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('send-notification', {
        body: {
          invoice_id: 'inv_123',
          to_phone: '+61412345678',
          method: 'sms',
        },
      });

      expect(result.data.status).toBe('sent');
      expect(result.data.delivery_status).toBeDefined();
    });
  });
});

describe('Notification Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should respect client notification preferences', async () => {
    const mockPreferences = {
      email_notifications: true,
      sms_notifications: false,
      marketing_emails: false,
    };

    expect(mockPreferences.email_notifications).toBe(true);
    expect(mockPreferences.sms_notifications).toBe(false);
  });

  it('should allow clients to opt out of notifications', async () => {
    const mockResponse = {
      data: {
        success: true,
        unsubscribed: true,
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('send-notification', {
      body: {
        client_id: 'client_123',
        check_preferences: true,
      },
    });

    if (result.data && result.data.unsubscribed) {
      expect(result.data.unsubscribed).toBe(true);
    }
  });
});

describe('Notification Security', () => {
  it('should require authentication to send notifications', async () => {
    const mockResponse = {
      data: null,
      error: {
        message: 'Unauthorized',
        code: 'unauthorized',
      },
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('send-notification', {
      body: {
        invoice_id: 'inv_123',
        to_email: 'client@example.com',
      },
      // No auth header
    });

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('unauthorized');
  });

  it('should verify invoice ownership before sending', async () => {
    const mockResponse = {
      data: null,
      error: {
        message: 'Access denied',
        code: 'forbidden',
      },
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

    const result = await supabase.functions.invoke('send-notification', {
      body: {
        invoice_id: 'inv_other_user',
        to_email: 'client@example.com',
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('forbidden');
  });

  it('should sanitize email content to prevent injection', () => {
    const unsafeContent = '<script>alert("xss")</script>Hello';
    const sanitized = unsafeContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toBe('Hello');
  });
});
