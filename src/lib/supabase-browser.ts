import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

async function fetchConfig(): Promise<{ url: string; anonKey: string }> {
  const res = await fetch('/api/supabase-config');
  if (!res.ok) {
    throw new Error('Failed to fetch Supabase config');
  }
  return res.json();
}

async function initClient(): Promise<SupabaseClient> {
  const { url, anonKey } = await fetchConfig();
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Get the singleton Supabase browser client.
 * On first call, fetches config from /api/supabase-config and creates the client.
 * Subsequent calls return the same instance immediately.
 */
async function getSupabaseBrowserClient(): Promise<SupabaseClient> {
  if (browserClient) return browserClient;

  if (!initPromise) {
    initPromise = initClient().then((client) => {
      browserClient = client;
      return client;
    }).catch((err) => {
      initPromise = null; // Allow retry on failure
      throw err;
    });
  }

  return initPromise;
}

export { getSupabaseBrowserClient };

// Legacy aliases
export const getSupabaseBrowser = getSupabaseBrowserClient;
export const getSupabaseBrowserClientAsync = getSupabaseBrowserClient;
export const getSupabaseBrowserClientWithRetry = getSupabaseBrowserClient;
