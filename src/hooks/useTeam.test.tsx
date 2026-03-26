/**
 * Tests for the TeamProvider / useTeam hook.
 *
 * Strategy:
 *  - Mock @/hooks/useAuth so we control which user is "logged in".
 *  - Mock @/integrations/supabase/client so all Supabase calls are intercepted.
 *  - Render a thin consumer component inside <TeamProvider> and assert on
 *    the values exposed by useTeam().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks – declared before the module imports that depend on them
// ---------------------------------------------------------------------------

const mockUser = { id: 'user-123', email: 'test@example.com' };

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

// We build a flexible supabase mock that lets each test configure the response.
const mockSupabaseFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

import { useAuth } from '@/hooks/useAuth';
import { TeamProvider, useTeam } from './useTeam';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A thin React component that renders whatever useTeam exposes. */
function TeamConsumer() {
  const team = useTeam();
  return (
    <div>
      <span data-testid="loading">{String(team.loading)}</span>
      <span data-testid="team-name">{team.team?.name ?? 'no-team'}</span>
      <span data-testid="role">{team.userRole ?? 'no-role'}</span>
      <span data-testid="error">{team.error ?? 'no-error'}</span>
      <span data-testid="canCreate">{String(team.canCreate)}</span>
      <span data-testid="canEdit">{String(team.canEdit)}</span>
      <span data-testid="canDelete">{String(team.canDelete)}</span>
      <span data-testid="canManageTeam">{String(team.canManageTeam)}</span>
      <span data-testid="allTeamsCount">{team.allTeams.length}</span>
      <button onClick={() => team.switchTeam('team-b')}>Switch Team</button>
    </div>
  );
}

function renderWithProvider(ui: ReactNode = <TeamConsumer />) {
  return render(<TeamProvider>{ui}</TeamProvider>);
}

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

type Role = 'owner' | 'admin' | 'member' | 'viewer';

/** Build a fluent Supabase chain that resolves with the given memberships.
 *
 * The TeamProvider makes two queries per fetchTeamData call:
 *   1. Fetch memberships for the current user (with nested `teams` data).
 *   2. Fetch all members for the active team.
 *
 * When `fetchTeamData` is triggered twice (e.g. the fallback path calls
 * `setCurrentTeamId` which re-triggers the useEffect), the mock must handle
 * 4 calls in total: primary, secondary, primary again, secondary again.
 *
 * We achieve this with `mockReturnValueOnce` queuing: the primary chain is
 * queued for odd calls and the secondary chain for even calls.
 */
function mockMemberships(memberships: any[] | null, error: any = null) {
  function makePrimary() {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: memberships, error }),
    };
  }

  function makeSecondary() {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  }

  // Queue enough responses for up to 2 full fetchTeamData cycles
  mockSupabaseFrom
    .mockReturnValueOnce(makePrimary())
    .mockReturnValueOnce(makeSecondary())
    .mockReturnValueOnce(makePrimary())
    .mockReturnValueOnce(makeSecondary());
}

function buildMembership(teamId: string, teamName: string, role: Role, userId = mockUser.id) {
  return {
    id: `m-${teamId}`,
    team_id: teamId,
    user_id: userId,
    role,
    joined_at: new Date().toISOString(),
    teams: { id: teamId, name: teamName, owner_id: userId, subscription_tier: 'free', created_at: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // resetAllMocks clears call history AND queued return values
  // (clearAllMocks only clears calls/instances, not the queued once-values)
  vi.resetAllMocks();
  localStorage.clear();
  // Re-establish the authenticated user default after reset
  vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
});

describe('useTeam — loading state', () => {
  it('starts in a loading state before the first fetch resolves', () => {
    // Make the query hang indefinitely
    const neverResolves = new Promise(() => {});
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue(neverResolves),
    });

    renderWithProvider();
    expect(screen.getByTestId('loading').textContent).toBe('true');
  });
});

describe('useTeam — no user logged in', () => {
  it('sets loading=false and team=null when there is no authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    mockMemberships(null);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('team-name').textContent).toBe('no-team');
    expect(screen.getByTestId('role').textContent).toBe('no-role');
  });
});

describe('useTeam — permission helpers by role', () => {
  async function renderWithRole(role: Role) {
    const membership = buildMembership('team-a', 'Acme Co', role);
    mockMemberships([membership]);
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  }

  it('owner has canCreate, canEdit, canDelete, canManageTeam = true', async () => {
    await renderWithRole('owner');
    expect(screen.getByTestId('canCreate').textContent).toBe('true');
    expect(screen.getByTestId('canEdit').textContent).toBe('true');
    expect(screen.getByTestId('canDelete').textContent).toBe('true');
    expect(screen.getByTestId('canManageTeam').textContent).toBe('true');
  });

  it('admin has canCreate, canEdit, canDelete, canManageTeam = true', async () => {
    await renderWithRole('admin');
    expect(screen.getByTestId('canCreate').textContent).toBe('true');
    expect(screen.getByTestId('canEdit').textContent).toBe('true');
    expect(screen.getByTestId('canDelete').textContent).toBe('true');
    expect(screen.getByTestId('canManageTeam').textContent).toBe('true');
  });

  it('member has canCreate=true, canEdit=true, canDelete=false, canManageTeam=false', async () => {
    await renderWithRole('member');
    expect(screen.getByTestId('canCreate').textContent).toBe('true');
    expect(screen.getByTestId('canEdit').textContent).toBe('true');
    expect(screen.getByTestId('canDelete').textContent).toBe('false');
    expect(screen.getByTestId('canManageTeam').textContent).toBe('false');
  });

  it('viewer has canCreate=false, canEdit=false, canDelete=false, canManageTeam=false', async () => {
    await renderWithRole('viewer');
    expect(screen.getByTestId('canCreate').textContent).toBe('false');
    expect(screen.getByTestId('canEdit').textContent).toBe('false');
    expect(screen.getByTestId('canDelete').textContent).toBe('false');
    expect(screen.getByTestId('canManageTeam').textContent).toBe('false');
  });
});

describe('useTeam — team resolution', () => {
  it('loads the team name and role from membership data', async () => {
    const membership = buildMembership('team-a', 'Best Tradies', 'owner');
    mockMemberships([membership]);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('team-name').textContent).toBe('Best Tradies');
    expect(screen.getByTestId('role').textContent).toBe('owner');
  });

  it('exposes all teams via allTeams', async () => {
    const memberships = [
      buildMembership('team-a', 'Team A', 'owner'),
      buildMembership('team-b', 'Team B', 'member'),
    ];
    mockMemberships(memberships);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('allTeamsCount').textContent).toBe('2');
  });

  it('falls back to first team when stored teamId is not found', async () => {
    // Persist a teamId for a team that is NOT in the memberships list
    localStorage.setItem('tradie_mate_active_team_id', 'non-existent-team');

    const membership = buildMembership('team-a', 'Fallback Team', 'admin');
    mockMemberships([membership]);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Should fall back to the first membership's team
    expect(screen.getByTestId('team-name').textContent).toBe('Fallback Team');
  });

  it('shows no team when there are no memberships', async () => {
    mockMemberships([]);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('team-name').textContent).toBe('no-team');
  });
});

describe('useTeam — switchTeam', () => {
  it('persists the selected teamId to localStorage', async () => {
    const memberships = [
      buildMembership('team-a', 'Team A', 'owner'),
      buildMembership('team-b', 'Team B', 'member'),
    ];
    mockMemberships(memberships);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /switch team/i }));
    });

    expect(localStorage.getItem('tradie_mate_active_team_id')).toBe('team-b');
  });
});

describe('useTeam — error handling', () => {
  it('sets error state when the memberships query fails', async () => {
    const primaryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
    };
    mockSupabaseFrom.mockReturnValue(primaryChain);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('error').textContent).toBe('Network error');
  });
});

describe('useTeam — used outside provider', () => {
  it('throws when useTeam is called outside a TeamProvider', () => {
    // Suppress the expected React error output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TeamConsumer />)).toThrow('useTeam must be used within a TeamProvider');

    consoleSpy.mockRestore();
  });
});
