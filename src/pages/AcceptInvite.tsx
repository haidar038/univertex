import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertTriangle, Vote, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardPathFor } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface InvitationInfo {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  intent: 'register' | 'candidate' | 'voter_group' | 'committee' | 'observer';
  event_id: string | null;
  class_id: string | null;
  roles: string[];
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refresh } = useAuth();
  const [invite, setInvite] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Set-password flow state (new users without an account)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token undangan tidak valid.');
      setLoading(false);
      return;
    }
    fetchInvite();
  }, [token]);

  // After successful redemption, redirect to dashboard once profile is loaded.
  useEffect(() => {
    if (accepted && !authLoading && profile) {
      navigate(dashboardPathFor(profile), { replace: true });
    }
  }, [accepted, authLoading, profile, navigate]);

  const fetchInvite = async () => {
    setLoading(true);
    setError(null);

    try {
      // The visitor is not authenticated yet, so a normal table SELECT is
      // intentionally denied by RLS.  The token-scoped RPC exposes only the
      // one invitation represented by this unguessable URL.
      const { data, error: fetchErr } = await supabase.rpc('get_invitation_by_token', {
        p_token: token,
      });
      const invitation = data?.[0] ?? null;

      if (fetchErr) throw fetchErr;
      if (!invitation) {
        setError('Undangan tidak ditemukan atau sudah tidak berlaku.');
        return;
      }

      const i = invitation as InvitationInfo;

      if (i.accepted_at) {
        setError('Undangan ini sudah pernah diterima.');
        return;
      }
      if (i.revoked_at) {
        setError('Undangan ini telah dicabut.');
        return;
      }
      if (new Date(i.expires_at) < new Date()) {
        setError('Undangan ini sudah kedaluwarsa.');
        return;
      }
      setInvite(i);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat undangan';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !user) return;
    setSubmitting(true);
    try {
      const { error: redeemErr } = await supabase.rpc('redeem_invitation', {
        p_token: token,
      });
      if (redeemErr) throw redeemErr;
      toast.success('Undangan berhasil diterima.');
      setAccepted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menerima undangan';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Register a brand-new account directly from the invitation (fixes the
  // invite Catch-22: previously a new user had no way to accept because
  // accepting required being logged in first).
  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invite) return;

    setRegisterError(null);

    if (password.length < 8) {
      setRegisterError('Password minimal 8 karakter.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setRegisterError('Password harus mengandung huruf dan angka.');
      return;
    }
    if (password !== confirmPassword) {
      setRegisterError('Konfirmasi password tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: registerErr } = await supabase.rpc(
        'accept_invitation_and_register',
        { p_token: token, p_password: password }
      );
      if (registerErr) throw registerErr;

      // Sign in immediately with the credentials just set.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });
      if (signInErr) throw signInErr;

      toast.success('Akun berhasil dibuat. Selamat datang!');
      setAccepted(true);
      await refresh();
    } catch (e: unknown) {
      // Supabase RPC errors are plain objects with a `message` field, not
      // Error instances - extract accordingly.
      const msg =
        (e instanceof Error ? e.message : undefined) ??
        (e as { message?: string } | null)?.message ??
        'Gagal membuat akun';
      if (/sudah terdaftar/i.test(msg)) {
        setAccountExists(true);
      }
      setRegisterError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/5 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-center">Undangan Tidak Valid</CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/login">Kembali ke Halaman Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/5 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Vote className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center">Undangan UniVertex</CardTitle>
          <CardDescription className="text-center">
            Anda diundang untuk berpartisipasi dalam pemilihan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{invite.email}</span>
            </div>
            {invite.full_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama:</span>
                <span className="font-medium">{invite.full_name}</span>
              </div>
            )}
            {invite.student_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">NIM:</span>
                <span className="font-medium">{invite.student_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tujuan:</span>
              <span className="font-medium">
                {invite.intent === 'register' && 'Pendaftaran Pemilih'}
                {invite.intent === 'candidate' && 'Pendaftaran Kandidat'}
                {invite.intent === 'voter_group' && 'Tambah ke DPT'}
                {invite.intent === 'committee' && 'Penugasan Panitia'}
                {invite.intent === 'observer' && 'Penugasan Observer'}
              </span>
            </div>
            {invite.roles.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium">{invite.roles.join(', ')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Berlaku s/d:</span>
              <span className="font-medium">
                {format(new Date(invite.expires_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
              </span>
            </div>
          </div>

          {!user ? (
            accountExists ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Akun dengan email <strong>{invite.email}</strong> sudah terdaftar.
                  Silakan <Link to="/login" className="underline font-medium">login terlebih dahulu</Link>,
                  lalu buka kembali tautan undangan ini untuk menerimanya.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleRegisterAndAccept} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Buat Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimal 8 karakter, huruf & angka"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Konfirmasi Password</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ulangi password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={submitting}
                    autoComplete="new-password"
                  />
                </div>
                {registerError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{registerError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Memproses...' : 'Buat Akun & Terima Undangan'}
                </Button>
              </form>
            )
          ) : user.email !== invite.email ? (
            <Alert variant="destructive">
              <AlertDescription>
                Anda sedang login sebagai <strong>{user.email}</strong>, tetapi undangan ini
                ditujukan untuk <strong>{invite.email}</strong>. Silakan logout lalu login
                dengan email yang benar.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-success/40 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success-foreground">
                Email login Anda cocok dengan undangan. Klik tombol di bawah untuk menerima.
              </AlertDescription>
            </Alert>
          )}

          {user && (
            <Button
              onClick={handleAccept}
              disabled={!user || user.email !== invite.email || submitting || accepted}
              className="w-full gap-2"
            >
              {submitting ? 'Memproses...' : accepted ? 'Diterima!' : 'Terima Undangan'}
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Dengan menerima undangan, Anda akan terdaftar sebagai pengguna UniVertex
            dengan role yang tercantum di atas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
