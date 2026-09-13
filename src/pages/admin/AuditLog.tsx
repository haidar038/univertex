import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { fetchAuditLog, AuditLogRow } from '@/lib/audit';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { FileText, Filter, RefreshCw, ShieldAlert, FileDown } from 'lucide-react';
import { RequirePermission } from '@/components/RequirePermission';

const CATEGORIES: Array<{ value: 'all' | 'admin' | 'auth' | 'election' | 'security'; label: string }> = [
  { value: 'all', label: 'Semua Kategori' },
  { value: 'admin', label: 'Admin' },
  { value: 'auth', label: 'Autentikasi' },
  { value: 'election', label: 'Pemilihan' },
  { value: 'security', label: 'Keamanan' },
];

const SEVERITIES: Array<{ value: 'all' | 'info' | 'warning' | 'critical'; label: string }> = [
  { value: 'all', label: 'Semua Tingkat' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Peringatan' },
  { value: 'critical', label: 'Kritis' },
];

const severityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'destructive' as const;
    case 'warning':
      return 'outline' as const;
    default:
      return 'secondary' as const;
  }
};

export default function AdminAuditLog() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'admin' | 'auth' | 'election' | 'security'>('all');
  const [severity, setSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const data = await fetchAuditLog({ limit: 200 });
    setRows(data);
    setLoading(false);
  };

  const filtered = rows.filter((r) => {
    if (category !== 'all' && r.category !== category) return false;
    if (severity !== 'all' && r.severity !== severity) return false;
    if (search) {
      const t = search.toLowerCase();
      return (
        r.description.toLowerCase().includes(t) ||
        (r.actor_email || '').toLowerCase().includes(t) ||
        r.action.toLowerCase().includes(t)
      );
    }
    return true;
  });

  return (
    <RequirePermission permission="audit.view">
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mb-6 md:mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-2xl md:text-3xl font-bold text-foreground">Audit Log</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Jejak aktivitas admin dan peristiwa keamanan sistem.
            </p>
          </div>
          <Link
            to="/admin/audit-export"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <FileDown className="h-4 w-4" />
            Audit Export
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="search">Cari</Label>
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Deskripsi, email, action..."
                />
              </div>
              <div className="space-y-1">
                <Label>Kategori</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tingkat</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={refresh} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {filtered.length} entri
            </CardTitle>
            <CardDescription>
              200 entri terbaru. Log bersifat append-only dan tidak dapat diubah.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Memuat...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ShieldAlert className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                Tidak ada entri yang cocok dengan kriteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium">Waktu</th>
                      <th className="p-3 text-left text-xs font-medium">Actor</th>
                      <th className="p-3 text-left text-xs font-medium">Action</th>
                      <th className="p-3 text-left text-xs font-medium">Kategori</th>
                      <th className="p-3 text-left text-xs font-medium">Severity</th>
                      <th className="p-3 text-left text-xs font-medium">Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 align-top">
                        <td className="p-3 text-xs whitespace-nowrap text-muted-foreground">
                          {format(new Date(r.created_at), 'dd MMM yyyy HH:mm:ss', { locale: idLocale })}
                        </td>
                        <td className="p-3 text-xs">
                          <div className="font-medium text-foreground">{r.actor_email || 'anonim'}</div>
                          <div className="text-muted-foreground">{r.actor_role || '-'}</div>
                        </td>
                        <td className="p-3 text-xs font-mono">{r.action}</td>
                        <td className="p-3 text-xs">
                          <Badge variant="outline">{r.category}</Badge>
                        </td>
                        <td className="p-3 text-xs">
                          <Badge variant={severityColor(r.severity)}>{r.severity}</Badge>
                        </td>
                        <td className="p-3 text-xs">
                          <div className="text-foreground">{r.description}</div>
                          {r.target_type && (
                            <div className="text-muted-foreground mt-1">
                              Target: <code className="font-mono">{r.target_type}:{r.target_id || '-'}</code>
                            </div>
                          )}
                          {r.ip_address && (
                            <div className="text-muted-foreground mt-1">IP: {r.ip_address}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
