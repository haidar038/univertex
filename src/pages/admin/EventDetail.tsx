import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, UserPlus, GraduationCap, Edit, BarChart3, CheckCircle2, AlertCircle, Clock, User as UserIcon, ShieldCheck, ListChecks, Settings, History, Plus, Trash2, ScrollText, Layers } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AddCandidateDialog } from '@/components/admin/events/AddCandidateDialog';
import { CreatePairDialog } from '@/components/admin/events/CreatePairDialog';
import { EditPairDialog } from '@/components/admin/events/EditPairDialog';
import { ApprovePairDialog } from '@/components/admin/events/ApprovePairDialog';
import { fetchPairsWithMembers, getPairDisplayName, getPairPositionLabel, type PairWithMembers } from '@/lib/candidate-pair-helpers';
import { AssignVoterGroupsDialog } from '@/components/admin/events/AssignVoterGroupsDialog';
import { EditCandidateDialog } from '@/components/admin/events/EditCandidateDialog';
import { EventResultsView } from '@/components/admin/events/EventResultsView';
import { ApproveCandidateDialog } from '@/components/admin/events/ApproveCandidateDialog';
import { getCandidatePhotoUrl, getCandidateStatusInfo } from '@/lib/candidate-helpers';
import {
  ELECTION_STATUSES,
  STATUS_LABEL,
  STATUS_COLOR,
  ALLOWED_TRANSITIONS,
  STATUS_ACTION_LABEL,
  canTransition,
  type ElectionStatus,
} from '@/lib/election-state';
import { useAuth } from '@/hooks/useAuth';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function AdminEventDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [voterGroups, setVoterGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [assignGroupsOpen, setAssignGroupsOpen] = useState(false);
  const [editCandidateOpen, setEditCandidateOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  // Candidate pairs (pasangan calon)
  const [pairs, setPairs] = useState<PairWithMembers[]>([]);
  const [createPairOpen, setCreatePairOpen] = useState(false);
  const [editPairOpen, setEditPairOpen] = useState(false);
  const [approvePairOpen, setApprovePairOpen] = useState(false);
  const [deletePairOpen, setDeletePairOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState<PairWithMembers | null>(null);
  const [pendingUsePairs, setPendingUsePairs] = useState<boolean | null>(null);
  const [pairsBusy, setPairsBusy] = useState(false);

  // Phase 2 state
  const [transitions, setTransitions] = useState<any[]>([]);
  const [eligibilityRules, setEligibilityRules] = useState<any[]>([]);
  const [newRule, setNewRule] = useState<{ rule_type: string; rule_value: string; description: string }>({
    rule_type: 'class_id',
    rule_value: '',
    description: '',
  });
  const [scopeDraft, setScopeDraft] = useState<{ scope_type: string; scope_id: string }>({ scope_type: '', scope_id: '' });
  const [stateBusy, setStateBusy] = useState(false);

  const currentStatus: ElectionStatus | null = event && ELECTION_STATUSES.includes(event.status)
    ? (event.status as ElectionStatus)
    : null;
  const nextStates = currentStatus
    ? ALLOWED_TRANSITIONS[currentStatus].filter((s) => canTransition(currentStatus, s, isAdmin))
    : [];

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const [eventResult, candidatesResult, voterGroupsResult, pairsResult] = await Promise.all([
        supabase.from('election_events').select('*').eq('id', id).single(),
        supabase
          .from('candidates')
          .select('*, profiles(full_name, student_id)')
          .eq('event_id', id),
        supabase
          .from('event_voter_groups')
          .select('*, classes(name, faculty)')
          .eq('event_id', id),
        fetchPairsWithMembers(id),
      ]);

      if (eventResult.error) throw eventResult.error;

      setEvent(eventResult.data);
      setCandidates(candidatesResult.data || []);
      setVoterGroups(voterGroupsResult.data || []);
      setPairs(pairsResult);

      if (eventResult.data) {
        // scope_type/scope_id belum ada di generated types.ts (gap pre-existing)
        const eventData = eventResult.data as any;
        setScopeDraft({
          scope_type: eventData.scope_type ?? '',
          scope_id: eventData.scope_id ?? '',
        });
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhase2Data = async () => {
    if (!id) return;
    try {
      // Tabel phase2 belum terdaftar di generated types.ts — gunakan cast any
      const client = supabase as any;
      const [t, r] = await Promise.all([
        client
          .from('election_state_transitions')
          .select('*')
          .eq('election_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
        client
          .from('election_eligibility_rules')
          .select('*')
          .eq('election_id', id)
          .order('created_at', { ascending: false }),
      ]);
      setTransitions(t.data || []);
      setEligibilityRules(r.data || []);
    } catch (e) {
      console.error('Error fetching phase 2 data:', e);
    }
  };

  useEffect(() => {
    if (id) fetchPhase2Data();
  }, [id]);

  const handleTransitionState = async (to: ElectionStatus) => {
    if (!id || !event) return;
    setStateBusy(true);
    try {
      const { error } = await supabase.rpc('admin_transition_election_state', {
        p_election_id: id,
        p_to_status: to,
        p_reason: null,
      });
      if (error) throw error;
      toast.success(`Status diubah ke ${STATUS_LABEL[to]}`);
      await Promise.all([fetchEventDetails(), fetchPhase2Data()]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal mengubah status');
    } finally {
      setStateBusy(false);
    }
  };

  const handleAddRule = async () => {
    if (!id) return;
    if (!newRule.rule_value.trim()) {
      toast.error('rule_value harus diisi');
      return;
    }
    try {
      const { error } = await supabase.rpc('admin_add_eligibility_rule', {
        p_election_id: id,
        p_rule_type: newRule.rule_type,
        p_rule_value: newRule.rule_value.trim(),
        p_description: newRule.description.trim() || null,
      });
      if (error) throw error;
      toast.success('Rule eligibility ditambahkan');
      setNewRule({ rule_type: 'class_id', rule_value: '', description: '' });
      await fetchPhase2Data();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal menambah rule');
    }
  };

  const handleRemoveRule = async (ruleId: string) => {
    try {
      const { error } = await supabase.rpc('admin_remove_eligibility_rule', {
        p_rule_id: ruleId,
      });
      if (error) throw error;
      toast.success('Rule dihapus');
      await fetchPhase2Data();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal menghapus rule');
    }
  };

  const handleSaveScope = async () => {
    if (!id) return;
    if ((scopeDraft.scope_type === '') !== (scopeDraft.scope_id === '')) {
      toast.error('scope_type dan scope_id harus diisi bersamaan');
      return;
    }
    if (scopeDraft.scope_type && scopeDraft.scope_id) {
      const { data: ok, error: vErr } = await (supabase as any).rpc('validate_scope_id', {
        p_scope_type: scopeDraft.scope_type,
        p_scope_id: scopeDraft.scope_id,
      });
      if (vErr) {
        toast.error(vErr.message);
        return;
      }
      if (!ok) {
        toast.error('scope_id tidak valid untuk scope_type tersebut');
        return;
      }
    }
    try {
      const { error } = await supabase
        .from('election_events')
        .update({
          scope_type: scopeDraft.scope_type || null,
          scope_id: scopeDraft.scope_id || null,
        } as any)
        .eq('id', id);
      if (error) throw error;
      await logAudit({
        action: 'event.scope_change',
        description: `Event scope updated`,
        category: 'election',
        targetType: 'election_events',
        targetId: id,
        metadata: scopeDraft,
      });
      toast.success('Cakupan acara diperbarui');
      await fetchEventDetails();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal memperbarui cakupan');
    }
  };

  const handleToggleUsePairs = async () => {
    if (!id || pendingUsePairs === null) return;
    setPairsBusy(true);
    try {
      const { error } = await supabase
        .from('election_events')
        .update({ use_pairs: pendingUsePairs })
        .eq('id', id);
      if (error) throw error;
      await logAudit({
        action: 'event.use_pairs_change',
        description: `Candidate pairs mode ${pendingUsePairs ? 'enabled' : 'disabled'}`,
        category: 'election',
        targetType: 'election_events',
        targetId: id,
        metadata: { use_pairs: pendingUsePairs },
      });
      toast.success(pendingUsePairs ? 'Mode pasangan kandidat diaktifkan' : 'Mode pasangan kandidat dinonaktifkan');
      setPendingUsePairs(null);
      await fetchEventDetails();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal mengubah mode pasangan');
    } finally {
      setPairsBusy(false);
    }
  };

  const handleDeletePair = async () => {
    if (!selectedPair) return;
    setPairsBusy(true);
    try {
      const { error } = await supabase
        .from('candidate_pairs')
        .delete()
        .eq('id', selectedPair.id);
      if (error) throw error;
      await logAudit({
        action: 'candidate.pair.delete',
        description: `Deleted candidate pair: ${getPairDisplayName(selectedPair)}`,
        category: 'election',
        targetType: 'candidate_pairs',
        targetId: selectedPair.id,
        metadata: { event_id: id },
        severity: 'warning',
      });
      toast.success('Pasangan kandidat dihapus');
      setDeletePairOpen(false);
      setSelectedPair(null);
      await fetchEventDetails();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal menghapus pasangan');
    } finally {
      setPairsBusy(false);
    }
  };

  const handleEditCandidate = (candidate: any) => {
    setSelectedCandidate(candidate);
    setEditCandidateOpen(true);
  };

  const handleEditPair = (pair: PairWithMembers) => {
    setSelectedPair(pair);
    setEditPairOpen(true);
  };

  const handleApprovePair = (pair: PairWithMembers) => {
    setSelectedPair(pair);
    setApprovePairOpen(true);
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
          <Badge className={currentStatus ? STATUS_COLOR[currentStatus] : 'bg-muted'}>
            {currentStatus ? STATUS_LABEL[currentStatus] : event.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="candidates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="candidates">Kandidat</TabsTrigger>
          {event.use_pairs && <TabsTrigger value="pairs">Pasangan</TabsTrigger>}
          <TabsTrigger value="voters">Pemilih (DPT)</TabsTrigger>
          <TabsTrigger value="status">
            <Settings className="mr-2 h-4 w-4" />
            Status & Rules
          </TabsTrigger>
          <TabsTrigger value="results">
            <BarChart3 className="mr-2 h-4 w-4" />
            Hasil Pemilihan
          </TabsTrigger>
          <TabsTrigger value="staff" asChild>
            <Link to={`/admin/events/${id}/staff`}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Panitia & Observer
            </Link>
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
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20">
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

        <TabsContent value="pairs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Daftar Pasangan Kandidat</h2>
            <Button className="gap-2" onClick={() => setCreatePairOpen(true)}>
              <Plus className="h-4 w-4" />
              Tambah Pasangan
            </Button>
          </div>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium text-foreground">Mode Pasangan Kandidat</p>
                <p className="text-sm text-muted-foreground">
                  Saat aktif, pemilih memilih satu pasangan (ketua & wakil) alih-alih kandidat tunggal.
                </p>
              </div>
              <Switch
                checked={!!event.use_pairs}
                onCheckedChange={(checked) => setPendingUsePairs(checked)}
                disabled={pairsBusy}
              />
            </CardContent>
          </Card>

          {pairs.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[200px] flex-col items-center justify-center py-12">
                <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Belum ada pasangan kandidat</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pairs.map((pair) => {
                const statusInfo = getCandidateStatusInfo(pair.status);
                const StatusIcon = pair.status === 'approved' ? CheckCircle2 :
                  pair.status === 'rejected' ? AlertCircle : Clock;

                return (
                  <Card key={pair.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            #{pair.number ?? '-'} {pair.label || 'Pasangan'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {getPairDisplayName(pair)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleEditPair(pair)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => { setSelectedPair(pair); setDeletePairOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Badge variant={statusInfo.variant as any} className="mt-2 gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        {pair.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between rounded border p-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {member.candidates?.profiles?.full_name || 'Tanpa nama'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.candidates?.profiles?.student_id || '-'}
                              </p>
                            </div>
                            <Badge variant="outline">{getPairPositionLabel(member.position)}</Badge>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Visi:</p>
                        <p className="text-sm text-muted-foreground">{pair.vision || 'Belum diisi'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Misi:</p>
                        <p className="text-sm text-muted-foreground">{pair.mission || 'Belum diisi'}</p>
                      </div>

                      {pair.status === 'rejected' && pair.rejection_reason && (
                        <p className="text-xs text-destructive">
                          <strong>Ditolak:</strong> {pair.rejection_reason}
                        </p>
                      )}

                      {pair.status !== 'approved' && (
                        <Button
                          className="mt-2 w-full gap-2"
                          variant={pair.status === 'pending' ? 'default' : 'outline'}
                          onClick={() => handleApprovePair(pair)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {pair.status === 'pending' ? 'Tinjau & Setujui' : 'Tinjau Ulang'}
                        </Button>
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
              eventStatus={currentStatus ?? 'draft'}
            />
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                State Machine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status saat ini:</span>
                <Badge className={currentStatus ? STATUS_COLOR[currentStatus] : 'bg-muted'}>
                  {currentStatus ? STATUS_LABEL[currentStatus] : event.status}
                </Badge>
              </div>

              {nextStates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada transisi yang tersedia dari status ini.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {nextStates.map((to) => (
                    <Button
                      key={to}
                      variant="outline"
                      disabled={stateBusy}
                      onClick={() => handleTransitionState(to)}
                    >
                      {STATUS_ACTION_LABEL[to] ?? `Ke ${STATUS_LABEL[to]}`}
                    </Button>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Transisi otomatis (registration→voting, voting→counting) dilakukan oleh pg_cron setiap menit berdasarkan start_time / end_time.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" />
                Cakupan (Scope)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipe Scope</Label>
                  <Select
                    value={scopeDraft.scope_type || 'none'}
                    onValueChange={(v) => setScopeDraft((s) => ({
                      ...s,
                      scope_type: v === 'none' ? '' : v,
                      scope_id: v === 'none' ? '' : s.scope_id,
                    }))}
                  >
                    <SelectTrigger><SelectValue placeholder="(tidak ada)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(tidak ada)</SelectItem>
                      <SelectItem value="class">Kelas</SelectItem>
                      <SelectItem value="organization">Organisasi</SelectItem>
                      <SelectItem value="cohort">Angkatan</SelectItem>
                      <SelectItem value="program">Program Studi</SelectItem>
                      <SelectItem value="department">Departemen</SelectItem>
                      <SelectItem value="faculty">Fakultas</SelectItem>
                      <SelectItem value="university">Universitas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scope ID</Label>
                  <Input
                    placeholder="UUID atau kunci"
                    value={scopeDraft.scope_id}
                    onChange={(e) => setScopeDraft((s) => ({ ...s, scope_id: e.target.value }))}
                    disabled={!scopeDraft.scope_type}
                  />
                </div>
              </div>
              <Button onClick={handleSaveScope}>Simpan Cakupan</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Eligibility Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Rule Type</Label>
                  <Select
                    value={newRule.rule_type}
                    onValueChange={(v) => setNewRule((r) => ({ ...r, rule_type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class_id">class_id</SelectItem>
                      <SelectItem value="profile_id">profile_id</SelectItem>
                      <SelectItem value="department">department</SelectItem>
                      <SelectItem value="cohort">cohort</SelectItem>
                      <SelectItem value="organization">organization</SelectItem>
                      <SelectItem value="custom">custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>Rule Value</Label>
                  <Input
                    placeholder="UUID atau nilai"
                    value={newRule.rule_value}
                    onChange={(e) => setNewRule((r) => ({ ...r, rule_value: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Deskripsi</Label>
                  <Textarea
                    placeholder="Catatan (opsional)"
                    value={newRule.description}
                    onChange={(e) => setNewRule((r) => ({ ...r, description: e.target.value }))}
                    rows={1}
                  />
                </div>
              </div>
              <Button onClick={handleAddRule} className="gap-2">
                <Plus className="h-4 w-4" />
                Tambah Rule
              </Button>

              {eligibilityRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada rule tambahan (cuma event_voter_groups).</p>
              ) : (
                <div className="space-y-2">
                  {eligibilityRules.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {r.rule_type} = <code>{r.rule_value}</code>
                        </p>
                        {r.description && (
                          <p className="text-sm text-muted-foreground">{r.description}</p>
                        )}
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveRule(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Timeline Transisi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada transisi tercatat.</p>
              ) : (
                <ul className="space-y-2">
                  {transitions.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 rounded border p-3">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {t.from_status} → {t.to_status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                          {' • '}
                          {t.triggered_by}
                          {t.reason ? ` • ${t.reason}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
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
          <CreatePairDialog
            open={createPairOpen}
            onOpenChange={setCreatePairOpen}
            eventId={id}
            onSuccess={fetchEventDetails}
          />
          <EditPairDialog
            open={editPairOpen}
            onOpenChange={setEditPairOpen}
            pair={selectedPair}
            eventId={id}
            onSuccess={fetchEventDetails}
          />
          <ApprovePairDialog
            open={approvePairOpen}
            onOpenChange={setApprovePairOpen}
            pair={selectedPair}
            onSuccess={fetchEventDetails}
          />

          {/* Confirm toggle use_pairs */}
          <AlertDialog
            open={pendingUsePairs !== null}
            onOpenChange={(o) => { if (!o) setPendingUsePairs(null); }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pendingUsePairs ? 'Aktifkan mode pasangan kandidat?' : 'Nonaktifkan mode pasangan kandidat?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingUsePairs
                    ? 'Pemilih akan memilih satu pasangan (ketua & wakil) alih-alih kandidat tunggal. Pastikan pasangan sudah disiapkan sebelum pemilihan dimulai.'
                    : 'Pemilih akan kembali memilih kandidat tunggal. Suara yang sudah tercatat untuk pasangan tetap tersimpan, tetapi tidak akan ditampilkan sebagai pilihan.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pairsBusy}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleToggleUsePairs} disabled={pairsBusy}>
                  {pairsBusy ? 'Menyimpan...' : 'Ya, Lanjutkan'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Confirm delete pair */}
          <AlertDialog open={deletePairOpen} onOpenChange={setDeletePairOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus pasangan kandidat?</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedPair
                    ? `Pasangan "${getPairDisplayName(selectedPair)}" akan dihapus permanen beserta anggotanya.`
                    : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pairsBusy}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePair} disabled={pairsBusy}>
                  {pairsBusy ? 'Menghapus...' : 'Ya, Hapus'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
