import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus, UserX, Search, ShieldCheck, Eye, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface CommitteeRow {
    id: string;
    user_id: string;
    committee_role: 'chair' | 'secretary' | 'verifier' | 'technical' | 'member';
    appointed_at: string;
    revoked_at: string | null;
    revoked_reason: string | null;
    profile?: { full_name: string; student_id: string; email?: string } | null;
}

interface ObserverRow {
    id: string;
    user_id: string;
    appointed_at: string;
    revoked_at: string | null;
    revoked_reason: string | null;
    profile?: { full_name: string; student_id: string; email?: string } | null;
}

const ROLE_LABEL: Record<CommitteeRow['committee_role'], string> = {
    chair: 'Ketua',
    secretary: 'Sekretaris',
    verifier: 'Verifikator',
    technical: 'Teknis',
    member: 'Anggota',
};

/**
 * Admin view to assign/revoke committee and observer roles for a specific
 * election. Users are looked up by email; their existing auth.users row is
 * used (no password handling). The admin must have already created the
 * user account before adding them as committee/observer.
 */
export default function ElectionStaff() {
    const { id: electionId } = useParams<{ id: string }>();

    const [title, setTitle] = useState<string>('');
    const [committees, setCommittees] = useState<CommitteeRow[]>([]);
    const [observers, setObservers] = useState<ObserverRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Committee form
    const [cEmail, setCEmail] = useState('');
    const [cRole, setCRole] = useState<CommitteeRow['committee_role']>('member');
    const [cBusy, setCBusy] = useState(false);

    // Observer form
    const [oEmail, setOEmail] = useState('');
    const [oBusy, setOBusy] = useState(false);

    const load = async () => {
        if (!electionId) return;
        setLoading(true);
        setError(null);
        try {
            const { data: ev } = await supabase.from('election_events').select('title').eq('id', electionId).maybeSingle();
            setTitle(ev?.title ?? '');

            const [cRes, oRes] = await Promise.all([
                supabase.from('election_committees')
                    .select('id, user_id, committee_role, appointed_at, revoked_at, revoked_reason')
                    .eq('election_id', electionId)
                    .order('appointed_at', { ascending: false }),
                supabase.from('election_observers')
                    .select('id, user_id, appointed_at, revoked_at, revoked_reason')
                    .eq('election_id', electionId)
                    .order('appointed_at', { ascending: false }),
            ]);
            if (cRes.error) throw cRes.error;
            if (oRes.error) throw oRes.error;

            // Hydrate profile info for each user_id in one round-trip
            const userIds = Array.from(new Set([
                ...(cRes.data ?? []).map((r: any) => r.user_id),
                ...(oRes.data ?? []).map((r: any) => r.user_id),
            ].filter(Boolean)));

            let profileMap: Record<string, { full_name: string; student_id: string }> = {};
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, student_id')
                    .in('id', userIds);
                profileMap = Object.fromEntries(
                    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, student_id: p.student_id }])
                );
            }

            const enrichC = (r: any): CommitteeRow => ({ ...r, profile: profileMap[r.user_id] ?? null });
            const enrichO = (r: any): ObserverRow => ({ ...r, profile: profileMap[r.user_id] ?? null });

            setCommittees((cRes.data ?? []).map(enrichC));
            setObservers((oRes.data ?? []).map(enrichO));
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Gagal memuat data';
            logger.error('Failed to load election staff', e, { action: 'admin.staff.load' });
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [electionId]);

    const lookupUserId = async (email: string): Promise<string | null> => {
        // auth.users is not directly readable from anon/auth via PostgREST.
        // Use the public rpc get_user_email in reverse? We don't have that —
        // instead, use a SECURITY DEFINER lookup via a SQL function we own.
        // For now, simplest path: use the admin client's service-role-style
        // SQL via an RPC wrapper. The user lookup function is created below.
        const { data, error } = await supabase.rpc('admin_lookup_user_id_by_email', { p_email: email });
        if (error) {
            logger.warn('User lookup failed', { action: 'admin.staff.lookup', error: error.message });
            return null;
        }
        return data as string | null;
    };

    const handleAssignCommittee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!electionId) return;
        setCBusy(true);
        try {
            const uid = await lookupUserId(cEmail);
            if (!uid) {
                toast.error('User tidak ditemukan. Pastikan user sudah dibuat.');
                return;
            }
            const { error } = await supabase.rpc('admin_assign_committee', {
                p_user_id: uid,
                p_election_id: electionId,
                p_role: cRole,
            });
            if (error) throw error;
            toast.success('Panitia berhasil ditugaskan');
            setCEmail('');
            await load();
        } catch (e2) {
            const msg = e2 instanceof Error ? e2.message : 'Gagal menugaskan panitia';
            toast.error(msg);
        } finally {
            setCBusy(false);
        }
    };

    const handleAssignObserver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!electionId) return;
        setOBusy(true);
        try {
            const uid = await lookupUserId(oEmail);
            if (!uid) {
                toast.error('User tidak ditemukan. Pastikan user sudah dibuat.');
                return;
            }
            const { error } = await supabase.rpc('admin_assign_observer', {
                p_user_id: uid,
                p_election_id: electionId,
            });
            if (error) throw error;
            toast.success('Observer berhasil ditugaskan');
            setOEmail('');
            await load();
        } catch (e2) {
            const msg = e2 instanceof Error ? e2.message : 'Gagal menugaskan observer';
            toast.error(msg);
        } finally {
            setOBusy(false);
        }
    };

    const handleRevokeCommittee = async (committeeId: string) => {
        if (!confirm('Cabut penugasan panitia ini? Pengguna tidak akan bisa lagi mengakses dashboard panitia.')) return;
        const { error } = await supabase.rpc('admin_revoke_committee', {
            p_committee_id: committeeId,
            p_reason: 'admin_revoke',
        });
        if (error) { toast.error(error.message); return; }
        toast.success('Penugasan dicabut');
        await load();
    };

    const handleRevokeObserver = async (observerId: string) => {
        if (!confirm('Cabut penugasan observer ini?')) return;
        const { error } = await supabase.rpc('admin_revoke_observer', {
            p_observer_id: observerId,
            p_reason: 'admin_revoke',
        });
        if (error) { toast.error(error.message); return; }
        toast.success('Penugasan dicabut');
        await load();
    };

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <Button asChild variant="ghost" size="sm">
                <Link to={`/admin/events/${electionId}`}><ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke pemilihan</Link>
            </Button>

            <header>
                <h1 className="text-2xl font-bold">Panitia & Observer</h1>
                <p className="text-muted-foreground">{title}</p>
            </header>

            {/* Committee form */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <CardTitle>Tugaskan Panitia</CardTitle>
                    </div>
                    <CardDescription>
                        Panitia dapat memantau & memvalidasi pemilihan, tetapi tidak dapat
                        mengubah data inti.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAssignCommittee} className="flex flex-col md:flex-row gap-2">
                        <div className="flex-1">
                            <Label htmlFor="c-email" className="sr-only">Email</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="c-email"
                                    type="email"
                                    placeholder="email@pengguna"
                                    value={cEmail}
                                    onChange={(e) => setCEmail(e.target.value)}
                                    className="pl-9"
                                    required
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-44">
                            <Select value={cRole} onValueChange={(v) => setCRole(v as CommitteeRow['committee_role'])}>
                                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="chair">Ketua</SelectItem>
                                    <SelectItem value="secretary">Sekretaris</SelectItem>
                                    <SelectItem value="verifier">Verifikator</SelectItem>
                                    <SelectItem value="technical">Teknis</SelectItem>
                                    <SelectItem value="member">Anggota</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" disabled={cBusy}>
                            {cBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                            Tugaskan
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Committee list */}
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Panitia ({committees.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {committees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada panitia.</p>
                    ) : (
                        <ul className="divide-y">
                            {committees.map((c) => (
                                <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-medium">{c.profile?.full_name ?? c.user_id}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {c.profile?.student_id ?? '—'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={c.revoked_at ? 'outline' : 'secondary'}>
                                            {ROLE_LABEL[c.committee_role]}
                                            {c.revoked_at && ' (dicabut)'}
                                        </Badge>
                                        {!c.revoked_at && (
                                            <Button size="sm" variant="ghost" onClick={() => handleRevokeCommittee(c.id)}>
                                                <UserX className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Observer form */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        <CardTitle>Tugaskan Observer</CardTitle>
                    </div>
                    <CardDescription>
                        Observer hanya-baca. Cocok untuk BPM, saksi, atau auditor eksternal.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAssignObserver} className="flex flex-col md:flex-row gap-2">
                        <div className="flex-1">
                            <Label htmlFor="o-email" className="sr-only">Email</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="o-email"
                                    type="email"
                                    placeholder="email@observer"
                                    value={oEmail}
                                    onChange={(e) => setOEmail(e.target.value)}
                                    className="pl-9"
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={oBusy}>
                            {oBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                            Tugaskan
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Observer list */}
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Observer ({observers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {observers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada observer.</p>
                    ) : (
                        <ul className="divide-y">
                            {observers.map((o) => (
                                <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-medium">{o.profile?.full_name ?? o.user_id}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {o.profile?.student_id ?? '—'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={o.revoked_at ? 'outline' : 'secondary'}>
                                            Observer {o.revoked_at && '(dicabut)'}
                                        </Badge>
                                        {!o.revoked_at && (
                                            <Button size="sm" variant="ghost" onClick={() => handleRevokeObserver(o.id)}>
                                                <UserX className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
