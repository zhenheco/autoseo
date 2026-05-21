import { NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { verifyAuditLeadUnsubscribeToken } from "@/lib/email/audit-lead-unsubscribe";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return html("Invalid unsubscribe token", 400);
  }

  let leadId: string | null;
  try {
    leadId = verifyAuditLeadUnsubscribeToken(token);
  } catch {
    return html("Invalid unsubscribe token", 400);
  }

  if (!leadId) {
    return html("Invalid unsubscribe token", 400);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("audit_lead_inquiries")
    .update({ nurture_stage: -1 })
    .eq("id", leadId)
    .select("id")
    .single();

  if (error) {
    return html("Unable to unsubscribe", 500);
  }

  return html("您已成功取消訂閱", 200);
}

function html(message: string, status: number) {
  return new NextResponse(
    `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>${escapeHtml(
      message,
    )}</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;padding:32px"><main style="max-width:560px;margin:0 auto"><h1>${escapeHtml(
      message,
    )}</h1><p>您可以關閉此頁面。</p></main></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
