import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);

const retrieveCheckoutSessionMock = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "cs_test_123",
    mode: "subscription",
    payment_status: "no_payment_required",
  })),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/payments/stripe/server", () => ({
  getStripeClient: vi.fn(() => ({
    retrieveCheckoutSession: retrieveCheckoutSessionMock,
  })),
}));

import WelcomePage from "../welcome/page";

describe("/onboarding/welcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows trial pending state when Checkout completed with a trial", async () => {
    render(
      await WelcomePage({
        searchParams: Promise.resolve({ session_id: "cs_test_123" }),
      }),
    );

    expect(retrieveCheckoutSessionMock).toHaveBeenCalledWith("cs_test_123");
    expect(
      screen.getByRole("heading", { name: "您的試用已開始" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Trial active")).toBeInTheDocument();
    expect(
      screen.getByText(
        /It might take a moment for your trial to fully activate/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "前往 Dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
