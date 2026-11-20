/**
 * PublicResultsPage — public live count gating.
 *
 * Regresi yang dijaga:
 * - open+voting TANPA public_live_count tidak boleh memanggil tally (bocor).
 * - open+voting DENGAN public_live_count boleh tampil live.
 * - counting+public_results tetap tampil.
 * - closed+voting selalu terkunci untuk publik.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicResultsPage from '../PublicResultsPage';
import { supabase } from '@/integrations/supabase/client';

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

const baseEvent = {
  id: 'event-1',
  title: 'Pemilihan BEM',
  description: null,
  status: 'voting',
  election_type: 'open',
  public_results: false,
  public_live_count: false,
  show_results_after_voting: false,
  use_pairs: false,
  start_time: '2026-01-01T00:00:00Z',
  end_time: '2026-01-02T00:00:00Z',
};

function mockPage(event: any, opts: { candidates?: any[]; tally?: any[] } = {}) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'election_events') {
      return chainable({ single: vi.fn().mockResolvedValue({ data: event, error: null }) });
    }
    if (table === 'candidates') {
      const chain = chainable();
      chain.select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: opts.candidates ?? [], error: null }),
        }),
      });
      return chain;
    }
    return chainable();
  });
  vi.mocked(supabase.rpc).mockResolvedValue({ data: opts.tally ?? [], error: null } as any);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/results/event-1']}>
      <Routes>
        <Route path="/results/:eventId" element={<PublicResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicResultsPage - public live count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open+voting tanpa public_live_count: terkunci, tally tidak dipanggil', async () => {
    mockPage({ ...baseEvent, public_live_count: false });

    renderPage();

    expect(await screen.findByText('Hasil Tidak Tersedia')).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('open+voting dengan public_live_count: tally tampil', async () => {
    mockPage(
      { ...baseEvent, public_live_count: true },
      {
        tally: [{ candidate_id: 'c1', pair_id: null, total_votes: 3 }],
        candidates: [
          { id: 'c1', profiles: { full_name: 'Kandidat A', student_id: 'N1', department: null } },
        ],
      }
    );

    renderPage();

    expect(await screen.findByText('Hasil Sementara')).toBeInTheDocument();
    expect((await screen.findAllByText('Kandidat A')).length).toBeGreaterThan(0);
    expect(supabase.rpc).toHaveBeenCalledWith('get_election_tally', { p_event_id: 'event-1' });
  });

  it('counting+public_results: tally tampil', async () => {
    mockPage(
      { ...baseEvent, status: 'counting', public_results: true },
      {
        tally: [{ candidate_id: 'c1', pair_id: null, total_votes: 5 }],
        candidates: [
          { id: 'c1', profiles: { full_name: 'Kandidat B', student_id: 'N2', department: null } },
        ],
      }
    );

    renderPage();

    expect(await screen.findByText('Hasil Pemilihan')).toBeInTheDocument();
    expect((await screen.findAllByText('Kandidat B')).length).toBeGreaterThan(0);
    expect(supabase.rpc).toHaveBeenCalledWith('get_election_tally', { p_event_id: 'event-1' });
  });

  it('closed+voting: terkunci walau public_results menyala', async () => {
    mockPage({
      ...baseEvent,
      election_type: 'closed',
      public_results: true,
      public_live_count: true,
    });

    renderPage();

    expect(await screen.findByText('Hasil Tidak Tersedia')).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
