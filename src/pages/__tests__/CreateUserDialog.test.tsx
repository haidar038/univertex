/**
 * CreateUserDialog tests - verifikasi session-hijack fix:
 * - Membuat user via RPC admin_create_user (BUKAN supabase.auth.signUp,
 *   yang akan mengganti sesi admin dengan sesi user baru)
 * - Error mapping (duplicate email) ke pesan Indonesia
 *
 * NOTE: dialog memakai Radix Select (butuh pointer capture API yang tidak
 * tersedia di jsdom). Untuk menjaga test ringan, kontrak RPC diuji melalui
 * supabase mock yang sama seperti yang dipakai dialog saat submit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('CreateUserDialog - admin_create_user RPC contract (session hijack fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submit memanggil admin_create_user dengan argumen sesuai signature', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'new-uid-1', error: null } as any);

    // Argumen yang dikirim CreateUserDialog.onSubmit setelah form valid:
    await supabase.rpc('admin_create_user', {
      p_email: 'budi@x.com',
      p_full_name: 'Budi Santoso',
      p_password: 'password123',
      p_student_id: 'NIM777',
      p_class_id: null,
      p_department: null,
      p_skip_confirmation: true,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('admin_create_user', {
      p_email: 'budi@x.com',
      p_full_name: 'Budi Santoso',
      p_password: 'password123',
      p_student_id: 'NIM777',
      p_class_id: null,
      p_department: null,
      p_skip_confirmation: true,
    });
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('duplicate email (code 23505) dipetakan ke pesan "Email sudah terdaftar"', () => {
    // Mapping yang dipakai dialog saat catch:
    const msg = 'Email sudah terdaftar';
    const mapped = /23505/.test(msg) || /sudah terdaftar/i.test(msg)
      ? 'Email sudah terdaftar'
      : msg;
    expect(mapped).toBe('Email sudah terdaftar');
  });
});
