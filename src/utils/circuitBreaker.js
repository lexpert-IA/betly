// ─── In-memory circuit breaker ────────────────────────────────────────────────
// States: CLOSED (normal) → OPEN (blocking) → HALF_OPEN (testing recovery)

let state = 'CLOSED';
let errorCount = 0;
let lastErrorTime = 0;
let openedAt = 0;

const MAX_ERRORS   = 5;
const WINDOW_MS    = 60_000;       // count errors in a 1-min window
const COOLDOWN_MS  = 15 * 60_000;  // auto-reset after 15 min without new errors

function recordError() {
  const now = Date.now();
  if (now - lastErrorTime > WINDOW_MS) errorCount = 0; // reset counter after window
  errorCount++;
  lastErrorTime = now;

  if (errorCount >= MAX_ERRORS && state === 'CLOSED') {
    state   = 'OPEN';
    openedAt = now;
    // Log as critical — admins can wire Telegram alert here
    console.error(`[CIRCUIT BREAKER] OPENED — ${errorCount} critical errors in ${WINDOW_MS/1000}s`);
  }
}

function isOpen() {
  if (state === 'OPEN') {
    if (Date.now() - openedAt >= COOLDOWN_MS) {
      state = 'HALF_OPEN';
      return false;
    }
    return true;
  }
  return false;
}

function recordSuccess() {
  if (state === 'HALF_OPEN') {
    state      = 'CLOSED';
    errorCount = 0;
    console.info('[CIRCUIT BREAKER] Closed — system recovered');
  }
}

function reset() {
  state      = 'CLOSED';
  errorCount = 0;
  openedAt   = 0;
}

function getState() {
  return { state, errorCount, openedAt, lastErrorTime };
}

module.exports = { recordError, isOpen, recordSuccess, reset, getState };
