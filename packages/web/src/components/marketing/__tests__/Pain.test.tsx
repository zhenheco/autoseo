import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@shared/i18n/messages/en-US.json";
import { Pain } from "../Pain";

function renderPain(customMessages: Record<string, unknown> = messages) {
  return render(
    <NextIntlClientProvider
      locale="en-US"
      messages={customMessages}
      onError={() => undefined}
      getMessageFallback={({ namespace, key }) =>
        `fallback:${namespace}.${key}`
      }
    >
      <Pain />
    </NextIntlClientProvider>,
  );
}

describe("Pain", () => {
  it("renders the three pain cards", () => {
    renderPain();

    expect(
      screen.getByRole("heading", { name: "Writing is slow" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Published but no one reads",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Can't decide what to write next",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("lp-pain-card")).toHaveLength(3);
  });

  it("uses the configured i18n fallback for missing keys", () => {
    const partialMessages = structuredClone(messages);
    // @ts-expect-error - test intentionally removes one nested message key.
    delete partialMessages.lp.pain.items.speed.body;

    renderPain(partialMessages);

    expect(
      screen.getByText("fallback:lp.pain.items.speed.body"),
    ).toBeInTheDocument();
  });
});
