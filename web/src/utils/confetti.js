import confetti from 'canvas-confetti';

export function fireWin(amount) {
  const duration = 2200;
  const end = Date.now() + duration;

  // Burst from center
  confetti({
    particleCount: 80,
    spread: 80,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#a855f7', '#7c3aed', '#06b6d4', '#fbbf24', '#22c55e'],
    zIndex: 9999,
  });

  // Side streams
  const frame = () => {
    if (Date.now() > end) return;
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#a855f7', '#fbbf24'], zIndex: 9999 });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#a855f7', '#06b6d4'], zIndex: 9999 });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
