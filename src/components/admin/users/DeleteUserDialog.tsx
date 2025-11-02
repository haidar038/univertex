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
import { AlertTriangle, Vote, UserX } from 'lucide-react';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string | null;
  onSuccess?: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: DeleteUserDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    votesCount: 0,
    candidaciesCount: 0,
  });
  const [loading, setLoading] = useState(false);

  // Fetch user statistics
  useEffect(() => {
    if (open && userId) {
      fetchUserStats();
    }
  }, [open, userId]);

  const fetchUserStats = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [votesResult, candidaciesResult] = await Promise.all([
        supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('voter_id', userId),
        supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

      setStats({
        votesCount: votesResult.count || 0,
        candidaciesCount: candidaciesResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userId) return;

    setIsDeleting(true);
    try {
      // Delete from profiles (will cascade to user_roles, votes, candidates)
      const { error } = await supabase.from('profiles').delete().eq('id', userId);

      if (error) throw error;

      // Note: Auth user deletion requires service role key
      // For now, we only delete from profiles table
      // To fully delete auth user, use Supabase Admin API

      toast.success('Pengguna berhasil dihapus dari sistem!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Gagal menghapus pengguna');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasData = stats.votesCount > 0 || stats.candidaciesCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Hapus Pengguna?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Anda akan menghapus pengguna <strong>{userName}</strong>. Tindakan ini tidak dapat
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
                  <strong>Peringatan!</strong> Menghapus pengguna ini akan menghapus semua data
                  terkait:
                </AlertDescription>
              </Alert>

              <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                {stats.votesCount > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <Vote className="h-4 w-4 text-destructive" />
                    <span>
                      <strong>{stats.votesCount}</strong> suara yang telah diberikan
                    </span>
                  </div>
                )}
                {stats.candidaciesCount > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <UserX className="h-4 w-4 text-destructive" />
                    <span>
                      <strong>{stats.candidaciesCount}</strong> pencalonan di berbagai acara
                    </span>
                  </div>
                )}
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Catatan:</strong> Akun autentikasi akan tetap ada di sistem. Untuk
                  menghapus sepenuhnya, hubungi administrator sistem.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <Alert>
              <AlertDescription className="text-sm">
                Pengguna ini belum memiliki aktivitas di sistem. Aman untuk dihapus.
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
            {isDeleting ? 'Menghapus...' : 'Hapus Pengguna'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
