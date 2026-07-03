/**
 * Auth-aware fetch utility
 * Automatically adds x-session header when user is logged in via Supabase Auth
 */

let _session: { access_token: string } | null = null;

export function setAuthSession(session: { access_token: string } | null) {
  _session = session;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (_session?.access_token) {
    headers['x-session'] = _session.access_token;
  }
  return headers;
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const authHeaders = getAuthHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }
  return fetch(url, { ...options, headers });
}
