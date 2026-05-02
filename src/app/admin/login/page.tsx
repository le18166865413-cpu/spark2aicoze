'use client';

import { useEffect } from 'react';

export default function AdminLoginPage() {
  useEffect(() => {
    window.location.href = '/admin';
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">正在跳转到管理后台...</p>
      </div>
    </div>
  );
}
