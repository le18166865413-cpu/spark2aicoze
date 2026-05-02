'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SettingItem {
  key: string;
  value: string;
  category: string;
  updated_at: string;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSetting = useCallback((key: string, defaultValue: string = ''): string => {
    const item = settings.find(s => s.key === key);
    return item?.value ?? defaultValue;
  }, [settings]);

  const saveSettings = useCallback(async (settingsToSave: Array<{ key: string; value: string }>) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      });

      if (!res.ok) {
        throw new Error('保存失败');
      }

      await fetchSettings();
    } catch (error) {
      console.error('Save settings error:', error);
      throw error;
    }
  }, [fetchSettings]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, getSetting, saveSettings, refetch };
}
