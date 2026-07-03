'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { getSupabaseBrowser } from '@/utils/supabase-browser';
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

  // Initialize Supabase client (singleton, may be null if env vars missing)
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowser();
    } catch {
      console.warn('[AuthProvider] Supabase client initialization failed — auth features will be unavailable');
      return null;
    }
  }, []);

  // Sync user info from backend (role, status, etc.)
  const syncUserProfile = useCallback(async (sbUser: { id: string; email?: string | null } | null) => {
    if (!sbUser) {
      setUser(null);
      return;
    }
    if (!supabase) {
      // Supabase not configured — set basic profile from auth data
      setUser({
        id: sbUser.id,
        email: sbUser.email ?? null,
        role: 'user',
        status: 'pending',
        canGenerate: false,
      });
      return;
    }
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) {
        setUser(null);
        return;
      }
      const res = await fetch('/api/auth/me', {
        headers: { 'x-session': token },
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        // Check if user was kicked
        if (data.user.status === 'rejected') {
          setKickedMessage('您的账号已被禁用，请联系管理员');
        }
      } else {
        // Backend doesn't know this user yet — create a basic profile
        setUser({
          id: sbUser.id,
          email: sbUser.email ?? null,
          role: 'user',
          status: 'pending',
          canGenerate: false,
        });
      }
    } catch {
      setUser({
        id: sbUser.id,
        email: sbUser.email ?? null,
        role: 'user',
        status: 'pending',
        canGenerate: false,
      });
    }
  }, [supabase]);

  // Listen for auth state changes
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setAuthSession(initialSession);
      syncUserProfile(initialSession?.user ?? null);
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
    if (!supabase) return;
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    setSession(currentSession);
    await syncUserProfile(currentSession?.user ?? null);
  }, [supabase, syncUserProfile]);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [supabase]);

  const login = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Supabase 未配置' };
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '登录失败' };
    }
  }, [supabase]);

  const sendOtp = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Supabase 未配置' };
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '发送验证码失败' };
    }
  }, [supabase]);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    if (!supabase) return { error: 'Supabase 未配置' };
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '验证失败' };
    }
  }, [supabase]);

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
