import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Trophy, Users, CheckCircle2, AlertCircle, Clock, Bell, Settings, BarChart3 } from "lucide-react";
import { getCandidateStatusInfo } from "@/lib/candidate-helpers";
import { format } from "date-fns";
import { id } from "date-fns/locale";

type CandidateRow = Database["public"]["Tables"]["candidates"]["Row"];
type ElectionEventRow = Database["public"]["Tables"]["election_events"]["Row"];
type NotificationRow = Database["public"]["Tables"]["candidate_notifications"]["Row"];

interface CandidateWithEvent extends Omit<CandidateRow, 'event_id'> {
    election_events: {
        id: string;
        title: string;
        description: string | null;
        status: string;
        start_time: string;
        end_time: string;
    };
}

interface VoteStats {
    eventId: string;
    totalVotes: number;
    myVotes: number;
    rank: number;
}

export default function CandidateDashboard() {
    const { profile } = useAuth();
    const [candidates, setCandidates] = useState<CandidateWithEvent[]>([]);
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [voteStats, setVoteStats] = useState<Record<string, VoteStats>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            fetchCandidateData();
            fetchNotifications();
        }
    }, [profile]);

    const fetchCandidateData = async () => {
        try {
            const { data, error } = await supabase
                .from("candidates")
                .select(
                    `
          *,
          election_events (
            id,
            title,
            description,
            status,
            start_time,
            end_time
          )
        `
                )
                .eq("user_id", profile?.id || "");

            if (error) throw error;

            setCandidates(data || []);

            // Fetch vote statistics for closed events
            if (data) {
                const closedEvents = data.filter((c) => c.election_events?.status === "closed");

                for (const candidate of closedEvents) {
                    await fetchVoteStats(candidate.id, candidate.election_events.id);
                }
            }
        } catch (error) {
            console.error("Error fetching candidate data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchVoteStats = async (candidateId: string, eventId: string) => {
        try {
            // Get total votes for this candidate
            const { count: myVotes } = await supabase.from("votes").select("*", { count: "exact", head: true }).eq("candidate_id", candidateId);

            // Get all votes for this event
            const { data: allVotes } = await supabase.from("votes").select("candidate_id").eq("event_id", eventId);

            // Calculate vote counts per candidate
            const voteCounts: Record<string, number> = {};
            allVotes?.forEach((vote) => {
                voteCounts[vote.candidate_id] = (voteCounts[vote.candidate_id] || 0) + 1;
            });

            // Calculate rank
            const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
            const rank = sorted.findIndex(([id]) => id === candidateId) + 1;

            setVoteStats((prev) => ({
                ...prev,
                [candidateId]: {
                    eventId,
                    totalVotes: allVotes?.length || 0,
                    myVotes: myVotes || 0,
                    rank,
                },
            }));
        } catch (error) {
            console.error("Error fetching vote stats:", error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const { data, error } = await supabase
                .from("candidate_notifications")
                .select("*")
                .eq("user_id", profile?.id || "")
                .order("created_at", { ascending: false })
                .limit(5);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const markNotificationAsRead = async (notificationId: string) => {
        try {
            await supabase.from("candidate_notifications").update({ is_read: true }).eq("id", notificationId);

            setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    if (loading) {
        return <div className="p-8 text-center">Memuat...</div>;
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-foreground">Dashboard Kandidat</h1>
                <p className="text-muted-foreground">Kelola profil dan pantau performa kandidat Anda</p>
            </div>

            <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Kandidat</CardTitle>
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{candidates.length}</div>
                            <p className="text-xs text-muted-foreground">Pemilihan yang Anda ikuti</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Disetujui</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{candidates.filter((c) => c.status === "approved").length}</div>
                            <p className="text-xs text-muted-foreground">Profil yang disetujui</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Notifikasi</CardTitle>
                            <Bell className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{unreadCount}</div>
                            <p className="text-xs text-muted-foreground">Notifikasi belum dibaca</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Notifications */}
                {notifications.length > 0 && unreadCount > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Notifikasi Terbaru
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {notifications
                                .filter((n) => !n.is_read)
                                .map((notification) => (
                                    <Alert
                                        key={notification.id}
                                        variant={notification.type === "approved" ? "default" : notification.type === "rejected" ? "destructive" : "default"}
                                        className="cursor-pointer"
                                        onClick={() => markNotificationAsRead(notification.id)}
                                    >
                                        {notification.type === "approved" ? <CheckCircle2 className="h-4 w-4" /> : notification.type === "rejected" ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                        <AlertDescription>
                                            <p>{notification.message}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {format(new Date(notification.created_at), "dd MMM yyyy HH:mm", {
                                                    locale: id,
                                                })}
                                            </p>
                                        </AlertDescription>
                                    </Alert>
                                ))}
                        </CardContent>
                    </Card>
                )}

                {/* Candidate Registrations */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Pemilihan yang Diikuti</CardTitle>
                            <Link to="/app/candidate-settings">
                                <Button variant="outline" className="gap-2">
                                    <Settings className="h-4 w-4" />
                                    Kelola Profil
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {candidates.length === 0 ? (
                            <div className="flex min-h-[200px] items-center justify-center">
                                <p className="text-sm text-muted-foreground">Anda belum terdaftar sebagai kandidat</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {candidates.map((candidate) => {
                                    const statusInfo = getCandidateStatusInfo(candidate.status);
                                    const StatusIcon = candidate.status === "approved" ? CheckCircle2 : candidate.status === "rejected" ? AlertCircle : Clock;
                                    const stats = voteStats[candidate.id];

                                    return (
                                        <Card key={candidate.id}>
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="text-lg">{candidate.election_events.title}</CardTitle>
                                                        <CardDescription>{candidate.election_events.description}</CardDescription>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <Badge variant={statusInfo.variant as any} className="gap-1">
                                                            <StatusIcon className="h-3 w-3" />
                                                            {statusInfo.label}
                                                        </Badge>
                                                        <Badge variant="outline">{candidate.election_events.status === "active" ? "Berlangsung" : candidate.election_events.status === "closed" ? "Selesai" : "Draft"}</Badge>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="text-sm">
                                                    <p className="text-muted-foreground">
                                                        {format(new Date(candidate.election_events.start_time), "dd MMM yyyy", { locale: id })} - {format(new Date(candidate.election_events.end_time), "dd MMM yyyy", { locale: id })}
                                                    </p>
                                                </div>

                                                {candidate.status === "rejected" && candidate.rejection_reason && (
                                                    <Alert variant="destructive">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <AlertDescription>
                                                            <strong>Ditolak:</strong> {candidate.rejection_reason}
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                {/* Vote Statistics for closed events */}
                                                {candidate.election_events.status === "closed" && stats && (
                                                    <div className="rounded-lg border bg-muted/50 p-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                                            <h4 className="font-semibold text-sm">Hasil Pemilihan</h4>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-4 text-center">
                                                            <div>
                                                                <div className="text-2xl font-bold text-foreground">{stats.myVotes}</div>
                                                                <p className="text-xs text-muted-foreground">Suara</p>
                                                            </div>
                                                            <div>
                                                                <div className="text-2xl font-bold text-foreground">#{stats.rank}</div>
                                                                <p className="text-xs text-muted-foreground">Peringkat</p>
                                                            </div>
                                                            <div>
                                                                <div className="text-2xl font-bold text-foreground">{stats.totalVotes > 0 ? Math.round((stats.myVotes / stats.totalVotes) * 100) : 0}%</div>
                                                                <p className="text-xs text-muted-foreground">Persentase</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <Link to="/app/candidate-settings" className="flex-1">
                                                        <Button variant="outline" className="w-full gap-2">
                                                            <Settings className="h-4 w-4" />
                                                            Edit Profil
                                                        </Button>
                                                    </Link>
                                                    {candidate.election_events.status === "closed" && (
                                                        <Link to={`/app/results/${candidate.election_events.id}`} className="flex-1">
                                                            <Button variant="default" className="w-full gap-2">
                                                                <BarChart3 className="h-4 w-4" />
                                                                Lihat Hasil Lengkap
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
