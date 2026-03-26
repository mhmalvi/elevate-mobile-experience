/**
 * Tests for useUsageLimits hook.
 *
 * Strategy:
 *  - Mock useAuth, useProfile, and the supabase client.
 *  - Render the hook inside a minimal wrapper component and inspect state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useUsageLimits } from './useUsageLimits';
import type { UsageType } from '@/lib/tierLimits';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = { id: 'user-abc', email: 'dev@example.com' };

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({ profile: { subscription_tier: 'free' } })),
}));

const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: (...args: any[]) => mockMaybeSingle(...args),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Imports that depend on mocks
// ---------------------------------------------------------------------------

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

// ---------------------------------------------------------------------------
// Consumer component
// ---------------------------------------------------------------------------

function UsageLimitsConsumer({ usageType }: { usageType: UsageType }) {
  const limits = useUsageLimits(usageType);
  return (
    <div>
      <span data-testid="loading">{String(limits.loading)}</span>
      <span data-testid="canCreate">{String(limits.canCreate)}</span>
      <span data-testid="used">{limits.used}</span>
      <span data-testid="limit">{limits.limit}</span>
      <span data-testid="remaining">{limits.remaining === Infinity ? 'Infinity' : limits.remaining}</span>
      <span data-testid="isUnlimited">{String(limits.isUnlimited)}</span>
      <span data-testid="tier">{limits.tier}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderHookUI(usageType: UsageType) {
  return render(<UsageLimitsConsumer usageType={usageType} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: free tier user with zero usage
  vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
  vi.mocked(useProfile).mockReturnValue({ profile: { subscription_tier: 'free' } } as any);
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('useUsageLimits — free tier defaults (zero usage)', () => {
  it('shows loading=false after the fetch completes', async () => {
    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  });

  it('canCreate is true when usage is below the limit', async () => {
    // Free tier allows 5 quotes; zero used → canCreate true
    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('canCreate').textContent).toBe('true');
  });

  it('used defaults to 0 when no usage record exists', async () => {
    renderHookUI('invoices');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('used').textContent).toBe('0');
  });

  it('remaining equals limit when usage is 0', async () => {
    // Free tier quote limit = 5
    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    const limit = Number(screen.getByTestId('limit').textContent);
    expect(Number(screen.getByTestId('remaining').textContent)).toBe(limit);
  });

  it('isUnlimited is false for free tier', async () => {
    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('isUnlimited').textContent).toBe('false');
  });

  it('tier reflects the profile subscription_tier', async () => {
    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('tier').textContent).toBe('free');
  });
});

describe('useUsageLimits — canCreate = false when limit reached', () => {
  it('canCreate is false when used equals the limit', async () => {
    // Free tier: 5 quotes allowed; simulate 5 used
    mockMaybeSingle.mockResolvedValue({
      data: { quotes_created: 5, invoices_created: 0, jobs_created: 0, emails_sent: 0, sms_sent: 0, clients_created: 0 },
      error: null,
    });

    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    expect(screen.getByTestId('canCreate').textContent).toBe('false');
    expect(screen.getByTestId('remaining').textContent).toBe('0');
  });

  it('canCreate is false when used exceeds the limit', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { quotes_created: 10, invoices_created: 0, jobs_created: 0, emails_sent: 0, sms_sent: 0, clients_created: 0 },
      error: null,
    });

    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    expect(screen.getByTestId('canCreate').textContent).toBe('false');
    // remaining should never go below 0
    expect(Number(screen.getByTestId('remaining').textContent)).toBe(0);
  });
});

describe('useUsageLimits — unlimited tiers (solo/crew/pro)', () => {
  it('isUnlimited is true and canCreate is true for solo tier quotes', async () => {
    vi.mocked(useProfile).mockReturnValue({ profile: { subscription_tier: 'solo' } } as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    expect(screen.getByTestId('isUnlimited').textContent).toBe('true');
    expect(screen.getByTestId('canCreate').textContent).toBe('true');
    expect(screen.getByTestId('remaining').textContent).toBe('Infinity');
  });

  it('isUnlimited is true even when usage is high for an unlimited type', async () => {
    vi.mocked(useProfile).mockReturnValue({ profile: { subscription_tier: 'pro' } } as any);
    mockMaybeSingle.mockResolvedValue({
      data: { quotes_created: 9999, invoices_created: 0, jobs_created: 0, emails_sent: 0, sms_sent: 0, clients_created: 0 },
      error: null,
    });

    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    expect(screen.getByTestId('isUnlimited').textContent).toBe('true');
    expect(screen.getByTestId('canCreate').textContent).toBe('true');
  });
});

describe('useUsageLimits — remaining calculation', () => {
  it('remaining = limit - used when used < limit', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { quotes_created: 2, invoices_created: 0, jobs_created: 0, emails_sent: 0, sms_sent: 0, clients_created: 0 },
      error: null,
    });

    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    const limit = Number(screen.getByTestId('limit').textContent); // 5 for free
    const used = Number(screen.getByTestId('used').textContent);   // 2
    const remaining = Number(screen.getByTestId('remaining').textContent);
    expect(remaining).toBe(Math.max(0, limit - used));
  });

  it('remaining is 0 (not negative) when usage exceeds limit', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { quotes_created: 100, invoices_created: 0, jobs_created: 0, emails_sent: 0, sms_sent: 0, clients_created: 0 },
      error: null,
    });

    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    expect(Number(screen.getByTestId('remaining').textContent)).toBe(0);
  });
});

describe('useUsageLimits — no logged-in user', () => {
  it('sets loading=false and shows default values when no user is present', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);

    renderHookUI('quotes');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    expect(screen.getByTestId('used').textContent).toBe('0');
  });
});

describe('useUsageLimits — incrementUsage no-op', () => {
  it('incrementUsage is callable and does not throw', async () => {
    let incrementFn: (() => Promise<void>) | undefined;

    function IncrementConsumer() {
      const limits = useUsageLimits('quotes');
      incrementFn = limits.incrementUsage;
      return <span data-testid="ready">ready</span>;
    }

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    render(<IncrementConsumer />);

    await waitFor(() => expect(screen.getByTestId('ready')).toBeInTheDocument());
    expect(incrementFn).toBeDefined();
    await expect(incrementFn!()).resolves.toBeUndefined();
  });
});
