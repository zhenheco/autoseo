import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "../page";

describe("PrivacyPage", () => {
  it("renders the Privacy Policy title", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { name: /privacy policy/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders contact information", () => {
    render(<PrivacyPage />);

    expect(screen.getAllByText(/ace@zhenheai\.com/i).length).toBeGreaterThan(0);
  });
});
