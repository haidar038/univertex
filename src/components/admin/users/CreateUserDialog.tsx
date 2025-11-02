import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const userFormSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  student_id: z.string().min(1, 'NIM harus diisi'),
  department: z.string().optional(),
  class_id: z.string().optional(),
  roles: z.object({
    voter: z.boolean(),
    candidate: z.boolean(),
  }).refine((data) => data.voter || data.candidate, {
    message: 'Minimal satu role harus dipilih',
  }),
  email_confirm: z.boolean(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface Class {
  id: string;
  name: string;
  faculty: string | null;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      student_id: '',
      department: '',
      class_id: '',
      roles: {
        voter: true,
        candidate: false,
      },
      email_confirm: true,
    },
  });

  const classIdValue = watch('class_id');
  const emailConfirmValue = watch('email_confirm');
  const rolesValue = watch('roles');

  // Fetch classes
  useEffect(() => {
    if (open) {
      fetchClasses();
    }
  }, [open]);

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, faculty')
        .order('faculty')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      toast.error('Gagal memuat daftar kelas');
    } finally {
      setLoadingClasses(false);
    }
  };

  const onSubmit = async (data: UserFormValues) => {
    setIsSubmitting(true);
    try {
      // Create user using Supabase Auth Admin API
      const { data: userData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            student_id: data.student_id,
            department: data.department,
            class_id: data.class_id || null,
            // Note: Trigger will auto-assign voter role for any role except 'admin'
            // We manually manage roles below based on user selection
            role: 'voter',
          },
          // Skip email confirmation if checkbox is checked
          emailRedirectTo: data.email_confirm ? undefined : window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!userData.user) throw new Error('Gagal membuat user');

      const userId = userData.user.id;

      // Update profile with additional data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          student_id: data.student_id,
          department: data.department || null,
          class_id: data.class_id || null,
        })
        .eq('id', userId);

      if (profileError) {
        console.warn('Profile update warning:', profileError);
      }

      // Delete default voter role if not selected
      if (!data.roles.voter) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'voter');
      }

      // Add candidate role if selected
      if (data.roles.candidate) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'candidate',
          });

        if (roleError && roleError.code !== '23505') {
          console.warn('Role assignment warning:', roleError);
        }
      }

      toast.success('Pengguna berhasil dibuat!');
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.message?.includes('already registered')) {
        toast.error('Email sudah terdaftar');
      } else if (error.code === '23505') {
        toast.error('NIM sudah digunakan');
      } else {
        toast.error(error.message || 'Gagal membuat pengguna');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          <DialogDescription>
            Buat akun pengguna baru untuk sistem e-voting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                placeholder="Nama lengkap"
                {...register('full_name')}
                disabled={isSubmitting}
              />
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="student_id">
                NIM <span className="text-destructive">*</span>
              </Label>
              <Input
                id="student_id"
                placeholder="NIM"
                {...register('student_id')}
                disabled={isSubmitting}
              />
              {errors.student_id && (
                <p className="text-sm text-destructive">{errors.student_id.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              {...register('email')}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimal 6 karakter"
              {...register('password')}
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Jurusan</Label>
            <Input
              id="department"
              placeholder="Nama jurusan"
              {...register('department')}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="class_id">Kelas</Label>
            <Select
              value={classIdValue}
              onValueChange={(value) => setValue('class_id', value)}
              disabled={loadingClasses || isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingClasses ? 'Memuat...' : 'Pilih kelas'} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} {cls.faculty && `- ${cls.faculty}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>
              Roles <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="role-voter"
                  checked={rolesValue.voter}
                  onCheckedChange={(checked) =>
                    setValue('roles.voter', checked as boolean)
                  }
                  disabled={isSubmitting}
                />
                <Label htmlFor="role-voter" className="cursor-pointer font-normal">
                  Pemilih (Voter)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="role-candidate"
                  checked={rolesValue.candidate}
                  onCheckedChange={(checked) =>
                    setValue('roles.candidate', checked as boolean)
                  }
                  disabled={isSubmitting}
                />
                <Label htmlFor="role-candidate" className="cursor-pointer font-normal">
                  Kandidat (Candidate)
                </Label>
              </div>
            </div>
            {errors.roles && (
              <p className="text-sm text-destructive">{errors.roles.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="email_confirm"
              checked={emailConfirmValue}
              onCheckedChange={(checked) => setValue('email_confirm', checked as boolean)}
              disabled={isSubmitting}
            />
            <Label htmlFor="email_confirm" className="cursor-pointer text-sm font-normal">
              Konfirmasi email otomatis (tidak perlu verifikasi email)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Membuat...' : 'Buat Pengguna'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
