import { useState, useEffect, useCallback, useRef } from 'react';

export function useUserId() {
  return new URLSearchParams(window.location.search).get('userId') || '';
}

export function useApi(path, { interval = 0, params = {} } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const userId = useUserId();

  const fetch_ = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setLoading(true);
    try {
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
  }, [path, userId, JSON.stringify(params)]);

  useEffect(() => {
    fetch_(true);
    if (interval > 0) timerRef.current = setInterval(() => fetch_(false), interval);
    return () => clearInterval(timerRef.current);
  }, [fetch_, interval]);

  return { data, loading, error, refetch: () => fetch_(false) };
}
