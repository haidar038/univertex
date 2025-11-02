import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Vote, Calendar, CheckCircle2, Clock, BarChart3, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function VoterDashboard() {
    const { profile } = useAuth();
    const [activeEvents, setActiveEvents] = useState<any[]>([]);
    const [closedEvents, setClosedEvents] = useState<any[]>([]);
    const [votedEvents, setVotedEvents] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [className, setClassName] = useState<string>("");

    useEffect(() => {
        if (profile) {
            fetchEvents();
        }
    }, [profile]);

    const fetchEvents = async () => {
        try {
            console.log("Fetching events for user:", {
                userId: profile?.id,
                classId: profile?.class_id,
                fullName: profile?.full_name,
            });

            // Check if user has a class assigned
            if (!profile?.class_id) {
                console.warn("User has no class assigned. Cannot fetch eligible events.");
                setActiveEvents([]);
                setClosedEvents([]);
                setLoading(false);
                return;
            }

            // Fetch class name
            const { data: classData } = await supabase.from("classes").select("name").eq("id", profile.class_id).single();

            if (classData) {
                setClassName(classData.name);
            }

            // Get user's class eligible events
            const { data: eligibleGroups, error: groupsError } = await supabase.from("event_voter_groups").select("event_id").eq("class_id", profile.class_id);

            console.log("Eligible groups fetch:", {
                classId: profile.class_id,
                eligibleGroups,
                error: groupsError,
            });

            if (groupsError) {
                console.error("Error fetching voter groups:", groupsError);
            }

            const eligibleEventIds = eligibleGroups?.map((g) => g.event_id) || [];

            // If no eligible events found, show message
            if (eligibleEventIds.length === 0) {
                console.warn("No events assigned to this class. Check event_voter_groups table.");
                setActiveEvents([]);
                setClosedEvents([]);
                setLoading(false);
                return;
            }

            console.log("Eligible event IDs:", eligibleEventIds);

            // Fetch active events
            const { data: activeData, error: activeError } = await supabase.from("election_events").select("*").eq("status", "active").in("id", eligibleEventIds);

            if (activeError) {
                console.error("Error fetching active events:", activeError);
            }

            // Fetch closed events
            const { data: closedData, error: closedError } = await supabase.from("election_events").select("*").eq("status", "closed").in("id", eligibleEventIds);

            if (closedError) {
                console.error("Error fetching closed events:", closedError);
            }

            // Check which events user has voted in
            const { data: votes } = await supabase
                .from("votes")
                .select("event_id")
                .eq("voter_id", profile?.id || "");

            const votedSet = new Set(votes?.map((v) => v.event_id) || []);

            setActiveEvents(activeData || []);
            setClosedEvents(closedData || []);
            setVotedEvents(votedSet);
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoading(false);
        }
    };

    const hasVoted = (eventId: string) => votedEvents.has(eventId);

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="mb-6 md:mb-8">
                <h1 className="mb-2 text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Selamat datang, {profile?.full_name}</h1>
                <p className="text-sm md:text-base text-muted-foreground">Lihat pemilihan yang tersedia dan berikan suara Anda</p>
            </div>

            {loading ? (
                <div className="text-center text-sm md:text-base text-muted-foreground">Memuat...</div>
            ) : (
                <div className="space-y-6 md:space-y-8">
                    {/* Active Elections */}
                    <div>
                        <h2 className="mb-4 text-lg md:text-xl font-bold text-foreground">Pemilihan Aktif</h2>
                        {activeEvents.length === 0 ? (
                            <Card>
                                <CardContent className="flex min-h-[200px] flex-col items-center justify-center py-8 md:py-12 px-4">
                                    <Calendar className="mb-4 h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground text-center">Tidak ada pemilihan aktif saat ini</p>
                                    {!profile?.class_id && (
                                        <div className="mt-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 md:p-4 w-full max-w-md">
                                            <p className="text-xs md:text-sm text-yellow-800 dark:text-yellow-200">
                                                <strong>Perhatian:</strong> Anda belum di-assign ke kelas. Hubungi admin untuk mendaftarkan Anda ke kelas.
                                            </p>
                                        </div>
                                    )}
                                    {profile?.class_id && (
                                        <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 md:p-4 w-full max-w-md">
                                            <p className="text-xs md:text-sm text-blue-800 dark:text-blue-200">
                                                <strong>Info:</strong> Kelas Anda: <em>{className || "Unknown"}</em>. Jika ada pemilihan aktif namun tidak muncul, hubungi admin untuk mengaktifkan pemilihan untuk kelas Anda.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
                                {activeEvents.map((event) => (
                                    <Card key={event.id} className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
                                        <CardHeader>
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                <CardTitle className="text-base md:text-lg pr-2">{event.title}</CardTitle>
                                                {hasVoted(event.id) ? (
                                                    <Badge className="bg-success gap-1 w-fit text-xs">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Sudah Memilih
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-primary w-fit text-xs">Aktif</Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs md:text-sm text-muted-foreground mb-3 line-clamp-2">{event.description}</p>

                                            {/* Election Type Badge */}
                                            <div className="mb-3 flex items-center gap-2">
                                                {event.election_type === "open" ? (
                                                    <Badge variant="outline" className="gap-1 text-xs">
                                                        <Eye className="h-3 w-3" />
                                                        <span className="hidden xs:inline">Pemilihan </span>Terbuka
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="gap-1 text-xs">
                                                        <EyeOff className="h-3 w-3" />
                                                        <span className="hidden xs:inline">Pemilihan </span>Tertutup
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-4">
                                                <Clock className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                                                <span className="truncate">Berakhir: {format(new Date(event.end_time), "dd MMM yyyy HH:mm", { locale: id })}</span>
                                            </div>
                                            {hasVoted(event.id) ? (
                                                <div className="flex flex-col space-y-2">
                                                    <div className="rounded-lg bg-success/10 p-2.5 md:p-3 text-center">
                                                        <p className="text-xs md:text-sm font-medium text-success-foreground">Terima kasih telah memberikan suara!</p>
                                                    </div>
                                                    {(event.election_type === "open" || event.show_results_after_voting) && (
                                                        <Link to={`/app/results/${event.id}`}>
                                                            <Button variant="outline" className="w-full gap-2 text-xs md:text-sm h-9 md:h-10">
                                                                <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                                                                Lihat Hasil Sementara
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col space-y-2">
                                                    <Link to={`/app/vote/${event.id}`}>
                                                        <Button className="w-full gap-2 text-xs md:text-sm h-9 md:h-10">
                                                            <Vote className="h-3 w-3 md:h-4 md:w-4" />
                                                            Berikan Suara
                                                        </Button>
                                                    </Link>
                                                    {event.election_type === "open" && (
                                                        <Link to={`/app/results/${event.id}`}>
                                                            <Button variant="ghost" className="w-full gap-2 text-xs md:text-sm h-9 md:h-10">
                                                                <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                                                                Lihat Hasil Real-time
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </div>
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
                            <h2 className="mb-4 text-lg md:text-xl font-bold text-foreground">Hasil Pemilihan</h2>
                            <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
                                {closedEvents.map((event) => (
                                    <Card key={event.id}>
                                        <CardHeader>
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                <CardTitle className="text-base md:text-lg pr-2">{event.title}</CardTitle>
                                                <Badge variant="secondary" className="w-fit text-xs">Selesai</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <Link to={`/app/results/${event.id}`}>
                                                <Button variant="outline" className="w-full text-xs md:text-sm h-9 md:h-10">
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
