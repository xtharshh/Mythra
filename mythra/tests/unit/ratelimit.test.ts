import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../../server/ratelimit.js";

describe("rate limiter (abuse protection)", () => {
  it("allows max per window, then refuses until reset", () => {
    const lane = createRateLimiter({ windowMs: 60_000, max: 2 });
    expect(lane.check("1.2.3.4", 0)).toBe(true);
    expect(lane.check("1.2.3.4", 1)).toBe(true);
    expect(lane.check("1.2.3.4", 2)).toBe(false);
    // other IPs unaffected
    expect(lane.check("5.6.7.8", 2)).toBe(true);
    // next window opens again
    expect(lane.check("1.2.3.4", 60_001)).toBe(true);
  });
});
