/**
 * CommitteeDashboard tests
 *
 * - Renders the heading and the access explanation
 * - Empty state when no assignments
 * - Lists assignments as cards when the RPC returns rows
 * - Handles RPC error gracefully
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommitteeDashboard from '../committee/Dashboard';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/committee']}>
      <Routes>
        <Route path="/committee" element={<CommitteeDashboard />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CommitteeDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the heading and explanation', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Panitia Pemilihan/i })).toBeInTheDocument();
    });
  });

  it('shows empty state when no assignments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/belum ditugaskan sebagai panitia/i)).toBeInTheDocument();
    });
  });

  it('lists assignments from list_my_committee_assignments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        { committee_id: 'c1', election_id: 'e1', election_title: 'Pemilihan BEM 2026', committee_role: 'chair', appointed_at: '2026-09-01T00:00:00Z' },
        { committee_id: 'c2', election_id: 'e2', election_title: 'Pemilihan Himpunan', committee_role: 'verifier', appointed_at: '2026-09-02T00:00:00Z' },
      ],
      error: null,
    } as any);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pemilihan BEM 2026')).toBeInTheDocument();
      expect(screen.getByText('Pemilihan Himpunan')).toBeInTheDocument();
    });
    expect(screen.getByText('Ketua')).toBeInTheDocument();
    expect(screen.getByText('Verifikator')).toBeInTheDocument();
  });

  it('shows error alert when RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    } as any);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Gagal memuat data panitia/i)).toBeInTheDocument();
    });
  });
});
