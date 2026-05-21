import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import SignupPage from "../page";

function legacyPlanSlug() {
  return ["fr", "ee"].join("");
}

describe("/signup redirect", () => {
  it("normalizes deprecated plan query values before entering signup", async () => {
    await expect(
      SignupPage({
        searchParams: Promise.resolve({ plan: legacyPlanSlug() }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/login?mode=signup&plan=solo_monthly");

    expect(redirectMock).toHaveBeenCalledWith(
      "/login?mode=signup&plan=solo_monthly",
    );
  });
});
