import { describe, expect, it } from "vitest";
import { formatPing } from "../../src/api/client";

describe("formatPing (station chip)", () => {
  it("reads local vs live at a glance", () => {
    expect(formatPing(null, false)).toBe("local");
    expect(formatPing(null, true)).toBe("offline");
    expect(formatPing(12, true)).toMatch(/12ms/);
    expect(formatPing(900, true)).toMatch(/slow/);
  });
});
