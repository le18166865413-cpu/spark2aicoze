"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, KeyRound, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login, loginWithEmail, sendCode } = useAuth();
  const router = useRouter();

  // Email login state
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Password login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Tab state
  const [loginMode, setLoginMode] = useState<"email" | "password">("email");

  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Send verification code
  const handleSendCode = async () => {
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
    // Immediately start countdown to prevent double-click
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      await sendCode(email.trim());
      setCodeSent(true);
    } catch (err: unknown) {
      // Reset countdown on failure so user can retry
      clearInterval(timer);
      setCountdown(0);
      const message = err instanceof Error ? err.message : "发送失败";
      setError(message);
    } finally {
      setSendingCode(false);
    }
  };

  // Email code login
  const handleEmailLogin = async () => {
    if (!email.trim()) {
      setError("请输入邮箱地址");
      return;
    }
    if (!code.trim() || code.trim().length !== 6) {
      setError("请输入6位验证码");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), code.trim());
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "登录失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Password login
  const handlePasswordLogin = async () => {
    if (!username.trim()) {
      setError("请输入账号");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "登录失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (loginMode === "email") handleEmailLogin();
      else handlePasswordLogin();
    }
  };

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

        {/* Mode Tabs */}
        <div className="flex mb-6 bg-muted/50 rounded-lg p-1">
          <button
            onClick={() => { setLoginMode("email"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
              loginMode === "email"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="w-4 h-4" />
            邮箱验证码登录
          </button>
          <button
            onClick={() => { setLoginMode("password"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
              loginMode === "password"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            账号密码登录
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center">
            {error}
          </div>
        )}

        {/* Email Login Form */}
        {loginMode === "email" && (
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                邮箱地址
              </label>
              <Input
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
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
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || sendingCode || !email.trim()}
                  className="shrink-0 min-w-[120px]"
                >
                  {sendingCode
                    ? "发送中..."
                    : countdown > 0
                      ? `${countdown}秒后重试`
                      : codeSent
                        ? "重新获取"
                        : "获取验证码"}
                </Button>
              </div>
            </div>

            <Button
              onClick={handleEmailLogin}
              disabled={loading || !email.trim() || code.trim().length !== 6}
              className="w-full"
            >
              {loading ? "登录中..." : "登录"}
              {!loading && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              新邮箱将自动注册，注册后需管理员审核通过方可使用生图功能
            </p>
          </div>
        )}

        {/* Password Login Form */}
        {loginMode === "password" && (
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                账号
              </label>
              <Input
                type="text"
                placeholder="请输入账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                密码
              </label>
              <Input
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              onClick={handlePasswordLogin}
              disabled={loading || !username.trim() || !password}
              className="w-full"
            >
              {loading ? "登录中..." : "登录"}
              {!loading && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              仅限已有账号的用户使用此方式登录
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
