import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface User {
  id: string; email: string; full_name: string; role: 'admin' | 'super_admin' | 'user' | 'technician' | 'auditor';
  totp_enabled: boolean; must_change_password: boolean; needs_term_acceptance: boolean;
  password_expires_days: number; password_days_left: number | null;
  avatar_url: string | null; display_name: string | null;
  cpf?: string | null;
  email_notifications: boolean; allowed_days: string;
  allowed_time_start: string; allowed_time_end: string;
  permissions?: Record<string, boolean>;
  group_ids?: string[];
}

interface Ctx {
  user: User | null; loading: boolean; inactivityLogout: boolean;
  login: (e: string, p: string, t?: string) => Promise<any>;
  logout: () => void; updateUser: () => Promise<void>; clearInactivity: () => void;
}

const AuthContext = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthContext);

const TIMEOUT = 15 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastAct, setLastAct] = useState(Date.now());
  const [inactivityLogout, setInactivityLogout] = useState(false);

  const logout = useCallback(() => {
    try { api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null);
  }, []);
  const clearInactivity = useCallback(() => setInactivityLogout(false), []);

  useEffect(() => {
    const evts = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const reset = () => setLastAct(Date.now());
    evts.forEach(e => window.addEventListener(e, reset));
    const iv = setInterval(() => { if (user && Date.now() - lastAct > TIMEOUT) { logout(); setInactivityLogout(true); } }, 30000);
    return () => { evts.forEach(e => window.removeEventListener(e, reset)); clearInterval(iv); };
  }, [user, lastAct, logout]);

  useEffect(() => {
    const s = localStorage.getItem('user'); const t = localStorage.getItem('token');
    if (s && t) try { setUser(JSON.parse(s)); } catch {}
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, totpCode?: string) => {
    const data = await api.post('/auth/login', { email, password, totpCode });
    if (data.requires2FA) return data;
    localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user); setInactivityLogout(false); return data;
  };
  const updateUser = async () => {
    try { const d = await api.get('/auth/me'); setUser(d.user); localStorage.setItem('user', JSON.stringify(d.user)); } catch {}
  };

  return <AuthContext.Provider value={{ user, loading, inactivityLogout, login, logout, updateUser, clearInactivity }}>{children}</AuthContext.Provider>;
}
