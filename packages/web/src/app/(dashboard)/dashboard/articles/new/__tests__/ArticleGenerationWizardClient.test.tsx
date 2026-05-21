import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleGenerationWizardClient } from "../components/ArticleGenerationWizardClient";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
  }),
}));

const brands = [
  { id: "brand-1", name: "Northwind" },
  { id: "brand-2", name: "Contoso" },
];

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
];

function renderWizard(activeBrandId = "brand-1") {
  return render(
    <ArticleGenerationWizardClient
      brands={brands}
      activeBrandId={activeBrandId}
    />,
  );
}

function stubLocalStorage() {
  const store = new Map<string, string>();

  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  });
}

function mockFetch(responseOverrides?: {
  generateStatus?: number;
  generateBody?: Record<string, unknown>;
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.startsWith("/api/trends")) {
      return Response.json({ signals });
    }

    if (url === "/api/articles/generate") {
      return Response.json(
        responseOverrides?.generateBody ?? {
          success: true,
          articleJobId: "job-1",
        },
        {
          status: responseOverrides?.generateStatus ?? 200,
        },
      );
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ArticleGenerationWizardClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    stubLocalStorage();
  });

  it("gates each step until required selections are complete", async () => {
    mockFetch();
    renderWizard();

    expect(
      screen.getByRole("heading", { name: "Choose brand" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByRole("heading", { name: "Choose topic" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByText("Choose a trend signal or enter a topic."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Custom topic"), {
      target: { value: "Technical SEO automation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("heading", { name: "Structure article" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("heading", { name: "Confirm generation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Technical SEO automation")).toBeInTheDocument();
  });

  it("prefills the topic when a trend signal is selected", async () => {
    mockFetch();
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /AI SEO workflows/ }),
    );

    expect(screen.getByDisplayValue("AI SEO workflows")).toBeInTheDocument();
  });

  it("persists and resumes the brand-scoped draft", async () => {
    mockFetch();
    const view = renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("AI SEO workflows");
    fireEvent.change(screen.getByLabelText("Custom topic"), {
      target: { value: "Local SEO refresh plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tutorial" }));

    await waitFor(() =>
      expect(localStorage.getItem("brand-1-wizard-draft")).toContain(
        "Local SEO refresh plan",
      ),
    );

    view.unmount();
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("AI SEO workflows");

    expect(
      screen.getByDisplayValue("Local SEO refresh plan"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutorial" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("surfaces quota 402 with an upgrade CTA", async () => {
    mockFetch({
      generateStatus: 402,
      generateBody: {
        error: "quota_exceeded",
        upgradeUrl: "/dashboard/settings#upgrade",
      },
    });
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Custom topic"), {
      target: { value: "Programmatic content QA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate article" }));

    expect(
      await screen.findByText(
        "Article quota exceeded. Upgrade to generate more articles.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upgrade plan" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
  });

  it("posts the full payload, clears the draft, and redirects to job status", async () => {
    const fetchMock = mockFetch();
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /AI SEO workflows/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Article length"), {
      target: { value: "2200" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Comparison" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "English" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate article" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/articles/generate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            keyword: "AI SEO workflows",
            title: "AI SEO workflows",
            mode: "wizard",
            brandId: "brand-1",
            brand_id: "brand-1",
            sourceTrendSignalId: "signal-1",
            topicTemplate: null,
            wordCount: "2200",
            structureTemplate: "comparison",
            translateLocales: ["en-US"],
          }),
        }),
      ),
    );
    expect(localStorage.getItem("brand-1-wizard-draft")).toBeNull();
    expect(navigationMocks.push).toHaveBeenCalledWith(
      "/dashboard/articles/job-1/status",
    );
  });
});
