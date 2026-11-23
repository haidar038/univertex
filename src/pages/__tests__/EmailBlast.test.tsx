/**
 * Blast Email panel tests (Fase 2):
 * - Halaman render di balik permission admin + query daftar event
 * - Kontrak RPC admin_enqueue_event_voters(event) dan invoke function
 *   send-voter-credentials {event_id, batch} (tanpa render Radix Select
 *   yang butuh pointer capture di jsdom — pola sama seperti CreateUserDialog)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminEmailBlast from '@/pages/admin/EmailBlast';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ has: true, loading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

describe('AdminEmailBlast - Fase 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase as any).functions = { invoke: vi.fn() };
  });

  it('render judul + ambil daftar event', async () => {
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === 'election_events') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: 'ev-1', title: 'Event Uji' }],
              error: null,
            }),
          }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      } as any;
    }) as any);

    render(<AdminEmailBlast />);

    expect(screen.getByText(/Blast Kredensial Email/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('election_events');
    });
  });

  it('kontrak enqueue: admin_enqueue_event_voters dipanggil dengan event id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 120, error: null } as any);

    await supabase.rpc('admin_enqueue_event_voters', { p_event_id: 'ev-1' });

    expect(supabase.rpc).toHaveBeenCalledWith('admin_enqueue_event_voters', {
      p_event_id: 'ev-1',
    });
  });

  it('kontrak kirim: functions.invoke send-voter-credentials {event_id, batch} + header sesi', async () => {
    (supabase as any).functions.invoke.mockResolvedValue({
      data: { sent: 200, failed: 0, pending: 0, duration_ms: 12000 },
      error: null,
    });

    await (supabase as any).functions.invoke('send-voter-credentials', {
      body: { event_id: 'ev-1', batch: 200 },
      headers: { Authorization: 'Bearer sess-123' },
    });

    const [, opts] = (supabase as any).functions.invoke.mock.calls[0];
    // Gotcha supabase-js: header Authorization TIDAK otomatis = token sesi
    // (default-nya anon key -> server jawab 401). Wajib eksplisit.
    expect(opts.headers.Authorization).toMatch(/^Bearer\s+\S+$/);
    expect(opts.body).toEqual({ event_id: 'ev-1', batch: 200 });
  });
});
