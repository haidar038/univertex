import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../ProtectedRoute';
import * as useAuthModule from '@/hooks/useAuth';

// Mock Navigate component
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to);
    return <div data-testid="navigate">{to}</div>;
  },
}));

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading spinner when loading', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      signOut: vi.fn(),
      isAdmin: false,
      isVoter: false,
      isCandidate: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Check for loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
      isAdmin: false,
      isVoter: false,
      isCandidate: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should render children when user is authenticated and no role required', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'user-123', email: 'test@test.com' } as any,
      profile: {
        id: 'user-123',
        full_name: 'Test User',
        student_id: 'STU001',
        department: 'CS',
        class_id: 'class-123',
        roles: ['voter'],
      },
      loading: false,
      signOut: vi.fn(),
      isAdmin: false,
      isVoter: true,
      isCandidate: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render children when user has required admin role', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-123', email: 'admin@test.com' } as any,
      profile: {
        id: 'admin-123',
        full_name: 'Admin User',
        student_id: 'ADM001',
        department: 'CS',
        class_id: 'class-123',
        roles: ['admin', 'voter'],
      },
      loading: false,
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: true,
      isCandidate: false,
    });

    render(
      <ProtectedRoute requireRole="admin">
        <div>Admin Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('should redirect to admin dashboard when user is admin but role not matched', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-123', email: 'admin@test.com' } as any,
      profile: {
        id: 'admin-123',
        full_name: 'Admin User',
        student_id: 'ADM001',
        department: 'CS',
        class_id: 'class-123',
        roles: ['admin'],
      },
      loading: false,
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: false,
      isCandidate: false,
    });

    render(
      <ProtectedRoute requireRole="voter">
        <div>Voter Content</div>
      </ProtectedRoute>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('should redirect to app dashboard when user is voter but role not matched', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'voter-123', email: 'voter@test.com' } as any,
      profile: {
        id: 'voter-123',
        full_name: 'Voter User',
        student_id: 'VOT001',
        department: 'CS',
        class_id: 'class-123',
        roles: ['voter'],
      },
      loading: false,
      signOut: vi.fn(),
      isAdmin: false,
      isVoter: true,
      isCandidate: false,
    });

    render(
      <ProtectedRoute requireRole="admin">
        <div>Admin Content</div>
      </ProtectedRoute>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard');
  });

  it('should render children when user has required candidate role', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'candidate-123', email: 'candidate@test.com' } as any,
      profile: {
        id: 'candidate-123',
        full_name: 'Candidate User',
        student_id: 'CAN001',
        department: 'CS',
        class_id: 'class-123',
        roles: ['voter', 'candidate'],
      },
      loading: false,
      signOut: vi.fn(),
      isAdmin: false,
      isVoter: true,
      isCandidate: true,
    });

    render(
      <ProtectedRoute requireRole="candidate">
        <div>Candidate Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Candidate Content')).toBeInTheDocument();
  });

  it('should handle user with multiple roles correctly', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'multi-123', email: 'multi@test.com' } as any,
      profile: {
        id: 'multi-123',
        full_name: 'Multi Role User',
        student_id: 'MUL001',
        department: 'CS',
        class_id: 'class-123',
        roles: ['admin', 'voter', 'candidate'],
      },
      loading: false,
      signOut: vi.fn(),
      isAdmin: true,
      isVoter: true,
      isCandidate: true,
    });

    // Should render admin content when required
    const { rerender } = render(
      <ProtectedRoute requireRole="admin">
        <div>Admin Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();

    // Should render voter content when required
    rerender(
      <ProtectedRoute requireRole="voter">
        <div>Voter Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Voter Content')).toBeInTheDocument();

    // Should render candidate content when required
    rerender(
      <ProtectedRoute requireRole="candidate">
        <div>Candidate Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Candidate Content')).toBeInTheDocument();
  });
});
