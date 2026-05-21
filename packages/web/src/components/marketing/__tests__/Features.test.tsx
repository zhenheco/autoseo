import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@shared/i18n/messages/en-US.json";
import { Features } from "../Features";

function renderFeatures(customMessages: Record<string, unknown> = messages) {
  return render(
    <NextIntlClientProvider
      locale="en-US"
      messages={customMessages}
      onError={() => undefined}
      getMessageFallback={({ namespace, key }) =>
        `fallback:${namespace}.${key}`
      }
    >
      <Features />
    </NextIntlClientProvider>,
  );
}

describe("Features", () => {
  it("renders six feature cards with design-system token classes", () => {
    renderFeatures();

    expect(
      screen.getByRole("heading", { name: "SEO article generation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Auto social cards" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Multi-platform publishing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "7-locale support" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Brand memory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Self-optimization" }),
    ).toBeInTheDocument();

    const cards = screen.getAllByTestId("lp-feature-card");

    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card).toHaveClass("rounded-md", "border-border", "bg-card");
    }
  });

  it("uses the configured i18n fallback for missing keys", () => {
    const partialMessages = structuredClone(messages);
    // @ts-expect-error - test intentionally removes one nested message key.
    delete partialMessages.lp.features.items.article.body;

    renderFeatures(partialMessages);

    expect(
      screen.getByText("fallback:lp.features.items.article.body"),
    ).toBeInTheDocument();
  });
});
