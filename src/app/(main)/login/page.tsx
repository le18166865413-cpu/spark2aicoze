"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import { getSupabaseBrowserClientWithRetry } from "@/lib/supabase-browser";
import { useSupabaseConfig } from "@/lib/supabase-config-inject";

export default function LoginPage() {
  const router = useRouter();
  const { isLoading: configLoading } = useSupabaseConfig();

  // Email OTP state
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Listen for auth state changes (auto redirect after login)
  useEffect(() => {
    if (configLoading) return;

    let subscription: { unsubscribe: () => void } | null = null;

    getSupabaseBrowserClientWithRetry()
      .then((client) => {
        const { data } = client.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN") {
            router.push("/");
            router.refresh();
          }
        });
        subscription = data.subscription;
      })
      .catch(console.error);

    return () => {
      subscription?.unsubscribe();
    };
  }, [configLoading, router]);

  // Start countdown timer
  const startCountdown = useCallback(() => {
    setCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Send OTP to email
  const handleSendCode = useCallback(async () => {
    if (!email.trim()) {
      setError("请输入邮箱地址");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setError("");
    setSendingCode(true);

    try {
      const client = await getSupabaseBrowserClientWithRetry();
      const { error: otpError } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (otpError) throw otpError;
      setCodeSent(true);
      setSuccess("验证码已发送到您的邮箱");
      startCountdown();
    } catch (err: unknown) {
      setCountdown(0);
      const message = err instanceof Error ? err.message : "发送失败";
      if (message.includes("rate limit")) {
        setError("发送过于频繁，请稍后再试");
      } else if (message.includes("invalid email")) {
        setError("邮箱格式不正确");
      } else {
        setError(message);
      }
    } finally {
      setSendingCode(false);
    }
  }, [email, startCountdown]);

  // Verify OTP
  const handleVerifyOtp = useCallback(async () => {
    if (!email.trim()) {
      setError("请输入邮箱地址");
      return;
    }
    if (!code.trim() || code.trim().length !== 6) {
      setError("请输入6位验证码");
      return;
    }

    setError("");
    setVerifying(true);
    try {
      const client = await getSupabaseBrowserClientWithRetry();
      const { error: verifyError } = await client.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyError) throw verifyError;
      // Auth state change listener will handle redirect
      setSuccess("登录成功，正在跳转...");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "验证失败";
      if (message.includes("expired")) {
        setError("验证码已过期，请重新获取");
      } else if (message.includes("invalid")) {
        setError("验证码不正确");
      } else {
        setError(message);
      }
    } finally {
      setVerifying(false);
    }
  }, [email, code]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (codeSent) {
        handleVerifyOtp();
      } else {
        handleSendCode();
      }
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">登录</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            输入邮箱验证码即可登录，新邮箱自动注册
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center">
            {error}
          </div>
        )}

        {/* Success */}
        {success && !error && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm text-center">
            {success}
          </div>
        )}

        {/* Email OTP Login Form */}
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              邮箱地址
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={verifying}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              验证码
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="6位数字验证码"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(val);
                }}
                maxLength={6}
                disabled={verifying}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSendCode}
                disabled={countdown > 0 || sendingCode || !email.trim()}
                className="shrink-0 min-w-[120px]"
              >
                {sendingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : countdown > 0 ? (
                  `${countdown}秒后重试`
                ) : codeSent ? (
                  "重新获取"
                ) : (
                  "获取验证码"
                )}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleVerifyOtp}
            disabled={verifying || !email.trim() || code.trim().length !== 6}
            className="w-full"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                验证中...
              </>
            ) : (
              <>
                登录
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            新邮箱将自动注册账号，登录后即可使用
          </p>
        </div>
      </div>
    </div>
  );
}
