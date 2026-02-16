import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';

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
    staleTime: 60000, // Clients change less frequently
    gcTime: 600000,
  });
}

export function useClient(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

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
  });
}

// Hook for searching clients (useful for autocomplete)
export function useClientSearch(searchTerm: string) {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['clients', 'search', searchTerm, team?.id],
    queryFn: async () => {
      if (!user || !searchTerm) return [];

      let query = supabase
        .from('clients')
        .select('*')
        .is('deleted_at', null)
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
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
    staleTime: 60000,
  });
}
