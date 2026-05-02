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
      console.log('[useAdminSettings] Fetching settings...');
      const res = await fetch('/api/admin/settings');
      console.log('[useAdminSettings] Fetch response status:', res.status);
      const data = await res.json();
      console.log('[useAdminSettings] Fetch data:', data);
      if (Array.isArray(data)) {
        setSettings(data);
      }
    } catch (error) {
      console.error('[useAdminSettings] Fetch settings error:', error);
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
      console.log('[useAdminSettings] Saving settings:', settingsToSave);
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      });

      console.log('[useAdminSettings] Save response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[useAdminSettings] Save failed, response:', errorText);
        throw new Error('保存失败');
      }

      const result = await res.json();
      console.log('[useAdminSettings] Save result:', result);
      await fetchSettings();
    } catch (error) {
      console.error('[useAdminSettings] Save settings error:', error);
      throw error;
    }
  }, [fetchSettings]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, getSetting, saveSettings, refetch };
}