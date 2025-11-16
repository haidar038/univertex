import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCandidatePhotoUrl, getCandidateStatusInfo } from '../candidate-helpers';
import { supabase } from '@/integrations/supabase/client';

describe('Candidate Helper Functions', () => {
  describe('getCandidatePhotoUrl', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return public URL when storage path is provided', () => {
      const mockPublicUrl = 'https://storage.supabase.co/bucket/photo.jpg';
      const mockStoragePath = 'candidate-photos/user-123/photo.jpg';

      const mockFrom = vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: mockPublicUrl },
        }),
      });

      vi.mocked(supabase).storage = {
        from: mockFrom,
      } as any;

      const result = getCandidatePhotoUrl(mockStoragePath, null);

      expect(result).toBe(mockPublicUrl);
      expect(mockFrom).toHaveBeenCalledWith('candidate-photos');
    });

    it('should return external photo URL when storage path is not provided', () => {
      const mockPhotoUrl = 'https://example.com/photo.jpg';

      const result = getCandidatePhotoUrl(null, mockPhotoUrl);

      expect(result).toBe(mockPhotoUrl);
    });

    it('should prioritize storage path over external URL', () => {
      const mockPublicUrl = 'https://storage.supabase.co/bucket/photo.jpg';
      const mockStoragePath = 'candidate-photos/user-123/photo.jpg';
      const mockPhotoUrl = 'https://example.com/photo.jpg';

      const mockFrom = vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: mockPublicUrl },
        }),
      });

      vi.mocked(supabase).storage = {
        from: mockFrom,
      } as any;

      const result = getCandidatePhotoUrl(mockStoragePath, mockPhotoUrl);

      expect(result).toBe(mockPublicUrl);
      expect(result).not.toBe(mockPhotoUrl);
    });

    it('should return null when both paths are null', () => {
      const result = getCandidatePhotoUrl(null, null);

      expect(result).toBeNull();
    });

    it('should return null when both paths are undefined', () => {
      const result = getCandidatePhotoUrl(undefined, undefined);

      expect(result).toBeNull();
    });

    it('should handle empty strings as falsy values', () => {
      const mockPhotoUrl = 'https://example.com/photo.jpg';
      const result = getCandidatePhotoUrl('', mockPhotoUrl);

      expect(result).toBe(mockPhotoUrl);
    });
  });

  describe('getCandidateStatusInfo', () => {
    it('should return correct info for approved status', () => {
      const result = getCandidateStatusInfo('approved');

      expect(result).toEqual({
        label: 'Disetujui',
        variant: 'success',
        description: 'Profil kandidat telah disetujui dan akan tampil di pemilihan',
      });
    });

    it('should return correct info for rejected status', () => {
      const result = getCandidateStatusInfo('rejected');

      expect(result).toEqual({
        label: 'Ditolak',
        variant: 'destructive',
        description: 'Profil kandidat ditolak dan tidak akan tampil di pemilihan',
      });
    });

    it('should return correct info for pending status', () => {
      const result = getCandidateStatusInfo('pending');

      expect(result).toEqual({
        label: 'Menunggu Persetujuan',
        variant: 'warning',
        description: 'Profil kandidat sedang menunggu persetujuan admin',
      });
    });

    it('should have consistent return types', () => {
      const approved = getCandidateStatusInfo('approved');
      const rejected = getCandidateStatusInfo('rejected');
      const pending = getCandidateStatusInfo('pending');

      // Check all have required properties
      [approved, rejected, pending].forEach((status) => {
        expect(status).toHaveProperty('label');
        expect(status).toHaveProperty('variant');
        expect(status).toHaveProperty('description');
        expect(typeof status.label).toBe('string');
        expect(typeof status.variant).toBe('string');
        expect(typeof status.description).toBe('string');
      });
    });

    it('should have unique labels for each status', () => {
      const approved = getCandidateStatusInfo('approved');
      const rejected = getCandidateStatusInfo('rejected');
      const pending = getCandidateStatusInfo('pending');

      const labels = [approved.label, rejected.label, pending.label];
      const uniqueLabels = new Set(labels);

      expect(uniqueLabels.size).toBe(3);
    });

    it('should have unique variants for each status', () => {
      const approved = getCandidateStatusInfo('approved');
      const rejected = getCandidateStatusInfo('rejected');
      const pending = getCandidateStatusInfo('pending');

      const variants = [approved.variant, rejected.variant, pending.variant];
      const uniqueVariants = new Set(variants);

      expect(uniqueVariants.size).toBe(3);
    });
  });
});
