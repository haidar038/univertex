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
import { Textarea } from '@/components/ui/textarea';

const candidateFormSchema = z.object({
  vision: z.string().min(10, 'Visi minimal 10 karakter').max(500, 'Visi maksimal 500 karakter'),
  mission: z.string().min(10, 'Misi minimal 10 karakter').max(500, 'Misi maksimal 500 karakter'),
  photo_url: z.string().url('URL foto tidak valid').optional().or(z.literal('')),
});

type CandidateFormValues = z.infer<typeof candidateFormSchema>;

interface Candidate {
  id: string;
  vision: string | null;
  mission: string | null;
  photo_url: string | null;
  user_id: string;
  profiles?: {
    full_name: string;
    student_id: string;
  };
}

interface EditCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  onSuccess?: () => void;
}

export function EditCandidateDialog({
  open,
  onOpenChange,
  candidate,
  onSuccess,
}: EditCandidateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: {
      vision: '',
      mission: '',
      photo_url: '',
    },
  });

  // Update form when candidate changes
  useEffect(() => {
    if (candidate) {
      reset({
        vision: candidate.vision || '',
        mission: candidate.mission || '',
        photo_url: candidate.photo_url || '',
      });
    }
  }, [candidate, reset]);

  const onSubmit = async (data: CandidateFormValues) => {
    if (!candidate) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          vision: data.vision,
          mission: data.mission,
          photo_url: data.photo_url || null,
        })
        .eq('id', candidate.id);

      if (error) throw error;

      toast.success('Data kandidat berhasil diperbarui!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating candidate:', error);
      toast.error(error.message || 'Gagal memperbarui kandidat');
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
          <DialogTitle>Edit Data Kandidat</DialogTitle>
          <DialogDescription>
            {candidate?.profiles && (
              <>
                Perbarui informasi visi dan misi untuk{' '}
                <strong>{(candidate.profiles as any).full_name}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vision">
              Visi <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="vision"
              placeholder="Tuliskan visi kandidat..."
              rows={3}
              {...register('vision')}
              disabled={isSubmitting}
            />
            {errors.vision && (
              <p className="text-sm text-destructive">{errors.vision.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mission">
              Misi <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="mission"
              placeholder="Tuliskan misi kandidat..."
              rows={3}
              {...register('mission')}
              disabled={isSubmitting}
            />
            {errors.mission && (
              <p className="text-sm text-destructive">{errors.mission.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo_url">URL Foto (Opsional)</Label>
            <Input
              id="photo_url"
              type="url"
              placeholder="https://example.com/photo.jpg"
              {...register('photo_url')}
              disabled={isSubmitting}
            />
            {errors.photo_url && (
              <p className="text-sm text-destructive">{errors.photo_url.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Masukkan URL foto kandidat dari sumber eksternal
            </p>
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
