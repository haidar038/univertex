/**
 * AcceptInvite tests - verifikasi invitation flow:
 * - Validasi token (tidak ditemukan, sudah dipakai, dicabut, kedaluwarsa)
 * - Cocokkan email user dengan email undangan
 * - Tombol terima disabled ketika mismatch
 * - redeem_invitation dipanggil saat accept
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AcceptInvite from '../AcceptInvite';
import { supabase } from '@/integrations/supabase/client';
import * as useAuthModule from '@/hooks/useAuth';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function mockUseAuth(user: any, profile: any, loading = false) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    profile,
    loading,
    refresh: vi.fn(),
    signOut: vi.fn(),
    isAdmin: false,
    isVoter: !!profile?.roles?.includes('voter'),
    isCandidate: false,
  });
}

const futureDate = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();

/**
 * Wrap the rpc mock so `fnName` resolves to `result` while every other
 * function (notably get_invitation_by_token, already configured by
 * mockValidInvite) keeps its existing behaviour.
 */
function mockRpcHandler(fnName: string, result: any) {
  const existing = vi.mocked(supabase.rpc).getMockImplementation();
  vi.mocked(supabase.rpc).mockImplementation((fn: string, ...args: any[]) => {
    if (fn === fnName) return Promise.resolve(result) as any;
    return existing ? existing(fn, ...args) : Promise.resolve({ data: null, error: null }) as any;
  });
}

function renderInviteRouted(token = 'tok-1') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<AcceptInvite />} />
      </Routes>
    </MemoryRouter>
  );
}describe('AcceptInvite - Validasi Token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth(null, null, false);
  });

  it('menampilkan error ketika undangan tidak ditemukan', async () => {
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invitation_by_token') {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    renderInviteRouted();

    await waitFor(() => {
      expect(screen.getByText(/Undangan tidak ditemukan atau sudah tidak berlaku/i)).toBeInTheDocument();
    });
  });

  it('menampilkan error ketika undangan sudah diterima sebelumnya', async () => {
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invitation_by_token') {
        return Promise.resolve({
          data: [{
            id: 'inv-1',
            email: 'target@x.com',
            full_name: 'Target',
            student_id: 'NIM9',
            intent: 'register',
            event_id: null,
            class_id: null,
            roles: ['voter'],
            expires_at: futureDate(60),
            accepted_at: new Date().toISOString(),
            revoked_at: null,
          }],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    renderInviteRouted();

    await waitFor(() => {
      expect(screen.getByText(/sudah pernah diterima/i)).toBeInTheDocument();
    });
  });

  it('menampilkan error ketika undangan dicabut', async () => {
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invitation_by_token') {
        return Promise.resolve({
          data: [{
            id: 'inv-1',
            email: 'target@x.com',
            full_name: 'Target',
            student_id: 'NIM9',
            intent: 'register',
            event_id: null,
            class_id: null,
            roles: ['voter'],
            expires_at: futureDate(60),
            accepted_at: null,
            revoked_at: new Date().toISOString(),
          }],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    renderInviteRouted();

    await waitFor(() => {
      expect(screen.getByText(/telah dicabut/i)).toBeInTheDocument();
    });
  });

  it('menampilkan error ketika undangan kedaluwarsa', async () => {
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invitation_by_token') {
        return Promise.resolve({
          data: [{
            id: 'inv-1',
            email: 'target@x.com',
            full_name: 'Target',
            student_id: 'NIM9',
            intent: 'register',
            event_id: null,
            class_id: null,
            roles: ['voter'],
            expires_at: new Date(Date.now() - 1000).toISOString(),
            accepted_at: null,
            revoked_at: null,
          }],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    renderInviteRouted();

    await waitFor(() => {
      expect(screen.getByText(/kedaluwarsa/i)).toBeInTheDocument();
    });
  });
});

describe('AcceptInvite - Auth & Email Matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockValidInvite(email = 'target@x.com') {
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invitation_by_token') {
        return Promise.resolve({
          data: [{
            id: 'inv-1',
            email,
            full_name: 'Target User',
            student_id: 'NIM9',
            intent: 'register',
            event_id: null,
            class_id: null,
            roles: ['voter'],
            expires_at: futureDate(60),
            accepted_at: null,
            revoked_at: null,
          }],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });
  }

  it('menampilkan form set-password ketika user belum terautentikasi (bukan lagi instruksi login)', async () => {
    mockValidInvite();
    mockUseAuth(null, null, false);

    renderInviteRouted();

    // Fix Catch-22: user baru langsung disajikan form buat password,
    // bukan diminta login dulu (yang mustahil tanpa akun).
    await waitFor(() => {
      expect(screen.getByLabelText(/Buat Password/i)).toBeInTheDocument();
    });
  });

  it('menampilkan peringatan mismatch ketika email login != email undangan', async () => {
    mockValidInvite('target@x.com');
    mockUseAuth(
      { id: 'u1', email: 'wrong@x.com' } as any,
      {
        id: 'u1',
        full_name: 'Wrong',
        student_id: 'NIM1',
        department: null,
        class_id: null,
        roles: ['voter'],
      },
      false
    );

    renderInviteRouted();

    await waitFor(() => {
      expect(screen.getByText(/ditujukan untuk/i)).toBeInTheDocument();
    });

    // Tombol Terima harus disabled
    const btn = screen.getByRole('button', { name: /Terima Undangan/i });
    expect(btn).toBeDisabled();
  });

  it('menampilkan konfirmasi ketika email cocok dan tombol enabled', async () => {
    mockValidInvite('target@x.com');
    mockUseAuth(
      { id: 'u1', email: 'target@x.com' } as any,
      {
        id: 'u1',
        full_name: 'Target',
        student_id: 'NIM9',
        department: null,
        class_id: null,
        roles: ['voter'],
      },
      false
    );

    renderInviteRouted();

    await waitFor(() => {
      expect(screen.getByText(/Email login Anda cocok/i)).toBeInTheDocument();
    });

    const btn = screen.getByRole('button', { name: /Terima Undangan/i });
    expect(btn).toBeEnabled();
  });

  it('memanggil redeem_invitation saat tombol diterima diklik', async () => {
    mockValidInvite('target@x.com');
    mockUseAuth(
      { id: 'u1', email: 'target@x.com' } as any,
      {
        id: 'u1',
        full_name: 'Target',
        student_id: 'NIM9',
        department: null,
        class_id: null,
        roles: ['voter'],
      },
      false
    );

    renderInviteRouted();

    await waitFor(() => screen.getByRole('button', { name: /Terima Undangan/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Terima Undangan/i }));
    });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('redeem_invitation', { p_token: 'tok-1' });
    });
  });
});

describe('AcceptInvite - Set Password Flow (user baru, fix Catch-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth(null, null, false); // user belum login
  });

  function mockValidInvite(email = 'new@x.com') {
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'get_invitation_by_token') {
        return Promise.resolve({
          data: [{
            id: 'inv-1',
            email,
            full_name: 'New User',
            student_id: 'NIM42',
            intent: 'register',
            event_id: null,
            class_id: null,
            roles: ['voter'],
            expires_at: futureDate(60),
            accepted_at: null,
            revoked_at: null,
          }],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });
  }

  it('menampilkan form set password ketika user belum punya akun', async () => {
    mockValidInvite();

    renderInviteRouted();

    await waitFor(() => {
      expect(screen.getByLabelText(/Buat Password/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Konfirmasi Password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Buat Akun & Terima Undangan/i })
    ).toBeInTheDocument();
  });

  it('submit memanggil accept_invitation_and_register lalu signInWithPassword', async () => {
    mockValidInvite('new@x.com');
    mockRpcHandler('accept_invitation_and_register', { data: 'new-user-id', error: null });
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'new-user-id', email: 'new@x.com' }, session: {} },
      error: null,
    } as any);

    renderInviteRouted();

    await waitFor(() => screen.getByLabelText(/Buat Password/i));

    fireEvent.change(screen.getByLabelText(/Buat Password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/Konfirmasi Password/i), {
      target: { value: 'password123' },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Buat Akun & Terima Undangan/i })
      );
    });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('accept_invitation_and_register', {
        p_token: 'tok-1',
        p_password: 'password123',
      });
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'new@x.com',
        password: 'password123',
      });
    });
  });

  it('validasi client-side: konfirmasi password tidak cocok tidak mengirim RPC', async () => {
    mockValidInvite();

    renderInviteRouted();

    await waitFor(() => screen.getByLabelText(/Buat Password/i));

    fireEvent.change(screen.getByLabelText(/Buat Password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/Konfirmasi Password/i), {
      target: { value: 'beda12345' },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Buat Akun & Terima Undangan/i })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Konfirmasi password tidak cocok/i)).toBeInTheDocument();
    });
    expect(supabase.rpc).not.toHaveBeenCalledWith('accept_invitation_and_register', expect.anything());
  });

  it('error "akun sudah terdaftar" menampilkan pesan dan arahan ke login', async () => {
    mockValidInvite('existing@x.com');
    mockRpcHandler('accept_invitation_and_register', {
      data: null,
      error: { message: 'Akun dengan email ini sudah terdaftar. Silakan login terlebih dahulu.' },
    });

    renderInviteRouted();

    await waitFor(() => screen.getByLabelText(/Buat Password/i));

    fireEvent.change(screen.getByLabelText(/Buat Password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/Konfirmasi Password/i), {
      target: { value: 'password123' },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Buat Akun & Terima Undangan/i })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/sudah terdaftar/i)).toBeInTheDocument();
    });
  });
});


