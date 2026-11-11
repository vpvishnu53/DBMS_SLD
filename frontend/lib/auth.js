'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, session } from './api';

const AuthContext = createContext(null);

export const homeFor = (user) =>
  !user ? '/login' : user.userType === 'CIVILIAN' ? '/citizen' : user.userType === 'COMPANY' ? '/contractor' : '/dashboard';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // localStorage is client-only: read it after mount to avoid hydration mismatch
  useEffect(() => {
    if (session.token()) setUser(session.user());
    setReady(true);
  }, []);

  const login = useCallback(async (username, password) => {
    const { token, user: u } = await api('/auth/login', { method: 'POST', body: { username, password } });
    session.save(token, u);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user: u } = await api('/auth/register', { method: 'POST', body: payload });
    session.save(token, u);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user, ready, login, register, logout,
    isAdmin: user?.userType === 'EMPLOYEE' && user?.role === 'ADMIN',
  }), [user, ready, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
