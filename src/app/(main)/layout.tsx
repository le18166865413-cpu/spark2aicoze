"use client";

import Navbar from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function KickedNotification() {
  const { kickedMessage, clearKickedMessage, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (kickedMessage && !user) {
      const timer = setTimeout(() => {
        clearKickedMessage();
        router.push("/login");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [kickedMessage, user, clearKickedMessage, router]);

  if (!kickedMessage || !kickedMessage.length) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">账号在其他设备登录</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-4">{kickedMessage}</p>
        <button
          onClick={() => {
            clearKickedMessage();
            router.push("/login");
          }}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          重新登录
        </button>
      </div>
    </div>
  );
}

function NicknameGuide() {
  const { user, refresh, session } = useAuth();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 当用户已登录但没有昵称时，显示引导
    if (user && !user.nickname) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [user]);

  if (!show || !user) return null;

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["x-session"] = session.access_token;
      }
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ nickname: trimmed }),
      });
      if (res.ok) {
        await refresh();
        setShow(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "保存失败，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">设置你的昵称</h3>
            <p className="text-sm text-muted-foreground">让其他用户认识你</p>
          </div>
        </div>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="输入你的昵称"
          maxLength={20}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2"
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <button
          onClick={handleSave}
          disabled={!nickname.trim() || saving}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "保存中..." : "确认"}
        </button>
      </div>
    </div>
  );
}

function PendingStatusBanner() {
  const { user } = useAuth();

  if (!user || user.status !== "pending") return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center">
      <p className="text-sm text-amber-700 dark:text-amber-300">
        你的账号正在审核中，审核通过后即可使用生图功能，如有疑问请联系 18166865413
      </p>
    </div>
  );
}

function RejectedStatusBanner() {
  const { user, logout } = useAuth();

  if (!user || user.status !== "rejected") return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2 text-center">
      <p className="text-sm text-red-700 dark:text-red-300">
        你的账号审核未通过，如有疑问请联系 18166865413
      </p>
      <button
        onClick={logout}
        className="text-xs text-red-600 dark:text-red-400 underline mt-1"
      >
        退出登录
      </button>
    </div>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <KickedNotification />
      <NicknameGuide />
      <Navbar />
      <PendingStatusBanner />
      <RejectedStatusBanner />
      <main className="bg-gradient-page min-h-screen">{children}</main>
    </>
  );
}
