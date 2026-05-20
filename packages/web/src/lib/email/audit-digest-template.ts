export interface AuditDigestEmailInput {
  companyName: string;
  weekStart: string;
  weekEnd: string;
  delta: {
    newIssues: number;
    resolvedIssues: number;
    healthScoreCurrent: number;
    healthScoreDelta: number;
  };
  topRecommendations: Array<{
    ruleId: string;
    page: string;
    suggested: string;
  }>;
  dashboardUrl: string;
  locale: "zh-TW" | "en-US" | "ja-JP" | "ko-KR" | "de-DE" | "es-ES" | "fr-FR";
}

export function renderAuditDigestEmail(input: AuditDigestEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = COPY[input.locale] ?? COPY["zh-TW"];
  const subject = copy.subject(input.companyName);
  const recommendations = input.topRecommendations
    .map(
      (item, index) =>
        `${index + 1}. [${item.ruleId}] ${item.page}: ${item.suggested}`,
    )
    .join("\n");
  const text = [
    subject,
    `${input.weekStart} - ${input.weekEnd}`,
    `${copy.healthScore}${copy.colon}${input.delta.healthScoreCurrent}${copy.openParen}${formatDelta(
      input.delta.healthScoreDelta,
    )}${copy.closeParen}`,
    `${copy.newIssues}${copy.colon}${input.delta.newIssues}`,
    `${copy.resolvedIssues}${copy.colon}${input.delta.resolvedIssues}`,
    recommendations
      ? `${copy.topRecommendations}${copy.colon}\n${recommendations}`
      : "",
    `${copy.cta}: ${input.dashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const htmlRecommendations = input.topRecommendations
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.ruleId)}</strong> ${escapeHtml(
          item.page,
        )}<br>${escapeHtml(item.suggested)}</li>`,
    )
    .join("");

  return {
    subject,
    text,
    html: `<!doctype html><html><body><main style="font-family:Arial,sans-serif;line-height:1.5;color:#172033;max-width:640px;margin:0 auto;padding:24px"><h1 style="font-size:24px;margin:0 0 8px">${escapeHtml(
      subject,
    )}</h1><p style="margin:0 0 20px;color:#526070">${escapeHtml(
      input.weekStart,
    )} - ${escapeHtml(
      input.weekEnd,
    )}</p><section style="border:1px solid #d8dee8;border-radius:8px;padding:16px;margin-bottom:20px"><p style="margin:0 0 12px">${copy.healthScore}: <strong>${input.delta.healthScoreCurrent}</strong> (${formatDelta(
      input.delta.healthScoreDelta,
    )})</p><p style="margin:0">${copy.newIssues}: <strong>${
      input.delta.newIssues
    }</strong> · ${copy.resolvedIssues}: <strong>${
      input.delta.resolvedIssues
    }</strong></p></section><ol>${htmlRecommendations}</ol><p><a href="${escapeHtml(
      input.dashboardUrl,
    )}" style="display:inline-block;background:#172033;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">${copy.cta}</a></p></main></body></html>`,
  };
}

const COPY = {
  "zh-TW": {
    subject: (companyName: string) => `${companyName} 每週 audit 摘要`,
    healthScore: "健康分數",
    newIssues: "本週新發現",
    resolvedIssues: "本週已解決",
    topRecommendations: "優先修補建議",
    cta: "查看儀表板",
    colon: "：",
    openParen: "（",
    closeParen: "）",
  },
  "en-US": {
    subject: (companyName: string) => `${companyName} weekly SEO audit digest`,
    healthScore: "Health score",
    newIssues: "New issues",
    resolvedIssues: "Resolved issues",
    topRecommendations: "Top recommendations",
    cta: "Open dashboard",
    colon: ": ",
    openParen: " (",
    closeParen: ")",
  },
} satisfies Record<
  string,
  {
    subject: (companyName: string) => string;
    healthScore: string;
    newIssues: string;
    resolvedIssues: string;
    topRecommendations: string;
    cta: string;
    colon: string;
    openParen: string;
    closeParen: string;
  }
>;

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
