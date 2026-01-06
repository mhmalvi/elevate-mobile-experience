import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClients, useClient, useDeleteClient, useClientSearch } from './useClients';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('Client Management - useClients Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Mock authenticated user
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

  describe('useClients - Fetching client list', () => {
    it('should fetch clients successfully', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'John Smith',
          email: 'john@example.com',
          phone: '0412345678',
          user_id: 'user-123',
          deleted_at: null,
        },
        {
          id: 'client-2',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '0423456789',
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
          data: mockClients,
          count: 2,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useClients(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.clients).toHaveLength(2);
      expect(result.current.data?.clients[0].name).toBe('John Smith');
      expect(result.current.data?.totalCount).toBe(2);
      expect(result.current.data?.totalPages).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          count: 45,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useClients(2), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.range).toHaveBeenCalledWith(20, 39);
      expect(result.current.data?.totalPages).toBe(3); // 45 clients / 20 per page
    });

    it('should not fetch when user is not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useClients(1), { wrapper });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle errors when fetching clients fails', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: { message: 'Database error' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useClients(1), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it('should filter out soft-deleted clients', async () => {
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

      renderHook(() => useClients(1), { wrapper });

      await waitFor(() =>
        expect(mockSupabaseChain.is).toHaveBeenCalledWith('deleted_at', null)
      );
    });
  });

  describe('useClient - Fetching single client', () => {
    it('should fetch a single client by ID', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'John Smith',
        email: 'john@example.com',
        phone: '0412345678',
        address: '123 Main St',
        user_id: 'user-123',
        deleted_at: null,
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockClient,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useClient('client-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe('client-1');
      expect(result.current.data?.name).toBe('John Smith');
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'client-1');
    });

    it('should handle client not found', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useClient('nonexistent'), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useDeleteClient - Soft delete functionality', () => {
    it('should soft delete a client', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useDeleteClient(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate('client-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'client-1');
    });

    it('should handle deletion errors', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Deletion failed' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useDeleteClient(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate('client-1');

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useClientSearch - Search functionality', () => {
    it('should search clients by name', async () => {
      const mockClients = [
        { id: 'client-1', name: 'John Smith', email: 'john@example.com' },
        { id: 'client-2', name: 'Johnny Doe', email: 'johnny@example.com' },
      ];

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockClients,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useClientSearch('john'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(mockSupabaseChain.or).toHaveBeenCalledWith(
        expect.stringContaining('name.ilike.%john%')
      );
    });

    it('should search clients by email', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      renderHook(() => useClientSearch('example.com'), { wrapper });

      await waitFor(() =>
        expect(mockSupabaseChain.or).toHaveBeenCalledWith(
          expect.stringContaining('email.ilike.%example.com%')
        )
      );
    });

    it('should not search with less than 2 characters', async () => {
      const { result } = renderHook(() => useClientSearch('j'), { wrapper });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should limit search results to 10', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      renderHook(() => useClientSearch('smith'), { wrapper });

      await waitFor(() => expect(mockSupabaseChain.limit).toHaveBeenCalledWith(10));
    });
  });
});
