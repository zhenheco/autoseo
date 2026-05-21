import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrialCountdown } from "../trial-countdown";

describe("TrialCountdown", () => {
  it("renders nothing when the trial ends more than seven days out", () => {
    const trialEndsAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

    const { container } = render(
      <TrialCountdown trialEndsAt={trialEndsAt} onUpgrade={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders remaining days and triggers upgrade", () => {
    const onUpgrade = vi.fn();
    const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    render(<TrialCountdown trialEndsAt={trialEndsAt} onUpgrade={onUpgrade} />);

    expect(screen.getByText(/2 days remaining/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /upgrade/i }));

    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});
