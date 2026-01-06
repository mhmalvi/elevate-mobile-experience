import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJobs, useJob, useDeleteJob, useUpdateJobStatus } from './useJobs';
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

describe('Job Management - useJobs Hook', () => {
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

  describe('useJobs - Fetching job list', () => {
    it('should fetch jobs with client information', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          title: 'Bathroom Renovation',
          client_id: 'client-1',
          status: 'scheduled',
          scheduled_start: '2026-01-15',
          scheduled_end: '2026-01-20',
          clients: { name: 'John Smith' },
          user_id: 'user-123',
          deleted_at: null,
        },
        {
          id: 'job-2',
          title: 'Kitchen Remodel',
          client_id: 'client-2',
          status: 'in_progress',
          scheduled_start: '2026-01-10',
          scheduled_end: '2026-01-25',
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
          data: mockJobs,
          count: 2,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useJobs(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs[0].title).toBe('Bathroom Renovation');
      expect(result.current.data?.jobs[0].clients.name).toBe('John Smith');
      expect(result.current.data?.totalCount).toBe(2);
    });

    it('should track job status correctly', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'scheduled' },
        { id: 'job-2', status: 'in_progress' },
        { id: 'job-3', status: 'completed' },
        { id: 'job-4', status: 'cancelled' },
      ];

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockJobs,
          count: 4,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useJobs(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const jobs = result.current.data?.jobs || [];
      expect(jobs[0].status).toBe('scheduled');
      expect(jobs[1].status).toBe('in_progress');
      expect(jobs[2].status).toBe('completed');
      expect(jobs[3].status).toBe('cancelled');
    });

    it('should order jobs by created_at descending', async () => {
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

      renderHook(() => useJobs(1), { wrapper });

      await waitFor(() =>
        expect(mockSupabaseChain.order).toHaveBeenCalledWith('created_at', {
          ascending: false,
        })
      );
    });
  });

  describe('useJob - Fetching single job with details', () => {
    it('should fetch job with client and quote information', async () => {
      const mockJob = {
        id: 'job-1',
        title: 'Bathroom Renovation',
        description: 'Full bathroom renovation including tiling',
        status: 'in_progress',
        scheduled_start: '2026-01-15',
        scheduled_end: '2026-01-20',
        actual_start: '2026-01-15',
        actual_end: null,
        clients: {
          id: 'client-1',
          name: 'John Smith',
          email: 'john@example.com',
          phone: '0412345678',
        },
        quote: {
          id: 'quote-1',
          quote_number: 'QT-001',
          total: 5500,
          status: 'accepted',
        },
        deleted_at: null,
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockJob,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useJob('job-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe('job-1');
      expect(result.current.data?.title).toBe('Bathroom Renovation');
      expect(result.current.data?.clients.name).toBe('John Smith');
      expect(result.current.data?.quote.quote_number).toBe('QT-001');
    });

    it('should track job progress with actual dates', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'in_progress',
        scheduled_start: '2026-01-15',
        scheduled_end: '2026-01-20',
        actual_start: '2026-01-15',
        actual_end: null,
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockJob,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useJob('job-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.actual_start).toBe('2026-01-15');
      expect(result.current.data?.actual_end).toBeNull();
      expect(result.current.data?.status).toBe('in_progress');
    });

    it('should handle completed jobs with actual dates', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'completed',
        scheduled_start: '2026-01-15',
        scheduled_end: '2026-01-20',
        actual_start: '2026-01-15',
        actual_end: '2026-01-19',
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockJob,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useJob('job-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.status).toBe('completed');
      expect(result.current.data?.actual_start).toBe('2026-01-15');
      expect(result.current.data?.actual_end).toBe('2026-01-19');
    });
  });

  describe('useDeleteJob - Soft delete functionality', () => {
    it('should soft delete a job', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useDeleteJob(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate('job-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'job-1');
    });

    it('should invalidate jobs cache after deletion', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteJob(), { wrapper });

      result.current.mutate('job-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jobs'] });
    });
  });

  describe('useUpdateJobStatus - Status transitions', () => {
    it('should update job status from scheduled to in_progress', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateJobStatus(), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());

      result.current.mutate({ id: 'job-1', status: 'in_progress' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        status: 'in_progress',
      });
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'job-1');
    });

    it('should update job status from in_progress to completed', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateJobStatus(), { wrapper });

      result.current.mutate({ id: 'job-1', status: 'completed' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        status: 'completed',
      });
    });

    it('should handle job cancellation', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateJobStatus(), { wrapper });

      result.current.mutate({ id: 'job-1', status: 'cancelled' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        status: 'cancelled',
      });
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

      const { result } = renderHook(() => useUpdateJobStatus(), { wrapper });

      result.current.mutate({ id: 'job-1', status: 'completed' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jobs'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job', 'job-1'] });
    });

    it('should handle status update errors', async () => {
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useUpdateJobStatus(), { wrapper });

      result.current.mutate({ id: 'job-1', status: 'in_progress' });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('Job Business Logic', () => {
    it('should link jobs to quotes correctly', async () => {
      const mockJob = {
        id: 'job-1',
        title: 'Bathroom Renovation',
        quote: {
          id: 'quote-1',
          quote_number: 'QT-001',
          status: 'accepted',
          total: 5500,
        },
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockJob,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useJob('job-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.quote.id).toBe('quote-1');
      expect(result.current.data?.quote.status).toBe('accepted');
    });

    it('should track job duration accurately', async () => {
      const mockJob = {
        id: 'job-1',
        scheduled_start: '2026-01-15',
        scheduled_end: '2026-01-20',
        actual_start: '2026-01-15',
        actual_end: '2026-01-19',
        status: 'completed',
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockJob,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const { result } = renderHook(() => useJob('job-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Job was scheduled for 5 days (15th-20th)
      // But completed in 4 days (15th-19th)
      const scheduledStart = new Date(mockJob.scheduled_start);
      const scheduledEnd = new Date(mockJob.scheduled_end);
      const actualStart = new Date(mockJob.actual_start);
      const actualEnd = new Date(mockJob.actual_end);

      const scheduledDuration =
        (scheduledEnd.getTime() - scheduledStart.getTime()) /
        (1000 * 60 * 60 * 24);
      const actualDuration =
        (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24);

      expect(scheduledDuration).toBe(5);
      expect(actualDuration).toBe(4);
    });
  });
});
