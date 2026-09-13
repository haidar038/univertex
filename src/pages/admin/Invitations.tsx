import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { MailPlus, Copy, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface InvitationRow {
  id: string;
  created_at: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  intent: 'register' | 'candidate' | 'voter_group' | 'committee' | 'observer';
  event_id: string | null;
  class_id: string | null;
  roles: string[];
  token: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
  revoked_at: string | null;
}

interface EventOpt { id: string; title: string }
interface ClassOpt { id: string; name: string }

export default function AdminInvitations() {
  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [intent, setIntent] = useState<InvitationRow['intent']>('register');
  const [eventId, setEventId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [roleVoter, setRoleVoter] = useState(true);
  const [roleCandidate, setRoleCandidate] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [notes, setNotes] = useState('');
  const [lastCreatedLink, setLastCreatedLink] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    fetchSupportData();
  }, []);

  const fetchSupportData = async () => {
    const [{ data: ev }, { data: cl }] = await Promise.all([
      supabase.from('election_events').select('id, title').order('created_at', { ascending: false }),
      supabase.from('classes').select('id, name').order('name'),
    ]);
    setEvents(ev || []);
    setClasses(cl || []);
  };

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_invitations');
    if (error) {
      console.error('[invitations] refresh:', error);
      toast.error('Gagal memuat data undangan.');
    } else {
      setRows((data || []) as InvitationRow[]);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!email) {
      toast.error('Email wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const roles: string[] = [];
      if (roleVoter) roles.push('voter');
      if (roleCandidate) roles.push('candidate');

      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      if (intent === 'candidate' && !eventId) {
        toast.error('Pilih event untuk undangan kandidat.');
        return;
      }
      if (intent === 'candidate' && !roles.includes('candidate')) {
        roles.push('candidate');
      }

      const { data: created, error } = await supabase.rpc('admin_create_invitation', {
        p_email: email,
        p_full_name: fullName || null,
        p_student_id: studentId || null,
        p_intent: intent,
        p_event_id: intent === 'candidate' ? eventId : null,
        p_class_id: classId || null,
        p_roles: roles,
        p_expires_at: expiresAt,
        p_metadata: notes ? { notes } : {},
      });

      if (error) throw error;
      const createdToken = created?.[0]?.token;
      if (!createdToken) throw new Error('Server tidak mengembalikan token undangan');

      const link = `${window.location.origin}/invite/${createdToken}`;
      setLastCreatedLink(link);
      await logAudit({
        action: 'invitation.create',
        description: `Created invitation for ${email} (${intent})`,
        category: 'admin',
        targetType: 'invitations',
        severity: 'info',
        metadata: { email, intent, expires_at: expiresAt },
      });
      toast.success('Undangan berhasil dibuat!');
      resetForm();
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal membuat undangan';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setStudentId('');
    setIntent('register');
    setEventId('');
    setClassId('');
    setRoleVoter(true);
    setRoleCandidate(false);
    setNotes('');
  };

  const handleRevoke = async (row: InvitationRow) => {
    if (!confirm(`Cabut undangan untuk ${row.email}?`)) return;
    const { error } = await supabase.rpc('admin_revoke_invitation', {
      p_invitation_id: row.id,
    });
    if (error) {
      toast.error('Gagal mencabut undangan.');
    } else {
      await logAudit({
        action: 'invitation.revoke',
        description: `Revoked invitation for ${row.email}`,
        category: 'security',
        targetType: 'invitations',
        targetId: row.id,
        severity: 'warning',
      });
      toast.success('Undangan dicabut.');
      refresh();
    }
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link berhasil disalin.');
    } catch {
      toast.error('Gagal menyalin. Silakan salin manual.');
    }
  };

  const statusOf = (r: InvitationRow): { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' } => {
    if (r.revoked_at) return { label: 'Dicabut', variant: 'destructive' };
    if (r.accepted_at) return { label: 'Diterima', variant: 'secondary' };
    if (new Date(r.expires_at) < new Date()) return { label: 'Kedaluwarsa', variant: 'outline' };
    return { label: 'Aktif', variant: 'default' };
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="mb-2 text-2xl md:text-3xl font-bold text-foreground">Undangan (Invite)</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Buat tautan undangan untuk mendaftarkan pengguna atau mencalonkan kandidat.
            Registrasi publik ditutup, semua akun harus melalui undangan admin/panitia.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <MailPlus className="h-4 w-4" />
          Buat Undangan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Undangan ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Belum ada undangan. Klik "Buat Undangan" untuk memulai.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="p-3 text-left text-xs font-medium">Email</th>
                    <th className="p-3 text-left text-xs font-medium">Tujuan</th>
                    <th className="p-3 text-left text-xs font-medium">Roles</th>
                    <th className="p-3 text-left text-xs font-medium">Status</th>
                    <th className="p-3 text-left text-xs font-medium">Berlaku s/d</th>
                    <th className="p-3 text-left text-xs font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => {
                    const st = statusOf(r);
                    const link = `${window.location.origin}/invite/${r.token}`;
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-3 text-sm">
                          <div className="font-medium text-foreground">{r.email}</div>
                          {r.full_name && (
                            <div className="text-xs text-muted-foreground">{r.full_name}</div>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          <Badge variant="outline">{r.intent}</Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {r.roles.length > 0 ? r.roles.join(', ') : '-'}
                        </td>
                        <td className="p-3 text-xs">
                          <Badge variant={st.variant}>{st.label}</Badge>
                          {r.accepted_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(r.accepted_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {format(new Date(r.expires_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(link)}
                              title="Salin link undangan"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {!r.accepted_at && !r.revoked_at && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRevoke(r)}
                                title="Cabut undangan"
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setLastCreatedLink(null); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Buat Undangan Baru</DialogTitle>
            <DialogDescription>
              Undang calon pengguna via tautan. Tautan akan kedaluwarsa sesuai waktu yang dipilih.
            </DialogDescription>
          </DialogHeader>

          {lastCreatedLink ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-success/40 bg-success/10 p-4">
                <p className="text-sm font-medium text-success-foreground mb-2">Undangan berhasil dibuat!</p>
                <p className="text-xs text-muted-foreground mb-2">Bagikan link berikut ke penerima:</p>
                <div className="flex gap-2">
                  <Input value={lastCreatedLink} readOnly className="font-mono text-xs" />
                  <Button onClick={() => copyLink(lastCreatedLink)} className="gap-2">
                    <Copy className="h-4 w-4" />
                    Salin
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setCreateOpen(false); setLastCreatedLink(null); }}>Selesai</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="inv-email">Email Tujuan <span className="text-destructive">*</span></Label>
                <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="inv-name">Nama Lengkap</Label>
                  <Input id="inv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="inv-nim">NIM</Label>
                  <Input id="inv-nim" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Tujuan Undangan</Label>
                <Select value={intent} onValueChange={(v) => setIntent(v as typeof intent)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="register">Daftarkan sebagai Pemilih</SelectItem>
                    <SelectItem value="candidate">Daftarkan sebagai Kandidat</SelectItem>
                    <SelectItem value="voter_group">Tambah Kelas ke DPT Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {intent === 'candidate' && (
                <div className="space-y-1">
                  <Label>Event</Label>
                  <Select value={eventId} onValueChange={setEventId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih event..." />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label>Kelas</Label>
                <Select value={classId || 'none'} onValueChange={(value) => setClassId(value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas (opsional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tidak ada --</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={roleVoter} onChange={(e) => setRoleVoter(e.target.checked)} />
                    Pemilih (Voter)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={roleCandidate} onChange={(e) => setRoleCandidate(e.target.checked)} />
                    Kandidat (Candidate)
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-exp">Berlaku (hari)</Label>
                <Input
                  id="inv-exp"
                  type="number"
                  min={1}
                  max={90}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value) || 14)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-notes">Catatan (internal)</Label>
                <Textarea id="inv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                  Batal
                </Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? 'Membuat...' : 'Buat Undangan'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
