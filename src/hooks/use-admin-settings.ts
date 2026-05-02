'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdminSetting {
  key: string;
  value: string;
  category?: string;
  updated_at?: string;
}

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

function getApiUrl(path: string): string {
  const token = getAdminToken();
  const separator = path.includes('?') ? '&' : '?';
  return token ? `${path}${separator}token=${encodeURIComponent(token)}` : path;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const token = getAdminToken();
      if (!token) {
        setAuthFailed(true);
        setLoading(false);
        return;
      }

      const res = await fetch(getApiUrl('/api/admin/settings'));
      if (res.status === 401) {
        setAuthFailed(true);
        localStorage.removeItem('admin_token');
        window.location.replace('/admin/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
      setAuthFailed(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const getSetting = useCallback((key: string, defaultValue: string = ''): string => {
    const setting = settings.find((s) => s.key === key);
    return setting ? setting.value : defaultValue;
  }, [settings]);

  const saveSettings = useCallback(async (newSettings: Array<{ key: string; value: string; category?: string }>): Promise<void> => {
    try {
      const token = getAdminToken();
      if (!token) {
        setAuthFailed(true);
        localStorage.removeItem('admin_token');
        window.location.replace('/admin/login');
        return;
      }

      const res = await fetch(getApiUrl('/api/admin/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (res.status === 401) {
        setAuthFailed(true);
        localStorage.removeItem('admin_token');
        window.location.replace('/admin/login');
        return;
      }

      if (!res.ok) throw new Error('Failed to save settings');
      await fetchSettings();
    } catch (error) {
      throw error;
    }
  }, [fetchSettings]);

  const refetch = useCallback(() => {
    setLoading(true);
    setAuthFailed(false);
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    getSetting,
    saveSettings,
    refetch,
  };
}
