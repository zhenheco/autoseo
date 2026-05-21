import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enUS from "@shared/i18n/messages/en-US.json";
import zhTW from "@shared/i18n/messages/zh-TW.json";
import { track } from "@/lib/analytics/events";
import { Pricing } from "../Pricing";

vi.mock("@/lib/analytics/events", () => ({
  track: vi.fn(),
}));

function renderPricing({
  locale = "en-US",
  messages = enUS,
}: {
  locale?: string;
  messages?: Record<string, unknown>;
} = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Pricing locale={locale} />
    </NextIntlClientProvider>,
  );
}

describe("Pricing", () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
  });

  it("switches both plan card prices between monthly and yearly", () => {
    renderPricing();

    expect(screen.getByTestId("pricing-card-solo")).toHaveTextContent("$39");
    expect(screen.getByTestId("pricing-card-pro")).toHaveTextContent("$99");

    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));

    expect(screen.getByTestId("pricing-card-solo")).toHaveTextContent("$374");
    expect(screen.getByTestId("pricing-card-pro")).toHaveTextContent("$950");
    expect(screen.getByText("Save $94/yr")).toBeInTheDocument();
    expect(screen.getByText("Save $238/yr")).toBeInTheDocument();
  });

  it("updates CTA hrefs based on the selected billing period and plan", () => {
    renderPricing();

    expect(screen.getByTestId("pricing-cta-solo")).toHaveAttribute(
      "href",
      "/signup?plan=solo_monthly",
    );
    expect(screen.getByTestId("pricing-cta-pro")).toHaveAttribute(
      "href",
      "/signup?plan=pro_monthly",
    );

    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));

    expect(screen.getByTestId("pricing-cta-solo")).toHaveAttribute(
      "href",
      "/signup?plan=solo_yearly",
    );
    expect(screen.getByTestId("pricing-cta-pro")).toHaveAttribute(
      "href",
      "/signup?plan=pro_yearly",
    );
  });

  it("shows approximate NT pricing for the Taiwan locale", () => {
    renderPricing({ locale: "zh-TW", messages: zhTW });

    expect(screen.getByText("約 NT$ 1,250")).toBeInTheDocument();
  });

  it("emits pricing_view on mount and cta_click on CTA click", () => {
    renderPricing();

    expect(track).toHaveBeenCalledWith({
      name: "pricing_view",
      properties: { locale: "en-US" },
    });

    fireEvent.click(screen.getByTestId("pricing-cta-pro"));

    expect(track).toHaveBeenCalledWith({
      name: "cta_click",
      properties: {
        ctaId: "pricing_pro_monthly",
        locale: "en-US",
      },
    });
  });
});
