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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

const candidateFormSchema = z.object({
  user_id: z.string().min(1, 'Kandidat harus dipilih'),
  vision: z.string().min(10, 'Visi minimal 10 karakter').max(500, 'Visi maksimal 500 karakter'),
  mission: z.string().min(10, 'Misi minimal 10 karakter').max(500, 'Misi maksimal 500 karakter'),
  photo_url: z.string().url('URL foto tidak valid').optional().or(z.literal('')),
});

type CandidateFormValues = z.infer<typeof candidateFormSchema>;

interface User {
  id: string;
  full_name: string;
  student_id: string;
  department: string | null;
}

interface AddCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess?: () => void;
}

export function AddCandidateDialog({
  open,
  onOpenChange,
  eventId,
  onSuccess,
}: AddCandidateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: {
      user_id: '',
      vision: '',
      mission: '',
      photo_url: '',
    },
  });

  const userIdValue = watch('user_id');

  // Fetch users with candidate role
  useEffect(() => {
    if (open) {
      fetchCandidateUsers();
    }
  }, [open]);

  const fetchCandidateUsers = async () => {
    setLoadingUsers(true);
    try {
      // Get users who have candidate role and are not already candidates in this event
      const { data: candidateRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'candidate');

      console.log('Candidate roles fetch:', { candidateRoles, rolesError });

      if (rolesError) {
        console.error('Error fetching candidate roles:', rolesError);
        throw rolesError;
      }

      // If no users with candidate role, show all users as fallback
      let candidateUserIds: string[] = [];

      if (!candidateRoles || candidateRoles.length === 0) {
        console.warn('No users with candidate role found. Showing all users.');
        // Fetch all users instead
        const { data: allProfiles, error: allError } = await supabase
          .from('profiles')
          .select('id')
          .order('full_name');

        if (allError) throw allError;
        candidateUserIds = allProfiles?.map((p) => p.id) || [];
      } else {
        candidateUserIds = candidateRoles.map((r) => r.user_id);
      }

      console.log('Candidate user IDs:', candidateUserIds);

      // Get existing candidates for this event
      const { data: existingCandidates, error: existingError } = await supabase
        .from('candidates')
        .select('user_id')
        .eq('event_id', eventId);

      console.log('Existing candidates:', { existingCandidates, existingError });

      if (existingError) {
        console.error('Error fetching existing candidates:', existingError);
      }

      const existingCandidateIds = existingCandidates?.map((c) => c.user_id) || [];

      // Filter out users who are already candidates
      const availableUserIds = candidateUserIds.filter(
        (id) => !existingCandidateIds.includes(id)
      );

      console.log('Available user IDs:', availableUserIds);

      if (availableUserIds.length === 0) {
        console.warn('No available users to add as candidates');
        setUsers([]);
        toast.info('Semua user dengan role kandidat sudah terdaftar di event ini');
        return;
      }

      // Fetch user profiles (only those with class_id assigned)
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, department, class_id, classes(name)')
        .in('id', availableUserIds)
        .not('class_id', 'is', null) // Only users with assigned class
        .order('full_name');

      console.log('Profiles fetch:', { profiles, error });

      if (error) throw error;

      setUsers(profiles || []);
      console.log('Final users list:', profiles);

      if (!profiles || profiles.length === 0) {
        toast.info('Tidak ada kandidat tersedia. Pastikan user sudah punya role "candidate" dan telah di-assign ke kelas');
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Gagal memuat daftar kandidat: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const onSubmit = async (data: CandidateFormValues) => {
    setIsSubmitting(true);
    try {
      console.log('Submitting candidate data:', {
        user_id: data.user_id,
        event_id: eventId,
        vision: data.vision,
        mission: data.mission,
        photo_url: data.photo_url || null,
        status: 'approved',
      });

      const { data: insertedData, error } = await supabase.from('candidates').insert({
        user_id: data.user_id,
        event_id: eventId,
        vision: data.vision,
        mission: data.mission,
        photo_url: data.photo_url || null,
        status: 'approved', // Admin adds candidates as approved by default
      }).select();

      console.log('Insert result:', { insertedData, error });

      if (error) {
        console.error('Insert error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        if (error.code === '23505') {
          throw new Error('Kandidat sudah terdaftar di acara ini');
        }
        throw error;
      }

      toast.success('Kandidat berhasil ditambahkan!');
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error adding candidate:', error);
      toast.error(error.message || 'Gagal menambahkan kandidat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tambah Kandidat</DialogTitle>
          <DialogDescription>
            Pilih kandidat dan isi visi serta misi untuk acara pemilihan ini.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user_id">
              Pilih Kandidat <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama atau NIM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  disabled={loadingUsers || isSubmitting}
                />
              </div>
              <Select
                value={userIdValue}
                onValueChange={(value) => setValue('user_id', value)}
                disabled={loadingUsers || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? 'Memuat...' : 'Pilih kandidat'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      {loadingUsers
                        ? 'Memuat...'
                        : searchQuery
                        ? 'Tidak ada kandidat yang cocok'
                        : 'Tidak ada kandidat tersedia'}
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} - {user.student_id}
                        {user.department && ` (${user.department})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {errors.user_id && (
              <p className="text-sm text-destructive">{errors.user_id.message}</p>
            )}
          </div>

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
            <Button type="submit" disabled={isSubmitting || loadingUsers}>
              {isSubmitting ? 'Menambahkan...' : 'Tambah Kandidat'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
