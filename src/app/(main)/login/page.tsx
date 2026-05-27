'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Sparkles, Mail, KeyRound, ArrowRight, Shield } from 'lucide-react';

type LoginMode = 'email' | 'password';

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  // 验证码倒计时
  const [countdown, setCountdown] = useState(0);

  const { login, loginWithEmail, sendCode, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 倒计时效果
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 发送验证码
  const [sendingCode, setSendingCode] = useState(false);
  const handleSendCode = useCallback(async () => {
    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('邮箱格式不正确');
      return;
    }
    if (countdown > 0 || sendingCode) return;
    setError('');
    setSendingCode(true);
    // 立即开始倒计时，防止连点
    setCountdown(60);
    try {
      await sendCode(email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '发送失败';
      setError(message);
      // 发送失败时重置倒计时，允许重试
      setCountdown(0);
    } finally {
      setSendingCode(false);
    }
  }, [email, sendCode, countdown, sendingCode]);

  // 邮箱验证码登录
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }
    if (!code.trim()) {
      setError('请输入验证码');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email, code);
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 用户名密码登录
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        if (!nickname.trim()) {
          setError('请输入昵称');
          setLoading(false);
          return;
        }
        await register(username, password, nickname);
        setRegistered(true);
      } else {
        await login(username, password);
        const redirect = searchParams.get('redirect') || '/';
        router.push(redirect);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '操作失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 注册成功 - 待审批
  if (registered) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/15 ring-1 ring-yellow-500/30 mb-4">
            <Shield className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">注册成功</h1>
          <p className="text-muted-foreground mb-6">
            你的账号已提交，请等待管理员审批后即可登录使用
          </p>
          <button
            onClick={() => {
              setRegistered(false);
              setIsRegister(false);
              setError('');
            }}
            className="text-primary font-semibold hover:underline text-sm"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 ring-1 ring-primary/40 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            {mode === 'email' ? '欢迎回来' : isRegister ? '加入我们' : '欢迎回来'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {mode === 'email' ? '使用邮箱验证码快速登录' : isRegister ? '注册新账号' : '使用账号密码登录'}
          </p>
        </div>

        {/* 邮箱验证码登录 */}
        {mode === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">邮箱地址</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="请输入邮箱"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">验证码</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="6位验证码"
                    required
                    maxLength={6}
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || !email.trim() || sendingCode}
                  className="h-11 px-4 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            >
              {loading ? '登录中...' : (
                <span className="flex items-center justify-center gap-2">
                  登录 <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              新邮箱将自动注册并登录
            </p>
          </form>
        )}

        {/* 用户名密码登录/注册 */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">账号</label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="请输入账号"
                required
                minLength={3}
                maxLength={20}
                className="w-full h-11 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>

            {isRegister && (
              <div className="space-y-2">
                <label className="text-sm font-medium">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setError(''); }}
                  placeholder="请输入昵称"
                  required
                  minLength={1}
                  maxLength={20}
                  className="w-full h-11 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="请输入密码"
                  required
                  minLength={6}
                  className="w-full h-11 px-4 pr-11 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            >
              {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
            </button>

            {!isRegister && (
              <div className="text-center text-sm text-muted-foreground">
                还没有账号？
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(''); }}
                  className="text-primary font-semibold hover:underline ml-1"
                >
                  立即注册
                </button>
              </div>
            )}

            {isRegister && (
              <div className="text-center text-sm text-muted-foreground">
                已有账号？
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(''); }}
                  className="text-primary font-semibold hover:underline ml-1"
                >
                  立即登录
                </button>
              </div>
            )}
          </form>
        )}

        {/* 模式切换 */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setMode(mode === 'email' ? 'password' : 'email');
              setError('');
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === 'email' ? '使用账号密码登录' : '使用邮箱验证码登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
