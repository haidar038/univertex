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
import { logAudit } from '@/lib/audit';
import { cn } from '@/lib/utils';
import { localDateTimeToUTCISO } from '@/lib/datetime';
import { EventDateTimeFields } from '@/components/admin/events/EventDateTimeFields';

const eventFormSchema = z.object({
  title: z.string().min(3, 'Judul minimal 3 karakter').max(100, 'Judul maksimal 100 karakter'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Tanggal mulai harus diisi'),
  start_time: z.string().min(1, 'Waktu mulai harus diisi'),
  end_date: z.string().min(1, 'Tanggal selesai harus diisi'),
  end_time: z.string().min(1, 'Waktu selesai harus diisi'),
  status: z.enum(['draft', 'registration', 'voting', 'counting', 'published', 'archived']),
  election_type: z.enum(['open', 'closed']),
  show_results_after_voting: z.boolean(),
  public_results: z.boolean(),
  scope_type: z.enum(['', 'university', 'faculty', 'department', 'program', 'cohort', 'class', 'organization']),
  scope_id: z.string().optional(),
}).refine((data) => {
  const startTime = new Date(`${data.start_date}T${data.start_time}`);
  const endTime = new Date(`${data.end_date}T${data.end_time}`);
  return endTime > startTime;
}, {
  message: 'Waktu selesai harus setelah waktu mulai',
  path: ['end_time'],
}).refine((data) => {
  if (data.scope_type && !data.scope_id) return false;
  if (!data.scope_type && data.scope_id) return false;
  return true;
}, {
  message: 'scope_type dan scope_id harus diisi bersamaan',
  path: ['scope_id'],
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
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      status: 'draft',
      election_type: 'closed',
      show_results_after_voting: false,
      public_results: false,
      scope_type: '',
      scope_id: '',
    },
  });

  const statusValue = watch('status');
  const electionTypeValue = watch('election_type');
  const showResultsAfterVoting = watch('show_results_after_voting');
  const publicResults = watch('public_results');
  const scopeTypeValue = watch('scope_type');

  // Simpan sebagai UTC; input form selalu waktu lokal (anti-geser zona waktu).
  const normalizeDateTime = (date: string, time: string) => localDateTimeToUTCISO(date, time);

  const onSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    try {
      const startTime = normalizeDateTime(data.start_date, data.start_time);
      const endTime = normalizeDateTime(data.end_date, data.end_time);

      const { data: inserted, error } = await supabase.from('election_events').insert({
        title: data.title,
        description: data.description || null,
        start_time: startTime,
        end_time: endTime,
        status: data.status,
        election_type: data.election_type,
        show_results_after_voting: data.show_results_after_voting,
        public_results: data.public_results,
        scope_type: data.scope_type || null,
        scope_id: data.scope_id || null,
      }).select('id').single();

      if (error) throw error;

      await logAudit({
        action: 'event.create',
        description: `Created election event "${data.title}"`,
        category: 'election',
        targetType: 'election_events',
        targetId: inserted?.id,
        metadata: {
          election_type: data.election_type,
          status: data.status,
          public_results: data.public_results,
        },
      });

      toast.success('Acara berhasil dibuat!');
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error('Error creating event:', error);
      const msg = error instanceof Error ? error : null;
      toast.error(msg?.message || 'Gagal membuat acara');
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
      <DialogContent className="sm:max-w-175 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Acara Pemilihan Baru</DialogTitle>
          <DialogDescription>
            Isi informasi acara pemilihan. Anda dapat menyimpan sebagai draft atau langsung mengaktifkan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul Acara <span className="text-destructive">*</span></Label>
            <Input id="title" placeholder="Contoh: Pemilihan Ketua BEM 2025" {...register('title')} disabled={isSubmitting} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" placeholder="Deskripsi singkat tentang acara pemilihan..." rows={3} {...register('description')} disabled={isSubmitting} />
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

          <div className="space-y-3">
            <Label>Jenis Pemilihan <span className="text-destructive">*</span></Label>
            <RadioGroup value={electionTypeValue} onValueChange={(value) => setValue('election_type', value as 'open' | 'closed')} disabled={isSubmitting}>
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
                <RadioGroupItem value="closed" id="closed" />
                <div className="space-y-1 leading-none">
                  <span className="font-medium text-sm">Tertutup (Closed)</span>
                  <p className="text-sm text-muted-foreground">Hasil hanya tampil setelah pemilihan ditutup.</p>
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
                <RadioGroupItem value="open" id="open" />
                <div className="space-y-1 leading-none">
                  <span className="font-medium text-sm">Terbuka (Open)</span>
                  <p className="text-sm text-muted-foreground">Progress dan hasil visible real-time.</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <div>
              <Label className="text-base">Pengaturan Visibilitas Hasil</Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox id="show_results_after_voting" checked={showResultsAfterVoting} onCheckedChange={(checked) => setValue('show_results_after_voting', checked as boolean)} disabled={isSubmitting} />
              <div className="space-y-1 leading-none">
                <Label htmlFor="show_results_after_voting" className="cursor-pointer font-medium">Tampilkan hasil setelah voter memilih</Label>
                <p className="text-sm text-muted-foreground">Voter dapat melihat hasil sementara setelah vote.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="public_results" checked={publicResults} onCheckedChange={(checked) => setValue('public_results', checked as boolean)} disabled={isSubmitting} />
              <div className="space-y-1 leading-none">
                <Label htmlFor="public_results" className="cursor-pointer font-medium">Hasil publik (tanpa login)</Label>
                <p className="text-sm text-muted-foreground">Hasil dapat dilihat siapa saja tanpa login.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
            <Select value={statusValue} onValueChange={(value) => setValue('status', value as any)} disabled={isSubmitting}>
              <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="registration">Pendaftaran</SelectItem>
                <SelectItem value="voting">Voting</SelectItem>
                <SelectItem value="counting">Penghitungan</SelectItem>
                <SelectItem value="published">Dipublikasikan</SelectItem>
                <SelectItem value="archived">Diarsipkan</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <Label className="text-base">Cakupan (Scope)</Label>
            <p className="text-xs text-muted-foreground">
              Opsional. Tentukan lingkup pemilihan (mis. kelas, fakultas). Kosongkan untuk pemilihan tingkat universitas.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scope_type">Tipe Scope</Label>
                <Select
                  value={scopeTypeValue || 'none'}
                  onValueChange={(value) => {
                    const nextScopeType = value === 'none' ? '' : value;
                    setValue('scope_type', nextScopeType as EventFormValues['scope_type']);
                    if (nextScopeType === '') setValue('scope_id', '');
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger><SelectValue placeholder="(tidak ada)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">(tidak ada)</SelectItem>
                    <SelectItem value="class">Kelas</SelectItem>
                    <SelectItem value="organization">Organisasi</SelectItem>
                    <SelectItem value="cohort">Angkatan</SelectItem>
                    <SelectItem value="program">Program Studi</SelectItem>
                    <SelectItem value="department">Departemen</SelectItem>
                    <SelectItem value="faculty">Fakultas</SelectItem>
                    <SelectItem value="university">Universitas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope_id">Scope ID</Label>
                <Input
                  id="scope_id"
                  placeholder="UUID atau kunci"
                  {...register('scope_id')}
                  disabled={isSubmitting || !scopeTypeValue}
                />
                {errors.scope_id && <p className="text-sm text-destructive">{errors.scope_id.message}</p>}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Buat Acara'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

