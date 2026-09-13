import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type PermissionKey =
  | 'election.view' | 'election.update' | 'election.publish' | 'election.delete' | 'election.transition'
  | 'candidate.view' | 'candidate.create' | 'candidate.review' | 'candidate.approve' | 'candidate.reject' | 'candidate.edit'
  | 'vote.cast' | 'vote.view' | 'vote.count' | 'vote.export'
  | 'voter.view' | 'voter.verify' | 'voter.manage'
  | 'committee.manage' | 'committee.view'
  | 'observer.manage' | 'observer.view'
  | 'audit.view' | 'audit.export'
  | 'user.create' | 'user.edit' | 'user.delete' | 'user.reset_password'
  | 'system.manage' | 'system.settings'
  | 'eligibility.manage';

export interface UsePermissionResult {
  has: boolean;
  loading: boolean;
}

export function usePermission(permission: PermissionKey | null | undefined): UsePermissionResult {
  const { profile } = useAuth();
  const [has, setHas] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!permission || !profile) {
      setHas(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .rpc('has_permission', { p_user_id: profile.id, p_permission: permission })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('usePermission RPC error', error);
          setHas(false);
        } else {
          setHas(Boolean(data));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, permission]);

  return { has, loading };
}
