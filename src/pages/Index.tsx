import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Vote, Calendar, Users, Shield, BarChart3, Eye, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Event {
    id: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    status: string;
    election_type?: string;
    public_results?: boolean;
}

function Index() {
    const [activeEvents, setActiveEvents] = useState<Event[]>([]);
    const [publicResults, setPublicResults] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            // Fetch active events
            const { data: activeData, error: activeError } = await supabase.from("election_events").select("*").eq("status", "active").order("start_time", { ascending: true });

            if (activeError) {
                console.error("Error fetching active events:", activeError);
            } else {
                setActiveEvents(activeData || []);
            }

            // Fetch closed events with public results
            const { data: closedData, error: closedError } = await supabase.from("election_events").select("*").eq("status", "closed").eq("public_results", true).order("end_time", { ascending: false }).limit(6);

            if (closedError) {
                console.error("Error fetching closed events:", closedError);
            } else {
                setPublicResults(closedData || []);
            }
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
            {/* Hero Section */}
            <div className="container mx-auto px-4 py-16">
                <div className="text-center space-y-6 mb-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                        <Vote className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold text-foreground">Sistem E-Voting Universitas</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Platform pemilihan elektronik yang aman, transparan, dan mudah digunakan untuk seluruh sivitas akademika</p>
                    <div className="flex gap-4 justify-center mt-8">
                        <Button asChild size="lg">
                            <Link to="/login">Masuk</Link>
                        </Button>
                        <Button asChild variant="outline" size="lg">
                            <Link to="/signup">Daftar Sekarang</Link>
                        </Button>
                    </div>
                </div>

                {/* Features */}
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    <Card>
                        <CardHeader>
                            <Shield className="w-12 h-12 text-primary mb-4" />
                            <CardTitle>Aman & Terpercaya</CardTitle>
                            <CardDescription>Sistem keamanan berlapis untuk menjamin integritas setiap suara</CardDescription>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Users className="w-12 h-12 text-primary mb-4" />
                            <CardTitle>Mudah Digunakan</CardTitle>
                            <CardDescription>Interface yang intuitif memudahkan semua pengguna untuk berpartisipasi</CardDescription>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Calendar className="w-12 h-12 text-primary mb-4" />
                            <CardTitle>Real-time</CardTitle>
                            <CardDescription>Pantau hasil pemilihan secara langsung setelah periode voting berakhir</CardDescription>
                        </CardHeader>
                    </Card>
                </div>

                {/* Active Events Section */}
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold text-center">Pemilihan yang Sedang Berlangsung</h2>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Memuat...</p>
                        </div>
                    ) : activeEvents.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-6">
                            {activeEvents.map((event) => (
                                <Card key={event.id}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 space-y-3">
                                                <CardTitle>{event.title}</CardTitle>
                                                <CardDescription>{event.description}</CardDescription>
                                            </div>
                                            {event.election_type === "open" && (
                                                <Badge variant="outline" className="gap-1">
                                                    <Eye className="h-3 w-3" />
                                                    Terbuka
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm mb-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                                <span>Mulai: {format(new Date(event.start_time), "dd MMMM yyyy, HH:mm", { locale: id })}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                                <span>Berakhir: {format(new Date(event.end_time), "dd MMMM yyyy, HH:mm", { locale: id })}</span>
                                            </div>
                                        </div>
                                        {event.election_type === "open" ? (
                                            <div className="space-y-2">
                                                <Button asChild className="w-full">
                                                    <Link to="/login">Ikuti Pemilihan</Link>
                                                </Button>
                                                <Button asChild variant="outline" className="w-full gap-2">
                                                    <Link to={`/results/${event.id}`}>
                                                        <BarChart3 className="w-4 h-4" />
                                                        Lihat Hasil Real-time
                                                    </Link>
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button asChild className="w-full">
                                                <Link to="/login">Ikuti Pemilihan</Link>
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="text-center py-12">
                            <CardContent>
                                <Vote className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                                <p className="text-lg text-muted-foreground">Belum ada pemilihan yang berjalan</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Public Results Section */}
                {!loading && publicResults.length > 0 && (
                    <div className="space-y-6 mt-16">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-bold">Hasil Pemilihan</h2>
                            <p className="text-muted-foreground">Lihat hasil dari pemilihan yang telah selesai</p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {publicResults.map((event) => (
                                <Card key={event.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader>
                                        <div className="flex items-start justify-between mb-2">
                                            <CardTitle className="text-lg">{event.title}</CardTitle>
                                            <Badge variant="secondary">Selesai</Badge>
                                        </div>
                                        <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="w-4 h-4" />
                                                <span>Selesai: {format(new Date(event.end_time), "dd MMM yyyy", { locale: id })}</span>
                                            </div>
                                            <Button asChild variant="outline" className="w-full gap-2">
                                                <Link to={`/results/${event.id}`}>
                                                    <TrendingUp className="w-4 h-4" />
                                                    Lihat Hasil
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="border-t mt-16 py-8">
                <div className="container mx-auto px-4 text-center text-muted-foreground">
                    <p>&copy; 2025 Sistem E-Voting Universitas. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

export default Index;
