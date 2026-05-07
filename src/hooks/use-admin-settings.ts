'use client';

import { useState, useEffect, useCallback } from 'react';

interface Setting {
  key: string;
  value: string;
  category?: string;
  updated_at?: string;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      console.log('[useAdminSettings] Fetching settings...');
      const res = await fetch('/api/admin/settings', { credentials: 'include' });
      console.log('[useAdminSettings] Fetch response status:', res.status);
      if (!res.ok) {
        console.error('[useAdminSettings] Fetch failed:', res.status);
        throw new Error('获取设置失败');
      }
      const data = await res.json();
      console.log('[useAdminSettings] Fetch data:', data);
      setSettings(data || []);
    } catch (error) {
      console.error('[useAdminSettings] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSetting = useCallback((key: string, defaultValue: string = ''): string => {
    const setting = settings.find((s) => s.key === key);
    return setting?.value ?? defaultValue;
  }, [settings]);

  const saveSettings = useCallback(async (newSettings: { key: string; value: string; category?: string }[]) => {
    console.log('[useAdminSettings] Saving settings:', newSettings);
    try {
      console.log('[useAdminSettings] Sending request...');
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: newSettings }), // 包装在对象里
      });

      console.log('[useAdminSettings] Save response status:', res.status);
      
      if (!res.ok) {
        const text = await res.text();
        console.log('[useAdminSettings] Save failed, response:', text);
        throw new Error('保存失败');
      }
      
      const result = await res.json();
      console.log('[useAdminSettings] Save result:', result);
      
      await fetchSettings();
      console.log('[useAdminSettings] Save completed successfully');
    } catch (error) {
      console.error('[useAdminSettings] Save error:', error);
      throw error;
    }
  }, [fetchSettings]);

  const refetch = useCallback(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, getSetting, saveSettings, refetch };
}