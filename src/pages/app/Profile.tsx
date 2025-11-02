import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { User, Lock, Edit, Mail } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  student_id: string;
  department: string;
  class_id: string;
  roles: string[];
  email?: string;
}

export default function ProfilePage() {
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; faculty: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Edit Profile Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Change Password Dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchClasses();
  }, [authProfile]);

  const fetchUserData = async () => {
    if (!authProfile?.id) return;

    setLoading(true);
    try {
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authProfile.id)
        .single();

      if (profileError) throw profileError;

      // Fetch user email from auth
      const { data: { user } } = await supabase.auth.getUser();

      setProfile({
        ...profileData,
        roles: authProfile.roles || [],
        email: user?.email || '',
      });
    } catch (error: any) {
      console.error('Error fetching user data:', error);
      toast.error('Gagal memuat data profil');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, faculty')
      .order('faculty', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching classes:', error);
      return;
    }

    setClasses(data || []);
  };

  const handleOpenEditDialog = () => {
    if (!profile) return;
    setEditFullName(profile.full_name || '');
    setEditDepartment(profile.department || '');
    setEditClassId(profile.class_id || '');
    setEditDialogOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName,
          department: editDepartment,
          class_id: editClassId || null
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profil berhasil diperbarui');
      setEditDialogOpen(false);
      await fetchUserData(); // Refresh data
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Gagal memperbarui profil');
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Password baru tidak cocok');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password berhasil diubah');
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('Gagal mengubah password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getClassName = () => {
    if (!profile?.class_id) return '-';
    const cls = classes.find(c => c.id === profile.class_id);
    return cls ? `${cls.name} - ${cls.faculty}` : '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Memuat data profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Profil Saya</h1>
          <p className="text-muted-foreground">Kelola informasi profil Anda</p>
        </div>

        {/* Profile Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informasi Profil
            </CardTitle>
            <Button onClick={handleOpenEditDialog} variant="outline" size="sm" className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 py-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Nama Lengkap</span>
              <span className="col-span-2 text-sm text-foreground">{profile?.full_name || '-'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">NIM</span>
              <span className="col-span-2 text-sm text-foreground">{profile?.student_id || '-'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Email</span>
              <span className="col-span-2 text-sm text-foreground">{profile?.email || '-'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Jurusan</span>
              <span className="col-span-2 text-sm text-foreground">{profile?.department || '-'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-b">
              <span className="text-sm font-medium text-muted-foreground">Kelas</span>
              <span className="col-span-2 text-sm text-foreground">{getClassName()}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3">
              <span className="text-sm font-medium text-muted-foreground">Role</span>
              <span className="col-span-2 text-sm text-foreground">
                {profile?.roles
                  .map(role =>
                    role === 'admin' ? 'Administrator' :
                    role === 'candidate' ? 'Kandidat' :
                    role === 'voter' ? 'Pemilih' : role
                  )
                  .join(', ') || '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Keamanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setPasswordDialogOpen(true)} variant="outline" className="gap-2">
              <Lock className="h-4 w-4" />
              Ubah Password
            </Button>
          </CardContent>
        </Card>

        {/* Edit Profile Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Profil</DialogTitle>
              <DialogDescription>
                Perbarui informasi profil Anda di sini.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateProfile}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-fullName">Nama Lengkap</Label>
                  <Input
                    id="edit-fullName"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    disabled={editLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>NIM</Label>
                  <Input value={profile?.student_id} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-department">Jurusan</Label>
                  <Input
                    id="edit-department"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="Masukkan jurusan Anda"
                    disabled={editLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-class">Kelas</Label>
                  <Select value={editClassId} onValueChange={setEditClassId} disabled={editLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} - {cls.faculty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editLoading}>
                  Batal
                </Button>
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Ubah Password</DialogTitle>
              <DialogDescription>
                Masukkan password baru Anda. Password minimal 6 karakter.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Password Baru</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={passwordLoading}
                    placeholder="Minimal 6 karakter"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={passwordLoading}
                    placeholder="Ketik ulang password baru"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPasswordDialogOpen(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={passwordLoading}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? 'Mengubah...' : 'Ubah Password'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
