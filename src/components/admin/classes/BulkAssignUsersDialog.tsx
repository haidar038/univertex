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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, Users, CheckCircle2 } from 'lucide-react';

interface BulkAssignUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string | null;
  onSuccess?: () => void;
}

interface User {
  id: string;
  full_name: string;
  student_id: string;
  department: string | null;
  current_class: string | null;
}

export function BulkAssignUsersDialog({
  open,
  onOpenChange,
  classId,
  className,
  onSuccess,
}: BulkAssignUsersDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setSelectedUserIds(new Set());
      setSearchQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.full_name.toLowerCase().includes(query) ||
          user.student_id.toLowerCase().includes(query) ||
          user.department?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users that are not in the current class or have no class
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, department, class_id, classes(name)')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Filter users: exclude those already in this class
      const availableUsers = (profilesData || [])
        .filter((profile) => profile.class_id !== classId)
        .map((profile) => ({
          id: profile.id,
          full_name: profile.full_name,
          student_id: profile.student_id,
          department: profile.department,
          current_class: (profile.classes as any)?.name || null,
        }));

      setUsers(availableUsers);
      setFilteredUsers(availableUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Gagal memuat daftar pengguna');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const handleAssign = async () => {
    if (!classId || selectedUserIds.size === 0) {
      toast.error('Pilih minimal satu user');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update class_id for selected users
      const updates = Array.from(selectedUserIds).map((userId) =>
        supabase
          .from('profiles')
          .update({ class_id: classId })
          .eq('id', userId)
      );

      const results = await Promise.all(updates);

      // Check for errors
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error('Beberapa user gagal di-assign');
      }

      toast.success(`${selectedUserIds.size} user berhasil di-assign ke kelas`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error assigning users:', error);
      toast.error(error.message || 'Gagal assign users ke kelas');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedUserIds(new Set());
    setSearchQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Assign Users ke Kelas: {className}</DialogTitle>
          <DialogDescription>
            Pilih user yang ingin di-assign ke kelas ini.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Cari User</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Cari nama, NIM, atau jurusan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
          <span className="text-sm text-muted-foreground">
            {selectedUserIds.size} dari {filteredUsers.length} user dipilih
          </span>
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0
              ? 'Batalkan Semua'
              : 'Pilih Semua'}
          </Button>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Memuat data user...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Tidak Ada User</AlertTitle>
            <AlertDescription>
              {searchQuery
                ? 'Tidak ada user yang cocok dengan pencarian.'
                : 'Semua user sudah di-assign ke kelas ini atau kelas lain.'}
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-4 space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selectedUserIds.has(user.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedUserIds.has(user.id)}
                    onCheckedChange={() => handleToggleUser(user.id)}
                  />
                  <label
                    htmlFor={`user-${user.id}`}
                    className="flex-1 cursor-pointer space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {user.full_name}
                      </span>
                      {selectedUserIds.has(user.id) && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>NIM: {user.student_id}</span>
                      {user.department && <span>• {user.department}</span>}
                    </div>
                    {user.current_class && (
                      <div className="text-xs text-muted-foreground">
                        Kelas saat ini: {user.current_class}
                      </div>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedUserIds.size === 0 || isSubmitting}
          >
            {isSubmitting
              ? 'Mengassign...'
              : `Assign ${selectedUserIds.size} User`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
