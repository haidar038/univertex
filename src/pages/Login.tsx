import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { toast } from "sonner";
import { Vote, AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function Login() {
    const navigate = useNavigate();
    const { resolvedTheme } = useTheme();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Check if user is already logged in
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Get user roles to redirect to appropriate dashboard
                const { data: roles } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", session.user.id);

                const isAdmin = roles?.some((r) => r.role === "admin");
                navigate(isAdmin ? "/admin/dashboard" : "/app/dashboard", { replace: true });
            }
        };
        checkSession();
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            // Get user roles to determine redirection
            const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);

            toast.success("Login berhasil!");

            // Redirect based on role
            const isAdmin = roles?.some((r) => r.role === "admin");
            if (isAdmin) {
                navigate("/admin/dashboard");
            } else {
                navigate("/app/dashboard");
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Login error:", error);
                setError(error.message || "Email atau password salah");
            } else {
                console.error("Unexpected error:", error);
            }
        } finally {
            setLoading(false);
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
                                <Input id="email" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="border-border" />
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
                                        disabled={loading}
                                        className="border-border"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Memproses..." : "Masuk"}
                            </Button>
                        </form>

                        <div className="mt-6 space-y-3 text-center text-sm">
                            <p className="text-muted-foreground">
                                Belum punya akun?{" "}
                                <Link to="/signup" className="text-primary hover:underline font-medium">
                                    Daftar di sini
                                </Link>
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
