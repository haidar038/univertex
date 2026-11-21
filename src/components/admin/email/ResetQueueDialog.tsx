import {
  AlertDialog,  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ResetQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingCount: number;
  busy: boolean;
  onConfirm: () => void;
}

export function ResetQueueDialog({
  open,
  onOpenChange,
  pendingCount,
  busy,
  onConfirm,
}: ResetQueueDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset Antrean?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingCount} email pending event ini akan dihapus dari antrean.
            Error pengiriman akan diunduh sebagai CSV sebelum dihapus.
            Yang sudah terkirim/gagal dipertahankan. Isi ulang dari DPT sesudahnya bila perlu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            className="bg-destructive hover:bg-destructive/90"
          >
            {busy ? 'Mereset...' : `Hapus ${pendingCount} Antrean`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
