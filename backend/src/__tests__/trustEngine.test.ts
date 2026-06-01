import { describe, it, expect } from "vitest";
import { getTrustTier } from "../services/trustEngine";

describe("Trust Engine", () => {
  describe("getTrustTier", () => {
    it("returns CLEAN for high trust scores", () => {
      expect(getTrustTier(100)).toBe("CLEAN");
      expect(getTrustTier(85)).toBe("CLEAN");
      expect(getTrustTier(70)).toBe("CLEAN");
    });

    it("returns WATCHED for medium-high trust scores", () => {
      expect(getTrustTier(69)).toBe("WATCHED");
      expect(getTrustTier(50)).toBe("WATCHED");
      expect(getTrustTier(40)).toBe("WATCHED");
    });

    it("returns SUSPICIOUS for low trust scores", () => {
      expect(getTrustTier(39)).toBe("SUSPICIOUS");
      expect(getTrustTier(25)).toBe("SUSPICIOUS");
      expect(getTrustTier(20)).toBe("SUSPICIOUS");
    });

    it("returns SHADOW_BANNED for very low trust scores", () => {
      expect(getTrustTier(19)).toBe("SHADOW_BANNED");
      expect(getTrustTier(10)).toBe("SHADOW_BANNED");
      expect(getTrustTier(1)).toBe("SHADOW_BANNED");
    });

    it("returns HARD_BANNED for zero trust score", () => {
      expect(getTrustTier(0)).toBe("HARD_BANNED");
    });
  });
});
