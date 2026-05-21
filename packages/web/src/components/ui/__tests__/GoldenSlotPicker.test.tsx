import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoldenSlotPicker } from "../golden-slot-picker";

describe("GoldenSlotPicker", () => {
  it("renders localized fixed slots and triggers onChange", () => {
    const onChange = vi.fn();

    render(<GoldenSlotPicker onChange={onChange} locale="en-US" />);

    expect(screen.getByRole("radio", { name: /09:00/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /14:00/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /20:00/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /14:00/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ utcHour: 6, twHour: 14 }),
    );
  });
});
