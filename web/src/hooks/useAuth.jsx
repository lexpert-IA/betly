import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

const BASE = import.meta.env.VITE_API_URL || '';

const PALETTE = ['#7c3aed','#0891b2','#059669','#b45309','#be185d','#1d4ed8','#c2410c','#6d28d9'];

export function computeAvatarColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = still loading
  const [user, setUser]                 = useState(null);       // BETLY profile
  const [loading, setLoading]           = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          const res   = await fetch(`${BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setUser(await res.json());
          } else {
            // Firebase auth OK but no BETLY profile yet → PseudoModal will show
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Called after pseudo registration to set profile directly (avoids extra fetch)
  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await firebaseSignOut(auth); } catch {}
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const updateBalance = useCallback((balance) => {
    setUser(prev => prev ? { ...prev, balance } : prev);
  }, []);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    try {
      const token = await fbUser.getIdToken(true);
      const res   = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUser(await res.json());
    } catch {}
  }, []);

  const openAuth  = useCallback(() => setAuthModalOpen(true),  []);
  const closeAuth = useCallback(() => setAuthModalOpen(false), []);

  // Auto-refresh user data every 30s (balances, lockedBalance, stats)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshUser, 30000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  // Auto-close modal once user is authenticated
  useEffect(() => {
    if (user) setAuthModalOpen(false);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, firebaseUser, loading,
      login, logout, updateBalance, refreshUser,
      authModalOpen, openAuth, closeAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUserId() {
  const ctx = useContext(AuthContext);
  return ctx?.user?.userId || '';
}
