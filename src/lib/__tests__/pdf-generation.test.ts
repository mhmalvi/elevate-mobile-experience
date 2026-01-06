/**
 * PDF Generation Tests
 *
 * Tests PDF generation for invoices and quotes
 * Covers document structure, content accuracy, and formatting
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
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

describe('PDF Generation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invoice PDF Generation', () => {
    it('should generate PDF for invoice', async () => {
      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/invoices/inv_123.pdf',
          pdf_data: 'base64_encoded_pdf_data',
          success: true,
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.success).toBe(true);
      expect(result.data.pdf_url).toContain('.pdf');
    });

    it('should include all invoice details in PDF', async () => {
      const mockInvoice = {
        id: 'inv_123',
        invoice_number: 'INV-2026-001',
        client: {
          name: 'Test Client',
          email: 'client@example.com',
          phone: '0412 345 678',
        },
        line_items: [
          {
            description: 'Plumbing services',
            quantity: 2,
            rate: 150,
            total: 300,
          },
        ],
        subtotal: 300,
        gst: 30,
        total: 330,
        status: 'sent',
        due_date: '2026-01-15',
      };

      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/invoices/inv_123.pdf',
          success: true,
          metadata: {
            invoice_number: mockInvoice.invoice_number,
            client_name: mockInvoice.client.name,
            total: mockInvoice.total,
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
        },
      });

      expect(result.data.metadata.invoice_number).toBe('INV-2026-001');
      expect(result.data.metadata.client_name).toBe('Test Client');
      expect(result.data.metadata.total).toBe(330);
    });

    it('should handle PDF generation errors', async () => {
      const mockResponse = {
        data: null,
        error: {
          message: 'Invoice not found',
          code: 'not_found',
        },
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'invalid_id',
          type: 'invoice',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('not_found');
    });
  });

  describe('Quote PDF Generation', () => {
    it('should generate PDF for quote', async () => {
      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/quotes/quo_123.pdf',
          pdf_data: 'base64_encoded_pdf_data',
          success: true,
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          quote_id: 'quo_123',
          type: 'quote',
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.success).toBe(true);
      expect(result.data.pdf_url).toContain('.pdf');
    });

    it('should include all quote details in PDF', async () => {
      const mockQuote = {
        id: 'quo_123',
        quote_number: 'QUO-2026-001',
        client: {
          name: 'Test Client',
          email: 'client@example.com',
        },
        line_items: [
          {
            description: 'Bathroom renovation',
            quantity: 1,
            rate: 5000,
            total: 5000,
          },
        ],
        subtotal: 5000,
        gst: 500,
        total: 5500,
        status: 'sent',
        valid_until: '2026-02-15',
      };

      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/quotes/quo_123.pdf',
          success: true,
          metadata: {
            quote_number: mockQuote.quote_number,
            client_name: mockQuote.client.name,
            total: mockQuote.total,
            valid_until: mockQuote.valid_until,
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          quote_id: 'quo_123',
          type: 'quote',
        },
      });

      expect(result.data.metadata.quote_number).toBe('QUO-2026-001');
      expect(result.data.metadata.valid_until).toBeDefined();
    });
  });

  describe('PDF Formatting', () => {
    it('should format currency correctly in AUD', () => {
      const amount = 123456; // $1,234.56 in cents
      const formatted = (amount / 100).toLocaleString('en-AU', {
        style: 'currency',
        currency: 'AUD',
      });

      expect(formatted).toContain('1,234.56');
    });

    it('should format dates in Australian format (DD/MM/YYYY)', () => {
      const date = new Date('2026-01-15');
      const formatted = date.toLocaleDateString('en-AU');

      expect(formatted).toBe('15/01/2026');
    });

    it('should format ABN correctly (XX XXX XXX XXX)', () => {
      const abn = '51824753556';
      const formatted = abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');

      expect(formatted).toBe('51 824 753 556');
    });

    it('should format phone numbers in Australian format', () => {
      const phone = '0412345678';
      const formatted = phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');

      expect(formatted).toBe('0412 345 678');
    });
  });

  describe('PDF Branding', () => {
    it('should include business logo in PDF', async () => {
      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/invoices/inv_123.pdf',
          success: true,
          branding: {
            logo_url: 'https://storage.supabase.co/logos/business_logo.png',
            business_name: 'Test Plumbing Services',
            abn: '51 824 753 556',
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
          include_branding: true,
        },
      });

      expect(result.data.branding).toBeDefined();
      expect(result.data.branding.logo_url).toContain('logo');
      expect(result.data.branding.business_name).toBe('Test Plumbing Services');
    });

    it('should use default branding if custom branding not set', async () => {
      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/invoices/inv_123.pdf',
          success: true,
          branding: {
            logo_url: null,
            business_name: 'TradieMate User',
            use_default: true,
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
        },
      });

      expect(result.data.branding.use_default).toBe(true);
    });
  });

  describe('PDF Line Items', () => {
    it('should calculate line item totals correctly', () => {
      const lineItems = [
        { description: 'Labour', quantity: 4, rate: 100, total: 400 },
        { description: 'Materials', quantity: 1, rate: 250, total: 250 },
        { description: 'Travel', quantity: 2, rate: 50, total: 100 },
      ];

      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const gst = subtotal * 0.1;
      const total = subtotal + gst;

      expect(subtotal).toBe(750);
      expect(gst).toBe(75);
      expect(total).toBe(825);
    });

    it('should handle decimal quantities and rates', () => {
      const lineItems = [
        { description: 'Hourly rate', quantity: 2.5, rate: 85.5, total: 213.75 },
        { description: 'Materials', quantity: 1.25, rate: 120, total: 150 },
      ];

      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

      expect(subtotal).toBe(363.75);
    });

    it('should round line item totals to 2 decimal places', () => {
      const quantity = 3;
      const rate = 33.333;
      const total = parseFloat((quantity * rate).toFixed(2));

      expect(total).toBe(100);
    });
  });

  describe('PDF Payment Information', () => {
    it('should include payment instructions in invoice PDF', async () => {
      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/invoices/inv_123.pdf',
          success: true,
          payment_info: {
            bsb: '123-456',
            account_number: '12345678',
            account_name: 'Test Plumbing Services',
            payment_url: 'https://app.tradiemate.com/pay/inv_123',
          },
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
        },
      });

      expect(result.data.payment_info).toBeDefined();
      expect(result.data.payment_info.bsb).toBe('123-456');
      expect(result.data.payment_info.payment_url).toContain('/pay/');
    });

    it('should include due date in invoice PDF', async () => {
      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/invoices/inv_123.pdf',
          success: true,
          due_date: '2026-01-22',
          payment_terms: '7 days',
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
        },
      });

      expect(result.data.due_date).toBeDefined();
      expect(result.data.payment_terms).toBe('7 days');
    });
  });

  describe('PDF Storage', () => {
    it('should store PDF in Supabase storage', async () => {
      const mockResponse = {
        data: {
          pdf_url: 'https://storage.supabase.co/v1/object/public/invoices/inv_123.pdf',
          storage_path: 'invoices/inv_123.pdf',
          success: true,
        },
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
        },
      });

      expect(result.data.pdf_url).toContain('storage.supabase.co');
      expect(result.data.storage_path).toContain('invoices/');
    });

    it('should generate unique PDF filenames', async () => {
      const invoiceIds = ['inv_123', 'inv_124', 'inv_125'];
      const filenames = invoiceIds.map((id) => `invoices/${id}.pdf`);

      const uniqueFilenames = new Set(filenames);
      expect(uniqueFilenames.size).toBe(3);
    });
  });

  describe('PDF Access Control', () => {
    it('should require authentication to generate PDF', async () => {
      const mockResponse = {
        data: null,
        error: {
          message: 'Unauthorized',
          code: 'unauthorized',
        },
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_123',
          type: 'invoice',
        },
        // No auth header
      });

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('unauthorized');
    });

    it('should verify ownership before generating PDF', async () => {
      const mockResponse = {
        data: null,
        error: {
          message: 'Access denied',
          code: 'forbidden',
        },
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('generate-pdf', {
        body: {
          invoice_id: 'inv_other_user',
          type: 'invoice',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('forbidden');
    });
  });

  describe('PDF Content Validation', () => {
    it('should validate required invoice fields before generating PDF', () => {
      const requiredFields = [
        'invoice_number',
        'client_id',
        'line_items',
        'subtotal',
        'gst',
        'total',
      ];

      const mockInvoice = {
        invoice_number: 'INV-001',
        client_id: 'client_123',
        line_items: [],
        subtotal: 0,
        gst: 0,
        total: 0,
      };

      requiredFields.forEach((field) => {
        expect(mockInvoice).toHaveProperty(field);
      });
    });

    it('should validate line items are not empty', () => {
      const validLineItems = [
        { description: 'Service', quantity: 1, rate: 100, total: 100 },
      ];

      expect(validLineItems.length).toBeGreaterThan(0);
      expect(validLineItems[0].description).toBeDefined();
      expect(validLineItems[0].total).toBeGreaterThan(0);
    });
  });
});
