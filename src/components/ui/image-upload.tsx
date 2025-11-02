import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, X, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageUploaded: (storagePath: string, publicUrl: string) => void;
  userId: string;
  disabled?: boolean;
  maxSizeMB?: number;
  folder?: string;
}

export function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  userId,
  disabled = false,
  maxSizeMB = 2,
  folder = 'candidate-photos'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`Ukuran file maksimal ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${userId}/${timestamp}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(folder)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(folder)
        .getPublicUrl(data.path);

      setPreviewUrl(publicUrl);
      onImageUploaded(data.path, publicUrl);
      toast.success('Foto berhasil diunggah');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error('Gagal mengunggah foto: ' + error.message);
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    setPreviewUrl(null);
    onImageUploaded('', '');
    toast.success('Foto dihapus');
  };

  return (
    <div className="space-y-4">
      <Label>Foto Kandidat</Label>

      <div className="flex flex-col items-center gap-4">
        {/* Image Preview */}
        <div className="relative">
          <div className={cn(
            "relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-2 border-dashed",
            previewUrl ? "border-primary" : "border-muted-foreground/25"
          )}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-16 w-16 text-muted-foreground" />
            )}
          </div>

          {/* Remove Button - positioned outside but visually on top */}
          {previewUrl && !disabled && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -right-2 -top-2 z-10 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-lg hover:bg-destructive/90 transition-colors"
              disabled={uploading}
              aria-label="Hapus foto"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Upload Button */}
        {!disabled && (
          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {previewUrl ? 'Ganti Foto' : 'Unggah Foto'}
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Format: JPG, PNG, atau GIF. Maksimal {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
