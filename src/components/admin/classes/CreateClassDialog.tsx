import { useState } from 'react';
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

const classFormSchema = z.object({
  name: z.string().min(2, 'Nama kelas minimal 2 karakter').max(100, 'Nama kelas maksimal 100 karakter'),
  faculty: z.string().min(2, 'Nama fakultas minimal 2 karakter').max(100, 'Nama fakultas maksimal 100 karakter'),
});

type ClassFormValues = z.infer<typeof classFormSchema>;

interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateClassDialog({ open, onOpenChange, onSuccess }: CreateClassDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: '',
      faculty: '',
    },
  });

  const onSubmit = async (data: ClassFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('classes').insert({
        name: data.name,
        faculty: data.faculty,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Nama kelas sudah digunakan');
        }
        throw error;
      }

      toast.success('Kelas berhasil ditambahkan!');
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating class:', error);
      toast.error(error.message || 'Gagal menambahkan kelas');
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Tambah Kelas Baru</DialogTitle>
          <DialogDescription>
            Tambahkan kelas baru untuk mengelompokkan pemilih (DPT).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nama Kelas <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Contoh: TI-1A, SI-2B"
              {...register('name')}
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="faculty">
              Fakultas <span className="text-destructive">*</span>
            </Label>
            <Input
              id="faculty"
              placeholder="Contoh: Fakultas Teknik Informatika"
              {...register('faculty')}
              disabled={isSubmitting}
            />
            {errors.faculty && (
              <p className="text-sm text-destructive">{errors.faculty.message}</p>
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
              {isSubmitting ? 'Menambahkan...' : 'Tambah Kelas'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
