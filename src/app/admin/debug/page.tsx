'use client';

import React, { useEffect, useState } from 'react';

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        // Check /api/auth/me
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        const meData = await meRes.json();

        // Get cookies
        const cookies = document.cookie.split(';').map(c => c.trim());

        setDebugInfo({
          me: meData,
          cookies: cookies,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        setDebugInfo({ error: String(error) });
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">认证调试页面</h1>

      <div className="space-y-6">
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">当前登录用户 (/api/auth/me)</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">快速操作</h2>
          <div className="space-x-4">
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'DELETE', credentials: 'include' });
                window.location.href = '/admin/login';
              }}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              退出登录
            </button>
            <a
              href="/admin/login"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block"
            >
              去登录页面
            </a>
          </div>
        </div>

        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2 text-yellow-800">提示</h2>
          <ul className="list-disc pl-5 text-yellow-800 space-y-1">
            <li>管理员账号: <strong>admin</strong></li>
            <li>管理员密码: <strong>666666</strong></li>
            <li>如果当前显示的用户不是 admin，请先退出再用 admin 账号登录</li>
          </ul>
        </div>
      </div>
    </div>
  );
}