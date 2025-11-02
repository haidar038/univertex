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
import { AlertTriangle, Users, Vote, GraduationCap } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);

  // Fetch event statistics
  useEffect(() => {
    if (open && eventId) {
      fetchEventStats();
    }
  }, [open, eventId]);

  const fetchEventStats = async () => {
    if (!eventId) return;

    setLoading(true);
    try {
      const [candidatesResult, votesResult, voterGroupsResult] = await Promise.all([
        supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('event_voter_groups')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
      ]);

      setStats({
        candidatesCount: candidatesResult.count || 0,
        votesCount: votesResult.count || 0,
        voterGroupsCount: voterGroupsResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching event stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('election_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast.success('Acara berhasil dihapus!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || 'Gagal menghapus acara');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasData = stats.candidatesCount > 0 || stats.votesCount > 0 || stats.voterGroupsCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Hapus Acara Pemilihan?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Anda akan menghapus acara <strong>{eventTitle}</strong>. Tindakan ini tidak dapat
            dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">Memuat data...</div>
          ) : hasData ? (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Peringatan!</strong> Menghapus acara ini akan menghapus semua data
                  terkait:
                </AlertDescription>
              </Alert>

              <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Users className="h-4 w-4 text-destructive" />
                  <span>
                    <strong>{stats.candidatesCount}</strong> kandidat akan dihapus
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Vote className="h-4 w-4 text-destructive" />
                  <span>
                    <strong>{stats.votesCount}</strong> suara akan dihapus
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <GraduationCap className="h-4 w-4 text-destructive" />
                  <span>
                    <strong>{stats.voterGroupsCount}</strong> grup pemilih akan dihapus
                  </span>
                </div>
              </div>
            </>
          ) : (
            <Alert>
              <AlertDescription className="text-sm">
                Acara ini belum memiliki data. Aman untuk dihapus.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || loading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? 'Menghapus...' : 'Hapus Acara'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
