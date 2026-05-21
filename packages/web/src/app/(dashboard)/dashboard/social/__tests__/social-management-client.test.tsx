import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SocialManagementClient,
  type SocialAccountView,
} from "../social-management-client";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/social",
  useRouter: () => ({
    push: navigationMocks.push,
    refresh: navigationMocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams("brand=brand-1"),
}));

const brands = [
  { id: "brand-1", name: "Northwind" },
  { id: "brand-2", name: "Contoso" },
];

const account: SocialAccountView = {
  id: "account-1",
  platform: "instagram",
  platformUsername: "northwind_ig",
  status: "connected",
  connectedAt: "2026-05-01T00:00:00.000Z",
  disconnectedAt: null,
  tokenExpiresAt: "2026-06-01T00:00:00.000Z",
  lastPublishedAt: "2026-05-20T03:00:00.000Z",
};

function mockPostsFetch(pages: Array<{ posts: unknown[]; hasMore: boolean }>) {
  let call = 0;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Response.json({
          success: true,
          data: {
            id: "account-1",
            disconnectedAt: "2026-05-22T10:00:00.000Z",
          },
        });
      }

      const page = pages[Math.min(call, pages.length - 1)];
      call += 1;
      return Response.json({
        success: true,
        data: {
          posts: page.posts,
          pagination: {
            limit: 10,
            offset: (call - 1) * 10,
            total: null,
            hasMore: page.hasMore,
          },
        },
      });
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderClient(
  props: Partial<React.ComponentProps<typeof SocialManagementClient>> = {},
) {
  return render(
    <SocialManagementClient
      brands={brands}
      activeBrandId="brand-1"
      activeBrandName="Northwind"
      initialAccounts={[account]}
      plan="solo"
      activeBrandConnectedCount={1}
      companyConnectedCount={1}
      metaOAuthPublicEnabled={false}
      {...props}
    />,
  );
}

describe("SocialManagementClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockPostsFetch([{ posts: [], hasMore: false }]);
  });

  it("renders five platform connect cards with Meta gated and LinkedIn coming soon", async () => {
    renderClient({
      initialAccounts: [],
      activeBrandConnectedCount: 0,
      companyConnectedCount: 0,
    });

    expect((await screen.findAllByText("Instagram")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Threads").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Facebook").length).toBeGreaterThan(0);
    expect(screen.getAllByText("X").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LinkedIn").length).toBeGreaterThan(0);

    expect(
      screen.getAllByRole("button", { name: /Pending review/ }),
    ).toHaveLength(3);
    expect(screen.getByRole("link", { name: /Connect X/ })).toHaveAttribute(
      "href",
      "/api/social/x/connect?brand_id=brand-1",
    );
    expect(
      screen.getByRole("button", { name: /LinkedIn coming soon/ }),
    ).toBeDisabled();
  });

  it("shows the Meta App Review pending banner when public OAuth is disabled", async () => {
    renderClient();

    expect(
      await screen.findByText("Meta connect pending review"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Meta App Review runbook" }),
    ).toHaveAttribute("href", "/docs/runbooks/meta-app-review.md");
  });

  it("disconnects an account after confirmation", async () => {
    const fetchMock = mockPostsFetch([{ posts: [], hasMore: false }]);
    renderClient();

    fireEvent.click(await screen.findByRole("button", { name: /Disconnect/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect account" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/social-accounts/account-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(await screen.findByText("disconnected")).toBeInTheDocument();
  });

  it("paginates the posts table", async () => {
    const fetchMock = mockPostsFetch([
      {
        hasMore: true,
        posts: [
          {
            id: "post-1",
            platform: "instagram",
            contentSnippet: "First page post",
            scheduledAt: "2026-05-22T09:00:00.000Z",
            publishedAt: null,
            status: "scheduled",
            metrics: { impressions: 10, engagement: 2 },
          },
        ],
      },
      {
        hasMore: false,
        posts: [
          {
            id: "post-2",
            platform: "x",
            contentSnippet: "Second page post",
            scheduledAt: "2026-05-21T09:00:00.000Z",
            publishedAt: "2026-05-21T10:00:00.000Z",
            status: "published",
            metrics: { impressions: 20, engagement: 5 },
          },
        ],
      },
    ]);
    renderClient({ metaOAuthPublicEnabled: true });

    expect(await screen.findByText("First page post")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Second page post")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/social-posts?brandId=brand-1&limit=10&offset=10",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
