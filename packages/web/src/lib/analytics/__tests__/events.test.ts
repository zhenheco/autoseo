import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FunnelEvent } from "../events";
import { track } from "../events";
import { getPostHogClient } from "@/lib/analytics/posthog-client";

vi.mock("@/lib/analytics/posthog-client", () => ({
  getPostHogClient: vi.fn(),
}));

const mockedGetPostHogClient = vi.mocked(getPostHogClient);

const funnelEvents: FunnelEvent[] = [
  { name: "lp_view", properties: { locale: "zh-TW", referer: "direct" } },
  { name: "cta_click", properties: { ctaId: "hero-primary", locale: "zh-TW" } },
  { name: "pricing_view", properties: { locale: "zh-TW" } },
  { name: "signup_start", properties: { method: "email" } },
  {
    name: "signup_complete",
    properties: { userId: "user_123", companyId: "company_123" },
  },
  {
    name: "trial_card_added",
    properties: {
      userId: "user_123",
      trialId: "trial_123",
      cardBrand: "visa",
    },
  },
  {
    name: "trial_converted",
    properties: {
      userId: "user_123",
      trialId: "trial_123",
      planId: "pro",
      amountUsd: 29,
    },
  },
];

describe("funnel track", () => {
  const capture = vi.fn();
  const gtag = vi.fn();
  let idleCallback: (deadline?: IdleDeadline) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPostHogClient.mockReturnValue({ capture });
    window.requestIdleCallback = vi.fn((callback) => {
      idleCallback = callback;
      return 1;
    });
    Object.defineProperty(window.navigator, "doNotTrack", {
      configurable: true,
      value: "0",
    });
    window.gtag = gtag;
  });

  it.each(funnelEvents)(
    "dual-emits $name to PostHog and GA4 with the canonical shape",
    async (event) => {
      track(event);

      expect(gtag).toHaveBeenCalledWith("event", event.name, event.properties);
      expect(window.requestIdleCallback).toHaveBeenCalled();
      expect(capture).not.toHaveBeenCalled();

      idleCallback();
      await vi.dynamicImportSettled();

      expect(capture).toHaveBeenCalledWith(event.name, event.properties);
    },
  );

  it("still emits GA4 when PostHog is not initialized", async () => {
    mockedGetPostHogClient.mockReturnValue(null);

    track({ name: "pricing_view", properties: { locale: "zh-TW" } });

    idleCallback();
    await vi.dynamicImportSettled();

    expect(capture).not.toHaveBeenCalled();
    expect(gtag).toHaveBeenCalledWith("event", "pricing_view", {
      locale: "zh-TW",
    });
  });

  it("does not emit when Do Not Track is enabled", () => {
    Object.defineProperty(window.navigator, "doNotTrack", {
      configurable: true,
      value: "1",
    });

    track({ name: "pricing_view", properties: { locale: "zh-TW" } });

    expect(capture).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });
});
