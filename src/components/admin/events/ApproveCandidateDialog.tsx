import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { getCandidatePhotoUrl, getCandidateStatusInfo } from '@/lib/candidate-helpers';
import { CheckCircle2, XCircle, User } from 'lucide-react';

interface Candidate {
  id: string;
  vision: string | null;
  mission: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  profiles?: {
    full_name: string;
    student_id: string;
  };
}

interface ApproveCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  onSuccess?: () => void;
}

export function ApproveCandidateDialog({
  open,
  onOpenChange,
  candidate,
  onSuccess,
}: ApproveCandidateDialogProps) {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const handleApprove = async () => {
    if (!candidate || !profile) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: profile.id,
          rejection_reason: null,
          admin_notes: adminNotes.trim() || null,
        })
        .eq('id', candidate.id);

      if (error) throw error;

      toast.success('Kandidat berhasil disetujui!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error approving candidate:', error);
      toast.error('Gagal menyetujui kandidat');
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!candidate || !profile) return;

    if (!rejectionReason.trim()) {
      toast.error('Alasan penolakan harus diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          admin_notes: adminNotes.trim() || null,
          approved_at: null,
          approved_by: null,
        })
        .eq('id', candidate.id);

      if (error) throw error;

      toast.success('Kandidat ditolak');
      setRejectionReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error rejecting candidate:', error);
      toast.error('Gagal menolak kandidat');
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  const handleCancel = () => {
    setAction(null);
    setRejectionReason('');
    setAdminNotes('');
    onOpenChange(false);
  };

  if (!candidate) return null;

  const photoUrl = getCandidatePhotoUrl(candidate.photo_storage_path, candidate.photo_url);
  const statusInfo = getCandidateStatusInfo(candidate.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Persetujuan Kandidat</DialogTitle>
          <DialogDescription>
            Tinjau profil kandidat dan tentukan apakah akan menyetujui atau menolak
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status Saat Ini</p>
            </div>
            <Badge variant={statusInfo.variant as any}>
              {statusInfo.label}
            </Badge>
          </div>

          {/* Candidate Info */}
          <div className="rounded-lg border p-4">
            <div className="flex gap-4">
              {/* Photo */}
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20">
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto kandidat" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-muted-foreground" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {candidate.profiles?.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {candidate.profiles?.student_id}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">VISI</p>
                  <p className="text-sm">{candidate.vision || 'Belum diisi'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">MISI</p>
                  <p className="text-sm">{candidate.mission || 'Belum diisi'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Notes (always show) */}
          <div className="space-y-2">
            <Label htmlFor="admin-notes">
              Catatan Admin (Opsional)
            </Label>
            <Textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Catatan verifikasi, observasi, atau informasi tambahan..."
              rows={2}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Catatan ini hanya untuk internal admin dan tidak terlihat oleh kandidat
            </p>
          </div>

          {/* Rejection Reason Input (only show when rejecting) */}
          {action === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Alasan Penolakan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Jelaskan alasan penolakan kandidat..."
                rows={3}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Alasan ini akan terlihat oleh kandidat
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {!action ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setAction('reject')}
                disabled={isSubmitting || candidate.status === 'rejected'}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Tolak
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting || candidate.status === 'approved'}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Setujui
              </Button>
            </>
          ) : action === 'reject' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAction(null)}
                disabled={isSubmitting}
              >
                Kembali
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Menolak...' : 'Konfirmasi Penolakan'}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
