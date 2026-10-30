export function userRateLimit({ max = 10, windowMs = 60_000 } = {}) {
  const windows = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const current = windows.get(req.userId);
    if (!current || now - current.startedAt >= windowMs) {
      windows.set(req.userId, { startedAt: now, count: 1 });
      return next();
    }
    current.count += 1;
    if (current.count > max) return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    if (windows.size > 1000) for (const [key, entry] of windows) if (now - entry.startedAt >= windowMs) windows.delete(key);
    return next();
  };
}
