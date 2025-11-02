import { useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, GraduationCap, Users } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  faculty: string | null;
  student_count?: number;
}

interface AssignVoterGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess?: () => void;
}

export function AssignVoterGroupsDialog({
  open,
  onOpenChange,
  eventId,
  onSuccess,
}: AssignVoterGroupsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Fetch classes and existing assignments
  useEffect(() => {
    if (open) {
      fetchClassesAndAssignments();
    }
  }, [open, eventId]);

  const fetchClassesAndAssignments = async () => {
    setLoadingClasses(true);
    try {
      // Fetch all classes with student count
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, faculty')
        .order('faculty')
        .order('name');

      if (classesError) throw classesError;

      // Get student count for each class
      const classesWithCount = await Promise.all(
        (classesData || []).map(async (cls) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);

          return {
            ...cls,
            student_count: count || 0,
          };
        })
      );

      setClasses(classesWithCount);

      // Fetch existing assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('event_voter_groups')
        .select('class_id')
        .eq('event_id', eventId);

      if (assignmentsError) throw assignmentsError;

      const assignedIds = assignments?.map((a) => a.class_id) || [];
      setSelectedClassIds(assignedIds);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      toast.error('Gagal memuat data kelas');
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleSelectAll = () => {
    const filteredIds = filteredClasses.map((cls) => cls.id);
    setSelectedClassIds(filteredIds);
  };

  const handleDeselectAll = () => {
    setSelectedClassIds([]);
  };

  const onSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('event_voter_groups')
        .delete()
        .eq('event_id', eventId);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (selectedClassIds.length > 0) {
        const assignments = selectedClassIds.map((classId) => ({
          event_id: eventId,
          class_id: classId,
        }));

        const { error: insertError } = await supabase
          .from('event_voter_groups')
          .insert(assignments);

        if (insertError) throw insertError;
      }

      toast.success('Grup pemilih berhasil diperbarui!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error assigning voter groups:', error);
      toast.error(error.message || 'Gagal memperbarui grup pemilih');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const filteredClasses = classes.filter(
    (cls) =>
      cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cls.faculty && cls.faculty.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalVoters = selectedClassIds.reduce((total, classId) => {
    const cls = classes.find((c) => c.id === classId);
    return total + (cls?.student_count || 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Kelola Grup Pemilih (DPT)</DialogTitle>
          <DialogDescription>
            Pilih kelas yang dapat mengikuti pemilihan ini. Siswa dari kelas yang dipilih akan
            menjadi Daftar Pemilih Tetap (DPT).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kelas atau fakultas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              disabled={loadingClasses || isSubmitting}
            />
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {selectedClassIds.length} Kelas Dipilih
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium">{totalVoters} Pemilih</span>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={loadingClasses || isSubmitting}
            >
              Pilih Semua
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              disabled={loadingClasses || isSubmitting}
            >
              Hapus Semua
            </Button>
          </div>

          {/* Classes List */}
          <ScrollArea className="h-[300px] rounded-md border border-border">
            <div className="space-y-1 p-4">
              {loadingClasses ? (
                <div className="text-center text-sm text-muted-foreground">Memuat...</div>
              ) : filteredClasses.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground">
                  {searchQuery ? 'Tidak ada kelas yang cocok' : 'Tidak ada kelas tersedia'}
                </div>
              ) : (
                filteredClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-start space-x-3 rounded-lg border border-transparent p-3 hover:border-border hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`class-${cls.id}`}
                      checked={selectedClassIds.includes(cls.id)}
                      onCheckedChange={() => handleToggleClass(cls.id)}
                      disabled={isSubmitting}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`class-${cls.id}`}
                        className="cursor-pointer font-medium text-foreground"
                      >
                        {cls.name}
                      </Label>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {cls.faculty && <span>{cls.faculty}</span>}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {cls.student_count} siswa
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
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
          <Button onClick={onSubmit} disabled={isSubmitting || loadingClasses}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
