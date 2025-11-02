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
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface Class {
  id: string;
  name: string;
  faculty: string | null;
}

interface User {
  id: string;
  full_name: string;
  student_id: string;
  department: string | null;
  class_id: string | null;
  roles: Array<{ role: string }>;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess?: () => void;
}

export function EditUserDialog({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) {
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
      full_name: '',
      student_id: '',
      department: '',
      class_id: '',
      roles: {
        voter: false,
        candidate: false,
      },
    },
  });

  const classIdValue = watch('class_id');
  const rolesValue = watch('roles');

  // Fetch classes
  useEffect(() => {
    if (open) {
      fetchClasses();
    }
  }, [open]);

  // Update form when user changes
  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name,
        student_id: user.student_id,
        department: user.department || '',
        class_id: user.class_id || '',
        roles: {
          voter: user.roles.some((r) => r.role === 'voter'),
          candidate: user.roles.some((r) => r.role === 'candidate'),
        },
      });
    }
  }, [user, reset]);

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
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          student_id: data.student_id,
          department: data.department || null,
          class_id: data.class_id || null,
        })
        .eq('id', user.id);

      if (profileError) {
        if (profileError.code === '23505') {
          throw new Error('NIM sudah digunakan oleh pengguna lain');
        }
        throw profileError;
      }

      // Update roles
      // Delete all current roles (except admin)
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id)
        .neq('role', 'admin');

      // Insert new roles
      const rolesToInsert = [];
      if (data.roles.voter) rolesToInsert.push({ user_id: user.id, role: 'voter' });
      if (data.roles.candidate) rolesToInsert.push({ user_id: user.id, role: 'candidate' });

      if (rolesToInsert.length > 0) {
        const { error: rolesError } = await supabase
          .from('user_roles')
          .insert(rolesToInsert);

        if (rolesError && rolesError.code !== '23505') {
          throw rolesError;
        }
      }

      toast.success('Pengguna berhasil diperbarui!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Gagal memperbarui pengguna');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
          <DialogDescription>
            Perbarui informasi pengguna dan kelola role mereka.
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
              value={classIdValue || 'none'}
              onValueChange={(value) => setValue('class_id', value === 'none' ? '' : value)}
              disabled={loadingClasses || isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingClasses ? 'Memuat...' : 'Pilih kelas'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
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
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
