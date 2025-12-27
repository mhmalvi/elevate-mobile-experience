import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const PAGE_SIZE = 20;

export function useClients(page: number = 1) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clients', user?.id, page],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .range(from, to);

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

  return useQuery({
    queryKey: ['clients', 'search', searchTerm],
    queryFn: async () => {
      if (!user || !searchTerm) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .order('name')
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && searchTerm.length >= 2,
    staleTime: 60000,
  });
}
