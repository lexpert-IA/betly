import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'betly_user';

const PALETTE = ['#7c3aed','#0891b2','#059669','#b45309','#be185d','#1d4ed8','#c2410c','#6d28d9'];

export function computeAvatarColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadSession());

  const login = useCallback((userData) => {
    saveSession(userData);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const updateBalance = useCallback((balance) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, balance };
      saveSession(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateBalance }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUserId() {
  const auth = useContext(AuthContext);
  // fallback to query param for backward compat
  if (auth?.user?.userId) return auth.user.userId;
  return new URLSearchParams(window.location.search).get('userId') || '';
}
