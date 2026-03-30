const geoip = require('geoip-lite');

// Countries and regions blocked from betting features
// Only block the most restrictive jurisdictions — expand later based on legal review
const BLOCKED_COUNTRIES = new Set(['US', 'RU', 'SG']);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '';
}

/**
 * Middleware: blocks requests from restricted jurisdictions.
 * Applies to betting/market-trading routes only.
 */
function geoblock(req, res, next) {
  // Skip in dev unless explicitly enabled
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_GEOBLOCK) {
    return next();
  }

  const ip = getClientIp(req);
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) {
    return next(); // localhost always passes
  }

  const geo = geoip.lookup(ip);
  if (!geo) return next(); // unknown IP — allow, don't punish

  const country = geo.country;
  if (BLOCKED_COUNTRIES.has(country)) {
    return res.status(403).json({
      error: 'geo_blocked',
      message: 'BETLY n\'est pas disponible dans votre juridiction.',
      country,
    });
  }

  next();
}

module.exports = { geoblock };
