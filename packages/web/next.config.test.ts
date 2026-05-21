import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type HeaderRoute = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

const require = createRequire(import.meta.url);
const nextConfig = require("./next.config.js") as {
  headers: () => Promise<HeaderRoute[]>;
};

describe("next config security headers", () => {
  it("does not apply static X-Frame-Options to the SHOPLINE admin iframe route", async () => {
    const headers = await nextConfig.headers();
    const xFrameRoutes = headers.filter((route) =>
      route.headers.some(
        (header) => header.key.toLowerCase() === "x-frame-options",
      ),
    );

    expect(xFrameRoutes).toEqual([
      expect.objectContaining({
        source: "/((?!shopline/admin(?:/.*)?$).*)",
      }),
    ]);
  });
});
