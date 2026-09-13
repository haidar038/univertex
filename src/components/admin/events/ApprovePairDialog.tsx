import { useState } from 'react';
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
import { CheckCircle2, XCircle } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { getPairDisplayName, type PairWithMembers } from '@/lib/candidate-pair-helpers';

interface ApprovePairDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pair: PairWithMembers | null;
    onSuccess?: () => void;
}

/**
 * Admin dialog to approve or reject a candidate pair, mirroring
 * ApproveCandidateDialog. Rejection requires a reason.
 */
export function ApprovePairDialog({
    open,
    onOpenChange,
    pair,
    onSuccess,
}: ApprovePairDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleApprove = async () => {
        if (!pair) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('candidate_pairs')
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString(),
                    rejection_reason: null,
                })
                .eq('id', pair.id);

            if (error) throw error;

            await logAudit({
                action: 'candidate.pair.approve',
                description: `Approved candidate pair: ${getPairDisplayName(pair)}`,
                category: 'election',
                targetType: 'candidate_pairs',
                targetId: pair.id,
                metadata: { event_id: pair.event_id },
            });

            toast.success('Pasangan kandidat disetujui');
            setRejectionReason('');
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            console.error('Error approving pair:', error);
            toast.error(error.message || 'Gagal menyetujui pasangan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!pair) return;
        if (!rejectionReason.trim()) {
            toast.error('Alasan penolakan wajib diisi');
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('candidate_pairs')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason.trim(),
                })
                .eq('id', pair.id);

            if (error) throw error;

            await logAudit({
                action: 'candidate.pair.reject',
                description: `Rejected candidate pair: ${getPairDisplayName(pair)}`,
                category: 'election',
                targetType: 'candidate_pairs',
                targetId: pair.id,
                metadata: { event_id: pair.event_id, reason: rejectionReason.trim() },
                severity: 'warning',
            });

            toast.success('Pasangan kandidat ditolak');
            setRejectionReason('');
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            console.error('Error rejecting pair:', error);
            toast.error(error.message || 'Gagal menolak pasangan');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) setRejectionReason(''); onOpenChange(o); }}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Tinjau Pasangan Kandidat</DialogTitle>
                    <DialogDescription>
                        {pair ? getPairDisplayName(pair) : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="pair-rejection-reason">
                            Alasan Penolakan (jika menolak)
                        </Label>
                        <Textarea
                            id="pair-rejection-reason"
                            placeholder="Jelaskan alasan penolakan pasangan ini..."
                            rows={3}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={isSubmitting}
                        className="gap-2"
                    >
                        <XCircle className="h-4 w-4" />
                        Tolak
                    </Button>
                    <Button onClick={handleApprove} disabled={isSubmitting} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Setujui
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}