import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "../status-badge";

describe("StatusBadge", () => {
  it("maps common success and failed statuses to design-system tones", () => {
    const { rerender } = render(<StatusBadge status="success" />);

    expect(screen.getByText("success")).toHaveClass("bg-success-50");

    rerender(<StatusBadge status="failed" />);

    expect(screen.getByText("failed")).toHaveClass("bg-destructive-50");
  });

  it("accepts localized labels and icons", () => {
    render(
      <StatusBadge
        status="pending"
        label="Waiting"
        icon={<span aria-label="pending icon">P</span>}
      />,
    );

    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByLabelText("pending icon")).toBeInTheDocument();
  });
});
