import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/**
 * Auth-aware fetch utility.
 * Automatically adds x-session JWT header from the current Supabase session
 * (for Supabase Auth users) and sends credentials: 'include' (for cookie-based
 * admin/legacy sessions).
 */
export async function authFetch(
  input: string | URL | RequestInfo,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});

  // Attach x-session JWT if Supabase session exists
  try {
    const client = await getSupabaseBrowserClient();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (token && !headers.has('x-session')) {
      headers.set('x-session', token);
    }
  } catch {
    // Client not ready, proceed without JWT (may fall back to cookie)
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}

/**
 * Synchronous version — returns headers with x-session if already set up.
 * Prefer authFetch() which handles async token retrieval.
 */
export function getAuthHeadersSync(): Record<string, string> {
  return {};
}

export function setAuthSession(_session: unknown) {
  // No-op — authFetch now reads directly from Supabase client.
  // Kept for backward compatibility with any existing callers.
}
