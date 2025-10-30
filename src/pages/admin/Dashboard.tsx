import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Vote as VoteIcon, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalVoters: 0,
    totalEvents: 0,
    activeEvents: 0,
    totalVotes: 0,
  });
  const [liveVotes, setLiveVotes] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    setupRealtimeVotes();
  }, []);

  const fetchStats = async () => {
    try {
      const [votersResult, eventsResult, activeEventsResult, votesResult] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('election_events').select('*', { count: 'exact', head: true }),
        supabase.from('election_events').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('votes').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalVoters: votersResult.count || 0,
        totalEvents: eventsResult.count || 0,
        activeEvents: activeEventsResult.count || 0,
        totalVotes: votesResult.count || 0,
      });

      // Fetch live vote counts for active events
      if (activeEventsResult.count && activeEventsResult.count > 0) {
        const { data: activeEvents } = await supabase
          .from('election_events')
          .select('id, title')
          .eq('status', 'active');

        if (activeEvents) {
          const voteCounts = await Promise.all(
            activeEvents.map(async (event) => {
              const { data: candidates } = await supabase
                .from('candidates')
                .select('id, user_id, profiles(full_name)')
                .eq('event_id', event.id);

              if (!candidates) return null;

              const candidatesWithVotes = await Promise.all(
                candidates.map(async (candidate) => {
                  const { count } = await supabase
                    .from('votes')
                    .select('*', { count: 'exact', head: true })
                    .eq('candidate_id', candidate.id);

                  return {
                    name: (candidate.profiles as any).full_name,
                    votes: count || 0,
                  };
                })
              );

              return {
                eventTitle: event.title,
                candidates: candidatesWithVotes,
              };
            })
          );

          setLiveVotes(voteCounts.filter(Boolean));
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const setupRealtimeVotes = () => {
    const channel = supabase
      .channel('vote-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground">Pantau statistik dan aktivitas pemilihan real-time</p>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pemilih
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalVoters}</div>
            <p className="text-xs text-muted-foreground">Terdaftar di sistem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Acara
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Pemilihan dibuat</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">
              Acara Aktif
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.activeEvents}</div>
            <p className="text-xs text-muted-foreground">Sedang berlangsung</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Suara
            </CardTitle>
            <VoteIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalVotes}</div>
            <p className="text-xs text-muted-foreground">Telah masuk</p>
          </CardContent>
        </Card>
      </div>

      {liveVotes.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-4 text-xl font-bold text-foreground">Live Vote Count</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {liveVotes.map((event, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="text-lg">{event?.eventTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {event?.candidates.map((candidate: any, cIdx: number) => (
                        <div key={cIdx} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">
                            {candidate.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-gradient-primary transition-all"
                                style={{
                                  width: `${(candidate.votes / Math.max(...event.candidates.map((c: any) => c.votes), 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="min-w-[3rem] text-sm font-bold text-primary">
                              {candidate.votes} suara
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
