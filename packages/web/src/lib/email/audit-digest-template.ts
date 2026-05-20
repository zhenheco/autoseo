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
  const subject = `${input.companyName} weekly audit digest`;
  const recommendations = input.topRecommendations
    .map(
      (item, index) =>
        `${index + 1}. [${item.ruleId}] ${item.page}: ${item.suggested}`,
    )
    .join("\n");
  const text = [
    `${input.companyName} weekly audit digest`,
    `${input.weekStart} - ${input.weekEnd}`,
    `Health score: ${input.delta.healthScoreCurrent} (${formatDelta(
      input.delta.healthScoreDelta,
    )})`,
    `New issues: ${input.delta.newIssues}`,
    `Resolved issues: ${input.delta.resolvedIssues}`,
    recommendations ? `Top recommendations:\n${recommendations}` : "",
    `Dashboard: ${input.dashboardUrl}`,
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
      input.companyName,
    )} weekly audit digest</h1><p style="margin:0 0 20px;color:#526070">${escapeHtml(
      input.weekStart,
    )} - ${escapeHtml(
      input.weekEnd,
    )}</p><section style="border:1px solid #d8dee8;border-radius:8px;padding:16px;margin-bottom:20px"><p style="margin:0 0 12px">Health score: <strong>${input.delta.healthScoreCurrent}</strong> (${formatDelta(
      input.delta.healthScoreDelta,
    )})</p><p style="margin:0">New issues: <strong>${
      input.delta.newIssues
    }</strong> · Resolved issues: <strong>${
      input.delta.resolvedIssues
    }</strong></p></section><ol>${htmlRecommendations}</ol><p><a href="${escapeHtml(
      input.dashboardUrl,
    )}" style="display:inline-block;background:#172033;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">Open dashboard</a></p></main></body></html>`,
  };
}

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
