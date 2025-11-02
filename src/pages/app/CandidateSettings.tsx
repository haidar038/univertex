import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Settings, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { getCandidateStatusInfo } from "@/lib/candidate-helpers";

export default function CandidateSettings() {
    const { profile } = useAuth();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            fetchCandidateProfiles();
        }
    }, [profile]);

    const fetchCandidateProfiles = async () => {
        try {
            const { data, error } = await supabase
                .from("candidates")
                .select("*, election_events(title)")
                .eq("user_id", profile?.id || "");

            if (error) throw error;
            setCandidates(data || []);
        } catch (error) {
            console.error("Error fetching candidate profiles:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (candidateId: string, vision: string, mission: string, photoStoragePath: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from("candidates")
                .update({
                    vision,
                    mission,
                    photo_storage_path: photoStoragePath || null,
                    status: "pending", // Set to pending when candidate makes changes
                })
                .eq("id", candidateId);

            if (error) throw error;
            toast.success("Profil kandidat berhasil diperbarui dan menunggu persetujuan admin");
            fetchCandidateProfiles();
        } catch (error: any) {
            console.error("Error updating candidate profile:", error);
            toast.error("Gagal memperbarui profil kandidat");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Memuat...</div>;
    }

    return (
        <div className="p-8">
            <div className="mx-auto max-w-2xl space-y-6">
                <div>
                    <h1 className="mb-2 text-3xl font-bold text-foreground">Pengaturan Kandidat</h1>
                    <p className="text-muted-foreground">Kelola profil kandidat Anda</p>
                </div>

                {/* Instructions */}
                {candidates.length > 0 && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Catatan Penting:</strong>
                            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                                <li>Pastikan visi dan misi Anda jelas dan sesuai dengan pedoman pemilihan</li>
                                <li>Upload foto profil yang profesional dan berkualitas baik</li>
                                <li>Setiap perubahan yang Anda lakukan akan di-review oleh admin sebelum tampil di halaman pemilihan</li>
                                <li>Status profil akan berubah menjadi "Menunggu Persetujuan" setelah Anda update</li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {candidates.length === 0 ? (
                    <Card>
                        <CardContent className="flex min-h-[200px] flex-col items-center justify-center py-12">
                            <Settings className="mb-4 h-12 w-12 text-muted-foreground" />
                            <h3 className="mb-2 text-lg font-semibold text-foreground">Belum Ada Pendaftaran Kandidat</h3>
                            <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
                                Anda memiliki role kandidat, namun belum didaftarkan oleh admin ke pemilihan manapun. Hubungi admin untuk mendaftarkan Anda sebagai kandidat di pemilihan tertentu.
                            </p>
                            <div className="rounded-lg bg-muted p-4 max-w-md">
                                <p className="text-xs text-muted-foreground">
                                    <strong>Catatan:</strong> Admin yang akan mendaftarkan Anda sebagai kandidat di event pemilihan tertentu. Setelah didaftarkan, Anda dapat mengelola profil kandidat (visi, misi, foto) di halaman ini.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    candidates.map((candidate) => {
                        const statusInfo = getCandidateStatusInfo(candidate.status || "pending");
                        const StatusIcon = candidate.status === "approved" ? CheckCircle2 : candidate.status === "rejected" ? AlertCircle : Clock;

                        return (
                            <Card key={candidate.id}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Settings className="h-5 w-5" />
                                            {(candidate.election_events as any).title}
                                        </CardTitle>
                                        <Badge variant={statusInfo.variant as any} className="gap-1">
                                            <StatusIcon className="h-3 w-3" />
                                            {statusInfo.label}
                                        </Badge>
                                    </div>
                                    <CardDescription>{statusInfo.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {candidate.status === "rejected" && candidate.rejection_reason && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                <strong>Alasan penolakan:</strong> {candidate.rejection_reason}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <CandidateForm candidate={candidate} onUpdate={handleUpdate} loading={loading} userId={profile?.id || ""} />
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function CandidateForm({ candidate, onUpdate, loading, userId }: { candidate: any; onUpdate: (id: string, vision: string, mission: string, photoStoragePath: string) => void; loading: boolean; userId: string }) {
    const [vision, setVision] = useState(candidate.vision || "");
    const [mission, setMission] = useState(candidate.mission || "");
    const [photoStoragePath, setPhotoStoragePath] = useState(candidate.photo_storage_path || "");
    const [photoUrl, setPhotoUrl] = useState("");

    // Get current photo URL
    const getCurrentPhotoUrl = () => {
        if (photoStoragePath) {
            const { data } = supabase.storage.from("candidate-photos").getPublicUrl(photoStoragePath);
            return data.publicUrl;
        }
        return candidate.photo_url || null;
    };

    const handleImageUploaded = (storagePath: string, publicUrl: string) => {
        setPhotoStoragePath(storagePath);
        setPhotoUrl(publicUrl);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        if (!vision.trim() || !mission.trim()) {
            toast.error("Visi dan Misi harus diisi");
            return;
        }

        onUpdate(candidate.id, vision, mission, photoStoragePath);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <ImageUpload currentImageUrl={getCurrentPhotoUrl()} onImageUploaded={handleImageUploaded} userId={userId} disabled={loading} />

            <div className="space-y-2">
                <Label htmlFor={`vision-${candidate.id}`}>
                    Visi <span className="text-destructive">*</span>
                </Label>
                <Textarea id={`vision-${candidate.id}`} value={vision} onChange={(e) => setVision(e.target.value)} disabled={loading} rows={4} placeholder="Tuliskan visi Anda..." required />
            </div>

            <div className="space-y-2">
                <Label htmlFor={`mission-${candidate.id}`}>
                    Misi <span className="text-destructive">*</span>
                </Label>
                <Textarea id={`mission-${candidate.id}`} value={mission} onChange={(e) => setMission(e.target.value)} disabled={loading} rows={4} placeholder="Tuliskan misi Anda..." required />
            </div>

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Setelah menyimpan perubahan, profil Anda akan diubah ke status "Menunggu Persetujuan" dan memerlukan persetujuan admin sebelum tampil di pemilihan.</AlertDescription>
            </Alert>

            <Button type="submit" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
        </form>
    );
}
