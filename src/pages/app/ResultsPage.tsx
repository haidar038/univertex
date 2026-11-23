import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trophy, Users, ArrowLeft, Lock, Eye, Clock, AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { fetchPairsWithMembers, getPairDisplayName, type PairWithMembers } from '@/lib/candidate-pair-helpers';
import { getTieGroup } from '@/lib/election-results';

interface CandidateResult {
  id: string;
  name: string;
  studentId: string;
  votes: number;
}

interface PairResult {
  id: string;
  name: string;
  members: string[];
  votes: number;
}

interface EventData {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'registration' | 'voting' | 'counting' | 'published' | 'archived';
  election_type: 'open' | 'closed';
  public_results: boolean;
  show_results_after_voting: boolean;
  use_pairs: boolean;
  start_time: string;
  end_time: string;
}

/**
 * Safe percentage formatter. Returns 0 when totalVotes is 0 / NaN to avoid
 * "NaN%" being shown in the UI. The original implementation trusted
 * Math.round(undefined / 0) -> NaN.
 */
const safePercent = (votes: number, totalVotes: number): number => {
  if (!Number.isFinite(votes) || !Number.isFinite(totalVotes) || totalVotes <= 0) {
    return 0;
  }
  return Math.round((votes / totalVotes) * 100);
};

export default function ResultsPage() {
  const { eventId } = useParams();
  const { profile } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [pairResults, setPairResults] = useState<PairResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // P-B: id kandidat/paslon yang dipilih user (untuk struk abu-abu closed).
  const [myChoiceId, setMyChoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      fetchResults();
    } else {
      setErrorMsg('ID pemilihan tidak valid');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, profile?.id]);

  const fetchResults = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('election_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) throw eventError;
      if (!eventData) {
        setErrorMsg('Pemilihan tidak ditemukan.');
        setLoading(false);
        return;
      }
      setEvent(eventData as EventData);
      const redactedEvent =
        (eventData as EventData).election_type === 'closed' &&
        !['published', 'archived'].includes((eventData as EventData).status);

      // P-B: pilihan sendiri untuk struk abu-abu (RLS: voter hanya lihat miliknya).
      if (profile?.id) {
        const { data: myVote } = await supabase
          .from('votes')
          .select('candidate_id, pair_id')
          .eq('voter_id', profile.id)
          .eq('event_id', eventId)
          .maybeSingle();
        if (myVote) {
          setMyChoiceId(
            ((myVote as { pair_id?: string | null }).pair_id ??
              (myVote as { candidate_id?: string | null }).candidate_id ??
              null) as string | null
          );
        }
      }

      // Single aggregated RPC instead of N+1 queries
      const { data: tally, error: tallyError } = await supabase.rpc(
        'get_election_tally',
        { p_event_id: eventId }
      );

      // P-B: voter closed pre-publish memang ditolak server (42501).
      // Itu bukan error — tampilkan mode sensor dengan daftar kandidat.
      if (tallyError) {
        if (!(redactedEvent && (tallyError as { code?: string })?.code === '42501')) throw tallyError;
      }

      if (eventData.use_pairs) {
        // Mode pasangan: hasil per pasangan (ketua & wakil)
        const pairs = await fetchPairsWithMembers(eventId, { approvedOnly: true });

        const votesByPair = new Map<string, number>();
        (tally || []).forEach((row: { pair_id: string | null; total_votes: number | string }) => {
          if (row.pair_id) {
            votesByPair.set(row.pair_id, Number(row.total_votes) || 0);
          }
        });

        const pairResultsWithVotes: PairResult[] = pairs.map((p: PairWithMembers) => ({
          id: p.id,
          name: getPairDisplayName(p),
          members: p.members.map((m) => m.candidates?.profiles?.full_name || 'Tanpa nama'),
          votes: votesByPair.get(p.id) ?? 0,
        }));

        pairResultsWithVotes.sort((a, b) => b.votes - a.votes);
        setPairResults(pairResultsWithVotes);
        setResults([]);
        setLoading(false);
        return;
      }

      // Only show approved candidates
      const { data: candidates, error: candidatesError } = await supabase
        .from('candidates')
        .select('id, profiles(full_name, student_id)')
        .eq('event_id', eventId)
        .eq('status', 'approved');

      if (candidatesError) throw candidatesError;
      if (!candidates || candidates.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      const votesByCandidate = new Map<string, number>();
      (tally || []).forEach((row: { candidate_id: string | null; total_votes: number | string }) => {
        if (row.candidate_id) {
          votesByCandidate.set(
            row.candidate_id,
            Number(row.total_votes) || 0
          );
        }
      });

      const resultsWithVotes: CandidateResult[] = candidates.map((c) => ({
        id: c.id,
        name: (c.profiles as unknown as { full_name: string })?.full_name ?? 'Tanpa nama',
        studentId: (c.profiles as unknown as { student_id: string })?.student_id ?? '-',
        votes: votesByCandidate.get(c.id) ?? 0,
      }));

      resultsWithVotes.sort((a, b) => b.votes - a.votes);
      setResults(resultsWithVotes);
    } catch (error) {
      console.error('Error fetching results:', error);
      setErrorMsg('Gagal memuat hasil pemilihan.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-2" />
        <p>Memuat hasil...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/app/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Pemilihan tidak ditemukan.</p>
      </div>
    );
  }

  // Always coerce to finite numbers to prevent NaN rendering downstream.
  const isPairMode = event.use_pairs;
  // P-B: closed pre-publish = sensor. Angka/pemenang disembunyikan walau
  // server (data lama) masih mengembalikan tally.
  const isRedacted =
    event.election_type === 'closed' &&
    !['published', 'archived'].includes(event.status);
  const myChoiceName = isPairMode
    ? pairResults.find((r) => r.id === myChoiceId)?.name
    : results.find((r) => r.id === myChoiceId)?.name;
  const totalVotes: number = isPairMode
    ? pairResults.reduce((sum, r) => sum + (Number.isFinite(r.votes) ? r.votes : 0), 0)
    : results.reduce((sum, r) => sum + (Number.isFinite(r.votes) ? r.votes : 0), 0);
  const winnerName: string | undefined = isPairMode ? pairResults[0]?.name : results[0]?.name;
  const winnerVotes: number = isPairMode
    ? Number(pairResults[0]?.votes) || 0
    : Number(results[0]?.votes) || 0;
  // Pemenang tunggal vs seri: ≥2 entri dengan suara terbanyak sama.
  const tiedResults = getTieGroup(isPairMode ? pairResults : results);
  const isTie = !isRedacted && tiedResults.length > 0;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Button asChild variant="ghost" className="gap-2 mb-4">
            <Link to="/app/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </Link>
          </Button>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Hasil Pemilihan</h1>
          <p className="text-lg text-muted-foreground">{event.title}</p>
          {event.description && (
            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
          )}
        </div>

        {winnerName && totalVotes > 0 && !isRedacted && !isTie && (
          <Card className="mb-8 border-primary/50 bg-gradient-to-br from-card to-primary/10">
            <CardContent className="py-8 text-center">
              <Trophy className="mx-auto mb-4 h-16 w-16 text-primary" />
              <h2 className="mb-2 text-2xl font-bold text-foreground">
                {event.status === 'voting' ? 'Posisi Teratas' : 'Pemenang'}
              </h2>
              <p className="mb-1 text-xl font-semibold text-primary">{winnerName}</p>
              {isPairMode && pairResults[0] && (
                <p className="mb-1 text-sm text-muted-foreground">
                  {pairResults[0].members.join(' • ')}
                </p>
              )}
              {!isPairMode && results[0] && (
                <p className="mb-1 text-sm text-muted-foreground">{results[0].studentId}</p>
              )}
              <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2">
                <Users className="h-4 w-4 text-primary-foreground" />
                <span className="font-bold text-primary-foreground">
                  {winnerVotes} suara ({safePercent(winnerVotes, totalVotes)}%)
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seri: ≥2 kandidat/pasangan dengan suara terbanyak sama */}
        {isTie && (
          <Card className="mb-8 border-accent/50 bg-gradient-to-br from-card to-accent/10">
            <CardContent className="py-8 text-center">
              <Scale className="mx-auto mb-4 h-16 w-16 text-primary" />
              <h2 className="mb-2 text-2xl font-bold text-foreground">Seri</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                {isPairMode
                  ? `${tiedResults.length} pasangan kandidat memperoleh suara terbanyak yang sama.`
                  : `${tiedResults.length} kandidat memperoleh suara terbanyak yang sama.`}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {tiedResults.map((r) => (
                  <div
                    key={r.id}
                    className="min-w-[180px] rounded-lg border border-accent/40 bg-card px-4 py-3 text-left"
                  >
                    <p className="font-semibold text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isPairMode
                        ? (r as PairResult).members.join(' • ')
                        : (r as CandidateResult).studentId}
                    </p>
                    <p className="mt-1 text-sm font-bold text-primary">
                      {r.votes} suara ({safePercent(Number(r.votes), totalVotes)}%)
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* P-B: struk abu-abu untuk closed pre-publish */}
        {isRedacted && (
          <Card className="mb-8 border-muted bg-muted/30">
            <CardContent className="py-8 text-center">
              <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-bold text-foreground">Hasil Disembunyikan</h2>
              <p className="mb-1 text-sm text-muted-foreground">
                Pemilihan tertutup — perolehan suara dibuka setelah hasil dipublikasikan.
              </p>
              {myChoiceName && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/15 px-4 py-2 text-sm font-semibold text-success-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  Pilihanmu: {myChoiceName}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Perolehan Suara</span>
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                Total: {isRedacted ? '?' : totalVotes}
              </Badge>
            </CardTitle>
            <CardDescription>
              {isPairMode
                ? `${pairResults.length} pasangan kandidat terdaftar`
                : `${results.length} kandidat terdaftar`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(isPairMode ? pairResults.length : results.length) === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isPairMode ? 'Belum ada pasangan kandidat terdaftar.' : 'Belum ada kandidat yang terdaftar.'}
                </p>
              </div>
            ) : isPairMode ? (
              pairResults.map((result, index) => {
                const safeVotes = Number(result.votes) || 0;
                const pct = safePercent(safeVotes, totalVotes);
                return (
                  <div key={result.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{result.name}</p>
                          <p className="text-sm text-muted-foreground">{result.members.join(' • ')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{isRedacted ? '?' : safeVotes}</p>
                        <p className="text-xs text-muted-foreground">{isRedacted ? '?' : `${pct}%`}</p>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${isRedacted ? 'bg-muted-foreground/30' : 'bg-primary'}`}
                        style={{ width: `${isRedacted ? 0 : pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              results.map((result, index) => {
                const safeVotes = Number(result.votes) || 0;
                const pct = safePercent(safeVotes, totalVotes);
                return (
                  <div key={result.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{result.name}</p>
                          <p className="text-sm text-muted-foreground">{result.studentId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{isRedacted ? '?' : safeVotes}</p>
                        <p className="text-xs text-muted-foreground">{isRedacted ? '?' : `${pct}%`}</p>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${isRedacted ? 'bg-muted-foreground/30' : 'bg-primary'}`}
                        style={{ width: `${isRedacted ? 0 : pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Suara Masuk</span>
                <span className="font-bold text-foreground">{isRedacted ? 'Disembunyikan' : totalVotes}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
