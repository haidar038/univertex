/**
 * ObserverDashboard tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ObserverDashboard from '../observer/Dashboard';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/observer']}>
      <Routes>
        <Route path="/observer" element={<ObserverDashboard />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ObserverDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the heading and read-only notice', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Observer Pemilihan/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/hanya dapat/i)).toBeInTheDocument();
  });

  it('shows empty state when no assignments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/belum ditugaskan sebagai observer/i)).toBeInTheDocument();
    });
  });

  it('lists observer assignments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        { observer_id: 'o1', election_id: 'e1', election_title: 'Audit BEM', appointed_at: '2026-09-01T00:00:00Z' },
      ],
      error: null,
    } as any);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Audit BEM')).toBeInTheDocument();
    });
  });
});
