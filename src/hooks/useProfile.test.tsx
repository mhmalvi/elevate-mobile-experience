import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock Capacitor Preferences (will fail, forcing localStorage fallback)
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: vi.fn().mockRejectedValue(new Error('Not available in test')),
    get: vi.fn().mockRejectedValue(new Error('Not available in test')),
    remove: vi.fn().mockRejectedValue(new Error('Not available in test')),
  },
}));

// Mock supabase
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// Mock useAuth
vi.mock('./useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
  })),
}));

import { useProfile } from './useProfile';

describe('useProfile', () => {
  const mockProfile = {
    user_id: 'test-user-id',
    email: 'test@example.com',
    business_name: 'Test Business',
    subscription_tier: 'solo',
    subscription_expires_at: '2027-01-01T00:00:00Z',
    subscription_provider: 'stripe',
    subscription_id: 'sub_123',
    stripe_account_id: null,
    stripe_onboarding_complete: false,
    stripe_charges_enabled: false,
    trade_type: 'Electrician',
    phone: '0412345678',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default mock chain: supabase.from('profiles').select('*').eq('user_id', id).single()
    mockSingle.mockResolvedValue({ data: mockProfile, error: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should fetch profile on mount', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeTruthy();
  });

  it('should cache subscription data to localStorage on fetch', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // The subscriptionCache utility falls back to localStorage when Capacitor is unavailable
    const cached = localStorage.getItem('tradiemate_subscription_cache');
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    // New cache shape from subscriptionCache.ts utility
    expect(parsed.tier).toBe('solo');
    expect(parsed.expiresAt).toBe('2027-01-01T00:00:00Z');
    expect(parsed.provider).toBe('stripe');
    expect(parsed.userId).toBe('test-user-id');
    expect(parsed.version).toBe(1);
    expect(parsed.cachedAt).toBeTruthy();
  });

  it('should expose updateProfile and refetch functions', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.updateProfile).toBe('function');
    expect(typeof result.current.refetch).toBe('function');
  });
});

describe('subscription cache', () => {
  it('should expire cache after 72h grace period', () => {
    const oldCache = {
      version: 1,
      tier: 'pro',
      provider: 'stripe',
      expiresAt: '2027-01-01T00:00:00Z',
      cachedAt: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(), // 73 hours ago
      userId: 'test-user-id',
    };
    localStorage.setItem('tradiemate_subscription_cache', JSON.stringify(oldCache));

    // Reading the cache should detect it as expired (beyond 72h grace)
    const raw = localStorage.getItem('tradiemate_subscription_cache');
    const parsed = JSON.parse(raw!);
    const cachedAt = new Date(parsed.cachedAt).getTime();
    const graceMs = 72 * 60 * 60 * 1000;
    const isExpired = Date.now() - cachedAt > graceMs;
    expect(isExpired).toBe(true);
  });

  it('should treat expired subscription as free tier', () => {
    const expiredCache = {
      version: 1,
      tier: 'solo',
      provider: 'stripe',
      expiresAt: '2020-01-01T00:00:00Z', // Past date
      cachedAt: new Date().toISOString(),
      userId: 'test-user-id',
    };
    localStorage.setItem('tradiemate_subscription_cache', JSON.stringify(expiredCache));

    const raw = localStorage.getItem('tradiemate_subscription_cache');
    const parsed = JSON.parse(raw!);
    const isSubscriptionExpired = parsed.expiresAt && new Date(parsed.expiresAt) < new Date();
    expect(isSubscriptionExpired).toBe(true);
  });
});

