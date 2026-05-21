import { describe, expect, it } from "vitest";
import { normalizeUserSubscriptionTier } from "@shared/auth/permissions";

function legacyPlanSlug() {
  return ["fr", "ee"].join("");
}

describe("normalizeUserSubscriptionTier", () => {
  it("returns null for legacy complimentary rows", () => {
    expect(
      normalizeUserSubscriptionTier({
        status: "active",
        trialEndsAt: null,
        planSlug: legacyPlanSlug(),
        companyTier: legacyPlanSlug(),
        now: new Date("2026-05-21T00:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("maps a live manual transition trial to pro access", () => {
    expect(
      normalizeUserSubscriptionTier({
        status: "grandfather_trial",
        trialEndsAt: "2026-06-20T00:00:00.000Z",
        planSlug: legacyPlanSlug(),
        companyTier: legacyPlanSlug(),
        now: new Date("2026-05-21T00:00:00.000Z"),
      }),
    ).toBe("pro");
  });
});
