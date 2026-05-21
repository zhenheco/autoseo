import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { FAQ } from "../FAQ";

const messages = {
  lp: {
    faq: {
      eyebrow: "FAQ",
      headline: "Questions before you start.",
      subheadline: "Short answers for the content flywheel.",
      items: [
        {
          question: "How does the 7-day trial work?",
          answer: "You can try the product for 7 days before billing starts.",
        },
        {
          question: "How many brands can I have?",
          answer: "Brand limits depend on your plan.",
        },
      ],
    },
  },
};

function renderFAQ() {
  return render(
    <NextIntlClientProvider locale="en-US" messages={messages}>
      <FAQ />
    </NextIntlClientProvider>,
  );
}

describe("FAQ", () => {
  it("expands and collapses accordion answers", () => {
    renderFAQ();

    const trigger = screen.getByRole("button", {
      name: "How does the 7-day trial work?",
    });

    expect(screen.queryByText(/before billing starts/i)).not.toBeVisible();

    fireEvent.click(trigger);

    expect(screen.getByText(/before billing starts/i)).toBeVisible();

    fireEvent.click(trigger);

    expect(screen.queryByText(/before billing starts/i)).not.toBeVisible();
  });
});
