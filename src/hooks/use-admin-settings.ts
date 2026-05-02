'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdminSetting {
  key: string;
  value: string;
  category: string;
  updated_at: string;
}

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

function getApiUrl(path: string): string {
  const token = getAdminToken();
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}token=${encodeURIComponent(token || '')}`;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/settings'));
      if (res.status === 401) {
        setAuthFailed(true);
        localStorage.removeItem('admin_token');
        window.location.replace('/admin/login');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSetting = useCallback((key: string): string => {
    const s = settings.find((s) => s.key === key);
    return s?.value || '';
  }, [settings]);

  const saveSettings = async (updates: Array<{ key: string; value: string }>) => {
    const res = await fetch(getApiUrl('/api/admin/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: updates }),
    });
    if (res.ok) {
      await fetchSettings();
    }
    return res.ok;
  };

  return { settings, loading, getSetting, saveSettings, refetch: fetchSettings, authFailed };
}
