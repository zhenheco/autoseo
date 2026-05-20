import { normalizeShoplineShopHandle } from "./oauth";

const PARSE_FAILED = "shopline_shop_handle_parse_failed";
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (1waySEO bot)";
const RESERVED_MYSHOPLINE_SUBDOMAINS = new Set(["cdn", "www", "static", "img"]);

type FetchLike = typeof fetch;

function parseFailed(): Error {
  return new Error(PARSE_FAILED);
}

function normalizeCandidate(candidate: string): string {
  try {
    return normalizeShoplineShopHandle(candidate);
  } catch {
    throw parseFailed();
  }
}

function firstMatchedHandle(html: string): string | null {
  const handleMatch = /handle:\s*['"]([a-z0-9-]+)['"]/i.exec(html);
  if (handleMatch?.[1]) return handleMatch[1];

  const shopHandleMatch = /"shop_handle"\s*:\s*"([a-z0-9-]+)"/i.exec(html);
  if (shopHandleMatch?.[1]) return shopHandleMatch[1];

  const myshoplineMatches = html.matchAll(
    /https?:\/\/([a-z0-9-]+)\.myshopline\.com/gi,
  );
  for (const match of myshoplineMatches) {
    const subdomain = match[1]?.toLowerCase();
    if (subdomain && !RESERVED_MYSHOPLINE_SUBDOMAINS.has(subdomain)) {
      return subdomain;
    }
  }

  return null;
}

async function fetchHtml(url: string, fetchFn: FetchLike): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchFn(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) throw parseFailed();
    return await response.text();
  } catch {
    throw parseFailed();
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseShoplineShopHandleFromUrl(
  url: string,
  opts: { fetch?: FetchLike } = {},
): Promise<string> {
  const html = await fetchHtml(url, opts.fetch ?? fetch);
  const candidate = firstMatchedHandle(html);

  if (!candidate) throw parseFailed();

  return normalizeCandidate(candidate);
}
