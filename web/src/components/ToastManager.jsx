import React, { useState, useCallback, useEffect, useRef } from 'react';

// Global toast emitter
let emitToast = null;

export function toast(message, type = 'info', duration = 3500) {
  emitToast?.({ id: Date.now() + Math.random(), message, type, duration });
}

const TOAST_STYLES = {
  info:    { bg: 'rgba(124,58,237,0.95)',   border: 'rgba(168,85,247,0.4)', icon: '🔔' },
  success: { bg: 'rgba(5,150,105,0.95)',    border: 'rgba(34,197,94,0.4)',  icon: '✓'  },
  error:   { bg: 'rgba(185,28,28,0.95)',    border: 'rgba(239,68,68,0.4)',  icon: '✗'  },
  warning: { bg: 'rgba(146,64,14,0.95)',    border: 'rgba(245,158,11,0.4)', icon: '⚠' },
  win:     { bg: 'rgba(5,150,105,0.95)',    border: 'rgba(34,197,94,0.4)',  icon: '💰' },
  loss:    { bg: 'rgba(127,29,29,0.95)',    border: 'rgba(239,68,68,0.4)',  icon: '😞' },
  notif:   { bg: 'rgba(15,23,42,0.97)',     border: 'rgba(124,58,237,0.4)', icon: '🔔' },
};

function ToastItem({ id, message, type, duration, onRemove }) {
  const [visible, setVisible] = useState(false);
  const style = TOAST_STYLES[type] || TOAST_STYLES.info;

  useEffect(() => {
    // Appear
    requestAnimationFrame(() => setVisible(true));
    // Disappear
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(id), 300);
    }, duration);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px',
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,.5)',
      backdropFilter: 'blur(12px)',
      maxWidth: 320, minWidth: 240,
      transform: visible ? 'translateX(0)' : 'translateX(360px)',
      opacity: visible ? 1 : 0,
      transition: 'all .3s cubic-bezier(.4,0,.2,1)',
      cursor: 'pointer',
    }}
      onClick={() => { setVisible(false); setTimeout(() => onRemove(id), 300); }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{style.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#f8fafc', lineHeight: 1.4 }}>
        {message}
      </span>
    </div>
  );
}

export default function ToastManager() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((t) => {
    setToasts(prev => [...prev.slice(-4), t]); // max 5
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Register global emitter
  useEffect(() => {
    emitToast = addToast;
    return () => { emitToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 9997,
      display: 'flex', flexDirection: 'column', gap: 8,
      alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem {...t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
