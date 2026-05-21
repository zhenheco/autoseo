import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconLabel } from "../icon-label";

describe("IconLabel", () => {
  it("renders an icon and label with the dashboard icon-label layout", () => {
    render(
      <IconLabel icon={<span aria-label="calendar icon">C</span>}>
        Weekly preview
      </IconLabel>,
    );

    expect(screen.getByLabelText("calendar icon")).toBeInTheDocument();
    expect(screen.getByText("Weekly preview")).toBeInTheDocument();
  });

  it("can render as paragraph text for inline status messages", () => {
    render(
      <IconLabel
        as="p"
        icon={<span aria-hidden="true">S</span>}
        className="text-sm text-success-700"
      >
        Settings saved.
      </IconLabel>,
    );

    expect(screen.getByText("Settings saved.").tagName).toBe("P");
  });
});
