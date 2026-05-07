'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Sparkles, Eye, EyeOff, Clock, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
        router.push('/');
      } else {
        if (!nickname.trim()) {
          setError('请输入昵称');
          setLoading(false);
          return;
        }
        await register(username, password, nickname);
        setRegistered(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '操作失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Registration success - pending approval
  if (registered) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/15 ring-1 ring-yellow-500/30 mb-4">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">注册成功</h1>
          <p className="text-muted-foreground mb-6">
            你的账号已提交，请等待管理员审批后即可登录使用
          </p>
          <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm">账号信息已提交，审批通过后将收到通知</span>
            </div>
          </div>
          <button
            onClick={() => {
              setRegistered(false);
              setIsLogin(true);
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
            {isLogin ? '欢迎回来' : '加入我们'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isLogin ? '登录你的账号，继续创作' : '注册账号，开启创作之旅'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              required
              minLength={3}
              maxLength={20}
              className="w-full h-11 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-medium">昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
          >
            {loading ? '请稍候...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        {/* Toggle */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          {isLogin ? (
            <>
              还没有账号？
              <button
                onClick={() => { setIsLogin(false); setError(''); }}
                className="text-primary font-semibold hover:underline ml-1"
              >
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button
                onClick={() => { setIsLogin(true); setError(''); }}
                className="text-primary font-semibold hover:underline ml-1"
              >
                立即登录
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
