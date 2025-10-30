import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Vote, User } from 'lucide-react';

export default function VotingPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEventAndCandidates();
    }
  }, [eventId]);

  const fetchEventAndCandidates = async () => {
    try {
      const { data: eventData } = await supabase
        .from('election_events')
        .select('*')
        .eq('id', eventId)
        .single();

      const { data: candidatesData } = await supabase
        .from('candidates')
        .select('*, profiles(full_name, student_id)')
        .eq('event_id', eventId);

      setEvent(eventData);
      setCandidates(candidatesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidate || !profile) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('votes').insert({
        voter_id: profile.id,
        candidate_id: selectedCandidate,
        event_id: eventId,
      });

      if (error) {
        if (error.message.includes('unique')) {
          toast.error('Anda sudah memberikan suara untuk pemilihan ini');
        } else {
          throw error;
        }
      } else {
        toast.success('Suara Anda berhasil tercatat!');
        navigate('/app/dashboard');
      }
    } catch (error: any) {
      console.error('Error submitting vote:', error);
      toast.error('Gagal memberikan suara. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Memuat...</div>;
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">{event?.title}</h1>
          <p className="text-muted-foreground">Pilih satu kandidat yang Anda dukung</p>
        </div>

        <div className="mb-8 rounded-lg bg-primary/10 p-4 text-sm">
          <p className="font-medium text-foreground">
            <Vote className="mb-1 mr-2 inline h-4 w-4" />
            Anda hanya dapat memberikan satu suara. Pilihan tidak dapat diubah setelah dikonfirmasi.
          </p>
        </div>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[200px] items-center justify-center">
              <p className="text-muted-foreground">Belum ada kandidat</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {candidates.map((candidate) => (
              <Card
                key={candidate.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedCandidate === candidate.id
                    ? 'border-primary bg-primary/5 shadow-primary'
                    : ''
                }`}
                onClick={() => setSelectedCandidate(candidate.id)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary">
                      <User className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">
                        {(candidate.profiles as any).full_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {(candidate.profiles as any).student_id}
                      </p>
                    </div>
                    {selectedCandidate === candidate.id && (
                      <div className="rounded-full bg-primary p-2">
                        <Vote className="h-5 w-5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">Visi</h3>
                    <p className="text-sm text-muted-foreground">
                      {candidate.vision || 'Belum diisi'}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">Misi</h3>
                    <p className="text-sm text-muted-foreground">
                      {candidate.mission || 'Belum diisi'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedCandidate && (
          <div className="mt-8 flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate('/app/dashboard')}>
              Batal
            </Button>
            <Button onClick={() => setShowConfirm(true)} className="gap-2">
              <Vote className="h-4 w-4" />
              Konfirmasi Pilihan
            </Button>
          </div>
        )}

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Pilihan Anda</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin dengan pilihan Anda? Keputusan ini tidak dapat diubah
                setelah dikonfirmasi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleVote} disabled={submitting}>
                {submitting ? 'Memproses...' : 'Ya, Saya Yakin'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
