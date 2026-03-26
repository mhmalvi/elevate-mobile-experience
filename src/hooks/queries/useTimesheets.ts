import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';

export function useTimesheets() {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['timesheets', user?.id, team?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .or(`user_id.eq.${user.id},member_id.eq.${user.id}`)
        .order('week_starting', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Hook for fetching active jobs (for form dropdowns)
export function useActiveJobs() {
  const { user } = useAuth();
  const { team } = useTeam();

  return useQuery({
    queryKey: ['jobs', 'active', user?.id, team?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('jobs')
        .select('id, title, status')
        .is('deleted_at', null)
        .in('status', ['approved', 'scheduled', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(50);

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
