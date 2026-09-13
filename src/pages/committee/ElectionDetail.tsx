import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, AlertCircle, AlertTriangle, Info, Vote, Users, FileText } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { fetchPairsWithMembers, getPairDisplayName, getPairPositionLabel, type PairWithMembers } from "@/lib/candidate-pair-helpers";

interface ElectionInfo {
    id: string;
    title: string;
    description: string | null;
    status: string;
    election_type: string;
    start_time: string;
    end_time: string;
    use_pairs: boolean;
}

interface TallyRow {
    candidate_id: string | null;
    pair_id: string | null;
    total_votes: number;
}

interface Candidate {
    id: string;
    user_id: string;
    vision: string | null;
    mission: string | null;
    photo_url: string | null;
    status: string;
}


interface Observation {
    id: string;
    category: string;
    severity: string;
    description: string;
    created_at: string;
}

const SEVERITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    info: Info,
    warning: AlertCircle,
    critical: AlertTriangle,
};

const SEVERITY_COLOR: Record<string, string> = {
    info: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    warning: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
    critical: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

const CATEGORY_LABEL: Record<string, string> = {
    attendance: 'Kehadiran',
    irregularity: 'Ketidakwajaran',
    technical: 'Teknis',
    voter_question: 'Pertanyaan Pemilih',
    other: 'Lainnya',
};

const STATUS_LABEL: Record<string, string> = {
    draft: 'Draf',
    active: 'Aktif',
    closed: 'Selesai',
};

/**
 * Read-only committee election view. Lets the committee:
 *   - See live vote tally (reuses the secure get_election_tally RPC).
 *   - Browse candidates / pairs (read-only).
 *   - Submit monitoring observations (inserted via add_election_observation).
 *
 * Committee CANNOT: edit the election, edit candidates, edit votes, change
 * voter groups, or modify any other committee's observations.
 */
export default function CommitteeElectionDetail() {
    const { electionId } = useParams<{ electionId: string }>();
    const [election, setElection] = useState<ElectionInfo | null>(null);
    const [tally, setTally] = useState<TallyRow[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [pairs, setPairs] = useState<PairWithMembers[]>([]);
    const [observations, setObservations] = useState<Observation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Observation form
    const [obsCategory, setObsCategory] = useState<string>('attendance');
    const [obsSeverity, setObsSeverity] = useState<string>('info');
    const [obsDescription, setObsDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadAll = async () => {
        if (!electionId) return;
        setLoading(true);
        setError(null);
        try {
            const [eventRes, tallyRes, candRes, pairRes, obsRes] = await Promise.all([
                supabase.from('election_events').select('*').eq('id', electionId).maybeSingle(),
                supabase.rpc('get_election_tally', { p_event_id: electionId }),
                supabase.from('candidates').select('*').eq('event_id', electionId),
                fetchPairsWithMembers(electionId),
                supabase.from('election_observations')
                    .select('id,category,severity,description,created_at')
                    .eq('election_id', electionId)
                    .order('created_at', { ascending: false })
                    .limit(50),
            ]);

            if (eventRes.error) throw eventRes.error;
            if (!eventRes.data) throw new Error('Pemilihan tidak ditemukan atau Anda tidak memiliki akses');

            setElection(eventRes.data as ElectionInfo);
            setTally((tallyRes.data ?? []) as TallyRow[]);
            setCandidates((candRes.data ?? []) as Candidate[]);
            setPairs(pairRes);
            setObservations((obsRes.data ?? []) as Observation[]);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Gagal memuat data';
            logger.error('Failed to load election detail', e, { action: 'committee.election.load' });
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [electionId]);

    const submitObservation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!electionId) return;
        if (!obsDescription.trim()) {
            toast.error('Deskripsi wajib diisi');
            return;
        }
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('add_election_observation', {
                p_election_id: electionId,
                p_category: obsCategory,
                p_description: obsDescription,
                p_severity: obsSeverity,
            });
            if (error) throw error;
            toast.success('Observasi tercatat');
            setObsDescription('');
            await loadAll();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Gagal mengirim observasi';
            logger.error('Failed to submit observation', e, { action: 'committee.observation.submit' });
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const totalVotes = tally.reduce((s, r) => s + Number(r.total_votes || 0), 0);

    const tallyForCandidate = (candidateId: string) =>
        tally.find((t) => t.candidate_id === candidateId)?.total_votes ?? 0;

    const tallyForPair = (pairId: string) =>
        tally.find((t) => t.pair_id === pairId)?.total_votes ?? 0;

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (error || !election) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Alert variant="destructive">
                    <AlertTitle>Tidak dapat memuat pemilihan</AlertTitle>
                    <AlertDescription>{error ?? 'Tidak ditemukan'}</AlertDescription>
                </Alert>
                <Button asChild variant="outline" className="mt-4">
                    <Link to="/committee">← Kembali ke daftar pemilihan</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <Button asChild variant="ghost" size="sm">
                <Link to="/committee"><ArrowLeft className="h-4 w-4 mr-2" /> Kembali</Link>
            </Button>

            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-2xl">{election.title}</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant={election.status === 'voting' ? 'default' : 'secondary'}>
                                {STATUS_LABEL[election.status] ?? election.status}
                            </Badge>
                            <Badge variant="outline">
                                {election.election_type === 'open' ? 'Terbuka' : 'Tertutup'}
                            </Badge>
                        </div>
                    </div>
                    {election.description && <CardDescription>{election.description}</CardDescription>}
                    <div className="text-sm text-muted-foreground flex gap-4 mt-2">
                        <span>Mulai: {new Date(election.start_time).toLocaleString('id-ID')}</span>
                        <span>Selesai: {new Date(election.end_time).toLocaleString('id-ID')}</span>
                    </div>
                </CardHeader>
            </Card>

            {/* Live Tally */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Vote className="h-5 w-5" />
                        <CardTitle>Hasil Suara (Live)</CardTitle>
                    </div>
                    <CardDescription>
                        Total suara masuk: <strong>{totalVotes}</strong>. Data diperbarui
                        secara real-time.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {election.use_pairs ? (
                        pairs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Belum ada pasangan kandidat.</p>
                        ) : (
                            pairs.map((p) => {
                                const votes = tallyForPair(p.id);
                                const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                return (
                                    <div key={p.id} className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <p className="font-medium">
                                                #{p.number ?? '?'} {getPairDisplayName(p)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {p.members.map((m) => `${getPairPositionLabel(m.position)}: ${m.candidates?.profiles?.full_name || 'Tanpa nama'}`).join(' • ')}
                                            </p>
                                            <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-24 text-right">
                                            <p className="font-bold">{votes}</p>
                                            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                );
                            })
                        )
                    ) : candidates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada kandidat.</p>
                    ) : (
                        candidates.map((c) => {
                            const votes = tallyForCandidate(c.id);
                            const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                            return (
                                <div key={c.id} className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <p className="font-medium">Kandidat {c.id.slice(0, 8)}…</p>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="w-24 text-right">
                                        <p className="font-bold">{votes}</p>
                                        <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Observation Form */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        <CardTitle>Tambah Observasi</CardTitle>
                    </div>
                    <CardDescription>
                        Catat kejadian penting di lapangan. Setiap observasi akan otomatis tercatat
                        di audit log dengan timestamp.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submitObservation} className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="obs-category">Kategori</Label>
                                <Select value={obsCategory} onValueChange={setObsCategory}>
                                    <SelectTrigger id="obs-category"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="attendance">Kehadiran</SelectItem>
                                        <SelectItem value="irregularity">Ketidakwajaran</SelectItem>
                                        <SelectItem value="technical">Teknis</SelectItem>
                                        <SelectItem value="voter_question">Pertanyaan Pemilih</SelectItem>
                                        <SelectItem value="other">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="obs-severity">Tingkat</Label>
                                <Select value={obsSeverity} onValueChange={setObsSeverity}>
                                    <SelectTrigger id="obs-severity"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="info">Info (biasa)</SelectItem>
                                        <SelectItem value="warning">Peringatan</SelectItem>
                                        <SelectItem value="critical">Kritis</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="obs-description">Deskripsi</Label>
                            <Textarea
                                id="obs-description"
                                placeholder="Jelaskan kejadian, siapa yang terlibat, waktu, dll."
                                value={obsDescription}
                                onChange={(e) => setObsDescription(e.target.value)}
                                rows={3}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Mengirim…' : 'Kirim Observasi'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Observations list */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <CardTitle>Riwayat Observasi ({observations.length})</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {observations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada observasi tercatat.</p>
                    ) : (
                        observations.map((o) => {
                            const Icon = SEVERITY_ICON[o.severity] ?? Info;
                            return (
                                <div key={o.id} className={`p-3 rounded-lg ${SEVERITY_COLOR[o.severity]}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className="h-4 w-4" />
                                        <span className="text-sm font-medium">
                                            {CATEGORY_LABEL[o.category] ?? o.category} •{' '}
                                            {new Date(o.created_at).toLocaleString('id-ID')}
                                        </span>
                                    </div>
                                    <p className="text-sm">{o.description}</p>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Quick stats */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <CardTitle>Statistik Pemilih</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Statistik DPT dan kehadiran tersedia di konsol admin. Panitia hanya
                        diberi akses baca tally untuk mencegah manipulasi data.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
