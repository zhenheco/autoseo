import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrendsWidget } from "../TrendsWidget";

const signals = [
  {
    id: "signal-1",
    brandId: "brand-1",
    topic: "AI SEO workflows",
    source: "perplexity",
    confidence: 0.96,
  },
  {
    id: "signal-2",
    brandId: "brand-1",
    topic: "Search console automation",
    source: "gsc",
    confidence: 0.86,
  },
  {
    id: "signal-3",
    brandId: "brand-1",
    topic: "Google Trends planning",
    source: "google_trends",
    confidence: 0.78,
  },
  {
    id: "signal-4",
    brandId: "brand-1",
    topic: "Programmatic content QA",
    source: "perplexity",
    confidence: 0.71,
  },
  {
    id: "signal-5",
    brandId: "brand-1",
    topic: "Local SEO refresh",
    source: "gsc",
    confidence: 0.68,
  },
  {
    id: "signal-6",
    brandId: "brand-1",
    topic: "Overflow topic",
    source: "perplexity",
    confidence: 0.5,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TrendsWidget", () => {
  it("renders the top five fetched trend signals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ signals }),
      })),
    );

    render(<TrendsWidget />);

    expect(await screen.findByText("AI SEO workflows")).toBeInTheDocument();
    expect(screen.getByText("Search console automation")).toBeInTheDocument();
    expect(screen.getByText("Google Trends planning")).toBeInTheDocument();
    expect(screen.getByText("Programmatic content QA")).toBeInTheDocument();
    expect(screen.getByText("Local SEO refresh")).toBeInTheDocument();
    expect(screen.queryByText("Overflow topic")).not.toBeInTheDocument();
  });

  it("dismisses a signal and removes it from the list", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url === "/api/trends") {
        return {
          ok: true,
          json: async () => ({ signals: signals.slice(0, 2) }),
        };
      }

      if (url === "/api/trends/signal-1/dismiss") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TrendsWidget />);

    expect(await screen.findByText("AI SEO workflows")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss AI SEO workflows" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("AI SEO workflows")).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/trends/signal-1/dismiss", {
      method: "POST",
    });
  });
});
