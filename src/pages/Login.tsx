import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { toast } from "sonner";
import { AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { dashboardPathFor, useAuth } from "@/hooks/useAuth";
import { registerCurrentDeviceSession } from "@/lib/sessions";
import { logAudit } from "@/lib/audit";

export default function Login() {
    const navigate = useNavigate();
    const { user, profile, loading: authLoading } = useAuth();
    const { resolvedTheme } = useTheme();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // If the user is already authenticated AND the auth context has finished
    // bootstrapping, send them to the right dashboard. We do NOT trigger a
    // fetch here - the auth context already does that - so this is a
    // pure navigation effect that runs at most once per sign-in.
    if (!authLoading && user && profile && !submitting) {
        const target = dashboardPathFor(profile);
        if (target !== '/login') {
            // Defer to next tick so we never navigate during render.
            setTimeout(() => navigate(target, { replace: true }), 0);
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            // Fetch profile + roles. Done locally so we can decide where to
            // go *before* the useAuth subscriber fires (otherwise the user
            // briefly sees a flash of the same page).
            const { data: profile } = await supabase
                .from("profiles")
                .select("id, full_name, student_id, department, class_id")
                .eq("id", data.user.id)
                .single();

            if (!profile) {
                throw new Error('Profil pengguna tidak ditemukan. Hubungi admin.');
            }

            const { data: rolesData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", data.user.id);

            const roles = (rolesData || []).map(
                (r: { role: string }) => r.role as 'admin' | 'voter' | 'candidate'
            );

            // Fire-and-forget side effects.
            void registerCurrentDeviceSession();
            void logAudit({
                action: 'auth.login',
                description: `User logged in: ${data.user.email}`,
                category: 'auth',
                severity: 'info',
                metadata: { user_id: data.user.id, roles },
            });

            toast.success("Login berhasil!");

            const target = dashboardPathFor({ ...profile, roles } as any);
            navigate(target, { replace: true });
        } catch (err: unknown) {
            const msg =
                err instanceof Error && err.message === 'Profil pengguna tidak ditemukan. Hubungi admin.'
                    ? err.message
                    : 'Email atau kombinasi password yang dimasukkan salah.';

            // Failed-login audit must go through the anon-callable RPC; the
            // old logAudit call failed silently because the caller is still
            // `anon` after a failed sign-in (log_audit_event is only granted
            // to `authenticated`). Fire-and-forget.
            void (async () => {
                await supabase.rpc('log_failed_login', { p_email: email });
            })().catch(() => undefined);

            setError(msg);
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/5 p-4">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md">
                <div className="mb-4">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Kembali ke Beranda
                    </Link>
                </div>
                <div className="mb-8 text-center">
                    <img
                        src={resolvedTheme === 'dark' ? "/UniVertexPrimaryWhite.png" : "/UniVertex.png"}
                        alt="UniVertex Logo"
                        className="mx-auto mb-4 h-40 w-auto"
                    />
                </div>

                <Card className="border-border/50 shadow-lg">
                    <CardHeader>
                        <CardTitle>Masuk</CardTitle>
                        <CardDescription>Masuk ke akun Anda untuk memberikan suara</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email atau NIM</Label>
                                <Input id="email" type="email" placeholder="example@email.com" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required disabled={submitting} className="border-border" autoComplete="email" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link to="/reset-password" className="text-sm text-primary hover:underline">
                                        Lupa password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={submitting}
                                        className="border-border"
                                        autoComplete="current-password"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? "Memproses..." : "Masuk"}
                            </Button>
                        </form>

                        <div className="mt-6 space-y-3 text-center text-sm">
                            <p className="text-muted-foreground">
                                Punya undangan? Buka tautan undangan yang diberikan panitia.
                            </p>
                            <p className="text-muted-foreground">Tidak bisa masuk? Hubungi administrator Anda</p>
                        </div>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground">Dengan masuk, Anda menyetujui penggunaan sistem ini sesuai ketentuan yang berlaku</p>
            </div>
        </div>
    );
}
