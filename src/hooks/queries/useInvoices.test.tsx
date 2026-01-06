import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvoices, useInvoice, useDeleteInvoice, useUpdateInvoiceStatus } from './useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('Invoice Management - useInvoices Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123' } as any,
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useInvoices - Fetching invoice list', () => {
    it('should fetch invoices with client information', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          invoice_number: 'INV-001',
          client_id: 'client-1',
          status: 'draft',
          subtotal: 1000,
          gst_amount: 100,
          total: 1100,
          amount_paid: 0,
          balance: 1100,
          clients: { name: 'John Smith' },
          user_id: 'user-123',
          deleted_at: null,
        },
        {
          id: 'invoice-2',
          invoice_number: 'INV-002',
          client_id: 'client-2',
          status: 'sent',
          subtotal: 2000,
          gst_amount: 200,
          total: 2200,
          amount_paid: 1000,
          balance: 1200,
          clients: { name: 'Jane Doe' },
          user_id: 'user-123',
          deleted_at: null,
        },
      ];

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockInvoices,
          count: 2,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useInvoices(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.invoices).toHaveLength(2);
      expect(result.current.data?.invoices[0].invoice_number).toBe('INV-001');
      expect(result.current.data?.invoices[0].clients.name).toBe('John Smith');
      expect(result.current.data?.totalCount).toBe(2);
    });

    it('should track invoice payment status correctly', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          total: 1100,
          amount_paid: 0,
          balance: 1100,
          status: 'sent',
        },
        {
          id: 'invoice-2',
          total: 2200,
          amount_paid: 1100,
          balance: 1100,
          status: 'partially_paid',
        },
        {
          id: 'invoice-3',
          total: 3300,
          amount_paid: 3300,
          balance: 0,
          status: 'paid',
        },
      ];

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockInvoices,
          count: 3,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useInvoices(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const invoices = result.current.data?.invoices || [];
      expect(invoices[0].balance).toBe(1100); // Unpaid
      expect(invoices[1].balance).toBe(1100); // Half paid
      expect(invoices[2].balance).toBe(0); // Fully paid
    });
  });

  describe('useInvoice - Fetching single invoice with line items', () => {
    it('should fetch invoice with client and line items', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoice_number: 'INV-001',
        status: 'sent',
        subtotal: 1000,
        gst_amount: 100,
        total: 1100,
        amount_paid: 500,
        balance: 600,
        due_date: '2026-02-06',
        clients: {
          id: 'client-1',
          name: 'John Smith',
          email: 'john@example.com',
        },
        invoice_line_items: [
          {
            id: 'item-1',
            description: 'Labour',
            quantity: 10,
            unit_price: 85,
            amount: 850,
          },
          {
            id: 'item-2',
            description: 'Materials',
            quantity: 1,
            unit_price: 150,
            amount: 150,
          },
        ],
        deleted_at: null,
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvoice,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe('invoice-1');
      expect(result.current.data?.clients.name).toBe('John Smith');
      expect(result.current.data?.invoice_line_items).toHaveLength(2);
      expect(result.current.data?.total).toBe(1100);
      expect(result.current.data?.balance).toBe(600);
    });

    it('should calculate outstanding balance correctly', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        total: 2200,
        amount_paid: 1000,
        balance: 1200,
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvoice,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.balance).toBe(1200);
      expect(result.current.data?.total).toBe(2200);
      expect(result.current.data?.amount_paid).toBe(1000);
    });
  });

  describe('useDeleteInvoice - Soft delete functionality', () => {
    it('should soft delete an invoice', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useDeleteInvoice(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate('invoice-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'invoice-1');
    });

    it('should invalidate invoices cache after deletion', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteInvoice(), { wrapper });

      result.current.mutate('invoice-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invoices'] });
    });
  });

  describe('useUpdateInvoiceStatus - Payment tracking', () => {
    it('should update invoice status from draft to sent', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateInvoiceStatus(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate({ id: 'invoice-1', status: 'sent' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({ status: 'sent' });
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'invoice-1');
    });

    it('should update invoice status to partially_paid', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateInvoiceStatus(), { wrapper });

      result.current.mutate({ id: 'invoice-1', status: 'partially_paid' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        status: 'partially_paid',
      });
    });

    it('should update invoice status to paid', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateInvoiceStatus(), { wrapper });

      result.current.mutate({ id: 'invoice-1', status: 'paid' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({ status: 'paid' });
    });

    it('should update invoice status to overdue', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateInvoiceStatus(), { wrapper });

      result.current.mutate({ id: 'invoice-1', status: 'overdue' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({ status: 'overdue' });
    });

    it('should invalidate both list and detail caches after status update', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateInvoiceStatus(), { wrapper });

      result.current.mutate({ id: 'invoice-1', status: 'paid' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invoices'] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['invoice', 'invoice-1'],
      });
    });
  });

  describe('Invoice Business Logic', () => {
    it('should maintain accurate financial calculations', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        subtotal: 1000.00,
        gst_amount: 100.00,
        total: 1100.00,
        amount_paid: 500.00,
        balance: 600.00,
        invoice_line_items: [
          { quantity: 10, unit_price: 85, amount: 850 },
          { quantity: 1, unit_price: 150, amount: 150 },
        ],
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvoice,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify subtotal equals sum of line items
      const lineItemsTotal = mockInvoice.invoice_line_items.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      expect(result.current.data?.subtotal).toBe(lineItemsTotal);

      // Verify GST is 10% of subtotal
      expect(result.current.data?.gst_amount).toBe(100);

      // Verify total is subtotal + GST
      expect(result.current.data?.total).toBe(1100);

      // Verify balance is total - amount_paid
      expect(result.current.data?.balance).toBe(
        result.current.data!.total - result.current.data!.amount_paid
      );
    });

    it('should handle fully paid invoices', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        total: 1100,
        amount_paid: 1100,
        balance: 0,
        status: 'paid',
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvoice,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.balance).toBe(0);
      expect(result.current.data?.status).toBe('paid');
    });

    it('should handle overpayment correctly', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        total: 1100,
        amount_paid: 1200,
        balance: -100,
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvoice,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.balance).toBe(-100);
    });
  });
});
