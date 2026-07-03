'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  nickname?: string;
  role: string;
  status: string;
  canGenerate: boolean;
  username?: string;
  avatar?: string;
  wechat?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  supabase: SupabaseClient | null;
  login: () => void;
  logout: () => Promise<void>;
  sendOtp: (emailOrPhone: string, isPhone?: boolean) => Promise<{ error: string | null }>;
  verifyOtp: (emailOrPhone: string, token: string, isPhone?: boolean) => Promise<{ error: string | null }>;
  kickedMessage: string | null;
  clearKickedMessage: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const initRef = useRef(false);

  // Initialize Supabase client (singleton)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    getSupabaseBrowserClient()
      .then((client) => {
        setSupabase(client);

        // Listen for auth state changes
        client.auth.onAuthStateChange((_event, newSession) => {
          setSession(newSession);
          if (newSession?.user) {
            syncUserProfile(newSession.user.id, newSession.user.email, newSession.user.phone);
          } else {
            setUser(null);
            setLoading(false);
          }
        });

        // Check existing session
        client.auth.getSession().then(({ data: { session: existingSession } }) => {
          setSession(existingSession);
          if (existingSession?.user) {
            syncUserProfile(existingSession.user.id, existingSession.user.email, existingSession.user.phone);
          } else {
            checkLegacyCookieSession();
          }
        }).catch(() => {
          checkLegacyCookieSession();
        });
      })
      .catch((err) => {
        console.warn('[AuthProvider] Supabase init failed:', err);
        checkLegacyCookieSession();
      });
  }, []);

  const syncUserProfile = useCallback(async (supabaseUserId: string, email?: string, phone?: string) => {
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers['x-session'] = token;

      const res = await fetch('/api/auth/me', { headers });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else {
        // No user record yet, create minimal one
        setUser({
          id: supabaseUserId,
          email,
          phone,
          nickname: '',
          role: 'user',
          status: 'pending',
          canGenerate: false,
        });
      }
    } catch {
      setUser({
        id: supabaseUserId,
        email,
        phone,
        nickname: '',
        role: 'user',
        status: 'pending',
        canGenerate: false,
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const checkLegacyCookieSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const logout = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // ignore
    }
    try {
      await fetch('/api/auth/logout', { method: 'DELETE' });
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);
  }, [supabase]);

  const sendOtp = useCallback(async (emailOrPhone: string, isPhone = false): Promise<{ error: string | null }> => {
    if (!supabase) return { error: '系统初始化中，请稍后重试' };
    try {
      if (isPhone) {
        const { error } = await supabase.auth.signInWithOtp({ phone: emailOrPhone });
        return { error: error?.message || null };
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email: emailOrPhone });
        return { error: error?.message || null };
      }
    } catch {
      return { error: '发送验证码失败，请稍后重试' };
    }
  }, [supabase]);

  const verifyOtp = useCallback(async (emailOrPhone: string, token: string, isPhone = false): Promise<{ error: string | null }> => {
    if (!supabase) return { error: '系统初始化中，请稍后重试' };
    try {
      if (isPhone) {
        const { error } = await supabase.auth.verifyOtp({ phone: emailOrPhone, token, type: 'sms' });
        return { error: error?.message || null };
      } else {
        const { error } = await supabase.auth.verifyOtp({ email: emailOrPhone, token, type: 'email' });
        return { error: error?.message || null };
      }
    } catch {
      return { error: '验证失败，请稍后重试' };
    }
  }, [supabase]);

  const clearKickedMessage = useCallback(() => setKickedMessage(null), []);

  const refresh = useCallback(async () => {
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers['x-session'] = token;

      const res = await fetch('/api/auth/me', { headers });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
    } catch {
      // ignore
    }
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        supabase,
        login,
        logout,
        sendOtp,
        verifyOtp,
        kickedMessage,
        clearKickedMessage,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
