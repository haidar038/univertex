/**
 * Invitations — hapus user undangan.
 *
 * Regresi yang dijaga:
 * - UI memanggil RPC admin_delete_invitation_user (bukan delete langsung).
 * - Audit TIDAK ditulis dua kali: RPC sudah menulis invitation.user_delete,
 *   jadi UI tidak boleh memanggil logAudit lagi.
 * - Error server (admin/punya votes) ditampilkan apa adanya.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { toast } from 'sonner';
import AdminInvitations from '../admin/Invitations';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit';

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }));

const row = {
  id: 'inv-1',
  created_at: '2026-10-01T00:00:00Z',
  email: 'user@test.com',
  full_name: 'User Test',
  student_id: 'N1',
  intent: 'register' as const,
  event_id: null,
  class_id: null,
  roles: ['voter'],
  token: 'a'.repeat(64),
  expires_at: '2099-01-01T00:00:00Z',
  accepted_at: '2026-10-02T00:00:00Z',
  accepted_user_id: 'u1',
  revoked_at: null,
};

function mockInvitations(deleteResult: { data?: any; error?: any } = { data: {}, error: null }) {
  vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
    if (fn === 'admin_list_invitations') {
      return Promise.resolve({ data: [row], error: null }) as any;
    }
    if (fn === 'admin_delete_invitation_user') {
      return Promise.resolve(deleteResult) as any;
    }
    return Promise.resolve({ data: null, error: null }) as any;
  });
}

describe('AdminInvitations - delete user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('memanggil RPC sekali dan tidak menulis audit ganda', async () => {
    mockInvitations();

    render(<AdminInvitations />);

    expect(await screen.findByText('user@test.com')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTitle('Hapus permanen akun + undangan'));
    });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_invitation_user', {
        p_invitation_id: 'inv-1',
      });
    });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('menampilkan error server (mis. akun admin / punya votes)', async () => {
    mockInvitations({ error: { message: 'Akun admin tidak dapat dihapus dari sini' } });

    render(<AdminInvitations />);

    expect(await screen.findByText('user@test.com')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTitle('Hapus permanen akun + undangan'));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Akun admin tidak dapat dihapus dari sini');
    });
  });
});
