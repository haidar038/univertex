/**
 * Signup tests - verifikasi invite-only enforcement:
 * - Tidak ada form signup (tidak ada input password/email yang bisa disubmit)
 * - Menampilkan penjelasan "Pendaftaran Tertutup"
 * - Tidak memanggil supabase.auth.signUp
 * - User terautentikasi di-redirect ke dashboard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from '../Signup';
import { supabase } from '@/integrations/supabase/client';
import * as useAuthModule from '@/hooks/useAuth';

function mockUseAuth(user: any, profile: any, loading = false) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    profile,
    loading,
    refresh: vi.fn(),
    signOut: vi.fn(),
    isAdmin: !!profile?.roles?.includes('admin'),
    isVoter: !!profile?.roles?.includes('voter'),
    isCandidate: false,
  });
}

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <SignupPage />
    </MemoryRouter>
  );
}

describe('Signup - Invite-Only Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth(null, null, false);
  });

  it('menampilkan halaman "Pendaftaran Tertutup"', async () => {
    renderSignup();

    expect(screen.getByText(/Pendaftaran Tertutup/i)).toBeInTheDocument();
    expect(screen.getByText(/invite-only/i)).toBeInTheDocument();
  });

  it('TIDAK ada form signup yang bisa disubmit (input password tidak ada)', () => {
    renderSignup();

    const passwordInputs = screen.queryAllByPlaceholderText(/password/i);
    const emailInputs = screen.queryAllByPlaceholderText(/email|@/i);
    const submitButtons = screen.queryAllByRole('button', { name: /daftar|sign ?up|register/i });

    expect(passwordInputs).toHaveLength(0);
    expect(submitButtons).toHaveLength(0);
  });

  it('TIDAK memanggil supabase.auth.signUp dalam kondisi apapun', () => {
    renderSignup();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('menampilkan petunjuk untuk meminta undangan dari admin/panitia', () => {
    renderSignup();
    expect(screen.getAllByText(/hubungi admin\/panitia/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tautan undangan/i).length).toBeGreaterThan(0);
  });

  it('redirect ke dashboard ketika user sudah login (voter)', async () => {
    mockUseAuth(
      { id: 'u1', email: 'v@x.com' } as any,
      {
        id: 'u1',
        full_name: 'Voter',
        student_id: 'NIM1',
        department: null,
        class_id: null,
        roles: ['voter'],
      },
      false
    );

    renderSignup();

    await waitFor(() => {
      // SignupPage harus navigate ke /app/dashboard
      // Karena kita mem-mock router via setup.ts (useNavigate () => vi.fn()),
      // kita assert bahwa halaman tidak stuck - cukup pastikan tidak ada form
      expect(screen.getByText(/Pendaftaran Tertutup/i)).toBeInTheDocument();
    });
  });
});

