/**
 * Device session tests - verifikasi:
 * - registerCurrentDeviceSession mengirim fingerprint + label + expiry
 * - touchCurrentDeviceSession memanggil touch_user_session
 * - revokeSession memanggil revoke_user_session dengan reason
 * - Semua best-effort: tidak throw walau DB belum ada RPC-nya (404 handling)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerCurrentDeviceSession, touchCurrentDeviceSession, revokeSession, revokeSessionByHash, listMySessions, listUserSessions } from '../sessions';
import { supabase } from '@/integrations/supabase/client';

const realCrypto = global.crypto;

function chainable() {
  const obj: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'single']) {
    obj[m] = vi.fn().mockReturnThis();
  }
  return obj;
}

describe('registerCurrentDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getSession untuk session aktif
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1' },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        } as any,
      },
      error: null,
    });
  });

  it('mendaftarkan sesi device dengan fingerprint hash + label + expiry', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'session-row-id', error: null } as any);

    const id = await registerCurrentDeviceSession();

    expect(id).toBe('session-row-id');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'register_user_session',
      expect.objectContaining({
        p_refresh_token_hash: expect.any(String) as any,
        p_user_agent: expect.any(String) as any,
        p_device_label: expect.any(String) as any,
        p_expires_at: expect.any(String) as any,
      })
    );
    // Hash harus 64 char hex (SHA-256)
    const call = vi.mocked(supabase.rpc).mock.calls[0][1] as any;
    expect(call.p_refresh_token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mengembalikan null ketika tidak ada session (belum login)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const id = await registerCurrentDeviceSession();
    expect(id).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('tidak throw ketika RPC tidak ada (404) - best effort', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Could not find the function public.register_user_session' },
    } as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const id = await registerCurrentDeviceSession();

    expect(id).toBeNull(); // graceful
    warnSpy.mockRestore();
  });
});

describe('touchCurrentDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('memanggil touch_user_session dengan hash fingerprint', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await touchCurrentDeviceSession();

    expect(supabase.rpc).toHaveBeenCalledWith(
      'touch_user_session',
      expect.objectContaining({
        p_refresh_token_hash: expect.any(String) as any,
      })
    );
  });

  it('tidak throw ketika RPC gagal', async () => {
    vi.mocked(supabase.rpc).mockRejectedValue(new Error('network') as any);
    await expect(touchCurrentDeviceSession()).resolves.toBeUndefined();
  });
});

describe('revokeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('memanggil revoke_user_session dengan id dan reason', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    const ok = await revokeSession('session-id-1', 'admin_revoke');

    expect(ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('revoke_user_session', {
      p_session_id: 'session-id-1',
      p_revoked_reason: 'admin_revoke',
    });
  });

  it('mengembalikan false ketika RPC error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'not found' } } as any);

    const ok = await revokeSession('bad-id');
    expect(ok).toBe(false);
  });
});

describe('revokeSessionByHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('memanggil revoke_user_session_by_hash dengan hash dan reason', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    const ok = await revokeSessionByHash('a'.repeat(64), 'user_logout');

    expect(ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('revoke_user_session_by_hash', {
      p_refresh_token_hash: 'a'.repeat(64),
      p_revoked_reason: 'user_logout',
    });
  });

  it('mengembalikan false ketika RPC error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'no rows' } } as any);

    const ok = await revokeSessionByHash('b'.repeat(64));
    expect(ok).toBe(false);
  });
});

describe('listMySessions / listUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMySessions mengembalikan rows terurut last_seen_at desc', async () => {
    const rows = [{ id: 's1', device_label: 'Chrome on Windows' }];
    const eqMock = vi.fn().mockReturnThis();
    const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: orderMock,
      }),
    } as any);

    const result = await listMySessions();

    expect(orderMock).toHaveBeenCalledWith('last_seen_at', { ascending: false });
    expect(result).toEqual(rows);
  });

  it('listUserSessions memfilter berdasarkan user_id', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = vi.fn().mockReturnThis();

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: eqMock.mockReturnValue({
          order: orderMock,
        }),
      }),
    } as any);

    await listUserSessions('user-42');

    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-42');
  });
});
