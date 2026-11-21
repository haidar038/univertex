/**
 * P-C bulk delete tests:
 * - Dialog memanggil RPC admin_bulk_delete_users (BUKAN loop profiles.delete,
 *   yang menabrak RLS + FK votes/kandidatur)
 * - Hasil skip (admin / punya data pemilu) ditampilkan, bukan error buta
 * - Tombol disabled bila tidak ada yang dipilih
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BulkDeleteUsersDialog } from '@/components/admin/users/BulkDeleteUsersDialog';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

describe('BulkDeleteUsersDialog - P-C', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('konfirmasi memanggil admin_bulk_delete_users dengan ids terpilih', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { deleted: ['u1', 'u2'], skipped_admin: [], skipped_has_data: [] },
      error: null,
    } as any);

    render(
      <BulkDeleteUsersDialog open onOpenChange={() => {}} userIds={['u1', 'u2']} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hapus 2 Pengguna/i }));
    });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_bulk_delete_users', {
        p_user_ids: ['u1', 'u2'],
      });
    });
  });

  it('menampilkan ringkasan skip (admin / punya data) tanpa error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        deleted: ['u1'],
        skipped_admin: ['u9'],
        skipped_has_data: [{ id: 'u2', votes: 1, candidacies: 0 }],
      },
      error: null,
    } as any);

    render(
      <BulkDeleteUsersDialog open onOpenChange={() => {}} userIds={['u1', 'u9', 'u2']} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hapus 3 Pengguna/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/1 admin dilewati/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/punya data pemilu/i)).toBeInTheDocument();
  });

  it('tombol disabled bila tidak ada yang dipilih', () => {
    render(
      <BulkDeleteUsersDialog open onOpenChange={() => {}} userIds={[]} />
    );

    const btn = screen.getByRole('button', { name: /Hapus 0 Pengguna/i });
    expect(btn).toBeDisabled();
  });

  it('kontrak RPC import per-kelas: admin_import_class_users(class, users)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { created: 2, skipped_exists: [], errors: [] },
      error: null,
    } as any);

    await supabase.rpc('admin_import_class_users', {
      p_class_id: 'class-1',
      p_users: [
        { full_name: 'A', student_id: 'N1', email: 'a@x.com', password: 'password123' },
        { full_name: 'B', student_id: 'N2', email: 'b@x.com', password: 'password123' },
      ],
    });

    expect(supabase.rpc).toHaveBeenCalledWith('admin_import_class_users', {
      p_class_id: 'class-1',
      p_users: [
        { full_name: 'A', student_id: 'N1', email: 'a@x.com', password: 'password123' },
        { full_name: 'B', student_id: 'N2', email: 'b@x.com', password: 'password123' },
      ],
    });
  });
});
