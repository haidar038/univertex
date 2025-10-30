import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, GraduationCap } from 'lucide-react';

export default function AdminEventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [voterGroups, setVoterGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const [eventResult, candidatesResult, voterGroupsResult] = await Promise.all([
        supabase.from('election_events').select('*').eq('id', id).single(),
        supabase
          .from('candidates')
          .select('*, profiles(full_name, student_id)')
          .eq('event_id', id),
        supabase
          .from('event_voter_groups')
          .select('*, classes(name, faculty)')
          .eq('event_id', id),
      ]);

      if (eventResult.error) throw eventResult.error;
      
      setEvent(eventResult.data);
      setCandidates(candidatesResult.data || []);
      setVoterGroups(voterGroupsResult.data || []);
    } catch (error) {
      console.error('Error fetching event details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Memuat...</div>;
  }

  if (!event) {
    return <div className="p-8 text-center">Event tidak ditemukan</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">{event.title}</h1>
            <p className="text-muted-foreground">{event.description}</p>
          </div>
          <Badge
            className={
              event.status === 'active'
                ? 'bg-success'
                : event.status === 'closed'
                ? 'bg-secondary'
                : ''
            }
          >
            {event.status === 'active' ? 'Aktif' : event.status === 'closed' ? 'Selesai' : 'Draft'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="candidates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="candidates">Kandidat</TabsTrigger>
          <TabsTrigger value="voters">Pemilih (DPT)</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Daftar Kandidat</h2>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Tambah Kandidat
            </Button>
          </div>

          {candidates.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[200px] flex-col items-center justify-center py-12">
                <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Belum ada kandidat</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {candidates.map((candidate) => (
                <Card key={candidate.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {(candidate.profiles as any).full_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {(candidate.profiles as any).student_id}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Visi:</p>
                        <p className="text-sm text-muted-foreground">
                          {candidate.vision || 'Belum diisi'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Misi:</p>
                        <p className="text-sm text-muted-foreground">
                          {candidate.mission || 'Belum diisi'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="voters" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Daftar Pemilih Tetap (DPT)</h2>
            <Button className="gap-2">
              <GraduationCap className="h-4 w-4" />
              Tambah Grup Pemilih
            </Button>
          </div>

          {voterGroups.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[200px] flex-col items-center justify-center py-12">
                <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Belum ada grup pemilih</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {voterGroups.map((group) => (
                <Card key={group.id}>
                  <CardContent className="p-6">
                    <h3 className="mb-2 font-bold text-foreground">
                      {(group.classes as any).name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {(group.classes as any).faculty}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
