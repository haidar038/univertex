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
import { logAudit } from '@/lib/audit';

const userFormSchema = z.object({
  email: z.string().email('EmailNot tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
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
  const [loadingClass, setLoadingClass] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '', password: '', full_name: '', student_id: '',
      department: '', class_id: '',
      roles: { voter: true, candidate: false },
      email_confirm: true,
    },
  });

  const classIdValue = watch('class_id');
  const emailConfirmValue = watch('email_confirm');
  const rolesValue = watch('roles');

  useEffect(() => { if (open) fetchClasses(); }, [open]);

  const fetchClasses = async () => {
    setLoadingClass(true);
    try {
      const { data, error } = await supabase.from('classes').select('id, name, faculty').order('faculty').order('name');
      if (error) throw error;
      setClasses(data || []);
    } catch (e: unknown) {
      console.error(e);
      toast.error('Gagal memuat daftar kelas');
    } finally {
      setLoadingClass(false);
    }
  };

  const onSubmit = async (data: UserFormValues) => {
    setIsSubmitting(true);
    try {
      // Use the admin_create_user RPC instead of supabase.auth.signUp:
      // signUp from the admin's browser would REPLACE the admin's own
      // session with the new user's session (session hijack by design).
      const { data: newUserId, error: rpcError } = await supabase.rpc('admin_create_user', {
        p_email: data.email,
        p_full_name: data.full_name,
        p_password: data.password,
        p_student_id: data.student_id,
        p_class_id: data.class_id || null,
        p_department: data.department || null,
        p_skip_confirmation: data.email_confirm,
      });

      if (rpcError) throw rpcError;
      if (!newUserId) throw new Error('Gagal membuat user');

      const userId = newUserId as string;

      // Role adjustments on top of the default 'voter' role created by the
      // handle_new_user trigger.
      if (!data.roles.voter) {
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'voter');
      }
      if (data.roles.candidate) {
        await supabase.from('user_roles').insert({ user_id: userId, role: 'candidate' });
      }

      await logAudit({
        action: 'user.create',
        description: `Created user ${data.full_name} (${data.student_id})`,
        category: 'admin',
        targetType: 'auth.users',
        targetId: userId,
        metadata: {
          email: data.email,
          student_id: data.student_id,
          class_id: data.class_id || null,
          roles: Object.entries(data.roles).filter(([, v]) => v).map(([k]) => k),
        },
      });

      toast.success('Pengguna berhasil dibuat!');
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      console.error(e);
      let msg = e instanceof Error ? e.message : 'Gagal membuat pengguna';
      if (/23505/.test(msg) || /sudah terdaftar/i.test(msg)) {
        msg = 'Email sudah terdaftar';
      } else if (/sudah digunakan/i.test(msg)) {
        msg = 'NIM sudah digunakan';
      } else if (/password minimal/i.test(msg)) {
        msg = 'Password minimal 8 karakter';
      }
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => { reset(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          <DialogDescription>Buat akun pengguna baru untuk sistem e-voting.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nama Lengkap <span className="text-destructive">*</span></Label>
              <Input id="full_name" placeholder="Nama lengkap" {...register('full_name')} disabled={isSubmitting} />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="student_id">NIM <span className="text-destructive">*</span></Label>
              <Input id="student_id" placeholder="NIM" {...register('student_id')} disabled={isSubmitting} />
              {errors.student_id && <p className="text-sm text-destructive">{errors.student_id.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <Input id="email" type="email" placeholder="email@example.com" {...register('email')} disabled={isSubmitting} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
            <Input id="password" type="password" placeholder="Minimal 8 karakter" {...register('password')} disabled={isSubmitting} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Jurusan</Label>
            <Input id="department" placeholder="Nama jurusan" {...register('department')} disabled={isSubmitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class_id">Kelas</Label>
            <Select value={classIdValue} onValueChange={(v) => setValue('class_id', v)} disabled={loadingClass || isSubmitting}>
              <SelectTrigger><SelectValue placeholder={loadingClass ? 'Memuat...' : 'Pilih kelas'} /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} {c.faculty && `- ${c.faculty}`}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label>Roles <span className="text-destructive">*</span></Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="role-voter" checked={rolesValue.voter} onCheckedChange={(c) => setValue('roles.voter', c as boolean)} disabled={isSubmitting} />
                <Label htmlFor="role-voter" className="cursor-pointer font-normal">Pemilih (Voter)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="role-candidate" checked={rolesValue.candidate} onCheckedChange={(c) => setValue('roles.candidate', c as boolean)} disabled={isSubmitting} />
                <Label htmlFor="role-candidate" className="cursor-pointer font-normal">Kandidat (Candidate)</Label>
              </div>
            </div>
            {errors.roles && <p className="text-sm text-destructive">{errors.roles.message}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="email_confirm" checked={emailConfirmValue} onCheckedChange={(c) => setValue('email_confirm', c as boolean)} disabled={isSubmitting} />
            <Label htmlFor="email_confirm" className="cursor-pointer text-sm font-normal">Konfirmasi email otomatis</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Membuat...' : 'Buat Pengguna'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
