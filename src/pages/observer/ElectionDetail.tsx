import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Eye, AlertCircle, AlertTriangle, Info, Vote, FileText } from "lucide-react";
import { logger } from "@/lib/logger";
import { fetchPairsWithMembers, getPairDisplayName, type PairWithMembers } from "@/lib/candidate-pair-helpers";

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

interface NamedCandidate {
    id: string;
    profiles: { full_name: string; student_id: string } | null;
}

interface TallyRow {
    candidate_id: string | null;
    pair_id: string | null;
    total_votes: number;
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
 * Read-only observer view. Mirrors the committee ElectionDetail but
 * without the observation submission form (observers can only monitor).
 */
export default function ObserverElectionDetail() {
    const { electionId } = useParams<{ electionId: string }>();
    const [election, setElection] = useState<ElectionInfo | null>(null);
    const [tally, setTally] = useState<TallyRow[]>([]);
    const [candidates, setCandidates] = useState<NamedCandidate[]>([]);
    const [pairs, setPairs] = useState<PairWithMembers[]>([]);
    const [observations, setObservations] = useState<Observation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!electionId) return;
            setLoading(true);
            setError(null);
            try {
                const [eventRes, tallyRes, candRes, pairRes, obsRes] = await Promise.all([
                    supabase.from('election_events').select('*').eq('id', electionId).maybeSingle(),
                    supabase.rpc('get_election_tally', { p_event_id: electionId }),
                    supabase.from('candidates').select('id, profiles(full_name, student_id)').eq('event_id', electionId),
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
                setCandidates((candRes.data ?? []) as NamedCandidate[]);
                setPairs(pairRes);
                setObservations((obsRes.data ?? []) as Observation[]);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Gagal memuat data';
                logger.error('Failed to load observer election detail', e, { action: 'observer.election.load' });
                setError(msg);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [electionId]);

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-64 w-full" />
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
                    <Link to="/observer">← Kembali</Link>
                </Button>
            </div>
        );
    }

    const totalVotes = tally.reduce((s, r) => s + Number(r.total_votes || 0), 0);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <Button asChild variant="ghost" size="sm">
                <Link to="/observer"><ArrowLeft className="h-4 w-4 mr-2" /> Kembali</Link>
            </Button>

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
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Vote className="h-5 w-5" />
                        <CardTitle>Hasil Suara</CardTitle>
                    </div>
                    <CardDescription>Total suara masuk: <strong>{totalVotes}</strong></CardDescription>
                </CardHeader>
                <CardContent>
                    {election.use_pairs ? (
                        pairs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Belum ada pasangan kandidat.</p>
                        ) : (
                            <ul className="space-y-2">
                                {pairs.map((p) => {
                                    const votes = Number(tally.find((t) => t.pair_id === p.id)?.total_votes ?? 0);
                                    const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                    return (
                                        <li key={p.id} className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">
                                                    #{p.number ?? '?'} {getPairDisplayName(p)}
                                                </p>
                                                <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                                                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                            <div className="w-20 text-right text-sm">
                                                <p className="font-bold">{votes}</p>
                                                <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    ) : candidates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada kandidat.</p>
                    ) : (
                        <ul className="space-y-2">
                            {candidates.map((c) => {
                                const votes = Number(tally.find((t) => t.candidate_id === c.id)?.total_votes ?? 0);
                                const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                return (
                                    <li key={c.id} className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">
                                                {c.profiles?.full_name || 'Tanpa nama'}
                                                <span className="text-muted-foreground"> — {c.profiles?.student_id || '-'}</span>
                                            </p>
                                            <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                                                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <div className="w-20 text-right text-sm">
                                            <p className="font-bold">{votes}</p>
                                            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <CardTitle>Riwayat Observasi ({observations.length})</CardTitle>
                    </div>
                    <CardDescription>
                        Hanya-baca. Untuk menambah observasi baru, hubungi admin atau panitia
                        terkait.
                    </CardDescription>
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

            <p className="text-xs text-muted-foreground text-center">
                <Eye className="inline h-3 w-3 mr-1" />
                Anda login sebagai <strong>Observer</strong>. Akses hanya-baca.
            </p>
        </div>
    );
}
