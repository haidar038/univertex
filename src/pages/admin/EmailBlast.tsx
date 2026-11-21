import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ResetQueueDialog } from '@/components/admin/email/ResetQueueDialog';
import { RequirePermission } from '@/components/RequirePermission';
import { toast } from 'sonner';
import { MailPlus, Send, Download, RefreshCw } from 'lucide-react';

interface Stats {
  pending: number;
  sent: number;
  bounced: number;
  failed: number;
}

export default function AdminEmailBlast() {
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([]);
  const [eventId, setEventId] = useState('');
  const [stats, setStats] = useState<Stats>({ pending: 0, sent: 0, bounced: 0, failed: 0 });
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  // Ukuran batch kirim (label tombol selalu = yang benar-benar dikirim).
  const [batchSize, setBatchSize] = useState(40);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const toSend = Math.min(stats.pending, batchSize);

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    supabase
      .from('election_events')
      .select('id, title')
      .order('created_at', { ascending: false })
      .then(({ data }) => setEvents((data as Array<{ id: string; title: string }>) || []));
  }, []);

  const refreshStats = async () => {
    if (!eventId) return;
    const statuses: (keyof Stats)[] = ['pending', 'sent', 'bounced', 'failed'];
    const next: Stats = { pending: 0, sent: 0, bounced: 0, failed: 0 };
    for (const s of statuses) {
      const { count } = await supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', s);
      next[s] = count || 0;
    }
    setStats(next);
  };

  useEffect(() => {
    setStats({ pending: 0, sent: 0, bounced: 0, failed: 0 });
    setLastResult(null);
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const handleEnqueue = async () => {
    if (!eventId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_enqueue_event_voters', {
        p_event_id: eventId,
      });
      if (error) throw error;
      toast.success(`${data ?? 0} voter masuk antrean`);
      refreshStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengisi antrean');
    } finally {
      setBusy(false);
    }
  };

  const handleSendBatch = async () => {
    if (!eventId) return;
    // Sesi JWT 1 jam: tanpa sesi, invoke pasti 401 — cegah duluan.
    // Catatan supabase-js: functions.invoke TIDAK menyuntik token sesi
    // otomatis (header-nya statik = anon key) -> kirim eksplisit, kalau tidak
    // server selalu baca anon key sebagai "token tak valid" (401 bad_token).
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Sesi habis — logout lalu login ulang sebelum kirim.');
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-voter-credentials', {
        body: { event_id: eventId, batch: batchSize },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      // Tampilkan pesan server apa adanya (no_token/bad_token/not_admin/secrets).
      if (error) throw new Error(error.message || 'Gagal mengirim batch');
      const r = data as {
        sent: number;
        failed: number;
        errors?: Array<{ email: string; error: string }>;
      };
      // Tampilkan alasan kegagalan (mis. Resend 403 domain belum verified),
      // jangan cuma hitungan — error hilang saat antrean di-reset.
      const detail = r.errors?.[0]?.error;
      setLastResult(
        `Terkirim ${r.sent}, gagal ${r.failed} (batch ${batchSize})` +
          (detail ? `\n${detail}` : '')
      );
      if (r.failed > 0) toast.error(`${r.failed} email gagal — lihat detail di bawah`);
      else toast.success('Batch selesai — lihat statistik');
      refreshStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengirim batch');
    } finally {
      setBusy(false);
    }
  };

  const handleResetQueue = async () => {
    if (!eventId) return;
    setBusy(true);
    try {
      // Baris gagal tetap 'pending' (attempts < 3), jadi error-nya ikut terhapus
      // kalau reset langsung. Unduh dulu sebelum DELETE.
      const { data: errors, error: readErr } = await supabase
        .from('email_queue')
        .select('email, full_name, attempts, error')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .not('error', 'is', null);
      if (readErr) throw readErr;
      const withError = (errors || []).filter(
        (r: { error: string | null }) => !!r.error
      ) as Array<{ email: string; full_name: string | null; attempts: number; error: string }>;
      if (withError.length) {
        const rows = withError.map(
          (r) =>
            `${r.full_name || ''},${r.email},${r.attempts},"${r.error.replace(/"/g, '""')}"`
        );
        downloadCsv(
          'error-antrean-blast.csv',
          `full_name,email,attempts,error\n${rows.join('\n')}`
        );
      }

      const { error } = await supabase
        .from('email_queue')
        .delete()
        .eq('event_id', eventId)
        .eq('status', 'pending');
      if (error) throw error;
      toast.success(
        withError.length
          ? `${withError.length} error diunduh — antrean pending dikosongkan`
          : 'Antrean pending dikosongkan — siap isi ulang'
      );
      refreshStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal mereset antrean');
    } finally {
      setBusy(false);
      setResetDialogOpen(false);
    }
  };

  const handleExportFailed = async () => {
    if (!eventId) return;
    const { data, error } = await supabase
      .from('email_queue')
      .select('email, full_name, attempts, error')
      .eq('event_id', eventId)
      .in('status', ['bounced', 'failed'])
      .order('email');
    if (error) {
      toast.error('Gagal mengekspor');
      return;
    }
    const rows = (data || []).map(
      (r: { email: string; full_name: string | null }) => `${r.full_name || ''},${r.email}`
    );
    downloadCsv('gagal-kirim-slip.csv', `full_name,email\n${rows.join('\n')}`);
    toast.success(`${rows.length} alamat gagal diekspor — cetak sebagai slip fisik`);
  };

  return (
    <RequirePermission permission="user.edit">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Blast Kredensial Email</h1>
          <p className="text-muted-foreground">
            Kirim PIN login per batch. Setiap kirim MENGGANTI password dengan PIN baru
            via email — password/SLIP lama kohort ini otomatis tidak berlaku. Gagal kirim → ekspor CSV → cetak slip fisik (fallback).
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pilih Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Event</Label>
              <Select value={eventId || 'none'} onValueChange={(v) => setEventId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih event..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih event...</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventId && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Antre: {stats.pending}</Badge>
                  <Badge variant="secondary">Terkirim: {stats.sent}</Badge>
                  <Badge variant="destructive">Gagal: {stats.failed}</Badge>
                  <Badge variant="outline">Bounce: {stats.bounced}</Badge>
                </div>
                {lastResult && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{lastResult}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="batch-size">Batch</Label>
                  <Select value={String(batchSize)} onValueChange={(v) => setBatchSize(Number(v))}>
                    <SelectTrigger id="batch-size" className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="40">40</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleEnqueue} disabled={busy}>
                    <MailPlus className="h-4 w-4" />
                    Isi Antrean dari DPT
                  </Button>
                  <Button className="gap-2" onClick={handleSendBatch} disabled={busy || toSend === 0}>
                    <Send className="h-4 w-4" />
                    {busy ? 'Memproses...' : `Kirim ${toSend} Email`}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={refreshStats} disabled={busy}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setResetDialogOpen(true)} disabled={busy || stats.pending === 0}>
                    Reset Antrean
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleExportFailed}
                    disabled={stats.failed + stats.bounced === 0}
                  >
                    <Download className="h-4 w-4" />
                    Export Gagal → Slip
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <ResetQueueDialog
          open={resetDialogOpen}
          onOpenChange={setResetDialogOpen}
          pendingCount={stats.pending}
          busy={busy}
          onConfirm={handleResetQueue}
        />
      </div>
    </RequirePermission>
  );
}
