import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users as UsersIcon, Edit, Trash2, Upload, KeyRound, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { RequirePermission } from '@/components/RequirePermission';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { EditUserDialog } from '@/components/admin/users/EditUserDialog';
import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';
import { BulkDeleteUsersDialog } from '@/components/admin/users/BulkDeleteUsersDialog';
import { BulkImportUsersDialog } from '@/components/admin/users/BulkImportUsersDialog';
import { ResetPasswordDialog } from '@/components/admin/users/ResetPasswordDialog';

interface UserWithRoles {
  id: string;
  full_name: string;
  student_id: string;
  email?: string;
  department: string | null;
  class_id: string | null;
  classes: { name: string } | null;
  roles: Array<{ role: string }>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const requestSeq = useRef(0);
  const firstSearchRun = useRef(true);
  // P-C shift+klik: anchor index klik terakhir + status tombol Shift global
  // (Radix onCheckedChange tidak membawa MouseEvent, jadi dibaca dari window).
  const lastClickedIndex = useRef<number | null>(null);
  const shiftHeld = useRef(false);

  // Data diambil per halaman dari RPC; debounce agar tidak query tiap ketikan.
  useEffect(() => {
    // Mount = sudah ada fetch dari effect halaman; jangan jadwalkan reset.
    if (firstSearchRun.current) {
      firstSearchRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
      lastClickedIndex.current = null;
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchUsers(page, searchQuery);
  }, [page, searchQuery]);

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

  const handleEdit = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: UserWithRoles) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleResetPassword = (user: UserWithRoles) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
  };

  // Server yang memotong halaman + menghitung total; UI hanya merender.
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageUsers = users;
  const pageOffset = (safePage - 1) * PAGE_SIZE;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goPage = (p: number) => {
    lastClickedIndex.current = null;
    setPage(Math.min(Math.max(p, 1), totalPages));
  };

  const toggleSelect = (id: string, index?: number) => {
    const anchor = lastClickedIndex.current;
    // Shift+klik: pilih semua dari klik terakhir (anchor) sampai baris ini.
    // Index = posisi di urutan tampil (halaman), diteruskan dari map.
    if (shiftHeld.current && anchor !== null && index !== undefined) {
      const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
      // Anchor/index adalah posisi global; data yang ada hanya halaman aktif.
      const a = Math.max(0, Math.min(from, to) - pageOffset);
      const b = Math.min(users.length - 1, Math.max(from, to) - pageOffset);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (a <= b) users.slice(a, b + 1).forEach((u) => next.add(u.id));
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

  // Header checkbox = yang tampil di halaman ini (seleksi global tetap).
  const allVisibleSelected =
    pageUsers.length > 0 && pageUsers.every((u) => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    lastClickedIndex.current = null;
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageUsers.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageUsers.forEach((u) => next.add(u.id));
        return next;
      });
    }
  };

  const reload = () => fetchUsers(page, searchQuery);

  const handleBulkDeleteSuccess = () => {
    setSelectedIds(new Set());
    reload();
  };

  const fetchUsers = async (nextPage: number, nextSearch: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      // RPC melakukan filter admin, pencarian, count, dan LIMIT/OFFSET di DB.
      // Tanpa ini PostgREST memotong ±1000 baris sebelum UI sempat pagination.
      const { data, error } = await supabase.rpc('admin_list_users_paged', {
        p_limit: PAGE_SIZE,
        p_offset: (nextPage - 1) * PAGE_SIZE,
        p_search: nextSearch || null,
      });
      if (error) throw error;
      if (seq !== requestSeq.current) return;

      const rows = (data || []) as Array<{
        id: string;
        full_name: string;
        student_id: string;
        email: string;
        department: string | null;
        class_id: string | null;
        class_name: string | null;
        roles: string[];
        total_count: number;
      }>;

      const usersWithRoles = rows.map((user) => ({
        id: user.id,
        full_name: user.full_name,
        student_id: user.student_id,
        email: user.email,
        department: user.department,
        class_id: user.class_id,
        classes: user.class_name ? { name: user.class_name } : null,
        roles: (user.roles || []).map((role) => ({ role })),
      }));

      setUsers(usersWithRoles);
      setTotalCount(Number(rows[0]?.total_count ?? 0));
      lastClickedIndex.current = null;
      // Seleksi sengaja dipertahankan lintas halaman — jangan dipangkas
      // terhadap id di halaman aktif saja.
    } catch (error) {
      if (seq === requestSeq.current) console.error('Error fetching users:', error);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary">Admin</Badge>;
      case 'candidate':
        return <Badge className="bg-accent">Kandidat</Badge>;
      case 'committee':
        return <Badge className="bg-info">Panitia</Badge>;
      case 'observer':
        return <Badge variant="outline">Observer</Badge>;
      default:
        return <Badge variant="secondary">Pemilih</Badge>;
    }
  };

  return (
    <RequirePermission permission="user.edit">
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">Manajemen Pengguna</h1>
            <p className="text-muted-foreground">Kelola pengguna dan peran mereka</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setBulkImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Tambah Pengguna
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Memuat...</div>
        ) : users.length === 0 && !searchQuery ? (
          <Card>
            <CardContent className="flex min-h-[300px] flex-col items-center justify-center py-12">
              <UsersIcon className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">Belum ada pengguna</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Mulai dengan menambahkan pengguna pertama
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Cari nama, NIM, atau email..."
                    aria-label="Cari pengguna"
                    className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {searchQuery.trim() !== '' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {totalCount} pengguna cocok
                  </p>
                )}
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between border-b border-border bg-muted/50 p-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} pengguna dipilih
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                      Batalkan
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus Massal
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="p-4">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Pilih semua"
                        />
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-foreground">Nama</th>
                      <th className="p-4 text-left text-sm font-medium text-foreground">Email</th>
                      <th className="p-4 text-left text-sm font-medium text-foreground">NIM</th>
                      <th className="p-4 text-left text-sm font-medium text-foreground">Kelas</th>
                      <th className="p-4 text-left text-sm font-medium text-foreground">Role</th>
                      <th className="p-4 text-left text-sm font-medium text-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageUsers.map((user, i) => {
                      const idx = pageOffset + i;
                      return (
                      <tr key={user.id} className="hover:bg-muted/30">
                        <td className="p-4">
                          <Checkbox
                            checked={selectedIds.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id, idx)}
                            aria-label={`Pilih ${user.full_name}`}
                          />
                        </td>
                        <td className="p-4 text-sm text-foreground">{user.full_name}</td>
                        <td className="p-4 text-sm text-muted-foreground">{user.email || '-'}</td>
                        <td className="p-4 text-sm text-muted-foreground">{user.student_id}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {user.classes?.name || '-'}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            {user.roles.length > 0 ? (
                              user.roles.map((roleObj, idx) => (
                                <span key={idx}>{getRoleBadge(roleObj.role)}</span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleResetPassword(user)}
                              title="Reset Password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(user)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {pageUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                          Tidak ada pengguna yang cocok dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border p-3">
                  <span className="text-xs text-muted-foreground">
                    Halaman {safePage} dari {totalPages} ({totalCount} pengguna)
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
            </CardContent>
          </Card>
        )}

        {/* Dialogs */}
        <CreateUserDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={reload}
        />
        <BulkImportUsersDialog
          open={bulkImportDialogOpen}
          onOpenChange={setBulkImportDialogOpen}
          onSuccess={reload}
        />
        <EditUserDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSuccess={reload}
        />
        <ResetPasswordDialog
          open={resetPasswordDialogOpen}
          onOpenChange={setResetPasswordDialogOpen}
          userId={selectedUser?.id || null}
          userEmail={selectedUser?.email || null}
          userName={selectedUser?.full_name || null}
          onSuccess={reload}
        />
        <DeleteUserDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          userId={selectedUser?.id || null}
          userName={selectedUser?.full_name || null}
          onSuccess={reload}
        />
        <BulkDeleteUsersDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          userIds={Array.from(selectedIds)}
          onSuccess={handleBulkDeleteSuccess}
        />
      </div>
    </RequirePermission>
  );
}
