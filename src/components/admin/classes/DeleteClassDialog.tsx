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
import { AlertTriangle, Users, Calendar } from 'lucide-react';

interface DeleteClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string | null;
  onSuccess?: () => void;
}

export function DeleteClassDialog({
  open,
  onOpenChange,
  classId,
  className,
  onSuccess,
}: DeleteClassDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    studentsCount: 0,
    eventsCount: 0,
  });
  const [loading, setLoading] = useState(false);

  // Fetch class statistics
  useEffect(() => {
    if (open && classId) {
      fetchClassStats();
    }
  }, [open, classId]);

  const fetchClassStats = async () => {
    if (!classId) return;

    setLoading(true);
    try {
      const [studentsResult, eventsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classId),
        supabase
          .from('event_voter_groups')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classId),
      ]);

      setStats({
        studentsCount: studentsResult.count || 0,
        eventsCount: eventsResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching class stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!classId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId);

      if (error) throw error;

      toast.success('Kelas berhasil dihapus!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error deleting class:', error);
      toast.error(error.message || 'Gagal menghapus kelas');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasData = stats.studentsCount > 0 || stats.eventsCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Hapus Kelas?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Anda akan menghapus kelas <strong>{className}</strong>. Tindakan ini tidak dapat
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
                  <strong>Peringatan!</strong> Kelas ini masih digunakan:
                </AlertDescription>
              </Alert>

              <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                {stats.studentsCount > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="h-4 w-4 text-destructive" />
                    <span>
                      <strong>{stats.studentsCount}</strong> siswa akan kehilangan kelasnya
                      (class_id = null)
                    </span>
                  </div>
                )}
                {stats.eventsCount > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-destructive" />
                    <span>
                      <strong>{stats.eventsCount}</strong> acara menggunakan kelas ini sebagai DPT
                    </span>
                  </div>
                )}
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Dampak:</strong> Siswa dari kelas ini akan tetap ada tetapi tidak
                  tergabung di kelas manapun. Assignments di acara pemilihan akan dihapus.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <Alert>
              <AlertDescription className="text-sm">
                Kelas ini tidak memiliki siswa dan tidak digunakan di acara manapun. Aman untuk
                dihapus.
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
            {isDeleting ? 'Menghapus...' : 'Hapus Kelas'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
