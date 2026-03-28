import { useState, useEffect, useCallback, useRef, useContext } from 'react';

// Re-export from useAuth for backward compat
export { useUserId } from './useAuth';

export function useApi(path, { interval = 0, params = {} } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  // Get userId from localStorage session (or URL param fallback)
  function getUserId() {
    try {
      const raw = localStorage.getItem('betly_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) return parsed.userId;
      }
    } catch {}
    return new URLSearchParams(window.location.search).get('userId') || '';
  }

  const fetch_ = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setLoading(true);
    try {
      const userId = getUserId();
      const qs = new URLSearchParams({ userId, ...params }).toString();
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}${path}?${qs}`);
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
