import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 20;

export function useQuotes(page: number = 1) {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['quotes', user?.id, team?.id, page],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('quotes')
        .select('*, clients(name)', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (team?.id) {
        query = query.eq('team_id', team.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        quotes: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - list data doesn't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
  });
}

export function useQuote(id: string) {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['quote', id, team?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('quotes')
        .select('*, clients(*), quote_line_items(*)')
        .eq('id', id)
        .is('deleted_at', null);

      // Defence-in-depth: filter by team or user in addition to RLS
      if (team?.id) {
        query = query.eq('team_id', team.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
    staleTime: 2 * 60 * 1000,  // 2 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: set deleted_at timestamp
      const { error } = await supabase
        .from('quotes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate and refetch quotes list
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete quote',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate both the list and the specific quote
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', variables.id] });
    },
  });
}
