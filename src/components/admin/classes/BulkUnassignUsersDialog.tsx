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
import { AlertTriangle } from 'lucide-react';
import { logAudit } from '@/lib/audit';

interface BulkUnassignUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string | null;
  userIds: string[];
  onSuccess?: () => void;
}

export function BulkUnassignUsersDialog({
  open,
  onOpenChange,
  classId,
  className,
  userIds,
  onSuccess,
}: BulkUnassignUsersDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnassign = async () => {
    if (!classId || userIds.length === 0) return;
    setIsSubmitting(true);
    try {
      // class_id dibataskan ke kelas asal: seleksi yang sudah berubah tidak ikut terhapus.
      const { count, error } = await supabase
        .from('profiles')
        .update({ class_id: null })
        .in('id', userIds)
        .eq('class_id', classId)
        .select('id', { count: 'exact', head: true });

      if (error) throw error;
      const unassigned = count ?? userIds.length;

      await logAudit({
        action: 'class.unassign_bulk',
        description: `Unassign ${unassigned} mahasiswa dari kelas ${className ?? classId}`,
        category: 'admin',
        targetType: 'classes',
        targetId: classId,
        severity: 'warning',
        metadata: { class_id: classId, class_name: className, unassigned, requested: userIds.length },
      });

      toast.success(`${unassigned} mahasiswa di-unassign dari kelas`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Gagal meng-unassign mahasiswa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Unassign {userIds.length} Mahasiswa?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Mahasiswa akan kehilangan kelas {className ?? 'ini'}. DPT event yang memakai kelas ini
            akan berubah. Assign kembali lewat tombol Assign Users bila diperlukan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnassign}
            disabled={isSubmitting || userIds.length === 0}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isSubmitting ? 'Meng-unassign...' : `Unassign ${userIds.length} Mahasiswa`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
