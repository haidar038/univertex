import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Vote, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function VoterDashboard() {
  const { profile } = useAuth();
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [closedEvents, setClosedEvents] = useState<any[]>([]);
  const [votedEvents, setVotedEvents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchEvents();
    }
  }, [profile]);

  const fetchEvents = async () => {
    try {
      // Get user's class eligible events
      const { data: eligibleGroups } = await supabase
        .from('event_voter_groups')
        .select('event_id')
        .eq('class_id', profile?.class_id || '');

      const eligibleEventIds = eligibleGroups?.map((g) => g.event_id) || [];

      // Fetch active events
      const { data: activeData } = await supabase
        .from('election_events')
        .select('*')
        .eq('status', 'active')
        .in('id', eligibleEventIds);

      // Fetch closed events
      const { data: closedData } = await supabase
        .from('election_events')
        .select('*')
        .eq('status', 'closed')
        .in('id', eligibleEventIds);

      // Check which events user has voted in
      const { data: votes } = await supabase
        .from('votes')
        .select('event_id')
        .eq('voter_id', profile?.id || '');

      const votedSet = new Set(votes?.map((v) => v.event_id) || []);

      setActiveEvents(activeData || []);
      setClosedEvents(closedData || []);
      setVotedEvents(votedSet);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasVoted = (eventId: string) => votedEvents.has(eventId);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Selamat datang, {profile?.full_name}
        </h1>
        <p className="text-muted-foreground">
          Lihat pemilihan yang tersedia dan berikan suara Anda
        </p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Memuat...</div>
      ) : (
        <div className="space-y-8">
          {/* Active Elections */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-foreground">Pemilihan Aktif</h2>
            {activeEvents.length === 0 ? (
              <Card>
                <CardContent className="flex min-h-[200px] flex-col items-center justify-center py-12">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Tidak ada pemilihan aktif saat ini
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {activeEvents.map((event) => (
                  <Card key={event.id} className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        {hasVoted(event.id) ? (
                          <Badge className="bg-success gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Sudah Memilih
                          </Badge>
                        ) : (
                          <Badge className="bg-primary">Aktif</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Berakhir: {format(new Date(event.end_time), 'dd MMM yyyy HH:mm', { locale: id })}
                      </div>
                      {hasVoted(event.id) ? (
                        <div className="rounded-lg bg-success/10 p-3 text-center">
                          <p className="text-sm font-medium text-success-foreground">
                            Terima kasih telah memberikan suara!
                          </p>
                        </div>
                      ) : (
                        <Link to={`/app/vote/${event.id}`}>
                          <Button className="w-full gap-2">
                            <Vote className="h-4 w-4" />
                            Berikan Suara
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Closed Elections */}
          {closedEvents.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-bold text-foreground">Hasil Pemilihan</h2>
              <div className="grid gap-6 md:grid-cols-2">
                {closedEvents.map((event) => (
                  <Card key={event.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <Badge variant="secondary">Selesai</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Link to={`/app/results/${event.id}`}>
                        <Button variant="outline" className="w-full">
                          Lihat Hasil
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
