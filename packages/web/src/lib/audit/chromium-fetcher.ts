export interface CloudflareBrowserRenderingFetcherOptions {
  apiUrl?: string;
  apiToken?: string;
}

export function createCloudflareBrowserRenderingFetcher(
  opts: CloudflareBrowserRenderingFetcherOptions = {},
): (input: { url: string }) => Promise<{
  lighthouseJson: unknown;
  axeJson: unknown;
}> {
  const accountId = process.env.CF_ACCOUNT_ID?.trim();
  const apiUrl =
    opts.apiUrl ??
    (accountId
      ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/audit`
      : undefined);
  const apiToken = opts.apiToken ?? process.env.CF_BROWSER_RENDERING_TOKEN;

  return async (input) => {
    if (!apiUrl || !apiToken?.trim()) {
      throw new Error("chromium_binding_not_available");
    }

    // TODO(HITL): replace this stub with Cloudflare Browser Rendering requests
    // that run Lighthouse Node API and axe-core in the paid Worker context.
    void input;
    void apiUrl;
    void apiToken;
    throw new Error("chromium_browser_rendering_api_not_implemented");
  };
}
