/**
 * Login - jalur paralel NIM sebagai password:
 * - PIN/password tersimpan tetap jalan (Edge Function tidak dipanggil)
 * - Gagal signInWithPassword → nim-login → verifyOtp(token_hash)
 * - Dua-duanya gagal → satu log_failed_login, error generik
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { toast } from 'sonner';
import Login from '@/pages/Login';
import { supabase } from '@/integrations/supabase/client';
import * as useAuthModule from '@/hooks/useAuth';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/lib/sessions', () => ({
  registerCurrentDeviceSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const user = { id: 'u1', email: 'u1@x.com' };
const profileRow = {
  id: 'u1', full_name: 'User Satu', student_id: 'N1',
  department: null, class_id: null,
};

function mockTables() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const result = table === 'profiles' ? profileRow : [{ role: 'voter' }];
    const builder: any = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'ilike']) {
      builder[m] = () => builder;
    }
    builder.single = () => Promise.resolve({ data: result, error: null });
    builder.maybeSingle = () => Promise.resolve({ data: result, error: null });
    builder.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: result, error: null }).then(resolve, reject);
    return builder as any;
  });
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
  });
};

describe('Login - NIM sebagai password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null, profile: null, loading: false,
      refresh: vi.fn(), signOut: vi.fn(),
      isAdmin: false, isVoter: false, isCandidate: false,
    } as any);
    mockTables();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: null } as any);
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: { user: null }, error: null } as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
  });

  it('PIN tersimpan dipakai tanpa memanggil nim-login', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user }, error: null,
    } as any);

    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'u1@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '12345678' } });
    await submit();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Login berhasil!');
    });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('gagal PIN → nim-login → verifyOtp token_hash', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null }, error: { message: 'Invalid login credentials' },
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { token_hash: 'th-1' }, error: null,
    } as any);
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user }, error: null,
    } as any);

    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'N1' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'N1' } });
    await submit();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Login berhasil!');
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('nim-login', {
      body: { identifier: 'N1', password: 'N1' },
    });
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'th-1', type: 'magiclink',
    });
  });

  it('dua-duanya gagal → satu log_failed_login dan error generik', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null }, error: { message: 'Invalid login credentials' },
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null, error: { message: 'invalid' },
    } as any);

    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'u1@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'salah' } });
    await submit();

    await waitFor(() => {
      expect(screen.getByText(/Email atau kombinasi password yang dimasukkan salah/i)).toBeInTheDocument();
    });
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('log_failed_login', { p_email: 'u1@x.com' });
  });
});
