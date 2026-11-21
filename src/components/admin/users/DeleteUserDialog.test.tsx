/**
 * DeleteUserDialog: hapus tunggal lewat RPC yang SAMA dengan massal.
 * - Tanpa data -> RPC admin_bulk_delete_users([id]) -> sukses
 * - Ada votes -> tombol disabled + pesan arsip (aturan satu kode)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function mockStats(votes: number, cand: number) {
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const n = table === 'votes' ? votes : table === 'candidates' ? cand : 0;
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, count: n, error: null }),
      }),
    } as any;
  }) as any);
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { deleted: ['u1'], skipped_admin: [], skipped_has_data: [] },
    error: null,
  } as any);
}

describe('DeleteUserDialog - satu aturan hapus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tanpa data -> RPC bulk 1 id -> sukses', async () => {
    mockStats(0, 0);

    render(
      <DeleteUserDialog open onOpenChange={() => {}} userId="u1" userName="User Satu" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Aman untuk dihapus/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hapus Pengguna/i }));
    });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_bulk_delete_users', {
        p_user_ids: ['u1'],
      });
    });
    expect(supabase.from).not.toHaveBeenCalledWith('profiles');
  });

  it('ada votes -> tombol disabled + pesan arsip', async () => {
    mockStats(3, 0);

    render(
      <DeleteUserDialog open onOpenChange={() => {}} userId="u1" userName="User Satu" />
    );

    await waitFor(() => {
      expect(screen.getByText(/tidak dapat/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Hapus Pengguna/i })).toBeDisabled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
