import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermission, PermissionKey } from '@/hooks/usePermission';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Role = 'admin' | 'voter' | 'candidate' | 'committee' | 'observer';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: Role;
  permission?: PermissionKey;
}

function DeniedCard({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Akses Ditolak</h2>
            <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else window.location.href = '/';
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProtectedRoute({ children, requireRole, permission }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const permCheck = usePermission(permission);

  if (loading || (!!permission && permCheck.loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !permCheck.has) {
    return <DeniedCard reason={`Anda tidak memiliki izin ${permission} untuk mengakses halaman ini.`} />;
  }

  if (requireRole && !profile?.roles.includes(requireRole)) {
    // Send each role to its own dashboard.
    if (profile?.roles.includes('admin')) return <Navigate to="/admin/dashboard" replace />;
    if (profile?.roles.includes('committee')) return <Navigate to="/committee" replace />;
    if (profile?.roles.includes('observer')) return <Navigate to="/observer" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
