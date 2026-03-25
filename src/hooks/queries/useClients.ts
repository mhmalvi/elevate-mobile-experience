import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 20;

export function useClients(page: number = 1) {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['clients', user?.id, team?.id, page],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .range(from, to);

      if (team?.id) {
        query = query.eq('team_id', team.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        clients: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - list data doesn't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
  });
}

export function useClient(id: string) {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['client', id, team?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('clients')
        .select('*')
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

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: set deleted_at timestamp
      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete client',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook for fetching all clients (for forms/selects - no pagination)
export function useAllClients() {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['clients', 'all', user?.id, team?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('clients')
        .select('id, name')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (team?.id) {
        query = query.eq('team_id', team.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// Sanitize search term for PostgREST filter syntax
// Commas delimit .or() filters, parens are syntax, backslash is escape char
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()\\]/g, '');
}

// Hook for searching clients (useful for autocomplete)
export function useClientSearch(searchTerm: string) {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['clients', 'search', searchTerm, team?.id],
    queryFn: async () => {
      if (!user || !searchTerm) return [];

      const sanitized = sanitizeSearchTerm(searchTerm);
      if (!sanitized) return [];

      let query = supabase
        .from('clients')
        .select('*')
        .is('deleted_at', null)
        .or(`name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
        .order('name')
        .limit(10);

      if (team?.id) {
        query = query.eq('team_id', team.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && searchTerm.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
