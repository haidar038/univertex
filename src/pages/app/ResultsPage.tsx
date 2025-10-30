import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users } from 'lucide-react';

export default function ResultsPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetchResults();
    }
  }, [eventId]);

  const fetchResults = async () => {
    try {
      const { data: eventData } = await supabase
        .from('election_events')
        .select('*')
        .eq('id', eventId)
        .single();

      const { data: candidates } = await supabase
        .from('candidates')
        .select('id, profiles(full_name, student_id)')
        .eq('event_id', eventId);

      if (!candidates) return;

      const resultsWithVotes = await Promise.all(
        candidates.map(async (candidate) => {
          const { count } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('candidate_id', candidate.id);

          return {
            name: (candidate.profiles as any).full_name,
            studentId: (candidate.profiles as any).student_id,
            votes: count || 0,
          };
        })
      );

      resultsWithVotes.sort((a, b) => b.votes - a.votes);

      setEvent(eventData);
      setResults(resultsWithVotes);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Memuat...</div>;
  }

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const winner = results[0];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Hasil Pemilihan</h1>
          <p className="text-lg text-muted-foreground">{event?.title}</p>
        </div>

        {winner && (
          <Card className="mb-8 border-primary/50 bg-gradient-to-br from-card to-primary/10">
            <CardContent className="py-8 text-center">
              <Trophy className="mx-auto mb-4 h-16 w-16 text-primary" />
              <h2 className="mb-2 text-2xl font-bold text-foreground">Pemenang</h2>
              <p className="mb-1 text-xl font-semibold text-primary">{winner.name}</p>
              <p className="mb-4 text-sm text-muted-foreground">{winner.studentId}</p>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2">
                <Users className="h-4 w-4 text-primary-foreground" />
                <span className="font-bold text-primary-foreground">
                  {winner.votes} suara ({Math.round((winner.votes / totalVotes) * 100)}%)
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Perolehan Suara</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{result.name}</p>
                    <p className="text-sm text-muted-foreground">{result.studentId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{result.votes}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalVotes > 0 ? Math.round((result.votes / totalVotes) * 100) : 0}%
                    </p>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-primary transition-all"
                    style={{
                      width: `${totalVotes > 0 ? (result.votes / totalVotes) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Suara</span>
                <span className="font-bold text-foreground">{totalVotes}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
