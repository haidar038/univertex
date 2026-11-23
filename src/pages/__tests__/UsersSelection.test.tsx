/**
 * P-C regresi checkbox Users.tsx + pagination server-side:
 * - Klik checkbox baris TIDAK boleh crash (bug: updater toggleSelect
 *   tidak me-return Set baru -> selectedIds undefined -> .size meledak)
 * - Toolbar "Hapus Massal" muncul saat ada pilihan, hilang saat dibatalkan
 * - Header checkbox pilih-semua / batal-semua
 * - RPC admin_list_users_paged dipanggil dengan offset/search; total_count
 *   dipakai UI (bukan 999 dari batas PostgREST)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import AdminUsers from '@/pages/admin/Users';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ has: true, loading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

type Row = {
  id: string;
  full_name: string;
  student_id: string;
  email: string;
  department: string | null;
  class_id: string | null;
  class_name: string | null;
  roles: string[];
};

const twoUsers: Row[] = [
  {
    id: 'u1', full_name: 'User Satu', student_id: 'N1', email: 'u1@x.com',
    department: null, class_id: null, class_name: null, roles: ['voter'],
  },
  {
    id: 'u2', full_name: 'User Dua', student_id: 'N2', email: 'u2@x.com',
    department: null, class_id: null, class_name: null, roles: ['voter'],
  },
];

/** Mock RPC pagination: filter + slice sesuai argumen, sertakan total_count. */
function mockPagedUsers(source: Row[]) {
  vi.mocked(supabase.rpc).mockImplementation((fn: string, args: any) => {
    if (fn !== 'admin_list_users_paged') {
      return Promise.resolve({ data: null, error: null }) as any;
    }
    const limit = Number(args?.p_limit ?? 20);
    const offset = Number(args?.p_offset ?? 0);
    const search = String(args?.p_search ?? '').trim().toLowerCase();
    const filtered = search
      ? source.filter((u) =>
          u.full_name.toLowerCase().includes(search) ||
          u.student_id.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search),
        )
      : source;
    const data = filtered
      .slice(offset, offset + limit)
      .map((u) => ({ ...u, total_count: filtered.length }));
    return Promise.resolve({ data, error: null }) as any;
  });
}

describe('AdminUsers - P-C seleksi bulk delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPagedUsers(twoUsers);
  });

  it('klik checkbox baris menampilkan toolbar tanpa crash', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Satu')).toBeInTheDocument();
    });

    // Belum ada pilihan -> toolbar tidak ada
    expect(screen.queryByText(/pengguna dipilih/i)).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih User Satu' }));
    });

    // Toolbar muncul, tidak crash (regresi bug .size of undefined)
    expect(screen.getByText(/1 pengguna dipilih/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hapus Massal/i })).toBeInTheDocument();

    // Klik lagi -> batal pilih, toolbar hilang
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih User Satu' }));
    });
    expect(screen.queryByText(/pengguna dipilih/i)).not.toBeInTheDocument();
  });

  it('header checkbox pilih semua lalu batalkan', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih semua' }));
    });
    expect(screen.getByText(/2 pengguna dipilih/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Batalkan/i }));
    });
    expect(screen.queryByText(/pengguna dipilih/i)).not.toBeInTheDocument();
  });

  it('shift+klik memilih rentang dari klik terakhir', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    // Klik biasa baris 1 -> anchor
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih User Satu' }));
    });
    expect(screen.getByText(/1 pengguna dipilih/i)).toBeInTheDocument();

    // Tahan Shift + klik baris 2 -> rentang 1..2 terpilih
    fireEvent.keyDown(window, { key: 'Shift' });
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih User Dua' }));
    });
    fireEvent.keyUp(window, { key: 'Shift' });

    expect(screen.getByText(/2 pengguna dipilih/i)).toBeInTheDocument();
  });

  it('klik tanpa shift setelah shift tidak membawa rentang lama', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    // Tanpa anchor (belum klik apa-apa), shift+klik = toggle biasa 1 item
    fireEvent.keyDown(window, { key: 'Shift' });
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih User Dua' }));
    });
    fireEvent.keyUp(window, { key: 'Shift' });

    expect(screen.getByText(/1 pengguna dipilih/i)).toBeInTheDocument();
  });

  it('search dikirim ke server dan menyaring baris nama/NIM/email', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Cari pengguna' }), {
      target: { value: 'satu' },
    });

    await waitFor(() => {
      expect(screen.getByText('User Satu')).toBeInTheDocument();
      expect(screen.queryByText('User Dua')).not.toBeInTheDocument();
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'admin_list_users_paged',
      expect.objectContaining({ p_search: 'satu', p_offset: 0 }),
    );
    expect(screen.getByText(/1 pengguna cocok/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Cari pengguna' }), {
      target: { value: 'N2' },
    });
    await waitFor(() => {
      expect(screen.queryByText('User Satu')).not.toBeInTheDocument();
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Cari pengguna' }), {
      target: { value: '' },
    });
    await waitFor(() => {
      expect(screen.getByText('User Satu')).toBeInTheDocument();
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });
  });

  it('search tanpa hasil tampil pesan kosong', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Cari pengguna' }), {
      target: { value: 'zzzz-tidak-ada' },
    });

    await waitFor(() => {
      expect(screen.getByText(/Tidak ada pengguna yang cocok/i)).toBeInTheDocument();
    });
  });

  describe('pagination 20/halaman dari RPC', () => {
    const manyUsers: Row[] = Array.from({ length: 25 }, (_, i) => ({
      id: `u${i + 1}`,
      full_name: `User ${String(i + 1).padStart(2, '0')}`,
      student_id: `N${i + 1}`,
      email: `u${i + 1}@x.com`,
      department: null,
      class_id: null,
      class_name: null,
      roles: ['voter'],
    }));

    beforeEach(() => {
      mockPagedUsers(manyUsers);
    });

    it('halaman 1 tampil 20, halaman 2 tampil 5 dengan offset benar', async () => {
      render(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText('User 01')).toBeInTheDocument();
      });

      expect(screen.queryByText('User 21')).not.toBeInTheDocument();
      expect(screen.getByText(/Halaman 1 dari 2 \(25 pengguna\)/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));

      await waitFor(() => {
        expect(screen.getByText('User 21')).toBeInTheDocument();
      });
      expect(supabase.rpc).toHaveBeenCalledWith(
        'admin_list_users_paged',
        expect.objectContaining({ p_limit: 20, p_offset: 20, p_search: null }),
      );
      expect(screen.queryByText('User 01')).not.toBeInTheDocument();
      expect(screen.getByText(/Halaman 2 dari 2/i)).toBeInTheDocument();
    }, 15000);

    it('seleksi bertahan lintas halaman', async () => {
      render(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText('User 01')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih User 01' }));
      });
      expect(screen.getByText(/1 pengguna dipilih/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
      await waitFor(() => expect(screen.getByText('User 21')).toBeInTheDocument());
      expect(screen.getByText(/1 pengguna dipilih/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Halaman sebelumnya' }));
      await waitFor(() => expect(screen.getByText('User 01')).toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: 'Pilih User 01' })).toBeChecked();
    }, 15000);

    it('search reset ke halaman 1', async () => {
      render(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText('User 01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
      await waitFor(() => expect(screen.getByText(/Halaman 2 dari 2/i)).toBeInTheDocument());

      fireEvent.change(screen.getByRole('textbox', { name: 'Cari pengguna' }), {
        target: { value: 'User 0' },
      });

      // 9 hasil (01-09) = 1 halaman, pager hilang
      await waitFor(() => {
        expect(screen.queryByText(/Halaman 2 dari/i)).not.toBeInTheDocument();
        expect(screen.getByText('User 01')).toBeInTheDocument();
      });
    }, 15000);

    it('menampilkan total 1600 pengguna meski PostgREST memotong 1000', async () => {
      const big: Row[] = Array.from({ length: 1600 }, (_, i) => ({
        id: `b${i + 1}`,
        full_name: `Voter ${String(i + 1).padStart(4, '0')}`,
        student_id: `B${i + 1}`,
        email: `b${i + 1}@x.com`,
        department: null,
        class_id: null,
        class_name: null,
        roles: ['voter'],
      }));
      mockPagedUsers(big);

      render(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText('Voter 0001')).toBeInTheDocument();
      });
      expect(screen.getByText(/Halaman 1 dari 80 \(1600 pengguna\)/i)).toBeInTheDocument();
      expect(screen.queryByText('Voter 0021')).not.toBeInTheDocument();
    }, 15000);
  });
});
