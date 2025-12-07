import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FingerprintSubmitRequest } from "@/types/fraud.types";

/**
 * 接收前端提交的裝置指紋
 * POST /api/fingerprint/submit
 */
export async function POST(request: NextRequest) {
  try {
    const body: FingerprintSubmitRequest = await request.json();
    const {
      fingerprint_hash,
      fingerprint_components,
      referral_code,
      event_type,
    } = body;

    if (!fingerprint_hash) {
      return NextResponse.json({ error: "缺少指紋資料" }, { status: 400 });
    }

    const supabase = await createClient();

    // 獲取 IP 和 User-Agent
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    // 1. 儲存或更新指紋記錄
    let fingerprintId: string;

    const { data: existingFingerprint } = await supabase
      .from("device_fingerprints")
      .select("id")
      .eq("fingerprint_hash", fingerprint_hash)
      .single();

    if (existingFingerprint) {
      fingerprintId = existingFingerprint.id;

      // 更新 last_seen_at
      await supabase
        .from("device_fingerprints")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", fingerprintId);
    } else {
      // 創建新的指紋記錄
      const { data: newFingerprint, error: createError } = await supabase
        .from("device_fingerprints")
        .insert({
          fingerprint_hash,
          fingerprint_components: fingerprint_components || null,
        })
        .select("id")
        .single();

      if (createError || !newFingerprint) {
        console.error("創建指紋記錄失敗:", createError);
        return NextResponse.json({ error: "儲存失敗" }, { status: 500 });
      }

      fingerprintId = newFingerprint.id;
    }

    // 2. 如果有推薦碼，記錄到追蹤日誌
    if (referral_code) {
      await supabase.from("referral_tracking_logs").insert({
        referral_code: referral_code.toUpperCase(),
        event_type: event_type || "click",
        device_fingerprint: fingerprint_hash,
        fingerprint_id: fingerprintId,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }

    return NextResponse.json({ success: true, fingerprint_id: fingerprintId });
  } catch (error) {
    console.error("指紋提交處理失敗:", error);
    return NextResponse.json({ error: "處理失敗" }, { status: 500 });
  }
}
