import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@shared/i18n/messages/en-US.json";
import { track } from "@/lib/analytics/events";
import { Hero } from "../Hero";

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority,
    src,
    ...props
  }: {
    alt: string;
    priority?: boolean;
    src: string | { src: string };
  }) => {
    void priority;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} src={typeof src === "string" ? src : src.src} {...props} />
    );
  },
}));

vi.mock("@/lib/analytics/events", () => ({
  track: vi.fn(),
}));

function renderHero() {
  return render(
    <NextIntlClientProvider locale="en-US" messages={messages}>
      <Hero locale="en-US" />
    </NextIntlClientProvider>,
  );
}

describe("Hero", () => {
  it("renders the headline, subheadline, and both CTAs", () => {
    renderHero();

    expect(
      screen.getByRole("heading", {
        name: "Your content marketing on autopilot.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "From weekly topic discovery to multi-platform publishing and performance-driven prompt tuning — 1wayseo turns your content pipeline into a flywheel that improves itself.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start 7-day free trial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View pricing" }),
    ).toBeInTheDocument();
  });

  it("links the CTAs to signup and pricing", () => {
    renderHero();

    expect(
      screen.getByRole("link", { name: "Start 7-day free trial" }),
    ).toHaveAttribute("href", "/signup?plan=solo_monthly");
    expect(screen.getByRole("link", { name: "View pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("fires cta_click with the primary CTA id", () => {
    renderHero();

    fireEvent.click(
      screen.getByRole("link", { name: "Start 7-day free trial" }),
    );

    expect(track).toHaveBeenCalledWith({
      name: "cta_click",
      properties: {
        ctaId: "hero_primary",
        locale: "en-US",
      },
    });
  });
});
