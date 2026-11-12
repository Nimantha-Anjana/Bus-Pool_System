// Small in-memory limiter for the public (token) endpoints: max `max` requests per IP per window.
// (Single-server only. Behind a load balancer use a shared store.)
const createRateLimiter = ({ windowMs = 60 * 1000, max = 30 } = {}) => {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ success: false, message: "Too many requests. Please try again shortly." });
    }

    next();
  };
};

module.exports = { createRateLimiter };
