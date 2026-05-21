import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../page-header";

describe("PageHeader", () => {
  it("renders title, description, and actions", () => {
    render(
      <PageHeader
        title="Dashboard"
        description="Monitor article operations."
        actions={<button type="button">New article</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Monitor article operations.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New article" }),
    ).toBeInTheDocument();
  });
});
