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
import { Search, Users } from 'lucide-react';
import { logAudit } from '@/lib/audit';

interface CandidateOption {
    id: string;
    user_id: string;
    vision: string | null;
    mission: string | null;
    profiles: { full_name: string; student_id: string } | null;
}

interface CreatePairDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventId: string;
    onSuccess?: () => void;
}

/**
 * Admin dialog to create a candidate pair (pasangan calon) for an event.
 *
 * Creates one `candidate_pairs` row plus two `candidate_pair_members` rows
 * (ketua + wakil) selected from the event's existing candidates. Follows the
 * same patterns as AddCandidateDialog (direct insert + audit log).
 */
export function CreatePairDialog({
    open,
    onOpenChange,
    eventId,
    onSuccess,
}: CreatePairDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [candidates, setCandidates] = useState<CandidateOption[]>([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [label, setLabel] = useState('');
    const [number, setNumber] = useState('');
    const [vision, setVision] = useState('');
    const [mission, setMission] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [ketuaId, setKetuaId] = useState('');
    const [wakilId, setWakilId] = useState('');

    useEffect(() => {
        if (open) {
            fetchCandidates();
        }
    }, [open, eventId]);

    const resetForm = () => {
        setLabel('');
        setNumber('');
        setVision('');
        setMission('');
        setPhotoUrl('');
        setKetuaId('');
        setWakilId('');
        setSearchQuery('');
    };

    const fetchCandidates = async () => {
        setLoadingCandidates(true);
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('id, user_id, vision, mission, profiles(full_name, student_id)')
                .eq('event_id', eventId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setCandidates((data || []) as CandidateOption[]);
        } catch (error: any) {
            console.error('Error fetching candidates:', error);
            toast.error('Gagal memuat daftar kandidat: ' + (error.message || 'Unknown error'));
        } finally {
            setLoadingCandidates(false);
        }
    };

    const filteredCandidates = candidates.filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const name = c.profiles?.full_name?.toLowerCase() ?? '';
        const sid = c.profiles?.student_id?.toLowerCase() ?? '';
        return name.includes(q) || sid.includes(q);
    });

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
        const validationError = validate();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsSubmitting(true);
        try {
            // 1) Insert the pair row
            const { data: pairData, error: pairError } = await supabase
                .from('candidate_pairs')
                .insert({
                    event_id: eventId,
                    label: label.trim() || null,
                    number: number ? Number(number) : null,
                    vision: vision.trim(),
                    mission: mission.trim(),
                    photo_url: photoUrl.trim() || null,
                    status: 'approved', // Admin-created pairs are approved by default
                })
                .select('id')
                .single();

            if (pairError) {
                if (pairError.code === '23505') {
                    throw new Error('Nomor urut sudah digunakan pasangan lain di event ini');
                }
                throw pairError;
            }

            const pairId = pairData.id;

            // 2) Insert the two members (ketua + wakil)
            const { error: membersError } = await supabase.from('candidate_pair_members').insert([
                { pair_id: pairId, candidate_id: ketuaId, position: 'ketua' },
                { pair_id: pairId, candidate_id: wakilId, position: 'wakil' },
            ]);

            if (membersError) {
                // Roll back the pair row so a partial pair never lingers
                await supabase.from('candidate_pairs').delete().eq('id', pairId);
                throw membersError;
            }

            await logAudit({
                action: 'candidate.pair.add',
                description: 'Created candidate pair for event',
                category: 'election',
                targetType: 'candidate_pairs',
                targetId: pairId,
                metadata: { event_id: eventId, ketua: ketuaId, wakil: wakilId },
            });

            toast.success('Pasangan kandidat berhasil ditambahkan!');
            resetForm();
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            console.error('Error creating pair:', error);
            toast.error(error.message || 'Gagal menambahkan pasangan kandidat');
        } finally {
            setIsSubmitting(false);
        }
    };

    const candidateLabel = (c: CandidateOption) =>
        `${c.profiles?.full_name ?? 'Tanpa nama'} - ${c.profiles?.student_id ?? '-'}`;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
            <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tambah Pasangan Kandidat</DialogTitle>
                    <DialogDescription>
                        Pilih dua kandidat (ketua & wakil) dari daftar kandidat event ini,
                        lalu isi visi dan misi pasangan.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="pair-label">Label Pasangan (Opsional)</Label>
                            <Input
                                id="pair-label"
                                placeholder="cth: Paslon 1 - BEM Harmoni"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pair-number">Nomor Urut (Opsional)</Label>
                            <Input
                                id="pair-number"
                                type="number"
                                min={1}
                                placeholder="cth: 1"
                                value={number}
                                onChange={(e) => setNumber(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Kandidat Anggota Pasangan</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama atau NIM..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                                disabled={loadingCandidates || isSubmitting}
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="pair-ketua" className="text-xs">
                                    Ketua <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={ketuaId}
                                    onValueChange={(v) => {
                                        setKetuaId(v);
                                        if (v === wakilId) setWakilId('');
                                    }}
                                    disabled={loadingCandidates || isSubmitting}
                                >
                                    <SelectTrigger id="pair-ketua">
                                        <SelectValue placeholder={loadingCandidates ? 'Memuat...' : 'Pilih ketua'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredCandidates.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground">
                                                {loadingCandidates ? 'Memuat...' : 'Tidak ada kandidat'}
                                            </div>
                                        ) : (
                                            filteredCandidates.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {candidateLabel(c)}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="pair-wakil" className="text-xs">
                                    Wakil Ketua <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={wakilId}
                                    onValueChange={setWakilId}
                                    disabled={loadingCandidates || isSubmitting}
                                >
                                    <SelectTrigger id="pair-wakil">
                                        <SelectValue placeholder={loadingCandidates ? 'Memuat...' : 'Pilih wakil'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredCandidates.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground">
                                                {loadingCandidates ? 'Memuat...' : 'Tidak ada kandidat'}
                                            </div>
                                        ) : (
                                            filteredCandidates
                                                .filter((c) => c.id !== ketuaId)
                                                .map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {candidateLabel(c)}
                                                    </SelectItem>
                                                ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {candidates.length === 0 && !loadingCandidates && (
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                Belum ada kandidat di event ini. Tambahkan kandidat terlebih dahulu di tab Kandidat.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pair-vision">
                            Visi <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="pair-vision"
                            placeholder="Tuliskan visi pasangan..."
                            rows={3}
                            value={vision}
                            onChange={(e) => setVision(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pair-mission">
                            Misi <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="pair-mission"
                            placeholder="Tuliskan misi pasangan..."
                            rows={3}
                            value={mission}
                            onChange={(e) => setMission(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pair-photo">URL Foto (Opsional)</Label>
                        <Input
                            id="pair-photo"
                            type="url"
                            placeholder="https://example.com/photo.jpg"
                            value={photoUrl}
                            onChange={(e) => setPhotoUrl(e.target.value)}
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground">
                            Masukkan URL foto pasangan dari sumber eksternal
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Batal
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || loadingCandidates}>
                        {isSubmitting ? 'Menambahkan...' : 'Tambah Pasangan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}