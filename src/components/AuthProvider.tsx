'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  nickname: string;
  role: 'user' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, code: string) => Promise<void>;
  sendCode: (email: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  kickedMessage: string | null;
  clearKickedMessage: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [prevUserId, setPrevUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      
      // 检测被踢：之前有用户，现在没了，且不是主动登出
      if (prevUserId && !data.user && data.kicked) {
        setKickedMessage('你的账号已在其他设备登录，如非本人操作请及时修改密码');
      }
      
      setUser(data.user || null);
      setPrevUserId(data.user?.id || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [prevUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 定期检查 session 有效性（每 30 秒）
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (!data.user && data.kicked) {
          setKickedMessage('你的账号已在其他设备登录，如非本人操作请及时修改密码');
        }
        setUser(data.user || null);
      } catch {
        // 忽略网络错误
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const clearKickedMessage = useCallback(() => {
    setKickedMessage(null);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    setUser(data.user || null);
    setPrevUserId(data.user?.id || null);
  };

  const loginWithEmail = async (email: string, code: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    setUser(data.user || null);
    setPrevUserId(data.user?.id || null);
  };

  const sendCode = async (email: string) => {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '发送失败');
  };

  const register = async (username: string, password: string, nickname: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, nickname }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    setUser(data.user);
    setPrevUserId(data.user?.id || null);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'DELETE', credentials: 'include' });
    setUser(null);
    setPrevUserId(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithEmail, sendCode, register, logout, refresh, kickedMessage, clearKickedMessage }}>
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
