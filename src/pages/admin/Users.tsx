import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users as UsersIcon } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, classes(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary">Admin</Badge>;
      case 'candidate':
        return <Badge className="bg-accent">Kandidat</Badge>;
      default:
        return <Badge variant="secondary">Pemilih</Badge>;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Manajemen Pengguna</h1>
          <p className="text-muted-foreground">Kelola pengguna dan peran mereka</p>
        </div>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Tambah Pengguna
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Memuat...</div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center py-12">
            <UsersIcon className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Belum ada pengguna</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Mulai dengan menambahkan pengguna pertama
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="p-4 text-left text-sm font-medium text-foreground">Nama</th>
                    <th className="p-4 text-left text-sm font-medium text-foreground">NIM</th>
                    <th className="p-4 text-left text-sm font-medium text-foreground">Kelas</th>
                    <th className="p-4 text-left text-sm font-medium text-foreground">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="p-4 text-sm text-foreground">{user.full_name}</td>
                      <td className="p-4 text-sm text-muted-foreground">{user.student_id}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {user.classes?.name || '-'}
                      </td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
