import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { dashboardPathFor, useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

function hasRecoveryTokenInUrl() {
  const fromSearch = new URLSearchParams(window.location.search).get('type');
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
  return fromSearch === 'recovery' || fromHash === 'recovery';
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(hasRecoveryTokenInUrl);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Supabase emits PASSWORD_RECOVERY after it exchanges the email-link token
  // for a session.  The URL check covers the case where the client parsed the
  // hash before this component's listener was attached.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // A normal authenticated user does not need the reset-request page.  A
  // recovery session is the exception: it must stay here until updateUser
  // succeeds, otherwise the user is sent to a dashboard without a password.
  useEffect(() => {
    if (!recoveryMode && !authLoading && user && profile) {
      navigate(dashboardPathFor(profile), { replace: true });
    }
  }, [authLoading, navigate, profile, recoveryMode, user]);

  const handleResetRequest = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (requestError: unknown) {
      console.error('Reset password error:', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Gagal mengirim email reset password');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);

      const refreshedProfile = await refresh();
      if (refreshedProfile) {
        navigate(dashboardPathFor(refreshedProfile), { replace: true });
      }
    } catch (updateError: unknown) {
      console.error('Update password error:', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Gagal memperbarui password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/5 p-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke login
        </Link>

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>{recoveryMode ? 'Buat Password Baru' : 'Reset Password'}</CardTitle>
            <CardDescription>
              {recoveryMode
                ? 'Masukkan password baru untuk akun Anda.'
                : 'Masukkan email Anda untuk menerima link reset password.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success && !recoveryMode ? (
              <Alert className="border-success bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription className="text-success-foreground">
                  Email reset password telah dikirim. Periksa inbox Anda.
                </AlertDescription>
              </Alert>
            ) : recoveryMode ? (
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password baru</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Konfirmasi password baru</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || authLoading || !user}>
                  {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetRequest} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Mengirim...' : 'Kirim Link Reset'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
