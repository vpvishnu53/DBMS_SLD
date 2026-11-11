'use client';
/**
 * Thin fetch wrapper for the SLMS REST API (proxied via next.config rewrites).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const TOKEN_KEY = 'slms.token';
const USER_KEY = 'slms.user';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function safeGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export const session = {
  token: () => safeGet(TOKEN_KEY),
  user: () => {
    try { return JSON.parse(safeGet(USER_KEY) || 'null'); } catch { return null; }
  },
  save(token, user) {
    try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
  },
};

export async function api(path, { method = 'GET', body, signal } = {}) {
  const token = session.token();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the API server. Is the backend running on port 5000?');
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token) {
    session.clear();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login'))
      window.location.href = '/login?expired=1';
  }
  if (!res.ok) {
    const msg = data?.error || (res.status >= 500 ? 'Server error — check the API / Oracle connection.' : res.statusText);
    throw new ApiError(res.status, msg, data?.details);
  }
  return data;
}

/** GET with loading/error state. Pass null path to skip. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const [nonce, setNonce] = useState(0);
  const ctrl = useRef(null);

  useEffect(() => {
    if (!path) { setState({ data: null, error: null, loading: false }); return undefined; }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { signal: c.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ data: null, error, loading: false }); });
    return () => c.abort();
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
