import { useState } from 'react';
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
import { AlertTriangle } from 'lucide-react';
import { logAudit } from '@/lib/audit';

interface BulkDeleteUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIds: string[];
  onSuccess?: () => void;
}

interface BulkDeleteResult {
  deleted: string[];
  skipped_admin: string[];
  skipped_has_data: Array<{ id: string; votes: number; candidacies: number }>;
}

export function BulkDeleteUsersDialog({
  open,
  onOpenChange,
  userIds,
  onSuccess,
}: BulkDeleteUsersDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<BulkDeleteResult | null>(null);

  const handleDelete = async () => {
    if (userIds.length === 0) return;
    setIsDeleting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('admin_bulk_delete_users', {
        p_user_ids: userIds,
      });
      if (error) throw error;

      const res = data as unknown as BulkDeleteResult;
      setResult(res);

      await logAudit({
        action: 'user.bulk_delete_ui',
        description: `Bulk delete ${res.deleted.length} users via Users page`,
        category: 'admin',
        targetType: 'auth.users',
        severity: 'warning',
        metadata: {
          deleted: res.deleted.length,
          skipped_admin: res.skipped_admin.length,
          skipped_has_data: res.skipped_has_data.length,
        },
      });

      if (res.deleted.length > 0) {
        toast.success(`${res.deleted.length} pengguna berhasil dihapus`);
      }
      if (res.skipped_admin.length > 0 || res.skipped_has_data.length > 0) {
        toast.warning(
          `${res.skipped_admin.length + res.skipped_has_data.length} dilewati (admin / punya data pemilu)`
        );
      }
      onSuccess?.();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus pengguna');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Hapus {userIds.length} Pengguna?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini tidak dapat dibatalkan. Admin dan pengguna yang memiliki suara/kandidatur
            otomatis dilewati.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {result && (result.skipped_admin.length > 0 || result.skipped_has_data.length > 0) && (
          <Alert>
            <AlertDescription className="text-sm">
              {result.skipped_admin.length > 0 && (
                <p>{result.skipped_admin.length} admin dilewati.</p>
              )}
              {result.skipped_has_data.length > 0 && (
                <p>
                  {result.skipped_has_data.length} punya data pemilu dan tidak dihapus
                  (hapus manual case-by-case bila memang perlu).
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || userIds.length === 0}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? 'Menghapus...' : `Hapus ${userIds.length} Pengguna`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
