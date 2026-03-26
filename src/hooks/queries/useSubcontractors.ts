import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useToast } from '@/hooks/use-toast';

export function useSubcontractors() {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['subcontractors', user?.id, team?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('subcontractors')
        .select('*')
        .is('deleted_at', null)
        .order('name');

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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useDeleteSubcontractor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSaveSubcontractor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, unknown> }) => {
      if (id) {
        const { error } = await supabase
          .from('subcontractors')
          .update(data)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subcontractors')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      toast({
        title: variables.id ? 'Subcontractor updated' : 'Subcontractor added!',
      });
    },
    onError: (error: Error, variables) => {
      toast({
        title: variables.id ? 'Error updating' : 'Error adding',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
