import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQPage from "../page";

describe("FAQPage", () => {
  it("renders the FAQ title", () => {
    render(<FAQPage />);

    expect(
      screen.getByRole("heading", { name: /faq/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders at least five questions", () => {
    render(<FAQPage />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).length,
    ).toBeGreaterThanOrEqual(5);
  });
});
