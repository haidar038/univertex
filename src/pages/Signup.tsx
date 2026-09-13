import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { dashboardPathFor, useAuth } from '@/hooks/useAuth';
import { ShieldCheck, Info, Mail, Vote, ArrowLeft } from 'lucide-react';

/**
 * Public sign-up is intentionally disabled. UniVertex uses an invite-only flow:
 * every account must be created either by an admin or by accepting an
 * invitation link distributed by the committee.
 *
 * This page now redirects authenticated users to their dashboard and shows an
 * informative placeholder for everyone else.
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { resolvedTheme } = useTheme();

  // If already signed in, send to the right dashboard.
  useEffect(() => {
    if (authLoading || !user || !profile) return;
    navigate(dashboardPathFor(profile), { replace: true });
  }, [authLoading, user, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/5 p-4">
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
            className="mx-auto mb-4 h-32 w-auto"
          />
        </div>

        <Card className="w-full border-border/50 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Pendaftaran Tertutup</CardTitle>
            <CardDescription>
              UniVertex menggunakan sistem undangan (invite-only) untuk menjaga
              keamanan dan integritas pemilihan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
              <p className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span>
                  Pendaftaran publik <strong>dinonaktifkan</strong>. Akun hanya dapat
                  dibuat oleh admin/panitia melalui tautan undangan.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span>
                  Jika Anda seorang mahasiswa, hubungi admin/panitia untuk menerima
                  tautan undangan yang berisi instruksi pendaftaran.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Vote className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span>
                  Anda akan diminta untuk <strong>login</strong> dengan email yang
                  sesuai saat menerima undangan.
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/login">Sudah Punya Akun?</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link to="/">Kembali ke Beranda</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
