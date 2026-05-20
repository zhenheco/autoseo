import { scanHtml } from "./scan-html";
import type {
  AuditReport,
  AuditWebsiteDeps,
  AuditWebsiteInput,
} from "./types";

export async function auditWebsite(
  input: AuditWebsiteInput,
  deps: AuditWebsiteDeps = {},
): Promise<AuditReport> {
  const fetchFn = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());

  const response = await fetchFn(input.url, {
    headers: { "User-Agent": "Mozilla/5.0 (1waySEO audit)" },
  });

  const html = await response.text();
  const issues = scanHtml({ html, pageUrl: input.url });

  return {
    id: randomUuid(),
    url: input.url,
    scannedAt: now().toISOString(),
    pagesScanned: 1,
    healthScore: 100,
    issues,
  };
}
