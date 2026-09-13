import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { revokeSession, revokeAllMySessions, UserSessionRow, listMySessions } from '@/lib/sessions';
import { buildDeviceFingerprint } from '@/lib/device';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Monitor, Smartphone, Tablet, ShieldCheck, AlertTriangle } from 'lucide-react';

const iconFor = (label: string | null) => {
  if (!label) return Monitor;
  if (label.includes('Mobile')) return Smartphone;
  if (label.includes('Tablet')) return Tablet;
  return Monitor;
};

export default function MySessionsPage() {
  const [rows, setRows] = useState<UserSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentHash, setCurrentHash] = useState('');
  const [revokingAll, setRevokingAll] = useState(false);

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
    const ok = await revokeSession(row.id, 'user_logout');
    if (ok) {
      toast.success('Sesi berhasil dicabut.');
      refresh();
    } else {
      toast.error('Gagal mencabut sesi.');
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      const n = await revokeAllMySessions();
      toast.success(n > 0 ? n + ' sesi lain dicabut.' : 'Tidak ada sesi lain.');
      refresh();
    } finally {
      setRevokingAll(false);
    }
  };

  const active = rows.filter((r) => !r.revoked_at);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-2xl md:text-3xl font-bold text-foreground">Perangkat Saya</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Pantau dan kelola sesi aktif dari akun Anda. Cabut sesi jika Anda melihat perangkat yang tidak dikenal.
        </p>
      </div>

      {active.length > 2 && (
        <Alert className="mb-6 border-yellow-500/40 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertDescription className="text-yellow-900">
            Anda login dari <strong>{active.length}</strong> perangkat. Jika Anda tidak mengenali salah satunya, segera cabut.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            Sesi Aktif ({active.length})
          </CardTitle>
          <CardDescription>
            Setiap baris mewakili satu perangkat atau browser yang sedang login ke akun Anda.
            {active.filter((r) => r.refresh_token_hash !== currentHash).length > 0 && (
              <span className="mt-3 block">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRevokeAll}
                  disabled={revokingAll}
                >
                  {revokingAll ? 'Mencabut...' : 'Keluar dari semua device lain'}
                </Button>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Memuat...</div>
          ) : active.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Tidak ada sesi aktif.</div>
          ) : (
            <div className="divide-y divide-border">
              {active.map((s) => {
                const Icon = iconFor(s.device_label);
                const isCurrent = s.refresh_token_hash === currentHash;
                return (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon className="h-8 w-8 text-muted-foreground shrink-0 mt-1" />
                      <div className="min-w-0">
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
                      </div>
                    </div>
                    <Button
                      variant={isCurrent ? 'outline' : 'destructive'}
                      size="sm"
                      onClick={() => handleRevoke(s)}
                      disabled={isCurrent}
                      title={isCurrent ? 'Gunakan tombol logout untuk keluar dari sesi ini' : 'Cabut sesi'}
                    >
                      {isCurrent ? 'Sesi Saat Ini' : 'Cabut'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
