import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RequirePermission } from '@/components/RequirePermission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, FileDown, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  category: string;
  severity: string;
  description: string;
  metadata: Record<string, unknown>;
  target_type: string | null;
  target_id: string | null;
  election_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  actor_full_name: string | null;
  actor_student_id: string | null;
  ip_address_hash: string | null;
  request_id: string | null;
  schema_version: string | null;
}

interface ExportEnvelope {
  total: number;
  limit: number;
  offset: number;
  rows: AuditRow[];
}

export default function AdminAuditExport() {
  const [electionId, setElectionId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportEnvelope | null>(null);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const args: Record<string, unknown> = {
        p_limit: 1000,
        p_offset: 0,
      };
      if (electionId.trim()) args.p_election_id = electionId.trim();
      if (fromDate) args.p_from_date = new Date(fromDate).toISOString();
      if (toDate) args.p_to_date = new Date(toDate).toISOString();

      const { data, error } = await supabase.rpc('admin_export_audit_log', args);
      if (error) throw error;
      setResult(data as unknown as ExportEnvelope);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengekspor audit log';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!result || result.rows.length === 0) return;
    const headers = [
      'id','created_at','action','category','severity','description',
      'target_type','target_id','election_id','actor_id','actor_email',
      'actor_role','actor_full_name','actor_student_id','ip_address_hash',
      'request_id','schema_version',
    ];
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const csv = [
      headers.join(','),
      ...result.rows.map(r => headers.map(h => escape((r as Record<string, unknown>)[h])).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <RequirePermission permission="audit.export">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold text-foreground">
            <ScrollText className="h-7 w-7" />
            Audit Log Export
          </h1>
          <p className="text-muted-foreground">
            Ekspor jejak audit untuk compliance, forensik, atau retensi. Maksimum 5000 baris per panggilan.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Export</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleExport} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="election_id">Election ID (opsional)</Label>
                <Input
                  id="election_id"
                  type="text"
                  placeholder="UUID pemilihan"
                  value={electionId}
                  onChange={(e) => setElectionId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_date">Dari tanggal (opsional)</Label>
                <Input
                  id="from_date"
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to_date">Sampai tanggal (opsional)</Label>
                <Input
                  id="to_date"
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-3 flex gap-2">
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Ekspor
                </Button>
                {result && (
                  <>
                    <Button type="button" variant="outline" onClick={handleDownload} className="gap-2">
                      <FileDown className="h-4 w-4" />
                      Unduh JSON
                    </Button>
                    <Button type="button" variant="outline" onClick={handleDownloadCsv} className="gap-2">
                      <FileDown className="h-4 w-4" />
                      Unduh CSV
                    </Button>
                  </>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>
                Hasil ({result.total.toLocaleString('id-ID')} baris — menampilkan {result.rows.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.rows.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Tidak ada data untuk filter ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Tanggal</th>
                        <th className="p-2 text-left">Aksi</th>
                        <th className="p-2 text-left">Kategori</th>
                        <th className="p-2 text-left">Severity</th>
                        <th className="p-2 text-left">Actor</th>
                        <th className="p-2 text-left">Deskripsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="p-2 font-mono text-xs">
                            {format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss')}
                          </td>
                          <td className="p-2 font-mono text-xs">{row.action}</td>
                          <td className="p-2 text-xs">{row.category}</td>
                          <td className="p-2 text-xs">{row.severity}</td>
                          <td className="p-2 text-xs">
                            {row.actor_full_name ?? row.actor_email ?? row.actor_id ?? '-'}
                          </td>
                          <td className="p-2 text-xs">{row.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </RequirePermission>
  );
}
