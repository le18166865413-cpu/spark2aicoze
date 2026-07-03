/**
 * Auth-aware fetch utility.
 * Token is set by AuthProvider via setAuthToken() on auth state change.
 * This avoids async client initialization timing issues.
 */
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

export function authFetch(
  input: string | URL | RequestInfo,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (_authToken && !headers.has('x-session')) {
    headers.set('x-session', _authToken);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}

/**
 * Returns auth headers for SSE/fetch stream requests that don't use authFetch().
 */
export function getAuthHeaders(): Record<string, string> {
  return _authToken ? { 'x-session': _authToken } : {};
}
