import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RequirePermission } from '../RequirePermission';
import * as usePermissionModule from '@/hooks/usePermission';
import * as useAuthModule from '@/hooks/useAuth';

const mockUseNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockUseNavigate,
}));

describe('RequirePermission component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'user-1', roles: ['admin'] } as any,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: false,
      isCandidate: false,
      isCommittee: false,
      isObserver: false,
    });
  });

  it('renders children when permission is granted', async () => {
    vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue({
      has: true,
      loading: false,
    });

    render(
      <RequirePermission permission="user.create">
        <div>Allowed Content</div>
      </RequirePermission>
    );

    expect(screen.getByText('Allowed Content')).toBeInTheDocument();
  });

  it('renders default denied card when permission is denied', async () => {
    vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue({
      has: false,
      loading: false,
    });

    render(
      <RequirePermission permission="user.create">
        <div>Allowed Content</div>
      </RequirePermission>
    );

    await waitFor(() => {
      expect(screen.getByText(/Akses Ditolak/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Allowed Content')).not.toBeInTheDocument();
    expect(screen.getByText('user.create')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', async () => {
    vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue({
      has: false,
      loading: false,
    });

    render(
      <RequirePermission permission="audit.export" fallback={<div>Custom Denied</div>}>
        <div>Allowed Content</div>
      </RequirePermission>
    );

    expect(screen.getByText('Custom Denied')).toBeInTheDocument();
    expect(screen.queryByText('Allowed Content')).not.toBeInTheDocument();
  });

  it('renders loading spinner while loading', () => {
    vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue({
      has: false,
      loading: true,
    });

    render(
      <RequirePermission permission="user.create">
        <div>Allowed Content</div>
      </RequirePermission>
    );

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Allowed Content')).not.toBeInTheDocument();
  });
});
