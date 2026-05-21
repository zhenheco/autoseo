import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";

const createClient = vi.fn();
const homeClient = vi.fn(() => null);

vi.mock("@shared/supabase", () => ({
  createClient,
}));

vi.mock("../home-client", () => ({
  HomeClient: homeClient,
}));

describe("home page data loading", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not fetch legacy pricing data when LP v2 is enabled", async () => {
    process.env.NEXT_PUBLIC_LP_V2_ENABLED = "true";

    const { default: Home } = await import("../page");
    const result = await Home();

    expect(createClient).not.toHaveBeenCalled();
    expect(isValidElement(result)).toBe(true);
    expect(result.props).toMatchObject({
      plans: [],
      articlePackages: [],
    });
  });
});
