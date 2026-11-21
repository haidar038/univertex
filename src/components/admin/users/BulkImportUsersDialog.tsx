import { useState, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Download, KeyRound } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { generatePin } from '@/lib/pin';

interface BulkImportUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface CSVUser {
  full_name: string;
  student_id: string;
  email: string;
  password: string;
  department?: string;
  class_name?: string;
  roles: string; // comma-separated: voter,candidate
}

interface ParsedUser extends CSVUser {
  rowNumber: number;
  valid: boolean;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  user: ParsedUser;
  error?: string;
}

export function BulkImportUsersDialog({ open, onOpenChange, onSuccess }: BulkImportUsersDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  // P-C: kelas override — untuk import per-kelas tanpa kolom class_name.
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classOverride, setClassOverride] = useState<string>('none');
  // Upacara kredensial H-H: password 8 digit acak (CSPRNG), anti-bingung.
  const [autoGenPw, setAutoGenPw] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    setClasses((data as Array<{ id: string; name: string }>) || []);
  };

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setClassOverride('none');
      fetchClasses();
    } else {
      handleClose();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('File harus berformat CSV');
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setParsedUsers(parsed);
      setStep('preview');
    } catch (error: any) {
      console.error('Error parsing CSV:', error);
      toast.error('Gagal membaca file CSV');
    }
  };

  const parseCSV = (text: string): ParsedUser[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('File CSV kosong atau tidak valid');
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredFields = ['full_name', 'student_id', 'email', 'password', 'roles'];

    // Validate header
    const missingFields = requiredFields.filter(field => !header.includes(field));
    if (missingFields.length > 0) {
      throw new Error(`Kolom wajib tidak ditemukan: ${missingFields.join(', ')}`);
    }

    // Parse rows
    const users: ParsedUser[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const user: any = {};
      header.forEach((field, index) => {
        user[field] = values[index] || '';
      });

      const errors = validateUser(user, i + 1);
      users.push({
        ...user,
        rowNumber: i + 1,
        valid: errors.length === 0,
        errors,
      });
    }

    return users;
  };

  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  };

  const validateUser = (user: any, rowNumber: number): string[] => {
    const errors: string[] = [];

    // Required fields
    if (!user.full_name || user.full_name.length < 2) {
      errors.push('Nama harus minimal 2 karakter');
    }
    if (!user.student_id || user.student_id.length < 1) {
      errors.push('NIM tidak boleh kosong');
    }
    if (!user.email || !isValidEmail(user.email)) {
      errors.push('Email tidak valid');
    }
    // Upacara H-H: password digenerate otomatis (8 digit) bila mode aktif.
    if (!autoGenPw && (!user.password || user.password.length < 8)) {
      errors.push('Password minimal 8 karakter');
    }
    if (!user.roles || user.roles.trim() === '') {
      errors.push('Role tidak boleh kosong');
    } else {
      const roles = user.roles.split('|').map((r: string) => r.trim());
      const validRoles = ['voter', 'candidate'];
      const invalidRoles = roles.filter((r: string) => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        errors.push(`Role tidak valid: ${invalidRoles.join(', ')}`);
      }
    }

    return errors;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleImport = async () => {
    const validUsers = parsedUsers.filter(u => u.valid);
    if (validUsers.length === 0) {
      toast.error('Tidak ada data valid untuk diimport');
      return;
    }

    setIsProcessing(true);
    setStep('importing');
    setProgress(0);

    const results: ImportResult[] = [];

    // Fetch all classes once
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name');
    const classesMap = new Map(classesData?.map(c => [c.name.toLowerCase(), c.id]) || []);

    // PIN per baris (upacara H-H): digenerate di client agar bisa diunduh
    // SEKALI sebagai slip kredensial. Server tidak pernah mengembalikannya.
    const withPins = validUsers.map((user) =>
      autoGenPw && (!user.password || user.password.length < 8)
        ? { ...user, password: generatePin() }
        : user
    );

    // Kelompokkan per kelas ter-resolve; SATU-SATUNYA jalur tulis = RPC batch.
    // Baris tanpa kelas = error eksplisit (dulu lolos diam-diam class null).
    const groups = new Map<string, typeof withPins>();
    const noClass: typeof withPins = [];
    for (const user of withPins) {
      let classId: string | null = null;
      if (user.class_name) {
        classId = classesMap.get(user.class_name.toLowerCase()) || null;
      }
      if (!classId && classOverride !== 'none') classId = classOverride;
      if (!classId) noClass.push(user);
      else {
        const g = groups.get(classId) || [];
        g.push(user);
        groups.set(classId, g);
      }
    }
    for (const user of noClass) {
      results.push({
        success: false,
        user,
        error: 'Kelas tidak ditemukan — pilih kelas tujuan atau perbaiki class_name',
      });
    }

    let done = noClass.length;
    const total = validUsers.length;
    // Create accounts via admin_import_class_users (chunk 200). Never call
    // supabase.auth.signUp here - that would hijack the admin's own session.
    // Roles per baris ditentukan server (satu aturan untuk semua import).
    for (const [classId, rows] of groups) {
      for (let s = 0; s < rows.length; s += 200) {
        const chunk = rows.slice(s, s + 200);
        try {
          const { data, error: rpcError } = await supabase.rpc('admin_import_class_users', {
            p_class_id: classId,
            p_users: chunk.map((u) => ({
              full_name: u.full_name,
              student_id: u.student_id,
              email: u.email,
              password: u.password,
              department: u.department || null,
              roles: u.roles,
            })),
          });
          if (rpcError) throw rpcError;
          const res = data as unknown as {
            created: number;
            skipped_exists: string[];
            errors: Array<{ email: string; error: string }>;
          };
          const skipped = new Set(res.skipped_exists || []);
          const errByEmail = new Map((res.errors || []).map((e) => [e.email.toLowerCase(), e.error]));
          for (const u of chunk) {
            const key = u.email.toLowerCase();
            if (errByEmail.has(key)) {
              results.push({ success: false, user: u, error: errByEmail.get(key) });
            } else if (skipped.has(u.email) || skipped.has(key)) {
              results.push({ success: false, user: u, error: 'Email sudah terdaftar' });
            } else {
              results.push({ success: true, user: u });
            }
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Gagal import batch';
          for (const u of chunk) results.push({ success: false, user: u, error: msg });
        }
        done += chunk.length;
        setProgress((done / total) * 100);
      }
    }

    setImportResults(results);
    setIsProcessing(false);
    setStep('complete');

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      toast.success(`Berhasil mengimport ${successCount} user`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} user gagal diimport`);
    }

    if (successCount > 0) {
      onSuccess?.();
    }
  };

  const handleClose = () => {
    setParsedUsers([]);
    setImportResults([]);
    setProgress(0);
    setStep('upload');
    setClassOverride('none');
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const template = `full_name,student_id,email,password,department,class_name,roles
John Doe,123456,john@example.com,password123,Teknik Informatika,Informatika 2022,voter
Jane Smith,123457,jane@example.com,password123,Teknik Informatika,Informatika 2022,voter|candidate
Bob Johnson,123458,bob@example.com,password123,Sistem Informasi,Informatika 2022,voter`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template berhasil diunduh');
  };

  const downloadCredentials = () => {
    // Slip kredensial H-H: unduh SEKALI, cetak per-kelas, simpan terkunci.
    // Server tidak menyimpan PIN plain — file ini satu-satunya salinan.
    const rows = importResults
      .filter((r) => r.success)
      .map((r) => `${r.user.full_name},${r.user.student_id},${r.user.email},${r.user.password}`);
    const csv = `full_name,student_id,email,password\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kredensial-voter.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV kredensial diunduh — simpan terkunci, jangan disebar digital');
  };

  const validCount = parsedUsers.filter(u => u.valid).length;
  const invalidCount = parsedUsers.filter(u => !u.valid).length;
  const successCount = importResults.filter(r => r.success).length;
  const failCount = importResults.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-175">
        <DialogHeader>
          <DialogTitle>Import Pengguna dari CSV</DialogTitle>
          <DialogDescription>
            Upload file CSV untuk membuat banyak pengguna sekaligus.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Format CSV</AlertTitle>
              <AlertDescription>
                File CSV harus memiliki kolom: <strong>full_name, student_id, email, password, roles</strong>.
                Kolom opsional: <strong>department, class_name</strong>.
                <br />
                Roles dipisahkan dengan | (contoh: voter|candidate).
                Bila "Generate PIN" aktif, kolom password boleh kosong.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={downloadTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            {/* P-C: import per-kelas — pilih kelas sekali, berlaku untuk
                baris tanpa class_name yang cocok. */}
            <div className="space-y-2">
              <Label htmlFor="class-override">Kelas tujuan (opsional)</Label>
              <Select value={classOverride} onValueChange={setClassOverride}>
                <SelectTrigger id="class-override">
                  <SelectValue placeholder="Ikut kolom class_name CSV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ikut kolom class_name CSV</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Untuk import 1 kelas penuh: pilih kelas di sini, CSV cukup berisi
                full_name, student_id, email, password, roles.
              </p>
            </div>

            {/* Upacara kredensial H-H: PIN 8 digit acak per voter. */}
            <div className="flex items-start space-x-3 rounded-md border p-3">
              <Checkbox
                id="autogen-pin"
                checked={autoGenPw}
                onCheckedChange={(v) => setAutoGenPw(v === true)}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="autogen-pin" className="cursor-pointer font-medium">
                  Generate PIN 8 digit otomatis
                </Label>
                <p className="text-xs text-muted-foreground">
                  Kolom password CSV boleh kosong — tiap voter dapat PIN acak
                  (10^8 kombinasi). Unduh CSV kredensial setelah import untuk
                  dicetak sebagai slip H-H.
                </p>
              </div>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Klik untuk memilih file CSV atau drag & drop
              </p>
              <p className="text-xs text-muted-foreground">
                Maksimal ukuran file: 5MB
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Alert className="flex-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Valid</AlertTitle>
                <AlertDescription className="text-2xl font-bold">
                  {validCount}
                </AlertDescription>
              </Alert>
              <Alert className="flex-1" variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-2xl font-bold">
                  {invalidCount}
                </AlertDescription>
              </Alert>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-3">
                {parsedUsers.map((user) => (
                  <div
                    key={user.rowNumber}
                    className={`p-3 rounded-lg border ${user.valid
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {user.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">
                            Baris {user.rowNumber}: {user.full_name}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {user.student_id} - {user.email} - {user.roles}
                        </p>
                        {!user.valid && (
                          <ul className="text-sm text-red-600 mt-2 list-disc list-inside">
                            {user.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {invalidCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Peringatan</AlertTitle>
                <AlertDescription>
                  {invalidCount} baris data tidak valid. Hanya {validCount} user yang akan diimport.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="space-y-4">
            <Alert>
              <Upload className="h-4 w-4 animate-pulse" />
              <AlertTitle>Sedang Mengimport...</AlertTitle>
              <AlertDescription>
                Mohon tunggu, sedang membuat {validCount} user.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Alert className="flex-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Berhasil</AlertTitle>
                <AlertDescription className="text-2xl font-bold">
                  {successCount}
                </AlertDescription>
              </Alert>
              <Alert className="flex-1" variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription className="text-2xl font-bold">
                  {failCount}
                </AlertDescription>
              </Alert>
            </div>

            {failCount > 0 && (
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {importResults
                    .filter(r => !r.success)
                    .map((result, idx) => (
                      <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded">
                        <p className="font-medium text-sm text-red-600">
                          {result.user.full_name} ({result.user.email})
                        </p>
                        <p className="text-xs text-red-600">{result.error}</p>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}

            {successCount > 0 && (
              <div className="space-y-2">
                <Button variant="outline" className="w-full gap-2" onClick={downloadCredentials}>
                  <KeyRound className="h-4 w-4" />
                  Unduh CSV Kredensial ({successCount} akun, sekali saja)
                </Button>
                <p className="text-xs text-muted-foreground">
                  Berisi PIN tiap akun — cetak per-kelas sebagai slip H-H, lalu hapus file digitalnya.
                  PIN tidak bisa dilihat lagi setelah dialog ditutup.
                </p>
                <p className="text-xs font-medium text-destructive">
                  Perhatian: bila akun ini nanti di-blast via email, password di sini DIGANTI
                  PIN baru yang dikirim email — CSV ini otomatis kedaluwarsa. Satu kohort =
                  satu jalur (slip fisik ATAU email, jangan campur).
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Batal
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Kembali
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isProcessing}
              >
                Import {validCount} User
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
