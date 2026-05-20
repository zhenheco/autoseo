import { scanHtml } from "./scan-html";
import { scoreHealth } from "./score-health";
import type {
  AuditReport,
  AuditWebsiteDeps,
  AuditWebsiteInput,
} from "./types";

export async function auditWebsite(
  input: AuditWebsiteInput,
  deps: AuditWebsiteDeps = {},
): Promise<AuditReport> {
  if (input.scope !== "single-page") {
    throw new Error(`scope_not_implemented: ${input.scope}`);
  }

  const fetchFn = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());

  let response: Response;
  try {
    response = await fetchFn(input.url, {
      headers: { "User-Agent": "Mozilla/5.0 (1waySEO audit)" },
    });
  } catch (cause) {
    throw new Error("audit_fetch_failed", { cause });
  }
  if (!response.ok) {
    throw new Error(`audit_fetch_failed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const issues = scanHtml({ html, pageUrl: input.url });

  return {
    id: randomUuid(),
    url: input.url,
    scannedAt: now().toISOString(),
    pagesScanned: 1,
    healthScore: scoreHealth(issues),
    issues,
  };
}
