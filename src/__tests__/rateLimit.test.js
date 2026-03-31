import { describe, it, expect, vi, beforeEach } from "vitest";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows actions under the limit", async () => {
    const { checkRateLimit } = await import("../utils/rateLimit.js");
    expect(checkRateLimit()).toBe(true);
    expect(checkRateLimit()).toBe(true);
    expect(checkRateLimit()).toBe(true);
  });

  it("blocks after exceeding 5 actions in 60s", async () => {
    const { checkRateLimit } = await import("../utils/rateLimit.js");
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit()).toBe(true);
    }
    expect(checkRateLimit()).toBe(false);
  });
});
