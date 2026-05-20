import { describe, expect, it } from "vitest";
import { scoreHealth } from "../src/score-health";

describe("scoreHealth", () => {
  it("returns 100 for empty issues", () => {
    expect(scoreHealth([])).toBe(100);
  });
});
