import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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

  // Multi-team support
  allTeams: Team[];
  switchTeam: (teamId: string) => void;
}

const TeamContext = createContext<UseTeamReturn | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [userRole, setUserRole] = useState<TeamRole | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);

  // Persistent team selection
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(() => {
    return sessionStorage.getItem('tradie_mate_active_team_id');
  });

  const fetchTeamData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get ALL user's team memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('*, teams!inner(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (membershipError) {
        console.error('Error fetching team memberships:', membershipError);
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setAllTeams([]);
        setTeam(null);
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // Extract all unique teams
      const teamsList = memberships.map((m: any) => m.teams);
      setAllTeams(teamsList);

      // Determine active membership
      // 1. Try to find membership matching currentTeamId
      // 2. Default to the first one (most recently joined)
      let activeMembership = null;
      if (currentTeamId) {
        activeMembership = memberships.find(m => m.team_id === currentTeamId);
      }

      if (!activeMembership) {
        activeMembership = memberships[0];
        // Update current ID to match the fallback
        if (activeMembership) {
          setCurrentTeamId(activeMembership.team_id);
          sessionStorage.setItem('tradie_mate_active_team_id', activeMembership.team_id);
        }
      }

      if (activeMembership) {
        setUserRole(activeMembership.role as TeamRole);
        setTeam((activeMembership as any).teams);

        // Fetch team members for the ACTIVE team
        const { data: members, error: membersError } = await supabase
          .from('team_members')
          .select('*, profiles(email, business_name)')
          .eq('team_id', activeMembership.team_id)
          .order('joined_at', { ascending: true });

        if (membersError) {
          console.error('Error fetching team members:', membersError);
        } else {
          setTeamMembers(members || []);
        }
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
  }, [user, currentTeamId]); // Refetch if user or currentTeamId changes

  const switchTeam = (teamId: string) => {
    setCurrentTeamId(teamId);
    sessionStorage.setItem('tradie_mate_active_team_id', teamId);
    // The useEffect will trigger fetchTeamData
  };

  // Permission helpers based on role hierarchy
  const canCreate = userRole !== null && ['owner', 'admin', 'member'].includes(userRole);
  const canEdit = userRole !== null && ['owner', 'admin', 'member'].includes(userRole);
  const canDelete = userRole !== null && ['owner', 'admin'].includes(userRole);
  const canManageTeam = userRole !== null && ['owner', 'admin'].includes(userRole);

  const value = {
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
    allTeams,
    switchTeam
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam(): UseTeamReturn {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
