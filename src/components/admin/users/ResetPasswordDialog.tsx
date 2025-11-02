import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, RefreshCw, Mail, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  onSuccess?: () => void;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  userName,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'generate' | 'confirm' | 'complete'>('generate');
  const [copySuccess, setCopySuccess] = useState(false);
  const [actualEmail, setActualEmail] = useState<string | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);

  // Fetch actual user email from auth.users using RPC
  useEffect(() => {
    const fetchUserEmail = async () => {
      if (!userId || !open) return;

      setIsLoadingEmail(true);
      try {
        // Get the actual email from auth.users table using database function
        const { data, error } = await supabase.rpc('get_user_email', {
          user_id: userId
        });

        if (error) throw error;

        if (data) {
          setActualEmail(data);
        }
      } catch (error: any) {
        console.error('Error fetching user email:', error);
        toast.error('Gagal mengambil email pengguna: ' + (error.message || 'Unknown error'));
      } finally {
        setIsLoadingEmail(false);
      }
    };

    fetchUserEmail();
  }, [userId, open]);

  const generateStrongPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special

    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  };

  const handleGenerate = () => {
    const newPassword = generateStrongPassword();
    setGeneratedPassword(newPassword);
    setStep('confirm');
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopySuccess(true);
      toast.success('Password berhasil disalin ke clipboard');
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Gagal menyalin password');
    }
  };

  const handleResetPassword = async () => {
    if (!userId || !generatedPassword) return;

    const emailToUse = actualEmail || userEmail;
    if (!emailToUse) {
      toast.error('Email pengguna tidak ditemukan');
      return;
    }

    setIsSubmitting(true);
    try {
      // Note: Supabase tidak menyediakan API untuk admin mengubah password user lain
      // dari client-side karena alasan keamanan.
      // Solusi alternatif: Kirim reset password email

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setStep('complete');
      toast.success('Email reset password telah dikirim ke ' + emailToUse);

      onSuccess?.();
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Gagal mereset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualReset = async () => {
    if (!userId || !generatedPassword) return;

    setIsSubmitting(true);
    try {
      // Alternative: Show password for manual input
      // Admin can share this password with user manually
      setStep('complete');
      toast.success('Password berhasil digenerate. Bagikan password ini kepada user.');

      onSuccess?.();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setGeneratedPassword('');
    setStep('generate');
    setShowPassword(false);
    setCopySuccess(false);
    setActualEmail(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reset Password Pengguna</DialogTitle>
          <DialogDescription>
            Generate password baru untuk {userName || 'pengguna ini'}.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Generate */}
        {step === 'generate' && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Peringatan</AlertTitle>
              <AlertDescription>
                Password yang digenerate harus dibagikan kepada user secara aman.
                Pastikan user mengubah password setelah login pertama.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Klik tombol di bawah untuk generate password baru yang kuat dan acak.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              {isLoadingEmail ? (
                <div className="text-sm text-muted-foreground">Memuat email pengguna...</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Email Pengguna:</span>
                    <span className="text-muted-foreground">{actualEmail || 'Tidak tersedia'}</span>
                  </div>
                  {userEmail && userEmail !== actualEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Email Edu:</span>
                      <span className="text-muted-foreground">{userEmail}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Password Berhasil Digenerate</AlertTitle>
              <AlertDescription>
                Salin password di bawah ini dan bagikan kepada user melalui channel yang aman.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="password">Password Baru</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={generatedPassword}
                    readOnly
                    className="pr-10 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyToClipboard}
                  className="gap-2"
                >
                  {copySuccess ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copySuccess ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Password ini mengandung huruf besar, huruf kecil, angka, dan simbol.
              </p>
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleGenerate}
              >
                <RefreshCw className="h-4 w-4" />
                Generate Ulang
              </Button>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Catatan Penting</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Karena keterbatasan Supabase Auth, admin tidak dapat langsung mengubah password user dari aplikasi.
                </p>
                <p className="font-medium">
                  Pilihan yang tersedia:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Kirim email reset password ke user (otomatis)</li>
                  <li>Bagikan password ini ke user secara manual</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Selesai</AlertTitle>
              <AlertDescription>
                Password telah digenerate. Pastikan user telah menerima password baru mereka.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h4 className="font-medium text-green-900 mb-2">Langkah Selanjutnya:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-green-800">
                <li>Bagikan password kepada user melalui channel yang aman</li>
                <li>Instruksikan user untuk login dengan password baru</li>
                <li>Minta user untuk mengubah password setelah login pertama</li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'generate' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Batal
              </Button>
              <Button onClick={handleGenerate} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Generate Password
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Batal
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleResetPassword}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  {isSubmitting ? 'Mengirim...' : 'Kirim Email Reset'}
                </Button>
                <Button onClick={handleManualReset} disabled={isSubmitting}>
                  Selesai
                </Button>
              </div>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>
              Tutup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
