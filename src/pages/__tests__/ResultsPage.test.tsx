/**
 * ResultsPage tests - verifikasi NaN fix:
 * - Tidak ada "NaN" di UI ketika totalVotes = 0
 * - safePercent mengembalikan 0 untuk input invalid
 * - Sorting kandidat berdasarkan votes (desc)
 * - Empty state ketika tidak ada kandidat
 * - Uses get_election_tally RPC (bukan N+1)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResultsPage from '../app/ResultsPage';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function chainable(final: Record<string, any> = {}) {
  const obj: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'rpc', 'ilike']) {
    obj[m] = vi.fn().mockImplementation((...args: any[]) => {
      const res = (final as any)[m];
      return typeof res === 'function' ? res(...args) : (res !== undefined ? res : obj);
    });
  }
  return obj;
}

const event = {
  id: 'event-1',
  title: 'Pemilihan BEM',
  description: null,
  status: 'closed',
  election_type: 'open',
  public_results: true,
  show_results_after_voting: false,
  start_time: '2026-01-01T00:00:00Z',
  end_time: '2026-01-02T00:00:00Z',
};

function mockResults({ tally, candidates }: { tally: any[]; candidates: any[] }) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'election_events') {
      return chainable({
        maybeSingle: vi.fn().mockResolvedValue({ data: event, error: null }),
      });
    }
    if (table === 'candidates') {
      const chain = chainable();
      chain.select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: candidates, error: null }),
        }),
      });
      return chain;
    }
    return chainable();
  });

  vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
    if (fn === 'get_election_tally') {
      return Promise.resolve({ data: tally, error: null }) as any;
    }
    return Promise.resolve({ data: null, error: null }) as any;
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/results/event-1']}>
      <Routes>
        <Route path="/app/results/:eventId" element={<ResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResultsPage - NaN Bug Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tidak menampilkan NaN ketika tidak ada suara sama sekali (totalVotes = 0)', async () => {
    mockResults({
      tally: [],
      candidates: [
        { id: 'c1', profiles: { full_name: 'Kandidat A', student_id: 'NA' } },
        { id: 'c2', profiles: { full_name: 'Kandidat B', student_id: 'NB' } },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Kandidat A').length).toBeGreaterThan(0);
    });

    // Kunci test: body halaman TIDAK boleh mengandung teks "NaN"
    expect(document.body.textContent).not.toMatch(/NaN/);

    // Persentase harus tampil sebagai 0%
    expect(document.body.textContent).toMatch(/0%/);
  });

  it('tidak menampilkan NaN dan menghitung persentase benar ketika ada suara', async () => {
    mockResults({
      tally: [
        { candidate_id: 'c1', pair_id: null, total_votes: 3 },
        { candidate_id: 'c2', pair_id: null, total_votes: 1 },
      ],
      candidates: [
        { id: 'c1', profiles: { full_name: 'Kandidat A', student_id: 'NA' } },
        { id: 'c2', profiles: { full_name: 'Kandidat B', student_id: 'NB' } },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Kandidat A').length).toBeGreaterThan(0);
    });

    expect(document.body.textContent).not.toMatch(/NaN/);
    // 3/4 = 75%
    expect(document.body.textContent).toMatch(/75%/);
    // 1/4 = 25%
    expect(document.body.textContent).toMatch(/25%/);
    // Total = 4
    expect(document.body.textContent).toMatch(/Total: 4/);
  });

  it('memanggil get_election_tally RPC (bukan N+1 query per kandidat)', async () => {
    mockResults({
      tally: [{ candidate_id: 'c1', pair_id: null, total_votes: 2 }],
      candidates: [{ id: 'c1', profiles: { full_name: 'Kandidat A', student_id: 'NA' } }],
    });

    renderPage();

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('get_election_tally', { p_event_id: 'event-1' });
    });
  });
});

describe('ResultsPage - Sorting & Empty States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mengurutkan kandidat berdasarkan suara terbanyak', async () => {
    mockResults({
      tally: [
        { candidate_id: 'c2', pair_id: null, total_votes: 10 },
        { candidate_id: 'c1', pair_id: null, total_votes: 5 },
      ],
      candidates: [
        { id: 'c1', profiles: { full_name: 'Alpha', student_id: 'NA' } },
        { id: 'c2', profiles: { full_name: 'Beta', student_id: 'NB' } },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    });

    // Beta (10 suara) harus di posisi #1, Alpha (5 suara) di #2
    const rows = document.body.textContent || '';
    expect(rows.indexOf('Beta')).toBeLessThan(rows.indexOf('Alpha'));
  });

  it('menampilkan empty state ketika tidak ada kandidat', async () => {
    mockResults({ tally: [], candidates: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Belum ada kandidat yang terdaftar/i)).toBeInTheDocument();
    });
  });

  it('menampilkan error state ketika event tidak ditemukan', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'election_events') {
        return chainable({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
      }
      return chainable();
    });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pemilihan tidak ditemukan/i)).toBeInTheDocument();
    });
  });
});



