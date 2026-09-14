import { beforeEach, describe, expect, it } from "vitest";
import { dismissMobileGate, isMobileDevice, mobileGateDismissed } from "../../src/components/MobileGate";

const mem = new Map<string, string>();

function stubWindow(ua: string, coarse: boolean, width: number): void {
  Object.defineProperty(globalThis, "window", {
    value: {
      navigator: { userAgent: ua },
      matchMedia: () => ({ matches: coarse }),
      innerWidth: width,
    },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  mem.clear();
  Object.defineProperty(globalThis, "sessionStorage", {
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    },
    configurable: true,
    writable: true,
  });
});

describe("mobile gate", () => {
  it("stays shut on desktop, opens on handhelds", () => {
    stubWindow("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", false, 1440);
    expect(isMobileDevice()).toBe(false);
    stubWindow("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", false, 390);
    expect(isMobileDevice()).toBe(true);
    stubWindow("Mozilla/5.0 (Linux; Android 14)", true, 412);
    expect(isMobileDevice()).toBe(true);
  });

  it("dismissal lifts the gate for the session", () => {
    expect(mobileGateDismissed()).toBe(false);
    dismissMobileGate();
    expect(mobileGateDismissed()).toBe(true);
  });
});
