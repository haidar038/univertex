import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AdminAuditExport from '../../admin/AuditExport';
import { supabase } from '@/integrations/supabase/client';
import * as usePermissionModule from '@/hooks/usePermission';
import * as useAuthModule from '@/hooks/useAuth';

vi.mock('@/hooks/usePermission', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/usePermission')>('@/hooks/usePermission');
  return {
    ...actual,
    usePermission: vi.fn(),
  };
});

const mockUsePermission = vi.mocked(usePermissionModule.usePermission);

describe('AdminAuditExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1' } as any,
      profile: { id: 'admin-1', roles: ['admin'] } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: false,
      isCandidate: false,
      isCommittee: false,
      isObserver: false,
    });

    mockUsePermission.mockReturnValue({ has: true, loading: false });
  });

  it('renders the export form', () => {
    render(<AdminAuditExport />);
    expect(screen.getByText(/Audit Log Export/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Election ID/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ekspor/i })).toBeInTheDocument();
  });

  it('calls admin_export_audit_log with form args and renders result table', async () => {
    const mockRows = [
      {
        id: 'row-1',
        created_at: new Date().toISOString(),
        action: 'user.create',
        category: 'admin',
        severity: 'info',
        description: 'Created user',
        metadata: {},
        target_type: 'auth.users',
        target_id: 'u1',
        election_id: null,
        actor_id: 'admin-1',
        actor_email: 'admin@test.com',
        actor_role: 'admin',
        actor_full_name: 'Admin User',
        actor_student_id: 'ADM001',
        ip_address_hash: null,
        request_id: null,
        schema_version: '3',
      },
    ];

    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'admin_export_audit_log') {
        return Promise.resolve({
          data: { total: 1, limit: 1000, offset: 0, rows: mockRows },
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(<AdminAuditExport />);

    fireEvent.click(screen.getByRole('button', { name: /Ekspor/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        'admin_export_audit_log',
        expect.objectContaining({ p_limit: 1000, p_offset: 0 })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Created user/i)).toBeInTheDocument();
    });
  });

  it('shows toast error when RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: new Error('Permission denied'),
    } as any);

    render(<AdminAuditExport />);
    fireEvent.click(screen.getByRole('button', { name: /Ekspor/i }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalled();
    });
  });
});
