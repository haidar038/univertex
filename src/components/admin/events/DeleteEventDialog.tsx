import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Users, Vote, GraduationCap } from 'lucide-react';
import { logAudit } from '@/lib/audit';

interface DeleteEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  eventTitle: string | null;
  onSuccess?: () => void;
}

export function DeleteEventDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  onSuccess,
}: DeleteEventDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    candidatesCount: 0,
    votesCount: 0,
    voterGroupsCount: 0,
  });
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  // Konfirmasi ketik untuk hapus arsip (anti-klik-tidak-sengaja).
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && eventId) fetchEventStats();
  }, [open, eventId]);

  const fetchEventStats = async () => {
    if (!eventId) return;
    setLoading(true);
    setConfirmText('');
    try {
      const [c, v, g, ev] = await Promise.all([
        supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('votes').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_voter_groups').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('election_events').select('status').eq('id', eventId).maybeSingle(),
      ]);
      setStats({
        candidatesCount: c.count || 0,
        votesCount: v.count || 0,
        voterGroupsCount: g.count || 0,
      });
      setEventStatus((ev.data as { status?: string } | null)?.status ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const hasData =
    stats.candidatesCount > 0 || stats.votesCount > 0 || stats.voterGroupsCount > 0;
  const isArchived = eventStatus === 'archived';
  // Arsip + ada data -> hapus via RPC (transaksional). Selain itu yang
  // berdata diblokir; yang kosong pakai DELETE langsung seperti semula.
  const useRpcDelete = isArchived && hasData;
  const blocked =
    !isArchived &&
    (stats.votesCount > 0 ||
      stats.candidatesCount > 0 ||
      stats.voterGroupsCount > 0);

  const handleDelete = async () => {
    if (!eventId) return;
    // P-B: suara/data yang sudah masuk tidak boleh lenyap diam-diam.
    if (blocked) {
      toast.error(
        stats.votesCount > 0
          ? 'Acara dengan suara masuk tidak dapat dihapus. Arsipkan sebagai gantinya.'
          : 'Bersihkan kandidat & DPT dulu, atau arsipkan event sebelum menghapus.'
      );
      return;
    }
    if (useRpcDelete && confirmText.trim() !== (eventTitle || '').trim()) {
      toast.error('Ketik nama acara persis untuk konfirmasi.');
      return;
    }
    setIsDeleting(true);
    try {
      if (useRpcDelete) {
        const { error } = await supabase.rpc('admin_delete_event', {
          p_event_id: eventId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('election_events').delete().eq('id', eventId);
        if (error) throw error;
      }

      await logAudit({
        action: 'event.delete',
        description: `Deleted election event "${eventTitle}"${useRpcDelete ? ' (archived, via RPC)' : ''}`,
        category: 'election',
        targetType: 'election_events',
        targetId: eventId,
        severity: 'warning',
        metadata: { candidates: stats.candidatesCount, votes: stats.votesCount, voter_groups: stats.voterGroupsCount },
      });

      toast.success('Acara berhasil dihapus!');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus acara');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Hapus Acara Pemilihan?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Anda akan menghapus acara <strong>{eventTitle}</strong>. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">Memuat data...</div>
          ) : blocked ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {stats.votesCount > 0 ? (
                  <>
                    Acara ini sudah menerima <strong>{stats.votesCount}</strong> suara dan tidak dapat
                    dihapus. Ubah status menjadi <strong>diarsipkan</strong> bila pemilihan selesai.
                  </>
                ) : (
                  <>
                    Acara ini masih punya data (kandidat/DPT). Bersihkan dulu, atau arsipkan
                    event bila selesai — penghapusan total hanya untuk arsip.
                  </>
                )}
              </AlertDescription>
            </Alert>
          ) : hasData ? (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Peringatan!</strong> Menghapus acara ini akan menghapus semua data terkait:
                </AlertDescription>
              </Alert>

              <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-center gap-3 text-sm"><Users className="h-4 w-4 text-destructive" /><span><strong>{stats.candidatesCount}</strong> kandidat akan dihapus</span></div>
                <div className="flex items-center gap-3 text-sm"><Vote className="h-4 w-4 text-destructive" /><span><strong>{stats.votesCount}</strong> suara akan dihapus</span></div>
                <div className="flex items-center gap-3 text-sm"><GraduationCap className="h-4 w-4 text-destructive" /><span><strong>{stats.voterGroupsCount}</strong> grup pemilih akan dihapus</span></div>
              </div>

              {useRpcDelete && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-delete-title">
                    Ketik nama acara persis untuk konfirmasi: <strong>{eventTitle}</strong>
                  </Label>
                  <Input
                    id="confirm-delete-title"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={eventTitle || ''}
                    disabled={isDeleting}
                  />
                </div>
              )}
            </>
          ) : (
            <Alert>
              <AlertDescription className="text-sm">Acara ini belum memiliki data. Aman untuk dihapus.</AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={
              isDeleting ||
              loading ||
              blocked ||
              (useRpcDelete && confirmText.trim() !== (eventTitle || '').trim())
            }
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? 'Menghapus...' : 'Hapus Acara'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
