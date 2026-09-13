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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { logAudit } from '@/lib/audit';
import type { PairWithMembers } from '@/lib/candidate-pair-helpers';

interface CandidateOption {
    id: string;
    profiles: { full_name: string; student_id: string } | null;
}

interface EditPairDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pair: PairWithMembers | null;
    eventId: string;
    onSuccess?: () => void;
}

/**
 * Admin dialog to edit a candidate pair: label, number, vision, mission,
 * photo, and its two members (ketua + wakil). Members are replaced on save
 * (delete existing rows, insert the new selection).
 */
export function EditPairDialog({
    open,
    onOpenChange,
    pair,
    eventId,
    onSuccess,
}: EditPairDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [candidates, setCandidates] = useState<CandidateOption[]>([]);

    const [label, setLabel] = useState('');
    const [number, setNumber] = useState('');
    const [vision, setVision] = useState('');
    const [mission, setMission] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [ketuaId, setKetuaId] = useState('');
    const [wakilId, setWakilId] = useState('');

    useEffect(() => {
        if (open && pair) {
            setLabel(pair.label || '');
            setNumber(pair.number != null ? String(pair.number) : '');
            setVision(pair.vision || '');
            setMission(pair.mission || '');
            setPhotoUrl(pair.photo_url || '');
            setKetuaId(pair.members.find((m) => m.position === 'ketua')?.candidate_id || '');
            setWakilId(pair.members.find((m) => m.position === 'wakil')?.candidate_id || '');
            fetchCandidates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, pair]);

    const fetchCandidates = async () => {
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('id, profiles(full_name, student_id)')
                .eq('event_id', eventId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setCandidates((data || []) as CandidateOption[]);
        } catch (error: any) {
            console.error('Error fetching candidates:', error);
            toast.error('Gagal memuat daftar kandidat');
        }
    };

    const validate = (): string | null => {
        if (!ketuaId) return 'Kandidat ketua wajib dipilih';
        if (!wakilId) return 'Kandidat wakil wajib dipilih';
        if (ketuaId === wakilId) return 'Ketua dan wakil harus kandidat yang berbeda';
        if (vision.trim().length < 10) return 'Visi minimal 10 karakter';
        if (mission.trim().length < 10) return 'Misi minimal 10 karakter';
        if (number && (isNaN(Number(number)) || Number(number) < 1)) {
            return 'Nomor urut harus angka positif';
        }
        return null;
    };

    const handleSubmit = async () => {
        if (!pair) return;
        const validationError = validate();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: updateError } = await supabase
                .from('candidate_pairs')
                .update({
                    label: label.trim() || null,
                    number: number ? Number(number) : null,
                    vision: vision.trim(),
                    mission: mission.trim(),
                    photo_url: photoUrl.trim() || null,
                })
                .eq('id', pair.id);

            if (updateError) {
                if (updateError.code === '23505') {
                    throw new Error('Nomor urut sudah digunakan pasangan lain di event ini');
                }
                throw updateError;
            }

            // Replace members with the new selection
            const { error: deleteError } = await supabase
                .from('candidate_pair_members')
                .delete()
                .eq('pair_id', pair.id);

            if (deleteError) throw deleteError;

            const { error: membersError } = await supabase.from('candidate_pair_members').insert([
                { pair_id: pair.id, candidate_id: ketuaId, position: 'ketua' },
                { pair_id: pair.id, candidate_id: wakilId, position: 'wakil' },
            ]);

            if (membersError) throw membersError;

            await logAudit({
                action: 'candidate.pair.edit',
                description: 'Updated candidate pair',
                category: 'election',
                targetType: 'candidate_pairs',
                targetId: pair.id,
                metadata: { event_id: eventId, ketua: ketuaId, wakil: wakilId },
            });

            toast.success('Pasangan kandidat berhasil diperbarui!');
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            console.error('Error updating pair:', error);
            toast.error(error.message || 'Gagal memperbarui pasangan kandidat');
        } finally {
            setIsSubmitting(false);
        }
    };

    const candidateLabel = (c: CandidateOption) =>
        `${c.profiles?.full_name ?? 'Tanpa nama'} - ${c.profiles?.student_id ?? '-'}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Pasangan Kandidat</DialogTitle>
                    <DialogDescription>
                        Perbarui detail pasangan atau ganti anggota (ketua & wakil).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-pair-label">Label Pasangan (Opsional)</Label>
                            <Input
                                id="edit-pair-label"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-pair-number">Nomor Urut (Opsional)</Label>
                            <Input
                                id="edit-pair-number"
                                type="number"
                                min={1}
                                value={number}
                                onChange={(e) => setNumber(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-pair-ketua" className="text-xs">
                                Ketua <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={ketuaId}
                                onValueChange={(v) => {
                                    setKetuaId(v);
                                    if (v === wakilId) setWakilId('');
                                }}
                                disabled={isSubmitting}
                            >
                                <SelectTrigger id="edit-pair-ketua">
                                    <SelectValue placeholder="Pilih ketua" />
                                </SelectTrigger>
                                <SelectContent>
                                    {candidates.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {candidateLabel(c)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-pair-wakil" className="text-xs">
                                Wakil Ketua <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={wakilId}
                                onValueChange={setWakilId}
                                disabled={isSubmitting}
                            >
                                <SelectTrigger id="edit-pair-wakil">
                                    <SelectValue placeholder="Pilih wakil" />
                                </SelectTrigger>
                                <SelectContent>
                                    {candidates
                                        .filter((c) => c.id !== ketuaId)
                                        .map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {candidateLabel(c)}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-pair-vision">
                            Visi <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="edit-pair-vision"
                            rows={3}
                            value={vision}
                            onChange={(e) => setVision(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-pair-mission">
                            Misi <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="edit-pair-mission"
                            rows={3}
                            value={mission}
                            onChange={(e) => setMission(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-pair-photo">URL Foto (Opsional)</Label>
                        <Input
                            id="edit-pair-photo"
                            type="url"
                            value={photoUrl}
                            onChange={(e) => setPhotoUrl(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Batal
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}