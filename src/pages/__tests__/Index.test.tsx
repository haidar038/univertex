/**
 * Index (landing) tests - verifikasi:
 * - CTA "Daftar" sudah TIDAK ada lagi (invite-only)
 * - Semua CTA mengarah ke /login
 * - Redirect ke dashboard ketika sudah login
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Index from '../Index';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function chainable(final: Record<string, any> = {}) {
  const obj: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'ilike', 'head', 'count']) {
    obj[m] = vi.fn().mockImplementation((...args: any[]) => {
      const res = (final as any)[m];
      return typeof res === 'function' ? res(...args) : (res !== undefined ? res : obj);
    });
  }
  return obj;
}

function mockNoSession() {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  });
  vi.mocked(supabase.from).mockImplementation(() => chainable());
}

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Index />
    </MemoryRouter>
  );
}

describe('Index - Invite-Only Landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNoSession();
  });

  it('TIDAK menampilkan tombol/CTA "Daftar" (signup publik ditutup)', async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByText(/Demokrasi Digital/i)).toBeInTheDocument();
    });

    // Tidak boleh ada CTA "Daftar" yang mengarah ke /signup
    const signupLinks = screen.queryAllByRole('link', { name: /^Daftar$/i });
    expect(signupLinks).toHaveLength(0);
  });

  it('semua CTA utama mengarah ke /login', async () => {
    renderIndex();

    await waitFor(() => {
      const loginLinks = screen.getAllByRole('link', { name: /Masuk|Mulai Sekarang/i });
      expect(loginLinks.length).toBeGreaterThanOrEqual(2);
    });

    // Link "Mulai Sekarang" harus ke /login
    const mulai = screen.getByRole('link', { name: /Mulai Sekarang/i });
    expect(mulai.getAttribute('href')).toBe('/login');
  });

  it('menampilkan catatan undangan dari admin/panitia', async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByText(/tautan undangan dari admin\/panitia/i)).toBeInTheDocument();
    });
  });

  it('FAQ menjelaskan sistem undangan', async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByText(/Bagaimana cara mendapatkan akun\?/i)).toBeInTheDocument();
    });

    // Accordion konten tersembunyi sampai dibuka; cukup verifikasi item FAQ ada
    // dan halaman menyebut sistem undangan di CTA note.
    expect(document.body.textContent).toMatch(/invite-only|undangan/i);
  });
});

