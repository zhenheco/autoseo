import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@shared/i18n/messages/en-US.json";
import { SocialProof } from "../SocialProof";

function renderSocialProof(customMessages: Record<string, unknown> = messages) {
  return render(
    <NextIntlClientProvider
      locale="en-US"
      messages={customMessages}
      onError={() => undefined}
      getMessageFallback={({ namespace, key }) =>
        `fallback:${namespace}.${key}`
      }
    >
      <SocialProof />
    </NextIntlClientProvider>,
  );
}

describe("SocialProof", () => {
  it("renders the founding-member banner and founder story without fake logos", () => {
    renderSocialProof();

    expect(
      screen.getByText("Founding members coming soon"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Founder story" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lp-founder-story")).toHaveTextContent(
      "Ace will add the first founder story here",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses the configured i18n fallback for missing keys", () => {
    const partialMessages = structuredClone(messages);
    // @ts-expect-error - test intentionally removes one nested message key.
    delete partialMessages.lp.social.story.body;

    renderSocialProof(partialMessages);

    expect(
      screen.getByText("fallback:lp.social.story.body"),
    ).toBeInTheDocument();
  });
});
