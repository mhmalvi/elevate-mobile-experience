import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

interface Team {
  id: string;
  name: string;
  owner_id: string;
  subscription_tier: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  profiles?: {
    email: string;
    business_name?: string;
  };
}

interface UseTeamReturn {
  team: Team | null;
  userRole: TeamRole | null;
  teamMembers: TeamMember[];
  loading: boolean;
  error: string | null;

  // Permission helpers
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageTeam: boolean;

  // Actions
  refetch: () => Promise<void>;
}

export function useTeam(): UseTeamReturn {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [userRole, setUserRole] = useState<TeamRole | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user's team membership
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('*, teams!inner(*)')
        .eq('user_id', user.id)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false }); // Show most recently joined team first

      const membership = memberships?.[0];

      if (membershipError) {
        console.error('Error fetching team membership:', membershipError);
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      if (!membership) {
        setLoading(false);
        return;
      }

      setUserRole(membership.role as TeamRole);
      setTeam((membership as any).teams);

      // Fetch all team members (using left join for profiles in case they don't exist)
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('*, profiles(email, business_name)')
        .eq('team_id', membership.team_id)
        .order('joined_at', { ascending: true });

      if (membersError) {
        console.error('Error fetching team members:', membersError);
      } else {
        setTeamMembers(members || []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error in useTeam:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [user]);

  // Permission helpers based on role hierarchy
  const canCreate = userRole !== null && ['owner', 'admin', 'member'].includes(userRole);
  const canEdit = userRole !== null && ['owner', 'admin', 'member'].includes(userRole);
  const canDelete = userRole !== null && ['owner', 'admin'].includes(userRole);
  const canManageTeam = userRole !== null && ['owner', 'admin'].includes(userRole);

  return {
    team,
    userRole,
    teamMembers,
    loading,
    error,
    canCreate,
    canEdit,
    canDelete,
    canManageTeam,
    refetch: fetchTeamData,
  };
}
