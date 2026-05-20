export interface AuditNurtureEmailInput {
  stage: 0 | 1 | 2;
  recipientEmail: string;
  scannedUrl: string;
  healthScore: number;
  topIssues: Array<{ ruleId: string; page: string }>;
  unsubscribeUrl: string;
  ctaUrl: string;
  locale: "zh-TW" | "en-US" | "ja-JP" | "ko-KR" | "de-DE" | "es-ES" | "fr-FR";
}

type Locale = AuditNurtureEmailInput["locale"];
type Copy = {
  greeting: string;
  scoreLabel: string;
  issuesLabel: string;
  noIssues: string;
  unsubscribe: string;
  stages: Record<
    AuditNurtureEmailInput["stage"],
    {
      subject: (score: number) => string;
      body: string;
      ctaButton: string;
    }
  >;
};

export function renderAuditNurtureEmail(input: AuditNurtureEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = COPY[input.locale] ?? COPY["zh-TW"];
  const stage = copy.stages[input.stage];
  const subject = stage.subject(input.healthScore);
  const issueLines =
    input.topIssues.length > 0
      ? input.topIssues
          .map(
            (issue, index) => `${index + 1}. [${issue.ruleId}] ${issue.page}`,
          )
          .join("\n")
      : copy.noIssues;
  const htmlIssues =
    input.topIssues.length > 0
      ? `<ol>${input.topIssues
          .map(
            (issue) =>
              `<li><strong>${escapeHtml(issue.ruleId)}</strong><br><span>${escapeHtml(
                issue.page,
              )}</span></li>`,
          )
          .join("")}</ol>`
      : `<p>${escapeHtml(copy.noIssues)}</p>`;

  const text = [
    subject,
    `${copy.greeting} ${input.recipientEmail}`,
    stage.body,
    `${copy.scoreLabel}: ${input.healthScore}/100`,
    `${copy.issuesLabel}:\n${issueLines}`,
    `${stage.ctaButton}: ${input.ctaUrl}`,
    `${copy.unsubscribe}: ${input.unsubscribeUrl}`,
  ].join("\n\n");

  const html = `<!doctype html><html><body><main style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:640px;margin:0 auto;padding:24px"><h1 style="font-size:24px;margin:0 0 12px">${escapeHtml(
    subject,
  )}</h1><p>${escapeHtml(copy.greeting)} ${escapeHtml(
    input.recipientEmail,
  )}</p><p>${escapeHtml(stage.body)}</p><section style="border:1px solid #d8dee8;border-radius:8px;padding:16px;margin:20px 0"><p style="margin:0 0 10px">${escapeHtml(
    copy.scoreLabel,
  )}: <strong>${input.healthScore}/100</strong></p><p style="margin:0;color:#526070">${escapeHtml(
    input.scannedUrl,
  )}</p></section><h2 style="font-size:18px">${escapeHtml(
    copy.issuesLabel,
  )}</h2>${htmlIssues}<p><a href="${escapeHtml(
    input.ctaUrl,
  )}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">${escapeHtml(
    stage.ctaButton,
  )}</a></p><p style="font-size:12px;color:#697586;margin-top:28px"><a href="${escapeHtml(
    input.unsubscribeUrl,
  )}" data-action="unsubscribe">${escapeHtml(copy.unsubscribe)}</a></p></main></body></html>`;

  return { subject, html, text };
}

const COPY: Record<Locale, Copy> = {
  "zh-TW": {
    greeting: "您好",
    scoreLabel: "SEO 健康分數",
    issuesLabel: "優先處理項目",
    noIssues: "這次沒有找到高優先問題。",
    unsubscribe: "取消訂閱",
    stages: {
      0: {
        subject: (score) => `您的 SEO 健檢完整報告 - ${score}/100`,
        body: "感謝您試用 1waySEO 健檢。以下是這次掃描的完整摘要與最需要先處理的 SEO 問題。",
        ctaButton: "綁定 1waySEO 自動修補",
      },
      1: {
        subject: () => "客戶案例：綁定後 30 天 SEO 進步報告",
        body: "很多 SHOPLINE 商店在綁定後，會先處理標題、描述、圖片 alt 與索引問題，再用月度監控確認成效。",
        ctaButton: "查看綁定後 30 天進步報告",
      },
      2: {
        subject: () => "需要一起看 SEO 健檢結果嗎？",
        body: "如果您想確認哪些問題最值得先修，我們可以提供一次免費諮詢，協助排出修補優先順序。",
        ctaButton: "預約免費諮詢",
      },
    },
  },
  "en-US": {
    greeting: "Hi",
    scoreLabel: "SEO health score",
    issuesLabel: "Priority issues",
    noIssues: "No high-priority issues were found in this scan.",
    unsubscribe: "Unsubscribe",
    stages: {
      0: {
        subject: (score) => `Your full SEO audit report - ${score}/100`,
        body: "Thanks for trying the 1waySEO audit. Here is the full scan summary and the SEO issues worth fixing first.",
        ctaButton: "Connect SHOPLINE for auto fixes",
      },
      1: {
        subject: () => "Customer story: SEO progress after 30 days",
        body: "Stores that connect SHOPLINE usually start with titles, descriptions, image alt text, and indexability, then track progress with monthly monitoring.",
        ctaButton: "See the 30-day progress report",
      },
      2: {
        subject: () => "Want help reviewing your SEO audit?",
        body: "If you want a second set of eyes on the highest-impact fixes, book a free consultation and we will help prioritize the next steps.",
        ctaButton: "Book a free consultation",
      },
    },
  },
  "ja-JP": {
    greeting: "こんにちは",
    scoreLabel: "SEOヘルススコア",
    issuesLabel: "優先課題",
    noIssues: "今回のスキャンでは高優先度の課題は見つかりませんでした。",
    unsubscribe: "配信停止",
    stages: {
      0: {
        subject: (score) => `SEO健診の完全レポート - ${score}/100`,
        body: "1waySEO健診をご利用いただきありがとうございます。今回のスキャン概要と先に対応すべきSEO課題をお届けします。",
        ctaButton: "SHOPLINEを連携して自動修正",
      },
      1: {
        subject: () => "導入事例：30日後のSEO改善レポート",
        body: "SHOPLINE連携後は、タイトル、説明文、画像alt、インデックス課題から修正し、月次モニタリングで成果を確認できます。",
        ctaButton: "30日改善レポートを見る",
      },
      2: {
        subject: () => "SEO健診結果を一緒に確認しませんか？",
        body: "優先して直すべき課題を確認したい場合は、無料相談で次の対応順を整理できます。",
        ctaButton: "無料相談を予約",
      },
    },
  },
  "ko-KR": {
    greeting: "안녕하세요",
    scoreLabel: "SEO 건강 점수",
    issuesLabel: "우선순위 이슈",
    noIssues: "이번 스캔에서는 높은 우선순위 이슈가 발견되지 않았습니다.",
    unsubscribe: "구독 취소",
    stages: {
      0: {
        subject: (score) => `SEO 진단 전체 보고서 - ${score}/100`,
        body: "1waySEO 진단을 이용해 주셔서 감사합니다. 이번 스캔 요약과 먼저 수정할 SEO 이슈를 보내드립니다.",
        ctaButton: "SHOPLINE 연결 후 자동 수정",
      },
      1: {
        subject: () => "고객 사례: 연결 후 30일 SEO 개선 보고서",
        body: "SHOPLINE 연결 후에는 제목, 설명, 이미지 alt, 색인 문제를 먼저 정리하고 월간 모니터링으로 성과를 확인합니다.",
        ctaButton: "30일 개선 보고서 보기",
      },
      2: {
        subject: () => "SEO 진단 결과를 함께 검토해 드릴까요?",
        body: "우선순위가 높은 수정 항목을 확인하고 싶다면 무료 상담으로 다음 단계를 정리해 드립니다.",
        ctaButton: "무료 상담 예약",
      },
    },
  },
  "de-DE": {
    greeting: "Hallo",
    scoreLabel: "SEO Health Score",
    issuesLabel: "Wichtige Probleme",
    noIssues:
      "In diesem Scan wurden keine Probleme mit hoher Priorität gefunden.",
    unsubscribe: "Abmelden",
    stages: {
      0: {
        subject: (score) =>
          `Ihr vollständiger SEO-Audit-Bericht - ${score}/100`,
        body: "Danke, dass Sie den 1waySEO Audit getestet haben. Hier ist die vollständige Zusammenfassung mit den wichtigsten SEO-Problemen.",
        ctaButton: "SHOPLINE verbinden und automatisch beheben",
      },
      1: {
        subject: () => "Kundenbeispiel: SEO-Fortschritt nach 30 Tagen",
        body: "Nach der SHOPLINE-Verbindung beginnen viele Shops mit Titeln, Beschreibungen, Bild-alt-Texten und Indexierbarkeit und messen den Fortschritt monatlich.",
        ctaButton: "30-Tage-Fortschrittsbericht ansehen",
      },
      2: {
        subject: () => "Möchten Sie Ihren SEO-Audit besprechen?",
        body: "Wenn Sie die wichtigsten nächsten Schritte priorisieren möchten, buchen Sie eine kostenlose Beratung.",
        ctaButton: "Kostenlose Beratung buchen",
      },
    },
  },
  "es-ES": {
    greeting: "Hola",
    scoreLabel: "Puntuación SEO",
    issuesLabel: "Problemas prioritarios",
    noIssues: "No se encontraron problemas de alta prioridad en este escaneo.",
    unsubscribe: "Cancelar suscripción",
    stages: {
      0: {
        subject: (score) =>
          `Tu informe completo de auditoría SEO - ${score}/100`,
        body: "Gracias por probar la auditoría de 1waySEO. Aquí tienes el resumen completo y los problemas SEO que conviene corregir primero.",
        ctaButton: "Conectar SHOPLINE para correcciones automáticas",
      },
      1: {
        subject: () => "Caso de cliente: progreso SEO tras 30 días",
        body: "Las tiendas que conectan SHOPLINE suelen empezar por títulos, descripciones, alt de imágenes e indexación, y luego monitorizan el progreso mensual.",
        ctaButton: "Ver informe de progreso de 30 días",
      },
      2: {
        subject: () => "¿Quieres revisar tu auditoría SEO?",
        body: "Si quieres priorizar las correcciones de mayor impacto, reserva una consulta gratuita y revisamos los próximos pasos.",
        ctaButton: "Reservar consulta gratuita",
      },
    },
  },
  "fr-FR": {
    greeting: "Bonjour",
    scoreLabel: "Score de santé SEO",
    issuesLabel: "Problèmes prioritaires",
    noIssues: "Aucun problème prioritaire n'a été trouvé lors de ce scan.",
    unsubscribe: "Se désabonner",
    stages: {
      0: {
        subject: (score) => `Votre rapport d'audit SEO complet - ${score}/100`,
        body: "Merci d'avoir essayé l'audit 1waySEO. Voici le résumé complet du scan et les problèmes SEO à corriger en priorité.",
        ctaButton: "Connecter SHOPLINE pour les corrections automatiques",
      },
      1: {
        subject: () => "Cas client : progrès SEO après 30 jours",
        body: "Les boutiques connectées à SHOPLINE commencent souvent par les titres, descriptions, textes alt et problèmes d'indexation, puis suivent les progrès chaque mois.",
        ctaButton: "Voir le rapport de progrès à 30 jours",
      },
      2: {
        subject: () => "Besoin d'aide pour votre audit SEO ?",
        body: "Si vous voulez prioriser les corrections à fort impact, réservez une consultation gratuite et nous définirons les prochaines étapes.",
        ctaButton: "Réserver une consultation gratuite",
      },
    },
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
