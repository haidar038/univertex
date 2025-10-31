import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Vote, Calendar, Users, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
}

function Index() {
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveEvents();
  }, []);

  const fetchActiveEvents = async () => {
    const { data, error } = await supabase
      .from('election_events')
      .select('*')
      .eq('status', 'active')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
    } else {
      setActiveEvents(data || []);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Vote className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            Sistem E-Voting Universitas
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Platform pemilihan elektronik yang aman, transparan, dan mudah digunakan untuk seluruh sivitas akademika
          </p>
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
              <CardDescription>
                Sistem keamanan berlapis untuk menjamin integritas setiap suara
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Users className="w-12 h-12 text-primary mb-4" />
              <CardTitle>Mudah Digunakan</CardTitle>
              <CardDescription>
                Interface yang intuitif memudahkan semua pengguna untuk berpartisipasi
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Calendar className="w-12 h-12 text-primary mb-4" />
              <CardTitle>Real-time</CardTitle>
              <CardDescription>
                Pantau hasil pemilihan secara langsung setelah periode voting berakhir
              </CardDescription>
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
                    <CardTitle>{event.title}</CardTitle>
                    <CardDescription>{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>
                          Mulai: {format(new Date(event.start_time), 'dd MMMM yyyy, HH:mm', { locale: id })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>
                          Berakhir: {format(new Date(event.end_time), 'dd MMMM yyyy, HH:mm', { locale: id })}
                        </span>
                      </div>
                    </div>
                    <Button asChild className="w-full mt-4">
                      <Link to="/login">Ikuti Pemilihan</Link>
                    </Button>
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
