import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('Authentication - useAuth Hook', () => {
  let mockSubscription: { unsubscribe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSubscription = { unsubscribe: vi.fn() };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('Initial State', () => {
    it('should start with loading state', () => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should initialize with existing session', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
        access_token: 'mock-token',
      };

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.session).toEqual(mockSession);
    });

    it('should handle no existing session', async () => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe('Sign Up', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
    });

    it('should successfully sign up a new user', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: {
          user: { id: 'new-user-123', email: 'newuser@example.com' } as any,
          session: null,
        },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const response = await result.current.signUp(
        'newuser@example.com',
        'SecurePassword123!'
      );

      expect(response.error).toBeNull();
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        options: {
          emailRedirectTo: expect.stringContaining(window.location.origin),
        },
      });
    });

    it('should handle sign up errors', async () => {
      const mockError = new Error('Email already registered');

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const response = await result.current.signUp(
        'existing@example.com',
        'password123'
      );

      expect(response.error).toEqual(mockError);
    });

    it('should include redirect URL in sign up options', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.signUp('test@example.com', 'password123');

      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Sign In', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
    });

    it('should successfully sign in a user', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token',
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockSession.user as any,
          session: mockSession as any,
        },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const response = await result.current.signIn(
        'test@example.com',
        'CorrectPassword123!'
      );

      expect(response.error).toBeNull();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'CorrectPassword123!',
      });
    });

    it('should handle invalid credentials', async () => {
      const mockError = new Error('Invalid login credentials');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const response = await result.current.signIn(
        'test@example.com',
        'WrongPassword'
      );

      expect(response.error).toEqual(mockError);
    });

    it('should handle network errors during sign in', async () => {
      const mockError = new Error('Network error');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const response = await result.current.signIn(
        'test@example.com',
        'password123'
      );

      expect(response.error).toEqual(mockError);
    });
  });

  describe('Sign Out', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);
    });

    it('should successfully sign out a user', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token',
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors gracefully', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token',
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const mockError = new Error('Sign out failed');
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: mockError,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should not throw
      await expect(result.current.signOut()).resolves.toBeUndefined();
    });
  });

  describe('Auth State Changes', () => {
    it('should update state when auth state changes', async () => {
      let authCallback: ((event: string, session: any) => void) | null = null;

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
        (callback) => {
          authCallback = callback;
          return {
            data: { subscription: mockSubscription },
          } as any;
        }
      );

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Initial state - no user
      expect(result.current.user).toBeNull();

      // Simulate sign in
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token',
      };

      if (authCallback) {
        authCallback('SIGNED_IN', mockSession);
      }

      await waitFor(() => expect(result.current.user).not.toBeNull());

      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.session).toEqual(mockSession);
    });

    it('should clear state when user signs out', async () => {
      let authCallback: ((event: string, session: any) => void) | null = null;

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
        (callback) => {
          authCallback = callback;
          return {
            data: { subscription: mockSubscription },
          } as any;
        }
      );

      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token',
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.user).not.toBeNull());

      // Simulate sign out
      if (authCallback) {
        authCallback('SIGNED_OUT', null);
      }

      await waitFor(() => expect(result.current.user).toBeNull());

      expect(result.current.session).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from auth changes on unmount', () => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { unmount } = renderHook(() => useAuth(), { wrapper });

      unmount();

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useAuth is used outside AuthProvider', () => {
      // Suppress console error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });

  describe('Security', () => {
    it('should not expose password in any form', async () => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.signIn('test@example.com', 'SecretPassword123!');

      // Verify that the hook doesn't store or expose the password
      expect(JSON.stringify(result.current)).not.toContain('SecretPassword');
      expect(JSON.stringify(result.current)).not.toContain('password');
    });
  });
});
