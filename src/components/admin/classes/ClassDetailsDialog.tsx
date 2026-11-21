import { useEffect, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Download,
  Users,
  FileText,
  UserPlus,
  UserMinus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { BulkUnassignUsersDialog } from '@/components/admin/classes/BulkUnassignUsersDialog';

const PAGE_SIZE = 20;

interface ClassDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string | null;
  onBulkAssign?: () => void;
  onSuccess?: () => void;
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
  onSuccess,
}: ClassDetailsDialogProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    votersCount: 0,
    candidatesCount: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  // Shift+klik: anchor index klik terakhir + status tombol Shift global.
  const lastClickedIndex = useRef<number | null>(null);
  const shiftHeld = useRef(false);

  useEffect(() => {
    if (open && classId) {
      setSearchQuery('');
      setPage(1);
      setSelectedIds(new Set());
      lastClickedIndex.current = null;
      fetchStudents();
    }
  }, [open, classId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeld.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeld.current = false;
    };
    const blur = () => {
      shiftHeld.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const fetchStudents = async () => {
    if (!classId) return;

    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, department')
        .eq('class_id', classId)
        .order('full_name');

      if (profilesError) throw profilesError;

      const studentIds = (profilesData || []).map((p) => p.id);
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', studentIds);

      if (rolesError) throw rolesError;

      const studentsWithRoles: Student[] = (profilesData || []).map((profile) => {
        const userRoles = (rolesData || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => ({ role: r.role }));

        return { ...profile, roles: userRoles };
      });

      setStudents(studentsWithRoles);
      // Seleksi yang sudah tidak ada di kelas dibuang.
      setSelectedIds((prev) => {
        const alive = new Set(studentsWithRoles.map((s) => s.id));
        return new Set([...prev].filter((id) => alive.has(id)));
      });

      setStats({
        totalStudents: studentsWithRoles.length,
        votersCount: studentsWithRoles.filter((s) => s.roles.some((r) => r.role === 'voter')).length,
        candidatesCount: studentsWithRoles.filter((s) => s.roles.some((r) => r.role === 'candidate')).length,
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Gagal memuat data mahasiswa');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = searchQuery.trim() === ''
    ? students
    : students.filter((student) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          student.full_name.toLowerCase().includes(q) ||
          student.student_id.toLowerCase().includes(q) ||
          (student.department || '').toLowerCase().includes(q)
        );
      });
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageStudents = filteredStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageOffset = (safePage - 1) * PAGE_SIZE;

  const goPage = (p: number) => {
    lastClickedIndex.current = null;
    setPage(Math.min(Math.max(p, 1), totalPages));
  };

  const toggleSelect = (id: string, index?: number) => {
    const anchor = lastClickedIndex.current;
    if (shiftHeld.current && anchor !== null && index !== undefined) {
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor];
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredStudents.slice(a, b + 1).forEach((s) => next.add(s.id));
        return next;
      });
      return;
    }
    if (index !== undefined) lastClickedIndex.current = index;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Header checkbox = seleksi pada halaman tampil; seleksi global tetap dipertahankan.
  const allVisibleSelected =
    pageStudents.length > 0 && pageStudents.every((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    lastClickedIndex.current = null;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageStudents.forEach((s) => {
        if (allVisibleSelected) next.delete(s.id);
        else next.add(s.id);
      });
      return next;
    });
  };

  const handleUnassignSuccess = () => {
    setSelectedIds(new Set());
    lastClickedIndex.current = null;
    fetchStudents();
    onSuccess?.();
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
      <DialogContent className="sm:max-w-175">
        <DialogHeader>
          <DialogTitle>Detail Kelas: {className}</DialogTitle>
          <DialogDescription>Daftar mahasiswa yang terdaftar di kelas ini.</DialogDescription>
        </DialogHeader>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Total Mahasiswa
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.totalStudents}</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground mb-1">Pemilih</div>
            <div className="text-2xl font-bold text-foreground">{stats.votersCount}</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground mb-1">Kandidat</div>
            <div className="text-2xl font-bold text-foreground">{stats.candidatesCount}</div>
          </div>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="class-search">Cari Mahasiswa</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="class-search"
              placeholder="Cari nama, NIM, atau jurusan..."
              aria-label="Cari mahasiswa"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
                lastClickedIndex.current = null;
              }}
              className="pl-10"
            />
          </div>
        </div>

        {/* Bulk selection bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} mahasiswa dipilih
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds(new Set());
                  lastClickedIndex.current = null;
                }}
              >
                Batalkan
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setUnassignDialogOpen(true)}
              >
                <UserMinus className="h-4 w-4" />
                Unassign Massal
              </Button>
            </div>
          </div>
        )}

        {/* Students list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Memuat data mahasiswa...</p>
          </div>
        ) : students.length === 0 ? (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Belum Ada Mahasiswa</AlertTitle>
            <AlertDescription>Belum ada mahasiswa yang terdaftar di kelas ini.</AlertDescription>
          </Alert>
        ) : (
          <>
            <ScrollArea className="h-100 rounded-lg border">
              <table className="w-full">
                {/* Header solid + z-index: baris tidak boleh tembus saat scroll. */}
                <thead className="sticky top-0 z-10 border-b border-border bg-background">
                  <tr>
                    <th className="px-4 py-3">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Pilih semua mahasiswa di halaman ini"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">No</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Nama</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">NIM</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Jurusan</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {pageStudents.map((student, i) => {
                    const idx = pageOffset + i;
                    return (
                      <tr key={student.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(student.id)}
                            onCheckedChange={() => toggleSelect(student.id, idx)}
                            aria-label={`Pilih ${student.full_name}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {student.full_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{student.student_id}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {student.department || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {student.roles.length > 0 ? (
                              student.roles.map((roleObj, ridx) => (
                                <span key={ridx}>{getRoleBadge(roleObj.role)}</span>
                              ))
                            ) : (
                              <Badge variant="secondary">Pemilih</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                        Tidak ada mahasiswa yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
            {totalPages > 1 && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-xs text-muted-foreground">
                  Halaman {safePage} dari {totalPages} ({filteredStudents.length} mahasiswa)
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => goPage(1)} disabled={safePage <= 1} aria-label="Halaman pertama">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => goPage(safePage - 1)} disabled={safePage <= 1} aria-label="Halaman sebelumnya">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => goPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Halaman berikutnya">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => goPage(totalPages)} disabled={safePage >= totalPages} aria-label="Halaman terakhir">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
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
            <Button variant="outline" className="gap-2" onClick={exportToCSV} disabled={students.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>

      <BulkUnassignUsersDialog
        open={unassignDialogOpen}
        onOpenChange={setUnassignDialogOpen}
        classId={classId}
        className={className}
        userIds={Array.from(selectedIds)}
        onSuccess={handleUnassignSuccess}
      />
    </Dialog>
  );
}
