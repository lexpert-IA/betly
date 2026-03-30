/**
 * Firebase Admin middleware for BETLY backend.
 *
 * resolveUserId — lenient, applied globally on the router.
 *   If Authorization: Bearer <token> is present → verify → set req.query.userId from MongoDB user.
 *   Otherwise falls back to req.query.userId (backward compat).
 *
 * requireAuth — strict, applied to sensitive routes.
 *   Returns 401 if no valid Firebase token present.
 *
 * When Firebase Admin env vars are absent (dev mode), falls back to unsafe
 * JWT payload decode (no signature verification) to extract uid.
 * Never use this fallback in production without proper Firebase Admin keys.
 */

const User = require('../../db/models/User');

let _admin = null;
let _adminFailed = false;

function getAdmin() {
  if (_admin) return _admin;
  if (_adminFailed) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const projectId   = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        console.warn('[BETLY] Firebase Admin: env vars missing — using unsafe JWT decode fallback');
        _adminFailed = true;
        return null;
      }
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    _admin = admin;
    return _admin;
  } catch (err) {
    console.error('[BETLY] Firebase Admin init failed:', err.message);
    _adminFailed = true;
    return null;
  }
}

/**
 * Dev fallback: decode JWT payload without signature verification.
 * Only used when Firebase Admin is not configured.
 */
function decodeTokenUnsafe(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // Basic sanity checks
    if (!payload.sub && !payload.user_id) return null;
    // Map to Firebase Admin decoded token shape
    return {
      uid: payload.user_id || payload.sub,
      email: payload.email || null,
      firebase: payload.firebase || { sign_in_provider: payload.sign_in_provider || 'unknown' },
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Global resolver — applies to all routes.
 * Sets req.query.userId from the Firebase token if present.
 */
async function resolveUserId(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const admin = getAdmin();

    let decoded = null;
    if (admin) {
      try {
        decoded = await admin.auth().verifyIdToken(token);
      } catch {
        // Invalid token — fall through
      }
    } else {
      // Dev fallback: decode without verification
      decoded = decodeTokenUnsafe(token);
    }

    if (decoded?.uid) {
      req.firebaseUser = decoded;
      const user = await User.findOne({ firebaseUid: decoded.uid }).lean();
      if (user) {
        req.query.userId = user._id.toString();
        req.dbUser = user;
      }
    }
  }
  next();
}

/**
 * Strict auth — returns 401 if no valid Firebase token.
 * Use on sensitive write routes (bets, withdrawals, etc.).
 */
async function requireAuth(req, res, next) {
  // resolveUserId already ran — if it set dbUser, we're good
  if (req.dbUser) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  // If resolveUserId couldn't decode the token, we can't authenticate
  return res.status(401).json({ error: 'Token invalide ou expiré' });
}

module.exports = { resolveUserId, requireAuth };
