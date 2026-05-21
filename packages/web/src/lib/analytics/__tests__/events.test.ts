import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FunnelEvent } from "../events";
import { track } from "../events";
import { getPostHogClient } from "../posthog-client";

vi.mock("../posthog-client", () => ({
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPostHogClient.mockReturnValue({ capture });
    Object.defineProperty(window.navigator, "doNotTrack", {
      configurable: true,
      value: "0",
    });
    window.gtag = gtag;
  });

  it.each(funnelEvents)(
    "dual-emits $name to PostHog and GA4 with the canonical shape",
    (event) => {
      track(event);

      expect(capture).toHaveBeenCalledWith(event.name, event.properties);
      expect(gtag).toHaveBeenCalledWith("event", event.name, event.properties);
    },
  );

  it("is a no-op when PostHog is not initialized", () => {
    mockedGetPostHogClient.mockReturnValue(null);

    track({ name: "pricing_view", properties: { locale: "zh-TW" } });

    expect(capture).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
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
