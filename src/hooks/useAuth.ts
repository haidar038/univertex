import { useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildDeviceFingerprint } from '@/lib/device';
import { revokeSessionByHash, isCurrentSessionRevoked } from '@/lib/sessions';
import { logAudit } from '@/lib/audit';

// Keep the local role type narrow. We only enumerate the values we already
// use in the app; the database enum is wider (committee, observer) and the
// `roles` array just passes those strings through.
export type AppRole = 'admin' | 'voter' | 'candidate' | 'committee' | 'observer';

export interface Profile {
  id: string;
  full_name: string;
  student_id: string;
  department: string | null;
  class_id: string | null;
  roles: AppRole[];
}

/**
 * Compute the dashboard URL for a given profile. Centralised so that the
 * confirmation-email redirect, the regular login, and the index page all
 * agree on where to send the user.
 */
export function dashboardPathFor(profile: Profile | null): string {
  if (!profile) return '/login';
  if (profile.roles.includes('admin')) return '/admin/dashboard';
  if (profile.roles.includes('committee')) return '/committee';
  if (profile.roles.includes('observer')) return '/observer';
  return '/app/dashboard';
}

// Recovery links create a temporary authenticated session.  Do not treat the
// reset page as a redirect target: the user must first submit their new
// password there.  Account-confirmation links still land on `/` and are sent
// to the role-appropriate dashboard after the profile is available.
const PUBLIC_PATHS = new Set(['/', '/login', '/signup']);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Refs used to ensure side effects only fire once per relevant event.
  // Without these we end up in an infinite render loop: profile arrives -> we
  // call navigate() -> location.pathname changes -> effect re-runs -> repeat.
  const redirectingRef = useRef(false);
  const profileInflightRef = useRef(false);

  // Listen for auth state changes ONCE on mount. The handler is the single
  // place that decides when to fetch the profile and when to fire the
  // session / audit side effects.
  useEffect(() => {
    let cancelled = false;
    let initialised = false;

    const handleSession = async (currentSession: { user: User | null } | null) => {
      if (cancelled) return;
      const currentUser = currentSession?.user ?? null;

      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Only fetch the profile once per user id change. Without this guard
      // every re-render would re-issue the query, and the Supabase realtime
      // channel would push the same profile back into state, causing the
      // useEffect in Login (and ours below) to fire again.
      if (profileInflightRef.current) return;
      profileInflightRef.current = true;
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (cancelled) return;
        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setProfile(null);
          return;
        }

        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id);

        if (cancelled) return;
        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        }

        const roles = (rolesData || []).map(
          (r) => r.role as AppRole
        );

        setProfile({ ...profileData, roles } as Profile);
      } catch (error) {
        if (!cancelled) {
          console.error('Unexpected error fetching profile:', error);
          setProfile(null);
        }
      } finally {
        profileInflightRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      initialised = true;
      handleSession(session);
    });

    // Subscribe to auth state changes. We DO NOT call handleSession on every
    // event automatically - the caller (Login, AcceptInvite, etc.) is
    // responsible for triggering it via the returned `refresh` function
    // when they explicitly want to react to a new sign-in. This is what
    // breaks the previous infinite loop.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (!initialised) return; // Wait for the first getSession() to settle.
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        // TOKEN_REFRESHED is silent - we keep the same profile.
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          handleSession(session);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // After the profile loads, if we are on a public path (e.g. the user landed
  // on "/" after an email confirmation link) we send them to the correct
  // dashboard. We use a ref guard to ensure we only redirect ONCE per
  // (profile.id, pathname) combination, otherwise the navigate() call would
  // change location.pathname, retrigger the effect, and loop.
  useEffect(() => {
    if (loading || !profile || !user) return;
    if (redirectingRef.current) return;
    if (!PUBLIC_PATHS.has(location.pathname)) return;

    redirectingRef.current = true;
    const target = dashboardPathFor(profile);
    navigate(target, { replace: true });

    // Allow another redirect after a short delay so that subsequent sign-in
    // flows still work, but we don't loop within the same render.
    const t = window.setTimeout(() => {
      redirectingRef.current = false;
    }, 500);
    return () => window.clearTimeout(t);
  }, [loading, profile, user, location.pathname, navigate]);

  const refresh = async (): Promise<Profile | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // P0-03: cek revoke dulu sebelum fetch profile. Best-effort: false jika
      // RPC belum ada (migration belum apply) -> lanjut normal.
      try {
        if (await isCurrentSessionRevoked()) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          navigate('/login', { replace: true });
          return null;
        }
      } catch {
        // ignore -> lanjut fetch profile normal
      }
      profileInflightRef.current = false;
      setLoading(true);
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
      subscription.unsubscribe();
      // Re-run the session handler inline.
      setUser(session.user);
      try {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id);
        const roles = (rolesData || []).map((r) => r.role as AppRole);
        const freshProfile = profileData ? ({ ...profileData, roles } as Profile) : null;
        setProfile(freshProfile);
        return freshProfile;
      } finally {
        setLoading(false);
      }
    }
    return null;
  };

  const signOut = async () => {
    try {
      // Audit while the session is still valid - auth.logout must land in
      // audit_log BEFORE the token is destroyed by signOut().
      await logAudit({
        action: 'auth.logout',
        description: 'User logged out',
        category: 'auth',
      }).catch(() => undefined);

      // Revoke this device's session row by its fingerprint HASH (the old
      // code passed the hash to the by-id RPC, which matched 0 rows).
      try {
        const fp = await buildDeviceFingerprint();
        await revokeSessionByHash(fp.hash, 'user_logout').catch(() => undefined);
      } catch {
        // ignore
      }
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      redirectingRef.current = false;
      window.location.href = '/login';
    }
  };

  return {
    user,
    profile,
    loading,
    refresh,
    signOut,
    isAdmin: profile?.roles.includes('admin') || false,
    isVoter: profile?.roles.includes('voter') || false,
    isCandidate: profile?.roles.includes('candidate') || false,
    isCommittee: profile?.roles.includes('committee') || false,
    isObserver: profile?.roles.includes('observer') || false,
  };
}
