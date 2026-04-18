import React from 'react';

export default function BetlyLoader({ size = 120, text, style }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 16px',
      ...style,
    }}>
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: size, height: size,
          borderRadius: size * 0.2,
          objectFit: 'cover',
        }}
      >
        <source src="/betly-loader.mp4" type="video/mp4" />
      </video>
      {text && (
        <div style={{
          marginTop: 14, fontSize: 13, fontWeight: 600,
          color: '#64748b', letterSpacing: '0.3px',
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

// Loader centré pour les pages (pas fixe — ne bloque pas le layout)
export function BetlyLoaderFullPage({ text = 'Chargement...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '50vh', gap: 16,
    }}>
      <video
        autoPlay loop muted playsInline
        poster="/betly-icon.png"
        style={{ width: 90, height: 90, borderRadius: 20, objectFit: 'cover', display: 'block' }}
      >
        <source src="/betly-loader.mp4" type="video/mp4" />
        <img src="/betly-icon.png" alt="BETLY" style={{ width: 90, height: 90, borderRadius: 20 }} />
      </video>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>{text}</div>
    </div>
  );
}

// Splash plein écran — uniquement pour l'init de l'app (App.jsx)
export function BetlySplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0a0a0f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 28,
    }}>
      <style>{`
        @keyframes bl-glow {
          0%,100% { filter: drop-shadow(0 0 20px rgba(168,85,247,0.55)); transform: scale(1); }
          50%      { filter: drop-shadow(0 0 50px rgba(168,85,247,1)); transform: scale(1.07); }
        }
        @keyframes bl-bar {
          0%   { width: 0%; }
          70%  { width: 85%; }
          100% { width: 100%; }
        }
        @keyframes bl-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ animation: 'bl-glow 2s ease-in-out infinite' }}>
        <video
          autoPlay loop muted playsInline
          poster="/betly-icon.png"
          style={{ width: 110, height: 110, borderRadius: 26, objectFit: 'cover', display: 'block' }}
        >
          <source src="/betly-loader.mp4" type="video/mp4" />
          <img src="/betly-icon.png" alt="BETLY" style={{ width: 110, height: 110, borderRadius: 26 }} />
        </video>
      </div>
      <div style={{ textAlign: 'center', animation: 'bl-fadein 0.5s ease 0.3s both' }}>
        <div style={{
          fontSize: 18, fontWeight: 900, letterSpacing: 4,
          background: 'linear-gradient(135deg, #7c3aed, #a855f7, #c084fc)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 14,
        }}>BETLY</div>
        <div style={{ width: 160, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: 'linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)',
            animation: 'bl-bar 1.6s ease-in-out forwards',
          }} />
        </div>
      </div>
    </div>
  );
}
