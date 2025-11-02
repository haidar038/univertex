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
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!user.password || user.password.length < 6) {
      errors.push('Password minimal 6 karakter');
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

    for (let i = 0; i < validUsers.length; i++) {
      const user = validUsers[i];
      try {
        // Create user account
        const { data: userData, error: authError } = await supabase.auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            data: {
              full_name: user.full_name,
              student_id: user.student_id,
              department: user.department,
            },
          },
        });

        if (authError) throw authError;
        if (!userData.user) throw new Error('Gagal membuat user');

        const userId = userData.user.id;

        // Find class_id if class_name provided
        let classId = null;
        if (user.class_name) {
          classId = classesMap.get(user.class_name.toLowerCase());
          if (!classId) {
            console.warn(`Kelas tidak ditemukan: ${user.class_name}`);
          }
        }

        // Update profile with class_id
        await supabase
          .from('profiles')
          .update({
            full_name: user.full_name,
            student_id: user.student_id,
            department: user.department || null,
            class_id: classId,
          })
          .eq('id', userId);

        // Parse roles
        const roles = user.roles.split('|').map(r => r.trim());

        // Delete default voter role if not in roles list
        if (!roles.includes('voter')) {
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role', 'voter');
        }

        // Add candidate role if specified
        if (roles.includes('candidate')) {
          await supabase
            .from('user_roles')
            .insert({
              user_id: userId,
              role: 'candidate',
            });
        }

        results.push({ success: true, user });
      } catch (error: any) {
        console.error(`Error importing user ${user.email}:`, error);
        let errorMessage = error.message || 'Unknown error';
        if (error.message?.includes('already registered')) {
          errorMessage = 'Email sudah terdaftar';
        } else if (error.code === '23505') {
          errorMessage = 'NIM sudah digunakan';
        }
        results.push({ success: false, user, error: errorMessage });
      }

      setProgress(((i + 1) / validUsers.length) * 100);
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

  const validCount = parsedUsers.filter(u => u.valid).length;
  const invalidCount = parsedUsers.filter(u => !u.valid).length;
  const successCount = importResults.filter(r => r.success).length;
  const failCount = importResults.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px]">
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
                Roles dipisahkan dengan | (contoh: voter|candidate)
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
                    className={`p-3 rounded-lg border ${
                      user.valid
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
                        <p className="font-medium text-sm">
                          {result.user.full_name} ({result.user.email})
                        </p>
                        <p className="text-xs text-red-600">{result.error}</p>
                      </div>
                    ))}
                </div>
              </ScrollArea>
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
