'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { setAuthSession } from '@/utils/auth-fetch';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string | null;
  username?: string;
  nickname?: string;
  role: string;
  status?: string;
  canGenerate?: boolean;
  phone?: string;
  wechat?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  session: Session | null;
  supabase: SupabaseClient | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  login: (email: string) => Promise<{ error: string | null }>;
  sendOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  kickedMessage: string | null;
  clearKickedMessage: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  const { isLoading: configLoading } = useSupabaseConfig();
  const initRef = useRef(false);

  // Initialize Supabase client once config is ready
  useEffect(() => {
    if (configLoading || initRef.current) return;

    initRef.current = true;
    getSupabaseBrowserClientWithRetry()
      .then((client) => {
        setSupabase(client);
      })
      .catch((err) => {
        console.warn('[AuthProvider] Supabase client initialization failed:', err);
        setLoading(false);
      });
  }, [configLoading]);

  // Sync user info from backend (role, status, etc.)
  // Supports both Supabase Auth (x-session) and legacy Cookie session
  const syncUserProfile = useCallback(async (sbUser: { id: string; email?: string | null } | null) => {
    try {
      // Try Supabase Auth session first
      let token: string | undefined;
      if (sbUser) {
        const client = await getSupabaseBrowserClientWithRetry();
        const { data: { session: currentSession } } = await client.auth.getSession();
        token = currentSession?.access_token;
      }

      const headers: Record<string, string> = {};
      if (token) headers['x-session'] = token;

      const res = await fetch('/api/auth/me', { headers });
      const data = await res.json();

      if (data.user) {
        setUser(data.user);
        if (data.user.status === 'rejected') {
          setKickedMessage('您的账号已被禁用，请联系管理员');
        }
        return;
      }

      // No user from backend
      if (sbUser) {
        setUser({
          id: sbUser.id,
          email: sbUser.email ?? null,
          role: 'user',
          status: 'pending',
          canGenerate: false,
        });
      } else {
        setUser(null);
      }
    } catch {
      if (sbUser) {
        setUser({
          id: sbUser.id,
          email: sbUser.email ?? null,
          role: 'user',
          status: 'pending',
          canGenerate: false,
        });
      } else {
        setUser(null);
      }
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setAuthSession(initialSession);
      await syncUserProfile(initialSession?.user ?? null);
      // If no Supabase session, also try legacy cookie session
      if (!initialSession) {
        await syncUserProfile(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setAuthSession(newSession);
        if (event === 'SIGNED_IN' && newSession?.user) {
          await syncUserProfile(newSession.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, syncUserProfile]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      // No Supabase client, try legacy cookie session directly
      await syncUserProfile(null);
      return;
    }
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    setSession(currentSession);
    await syncUserProfile(currentSession?.user ?? null);
  }, [supabase, syncUserProfile]);

  const logout = useCallback(async () => {
    // Sign out from Supabase Auth
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Also clear legacy cookie session
    try {
      await fetch('/api/auth/logout', { method: 'DELETE', credentials: 'include' });
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);
  }, [supabase]);

  const login = useCallback(async (email: string) => {
    try {
      const client = await getSupabaseBrowserClientWithRetry();
      const { error } = await client.auth.signInWithOtp({ email });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '登录失败' };
    }
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    try {
      const client = await getSupabaseBrowserClientWithRetry();
      const { error } = await client.auth.signInWithOtp({ email });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '发送验证码失败' };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    try {
      const client = await getSupabaseBrowserClientWithRetry();
      const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '验证失败' };
    }
  }, []);

  const clearKickedMessage = useCallback(() => {
    setKickedMessage(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, session, supabase, logout, refresh, login, sendOtp, verifyOtp, kickedMessage, clearKickedMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
