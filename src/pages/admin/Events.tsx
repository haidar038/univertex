import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock, Eye, Edit, Trash2, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { CreateEventDialog } from '@/components/admin/events/CreateEventDialog';
import { EditEventDialog } from '@/components/admin/events/EditEventDialog';
import { DeleteEventDialog } from '@/components/admin/events/DeleteEventDialog';
import { EventStatusDialog } from '@/components/admin/events/EventStatusDialog';

export default function AdminEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('election_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event: any) => {
    setSelectedEvent(event);
    setEditDialogOpen(true);
  };

  const handleDelete = (event: any) => {
    setSelectedEvent(event);
    setDeleteDialogOpen(true);
  };

  const handleStatusChange = (event: any) => {
    setSelectedEvent(event);
    setStatusDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success">Aktif</Badge>;
      case 'closed':
        return <Badge variant="secondary">Selesai</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Acara Pemilihan</h1>
          <p className="text-muted-foreground">Kelola semua acara pemilihan</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Buat Acara Baru
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Memuat...</div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center py-12">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Belum ada acara</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Mulai dengan membuat acara pemilihan pertama Anda
            </p>
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Buat Acara
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-lg font-bold text-foreground">{event.title}</h3>
                  {getStatusBadge(event.status)}
                </div>

                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                  {event.description || 'Tidak ada deskripsi'}
                </p>

                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(event.start_time), 'dd MMM yyyy', { locale: id })}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {format(new Date(event.start_time), 'HH:mm')} - {format(new Date(event.end_time), 'HH:mm')}
                  </div>
                </div>

                <div className="space-y-2">
                  <Link to={`/admin/events/${event.id}`} className="block">
                    <Button variant="outline" className="w-full gap-2">
                      <Eye className="h-4 w-4" />
                      Lihat Detail
                    </Button>
                  </Link>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={(e) => {
                        e.preventDefault();
                        handleStatusChange(event);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        handleEdit(event);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(event);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchEvents}
      />
      <EditEventDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        event={selectedEvent}
        onSuccess={fetchEvents}
      />
      <DeleteEventDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        eventId={selectedEvent?.id}
        eventTitle={selectedEvent?.title}
        onSuccess={fetchEvents}
      />
      <EventStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        eventId={selectedEvent?.id}
        currentStatus={selectedEvent?.status}
        onSuccess={fetchEvents}
      />
    </div>
  );
}
