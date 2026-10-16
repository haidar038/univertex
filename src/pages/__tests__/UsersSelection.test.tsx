/**
 * P-C regresi checkbox Users.tsx:
 * - Klik checkbox baris TIDAK boleh crash (bug: updater toggleSelect
 *   tidak me-return Set baru -> selectedIds undefined -> .size meledak)
 * - Toolbar "Hapus Massal" muncul saat ada pilihan, hilang saat dibatalkan
 * - Header checkbox pilih-semua / batal-semua
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

const twoUsers = [
  {
    id: 'u1', full_name: 'User Satu', student_id: 'N1', email: 'u1@x.com',
    department: null, class_id: null, class_name: null, roles: ['voter'],
  },
  {
    id: 'u2', full_name: 'User Dua', student_id: 'N2', email: 'u2@x.com',
    department: null, class_id: null, class_name: null, roles: ['voter'],
  },
];

function mockListUsers() {
  vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
    if (fn === 'admin_list_users') {
      return Promise.resolve({ data: twoUsers, error: null }) as any;
    }
    return Promise.resolve({ data: null, error: null }) as any;
  });
}

describe('AdminUsers - P-C seleksi bulk delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers();
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

  it('search menyaring baris nama/NIM/email', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    const box = screen.getByRole('textbox', { name: 'Cari pengguna' });
    fireEvent.change(box, { target: { value: 'satu' } });

    expect(screen.getByText('User Satu')).toBeInTheDocument();
    expect(screen.queryByText('User Dua')).not.toBeInTheDocument();
    expect(screen.getByText(/1 dari 2 pengguna cocok/i)).toBeInTheDocument();

    fireEvent.change(box, { target: { value: 'N2' } });
    expect(screen.queryByText('User Satu')).not.toBeInTheDocument();
    expect(screen.getByText('User Dua')).toBeInTheDocument();

    fireEvent.change(box, { target: { value: '' } });
    expect(screen.getByText('User Satu')).toBeInTheDocument();
    expect(screen.getByText('User Dua')).toBeInTheDocument();
  });

  it('search tanpa hasil tampil pesan kosong', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('User Dua')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Cari pengguna' }), {
      target: { value: 'zzzz-tidak-ada' },
    });

    expect(screen.getByText(/Tidak ada pengguna yang cocok/i)).toBeInTheDocument();
  });

  describe('pagination 20/halaman', () => {
    const manyUsers = Array.from({ length: 25 }, (_, i) => ({
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
      vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
        if (fn === 'admin_list_users') {
          return Promise.resolve({ data: manyUsers, error: null }) as any;
        }
        return Promise.resolve({ data: null, error: null }) as any;
      });
    });

    it('halaman 1 tampil 20, halaman 2 tampil 5', async () => {      render(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText('User 01')).toBeInTheDocument();
      });

      expect(screen.queryByText('User 21')).not.toBeInTheDocument();
      expect(screen.getByText(/Halaman 1 dari 2/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));

      expect(screen.getByText('User 21')).toBeInTheDocument();
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
      expect(screen.getByText(/1 pengguna dipilih/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Halaman sebelumnya' }));
      expect(screen.getByRole('checkbox', { name: 'Pilih User 01' })).toBeChecked();
    }, 15000);

    it('search reset ke halaman 1', async () => {
      render(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText('User 01')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
      expect(screen.getByText(/Halaman 2 dari 2/i)).toBeInTheDocument();

      fireEvent.change(screen.getByRole('textbox', { name: 'Cari pengguna' }), {
        target: { value: 'User 0' },
      });

      // 9 hasil (01-09) = 1 halaman, pager hilang
      expect(screen.queryByText(/Halaman 2 dari/i)).not.toBeInTheDocument();
      expect(screen.getByText('User 01')).toBeInTheDocument();
    }, 15000);
  });
});
