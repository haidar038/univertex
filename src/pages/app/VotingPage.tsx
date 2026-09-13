import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Vote, User, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCandidatePhotoUrl } from '@/lib/candidate-helpers';
import { fetchPairsWithMembers, getPairDisplayName, getPairPositionLabel, type PairWithMembers } from '@/lib/candidate-pair-helpers';
import { logAudit } from '@/lib/audit';

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'registration' | 'voting' | 'counting' | 'published' | 'archived';
  start_time: string;
  end_time: string;
  election_type: 'open' | 'closed';
  show_results_after_voting: boolean;
  use_pairs: boolean;
}

interface CandidateRow {
  id: string;
  vision: string | null;
  mission: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  profiles?: { full_name: string; student_id: string } | null;
}

export default function VotingPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [pairs, setPairs] = useState<PairWithMembers[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [alreadyVotedCandidateId, setAlreadyVotedCandidateId] = useState<string | null>(null);
  const [alreadyVotedPairId, setAlreadyVotedPairId] = useState<string | null>(null);
  const [notEligible, setNotEligible] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  // Tick the "now" timer once per minute so countdown / "voting closed" status updates.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (eventId && profile) {
      fetchEventAndCandidates();
    }
  }, [eventId, profile]);

  const fetchEventAndCandidates = async () => {
    if (!eventId || !profile) return;

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('election_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) throw eventError;
      if (!eventData) {
        setEvent(null);
        return;
      }
      setEvent(eventData as EventRow);

      // Eligibility check: voter must be in event_voter_groups for this event.
      const { data: eligibility } = await supabase
        .from('event_voter_groups')
        .select('event_id')
        .eq('event_id', eventId)
        .eq('class_id', profile.class_id || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();
      setNotEligible(!eligibility);

      // Already-voted check (cheap, avoids surprises).
      const { data: voteRow } = await supabase
        .from('votes')
        .select('candidate_id, pair_id')
        .eq('voter_id', profile.id)
        .eq('event_id', eventId)
        .maybeSingle();

      if (voteRow) {
        setHasVoted(true);
        setAlreadyVotedCandidateId(voteRow.candidate_id);
        setAlreadyVotedPairId(voteRow.pair_id);
      }

      if (eventData.use_pairs) {
        // Mode pasangan: fetch approved pairs with member candidates embedded
        const pairsData = await fetchPairsWithMembers(eventId, { approvedOnly: true });
        setPairs(pairsData);
        setCandidates([]);
      } else {
        const { data: candidatesData } = await supabase
          .from('candidates')
          .select('*, profiles(full_name, student_id)')
          .eq('event_id', eventId)
          .eq('status', 'approved');

        setCandidates((candidatesData || []) as CandidateRow[]);
        setPairs([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---- derived state ---------------------------------------------------
  const eventStartMs = event ? new Date(event.start_time).getTime() : NaN;
  const eventEndMs = event ? new Date(event.end_time).getTime() : NaN;
  const eventIsActive = event?.status === 'voting';
  const eventIsOpen = eventStartMs <= now;
  const eventIsClosed = now >= eventEndMs;
  const isWithinWindow = eventIsActive && eventIsOpen && !eventIsClosed;
  const votingDisabled =
    !event || !eventIsActive || eventIsClosed || !eventIsOpen || notEligible || hasVoted;
  const showClosedNotice = event && eventIsActive && eventIsOpen && eventIsClosed;
  const showNotStartedNotice = event && eventIsActive && !eventIsOpen;
  const showInactiveNotice = event && !eventIsActive;

  const handleVote = async () => {
    const isPairMode = !!event?.use_pairs;
    const choice = isPairMode ? selectedPair : selectedCandidate;
    if (!choice || !profile || !eventId || votingDisabled) return;

    setSubmitting(true);
    try {
      // Constraint votes_single_or_pair: a vote is either for a candidate OR
      // for a pair — never both, never neither.
      const { error } = await supabase.from('votes').insert(
        isPairMode
          ? { voter_id: profile.id, pair_id: selectedPair!, event_id: eventId }
          : { voter_id: profile.id, candidate_id: selectedCandidate!, event_id: eventId }
      );

      if (error) {
        // Prefer structured code matching (Postgres unique violation)
        if (error.code === '23505') {
          toast.error('Anda sudah memberikan suara untuk pemilihan ini');
          setHasVoted(true);
        } else if (error.code === 'P0001') {
          // Timeline enforcement trigger
          toast.error('Waktu pemilihan sudah berakhir atau belum dimulai');
          await fetchEventAndCandidates();
        } else if (error.code === '42501') {
          // P0-01: DB menolak non-DPT (trigger tg_enforce_vote_timeline).
          // Jangan refetch eligibility di sini: query cepat UI (event_voter_groups)
          // bisa bilang eligible sementara DB (is_eligible_voter) menolak — DB menang.
          toast.error('Anda tidak terdaftar di DPT pemilihan ini. Hubungi panitia.');
          setNotEligible(true);
        } else {
          toast.error(error.message || 'Gagal memberikan suara');
        }
        return;
      }

      toast.success('Suara Anda berhasil tercatat!');
      setHasVoted(true);

      // Audit trail. Metadata hanya event_id — jangan simpan candidate/pair
      // demi menjaga kerahasiaan suara (secret ballot).
      logAudit({
        action: 'vote.cast',
        description: 'Vote cast',
        category: 'election',
        targetType: 'election_events',
        targetId: eventId,
        metadata: { event_id: eventId },
      });

      if (event?.election_type === 'open' || event?.show_results_after_voting) {
        navigate(`/app/results/${eventId}`);
      } else {
        navigate('/app/dashboard');
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      toast.error('Terjadi kesalahan tak terduga. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-2" />
        <p className="text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Pemilihan tidak ditemukan.</AlertDescription>
        </Alert>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/app/dashboard')}>
          Kembali ke Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">{event.title}</h1>
          <p className="text-muted-foreground">{event.description || 'Pilih satu kandidat yang Anda dukung'}</p>
        </div>

        {/* Status banners */}
        {notEligible && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Anda tidak termasuk dalam Daftar Pemilih Tetap (DPT) untuk pemilihan ini.
              Hubungi admin jika Anda merasa ini keliru.
            </AlertDescription>
          </Alert>
        )}

        {hasVoted && (
          <Alert className="mb-6 border-success/40 bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success-foreground">
              Anda sudah memberikan suara pada pemilihan ini.
            </AlertDescription>
          </Alert>
        )}

        {showInactiveNotice && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {event.status === 'draft' && 'Pemilihan ini masih dalam tahap draf dan belum dipublikasi.'}
              {event.status === 'registration' && 'Pemilihan ini sedang dalam tahap pendaftaran. Voting belum dibuka.'}
              {event.status === 'counting' && 'Voting telah berakhir. Saat ini sedang dalam tahap penghitungan suara.'}
              {event.status === 'published' && 'Pemilihan ini sudah selesai dan hasilnya telah dipublikasikan.'}
              {event.status === 'archived' && 'Pemilihan ini sudah diarsipkan.'}
            </AlertDescription>
          </Alert>
        )}

        {showNotStartedNotice && (
          <Alert variant="destructive" className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Pemilihan belum dimulai. Akan dibuka pada{' '}
              <strong>
                {new Date(event.start_time).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
              </strong>
              .
            </AlertDescription>
          </Alert>
        )}

        {showClosedNotice && (
          <Alert variant="destructive" className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Waktu pemilihan sudah berakhir pada{' '}
              <strong>
                {new Date(event.end_time).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
              </strong>
              . Suara tidak dapat lagi diberikan.
            </AlertDescription>
          </Alert>
        )}

        {isWithinWindow && !hasVoted && (
          <div className="mb-8 rounded-lg bg-primary/10 p-4 text-sm">
            <p className="font-medium text-foreground">
              <Vote className="mb-1 mr-2 inline h-4 w-4" />
              Anda hanya dapat memberikan satu suara. Pilihan tidak dapat diubah setelah dikonfirmasi.
            </p>
          </div>
        )}

        {event.use_pairs ? (
          pairs.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-50 items-center justify-center">
                <p className="text-muted-foreground">Belum ada pasangan kandidat yang disetujui untuk pemilihan ini.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pairs.map((pair) => {
                const isSelected = selectedPair === pair.id;
                const isAlreadyChosen = alreadyVotedPairId === pair.id;

                return (
                  <Card
                    key={pair.id}
                    className={`transition-all ${votingDisabled
                      ? 'opacity-60 cursor-not-allowed'
                      : `cursor-pointer ${isSelected ? 'border-primary bg-primary/5 shadow-primary' : 'hover:shadow-lg'}`
                      }`}
                    onClick={() => {
                      if (!votingDisabled) setSelectedPair(pair.id);
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">
                            #{pair.number ?? '-'} {pair.label || 'Pasangan Kandidat'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">{getPairDisplayName(pair)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <div className="rounded-full bg-primary p-2">
                              <Vote className="h-5 w-5 text-primary-foreground" />
                            </div>
                          )}
                          {isAlreadyChosen && (
                            <div className="rounded-full bg-success p-2">
                              <CheckCircle2 className="h-5 w-5 text-success-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {pair.members.map((member) => {
                          const photoUrl = getCandidatePhotoUrl(
                            member.candidates?.photo_storage_path,
                            member.candidates?.photo_url
                          );
                          return (
                            <div key={member.id} className="flex items-start gap-3 rounded-lg border p-3">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20">
                                {photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt={member.candidates?.profiles?.full_name ?? ''}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-primary">
                                    <User className="h-7 w-7 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <Badge variant="outline" className="mb-1">
                                  {getPairPositionLabel(member.position)}
                                </Badge>
                                <p className="font-medium text-foreground">
                                  {member.candidates?.profiles?.full_name || 'Tanpa nama'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {member.candidates?.profiles?.student_id || '-'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div>
                        <h3 className="mb-2 font-semibold text-foreground">Visi</h3>
                        <p className="text-sm text-muted-foreground">{pair.vision || 'Belum diisi'}</p>
                      </div>
                      <div>
                        <h3 className="mb-2 font-semibold text-foreground">Misi</h3>
                        <p className="text-sm text-muted-foreground">{pair.mission || 'Belum diisi'}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        ) : candidates.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-50 items-center justify-center">
              <p className="text-muted-foreground">Belum ada kandidat yang disetujui untuk pemilihan ini.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {candidates.map((candidate) => {
              const photoUrl = getCandidatePhotoUrl(candidate.photo_storage_path, candidate.photo_url);
              const isSelected = selectedCandidate === candidate.id;
              const isAlreadyChosen = alreadyVotedCandidateId === candidate.id;

              return (
                <Card
                  key={candidate.id}
                  className={`transition-all ${votingDisabled
                    ? 'opacity-60 cursor-not-allowed'
                    : `cursor- ${isSelected ? 'border-primary bg-primary/5 shadow-primary' : 'hover:shadow-lg'}`
                    }`}
                  onClick={() => {
                    if (!votingDisabled) setSelectedCandidate(candidate.id);
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={`Foto ${candidate.profiles?.full_name ?? ''}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-primary">
                            <User className="h-10 w-10 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl">{candidate.profiles?.full_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{candidate.profiles?.student_id}</p>
                      </div>
                      {isSelected && (
                        <div className="rounded-full bg-primary p-2">
                          <Vote className="h-5 w-5 text-primary-foreground" />
                        </div>
                      )}
                      {isAlreadyChosen && (
                        <div className="rounded-full bg-success p-2">
                          <CheckCircle2 className="h-5 w-5 text-success-foreground" />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="mb-2 font-semibold text-foreground">Visi</h3>
                      <p className="text-sm text-muted-foreground">{candidate.vision || 'Belum diisi'}</p>
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold text-foreground">Misi</h3>
                      <p className="text-sm text-muted-foreground">{candidate.mission || 'Belum diisi'}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!votingDisabled && (selectedCandidate || selectedPair) && (
          <div className="mt-8 flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate('/app/dashboard')}>
              Batal
            </Button>
            <Button onClick={() => setShowConfirm(true)} className="gap-2">
              <Vote className="h-4 w-4" />
              Konfirmasi Pilihan
            </Button>
          </div>
        )}

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Pilihan Anda</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin dengan pilihan Anda? Keputusan ini tidak dapat diubah
                setelah dikonfirmasi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleVote} disabled={submitting || votingDisabled}>
                {submitting ? 'Memproses...' : 'Ya, Saya Yakin'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
