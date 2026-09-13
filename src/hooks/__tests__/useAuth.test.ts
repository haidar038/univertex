import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth, dashboardPathFor } from '../useAuth';
import { supabase } from '@/integrations/supabase/client';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/' }),
}));

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('should set user and profile when session exists', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      student_id: 'STU001',
      department: 'Computer Science',
      class_id: 'class-123',
    };

    const mockRoles = [{ role: 'voter' }, { role: 'admin' }];

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    }));

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') return mockFrom(table) as any;
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
        } as any;
      }
      return mockFrom(table) as any;
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.profile).toMatchObject({
      ...mockProfile,
      roles: ['voter', 'admin'],
    });
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isVoter).toBe(true);
    expect(result.current.isCandidate).toBe(false);
  });

  it('should handle no session (logged out state)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isVoter).toBe(false);
    expect(result.current.isCandidate).toBe(false);
  });

  it('should handle sign out correctly', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.auth.signOut).mockImplementation(mockSignOut);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Stub window.location
    const originalLocation = window.location;
    // @ts-expect-error - jsdom allows deleting then reassigning location
    delete (window as any).location;
    (window as any).location = { href: '' };

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.signOut();

    expect(mockSignOut).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();

    (window as any).location = originalLocation;
  });

  it('signOut: audit + revoke-by-hash happen BEFORE auth.signOut, in that order', async () => {
    const callOrder: string[] = [];
    const mockSignOut = vi.fn().mockImplementation(async () => {
      callOrder.push('auth.signOut');
      return { error: null };
    });
    vi.mocked(supabase.auth.signOut).mockImplementation(mockSignOut);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // log_audit_event RPC -> audit
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'log_audit_event') {
        callOrder.push('log_audit_event');
      }
      if (fn === 'revoke_user_session_by_hash') {
        callOrder.push('revoke_user_session_by_hash');
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    const originalLocation = window.location;
    // @ts-expect-error - jsdom allows deleting then reassigning location
    delete (window as any).location;
    (window as any).location = { href: '' };

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.signOut();

    // auth.logout audit must be recorded while the session token is still
    // valid, i.e. BEFORE supabase.auth.signOut() destroys it.
    expect(callOrder.indexOf('log_audit_event')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('auth.signOut')).toBeGreaterThan(callOrder.indexOf('log_audit_event'));

    // The device session is revoked via the BY-HASH RPC (the old code sent
    // the hash to the by-id RPC which matched 0 rows).
    expect(supabase.rpc).toHaveBeenCalledWith(
      'revoke_user_session_by_hash',
      expect.objectContaining({
        p_refresh_token_hash: expect.any(String),
        p_revoked_reason: 'user_logout',
      })
    );

    (window as any).location = originalLocation;
  });

  it('should handle profile fetch error gracefully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Profile not found'),
      }),
    } as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching profile:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should correctly identify candidate role', async () => {
    const mockUser = { id: 'user-123', email: 'candidate@example.com' };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Candidate User',
      student_id: 'STU002',
      department: 'Engineering',
      class_id: 'class-456',
    };

    const mockRoles = [{ role: 'voter' }, { role: 'candidate' }];

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        } as any;
      }
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
        } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isCandidate).toBe(true);
    expect(result.current.isVoter).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });
});

describe('dashboardPathFor - role routing', () => {
  it('returns /login for null profile', () => {
    expect(dashboardPathFor(null)).toBe('/login');
  });

  it('returns /admin/dashboard for admin', () => {
    expect(dashboardPathFor({ id: 'u', full_name: 'A', student_id: 'S', department: null, class_id: null, roles: ['admin'] })).toBe('/admin/dashboard');
  });

  it('returns /committee for committee', () => {
    expect(dashboardPathFor({ id: 'u', full_name: 'C', student_id: 'S', department: null, class_id: null, roles: ['committee'] })).toBe('/committee');
  });

  it('returns /observer for observer', () => {
    expect(dashboardPathFor({ id: 'u', full_name: 'O', student_id: 'S', department: null, class_id: null, roles: ['observer'] })).toBe('/observer');
  });

  it('admin beats committee for users with multiple roles', () => {
    expect(dashboardPathFor({ id: 'u', full_name: 'X', student_id: 'S', department: null, class_id: null, roles: ['committee', 'admin'] })).toBe('/admin/dashboard');
  });

  it('falls back to /app/dashboard for voter-only', () => {
    expect(dashboardPathFor({ id: 'u', full_name: 'V', student_id: 'S', department: null, class_id: null, roles: ['voter'] })).toBe('/app/dashboard');
  });
});
