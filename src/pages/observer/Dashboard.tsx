import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, Inbox } from "lucide-react";
import { logger } from "@/lib/logger";

interface ObserverAssignment {
    observer_id: string;
    election_id: string;
    election_title: string;
    appointed_at: string;
}

export default function ObserverDashboard() {
    const [assignments, setAssignments] = useState<ObserverAssignment[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data, error } = await supabase.rpc('list_my_observer_assignments');
            if (error) {
                logger.error('Failed to load observer assignments', error, { action: 'observer.dashboard.load' });
                setError(error.message);
                return;
            }
            setAssignments((data ?? []) as ObserverAssignment[]);
        };
        load();
    }, []);

    if (error) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <Alert variant="destructive">
                    <AlertTitle>Gagal memuat data observer</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <header className="flex items-start gap-3">
                <Eye className="h-8 w-8 text-primary mt-1" />
                <div>
                    <h1 className="text-3xl font-bold">Observer Pemilihan</h1>
                    <p className="text-muted-foreground">
                        Anda terdaftar sebagai observer untuk pemilihan di bawah ini. Anda hanya
                        dapat <strong>membaca data pemilihan</strong> — tidak dapat mengubah apapun.
                        Cocok untuk BPM, saksi, atau auditor eksternal.
                    </p>
                </div>
            </header>

            {assignments === null ? (
                <div className="space-y-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : assignments.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Inbox className="h-10 w-10 mb-3" />
                        <p>Anda belum ditugaskan sebagai observer pada pemilihan manapun.</p>
                        <p className="text-sm">Hubungi admin jika ini keliru.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {assignments.map((a) => (
                        <Link key={a.observer_id} to={`/observer/election/${a.election_id}`} className="block">
                            <Card className="h-full transition-colors hover:border-primary">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <Badge variant="secondary">Observer</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            Sejak {new Date(a.appointed_at).toLocaleDateString('id-ID')}
                                        </span>
                                    </div>
                                    <CardTitle className="mt-2">{a.election_title}</CardTitle>
                                    <CardDescription>Baca hasil & riwayat observasi</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
