/**
 * Retry a DB/async operation with exponential backoff.
 * @param {Function} fn   - async function to retry
 * @param {Object}  opts  - { maxRetries, baseDelayMs, label }
 */
async function withRetry(fn, { maxRetries = 3, baseDelayMs = 300, label = 'operation' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  const error = new Error(`${label} failed after ${maxRetries} attempts: ${lastErr?.message}`);
  error.cause = lastErr;
  throw error;
}

module.exports = { withRetry };
