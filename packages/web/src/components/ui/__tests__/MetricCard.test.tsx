import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "../metric-card";

describe("MetricCard", () => {
  it("renders label, value, delta, and icon", () => {
    render(
      <MetricCard
        label="Articles"
        value="128"
        delta={{ value: "+12%", trend: "up" }}
        icon={<span aria-label="article icon">A</span>}
      />,
    );

    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("+12%")).toBeInTheDocument();
    expect(screen.getByLabelText("article icon")).toBeInTheDocument();
  });
});
