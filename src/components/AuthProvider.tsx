'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { setAuthToken } from '@/utils/auth-fetch';

export interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  nickname?: string | null;
  role: string;
  status: string;
  canGenerate: boolean;
  username?: string | null;
  avatar?: string | null;
  wechat?: string | null;
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

  // Use ref to hold supabase client — avoids stale closure issues
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const [supabase, setSupabaseState] = useState<SupabaseClient | null>(null);

  // Fetch user profile from /api/auth/me using the access token from the session
  const fetchUserProfile = useCallback(async (sess: Session | null) => {
    try {
      const headers: Record<string, string> = {};
      if (sess?.access_token) {
        headers['x-session'] = sess.access_token;
      }
      const res = await fetch('/api/auth/me', { headers, credentials: 'include' });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else if (sess?.user) {
        // Backend didn't return a user — set minimal placeholder
        setUser({
          id: sess.user.id,
          email: sess.user.email ?? null,
          phone: sess.user.phone ?? null,
          nickname: null,
          role: 'user',
          status: 'pending',
          canGenerate: false,
        });
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error('[AuthProvider] fetchUserProfile error:', e);
      if (sess?.user) {
        setUser({
          id: sess.user.id,
          email: sess.user.email ?? null,
          phone: sess.user.phone ?? null,
          nickname: null,
          role: 'user',
          status: 'pending',
          canGenerate: false,
        });
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize: get singleton Supabase client and set up auth listener
  useEffect(() => {
    let mounted = true;

    getSupabaseBrowserClient()
      .then((client) => {
        if (!mounted) return;
        supabaseRef.current = client;
        setSupabaseState(client);

        // Listen for auth state changes
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, newSession) => {
          setSession(newSession);
          // Sync token to authFetch immediately (avoid async getSession timing issues)
          setAuthToken(newSession?.access_token || null);
          // Use newSession directly — no stale closure issue
          fetchUserProfile(newSession);
        });

        // Check existing session on mount
        client.auth.getSession().then(({ data: { session: existingSession } }) => {
          if (!mounted) return;
          setSession(existingSession);
          setAuthToken(existingSession?.access_token || null);
          if (existingSession?.user) {
            fetchUserProfile(existingSession);
          } else {
            // No Supabase session — try legacy cookie session
            fetchLegacyCookie();
          }
        }).catch(() => {
          fetchLegacyCookie();
        });

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      })
      .catch((err) => {
        console.warn('[AuthProvider] Supabase init failed:', err);
        fetchLegacyCookie();
      });

    async function fetchLegacyCookie() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (mounted && data.user) {
          setUser(data.user);
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const logout = useCallback(async () => {
    const client = supabaseRef.current;
    if (client) {
      try { await client.auth.signOut(); } catch { /* ignore */ }
    }
    try { await fetch('/api/auth/logout', { method: 'DELETE', credentials: 'include' }); } catch { /* ignore */ }
    setAuthToken(null);
    setUser(null);
    setSession(null);
  }, []);

  const sendOtp = useCallback(async (emailOrPhone: string, isPhone = false): Promise<{ error: string | null }> => {
    const client = supabaseRef.current;
    if (!client) return { error: '系统初始化中，请稍后重试' };
    try {
      const { error } = isPhone
        ? await client.auth.signInWithOtp({ phone: emailOrPhone })
        : await client.auth.signInWithOtp({ email: emailOrPhone });
      return { error: error?.message || null };
    } catch {
      return { error: '发送验证码失败，请稍后重试' };
    }
  }, []);

  const verifyOtp = useCallback(async (emailOrPhone: string, token: string, isPhone = false): Promise<{ error: string | null }> => {
    const client = supabaseRef.current;
    if (!client) return { error: '系统初始化中，请稍后重试' };
    try {
      const { error } = isPhone
        ? await client.auth.verifyOtp({ phone: emailOrPhone, token, type: 'sms' })
        : await client.auth.verifyOtp({ email: emailOrPhone, token, type: 'email' });
      return { error: error?.message || null };
    } catch {
      return { error: '验证失败，请稍后重试' };
    }
  }, []);

  const clearKickedMessage = useCallback(() => setKickedMessage(null), []);

  const refresh = useCallback(async () => {
    const client = supabaseRef.current;
    let currentSession: Session | null = null;
    if (client) {
      try {
        const { data } = await client.auth.getSession();
        currentSession = data.session;
      } catch { /* ignore */ }
    }
    await fetchUserProfile(currentSession);
  }, [fetchUserProfile]);

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
