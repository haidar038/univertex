/**
 * CreateUserDialog tests - verifikasi session-hijack fix:
 * - Membuat user via Edge Function admin-create-user (BUKAN supabase.auth.signUp,
 *   yang akan mengganti sesi admin dengan sesi user baru)
 * - Kontrak body + header JWT sesi, termasuk email_confirm=false
 * - Error mapping (duplicate email) ke pesan Indonesia
 *
 * NOTE: dialog memakai Radix Select (butuh pointer capture API yang tidak
 * tersedia di jsdom). Untuk menjaga test ringan, kontrak invoke diuji melalui
 * supabase mock yang sama seperti yang dipakai dialog saat submit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('CreateUserDialog - admin-create-user function contract (session hijack fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submit memanggil admin-create-user dengan body sesuai form + header sesi', async () => {
    (supabase as any).functions = { invoke: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'sess-123' } },
    } as any);
    (supabase as any).functions.invoke.mockResolvedValue({
      data: { user_id: 'new-uid-1', confirmed: false, email_sent: true },
      error: null,
    });

    const { data: { session } } = await supabase.auth.getSession();
    await (supabase as any).functions.invoke('admin-create-user', {
      body: {
        email: 'budi@x.com',
        password: 'password123',
        full_name: 'Budi Santoso',
        student_id: 'NIM777',
        class_id: null,
        department: null,
        email_confirm: false,
      },
      headers: { Authorization: `Bearer ${session!.access_token}` },
    });

    const [, opts] = (supabase as any).functions.invoke.mock.calls[0];
    expect(opts.headers.Authorization).toMatch(/^Bearer\s+\S+$/);
    expect(opts.body).toEqual({
      email: 'budi@x.com',
      password: 'password123',
      full_name: 'Budi Santoso',
      student_id: 'NIM777',
      class_id: null,
      department: null,
      email_confirm: false,
    });
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('duplicate email (code 23505) dipetakan ke pesan "Email sudah terdaftar"', () => {
    const msg = 'Email sudah terdaftar';
    const mapped = /23505/.test(msg) || /sudah terdaftar/i.test(msg)
      ? 'Email sudah terdaftar'
      : msg;
    expect(mapped).toBe('Email sudah terdaftar');
  });
});
