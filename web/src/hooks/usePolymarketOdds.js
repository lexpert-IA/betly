import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const REST_URL = 'https://clob.polymarket.com/book';
const REST_POLL_MS = 5_000;
const RECONNECT_MAX_MS = 30_000;

function midpoint(book) {
  const bestBid = book.bids?.[0]?.price ?? book.bids?.[0]?.p;
  const bestAsk = book.asks?.[0]?.price ?? book.asks?.[0]?.p;
  if (bestBid == null && bestAsk == null) return null;
  const bid = parseFloat(bestBid ?? 0);
  const ask = parseFloat(bestAsk ?? 1);
  return (bid + ask) / 2;
}

export function usePolymarketOdds(tokenId) {
  const [polyYes, setPolyYes] = useState(null);
  const [polyNo, setPolyNo] = useState(null);
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState(null); // 'ws' | 'rest'

  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const reconnectRef = useRef(null);
  const backoffRef = useRef(2000);
  const mountedRef = useRef(true);

  const updateOdds = useCallback((mid) => {
    if (mid == null || !mountedRef.current) return;
    const yes = Math.round(mid * 100);
    setPolyYes(Math.min(100, Math.max(0, yes)));
    setPolyNo(Math.min(100, Math.max(0, 100 - yes)));
  }, []);

  // REST fallback polling
  const startPolling = useCallback(() => {
    if (!tokenId || pollRef.current) return;
    const poll = async () => {
      try {
        const res = await fetch(`${REST_URL}?token_id=${tokenId}`);
        if (!res.ok) return;
        const book = await res.json();
        const mid = midpoint(book);
        updateOdds(mid);
        setSource('rest');
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, REST_POLL_MS);
  }, [tokenId, updateOdds]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // WebSocket connection
  const connectWs = useCallback(() => {
    if (!tokenId || !mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'book',
          assets_id: tokenId,
        }));
        setConnected(true);
        setSource('ws');
        backoffRef.current = 2000;
        stopPolling(); // WS active, stop REST fallback
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle different message formats
          const book = data.book || data;
          const mid = midpoint(book);
          updateOdds(mid);
        } catch {}
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        startPolling(); // Fallback to REST
        // Reconnect with exponential backoff
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
        reconnectRef.current = setTimeout(connectWs, delay);
      };

      ws.onerror = () => {
        ws.close(); // triggers onclose → reconnect
      };
    } catch {
      startPolling();
    }
  }, [tokenId, updateOdds, startPolling, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;

    if (!tokenId) {
      setPolyYes(null);
      setPolyNo(null);
      setConnected(false);
      setSource(null);
      return;
    }

    connectWs();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      stopPolling();
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    };
  }, [tokenId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { polyYes, polyNo, connected, source };
}
