/**
 * DeleteEventDialog: hapus event berdata hanya via arsip + RPC.
 * - voting + votes>0 -> diblokir (tombol disabled, pesan arsipkan)
 * - archived + data -> wajib ketik nama persis -> RPC admin_delete_event
 * - kosong -> DELETE langsung seperti semula
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { DeleteEventDialog } from '@/components/admin/events/DeleteEventDialog';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function mockEventData(status: string, counts: { c: number; v: number; g: number }) {
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'election_events') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { status }, error: null }),
          }),
        }),
      } as any;
    }
    const n = table === 'candidates' ? counts.c : table === 'votes' ? counts.v : counts.g;
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, count: n, error: null }),
      }),
    } as any;
  }) as any);
  vi.mocked(supabase.rpc).mockResolvedValue({ data: { deleted: 'ev-1' }, error: null } as any);
}

describe('DeleteEventDialog - hapus arsip via RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('voting + ada votes -> diblokir dengan pesan arsipkan', async () => {
    mockEventData('voting', { c: 2, v: 1, g: 1 });

    render(
      <DeleteEventDialog open onOpenChange={() => {}} eventId="ev-1" eventTitle="Event A" />
    );

    await waitFor(() => {
      expect(screen.getByText(/tidak dapat/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Hapus Acara/i })).toBeDisabled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('archived + data -> wajib ketik nama persis lalu RPC', async () => {
    mockEventData('archived', { c: 2, v: 5, g: 1 });

    render(
      <DeleteEventDialog open onOpenChange={() => {}} eventId="ev-1" eventTitle="Event A" />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Ketik nama acara persis/i)).toBeInTheDocument();
    });

    const btn = screen.getByRole('button', { name: /Hapus Acara/i });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Ketik nama acara persis/i), {
      target: { value: 'Event A' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hapus Acara/i }));
    });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_event', { p_event_id: 'ev-1' });
    });
  });

  it('tanpa data -> DELETE langsung seperti semula', async () => {
    mockEventData('voting', { c: 0, v: 0, g: 0 });

    render(
      <DeleteEventDialog open onOpenChange={() => {}} eventId="ev-1" eventTitle="Event A" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Aman untuk dihapus/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hapus Acara/i }));
    });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('election_events');
    });
  });
});
