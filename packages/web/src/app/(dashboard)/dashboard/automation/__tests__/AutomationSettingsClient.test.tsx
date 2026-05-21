import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationSettingsClient } from "../AutomationSettingsClient";

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: navigationMocks.refresh,
  }),
}));

const brand = {
  id: "brand-1",
  name: "Northwind",
  automation_level: 1,
  auto_articles_per_week: 2,
  auto_publish_to_social: false,
};

function mockPatch() {
  const fetchMock = vi.fn(async () =>
    Response.json({
      success: true,
      data: {
        id: "brand-1",
        automation_level: 1,
        auto_articles_per_week: 2,
        auto_publish_to_social: true,
      },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AutomationSettingsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("persists automation toggles to the active brand", async () => {
    const fetchMock = mockPatch();
    render(<AutomationSettingsClient brand={brand} />);

    fireEvent.click(
      screen.getByRole("switch", {
        name: "Publish to social automatically",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/brands/brand-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            automationLevel: 1,
            autoArticlesPerWeek: 2,
            autoPublishToSocial: true,
          }),
        }),
      ),
    );
    expect(navigationMocks.refresh).toHaveBeenCalled();
  });

  it("requires confirmation before switching to L4", async () => {
    render(<AutomationSettingsClient brand={brand} />);

    fireEvent.click(screen.getByRole("radio", { name: /L4 全自動/ }));

    expect(
      screen.getByRole("alertdialog", { name: "Enable L4 automation?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/auto-publish-to-social/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("radio", { name: /L4 全自動/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    fireEvent.click(screen.getByRole("radio", { name: /L4 全自動/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enable L4" }));

    expect(screen.getByRole("radio", { name: /L4 全自動/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("updates the weekly preview when the slider changes", () => {
    render(<AutomationSettingsClient brand={brand} />);

    expect(screen.getByText(/2 articles/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Articles per week"), {
      target: { value: "5" },
    });

    expect(screen.getByText(/5 articles/)).toBeInTheDocument();
    expect(screen.getAllByText(/09:00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/14:00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20:00/).length).toBeGreaterThan(0);
  });
});
