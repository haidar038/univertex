import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { revokeSession, UserSessionRow, listMySessions } from '@/lib/sessions';
import { buildDeviceFingerprint } from '@/lib/device';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Monitor, Smartphone, Tablet, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { logAudit } from '@/lib/audit';

const detectDeviceIcon = (label: string | null) => {
  if (!label) return Monitor;
  if (label.includes('Mobile')) return Smartphone;
  if (label.includes('Tablet')) return Tablet;
  return Monitor;
};

export default function AdminSessions() {
  const [rows, setRows] = useState<UserSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentHash, setCurrentHash] = useState<string>('');

  useEffect(() => {
    refresh();
    buildDeviceFingerprint().then((fp) => setCurrentHash(fp.hash));
  }, []);

  const refresh = async () => {
    setLoading(true);
    const data = await listMySessions();
    setRows(data);
    setLoading(false);
  };

  const handleRevoke = async (row: UserSessionRow) => {
    const ok = await revokeSession(row.id, 'admin_revoke');
    if (ok) {
      toast.success(`Sesi ${row.device_label || row.id.slice(0, 6)} berhasil dicabut.`);
      await logAudit({
        action: 'session.revoke',
        description: `Admin revoked session ${row.id}`,
        category: 'security',
        targetType: 'user_sessions',
        targetId: row.id,
        metadata: { user_id: row.user_id, device_label: row.device_label },
        severity: 'warning',
      });
      refresh();
    } else {
      toast.error('Gagal mencabut sesi.');
    }
  };

  const active = rows.filter((r) => !r.revoked_at);
  const revoked = rows.filter((r) => !!r.revoked_at);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="mb-2 text-2xl md:text-3xl font-bold text-foreground">Manajemen Sesi</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Pantau dan kelola sesi aktif (device) untuk semua pengguna. Mendukung deteksi multi-device.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {active.length > 1 && (
        <Alert className="mb-6 border-yellow-500/40 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertDescription className="text-yellow-900">
            Saat ini ada <strong>{active.length}</strong> sesi aktif di sistem. Pastikan hanya
            perangkat yang dikenal yang sedang login. Cabut sesi yang mencurigakan.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            Sesi Aktif ({active.length})
          </CardTitle>
          <CardDescription>
            Hanya admin yang bisa melihat semua sesi. Aksi pencabutan akan langsung berlaku.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Memuat...</div>
          ) : active.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Tidak ada sesi aktif.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {active.map((s) => {
                const Icon = detectDeviceIcon(s.device_label);
                const isCurrent = s.refresh_token_hash === currentHash;
                return (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">
                            {s.device_label || 'Perangkat tidak dikenal'}
                          </p>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-xs">
                              Sesi ini
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Login: {format(new Date(s.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                          {' • '}
                          Terakhir aktif: {format(new Date(s.last_seen_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                        </p>
                        {s.ip_address && (
                          <p className="text-xs text-muted-foreground mt-1">IP: {s.ip_address}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          User ID: <code className="font-mono">{s.user_id.slice(0, 8)}...</code>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(s)}
                      disabled={isCurrent}
                      title={isCurrent ? 'Tidak dapat mencabut sesi sendiri dari panel ini' : 'Cabut sesi'}
                    >
                      Cabut
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {revoked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Sesi Dicabut ({revoked.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {revoked.slice(0, 20).map((s) => {
                const Icon = detectDeviceIcon(s.device_label);
                return (
                  <div key={s.id} className="p-4 flex items-center gap-3 opacity-60">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{s.device_label || 'Perangkat'}</p>
                      <p className="text-xs text-muted-foreground">
                        Dicabut {s.revoked_at && format(new Date(s.revoked_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                        {s.revoked_reason && ` (${s.revoked_reason})`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
