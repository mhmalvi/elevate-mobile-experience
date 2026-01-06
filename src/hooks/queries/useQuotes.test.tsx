import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuotes, useQuote, useDeleteQuote, useUpdateQuoteStatus } from './useQuotes';
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

describe('Quote Management - useQuotes Hook', () => {
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

  describe('useQuotes - Fetching quote list', () => {
    it('should fetch quotes with client information', async () => {
      const mockQuotes = [
        {
          id: 'quote-1',
          quote_number: 'QT-001',
          client_id: 'client-1',
          status: 'draft',
          subtotal: 1000,
          gst_amount: 100,
          total: 1100,
          clients: { name: 'John Smith' },
          user_id: 'user-123',
          deleted_at: null,
        },
        {
          id: 'quote-2',
          quote_number: 'QT-002',
          client_id: 'client-2',
          status: 'sent',
          subtotal: 2000,
          gst_amount: 200,
          total: 2200,
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
          data: mockQuotes,
          count: 2,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useQuotes(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.quotes).toHaveLength(2);
      expect(result.current.data?.quotes[0].quote_number).toBe('QT-001');
      expect(result.current.data?.quotes[0].clients.name).toBe('John Smith');
      expect(result.current.data?.totalCount).toBe(2);
    });

    it('should calculate total pages correctly', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          count: 55,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useQuotes(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.totalPages).toBe(3); // 55 / 20 = 3 pages
    });

    it('should order quotes by created_at descending', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      renderHook(() => useQuotes(1), { wrapper });

      await waitFor(() =>
        expect(mockSupabaseChain.order).toHaveBeenCalledWith('created_at', {
          ascending: false,
        })
      );
    });
  });

  describe('useQuote - Fetching single quote with line items', () => {
    it('should fetch quote with client and line items', async () => {
      const mockQuote = {
        id: 'quote-1',
        quote_number: 'QT-001',
        status: 'draft',
        subtotal: 1000,
        gst_amount: 100,
        total: 1100,
        clients: {
          id: 'client-1',
          name: 'John Smith',
          email: 'john@example.com',
        },
        quote_line_items: [
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
          data: mockQuote,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useQuote('quote-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe('quote-1');
      expect(result.current.data?.clients.name).toBe('John Smith');
      expect(result.current.data?.quote_line_items).toHaveLength(2);
      expect(result.current.data?.total).toBe(1100);
    });

    it('should calculate line item totals correctly', async () => {
      const mockQuote = {
        id: 'quote-1',
        quote_line_items: [
          { quantity: 10, unit_price: 85, amount: 850 },
          { quantity: 5, unit_price: 100, amount: 500 },
        ],
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockQuote,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useQuote('quote-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const lineItems = result.current.data?.quote_line_items || [];
      expect(lineItems[0].amount).toBe(850);
      expect(lineItems[1].amount).toBe(500);
    });
  });

  describe('useDeleteQuote - Soft delete functionality', () => {
    it('should soft delete a quote', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useDeleteQuote(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate('quote-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'quote-1');
    });

    it('should invalidate quotes cache after deletion', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteQuote(), { wrapper });

      result.current.mutate('quote-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['quotes'] });
    });
  });

  describe('useUpdateQuoteStatus - Status management', () => {
    it('should update quote status from draft to sent', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateQuoteStatus(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate({ id: 'quote-1', status: 'sent' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({ status: 'sent' });
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'quote-1');
    });

    it('should update quote status from sent to accepted', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateQuoteStatus(), { wrapper });

      result.current.mutate({ id: 'quote-1', status: 'accepted' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({ status: 'accepted' });
    });

    it('should update quote status to declined', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateQuoteStatus(), { wrapper });

      result.current.mutate({ id: 'quote-1', status: 'declined' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({ status: 'declined' });
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

      const { result } = renderHook(() => useUpdateQuoteStatus(), { wrapper });

      result.current.mutate({ id: 'quote-1', status: 'accepted' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['quotes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['quote', 'quote-1'] });
    });

    it('should handle status update errors', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateQuoteStatus(), { wrapper });

      result.current.mutate({ id: 'quote-1', status: 'sent' });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('Quote Business Logic', () => {
    it('should maintain accurate financial calculations', async () => {
      const mockQuote = {
        id: 'quote-1',
        subtotal: 1000.00,
        gst_amount: 100.00,
        total: 1100.00,
        quote_line_items: [
          { quantity: 10, unit_price: 85, amount: 850 },
          { quantity: 1, unit_price: 150, amount: 150 },
        ],
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockQuote,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useQuote('quote-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify subtotal equals sum of line items
      const lineItemsTotal = mockQuote.quote_line_items.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      expect(result.current.data?.subtotal).toBe(lineItemsTotal);

      // Verify GST is 10% of subtotal
      expect(result.current.data?.gst_amount).toBe(
        Math.round(lineItemsTotal * 0.1 * 100) / 100
      );

      // Verify total is subtotal + GST
      expect(result.current.data?.total).toBe(
        lineItemsTotal + result.current.data!.gst_amount
      );
    });
  });
});
