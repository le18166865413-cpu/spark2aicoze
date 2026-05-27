"use client";

import Navbar from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function KickedNotification() {
  const { kickedMessage, clearKickedMessage, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (kickedMessage && !user) {
      // 5 秒后自动关闭
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

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <KickedNotification />
      <Navbar />
      <main>{children}</main>
    </>
  );
}
