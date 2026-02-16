import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';

const PAGE_SIZE = 20;

export function useJobs(page: number = 1) {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['jobs', user?.id, team?.id, page],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('jobs')
        .select('*, clients(name)', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Filter by team or user - RLS handles team member access
      if (team?.id) {
        query = query.eq('team_id', team.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        jobs: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
    enabled: !!user,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useJob(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, clients(*), quote:quotes(*)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: set deleted_at timestamp
      const { error } = await supabase
        .from('jobs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.id] });
    },
  });
}
