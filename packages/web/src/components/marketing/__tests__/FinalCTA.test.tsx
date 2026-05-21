import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinalCTA } from "../FinalCTA";

const messages = {
  lp: {
    finalCta: {
      eyebrow: "Start now",
      headline: "Ready to start your content flywheel?",
      subheadline: "Launch the next content cycle with a trial.",
      primaryCta: "Start 7-day free trial",
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      emailSubmit: "Subscribe",
      emailHelp: "Get product updates. This is separate from the trial.",
      invalidEmail: "Enter a valid email address.",
      success: "You are subscribed.",
      duplicate: "You are already subscribed.",
      error: "Subscription failed. Please try again.",
    },
  },
};

function renderFinalCTA() {
  return render(
    <NextIntlClientProvider locale="en-US" messages={messages}>
      <FinalCTA />
    </NextIntlClientProvider>,
  );
}

describe("FinalCTA", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates email before posting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderFinalCTA();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts valid email subscriptions to the marketing API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderFinalCTA();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "Lead@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/marketing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "Lead@Example.com" }),
      });
    });
    expect(await screen.findByText("You are subscribed.")).toBeVisible();
  });

  it("shows a duplicate subscription message for 409 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "already_subscribed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderFinalCTA();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "lead@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(
      await screen.findByText("You are already subscribed."),
    ).toBeVisible();
  });
});
