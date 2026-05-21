import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../input";
import { FormRow } from "../form-row";

describe("FormRow", () => {
  it("renders a label, control, and helper text with stable form spacing", () => {
    render(
      <FormRow
        label="Site URL"
        htmlFor="site-url"
        helperText="Use the public homepage URL."
      >
        <Input id="site-url" />
      </FormRow>,
    );

    expect(screen.getByLabelText("Site URL")).toBeInTheDocument();
    expect(
      screen.getByText("Use the public homepage URL."),
    ).toBeInTheDocument();
  });

  it("adds a visible required marker without changing the label text", () => {
    render(
      <FormRow label="Webhook URL" htmlFor="webhook-url" required>
        <Input id="webhook-url" />
      </FormRow>,
    );

    expect(screen.getByLabelText("Webhook URL *")).toBeInTheDocument();
  });
});
