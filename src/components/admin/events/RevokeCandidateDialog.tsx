import { useEffect, useState } from 'react';
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
import { Ban, Trash2 } from 'lucide-react';
import { logAudit } from '@/lib/audit';

interface Candidate {
  id: string;
  event_id: string;
  status: 'pending' | 'approved' | 'rejected';
  profiles?: { full_name: string; student_id: string } | null;
}

interface RevokeCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  onSuccess?: () => void;
}

/**
 * Cabut (revoke) atau hapus kandidat.
 *
 * - Cabut = set status `rejected` + alasan. Suara yang sudah masuk TIDAK
 *   ikut terhapus (aman untuk event berjalan).
 * - Hapus permanen HANYA bila 0 suara (votes.candidate_id ON DELETE CASCADE
 *   akan melenyapkan suara diam-diam bila dipaksa).
 */
export function RevokeCandidateDialog({ open, onOpenChange, candidate, onSuccess }: RevokeCandidateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [voteCount, setVoteCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !candidate) {
      setReason('');
      setVoteCount(null);
      return;
    }
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidate.id)
      .then(({ count, error }) => {
        if (error) {
          console.error('[RevokeCandidateDialog] vote count:', error);
          setVoteCount(null);
        } else {
          setVoteCount(count ?? 0);
        }
      });
  }, [open, candidate]);

  if (!candidate) return null;
  const name = candidate.profiles?.full_name || candidate.id;
  const canDelete = voteCount === 0;

  const handleRevoke = async () => {
    if (!reason.trim()) {
      toast.error('Alasan pencabutan harus diisi');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('candidates').update({
        status: 'rejected',
        rejection_reason: reason.trim(),
        approved_at: null,
        approved_by: null,
      }).eq('id', candidate.id);
      if (error) throw error;

      await logAudit({
        action: 'candidate.revoke',
        description: `Revoked candidate ${name}: ${reason.trim()}`,
        category: 'election',
        targetType: 'candidates',
        targetId: candidate.id,
        severity: 'warning',
        metadata: { rejection_reason: reason.trim(), had_votes: voteCount ?? 'unknown' },
      }).catch(() => undefined);

      toast.success('Kandidat dicabut (status: ditolak). Suara yang sudah masuk tetap tercatat.');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      console.error(e);
      toast.error('Gagal mencabut kandidat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('candidates').delete().eq('id', candidate.id);
      if (error) throw error;

      await logAudit({
        action: 'candidate.delete',
        description: `Deleted candidate ${name} (0 votes)`,
        category: 'election',
        targetType: 'candidates',
        targetId: candidate.id,
        severity: 'warning',
        metadata: { event_id: candidate.event_id },
      }).catch(() => undefined);

      toast.success('Kandidat dihapus permanen');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      console.error(e);
      toast.error('Gagal menghapus kandidat (mungkin terikat pasangan/vote)');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle>Cabut / Hapus Kandidat</DialogTitle>
          <DialogDescription>
            {name} — pencabutan mengubah status jadi ditolak (suara lama tetap ada).
            Hapus permanen hanya untuk kandidat tanpa suara.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="revoke-reason">Alasan pencabutan <span className="text-destructive">*</span></Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan alasan pencabutan..."
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isSubmitting || !canDelete}
            title={canDelete ? 'Hapus permanen (0 suara)' : 'Tidak bisa dihapus: kandidat sudah punya suara — gunakan Cabut'}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Hapus{voteCount !== null && voteCount > 0 ? ` (${voteCount} suara)` : ''}
          </Button>
          <Button type="button" onClick={handleRevoke} disabled={isSubmitting} className="gap-2">
            <Ban className="h-4 w-4" />
            {isSubmitting ? 'Memproses...' : 'Cabut Kandidat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
