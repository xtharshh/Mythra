// Tiny in-memory rate limiter (zero deps) for production abuse protection.
// Per-IP fixed windows; the game calls it from a Fastify hook. Pure — tested.
export interface RateLimit {
  windowMs: number;
  max: number;
}

export function createRateLimiter(limit: RateLimit): {
  /** True when the request may proceed (and counts it). */
  check: (ip: string, now?: number) => boolean;
  /** Current window usage (for tests/diagnostics). */
  size: () => number;
} {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    check(ip, now = Date.now()) {
      const slot = hits.get(ip);
      if (!slot || now >= slot.reset) {
        if (slot) hits.delete(ip);
        // opportunistic cleanup so the map can't grow forever
        if (hits.size > 10000) {
          for (const [k, v] of hits) {
            if (now >= v.reset) hits.delete(k);
            if (hits.size <= 8000) break;
          }
        }
        hits.set(ip, { count: 1, reset: now + limit.windowMs });
        return true;
      }
      slot.count += 1;
      return slot.count <= limit.max;
    },
    size: () => hits.size,
  };
}
