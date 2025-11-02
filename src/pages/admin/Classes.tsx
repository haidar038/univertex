import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, GraduationCap, Edit, Trash2, Eye, UserPlus } from 'lucide-react';
import { CreateClassDialog } from '@/components/admin/classes/CreateClassDialog';
import { EditClassDialog } from '@/components/admin/classes/EditClassDialog';
import { DeleteClassDialog } from '@/components/admin/classes/DeleteClassDialog';
import { ClassDetailsDialog } from '@/components/admin/classes/ClassDetailsDialog';
import { BulkAssignUsersDialog } from '@/components/admin/classes/BulkAssignUsersDialog';

export default function AdminClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleEdit = (classData: any) => {
    setSelectedClass(classData);
    setEditDialogOpen(true);
  };

  const handleDelete = (classData: any) => {
    setSelectedClass(classData);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = (classData: any) => {
    setSelectedClass(classData);
    setDetailsDialogOpen(true);
  };

  const handleBulkAssign = (classData: any) => {
    setSelectedClass(classData);
    setBulkAssignDialogOpen(true);
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Manajemen Kelas</h1>
          <p className="text-muted-foreground">Kelola kelas untuk DPT</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Tambah Kelas
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Memuat...</div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center py-12">
            <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Belum ada kelas</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Mulai dengan menambahkan kelas pertama
            </p>
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Tambah Kelas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((classItem) => (
            <Card key={classItem.id}>
              <CardContent className="p-6">
                <div className="mb-2 flex items-start justify-between">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(classItem)}
                      title="Edit Kelas"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(classItem)}
                      className="text-destructive hover:text-destructive"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="mb-1 text-lg font-bold text-foreground">{classItem.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{classItem.faculty}</p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleViewDetails(classItem)}
                  >
                    <Eye className="h-4 w-4" />
                    Lihat Detail
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleBulkAssign(classItem)}
                    title="Assign Users"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateClassDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchClasses}
      />
      <EditClassDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        classData={selectedClass}
        onSuccess={fetchClasses}
      />
      <DeleteClassDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        classId={selectedClass?.id || null}
        className={selectedClass?.name || null}
        onSuccess={fetchClasses}
      />
      <ClassDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        classId={selectedClass?.id || null}
        className={selectedClass?.name || null}
        onBulkAssign={() => {
          setDetailsDialogOpen(false);
          handleBulkAssign(selectedClass);
        }}
      />
      <BulkAssignUsersDialog
        open={bulkAssignDialogOpen}
        onOpenChange={setBulkAssignDialogOpen}
        classId={selectedClass?.id || null}
        className={selectedClass?.name || null}
        onSuccess={fetchClasses}
      />
    </div>
  );
}
