import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
    Vote,
    Calendar,
    Users,
    Shield,
    BarChart3,
    Eye,
    TrendingUp,
    CheckCircle2,
    Zap,
    Lock,
    Clock,
    UserCheck,
    FileCheck,
    Mail,
    Phone,
    MapPin,
    ArrowRight,
    Menu,
    X,
} from "lucide-react";
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
    const { resolvedTheme } = useTheme();
    const [activeEvents, setActiveEvents] = useState<Event[]>([]);
    const [publicResults, setPublicResults] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [stats, setStats] = useState({
        participationRate: 0,
        activeElections: 0,
        totalVotes: 0,
    });

    useEffect(() => {
        fetchEvents();
        fetchStats();
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

    const fetchStats = async () => {
        try {
            // Get total votes count
            const { count: votesCount } = await supabase.from("votes").select("*", { count: "exact", head: true });

            // Get active elections count
            const { count: activeCount } = await supabase.from("election_events").select("*", { count: "exact", head: true }).eq("status", "active");

            // Calculate participation rate (simplified - you might want to adjust this logic)
            const participationRate = 87; // Mock data - calculate based on your logic

            setStats({
                participationRate,
                activeElections: activeCount || 0,
                totalVotes: votesCount || 0,
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <img src={resolvedTheme === "dark" ? "/UniVertexWhite.png" : "/UniVertex-Primary.png"} alt="UniVertex" className="h-10 w-auto" />
                            <span className="text-xl font-bold text-foreground">UniVertex</span>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Fitur
                            </a>
                            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Cara Kerja
                            </a>
                            <a href="#elections" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Pemilihan
                            </a>
                            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                FAQ
                            </a>
                            <a href="#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Kontak
                            </a>
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-3">
                            <ThemeToggle />
                            <Button asChild variant="ghost" size="sm">
                                <Link to="/login">Masuk</Link>
                            </Button>
                            <Button asChild size="sm">
                                <Link to="/signup">Daftar</Link>
                            </Button>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="flex md:hidden items-center gap-2">
                            <ThemeToggle />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="p-2"
                            >
                                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t py-4 space-y-4 animate-in slide-in-from-top-5">
                            {/* Mobile Navigation Links */}
                            <div className="flex flex-col space-y-3">
                                <a
                                    href="#features"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-md hover:bg-muted"
                                >
                                    Fitur
                                </a>
                                <a
                                    href="#how-it-works"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-md hover:bg-muted"
                                >
                                    Cara Kerja
                                </a>
                                <a
                                    href="#elections"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-md hover:bg-muted"
                                >
                                    Pemilihan
                                </a>
                                <a
                                    href="#faq"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-md hover:bg-muted"
                                >
                                    FAQ
                                </a>
                                <a
                                    href="#contact"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-md hover:bg-muted"
                                >
                                    Kontak
                                </a>
                            </div>

                            {/* Mobile Action Buttons */}
                            <div className="flex flex-col gap-2 pt-4 border-t">
                                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Masuk</Link>
                                </Button>
                                <Button asChild size="sm" className="w-full">
                                    <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>Daftar</Link>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative overflow-hidden border-b bg-gradient-to-br from-background via-primary/5 to-accent/5 py-20 md:py-32">
                <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
                <div className="container relative mx-auto px-4">
                    <div className="mx-auto max-w-4xl text-center space-y-8">
                        <Badge variant="outline" className="mb-4">
                            Platform E-Voting Terpercaya
                        </Badge>
                        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                            Demokrasi Digital untuk <span className="text-primary">Masa Depan</span>
                        </h1>
                        <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
                            Platform pemilihan elektronik yang aman, transparan, dan mudah digunakan untuk seluruh sivitas akademika. Berpartisipasi dalam demokrasi dengan teknologi modern.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                            <Button asChild size="lg" className="gap-2">
                                <Link to="/signup">
                                    Mulai Sekarang
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link to="/login">Masuk ke Akun</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="border-b py-16">
                <div className="container mx-auto px-4">
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="relative overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Tingkat Partisipasi</CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-primary">{stats.participationRate}%</div>
                                <p className="text-xs text-muted-foreground mt-1">Rata-rata partisipasi pemilih</p>
                            </CardContent>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 to-primary" />
                        </Card>

                        <Card className="relative overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Pemilu Aktif</CardTitle>
                                    <Vote className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-primary">{stats.activeElections}</div>
                                <p className="text-xs text-muted-foreground mt-1">Pemilihan sedang berlangsung</p>
                            </CardContent>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/20 to-accent" />
                        </Card>

                        <Card className="relative overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Kecepatan Rekap</CardTitle>
                                    <Zap className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-primary">Real-time</div>
                                <p className="text-xs text-muted-foreground mt-1">Hasil langsung tersedia</p>
                            </CardContent>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-success/20 to-success" />
                        </Card>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="border-b py-20">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <Badge variant="outline" className="mb-4">
                            Cara Kerja
                        </Badge>
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Mudah & Cepat dalam 3 Langkah</h2>
                        <p className="text-muted-foreground">Berpartisipasi dalam pemilihan hanya dalam beberapa klik</p>
                    </div>

                    <div className="grid gap-8 md:grid-cols-3">
                        <Card className="relative text-center">
                            <CardHeader>
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                    <UserCheck className="h-8 w-8 text-primary" />
                                </div>
                                <CardTitle>1. Daftar & Login</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Buat akun menggunakan email dan NIM Anda. Verifikasi otomatis untuk keamanan maksimal.</CardDescription>
                            </CardContent>
                        </Card>

                        <Card className="relative text-center">
                            <CardHeader>
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                    <Vote className="h-8 w-8 text-primary" />
                                </div>
                                <CardTitle>2. Pilih Kandidat</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Lihat profil kandidat, visi & misi mereka. Pilih kandidat pilihan Anda dengan satu klik.</CardDescription>
                            </CardContent>
                        </Card>

                        <Card className="relative text-center">
                            <CardHeader>
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                    <FileCheck className="h-8 w-8 text-primary" />
                                </div>
                                <CardTitle>3. Konfirmasi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Konfirmasi pilihan Anda. Suara tercatat aman dan hasil dapat dilihat real-time.</CardDescription>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="border-b py-20 bg-muted/30">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <Badge variant="outline" className="mb-4">
                            Fitur Unggulan
                        </Badge>
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Kenapa Memilih UniVertex?</h2>
                        <p className="text-muted-foreground">Platform e-voting terlengkap dengan fitur-fitur modern</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <Shield className="h-10 w-10 text-primary mb-4" />
                                <CardTitle>Keamanan Maksimal</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Enkripsi end-to-end, Row Level Security, dan sistem autentikasi berlapis untuk melindungi setiap suara.</CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Zap className="h-10 w-10 text-primary mb-4" />
                                <CardTitle>Real-time Results</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Pantau hasil pemilihan secara langsung dengan visualisasi data yang interaktif dan mudah dipahami.</CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Users className="h-10 w-10 text-primary mb-4" />
                                <CardTitle>Multi-Role System</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Mendukung berbagai peran: Admin, Voter, dan Kandidat dengan hak akses yang terkelola dengan baik.</CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Lock className="h-10 w-10 text-primary mb-4" />
                                <CardTitle>Privasi Terjaga</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Setiap suara bersifat anonim. Sistem menjamin privasi pemilih sambil menjaga integritas pemilihan.</CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Clock className="h-10 w-10 text-primary mb-4" />
                                <CardTitle>24/7 Akses</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Akses kapan saja, di mana saja. Platform tersedia 24 jam untuk kenyamanan Anda.</CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <BarChart3 className="h-10 w-10 text-primary mb-4" />
                                <CardTitle>Analytics Dashboard</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>Dashboard admin dengan statistik lengkap untuk monitoring dan analisis pemilihan.</CardDescription>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Election Events Section */}
            <section id="elections" className="border-b py-20">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <Badge variant="outline" className="mb-4">
                            Pemilihan
                        </Badge>
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Pemilihan yang Sedang Berlangsung</h2>
                        <p className="text-muted-foreground">Ikuti pemilihan aktif dan lihat hasil pemilihan yang telah selesai</p>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Memuat pemilihan...</p>
                        </div>
                    ) : activeEvents.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-6 mb-16">
                            {activeEvents.map((event) => (
                                <Card key={event.id} className="overflow-hidden">
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="default" className="gap-1">
                                                        <Vote className="h-3 w-3" />
                                                        Aktif
                                                    </Badge>
                                                    {event.election_type === "open" && (
                                                        <Badge variant="outline" className="gap-1">
                                                            <Eye className="h-3 w-3" />
                                                            Terbuka
                                                        </Badge>
                                                    )}
                                                </div>
                                                <CardTitle className="text-xl">{event.title}</CardTitle>
                                                <CardDescription>{event.description}</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm mb-4">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="w-4 h-4" />
                                                <span>Mulai: {format(new Date(event.start_time), "dd MMMM yyyy, HH:mm", { locale: id })}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="w-4 h-4" />
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
                        <Card className="text-center py-12 mb-16">
                            <CardContent>
                                <Vote className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                                <p className="text-lg text-muted-foreground">Belum ada pemilihan yang berjalan saat ini</p>
                                <p className="text-sm text-muted-foreground mt-2">Pemilihan baru akan segera dimulai</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Public Results */}
                    {!loading && publicResults.length > 0 && (
                        <div>
                            <h3 className="text-2xl font-bold mb-6">Hasil Pemilihan Selesai</h3>
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
            </section>

            {/* FAQ Section */}
            <section id="faq" className="border-b py-20 bg-muted/30">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-3xl">
                        <div className="text-center mb-16">
                            <Badge variant="outline" className="mb-4">
                                FAQ
                            </Badge>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Pertanyaan yang Sering Diajukan</h2>
                            <p className="text-muted-foreground">Temukan jawaban untuk pertanyaan umum tentang UniVertex</p>
                        </div>

                        <Accordion type="single" collapsible className="w-full space-y-4">
                            <AccordionItem value="item-1" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Apa itu UniVertex?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    UniVertex adalah platform e-voting modern yang dirancang khusus untuk institusi pendidikan tinggi. Platform ini memungkinkan mahasiswa untuk berpartisipasi dalam pemilihan organisasi kampus secara aman, transparan, dan
                                    efisien dari mana saja dan kapan saja.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-2" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Bagaimana cara mendaftar dan membuat akun?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Untuk mendaftar, klik tombol "Daftar" di halaman utama, lalu isi formulir dengan email institusi Anda (@ui.ac.id atau sejenisnya), NIM, nama lengkap, dan password. Setelah mendaftar, Anda akan langsung dapat
                                    login dan berpartisipasi dalam pemilihan yang tersedia untuk kelas Anda.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-3" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Apakah suara saya bersifat rahasia?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Ya, mutlak rahasia. UniVertex menggunakan teknologi enkripsi end-to-end dan sistem pemisahan data yang memastikan pilihan voting Anda tidak dapat dikaitkan dengan identitas pribadi Anda. Bahkan administrator
                                    sistem tidak dapat melihat siapa memilih kandidat tertentu.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-4" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Bisakah saya mengubah pilihan setelah memberikan suara?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Tidak. Setelah Anda mengkonfirmasi pilihan Anda, suara akan langsung tercatat dan tidak dapat diubah. Hal ini untuk menjaga integritas pemilihan dan mencegah manipulasi. Pastikan Anda telah yakin dengan pilihan
                                    Anda sebelum mengklik tombol konfirmasi.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-5" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Bagaimana cara menjadi kandidat?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Untuk menjadi kandidat, Anda perlu memiliki akun dengan role "kandidat". Setelah login, buka halaman "Pengaturan Kandidat" untuk mengisi informasi seperti visi, misi, dan foto profil Anda. Profil kandidat Anda
                                    akan ditinjau dan disetujui oleh administrator sebelum dipublikasikan kepada pemilih.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-6" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Kapan saya bisa melihat hasil pemilihan?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Visibilitas hasil pemilihan tergantung pada jenis pemilihan:
                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                        <li>
                                            <strong>Pemilihan Terbuka:</strong> Hasil dapat dilihat secara real-time bahkan sebelum Anda memberikan suara
                                        </li>
                                        <li>
                                            <strong>Pemilihan Tertutup:</strong> Hasil hanya dapat dilihat setelah pemilihan berakhir, atau setelah Anda memberikan suara (tergantung pengaturan admin)
                                        </li>
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-7" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Bagaimana jika saya lupa password?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Klik link "Lupa password?" di halaman login, lalu masukkan email Anda. Kami akan mengirimkan link reset password ke email Anda. Ikuti instruksi dalam email untuk membuat password baru. Jika Anda tidak menerima
                                    email dalam beberapa menit, periksa folder spam Anda.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-8" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Apakah platform ini aman dari kecurangan?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Ya. UniVertex dilengkapi dengan berbagai mekanisme keamanan:
                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                        <li>Sistem one-person-one-vote yang ketat mencegah voting ganda</li>
                                        <li>Row Level Security (RLS) untuk kontrol akses data yang granular</li>
                                        <li>Audit logs untuk melacak semua aktivitas penting</li>
                                        <li>Verifikasi identitas melalui email institusi dan NIM</li>
                                        <li>Enkripsi data untuk melindungi privasi pemilih</li>
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-9" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Siapa yang dapat melihat data pribadi saya?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Data pribadi Anda (nama, NIM, kelas) hanya dapat diakses oleh administrator untuk keperluan verifikasi dan manajemen akun. Data voting Anda sepenuhnya anonim dan terpisah dari identitas pribadi. Kami tidak pernah
                                    menjual atau membagikan data pribadi Anda kepada pihak ketiga. Lihat{" "}
                                    <Link to="/privacy-policy" className="text-primary hover:underline">
                                        Kebijakan Privasi
                                    </Link>{" "}
                                    kami untuk informasi lebih detail.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-10" className="border rounded-lg px-6 bg-background">
                                <AccordionTrigger className="hover:no-underline">Bagaimana cara menghubungi support jika saya mengalami masalah?</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    Jika Anda mengalami masalah teknis atau memiliki pertanyaan, Anda dapat menghubungi kami melalui:
                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                        <li>
                                            Email: <a href="mailto:support@univertex.com" className="text-primary hover:underline">support@univertex.com</a>
                                        </li>
                                        <li>Telepon: +62 21 1234 5678 (Senin-Jumat, 08:00-17:00)</li>
                                        <li>Atau melalui form kontak di bagian bawah halaman ini</li>
                                    </ul>
                                    Tim support kami siap membantu Anda sesegera mungkin.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="mt-12 text-center">
                            <p className="text-muted-foreground mb-4">Masih ada pertanyaan?</p>
                            <Button asChild variant="outline">
                                <a href="#contact">Hubungi Kami</a>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="border-b py-20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-3xl text-center space-y-6">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Siap Berpartisipasi dalam Demokrasi?</h2>
                        <p className="text-lg text-muted-foreground">Bergabunglah dengan ribuan mahasiswa yang telah menggunakan UniVertex untuk memberikan suara mereka.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                            <Button asChild size="lg" className="gap-2">
                                <Link to="/signup">
                                    Daftar Sekarang
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link to="/login">Sudah Punya Akun?</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="border-b py-20">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <Badge variant="outline" className="mb-4">
                            Hubungi Kami
                        </Badge>
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Butuh Bantuan?</h2>
                        <p className="text-muted-foreground">Tim kami siap membantu Anda</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="text-center">
                            <CardHeader>
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <Mail className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle>Email</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">support@univertex.com</p>
                                <p className="text-sm text-muted-foreground">admin@univertex.com</p>
                            </CardContent>
                        </Card>

                        <Card className="text-center">
                            <CardHeader>
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <Phone className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle>Telepon</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">+62 21 1234 5678</p>
                                <p className="text-sm text-muted-foreground">Senin - Jumat, 08:00 - 17:00</p>
                            </CardContent>
                        </Card>

                        <Card className="text-center">
                            <CardHeader>
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <MapPin className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle>Alamat</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">Gedung Rektorat</p>
                                <p className="text-sm text-muted-foreground">Universitas Indonesia</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-muted/30">
                <div className="container mx-auto px-4">
                    <div className="grid gap-8 md:grid-cols-4">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <img src={resolvedTheme === "dark" ? "/UniVertexWhite.png" : "/UniVertex-Primary.png"} alt="UniVertex" className="h-8 w-auto" />
                                <span className="font-bold">UniVertex</span>
                            </div>
                            <p className="text-sm text-muted-foreground">Platform e-voting terpercaya untuk sivitas akademika Indonesia.</p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-4">Platform</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <a href="#features" className="hover:text-foreground transition-colors">
                                        Fitur
                                    </a>
                                </li>
                                <li>
                                    <a href="#how-it-works" className="hover:text-foreground transition-colors">
                                        Cara Kerja
                                    </a>
                                </li>
                                <li>
                                    <a href="#elections" className="hover:text-foreground transition-colors">
                                        Pemilihan
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-4">Dukungan</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <a href="#contact" className="hover:text-foreground transition-colors">
                                        Hubungi Kami
                                    </a>
                                </li>
                                <li>
                                    <Link to="/login" className="hover:text-foreground transition-colors">
                                        Bantuan Login
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/signup" className="hover:text-foreground transition-colors">
                                        Daftar Akun
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-4">Legal</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
                                        Kebijakan Privasi
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/terms-of-service" className="hover:text-foreground transition-colors">
                                        Syarat & Ketentuan
                                    </Link>
                                </li>
                                <li>
                                    <a href="#faq" className="hover:text-foreground transition-colors">
                                        FAQ
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
                        <p>&copy; {new Date().getFullYear()} UniVertex. All rights reserved.</p>
                        <p className="mt-2">Built with ❤️ for Indonesian Universities</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Index;
