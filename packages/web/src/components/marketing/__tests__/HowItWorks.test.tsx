import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@shared/i18n/messages/en-US.json";
import { HowItWorks } from "../HowItWorks";

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderHowItWorks(customMessages: Record<string, unknown> = messages) {
  return render(
    <NextIntlClientProvider
      locale="en-US"
      messages={customMessages}
      onError={() => undefined}
      getMessageFallback={({ namespace, key }) =>
        `fallback:${namespace}.${key}`
      }
    >
      <HowItWorks />
    </NextIntlClientProvider>,
  );
}

describe("HowItWorks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the four flow steps", () => {
    mockReducedMotion(false);
    renderHowItWorks();

    expect(
      screen.getByRole("heading", { name: "Topic discovery" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Article generation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Card production" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Multi-platform publishing" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("lp-how-step")).toHaveLength(4);
    expect(screen.getAllByTestId("lp-how-connector")).toHaveLength(3);
  });

  it("uses the configured i18n fallback for missing keys", () => {
    mockReducedMotion(false);
    const partialMessages = structuredClone(messages);
    // @ts-expect-error - test intentionally removes one nested message key.
    delete partialMessages.lp.how.steps.discover.description;

    renderHowItWorks(partialMessages);

    expect(
      screen.getByText("fallback:lp.how.steps.discover.description"),
    ).toBeInTheDocument();
  });

  it("renders connectors without transforms when reduced motion is preferred", () => {
    mockReducedMotion(true);

    const { container } = renderHowItWorks();

    expect(screen.getAllByTestId("lp-how-connector")[0]).toMatchSnapshot();
    expect(container.innerHTML).not.toContain("transform");
  });
});
