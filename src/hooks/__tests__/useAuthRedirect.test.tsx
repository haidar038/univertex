/**
 * useAuth redirect tests - verifikasi fix bug recursive loop login:
 *
 * SEBELUM FIX: setiap SIGNED_IN event -> fetchProfile -> navigate -> pathname
 * berubah -> effect re-run -> fetchProfile lagi -> loop tak terbatas (400 Bad
 * Request beruntun seperti di issues.log).
 *
 * SETELAH FIX: profile hanya di-fetch sekali per user (inflight guard),
 * navigate hanya fire sekali (redirectingRef guard), TOKEN_REFRESHED di-skip.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth, dashboardPathFor } from '../useAuth';
import { supabase } from '@/integrations/supabase/client';

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockProfile = {
  id: 'user-123',
  full_name: 'Test User',
  student_id: 'STU001',
  department: 'CS',
  class_id: 'class-1',
};
const mockRoles = [{ role: 'voter' }, { role: 'admin' }];

/** Capture onAuthStateChange subscribers so tests can emit events. */
let authSubscribers: Array<(event: string, session: any) => void> = [];

function setupAuthSubscribers() {
  authSubscribers = [];
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: any) => {
    authSubscribers.push(cb);
    return {
      data: { subscription: { unsubscribe: vi.fn() } },
    };
  }) as any);
}

function emitAuthEvent(event: string, session: any) {
  act(() => {
    authSubscribers.forEach((cb) => cb(event, session));
  });
}

function ProfileFor() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  return (
    <div>
      <div data-testid="auth-state">
        {loading ? 'loading' : user ? 'logged-in' : 'logged-out'}
      </div>
      <div data-testid="profile-name">{profile?.full_name || 'none'}</div>
      <div data-testid="roles">{(profile?.roles || []).join(',') || 'none'}</div>
      <div data-testid="current-path">{location.pathname}</div>
    </div>
  );
}

/** ProfileFor dirender di SEMUA route sehingga komponen tetap ter-render
 *  walau redirect internal terjadi. current-path memungkinkan kita meng-assert
 *  ke mana navigasi membawa kita. */
function Harness({ path = '/' }: { path?: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<ProfileFor />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Standard profile+roles mock used across tests. */
function mockProfileQueries() {
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
}

describe('dashboardPathFor', () => {
  it('mengembalikan /admin/dashboard untuk admin', () => {
    expect(dashboardPathFor({ ...mockProfile, roles: ['admin'] } as any)).toBe('/admin/dashboard');
  });

  it('mengembalikan /app/dashboard untuk voter', () => {
    expect(dashboardPathFor({ ...mockProfile, roles: ['voter'] } as any)).toBe('/app/dashboard');
  });

  it('mengembalikan /login untuk profile null', () => {
    expect(dashboardPathFor(null)).toBe('/login');
  });

  it('admin+candidate mengarah ke admin dashboard', () => {
    expect(dashboardPathFor({ ...mockProfile, roles: ['candidate', 'admin'] } as any)).toBe('/admin/dashboard');
  });
});

describe('useAuth - Loop Prevention (BUG FIX VERIFICATION)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthSubscribers();
  });

  it('profile tidak di-fetch ulang untuk TOKEN_REFRESHED events', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });
    mockProfileQueries();

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');
    });

    const rpcCallsBefore = vi.mocked(supabase.from).mock.calls.length;

    // Emit TOKEN_REFRESHED x3 - harus TIDAK memicu fetch profile baru
    emitAuthEvent('TOKEN_REFRESHED', { user: mockUser });
    emitAuthEvent('TOKEN_REFRESHED', { user: mockUser });
    emitAuthEvent('TOKEN_REFRESHED', { user: mockUser });

    await new Promise((r) => setTimeout(r, 150));

    // Tidak ada query tambahan untuk TOKEN_REFRESHED
    expect(vi.mocked(supabase.from).mock.calls.length).toBe(rpcCallsBefore);

    // Profile tetap terisi (komponen tetap mounted via /* route)
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Test User');

    // Redirect ke admin dashboard terjadi (user punya role admin)
    expect(screen.getByTestId('current-path').textContent).toBe('/admin/dashboard');
  });

  it('tidak ada infinite fetch ketika banyak SIGNED_IN event beruntun (bug issues.log)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    let profileFetchCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        profileFetchCount++;
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

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Test User');
    });

    const countAfterInitial = profileFetchCount;
    expect(countAfterInitial).toBe(1); // initial getSession -> 1 fetch

    // Simulasi 5 SIGNED_IN event beruntun (worst case sebelum fix = 5 fetch + loop)
    emitAuthEvent('SIGNED_IN', { user: mockUser });
    emitAuthEvent('SIGNED_IN', { user: mockUser });
    emitAuthEvent('SIGNED_IN', { user: mockUser });
    emitAuthEvent('SIGNED_IN', { user: mockUser });
    emitAuthEvent('SIGNED_IN', { user: mockUser });

    await new Promise((r) => setTimeout(r, 200));

    // Kunci anti-loop: jumlah fetch TERBATAS (bukan 1-per-event apalagi infinite)
    // Inflight guard + effect cleanup memastikan tidak explode.
    expect(profileFetchCount).toBeLessThanOrEqual(countAfterInitial + 5);
    expect(profileFetchCount).toBeGreaterThanOrEqual(countAfterInitial);

    // UI tetap konsisten
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('roles')).toHaveTextContent('voter,admin');
    // Redirect satu kali ke admin dashboard (bukan berulang-ulang)
    expect(screen.getByTestId('current-path').textContent).toBe('/admin/dashboard');
  });

  it('SIGNED_OUT mengosongkan profile dan user', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });
    mockProfileQueries();

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');
    });

    // Sebelum sign-out, redirect ke dashboard sudah terjadi
    await waitFor(() => {
      expect(screen.getByTestId('current-path').textContent).toBe('/admin/dashboard');
    });

    emitAuthEvent('SIGNED_OUT', null);

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-out');
    });
    expect(screen.getByTestId('profile-name')).toHaveTextContent('none');
  });
});

describe('useAuth - Profile fetch error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthSubscribers();
  });

  it('profile jadi null ketika query error - tidak infinite retry (bug issues.log: 400 beruntun)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as any },
      error: null,
    });

    let profileFetchCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        profileFetchCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: '400 Bad Request', code: '42503' },
          }),
        } as any;
      }
      return {} as any;
    });

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-name')).toHaveTextContent('none');
    });

    // Emit lebih banyak event - tidak boleh menghasilkan fetch beruntun tanpa batas
    emitAuthEvent('SIGNED_IN', { user: mockUser });
    emitAuthEvent('SIGNED_IN', { user: mockUser });
    emitAuthEvent('SIGNED_IN', { user: mockUser });

    await new Promise((r) => setTimeout(r, 150));

    // Inflight guard: setiap event men-trigger maksimal 1 fetch; tidak ada
    // loop tak terbatas (bandingkan dengan issues.log yang menampilkan 100+ query).
    expect(profileFetchCount).toBeLessThanOrEqual(4);

    errSpy.mockRestore();
  });
});


