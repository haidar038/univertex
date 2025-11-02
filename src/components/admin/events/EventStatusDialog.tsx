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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, FileText, Play, StopCircle } from 'lucide-react';

interface EventStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  currentStatus: 'draft' | 'active' | 'closed' | null;
  onSuccess?: () => void;
}

export function EventStatusDialog({
  open,
  onOpenChange,
  eventId,
  currentStatus,
  onSuccess,
}: EventStatusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'draft' | 'active' | 'closed'>('draft');
  const [validation, setValidation] = useState({
    hasCandidates: false,
    hasVoterGroups: false,
    loading: false,
  });

  useEffect(() => {
    if (currentStatus) {
      setSelectedStatus(currentStatus);
    }
  }, [currentStatus]);

  useEffect(() => {
    if (open && eventId) {
      validateEvent();
    }
  }, [open, eventId]);

  const validateEvent = async () => {
    if (!eventId) return;

    setValidation((prev) => ({ ...prev, loading: true }));
    try {
      const [candidatesResult, voterGroupsResult] = await Promise.all([
        supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('event_voter_groups')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
      ]);

      setValidation({
        hasCandidates: (candidatesResult.count || 0) > 0,
        hasVoterGroups: (voterGroupsResult.count || 0) > 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error validating event:', error);
      setValidation((prev) => ({ ...prev, loading: false }));
    }
  };

  const canActivate = validation.hasCandidates && validation.hasVoterGroups;

  const handleSubmit = async () => {
    if (!eventId) return;

    // Validation for activating event
    if (selectedStatus === 'active' && !canActivate) {
      toast.error('Acara harus memiliki kandidat dan grup pemilih untuk diaktifkan');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('election_events')
        .update({ status: selectedStatus })
        .eq('id', eventId);

      if (error) throw error;

      const statusText =
        selectedStatus === 'active' ? 'diaktifkan' : selectedStatus === 'closed' ? 'ditutup' : 'dijadikan draft';
      toast.success(`Status acara berhasil ${statusText}!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Gagal mengubah status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />;
      case 'active':
        return <Play className="h-4 w-4" />;
      case 'closed':
        return <StopCircle className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ubah Status Acara</DialogTitle>
          <DialogDescription>
            Pilih status baru untuk acara pemilihan. Pastikan semua persyaratan terpenuhi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {validation.loading ? (
            <div className="text-center text-sm text-muted-foreground">Memvalidasi acara...</div>
          ) : (
            <>
              {/* Validation warnings */}
              {selectedStatus === 'active' && !canActivate && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Tidak dapat mengaktifkan acara!</strong>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                      {!validation.hasCandidates && <li>Belum ada kandidat</li>}
                      {!validation.hasVoterGroups && <li>Belum ada grup pemilih (DPT)</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Requirements info */}
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="mb-2 text-sm font-medium">Persyaratan aktivasi:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    {validation.hasCandidates ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Memiliki kandidat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {validation.hasVoterGroups ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Memiliki grup pemilih (DPT)</span>
                  </div>
                </div>
              </div>

              {/* Status selection */}
              <RadioGroup value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 rounded-lg border border-border p-3 hover:bg-muted/50">
                    <RadioGroupItem value="draft" id="draft" />
                    <Label htmlFor="draft" className="flex flex-1 cursor-pointer items-center gap-2">
                      {getStatusIcon('draft')}
                      <div>
                        <div className="font-medium">Draft</div>
                        <div className="text-xs text-muted-foreground">
                          Acara belum dipublikasi, hanya admin yang dapat melihat
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 rounded-lg border border-border p-3 hover:bg-muted/50">
                    <RadioGroupItem value="active" id="active" disabled={!canActivate} />
                    <Label
                      htmlFor="active"
                      className={`flex flex-1 cursor-pointer items-center gap-2 ${
                        !canActivate ? 'opacity-50' : ''
                      }`}
                    >
                      {getStatusIcon('active')}
                      <div>
                        <div className="font-medium">Aktif</div>
                        <div className="text-xs text-muted-foreground">
                          Pemilihan sedang berlangsung, pemilih dapat memberikan suara
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 rounded-lg border border-border p-3 hover:bg-muted/50">
                    <RadioGroupItem value="closed" id="closed" />
                    <Label htmlFor="closed" className="flex flex-1 cursor-pointer items-center gap-2">
                      {getStatusIcon('closed')}
                      <div>
                        <div className="font-medium">Selesai</div>
                        <div className="text-xs text-muted-foreground">
                          Pemilihan telah ditutup, hasil dapat dilihat
                        </div>
                      </div>
                    </Label>
                  </div>
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
            disabled={isSubmitting || validation.loading || (selectedStatus === 'active' && !canActivate)}
          >
            {isSubmitting ? 'Menyimpan...' : 'Ubah Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
