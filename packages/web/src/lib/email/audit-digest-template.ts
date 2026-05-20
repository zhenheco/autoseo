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

type AuditDigestLocale = AuditDigestEmailInput["locale"];
type Copy = {
  subject: (companyName: string) => string;
  healthScore: string;
  newIssues: string;
  resolvedIssues: string;
  topRecommendations: string;
  cta: string;
  colon: string;
  openParen: string;
  closeParen: string;
};

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

const COPY: Record<AuditDigestLocale, Copy> = {
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
  "ja-JP": {
    subject: (companyName: string) => `${companyName} 週次SEO監査ダイジェスト`,
    healthScore: "ヘルススコア",
    newIssues: "今週の新規課題",
    resolvedIssues: "今週解決済み",
    topRecommendations: "優先対応の推奨事項",
    cta: "ダッシュボードを開く",
    colon: "：",
    openParen: "（",
    closeParen: "）",
  },
  "ko-KR": {
    subject: (companyName: string) => `${companyName} 주간 SEO 감사 요약`,
    healthScore: "건강 점수",
    newIssues: "이번 주 신규 이슈",
    resolvedIssues: "이번 주 해결됨",
    topRecommendations: "우선 권장 조치",
    cta: "대시보드 열기",
    colon: ": ",
    openParen: " (",
    closeParen: ")",
  },
  "de-DE": {
    subject: (companyName: string) =>
      `${companyName} wöchentlicher SEO-Audit-Bericht`,
    healthScore: "Health Score",
    newIssues: "Neue Probleme diese Woche",
    resolvedIssues: "Diese Woche gelöst",
    topRecommendations: "Wichtigste Empfehlungen",
    cta: "Dashboard öffnen",
    colon: ": ",
    openParen: " (",
    closeParen: ")",
  },
  "es-ES": {
    subject: (companyName: string) =>
      `Resumen semanal de auditoría SEO de ${companyName}`,
    healthScore: "Puntuación de salud",
    newIssues: "Nuevos problemas esta semana",
    resolvedIssues: "Problemas resueltos esta semana",
    topRecommendations: "Recomendaciones prioritarias",
    cta: "Abrir panel",
    colon: ": ",
    openParen: " (",
    closeParen: ")",
  },
  "fr-FR": {
    subject: (companyName: string) =>
      `Résumé hebdomadaire d'audit SEO de ${companyName}`,
    healthScore: "Score de santé",
    newIssues: "Nouveaux problèmes cette semaine",
    resolvedIssues: "Problèmes résolus cette semaine",
    topRecommendations: "Recommandations prioritaires",
    cta: "Ouvrir le tableau de bord",
    colon: ": ",
    openParen: " (",
    closeParen: ")",
  },
};

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
