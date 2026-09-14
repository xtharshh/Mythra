import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail } from "../../src/auth/auth";

describe("email login validation", () => {
  it("accepts normal explorer emails", () => {
    expect(isValidEmail("explorer@aurorabase.mars")).toBe(true);
    expect(isValidEmail("  Ivan@Earth.Example  ")).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a @b.co")).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });

  it("normalizes case + whitespace", () => {
    expect(normalizeEmail("  Ivan@Earth.Example ")).toBe("ivan@earth.example");
  });
});
