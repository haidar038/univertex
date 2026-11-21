/**
 * ClassDetailsDialog — regresi tabel detail kelas:
 * - pagination 20 per halaman
 * - checkbox header = pilih semua di halaman, seleksi lintas halaman
 * - shift+klik range-select
 * - unassign massal mengirim class_id = null hanya untuk baris terpilih
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { ClassDetailsDialog } from '@/components/admin/classes/ClassDetailsDialog';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }));

const profiles = Array.from({ length: 25 }, (_, i) => ({
  id: `s${i + 1}`,
  full_name: `Mahasiswa ${String(i + 1).padStart(2, '0')}`,
  student_id: `N${i + 1}`,
  department: 'Teknik',
}));
const roles = profiles.map((p) => ({ user_id: p.id, role: 'voter' }));

const updateValues = { current: null as Record<string, unknown> | null };
const inArgs = { current: [] as string[] };
const eqArgs = { current: [] as unknown[] };

// Chain thenable: tiap method return objek yang sama, await menyelesaikan hasil per tabel.
function chain(table: string) {
  const state = { mode: 'select' as 'select' | 'update' };
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'not', 'ilike', 'limit', 'delete', 'insert', 'upsert']) {
    c[m] = vi.fn(() => c);
  }
  c.in = vi.fn((column: string, values: string[]) => {
    if (column === 'id' && state.mode === 'update') inArgs.current = values;
    return c;
  });
  c.update = vi.fn((values: Record<string, unknown>) => {
    state.mode = 'update';
    updateValues.current = values;
    return c;
  });
  // eq dipakai fetchStudents (class_id) dan unassign (class_id) — simpan yang terakhir.
  c.eq = vi.fn((...args: unknown[]) => {
    eqArgs.current = args;
    return c;
  });
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    const result = table === 'profiles'
      ? state.mode === 'update'
        ? { count: inArgs.current.length, error: null }
        : { data: profiles, error: null }
      : { data: roles, error: null };
    return Promise.resolve(result).then(resolve, reject);
  };
  return c;
}

function mockTables() {
  vi.mocked(supabase.from).mockImplementation(((table: string) => chain(table)) as never);
}

describe('ClassDetailsDialog — tabel + bulk unassign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateValues.current = null;
    inArgs.current = [];
    eqArgs.current = [];
    mockTables();
  });

  it('memotong 20 baris per halaman dan bisa lanjut halaman', async () => {
    render(<ClassDetailsDialog open onOpenChange={() => {}} classId="c1" className="Kelas A" />);

    expect(await screen.findByText('Mahasiswa 01')).toBeInTheDocument();
    expect(screen.queryByText('Mahasiswa 21')).not.toBeInTheDocument();
    expect(screen.getByText(/Halaman 1 dari 2/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    });

    expect(screen.getByText('Mahasiswa 21')).toBeInTheDocument();
    expect(screen.queryByText('Mahasiswa 01')).not.toBeInTheDocument();
  });

  it('checkbox header pilih halaman ini; seleksi tetap lintas halaman', async () => {
    render(<ClassDetailsDialog open onOpenChange={() => {}} classId="c1" className="Kelas A" />);

    expect(await screen.findByText('Mahasiswa 01')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih semua mahasiswa di halaman ini' }));
    });
    expect(screen.getByText(/20 mahasiswa dipilih/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    });
    expect(screen.getByText(/20 mahasiswa dipilih/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih Mahasiswa 21' }));
    });
    expect(screen.getByText(/21 mahasiswa dipilih/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Batalkan/i }));
    });
    expect(screen.queryByText(/mahasiswa dipilih/i)).not.toBeInTheDocument();
  });

  it('shift+klik memilih rentang baris', async () => {
    render(<ClassDetailsDialog open onOpenChange={() => {}} classId="c1" className="Kelas A" />);

    expect(await screen.findByText('Mahasiswa 01')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih Mahasiswa 01' }));
    });
    expect(screen.getByText(/1 mahasiswa dipilih/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Shift' });
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih Mahasiswa 05' }));
    });
    fireEvent.keyUp(window, { key: 'Shift' });

    expect(screen.getByText(/5 mahasiswa dipilih/i)).toBeInTheDocument();
  });

  it('unassign massal men-set class_id null untuk ID terpilih saja', async () => {
    const onSuccess = vi.fn();
    render(
      <ClassDetailsDialog
        open
        onOpenChange={() => {}}
        classId="c1"
        className="Kelas A"
        onSuccess={onSuccess}
      />
    );

    expect(await screen.findByText('Mahasiswa 01')).toBeInTheDocument();
    for (const name of ['Mahasiswa 01', 'Mahasiswa 02']) {
      await act(async () => {
        fireEvent.click(screen.getByRole('checkbox', { name: `Pilih ${name}` }));
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Unassign Massal/i }));
    });
    expect(screen.getByText(/Unassign 2 Mahasiswa\?/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassign 2 Mahasiswa' }));
    });

    await waitFor(() => {
      expect(updateValues.current).toEqual({ class_id: null });
    });
    expect(inArgs.current).toEqual(['s1', 's2']);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'class.unassign_bulk' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
