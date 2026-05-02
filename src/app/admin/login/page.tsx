'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('[Login] Starting login...');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      console.log('[Login] Response status:', res.status);

      const data = await res.json();
      console.log('[Login] Response data:', data);

      if (data.success && data.token) {
        console.log('[Login] Login successful, token:', data.token.substring(0, 16) + '...');
        
        // 存储 token 到 localStorage
        try {
          localStorage.setItem('admin_token', data.token);
          console.log('[Login] Token stored to localStorage');
        } catch (storageErr) {
          console.error('[Login] Failed to store token:', storageErr);
        }

        // 尝试多种跳转方法，适配 iframe 环境
        console.log('[Login] Attempting redirect...');
        
        // 方法1: 当前窗口跳转
        try {
          window.location.href = '/admin';
          console.log('[Login] window.location.href set to /admin');
        } catch (err1) {
          console.error('[Login] window.location.href failed:', err1);
          
          // 方法2: iframe 中的 parent 跳转
          try {
            (window as any).parent.location.href = '/admin';
            console.log('[Login] window.parent.location.href set to /admin');
          } catch (err2) {
            console.error('[Login] window.parent.location.href failed:', err2);
            
            // 方法3: iframe 中的 top 跳转
            try {
              (window as any).top.location.href = '/admin';
              console.log('[Login] window.top.location.href set to /admin');
            } catch (err3) {
              console.error('[Login] All redirect methods failed:', err3);
              setError('跳转失败，请手动刷新页面');
            }
          }
        }
      } else {
        console.log('[Login] Login failed, data:', data);
        setError(data.error || '登录失败');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SparkAI 管理后台</h1>
          <p className="text-muted-foreground text-sm mt-1">请输入管理员凭据登录</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="请输入用户名"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="请输入密码"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
