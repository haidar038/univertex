import { useEffect, useMemo, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  Archive,
  Calculator,
  FileText,
  Play,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  ALLOWED_TRANSITIONS,
  STATUS_LABEL,
  type ElectionStatus,
} from '@/lib/election-state';

interface EventStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  currentStatus: ElectionStatus | null;
  eventTitle?: string;
  onSuccess?: () => void;
}

export function EventStatusDialog({
  open,
  onOpenChange,
  eventId,
  currentStatus,
  eventTitle,
  onSuccess,
}: EventStatusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ElectionStatus | null>(null);
  const [validation, setValidation] = useState({
    hasCandidates: false,
    hasVoterGroups: false,
    loading: false,
  });

  const availableStatuses = useMemo(
    () => (currentStatus ? ALLOWED_TRANSITIONS[currentStatus] : []),
    [currentStatus],
  );

  useEffect(() => {
    setSelectedStatus(availableStatuses[0] ?? null);
  }, [currentStatus, open, availableStatuses]);

  useEffect(() => {
    if (open && eventId) void validateEvent();
  }, [open, eventId]);

  const validateEvent = async () => {
    if (!eventId) return;
    setValidation((previous) => ({ ...previous, loading: true }));
    try {
      const [candidates, groups] = await Promise.all([
        supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_voter_groups').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);
      setValidation({
        hasCandidates: (candidates.count || 0) > 0,
        hasVoterGroups: (groups.count || 0) > 0,
        loading: false,
      });
    } catch (error) {
      console.error(error);
      setValidation((previous) => ({ ...previous, loading: false }));
    }
  };

  const requiresVotingPrerequisites = selectedStatus === 'voting';
  const canStartVoting = validation.hasCandidates && validation.hasVoterGroups;

  const handleSubmit = async () => {
    if (!eventId || !selectedStatus) return;
    if (requiresVotingPrerequisites && !canStartVoting) {
      toast.error('Voting memerlukan kandidat dan grup pemilih (DPT).');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('admin_transition_election_state', {
        p_election_id: eventId,
        p_to_status: selectedStatus,
        p_reason: null,
      });
      if (error) throw error;

      toast.success(`Status acara${eventTitle ? ` "${eventTitle}"` : ''} diubah ke ${STATUS_LABEL[selectedStatus]}.`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconFor = (status: ElectionStatus) => {
    switch (status) {
      case 'draft': return <RotateCcw className="h-4 w-4" />;
      case 'registration': return <FileText className="h-4 w-4" />;
      case 'voting': return <Play className="h-4 w-4" />;
      case 'counting': return <Calculator className="h-4 w-4" />;
      case 'published': return <Send className="h-4 w-4" />;
      case 'archived': return <Archive className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Ubah Status Acara</DialogTitle>
          <DialogDescription>
            Transisi mengikuti state machine pemilihan dan dicatat pada audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {validation.loading ? (
            <div className="text-center text-sm text-muted-foreground">Memvalidasi acara...</div>
          ) : availableStatuses.length === 0 ? (
            <Alert>
              <AlertDescription>
                Tidak ada transisi berikutnya. Status saat ini sudah terminal atau belum tersedia.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {requiresVotingPrerequisites && !canStartVoting && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Voting belum dapat dibuka.</strong>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                      {!validation.hasCandidates && <li>Belum ada kandidat</li>}
                      {!validation.hasVoterGroups && <li>Belum ada grup pemilih (DPT)</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <RadioGroup
                value={selectedStatus ?? ''}
                onValueChange={(value) => setSelectedStatus(value as ElectionStatus)}
              >
                <div className="space-y-2">
                  {availableStatuses.map((status) => {
                    const disabled = status === 'voting' && !canStartVoting;
                    return (
                      <div key={status} className="flex items-center space-x-2 rounded-lg border border-border p-3 hover:bg-muted/50">
                        <RadioGroupItem value={status} id={`status-${status}`} disabled={disabled} />
                        <Label
                          htmlFor={`status-${status}`}
                          className={`flex flex-1 cursor-pointer items-center gap-2 ${disabled ? 'opacity-50' : ''}`}
                        >
                          {iconFor(status)}
                          <div>
                            <div className="font-medium">{STATUS_LABEL[status]}</div>
                            {status === 'voting' && (
                              <div className="text-xs text-muted-foreground">
                                {canStartVoting ? 'Kandidat dan DPT sudah siap' : 'Memerlukan kandidat dan DPT'}
                              </div>
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              validation.loading ||
              !selectedStatus ||
              (requiresVotingPrerequisites && !canStartVoting)
            }
          >
            {isSubmitting ? 'Menyimpan...' : 'Ubah Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
