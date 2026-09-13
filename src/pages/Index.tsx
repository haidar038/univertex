import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Vote, Calendar, Users, Shield, BarChart3, Eye, TrendingUp, Zap, Lock, Clock, UserCheck, FileCheck, Mail, Phone, MapPin, ArrowRight, Menu, X } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { dashboardPathFor } from "@/hooks/useAuth";

interface Event { id: string; title: string; description: string; start_time: string; end_time: string; status: string; election_type?: string; public_results?: boolean; }

function Index() {
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [publicResults, setPublicResults] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({ totalVotes: 0, activeElections: 0 });


  useEffect(() => {
    let cancelled = false;
    const checkAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, department, class_id')
        .eq('id', session.user.id)
        .single();
      if (cancelled || !profile) return;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      if (cancelled) return;

      const roles = (rolesData || []).map(
        (r: { role: string }) => r.role as 'admin' | 'voter' | 'candidate'
      );
      navigate(dashboardPathFor({ ...profile, roles }), { replace: true });
    };
    checkAndRedirect();
    fetchEvents();
    fetchStats();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEvents = async () => {
    try {
      const { data: a } = await supabase.from("election_events").select("*").eq("status", "voting").order("start_time", { ascending: true });
      setActiveEvents(a || []);
      const { data: c } = await supabase.from("election_events").select("*").in("status", ["published", "counting"]).eq("public_results", true).order("end_time", { ascending: false }).limit(6);
      setPublicResults(c || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const { count: v } = await supabase.from("votes").select("*", { count: "exact", head: true });
      const { count: a } = await supabase.from("election_events").select("*", { count: "exact", head: true }).eq("status", "voting");
      setStats({ totalVotes: v || 0, activeElections: a || 0 });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <a href="/"><div className="flex items-center gap-3"><img src={resolvedTheme === "dark" ? "/UniVertexWhite.png" : "/UniVertex-Primary.png"} alt="UniVertex" className="h-10 w-auto" /><span className="text-xl font-bold text-foreground">UniVertex</span></div></a>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Fitur</a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground">Cara Kerja</a>
              <a href="#elections" className="text-sm font-medium text-muted-foreground hover:text-foreground">Pemilihan</a>
              <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground">FAQ</a>
              <a href="#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground">Kontak</a>
            </div>
            <div className="hidden md:flex items-center gap-3"><ThemeToggle /><Button asChild size="sm"><Link to="/login">Masuk</Link></Button></div>
            <div className="flex md:hidden items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden border-t py-4 space-y-4">
              <div className="flex flex-col space-y-3">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-2 rounded-md hover:bg-muted">Fitur</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-2 rounded-md hover:bg-muted">Cara Kerja</a>
                <a href="#elections" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-2 rounded-md hover:bg-muted">Pemilihan</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-2 rounded-md hover:bg-muted">FAQ</a>
                <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-2 rounded-md hover:bg-muted">Kontak</a>
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t"><Button asChild size="sm" className="w-full"><Link to="/login" onClick={() => setMobileMenuOpen(false)}>Masuk</Link></Button></div>
            </div>
          )}
        </div>
      </nav>

      <section className="relative overflow-hidden border-b bg-gradient-to-br from-background via-primary/5 to-accent/5 py-20 md:py-32">
        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center space-y-8">
            <Badge variant="outline" className="mb-4">Platform E-Voting Terpercaya</Badge>
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">Demokrasi Digital untuk <span className="text-primary">Masa Depan</span></h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">Platform pemilihan elektronik yang aman, transparan, dan mudah digunakan untuk seluruh sivitas akademika.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button asChild size="lg" className="gap-2"><Link to="/login">Mulai Sekarang<ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/login">Masuk ke Akun</Link></Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">*Akun didistribusikan melalui tautan undangan dari admin/panitia.</p>
          </div>
        </div>
      </section>

      <section className="border-b py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium text-muted-foreground">Total Suara Masuk</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></div></CardHeader>
              <CardContent><div className="text-3xl font-bold text-primary">{stats.totalVotes}</div><p className="text-xs text-muted-foreground mt-1">Seluruh pemilihan aktif & selesai</p></CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 to-primary" />
            </Card>
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium text-muted-foreground">Pemilu Aktif</CardTitle><Vote className="h-4 w-4 text-muted-foreground" /></div></CardHeader>
              <CardContent><div className="text-3xl font-bold text-primary">{stats.activeElections}</div><p className="text-xs text-muted-foreground mt-1">Sedang berlangsung</p></CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/20 to-accent" />
            </Card>
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium text-muted-foreground">Kecepatan Rekap</CardTitle><Zap className="h-4 w-4 text-muted-foreground" /></div></CardHeader>
              <CardContent><div className="text-3xl font-bold text-primary">Real-time</div><p className="text-xs text-muted-foreground mt-1">Hasil langsung tersedia</p></CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-success/20 to-success" />
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="outline" className="mb-4">Cara Kerja</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Mudah & Cepat dalam 3 Langkah</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="text-center"><CardHeader><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Mail className="h-8 w-8 text-primary" /></div><CardTitle>1. Terima Undangan</CardTitle></CardHeader><CardContent><CardDescription>Admin/panitia mengirim tautan undangan ke email Anda.</CardDescription></CardContent></Card>
            <Card className="text-center"><CardHeader><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><UserCheck className="h-8 w-8 text-primary" /></div><CardTitle>2. Login & Verifikasi</CardTitle></CardHeader><CardContent><CardDescription>Login dengan email Anda. Sistem mengenali kelas dan hak pilih Anda.</CardDescription></CardContent></Card>
            <Card className="text-center"><CardHeader><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><FileCheck className="h-8 w-8 text-primary" /></div><CardTitle>3. Berikan Suara</CardTitle></CardHeader><CardContent><CardDescription>Lihat kandidat, pilih, konfirmasi. Tidak dapat diubah setelahnya.</CardDescription></CardContent></Card>
          </div>
        </div>
      </section>

      <section id="features" className="border-b py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="outline" className="mb-4">Fitur Unggulan</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Kenapa Memilih UniVertex?</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card><CardHeader><Shield className="h-10 w-10 text-primary mb-4" /><CardTitle>Keamanan Maksimal</CardTitle></CardHeader><CardContent><CardDescription>Enkripsi, RLS, audit log, deteksi multi-device.</CardDescription></CardContent></Card>
            <Card><CardHeader><Zap className="h-10 w-10 text-primary mb-4" /><CardTitle>Real-time Results</CardTitle></CardHeader><CardContent><CardDescription>Pantau hasil pemilihan secara langsung.</CardDescription></CardContent></Card>
            <Card><CardHeader><Users className="h-10 w-10 text-primary mb-4" /><CardTitle>Multi-Role System</CardTitle></CardHeader><CardContent><CardDescription>Admin, Voter, Kandidat dengan hak akses terkelola.</CardDescription></CardContent></Card>
            <Card><CardHeader><Lock className="h-10 w-10 text-primary mb-4" /><CardTitle>Privasi Terjaga</CardTitle></CardHeader><CardContent><CardDescription>Suara anonim, terenkripsi.</CardDescription></CardContent></Card>
            <Card><CardHeader><Clock className="h-10 w-10 text-primary mb-4" /><CardTitle>Satu Pemilih Satu Suara</CardTitle></CardHeader><CardContent><CardDescription>UNIQUE constraint mencegah vote ganda.</CardDescription></CardContent></Card>
            <Card><CardHeader><BarChart3 className="h-10 w-10 text-primary mb-4" /><CardTitle>Pasangan Calon</CardTitle></CardHeader><CardContent><CardDescription>Mendukung ketua-wakil (paslon).</CardDescription></CardContent></Card>
          </div>
        </div>
      </section>

      <section id="elections" className="border-b py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="outline" className="mb-4">Pemilihan</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Pemilihan yang Sedang Berlangsung</h2>
          </div>
          {loading ? (
            <div className="text-center py-12"><p className="text-muted-foreground">Memuat pemilihan...</p></div>
          ) : activeEvents.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6 mb-16">
              {activeEvents.map((event) => (
                <Card key={event.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="gap-1"><Vote className="h-3 w-3" />Aktif</Badge>
                          {event.election_type === "open" && <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" />Terbuka</Badge>}
                        </div>
                        <CardTitle className="text-xl">{event.title}</CardTitle>
                        <CardDescription>{event.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /><span>Mulai: {format(new Date(event.start_time), "dd MMMM yyyy, HH:mm", { locale: id })}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /><span>Berakhir: {format(new Date(event.end_time), "dd MMMM yyyy, HH:mm", { locale: id })}</span></div>
                    </div>
                    {event.election_type === "open" ? (
                      <div className="space-y-2">
                        <Button asChild className="w-full"><Link to="/login">Ikuti Pemilihan</Link></Button>
                        <Button asChild variant="outline" className="w-full gap-2"><Link to={`/results/${event.id}`}><BarChart3 className="w-4 h-4" />Lihat Hasil Real-time</Link></Button>
                      </div>
                    ) : (
                      <Button asChild className="w-full"><Link to="/login">Ikuti Pemilihan</Link></Button>
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
              </CardContent>
            </Card>
          )}
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="w-4 h-4" /><span>Selesai: {format(new Date(event.end_time), "dd MMM yyyy", { locale: id })}</span></div>
                        <Button asChild variant="outline" className="w-full gap-2"><Link to={`/results/${event.id}`}><TrendingUp className="w-4 h-4" />Lihat Hasil</Link></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="faq" className="border-b py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">FAQ</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Pertanyaan yang Sering Diajukan</h2>
            </div>
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="border rounded-lg px-6 bg-background"><AccordionTrigger className="hover:no-underline">Apa itu UniVertex?</AccordionTrigger><AccordionContent className="text-muted-foreground">Platform e-voting modern untuk institusi pendidikan tinggi.</AccordionContent></AccordionItem>
              <AccordionItem value="item-2" className="border rounded-lg px-6 bg-background"><AccordionTrigger className="hover:no-underline">Bagaimana cara mendapatkan akun?</AccordionTrigger><AccordionContent className="text-muted-foreground">Sistem undangan (invite-only). Admin mengirim tautan ke email Anda.</AccordionContent></AccordionItem>
              <AccordionItem value="item-3" className="border rounded-lg px-6 bg-background"><AccordionTrigger className="hover:no-underline">Apakah suara saya bersifat rahasia?</AccordionTrigger><AccordionContent className="text-muted-foreground">Ya, mutlak rahasia.</AccordionContent></AccordionItem>
              <AccordionItem value="item-4" className="border rounded-lg px-6 bg-background"><AccordionTrigger className="hover:no-underline">Bisakah saya mengubah pilihan setelah vote?</AccordionTrigger><AccordionContent className="text-muted-foreground">Tidak. Setelah konfirmasi, suara tidak dapat diubah.</AccordionContent></AccordionItem>
              <AccordionItem value="item-5" className="border rounded-lg px-6 bg-background"><AccordionTrigger className="hover:no-underline">Bagaimana jika lupa password?</AccordionTrigger><AccordionContent className="text-muted-foreground">Klik "Lupa password?" di halaman login.</AccordionContent></AccordionItem>
              <AccordionItem value="item-6" className="border rounded-lg px-6 bg-background"><AccordionTrigger className="hover:no-underline">Bagaimana jika login dari perangkat lain?</AccordionTrigger><AccordionContent className="text-muted-foreground">Setiap perangkat tercatat di menu "Perangkat Saya". Cabut yang mencurigakan.</AccordionContent></AccordionItem>
              <AccordionItem value="item-7" className="border rounded-lg px-6 bg-background"><AccordionTrigger className="hover:no-underline">Apakah platform ini aman?</AccordionTrigger><AccordionContent className="text-muted-foreground">Ya. UNIQUE constraint DB, RLS, audit log, deteksi multi-device.</AccordionContent></AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      <section className="border-b py-20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Siap Berpartisipasi dalam Demokrasi?</h2>
            <p className="text-lg text-muted-foreground">Hubungi admin/panitia pemilihan untuk menerima tautan undangan.</p>
            <Button asChild size="lg"><Link to="/login">Masuk</Link></Button>
          </div>
        </div>
      </section>

      <section id="contact" className="border-b py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="outline" className="mb-4">Hubungi Kami</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Butuh Bantuan?</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="text-center"><CardHeader><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Mail className="h-6 w-6 text-primary" /></div><CardTitle>Email</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">support@univertex.com</p></CardContent></Card>
            <Card className="text-center"><CardHeader><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Phone className="h-6 w-6 text-primary" /></div><CardTitle>Telepon</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">+62 21 1234 5678</p></CardContent></Card>
            <Card className="text-center"><CardHeader><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><MapPin className="h-6 w-6 text-primary" /></div><CardTitle>Alamat</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Universitas X</p></CardContent></Card>
          </div>
        </div>
      </section>

      <footer className="pt-12 pb-6 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2"><img src={resolvedTheme === "dark" ? "/UniVertexWhite.png" : "/UniVertex-Primary.png"} alt="UniVertex" className="h-8 w-auto" /><span className="font-bold">UniVertex</span></div>
              <p className="text-sm text-muted-foreground">Platform e-voting terpercaya untuk sivitas akademika Indonesia.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Fitur</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground">Cara Kerja</a></li>
                <li><a href="#elections" className="hover:text-foreground">Pemilihan</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Dukungan</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#contact" className="hover:text-foreground">Hubungi Kami</a></li>
                <li><Link to="/login" className="hover:text-foreground">Bantuan Login</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy-policy" className="hover:text-foreground">Kebijakan Privasi</Link></li>
                <li><Link to="/terms-of-service" className="hover:text-foreground">Syarat & Ketentuan</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} UniVertex. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Index;

