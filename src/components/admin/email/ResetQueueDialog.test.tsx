/**
 * ResetQueueDialog: konfirmasi reset antrean via modal proper (pengganti
 * confirm() bawaan browser). Konfirmasi memanggil onConfirm (hapus pending),
 * batal menutup tanpa efek samping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ResetQueueDialog } from '@/components/admin/email/ResetQueueDialog';

describe('ResetQueueDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tampilkan jumlah pending + konfirmasi panggil onConfirm', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ResetQueueDialog open onOpenChange={onOpenChange} pendingCount={4} busy={false} onConfirm={onConfirm} />
    );

    expect(screen.getByText(/4 email pending/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hapus 4 Antrean/i }));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('tombol disabled saat busy', () => {
    render(
      <ResetQueueDialog open onOpenChange={() => {}} pendingCount={4} busy onConfirm={() => {}} />
    );

    expect(screen.getByRole('button', { name: /Mereset/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Batal/i })).toBeDisabled();
  });
});
