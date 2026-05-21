import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../..");

describe("legacy plan grep gate", () => {
  it("keeps src literal matches limited to approved technical references", () => {
    let output = "";
    try {
      output = execFileSync(
        "grep",
        [
          "-RIn",
          "'free'\\|\"free\"\\|plan: 'free'\\|free plan\\|Free plan",
          "packages/web/src/",
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 1) {
        output = "";
      } else {
        throw error;
      }
    }

    const lines = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const allowed = lines.filter(
      (line) =>
        line.includes("ai-gateway") ||
        line.includes("openrouter") ||
        line.includes("subscription_plans"),
    );

    expect(lines).toEqual(allowed);
  });
});
