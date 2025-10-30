import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';

export default function CandidateSettings() {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchCandidateProfiles();
    }
  }, [profile]);

  const fetchCandidateProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*, election_events(title)')
        .eq('user_id', profile?.id || '');

      if (error) throw error;
      setCandidates(data || []);
    } catch (error) {
      console.error('Error fetching candidate profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (candidateId: string, vision: string, mission: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ vision, mission })
        .eq('id', candidateId);

      if (error) throw error;
      toast.success('Profil kandidat berhasil diperbarui');
      fetchCandidateProfiles();
    } catch (error: any) {
      console.error('Error updating candidate profile:', error);
      toast.error('Gagal memperbarui profil kandidat');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Memuat...</div>;
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Pengaturan Kandidat</h1>
          <p className="text-muted-foreground">Kelola profil kandidat Anda</p>
        </div>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[200px] items-center justify-center">
              <p className="text-muted-foreground">
                Anda belum terdaftar sebagai kandidat di pemilihan manapun
              </p>
            </CardContent>
          </Card>
        ) : (
          candidates.map((candidate) => (
            <Card key={candidate.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {(candidate.election_events as any).title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CandidateForm
                  candidate={candidate}
                  onUpdate={handleUpdate}
                  loading={loading}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function CandidateForm({
  candidate,
  onUpdate,
  loading,
}: {
  candidate: any;
  onUpdate: (id: string, vision: string, mission: string) => void;
  loading: boolean;
}) {
  const [vision, setVision] = useState(candidate.vision || '');
  const [mission, setMission] = useState(candidate.mission || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(candidate.id, vision, mission);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`vision-${candidate.id}`}>Visi</Label>
        <Textarea
          id={`vision-${candidate.id}`}
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          disabled={loading}
          rows={4}
          placeholder="Tuliskan visi Anda..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`mission-${candidate.id}`}>Misi</Label>
        <Textarea
          id={`mission-${candidate.id}`}
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          disabled={loading}
          rows={4}
          placeholder="Tuliskan misi Anda..."
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
      </Button>
    </form>
  );
}
