import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchMyAccount } from '@/domain/accounts/api';
import type { Account } from '@/domain/accounts/types';
import { fetchMyProfile } from './api';
import type { Profile } from './types';

type ActiveRole = 'creator' | 'student';

type AuthState = {
  /** True until the very first session + profile lookup finishes. */
  bootstrapping: boolean;
  session: Session | null;
  profile: Profile | null;
  /** The Creator tenant this user owns, or null if they're not a Creator. */
  account: Account | null;
  /** True once we've confirmed this identity is linked to at least one student invitation. */
  isStudent: boolean;
  /** Neither a Creator account nor a student invitation exists yet. */
  needsOnboarding: boolean;
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  refreshAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isStudent, setIsStudent] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [activeRoleState, setActiveRoleState] = useState<ActiveRole>('creator');

  const loadUserContext = useCallback(async (userId: string) => {
    const [profileResult, accountResult, invitationResult] = await Promise.all([
      fetchMyProfile(userId),
      fetchMyAccount(userId),
      supabase.from('invitations').select('id').eq('user_id', userId).limit(1),
    ]);

    setProfile(profileResult);
    setAccount(accountResult);
    setIsStudent(!!invitationResult.data && invitationResult.data.length > 0);
    setRoleLoaded(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        await loadUserContext(data.session.user.id);
      }
      if (mounted) setBootstrapping(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession) {
        await loadUserContext(nextSession.user.id);
      } else {
        setProfile(null);
        setAccount(null);
        setIsStudent(false);
        setRoleLoaded(false);
      }
      setBootstrapping(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadUserContext]);

  const refreshAccount = useCallback(async () => {
    if (!session) return;
    const nextAccount = await fetchMyAccount(session.user.id);
    setAccount(nextAccount);
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const nextProfile = await fetchMyProfile(session.user.id);
    setProfile(nextProfile);
  }, [session]);

  const activeRole: ActiveRole = account ? activeRoleState : 'student';
  const needsOnboarding = roleLoaded && !!profile && !profile.onboarding_completed;

  const value = useMemo<AuthState>(
    () => ({
      bootstrapping,
      session,
      profile,
      account,
      isStudent,
      needsOnboarding,
      activeRole,
      setActiveRole: setActiveRoleState,
      refreshAccount,
      refreshProfile,
    }),
    [bootstrapping, session, profile, account, isStudent, needsOnboarding, activeRole, refreshAccount, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
