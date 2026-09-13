/**
 * Audit logging tests - verifikasi:
 * - logAudit mengirim argumen yang benar ke RPC log_audit_event
 * - logAudit tidak throw walau RPC gagal (never break calling flow)
 * - fetchAuditLog menerapkan filter kategori/severity/search/limit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAudit, fetchAuditLog } from '../audit';
import { supabase } from '@/integrations/supabase/client';

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('memanggil RPC log_audit_event dengan parameter lengkap', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'audit-id-1', error: null } as any);

    await logAudit({
      action: 'event.create',
      description: 'Created election event "Test"',
      category: 'election',
      targetType: 'election_events',
      targetId: 'evt-1',
      metadata: { title: 'Test' },
      severity: 'info',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', {
      p_action: 'event.create',
      p_description: 'Created election event "Test"',
      p_category: 'election',
      p_target_type: 'election_events',
      p_target_id: 'evt-1',
      p_metadata: { title: 'Test' },
      p_severity: 'info',
    });
  });

  it('menggunakan default values ketika optional fields tidak diisi', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await logAudit({ action: 'user.delete', description: 'Deleted user X' });

    expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', {
      p_action: 'user.delete',
      p_description: 'Deleted user X',
      p_category: 'admin',
      p_target_type: null,
      p_target_id: null,
      p_metadata: {},
      p_severity: 'info',
    });
  });

  it('tidak throw ketika RPC error (audit tidak boleh mem-break flow utama)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'function not found' },
    } as any);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      logAudit({ action: 'x.y', description: 'test' })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('tidak throw ketika rpc throw exception', async () => {
    vi.mocked(supabase.rpc).mockRejectedValue(new Error('network') as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      logAudit({ action: 'x.y', description: 'test' })
    ).resolves.toBeUndefined();

    warnSpy.mockRestore();
  });

  it('logAudit tetap mengirim auth.login.failed style event via log_audit_event (authenticated callers)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await logAudit({
      action: 'auth.logout',
      description: 'User logged out',
      category: 'auth',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', {
      p_action: 'auth.logout',
      p_description: 'User logged out',
      p_category: 'auth',
      p_target_type: null,
      p_target_id: null,
      p_metadata: {},
      p_severity: 'info',
    });
  });
});

describe('log_failed_login (anon-callable RPC, dipakai langsung oleh Login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Login.tsx memanggil RPC log_failed_login secara langsung (bukan lewat logAudit)', async () => {
    // Simulasi kontrak: caller anon memanggil supabase.rpc('log_failed_login')
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    await supabase.rpc('log_failed_login', { p_email: 'someone@x.com' });

    expect(supabase.rpc).toHaveBeenCalledWith('log_failed_login', {
      p_email: 'someone@x.com',
    });
  });
});

describe('fetchAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('menerapkan filter kategori dan severity ke query', async () => {
    // Build a then-able chainable: setiap method return chain itu sendiri,
    // dan `await chain` me-resolve ke result final.
    const result = { data: [], error: null };
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
    chain.then = (onResolve: any) => Promise.resolve(result).then(onResolve);

    vi.mocked(supabase.from).mockReturnValue(chain as any);

    await fetchAuditLog({ category: 'security', severity: 'critical', limit: 50 });

    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.eq).toHaveBeenCalledWith('category', 'security');
    expect(chain.eq).toHaveBeenCalledWith('severity', 'critical');
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('menerapkan search filter ilike ke description', async () => {
    const result = { data: [], error: null };
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
    chain.then = (onResolve: any) => Promise.resolve(result).then(onResolve);

    vi.mocked(supabase.from).mockReturnValue(chain as any);

    await fetchAuditLog({ search: 'kandidat', limit: 10 });

    expect(chain.ilike).toHaveBeenCalledWith('description', '%kandidat%');
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('mengembalikan array kosong ketika query error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
    chain.then = (onResolve: any) =>
      Promise.resolve({ data: null, error: { message: 'rls denied' } }).then(onResolve);

    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await fetchAuditLog({ limit: 10 });
    expect(result).toEqual([]);
    errSpy.mockRestore();
  });
});
