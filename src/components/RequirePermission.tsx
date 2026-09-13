import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermission, PermissionKey } from '@/hooks/usePermission';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}

function DefaultDenied({ permission }: { permission: PermissionKey }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Akses Ditolak</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anda tidak memiliki izin <code className="rounded bg-muted px-1 py-0.5 text-xs">{permission}</code> untuk mengakses halaman ini.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequirePermission({ permission, children, fallback }: Props) {
  const { has, loading } = usePermission(permission);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!has) {
    return <>{fallback ?? <DefaultDenied permission={permission} />}</>;
  }

  return <>{children}</>;
}
