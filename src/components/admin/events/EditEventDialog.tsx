import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import { EventDateTimeFields } from '@/components/admin/events/EventDateTimeFields';
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
import { cn } from '@/lib/utils';
import { localDateTimeToUTCISO, utcToLocalDate, utcToLocalTime } from '@/lib/datetime';

const eventFormSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(100, 'Judul maksimal 100 karakter'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Tanggal mulai harus diisi'),
  start_time: z.string().min(1, 'Waktu mulai harus diisi'),
  end_date: z.string().min(1, 'Tanggal selesai harus diisi'),
  end_time: z.string().min(1, 'Waktu selesai harus diisi'),
  election_type: z.enum(['open', 'closed']),
  show_results_after_voting: z.boolean(),
  public_results: z.boolean(),
}).refine((data) => {
  const startTime = new Date(`${data.start_date}T${data.start_time}`);
  const endTime = new Date(`${data.end_date}T${data.end_time}`);
  return endTime > startTime;
}, {
  message: 'Waktu selesai harus setelah waktu mulai',
  path: ['end_time'],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  election_type?: 'open' | 'closed';
  show_results_after_voting?: boolean;
  public_results?: boolean;
}

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
  onSuccess?: () => void;
}

export function EditEventDialog({ open, onOpenChange, event, onSuccess }: EditEventDialogProps) {
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
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      election_type: 'closed',
      show_results_after_voting: false,
      public_results: false,
    },
  });

  const electionTypeValue = watch('election_type');
  const showResultsAfterVoting = watch('show_results_after_voting');
  const publicResults = watch('public_results');

  // Simpan sebagai UTC; tampilkan sebagai waktu lokal (anti-geser zona waktu).
  const normalizeDateTime = (date: string, time: string) => localDateTimeToUTCISO(date, time);

  // Update form when event changes
  useEffect(() => {
    if (event) {
      const startDate = utcToLocalDate(event.start_time);
      const startTime = utcToLocalTime(event.start_time);
      const endDate = utcToLocalDate(event.end_time);
      const endTime = utcToLocalTime(event.end_time);

      reset({
        title: event.title,
        description: event.description || '',
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        election_type: event.election_type || 'closed',
        show_results_after_voting: event.show_results_after_voting || false,
        public_results: event.public_results || false,
      });
    }
  }, [event, reset]);

  const onSubmit = async (data: EventFormValues) => {
    if (!event) return;

    setIsSubmitting(true);
    try {
      const startTime = normalizeDateTime(data.start_date, data.start_time);
      const endTime = normalizeDateTime(data.end_date, data.end_time);

      const { error } = await supabase
        .from('election_events')
        .update({
          title: data.title,
          description: data.description || null,
          start_time: startTime,
          end_time: endTime,
          election_type: data.election_type,
          show_results_after_voting: data.show_results_after_voting,
          public_results: data.public_results,
        })
        .eq('id', event.id);

      if (error) throw error;

      // Jejak audit: perubahan jadwal/konten event harus tercatat (Peraturan §4).
      // Fire-and-forget: kegagalan audit tidak boleh menggagalkan update.
      const windowChanged =
        startTime !== event.start_time || endTime !== event.end_time;
      await logAudit({
        action: 'event.update',
        description: `Updated election event "${data.title}"`,
        category: 'election',
        targetType: 'election_events',
        targetId: event.id,
        metadata: {
          title: data.title,
          start_time: startTime,
          end_time: endTime,
          election_type: data.election_type,
          window_changed: windowChanged,
        },
        severity: event.status === 'draft' && !windowChanged ? 'info' : 'warning',
      }).catch(() => undefined);

      toast.success('Acara berhasil diperbarui!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast.error(error.message || 'Gagal memperbarui acara');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-175 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Acara Pemilihan</DialogTitle>
          <DialogDescription>
            Perbarui informasi acara pemilihan. Pastikan data yang diubah sudah benar.
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

          <EventDateTimeFields
            startDate={watch('start_date')}
            startTime={watch('start_time')}
            endDate={watch('end_date')}
            endTime={watch('end_time')}
            disabled={isSubmitting}
            onStartDateChange={(date) => setValue('start_date', date)}
            onStartTimeChange={(time) => setValue('start_time', time)}
            onEndDateChange={(date) => setValue('end_date', date)}
            onEndTimeChange={(time) => setValue('end_time', time)}
            startDateError={errors.start_date?.message}
            startTimeError={errors.start_time?.message}
            endDateError={errors.end_date?.message}
            endTimeError={errors.end_time?.message}
          />

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
              <div
                onClick={() => {
                  if (!isSubmitting) setValue('election_type', 'closed');
                }}
                className={cn(
                  'flex items-start space-x-3 space-y-0 rounded-md border p-4 transition-colors',
                  isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/50 hover:bg-muted/30',
                  electionTypeValue === 'closed' && 'border-primary bg-primary/5',
                )}
              >
                <RadioGroupItem value="closed" id="edit-closed" />
                <div className="space-y-1 leading-none">
                  <span className="font-medium text-sm">
                    Tertutup (Closed)
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Hasil hanya tampil setelah pemilihan ditutup. Lebih netral dan menghindari bandwagon effect.
                  </p>
                </div>
              </div>
              <div
                onClick={() => {
                  if (!isSubmitting) setValue('election_type', 'open');
                }}
                className={cn(
                  'flex items-start space-x-3 space-y-0 rounded-md border p-4 transition-colors',
                  isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/50 hover:bg-muted/30',
                  electionTypeValue === 'open' && 'border-primary bg-primary/5',
                )}
              >
                <RadioGroupItem value="open" id="edit-open" />
                <div className="space-y-1 leading-none">
                  <span className="font-medium text-sm">
                    Terbuka (Open)
                  </span>
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
                id="edit_show_results_after_voting"
                checked={showResultsAfterVoting}
                onCheckedChange={(checked) => setValue('show_results_after_voting', checked as boolean)}
                disabled={isSubmitting}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="edit_show_results_after_voting" className="cursor-pointer font-medium">
                  Tampilkan hasil setelah voter memilih
                </Label>
                <p className="text-sm text-muted-foreground">
                  Voter dapat melihat hasil sementara setelah mereka memberikan suara (hanya berlaku saat pemilihan masih aktif).
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="edit_public_results"
                checked={publicResults}
                onCheckedChange={(checked) => setValue('public_results', checked as boolean)}
                disabled={isSubmitting}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="edit_public_results" className="cursor-pointer font-medium">
                  Hasil publik (tanpa login)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Hasil pemilihan dapat dilihat oleh siapa saja di halaman depan tanpa perlu login.
                </p>
              </div>
            </div>
          </div>

          <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Status pemilihan dikelola terpisah melalui tombol <strong>Status</strong> agar selalu mengikuti state machine pemilihan.
          </p>

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
