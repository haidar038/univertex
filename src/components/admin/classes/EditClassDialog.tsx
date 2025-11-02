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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Calendar } from 'lucide-react';

const classFormSchema = z.object({
  name: z.string().min(2, 'Nama kelas minimal 2 karakter').max(100, 'Nama kelas maksimal 100 karakter'),
  faculty: z.string().min(2, 'Nama fakultas minimal 2 karakter').max(100, 'Nama fakultas maksimal 100 karakter'),
});

type ClassFormValues = z.infer<typeof classFormSchema>;

interface Class {
  id: string;
  name: string;
  faculty: string | null;
}

interface EditClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class | null;
  onSuccess?: () => void;
}

export function EditClassDialog({
  open,
  onOpenChange,
  classData,
  onSuccess,
}: EditClassDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);

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

  // Update form when classData changes
  useEffect(() => {
    if (classData) {
      reset({
        name: classData.name,
        faculty: classData.faculty || '',
      });
      fetchClassInfo();
    }
  }, [classData, reset]);

  const fetchClassInfo = async () => {
    if (!classData) return;

    try {
      // Get student count
      const { count: studentsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classData.id);

      setStudentCount(studentsCount || 0);

      // Get event count
      const { count: eventsCount } = await supabase
        .from('event_voter_groups')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classData.id);

      setEventCount(eventsCount || 0);
    } catch (error) {
      console.error('Error fetching class info:', error);
    }
  };

  const onSubmit = async (data: ClassFormValues) => {
    if (!classData) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('classes')
        .update({
          name: data.name,
          faculty: data.faculty,
        })
        .eq('id', classData.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Nama kelas sudah digunakan');
        }
        throw error;
      }

      toast.success('Kelas berhasil diperbarui!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating class:', error);
      toast.error(error.message || 'Gagal memperbarui kelas');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Kelas</DialogTitle>
          <DialogDescription>
            Perbarui informasi kelas. Hati-hati saat mengubah nama kelas yang sudah digunakan.
          </DialogDescription>
        </DialogHeader>

        {(studentCount > 0 || eventCount > 0) && (
          <Alert>
            <AlertDescription className="text-sm">
              <div className="space-y-1">
                {studentCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>
                      Kelas ini memiliki <strong>{studentCount}</strong> siswa
                    </span>
                  </div>
                )}
                {eventCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Digunakan di <strong>{eventCount}</strong> acara pemilihan
                    </span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

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
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
