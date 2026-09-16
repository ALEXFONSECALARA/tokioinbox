import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface RestaurantAccess {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  roleKey: string;
}

export interface AuthProfile {
  id: string;
  user_type: 'staff' | 'customer';
  full_name: string;
  phone: string | null;
  is_super_admin: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: AuthProfile | null;
  restaurants: RestaurantAccess[];
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  loginStaffOrCustomer: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * FASE 3 — Substitui o hack de "Alt+A entra no admin". Quem decide se você
 * vê o /admin, o /operacao (e o quê dentro dele) é: (1) ter uma sessão válida
 * do Supabase Auth, e (2) o que a API /api/v2/me devolve sobre seu perfil e
 * seus vínculos de restaurante — nunca um atalho de teclado ou query string.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/v2/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      setProfile(null);
      setRestaurants([]);
      return;
    }
    const data = await res.json();
    setProfile(data.profile);
    setRestaurants(
      (data.restaurants ?? []).map((r: any) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        logoUrl: r.logoUrl ?? r.logo_url ?? null,
        roleKey: r.roleKey ?? 'desconhecido',
      }))
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        fetchMe(data.session.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchMe(newSession.access_token);
      } else {
        setProfile(null);
        setRestaurants([]);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchMe]);

  const loginStaffOrCustomer = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRestaurants([]);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await fetchMe(session.access_token);
  }, [session, fetchMe]);

  const value: AuthContextValue = {
    session,
    profile,
    restaurants,
    loading,
    isAuthenticated: Boolean(session && profile),
    isSuperAdmin: Boolean(profile?.is_super_admin),
    isStaff: profile?.user_type === 'staff',
    isCustomer: profile?.user_type === 'customer',
    loginStaffOrCustomer,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
