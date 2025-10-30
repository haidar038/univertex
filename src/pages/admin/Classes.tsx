import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, GraduationCap } from 'lucide-react';

export default function AdminClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Manajemen Kelas</h1>
          <p className="text-muted-foreground">Kelola kelas untuk DPT</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Kelas
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Memuat...</div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center py-12">
            <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Belum ada kelas</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Mulai dengan menambahkan kelas pertama
            </p>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Kelas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((classItem) => (
            <Card key={classItem.id}>
              <CardContent className="p-6">
                <div className="mb-2 flex items-start justify-between">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-foreground">{classItem.name}</h3>
                <p className="text-sm text-muted-foreground">{classItem.faculty}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
