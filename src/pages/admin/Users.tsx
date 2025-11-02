import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users as UsersIcon, Edit, Trash2, Upload, KeyRound } from 'lucide-react';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { EditUserDialog } from '@/components/admin/users/EditUserDialog';
import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';
import { BulkImportUsersDialog } from '@/components/admin/users/BulkImportUsersDialog';
import { ResetPasswordDialog } from '@/components/admin/users/ResetPasswordDialog';

interface UserWithRoles {
  id: string;
  full_name: string;
  student_id: string;
  email?: string;
  department: string | null;
  class_id: string | null;
  classes: { name: string } | null;
  roles: Array<{ role: string }>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: UserWithRoles) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleResetPassword = (user: UserWithRoles) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
  };

  const fetchUsers = async () => {
    try {
      // Fetch all profiles with their classes and roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, department, class_id, classes(name)')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with their roles and filter out admins
      const usersWithRoles = (profilesData || []).map(profile => {
        const userRoles = (rolesData || [])
          .filter(r => r.user_id === profile.id)
          .map(r => ({ role: r.role }));

        return {
          ...profile,
          roles: userRoles,
        };
      }).filter(user => {
        // Exclude users with admin role
        return !user.roles.some(r => r.role === 'admin');
      });

      setUsers(usersWithRoles);
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
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBulkImportDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Tambah Pengguna
          </Button>
        </div>
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
                    <th className="p-4 text-left text-sm font-medium text-foreground">Aksi</th>
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
                      <td className="p-4">
                        <div className="flex gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((roleObj, idx) => (
                              <span key={idx}>{getRoleBadge(roleObj.role)}</span>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResetPassword(user)}
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchUsers}
      />
      <BulkImportUsersDialog
        open={bulkImportDialogOpen}
        onOpenChange={setBulkImportDialogOpen}
        onSuccess={fetchUsers}
      />
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />
      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        userId={selectedUser?.id || null}
        userEmail={selectedUser?.email || `${selectedUser?.student_id}@university.edu`}
        userName={selectedUser?.full_name || null}
        onSuccess={fetchUsers}
      />
      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        userId={selectedUser?.id || null}
        userName={selectedUser?.full_name || null}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
