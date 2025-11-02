import { supabase } from '@/integrations/supabase/client';

/**
 * Get the display URL for a candidate's photo
 * Prioritizes storage path over external photo_url
 */
export function getCandidatePhotoUrl(
  photoStoragePath?: string | null,
  photoUrl?: string | null
): string | null {
  // If there's a storage path, get the public URL
  if (photoStoragePath) {
    const { data } = supabase.storage
      .from('candidate-photos')
      .getPublicUrl(photoStoragePath);
    return data.publicUrl;
  }

  // Fall back to external URL
  if (photoUrl) {
    return photoUrl;
  }

  return null;
}

/**
 * Get candidate status badge info
 */
export function getCandidateStatusInfo(status: 'pending' | 'approved' | 'rejected') {
  switch (status) {
    case 'approved':
      return {
        label: 'Disetujui',
        variant: 'success' as const,
        description: 'Profil kandidat telah disetujui dan akan tampil di pemilihan'
      };
    case 'rejected':
      return {
        label: 'Ditolak',
        variant: 'destructive' as const,
        description: 'Profil kandidat ditolak dan tidak akan tampil di pemilihan'
      };
    case 'pending':
    default:
      return {
        label: 'Menunggu Persetujuan',
        variant: 'warning' as const,
        description: 'Profil kandidat sedang menunggu persetujuan admin'
      };
  }
}
