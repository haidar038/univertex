import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, ArrowLeft, Lock, Eye, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function PublicResultsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewResults, setCanViewResults] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchResults();
    }
  }, [eventId]);

  const fetchResults = async () => {
    try {
      // Fetch event data
      const { data: eventData, error: eventError } = await supabase
        .from('election_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      setEvent(eventData);

      // Check access permissions
      const isActive = eventData.status === 'active';
      const isClosed = eventData.status === 'closed';
      const isOpen = eventData.election_type === 'open';
      const hasPublicResults = eventData.public_results;

      // Determine if user can view results
      // For public page:
      // - Can view if election is open (active)
      // - Can view if election is closed AND has public_results = true
      const canView = (isActive && isOpen) || (isClosed && hasPublicResults);
      setCanViewResults(canView);

      if (!canView) {
        setLoading(false);
        return;
      }

      // Fetch candidates and votes
      const { data: candidates } = await supabase
        .from('candidates')
        .select('id, vision, mission, photo_storage_path, photo_url, profiles(full_name, student_id, department)')
        .eq('event_id', eventId)
        .eq('status', 'approved');

      if (!candidates) return;

      const resultsWithVotes = await Promise.all(
        candidates.map(async (candidate) => {
          const { count } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('candidate_id', candidate.id);

          return {
            id: candidate.id,
            name: (candidate.profiles as any).full_name,
            studentId: (candidate.profiles as any).student_id,
            department: (candidate.profiles as any).department,
            votes: count || 0,
          };
        })
      );

      resultsWithVotes.sort((a, b) => b.votes - a.votes);

      setResults(resultsWithVotes);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/5">
        <p className="text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/5">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground">Pemilihan tidak ditemukan</p>
            <Button asChild className="mt-4">
              <Link to="/">Kembali ke Beranda</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canViewResults) {
    const isActive = event.status === 'active';
    const isClosed = event.status === 'closed';

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 py-16">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-8 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Beranda
          </Button>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-start justify-between mb-4">
                <CardTitle className="text-2xl">{event.title}</CardTitle>
                <Badge variant={isActive ? 'default' : 'secondary'}>
                  {isActive ? 'Aktif' : 'Selesai'}
                </Badge>
              </div>
              <CardDescription>{event.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Hasil Tidak Tersedia</h3>
                  <p className="text-muted-foreground max-w-md">
                    {isActive && event.election_type === 'closed'
                      ? 'Hasil pemilihan ini tidak ditampilkan secara publik selama pemilihan berlangsung. Hasil akan tersedia setelah pemilihan ditutup.'
                      : isClosed && !event.public_results
                      ? 'Hasil pemilihan ini bersifat privat dan hanya dapat dilihat oleh peserta yang terdaftar.'
                      : 'Hasil pemilihan ini tidak tersedia untuk umum.'}
                  </p>
                  <div className="pt-4">
                    <Button asChild>
                      <Link to="/login">Login untuk Melihat Hasil</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    Periode: {format(new Date(event.start_time), "dd MMM yyyy HH:mm", { locale: id })} -{' '}
                    {format(new Date(event.end_time), "dd MMM yyyy HH:mm", { locale: id })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>Jenis: Pemilihan {event.election_type === 'open' ? 'Terbuka' : 'Tertutup'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const winner = results[0];
  const isActive = event.status === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-16">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-8 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </Button>

        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                {isActive ? 'Hasil Sementara' : 'Hasil Pemilihan'}
              </h1>
              {isActive && (
                <Badge variant="default" className="gap-1">
                  <Eye className="h-3 w-3" />
                  Live
                </Badge>
              )}
            </div>
            <p className="text-lg text-muted-foreground">{event.title}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {format(new Date(event.start_time), "dd MMM yyyy", { locale: id })} -{' '}
              {format(new Date(event.end_time), "dd MMM yyyy", { locale: id })}
            </p>
          </div>

          {isActive && (
            <Card className="mb-8 bg-primary/10 border-primary/20">
              <CardContent className="py-4">
                <p className="text-sm text-center text-foreground">
                  <strong>Catatan:</strong> Ini adalah hasil sementara. Hasil dapat berubah hingga pemilihan ditutup.
                </p>
              </CardContent>
            </Card>
          )}

          {winner && totalVotes > 0 && (
            <Card className="mb-8 border-primary/50 bg-gradient-to-br from-card to-primary/10">
              <CardContent className="py-8 text-center">
                <Trophy className="mx-auto mb-4 h-16 w-16 text-primary" />
                <h2 className="mb-2 text-2xl font-bold text-foreground">
                  {isActive ? 'Posisi Teratas' : 'Pemenang'}
                </h2>
                <p className="mb-1 text-xl font-semibold text-primary">{winner.name}</p>
                <p className="mb-1 text-sm text-muted-foreground">{winner.studentId}</p>
                {winner.department && (
                  <p className="mb-4 text-sm text-muted-foreground">{winner.department}</p>
                )}
                <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2">
                  <Users className="h-4 w-4 text-primary-foreground" />
                  <span className="font-bold text-primary-foreground">
                    {winner.votes} suara ({totalVotes > 0 ? Math.round((winner.votes / totalVotes) * 100) : 0}%)
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Perolehan Suara</span>
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  Total: {totalVotes}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {results.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Belum ada suara yang masuk</p>
                </div>
              ) : (
                results.map((result, index) => (
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
                        <p className="font-bold text-foreground">{result.votes}</p>
                        <p className="text-xs text-muted-foreground">
                          {totalVotes > 0 ? Math.round((result.votes / totalVotes) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: totalVotes > 0 ? `${(result.votes / totalVotes) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Button asChild variant="outline">
              <Link to="/">Kembali ke Beranda</Link>
            </Button>
          </div>
        </div>
      </div>

      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>&copy; 2025 Sistem E-Voting Universitas. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
