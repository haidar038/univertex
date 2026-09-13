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
import { Copy, RefreshCw, Mail, Eye, EyeOff, AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  onSuccess?: () => void;
}

type Step = 'choose' | 'confirm' | 'complete';
type CompleteMode = 'email' | 'manual';

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
  const [step, setStep] = useState<Step>('choose');
  const [completeMode, setCompleteMode] = useState<CompleteMode>('manual');
  const [copySuccess, setCopySuccess] = useState(false);
  const [actualEmail, setActualEmail] = useState<string | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);

  // Fetch actual user email from auth.users using RPC
  useEffect(() => {
    const fetchUserEmail = async () => {
      if (!userId || !open) return;

      // The user directory already obtained the email via its authorised,
      // batched admin RPC.  Reuse it and avoid another auth.users lookup.
      if (userEmail) {
        setActualEmail(userEmail);
        setIsLoadingEmail(false);
        return;
      }

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
  }, [userId, userEmail, open]);

  // Cryptographically secure random integer in [0, max)
  const secureRandomInt = (max: number): number => {
    const array = new Uint32Array(1);
    const limit = Math.floor(0xFFFFFFFF / max) * max;
    let value = 0;
    do {
      crypto.getRandomValues(array);
      value = array[0];
    } while (value >= limit);
    return value % max;
  };

  const generateStrongPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[secureRandomInt(26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[secureRandomInt(26)]; // Lowercase
    password += '0123456789'[secureRandomInt(10)]; // Number
    password += '!@#$%^&*'[secureRandomInt(8)]; // Special

    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += charset[secureRandomInt(charset.length)];
    }

    // Shuffle with Fisher-Yates using secure randomness
    const chars = password.split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  };

  const handleStartManual = () => {
    // Generate locally first; nothing is persisted until the admin confirms
    // with "Simpan Password" so a cancelled dialog never changes the account.
    setGeneratedPassword(generateStrongPassword());
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

  // Email-based path: Supabase sends the user a recovery link and the user
  // sets their own new password on /reset-password. The locally generated
  // password is never used or persisted in this path.
  const handleSendResetEmail = async () => {
    const emailToUse = actualEmail || userEmail;
    if (!emailToUse) {
      toast.error('Email pengguna tidak ditemukan');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setCompleteMode('email');
      setStep('complete');
      toast.success('Email reset password telah dikirim ke ' + emailToUse);

      onSuccess?.();
    } catch (error: any) {
      console.error('Error sending reset password email:', error);
      toast.error(error.message || 'Gagal mengirim email reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manual path: persist the generated password to the account via the
  // admin_update_password RPC. Only after this call does the generated
  // password actually work at login.
  const handleSavePassword = async () => {
    if (!userId || !generatedPassword) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('admin_update_password', {
        p_user_id: userId,
        p_password: generatedPassword,
      });

      if (error) throw error;

      setCompleteMode('manual');
      setStep('complete');
      toast.success('Password berhasil disimpan. Bagikan password ini kepada user.');

      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving password:', error);
      toast.error(error.message || 'Gagal menyimpan password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitting(false);
    setGeneratedPassword('');
    setStep('choose');
    setShowPassword(false);
    setCopySuccess(false);
    setActualEmail(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password Pengguna</DialogTitle>
          <DialogDescription>
            Atur ulang password untuk {userName || 'pengguna ini'}.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Choose the reset method */}
        {step === 'choose' && (
          <div className="space-y-4">
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

            <div className="grid gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-1 p-4 text-left"
                onClick={handleSendResetEmail}
                disabled={isSubmitting || isLoadingEmail || (!actualEmail && !userEmail)}
              >
                <span className="flex w-full items-center gap-2 font-medium text-foreground">
                  <Mail className="h-4 w-4" />
                  {isSubmitting ? 'Mengirim...' : 'Kirim Email Reset'}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  User menerima tautan via email dan membuat password barunya sendiri.
                  Password baru tidak dibuat oleh admin.
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-1 p-4 text-left"
                onClick={handleStartManual}
                disabled={isSubmitting}
              >
                <span className="flex w-full items-center gap-2 font-medium text-foreground">
                  <KeyRound className="h-4 w-4" />
                  Generate Password Manual
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Buat password acak yang kuat, simpan ke akun user, lalu bagikan
                  kepada user melalui channel yang aman.
                </span>
              </Button>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Peringatan</AlertTitle>
              <AlertDescription>
                Pastikan user mengubah password setelah login pertama. Password
                yang dibagikan secara manual harus disampaikan melalui channel yang aman.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 2: Confirm the generated password (manual path only) */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Password Berhasil Digenerate</AlertTitle>
              <AlertDescription>
                Password ini belum disimpan. Klik <strong>Simpan Password</strong> agar
                password aktif dan dapat digunakan user untuk login.
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
                onClick={() => setGeneratedPassword(generateStrongPassword())}
                disabled={isSubmitting}
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
                  Setelah disimpan, password lama user langsung tidak valid dan semua
                  sesi aktif akan dikeluarkan.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && completeMode === 'email' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Email Terkirim</AlertTitle>
              <AlertDescription>
                Tautan reset password telah dikirim ke {actualEmail || userEmail}. User
                akan mengatur password barunya sendiri melalui tautan tersebut.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'complete' && completeMode === 'manual' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Password Tersimpan</AlertTitle>
              <AlertDescription>
                Password baru telah aktif untuk akun {userName || 'user ini'}. Semua sesi
                lama telah dikeluarkan.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-400 dark:bg-green-900/25 p-4">
              <h4 className="font-medium text-green-400 mb-2">Langkah Selanjutnya:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-green-400">
                <li>Bagikan password kepada user melalui channel yang aman</li>
                <li>Instruksikan user untuk login dengan password baru</li>
                <li>Minta user untuk mengubah password setelah login pertama</li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'choose' && (
            <Button variant="outline" onClick={handleClose}>
              Batal
            </Button>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Batal
              </Button>
              <Button onClick={handleSavePassword} disabled={isSubmitting} className="gap-2">
                <KeyRound className="h-4 w-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Password'}
              </Button>
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
