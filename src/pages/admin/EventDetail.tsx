import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, GraduationCap, Edit, BarChart3, CheckCircle2, AlertCircle, Clock, User as UserIcon } from 'lucide-react';
import { AddCandidateDialog } from '@/components/admin/events/AddCandidateDialog';
import { AssignVoterGroupsDialog } from '@/components/admin/events/AssignVoterGroupsDialog';
import { EditCandidateDialog } from '@/components/admin/events/EditCandidateDialog';
import { EventResultsView } from '@/components/admin/events/EventResultsView';
import { ApproveCandidateDialog } from '@/components/admin/events/ApproveCandidateDialog';
import { getCandidatePhotoUrl, getCandidateStatusInfo } from '@/lib/candidate-helpers';

export default function AdminEventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [voterGroups, setVoterGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [assignGroupsOpen, setAssignGroupsOpen] = useState(false);
  const [editCandidateOpen, setEditCandidateOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

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

  const handleEditCandidate = (candidate: any) => {
    setSelectedCandidate(candidate);
    setEditCandidateOpen(true);
  };

  const handleApproveCandidate = (candidate: any) => {
    setSelectedCandidate(candidate);
    setApproveDialogOpen(true);
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
          <TabsTrigger value="results">
            <BarChart3 className="mr-2 h-4 w-4" />
            Hasil Pemilihan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Daftar Kandidat</h2>
            <Button className="gap-2" onClick={() => setAddCandidateOpen(true)}>
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
              {candidates.map((candidate) => {
                const statusInfo = getCandidateStatusInfo(candidate.status || 'pending');
                const StatusIcon = candidate.status === 'approved' ? CheckCircle2 :
                                 candidate.status === 'rejected' ? AlertCircle : Clock;
                const photoUrl = getCandidatePhotoUrl(candidate.photo_storage_path, candidate.photo_url);

                return (
                  <Card key={candidate.id}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {/* Photo */}
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20">
                          {photoUrl ? (
                            <img src={photoUrl} alt="Foto kandidat" className="h-full w-full object-cover" />
                          ) : (
                            <UserIcon className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">
                                {(candidate.profiles as any).full_name}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {(candidate.profiles as any).student_id}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCandidate(candidate)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <Badge variant={statusInfo.variant as any} className="mt-2 gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
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

                      {/* Approval button for pending candidates */}
                      {candidate.status === 'pending' && (
                        <Button
                          className="mt-2 w-full gap-2"
                          variant="default"
                          onClick={() => handleApproveCandidate(candidate)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Tinjau & Setujui
                        </Button>
                      )}

                      {/* Re-approval button for rejected candidates */}
                      {candidate.status === 'rejected' && (
                        <div className="mt-2 space-y-2">
                          {candidate.rejection_reason && (
                            <p className="text-xs text-destructive">
                              <strong>Ditolak:</strong> {candidate.rejection_reason}
                            </p>
                          )}
                          <Button
                            className="w-full gap-2"
                            variant="outline"
                            onClick={() => handleApproveCandidate(candidate)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Tinjau Ulang
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="voters" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Daftar Pemilih Tetap (DPT)</h2>
            <Button className="gap-2" onClick={() => setAssignGroupsOpen(true)}>
              <GraduationCap className="h-4 w-4" />
              Kelola Grup Pemilih
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

        <TabsContent value="results">
          {id && (
            <EventResultsView
              eventId={id}
              eventTitle={event?.title || ''}
              eventStatus={event?.status || 'draft'}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {id && (
        <>
          <AddCandidateDialog
            open={addCandidateOpen}
            onOpenChange={setAddCandidateOpen}
            eventId={id}
            onSuccess={fetchEventDetails}
          />
          <AssignVoterGroupsDialog
            open={assignGroupsOpen}
            onOpenChange={setAssignGroupsOpen}
            eventId={id}
            onSuccess={fetchEventDetails}
          />
          <EditCandidateDialog
            open={editCandidateOpen}
            onOpenChange={setEditCandidateOpen}
            candidate={selectedCandidate}
            onSuccess={fetchEventDetails}
          />
          <ApproveCandidateDialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
            candidate={selectedCandidate}
            onSuccess={fetchEventDetails}
          />
        </>
      )}
    </div>
  );
}
