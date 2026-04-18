import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../lib/firebase';

// Re-export for backward compat
export { useUserId } from './useAuth';

async function getAuthHeader() {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
  } catch {}
  return {};
}

export function useApi(path, { interval = 0, params = {} } = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const timerRef              = useRef(null);

  const fetch_ = useCallback(async (isFirstLoad = false) => {
    if (!path) { setLoading(false); return; }
    if (isFirstLoad) setLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const qs  = new URLSearchParams(params).toString();
      const base = import.meta.env.VITE_API_URL || '';
      const url  = qs ? `${base}${path}?${qs}` : `${base}${path}`;
      const res  = await fetch(url, { headers: authHeader });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  }, [path, JSON.stringify(params)]);

  useEffect(() => {
    fetch_(true);
    if (interval > 0) timerRef.current = setInterval(() => fetch_(false), interval);
    return () => clearInterval(timerRef.current);
  }, [fetch_, interval]);

  return { data, loading, error, refetch: () => fetch_(false) };
}
