import { useState, useEffect, useCallback, useRef } from 'react';

const BASE = import.meta.env.VITE_POLYFRENCH_API_URL || 'http://localhost:3000';

export function usePolyfrenchTelegramId() {
  return new URLSearchParams(window.location.search).get('telegramId') || '';
}

export function usePolyfrenchApi(path, { interval = 0, params = {} } = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const timerRef = useRef(null);

  const telegramId = usePolyfrenchTelegramId();

  const fetch_ = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setLoading(true);
    try {
      const qs  = new URLSearchParams({ telegramId, ...params }).toString();
      const res = await fetch(`${BASE}${path}?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  }, [path, telegramId, JSON.stringify(params)]);

  useEffect(() => {
    fetch_(true);
    if (interval > 0) {
      timerRef.current = setInterval(() => fetch_(false), interval);
    }
    return () => clearInterval(timerRef.current);
  }, [fetch_, interval]);

  return { data, loading, error, refetch: () => fetch_(false) };
}
