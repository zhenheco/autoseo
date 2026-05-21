import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders content and triggers the documented action", () => {
    const onClick = vi.fn();

    render(
      <EmptyState
        icon={<span aria-hidden="true">Icon</span>}
        title="No articles yet"
        description="Generate your first SEO article."
        action={{ label: "Create article", onClick }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No articles yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Generate your first SEO article."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
