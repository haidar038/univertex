/**
 * VotingPage tests - verifikasi implementasi:
 * - Timeline enforcement (belum mulai / sudah berakhir / active)
 * - Eligibility (DPT) check
 * - Double-vote prevention (unique constraint 23505)
 * - DB trigger timeline violation (P0001)
 * - Vote sukses toast
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VotingPage from '../app/VotingPage';
import { supabase } from '@/integrations/supabase/client';
import * as useAuthModule from '@/hooks/useAuth';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// ---- helpers -------------------------------------------------------------

const mockProfile = {
  id: 'voter-1',
  full_name: 'Voter Satu',
  student_id: 'NIM001',
  department: null,
  class_id: 'class-1',
  roles: ['voter'] as ('admin' | 'voter' | 'candidate')[],
};

function mockUseAuth(profile = mockProfile, loading = false) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user: profile ? ({ id: profile.id, email: 'v@x.com' } as any) : null,
    profile,
    loading,
    refresh: vi.fn(),
    signOut: vi.fn(),
    isAdmin: false,
    isVoter: true,
    isCandidate: false,
  });
}

function chainable(final: Record<string, any> = {}) {
  const obj: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'match', 'not']) {
    obj[m] = vi.fn().mockImplementation((...args: any[]) => {
      const res = (final as any)[m];
      return typeof res === 'function' ? res(...args) : (res !== undefined ? res : obj);
    });
  }
  return obj;
}

const futureDate = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();
const pastDate = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const activeEvent = {
  id: 'event-1',
  title: 'Pemilihan Ketua BEM',
  description: 'desc',
  status: 'voting',
  start_time: pastDate(60),
  end_time: futureDate(60),
  election_type: 'closed' as const,
  show_results_after_voting: false,
};

/** Mock all supabase.from() calls used by VotingPage. */
function mockFrom(config: {
  event?: any;
  eligible?: any;
  existingVote?: any;
  candidates?: any[];
  insertVote?: any;
}) {
  const approvedCandidates =
    config.candidates ??
    [
      { id: 'cand-1', vision: 'v1', mission: 'm1', photo_url: null, photo_storage_path: null, status: 'approved', profiles: { full_name: 'Kandidat A', student_id: 'NIM-A' } },
      { id: 'cand-2', vision: 'v2', mission: 'm2', photo_url: null, photo_storage_path: null, status: 'approved', profiles: { full_name: 'Kandidat B', student_id: 'NIM-B' } },
    ];

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    switch (table) {
      case 'election_events': {
        const ev = chainable();
        ev.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: 'event' in config ? config.event : activeEvent, error: null }),
          }),
        });
        return ev;
      }
      case 'event_voter_groups': {
        const eg = chainable();
        eg.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: 'eligible' in config ? config.eligible : { event_id: 'event-1' },
                error: null,
              }),
            }),
          }),
        });
        return eg;
      }
      case 'votes': {
        const votes = chainable();
        votes.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: config.existingVote ?? null, error: null }),
            }),
          }),
        });
        votes.insert = vi.fn().mockResolvedValue(config.insertVote ?? { error: null });
        return votes;
      }
      case 'candidates': {
        const cd = chainable();
        cd.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: approvedCandidates, error: null }),
          }),
        });
        return cd;
      }
      default:
        return chainable();
    }
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/vote/event-1']}>
      <Routes>
        <Route path="/app/vote/:eventId" element={<VotingPage />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Full flow: pilih kandidat -> konfirmasi -> submit vote. */
async function castVoteFlow() {
  await waitFor(() => screen.getByText('Kandidat A'));
  await act(async () => {
    fireEvent.click(screen.getByText('Kandidat A'));
  });
  await waitFor(() => screen.getByText(/Konfirmasi Pilihan/i));
  await act(async () => {
    fireEvent.click(screen.getByText(/Konfirmasi Pilihan/i));
  });
  await waitFor(() => screen.getByText(/Ya, Saya Yakin/i));
  await act(async () => {
    fireEvent.getByText ? null : null;
    fireEvent.click(screen.getByText(/Ya, Saya Yakin/i));
  });
}

// ---- tests ----------------------------------------------------------------

describe('VotingPage - Timeline Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
  });

  it('menampilkan banner "belum dimulai" ketika start_time di masa depan', async () => {
    mockFrom({
      event: { ...activeEvent, start_time: futureDate(30), end_time: futureDate(120) },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pemilihan belum dimulai/i)).toBeInTheDocument();
    });
  });

  it('menampilkan banner "sudah berakhir" ketika end_time sudah lewat dan TIDAK bisa vote (BUG SEBELUMNYA)', async () => {
    mockFrom({
      event: { ...activeEvent, start_time: pastDate(120), end_time: pastDate(10) },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Waktu pemilihan sudah berakhir/i)).toBeInTheDocument();
    });

    // Kunci fix: tombol konfirmasi TIDAK boleh muncul
    await waitFor(() => {
      expect(screen.queryByText(/Konfirmasi Pilihan/i)).not.toBeInTheDocument();
    });
  });

it('menampilkan banner status non-aktif ketika status bukan voting', async () => {
    mockFrom({ event: { ...activeEvent, status: 'published' } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/sudah diarsipkan|sudah selesai dan hasilnya telah dipublikasikan/i)).toBeInTheDocument();
    });
  });
});

describe('VotingPage - Eligibility (DPT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
  });

  it('menampilkan peringatan ketika user tidak masuk DPT', async () => {
    mockFrom({ eligible: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/tidak termasuk dalam Daftar Pemilih Tetap/i)).toBeInTheDocument();
    });
  });

  it('tidak menampilkan peringatan DPT ketika user eligible', async () => {
    mockFrom({ eligible: { event_id: 'event-1' } });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/tidak termasuk dalam Daftar Pemilih Tetap/i)).not.toBeInTheDocument();
    });
  });
});

describe('VotingPage - Double Vote Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
  });

  it('menampilkan banner "sudah vote" ketika vote sudah ada di DB', async () => {
    mockFrom({ existingVote: { candidate_id: 'cand-1' } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Anda sudah memberikan suara/i)).toBeInTheDocument();
    });

    // Tombol konfirmasi tidak boleh ada
    expect(screen.queryByText(/Konfirmasi Pilihan/i)).not.toBeInTheDocument();
  });

  it('menangani error 23505 (unique violation) dengan pesan spesifik via error.code', async () => {
    const { toast } = await import('sonner');
    mockFrom({
      insertVote: { error: { code: '23505', message: 'duplicate key value violates unique constraint "votes_voter_event_unique"' } },
    });

    renderPage();

    await castVoteFlow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Anda sudah memberikan suara untuk pemilihan ini');
    });
  });

  it('menangani error P0001 (timeline trigger) dengan pesan deadline', async () => {
    const { toast } = await import('sonner');
    mockFrom({
      insertVote: { error: { code: 'P0001', message: 'Election event has already ended' } },
    });

    renderPage();

    await castVoteFlow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Waktu pemilihan sudah berakhir atau belum dimulai');
    });
  });
});
describe('VotingPage - P0-01 Eligibility DB enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
  });

  it('menangani error 42501 non-DPT dengan banner DPT + insert kirim voter_id', async () => {
    const { toast } = await import('sonner');
    const insertMock = vi.fn().mockResolvedValue({
      error: { code: '42501', message: 'Voter voter-1 is not eligible for election event event-1' },
    });
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === 'votes') {
        const votes = chainable();
        votes.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        });
        votes.insert = insertMock;
        return votes;
      }
      if (table === 'election_events') {
        const ev = chainable();
        ev.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: activeEvent, error: null }),
          }),
        });
        return ev;
      }
      if (table === 'event_voter_groups') {
        const eg = chainable();
        eg.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { event_id: 'event-1' }, error: null }),
            }),
          }),
        });
        return eg;
      }
      if (table === 'candidates') {
        const cd = chainable();
        cd.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'cand-1', vision: 'v1', mission: 'm1', photo_url: null, photo_storage_path: null, status: 'approved', profiles: { full_name: 'Kandidat A', student_id: 'NIM-A' } },
              ],
              error: null,
            }),
          }),
        });
        return cd;
      }
      return chainable();
    }) as never);

    renderPage();

    await castVoteFlow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Anda tidak terdaftar di DPT pemilihan ini. Hubungi panitia.');
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ voter_id: 'voter-1', event_id: 'event-1' })
    );
    await waitFor(() => {
      expect(screen.getByText(/tidak termasuk dalam Daftar Pemilih Tetap/i)).toBeInTheDocument();
    });
  });

  it('menangani error 42501 voter_id mismatch dengan pesan DPT', async () => {
    const { toast } = await import('sonner');
    mockFrom({
      insertVote: { error: { code: '42501', message: 'voter_id must equal authenticated user' } },
    });

    renderPage();

    await castVoteFlow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Anda tidak terdaftar di DPT pemilihan ini. Hubungi panitia.');
    });
  });
});



describe('VotingPage - Success Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
  });

  it('menampilkan toast sukses setelah vote berhasil', async () => {
    const { toast } = await import('sonner');
    mockFrom({ insertVote: { error: null } });

    renderPage();

    await castVoteFlow();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Suara Anda berhasil tercatat!');
    });
  });

  it('mencatat audit vote.cast dengan metadata event_id saja (tanpa candidate)', async () => {
    const audit = await import('@/lib/audit');
    const spy = vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
    mockFrom({ insertVote: { error: null } });

    renderPage();

    await castVoteFlow();

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vote.cast',
          metadata: { event_id: 'event-1' },
        })
      );
    });
    // Jaga anonimitas: metadata TIDAK boleh berisi candidate/pair.
    const payload = spy.mock.calls[0][0] as { metadata?: Record<string, unknown> };
    expect(payload.metadata).not.toHaveProperty('candidate_id');
    expect(payload.metadata).not.toHaveProperty('pair_id');
    spy.mockRestore();
  });
});

describe('VotingPage - Not Found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
  });

  it('menampilkan error ketika event tidak ditemukan', async () => {
    mockFrom({ event: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pemilihan tidak ditemukan/i)).toBeInTheDocument();
    });
  });
});

