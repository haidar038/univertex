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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const eventFormSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(100, 'Judul maksimal 100 karakter'),
  description: z.string().optional(),
  start_time: z.string().min(1, 'Waktu mulai harus diisi'),
  end_time: z.string().min(1, 'Waktu selesai harus diisi'),
  status: z.enum(['draft', 'active', 'closed']),
  election_type: z.enum(['open', 'closed']),
  show_results_after_voting: z.boolean(),
  public_results: z.boolean(),
}).refine((data) => {
  const startTime = new Date(data.start_time);
  const endTime = new Date(data.end_time);
  return endTime > startTime;
}, {
  message: 'Waktu selesai harus setelah waktu mulai',
  path: ['end_time'],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateEventDialog({ open, onOpenChange, onSuccess }: CreateEventDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      status: 'draft',
      election_type: 'closed',
      show_results_after_voting: false,
      public_results: false,
    },
  });

  const statusValue = watch('status');
  const electionTypeValue = watch('election_type');
  const showResultsAfterVoting = watch('show_results_after_voting');
  const publicResults = watch('public_results');

  const onSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('election_events').insert({
        title: data.title,
        description: data.description || null,
        start_time: data.start_time,
        end_time: data.end_time,
        status: data.status,
        election_type: data.election_type,
        show_results_after_voting: data.show_results_after_voting,
        public_results: data.public_results,
      });

      if (error) throw error;

      toast.success('Acara berhasil dibuat!');
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error(error.message || 'Gagal membuat acara');
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Acara Pemilihan Baru</DialogTitle>
          <DialogDescription>
            Isi informasi acara pemilihan. Anda dapat menyimpan sebagai draft atau langsung mengaktifkan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Judul Acara <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Contoh: Pemilihan Ketua BEM 2025"
              {...register('title')}
              disabled={isSubmitting}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              placeholder="Deskripsi singkat tentang acara pemilihan..."
              rows={3}
              {...register('description')}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_time">
                Waktu Mulai <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_time"
                type="datetime-local"
                {...register('start_time')}
                disabled={isSubmitting}
              />
              {errors.start_time && (
                <p className="text-sm text-destructive">{errors.start_time.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">
                Waktu Selesai <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end_time"
                type="datetime-local"
                {...register('end_time')}
                disabled={isSubmitting}
              />
              {errors.end_time && (
                <p className="text-sm text-destructive">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          {/* Election Type */}
          <div className="space-y-3">
            <Label>
              Jenis Pemilihan <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={electionTypeValue}
              onValueChange={(value) => setValue('election_type', value as 'open' | 'closed')}
              disabled={isSubmitting}
            >
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="closed" id="closed" />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="closed" className="font-medium cursor-pointer">
                    Tertutup (Closed)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Hasil hanya tampil setelah pemilihan ditutup. Lebih netral dan menghindari bandwagon effect.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="open" id="open" />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="open" className="font-medium cursor-pointer">
                    Terbuka (Open)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Progress dan hasil visible real-time. Lebih transparan tapi bisa mempengaruhi voter behavior.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Visibility Options */}
          <div className="space-y-3 rounded-md border p-4">
            <Label className="text-base">Pengaturan Visibilitas Hasil</Label>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="show_results_after_voting"
                checked={showResultsAfterVoting}
                onCheckedChange={(checked) => setValue('show_results_after_voting', checked as boolean)}
                disabled={isSubmitting}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="show_results_after_voting" className="cursor-pointer font-medium">
                  Tampilkan hasil setelah voter memilih
                </Label>
                <p className="text-sm text-muted-foreground">
                  Voter dapat melihat hasil sementara setelah mereka memberikan suara (hanya berlaku saat pemilihan masih aktif).
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="public_results"
                checked={publicResults}
                onCheckedChange={(checked) => setValue('public_results', checked as boolean)}
                disabled={isSubmitting}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="public_results" className="cursor-pointer font-medium">
                  Hasil publik (tanpa login)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Hasil pemilihan dapat dilihat oleh siapa saja di halaman depan tanpa perlu login.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={statusValue}
              onValueChange={(value) => setValue('status', value as any)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft - Belum dipublikasi</SelectItem>
                <SelectItem value="active">Aktif - Pemilihan sedang berlangsung</SelectItem>
                <SelectItem value="closed">Selesai - Pemilihan sudah ditutup</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive">{errors.status.message}</p>
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
              {isSubmitting ? 'Menyimpan...' : 'Buat Acara'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
