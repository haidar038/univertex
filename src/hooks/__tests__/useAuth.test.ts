import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { supabase } from '@/integrations/supabase/client';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      student_id: 'STU001',
      department: 'Computer Science',
      class_id: 'class-123',
    };

    const mockRoles = [{ role: 'voter' }, { role: 'admin' }];

    // Mock getSession
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    // Mock profile fetch
    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      }),
    }));

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return mockFrom(table) as any;
      }
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: mockRoles,
            error: null,
          }),
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

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.signOut();

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('should handle profile fetch error gracefully', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    // Mock profile fetch with error
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
    const mockUser = {
      id: 'user-123',
      email: 'candidate@example.com',
    };

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
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        } as any;
      }
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: mockRoles,
            error: null,
          }),
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
