import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePermission } from '../usePermission';
import { supabase } from '@/integrations/supabase/client';
import * as useAuthModule from '@/hooks/useAuth';

describe('usePermission hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns has=false and skips RPC when no profile', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
      isAdmin: false,
      isVoter: false,
      isCandidate: false,
      isCommittee: false,
      isObserver: false,
    });

    const { result } = renderHook(() => usePermission('user.create'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.has).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns has=true when RPC returns true (admin)', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1' } as any,
      profile: { id: 'admin-1', roles: ['admin'] } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: false,
      isCandidate: false,
      isCommittee: false,
      isObserver: false,
    });

    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);

    const { result } = renderHook(() => usePermission('user.create'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.has).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('has_permission', {
      p_user_id: 'admin-1',
      p_permission: 'user.create',
    });
  });

  it('returns has=false when RPC returns false (voter)', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'voter-1' } as any,
      profile: { id: 'voter-1', roles: ['voter'] } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
      isAdmin: false,
      isVoter: true,
      isCandidate: false,
      isCommittee: false,
      isObserver: false,
    });

    vi.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as any);

    const { result } = renderHook(() => usePermission('user.create'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.has).toBe(false);
  });

  it('returns has=false when RPC errors', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'user-1', roles: ['admin'] } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: false,
      isCandidate: false,
      isCommittee: false,
      isObserver: false,
    });

    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('boom') } as any);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => usePermission('audit.view'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.has).toBe(false);
    consoleSpy.mockRestore();
  });

  it('skips RPC when permission arg is null', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'user-1', roles: ['admin'] } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: false,
      isCandidate: false,
      isCommittee: false,
      isObserver: false,
    });

    const { result } = renderHook(() => usePermission(null));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(result.current.has).toBe(false);
  });
});
