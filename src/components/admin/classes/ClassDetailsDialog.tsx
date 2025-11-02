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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, Users, FileText, UserPlus } from 'lucide-react';

interface ClassDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string | null;
  onBulkAssign?: () => void;
}

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  department: string | null;
  email?: string;
  roles: Array<{ role: string }>;
}

export function ClassDetailsDialog({
  open,
  onOpenChange,
  classId,
  className,
  onBulkAssign,
}: ClassDetailsDialogProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    votersCount: 0,
    candidatesCount: 0,
  });

  useEffect(() => {
    if (open && classId) {
      fetchStudents();
    }
  }, [open, classId]);

  const fetchStudents = async () => {
    if (!classId) return;

    setLoading(true);
    try {
      // Fetch students in this class
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, department')
        .eq('class_id', classId)
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles for these students
      const studentIds = (profilesData || []).map((p) => p.id);
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', studentIds);

      if (rolesError) throw rolesError;

      // Fetch auth users for emails
      const studentsWithRoles: Student[] = (profilesData || []).map((profile) => {
        const userRoles = (rolesData || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => ({ role: r.role }));

        return {
          ...profile,
          roles: userRoles,
        };
      });

      setStudents(studentsWithRoles);

      // Calculate stats
      const totalStudents = studentsWithRoles.length;
      const votersCount = studentsWithRoles.filter((s) =>
        s.roles.some((r) => r.role === 'voter')
      ).length;
      const candidatesCount = studentsWithRoles.filter((s) =>
        s.roles.some((r) => r.role === 'candidate')
      ).length;

      setStats({ totalStudents, votersCount, candidatesCount });
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Gagal memuat data mahasiswa');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (students.length === 0) {
      toast.error('Tidak ada data untuk diexport');
      return;
    }

    const csvHeader = 'No,Nama Lengkap,NIM,Jurusan,Roles\n';
    const csvRows = students
      .map((student, index) => {
        const roles = student.roles.map((r) => r.role).join('|');
        return `${index + 1},"${student.full_name}",${student.student_id},"${student.department || '-'}","${roles || 'voter'}"`;
      })
      .join('\n');

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daftar_mahasiswa_${className?.replace(/\s+/g, '_')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('File CSV berhasil diunduh');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary">Admin</Badge>;
      case 'candidate':
        return <Badge className="bg-accent">Kandidat</Badge>;
      default:
        return <Badge variant="secondary">Pemilih</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Detail Kelas: {className}</DialogTitle>
          <DialogDescription>
            Daftar mahasiswa yang terdaftar di kelas ini.
          </DialogDescription>
        </DialogHeader>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Total Mahasiswa
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalStudents}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground mb-1">Pemilih</div>
            <div className="text-2xl font-bold text-foreground">
              {stats.votersCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground mb-1">Kandidat</div>
            <div className="text-2xl font-bold text-foreground">
              {stats.candidatesCount}
            </div>
          </div>
        </div>

        {/* Students List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Memuat data mahasiswa...</p>
          </div>
        ) : students.length === 0 ? (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Belum Ada Mahasiswa</AlertTitle>
            <AlertDescription>
              Belum ada mahasiswa yang terdaftar di kelas ini.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-4">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium text-foreground">
                      No
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-foreground">
                      Nama
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-foreground">
                      NIM
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-foreground">
                      Jurusan
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-foreground">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((student, index) => (
                    <tr key={student.id} className="hover:bg-muted/30">
                      <td className="p-3 text-sm text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="p-3 text-sm font-medium text-foreground">
                        {student.full_name}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {student.student_id}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {student.department || '-'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {student.roles.length > 0 ? (
                            student.roles.map((roleObj, idx) => (
                              <span key={idx}>{getRoleBadge(roleObj.role)}</span>
                            ))
                          ) : (
                            <Badge variant="secondary">Pemilih</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {onBulkAssign && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  onBulkAssign();
                  onOpenChange(false);
                }}
              >
                <UserPlus className="h-4 w-4" />
                Assign Users
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              onClick={exportToCSV}
              disabled={students.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
