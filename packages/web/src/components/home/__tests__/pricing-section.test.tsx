import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@shared/i18n/messages/en-US.json";
import { PricingSection } from "../pricing-section";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        function MotionDiv(props, ref) {
          return <div ref={ref} {...props} />;
        },
      ),
      h2: React.forwardRef<
        HTMLHeadingElement,
        React.HTMLAttributes<HTMLHeadingElement>
      >(function MotionH2(props, ref) {
        return <h2 ref={ref} {...props} />;
      }),
    },
  };
});

const starterPlan = {
  id: "plan-starter",
  name: "STARTER",
  slug: "starter",
  monthly_price: 2990,
  yearly_price: 35880,
  articles_per_month: 3,
  yearly_bonus_months: 2,
  features: {},
};

const proPlan = {
  id: "plan-pro",
  name: "PRO",
  slug: "pro",
  monthly_price: 6990,
  yearly_price: 83880,
  articles_per_month: 10,
  yearly_bonus_months: 2,
  features: {},
};

const businessPlan = {
  id: "plan-business",
  name: "BUSINESS",
  slug: "business",
  monthly_price: 14990,
  yearly_price: 179880,
  articles_per_month: 30,
  yearly_bonus_months: 2,
  features: {},
};

function renderPricingSection(plans = [starterPlan, proPlan]) {
  return render(
    <NextIntlClientProvider locale="en-US" messages={messages}>
      <PricingSection plans={plans} articlePackages={[]} />
    </NextIntlClientProvider>,
  );
}

describe("legacy home PricingSection", () => {
  it("routes real plan cards through signup with the selected Stripe plan", () => {
    renderPricingSection();

    expect(screen.getByTestId("home-pricing-cta-starter")).toHaveAttribute(
      "href",
      "/signup?plan=solo_yearly",
    );
    expect(screen.getByTestId("home-pricing-cta-pro")).toHaveAttribute(
      "href",
      "/signup?plan=pro_yearly",
    );

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));

    expect(screen.getByTestId("home-pricing-cta-starter")).toHaveAttribute(
      "href",
      "/signup?plan=solo_monthly",
    );
    expect(screen.getByTestId("home-pricing-cta-pro")).toHaveAttribute(
      "href",
      "/signup?plan=pro_monthly",
    );
  });

  it("routes fallback cards through signup instead of generic login", () => {
    renderPricingSection([]);

    expect(screen.getByTestId("home-pricing-cta-starter")).toHaveAttribute(
      "href",
      "/signup?plan=solo_monthly",
    );
    expect(screen.getByTestId("home-pricing-cta-pro")).toHaveAttribute(
      "href",
      "/signup?plan=pro_monthly",
    );
  });

  it("does not render unsupported checkout plans without Stripe prices", () => {
    renderPricingSection([starterPlan, proPlan, businessPlan]);

    expect(screen.queryByText("BUSINESS")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-pricing-cta-business")).toBeNull();
  });
});
