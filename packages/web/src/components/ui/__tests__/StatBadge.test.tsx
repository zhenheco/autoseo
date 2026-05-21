import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatBadge } from "../stat-badge";

describe("StatBadge", () => {
  it("renders the savings amount with strong emphasis", () => {
    render(<StatBadge amount="$94/year" emphasis="strong" />);

    expect(screen.getByText(/save \$94\/year/i)).toBeInTheDocument();
  });
});
