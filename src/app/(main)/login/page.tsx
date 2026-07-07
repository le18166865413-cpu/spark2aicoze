'use client';

/**
 * ⚠️ 重要说明 - 手机登录方式固定使用 Supabase Auth，禁止改动
 * 
 * 手机号登录必须使用 Supabase Auth 内置短信服务 (signInWithOtp + verifyOtp)
 * 这样用户能收到【扣子】发送的短信验证码
 * 
 * 不要改用自定义的 /api/auth/send-phone-code 等接口，否则短信无法发送
 * 
 * 数据同步：Supabase Auth (auth.users) → public.users (业务表)
 * 同步代码位置：/api/auth/me/route.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { supabase } = useAuth();

  // Tab state: 'phone' | 'email'
  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');

  // Phone login state
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneCountdown, setPhoneCountdown] = useState(0);

  // Email login state
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailCountdown, setEmailCountdown] = useState(0);

  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown cleanup
  useEffect(() => {
    return () => {
      if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
      if (emailTimerRef.current) clearInterval(emailTimerRef.current);
    };
  }, []);

  const startPhoneCountdown = useCallback(() => {
    setPhoneCountdown(60);
    if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
    phoneTimerRef.current = setInterval(() => {
      setPhoneCountdown((prev) => {
        if (prev <= 1) {
          if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startEmailCountdown = useCallback(() => {
    setEmailCountdown(60);
    if (emailTimerRef.current) clearInterval(emailTimerRef.current);
    emailTimerRef.current = setInterval(() => {
      setEmailCountdown((prev) => {
        if (prev <= 1) {
          if (emailTimerRef.current) clearInterval(emailTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendPhoneCode = async () => {
    if (!phone || phone.length < 11) {
      setError('请输入有效的手机号');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      if (!supabase) { setError('系统初始化中，请稍后'); return; }
      console.log('[Login] Sending SMS OTP to:', phone);
      // 使用 Supabase Auth 发送短信验证码
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: '+86' + phone,
      });
      console.log('[Login] SMS OTP response:', { error: sendError?.message });
      if (sendError) {
        setError(sendError.message || '发送验证码失败');
        return;
      }
      startPhoneCountdown();
    } catch (e) {
      console.error('[Login] Send SMS OTP error:', e);
      setError('发送验证码失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmailCode = async () => {
    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      console.log('[Login] Sending email code via custom SMTP to:', email);
      const res = await fetch('/api/auth/send-phone-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      console.log('[Login] Email code response:', data);
      if (!res.ok) {
        setError(data.error || '发送验证码失败');
        return;
      }
      startEmailCountdown();
    } catch (e) {
      console.error('[Login] Send email code error:', e);
      setError('发送验证码失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      setError('请输入6位验证码');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      if (!supabase) { setError('系统初始化中，请稍后'); return; }
      console.log('[Login] Verifying phone OTP:', phone, phoneOtp);
      // 使用 Supabase Auth 验证短信验证码
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: '+86' + phone,
        token: phoneOtp,
        type: 'sms',
      });
      console.log('[Login] Phone OTP verify response:', { 
        user: data?.user?.id, 
        session: data?.session?.access_token ? 'yes' : 'no',
        error: verifyError?.message 
      });
      if (verifyError) {
        setError(verifyError.message || '验证码错误或已过期');
        return;
      }
      // 登录成功，刷新页面以让 AuthProvider 获取用户信息
      window.location.href = '/';
    } catch (e) {
      console.error('[Login] Phone login error:', e);
      setError('登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setError('请输入6位验证码');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, emailCode: emailOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '登录失败，请稍后重试');
        return;
      }
      // 登录成功，刷新页面以让 AuthProvider 获取用户信息
      window.location.href = '/';
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Spark2AI
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              欢迎回来，请选择登录方式
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Tabs */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => {
                setActiveTab('phone');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'phone'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              手机号登录
            </button>
            <button
              onClick={() => {
                setActiveTab('email');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'email'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              邮箱登录
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive text-center bg-destructive/10 rounded-lg py-2">
              {error}
            </div>
          )}

          {/* Phone Login */}
          {activeTab === 'phone' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <div className="flex">
                  <div className="flex items-center px-3 bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">
                    +86
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="rounded-l-none"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-otp">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="phone-otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="请输入6位验证码"
                    value={phoneOtp}
                    onChange={(e) =>
                      setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button
                    variant="outline"
                    onClick={handleSendPhoneCode}
                    disabled={isLoading || phoneCountdown > 0 || !phone}
                    className="min-w-[110px] whitespace-nowrap"
                  >
                    {phoneCountdown > 0 ? `${phoneCountdown}s` : '获取验证码'}
                  </Button>
                </div>
              </div>

              <Button
                onClick={handlePhoneLogin}
                disabled={isLoading || !phone || !phoneOtp}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录 / 注册'
                )}
              </Button>
            </div>
          )}

          {/* Email Login */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-otp">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="email-otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="请输入6位验证码"
                    value={emailOtp}
                    onChange={(e) =>
                      setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button
                    variant="outline"
                    onClick={handleSendEmailCode}
                    disabled={isLoading || emailCountdown > 0 || !email}
                    className="min-w-[110px] whitespace-nowrap"
                  >
                    {emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码'}
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleEmailLogin}
                disabled={isLoading || !email || !emailOtp}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
